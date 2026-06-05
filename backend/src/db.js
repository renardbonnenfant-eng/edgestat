// ============================================================
// Stockage JSON pur — aucune dépendance native
// ============================================================
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = path.join(__dirname, "..", "data");
mkdirSync(DATA_DIR, { recursive: true });

const FILE = path.join(DATA_DIR, "verdikt-store.json");

const store = {
  users:           {},
  usersByEmail:    {},
  usersByUsername: {},
  stats:           {},   // quiz stats
  pronostics:      {},   // pronostics[id] = pronostic
  nextId:          1,
  nextPronosticId: 1,
};

export function persist() {
  try { writeFileSync(FILE, JSON.stringify(store), "utf8"); } catch {}
}

function load() {
  try {
    if (!existsSync(FILE)) return;
    const raw = JSON.parse(readFileSync(FILE, "utf8"));
    Object.assign(store, raw);
    // Migrations : s'assurer que les nouveaux champs existent
    if (!store.pronostics) store.pronostics = {};
    if (!store.nextPronosticId) store.nextPronosticId = 1;
    // Migrer les utilisateurs existants
    Object.values(store.users).forEach(u => {
      if (!u.plan) u.plan = "free";
      if (!u.pronostics_count) u.pronostics_count = 0;
      if (!u.good_pronostics) u.good_pronostics = 0;
      if (!u.points_pronostics) u.points_pronostics = 0;
      if (!u.monthly_points) u.monthly_points = {};
    });
  } catch {}
}

load();

export default store;
