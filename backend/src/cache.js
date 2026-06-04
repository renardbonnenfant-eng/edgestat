// ============================================================
// Cache disque (fichiers JSON) avec TTL + compteur d'appels quotidien
// Objectif : rester sous les 100 requêtes/jour du tier gratuit.
// ============================================================
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, "..", "cache");

async function ensureDir() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

function keyToFile(key) {
  // nom de fichier sûr et stable à partir d'une clé arbitraire
  const hash = crypto.createHash("sha1").update(key).digest("hex").slice(0, 16);
  return path.join(CACHE_DIR, `${hash}.json`);
}

// Lit une entrée de cache. Renvoie { value, fetchedAt, age, fresh } ou null si absente.
export async function readCache(key, ttl) {
  try {
    const raw = await fs.readFile(keyToFile(key), "utf8");
    const entry = JSON.parse(raw);
    const age = Date.now() - entry.fetchedAt;
    return { ...entry, age, fresh: age < ttl };
  } catch {
    return null;
  }
}

export async function writeCache(key, value) {
  await ensureDir();
  const entry = { key, fetchedAt: Date.now(), value };
  await fs.writeFile(keyToFile(key), JSON.stringify(entry), "utf8");
  return entry;
}

// --- Compteur d'appels réels par jour (garde-fou tier gratuit) ---
const COUNTER_FILE = path.join(CACHE_DIR, "_daily-counter.json");

function todayStamp() {
  return new Date().toISOString().slice(0, 10); // AAAA-MM-JJ (UTC)
}

export async function getDailyCount() {
  try {
    const raw = await fs.readFile(COUNTER_FILE, "utf8");
    const data = JSON.parse(raw);
    return data.date === todayStamp() ? data.count : 0;
  } catch {
    return 0;
  }
}

export async function bumpDailyCount() {
  await ensureDir();
  const today = todayStamp();
  let count = 0;
  try {
    const data = JSON.parse(await fs.readFile(COUNTER_FILE, "utf8"));
    count = data.date === today ? data.count : 0;
  } catch {
    /* premier appel du jour */
  }
  count += 1;
  await fs.writeFile(COUNTER_FILE, JSON.stringify({ date: today, count }), "utf8");
  return count;
}
