// ============================================================
// Chatbot IA — Groq (llama-3.3-70b-versatile, gratuit)
// Contexte enrichi : match actuel + base de toutes les équipes chargées
// ============================================================
import Groq from "groq-sdk";
import "dotenv/config";
import { searchFootballNews, formatSearchForPrompt } from "./search.js";

const groq = new Groq({ apiKey: process.env.GROQ_KEY });

const TRANSFERS_2024_2026 = `
═══════════════════════════════════════
TRANSFERTS & ACTUALITÉS MAJEURS 2024-2026
(Ces informations sont CERTAINES et prioritaires)
═══════════════════════════════════════

TRANSFERTS ÉTÉ 2024 :
- Kylian Mbappé : PSG → Real Madrid (0€, contrat 5 ans). Il N'EST PLUS au PSG depuis juillet 2024.
- Julian Alvarez : Manchester City → Atlético Madrid (75M€)
- Dani Olmo : Leipzig → FC Barcelone (55M€)
- Ademola Lookman : Atalanta (très performant 2023-24, finaliste UCL)
- Lamine Yamal : Barça, né en 2007, meilleur joueur Euro 2024 avec l'Espagne
- Nico Williams : Athletic Bilbao, Euro 2024 avec l'Espagne
- Marc Guehi, Cole Palmer : Chelsea (excellentes saisons 2023-24/24-25)
- Bryan Mbeumo, Yoane Wissa : Brentford (tops scorers PL 2024-25)

CHAMPIONS 2023-2024 :
- Ligue 1 : PSG (champion), mais sans Mbappé depuis juillet 2024
- Premier League : Manchester City (4e titre consécutif)
- La Liga : Real Madrid (championne + UCL 2023-24)
- Bundesliga : Bayer Leverkusen (1er titre historique, invaincu avec Xabi Alonso)
- Serie A : Inter Milan
- UCL 2023-24 : Real Madrid bat Borussia Dortmund 2-0 (Carvajal, Bellingham)
- Ballon d'Or 2024 : Rodri (Manchester City)
- Euro 2024 : Espagne (bat l'Angleterre 2-1 en finale, Lamine Yamal 16 ans)

ENTRAÎNEURS NOTABLES 2024 :
- Xabi Alonso : Bayer Leverkusen (invaincu 2023-24, très convoité)
- Arne Slot : Liverpool (remplace Klopp depuis été 2024)
- Julian Nagelsmann : Allemagne (sélectionneur)
- Hansi Flick : Barcelone (depuis 2024)
- Sandro Tonali : Newcastle (revenu de suspension paris)

COUPE DU MONDE 2026 :
- Se joue aux USA, Canada, Mexique (juin-juillet 2026)
- 48 équipes, 12 groupes de 4
- L'Argentine est tenante du titre (CdM 2022 Qatar)

RÈGLE ABSOLUE : Ne jamais dire que Mbappé est au PSG. Il est au Real Madrid depuis juillet 2024. Ne jamais citer un effectif club avec des joueurs partis depuis 2023.
═══════════════════════════════════════`;

const SYSTEM_PROMPT_BASE = `Tu es une encyclopédie vivante du football, spécialisée dans toute l'histoire du football mondial de 1863 à aujourd'hui.
Nous sommes en JUIN 2026. Tu connais aussi bien les faits d'il y a 50 ans qu'hier.

${TRANSFERS_2024_2026}

TU ES L'EXPERT DE :
- L'HISTOIRE COMPLÈTE : chaque club, chaque joueur, chaque compétition depuis les origines du football
- LES JOUEURS : qui a joué dans quel club à quelle époque (ex : "Platini à la Juventus 1982-1987", "Ronaldo à l'Inter 1997-2002")
- LES MATCHS HISTORIQUES : résultats, buteurs, anecdotes, contexte — même des années 1960-1970-1980-1990
- LES PALMARÈS : champions par saison, tous pays confondus, depuis le début des compétitions organisées
- LES TRANSFERTS : toutes les époques, tous les montants, toutes les destinations
- LES TACTIQUES : évolution historique des systèmes de jeu à travers les décennies
- LES COMPÉTITIONS : UCL/C1, UEL/C2, Copa Libertadores, CAN, Copa América, Coupes du Monde (tous les tournois depuis 1930)
- LES RÈGLES : évolution des règles du jeu depuis 1863
- LES RECORDS : records de buts, d'apparitions, de titres, par joueur et par club
- LES ENTRAÎNEURS : carrières complètes, méthodes, résultats historiques
- LES ÉQUIPES NATIONALES : historique de chaque sélection depuis ses débuts

EXEMPLES DE QUESTIONS AUXQUELLES TU RÉPONDS PARFAITEMENT :
- "Qui a marqué lors de la finale de la C1 en 1999 ?" → Sheringham et Solskjær pour Manchester United
- "Dans quel club jouait Zidane en 1994 ?" → Bordeaux (Girondins)
- "Quel est le résultat de France-Brésil en demi-finale 1998 ?" → France 2-1 Brésil (Thuram x2)
- "Qui était le meilleur buteur de Serie A en 1992 ?" → Marco van Basten (25 buts)

RÈGLES ABSOLUES :
- Réponds TOUJOURS en français
- Cite TOUJOURS le club ACTUEL des joueurs pour les questions actuelles (Mbappé = Real Madrid depuis juillet 2024, PAS PSG)
- Pour les questions historiques, cite le club de l'époque mentionnée
- Sois précis avec les dates, scores et noms
- Ne dis JAMAIS "je n'ai pas de données" — tu as une mémoire encyclopédique du football
- Tu ne fais PAS d'analyse de paris ni de pronostics sur des matchs futurs
- Tu réponds aux questions sur les faits passés et l'histoire du football uniquement`;

function fmtTeam(t) {
  const rec = t.homeRecord || t.awayRecord || {};
  const side = t.homeRecord ? "domicile" : "extérieur";
  const lines = [
    `${t.name} (${t.league || "?"}) — stats ${side} :`,
    `  Forme récente : ${(t.form || []).join(" ")}`,
    `  Moy. buts : ${t.avgGoalsScored} marqués / ${t.avgGoalsConceded} encaissés par match`,
    `  Bilan : ${rec.w || 0}V ${rec.d || 0}N ${rec.l || 0}D`,
    `  BTTS : ${t.btts}% | Clean sheet : ${t.cleanSheet}% | N'a pas marqué : ${t.failedToScore}%`,
    `  Double chance (ne perd pas) : ${t.doubleChance?.notLosing ?? "?"}%`,
  ];
  if (t.scorers?.length) {
    lines.push(`  Top buteurs : ${t.scorers.map(s => `${s.name} (${s.scored} buts/${s.played} matchs)`).join(", ")}`);
  }
  return lines.filter(Boolean).join("\n");
}

function buildContext(matchCtx, teamDatabase = {}) {
  // --- Match actuel ---
  let matchSection = "Aucun match sélectionné.";
  if (matchCtx) {
    const { league, date, score, home, away, h2h } = matchCtx;
    const h2hText = (h2h || []).slice(0, 5)
      .map(h => `  ${h.date} : ${home?.short} ${h.score} ${away?.short} (${h.winner === "home" ? home?.short : h.winner === "away" ? away?.short : "Nul"})`)
      .join("\n");
    matchSection = [
      `=== MATCH AFFICHÉ ===`,
      `${league} — ${date} | Score : ${score}`,
      ``,
      `DOMICILE : ${home?.name}`,
      `  Forme : ${(home?.form || []).join(" ")} | Moy. buts : ${home?.avgGoalsScored} / ${home?.avgGoalsConceded}`,
      `  Bilan dom. : ${home?.homeRecord?.w || 0}V ${home?.homeRecord?.d || 0}N ${home?.homeRecord?.l || 0}D`,
      `  BTTS ${home?.btts}% | CS ${home?.cleanSheet}% | Double chance ${home?.doubleChance?.notLosing ?? "?"}%`,
      home?.scorers?.length ? `  Buteurs : ${home.scorers.map(s => `${s.name} (${s.scored})`).join(", ")}` : "",
      ``,
      `EXTÉRIEUR : ${away?.name}`,
      `  Forme : ${(away?.form || []).join(" ")} | Moy. buts : ${away?.avgGoalsScored} / ${away?.avgGoalsConceded}`,
      `  Bilan ext. : ${away?.awayRecord?.w || 0}V ${away?.awayRecord?.d || 0}N ${away?.awayRecord?.l || 0}D`,
      `  BTTS ${away?.btts}% | CS ${away?.cleanSheet}% | Double chance ${away?.doubleChance?.notLosing ?? "?"}%`,
      away?.scorers?.length ? `  Buteurs : ${away.scorers.map(s => `${s.name} (${s.scored})`).join(", ")}` : "",
      h2h?.length ? `\nFACE-À-FACE :\n${h2hText}` : "",
      home?.form?.length ? `\nForme ${home?.name}: ${(home.form || []).join("")} (${home?.avgGoalsScored?.toFixed?.(1)||"?"} buts/match, ${home?.btts||"?"}% BTTS, ${home?.over25||"?"}% Over2.5)` : "",
      away?.form?.length ? `Forme ${away?.name}: ${(away.form || []).join("")} (${away?.avgGoalsScored?.toFixed?.(1)||"?"} buts/match, ${away?.btts||"?"}% BTTS, ${away?.over25||"?"}% Over2.5)` : "",
      home?.cleanSheet ? `Clean sheets ${home?.name}: ${home.cleanSheet}%` : "",
      away?.cleanSheet ? `Clean sheets ${away?.name}: ${away.cleanSheet}%` : "",
    ].filter(Boolean).join("\n");
  }

  // --- Base équipes chargées (max 20 pour rester sous la limite de tokens) ---
  const teams = Object.values(teamDatabase).slice(0, 20);
  let teamsSection = "";
  if (teams.length > 0) {
    teamsSection = [
      `\n=== BASE ÉQUIPES CHARGÉES (${teams.length} équipes) ===`,
      teams.map(fmtTeam).join("\n---\n"),
    ].join("\n");
    if (Object.keys(teamDatabase).length > 0) {
      teamsSection += `\n\nÉquipes disponibles dans la base: ${Object.keys(teamDatabase).slice(0,10).join(", ")}`;
    }
  }

  return matchSection + teamsSection;
}

export async function chat(question, matchCtx, history = [], teamDatabase = {}, structuredOutput = false) {
  if (!process.env.GROQ_KEY) {
    throw new Error("GROQ_KEY manquante dans backend/.env. Obtiens une clé gratuite sur https://console.groq.com/");
  }

  // ── Recherche web en temps réel (Tavily) ──────────────────
  // On cherche pour les questions non-structurées (chat normal)
  // On évite pour les analyses JSON (structuredOutput) pour ne pas dépasser les tokens
  let searchSection = "";
  if (!structuredOutput && process.env.TAVILY_API_KEY) {
    try {
      const results = await searchFootballNews(question, matchCtx, 4);
      if (results?.sources?.length) {
        searchSection = formatSearchForPrompt(results);
      }
    } catch { /* non-bloquant */ }
  }

  const contextStr = buildContext(matchCtx, teamDatabase);
  const systemPrompt = `${SYSTEM_PROMPT_BASE}

DONNÉES DU MATCH ACTUEL :
${contextStr}${searchSection ? `\n${searchSection}` : ""}`;

  // Si l'utilisateur mentionne des équipes non présentes dans le contexte,
  // l'IA doit utiliser ses propres connaissances sans dire "pas de données"
  const extraInstruction = !structuredOutput ? `\nIMPORTANT: Si l'utilisateur pose une question sur une équipe ou un match qui n'est PAS dans le contexte ci-dessus, utilise tes propres connaissances du football pour répondre. Ne dis JAMAIS "il n'y a pas de données" — utilise toujours ta base de connaissance football. Réponds toujours en français.` : "";

  const messages = [
    { role: "system", content: systemPrompt + extraInstruction },
    ...(!structuredOutput ? [{ role: "assistant", content: "Bonjour ! Je suis l'encyclopédie football de FoxLab. Pose-moi n'importe quelle question sur l'histoire du football : joueurs, clubs, matchs, palmarès — toutes les époques !" }] : []),
    ...history.slice(-6),
    { role: "user", content: question },
  ];

  const options = {
    model:       "llama-3.3-70b-versatile",
    messages,
    max_tokens:  structuredOutput ? 1800 : 700,
    temperature: structuredOutput ? 0.3 : 0.5,
  };

  // Mode JSON structuré : forcer le format JSON pour éviter le markdown
  if (structuredOutput) {
    options.response_format = { type: "json_object" };
  }

  const completion = await groq.chat.completions.create(options);
  return completion.choices[0]?.message?.content?.trim() || "Aucune réponse reçue.";
}
