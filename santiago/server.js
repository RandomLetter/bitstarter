'use strict';
const path = require('path');
const express = require('express');
const engine = require('./lib/engine');
const store = require('./lib/store');
const mailer = require('./lib/mailer');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

store.init();
mailer.init();

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

// Create a new game. Body: { players: [{ name, email }, ...] } (3-5 players).
app.post('/api/games', async (req, res) => {
  try {
    const specs = Array.isArray(req.body.players) ? req.body.players : [];
    const cleaned = specs
      .map((p) => ({ name: String(p.name || '').trim(), email: String(p.email || '').trim() }))
      .filter((p) => p.name);
    const game = engine.createGame(cleaned);
    store.add(game);

    for (const p of game.players) await mailer.sendInvite(req, game, p);
    if (game.current !== null) {
      await mailer.sendYourTurn(req, game, game.players[game.current]);
    }
    res.json({
      id: game.id,
      links: game.players.map((p) => ({ name: p.name, color: p.color, url: `/g/${p.token}` })),
    });
  } catch (err) {
    res.status(err instanceof engine.EngineError ? 400 : 500).json({ error: err.message });
  }
});

// Personal game page (the "special URL" login).
app.get('/g/:token', (req, res) => {
  if (!store.findByToken(req.params.token)) {
    res.status(404).send('Unknown game link.');
    return;
  }
  res.sendFile(path.join(__dirname, 'public', 'game.html'));
});

app.get('/api/g/:token/state', (req, res) => {
  const hit = store.findByToken(req.params.token);
  if (!hit) {
    res.status(404).json({ error: 'Unknown game link.' });
    return;
  }
  res.json(engine.viewFor(hit.game, hit.playerIndex));
});

app.post('/api/g/:token/action', async (req, res) => {
  const hit = store.findByToken(req.params.token);
  if (!hit) {
    res.status(404).json({ error: 'Unknown game link.' });
    return;
  }
  const { game, playerIndex } = hit;
  try {
    engine.applyAction(game, playerIndex, req.body || {});
    store.save(game);
  } catch (err) {
    if (err instanceof engine.EngineError) {
      res.status(400).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal error.' });
    return;
  }
  res.json(engine.viewFor(game, playerIndex));

  // Notify after responding so the actor never waits on SMTP.
  try {
    if (game.phase === 'gameover') {
      for (const p of game.players) await mailer.sendGameOver(req, game, p);
    } else if (game.current !== null && game.current !== playerIndex) {
      await mailer.sendYourTurn(req, game, game.players[game.current]);
    }
  } catch (err) {
    console.error('Notification error:', err.message);
  }
});

const port = process.env.PORT || 5000;
if (require.main === module) {
  app.listen(port, () => console.log(`Santiago listening on port ${port}`));
}
module.exports = app;
