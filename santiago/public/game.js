'use strict';
/* Santiago client. Polls the server for state and renders the board as SVG. */

const TOKEN = location.pathname.split('/').pop();
// Everything before "/g/<token>" is the app root ('' at the domain root,
// '/santiago' when deployed under a path prefix).
const ROOT = location.pathname.replace(/\/g\/[^/]*$/, '');
const API = `${ROOT}/api/g/${TOKEN}`;

const CROP_EMOJI = { banana: '🍌', sugar: '🎋', potato: '🥔', bean: '🫘', pepper: '🌶️' };
const CROP_FILL = {
  banana: '#f7e08a', sugar: '#bfe3a8', potato: '#e8c79a', bean: '#d9b8e8', pepper: '#f5a9a0',
};
const CROP_NAME = {
  banana: 'Banana', sugar: 'Sugar Cane', potato: 'Potato', bean: 'Beans', pepper: 'Red Pepper',
};
const PHASE_TEXT = {
  bidding: 'Phase 1 — Bidding on plantations',
  placement: 'Phase 3 — Taking and placing plantations',
  lastTile: 'Phase 3 — Placing the neutral leftover tile',
  bribe: 'Phase 4 — Bribing the Canal Overseer',
  decision: 'Phase 4 — The Canal Overseer decides',
  extra: 'Phase 5 — Extra irrigation',
  gameover: 'Game over',
};

const S = 72; // square size in px
const M = 28; // board margin

let state = null;
let stateJson = '';
// ui.mode: null | 'pickSquare' | 'pickEdge'
const ui = { mode: null, selectedTile: null, selectedEdge: null, edgePurpose: null, error: '' };

function resetUi() {
  ui.mode = null; ui.selectedTile = null; ui.selectedEdge = null; ui.edgePurpose = null;
}

async function fetchState() {
  const res = await fetch(`${API}/state`);
  if (!res.ok) {
    document.getElementById('statusbar').textContent = 'This game link is not valid.';
    return;
  }
  const data = await res.json();
  const json = JSON.stringify(data);
  if (json !== stateJson) {
    stateJson = json;
    state = data;
    resetUi();
    render();
  }
}

async function act(action) {
  ui.error = '';
  const res = await fetch(`${API}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(action),
  });
  const data = await res.json();
  if (!res.ok) {
    ui.error = data.error || 'That move is not allowed.';
    renderActions();
    return;
  }
  stateJson = JSON.stringify(data);
  state = data;
  resetUi();
  render();
}

// ---------- rendering ----------

function el(tag, attrs, text) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

function svgEl(tag, attrs) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, v);
  return node;
}

function render() {
  renderHeader();
  renderPlayers();
  renderBoard();
  renderTiles();
  renderActions();
  renderLog();
  renderScores();
}

function renderHeader() {
  const you = state.players[state.youIndex];
  document.getElementById('who').textContent =
    `You are ${you.name} (${you.color}) — ${you.money} Escudos, ${you.markersLeft} yield markers left`
    + (you.hasExtraCanal ? ', extra canal available' : '');

  const bar = document.getElementById('statusbar');
  bar.innerHTML = '';
  bar.appendChild(el('span', {}, state.phase === 'gameover'
    ? 'Final result'
    : `Round ${state.round} / ${state.totalRounds}`));
  bar.appendChild(el('span', {}, PHASE_TEXT[state.phase] || state.phase));
  if (state.phase !== 'gameover') {
    const turn = el('span', { class: state.yourTurn ? 'turn yours' : 'turn' },
      state.yourTurn ? '➤ It is YOUR turn' : `Waiting for ${state.players[state.current].name}…`);
    bar.appendChild(turn);
  }
}

function renderPlayers() {
  const ul = document.getElementById('players');
  ul.innerHTML = '';
  state.players.forEach((p, i) => {
    const li = el('li', { class: i === state.current ? 'active' : '' });
    const sw = el('span', { class: 'swatch' });
    sw.style.background = p.colorHex;
    li.appendChild(sw);
    li.appendChild(el('span', {},
      `${p.name}${i === state.youIndex ? ' (you)' : ''}${p.isOverseer ? ' 👷' : ''}`));
    const money = p.money === null ? 'hidden' : `${p.money} Esc.`;
    li.appendChild(el('span', { class: 'meta' },
      `${money} · ${p.markersLeft} markers${p.hasExtraCanal ? ' · extra canal' : ''}`));
    ul.appendChild(li);
  });
  document.getElementById('supply').textContent =
    `Canal supply: ${state.canalSupply} · 👷 = Canal Overseer`;
}

function edgeCoords(key) {
  const [dir, xs, ys] = key.split(':');
  const x = Number(xs); const y = Number(ys);
  const x1 = M + x * S; const y1 = M + y * S;
  if (dir === 'h') return [x1, y1, x1 + S, y1];
  return [x1, y1, x1, y1 + S];
}

function renderBoard() {
  const svg = document.getElementById('board');
  const W = M * 2 + state.cols * S;
  const H = M * 2 + state.rows * S;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', W);
  svg.setAttribute('height', H);
  svg.innerHTML = '';

  svg.appendChild(svgEl('rect', { x: 0, y: 0, width: W, height: H, fill: '#ecd9a8', rx: 12 }));

  // Squares (plantation fields)
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const x = M + c * S; const y = M + r * S;
      const cell = state.board[r][c];
      const g = svgEl('g', {});
      if (cell && cell.desert) {
        g.appendChild(svgEl('rect', { x: x + 3, y: y + 3, width: S - 6, height: S - 6, rx: 6, fill: '#b09464' }));
        const t = svgEl('text', { x: x + S / 2, y: y + S / 2 + 7, 'text-anchor': 'middle', 'font-size': 20 });
        t.textContent = '🏜️';
        g.appendChild(t);
      } else if (cell) {
        g.appendChild(svgEl('rect', {
          x: x + 3, y: y + 3, width: S - 6, height: S - 6, rx: 6,
          fill: CROP_FILL[cell.crop], stroke: '#8a6a3a', 'stroke-width': 1.5,
        }));
        const t = svgEl('text', { x: x + S / 2, y: y + S / 2 + 2, 'text-anchor': 'middle', 'font-size': 24 });
        t.textContent = CROP_EMOJI[cell.crop];
        g.appendChild(t);
        // yield markers
        for (let m = 0; m < cell.markers; m++) {
          g.appendChild(svgEl('circle', {
            cx: x + S - 14 - m * 16, cy: y + S - 13, r: 7,
            fill: state.players[cell.owner].colorHex, stroke: '#3a2c1a', 'stroke-width': 1.5,
          }));
        }
        if (cell.owner === null && cell.markers === 0) {
          const n = svgEl('text', { x: x + S - 10, y: y + S - 8, 'text-anchor': 'end', 'font-size': 10, fill: '#6a5a3a' });
          n.textContent = 'neutral';
          g.appendChild(n);
        }
      } else {
        g.appendChild(svgEl('rect', {
          x: x + 3, y: y + 3, width: S - 6, height: S - 6, rx: 6,
          fill: '#f4e6bd', stroke: '#d8c08a', 'stroke-width': 1,
        }));
      }
      svg.appendChild(g);
    }
  }

  // Highlight squares the player may click
  const targets = squareTargets();
  for (const [c, r] of targets) {
    const x = M + c * S; const y = M + r * S;
    const hit = svgEl('rect', {
      x: x + 3, y: y + 3, width: S - 6, height: S - 6, rx: 6,
      fill: 'rgba(46,125,79,0.25)', stroke: '#2e7d4f', 'stroke-width': 2,
      class: 'square-hit',
    });
    hit.addEventListener('click', () => onSquareClick(c, r));
    svg.appendChild(hit);
  }

  // Canals
  for (const key of state.canals) {
    const [x1, y1, x2, y2] = edgeCoords(key);
    svg.appendChild(svgEl('line', {
      x1, y1, x2, y2, stroke: '#2a7fb8', 'stroke-width': 9, 'stroke-linecap': 'round',
    }));
  }

  // Current proposals (dashed, in proposer color)
  for (const prop of state.proposals || []) {
    const [x1, y1, x2, y2] = edgeCoords(prop.edge);
    svg.appendChild(svgEl('line', {
      x1, y1, x2, y2,
      stroke: state.players[prop.proposer].colorHex,
      'stroke-width': 7, 'stroke-dasharray': '10 6', 'stroke-linecap': 'round',
    }));
    svg.appendChild(svgEl('line', {
      x1, y1, x2, y2, stroke: '#3a2c1a', 'stroke-width': 1, 'stroke-dasharray': '10 6',
    }));
  }

  // Selected edge (pending action)
  if (ui.selectedEdge) {
    const [x1, y1, x2, y2] = edgeCoords(ui.selectedEdge);
    svg.appendChild(svgEl('line', {
      x1, y1, x2, y2, stroke: '#2e7d4f', 'stroke-width': 9, 'stroke-linecap': 'round',
    }));
  }

  // Edge click targets when picking a canal location
  if (ui.mode === 'pickEdge') {
    for (const key of edgeTargets()) {
      const [x1, y1, x2, y2] = edgeCoords(key);
      const t = 12; // hit-area thickness
      const hit = svgEl('rect', {
        x: Math.min(x1, x2) - (x1 === x2 ? t / 2 : 4),
        y: Math.min(y1, y2) - (y1 === y2 ? t / 2 : 4),
        width: x1 === x2 ? t : S + 8,
        height: y1 === y2 ? t : S + 8,
        rx: 6,
        fill: key === ui.selectedEdge ? 'rgba(46,125,79,0.9)' : 'rgba(46,125,79,0.35)',
        class: 'edge-hit',
      });
      hit.addEventListener('click', () => { ui.selectedEdge = key; renderBoard(); renderActions(); });
      svg.appendChild(hit);
    }
  }

  // Spring
  const sx = M + state.spring.x * S; const sy = M + state.spring.y * S;
  svg.appendChild(svgEl('circle', { cx: sx, cy: sy, r: 13, fill: '#2a7fb8', stroke: '#fff', 'stroke-width': 3 }));
  const drop = svgEl('text', { x: sx, y: sy + 5, 'text-anchor': 'middle', 'font-size': 13 });
  drop.textContent = '💧';
  svg.appendChild(drop);
}

function squareTargets() {
  if (!state.yourTurn) return [];
  if (state.phase === 'placement' && ui.selectedTile !== null) {
    const out = [];
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) if (state.board[r][c] === null) out.push([c, r]);
    }
    return out;
  }
  if (state.phase === 'lastTile') return state.allowedSquares || [];
  return [];
}

function edgeTargets() {
  const valid = state.validEdges || [];
  if (ui.edgePurpose === 'propose') {
    const proposed = new Set((state.proposals || []).map((p) => p.edge));
    return valid.filter((k) => !proposed.has(k));
  }
  return valid;
}

function onSquareClick(c, r) {
  if (state.phase === 'placement') {
    act({ type: 'place', tileIndex: ui.selectedTile, col: c, row: r });
  } else if (state.phase === 'lastTile') {
    act({ type: 'place', col: c, row: r });
  }
}

function renderTiles() {
  const wrap = document.getElementById('tiles');
  wrap.innerHTML = '';
  const selectable = state.yourTurn && state.phase === 'placement';
  state.revealed.forEach((tile, i) => {
    const card = el('div', { class: 'tile-card' + (tile ? '' : ' gone') });
    if (tile) {
      card.style.background = CROP_FILL[tile.crop];
      card.appendChild(el('span', { class: 'planters' }, '👤'.repeat(tile.planters)));
      card.appendChild(el('span', { class: 'emoji' }, CROP_EMOJI[tile.crop]));
      card.appendChild(el('span', {}, CROP_NAME[tile.crop]));
      if (selectable) {
        card.classList.add('selectable');
        if (ui.selectedTile === i) card.classList.add('selected');
        card.onclick = () => {
          ui.selectedTile = ui.selectedTile === i ? null : i;
          renderTiles(); renderBoard(); renderActions();
        };
      }
    } else {
      card.appendChild(el('span', {}, 'taken'));
    }
    wrap.appendChild(card);
  });
  document.getElementById('tiles-card').hidden = state.phase === 'gameover';
}

function renderActions() {
  const box = document.getElementById('actions');
  box.innerHTML = '';
  const add = (node) => box.appendChild(node);
  const group = () => { const g = el('div', { class: 'action-group' }); add(g); return g; };
  const hint = (txt) => add(el('p', { class: 'hint' }, txt));
  const you = state.players[state.youIndex];

  if (ui.error) add(el('p', { class: 'error' }, ui.error));

  if (state.phase === 'gameover') {
    hint('The game is over — final scores are shown below.');
    return;
  }

  // Public bid information
  if (state.phase === 'bidding' && state.bids && state.bids.length) {
    add(el('p', {}, 'Bids so far: ' + state.bids
      .map((b) => `${state.players[b.player].name}: ${b.passed ? 'pass' : `${b.amount} Esc.`}`)
      .join(' · ')));
  }

  if (!state.yourTurn) {
    hint(`Waiting for ${state.players[state.current].name}. This page refreshes automatically; you will also get an email when it is your turn.`);
    renderProposalList(box, false);
    return;
  }

  switch (state.phase) {
    case 'bidding': {
      hint('Bid Escudos for a better pick of the plantations — or pass. The lowest bid (or first pass) becomes Canal Overseer. Bids must be unique and are paid to the bank.');
      const g = group();
      const input = el('input', { type: 'number', min: 1, max: you.money, value: 1 });
      g.appendChild(input);
      const bid = el('button', {}, 'Bid');
      bid.onclick = () => act({ type: 'bid', amount: Number(input.value) });
      g.appendChild(bid);
      const pass = el('button', { class: 'secondary' }, 'Pass');
      pass.onclick = () => act({ type: 'pass' });
      g.appendChild(pass);
      break;
    }
    case 'placement': {
      if (state.youPassed) hint('You passed, so your plantation gets one yield marker fewer than its planters.');
      hint(ui.selectedTile === null
        ? 'Select one of the available plantation tiles above, then click a free square on the board.'
        : 'Now click a highlighted square on the board to place the plantation.');
      break;
    }
    case 'lastTile': {
      hint('As highest bidder you must place the leftover tile as a neutral plantation on a highlighted square.');
      break;
    }
    case 'bribe': {
      hint('Propose a canal (with a bribe of at least 1 Escudo), support an existing proposal, or pass. The Overseer will pick at most one canal.');
      renderProposalList(box, true);
      const g = group();
      if (ui.edgePurpose !== 'propose') {
        const b = el('button', {}, 'Propose a canal…');
        b.onclick = () => {
          ui.mode = 'pickEdge'; ui.edgePurpose = 'propose'; ui.selectedEdge = null;
          renderBoard(); renderActions();
        };
        g.appendChild(b);
      } else {
        g.appendChild(el('span', {}, ui.selectedEdge
          ? 'Bribe for this canal:'
          : 'Click a highlighted edge on the board, then set your bribe.'));
        if (ui.selectedEdge) {
          const input = el('input', { type: 'number', min: 1, max: you.money, value: 1 });
          g.appendChild(input);
          const ok = el('button', {}, 'Offer bribe');
          ok.onclick = () => act({ type: 'propose', edge: ui.selectedEdge, amount: Number(input.value) });
          g.appendChild(ok);
        }
        const cancel = el('button', { class: 'secondary' }, 'Cancel');
        cancel.onclick = () => { resetUi(); renderBoard(); renderActions(); };
        g.appendChild(cancel);
      }
      const pass = el('button', { class: 'secondary' }, 'Pass');
      pass.onclick = () => act({ type: 'pass' });
      g.appendChild(pass);
      break;
    }
    case 'decision': {
      const cost = (state.proposals && state.proposals.length) ? state.maxBribe + 1 : 1;
      hint(state.proposals && state.proposals.length
        ? `You are the Canal Overseer. Accept one proposal (you keep its bribe) or build your own canal for ${cost} Escudos.`
        : 'Everyone passed. You may build a canal anywhere for 1 Escudo, or decline.');
      renderProposalList(box, false, true);
      const g = group();
      if (ui.edgePurpose !== 'own') {
        const b = el('button', {}, `Build my own canal (${cost} Esc.)…`);
        b.disabled = you.money < cost;
        b.onclick = () => {
          ui.mode = 'pickEdge'; ui.edgePurpose = 'own'; ui.selectedEdge = null;
          renderBoard(); renderActions();
        };
        g.appendChild(b);
      } else {
        g.appendChild(el('span', {}, ui.selectedEdge
          ? `Build here for ${cost} Escudos?`
          : 'Click a highlighted edge on the board.'));
        if (ui.selectedEdge) {
          const ok = el('button', {}, 'Build canal');
          ok.onclick = () => act({ type: 'build', edge: ui.selectedEdge });
          g.appendChild(ok);
        }
        const cancel = el('button', { class: 'secondary' }, 'Cancel');
        cancel.onclick = () => { resetUi(); renderBoard(); renderActions(); };
        g.appendChild(cancel);
      }
      if (!state.proposals || state.proposals.length === 0) {
        const d = el('button', { class: 'secondary' }, 'No canal this round');
        d.onclick = () => act({ type: 'decline' });
        g.appendChild(d);
      }
      break;
    }
    case 'extra': {
      hint('You may place your one-time extra canal now, free of charge — or save it for a later round.');
      const g = group();
      if (ui.edgePurpose !== 'extra') {
        const b = el('button', {}, 'Place extra canal…');
        b.onclick = () => {
          ui.mode = 'pickEdge'; ui.edgePurpose = 'extra'; ui.selectedEdge = null;
          renderBoard(); renderActions();
        };
        g.appendChild(b);
      } else if (ui.selectedEdge) {
        const ok = el('button', {}, 'Confirm placement');
        ok.onclick = () => act({ type: 'placeExtra', edge: ui.selectedEdge });
        g.appendChild(ok);
        const cancel = el('button', { class: 'secondary' }, 'Cancel');
        cancel.onclick = () => { resetUi(); renderBoard(); renderActions(); };
        g.appendChild(cancel);
      } else {
        g.appendChild(el('span', {}, 'Click a highlighted edge on the board.'));
        const cancel = el('button', { class: 'secondary' }, 'Cancel');
        cancel.onclick = () => { resetUi(); renderBoard(); renderActions(); };
        g.appendChild(cancel);
      }
      const skip = el('button', { class: 'secondary' }, 'Keep it for later');
      skip.onclick = () => act({ type: 'skip' });
      g.appendChild(skip);
      break;
    }
  }
}

function renderProposalList(box, withSupport, withAccept) {
  if (!state.proposals || state.proposals.length === 0) return;
  const you = state.players[state.youIndex];
  const ul = el('ul', { class: 'proposal-list' });
  state.proposals.forEach((prop, i) => {
    const li = el('li', {});
    li.appendChild(el('span', {},
      `${state.players[prop.proposer].name}'s canal proposal — total bribe ${prop.total} Esc. (`
      + prop.contributions.map((c) => `${state.players[c.player].name}: ${c.amount}`).join(', ')
      + ') '));
    if (withSupport && state.yourTurn) {
      const input = el('input', { type: 'number', min: 1, max: you.money, value: 1 });
      li.appendChild(input);
      const b = el('button', { class: 'secondary' }, 'Support');
      b.onclick = () => act({ type: 'support', proposalIndex: i, amount: Number(input.value) });
      li.appendChild(b);
    }
    if (withAccept && state.yourTurn) {
      const b = el('button', {}, `Accept (take ${prop.total} Esc.)`);
      b.onclick = () => act({ type: 'accept', proposalIndex: i });
      li.appendChild(b);
    }
    ul.appendChild(li);
  });
  box.appendChild(ul);
}

function renderLog() {
  const box = document.getElementById('log');
  box.innerHTML = '';
  const entries = state.log.slice().reverse();
  for (const entry of entries) {
    const p = el('p', { style: 'margin:0.2rem 0' });
    p.appendChild(el('span', { class: 'round-tag' }, `R${entry.round} `));
    p.appendChild(document.createTextNode(entry.msg));
    box.appendChild(p);
  }
}

function renderScores() {
  const card = document.getElementById('scores-card');
  if (state.phase !== 'gameover' || !state.scores) {
    card.hidden = true;
    return;
  }
  card.hidden = false;
  card.innerHTML = '';
  card.appendChild(el('h3', { style: 'margin-top:0' }, '🏆 Final scores'));
  const table = el('table', { class: 'scores' });
  table.innerHTML = '<thead><tr><th>#</th><th>Player</th><th>Cash</th><th>Plantations</th><th>Total</th></tr></thead>';
  const tbody = el('tbody', {});
  state.scores.forEach((s, i) => {
    const tr = el('tr', {});
    tr.appendChild(el('td', {}, String(i + 1)));
    tr.appendChild(el('td', {}, `${s.name} (${s.color})`));
    tr.appendChild(el('td', {}, String(s.cash)));
    tr.appendChild(el('td', {}, String(s.plantationIncome)));
    tr.appendChild(el('td', {}, String(s.total)));
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  card.appendChild(table);
}

fetchState();
setInterval(fetchState, 4000);
