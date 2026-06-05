import { useState, useEffect } from "react";

// API functions — importer depuis le module api.js du projet
const api = {
  async fetchNext(n=60) {
    const r = await fetch(`/api/next?n=${n}`);
    return r.ok ? r.json().catch(()=>[]) : [];
  },
  async fetchOdds(fixtureId, stats={}) {
    if (!fixtureId) return null;
    const p = new URLSearchParams();
    if (stats.homeAtt) p.set("homeAtt", stats.homeAtt);
    if (stats.homeDef) p.set("homeDef", stats.homeDef);
    if (stats.awayAtt) p.set("awayAtt", stats.awayAtt);
    if (stats.awayDef) p.set("awayDef", stats.awayDef);
    const qs = p.toString();
    const r = await fetch(`/api/odds/${fixtureId}${qs?"?"+qs:""}`);
    return r.ok ? r.json().catch(()=>null) : null;
  },
  async fetchMatchData(leagueId, fixtureId) {
    const r = await fetch(`/api/match?league=${leagueId}&fixtureId=${fixtureId}`);
    if (!r.ok) return null;
    return r.json().catch(()=>null);
  },
  async fetchMatchStats(fixtureId) {
    const r = await fetch(`/api/match-stats/${fixtureId}`);
    return r.ok ? r.json().catch(()=>[]) : [];
  },
  async analyzeWithAI(matchData, home, away, competition, weatherData, fixture) {
    const h = matchData?.home || {};
    const a = matchData?.away || {};

    // ── Calculs avancés ──────────────────────────────────────
    const homeWinDom  = h.homeRecord ? Math.round(h.homeRecord.w/Math.max(h.homeRecord.w+h.homeRecord.d+h.homeRecord.l,1)*100) : null;
    const awayWinExt  = a.awayRecord ? Math.round(a.awayRecord.w/Math.max(a.awayRecord.w+a.awayRecord.d+a.awayRecord.l,1)*100) : null;
    const awayLossExt = a.awayRecord ? Math.round(a.awayRecord.l/Math.max(a.awayRecord.w+a.awayRecord.d+a.awayRecord.l,1)*100) : null;
    const avgGoals    = (h.avgGoalsScored||0) + (a.avgGoalsScored||0);
    const bttsComb    = Math.round(((h.btts||0)+(a.btts||0))/2);
    const over25Comb  = Math.round(((h.over25||0)+(a.over25||0))/2);
    const hForm5      = (h.form||[]).slice(-5).join("") || "N/A";
    const aForm5      = (a.form||[]).slice(-5).join("") || "N/A";
    const hPts5       = (h.form||[]).slice(-5).reduce((s,r)=>s+(r==="W"?3:r==="D"?1:0),0);
    const aPts5       = (a.form||[]).slice(-5).reduce((s,r)=>s+(r==="W"?3:r==="D"?1:0),0);

    // ── H2H ─────────────────────────────────────────────────
    const h2h = matchData?.h2h || [];
    const h2hHome = h2h.filter(x=>x.winner==="home").length;
    const h2hAway = h2h.filter(x=>x.winner==="away").length;
    const h2hDraw = h2h.filter(x=>x.winner==="draw").length;
    const h2hBtts = h2h.filter(x=>{ const [gf,ga]=(x.score||"").split(" - ").map(Number); return gf>0&&ga>0; }).length;
    const h2hOver  = h2h.filter(x=>{ const [gf,ga]=(x.score||"").split(" - ").map(Number); return gf+ga>2; }).length;

    // ── Météo ─────────────────────────────────────────────────
    let weatherContext = "";
    if (weatherData) {
      const wh = weatherData.home || weatherData;
      if (wh.condStats?.length) {
        const best = [...wh.condStats].sort((a,b)=>(b.w/(b.n||1))-(a.w/(a.n||1)))[0];
        const worst = [...wh.condStats].sort((a,b)=>(a.w/(a.n||1))-(b.w/(b.n||1)))[0];
        weatherContext = `Météo ${home}: Meilleure perf en "${best?.label}" (${best?.w}V/${best?.n}M), moins bonne en "${worst?.label}" (${worst?.w}V/${worst?.n}M).`;
      }
    }

    // ── Score confiance domicile ──────────────────────────────
    const xHomeConf = Math.min(95, Math.max(5,
      50
      + (homeWinDom ? (homeWinDom-50)*0.4 : 0)
      + (awayLossExt ? (awayLossExt-30)*0.3 : 0)
      + (hPts5-aPts5)*2
      + ((h.avgGoalsScored||0)-(a.avgGoalsScored||0))*3
      - ((h.avgGoalsConceded||0)-(a.avgGoalsConceded||0))*2
    ));

    // ── Date du match ─────────────────────────────────────────
    const matchDate = fixture?.date ? new Date(fixture.date).toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"}) : null;

    const contextLines = [
      `=== MATCH : ${home} (dom.) vs ${away} (ext.) — ${competition} ===`,
      matchDate ? `Date: ${matchDate}` : "",
      ``,
      `── ÉQUIPE DOMICILE: ${home} ──`,
      `Forme 5 derniers: ${hForm5} (${hPts5}/15 pts)`,
      `Buts marqués/match: ${(h.avgGoalsScored||0).toFixed(2)} | Buts encaissés: ${(h.avgGoalsConceded||0).toFixed(2)}`,
      homeWinDom !== null ? `Win% à domicile: ${homeWinDom}% (${h.homeRecord?.w||0}V ${h.homeRecord?.d||0}N ${h.homeRecord?.l||0}D)` : "",
      `BTTS: ${h.btts||0}% | Over 2.5: ${h.over25||0}% | Clean sheet: ${h.cleanSheet||0}% | Sans marquer: ${h.failedToScore||0}%`,
      h.doubleChance?.notLosing ? `Double chance (ne perd pas dom.): ${h.doubleChance.notLosing}%` : "",
      h.scorers?.length ? `Top buteurs: ${h.scorers.slice(0,3).map(s=>`${s.name} (${s.scored} buts)`).join(", ")}` : "",
      ``,
      `── ÉQUIPE EXTÉRIEUR: ${away} ──`,
      `Forme 5 derniers: ${aForm5} (${aPts5}/15 pts)`,
      `Buts marqués/match: ${(a.avgGoalsScored||0).toFixed(2)} | Buts encaissés: ${(a.avgGoalsConceded||0).toFixed(2)}`,
      awayWinExt !== null ? `Win% à l'extérieur: ${awayWinExt}% | Défaites ext.: ${awayLossExt}% (${a.awayRecord?.w||0}V ${a.awayRecord?.d||0}N ${a.awayRecord?.l||0}D)` : "",
      `BTTS: ${a.btts||0}% | Over 2.5: ${a.over25||0}% | Clean sheet: ${a.cleanSheet||0}% | Sans marquer: ${a.failedToScore||0}%`,
      a.doubleChance?.notLosing ? `Double chance (ne perd pas ext.): ${a.doubleChance.notLosing}%` : "",
      a.scorers?.length ? `Top buteurs: ${a.scorers.slice(0,3).map(s=>`${s.name} (${s.scored} buts)`).join(", ")}` : "",
      ``,
      `── ANALYSE COMBINÉE ──`,
      `Moyenne buts: ${avgGoals.toFixed(2)}/match | BTTS combiné: ${bttsComb}% | Over 2.5 combiné: ${over25Comb}%`,
      `Score de confiance domicile calculé: ${xHomeConf.toFixed(0)}%`,
      h2h.length ? `H2H (${h2h.length} matchs): ${h2hHome}V dom. | ${h2hDraw}N | ${h2hAway}V ext. | BTTS: ${h2hBtts}/${h2h.length} | Over2.5: ${h2hOver}/${h2h.length}` : "H2H: Pas de données",
      h2h.length >= 3 ? `Derniers H2H: ${h2h.slice(0,5).map(x=>`${x.score||"?"}`).join(", ")}` : "",
      weatherContext ? `\n── MÉTÉO & CONDITIONS ──\n${weatherContext}` : "",
    ].filter(Boolean).join("\n");

    const ctx = {
      league: competition, home: { name: home, ...h }, away: { name: away, ...a },
      h2h, score: matchData?.score, date: matchData?.date,
    };

    const schema = `{
  "resume": "1 phrase percutante et précise sur ce match",
  "alertes": [
    {"niveau": "ROUGE|ORANGE|VERT", "icone": "⚠️|🌡️|📊|🔥|💧", "titre": "Titre court alerte", "texte": "Explication détaillée de l'alerte pour le parieur"}
  ],
  "forme": {
    "home": {"resultats": ["V","D","V","V","N"], "desc": "analyse factuelle de la forme (cite les stats)"},
    "away": {"resultats": ["N","V","D","V","V"], "desc": "analyse factuelle de la forme (cite les stats)"}
  },
  "stats": [
    {"label": "Buts/match", "home": 1.8, "away": 1.2},
    {"label": "Buts encaissés", "home": 1.1, "away": 1.4},
    {"label": "Win% terrain", "home": 65, "away": 35},
    {"label": "BTTS %", "home": 55, "away": 60},
    {"label": "Over 2.5 %", "home": 60, "away": 45},
    {"label": "Clean sheets %", "home": 40, "away": 30},
    {"label": "Sans marquer %", "home": 20, "away": 30},
    {"label": "Double chance %", "home": 75, "away": 60}
  ],
  "h2h_analyse": "2 phrases sur les confrontations directes avec chiffres précis",
  "joueurs_cles": {
    "home": [{"nom": "nom", "poste": "poste", "stat": "stat précise basée sur les données"}],
    "away": [{"nom": "nom", "poste": "poste", "stat": "stat précise"}]
  },
  "analyse": "4 phrases d'analyse tactique et statistique très détaillée basée sur les vraies stats",
  "pronostic": {
    "score": "2-1",
    "resultat": "Victoire domicile",
    "confiance": 65,
    "explication": "3 phrases d'explication basées sur les données ci-dessus"
  },
  "paris": [
    {"type": "Victoire domicile", "cote_estimee": "1.75", "valeur": "bonne", "raisonnement": "1 phrase précise avec stats"},
    {"type": "Plus de 2.5 buts", "cote_estimee": "1.90", "valeur": "intéressante", "raisonnement": "1 phrase"},
    {"type": "BTTS Oui", "cote_estimee": "1.80", "valeur": "neutre", "raisonnement": "1 phrase"},
    {"type": "Double chance 1X", "cote_estimee": "1.35", "valeur": "sûre", "raisonnement": "1 phrase"}
  ],
  "verdict": "1 phrase finale synthétique",
  "facteurs_cles": ["facteur clé 1 avec chiffre", "facteur clé 2", "facteur clé 3", "facteur clé 4"],
  "signal_parieur": "fort" ou "moyen" ou "faible"
}

RÈGLES IMPORTANTES:
- Les "alertes" sont critiques : génère des alertes basées sur les VRAIES stats (météo, forme, H2H, domicile/extérieur)
- Si équipe forte à domicile (>70% win dom.) → alerte VERTE avantage domicile
- Si H2H dominé par une équipe → alerte ORANGE
- Si over25 très élevé des deux côtés → alerte VERT buts attendus
- Si conditions météo défavorables selon les stats → alerte ROUGE
- Utilise les données numériques exactes fournies dans ton analyse`;

    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: `En tant qu'expert football et analyste de paris sportifs, analyse ce match et génère une prédiction complète.\n\nDONNÉES RÉELLES DU MATCH:\n${contextLines}\n\nGénère une analyse basée sur ces données réelles.`,
        context: ctx,
        history: [],
        teamDatabase: {},
        structuredOutput: true,
        outputSchema: schema,
      }),
    });
    const d = await r.json();
    const text = d.answer || "";
    if (!text) throw new Error("Pas de réponse du serveur IA.");
    // Parsing robuste
    try { return JSON.parse(text); } catch {}
    const clean = text.replace(/```json|```/gi,"").trim();
    const m = clean.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("L'IA n'a pas retourné un JSON valide. Réessaie.");
    return JSON.parse(m[0]);
  }
};

// ── Palette dark FoxLab ──────────────────────────────────────
const C = {
  bg:"#141C28", card:"#1A2030", border:"#243548",
  accent:"#00D4AA", accentBg:"rgba(0,212,170,.12)", accentBorder:"rgba(0,212,170,.3)",
  dark:"#D0E8F4", mid:"#8AABBD", muted:"#4A6A7A",
  blue:"#3b82f6", green:"#16a34a", red:"#DC2626", warn:"#d97706",
};

const LEAGUE_IDS = {
  "Ligue 1":"fr","Premier League":"en","La Liga":"es","Serie A":"it",
  "Bundesliga":"de","Champions League":"ucl","Europa League":"uel",
  "Liga Portugal":"pt","Nations League":"nl","Amicaux":"intfriendly",
};

// Liste statique complète — fallback quand pas de matchs à venir chargés
const STATIC_TEAMS = {
  "Ligue 1": ["Paris Saint-Germain","Olympique de Marseille","Olympique Lyonnais","AS Monaco","Lille OSC","RC Lens","Stade Rennais","OGC Nice","Stade de Reims","FC Nantes","RC Strasbourg","Toulouse FC","Montpellier HSC","Brest","Le Havre","Angers"],
  "Premier League": ["Arsenal","Liverpool","Manchester City","Chelsea","Tottenham","Manchester United","Aston Villa","Newcastle United","Brighton","West Ham","Wolverhampton","Fulham","Brentford","Everton","Crystal Palace","Bournemouth","Nottingham Forest","Ipswich","Leicester","Southampton"],
  "La Liga": ["Real Madrid","FC Barcelone","Atlético Madrid","Séville FC","Real Sociedad","Villarreal","Athletic Bilbao","Real Betis","Valence CF","Celta Vigo","Getafe CF","Rayo Vallecano","Girona FC","Las Palmas","Mallorca","Osasuna","Alavés","Leganés","Espanyol","Real Valladolid"],
  "Serie A": ["Inter Milan","Juventus","AC Milan","SSC Naples","AS Roma","Lazio","Atalanta","Fiorentina","Torino","Bologna","Udinese","Empoli","Sassuolo","Hellas Vérone","Cagliari","Monza","Como","Lecce","Parme","Venise"],
  "Bundesliga": ["Bayern Munich","Borussia Dortmund","Bayer Leverkusen","RB Leipzig","Union Berlin","Eintracht Francfort","Fribourg","Wolfsburg","Mainz 05","Borussia Mönchengladbach","Hoffenheim","Werder Brème","Augsbourg","Heidenheim","Holstein Kiel","Saint-Pauli"],
  "Champions League": ["Real Madrid","Manchester City","Bayern Munich","Paris Saint-Germain","Barcelone","Arsenal","Atlético Madrid","Inter Milan","Borussia Dortmund","Liverpool","Chelsea","Juventus","Bayer Leverkusen","Porto","Benfica","PSV Eindhoven","Aston Villa","Atalanta","Lille OSC","Feyenoord"],
  "Europa League": ["Manchester United","AS Roma","Bayer Leverkusen","Juventus","Tottenham","Ajax","Séville FC","Fenerbahce","Lyon","Anderlecht","Slavia Prague","PAOK"],
  "Liga Portugal": ["Benfica","FC Porto","Sporting CP","Braga","Vitória Guimarães","Rio Ave","Famalicão","Casa Pia","Arouca","Moreirense"],
  "Nations League": ["France","Espagne","Allemagne","Angleterre","Portugal","Italie","Pays-Bas","Belgique","Croatie","Autriche","Danemark","Suisse","Hongrie","Écosse","Israël","Turquie"],
  "Amicaux": ["France","Espagne","Allemagne","Angleterre","Portugal","Brésil","Argentine","Italie","Pays-Bas","Belgique","Maroc","Sénégal","Côte d'Ivoire","Cameroun","Nigeria","USA","Mexique","Japon","Corée du Sud","Australie"],
};

// ── Composants UI ────────────────────────────────────────────
const FormBadge = ({ r }) => {
  const cfg = { V:{bg:"rgba(22,163,74,.15)",color:"#16a34a"}, D:{bg:"rgba(220,38,38,.15)",color:"#DC2626"}, N:{bg:"rgba(217,119,6,.15)",color:"#d97706"} }[r] || {bg:"#243548",color:"#4A6A7A"};
  return <span style={{width:24,height:24,borderRadius:5,background:cfg.bg,color:cfg.color,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700}}>{r}</span>;
};

const StatBar = ({ label, home, away }) => {
  const hN=parseFloat(home)||0, aN=parseFloat(away)||0, total=hN+aN||1;
  return (
    <div style={{marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
        <span style={{fontSize:13,fontWeight:700,color:hN>=aN?C.accent:C.dark,minWidth:40}}>{home}</span>
        <span style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:1,flex:1,textAlign:"center"}}>{label}</span>
        <span style={{fontSize:13,fontWeight:700,color:aN>hN?C.blue:C.dark,minWidth:40,textAlign:"right"}}>{away}</span>
      </div>
      <div style={{display:"flex",gap:3,height:5}}>
        <div style={{flex:1,background:"#1E2838",borderRadius:99,overflow:"hidden",display:"flex",justifyContent:"flex-end"}}>
          <div style={{width:`${Math.max(4,(hN/total)*100)}%`,height:"100%",background:C.accent,borderRadius:99}}/>
        </div>
        <div style={{flex:1,background:"#1E2838",borderRadius:99,overflow:"hidden"}}>
          <div style={{width:`${Math.max(4,(aN/total)*100)}%`,height:"100%",background:C.blue,borderRadius:99}}/>
        </div>
      </div>
    </div>
  );
};

const ConfidenceArc = ({ value }) => {
  const r=38,cx=46,cy=46,circ=2*Math.PI*r,dash=(value/100)*circ;
  const color=value>=70?C.green:value>=50?C.warn:C.muted;
  return (
    <div style={{position:"relative",width:92,height:92}}>
      <svg width="92" height="92" viewBox="0 0 92 92">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#243548" strokeWidth={6}/>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        <span style={{fontSize:20,fontWeight:900,color:C.dark}}>{value}%</span>
        <span style={{fontSize:8,color:C.muted,letterSpacing:1}}>CONFIANCE</span>
      </div>
    </div>
  );
};

const InsightCard = ({ icon, tag, text, color }) => (
  <div style={{display:"flex",gap:8,padding:"8px 10px",background:`${color}0d`,border:`1px solid ${color}22`,borderRadius:8,marginBottom:6}}>
    <span style={{fontSize:14,flexShrink:0}}>{icon}</span>
    <div>
      <span style={{fontSize:8,fontWeight:800,color,textTransform:"uppercase",letterSpacing:.8,marginRight:6}}>{tag}</span>
      <span style={{fontSize:11,color:C.dark,lineHeight:1.5}}>{text}</span>
    </div>
  </div>
);

// ── Composant principal ──────────────────────────────────────
export default function FoxLabAnalyzer({ userAccount, onNavigatePremium }) {
  const [competitions] = useState(Object.keys(LEAGUE_IDS));
  const [competition, setCompetition] = useState("Premier League");
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [upcomingMatches, setUpcomingMatches] = useState([]);
  const [selectedFixture, setSelectedFixture] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingReal, setLoadingReal] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [realMatchData, setRealMatchData] = useState(null);
  const [realStats, setRealStats] = useState(null);
  const [odds, setOdds] = useState(null);
  const [error, setError] = useState("");
  const [step, setStep] = useState(""); // état chargement

  // Charger les matchs à venir au montage
  useEffect(() => {
    api.fetchNext(300).then(fx => {
      setUpcomingMatches(fx.filter(f => f.compId && f.home?.name && f.away?.name));
    }).catch(()=>{});
  }, []);

  // Filtrer les matchs du championnats sélectionné
  const compId = LEAGUE_IDS[competition];
  const filteredFixtures = upcomingMatches.filter(f =>
    !compId || f.compId === compId || (competition === "Champions League" && f.compId === "ucl")
  );

  // Teams : d'abord depuis les matchs API, sinon liste statique complète
  const teamsFromAPI = [...new Set([
    ...filteredFixtures.map(f => f.home?.name),
    ...filteredFixtures.map(f => f.away?.name),
  ].filter(Boolean))].sort();
  const teamsFromFixtures = teamsFromAPI.length >= 4
    ? teamsFromAPI
    : (STATIC_TEAMS[competition] || []);

  // Trouver le fixture correspondant
  const findFixture = (h, a) => filteredFixtures.find(f =>
    (f.home?.name === h && f.away?.name === a) ||
    (f.home?.name === a && f.away?.name === h)
  ) || null;

  // Quand home/away change, chercher le fixture et charger les données réelles
  useEffect(() => {
    if (!home || !away || home === away) { setSelectedFixture(null); setRealMatchData(null); setOdds(null); setRealStats(null); return; }
    const fx = findFixture(home, away);
    setSelectedFixture(fx);
    if (fx?.id && fx?.compId) {
      setLoadingReal(true);
      Promise.all([
        api.fetchMatchData(fx.compId, fx.id),
        api.fetchMatchStats(fx.id),
        api.fetchOdds(fx.id, {}),
      ]).then(([md, ms, od]) => {
        setRealMatchData(md);
        setRealStats(ms?.length >= 2 ? ms : null);
        setOdds(od);
        // Si données réelles dispo, pré-remplir les stats dans les odds
        if (md && !od) {
          api.fetchOdds(fx.id, {
            homeAtt: md.home?.avgGoalsScored||1.3,
            homeDef: md.home?.avgGoalsConceded||1.2,
            awayAtt: md.away?.avgGoalsScored||1.0,
            awayDef: md.away?.avgGoalsConceded||1.3,
          }).then(setOdds).catch(()=>{});
        }
        setLoadingReal(false);
      }).catch(()=>setLoadingReal(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home, away, competition]);

  const analyze = async () => {
    if (!home || !away || home === away) { setError("Sélectionne deux équipes différentes."); return; }
    setError(""); setLoading(true); setAnalysis(null); setStep("Connexion à l'IA…");
    try {
      setStep("Analyse des données réelles…");
      const result = await api.analyzeWithAI(realMatchData, home, away, competition, null, selectedFixture);
      if (!result.pronostic && !result.resume) throw new Error("Analyse incomplète.");
      setAnalysis({ ...result, home, away, competition });
      setStep("");
    } catch(e) {
      setError(`Erreur IA : ${e.message}`);
      setStep("");
    } finally { setLoading(false); }
  };

  // Calcul des insights parieurs depuis données réelles
  const computeInsights = () => {
    if (!realMatchData) return [];
    const h = realMatchData.home, a = realMatchData.away;
    const insights = [];
    const bttsH=h?.btts||0, bttsA=a?.btts||0, bttsComb=Math.round((bttsH+bttsA)/2);
    const o25H=h?.over25||0, o25A=a?.over25||0, o25Comb=Math.round((o25H+o25A)/2);
    const avgG=(h?.avgGoalsScored||0)+(a?.avgGoalsScored||0);
    if (o25Comb>65) insights.push({icon:"📈",color:C.green,tag:"OVER 2.5",text:`Over 2.5 dans ${o25Comb}% des matchs (Dom. ${o25H}% · Ext. ${o25A}%)`});
    if (bttsComb>65) insights.push({icon:"⚽",color:C.accent,tag:"BTTS OUI",text:`Les deux équipes marquent dans ${bttsComb}% des cas`});
    if (avgG>3.0) insights.push({icon:"🔥",color:C.warn,tag:"BUTS",text:`Moyenne ${avgG.toFixed(1)} buts/match combinée — profil très offensif`});
    if ((h?.cleanSheet||0)>50) insights.push({icon:"🛡",color:C.blue,tag:"DÉFENSE",text:`${home} garde sa cage inviolée dans ${h.cleanSheet}% des matchs à domicile`});
    const hForm=(h?.form||[]).slice(-5), aForm=(a?.form||[]).slice(-5);
    const hPts=hForm.reduce((s,r)=>s+(r==="W"?3:r==="D"?1:0),0);
    const aPts=aForm.reduce((s,r)=>s+(r==="W"?3:r==="D"?1:0),0);
    if (Math.abs(hPts-aPts)>=6) insights.push({icon:"💪",color:hPts>aPts?C.accent:C.blue,tag:"FORME",text:`${hPts>aPts?home:away} nettement supérieur en forme récente (${Math.max(hPts,aPts)}/15 pts)`});
    const h2h=realMatchData.h2h||[];
    if (h2h.length>=3) {
      const hw=h2h.filter(x=>x.winner==="home").length, aw=h2h.filter(x=>x.winner==="away").length;
      if (hw/h2h.length>=0.7) insights.push({icon:"⚔️",color:C.warn,tag:"H2H",text:`${home} domine le H2H : ${hw}/${h2h.length} victoires`});
      else if (aw/h2h.length>=0.7) insights.push({icon:"⚔️",color:C.warn,tag:"H2H",text:`${away} domine le H2H : ${aw}/${h2h.length} victoires`});
    }
    return insights;
  };

  const insights = computeInsights();
  const hasRealData = !!realMatchData;
  const isPremium = userAccount?.plan === "premium" || userAccount?.plan === "vip";

  const selectStyle = {width:"100%",padding:"10px 12px",borderRadius:8,border:`1px solid ${C.border}`,background:"#0E1A28",color:C.dark,fontSize:13,outline:"none",cursor:"pointer"};

  return (
    <div style={{background:C.bg,minHeight:"100%",padding:"20px 24px 60px",fontFamily:"'DM Sans',sans-serif",color:C.dark}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <div style={{width:44,height:44,borderRadius:12,overflow:"hidden",border:`2px solid ${C.accent}44`,flexShrink:0}}>
          <img src="/fox-mascot.avif" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"center top"}} alt="FoxLab"/>
        </div>
        <div>
          <div style={{fontSize:20,fontWeight:900,color:C.dark}}>Analyse IA d'un Match</div>
          <div style={{fontSize:11,color:C.muted}}>
            {hasRealData ? "✅ Données réelles API-Football détectées" : "Sélectionne un match pour charger les données réelles"}
          </div>
        </div>
        {!isPremium && (
          <button onClick={()=>onNavigatePremium?.()} style={{marginLeft:"auto",background:C.accentBg,border:`1px solid ${C.accentBorder}`,borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:11,color:C.accent,fontWeight:700}}>
            ⭐ Premium — Analyse illimitée
          </button>
        )}
      </div>

      {/* Sélection */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"18px 20px",marginBottom:14}}>
        <div style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:.8,marginBottom:12}}>Configurer le match</div>

        {/* Compétitions */}
        <div style={{display:"flex",gap:5,marginBottom:14,flexWrap:"wrap"}}>
          {competitions.map(l=>(
            <button key={l} onClick={()=>{setCompetition(l);setHome("");setAway("");setAnalysis(null);setRealMatchData(null);}} style={{
              padding:"5px 11px",borderRadius:99,fontSize:10,cursor:"pointer",fontWeight:competition===l?700:400,
              border:`1px solid ${competition===l?C.accent:C.border}`,
              background:competition===l?C.accentBg:"none",
              color:competition===l?C.accent:C.muted,
            }}>{l}</button>
          ))}
        </div>

        {/* Dropdowns */}
        <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:12,alignItems:"end",marginBottom:14}}>
          <div>
            <div style={{fontSize:9,color:C.muted,textTransform:"uppercase",marginBottom:5}}>🏠 Domicile</div>
            <select value={home} onChange={e=>{setHome(e.target.value);setAnalysis(null);}} style={selectStyle}>
              <option value="">Choisir l&apos;équipe…</option>
              {(teamsFromFixtures.length>0?teamsFromFixtures:[]).filter(t=>t!==away).map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
          <div style={{fontSize:16,fontWeight:700,color:C.muted,paddingBottom:8,textAlign:"center"}}>vs</div>
          <div>
            <div style={{fontSize:9,color:C.muted,textTransform:"uppercase",marginBottom:5}}>✈️ Extérieur</div>
            <select value={away} onChange={e=>{setAway(e.target.value);setAnalysis(null);}} style={selectStyle}>
              <option value="">Choisir l&apos;équipe…</option>
              {(teamsFromFixtures.length>0?teamsFromFixtures:[]).filter(t=>t!==home).map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* Infos match si fixture trouvé */}
        {selectedFixture && (
          <div style={{background:C.accentBg,border:`1px solid ${C.accentBorder}`,borderRadius:8,padding:"8px 12px",marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:12,color:C.accent}}>📅</span>
            <span style={{fontSize:11,color:C.dark}}>
              {selectedFixture.league} · {new Date(selectedFixture.date).toLocaleDateString("fr-FR",{day:"numeric",month:"long",hour:"2-digit",minute:"2-digit"})}
            </span>
            {loadingReal && <span style={{marginLeft:"auto",fontSize:10,color:C.muted}}>Chargement données…</span>}
            {hasRealData && !loadingReal && <span style={{marginLeft:"auto",fontSize:10,color:C.green}}>✅ Données chargées</span>}
          </div>
        )}

        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <button onClick={analyze} disabled={loading||!home||!away} style={{
            padding:"11px 28px",background:(!loading&&home&&away)?C.accent:"#243548",
            color:(!loading&&home&&away)?"#0A1428":C.muted,
            border:"none",borderRadius:9,fontSize:13,fontWeight:800,
            cursor:(!loading&&home&&away)?"pointer":"default",transition:"all .15s",
            boxShadow:(!loading&&home&&away)?`0 4px 16px ${C.accent}44`:"none",
            display:"flex",alignItems:"center",gap:8,
          }}>
            {loading ? (
              <><div style={{width:14,height:14,borderRadius:"50%",border:`2px solid #0A142888`,borderTop:`2px solid #0A1428`,animation:"spin .6s linear infinite"}}/>{step||"Analyse…"}</>
            ) : <>🦊 {hasRealData?"Analyser avec données réelles":"Analyser"}</>}
          </button>
          {home&&away&&!loading && (
            <span style={{fontSize:11,color:C.muted}}>{home} <span style={{color:C.accent}}>vs</span> {away}</span>
          )}
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        {error&&<div style={{marginTop:8,fontSize:12,color:C.red,background:"rgba(220,38,38,.1)",borderRadius:6,padding:"7px 12px"}}>{error}</div>}
      </div>

      {/* Données réelles pré-analyse */}
      {hasRealData && !analysis && (
        <div style={{marginBottom:14}}>
          {/* Insights */}
          {insights.length>0&&(
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 16px",marginBottom:10}}>
              <div style={{fontSize:9,color:C.accent,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:10}}>💡 Insights pour les parieurs</div>
              {insights.map((ins,i)=><InsightCard key={i} {...ins}/>)}
            </div>
          )}
          {/* Stats réelles */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:10}}>
            {[
              {l:"Moy. buts",v:((realMatchData.home?.avgGoalsScored||0)+(realMatchData.away?.avgGoalsScored||0)).toFixed(1),c:C.dark,s:"combiné"},
              {l:"BTTS",v:`${Math.round(((realMatchData.home?.btts||0)+(realMatchData.away?.btts||0))/2)}%`,c:C.accent,s:"les 2 marquent"},
              {l:"Over 2.5",v:`${Math.round(((realMatchData.home?.over25||0)+(realMatchData.away?.over25||0))/2)}%`,c:C.blue,s:"3+ buts"},
              {l:"H2H",v:(realMatchData.h2h?.length||0)+" matchs",c:C.warn,s:"historique"},
            ].map(s=>(
              <div key={s.l} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 8px",textAlign:"center"}}>
                <div style={{fontSize:18,fontWeight:900,color:s.c}}>{s.v}</div>
                <div style={{fontSize:8,color:C.muted,textTransform:"uppercase"}}>{s.l}</div>
                <div style={{fontSize:9,color:C.muted}}>{s.s}</div>
              </div>
            ))}
          </div>
          {/* Forme */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            {[{name:home,data:realMatchData.home},{name:away,data:realMatchData.away}].map(({name,data})=>(
              <div key={name} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 12px"}}>
                <div style={{fontSize:11,fontWeight:600,color:C.dark,marginBottom:6,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</div>
                <div style={{display:"flex",gap:4,marginBottom:4}}>
                  {(data?.form||[]).slice(-5).map((r,i)=><FormBadge key={i} r={r}/>)}
                </div>
                <div style={{fontSize:9,color:C.muted}}>{data?.avgGoalsScored?.toFixed(1)||"—"} buts · {data?.avgGoalsConceded?.toFixed(1)||"—"} enc. · {data?.cleanSheet||0}% CS</div>
              </div>
            ))}
          </div>
          {/* Cotes Poisson */}
          {odds&&(
            <div style={{background:C.card,border:`1px solid ${odds.estimated?"rgba(217,119,6,.4)":C.border}`,borderRadius:9,padding:"10px 14px",display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
              <span style={{fontSize:10,color:C.muted,fontWeight:600}}>{odds.bookmaker||"Verdikt"}</span>
              {odds.estimated&&<span style={{fontSize:8,background:"rgba(217,119,6,.15)",color:C.warn,borderRadius:4,padding:"1px 6px",fontWeight:700}}>⚡ POISSON</span>}
              {odds.proba&&<div style={{display:"flex",gap:10,fontSize:11}}>
                <span style={{color:C.accent,fontWeight:700}}>Dom. {odds.proba.home}%</span>
                <span style={{color:C.muted}}>Nul {odds.proba.draw}%</span>
                <span style={{color:C.blue,fontWeight:700}}>Ext. {odds.proba.away}%</span>
              </div>}
              {odds.win?.home&&<div style={{display:"flex",gap:6,marginLeft:"auto"}}>
                <span style={{background:C.accentBg,color:C.accent,borderRadius:5,padding:"3px 10px",fontSize:12,fontWeight:700}}>1 {odds.win.home}</span>
                <span style={{background:"#1E2838",color:C.muted,borderRadius:5,padding:"3px 10px",fontSize:12}}>X {odds.win.draw}</span>
                <span style={{background:"rgba(59,130,246,.12)",color:C.blue,borderRadius:5,padding:"3px 10px",fontSize:12,fontWeight:700}}>2 {odds.win.away}</span>
              </div>}
            </div>
          )}
        </div>
      )}

      {/* Loading IA */}
      {loading&&(
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"32px",textAlign:"center",marginBottom:14}}>
          <div style={{width:56,height:56,borderRadius:12,overflow:"hidden",margin:"0 auto 12px",border:`2px solid ${C.accent}44`}}>
            <img src="/fox-mascot.avif" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"center top"}} alt="FoxLab"/>
          </div>
          <div style={{fontSize:14,color:C.dark,fontWeight:600,marginBottom:4}}>{step||"Analyse en cours…"}</div>
          <div style={{fontSize:11,color:C.muted}}>L&apos;IA analyse {hasRealData?"les données réelles":"les statistiques historiques"}…</div>
        </div>
      )}

      {/* Résultats analyse IA */}
      {analysis&&!loading&&(()=>{
        const showFull = isPremium;

        // 20% visible : header équipes + résumé tronqué (2 premières phrases)
        const resumeTronque = !showFull
          ? (analysis.resume||"").split(/[.!?]/).slice(0,1).join(".")+"."
          : analysis.resume;

        return (
          <div style={{position:"relative"}}>
            {/* ══ PARTIE VISIBLE (20%) — tout le monde ══ */}
            <div style={{background:C.card,border:`2px solid ${C.accent}44`,borderRadius:12,padding:"16px 20px",marginBottom:showFull?14:0,borderBottomLeftRadius:showFull?12:0,borderBottomRightRadius:showFull?12:0}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",alignItems:"center",gap:12,marginBottom:12}}>
                <div>
                  <div style={{fontSize:16,fontWeight:700,color:C.accent}}>{analysis.home}</div>
                  <div style={{fontSize:10,color:C.muted}}>Domicile</div>
                </div>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:10,color:C.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>{analysis.competition}</div>
                  {/* Score : flou si gratuit */}
                  {showFull
                    ? <div style={{fontSize:28,fontWeight:900,color:C.dark,letterSpacing:3}}>{analysis.pronostic?.score||"?-?"}</div>
                    : <div style={{fontSize:28,fontWeight:900,color:C.dark,letterSpacing:3,filter:"blur(6px)",userSelect:"none"}}>?-?</div>
                  }
                  <div style={{fontSize:9,color:C.muted,marginTop:3}}>Pronostic IA · {hasRealData?"Données réelles":"Données historiques"}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:16,fontWeight:700,color:C.blue}}>{analysis.away}</div>
                  <div style={{fontSize:10,color:C.muted}}>Extérieur</div>
                </div>
              </div>
              {/* Résumé : 20% visible (1 phrase), reste coupé */}
              <div style={{background:C.accentBg,border:`1px solid ${C.accentBorder}`,borderRadius:8,padding:"10px 13px",position:"relative",overflow:"hidden"}}>
                <span style={{fontSize:12,color:C.mid,lineHeight:1.6}}>🦊 {resumeTronque}</span>
                {!showFull && (
                  <span style={{fontSize:12,color:C.muted,filter:"blur(4px)",userSelect:"none",pointerEvents:"none"}}>
                    {" "}L'analyse tactique révèle un avantage domicile net avec des statistiques de pressing supérieures et un xG favorable. Les confrontations directes montrent une nette domination sur les dernières saisons avec un taux de clean sheet remarquable...
                  </span>
                )}
              </div>
            </div>

            {/* ══ PARTIE FLOUE (80%) — Premium uniquement ══ */}
            {!showFull && (
              <div style={{position:"relative",borderRadius:"0 0 12px 12px",overflow:"hidden"}}>
                {/* Contenu en arrière-plan — flou */}
                <div style={{filter:"blur(7px)",pointerEvents:"none",userSelect:"none",background:C.card,border:`1px solid ${C.border}`,borderTop:"none",padding:"16px 20px 200px"}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                    <div style={{background:"#1A2030",borderRadius:10,padding:"14px 16px",height:120}}/>
                    <div style={{background:"#1A2030",borderRadius:10,padding:"14px 16px",height:120}}/>
                  </div>
                  <div style={{background:"#1A2030",borderRadius:10,padding:"14px 16px",marginBottom:12,height:140}}/>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                    <div style={{background:"#1A2030",borderRadius:10,padding:"14px 16px",height:180}}/>
                    <div style={{background:"#1A2030",borderRadius:10,padding:"14px 16px",height:180}}/>
                  </div>
                </div>
                {/* Overlay CTA */}
                <div style={{
                  position:"absolute",inset:0,
                  background:"linear-gradient(to bottom, rgba(20,28,40,0) 0%, rgba(20,28,40,.6) 30%, rgba(20,28,40,.95) 60%)",
                  display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",
                  paddingBottom:28,gap:12,
                }}>
                  <div style={{textAlign:"center",padding:"0 20px"}}>
                    <div style={{fontSize:14,fontWeight:800,color:C.dark,marginBottom:6}}>🔒 Analyse complète réservée aux membres Premium</div>
                    <div style={{fontSize:12,color:C.muted,lineHeight:1.6,marginBottom:16}}>
                      Formulaires de forme · Statistiques avancées · Joueurs clés · Paris à valeur · Analyse tactique complète
                    </div>
                    <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
                      <button onClick={()=>onNavigatePremium?.()} style={{
                        background:C.accent,color:"#0A1428",border:"none",borderRadius:10,
                        padding:"12px 28px",cursor:"pointer",fontSize:14,fontWeight:900,
                        boxShadow:`0 4px 20px ${C.accent}55`,
                      }}>
                        🔓 Débloquer — 10€/mois
                      </button>
                      <button onClick={()=>onNavigatePremium?.()} style={{
                        background:"none",color:C.muted,border:`1px solid #243548`,
                        borderRadius:10,padding:"12px 16px",cursor:"pointer",fontSize:12,
                      }}>
                        Voir les avantages
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ══ CONTENU COMPLET si Premium ══ */}
            {showFull && (
              <>
            {/* Facteurs + signal */}
            {analysis.facteurs_cles?.length>0&&(
              <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
                {analysis.signal_parieur&&<span style={{fontSize:10,background:`${analysis.signal_parieur==="fort"?C.green:analysis.signal_parieur==="moyen"?C.warn:C.muted}18`,color:analysis.signal_parieur==="fort"?C.green:analysis.signal_parieur==="moyen"?C.warn:C.muted,borderRadius:20,padding:"3px 12px",fontWeight:700,border:`1px solid currentColor`}}>📡 Signal {analysis.signal_parieur}</span>}
                {analysis.facteurs_cles.map((f,i)=><span key={i} style={{fontSize:10,background:"rgba(217,119,6,.12)",color:C.warn,borderRadius:20,padding:"3px 12px"}}>⚡ {f}</span>)}
              </div>
            )}

            {/* ── ALERTES IA ── */}
            {analysis.alertes?.length>0&&(
              <div style={{marginBottom:14,display:"flex",flexDirection:"column",gap:7}}>
                <div style={{fontSize:10,fontWeight:700,color:C.dark,textTransform:"uppercase",letterSpacing:.8,marginBottom:2}}>⚠️ Alertes détectées</div>
                {analysis.alertes.map((alerte,i)=>{
                  const col = alerte.niveau==="ROUGE"?"#DC2626":alerte.niveau==="ORANGE"?"#d97706":C.green;
                  return (
                    <div key={i} style={{display:"flex",gap:10,padding:"10px 14px",background:`${col}0e`,border:`1px solid ${col}44`,borderRadius:10,borderLeft:`4px solid ${col}`}}>
                      <span style={{fontSize:18,flexShrink:0}}>{alerte.icone||"⚠️"}</span>
                      <div>
                        <div style={{fontSize:12,fontWeight:700,color:col,marginBottom:3}}>{alerte.titre}</div>
                        <div style={{fontSize:11,color:C.dark,lineHeight:1.5}}>{alerte.texte}</div>
                      </div>
                      <span style={{marginLeft:"auto",flexShrink:0,fontSize:9,fontWeight:800,color:col,background:`${col}18`,borderRadius:6,padding:"2px 8px",alignSelf:"flex-start"}}>{alerte.niveau}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── H2H rapide ── */}
            {analysis.h2h_analyse&&(
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",marginBottom:12}}>
                <div style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:.8,marginBottom:6}}>⚔️ Face-à-face</div>
                <div style={{fontSize:12,color:C.dim,lineHeight:1.6}}>{analysis.h2h_analyse}</div>
              </div>
            )}

            {/* Contenu complet Premium */}
            <div style={{position:"relative"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                {/* Forme */}
                <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 16px"}}>
                  <div style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:.8,marginBottom:10}}>Forme récente</div>
                  {[{n:analysis.home,f:analysis.forme?.home},{n:analysis.away,f:analysis.forme?.away}].map(({n,f},i)=>(
                    <div key={n} style={{marginBottom:i===0?12:0,paddingTop:i===1?12:0,borderTop:i===1?`1px solid ${C.border}`:"none"}}>
                      <div style={{fontSize:12,fontWeight:600,color:i===0?C.accent:C.blue,marginBottom:6}}>{n}</div>
                      <div style={{display:"flex",gap:4,marginBottom:4}}>{(f?.resultats||[]).map((r,j)=><FormBadge key={j} r={r}/>)}</div>
                      <div style={{fontSize:11,color:C.muted,lineHeight:1.5}}>{f?.desc}</div>
                    </div>
                  ))}
                </div>
                {/* Verdict */}
                <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 16px"}}>
                  <div style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:.8,marginBottom:10}}>Verdict</div>
                  <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:10}}>
                    <ConfidenceArc value={analysis.pronostic?.confiance||50}/>
                    <div>
                      <div style={{fontSize:14,fontWeight:700,color:C.dark,marginBottom:4}}>{analysis.pronostic?.resultat}</div>
                      <div style={{fontSize:11,color:C.muted,lineHeight:1.5}}>{analysis.pronostic?.explication}</div>
                    </div>
                  </div>
                  <div style={{background:C.accentBg,border:`1px solid ${C.accentBorder}`,borderRadius:7,padding:"8px 10px",fontSize:11,color:C.mid,fontStyle:"italic"}}>🦊 {analysis.verdict}</div>
                </div>
              </div>

              {/* Stats */}
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 16px",marginBottom:12}}>
                <div style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:.8,marginBottom:10}}>Comparaison statistique</div>
                <div style={{display:"flex",gap:14,marginBottom:10}}>
                  <div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:9,height:9,borderRadius:2,background:C.accent}}/><span style={{fontSize:10,color:C.mid}}>{analysis.home}</span></div>
                  <div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:9,height:9,borderRadius:2,background:C.blue}}/><span style={{fontSize:10,color:C.mid}}>{analysis.away}</span></div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 24px"}}>
                  {(analysis.stats||[]).map((s,i)=><StatBar key={i} label={s.label} home={s.home} away={s.away}/>)}
                </div>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                {/* Joueurs */}
                <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 16px"}}>
                  <div style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:.8,marginBottom:10}}>Joueurs à surveiller</div>
                  {[{team:analysis.home,players:analysis.joueurs_cles?.home,color:C.accent},{team:analysis.away,players:analysis.joueurs_cles?.away,color:C.blue}].map(({team,players,color},ti)=>(
                    <div key={team} style={{marginBottom:ti===0?12:0,paddingTop:ti===1?12:0,borderTop:ti===1?`1px solid ${C.border}`:"none"}}>
                      <div style={{fontSize:10,color,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>{team}</div>
                      {(players||[]).map((j,i)=>(
                        <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:i<(players.length-1)?`1px solid ${C.border}22`:"none"}}>
                          <div><div style={{fontSize:12,fontWeight:600,color:C.dark}}>{j.nom}</div><div style={{fontSize:10,color:C.muted}}>{j.poste}</div></div>
                          <div style={{fontSize:11,color,fontWeight:600}}>{j.stat}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                {/* Paris */}
                <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 16px"}}>
                  <div style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:.8,marginBottom:10}}>Paris conseillés</div>
                  {(analysis.paris||[]).map((p,i)=>{
                    const vc=p.valeur==="bonne"||p.valeur==="forte"?C.green:p.valeur==="intéressante"?C.warn:C.muted;
                    return (
                      <div key={i} style={{background:"#0E1A28",borderRadius:8,padding:"9px 12px",marginBottom:8,border:`1px solid ${vc}33`}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                          <div style={{fontSize:12,fontWeight:600,color:C.dark}}>{p.type}</div>
                          <div style={{fontSize:18,fontWeight:900,color:C.accent}}>{p.cote_estimee}</div>
                        </div>
                        <div style={{fontSize:10,color:vc,marginBottom:p.raisonnement?2:0}}>Valeur <strong>{p.valeur}</strong></div>
                        {p.raisonnement&&<div style={{fontSize:10,color:C.muted,lineHeight:1.4}}>{p.raisonnement}</div>}
                      </div>
                    );
                  })}
                  <div style={{fontSize:10,color:C.muted,lineHeight:1.5,marginTop:4}}>⚠️ Cotes estimées — vérifier chez les bookmakers.</div>
                </div>
              </div>

              {/* Analyse tactique */}
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 16px"}}>
                <div style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>Analyse tactique</div>
                <div style={{fontSize:13,color:C.mid,lineHeight:1.8}}>{analysis.analyse}</div>
              </div>
            </div>{/* fin contenu complet */}
              </>
            )}{/* fin showFull */}

          </div>
        );
      })()}

      {/* Empty state */}
      {!analysis&&!loading&&!hasRealData&&(
        <div style={{textAlign:"center",padding:"40px 20px"}}>
          <div style={{width:64,height:64,borderRadius:14,overflow:"hidden",margin:"0 auto 14px",border:`2px solid ${C.accent}44`}}>
            <img src="/fox-mascot.avif" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"center top",transform:"scale(1.1)"}} alt="FoxLab"/>
          </div>
          <div style={{fontSize:18,fontWeight:700,color:C.dark,marginBottom:6}}>Prêt à analyser</div>
          <div style={{fontSize:13,color:C.muted,maxWidth:380,margin:"0 auto",lineHeight:1.7}}>
            Sélectionne un championnat et deux équipes. Si le match est à venir, les données réelles sont chargées automatiquement.
          </div>
        </div>
      )}
    </div>
  );
}
