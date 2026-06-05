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
import { register, login as loginUser, verifyToken, getUserStats, getLeaderboard } from "./auth.js";
import { initQuizWS } from "./quiz-ws.js";

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

// ── Comptes utilisateurs ─────────────────────────────────────
app.post("/api/auth/register", express.json(), async (req, res) => {
  try {
    const { email, username, password } = req.body || {};
    const result = await register(email, username, password);
    res.json(result);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.post("/api/auth/login", express.json(), async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body || {};
    const result = await loginUser(emailOrUsername, password);
    res.json(result);
  } catch (err) { res.status(401).json({ error: err.message }); }
});

app.get("/api/auth/me", (req, res) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: "Non authentifié." });
  const data = getUserStats(decoded.id);
  if (!data) return res.status(404).json({ error: "Utilisateur introuvable." });
  res.json(data);
});

app.get("/api/leaderboard", (req, res) => {
  try { res.json(getLeaderboard(50)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/news/football", async (req, res) => {
  // Cache 30 min — news basées uniquement sur vrais résultats des 48h
  const cacheKey = `football-news-v4:${Math.floor(Date.now() / (30*60*1000))}`;
  try {
    const cached = await readCache(cacheKey, 30 * 60 * 1000);
    if (cached?.fresh) return res.json(cached.value);

    // ── Collecter les vrais résultats des 48h depuis les fixtures en cache ──
    const now = Date.now();
    const h48 = now - 48 * 60 * 60 * 1000;
    const TOP_LEAGUES = new Set([39, 61, 78, 135, 140, 94, 2, 3, 848, 1, 4, 9, 6, 11, 13]);
    const recentResults = [];

    // Scanner le payload principal ET tous les caches competition:v2
    const { promises: fs } = await import("node:fs");
    const { default: pathMod } = await import("node:path");
    const { fileURLToPath: furl } = await import("node:url");
    const cDir = pathMod.join(pathMod.dirname(furl(import.meta.url)), "..", "cache");
    const scanLeague = (lg) => {
      for (const f of (lg.recentFixtures || [])) {
        const d = new Date(f.date).getTime();
        if (d > h48 && d <= now && f.score && (f.status === "FT" || f.status === "AET" || f.status === "PEN")) {
          const [h, a] = (f.score||"").split(" - ").map(Number);
          if (!isNaN(h) && !isNaN(a)) {
            const ageH = Math.round((now - d) / 3600000);
            recentResults.push({ id:String(f.id||""), home:f.home?.name||"?", away:f.away?.name||"?", score:f.score, league:lg.league||"", leagueId:lg.apiId, diff:Math.abs(h-a), total:h+a, ageH, date:f.date });
          }
        }
      }
    };
    try {
      // 1. Payload principal
      const payload = await readCache("payload:football:v2", 24*60*60*1000);
      if (payload?.value) Object.values(payload.value.leagues||{}).forEach(scanLeague);
      // 2. Tous les caches competition:v2 (amicaux, coupes, etc.)
      const files = await fs.readdir(cDir);
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        try {
          const raw = JSON.parse(await fs.readFile(pathMod.join(cDir, file), "utf8"));
          if ((raw.key||"").includes("competition:v2")) {
            const val = raw.value;
            if (val?.recentFixtures) scanLeague(val);
            else if (val?.leagues) Object.values(val.leagues).forEach(scanLeague);
          }
        } catch {}
      }
    } catch {}

    // Trier : top ligues d'abord, puis par intérêt (gros écarts), puis récents
    recentResults.sort((a, b) => {
      const aTop = TOP_LEAGUES.has(a.leagueId) ? 1 : 0;
      const bTop = TOP_LEAGUES.has(b.leagueId) ? 1 : 0;
      if (bTop !== aTop) return bTop - aTop;
      return (b.diff + b.total) - (a.diff + a.total);
    });

    // Convertir directement en news — AUCUNE IA, uniquement les vraies données
    const EMOJIS = { 0:"😐", 1:"⚽", 2:"🔥", 3:"💥", 4:"🚀" };
    const CATS   = ["résultat","résultat","résultat","résultat","résultat"];

    const news = recentResults.slice(0, 8).map((r, i) => {
      const [h, a] = r.score.split(" - ").map(Number);
      const winner = h > a ? r.home : a > h ? r.away : null;
      const isUpset = r.diff >= 3;
      const isBigScore = r.total >= 5;
      const isDraw = h === a;

      let title = "";
      let summary = "";
      let betImpact = "";

      if (isUpset) {
        title = `${r.league} : ${winner} s'impose largement (${r.score})`;
        summary = `${r.home} ${r.score} ${r.away}. ${winner ? `${winner} domine nettement avec ${Math.max(h,a)} buts marqués.` : ""}`;
        betImpact = `${winner} en grande forme — à surveiller pour les prochains paris.`;
      } else if (isBigScore) {
        title = `Festival de buts : ${r.home} ${r.score} ${r.away}`;
        summary = `${r.total} buts au total dans ${r.league}. Les défenses en difficulté.`;
        betImpact = `Over 2.5 dans le prochain match de ces équipes à envisager.`;
      } else if (isDraw) {
        title = `${r.league} : match nul entre ${r.home} et ${r.away} (${r.score})`;
        summary = `Partage des points entre les deux équipes.`;
        betImpact = "";
      } else {
        title = `${r.league} : ${winner} l'emporte ${r.score} contre ${h < a ? r.home : r.away}`;
        summary = `${r.home} ${r.score} ${r.away} — victoire serrée en ${r.league}.`;
        betImpact = `${winner} conserve sa dynamique.`;
      }

      return {
        id: `r${i}`,
        title: title.slice(0, 90),
        summary,
        category: "résultat",
        entity: winner || r.home,
        entityType: "club",
        leagueId: r.leagueId,
        emoji: isUpset ? "🔥" : isBigScore ? "💥" : isDraw ? "🤝" : "⚽",
        hot: isUpset || isBigScore,
        betImpact: betImpact || undefined,
        ageH: r.ageH,
        score: r.score,
        homeTeam: r.home,
        awayTeam: r.away,
      };
    });

    // Si aucun résultat réel → afficher une news générique datée d'aujourd'hui
    if (news.length === 0) {
      const d = new Date().toLocaleDateString("fr-FR", { day:"numeric", month:"long", year:"numeric" });
      news.push({
        id:"empty",
        title:`Aucun résultat disponible pour les dernières 48h`,
        summary:`Les données de matchs se chargent. Reviens dans quelques minutes pour voir les derniers résultats du ${d}.`,
        category:"résultat", entity:"Football", entityType:"competition",
        emoji:"⏳", hot:false, ageH:0,
      });
    }

    const result = { news, generatedAt: new Date().toISOString(), source: "real-fixtures" };
    await writeCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error("[news]", err.message);
    // Fallback minimal basé sur la date du jour
    const d = new Date().toLocaleDateString("fr-FR");
    res.json({ news: [{ id:"err", title:`Flash infos du ${d} — données en cours de chargement`, summary:"Actualisation des résultats en cours. Recharge dans quelques minutes.", emoji:"⏳", category:"résultat", hot:false, ageH:0 }], generatedAt: new Date().toISOString() });
  }
});

function getFallbackNews() {
  const d = new Date().toLocaleDateString("fr-FR");
  const d2 = new Date().toLocaleDateString("fr-FR");
  return {
    news: [{ id:"f0", title:`Derniers résultats du ${d2}`, summary:"Données en cours de chargement depuis API-Football.", emoji:"⏳", category:"résultat", hot:false, ageH:0 }],
    generatedAt: new Date().toISOString(),
  };
}

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

// Top 200 ATP ou WTA — classement complet avec infos joueur
app.get("/api/tennis/top200/:type", async (req, res) => {
  const { type } = req.params; // "atp" ou "wta"
  const rankType = type === "wta" ? "wta" : "atp";
  const cacheKey = `tennis:top200:${rankType}`;
  try {
    const cached = await readCache(cacheKey, 12 * 60 * 60 * 1000); // 12h
    if (cached?.fresh) return res.json(cached.value);

    const { default: tennisGet } = await import("./tennis.js").then(m => ({ default: m }));
    const KEY  = (process.env.TENNIS_RAPIDAPI_KEY || "").trim();
    const HOST = (process.env.TENNIS_HOST || "tennisapi1.p.rapidapi.com").trim();
    if (!KEY) return res.status(500).json({ error: "TENNIS_RAPIDAPI_KEY manquante" });

    const url = `https://${HOST}/api/tennis/rankings/${rankType}`;
    const r = await fetch(url, { headers: { "x-rapidapi-key": KEY, "x-rapidapi-host": HOST }, signal: AbortSignal.timeout(15000) });
    const data = await r.json();
    const rankings = data.rankings || [];

    // Formater les données
    const players = rankings.slice(0, 200).map((entry, idx) => {
      const t = entry.team || {};
      return {
        rank:        entry.ranking || idx + 1,
        prevRank:    entry.previousRanking || null,
        points:      entry.points || 0,
        tournamentsPlayed: entry.tournamentsPlayed || null,
        id:          t.id,
        name:        t.fullName || t.name || "—",
        shortName:   t.shortName || t.name || "—",
        country:     t.country?.name || "",
        countryCode: t.country?.alpha2 || "",
        photo:       "",  // chargé à la demande
        type:        rankType,
      };
    });

    await writeCache(cacheKey, players);
    res.json(players);
  } catch (err) {
    console.error(`[tennis/top200/${type}]`, err.message);
    res.status(502).json({ error: err.message });
  }
});

// Détail d'un joueur tennis (photo, stats, âge, bio IA, surface préférée)
app.get("/api/tennis/player/:playerId", async (req, res) => {
  const { playerId } = req.params;
  const { name, country, rank } = req.query;
  const cacheKey = `tennis:playerv3:${playerId}`;
  try {
    const cached = await readCache(cacheKey, 48 * 60 * 60 * 1000);
    if (cached?.fresh && cached.value?.bio) return res.json(cached.value);

    const KEY  = (process.env.TENNIS_RAPIDAPI_KEY || "").trim();
    const HOST = (process.env.TENNIS_HOST || "tennisapi1.p.rapidapi.com").trim();

    let detail = {};

    // ── SOURCE 1 : API Tennis RapidAPI ──────────────────────
    if (KEY) {
      try {
        const r = await fetch(`https://${HOST}/api/tennis/player/${playerId}`, {
          headers: { "x-rapidapi-key": KEY, "x-rapidapi-host": HOST },
          signal: AbortSignal.timeout(6000),
        });
        const data = await r.json();
        const d = data?.team || {};
        const pt = d.playerTeamInfo || {};
        const birthTs = pt.birthDateTimestamp;
        detail = {
          photo:        d.playerPhoto || "",
          height:       pt.height || null,
          weight:       pt.weight || null,
          age:          birthTs ? Math.floor((Date.now()/1000 - birthTs)/(365.25*24*3600)) : null,
          birthPlace:   pt.birthplace || "",
          plays:        pt.plays || "",
          turnedPro:    pt.turnedPro || null,
          prizeCurrent: pt.prizeCurrent || null,
          prizeTotal:   pt.prizeTotal || null,
          bestRanking:  pt.bestRanking || null,
        };
      } catch {}
    }

    // ── SOURCE 2 : TheSportsDB (photo + bio + stats) ────────
    if (name) {
      try {
        // Chercher par nom complet, puis par nom de famille seul
        const queries = [name, name.split(" ").slice(-1)[0]];
        let tsdbPlayer = null;
        for (const q of queries) {
          const tsdb = await tsdbFetch(`searchplayers.php?p=${encodeURIComponent(q)}`);
          const found = (tsdb?.player || []).find(p =>
            p.strSport?.toLowerCase().includes("tennis") ||
            p.strNationality?.toLowerCase() === (country||"").toLowerCase() ||
            p.strPlayer?.toLowerCase().includes(name.split(" ").slice(-1)[0].toLowerCase())
          ) || tsdb?.player?.[0];
          if (found) { tsdbPlayer = found; break; }
        }
        if (tsdbPlayer) {
          if (!detail.photo) detail.photo = tsdbPlayer.strCutout || tsdbPlayer.strThumb || tsdbPlayer.strRender || "";
          if (!detail.birthPlace && tsdbPlayer.strBirthLocation) detail.birthPlace = tsdbPlayer.strBirthLocation;
          if (!detail.height && tsdbPlayer.strHeight) detail.height = parseFloat(tsdbPlayer.strHeight)||null;
          if (!detail.weight && tsdbPlayer.strWeight) detail.weight = parseFloat(tsdbPlayer.strWeight)||null;
          if (!detail.turnedPro && tsdbPlayer.intSigned) detail.turnedPro = tsdbPlayer.intSigned;
          if (!detail.age && tsdbPlayer.dateBorn) {
            const y = new Date(tsdbPlayer.dateBorn).getFullYear();
            detail.age = new Date().getFullYear() - y;
          }
          // Description TheSportsDB
          if (tsdbPlayer.strDescriptionEN) detail.tsdbBio = tsdbPlayer.strDescriptionEN.slice(0, 400);
        }
      } catch {}
    }

    // ── SOURCE 3 : Wikipedia (photo + résumé) ───────────────
    if (name && (!detail.photo || !detail.birthPlace)) {
      try {
        const wikiName = name.replace(/\s+/g, "_");
        const wikiUrl  = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiName)}`;
        const wikiR    = await fetch(wikiUrl, { signal: AbortSignal.timeout(5000) });
        if (wikiR.ok) {
          const wiki = await wikiR.json();
          if (!detail.photo && wiki.originalimage?.source) detail.photo = wiki.originalimage.source;
          if (!detail.photo && wiki.thumbnail?.source) detail.photo = wiki.thumbnail.source;
          if (wiki.extract && wiki.extract.length > 50) detail.wikiExtract = wiki.extract.slice(0, 500);
        }
      } catch {}
    }

    // ── SOURCE 4 : Surface préférée ──────────────────────────
    const SURFACE_MAP = {
      "Sinner":"hard","Alcaraz":"clay","Djokovic":"hard","Medvedev":"hard",
      "Zverev":"clay","Rune":"clay","Tsitsipas":"clay","Ruud":"clay",
      "Fritz":"hard","De Minaur":"hard","Swiatek":"clay","Sabalenka":"hard",
      "Gauff":"hard","Rybakina":"grass","Andreescu":"hard","Keys":"hard",
      "Nadal":"clay","Federer":"grass","Murray":"grass","Wawrinka":"clay",
      "Kyrgios":"hard","Shapovalov":"hard","Auger-Aliassime":"hard",
      "Berrettini":"grass","Hurkacz":"grass","Musetti":"clay",
      "Norrie":"grass","Draper":"grass","Shelton":"hard","Paul":"hard",
      "Korda":"hard","Cerundolo":"clay","Tabilo":"hard","Cobolli":"clay",
      "Marozsan":"clay","Struff":"clay","Griekspoor":"hard","Van Assche":"hard",
    };
    let preferredSurface = null;
    if (name) {
      const lastName = name.split(" ").slice(-1)[0];
      const firstName = name.split(" ")[0];
      preferredSurface = SURFACE_MAP[lastName] || SURFACE_MAP[firstName] || null;
      // Heuristique par pays si pas trouvé
      if (!preferredSurface && country) {
        const COUNTRY_SURFACE = { "Spain":"clay","France":"clay","Argentina":"clay","Italy":"clay","Chile":"clay","Brazil":"clay","Colombia":"clay", "Australia":"hard","Canada":"hard","USA":"hard","Russia":"hard","Kazakhstan":"hard","Belarus":"hard","Serbia":"hard","Greece":"hard","Poland":"clay","Norway":"clay" };
        preferredSurface = COUNTRY_SURFACE[country] || null;
      }
    }

    // ── SOURCE 5 : Bio via Groq (avec contexte enrichi) ─────
    let bio = "";
    const groqKey = process.env.GROQ_KEY;
    if (groqKey && name) {
      try {
        const { default: Groq } = await import("groq-sdk");
        const groq = new Groq({ apiKey: groqKey });
        // Utiliser les données Wikipedia/TSDB comme contexte si disponibles
        const context = detail.wikiExtract ? `Contexte Wikipedia disponible : "${detail.wikiExtract.slice(0,200)}"` :
                        detail.tsdbBio ? `Contexte disponible : "${detail.tsdbBio.slice(0,200)}"` : "";
        const completion = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [{
            role: "user",
            content: `Écris une biographie courte (3-4 phrases, maximum 150 mots) du joueur de tennis ${name} (${country||""}), actuellement classé #${rank||"?"} mondial.
${context}
Mentionne : ses origines, son style de jeu, ses plus grands titres ou performances notables, et ce qui le caractérise.
Si tu ne connais pas ce joueur précisément, base-toi sur ce qui est typique de ${country||"son pays"} et son niveau de classement.
Ne mentionne pas d'événements après août 2025. Réponds directement la biographie en français, sans titre.`,
          }],
          max_tokens: 180,
          temperature: 0.6,
        });
        bio = completion.choices[0]?.message?.content || "";
      } catch {}
    }

    const result = {
      ...detail,
      bio,
      preferredSurface,
      // Garder le résumé Wikipedia pour affichage si bio Groq vide
      wikiExtract: detail.wikiExtract || null,
    };
    // Toujours mettre en cache même si partiel (au moins les données de base)
    await writeCache(cacheKey, result);
    res.json(result);
  } catch (err) { res.json({}); }
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
// ── Calcul de cotes Poisson ──────────────────────────────────
function poissonProb(lambda, k) {
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}
function calcOddsFromStats(hAtt, hDef, aAtt, aDef) {
  const MARGIN  = 1.06; // marge bookmaker ~6%
  const lgH = 1.35, lgA = 1.05;
  const lH = (hAtt * aDef) / lgA;
  const lA = (aAtt * hDef) / lgH;
  let pH = 0, pD = 0, pA = 0, pO25 = 0, pBTTS = 0;
  for (let h = 0; h <= 6; h++) {
    for (let a = 0; a <= 6; a++) {
      const p = poissonProb(lH, h) * poissonProb(lA, a);
      if (h > a)       pH   += p;
      else if (h === a) pD  += p;
      else             pA   += p;
      if (h + a > 2.5) pO25 += p;
      if (h > 0 && a > 0) pBTTS += p;
    }
  }
  const o = v => +(v > 0.01 ? (MARGIN / v).toFixed(2) : null);
  return {
    bookmaker: "Verdikt Estimé",
    estimated: true,
    win:  { home: o(pH),  draw: o(pD),  away: o(pA) },
    ou25: { over: o(pO25), under: o(1-pO25) },
    btts: { yes: o(pBTTS), no: o(1-pBTTS) },
    proba: { home: +(pH*100).toFixed(1), draw: +(pD*100).toFixed(1), away: +(pA*100).toFixed(1) },
  };
}

app.get("/api/odds/:fixtureId", async (req, res) => {
  const { fixtureId } = req.params;
  const { homeAtt, homeDef, awayAtt, awayDef } = req.query;
  const cacheKey = `odds:${fixtureId}`;
  try {
    // 1. Essayer le cache — ignorer si valeur null (API vide dans le passé)
    const cached = await readCache(cacheKey, 3 * 60 * 60 * 1000);
    if (cached?.fresh && cached.value !== null) return res.json(cached.value);

    // 2. Essayer l'API officielle
    const data = await apiGet("odds", { fixture: fixtureId }, 3 * 60 * 60 * 1000);
    const bookmakers = data?.[0]?.bookmakers || [];
    const bm = bookmakers[0];
    if (bm) {
      const getBet = (id) => bm.bets?.find(b => b.id === id || b.name?.includes(String(id)));
      const win  = getBet(1) || getBet("Match Winner");
      const ou25 = getBet(5) || getBet("Goals Over/Under");
      const btts = getBet(8) || getBet("Both Teams Score");
      const getV = (bet, val) => bet?.values?.find(v => v.value === val || v.value?.toLowerCase().includes(val.toLowerCase()))?.odd;
      const result = {
        bookmaker: bm.name,
        estimated: false,
        win:  { home: getV(win,"Home"), draw: getV(win,"Draw"), away: getV(win,"Away") },
        ou25: { over: getV(ou25,"Over 2.5"), under: getV(ou25,"Under 2.5") },
        btts: { yes: getV(btts,"Yes"), no: getV(btts,"No") },
      };
      await writeCache(cacheKey, result);
      return res.json(result);
    }

    // 3. Fallback : calcul Poisson depuis les stats passées en query
    const hA = parseFloat(homeAtt)||1.3, hD = parseFloat(homeDef)||1.2;
    const aA = parseFloat(awayAtt)||1.0, aD = parseFloat(awayDef)||1.3;
    const result = calcOddsFromStats(hA, hD, aA, aD);
    await writeCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    // En cas d'erreur, calcul Poisson
    const hA = parseFloat(homeAtt)||1.3, hD = parseFloat(homeDef)||1.2;
    const aA = parseFloat(awayAtt)||1.0, aD = parseFloat(awayDef)||1.3;
    res.json(calcOddsFromStats(hA, hD, aA, aD));
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
        // TheSportsDB peut retourner honours ou honors (les deux orthographes)
        const honorsRaw = honorsRes.value?.honours || honorsRes.value?.honors || [];
        tsdbHonors = (Array.isArray(honorsRaw) ? honorsRaw : []).slice(0, 30);
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

    // Si TheSportsDB ne retourne rien → générer le palmarès via Groq
    const groqKeyLocal = process.env.GROQ_KEY;
    if (tsdbHonors.length === 0 && groqKeyLocal && team.name) {
      try {
        const { default: Groq } = await import("groq-sdk");
        const groq = new Groq({ apiKey: groqKeyLocal });
        const honorsCompletion = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [{
            role: "user",
            content: `Liste les principaux trophées du club de football "${team.name}" (${team.country || "pays inconnu"}).
Inclure : championnats nationaux, coupes nationales, compétitions européennes, titres internationaux.
Format JSON strict:
{
  "honours": [
    { "strHonour": "Nom exact du trophée", "strSeason": "année ou période (ex: 2023 ou 2015-2020)", "strTeam": "${team.name}" }
  ]
}
Maximum 25 trophées, du plus récent au plus ancien. Seulement les titres réels et vérifiables.
Réponds UNIQUEMENT avec le JSON.`,
          }],
          max_tokens: 600,
          temperature: 0.2,
          response_format: { type: "json_object" },
        });
        const parsed = JSON.parse(honorsCompletion.choices[0]?.message?.content || "{}");
        const aiHonors = parsed.honours || [];
        if (Array.isArray(aiHonors) && aiHonors.length > 0) {
          tsdbHonors = aiHonors.map(h => ({ ...h, aiGenerated: true }));
        }
      } catch(e) { console.warn("[club-card/honors-groq]", e.message); }
    }

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
      "Quarter-finals", "Semi-finals", "Final"
    ];
    const ROUND_LABELS = {
      "Playoff Round":  "BARRAGES",
      "Round of 64":    "64ÈMES",
      "Round of 32":    "32ÈMES",
      "Round of 16":    "8ÈMES DE FINALE",
      "Quarter-finals": "QUARTS DE FINALE",
      "Semi-finals":    "DEMI-FINALES",
      "Final":          "FINALE",
    };

    // Séparer phases de groupes et phase finale
    const groupMap = {};  // "Group A" → [fixtures]
    const roundMap = {};

    const FINISHED_S = new Set(["FT","AET","PEN"]);

    (fixtures || []).forEach(f => {
      const r = f.league?.round || "";
      // Phases de groupes : "Group A - 1", "Group Stage - 3", etc.
      const gm = r.match(/Group\s+([A-P])\b/i) || r.match(/Group\s+Stage/i) || r.match(/Groupe\s+([A-P])\b/i);
      if (gm) {
        const gKey = gm[1] ? `Group ${gm[1].toUpperCase()}` : "Group Stage";
        if (!groupMap[gKey]) groupMap[gKey] = [];
        groupMap[gKey].push(f);
        return;
      }
      const key = ROUND_ORDER.find(k => r.toLowerCase().includes(k.toLowerCase()));
      if (!key) return;
      if (!roundMap[key]) roundMap[key] = [];
      roundMap[key].push(f);
    });

    // Construire les groupes avec classement + matchs
    const groupStage = Object.entries(groupMap)
      .sort(([a],[b]) => a.localeCompare(b))
      .map(([gname, fxs]) => {
        const teams = {};
        fxs.forEach(f => {
          const addTeam = (t, gf, ga, isHome) => {
            if (!t?.id) return;
            if (!teams[t.id]) teams[t.id] = { id:t.id, name:t.name, logo:t.logo||"", played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 };
            const e = teams[t.id];
            if (!FINISHED_S.has(f.fixture?.status?.short)) return;
            e.played++; e.gf += gf||0; e.ga += ga||0;
            if (gf > ga) { e.won++; e.pts+=3; }
            else if (gf === ga) { e.drawn++; e.pts++; }
            else e.lost++;
          };
          addTeam(f.teams.home, f.goals.home, f.goals.away, true);
          addTeam(f.teams.away, f.goals.away, f.goals.home, false);
        });
        const ranking = Object.values(teams).sort((a,b) => b.pts-a.pts||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf);
        const matches = fxs.sort((a,b) => new Date(a.fixture.date)-new Date(b.fixture.date)).map(f => ({
          id:     f.fixture.id,
          date:   f.fixture.date,
          status: f.fixture.status?.short,
          home:   { id:f.teams.home.id, name:f.teams.home.name, logo:f.teams.home.logo||"" },
          away:   { id:f.teams.away.id, name:f.teams.away.name, logo:f.teams.away.logo||"" },
          score:  f.goals.home!=null ? `${f.goals.home} - ${f.goals.away}` : null,
        }));
        return { group: gname, ranking, matches };
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

    const result = { leagueId, season, rounds, groupStage };
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
  const cacheKey = `match-stats-v2:${fixtureId}`;
  try {
    const cached = await readCache(cacheKey, 10 * 60 * 1000);
    if (cached?.fresh) return res.json(cached.value);
    const data = await apiGet("fixtures/statistics", { fixture: fixtureId }, 10 * 60 * 1000);
    const result = (data || []).map(team => ({
      team: { id: team.team?.id, name: team.team?.name, logo: team.team?.logo || "" },
      stats: Object.fromEntries((team.statistics || []).map(s => [s.type, s.value])),
    }));
    await writeCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get("/api/match-players/:fixtureId", async (req, res) => {
  const { fixtureId } = req.params;
  const cacheKey = `match-players:${fixtureId}`;
  try {
    const cached = await readCache(cacheKey, 12 * 60 * 60 * 1000);
    if (cached?.fresh) return res.json(cached.value);
    const data = await apiGet("fixtures/players", { fixture: fixtureId }, 12 * 60 * 60 * 1000);
    const result = (data || []).map(team => ({
      team: { id: team.team?.id, name: team.team?.name, logo: team.team?.logo || "" },
      players: (team.players || []).map(p => {
        const s = p.statistics?.[0] || {};
        return {
          id:      p.player?.id,
          name:    p.player?.name || "",
          photo:   p.player?.photo || "",
          number:  p.player?.number ?? null,
          pos:     s.games?.position || "",
          rating:  s.games?.rating ? parseFloat(s.games.rating).toFixed(1) : null,
          minutes: s.games?.minutes ?? null,
          captain: s.games?.captain || false,
          // Attaque
          goals:   s.goals?.total ?? 0,
          assists: s.goals?.assists ?? 0,
          shots:   s.shots?.total ?? 0,
          shotsOn: s.shots?.on ?? 0,
          // Passes
          passes:    s.passes?.total ?? 0,
          keyPasses: s.passes?.key ?? 0,
          passAcc:   s.passes?.accuracy ?? null,
          // Défense
          tackles:       s.tackles?.total ?? 0,
          blocks:        s.tackles?.blocks ?? 0,
          interceptions: s.tackles?.interceptions ?? 0,
          // Duels
          duelsTotal: s.duels?.total ?? 0,
          duelsWon:   s.duels?.won ?? 0,
          // Dribbles
          dribAttempts: s.dribbles?.attempts ?? 0,
          dribSuccess:  s.dribbles?.success ?? 0,
          // Cartons
          yellow: s.cards?.yellow ?? 0,
          red:    s.cards?.red ?? 0,
          // Fautes
          foulsDrawn:     s.fouls?.drawn ?? 0,
          foulsCommitted: s.fouls?.committed ?? 0,
        };
      }),
    }));
    await writeCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Génération de questions de quiz via Groq
app.post("/api/quiz/generate", express.json(), async (req, res) => {
  const { category, difficulty, count = 10, exclude = [], seed = 0 } = req.body || {};
  const groqKey = process.env.GROQ_KEY;
  if (!groqKey) return res.status(500).json({ error: "GROQ_KEY manquante" });

  const cacheKey = `quiz-gen:${category}:${difficulty}:${Math.floor(Date.now()/1800000)}:${(seed||0)%10}`; // cache 30 min par seed
  try {
    const cached = await readCache(cacheKey, 30 * 60 * 1000);
    if (cached?.fresh && cached.value?.length >= count) {
      return res.json(cached.value.slice(0, count));
    }

    const { default: Groq } = await import("groq-sdk");
    const groq = new Groq({ apiKey: groqKey });

    const difficultyMap = { facile:"débutant (faits connus de tous)", moyen:"connaisseur", difficile:"expert passionné", expert:"statisticien professionnel" };
    const topics = ["joueurs actuels","records historiques","statistiques","anecdotes","palmarès","transferts","entraîneurs"];
    const topicFocus = topics[(seed||0) % topics.length];
    const prompt = `Génère exactement ${count} questions DE FOOTBALL uniques et variées pour niveau ${difficultyMap[difficulty]||"moyen"}, catégorie: ${category}. Focus thématique cette fois: ${topicFocus}.

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
  // 1. Essayer TheSportsDB
  try {
    const search = await fetch(
      `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(playerName)}`,
      { signal: AbortSignal.timeout(6000) }
    );
    const sd = await search.json();
    const tsdbId = sd.player?.[0]?.idPlayer;
    if (tsdbId) {
      const honors = await fetch(
        `https://www.thesportsdb.com/api/v1/json/3/lookuphonors.php?id=${tsdbId}`,
        { signal: AbortSignal.timeout(6000) }
      );
      const hd = await honors.json();
      const raw = hd.honours || hd.honors || [];
      if (Array.isArray(raw) && raw.length > 0) {
        return raw.map(h => ({ league: h.strHonour, season: h.strSeason, team: h.strTeam }));
      }
    }
  } catch {}

  // 2. Fallback : Groq génère le palmarès du joueur
  const groqKey = process.env.GROQ_KEY;
  if (!groqKey || !playerName) return [];
  try {
    const { default: Groq } = await import("groq-sdk");
    const groq = new Groq({ apiKey: groqKey });
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{
        role: "user",
        content: `Liste les principaux trophées remportés par le footballeur "${playerName}" tout au long de sa carrière.
Format JSON strict:
{
  "trophies": [
    { "league": "Nom du trophée", "season": "Année ou saison (ex: 2021-22)", "team": "Club avec lequel il l'a remporté" }
  ]
}
Maximum 20 trophées, du plus récent au plus ancien. Seulement les titres réels.
Réponds UNIQUEMENT avec le JSON.`,
      }],
      max_tokens: 500,
      temperature: 0.2,
      response_format: { type: "json_object" },
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
    const aiT = parsed.trophies || [];
    if (Array.isArray(aiT) && aiT.length > 0) {
      return aiT.map(t => ({ ...t, aiGenerated: true }));
    }
  } catch(e) { console.warn("[fetchTrophies/groq]", e.message); }

  return [];
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

const server = app.listen(PORT, () => {
  console.log(`Verdikt backend → http://localhost:${PORT}`);
  if (!API.key) {
    console.warn("⚠ API_FOOTBALL_KEY absente : copie backend/.env.example vers backend/.env");
  }
});

// WebSocket quiz multijoueur
initQuizWS(server);
