import { useState } from "react";

// Palette cohérente avec FoxLab dark
const C = {
  bg:         "#141C28",
  card:       "#1A2030",
  cardHover:  "#1E2838",
  border:     "#243548",
  accent:     "#00D4AA",
  accentBg:   "rgba(0,212,170,.12)",
  accentBorder:"rgba(0,212,170,.3)",
  dark:       "#D0E8F4",
  mid:        "#8AABBD",
  muted:      "#4A6A7A",
  dim:        "#243548",
  blue:       "#3b82f6",
  blueBg:     "rgba(59,130,246,.12)",
  green:      "#16a34a",
  greenBg:    "rgba(22,163,74,.12)",
  red:        "#DC2626",
  redBg:      "rgba(220,38,38,.12)",
  warn:       "#d97706",
  warnBg:     "rgba(217,119,6,.12)",
};

const LEAGUES = {
  "Ligue 1": ["Paris Saint-Germain","Olympique de Marseille","Olympique Lyonnais","AS Monaco","Lille OSC","RC Lens","Stade Rennais","OGC Nice","Stade de Reims","FC Nantes","RC Strasbourg","Toulouse FC","Montpellier HSC"],
  "Premier League": ["Arsenal","Liverpool","Manchester City","Chelsea","Tottenham","Manchester United","Aston Villa","Newcastle United","Brighton","West Ham","Wolverhampton","Fulham","Brentford","Everton","Crystal Palace"],
  "La Liga": ["Real Madrid","FC Barcelone","Atlético Madrid","Séville FC","Real Sociedad","Villarreal","Athletic Bilbao","Real Betis","Valence CF","Celta Vigo","Getafe CF","Rayo Vallecano","Girona FC"],
  "Serie A": ["Inter Milan","Juventus","AC Milan","SSC Naples","AS Roma","Lazio","Atalanta","Fiorentina","Torino","Bologna","Udinese","Empoli","Sassuolo"],
  "Bundesliga": ["Bayern Munich","Borussia Dortmund","Bayer Leverkusen","RB Leipzig","Union Berlin","Eintracht Francfort","Fribourg","Wolfsburg","Mainz 05","Borussia Mönchengladbach","Hoffenheim"],
  "Champions League": ["Real Madrid","Manchester City","Bayern Munich","PSG","Barcelona","Arsenal","Atletico Madrid","Inter Milan","Borussia Dortmund","Liverpool","Chelsea","Juventus"],
  "Copa América / Euro": ["France","Espagne","Allemagne","Angleterre","Portugal","Argentine","Brésil","Italie","Uruguay","Colombie","Pays-Bas","Belgique"],
};

const FormBadge = ({ r }) => {
  const cfg = {
    V: { bg: C.greenBg, color: C.green, border: `1px solid ${C.green}44` },
    D: { bg: C.redBg,   color: C.red,   border: `1px solid ${C.red}44` },
    N: { bg: C.warnBg,  color: C.warn,  border: `1px solid ${C.warn}44` },
  }[r] || { bg: C.dim, color: C.muted, border: `1px solid ${C.border}` };
  return (
    <span style={{ width:26, height:26, borderRadius:6, background:cfg.bg, color:cfg.color, border:cfg.border, display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700 }}>{r}</span>
  );
};

const StatBar = ({ label, home, away }) => {
  const hN = parseFloat(home) || 0;
  const aN = parseFloat(away) || 0;
  const total = hN + aN || 1;
  const hPct = (hN / total) * 100;
  const aPct = (aN / total) * 100;
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
        <span style={{ fontSize:13, fontWeight:700, color: hN >= aN ? C.accent : C.dark, minWidth:40 }}>{home}</span>
        <span style={{ fontSize:9, color:C.muted, textTransform:"uppercase", letterSpacing:1, textAlign:"center", flex:1 }}>{label}</span>
        <span style={{ fontSize:13, fontWeight:700, color: aN > hN ? C.blue : C.dark, minWidth:40, textAlign:"right" }}>{away}</span>
      </div>
      <div style={{ display:"flex", gap:3, height:6 }}>
        <div style={{ flex:1, background:"#1E2838", borderRadius:99, overflow:"hidden", display:"flex", justifyContent:"flex-end" }}>
          <div style={{ width:`${Math.max(4,hPct)}%`, height:"100%", background:C.accent, borderRadius:99 }}/>
        </div>
        <div style={{ flex:1, background:"#1E2838", borderRadius:99, overflow:"hidden" }}>
          <div style={{ width:`${Math.max(4,aPct)}%`, height:"100%", background:C.blue, borderRadius:99 }}/>
        </div>
      </div>
    </div>
  );
};

const ConfidenceArc = ({ value }) => {
  const r=38, cx=46, cy=46, circ=2*Math.PI*r;
  const dash = (value/100)*circ;
  const color = value>=70 ? C.green : value>=50 ? C.warn : C.muted;
  return (
    <div style={{ position:"relative", width:92, height:92 }}>
      <svg width="92" height="92" viewBox="0 0 92 92">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#243548" strokeWidth={6}/>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`} style={{ transition:"stroke-dasharray .8s ease" }}/>
      </svg>
      <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
        <span style={{ fontSize:20, fontWeight:900, color:C.dark, lineHeight:1 }}>{value}%</span>
        <span style={{ fontSize:8, color:C.muted, letterSpacing:1, marginTop:1 }}>CONFIANCE</span>
      </div>
    </div>
  );
};

const Card = ({ children, accent, style={} }) => (
  <div style={{ background:C.card, border:`1px solid ${accent?accent+"44":C.border}`, borderRadius:12, padding:"18px 20px", marginBottom:14, borderTop: accent?`2px solid ${accent}`:undefined, ...style }}>
    {children}
  </div>
);

const SectionTitle = ({ children }) => (
  <div style={{ fontSize:9, color:C.muted, letterSpacing:2, textTransform:"uppercase", marginBottom:14 }}>{children}</div>
);

export default function FoxLabAnalyzer({ userAccount, onNavigatePremium }) {
  const [competition, setCompetition] = useState("Ligue 1");
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState("");

  const teams = LEAGUES[competition] || [];

  const analyze = async () => {
    if (!home || !away || home === away) { setError("Sélectionne deux équipes différentes."); return; }
    setError(""); setLoading(true); setAnalysis(null);
    try {
      // Appel via notre backend Groq (pas d'exposition de clé API)
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: `Analyse ce match de ${competition}: ${home} (domicile) vs ${away} (extérieur). Génère une analyse complète et réaliste basée sur les performances historiques connues de ces équipes.`,
          context: null,
          history: [],
          teamDatabase: {},
          structuredOutput: true,
          outputSchema: `{
  "resume": "phrase courte de présentation du match",
  "forme": {
    "home": {"resultats": ["V","D","V","V","N"], "desc": "courte description de la forme"},
    "away": {"resultats": ["N","V","D","V","V"], "desc": "courte description"}
  },
  "stats": [
    {"label": "Buts/match", "home": 1.8, "away": 1.2},
    {"label": "Buts encaissés", "home": 1.1, "away": 1.4},
    {"label": "Tirs/match", "home": 14, "away": 11},
    {"label": "Possession %", "home": 54, "away": 46},
    {"label": "Clean sheets %", "home": 40, "away": 30},
    {"label": "BTTS %", "home": 55, "away": 60},
    {"label": "Over 2.5 %", "home": 60, "away": 45}
  ],
  "joueurs_cles": {
    "home": [{"nom": "nom", "poste": "poste", "stat": "stat clé"}],
    "away": [{"nom": "nom", "poste": "poste", "stat": "stat clé"}]
  },
  "analyse": "2-3 phrases d'analyse tactique détaillée",
  "pronostic": {
    "score": "2-1",
    "resultat": "Victoire domicile",
    "confiance": 65,
    "explication": "courte explication du pronostic"
  },
  "paris": [
    {"type": "Victoire domicile", "cote": "1.75", "valeur": "bonne", "raisonnement": "pourquoi"},
    {"type": "Plus de 2.5 buts", "cote": "1.90", "valeur": "intéressante", "raisonnement": "pourquoi"},
    {"type": "BTTS Oui", "cote": "1.80", "valeur": "neutre", "raisonnement": "pourquoi"}
  ],
  "verdict": "phrase finale résumant le verdict de l'analyse",
  "facteurs_cles": ["facteur 1", "facteur 2", "facteur 3"]
}
Réponds UNIQUEMENT avec un objet JSON valide, sans markdown.`,
        }),
      });
      const data = await res.json();
      const text = data.answer || "";
      if (!text) throw new Error("Réponse vide du serveur.");
      // Parsing robuste : tente direct, puis extrait le JSON du texte
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        const clean = text.replace(/```json|```/gi, "").trim();
        const match = clean.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("L'IA n'a pas renvoyé un JSON valide. Réessaie.");
        parsed = JSON.parse(match[0]);
      }
      if (!parsed.pronostic && !parsed.resume) throw new Error("Analyse incomplète reçue. Réessaie.");
      setAnalysis({ ...parsed, home, away, competition });
    } catch (e) {
      setError(`Erreur : ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const selectStyle = {
    width:"100%", padding:"10px 12px", border:`1px solid ${C.border}`,
    borderRadius:8, background:"#0E1A28", color:C.dark, fontSize:13, outline:"none",
    cursor:"pointer",
  };

  return (
    <div style={{ minHeight:"100%", background:C.bg, fontFamily:"'DM Sans',-apple-system,sans-serif", color:C.dark, padding:"20px 24px 60px" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24 }}>
        <div style={{ width:44, height:44, borderRadius:12, overflow:"hidden", border:`2px solid ${C.accent}44` }}>
          <img src="/fox-mascot.avif" style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"center top" }} alt="FoxLab"/>
        </div>
        <div>
          <div style={{ fontSize:20, fontWeight:900, color:C.dark }}>Analyse IA d'un Match</div>
          <div style={{ fontSize:11, color:C.muted }}>Sélectionne deux équipes · L'IA génère l'analyse complète</div>
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:6 }}>
          <span style={{ fontSize:10, background:C.accentBg, color:C.accent, border:`1px solid ${C.accentBorder}`, padding:"3px 10px", borderRadius:99, fontWeight:700 }}>🦊 IA Powered</span>
        </div>
      </div>

      {/* Sélecteur */}
      <Card accent={C.accent}>
        <SectionTitle>Configurer le match</SectionTitle>

        {/* Compétitions */}
        <div style={{ display:"flex", gap:5, marginBottom:16, flexWrap:"wrap" }}>
          {Object.keys(LEAGUES).map(l => (
            <button key={l} onClick={() => { setCompetition(l); setHome(""); setAway(""); setAnalysis(null); }} style={{
              padding:"5px 12px", borderRadius:99, fontSize:11, cursor:"pointer", fontWeight: l===competition?700:400,
              border:`1px solid ${l===competition?C.accent:C.border}`,
              background: l===competition ? C.accentBg : "none",
              color: l===competition ? C.accent : C.muted,
            }}>{l}</button>
          ))}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", gap:12, alignItems:"end", marginBottom:16 }}>
          <div>
            <div style={{ fontSize:9, color:C.muted, letterSpacing:1, textTransform:"uppercase", marginBottom:6 }}>🏠 Domicile</div>
            <select value={home} onChange={e=>setHome(e.target.value)} style={selectStyle}>
              <option value="">Choisir l'équipe...</option>
              {teams.filter(t=>t!==away).map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ fontSize:16, fontWeight:700, color:C.muted, paddingBottom:8, textAlign:"center" }}>vs</div>
          <div>
            <div style={{ fontSize:9, color:C.muted, letterSpacing:1, textTransform:"uppercase", marginBottom:6 }}>✈️ Extérieur</div>
            <select value={away} onChange={e=>setAway(e.target.value)} style={selectStyle}>
              <option value="">Choisir l'équipe...</option>
              {teams.filter(t=>t!==home).map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={analyze} disabled={loading||!home||!away} style={{
            padding:"11px 28px", background: (!loading&&home&&away)?C.accent:"#243548",
            color: (!loading&&home&&away)?"#0A1428":C.muted,
            border:"none", borderRadius:9, fontSize:13, fontWeight:800, cursor: (!loading&&home&&away)?"pointer":"default",
            letterSpacing:.3, display:"flex", alignItems:"center", gap:8, transition:"all .15s",
            boxShadow: (!loading&&home&&away)?`0 4px 16px ${C.accent}44`:"none",
          }}>
            {loading ? (
              <>
                <div style={{ width:14, height:14, borderRadius:"50%", border:`2px solid #0A142888`, borderTop:`2px solid #0A1428`, animation:"spin .6s linear infinite" }}/>
                Analyse en cours…
              </>
            ) : (
              <>🦊 Analyser ce match</>
            )}
          </button>
          {home && away && (
            <span style={{ fontSize:12, color:C.muted }}>
              {home} <span style={{ color:C.accent }}>vs</span> {away} · {competition}
            </span>
          )}
        </div>
        <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
        {error && <div style={{ marginTop:10, fontSize:12, color:C.red, background:C.redBg, borderRadius:6, padding:"7px 12px" }}>{error}</div>}
      </Card>

      {/* Loading */}
      {loading && (
        <Card>
          <div style={{ textAlign:"center", padding:"32px 0" }}>
            <div style={{ width:64, height:64, borderRadius:14, overflow:"hidden", margin:"0 auto 14px", border:`2px solid ${C.accent}44` }}>
              <img src="/fox-mascot.avif" style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"center top" }} alt="Fox"/>
            </div>
            <div style={{ fontSize:15, color:C.dark, fontWeight:600, marginBottom:6 }}>Le renard analyse le match…</div>
            <div style={{ fontSize:12, color:C.muted }}>Historique · Forme · Tactique · Probabilités · Paris</div>
          </div>
        </Card>
      )}

      {/* Résultats */}
      {analysis && !loading && (
        <div>
          {/* Header match */}
          <Card accent={C.accent} style={{ marginBottom:14 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", alignItems:"center", gap:16 }}>
              <div>
                <div style={{ fontSize:17, fontWeight:700, color:C.accent, marginBottom:3 }}>{analysis.home}</div>
                <div style={{ fontSize:10, color:C.muted }}>Domicile</div>
              </div>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:10, color:C.muted, letterSpacing:1, textTransform:"uppercase", marginBottom:5 }}>{analysis.competition}</div>
                <div style={{ fontSize:28, fontWeight:900, color:C.dark, letterSpacing:3 }}>{analysis.pronostic?.score||"?-?"}</div>
                <div style={{ fontSize:9, color:C.muted, marginTop:3 }}>Pronostic IA</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:17, fontWeight:700, color:C.blue, marginBottom:3 }}>{analysis.away}</div>
                <div style={{ fontSize:10, color:C.muted }}>Extérieur</div>
              </div>
            </div>
            <div style={{ marginTop:12, fontSize:12, color:C.mid, background:C.accentBg, border:`1px solid ${C.accentBorder}`, borderRadius:8, padding:"9px 13px" }}>
              🦊 {analysis.resume}
            </div>
          </Card>

          {/* Contenu détaillé — avec overlay freemium si plan gratuit */}
          <div style={{ position:"relative" }}>
            {/* Facteurs clés */}
            {analysis.facteurs_cles?.length > 0 && (
              <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
                {analysis.facteurs_cles.map((f,i) => (
                  <span key={i} style={{ fontSize:11, background:C.warnBg, color:C.warn, border:`1px solid ${C.warn}33`, borderRadius:20, padding:"4px 12px" }}>⚡ {f}</span>
                ))}
              </div>
            )}

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              {/* Forme */}
              <Card>
                <SectionTitle>Forme récente</SectionTitle>
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:12, color:C.accent, fontWeight:600, marginBottom:7 }}>{analysis.home}</div>
                  <div style={{ display:"flex", gap:4, marginBottom:5 }}>
                    {(analysis.forme?.home?.resultats||[]).map((r,i)=><FormBadge key={i} r={r}/>)}
                  </div>
                  <div style={{ fontSize:11, color:C.muted, lineHeight:1.5 }}>{analysis.forme?.home?.desc}</div>
                </div>
                <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:12 }}>
                  <div style={{ fontSize:12, color:C.blue, fontWeight:600, marginBottom:7 }}>{analysis.away}</div>
                  <div style={{ display:"flex", gap:4, marginBottom:5 }}>
                    {(analysis.forme?.away?.resultats||[]).map((r,i)=><FormBadge key={i} r={r}/>)}
                  </div>
                  <div style={{ fontSize:11, color:C.muted, lineHeight:1.5 }}>{analysis.forme?.away?.desc}</div>
                </div>
              </Card>

              {/* Pronostic */}
              <Card accent={C.blue}>
                <SectionTitle>Verdict & Confiance</SectionTitle>
                <div style={{ display:"flex", gap:14, alignItems:"center", marginBottom:12 }}>
                  <ConfidenceArc value={analysis.pronostic?.confiance||50}/>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:15, fontWeight:700, color:C.dark, marginBottom:5 }}>{analysis.pronostic?.resultat}</div>
                    <div style={{ fontSize:11, color:C.muted, lineHeight:1.6 }}>{analysis.pronostic?.explication}</div>
                  </div>
                </div>
                <div style={{ background:C.accentBg, border:`1px solid ${C.accentBorder}`, borderRadius:8, padding:"9px 12px", fontSize:11, color:C.mid, lineHeight:1.6, fontStyle:"italic" }}>
                  🦊 {analysis.verdict}
                </div>
              </Card>
            </div>

            {/* Stats */}
            <Card>
              <SectionTitle>Comparaison statistique</SectionTitle>
              <div style={{ display:"flex", gap:16, marginBottom:12 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <div style={{ width:10, height:10, borderRadius:2, background:C.accent }}/>
                  <span style={{ fontSize:11, color:C.mid }}>{analysis.home}</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <div style={{ width:10, height:10, borderRadius:2, background:C.blue }}/>
                  <span style={{ fontSize:11, color:C.mid }}>{analysis.away}</span>
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 24px" }}>
                {(analysis.stats||[]).map((s,i)=><StatBar key={i} label={s.label} home={s.home} away={s.away}/>)}
              </div>
            </Card>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              {/* Joueurs clés */}
              <Card>
                <SectionTitle>Joueurs à surveiller</SectionTitle>
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:10, color:C.accent, fontWeight:700, letterSpacing:1, textTransform:"uppercase", marginBottom:8 }}>{analysis.home}</div>
                  {(analysis.joueurs_cles?.home||[]).map((j,i)=>(
                    <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom: i<(analysis.joueurs_cles.home.length-1)?`1px solid ${C.border}`:"none" }}>
                      <div>
                        <div style={{ fontSize:12, fontWeight:600, color:C.dark }}>{j.nom}</div>
                        <div style={{ fontSize:10, color:C.muted }}>{j.poste}</div>
                      </div>
                      <div style={{ fontSize:11, color:C.accent, fontWeight:600 }}>{j.stat}</div>
                    </div>
                  ))}
                </div>
                <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:12 }}>
                  <div style={{ fontSize:10, color:C.blue, fontWeight:700, letterSpacing:1, textTransform:"uppercase", marginBottom:8 }}>{analysis.away}</div>
                  {(analysis.joueurs_cles?.away||[]).map((j,i)=>(
                    <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom: i<(analysis.joueurs_cles.away.length-1)?`1px solid ${C.border}`:"none" }}>
                      <div>
                        <div style={{ fontSize:12, fontWeight:600, color:C.dark }}>{j.nom}</div>
                        <div style={{ fontSize:10, color:C.muted }}>{j.poste}</div>
                      </div>
                      <div style={{ fontSize:11, color:C.blue, fontWeight:600 }}>{j.stat}</div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Paris */}
              <Card>
                <SectionTitle>Paris conseillés</SectionTitle>
                {(analysis.paris||[]).map((p,i)=>{
                  const valColor = p.valeur==="bonne"||p.valeur==="haute"||p.valeur==="forte" ? C.green : p.valeur==="intéressante" ? C.warn : C.muted;
                  return (
                    <div key={i} style={{ background:"#0E1A28", borderRadius:9, padding:"10px 13px", marginBottom:8, border:`1px solid ${valColor}33` }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                        <div style={{ fontSize:12, fontWeight:600, color:C.dark }}>{p.type}</div>
                        <div style={{ fontSize:20, fontWeight:900, color:C.accent }}>{p.cote}</div>
                      </div>
                      <div style={{ fontSize:10, color:valColor, marginBottom: p.raisonnement?3:0 }}>
                        Valeur <strong>{p.valeur}</strong>
                      </div>
                      {p.raisonnement && <div style={{ fontSize:10, color:C.muted, lineHeight:1.4 }}>{p.raisonnement}</div>}
                    </div>
                  );
                })}
                <div style={{ fontSize:10, color:C.muted, lineHeight:1.6, marginTop:6 }}>
                  ⚠️ Données historiques uniquement — aucune garantie. Jeu responsable.
                </div>
              </Card>
            </div>

            {/* Analyse tactique */}
            <Card accent={C.warn}>
              <SectionTitle>Analyse tactique</SectionTitle>
              <div style={{ fontSize:13, color:C.mid, lineHeight:1.8 }}>{analysis.analyse}</div>
            </Card>

            {/* Overlay freemium */}
            {(!userAccount || userAccount.plan === "free") && (
              <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom, transparent 0%, #141C28 40%)", zIndex:10, display:"flex", alignItems:"flex-end", justifyContent:"center", paddingBottom:30, borderRadius:12 }}>
                <button onClick={onNavigatePremium} style={{ background:"#00D4AA", color:"#0A1428", border:"none", borderRadius:10, padding:"12px 24px", cursor:"pointer", fontSize:14, fontWeight:800 }}>
                  🔓 Débloquer l'analyse complète — Premium
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!analysis && !loading && (
        <div style={{ textAlign:"center", padding:"48px 20px" }}>
          <div style={{ width:72, height:72, borderRadius:16, overflow:"hidden", margin:"0 auto 16px", border:`2px solid ${C.accent}44` }}>
            <img src="/fox-mascot.avif" style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"center top", transform:"scale(1.1)" }} alt="FoxLab"/>
          </div>
          <div style={{ fontSize:18, fontWeight:700, color:C.dark, marginBottom:8 }}>Prêt à analyser</div>
          <div style={{ fontSize:13, color:C.muted, maxWidth:380, margin:"0 auto", lineHeight:1.7 }}>
            Sélectionne deux équipes et une compétition.<br/>
            L'IA FoxLab analysera la forme, les statistiques clés, les joueurs à surveiller et te donnera un pronostic avec des pistes de paris.
          </div>
        </div>
      )}
    </div>
  );
}
