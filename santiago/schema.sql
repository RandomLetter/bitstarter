-- D1 schema for the Cloudflare Workers deployment of Santiago.
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL DEFAULT 0,
  data TEXT NOT NULL,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS tokens (
  token TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id),
  player_index INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tokens_game ON tokens(game_id);
