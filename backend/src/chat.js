// ============================================================
// Chatbot IA — Groq (llama-3.3-70b-versatile, gratuit)
// Contexte enrichi : match actuel + base de toutes les équipes chargées
// ============================================================
import Groq from "groq-sdk";
import "dotenv/config";

const groq = new Groq({ apiKey: process.env.GROQ_KEY });

const SYSTEM_PROMPT = `Tu es un assistant d'analyse statistique pour EdgeStat, un outil d'aide à l'analyse de paris sportifs.

Tu as accès à :
1. Le match actuellement sélectionné (données complètes)
2. Une base de données de toutes les équipes chargées lors de la session (données résumées)

Ton rôle :
- Analyser les données historiques fournies dans le contexte
- Répondre en français, de façon concise et factuelle
- Comparer des équipes quand la question le demande (ex : "Compare PSG et OM")
- Présenter uniquement des fréquences historiques (ex : "PSG a marqué en premier dans 60% de ses matchs")
- Ne jamais faire de prédictions, pronostics ou garanties de résultats
- Si une équipe demandée n'est pas dans la base, indiquer qu'il faut sélectionner un match la concernant pour charger ses données
- Rappeler quand c'est pertinent que les paris comportent un risque de perte
- Pour les faits généraux sur le football (règles, histoire, joueurs célèbres), réponds depuis tes connaissances générales. Pour les statistiques, utilise uniquement les données du contexte.

Format :
- Réponses courtes (4-8 phrases max)
- Chiffres précis quand disponibles
- Si la donnée n'est pas dans le contexte, dis-le clairement plutôt que d'inventer`;

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
  }

  return matchSection + teamsSection;
}

export async function chat(question, matchCtx, history = [], teamDatabase = {}) {
  if (!process.env.GROQ_KEY) {
    throw new Error("GROQ_KEY manquante dans backend/.env. Obtiens une clé gratuite sur https://console.groq.com/");
  }

  const context = buildContext(matchCtx, teamDatabase);
  const messages = [
    { role: "system",    content: SYSTEM_PROMPT },
    { role: "user",      content: `CONTEXTE :\n${context}` },
    { role: "assistant", content: "Compris. Je suis prêt à analyser les données. Quelle est ta question ?" },
    ...history.slice(-10),
    { role: "user",      content: question },
  ];

  const completion = await groq.chat.completions.create({
    model:       "llama-3.3-70b-versatile",
    messages,
    max_tokens:  500,
    temperature: 0.4,
  });

  return completion.choices[0]?.message?.content?.trim() || "Aucune réponse reçue.";
}
