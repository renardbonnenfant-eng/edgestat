// ============================================================
// Tennis — tennisapi1.p.rapidapi.com
// Endpoints confirmés gratuits : /rankings/atp, /rankings/wta, /player/{id}
// Stats de surface/sets/rangs non disponibles sur ce plan → marquées N/A
// ============================================================
import { readCache, writeCache } from "./cache.js";
import "dotenv/config";

const KEY  = (process.env.TENNIS_RAPIDAPI_KEY || "").trim();
const HOST = (process.env.TENNIS_HOST || "tennisapi1.p.rapidapi.com").trim();
const TTL  = 12 * 60 * 60 * 1000;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function checkKey() {
  if (!KEY) throw new Error(
    "TENNIS_NON_CONFIGURÉ: Ajoute TENNIS_RAPIDAPI_KEY dans backend/.env"
  );
}

async function get(endpoint) {
  checkKey();
  const url  = `https://${HOST}/api/tennis/${endpoint}`;
  const ckey = `tennis3:${endpoint}`;

  const cached = await readCache(ckey, TTL);
  if (cached?.fresh) return cached.value;

  const res  = await fetch(url, {
    headers: { "x-rapidapi-key": KEY, "x-rapidapi-host": HOST },
  });
  const text = await res.text();

  if (text.trimStart().startsWith("<"))
    throw new Error(`HTML reçu (HTTP ${res.status}).`);

  const json = JSON.parse(text);
  if (json.message?.includes("doesn't exist"))
    throw new Error(`Endpoint invalide: /api/tennis/${endpoint}`);
  if (json.message?.includes("Too many"))
    return cached?.value ?? null;

  await writeCache(ckey, json);
  return json;
}

// ── Tournois configurés (IDs API pour affichage) ──────────────
export const TENNIS_TOURNAMENTS_CONFIG = [
  { id: "atp",  name: "ATP Tour",         surface: "hard",  flag: "🎾", gender: "M" },
  { id: "wta",  name: "WTA Tour",         surface: "hard",  flag: "🎾", gender: "F" },
  { id: "atp-rg", name: "Roland Garros",  surface: "clay",  flag: "🇫🇷", gender: "M" },
  { id: "atp-wimbledon", name: "Wimbledon", surface: "grass", flag: "🏴", gender: "M" },
  { id: "atp-uso", name: "US Open",       surface: "hard",  flag: "🇺🇸", gender: "M" },
  { id: "atp-ao",  name: "Australian Open",surface: "hard", flag: "🇦🇺", gender: "M" },
];

// ── Construction du "match" depuis les rankings ───────────────
// Prend les joueurs #1 et #2 du classement correspondant
export async function buildTennisMatch(tournamentId, _season) {
  // Détermine le type de ranking selon le tournoi
  const conf   = TENNIS_TOURNAMENTS_CONFIG.find(t => t.id === tournamentId);
  const rankType = conf?.gender === "F" ? "wta" : "atp";
  const surface  = conf?.surface || "hard";

  const data = await get(`rankings/${rankType}`);
  if (!data) throw new Error("Rate limit atteint. Réessaie dans 1 minute.");

  const rankings = data.rankings || [];
  if (rankings.length < 2) throw new Error("Données de classement insuffisantes.");

  // Prend #1 et #2 ATP/WTA comme joueurs analysés
  const buildPlayer = async (entry) => {
    const t = entry.team || {};
    await sleep(1500);
    let detail = {};
    let ptInfo = {};
    try {
      const d = await get(`player/${t.id}`);
      detail = d?.team || {};
      ptInfo = detail.playerTeamInfo || {};
    } catch {}

    const birthTs = ptInfo.birthDateTimestamp;
    const age = birthTs
      ? Math.floor((Date.now() / 1000 - birthTs) / (365.25 * 24 * 3600))
      : null;

    return {
      id:      t.id,
      name:    t.fullName || detail.fullName || t.name || "—",
      short:   t.shortName || t.name || "—",
      rank:    t.ranking || entry.ranking || "?",
      points:  entry.points || 0,
      previousRank:      entry.previousRanking    || null,
      bestRank:          entry.bestRanking         || null,
      tournamentsPlayed: entry.tournamentsPlayed   || null,
      country:     t.country?.name  || "",
      countryCode: t.country?.alpha2 || "",
      photo:   detail.playerPhoto || detail.avatar || "",
      form:    [],
      // Profil physique
      height:    ptInfo.height    || null,
      weight:    ptInfo.weight    || null,
      plays:     ptInfo.plays     || null,
      turnedPro: ptInfo.turnedPro || null,
      age,
      birthplace: ptInfo.birthplace || null,
      // Gains
      prizeCurrent:  ptInfo.prizeCurrent  || null,
      prizeTotal:    ptInfo.prizeTotal    || null,
      prizeCurrency: ptInfo.prizeCurrentRaw?.currency || "EUR",
    };
  };

  const [p1, p2] = await Promise.all([
    buildPlayer(rankings[0]),
    buildPlayer(rankings[1]),
  ]);

  return {
    tournament: conf?.name || `Classement ${rankType.toUpperCase()}`,
    surface,
    date:  new Date().toISOString().slice(0, 10),
    score: "Classement",
    isRankingView: true,
    p1, p2,
    h2h: [],
    source: `tennisapi1.p.rapidapi.com — classement ${rankType.toUpperCase()} actuel`,
  };
}

export async function getTennisTournaments() {
  return TENNIS_TOURNAMENTS_CONFIG;
}

export async function testTennisApi() {
  if (!KEY) return { configured: false, message: "TENNIS_RAPIDAPI_KEY manquante" };
  try {
    const data = await get("rankings/atp");
    const r    = data?.rankings || [];
    return {
      configured: true, ok: true,
      top3: r.slice(0, 3).map(x => ({ rank: x.team?.ranking, name: x.team?.name, points: x.points })),
    };
  } catch (e) { return { configured: true, ok: false, error: e.message }; }
}
