// ============================================================
// Serveur EdgeStat — proxy API-Football + cache
// Le frontend ne parle qu'à CE serveur ; la clé API ne quitte jamais le backend.
// ============================================================
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

import { PORT, LEAGUES, LEAGUE_MAP, API, TTL, SITE_PASSWORD, TENNIS_TOURNAMENTS } from "./config.js";
import { buildAllLeagues, buildLeagueForFixture, buildSingleLeague } from "./build.js";
import { buildTennisMatch, getTennisTournaments, testTennisApi } from "./tennis.js";
import { chat } from "./chat.js";
import { readCache, writeCache, getDailyCount } from "./cache.js";
import { apiGet } from "./apiFootball.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Mapping apiId → compId (ex: 61 → "fr") pour le routing frontend
const API_ID_TO_COMP = Object.fromEntries(LEAGUES.map(l => [l.apiId, l.id]));
const app = express();
app.use(cors());

// Login — si SITE_PASSWORD vide → accès libre (mode public)
app.post("/api/login", express.json(), (req, res) => {
  if (!SITE_PASSWORD) {
    // Mode public : connexion automatique sans mot de passe
    return res.json({ ok: true, token: Buffer.from("edgestat:open").toString("base64"), public: true });
  }
  const { password } = req.body || {};
  if (!password || password.trim() !== SITE_PASSWORD) {
    return res.status(401).json({ error: "Mot de passe incorrect." });
  }
  const token = Buffer.from(`edgestat:${SITE_PASSWORD}`).toString("base64");
  res.json({ ok: true, token });
});

// Ping de santé pour garder le serveur éveillé (Render free tier)
app.get("/ping", (req, res) => res.send("ok"));

// Liste des championnats (pour le sélecteur du frontend)
app.get("/api/leagues", (req, res) => {
  res.json(LEAGUES.map(({ id, flag, country }) => ({ id, flag, country })));
});

// État du service : utile pour diagnostiquer la clé / le quota
app.get("/api/health", async (req, res) => {
  res.json({
    ok: true,
    hasKey: Boolean(API.key),
    dailyCount: await getDailyCount(),
    dailyLimit: API.dailyLimit,
  });
});

// Debug : appel brut à API-Football, résultat renvoyé tel quel.
// Usage : /api/debug?endpoint=fixtures&league=61&season=2024&last=10
app.get("/api/debug", async (req, res) => {
  const { endpoint = "status", ...params } = req.query;
  try {
    const { API } = await import("./config.js");
    const qs = new URLSearchParams(params).toString();
    const url = `https://${API.host}/${endpoint}${qs ? `?${qs}` : ""}`;
    console.log(`[debug] GET ${url}`);
    const r = await fetch(url, { headers: { "x-apisports-key": API.key } });
    const json = await r.json();
    res.json({ url, status: r.status, body: json });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Données football agrégées (les 6 ligues), au format mkTeam-ready.
// Le payload lui-même est mis en cache pour éviter de reconstruire à chaque requête.
app.get("/api/football", async (req, res) => {
  try {
    const force = req.query.refresh === "1";
    const cached = await readCache("payload:football:v2", TTL.payload);
    if (cached && cached.fresh && !force) {
      return res.json({ ...cached.value, cache: { hit: true, age: cached.age } });
    }
    const payload = await buildAllLeagues();
    await writeCache("payload:football:v2", payload);
    res.json({ ...payload, cache: { hit: false } });
  } catch (err) {
    console.error("[/api/football]", err);
    res.status(502).json({ error: err.message });
  }
});

// Chargement lazy d'une compétition (nationale, amicaux…)
app.get("/api/competition/:id", async (req, res) => {
  const { id } = req.params;
  const league  = LEAGUE_MAP[id];
  if (!league) return res.status(404).json({ error: `Compétition inconnue : ${id}` });

  const cacheKey = `payload:competition:v2:${id}`;
  try {
    const cached = await (await import("./cache.js")).readCache(cacheKey, TTL.payload);
    if (cached && cached.fresh) return res.json({ ...cached.value, cache: { hit: true } });

    const payload = await buildSingleLeague(id);
    await (await import("./cache.js")).writeCache(cacheKey, payload);
    res.json({ ...payload, cache: { hit: false } });
  } catch (err) {
    console.error(`[/api/competition/${id}]`, err.message);
    res.status(502).json({ error: err.message });
  }
});

// Stats pour un match spécifique (sélecteur UI → fixtureId choisi par l'utilisateur).
// Tout passe par le cache : changer de match ne consomme aucun appel API supplémentaire
// si les fixtures de la ligue sont déjà en cache.
app.get("/api/match", async (req, res) => {
  const { league: leagueId, fixtureId } = req.query;
  if (!leagueId || !fixtureId) {
    return res.status(400).json({ error: "Paramètres manquants : league et fixtureId requis." });
  }
  const league = LEAGUES.find((l) => l.id === leagueId);
  if (!league) return res.status(404).json({ error: `Ligue inconnue : ${leagueId}` });

  const cacheKey = `match:v2:${leagueId}:${fixtureId}`;
  try {
    const cached = await (await import("./cache.js")).readCache(cacheKey, TTL.teamFixtures);
    if (cached && cached.fresh) return res.json({ ...cached.value, cache: { hit: true } });

    const { currentSeason } = await import("./config.js");
    const data = await buildLeagueForFixture(league, fixtureId, currentSeason());
    await (await import("./cache.js")).writeCache(cacheKey, data);
    res.json({ ...data, cache: { hit: false } });
  } catch (err) {
    console.error("[/api/match]", err);
    res.status(502).json({ error: err.message });
  }
});

// Test de connexion API-Tennis (ouvrir dans le navigateur pour vérifier)
app.get("/api/tennis/test", async (req, res) => {
  try { res.json(await testTennisApi()); }
  catch (err) { res.status(502).json({ error: err.message }); }
});

// Liste des tournois tennis configurés
app.get("/api/tennis/tournaments", (req, res) => {
  res.json(TENNIS_TOURNAMENTS);
});

// Découverte des tournois depuis l'API (debug)
app.get("/api/tennis/discover", async (req, res) => {
  try {
    const list = await getTennisTournaments(req.query.season || 2025);
    res.json(list);
  } catch (err) { res.status(502).json({ error: err.message }); }
});

// Dernier match d'un tournoi + stats des deux joueurs
app.get("/api/tennis/:tournamentId", async (req, res) => {
  const { tournamentId } = req.params;
  const season = Number(req.query.season) || TENNIS_TOURNAMENTS.find(t => t.id === tournamentId)?.season || 2025;
  const cacheKey = `tennis:match:v2:${tournamentId}:${season}`;
  const { readCache: rc, writeCache: wc } = await import("./cache.js");
  try {
    const cached = await rc(cacheKey, 12 * 3600 * 1000);
    if (cached?.fresh) return res.json({ ...cached.value, cache: { hit: true } });
    const data = await buildTennisMatch(tournamentId, season);
    await wc(cacheKey, data);
    res.json({ ...data, cache: { hit: false } });
  } catch (err) {
    console.error(`[/api/tennis/${tournamentId}]`, err.message);
    res.status(502).json({ error: err.message });
  }
});

// Prochains matchs des ligues suivies (TTL 1h)
// Stratégie : collecte depuis caches existants (payload + caches de fixtures par ligue)
app.get("/api/next", async (req, res) => {
  const cacheKey = "next:tracked:v2";
  try {
    const cached = await readCache(cacheKey, 60 * 60 * 1000);
    if (cached?.fresh) return res.json(cached.value);

    const fixtures = [];

    // 1. Matchs à venir depuis le payload football (ligues eager)
    const payloadCached = await readCache("payload:football:v2", 12 * 60 * 60 * 1000);
    const eagerLeagues  = payloadCached?.value?.leagues || {};
    Object.entries(eagerLeagues).forEach(([compId, compData]) => {
      (compData.recentFixtures || [])
        .filter(f => f.status === "upcoming" || f.score == null)
        .forEach(f => fixtures.push({
          id:         f.id,
          date:       f.date,
          round:      f.round || "",
          league:     compData.league || "",
          leagueLogo: compData.leagueLogo || "",
          country:    "",
          compId,
          home: f.home,
          away: f.away,
          status: "upcoming",
        }));
    });

    // 2. WC 2026 — depuis le cache de fixtures directement
    const WC_LEAGUES = [
      { apiId:1,  season:2026, compId:"wc",    name:"FIFA World Cup",      country:"World" },
      { apiId:4,  season:2024, compId:"euro",   name:"UEFA Euro",           country:"Europe" },
      { apiId:22, season:2025, compId:"cdc",    name:"CdM des clubs",       country:"World" },
      { apiId:11, season:2025, compId:"lib",    name:"Copa Libertadores",   country:"CONMEBOL" },
      { apiId:3,  season:2025, compId:"uel",    name:"UEFA Europa League",  country:"Europe" },
    ];
    const FINISHED_SET = new Set(["FT","AET","PEN","AWD","WO"]);

    for (const lc of WC_LEAGUES) {
      const key = `fixtures?league=${lc.apiId}&season=${lc.season}`;
      const lcCached = await readCache(key, TTL.nextFixture);
      if (!lcCached?.value) continue;
      lcCached.value
        .filter(f => !FINISHED_SET.has(f.fixture?.status?.short) && f.fixture?.status?.short !== "CANC")
        .forEach(f => {
          // évite les doublons
          if (fixtures.find(x => x.id === f.fixture.id)) return;
          fixtures.push({
            id:         f.fixture.id,
            date:       f.fixture.date,
            round:      f.league?.round || "",
            league:     lc.name,
            leagueLogo: f.league?.logo || "",
            country:    lc.country,
            compId:     lc.compId,
            home: { id: f.teams.home.id, name: f.teams.home.name, logo: f.teams.home.logo || "" },
            away: { id: f.teams.away.id, name: f.teams.away.name, logo: f.teams.away.logo || "" },
            status: "upcoming",
          });
        });
    }

    // 3. Matchs globaux dans les 4 prochaines heures (toutes compétitions)
    const now = Date.now();
    const in4h = now + 4 * 60 * 60 * 1000;
    try {
      const soonData = await apiGet("fixtures", { next: 50 }, 15 * 60 * 1000);
      (soonData || []).forEach(f => {
        const d = new Date(f.fixture.date).getTime();
        if (d > now && d <= in4h && !fixtures.find(x => x.id === f.fixture.id)) {
          fixtures.push({
            id:         f.fixture.id,
            date:       f.fixture.date,
            round:      f.league?.round || "",
            league:     f.league?.name  || "",
            leagueLogo: f.league?.logo  || "",
            country:    f.league?.country || "",
            compId:     API_ID_TO_COMP[f.league?.id] || null,
            home: { id: f.teams.home.id, name: f.teams.home.name, logo: f.teams.home.logo || "" },
            away: { id: f.teams.away.id, name: f.teams.away.name, logo: f.teams.away.logo || "" },
            status: "upcoming",
            soonGlobal: true,
          });
        }
      });
    } catch { /* non-bloquant */ }

    fixtures.sort((a, b) => new Date(a.date) - new Date(b.date));
    await writeCache(cacheKey, fixtures);
    res.json(fixtures);
  } catch (err) {
    console.error("[/api/next]", err.message);
    res.status(502).json({ error: err.message });
  }
});

// Cotes de match — API-Football /odds
app.get("/api/odds/:fixtureId", async (req, res) => {
  const { fixtureId } = req.params;
  const cacheKey = `odds:${fixtureId}`;
  try {
    const cached = await readCache(cacheKey, 24 * 60 * 60 * 1000);
    if (cached?.fresh) return res.json(cached.value);

    const data = await apiGet("odds", { fixture: fixtureId }, 24 * 60 * 60 * 1000);
    const bookmakers = (data?.[0]?.bookmakers || []);
    // Prendre le premier bookmaker disponible
    const bm = bookmakers[0];
    if (!bm) { await writeCache(cacheKey, null); return res.json(null); }

    const getBet = (betId) => bm.bets?.find(b => b.id === betId || b.name?.includes(betId));
    const win  = getBet(1) || getBet("Match Winner");
    const ou25 = getBet(5) || getBet("Goals Over/Under");
    const btts = getBet(8) || getBet("Both Teams Score");

    const getVal = (bet, val) => bet?.values?.find(v => v.value === val || v.value?.toLowerCase().includes(val.toLowerCase()))?.odd;

    const result = {
      bookmaker: bm.name,
      logo: `https://media.api-sports.io/bookmakers/${bm.id}.png`,
      win:  { home: getVal(win,"Home"), draw: getVal(win,"Draw"), away: getVal(win,"Away") },
      ou25: { over: getVal(ou25,"Over 2.5"), under: getVal(ou25,"Under 2.5") },
      btts: { yes: getVal(btts,"Yes"), no: getVal(btts,"No") },
    };
    await writeCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error(`[/api/odds/${fixtureId}]`, err.message);
    res.json(null);
  }
});

// Fiche club complète — stats + IA (trophées, records, buteurs historiques)
app.get("/api/club-card/:teamId", async (req, res) => {
  const { teamId } = req.params;
  const { currentSeason: cs } = await import("./config.js");
  const season = Number(req.query.season) || cs();
  const cacheKey = `club-card:${teamId}:${season}`;
  try {
    const cached = await readCache(cacheKey, 6 * 60 * 60 * 1000);
    if (cached?.fresh) return res.json(cached.value);

    const [teamInfoR, fixturesR, fixturesN1R, standingsR] = await Promise.allSettled([
      apiGet("teams",    { id: teamId },               24 * 60 * 60 * 1000),
      apiGet("fixtures", { team: teamId, season },      6  * 60 * 60 * 1000), // saison courante
      apiGet("fixtures", { team: teamId, season:season-1 }, 12 * 60 * 60 * 1000), // saison précédente
      apiGet("standings",{ league: (await apiGet("fixtures",{ team: teamId, season, last:1 }, 24*60*60*1000).catch(()=>[]))?.[0]?.league?.id || 0, season }, 12 * 60 * 60 * 1000).catch(() => null),
    ]);

    const teamInfo = teamInfoR.status === "fulfilled" ? (teamInfoR.value?.[0] || {}) : {};
    const team     = teamInfo.team  || {};
    const venue    = teamInfo.venue || {};

    const FINISHED = new Set(["FT","AET","PEN"]);
    // Fusionner les deux saisons pour plus d'historique
    const curFx  = fixturesR.status   === "fulfilled" ? (fixturesR.value   || []) : [];
    const prevFx = fixturesN1R.status === "fulfilled" ? (fixturesN1R.value || []) : [];
    const allFx  = [...curFx, ...prevFx];

    const pastFx = allFx
      .filter(f => FINISHED.has(f.fixture?.status?.short))
      .sort((a,b) => new Date(b.fixture.date)-new Date(a.fixture.date))
      // Pas de slice — retourner TOUS les matchs passés disponibles
      .map(f => {
        const isHome = f.teams.home.id === Number(teamId);
        const gf = isHome ? f.goals.home : f.goals.away;
        const ga = isHome ? f.goals.away : f.goals.home;
        const res = gf > ga ? "W" : gf < ga ? "L" : "D";
        return {
          id: f.fixture.id, date: f.fixture.date,
          league: f.league?.name||"", leagueLogo: f.league?.logo||"",
          opponent: isHome ? { name:f.teams.away.name, logo:f.teams.away.logo||"", side:"ext." }
                           : { name:f.teams.home.name, logo:f.teams.home.logo||"", side:"dom." },
          score: `${gf ?? "?"} - ${ga ?? "?"}`, result: res,
          home: isHome,
        };
      });

    const upcomingFx = allFx
      .filter(f => !FINISHED.has(f.fixture?.status?.short) && f.fixture?.status?.short==="NS")
      .sort((a,b) => new Date(a.fixture.date)-new Date(b.fixture.date))
      .slice(0,3)
      .map(f => ({ id:f.fixture.id, date:f.fixture.date, league:f.league?.name||"", leagueLogo:f.league?.logo||"",
        home:{name:f.teams.home.name,logo:f.teams.home.logo||""},
        away:{name:f.teams.away.name,logo:f.teams.away.logo||""},
      }));

    // Standings courant
    const standingsData = standingsR?.status === "fulfilled" ? standingsR.value : null;
    const flatSt = (standingsData?.[0]?.league?.standings || []).flat();
    const teamRow = flatSt.find(e => e.team?.id === Number(teamId));

    // TheSportsDB pour trophées et infos historiques
    let tsdbHonors = [], tsdbInfo = {};
    try {
      const tsdbSearch = await tsdbFetch(`searchteams.php?t=${encodeURIComponent(team.name||"")}`);
      const tsdbTeam = (tsdbSearch?.teams||[]).filter(t=>t.strSport==="Soccer")[0];
      if (tsdbTeam?.idTeam) {
        const [honorsRes, infoRes] = await Promise.allSettled([
          tsdbFetch(`lookuphonors.php?id=${tsdbTeam.idTeam}`),
          tsdbFetch(`lookupteam.php?id=${tsdbTeam.idTeam}`),
        ]);
        tsdbHonors = (honorsRes.value?.honours || []).slice(0,20);
        const td = infoRes.value?.teams?.[0] || {};
        tsdbInfo = {
          description: td.strDescriptionEN?.slice(0,500) || "",
          website:     td.strWebsite || "",
          instagram:   td.strInstagram || "",
          manager:     td.strManager || "",
          kitColor:    td.strKitColour1 || "",
        };
      }
    } catch {}

    // Groq : records historiques du club
    let aiRecords = "";
    const groqKey = process.env.GROQ_KEY;
    if (groqKey && team.name) {
      try {
        const { default: Groq } = await import("groq-sdk");
        const groq = new Groq({ apiKey: groqKey });
        const recentStr = pastFx.slice(0,5).map(f=>`${f.result} vs ${f.opponent.name} ${f.score}`).join(", ");
        const prompt = `Tu es un expert du football. Pour le club "${team.name}" (${team.country||""}) :

Résultats récents : ${recentStr || "N/A"}

Réponds en JSON strict avec ces clés :
{
  "allTimeTopScorer": {"name": "", "goals": 0, "period": ""},
  "bestSeasonPoints": {"season": "", "points": 0, "competition": ""},
  "mostWinsSeason": {"season": "", "wins": 0},
  "clubRecord": {"description": ""},
  "trophyCount": {"total": 0, "majorTitles": "liste courte"},
  "currentManager": {"name": "", "since": ""},
  "stadiumCapacity": 0,
  "clubValue": "",
  "funFact": ""
}
Réponds UNIQUEMENT avec le JSON, sans texte autour. Si tu ne sais pas, mets null.`;

        const completion = await groq.chat.completions.create({
          model:"llama-3.3-70b-versatile", messages:[{role:"user",content:prompt}],
          max_tokens:400, temperature:0.2,
          response_format: { type:"json_object" },
        });
        aiRecords = completion.choices[0]?.message?.content || "";
      } catch(e) { console.warn("[club-card/groq]", e.message); }
    }

    let aiData = {};
    try { aiData = JSON.parse(aiRecords); } catch {}

    const result = {
      teamId:    Number(teamId),
      name:      team.name || "",
      logo:      team.logo || "",
      country:   team.country || "",
      founded:   team.founded || null,
      code:      team.code || "",
      stadium:   { name:venue.name||"", capacity:venue.capacity||null, city:venue.city||"", image:venue.image||"" },
      currentStanding: teamRow ? { rank:teamRow.rank, points:teamRow.points, played:teamRow.all?.played||0, won:teamRow.all?.win||0, drawn:teamRow.all?.draw||0, lost:teamRow.all?.lose||0, gf:teamRow.all?.goals?.for||0, ga:teamRow.all?.goals?.against||0 } : null,
      recentForm: pastFx,
      upcomingMatches: upcomingFx,
      tsdbHonors,
      tsdbInfo,
      aiData,
    };
    await writeCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error(`[/api/club-card/${teamId}]`, err.message);
    res.status(502).json({ error: err.message });
  }
});

// Statistiques météo (Open-Meteo, gratuit, sans clé)
app.get("/api/weather-stats", async (req, res) => {
  const { league: leagueId, fixtureId } = req.query;
  if (!leagueId || !fixtureId) return res.status(400).json({ error:"league et fixtureId requis" });
  const league = LEAGUE_MAP[leagueId];
  if (!league) return res.status(404).json({ error:"Ligue inconnue" });

  const cacheKey = `weather-stats:${leagueId}:${fixtureId}`;
  try {
    const cached = await readCache(cacheKey, 24 * 60 * 60 * 1000);
    if (cached?.fresh) return res.json(cached.value);

    const { currentSeason: cs } = await import("./config.js");
    const { computeWeatherStats }   = await import("./weather.js");

    // Trouver le match pour obtenir les IDs d'équipes
    const effectiveSeason = league.season || cs();
    let fx = null, sN = effectiveSeason;
    for (const s of [effectiveSeason, effectiveSeason - 1]) {
      const rows = await apiGet("fixtures", { league: league.apiId, season: s }, TTL.nextFixture);
      fx = rows.find(f => f.fixture.id === Number(fixtureId));
      if (fx) { sN = s; break; }
    }
    if (!fx) return res.status(404).json({ error:`Fixture ${fixtureId} introuvable` });

    const homeId     = fx.teams.home.id;
    const awayId     = fx.teams.away.id;
    const teamFilter = league.competitionOnly ? { league: league.apiId } : {};

    // Récupérer les matchs des équipes (depuis le cache existant)
    const [homeFxN, homeFxN1, awayFxN, awayFxN1] = await Promise.all([
      apiGet("fixtures", { team: homeId, season: sN,   ...teamFilter }, TTL.teamFixtures),
      league.competitionOnly ? Promise.resolve([]) : apiGet("fixtures", { team: homeId, season: sN-1 }, TTL.teamFixtures),
      apiGet("fixtures", { team: awayId, season: sN,   ...teamFilter }, TTL.teamFixtures),
      league.competitionOnly ? Promise.resolve([]) : apiGet("fixtures", { team: awayId, season: sN-1 }, TTL.teamFixtures),
    ]);

    const allHomeFx = [...homeFxN, ...homeFxN1];
    const allAwayFx = [...awayFxN, ...awayFxN1];
    // 4 combinaisons : chaque équipe × domicile / extérieur
    const [homeAtHome, homeAtAway, awayAtHome, awayAtAway] = await Promise.all([
      computeWeatherStats(allHomeFx, homeId, "home"),   // Équipe dom. → matchs dom.
      computeWeatherStats(allHomeFx, homeId, "away"),   // Équipe dom. → matchs ext.
      computeWeatherStats(allAwayFx, awayId, "home"),   // Équipe ext. → leurs matchs dom.
      computeWeatherStats(allAwayFx, awayId, "away"),   // Équipe ext. → matchs ext.
    ]);

    const result = {
      home: { name: fx.teams.home.name, atHome: homeAtHome, atAway: homeAtAway },
      away: { name: fx.teams.away.name, atHome: awayAtHome, atAway: awayAtAway },
    };
    await writeCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error("[/api/weather-stats]", err.message);
    res.status(502).json({ error: err.message });
  }
});

// Bracket de tournoi — phases à élimination directe
app.get("/api/bracket/:leagueId", async (req, res) => {
  const { leagueId } = req.params;
  const { currentSeason: cs } = await import("./config.js");
  const season = Number(req.query.season) || cs();
  const cacheKey = `bracket:${leagueId}:${season}`;
  try {
    const cached = await readCache(cacheKey, 6 * 60 * 60 * 1000);
    if (cached?.fresh) return res.json(cached.value);

    const fixtures = await apiGet("fixtures", { league: leagueId, season }, 6 * 60 * 60 * 1000);

    // Rounds dans l'ordre (Playoff → R32 → R16 → QF → SF → Final)
    const ROUND_ORDER = [
      "Playoff Round", "Round of 64", "Round of 32", "Round of 16",
      "Quarter-finals", "Semi-finals", "3rd Place", "Final"
    ];
    const ROUND_LABELS = {
      "Playoff Round":  "BARRAGES",
      "Round of 64":    "64ÈMES",
      "Round of 32":    "32ÈMES",
      "Round of 16":    "8ÈMES DE FINALE",
      "Quarter-finals": "QUARTS DE FINALE",
      "Semi-finals":    "DEMI-FINALES",
      "3rd Place":      "3ÈME PLACE",
      "Final":          "FINALE",
    };

    // Grouper les fixtures par round
    const roundMap = {};
    (fixtures || []).forEach(f => {
      const r = f.league?.round || "";
      const key = ROUND_ORDER.find(k => r.toLowerCase().includes(k.toLowerCase()));
      if (!key) return;
      if (!roundMap[key]) roundMap[key] = [];
      roundMap[key].push(f);
    });

    // Pour chaque round, grouper en "ties" (confrontations) si 2 matchs aller/retour
    const rounds = ROUND_ORDER
      .filter(r => roundMap[r]?.length > 0)
      .map(r => {
        const fxs = (roundMap[r] || []).sort((a,b) => new Date(a.fixture.date)-new Date(b.fixture.date));
        const FINISHED = new Set(["FT","AET","PEN"]);

        // Déterminer le vainqueur d'un match
        const getWinner = (f) => {
          if (!FINISHED.has(f.fixture?.status?.short)) return null;
          if (f.teams.home.winner) return f.teams.home;
          if (f.teams.away.winner) return f.teams.away;
          return null; // nul ou AP → pas de vainqueur direct
        };

        const ties = [];

        if (r === "Final" || fxs.length <= 2) {
          // Match unique ou très peu de matchs
          fxs.forEach(f => {
            const winner = getWinner(f);
            const homeGoals = f.goals.home;
            const awayGoals = f.goals.away;
            ties.push({
              id: f.fixture.id,
              home:    { id: f.teams.home.id, name: f.teams.home.name, logo: f.teams.home.logo||"" },
              away:    { id: f.teams.away.id, name: f.teams.away.name, logo: f.teams.away.logo||"" },
              score:   homeGoals != null ? `${homeGoals} - ${awayGoals}` : null,
              winner:  winner ? { id: winner.id, name: winner.name } : null,
              date:    f.fixture.date,
              status:  f.fixture.status?.short,
            });
          });
        } else {
          // Double confrontation : regrouper par paire d'équipes
          const paired = new Set();
          fxs.forEach((f, i) => {
            if (paired.has(i)) return;
            const homeId = f.teams.home.id;
            const awayId = f.teams.away.id;
            // Chercher le match retour (adversaires inversés)
            const retourIdx = fxs.findIndex((g, j) => j > i && g.teams.home.id === awayId && g.teams.away.id === homeId);

            let agg1 = 0, agg2 = 0, winner = null;

            if (retourIdx >= 0) {
              paired.add(retourIdx);
              const retour = fxs[retourIdx];
              // Calculer l'agrégat
              const g1h = f.goals.home ?? 0, g1a = f.goals.away ?? 0;
              const g2h = retour.goals.home ?? 0, g2a = retour.goals.away ?? 0;
              agg1 = g1h + g2a; // buts équipe 1 (home du match aller)
              agg2 = g1a + g2h; // buts équipe 2
              // Vainqueur
              if (FINISHED.has(retour.fixture?.status?.short)) {
                if (agg1 > agg2) winner = { id: f.teams.home.id, name: f.teams.home.name };
                else if (agg2 > agg1) winner = { id: f.teams.away.id, name: f.teams.away.name };
                else {
                  // Tirs au but ou prolongation → vainqueur du match retour
                  if (retour.teams.home.winner) winner = { id: retour.teams.home.id, name: retour.teams.home.name };
                  else if (retour.teams.away.winner) winner = { id: retour.teams.away.id, name: retour.teams.away.name };
                }
              }
              ties.push({
                id: f.fixture.id,
                home: { id: f.teams.home.id, name: f.teams.home.name, logo: f.teams.home.logo||"" },
                away: { id: f.teams.away.id, name: f.teams.away.name, logo: f.teams.away.logo||"" },
                score: agg1 !== 0 || agg2 !== 0 ? `${agg1} - ${agg2}` : null,
                scoreLabel: "agg.",
                winner,
                date: f.fixture.date,
                isAgg: true,
              });
            } else {
              // Pas de match retour trouvé → traiter comme match simple
              const w = getWinner(f);
              ties.push({
                id: f.fixture.id,
                home: { id: f.teams.home.id, name: f.teams.home.name, logo: f.teams.home.logo||"" },
                away: { id: f.teams.away.id, name: f.teams.away.name, logo: f.teams.away.logo||"" },
                score: f.goals.home != null ? `${f.goals.home} - ${f.goals.away}` : null,
                winner: w ? { id: w.id, name: w.name } : null,
                date: f.fixture.date,
              });
            }
          });
        }

        return {
          key: r,
          label: ROUND_LABELS[r] || r,
          ties,
        };
      });

    const result = { leagueId, season, rounds };
    await writeCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error(`[/api/bracket/${leagueId}]`, err.message);
    res.status(502).json({ error: err.message });
  }
});

// Feed complet d'un club (résultats, transferts, résumé IA)
app.get("/api/club-feed/:teamId", async (req, res) => {
  const { teamId } = req.params;
  const { currentSeason: cs } = await import("./config.js");
  const season = Number(req.query.season) || cs();
  const cacheKey = `club-feed:${teamId}:${season}`;

  try {
    // Cache 2h (mix données et résumé IA)
    const cached = await readCache(cacheKey, 2 * 60 * 60 * 1000);
    if (cached?.fresh) return res.json(cached.value);

    // Récupérer données en parallèle
    const [fixturesRaw, transfersRaw, teamInfoRaw] = await Promise.allSettled([
      apiGet("fixtures",   { team: teamId, season, last: 10 },  6  * 60 * 60 * 1000),
      apiGet("transfers",  { player: null, team: teamId },        7  * 24 * 60 * 60 * 1000),
      apiGet("teams",      { id: teamId },                        24 * 60 * 60 * 1000),
    ]);

    const FINISHED = new Set(["FT","AET","PEN"]);
    const allFx = fixturesRaw.status === "fulfilled" ? (fixturesRaw.value || []) : [];

    // Séparer résultats passés et matchs à venir
    const pastFx = allFx
      .filter(f => FINISHED.has(f.fixture?.status?.short))
      .sort((a,b) => new Date(b.fixture.date) - new Date(a.fixture.date))
      .slice(0, 5)
      .map(f => ({
        id:     f.fixture.id,
        date:   f.fixture.date,
        league: f.league?.name || "",
        leagueLogo: f.league?.logo || "",
        home:   { id: f.teams.home.id, name: f.teams.home.name, logo: f.teams.home.logo||"", winner: f.teams.home.winner },
        away:   { id: f.teams.away.id, name: f.teams.away.name, logo: f.teams.away.logo||"", winner: f.teams.away.winner },
        score:  `${f.goals.home ?? "?"} - ${f.goals.away ?? "?"}`,
        status: f.fixture.status?.short,
      }));

    const upcomingFx = allFx
      .filter(f => !FINISHED.has(f.fixture?.status?.short) && f.fixture?.status?.short === "NS")
      .sort((a,b) => new Date(a.fixture.date) - new Date(b.fixture.date))
      .slice(0, 3)
      .map(f => ({
        id:     f.fixture.id,
        date:   f.fixture.date,
        league: f.league?.name || "",
        leagueLogo: f.league?.logo || "",
        home:   { id: f.teams.home.id, name: f.teams.home.name, logo: f.teams.home.logo||"" },
        away:   { id: f.teams.away.id, name: f.teams.away.name, logo: f.teams.away.logo||"" },
      }));

    // Transferts récents
    const transfersData = transfersRaw.status === "fulfilled" ? (transfersRaw.value || []) : [];
    const recentTransfers = (transfersData[0]?.transfers || [])
      .sort((a,b) => new Date(b.date) - new Date(a.date))
      .slice(0, 6)
      .map(t => ({
        date:    t.date,
        type:    t.type || "Transfer",
        teamIn:  { name: t.teams?.in?.name||"",  logo: t.teams?.in?.logo||""  },
        teamOut: { name: t.teams?.out?.name||"", logo: t.teams?.out?.logo||"" },
        fee:     t.fee || null,
      }));

    // Info équipe
    const teamInfo = teamInfoRaw.status === "fulfilled" ? (teamInfoRaw.value?.[0] || {}) : {};
    const teamName = teamInfo.team?.name || "";
    const teamCountry = teamInfo.team?.country || "";

    // Résumé IA via Groq
    let aiSummary = "";
    const groqKey = process.env.GROQ_KEY;
    if (groqKey && teamName) {
      try {
        const { default: Groq } = await import("groq-sdk");
        const groq = new Groq({ apiKey: groqKey });

        const recentResultsText = pastFx.slice(0,5).map(f =>
          `${f.date.slice(0,10)}: ${f.home.name} ${f.score} ${f.away.name} (${f.league})`
        ).join("\n") || "Aucun résultat récent";

        const transfersText = recentTransfers.length > 0
          ? recentTransfers.slice(0,4).map(t => `${t.date}: ${t.teamOut.name} → ${t.teamIn.name} (${t.type}${t.fee ? ", "+t.fee : ""})`).join("\n")
          : "Aucun transfert récent";

        const prompt = `Tu es un expert en football. Génère un briefing complet sur le club "${teamName}" (${teamCountry}).

Données récentes disponibles :
RÉSULTATS RÉCENTS :
${recentResultsText}

TRANSFERTS RÉCENTS :
${transfersText}

Génère un résumé structuré en français incluant :
1. **Forme récente** : analyse des derniers résultats
2. **Mercato** : transferts récents et rumeurs connues
3. **Situation économique** : propriété, budget, valeur mercato si connu
4. **Actualités marquantes** : faits récents importants sur le club
5. **Contexte** : position dans la ligue, objectifs de la saison

Sois précis, cite des noms et chiffres. Mentionne si certaines infos datent. Réponds en 300 mots max.`;

        const completion = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 600,
          temperature: 0.4,
        });
        aiSummary = completion.choices[0]?.message?.content?.trim() || "";
      } catch (e) {
        console.warn("[club-feed/groq]", e.message);
        aiSummary = "Résumé IA non disponible.";
      }
    }

    const result = {
      teamId: Number(teamId),
      teamName,
      teamLogo:    teamInfo.team?.logo || "",
      teamCountry,
      venue:       teamInfo.venue?.name || "",
      founded:     teamInfo.team?.founded || null,
      pastResults: pastFx,
      upcomingMatches: upcomingFx,
      recentTransfers,
      aiSummary,
      generatedAt: new Date().toISOString(),
    };
    await writeCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error(`[/api/club-feed/${teamId}]`, err.message);
    res.status(502).json({ error: err.message });
  }
});

// Événements complets d'un match (buts, cartons, remplacements…)
app.get("/api/match-events/:fixtureId", async (req, res) => {
  const { fixtureId } = req.params;
  const cacheKey = `events-full:${fixtureId}`;
  try {
    const cached = await readCache(cacheKey, 24 * 60 * 60 * 1000);
    if (cached?.fresh) return res.json(cached.value);
    const data = await apiGet("fixtures/events", { fixture: fixtureId }, 24 * 60 * 60 * 1000);
    const events = (data || []).map(e => ({
      minute:     e.time?.elapsed || 0,
      extra:      e.time?.extra || null,
      type:       e.type,
      detail:     e.detail,
      teamId:     e.team?.id,
      teamName:   e.team?.name,
      playerId:   e.player?.id,
      playerName: e.player?.name || "",
      assistId:   e.assist?.id,
      assistName: e.assist?.name || "",
    })).sort((a,b) => a.minute - b.minute);
    await writeCache(cacheKey, events);
    res.json(events);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Blessés / Suspendus d'une équipe
app.get("/api/injuries/:teamId", async (req, res) => {
  const { teamId } = req.params;
  const { currentSeason: cs } = await import("./config.js");
  const season = Number(req.query.season) || cs();
  const cacheKey = `injuries:${teamId}:${season}`;
  try {
    const cached = await readCache(cacheKey, 6 * 60 * 60 * 1000);
    if (cached?.fresh) return res.json(cached.value);
    const data = await apiGet("injuries", { team: teamId, season }, 6 * 60 * 60 * 1000);
    const result = (data || []).slice(0, 12).map(p => ({
      playerId:    p.player?.id,
      playerName:  p.player?.name || "",
      playerPhoto: p.player?.photo || "",
      type:        p.fixture?.status?.short || "OUT",
      reason:      p.player?.reason || "",
    }));
    await writeCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    res.json([]);
  }
});

// Statistiques d'un match (tirs, corners, possession…)
app.get("/api/match-stats/:fixtureId", async (req, res) => {
  const { fixtureId } = req.params;
  const cacheKey = `match-stats:${fixtureId}`;
  try {
    const cached = await readCache(cacheKey, 24 * 60 * 60 * 1000);
    if (cached?.fresh) return res.json(cached.value);
    const data = await apiGet("fixtures/statistics", { fixture: fixtureId }, 24 * 60 * 60 * 1000);
    const result = (data || []).map(team => ({
      team: { id: team.team?.id, name: team.team?.name, logo: team.team?.logo || "" },
      stats: Object.fromEntries((team.statistics || []).map(s => [s.type, s.value]))
    }));
    await writeCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Génération de questions de quiz via Groq
app.post("/api/quiz/generate", express.json(), async (req, res) => {
  const { category, difficulty, count = 10, exclude = [] } = req.body || {};
  const groqKey = process.env.GROQ_KEY;
  if (!groqKey) return res.status(500).json({ error: "GROQ_KEY manquante" });

  const cacheKey = `quiz-gen:${category}:${difficulty}:${Math.floor(Date.now()/3600000)}`; // renouvelle chaque heure
  try {
    const cached = await readCache(cacheKey, 60 * 60 * 1000);
    if (cached?.fresh && cached.value?.length >= count) {
      return res.json(cached.value.slice(0, count));
    }

    const { default: Groq } = await import("groq-sdk");
    const groq = new Groq({ apiKey: groqKey });

    const difficultyMap = { facile:"débutant (faits connus de tous)", moyen:"connaisseur", difficile:"expert passionné", expert:"statisticien professionnel" };
    const prompt = `Génère exactement ${count} questions de quiz sur le football pour niveau ${difficultyMap[difficulty]||"moyen"}, catégorie: ${category}.

Chaque question DOIT être différente des précédentes. Les questions doivent être précises, vérifiables et intéressantes.

Format JSON strict:
[
  {
    "q": "Question précise?",
    "options": ["Réponse correcte", "Mauvaise 1", "Mauvaise 2", "Mauvaise 3"],
    "correct": 0,
    "explanation": "Explication courte et intéressante (1-2 phrases)",
    "year": 2023
  }
]

L'index "correct" indique la position (0-3) de la bonne réponse dans "options".
Mélange l'ordre des réponses correctes (pas toujours en position 0).
Réponds UNIQUEMENT avec le JSON, sans texte autour.`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role:"user", content:prompt }],
      max_tokens: 2000,
      temperature: 0.8,
      response_format: { type:"json_object" },
    });

    let questions = [];
    try {
      const raw = completion.choices[0]?.message?.content || "[]";
      const parsed = JSON.parse(raw);
      questions = Array.isArray(parsed) ? parsed : (parsed.questions || parsed.quiz || []);
    } catch { questions = []; }

    if (questions.length > 0) {
      await writeCache(cacheKey, questions);
    }
    res.json(questions);
  } catch (err) {
    console.error("[quiz/generate]", err.message);
    res.status(502).json({ error: err.message });
  }
});

// Matchs en direct (TTL 2 min)
app.get("/api/live", async (req, res) => {
  const cacheKey = "live:all";
  try {
    const cached = await readCache(cacheKey, 2 * 60 * 1000);
    if (cached?.fresh) return res.json(cached.value);
    const data = await apiGet("fixtures", { live: "all" }, 2 * 60 * 1000);
    const matches = (data || []).map(f => ({
      id:          f.fixture.id,
      league:      f.league?.name || "",
      leagueId:    f.league?.id,
      leagueLogo:  f.league?.logo || "",
      country:     f.league?.country || "",
      compId:      API_ID_TO_COMP[f.league?.id] || null,
      home:        { id: f.teams.home.id, name: f.teams.home.name, logo: f.teams.home.logo || "" },
      away:        { id: f.teams.away.id, name: f.teams.away.name, logo: f.teams.away.logo || "" },
      score:       `${f.goals.home ?? 0} - ${f.goals.away ?? 0}`,
      minute:      f.fixture.status?.elapsed || 0,
      status:      f.fixture.status?.short || "",
    }));
    await writeCache(cacheKey, matches);
    res.json(matches);
  } catch (err) {
    console.error("[/api/live]", err.message);
    res.json([]);
  }
});

// Logo d'équipe via TheSportsDB (gratuit, clé "3")
app.get("/api/team-logo", async (req, res) => {
  const name = (req.query.name || "").trim();
  if (!name) return res.json({ logo: null });

  // Normaliser le nom pour la recherche
  const aliases = {
    "West Germany":"Germany", "Soviet Union":"Russia",
    "Olympique Lillois":"Lille", "CO Roubaix-Tourcoing":"Roubaix",
    "AC Milan":"Milan", "Inter Milan":"Internazionale",
    "Atlético Madrid":"Atletico Madrid", "Atlético de Madrid":"Atletico Madrid",
    "Saint-Étienne":"Saint-Etienne", "Paris Saint-Germain":"Paris Saint Germain FC", "Paris Saint Germain":"Paris Saint Germain FC",
    "Borussia Mönchengladbach":"Borussia M'gladbach",
    "TSV 1860 Munich":"1860 Munich", "Eintracht Braunschweig":"Braunschweig",
    "PSV Eindhoven":"PSV", "Deportivo de La Coruña":"Deportivo La Coruna",
    "Peñarol":"Penarol", "Olimpia":"Club Olimpia",
    "IFK Göteborg":"IFK Goteborg", "Steaua Bucharest":"FCSB",
    "Red Star Belgrade":"Red Star", "LDU Quito":"LDU",
    "Once Caldas":"Once Caldas", "Fluminense":"Fluminense",
    "Girondins Bordeaux":"Bordeaux", "Girondins de Bordeaux":"Bordeaux",
    "Stade Reims":"Reims", "Olympique Lillois":"Lille",
    "Racing Club Paris":"Racing Club de Paris", "Sochaux":"FC Sochaux",
    "PSV":"PSV Eindhoven", "Nottingham Forest":"Nottingham Forest",
    "Aston Villa":"Aston Villa", "VfB Stuttgart":"VfB Stuttgart",
  };
  // Normalisation : remplacer tirets/accents courants
  let searchName = aliases[name] || name;
  // Retirer les accents pour la recherche
  searchName = searchName.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const cacheKey = `team-logo:${searchName.toLowerCase().replace(/\s+/g,"-")}`;

  try {
    const cached = await readCache(cacheKey, 30 * 24 * 60 * 60 * 1000);
    if (cached?.fresh) return res.json(cached.value);

    const url = `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(searchName)}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
    const data = await r.json();
    // Filtrer : prendre l'équipe masculine de football (strSport=Soccer, pas Women dans le nom)
    const teams = (data.teams || []).filter(t =>
      t.strSport === "Soccer" &&
      !t.strTeam?.toLowerCase().includes("women") &&
      !t.strTeam?.toLowerCase().includes("female") &&
      !t.strTeam?.toLowerCase().includes("ladies")
    );
    const team = teams[0];
    const result = {
      logo:     team?.strBadge || team?.strTeamBadge || team?.strLogo || null,
      teamName: team?.strTeam  || null,
      country:  team?.strCountry || null,
    };
    await writeCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    res.json({ logo: null });
  }
});

// Recherche de joueurs via TheSportsDB (plus fiable que API-Football search)
app.get("/api/player-search", async (req, res) => {
  const q = (req.query.q || "").trim();
  if (q.length < 3) return res.json([]);
  const cacheKey = `player-search-v2:${q.toLowerCase()}`;
  try {
    const cached = await readCache(cacheKey, 24 * 60 * 60 * 1000);
    if (cached?.fresh) return res.json(cached.value);

    // 1. Recherche TheSportsDB
    const searchUrl = `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(q)}`;
    const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(8000) });
    const searchData = await searchRes.json();
    const tsdbPlayers = (searchData?.player || [])
      .filter(p => p.strSport === "Soccer")
      .slice(0, 6);

    if (tsdbPlayers.length === 0) { await writeCache(cacheKey, []); return res.json([]); }

    // 2. Lookup pour obtenir idAPIfootball + détails bio
    const players = await Promise.all(tsdbPlayers.map(async p => {
      try {
        const lu = await tsdbFetch(`lookupplayer.php?id=${p.idPlayer}`);
        const detail = lu?.players?.[0] || p;
        return {
          tsdbId:      p.idPlayer,
          apiFootId:   detail.idAPIfootball || null,
          name:        p.strPlayer || "",
          photo:       detail.strCutout || detail.strThumb || p.strThumb || "",
          team:        p.strTeam || "",
          nationality: p.strNationality || "",
          position:    p.strPosition || detail.strPosition || "",
          birthdate:   detail.dateBorn || p.dateBorn || null,
          birthPlace:  detail.strBirthLocation || "",
          height:      detail.strHeight || "",
          weight:      detail.strWeight || "",
        };
      } catch { return null; }
    }));

    const result = players.filter(Boolean);
    await writeCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error("[/api/player-search]", err.message);
    res.json([]);
  }
});

// ── TheSportsDB — helper + mappings pour données historiques ─
const TSDB_LEAGUE = {
  61:4334, 39:4328, 78:4331, 140:4335, 135:4332, 94:4340,
  2:4480,  3:4484,  1:4439,  4:4442,   9:4444,   6:4396,
  11:4443, 13:4398, 71:4351, 128:4406, 45:4338,  65:4443,
};
// Compétitions à saison simple (ex: 1998, pas "1997-1998")
const TSDB_SINGLE_YEAR = new Set([4439,4442,4444,4396,4443,4398]);

function tsdbSeason(tsdbId, year) {
  const y = Number(year);
  if (TSDB_SINGLE_YEAR.has(tsdbId)) return String(y);
  return `${y}-${y+1}`;
}

async function tsdbFetch(endpoint) {
  const cacheKey = `tsdb3:${endpoint}`;
  const TTL7 = 7 * 24 * 60 * 60 * 1000;
  const cached = await readCache(cacheKey, TTL7);
  if (cached?.fresh) return cached.value;
  const url = `https://www.thesportsdb.com/api/v1/json/3/${endpoint}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  const data = await res.json();
  if (data) await writeCache(cacheKey, data);
  return data;
}

async function buildFromTheSportsDB(leagueId, year) {
  const tsdbId = TSDB_LEAGUE[Number(leagueId)];
  if (!tsdbId) return null;
  const s = tsdbSeason(tsdbId, year);

  const [tableRes, eventsRes] = await Promise.allSettled([
    tsdbFetch(`lookuptable.php?l=${tsdbId}&s=${s}`),
    tsdbFetch(`eventsseason.php?id=${tsdbId}&s=${s}`),
  ]);

  const table  = tableRes.status  === "fulfilled" ? (tableRes.value?.table  || []) : [];
  const events = eventsRes.status === "fulfilled" ? (eventsRes.value?.events || []) : [];

  if (table.length === 0 && events.length === 0) return null;

  // Champion + top 3
  const sorted = [...table].sort((a,b) => Number(b.intPoints||0)-Number(a.intPoints||0));
  let champion = null, top3 = [];
  if (sorted.length > 0) {
    const t = sorted[0];
    champion = {
      id:     null,
      name:   t.strTeam || "",
      logo:   t.strBadge || t.strTeamBadge || "",
      points: Number(t.intPoints||0),
      played: Number(t.intPlayed||0),
      won:    Number(t.intWin||0),
      drawn:  Number(t.intDraw||0),
      lost:   Number(t.intLoss||0),
      gf:     Number(t.intGoalsFor||0),
      ga:     Number(t.intGoalsAgainst||0),
      coach:  null,
    };
    top3 = sorted.slice(0,3).map((e,i) => ({
      rank: i+1,
      team: { id:null, name:e.strTeam||"", logo:e.strTeamBadge||"" },
      points:Number(e.intPoints||0), played:Number(e.intPlayed||0),
      won:Number(e.intWin||0), drawn:Number(e.intDraw||0), lost:Number(e.intLoss||0),
      gf:Number(e.intGoalsFor||0), ga:Number(e.intGoalsAgainst||0),
    }));
  } else if (events.length > 0) {
    // Cup : gagnant de la finale
    const final = events.find(e => /final$/i.test(e.strRound||"") && e.intHomeScore!=null);
    if (final) {
      const hw = Number(final.intHomeScore) > Number(final.intAwayScore);
      champion = {
        id:null, name: hw ? final.strHomeTeam : final.strAwayTeam,
        logo: hw ? final.strHomeTeamBadge||"" : final.strAwayTeamBadge||"",
        points:null, played:0, won:0, drawn:0, lost:0, gf:0, ga:0, coach:null,
      };
    }
  }

  // Rounds depuis les événements
  const roundsMap = {};
  events.forEach(e => {
    if (e.intHomeScore == null) return; // pas de score → pas joué
    const r = e.strRound || "Matchday";
    if (!roundsMap[r]) roundsMap[r] = [];
    const hw = Number(e.intHomeScore), aw = Number(e.intAwayScore);
    roundsMap[r].push({
      id:     e.idEvent,
      date:   e.dateEvent || "",
      home:   { id:null, name:e.strHomeTeam||"", logo:e.strHomeTeamBadge||"" },
      away:   { id:null, name:e.strAwayTeam||"", logo:e.strAwayTeamBadge||"" },
      score:  `${hw} - ${aw}`,
      winner: hw>aw ? "home" : hw<aw ? "away" : "draw",
    });
  });

  return {
    leagueId: String(leagueId),
    season:   Number(year),
    source:   "thesportsdb",
    champion,
    top3,
    topScorers: [],
    rounds: Object.entries(roundsMap)
      .sort(([a],[b]) => a.localeCompare(b, undefined, { numeric:true }))
      .map(([name, fixtures]) => ({ name, fixtures: fixtures.sort((a,b)=>a.date.localeCompare(b.date)) })),
    totalMatches: events.filter(e=>e.intHomeScore!=null).length,
    hasStandings: table.length > 0,
  };
}

// ── Histoire : saisons disponibles pour une ligue ─────────
app.get("/api/history/seasons/:leagueId", async (req, res) => {
  const { leagueId } = req.params;
  const cacheKey = `history:seasons:${leagueId}`;
  try {
    const cached = await readCache(cacheKey, 7 * 24 * 60 * 60 * 1000);
    if (cached?.fresh) return res.json(cached.value);
    const data = await apiGet("leagues", { id: leagueId }, 7 * 24 * 60 * 60 * 1000);
    const league = data?.[0]?.league;
    const apiSeasons = (data?.[0]?.seasons || [])
      .filter(s => s.coverage?.fixtures?.events)
      .map(s => s.year);

    // Ajouter les saisons TheSportsDB (allSeasons.php)
    const tsdbId = TSDB_LEAGUE[Number(leagueId)];
    let tsdbSeasons = [];
    if (tsdbId) {
      try {
        const tsdbData = await tsdbFetch(`search_all_seasons.php?id=${tsdbId}`);
        tsdbSeasons = (tsdbData?.seasons || [])
          .map(s => {
            const y = parseInt(s.strSeason);
            return isNaN(y) ? null : y;
          })
          .filter(Boolean);
      } catch {}
    }

    // Union et tri
    const allSeasons = [...new Set([...apiSeasons, ...tsdbSeasons])].sort((a,b)=>b-a);
    const result = { name: league?.name || "", logo: league?.logo || "", seasons: allSeasons };
    await writeCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error(`[/api/history/seasons/${leagueId}]`, err.message);
    res.status(502).json({ error: err.message });
  }
});

// ── Histoire : données complètes d'une saison ─────────────
app.get("/api/history/season/:leagueId/:season", async (req, res) => {
  const { leagueId, season } = req.params;
  const cacheKey = `history:season:v2:${leagueId}:${season}`;
  try {
    const cached = await readCache(cacheKey, 7 * 24 * 60 * 60 * 1000);
    if (cached?.fresh) return res.json(cached.value);

    const [fixtures, standingsRaw, topScorersRaw] = await Promise.all([
      apiGet("fixtures", { league: leagueId, season }, 7 * 24 * 60 * 60 * 1000),
      apiGet("standings",         { league: leagueId, season }, 7 * 24 * 60 * 60 * 1000).catch(() => []),
      apiGet("players/topscorers",{ league: leagueId, season }, 7 * 24 * 60 * 60 * 1000).catch(() => []),
    ]);

    const FINISHED = new Set(["FT","AET","PEN"]);
    const done = (fixtures || []).filter(f => FINISHED.has(f.fixture?.status?.short));

    // Pas de données API-Football → essayer TheSportsDB
    if (done.length === 0) {
      console.log(`[history] Aucune fixture API pour ${leagueId}/${season} → TheSportsDB`);
      const tsdbResult = await buildFromTheSportsDB(leagueId, season).catch(e => {
        console.warn("[history/tsdb]", e.message); return null;
      });
      if (tsdbResult) {
        await writeCache(cacheKey, tsdbResult);
        return res.json(tsdbResult);
      }
      return res.status(404).json({ error: `Pas de données pour ${leagueId}/${season}` });
    }

    // Rounds
    const roundsMap = {};
    done.forEach(f => {
      const r = f.league?.round || "Autre";
      if (!roundsMap[r]) roundsMap[r] = [];
      roundsMap[r].push({
        id:     f.fixture.id,
        date:   f.fixture.date,
        home:   { id: f.teams.home.id, name: f.teams.home.name, logo: f.teams.home.logo || "" },
        away:   { id: f.teams.away.id, name: f.teams.away.name, logo: f.teams.away.logo || "" },
        score:  `${f.goals.home ?? "?"} - ${f.goals.away ?? "?"}`,
        winner: f.teams.home.winner ? "home" : f.teams.away.winner ? "away" : "draw",
      });
    });

    // Standings → champion + top 3
    const standings = standingsRaw?.[0]?.league?.standings;
    let champion = null;
    let top3 = [];

    if (standings?.length > 0) {
      const mainGroup = standings[0] || [];
      // Champion = rank 1
      const t = mainGroup[0];
      if (t) {
        champion = {
          id:     t.team?.id,
          name:   t.team?.name,
          logo:   t.team?.logo || "",
          points: t.points || 0,
          played: t.all?.played || 0,
          won:    t.all?.win    || 0,
          drawn:  t.all?.draw   || 0,
          lost:   t.all?.lose   || 0,
          gf:     t.all?.goals?.for     || 0,
          ga:     t.all?.goals?.against || 0,
        };
      }
      // Top 3
      top3 = mainGroup.slice(0, 3).map(e => ({
        rank:   e.rank,
        team:   { id: e.team?.id, name: e.team?.name, logo: e.team?.logo||"" },
        points: e.points || 0,
        played: e.all?.played || 0,
        won:    e.all?.win    || 0,
        drawn:  e.all?.draw   || 0,
        lost:   e.all?.lose   || 0,
        gf:     e.all?.goals?.for     || 0,
        ga:     e.all?.goals?.against || 0,
      }));
    } else {
      // Compétition à élimination : gagnant de la finale
      const finalRound = Object.keys(roundsMap).find(r => /final$/i.test(r));
      if (finalRound && roundsMap[finalRound][0]) {
        const fm = roundsMap[finalRound][0];
        const winner = fm.winner === "home" ? fm.home : fm.winner === "away" ? fm.away : null;
        if (winner) champion = { ...winner, points: null, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0 };
      }
    }

    // Meilleur buteur
    const topScorers = (topScorersRaw || []).slice(0, 5).map(p => ({
      id:       p.player?.id,
      name:     p.player?.name    || "",
      photo:    p.player?.photo   || "",
      team:     p.statistics?.[0]?.team?.name || "",
      teamLogo: p.statistics?.[0]?.team?.logo || "",
      goals:    p.statistics?.[0]?.goals?.total || 0,
      played:   p.statistics?.[0]?.games?.appearences || 0,
    }));

    // Entraîneur du champion (depuis l'historique des coachs)
    let coach = null;
    if (champion?.id) {
      try {
        const coachData = await apiGet("coachs", { team: champion.id }, 7 * 24 * 60 * 60 * 1000);
        const targetYear = Number(season);
        const found = (coachData || []).find(c =>
          (c.career || []).some(p => {
            const s = parseInt(p.start?.slice(0,4)||"0");
            const e = parseInt(p.end?.slice(0,4)||"9999");
            return s <= targetYear && targetYear <= e && p.team?.id === champion.id;
          })
        );
        if (found) coach = { name: found.name, photo: found.photo||"", nationality: found.nationality||"" };
      } catch { /* coach non obligatoire */ }
    }
    if (champion) champion.coach = coach;

    const result = {
      leagueId, season: Number(season),
      champion,
      top3,
      topScorers,
      rounds: Object.entries(roundsMap)
        .sort(([a],[b]) => a.localeCompare(b, undefined, { numeric:true }))
        .map(([name, fxs]) => ({ name, fixtures: fxs.sort((a,b)=>a.date.localeCompare(b.date)) })),
      totalMatches: done.length,
      hasStandings: !!standings,
    };
    await writeCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error(`[/api/history/season/${leagueId}/${season}]`, err.message);
    res.status(502).json({ error: err.message });
  }
});

// Classements / groupes d'une compétition
app.get("/api/standings/:leagueId", async (req, res) => {
  const { leagueId } = req.params;
  const { currentSeason: cs } = await import("./config.js");
  const season = Number(req.query.season) || cs();
  const cacheKey = `standings:${leagueId}:${season}`;
  try {
    const cached = await readCache(cacheKey, 6 * 60 * 60 * 1000);
    if (cached?.fresh) return res.json(cached.value);
    const data = await apiGet("standings", { league: leagueId, season }, 6 * 60 * 60 * 1000);
    const raw = data[0]?.league?.standings || [];
    const result = raw.map(group =>
      group.map(e => ({
        rank:   e.rank,
        group:  e.group || "",
        team:   { id: e.team?.id, name: e.team?.name, logo: e.team?.logo || "" },
        played: e.all?.played || 0,
        won:    e.all?.win    || 0,
        drawn:  e.all?.draw   || 0,
        lost:   e.all?.lose   || 0,
        gf:     e.all?.goals?.for     || 0,
        ga:     e.all?.goals?.against || 0,
        points: e.points || 0,
      }))
    );
    await writeCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error(`[/api/standings/${leagueId}]`, err.message);
    res.status(502).json({ error: err.message });
  }
});

// Effectif d'une équipe
app.get("/api/squad/:teamId", async (req, res) => {
  const { teamId } = req.params;
  const cacheKey = `squad:${teamId}`;
  try {
    const cached = await readCache(cacheKey, 24 * 60 * 60 * 1000);
    if (cached && cached.fresh) return res.json(cached.value);

    const data = await apiGet("players/squads", { team: teamId }, 24 * 60 * 60 * 1000);
    const players = data[0]?.players || [];
    const result = players.map(p => ({
      id: p.id,
      name: p.name,
      age: p.age,
      number: p.number,
      position: p.position,
      photo: p.photo,
    }));
    await writeCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error(`[/api/squad/${teamId}]`, err.message);
    res.status(502).json({ error: err.message });
  }
});

// Compositions alignées (formations) d'un match
app.get("/api/lineup/:fixtureId", async (req, res) => {
  const { fixtureId } = req.params;
  const cacheKey = `lineup:${fixtureId}`;
  try {
    const cached = await readCache(cacheKey, 24 * 60 * 60 * 1000);
    if (cached?.fresh) return res.json(cached.value);

    const data = await apiGet("fixtures/lineups", { fixture: fixtureId }, 24 * 60 * 60 * 1000);
    if (!data || data.length === 0) return res.json({ home: null, away: null });

    const format = (side) => side ? {
      formation: side.formation || "",
      color:     side.team?.colors?.player?.primary || null,
      name:      side.team?.name || "",
      logo:      side.team?.logo || "",
      startXI:   (side.startXI || []).map(e => ({
        id:     e.player?.id,
        name:   e.player?.name  || "",
        number: e.player?.number,
        pos:    e.player?.pos,
        grid:   e.player?.grid  || "",
        photo:  e.player?.photo || "",
      })),
      substitutes: (side.substitutes || []).map(e => ({
        id:     e.player?.id,
        name:   e.player?.name  || "",
        number: e.player?.number,
        pos:    e.player?.pos,
        photo:  e.player?.photo || "",
      })),
    } : null;

    const result = { home: format(data[0]), away: format(data[1]) };
    await writeCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error(`[/api/lineup/${fixtureId}]`, err.message);
    res.json({ home: null, away: null });
  }
});

// Événements d'un match (buts, cartons…)
app.get("/api/events/:fixtureId", async (req, res) => {
  const { fixtureId } = req.params;
  const cacheKey = `events:${fixtureId}`;
  try {
    const cached = await readCache(cacheKey, 24 * 60 * 60 * 1000);
    if (cached?.fresh) return res.json(cached.value);

    const data = await apiGet("fixtures/events", { fixture: fixtureId }, 24 * 60 * 60 * 1000);
    const events = (data || [])
      .filter(e => e.type === "Goal" && e.detail !== "Own Goal")
      .map(e => ({
        playerId:   e.player?.id,
        playerName: e.player?.name,
        teamId:     e.team?.id,
        minute:     e.time?.elapsed,
      }));
    await writeCache(cacheKey, events);
    res.json(events);
  } catch (err) {
    console.error(`[/api/events/${fixtureId}]`, err.message);
    res.json([]); // non-bloquant si endpoint absent
  }
});

// Trophées via TheSportsDB (gratuit, sans clé)
async function fetchTrophies(playerName) {
  try {
    const search = await fetch(
      `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(playerName)}`,
      { signal: AbortSignal.timeout(6000) }
    );
    const sd = await search.json();
    const tsdbId = sd.player?.[0]?.idPlayer;
    if (!tsdbId) return [];
    const honors = await fetch(
      `https://www.thesportsdb.com/api/v1/json/3/lookuphonors.php?id=${tsdbId}`,
      { signal: AbortSignal.timeout(6000) }
    );
    const hd = await honors.json();
    return (hd.honours || []).map(h => ({
      league: h.strHonour,
      season: h.strSeason,
      team:   h.strTeam,
    }));
  } catch { return []; }
}

// Fiche joueur complète — stats multi-saisons + transferts + trophées
app.get("/api/player/:playerId", async (req, res) => {
  const { playerId } = req.params;
  const tsdbId  = req.query.tsdbId  || null;
  const { currentSeason: cs } = await import("./config.js");
  const season = Number(req.query.season) || cs();
  const cacheKey = `player:v2:${playerId}:${season}`;
  try {
    const cached = await readCache(cacheKey, 24 * 60 * 60 * 1000);
    if (cached?.fresh) return res.json(cached.value);

    // Stats saison courante + 2 saisons précédentes
    const seasons = [season, season-1, season-2];
    const statsAll = await Promise.allSettled(
      seasons.map(s => apiGet("players", { id: playerId, season: s }, 24*60*60*1000))
    );
    const firstValid = statsAll.find(r => r.status==="fulfilled" && r.value?.[0]);
    const { player } = firstValid?.value?.[0] || { player:{} };

    // Fusionner les statistiques de toutes les saisons
    const statistics = [];
    statsAll.forEach(r => {
      if (r.status==="fulfilled" && r.value?.[0]?.statistics) {
        statistics.push(...r.value[0].statistics);
      }
    });

    // Totaux carrière (sur les saisons récupérées)
    const careerGoals       = statistics.reduce((s,x)=> s+(x.goals?.total||0), 0);
    const careerAssists     = statistics.reduce((s,x)=> s+(x.goals?.assists||0), 0);
    const careerAppearances = statistics.reduce((s,x)=> s+(x.games?.appearences||0), 0);
    // GK stats
    const careerConceded    = statistics.reduce((s,x)=> s+(x.goals?.conceded||0), 0);
    const careerSaves       = statistics.reduce((s,x)=> s+(x.goals?.saves||0), 0);

    // Transferts
    let transfers = [];
    try {
      const txRaw = await apiGet("transfers", { player: playerId }, 7*24*60*60*1000);
      transfers = (txRaw?.[0]?.transfers || []).map(t => ({
        date:     t.date,
        type:     t.type || "Transfer",
        teamIn:   { name: t.teams?.in?.name||"",  logo: t.teams?.in?.logo||""  },
        teamOut:  { name: t.teams?.out?.name||"", logo: t.teams?.out?.logo||"" },
        fee:      t.fee || null,
      })).sort((a,b)=>new Date(b.date)-new Date(a.date));
    } catch {}

    // Bio enrichie depuis TheSportsDB si tsdbId fourni
    let tsdbBio = {};
    if (tsdbId) {
      try {
        const lu = await tsdbFetch(`lookupplayer.php?id=${tsdbId}`);
        const d  = lu?.players?.[0] || {};
        tsdbBio = {
          photo:      d.strCutout || d.strThumb || "",
          height:     d.strHeight || "",
          weight:     d.strWeight || "",
          birthPlace: d.strBirthLocation || "",
          description:d.strDescriptionEN?.slice(0,400) || "",
        };
      } catch {}
    }

    // Trophées TheSportsDB
    const nameKey = `tsdb:${(player?.name||"").toLowerCase().replace(/\s+/g,"-")}`;
    let trophies = [];
    const cachedTrophies = await readCache(nameKey, 7*24*60*60*1000);
    if (cachedTrophies?.fresh) {
      trophies = cachedTrophies.value;
    } else if (player?.name) {
      trophies = await fetchTrophies(player.name);
      await writeCache(nameKey, trophies);
    }

    // Formation/premier club = dernier club dans l'historique des transferts
    const formationClub = transfers.length > 0
      ? transfers[transfers.length-1].teamOut
      : null;

    const result = {
      player:    { ...player, ...tsdbBio },
      statistics,
      career:    { goals:careerGoals, assists:careerAssists, appearances:careerAppearances, conceded:careerConceded, saves:careerSaves },
      transfers,
      trophies,
      formationClub,
      seasonsLoaded: seasons.filter((_,i) => statsAll[i].status==="fulfilled"),
    };
    await writeCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error(`[/api/player/${playerId}]`, err.message);
    res.status(502).json({ error: err.message });
  }
});

// Chatbot IA — Groq
// Body: { question: string, context: object, history: array }
app.post("/api/chat", express.json({ limit: "2mb" }), async (req, res) => {
  const { question, context, history, teamDatabase } = req.body || {};
  if (!question?.trim()) return res.status(400).json({ error: "question manquante" });
  try {
    const answer = await chat(question.trim(), context, history || [], teamDatabase || {});
    res.json({ answer });
  } catch (err) {
    console.error("[/api/chat]", err.message);
    res.status(502).json({ error: err.message });
  }
});

// En production, sert le build du frontend si présent (un seul port).
const frontendDist = path.join(__dirname, "..", "..", "frontend", "dist");
if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("*", (req, res) => res.sendFile(path.join(frontendDist, "index.html")));
}

app.listen(PORT, () => {
  console.log(`EdgeStat backend → http://localhost:${PORT}`);
  if (!API.key) {
    console.warn(
      "⚠ API_FOOTBALL_KEY absente : copie backend/.env.example vers backend/.env et renseigne ta clé."
    );
  }
});
