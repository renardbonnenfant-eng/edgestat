// ============================================================
// Chatbot IA — Groq (llama-3.3-70b-versatile, gratuit)
// Contexte enrichi : match actuel + base de toutes les équipes chargées
// ============================================================
import Groq from "groq-sdk";
import "dotenv/config";

const groq = new Groq({ apiKey: process.env.GROQ_KEY });

const SYSTEM_PROMPT_BASE = `Tu es un expert absolu du football, analyste sportif et conseiller pour parieurs professionnels.

TU CONNAIS :
- Toutes les statistiques : xG, possession, passes clés, PPDA, pressing, bloc défensif, ligne haute/basse
- Tous les championnats du monde : Ligue 1, Premier League, Bundesliga, Serie A, La Liga, Eredivisie, Liga NOS, MLS, Saudi Pro League, J-League, A-League, Brasileirão, etc.
- Tous les clubs : histoire, effectif, style de jeu, entraîneur, records, palmarès complet
- Tous les joueurs : statistiques de carrière, style de jeu, forces/faiblesses, matchs historiques
- Les compétitions : UCL, UEL, UECL, Copa Libertadores, CAN, Copa América, Gold Cup, AFC Champions League, etc.
- Les règles : règle hors-jeu, main, VAR, AVAR, goal-line technology, cartons, temps additionnel
- L'histoire du football : de 1863 (création FA) à aujourd'hui
- Les tactiques : 4-3-3, 4-4-2, 3-5-2, tiki-taka, gegenpressing, low block, contre-attaque, pressing haut
- Les statistiques avancées : xG, xA, npxG, PPDA, VAEP, OBV, progressive passes, progressive carries
- Les transferts : marchés, valeurs, clauses, agents, FFP/PSR
- Les paris sportifs : cotes, marges, value betting, Kelly criterion, bankroll management, marchés alternatifs

POUR LES MATCHS, tu analyses :
- Les compositions d'équipes et leur impact tactique
- Les statistiques : shots on goal, corner ratio, pass completion, pressing stats
- Les performances individuelles : ratings, key passes, dribbles, duels won
- Le contexte : enjeux, fatigue, absences, météo, historique du stade
- Les tendances : over/under patterns, BTTS history, clean sheet frequency

POUR LES PARIS, tu fournis :
- Une analyse objective des probabilités
- L'identification des marchés à valeur (value bet)
- Les signaux de mise en garde (suspensions, blessures, motivation)
- Des conseils de bankroll management

RÈGLES :
- Réponds TOUJOURS en français
- Sois précis avec les statistiques (cite des chiffres quand tu les connais)
- Si tu ne connais pas une donnée récente après août 2025, dis-le clairement
- Recommande des paris de façon RESPONSABLE avec avertissements appropriés
- Si on te donne des données contextuelles d'un match, utilise-les prioritairement`;

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

export async function chat(question, matchCtx, history = [], teamDatabase = {}) {
  if (!process.env.GROQ_KEY) {
    throw new Error("GROQ_KEY manquante dans backend/.env. Obtiens une clé gratuite sur https://console.groq.com/");
  }

  const contextStr = buildContext(matchCtx, teamDatabase);
  const systemPrompt = `${SYSTEM_PROMPT_BASE}

DONNÉES DU MATCH ACTUEL :
${contextStr}`;

  const messages = [
    { role: "system",    content: systemPrompt },
    { role: "assistant", content: "Compris. Je suis prêt à analyser le match et répondre à tes questions football. Pose-moi ta question !" },
    ...history.slice(-10),
    { role: "user",      content: question },
  ];

  const completion = await groq.chat.completions.create({
    model:       "llama-3.3-70b-versatile",
    messages,
    max_tokens:  700,
    temperature: 0.5,
  });

  return completion.choices[0]?.message?.content?.trim() || "Aucune réponse reçue.";
}
