// Cloudflare Worker entry point for Santiago.
//
// The same game engine and frontend as the Node server, but:
//   - games are stored in a D1 database (binding: DB) with optimistic locking
//   - email goes through the Resend HTTP API (secret: RESEND_API_KEY)
//   - static files are served from the assets binding (binding: ASSETS)
//   - the whole app lives under BASE_PATH (e.g. "/santiago" on budoludo.com)
//
// Wrangler's bundler handles the CommonJS engine/email modules.
import engine from '../lib/engine.js';
import emails from '../lib/emails.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---- storage ---------------------------------------------------------------

async function insertGame(env, game) {
  const stmts = [
    env.DB.prepare('INSERT INTO games (id, version, data, created_at) VALUES (?, 0, ?, ?)')
      .bind(game.id, JSON.stringify(game), game.createdAt),
  ];
  game.players.forEach((p, i) => {
    stmts.push(env.DB.prepare('INSERT INTO tokens (token, game_id, player_index) VALUES (?, ?, ?)')
      .bind(p.token, game.id, i));
  });
  await env.DB.batch(stmts);
}

async function loadByToken(env, token) {
  const row = await env.DB.prepare(
    'SELECT g.version AS version, g.data AS data, t.player_index AS player_index '
    + 'FROM tokens t JOIN games g ON g.id = t.game_id WHERE t.token = ?',
  ).bind(token).first();
  if (!row) return null;
  return { game: JSON.parse(row.data), version: row.version, playerIndex: row.player_index };
}

// Returns false if another request modified the game in the meantime.
async function saveGame(env, game, expectedVersion) {
  const res = await env.DB.prepare(
    'UPDATE games SET data = ?, version = version + 1 WHERE id = ? AND version = ?',
  ).bind(JSON.stringify(game), game.id, expectedVersion).run();
  return res.meta.changes === 1;
}

// ---- email -----------------------------------------------------------------

async function sendMail(env, to, { subject, text }) {
  if (!to) return;
  if (!env.RESEND_API_KEY) {
    console.log(`[mail -> ${to}] ${subject}\n${text}`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.MAIL_FROM || 'Santiago <santiago@budoludo.com>',
      to: [to],
      subject,
      text,
    }),
  });
  if (!res.ok) console.error(`Mail to ${to} failed:`, res.status, await res.text());
}

function gameLink(env, url, token) {
  const base = env.BASE_URL
    ? env.BASE_URL.replace(/\/$/, '')
    : url.origin + (env.BASE_PATH || '').replace(/\/$/, '');
  return `${base}/g/${token}`;
}

async function notifyAfterAction(env, url, game, actorIndex) {
  if (game.phase === 'gameover') {
    for (const p of game.players) {
      await sendMail(env, p.email, emails.gameOverEmail(game, p, gameLink(env, url, p.token)));
    }
  } else if (game.current !== null && game.current !== actorIndex) {
    const p = game.players[game.current];
    await sendMail(env, p.email, emails.yourTurnEmail(game, p, gameLink(env, url, p.token)));
  }
}

// ---- request handlers --------------------------------------------------------

async function createGame(request, env, ctx, url) {
  let body;
  try { body = await request.json(); } catch { body = {}; }
  const specs = Array.isArray(body.players) ? body.players : [];
  const cleaned = specs
    .map((p) => ({ name: String(p.name || '').trim(), email: String(p.email || '').trim() }))
    .filter((p) => p.name);
  let game;
  try {
    game = engine.createGame(cleaned);
  } catch (err) {
    if (err instanceof engine.EngineError) return json({ error: err.message }, 400);
    throw err;
  }
  await insertGame(env, game);
  ctx.waitUntil((async () => {
    for (const p of game.players) {
      await sendMail(env, p.email, emails.inviteEmail(game, p, gameLink(env, url, p.token)));
    }
    if (game.current !== null) {
      const p = game.players[game.current];
      await sendMail(env, p.email, emails.yourTurnEmail(game, p, gameLink(env, url, p.token)));
    }
  })());
  return json({
    id: game.id,
    links: game.players.map((p) => ({ name: p.name, color: p.color, url: `/g/${p.token}` })),
  });
}

async function getState(env, token) {
  const hit = await loadByToken(env, token);
  if (!hit) return json({ error: 'Unknown game link.' }, 404);
  return json(engine.viewFor(hit.game, hit.playerIndex));
}

async function doAction(request, env, ctx, url, token) {
  let body;
  try { body = await request.json(); } catch { body = {}; }
  // Optimistic concurrency: reload and retry if another player's request
  // landed between our read and write.
  for (let attempt = 0; attempt < 3; attempt++) {
    const hit = await loadByToken(env, token);
    if (!hit) return json({ error: 'Unknown game link.' }, 404);
    try {
      engine.applyAction(hit.game, hit.playerIndex, body);
    } catch (err) {
      if (err instanceof engine.EngineError) return json({ error: err.message }, 400);
      throw err;
    }
    if (await saveGame(env, hit.game, hit.version)) {
      ctx.waitUntil(notifyAfterAction(env, url, hit.game, hit.playerIndex));
      return json(engine.viewFor(hit.game, hit.playerIndex));
    }
  }
  return json({ error: 'The game changed while processing your move. Please try again.' }, 409);
}

function asset(env, request, url, path) {
  return env.ASSETS.fetch(new Request(new URL(path, url.origin), request));
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const base = (env.BASE_PATH || '').replace(/\/+$/, '');
    let path = url.pathname;
    if (base) {
      if (path === base) {
        // Relative asset/API URLs need the trailing slash.
        return Response.redirect(`${url.origin}${base}/${url.search}`, 301);
      }
      if (path.startsWith(`${base}/`)) {
        path = path.slice(base.length);
      }
      // Paths outside BASE_PATH (only reachable on the workers.dev preview
      // URL) are treated as if they were inside it.
    }

    try {
      if (path === '/' || path === '/index.html' || path === '/home.html') {
        return asset(env, request, url, '/home.html');
      }
      if (path === '/api/games' && request.method === 'POST') {
        return await createGame(request, env, ctx, url);
      }
      let m = path.match(/^\/api\/g\/([a-f0-9]+)\/state$/);
      if (m && request.method === 'GET') return await getState(env, m[1]);
      m = path.match(/^\/api\/g\/([a-f0-9]+)\/action$/);
      if (m && request.method === 'POST') return await doAction(request, env, ctx, url, m[1]);
      m = path.match(/^\/g\/([a-f0-9]+)$/);
      if (m) {
        if (!(await loadByToken(env, m[1]))) return new Response('Unknown game link.', { status: 404 });
        return asset(env, request, url, '/game.html');
      }
      return asset(env, request, url, path);
    } catch (err) {
      console.error(err);
      return json({ error: 'Internal error.' }, 500);
    }
  },
};
