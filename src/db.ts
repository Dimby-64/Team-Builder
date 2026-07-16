import { Database } from "bun:sqlite";
import { join } from "path";

const db = new Database(join(import.meta.dir, "../data.db"), { create: true });

db.run("PRAGMA journal_mode=WAL");
db.run("PRAGMA foreign_keys=ON");

db.run(`
  CREATE TABLE IF NOT EXISTS pokemon (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dex_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    form TEXT,
    type1 TEXT NOT NULL,
    type2 TEXT,
    sprite_id TEXT NOT NULL,
    is_mega INTEGER DEFAULT 0,
    is_regional INTEGER DEFAULT 0,
    generation INTEGER NOT NULL
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS abilities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS pokemon_abilities (
    pokemon_id INTEGER NOT NULL REFERENCES pokemon(id),
    ability_id INTEGER NOT NULL REFERENCES abilities(id),
    is_hidden INTEGER DEFAULT 0,
    PRIMARY KEY (pokemon_id, ability_id)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS moves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('physical', 'special', 'status')),
    power INTEGER,
    accuracy INTEGER,
    pp INTEGER NOT NULL,
    description TEXT NOT NULL
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    category TEXT NOT NULL
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL DEFAULT 'My Team',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS team_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    slot INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 6),
    pokemon_id INTEGER NOT NULL REFERENCES pokemon(id),
    nickname TEXT,
    ability_id INTEGER REFERENCES abilities(id),
    item_id INTEGER REFERENCES items(id),
    UNIQUE (team_id, slot)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS team_member_moves (
    member_id INTEGER NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    move_slot INTEGER NOT NULL CHECK (move_slot BETWEEN 1 AND 4),
    move_id INTEGER NOT NULL REFERENCES moves(id),
    PRIMARY KEY (member_id, move_slot)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS pokemon_learnable_moves (
    pokemon_id INTEGER NOT NULL REFERENCES pokemon(id) ON DELETE CASCADE,
    move_id INTEGER NOT NULL REFERENCES moves(id) ON DELETE CASCADE,
    PRIMARY KEY (pokemon_id, move_id)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS pokemon_moves_cached (
    pokemon_id INTEGER PRIMARY KEY REFERENCES pokemon(id) ON DELETE CASCADE,
    cached_at TEXT DEFAULT (datetime('now'))
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS move_learners_cached (
    move_id INTEGER PRIMARY KEY REFERENCES moves(id) ON DELETE CASCADE,
    cached_at TEXT DEFAULT (datetime('now'))
  )
`);

export { db };
