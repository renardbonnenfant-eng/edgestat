// ============================================================
// Agrégation : API-Football  →  payload "mkTeam-ready"
// Toutes les statistiques sont calculées sur les 365 derniers jours
// (saison N + saison N-1 filtrées par date). Ce sont des FRÉQUENCES
// HISTORIQUES, jamais des prédictions.
// ============================================================
import { LEAGUES, TTL, currentSeason } from "./config.js";
import { apiGet } from "./apiFootball.js";

const FINISHED = new Set(["FT", "AET", "PEN"]);
const YEAR_MS  = 365 * 24 * 60 * 60 * 1000;
const sleep    = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Helpers d'affichage ---------------------------------------------------

function shortFromName(name = "") {
  const words = name.replace(/[^\p{L}\s]/gu, " ").split(/\s+/).filter(Boolean);
  const skip = new Set(["fc", "cf", "ac", "as", "sc", "ss", "us", "rc", "de", "of", "the"]);
  const initials = words
    .filter((w) => !skip.has(w.toLowerCase()))
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
  if (initials.length >= 2) return initials.slice(0, 4);
  return (name.replace(/\s/g, "").slice(0, 3) || "?").toUpperCase();
}

const FR_DATE = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short", day: "numeric", month: "long", timeZone: "Europe/Paris",
});
const FR_TIME = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris",
});

function formatKickoff(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${FR_DATE.format(d).replace(/^./, (c) => c.toUpperCase())} — ${FR_TIME.format(d)}`;
}

function round1(n) { return Math.round(n * 10) / 10; }
function pct(n, total) { return total > 0 ? Math.round((n / total) * 100) : 0; }

// --- Stats d'équipe sur les 365 derniers jours ----------------------------

function teamStatsFromFixtures(fixtures, teamId, side, days = 365, cutoffMs = null) {
  // cutoffMs = null → calculé depuis days ; cutoffMs = 0 → tous les matchs (saison entière)
  const cutoff = cutoffMs !== null ? cutoffMs : Date.now() - days * 24 * 60 * 60 * 1000;
  const games = fixtures
    .filter((f) =>
      FINISHED.has(f.fixture?.status?.short) &&
      new Date(f.fixture.date).getTime() >= cutoff
    )
    .sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));

  const per = games.map((f) => {
    const isHome = f.teams.home.id === teamId;
    const gf = isHome ? f.goals.home : f.goals.away;
    const ga = isHome ? f.goals.away : f.goals.home;
    const res = gf > ga ? "W" : gf < ga ? "L" : "D";
    return { isHome, gf: gf ?? 0, ga: ga ?? 0, res };
  });

  const total = per.length || 1;
  const sumFor     = per.reduce((s, g) => s + g.gf, 0);
  const sumAgainst = per.reduce((s, g) => s + g.ga, 0);

  const form = per.slice(-5).map((g) => g.res);

  const venue = per.filter((g) => (side === "home" ? g.isHome : !g.isHome));
  const totalV = venue.length || 1;
  const rec = {
    w: venue.filter((g) => g.res === "W").length,
    d: venue.filter((g) => g.res === "D").length,
    l: venue.filter((g) => g.res === "L").length,
  };

  // Répartition des buts marqués
  const c0  = per.filter((g) => g.gf === 0).length;
  const c1  = per.filter((g) => g.gf === 1).length;
  const c2  = per.filter((g) => g.gf === 2).length;
  const c3p = per.filter((g) => g.gf >= 3).length;
  const c4p = per.filter((g) => g.gf >= 4).length;

  // Écarts de victoires/défaites (sur matchs du côté concerné)
  const wins   = venue.filter((g) => g.res === "W");
  const losses = venue.filter((g) => g.res === "L");
  const margins = {
    winBy:  [1, 2, 3].map((n) => ({
      label: n < 3 ? `${n} but` : "3+ buts",
      pct: pct(wins.filter((g) => (n < 3 ? g.gf - g.ga === n : g.gf - g.ga >= n)).length, totalV),
    })),
    loseBy: [1, 2, 3].map((n) => ({
      label: n < 3 ? `${n} but` : "3+ buts",
      pct: pct(losses.filter((g) => (n < 3 ? g.ga - g.gf === n : g.ga - g.gf >= n)).length, totalV),
    })),
  };

  // Double Chance : ne pas perdre (W+D) / ne pas gagner (D+L)
  const doubleChance = {
    notLosing: pct(venue.filter((g) => g.res !== "L").length, totalV), // 1N ou N2
    notWinning: pct(venue.filter((g) => g.res !== "W").length, totalV),
  };

  // BTTS, clean sheet, failed to score, over 2.5 (sur tous les matchs)
  const btts          = pct(per.filter((g) => g.gf > 0 && g.ga > 0).length, total);
  const cleanSheet    = pct(per.filter((g) => g.ga === 0).length, total);
  const failedToScore = pct(per.filter((g) => g.gf === 0).length, total);
  const over25        = pct(per.filter((g) => g.gf + g.ga > 2.5).length, total);

  return {
    form,
    rec,
    avgFor:      round1(sumFor / total),
    avgAgainst:  round1(sumAgainst / total),
    dist: [pct(c0, total), pct(c1, total), pct(c2, total), pct(c3p, total)],
    p4:   pct(c4p, total),
    sampleSize: per.length,
    margins,
    doubleChance,
    btts,
    cleanSheet,
    failedToScore,
    over25,
  };
}

function buildAllPeriods(fixtures, teamId, side) {
  return {
    365:    teamStatsFromFixtures(fixtures, teamId, side, 365),
    182:    teamStatsFromFixtures(fixtures, teamId, side, 182),
    90:     teamStatsFromFixtures(fixtures, teamId, side, 90),
  };
}

// Stats sur la saison en cours uniquement (tous les matchs de sN, sans filtre date)
function buildSeasonStats(seasonFixtures, teamId, side) {
  return teamStatsFromFixtures(seasonFixtures, teamId, side, 365, 0);
}

// Répartition des buts par tranche de 15 min (depuis teams/statistics)
function minuteGoalsFromStats(stats) {
  const SLOTS = ["0-15", "16-30", "31-45", "46-60", "61-75", "76-90", "91-105"];
  const forMin  = stats?.goals?.for?.minute  || {};
  const agMin   = stats?.goals?.against?.minute || {};
  const parse   = (obj, slot) => ({
    label: slot === "91-105" ? "90+" : slot,
    total: obj[slot]?.total ?? 0,
    pct:   parseFloat(obj[slot]?.percentage) || 0,
  });
  return {
    for:     SLOTS.map((s) => parse(forMin, s)),
    against: SLOTS.map((s) => parse(agMin, s)),
  };
}

// --- Buteurs : fusion des deux saisons, filtre 365 j, dédupliqué par joueur
function scorersForTeam(scorersN, scorersN1, teamId, limit) {
  const cutoff = Date.now() - YEAR_MS;
  const byPlayer = new Map();

  for (const list of [scorersN, scorersN1]) {
    for (const p of list) {
      const st = p.statistics?.[0];
      if (!st || st.team?.id !== teamId) continue;
      const id = p.player?.id;
      if (!id) continue;
      // on ne conserve que si le joueur a joué dans la fenêtre 365 j
      // (on ne peut pas filtrer exactement sans les dates de chaque but → on garde les deux saisons)
      if (byPlayer.has(id)) {
        const existing = byPlayer.get(id);
        existing.scored  += st.goals?.total  ?? 0;
        existing.played  += st.games?.appearences ?? 0;
      } else {
        byPlayer.set(id, {
          name:   p.player?.name || "—",
          scored: st.goals?.total  ?? 0,
          played: st.games?.appearences ?? 0,
        });
      }
    }
  }

  return [...byPlayer.values()]
    .filter((s) => s.scored > 0)
    .sort((a, b) => b.scored - a.scored)
    .slice(0, limit);
}

// --- Penalties : saison principale seulement (endpoint agrégé par saison)
function penaltyFromStats(stats) {
  const pen = stats?.penalty || {};
  return {
    awarded:  pen.total ?? 0,
    scored:   pen.scored?.total ?? 0,
    played:   stats?.fixtures?.played?.total ?? 0,
    conceded: null,
  };
}

// --- Match vedette ---------------------------------------------------------

async function resolveFixture(league, season) {
  for (const s of [season, season - 1]) {
    // Sans paramètre "last" : tous les matchs de la saison (terminés + à venir)
    const rows = await apiGet(
      "fixtures",
      { league: league.apiId, season: s },
      TTL.nextFixture
    );
    const upcoming = rows
      .filter((f) => f.fixture?.status?.short === "NS")
      .sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date))
      .slice(0, 20);
    const finished = rows
      .filter((f) => FINISHED.has(f.fixture?.status?.short))
      .sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date));
    const toRow = (f, status) => ({
      id:     f.fixture.id,
      date:   f.fixture.date,
      round:  f.league?.round || "",
      home:   { id: f.teams.home.id, name: f.teams.home.name, logo: f.teams.home.logo || "" },
      away:   { id: f.teams.away.id, name: f.teams.away.name, logo: f.teams.away.logo || "" },
      score:  status === "past" ? `${f.goals.home ?? "?"} - ${f.goals.away ?? "?"}` : null,
      status,
    });

    if (finished.length) {
      return {
        fx: finished[0],
        season: s,
        recentFixtures: [
          ...upcoming.map((f) => toRow(f, "upcoming")),
          ...finished.map((f) => toRow(f, "past")),
        ],
      };
    }

    // Pas de matchs terminés mais des matchs à venir (ex : CdM 2026 avant le tournoi)
    if (upcoming.length) {
      return {
        fx: upcoming[0],
        season: s,
        recentFixtures: upcoming.map((f) => toRow(f, "upcoming")),
      };
    }
  }
  return null;
}

// --- Construction d'une ligue (11 appels séquentiels, 2 s d'écart) --------

// Construit les stats pour un fixtureId précis (appelé depuis /api/match).
// Cherche le match dans le cache de la ligue pour éviter un appel API.
export async function buildLeagueForFixture(league, fixtureId, season) {
  // Respecte la saison fixe de la config (ex : WC 2026, Euro 2024, Copa 2024)
  const effectiveSeason = league.season || season;
  for (const s of [effectiveSeason, effectiveSeason - 1]) {
    const rows = await apiGet(
      "fixtures",
      { league: league.apiId, season: s },
      TTL.nextFixture
    );
    const fx = rows.find((f) => f.fixture.id === Number(fixtureId));
    if (fx) return buildLeagueFromFixture(league, fx, s);
  }
  throw new Error(`Fixture ${fixtureId} introuvable pour ${league.country}.`);
}

async function buildLeague(league, season) {
  // Les compétitions avec saison figée (WC, Euro…) utilisent leur propre saison
  const effectiveSeason = league.season || season;
  const resolved = await resolveFixture(league, effectiveSeason);
  if (!resolved) {
    throw new Error(`Aucun match trouvé pour ${league.country} (saisons ${effectiveSeason} et ${effectiveSeason - 1}).`);
  }
  const { fx, season: sN, recentFixtures } = resolved;
  const result = await buildLeagueFromFixture(league, fx, sN);
  result.recentFixtures = recentFixtures;
  return result;
}

async function buildLeagueFromFixture(league, fx, sN) {
  const sN1 = sN - 1;
  const home = fx.teams.home;
  const away = fx.teams.away;

  // En mode compétition uniquement (coupes européennes) :
  // - les stats d'équipe sont filtrées sur cette seule compétition
  // - on ne charge qu'une seule saison (parcours de l'année en cours)
  const euroOnly = !!league.competitionOnly;
  const teamFilter = euroOnly ? { league: league.apiId } : {};

  // Appels parallèles — si tout est en cache : quasi-instantané
  const [
    homeFxN, homeFxN1, awayFxN, awayFxN1,
    topN, topN1, homeStats, awayStats, h2hRaw, standingsRaw,
  ] = await Promise.all([
    apiGet("fixtures",             { team: home.id, season: sN,  ...teamFilter },              TTL.teamFixtures),
    euroOnly ? Promise.resolve([]) : apiGet("fixtures", { team: home.id, season: sN1 },        TTL.teamFixtures),
    apiGet("fixtures",             { team: away.id, season: sN,  ...teamFilter },              TTL.teamFixtures),
    euroOnly ? Promise.resolve([]) : apiGet("fixtures", { team: away.id, season: sN1 },        TTL.teamFixtures),
    apiGet("players/topscorers",   { league: league.apiId, season: sN  },                      TTL.topScorers),
    euroOnly ? Promise.resolve([]) : apiGet("players/topscorers", { league: league.apiId, season: sN1 }, TTL.topScorers),
    apiGet("teams/statistics",     { league: league.apiId, season: sN, team: home.id },        TTL.teamStats),
    apiGet("teams/statistics",     { league: league.apiId, season: sN, team: away.id },        TTL.teamStats),
    apiGet("fixtures/headtohead",  { h2h: `${home.id}-${away.id}`, last: 10 },                 TTL.headToHead),
    apiGet("standings",            { league: league.apiId, season: sN },                        TTL.teamStats).catch(() => null),
  ]);

  // ── Enrichissement pour équipes nationales / compétitions euroOnly ──
  // Si peu de données dans la compétition spécifique, charger l'historique global de l'équipe
  let extraHomeFx = [], extraAwayFx = [];
  if (euroOnly) {
    const homeCount = homeFxN.filter(f => { const s = f.fixture?.status?.short; return ["FT","AET","PEN"].includes(s); }).length;
    const awayCount = awayFxN.filter(f => { const s = f.fixture?.status?.short; return ["FT","AET","PEN"].includes(s); }).length;
    const [extraH, extraH1, extraA, extraA1] = await Promise.all([
      homeCount < 8 ? apiGet("fixtures", { team: home.id, season: sN, last: 30 }, TTL.teamFixtures) : Promise.resolve([]),
      homeCount < 8 ? apiGet("fixtures", { team: home.id, season: sN1 }, TTL.teamFixtures) : Promise.resolve([]),
      awayCount < 8 ? apiGet("fixtures", { team: away.id, season: sN, last: 30 }, TTL.teamFixtures) : Promise.resolve([]),
      awayCount < 8 ? apiGet("fixtures", { team: away.id, season: sN1 }, TTL.teamFixtures) : Promise.resolve([]),
    ]);
    extraHomeFx = [...extraH, ...extraH1];
    extraAwayFx = [...extraA, ...extraA1];
  }

  // Fusionner les fixtures (déduplication par id)
  const mergeFx = (base, extra) => {
    const seen = new Set(base.map(f => f.fixture?.id));
    return [...base, ...extra.filter(f => !seen.has(f.fixture?.id))];
  };

  const allHomeFx = mergeFx([...homeFxN, ...homeFxN1], extraHomeFx);
  const allAwayFx = mergeFx([...awayFxN, ...awayFxN1], extraAwayFx);

  // Top 5 du championnat (pour le filtre "vs Top 5")
  const top5Ids = new Set(
    (standingsRaw?.[0]?.league?.standings?.[0] || [])
      .slice(0, 5)
      .map(e => e.team?.id)
      .filter(Boolean)
  );
  // Pour un teamId donné dans une fixture, retourne l'ID de l'adversaire
  const oppId = (f, teamId) =>
    f.teams?.home?.id === teamId ? f.teams?.away?.id : f.teams?.home?.id;
  const filterVsTop5Home = fxList => fxList.filter(f => top5Ids.has(oppId(f, home.id)));
  const filterVsTop5Away = fxList => fxList.filter(f => top5Ids.has(oppId(f, away.id)));

  const homePeriods = {
    ...buildAllPeriods(allHomeFx, home.id, "home"),
    season: buildSeasonStats(homeFxN, home.id, "home"),
    ...(top5Ids.size > 0 ? { top5: teamStatsFromFixtures(filterVsTop5Home(allHomeFx), home.id, "home", 9999, 0) } : {}),
  };
  const awayPeriods = {
    ...buildAllPeriods(allAwayFx, away.id, "away"),
    season: buildSeasonStats(awayFxN, away.id, "away"),
    ...(top5Ids.size > 0 ? { top5: teamStatsFromFixtures(filterVsTop5Away(allAwayFx), away.id, "away", 9999, 0) } : {}),
  };
  const homeBase = homePeriods[365];

  // Stats "avant le match" — filtrés sur les matchs joués AVANT la date du match affiché
  const matchTs = new Date(fx.fixture.date).getTime();
  const homePreFx = allHomeFx.filter(f => new Date(f.fixture.date).getTime() < matchTs);
  const awayPreFx = allAwayFx.filter(f => new Date(f.fixture.date).getTime() < matchTs);
  const homePreFxSeason = homeFxN.filter(f => new Date(f.fixture.date).getTime() < matchTs);
  const awayPreFxSeason = awayFxN.filter(f => new Date(f.fixture.date).getTime() < matchTs);
  const homePrePeriods = {
    ...buildAllPeriods(homePreFx, home.id, "home"),
    season: buildSeasonStats(homePreFxSeason, home.id, "home"),
  };
  const awayPrePeriods = {
    ...buildAllPeriods(awayPreFx, away.id, "away"),
    season: buildSeasonStats(awayPreFxSeason, away.id, "away"),
  };
  const awayBase = awayPeriods[365];

  // noData seulement si vraiment aucun match trouvé même avec l'enrichissement global
  homeBase.noData = homeBase.sampleSize < 1;
  awayBase.noData = awayBase.sampleSize < 1;
  // Marquer si les stats viennent de sources élargies
  homeBase.extendedStats = extraHomeFx.length > 0;
  awayBase.extendedStats = extraAwayFx.length > 0;

  const h2h = h2hRaw
    .filter((f) => FINISHED.has(f.fixture?.status?.short))
    .sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date))
    .slice(0, 5)
    .map((f) => {
      const homeIsHome = f.teams.home.id === home.id;
      const gH = homeIsHome ? f.goals.home : f.goals.away;
      const gA = homeIsHome ? f.goals.away : f.goals.home;
      return {
        date:   f.fixture.date.slice(0, 7),
        score:  `${gH} - ${gA}`,
        winner: gH > gA ? "home" : gH < gA ? "away" : "draw",
      };
    });

  return {
    league:      fx.league?.name || league.name,
    leagueLogo:  fx.league?.logo || "",
    date:        formatKickoff(fx.fixture.date),
    score:       `${fx.goals.home ?? "?"} - ${fx.goals.away ?? "?"}`,
    sampleSize:  { home: homeBase.sampleSize, away: awayBase.sampleSize },
    home: {
      logo:          home.logo  || "",
      name:          home.name,
      short:         shortFromName(home.name),
      form:          homeBase.form,
      avgFor:        homeBase.avgFor,
      avgAgainst:    homeBase.avgAgainst,
      rec:           homeBase.rec,
      scorers:       scorersForTeam(topN, topN1, home.id, 3),
      dist:          homeBase.dist,
      p4:            homeBase.p4,
      pen:           penaltyFromStats(homeStats),
      margins:       homeBase.margins,
      doubleChance:  homeBase.doubleChance,
      btts:          homeBase.btts,
      cleanSheet:    homeBase.cleanSheet,
      failedToScore: homeBase.failedToScore,
      over25:        homeBase.over25,
      minuteGoals:   minuteGoalsFromStats(homeStats),
      noData:        homeBase.noData,
      extendedStats: homeBase.extendedStats || false,
      periods:       homePeriods,
      prePeriods:    homePrePeriods,
    },
    away: {
      logo:          away.logo  || "",
      name:          away.name,
      short:         shortFromName(away.name),
      form:          awayBase.form,
      avgFor:        awayBase.avgFor,
      avgAgainst:    awayBase.avgAgainst,
      rec:           awayBase.rec,
      scorers:       scorersForTeam(topN, topN1, away.id, 2),
      dist:          awayBase.dist,
      p4:            awayBase.p4,
      pen:           penaltyFromStats(awayStats),
      margins:       awayBase.margins,
      doubleChance:  awayBase.doubleChance,
      btts:          awayBase.btts,
      cleanSheet:    awayBase.cleanSheet,
      failedToScore: awayBase.failedToScore,
      over25:        awayBase.over25,
      minuteGoals:   minuteGoalsFromStats(awayStats),
      noData:        awayBase.noData,
      extendedStats: awayBase.extendedStats || false,
      periods:       awayPeriods,
      prePeriods:    awayPrePeriods,
    },
    h2h,
  };
}

// --- Construction complète (les 6 ligues, séquentiel) ---------------------

// Construit une seule compétition à la demande (lazy, ex : Copa, WC…)
export async function buildSingleLeague(leagueId) {
  const league = LEAGUES.find(l => l.id === leagueId);
  if (!league) throw new Error(`Ligue inconnue : ${leagueId}`);
  const season = league.season || currentSeason();
  return buildLeague(league, season);
}

export async function buildAllLeagues() {
  const season = currentSeason();
  const out = {}, errors = {};
  // Ne construit que les compétitions non-lazy au démarrage
  for (const league of LEAGUES.filter(l => !l.lazy)) {
    try {
      console.log(`[build] ${league.country}…`);
      out[league.id] = await buildLeague(league, season);
      console.log(`[build] ${league.country} OK (${out[league.id].sampleSize.home}+${out[league.id].sampleSize.away} matchs)`);
    } catch (err) {
      errors[league.id] = err.message;
      console.error(`[build] ${league.id} échoué : ${err.message}`);
    }
  }
  return {
    generatedAt: new Date().toISOString(),
    season,
    leagues: out,
    errors: Object.keys(errors).length ? errors : undefined,
  };
}
