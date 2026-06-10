'use strict';
// Santiago board game engine.
// Implements the full 7-phase round structure of Santiago (Hely & Pelek, 2003)
// as a serializable state machine suitable for asynchronous play.

const crypto = require('crypto');

const COLS = 8; // plantation squares per row
const ROWS = 6; // plantation squares per column
// Intersections of the ditch grid run 0..COLS x 0..ROWS.

const CROPS = ['banana', 'sugar', 'potato', 'bean', 'pepper'];
const CROP_LABELS = {
  banana: 'Banana', sugar: 'Sugar Cane', potato: 'Potato', bean: 'Beans', pepper: 'Red Pepper',
};
const COLORS = [
  { name: 'White', hex: '#f4f1e8' },
  { name: 'Beige', hex: '#d9b36c' },
  { name: 'Gray', hex: '#8a8f98' },
  { name: 'Black', hex: '#2e2b29' },
  { name: 'Purple', hex: '#8050a8' },
];

function shuffle(arr, rng) {
  const r = rng || Math.random;
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildTiles() {
  const tiles = [];
  for (const crop of CROPS) {
    for (let i = 0; i < 3; i++) tiles.push({ crop, planters: 1 });
    for (let i = 0; i < 6; i++) tiles.push({ crop, planters: 2 });
  }
  return tiles;
}

// ---- Edges of the ditch grid ----------------------------------------------
// An edge is identified by "h:x:y" (from intersection (x,y) to (x+1,y)) or
// "v:x:y" (from (x,y) to (x,y+1)).

function edgeKey(dir, x, y) { return `${dir}:${x}:${y}`; }

function parseEdge(key) {
  const m = /^(h|v):(\d+):(\d+)$/.exec(String(key));
  if (!m) return null;
  return { dir: m[1], x: Number(m[2]), y: Number(m[3]) };
}

function edgeInBounds(e) {
  if (!e) return false;
  if (e.dir === 'h') return e.x >= 0 && e.x < COLS && e.y >= 0 && e.y <= ROWS;
  return e.x >= 0 && e.x <= COLS && e.y >= 0 && e.y < ROWS;
}

function edgeEndpoints(e) {
  if (e.dir === 'h') return [[e.x, e.y], [e.x + 1, e.y]];
  return [[e.x, e.y], [e.x, e.y + 1]];
}

function squareEdges(c, r) {
  return [
    edgeKey('h', c, r),     // top
    edgeKey('h', c, r + 1), // bottom
    edgeKey('v', c, r),     // left
    edgeKey('v', c + 1, r), // right
  ];
}

function allEdges() {
  const out = [];
  for (let y = 0; y <= ROWS; y++) for (let x = 0; x < COLS; x++) out.push(edgeKey('h', x, y));
  for (let y = 0; y < ROWS; y++) for (let x = 0; x <= COLS; x++) out.push(edgeKey('v', x, y));
  return out;
}

// The canal network: a new canal must share an intersection with the spring
// or with an existing canal.
function networkPoints(g) {
  const pts = new Set([`${g.spring.x},${g.spring.y}`]);
  for (const key of g.canals) {
    const e = parseEdge(key);
    for (const [x, y] of edgeEndpoints(e)) pts.add(`${x},${y}`);
  }
  return pts;
}

function canalEdgeValid(g, key) {
  const e = parseEdge(key);
  if (!edgeInBounds(e)) return false;
  if (g.canals.includes(key)) return false;
  const pts = networkPoints(g);
  return edgeEndpoints(e).some(([x, y]) => pts.has(`${x},${y}`));
}

function validCanalEdges(g) {
  return allEdges().filter((k) => canalEdgeValid(g, k));
}

function isIrrigated(g, c, r) {
  return squareEdges(c, r).some((k) => g.canals.includes(k));
}

// ---- Game creation ---------------------------------------------------------

function newToken() { return crypto.randomBytes(16).toString('hex'); }

function createGame(playerSpecs, opts) {
  opts = opts || {};
  const rng = opts.rng || Math.random;
  const n = playerSpecs.length;
  if (n < 3 || n > 5) throw new EngineError('Santiago is for 3 to 5 players.');

  let tiles = shuffle(buildTiles(), rng);
  let pileCount, pileSize, rounds;
  if (n <= 4) {
    tiles = tiles.slice(0, 44); // remove one tile from the game
    pileCount = 4; pileSize = 11; rounds = 11;
  } else {
    pileCount = 5; pileSize = 9; rounds = 9;
  }
  const piles = [];
  for (let i = 0; i < pileCount; i++) piles.push(tiles.slice(i * pileSize, (i + 1) * pileSize));

  const players = playerSpecs.map((p, i) => ({
    name: String(p.name || `Player ${i + 1}`).slice(0, 40),
    email: String(p.email || '').slice(0, 120),
    token: newToken(),
    color: COLORS[i].name,
    colorHex: COLORS[i].hex,
    money: 10,
    markersLeft: 22,
    hasExtraCanal: true,
  }));

  const board = [];
  for (let r = 0; r < ROWS; r++) {
    board.push(new Array(COLS).fill(null));
  }

  const g = {
    id: crypto.randomBytes(8).toString('hex'),
    createdAt: new Date().toISOString(),
    cols: COLS,
    rows: ROWS,
    players,
    spring: opts.spring || { x: 4, y: 3 },
    board,
    canals: [],
    canalSupply: n <= 4 ? 11 : 9,
    piles,
    revealed: [],
    round: 0,
    totalRounds: rounds,
    overseerIndex: Math.floor(rng() * n),
    phase: null,
    phaseData: null,
    current: null, // player index whose action is awaited
    log: [],
    scores: null,
  };
  if (!Number.isInteger(g.spring.x) || !Number.isInteger(g.spring.y)
    || g.spring.x < 0 || g.spring.x > COLS || g.spring.y < 0 || g.spring.y > ROWS) {
    throw new EngineError('Spring must be placed on an intersection of the ditch grid.');
  }
  log(g, `Game created. ${players[g.overseerIndex].name} is the first Canal Overseer.`);
  startRound(g);
  return g;
}

class EngineError extends Error {}

function log(g, msg) {
  g.log.push({ t: new Date().toISOString(), round: g.round, msg });
}

function orderFrom(g, startExclusive) {
  // Clockwise from the player to the left of startExclusive, ending with startExclusive.
  const n = g.players.length;
  const out = [];
  for (let i = 1; i <= n; i++) out.push((startExclusive + i) % n);
  return out;
}

// ---- Round / phase flow ----------------------------------------------------

function startRound(g) {
  g.round += 1;
  g.revealed = g.piles.map((p) => p.shift() || null);
  const order = orderFrom(g, g.overseerIndex); // overseer bids last
  g.phase = 'bidding';
  g.phaseData = { order, ptr: 0, bids: {} };
  g.current = order[0];
  log(g, `Round ${g.round} of ${g.totalRounds} begins. New plantations revealed; bidding starts with ${g.players[g.current].name}.`);
}

function requireTurn(g, playerIndex) {
  if (g.phase === 'gameover') throw new EngineError('The game is over.');
  if (g.current !== playerIndex) throw new EngineError('It is not your turn.');
}

function applyAction(g, playerIndex, action) {
  requireTurn(g, playerIndex);
  const type = action && action.type;
  switch (g.phase) {
    case 'bidding': return doBid(g, playerIndex, action);
    case 'placement': return doPlace(g, playerIndex, action);
    case 'lastTile': return doLastTile(g, playerIndex, action);
    case 'bribe': return doBribe(g, playerIndex, action);
    case 'decision': return doDecision(g, playerIndex, action);
    case 'extra': return doExtra(g, playerIndex, action);
    default: throw new EngineError(`No actions available in phase "${g.phase}" (action ${type}).`);
  }
}

// Phase 1: bidding ------------------------------------------------------------

function doBid(g, pi, action) {
  const pd = g.phaseData;
  const p = g.players[pi];
  if (action.type === 'pass') {
    pd.bids[pi] = { passed: true, seq: pd.ptr };
    log(g, `${p.name} passes.`);
  } else if (action.type === 'bid') {
    const amount = Number(action.amount);
    if (!Number.isInteger(amount) || amount < 1) throw new EngineError('Bids must be at least 1 Escudo.');
    if (amount > p.money) throw new EngineError('You cannot bid more money than you have.');
    const taken = Object.values(pd.bids).some((b) => !b.passed && b.amount === amount);
    if (taken) throw new EngineError('That amount has already been bid; bids must be unique.');
    p.money -= amount; // bids always end up in the bank
    pd.bids[pi] = { passed: false, amount, seq: pd.ptr };
    log(g, `${p.name} bids ${amount} Escudos.`);
  } else {
    throw new EngineError('Bid or pass.');
  }
  pd.ptr += 1;
  if (pd.ptr < pd.order.length) {
    g.current = pd.order[pd.ptr];
    return;
  }
  resolveBidding(g);
}

function resolveBidding(g) {
  const pd = g.phaseData;
  const entries = Object.entries(pd.bids).map(([pi, b]) => ({ pi: Number(pi), ...b }));
  const passers = entries.filter((e) => e.passed);
  const bidders = entries.filter((e) => !e.passed);

  let overseer;
  if (passers.length > 0) {
    overseer = passers.reduce((a, b) => (a.seq < b.seq ? a : b)).pi; // first to pass
  } else {
    overseer = bidders.reduce((a, b) => (a.amount < b.amount ? a : b)).pi;
  }
  g.overseerIndex = overseer;
  log(g, `${g.players[overseer].name} made the lowest bid and becomes the new Canal Overseer.`);

  bidders.sort((a, b) => b.amount - a.amount);
  passers.sort((a, b) => b.seq - a.seq); // among passers, the last to pass goes first
  const placeOrder = bidders.concat(passers).map((e) => e.pi);
  const passedSet = passers.map((e) => e.pi);

  g.phase = 'placement';
  g.phaseData = { order: placeOrder, ptr: 0, passed: passedSet, highest: placeOrder[0] };
  g.current = placeOrder[0];
  log(g, `${g.players[g.current].name} chooses and places a plantation first.`);
}

// Phase 3: taking and placing tiles -------------------------------------------

function cellFree(g, c, r) {
  return Number.isInteger(c) && Number.isInteger(r)
    && c >= 0 && c < COLS && r >= 0 && r < ROWS && g.board[r][c] === null;
}

function doPlace(g, pi, action) {
  if (action.type !== 'place') throw new EngineError('Choose a plantation tile and a free square.');
  const pd = g.phaseData;
  const p = g.players[pi];
  const ti = Number(action.tileIndex);
  const tile = g.revealed[ti];
  if (!tile) throw new EngineError('That plantation tile is not available.');
  const c = Number(action.col); const r = Number(action.row);
  if (!cellFree(g, c, r)) throw new EngineError('That square is not free.');

  const passed = pd.passed.includes(pi);
  let markers = tile.planters - (passed ? 1 : 0);
  markers = Math.max(0, Math.min(markers, p.markersLeft));
  p.markersLeft -= markers;
  g.board[r][c] = {
    crop: tile.crop, planters: tile.planters,
    owner: markers > 0 ? pi : null, markers, desert: false,
  };
  g.revealed[ti] = null;
  log(g, `${p.name} places a ${CROP_LABELS[tile.crop]} plantation with ${markers} yield marker${markers === 1 ? '' : 's'}.`);

  pd.ptr += 1;
  if (pd.ptr < pd.order.length) {
    g.current = pd.order[pd.ptr];
    return;
  }
  // In a 3 player game one tile remains; the highest bidder places it as a
  // neutral tile bordering another plantation.
  if (g.revealed.some(Boolean)) {
    g.phase = 'lastTile';
    g.current = pd.highest;
    g.phaseData = { allowed: allowedNeutralSquares(g) };
    log(g, `${g.players[g.current].name} must place the remaining tile as a neutral plantation.`);
    return;
  }
  startBribe(g);
}

function allowedNeutralSquares(g) {
  const free = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (g.board[r][c] === null) free.push([c, r]);
  }
  const bordering = (c, r, pred) => [[c - 1, r], [c + 1, r], [c, r - 1], [c, r + 1]]
    .some(([cc, rr]) => rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS
      && g.board[rr][cc] !== null && pred(g.board[rr][cc]));
  let allowed = free.filter(([c, r]) => bordering(c, r, (cell) => !cell.desert));
  if (allowed.length === 0) allowed = free.filter(([c, r]) => bordering(c, r, (cell) => cell.desert));
  if (allowed.length === 0) allowed = free;
  return allowed;
}

function doLastTile(g, pi, action) {
  if (action.type !== 'place') throw new EngineError('Place the remaining tile.');
  const ti = g.revealed.findIndex(Boolean);
  const tile = g.revealed[ti];
  const c = Number(action.col); const r = Number(action.row);
  if (!g.phaseData.allowed.some(([ac, ar]) => ac === c && ar === r)) {
    throw new EngineError('The neutral tile must border an existing plantation (or desert).');
  }
  g.board[r][c] = { crop: tile.crop, planters: tile.planters, owner: null, markers: 0, desert: false };
  g.revealed[ti] = null;
  log(g, `${g.players[pi].name} places the leftover ${CROP_LABELS[tile.crop]} tile as a neutral plantation.`);
  startBribe(g);
}

// Phase 4: bribing the Canal Overseer -----------------------------------------

function startBribe(g) {
  const order = orderFrom(g, g.overseerIndex).filter((i) => i !== g.overseerIndex);
  g.phase = 'bribe';
  g.phaseData = { order, ptr: 0, proposals: [] };
  g.current = order[0];
  log(g, `Canal proposals: starting with ${g.players[g.current].name}, players may propose or support a canal for the Overseer (${g.players[g.overseerIndex].name}).`);
}

function doBribe(g, pi, action) {
  const pd = g.phaseData;
  const p = g.players[pi];
  if (action.type === 'pass') {
    log(g, `${p.name} passes on the canal proposals.`);
  } else if (action.type === 'propose') {
    const key = String(action.edge);
    const amount = Number(action.amount);
    if (!canalEdgeValid(g, key)) throw new EngineError('That is not a legal canal location (it must extend the canal network from the spring).');
    if (pd.proposals.some((pr) => pr.edge === key)) throw new EngineError('That canal has already been proposed; support it instead.');
    if (!Number.isInteger(amount) || amount < 1) throw new EngineError('A bribe must be at least 1 Escudo.');
    if (amount > p.money) throw new EngineError('You cannot offer more money than you have.');
    p.money -= amount; // held openly on the table; returned if not accepted
    pd.proposals.push({ edge: key, proposer: pi, contributions: [{ player: pi, amount }] });
    log(g, `${p.name} proposes a canal and offers a bribe of ${amount} Escudos.`);
  } else if (action.type === 'support') {
    const idx = Number(action.proposalIndex);
    const amount = Number(action.amount);
    const prop = pd.proposals[idx];
    if (!prop) throw new EngineError('No such proposal.');
    if (!Number.isInteger(amount) || amount < 1) throw new EngineError('Supporting a proposal costs at least 1 Escudo.');
    if (amount > p.money) throw new EngineError('You cannot offer more money than you have.');
    p.money -= amount;
    prop.contributions.push({ player: pi, amount });
    log(g, `${p.name} supports ${g.players[prop.proposer].name}'s proposal with ${amount} Escudos (total bribe now ${proposalTotal(prop)}).`);
  } else {
    throw new EngineError('Propose a canal, support a proposal, or pass.');
  }
  pd.ptr += 1;
  if (pd.ptr < pd.order.length) {
    g.current = pd.order[pd.ptr];
    return;
  }
  g.phase = 'decision';
  g.current = g.overseerIndex;
  log(g, `${g.players[g.overseerIndex].name} (Canal Overseer) now decides where the canal is built.`);
}

function proposalTotal(prop) {
  return prop.contributions.reduce((s, c) => s + c.amount, 0);
}

function refund(g, prop) {
  for (const c of prop.contributions) g.players[c.player].money += c.amount;
}

// Overseer's decision ----------------------------------------------------------

function doDecision(g, pi, action) {
  const pd = g.phaseData;
  const p = g.players[pi];
  const maxBribe = pd.proposals.reduce((m, pr) => Math.max(m, proposalTotal(pr)), 0);

  if (action.type === 'accept') {
    const prop = pd.proposals[Number(action.proposalIndex)];
    if (!prop) throw new EngineError('No such proposal.');
    for (const other of pd.proposals) if (other !== prop) refund(g, other);
    p.money += proposalTotal(prop);
    buildCanal(g, prop.edge);
    log(g, `${p.name} accepts ${g.players[prop.proposer].name}'s proposal and pockets the ${proposalTotal(prop)} Escudo bribe. The canal is built.`);
  } else if (action.type === 'build') {
    const key = String(action.edge);
    const cost = pd.proposals.length > 0 ? maxBribe + 1 : 1;
    if (!canalEdgeValid(g, key)) throw new EngineError('That is not a legal canal location.');
    if (p.money < cost) throw new EngineError(`Building your own canal costs ${cost} Escudos, which you cannot afford.`);
    for (const other of pd.proposals) refund(g, other);
    p.money -= cost;
    buildCanal(g, key);
    log(g, `${p.name} ignores the proposals and builds a canal of their own for ${cost} Escudos. All bribes are returned.`);
  } else if (action.type === 'decline') {
    if (pd.proposals.length > 0) throw new EngineError('There are proposals on the table: you must accept one or build your own canal.');
    log(g, `${p.name} declines to build a canal this round.`);
  } else {
    throw new EngineError('Accept a proposal, build your own canal, or decline.');
  }
  startExtra(g);
}

function buildCanal(g, key) {
  if (g.canalSupply <= 0) throw new EngineError('No canals left in the supply.');
  g.canalSupply -= 1;
  g.canals.push(key);
}

// Phase 5: extra irrigation ------------------------------------------------------

function startExtra(g) {
  const order = orderFrom(g, g.overseerIndex).filter((i) => g.players[i].hasExtraCanal);
  if (order.length === 0) {
    endOfRound(g);
    return;
  }
  g.phase = 'extra';
  g.phaseData = { order, ptr: 0 };
  g.current = order[0];
  log(g, `Extra irrigation: ${g.players[g.current].name} may place their one extra canal.`);
}

function doExtra(g, pi, action) {
  const pd = g.phaseData;
  const p = g.players[pi];
  if (action.type === 'placeExtra') {
    const key = String(action.edge);
    if (!canalEdgeValid(g, key)) throw new EngineError('That is not a legal canal location.');
    p.hasExtraCanal = false;
    g.canals.push(key); // the extra canal is the player's own piece, not from the supply
    log(g, `${p.name} places their extra canal. (Only one extra canal per round.)`);
    endOfRound(g);
    return;
  }
  if (action.type !== 'skip') throw new EngineError('Place your extra canal or skip.');
  log(g, `${p.name} keeps their extra canal for later.`);
  pd.ptr += 1;
  if (pd.ptr < pd.order.length) {
    g.current = pd.order[pd.ptr];
    return;
  }
  endOfRound(g);
}

// Phases 6 & 7 and end of game ---------------------------------------------------

function endOfRound(g) {
  if (g.round < g.totalRounds) {
    dryRound(g);
    for (const p of g.players) p.money += 3;
    log(g, 'Income: every player collects 3 Escudos.');
    startRound(g);
  } else {
    finalDryingAndScoring(g);
  }
}

function dryRound(g) {
  let dried = 0; let deserts = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const cell = g.board[r][c];
    if (!cell || cell.desert) continue;
    if (isIrrigated(g, c, r)) continue;
    if (cell.markers > 0) {
      cell.markers -= 1;
      if (cell.markers === 0) cell.owner = null;
      dried += 1;
    } else {
      g.board[r][c] = { desert: true };
      deserts += 1;
    }
  }
  if (dried || deserts) {
    log(g, `Drying: ${dried} yield marker${dried === 1 ? '' : 's'} removed; ${deserts} plantation${deserts === 1 ? '' : 's'} turned to desert.`);
  } else {
    log(g, 'Drying: every plantation is irrigated. Nothing dries out.');
  }
}

function finalDryingAndScoring(g) {
  let deserts = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const cell = g.board[r][c];
    if (!cell || cell.desert) continue;
    if (!isIrrigated(g, c, r)) {
      g.board[r][c] = { desert: true };
      deserts += 1;
    }
  }
  log(g, `Final drying: ${deserts} non-irrigated plantation${deserts === 1 ? '' : 's'} turned to desert.`);

  // Find connected areas of the same crop (orthogonal adjacency).
  const seen = [];
  for (let r = 0; r < ROWS; r++) seen.push(new Array(COLS).fill(false));
  const areas = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const cell = g.board[r][c];
    if (!cell || cell.desert || seen[r][c]) continue;
    const crop = cell.crop;
    const stack = [[c, r]];
    const tiles = [];
    seen[r][c] = true;
    while (stack.length) {
      const [cc, rr] = stack.pop();
      tiles.push([cc, rr]);
      for (const [nc, nr] of [[cc - 1, rr], [cc + 1, rr], [cc, rr - 1], [cc, rr + 1]]) {
        if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS || seen[nr][nc]) continue;
        const ncell = g.board[nr][nc];
        if (ncell && !ncell.desert && ncell.crop === crop) {
          seen[nr][nc] = true;
          stack.push([nc, nr]);
        }
      }
    }
    areas.push({ crop, tiles });
  }

  const scores = g.players.map((p, i) => ({
    player: i, name: p.name, color: p.color, cash: p.money, plantationIncome: 0, areas: [],
  }));
  for (const area of areas) {
    const markersByPlayer = new Map();
    for (const [c, r] of area.tiles) {
      const cell = g.board[r][c];
      if (cell.owner !== null && cell.markers > 0) {
        markersByPlayer.set(cell.owner, (markersByPlayer.get(cell.owner) || 0) + cell.markers);
      }
    }
    for (const [pi, markers] of markersByPlayer) {
      const gain = area.tiles.length * markers;
      scores[pi].plantationIncome += gain;
      scores[pi].areas.push({ crop: area.crop, tiles: area.tiles.length, markers, gain });
    }
  }
  for (const s of scores) {
    s.total = s.cash + s.plantationIncome;
    g.players[s.player].money = s.total;
    log(g, `${s.name}: ${s.cash} Escudos in hand + ${s.plantationIncome} from plantations = ${s.total}.`);
  }
  scores.sort((a, b) => b.total - a.total);
  g.scores = scores;
  g.phase = 'gameover';
  g.current = null;
  const best = scores[0].total;
  const winners = scores.filter((s) => s.total === best).map((s) => s.name);
  log(g, `Game over! ${winners.join(' and ')} win${winners.length === 1 ? 's' : ''} with ${best} Escudos.`);
}

// ---- Per-player view -------------------------------------------------------

function viewFor(g, playerIndex) {
  const pd = g.phaseData || {};
  const view = {
    id: g.id,
    cols: g.cols,
    rows: g.rows,
    round: g.round,
    totalRounds: g.totalRounds,
    phase: g.phase,
    current: g.current,
    overseerIndex: g.overseerIndex,
    spring: g.spring,
    board: g.board,
    canals: g.canals,
    canalSupply: g.canalSupply,
    revealed: g.revealed,
    tilesLeftInPiles: g.piles.reduce((s, p) => s + p.length, 0),
    youIndex: playerIndex,
    yourTurn: g.current === playerIndex,
    players: g.players.map((p, i) => ({
      name: p.name,
      color: p.color,
      colorHex: p.colorHex,
      markersLeft: p.markersLeft,
      hasExtraCanal: p.hasExtraCanal,
      isOverseer: i === g.overseerIndex,
      // Money is hidden information in Santiago; only show your own.
      money: i === playerIndex || g.phase === 'gameover' ? p.money : null,
    })),
    log: g.log.slice(-120),
    scores: g.scores,
  };
  if (g.phase === 'bidding') {
    view.bids = Object.entries(pd.bids).map(([pi, b]) => ({
      player: Number(pi), passed: !!b.passed, amount: b.passed ? null : b.amount,
    }));
  }
  if (g.phase === 'placement') {
    view.placementOrder = pd.order;
    view.placementPtr = pd.ptr;
    view.youPassed = pd.passed.includes(playerIndex);
  }
  if (g.phase === 'lastTile') {
    view.allowedSquares = pd.allowed;
  }
  if (g.phase === 'bribe' || g.phase === 'decision') {
    view.proposals = (pd.proposals || []).map((pr) => ({
      edge: pr.edge,
      proposer: pr.proposer,
      total: proposalTotal(pr),
      contributions: pr.contributions,
    }));
    view.maxBribe = (pd.proposals || []).reduce((m, pr) => Math.max(m, proposalTotal(pr)), 0);
  }
  if (g.phase === 'bribe' || g.phase === 'decision' || g.phase === 'extra') {
    view.validEdges = validCanalEdges(g);
  }
  return view;
}

module.exports = {
  COLS, ROWS, CROPS, CROP_LABELS, COLORS,
  createGame, applyAction, viewFor,
  canalEdgeValid, validCanalEdges, isIrrigated, allowedNeutralSquares,
  EngineError,
};
