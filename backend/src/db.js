// ============================================================
// Base de données SQLite — comptes utilisateurs + stats quiz
// ============================================================
import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = path.join(__dirname, "..", "data");
mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "verdikt.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    email        TEXT    UNIQUE NOT NULL,
    username     TEXT    UNIQUE NOT NULL,
    password_hash TEXT   NOT NULL,
    avatar_color TEXT    DEFAULT '#00D4AA',
    created_at   INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS quiz_stats (
    user_id          INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    total_correct    INTEGER DEFAULT 0,
    total_wrong      INTEGER DEFAULT 0,
    total_games      INTEGER DEFAULT 0,
    total_wins       INTEGER DEFAULT 0,
    total_response_ms INTEGER DEFAULT 0,
    questions_answered INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS quiz_games (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    room_code    TEXT    UNIQUE NOT NULL,
    creator_id   INTEGER REFERENCES users(id),
    target_score INTEGER NOT NULL DEFAULT 200,
    category     TEXT    DEFAULT 'mix',
    difficulty   TEXT    DEFAULT 'moyen',
    status       TEXT    DEFAULT 'waiting',   -- waiting | playing | finished
    winner_id    INTEGER REFERENCES users(id),
    started_at   INTEGER,
    finished_at  INTEGER,
    created_at   INTEGER DEFAULT (unixepoch())
  );
`);

export default db;
