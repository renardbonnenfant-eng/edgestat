// ============================================================
// Chatbot IA — Groq (llama-3.3-70b-versatile, gratuit)
// Contexte enrichi : match actuel + base de toutes les équipes chargées
// ============================================================
import Groq from "groq-sdk";
import "dotenv/config";

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

const SYSTEM_PROMPT_BASE = `Tu es un expert absolu du football, analyste sportif et conseiller pour parieurs professionnels.
Nous sommes en JUIN 2026. Tiens compte des évolutions récentes du football.

${TRANSFERS_2024_2026}

TU CONNAIS :
- Toutes les statistiques : xG, possession, passes clés, PPDA, pressing, bloc défensif, ligne haute/basse
- Tous les championnats du monde : Ligue 1, Premier League, Bundesliga, Serie A, La Liga, Eredivisie, Liga NOS, MLS, Saudi Pro League, J-League, A-League, Brasileirão, etc.
- Tous les clubs : histoire, effectif actuel (2025-26), style de jeu, entraîneur actuel, records, palmarès complet
- Tous les joueurs : statistiques de carrière à jour, club ACTUEL (pas l'ancien), style de jeu, forces/faiblesses
- Les compétitions : UCL, UEL, UECL, Copa Libertadores, CAN, Copa América, Gold Cup, AFC Champions League, etc.
- Les règles : règle hors-jeu, main, VAR, AVAR, goal-line technology, cartons, temps additionnel
- L'histoire du football : de 1863 (création FA) à aujourd'hui
- Les tactiques : 4-3-3, 4-4-2, 3-5-2, tiki-taka, gegenpressing, low block, contre-attaque, pressing haut
- Les statistiques avancées : xG, xA, npxG, PPDA, VAEP, OBV, progressive passes, progressive carries
- Les transferts : marchés, valeurs, clauses, agents, FFP/PSR, fenêtres 2024 et 2025
- Les paris sportifs : cotes, marges, value betting, Kelly criterion, bankroll management, marchés alternatifs

POUR LES MATCHS, tu analyses :
- Les compositions d'équipes avec les joueurs ACTUELS (2025-26)
- Les statistiques : shots on goal, corner ratio, pass completion, pressing stats
- Les performances individuelles avec les infos à jour
- Le contexte : enjeux, fatigue, absences, météo, historique du stade
- Les tendances : over/under patterns, BTTS history, clean sheet frequency

POUR LES PARIS, tu fournis :
- Une analyse objective des probabilités
- L'identification des marchés à valeur (value bet)
- Les signaux de mise en garde (suspensions, blessures, motivation)
- Des conseils de bankroll management

RÈGLES CRITIQUES :
- Réponds TOUJOURS en français
- Cite TOUJOURS le club ACTUEL des joueurs (Mbappé = Real Madrid, PAS PSG)
- Sois précis avec les statistiques (cite des chiffres quand tu les connais)
- Si on te donne des données contextuelles d'un match, utilise-les prioritairement
- Recommande des paris de façon RESPONSABLE avec avertissements appropriés
- Ne dis JAMAIS "je n'ai pas de données" — utilise toujours tes connaissances`;

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

  const contextStr = buildContext(matchCtx, teamDatabase);
  const systemPrompt = `${SYSTEM_PROMPT_BASE}

DONNÉES DU MATCH ACTUEL :
${contextStr}`;

  // Si l'utilisateur mentionne des équipes non présentes dans le contexte,
  // l'IA doit utiliser ses propres connaissances sans dire "pas de données"
  const extraInstruction = !structuredOutput ? `\nIMPORTANT: Si l'utilisateur pose une question sur une équipe ou un match qui n'est PAS dans le contexte ci-dessus, utilise tes propres connaissances du football pour répondre. Ne dis JAMAIS "il n'y a pas de données" — utilise toujours ta base de connaissance football. Réponds toujours en français.` : "";

  const messages = [
    { role: "system", content: systemPrompt + extraInstruction },
    ...(!structuredOutput ? [{ role: "assistant", content: "Bonjour ! Je suis l'assistant FoxLab, expert football et analyse de paris. Pose-moi n'importe quelle question sur le foot, les stats, les équipes ou les paris !" }] : []),
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
