// ============================================================
// Stockage JSON pur — aucune dépendance native
// Compatible Render, Heroku, Railway, etc.
// ============================================================
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = path.join(__dirname, "..", "data");
mkdirSync(DATA_DIR, { recursive: true });

const FILE = path.join(DATA_DIR, "verdikt-store.json");

// ── État en mémoire ──────────────────────────────────────────
const store = {
  users:           {},   // id → { id, email, username, password_hash, avatar_color, created_at }
  usersByEmail:    {},   // email_lc → id
  usersByUsername: {},   // username_lc → id
  stats:           {},   // id → { total_correct, total_wrong, total_games, total_wins, total_response_ms, questions_answered }
  nextId:          1,
};

// ── Persistance sur disque ───────────────────────────────────
export function persist() {
  try { writeFileSync(FILE, JSON.stringify(store), "utf8"); } catch {}
}

function load() {
  try {
    if (!existsSync(FILE)) return;
    const raw = JSON.parse(readFileSync(FILE, "utf8"));
    Object.assign(store, raw);
  } catch {}
}

load();

export default store;
