'use strict';
// Simple JSON-file persistence: one file per game, loaded into memory at boot.

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.SANTIAGO_DATA_DIR || path.join(__dirname, '..', 'data');

const games = new Map(); // id -> game
const byToken = new Map(); // player token -> { game, playerIndex }

function init() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  for (const file of fs.readdirSync(DATA_DIR)) {
    if (!file.endsWith('.json')) continue;
    try {
      const g = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
      index(g);
    } catch (err) {
      console.error(`Skipping unreadable game file ${file}:`, err.message);
    }
  }
}

function index(g) {
  games.set(g.id, g);
  g.players.forEach((p, i) => byToken.set(p.token, { game: g, playerIndex: i }));
}

function save(g) {
  const file = path.join(DATA_DIR, `${g.id}.json`);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(g));
  fs.renameSync(tmp, file);
}

function add(g) {
  index(g);
  save(g);
}

function findByToken(token) {
  return byToken.get(token) || null;
}

module.exports = { init, add, save, findByToken, DATA_DIR };
