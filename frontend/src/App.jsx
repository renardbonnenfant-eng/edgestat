import React, { useState, useEffect, useRef, useMemo } from "react";
import { login, fetchFootball, fetchMatch, fetchCompetition, fetchTennisTournaments, fetchTennisMatch, sendChat, fetchSquad, fetchPlayer, fetchMatchEvents, fetchLineup, fetchLive, fetchNext, fetchStandings, fetchPlayerSearch, fetchWeatherStats, fetchHistorySeasons, fetchHistorySeason, fetchTeamLogo, fetchOdds, fetchBracket, fetchClubFeed, fetchClubCard, fetchMatchStats, fetchFullMatchEvents, fetchInjuries } from "./api.js";
import { HISTORICAL_CHAMPIONS } from "./historicalData.js";

// ============================================================
// Palette
// ============================================================
const C = {
  bg:              "#F3F6F9",
  sidebar:         "#032D60",
  sidebarHover:    "#044E9F",
  sidebarActive:   "#0176D3",
  sidebarText:     "#9FC3E9",
  sidebarSection:  "#4A6B8A",
  panel:           "#ffffff",
  panel2:          "#F3F6F9",
  line:            "#D0D5DD",
  text:            "#032D60",
  dim:             "#667085",
  muted:           "#98A2B3",
  accent:          "#0176D3",
  accentBg:        "#EBF5FB",
  accentHover:     "#015BB5",
  warn:            "#F59E0B",
  warnBg:          "#FFFBEB",
  red:             "#DC2626",
  redBg:           "#FEF2F2",
  blue:            "#0176D3",
  green:           "#10B981",
  greenBg:         "#D1FAE5",
  purple:          "#7C3AED",
};

// ============================================================
// Mapping pays → drapeau emoji (API-Football retourne les noms en anglais)
// ============================================================
const COUNTRY_FLAG = {
  "France":"🇫🇷","England":"🏴","Spain":"🇪🇸","Germany":"🇩🇪","Italy":"🇮🇹",
  "Portugal":"🇵🇹","Netherlands":"🇳🇱","Belgium":"🇧🇪","Turkey":"🇹🇷",
  "Scotland":"🏴","Greece":"🇬🇷","Austria":"🇦🇹","Switzerland":"🇨🇭",
  "Russia":"🇷🇺","Norway":"🇳🇴","Sweden":"🇸🇪","Denmark":"🇩🇰","Poland":"🇵🇱",
  "Czech-Republic":"🇨🇿","Croatia":"🇭🇷","Romania":"🇷🇴","Serbia":"🇷🇸",
  "Ukraine":"🇺🇦","Israel":"🇮🇱","Mexico":"🇲🇽","Brazil":"🇧🇷",
  "Argentina":"🇦🇷","USA":"🇺🇸","Chile":"🇨🇱","Colombia":"🇨🇴",
  "Peru":"🇵🇪","Uruguay":"🇺🇾","Japan":"🇯🇵","China":"🇨🇳",
  "South-Korea":"🇰🇷","Saudi-Arabia":"🇸🇦","UAE":"🇦🇪","Australia":"🇦🇺",
  "India":"🇮🇳","South-Africa":"🇿🇦","Egypt":"🇪🇬","Morocco":"🇲🇦",
  "Nigeria":"🇳🇬","Senegal":"🇸🇳","Cameroon":"🇨🇲","Algeria":"🇩🇿",
  "Tunisia":"🇹🇳","Ghana":"🇬🇭","Ivory-Coast":"🇨🇮","Kenya":"🇰🇪",
  "World":"🌍","Europe":"🇪🇺","International":"🌐","Africa":"🌍",
  "Asia":"🌏","CONCACAF":"🌎","CONMEBOL":"🌎",
};
function countryFlag(c) {
  if (!c) return "⚽";
  // Normalise : remplace espaces par tirets
  const key = c.replace(/\s+/g, "-");
  return COUNTRY_FLAG[key] || COUNTRY_FLAG[c] || "⚽";
}

// ============================================================
// Navigation : arborescence des compétitions
// ============================================================
const NAV = [
  {
    section: "⚽  Clubs — Europe", key: "clubs",
    groups: [
      { label: "Top 5", items: [
        { id:"fr",      flag:"🇫🇷", label:"Ligue 1" },
        { id:"en",      flag:"🏴",  label:"Premier League" },
        { id:"it",      flag:"🇮🇹", label:"Serie A" },
        { id:"de",      flag:"🇩🇪", label:"Bundesliga" },
        { id:"es",      flag:"🇪🇸", label:"La Liga" },
        { id:"pt",      flag:"🇵🇹", label:"Primeira Liga" },
      ]},
      { label: "Coupes européennes", items: [
        { id:"ucl",     flag:"🏆",  label:"Champions League" },
        { id:"uel",     flag:"🟠",  label:"Europa League" },
        { id:"uecl",    flag:"🟢",  label:"Conf. League" },
      ]},
      { label: "Deuxièmes divisions", items: [
        { id:"en_ch",   flag:"🏴",  label:"Championship" },
        { id:"fr_l2",   flag:"🇫🇷", label:"Ligue 2" },
        { id:"de_b2",   flag:"🇩🇪", label:"2. Bundesliga" },
        { id:"es_l2",   flag:"🇪🇸", label:"La Liga 2" },
        { id:"it_sb",   flag:"🇮🇹", label:"Serie B" },
        { id:"pt_l2",   flag:"🇵🇹", label:"Liga 2" },
      ]},
      { label: "Coupes domestiques", items: [
        { id:"en_fac",  flag:"🏴",  label:"FA Cup" },
        { id:"en_lc",   flag:"🏴",  label:"League Cup" },
        { id:"fr_cup",  flag:"🇫🇷", label:"Coupe de France" },
        { id:"de_cup",  flag:"🇩🇪", label:"DFB Pokal" },
        { id:"es_cup",  flag:"🇪🇸", label:"Copa del Rey" },
        { id:"it_cup",  flag:"🇮🇹", label:"Coppa Italia" },
        { id:"pt_cup",  flag:"🇵🇹", label:"Taça de Portugal" },
      ]},
      { label: "Autres ligues Europe", items: [
        { id:"nl_ere",  flag:"🇳🇱", label:"Eredivisie" },
        { id:"be_pro",  flag:"🇧🇪", label:"Pro League" },
        { id:"tr_sup",  flag:"🇹🇷", label:"Süper Lig" },
        { id:"sc_pre",  flag:"🏴",  label:"Premiership" },
        { id:"gr_sl",   flag:"🇬🇷", label:"Super League" },
        { id:"at_bun",  flag:"🇦🇹", label:"Bundesliga" },
        { id:"ch_sl",   flag:"🇨🇭", label:"Super League" },
        { id:"ru_rpl",  flag:"🇷🇺", label:"Russia PL" },
        { id:"no_els",  flag:"🇳🇴", label:"Eliteserien" },
        { id:"se_all",  flag:"🇸🇪", label:"Allsvenskan" },
        { id:"dk_sl",   flag:"🇩🇰", label:"Superliga" },
        { id:"pl_ekst", flag:"🇵🇱", label:"Ekstraklasa" },
        { id:"cz_liga", flag:"🇨🇿", label:"Fortuna Liga" },
        { id:"hr_hnl",  flag:"🇭🇷", label:"HNL" },
        { id:"ro_l1",   flag:"🇷🇴", label:"Liga 1" },
        { id:"rs_sl",   flag:"🇷🇸", label:"SuperLiga" },
        { id:"ua_pl",   flag:"🇺🇦", label:"Prem. League" },
        { id:"il_pl",   flag:"🇮🇱", label:"Prem. League" },
      ]},
      { label: "Amicaux clubs", items: [
        { id:"clubfriendly", flag:"🤝", label:"Amicaux clubs" },
      ]},
    ],
  },
  {
    section: "🌐  Équipes nationales", key: "national",
    groups: [
      { label: "Compétitions majeures", items: [
        { id:"wc",      flag:"🌍",  label:"Coupe du Monde" },
        { id:"euro",    flag:"🇪🇺", label:"Euro" },
        { id:"nl",      flag:"🏅",  label:"Nations League" },
        { id:"copa",    flag:"🌎",  label:"Copa América" },
        { id:"afcon",   flag:"🌍",  label:"CAN (Afrique)" },
        { id:"afc",     flag:"🌏",  label:"AFC Asian Cup" },
        { id:"conca",   flag:"🌎",  label:"Gold Cup" },
        { id:"cdc",     flag:"🏆",  label:"CdM des clubs" },
      ]},
      { label: "Amicaux pays", items: [
        { id:"intfriendly", flag:"🌐", label:"Amicaux pays" },
      ]},
    ],
  },
  {
    section: "🌍  Reste du monde", key: "world",
    groups: [
      { label: "Amériques — Clubs", items: [
        { id:"mx_lig",  flag:"🇲🇽", label:"Liga MX" },
        { id:"br_ser",  flag:"🇧🇷", label:"Série A" },
        { id:"ar_lig",  flag:"🇦🇷", label:"Primera Div." },
        { id:"us_mls",  flag:"🇺🇸", label:"MLS" },
        { id:"cl_pdv",  flag:"🇨🇱", label:"Primera Div." },
        { id:"co_lbp",  flag:"🇨🇴", label:"Liga BetPlay" },
        { id:"pe_l1",   flag:"🇵🇪", label:"Liga 1" },
        { id:"uy_pd",   flag:"🇺🇾", label:"Primera Div." },
      ]},
      { label: "Amériques — Coupes", items: [
        { id:"lib",     flag:"🌎",  label:"Copa Libertadores" },
        { id:"suda",    flag:"🌎",  label:"Copa Sudamericana" },
      ]},
      { label: "Asie & Océanie", items: [
        { id:"jp_j1",   flag:"🇯🇵", label:"J1 League" },
        { id:"cn_csl",  flag:"🇨🇳", label:"Super League" },
        { id:"kr_kl",   flag:"🇰🇷", label:"K League 1" },
        { id:"sa_pro",  flag:"🇸🇦", label:"Pro League" },
        { id:"ae_al",   flag:"🇦🇪", label:"Gulf League" },
        { id:"au_ale",  flag:"🇦🇺", label:"A-League" },
        { id:"in_isl",  flag:"🇮🇳", label:"Super League" },
      ]},
      { label: "Afrique", items: [
        { id:"za_psl",  flag:"🇿🇦", label:"Premier Div." },
        { id:"eg_pl",   flag:"🇪🇬", label:"Premier League" },
        { id:"ma_bdl",  flag:"🇲🇦", label:"Botola Pro" },
        { id:"ng_npl",  flag:"🇳🇬", label:"Nigeria PL" },
        { id:"sn_l1",   flag:"🇸🇳", label:"Ligue 1" },
        { id:"cl_caf",  flag:"🌍",  label:"CAF Champ. Lge" },
      ]},
    ],
  },
];

// IDs qui se chargent depuis /api/competition/:id (lazy)
const LAZY_IDS = new Set([
  "clubfriendly","wc","euro","nl","copa","intfriendly",
  "afcon","afc","conca","cdc",
  "en_ch","fr_l2","de_b2","es_l2","it_sb","pt_l2",
  "en_fac","en_lc","fr_cup","de_cup","es_cup","it_cup","pt_cup",
  "nl_ere","be_pro","tr_sup","sc_pre","gr_sl","at_bun","ch_sl",
  "ru_rpl","no_els","se_all","dk_sl","pl_ekst","cz_liga","hr_hnl",
  "ro_l1","rs_sl","ua_pl","il_pl",
  "mx_lig","br_ser","ar_lig","us_mls","cl_pdv","co_lbp","pe_l1","uy_pd",
  "lib","suda",
  "jp_j1","cn_csl","kr_kl","sa_pro","ae_al","au_ale","in_isl",
  "za_psl","eg_pl","ma_bdl","ng_npl","sn_l1","cl_caf",
]);

// ============================================================
// Données Tennis fictives
// ============================================================
const TENNIS_MATCH = {
  tournament: "Roland-Garros — 1/8 finale", surface: "Terre battue", date: "Lun. 9 juin — 14:00",
  p1: { name: "C. Alcaraz", rank: 2, form: ["W","W","W","L","W"], surfaceWinRate: 82, acesAvg: 6.2, setsWonPct: 71 },
  p2: { name: "J. Sinner",  rank: 1, form: ["W","W","W","W","L"], surfaceWinRate: 74, acesAvg: 8.1, setsWonPct: 68 },
  h2h: [
    { date: "2025 Madrid", surface: "Terre", score: "6-4 7-6", winner: "p1" },
    { date: "2024 RG",     surface: "Terre", score: "3-6 6-4 6-3", winner: "p2" },
    { date: "2024 Pékin",  surface: "Dur",   score: "7-6 6-3", winner: "p1" },
    { date: "2023 IW",     surface: "Dur",   score: "6-3 6-2", winner: "p2" },
  ],
  trends: [
    { label: "Match en +3 sets", value: 65, sub: "tendance H2H" },
    { label: "Tie-break joué",   value: 50, sub: "2 des 4 derniers" },
    { label: "Alcaraz sur terre",value: 82, sub: "saison en cours" },
  ],
};

// ============================================================
// mkTeam + mapLeague
// ============================================================
function mkTeam(side, raw = {}, period = 365) {
  // "top5" → utilise raw.periods.top5 si disponible, sinon fallback sur 365j
  const resolvedPeriod = period === "top5" && raw.periods?.top5 ? "top5"
    : period === "top5" ? 365 : period;
  const pStats = (raw.periods && raw.periods[resolvedPeriod]) ? raw.periods[resolvedPeriod] : raw;
  const {
    logo="", name="", short="", scorers=[], noData=false,
    pen={awarded:0,scored:0,played:0,conceded:null},
    minuteGoals={for:[],against:[]},
  } = raw;
  const {
    form=[], avgFor=0, avgAgainst=0, rec={w:0,d:0,l:0},
    dist=[0,0,0,0], p4=0,
    margins={winBy:[],loseBy:[]}, doubleChance={notLosing:0,notWinning:0},
    btts=0, cleanSheet=0, failedToScore=0,
  } = pStats;
  const [p0,p1,p2,p3] = dist;
  const t = {
    logo, name, short, form,
    avgGoalsScored: avgFor, avgGoalsConceded: avgAgainst, scorers,
    goalsDist: [
      { label:"0 but", pct:p0 }, { label:"1 but", pct:p1 },
      { label:"2 buts", pct:p2 }, { label:"3+ buts", pct:p3 },
    ],
    over: [
      { label:"+0.5", pct:100-p0 }, { label:"+1.5", pct:p2+p3 },
      { label:"+2.5", pct:p3 },     { label:"+3.5", pct:p4 },
    ],
    penalties: pen, margins, doubleChance, btts, cleanSheet, failedToScore, minuteGoals, noData,
  };
  if (side === "home") t.homeRecord = rec; else t.awayRecord = rec;
  return t;
}

function mapLeague(lg, period = 365) {
  return {
    league: lg.league, leagueLogo: lg.leagueLogo||"",
    date: lg.date, score: lg.score||"",
    home: mkTeam("home", lg.home, period), away: mkTeam("away", lg.away, period),
    h2h: lg.h2h||[], recentFixtures: lg.recentFixtures||[],
  };
}

// ============================================================
// Drapeau pays — image depuis flagcdn.com (évite le problème Windows avec les emojis)
// ============================================================
function flagImgUrl(emoji) {
  if (!emoji) return null;
  try {
    const cps = [...emoji].map(c => c.codePointAt(0));
    // Regional Indicator Letters : 🇦=0x1F1E6 … 🇿=0x1F1FF
    if (cps.length >= 2 && cps[0] >= 0x1F1E6 && cps[0] <= 0x1F1FF) {
      const code = cps.slice(0,2)
        .map(cp => String.fromCharCode(cp - 0x1F1E6 + 65))
        .join('').toLowerCase();
      return `https://flagcdn.com/20x15/${code}.png`;
    }
  } catch {}
  return null; // emoji non-drapeau (🏆, 🌍, 🏅, etc.) → fallback texte
}

function FlagImg({ emoji, height = 14, style: extraStyle }) {
  const [err, setErr] = useState(false);
  const src = flagImgUrl(emoji);
  const w = Math.round(height * 4 / 3);
  if (src && !err) {
    return (
      <img
        src={src}
        width={w} height={height}
        style={{ objectFit:"contain", flexShrink:0, verticalAlign:"middle", ...extraStyle }}
        onError={() => setErr(true)}
      />
    );
  }
  // fallback : emoji texte (pour 🏆, 🌍, etc.)
  return <span style={{ fontSize:height + 1, lineHeight:1, flexShrink:0 }}>{emoji || "⚽"}</span>;
}

// ============================================================
// Composants de base
// ============================================================
function TeamLogo({ url, size=52, name="" }) {
  const [err, setErr] = useState(false);
  if (err || !url) return (
    <div style={{ width:size, height:size, borderRadius:8, background:C.panel2, display:"grid", placeItems:"center", fontSize:size*.4, color:C.dim, flexShrink:0 }}>
      {name[0]||"?"}
    </div>
  );
  return <img src={url} alt={name} width={size} height={size} style={{ objectFit:"contain", flexShrink:0 }} onError={() => setErr(true)} />;
}

function LeagueLogo({ url, size=15 }) {
  const [err, setErr] = useState(false);
  if (err || !url) return null;
  return <img src={url} alt="" width={size} height={size} style={{ objectFit:"contain", verticalAlign:"middle" }} onError={() => setErr(true)} />;
}

function Bar({ value, color=C.accent }) {
  return (
    <div style={{ height:6, background:C.panel2, borderRadius:99, overflow:"hidden" }}>
      <div style={{ width:`${Math.min(100,value)}%`, height:"100%", background:color, borderRadius:99, transition:"width .4s ease" }} />
    </div>
  );
}

function FormPills({ form=[] }) {
  const style = r => r==="W"
    ? { bg:"#16a34a", color:"#ffffff" }   // vert vif
    : r==="L"
    ? { bg:"#dc2626", color:"#ffffff" }   // rouge vif
    : { bg:"#d97706", color:"#ffffff" };  // jaune/ambre vif
  return (
    <div style={{ display:"flex", gap:4 }}>
      {form.map((r,i) => {
        const s = style(r);
        return (
          <span key={i} style={{
            width:22, height:22, borderRadius:5, display:"grid", placeItems:"center",
            fontSize:10, fontWeight:700, background:s.bg, color:s.color,
            boxShadow:`0 1px 3px ${s.bg}66`,
          }}>{r}</span>
        );
      })}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize:10, letterSpacing:1.2, textTransform:"uppercase",
      color:C.dim, fontWeight:500, margin:"20px 0 8px",
    }}>{children}</div>
  );
}

function InfoPanel({ children, tone="dim" }) {
  return (
    <div style={{
      background: tone==="error" ? C.redBg : C.panel,
      border:`1px solid ${tone==="error" ? "#FECACA" : C.line}`,
      borderRadius:10, padding:"16px",
      color: tone==="error" ? C.red : C.dim,
      fontSize:13, lineHeight:1.6,
    }}>{children}</div>
  );
}

function NoDataBanner({ name }) {
  return (
    <div style={{
      background:C.warnBg, border:`1px solid #FDE68A`,
      borderRadius:6, padding:"5px 10px", fontSize:11, color:"#92400E", marginTop:6,
    }}>⚠ {name} — données insuffisantes.</div>
  );
}

// ============================================================
// Modal de login (optionnel — le site reste accessible sans connexion)
// ============================================================
function LoginModal({ onClose, onLogin }) {
  const [pwd, setPwd]   = useState("");
  const [err, setErr]   = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const { token } = await login(pwd);
      localStorage.setItem("es_token", token);
      onLogin(token);
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally { setBusy(false); }
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.7)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center" }} onClick={onClose}>
      <div style={{ width:340, background:C.panel, border:`1px solid ${C.line}`, borderRadius:14, padding:"32px 28px" }} onClick={e => e.stopPropagation()}>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10, marginBottom:24 }}>
          <div style={{ width:44, height:44, borderRadius:10, background:C.accent, display:"grid", placeItems:"center", fontSize:22, color:"#fff" }}>⌁</div>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:18, fontWeight:900 }}>Connexion</div>
            <div style={{ fontSize:11, color:C.dim, marginTop:3 }}>Accès membres EdgeStat</div>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <input type="password" value={pwd} onChange={e => setPwd(e.target.value)} placeholder="Mot de passe" autoFocus
            style={{ width:"100%", background:C.panel2, border:`1px solid ${err?C.red:C.line}`, borderRadius:8, color:C.text, fontSize:14, padding:"10px 14px", outline:"none", boxSizing:"border-box", marginBottom:err?6:12 }} />
          {err && <div style={{ fontSize:11, color:C.red, marginBottom:10 }}>{err}</div>}
          <button type="submit" disabled={busy||!pwd} style={{
            width:"100%", background:C.accent, border:"none", borderRadius:8, color:"#fff",
            fontWeight:800, fontSize:14, padding:"11px 0",
            cursor:busy||!pwd?"not-allowed":"pointer", opacity:busy||!pwd?.6:1,
          }}>{busy?"Connexion…":"Se connecter"}</button>
        </form>
        <button onClick={onClose} style={{ width:"100%", background:"none", border:"none", color:C.dim, fontSize:12, marginTop:12, cursor:"pointer", padding:"6px 0" }}>Continuer sans connexion</button>
      </div>
    </div>
  );
}

// ============================================================
// Sidebar navigation
// ============================================================
// ============================================================
// Section Live dans la sidebar
// ============================================================
function SidebarLive({ onMatchClick }) {
  const [live,    setLive]    = useState([]);
  const [open,    setOpen]    = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetch_ = () => {
      fetchLive().then(d => { if(mounted){ setLive(d||[]); setLoading(false); } }).catch(()=>{ if(mounted) setLoading(false); });
    };
    fetch_();
    const t = setInterval(fetch_, 60000); // rafraîchir toutes les minutes
    return () => { mounted=false; clearInterval(t); };
  }, []);

  if (loading || live.length === 0) return null;

  const sorted = [...live].sort((a,b) => livePrestige(b) - livePrestige(a));

  return (
    <div style={{ borderBottom:"1px solid #044E9F" }}>
      {/* Header cliquable pour déplier/replier */}
      <button onClick={() => setOpen(v=>!v)} style={{
        width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"8px 14px", background:"none", border:"none", cursor:"pointer",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
          <div style={{ width:7, height:7, borderRadius:"50%", background:"#DC2626", boxShadow:"0 0 5px #DC2626" }} />
          <span style={{ fontSize:11, fontWeight:700, color:"#ffffff", letterSpacing:.5 }}>
            LIVE
          </span>
          <span style={{ background:"#DC2626", color:"#fff", fontSize:9, fontWeight:800, borderRadius:20, padding:"1px 6px" }}>
            {live.length}
          </span>
        </div>
        <span style={{ color:"#9FC3E9", fontSize:10, transition:"transform .2s", transform:open?"rotate(180deg)":"" }}>▾</span>
      </button>

      {open && (
        <div style={{ padding:"0 8px 8px", display:"flex", flexDirection:"column", gap:3, maxHeight:260, overflowY:"auto", scrollbarWidth:"thin", scrollbarColor:"#044E9F transparent" }}>
          {sorted.map(f => {
            const canNav = !!f.compId;
            return (
              <button key={f.id} onClick={() => canNav && onMatchClick(f)} style={{
                width:"100%", display:"flex", alignItems:"center", gap:8, padding:"6px 8px",
                background:"rgba(255,255,255,.05)", border:"1px solid #1e3a5f",
                borderRadius:8, cursor:canNav?"pointer":"default", textAlign:"left",
                transition:"background .1s",
              }}
                onMouseEnter={e => { if(canNav) e.currentTarget.style.background="rgba(1,118,211,.25)"; }}
                onMouseLeave={e => { e.currentTarget.style.background="rgba(255,255,255,.05)"; }}
              >
                {/* Logos */}
                <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                  <TeamLogo url={f.home?.logo||""} size={14} name={f.home?.name||"?"} />
                  <TeamLogo url={f.away?.logo||""} size={14} name={f.away?.name||"?"} />
                </div>
                {/* Équipes + score */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:10, color:"#E2E8F0", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.home?.name}</div>
                  <div style={{ fontSize:10, color:"#9FC3E9", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.away?.name}</div>
                </div>
                {/* Score + minute */}
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontSize:11, fontWeight:800, color:"#DC2626" }}>{f.score}</div>
                  <div style={{ fontSize:9, color:"#9FC3E9" }}>{f.minute ? `${f.minute}'` : "🔴"}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Barre de recherche globale (sidebar)
// ============================================================
function SidebarSearch({ allData, logoRegistry, onSelectComp, onSelectTeam, onOpenPlayer, onOpenClub }) {
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState({ comps:[], teams:[], players:[] });
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);
  const ref    = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    clearTimeout(timerRef.current);
    const q = query.trim().toLowerCase();
    if (!q) { setResults({ comps:[], teams:[], players:[] }); return; }

    // Compétitions (instantané depuis NAV)
    const navItems = NAV.flatMap(s => s.groups.flatMap(g => g.items));
    const comps = navItems.filter(i => i.label.toLowerCase().includes(q)).slice(0, 5);

    // Équipes depuis allData
    const teamMap = new Map();
    Object.entries(allData).forEach(([compId, compData]) => {
      (compData.recentFixtures || []).forEach(f => {
        [f.home, f.away].forEach(t => {
          if (t?.id && t.name?.toLowerCase().includes(q) && !teamMap.has(t.id)) {
            teamMap.set(t.id, { id:t.id, name:t.name, logo: logoRegistry[t.id] || t.logo || "", compId, compName:compData.league||"" });
          }
        });
      });
    });
    const teams = [...teamMap.values()].slice(0, 5);
    setResults(r => ({ ...r, comps, teams }));

    // Joueurs (debounce 450ms, min 3 chars)
    if (q.length >= 3) {
      timerRef.current = setTimeout(() => {
        setLoading(true);
        fetchPlayerSearch(query.trim())
          .then(p => { setResults(r => ({ ...r, players: p.slice(0,6) })); setLoading(false); })
          .catch(() => setLoading(false));
      }, 450);
    } else {
      setResults(r => ({ ...r, players:[] }));
    }
  }, [query, allData]);

  const total = results.comps.length + results.teams.length + results.players.length;
  const showDrop = open && query.trim().length > 0;

  const SectionLabel = ({ label }) => (
    <div style={{ padding:"6px 12px 3px", fontSize:9, fontWeight:700, color:"#667085", textTransform:"uppercase", letterSpacing:1.2 }}>{label}</div>
  );

  return (
    <div ref={ref} style={{ padding:"10px 12px 8px", borderBottom:"1px solid #044E9F", position:"relative", flexShrink:0 }}>
      {/* Input */}
      <div style={{ display:"flex", alignItems:"center", gap:7, background:"#044E9F", borderRadius:8, padding:"7px 10px", border:`1px solid ${open ? "#60A5FA" : "transparent"}`, transition:"border .15s" }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="6" cy="6" r="5" stroke="#9FC3E9" strokeWidth="1.5"/>
          <line x1="10" y1="10" x2="13" y2="13" stroke="#9FC3E9" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Rechercher équipe, joueur, compé…"
          style={{ background:"none", border:"none", outline:"none", color:"#fff", flex:1, fontSize:12, "::placeholder":{ color:"#9FC3E9" } }}
        />
        {query && (
          <button onClick={() => { setQuery(""); setResults({ comps:[],teams:[],players:[] }); }} style={{ background:"none", border:"none", cursor:"pointer", color:"#9FC3E9", fontSize:13, lineHeight:1, padding:0 }}>✕</button>
        )}
      </div>

      {/* Dropdown résultats */}
      {showDrop && (
        <div style={{
          position:"absolute", top:"calc(100% + 4px)", left:12, right:12, zIndex:200,
          background:C.panel, border:`1px solid ${C.line}`, borderRadius:12,
          boxShadow:"0 8px 24px rgba(3,45,96,.15)", overflow:"hidden", maxHeight:380, overflowY:"auto",
        }}>
          {total === 0 && !loading ? (
            <div style={{ padding:"16px", textAlign:"center", color:C.muted, fontSize:12 }}>
              {query.length < 3 ? "Tape au moins 3 caractères pour chercher des joueurs" : "Aucun résultat"}
            </div>
          ) : (
            <>
              {/* Compétitions */}
              {results.comps.length > 0 && (
                <>
                  <SectionLabel label="Compétitions" />
                  {results.comps.map(c => (
                    <button key={c.id} onClick={() => { onSelectComp(c.id); setOpen(false); setQuery(""); }} style={{
                      width:"100%", display:"flex", alignItems:"center", gap:9, padding:"8px 12px",
                      background:"none", border:"none", cursor:"pointer",
                      borderBottom:`1px solid ${C.line}44`, textAlign:"left",
                    }}>
                      <FlagImg emoji={c.flag} height={13} />
                      <span style={{ fontSize:12, color:C.text, fontWeight:500 }}>{c.label}</span>
                    </button>
                  ))}
                </>
              )}

              {/* Équipes */}
              {results.teams.length > 0 && (
                <>
                  <SectionLabel label="Équipes" />
                  {results.teams.map(t => (
                    <button key={t.id} onClick={() => {
                      // Ouvrir la carte club si disponible, sinon naviguer vers le match
                      if (onOpenClub) {
                        onOpenClub({ id: t.id, name: t.name, logo: t.logo, leagueId: t.compId, leagueName: t.compName });
                      } else {
                        onSelectTeam(t.compId, t.id);
                      }
                      setOpen(false); setQuery("");
                    }} style={{
                      width:"100%", display:"flex", alignItems:"center", gap:9, padding:"8px 12px",
                      background:"none", border:"none", cursor:"pointer",
                      borderBottom:`1px solid ${C.line}44`, textAlign:"left",
                    }}>
                      <TeamLogo url={t.logo} size={20} name={t.name} />
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, color:C.text, fontWeight:500 }}>{t.name}</div>
                        <div style={{ fontSize:10, color:C.dim }}>{t.compName}</div>
                      </div>
                      {/* Indicateur "fiche club" */}
                      <span style={{ fontSize:9, color:C.muted, background:C.panel2, borderRadius:4, padding:"2px 5px" }}>Fiche →</span>
                    </button>
                  ))}
                </>
              )}

              {/* Joueurs */}
              {(results.players.length > 0 || loading) && (
                <>
                  <SectionLabel label="Joueurs" />
                  {loading && results.players.length === 0 && (
                    <div style={{ padding:"10px 12px", fontSize:12, color:C.muted }}>Recherche en cours…</div>
                  )}
                  {results.players.map(p => (
                    <button key={p.tsdbId||p.id} onClick={() => {
                      // Utiliser apiFootId si disponible, sinon tsdbId comme fallback
                      const pid = p.apiFootId || p.id;
                      onOpenPlayer(pid, p.name, p.tsdbId);
                      setOpen(false); setQuery("");
                    }} style={{
                      width:"100%", display:"flex", alignItems:"center", gap:9, padding:"8px 12px",
                      background:"none", border:"none", cursor:"pointer",
                      borderBottom:`1px solid ${C.line}44`, textAlign:"left",
                    }}>
                      {p.photo
                        ? <img src={p.photo} width={24} height={24} style={{ borderRadius:6, objectFit:"cover", flexShrink:0 }} onError={e=>e.target.style.display="none"} />
                        : <div style={{ width:24, height:24, borderRadius:6, background:C.panel2, display:"grid", placeItems:"center", fontSize:10, color:C.dim, flexShrink:0 }}>{(p.name||"?")[0]}</div>
                      }
                      <div>
                        <div style={{ fontSize:12, color:C.text, fontWeight:500 }}>{p.name}</div>
                        <div style={{ fontSize:10, color:C.dim }}>{p.team}{p.nationality ? ` · ${p.nationality}` : ""}</div>
                      </div>
                    </button>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Sidebar({ activeId, onSelect, leagueLogos, sport, onSportChange, token, onLoginClick, onLogout, tennisId, onTennisSelect, tennisTournaments, allData, logoRegistry, onSelectTeam, onOpenPlayer, onOpenClub }) {
  const [openSections, setOpenSections] = useState({ clubs: true, national: false, world: false, tennis: true });
  const toggle = key => setOpenSections(s => ({ ...s, [key]: !s[key] }));

  return (
    <div style={{
      width:220, flexShrink:0, background:C.sidebar,
      borderRight:"1px solid #044E9F",
      height:"100vh", overflowY:"auto", position:"sticky", top:0,
      display:"flex", flexDirection:"column",
    }}>
      {/* Logo */}
      <div style={{ padding:"14px 16px 12px", borderBottom:"1px solid #044E9F", display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
        <div style={{ width:30, height:30, borderRadius:7, background:"#0176D3", display:"grid", placeItems:"center", fontSize:17, color:"#fff", flexShrink:0 }}>⌁</div>
        <span style={{ color:"#ffffff", fontWeight:700, fontSize:17 }}>EdgeStat</span>
      </div>

      {/* Recherche globale */}
      <SidebarSearch
        allData={allData || {}}
        logoRegistry={logoRegistry || {}}
        onSelectComp={id => { onSportChange("foot"); onSelect(id); }}
        onSelectTeam={onSelectTeam}
        onOpenPlayer={onOpenPlayer}
        onOpenClub={onOpenClub}
      />

      {/* Section LIVE dans la sidebar */}
      <SidebarLive onMatchClick={liveMatch => {
        const cid = liveMatch.compId;
        if (!cid) return;
        if (onSportChange) onSportChange("foot");
        if (onSelect) onSelect(cid);
      }} />

      {/* Sport toggle — bien visible */}
      <div style={{ padding:"10px 10px 12px", borderBottom:"1px solid #044E9F" }}>
        <div style={{ fontSize:9, color:C.sidebarSection, textTransform:"uppercase", letterSpacing:2, marginBottom:6, paddingLeft:2 }}>Sport</div>
        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
          {[
            { id:"favs",    label:"Favoris",  icon:"⭐", color:"#d97706" },
            { id:"home",    label:"Accueil",  icon:"🏠", color:"#032D60" },
            { id:"history", label:"Histoire", icon:"📚", color:"#7C3AED" },
            { id:"bracket", label:"Coupes",   icon:"🏆", color:"#0176D3" },
            { id:"foot",    label:"Football", icon:"⚽", color:"#0176D3" },
            { id:"tennis",  label:"Tennis",   icon:"🎾", color:"#c2692d" },
          ].map(s => {
            const active = sport === s.id;
            return (
              <button key={s.id} onClick={() => onSportChange(s.id)} style={{
                display:"flex", alignItems:"center", gap:10,
                padding:"10px 12px", borderRadius:8, cursor:"pointer",
                background: active ? "#0176D320" : "transparent",
                borderLeft: `3px solid ${active ? "#0176D3" : "transparent"}`,
                border: "none",
                color: active ? "#ffffff" : C.sidebarText,
                fontWeight: active ? 800 : 500, fontSize:13,
                transition:"all .15s", textAlign:"left",
              }}>
                <span style={{ fontSize:17 }}>{s.icon}</span>
                <span>{s.label}</span>
                {active && <span style={{ marginLeft:"auto", fontSize:9, background:"#0176D3", color:"#ffffff", borderRadius:4, padding:"2px 5px", fontWeight:700 }}>ACTIF</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Navigation Football */}
      {sport === "foot" && (
        <div style={{ flex:1, overflowY:"auto", padding:"8px 0" }}>
          {NAV.map(section => (
            <div key={section.key}>
              <button onClick={() => toggle(section.key)} style={{
                width:"100%", textAlign:"left", background:"none", border:"none",
                padding:"8px 14px", fontSize:11, fontWeight:800, color:C.sidebarSection,
                letterSpacing:1, textTransform:"uppercase", cursor:"pointer",
                display:"flex", alignItems:"center", justifyContent:"space-between",
              }}>
                <span>{section.section}</span>
                <span style={{ fontSize:10 }}>{openSections[section.key] ? "▾" : "▸"}</span>
              </button>

              {openSections[section.key] && section.groups.map(group => (
                <div key={group.label}>
                  <div style={{ padding:"4px 14px 2px", fontSize:10, color:C.sidebarSection, letterSpacing:1.2 }}>{group.label}</div>
                  {group.items.map(item => {
                    const active = activeId === item.id;
                    const logo = leagueLogos[item.id];
                    return (
                      <button key={item.id} onClick={() => onSelect(item.id)} style={{
                        width:"100%", textAlign:"left",
                        background:active ? "#0176D3" : "none",
                        border:"none", borderLeft:`3px solid ${active ? "#60A5FA" : "transparent"}`,
                        borderRadius: active ? 8 : 0,
                        padding:"7px 14px", fontSize:12.5, fontWeight:active ? 700 : 400,
                        color:active ? "#ffffff" : C.sidebarText, cursor:"pointer",
                        display:"flex", alignItems:"center", gap:8, transition:"all .1s",
                      }}>
                        <FlagImg emoji={item.flag} height={13} />
                        {logo && <img src={logo} alt="" width={13} height={13} style={{ objectFit:"contain", flexShrink:0 }} onError={e=>e.target.style.display="none"} />}
                        {item.label}
                        {LAZY_IDS.has(item.id) && !leagueLogos[item.id] && (
                          <span style={{ marginLeft:"auto", fontSize:9, color:C.sidebarSection }}>•••</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Section Tennis dans sidebar */}
      {sport === "tennis" && (
        <div style={{ flex:1, overflowY:"auto", padding:"8px 0" }}>
          <button onClick={() => toggle("tennis")} style={{ width:"100%", textAlign:"left", background:"none", border:"none", padding:"8px 14px", fontSize:11, fontWeight:800, color:C.sidebarSection, letterSpacing:1, textTransform:"uppercase", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span>🎾  Tournois ATP</span>
            <span style={{ fontSize:10 }}>{openSections.tennis?"▾":"▸"}</span>
          </button>
          {openSections.tennis && tennisTournaments.map(t => {
            const active = tennisId === t.id;
            const SURF_COLOR = { hard:C.blue, clay:"#c2692d", grass:C.green };
            return (
              <button key={t.id} onClick={() => onTennisSelect(t.id, t.season)} style={{
                width:"100%", textAlign:"left",
                background:active?"#0176D3":"none",
                border:"none", borderLeft:`3px solid ${active?"#60A5FA":"transparent"}`,
                borderRadius: active ? 8 : 0,
                padding:"7px 14px", fontSize:12.5, fontWeight:active?700:400,
                color:active?"#ffffff":C.sidebarText, cursor:"pointer",
                display:"flex", alignItems:"center", gap:8, transition:"all .1s",
              }}>
                <FlagImg emoji={t.flag} height={13} />
                <span>{t.name}</span>
                <span style={{ marginLeft:"auto", fontSize:9, color:SURF_COLOR[t.surface]||C.dim, fontWeight:700 }}>{t.surface}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Footer sidebar : login optionnel */}
      <div style={{ padding:"10px 12px", borderTop:"1px solid #044E9F", flexShrink:0 }}>
        {token ? (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span style={{ color:"#60A5FA", fontWeight:600, fontSize:11 }}>✓ Connecté</span>
            <button onClick={onLogout} style={{ background:"none", border:"1px solid #044E9F", borderRadius:5, color:C.sidebarText, fontSize:10, padding:"4px 8px", cursor:"pointer" }}>Déco.</button>
          </div>
        ) : (
          <button onClick={onLoginClick} style={{ width:"100%", background:C.panel2, border:`1px solid ${C.line}`, borderRadius:7, color:C.dim, fontSize:12, fontWeight:600, padding:"8px 0", cursor:"pointer" }}>
            🔑 Connexion membre
          </button>
        )}
        <div style={{ fontSize:10, color:C.sidebarSection, lineHeight:1.5, marginTop:8 }}>Données API-Football · API-Tennis</div>
      </div>
    </div>
  );
}

// ============================================================
// Carte de match — style Betclic
// ============================================================
function MatchCard({ m }) {
  const isUpcoming = m.score?.includes("?");
  return (
    <div style={{ background:C.panel, border:`1px solid ${C.line}`, borderRadius:12, overflow:"hidden", marginBottom:4 }}>
      {/* Header */}
      <div style={{ padding:"8px 18px", display:"flex", alignItems:"center", gap:8, borderBottom:`1px solid ${C.line}` }}>
        <LeagueLogo url={m.leagueLogo} size={14} />
        <span style={{ fontSize:11, fontWeight:500, color:C.dim, letterSpacing:.5, textTransform:"uppercase" }}>{m.league}</span>
        <span style={{ color:C.line }}>·</span>
        <span style={{ fontSize:11, color:C.dim }}>{m.date}</span>
        {isUpcoming ? (
          <span style={{
            marginLeft:"auto", fontSize:9, fontWeight:600, letterSpacing:.5, textTransform:"uppercase",
            color:"#0C444C", background:"#EBF5FB", border:"1px solid #B3D9F2",
            borderRadius:20, padding:"2px 8px",
          }}>À venir</span>
        ) : (
          <span style={{
            marginLeft:"auto", fontSize:9, fontWeight:600, letterSpacing:.5, textTransform:"uppercase",
            color:"#065F46", background:C.greenBg, border:"1px solid #A7F3D0",
            borderRadius:20, padding:"2px 8px",
          }}>Terminé</span>
        )}
      </div>

      {/* Teams */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", alignItems:"center", gap:12, padding:"20px 24px" }}>
        {/* Home */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-start", gap:10 }}>
          <TeamLogo url={m.home.logo} size={52} name={m.home.name} />
          <div>
            <div style={{ fontSize:14, fontWeight:500, color:C.text, lineHeight:1.2 }}>{m.home.name}</div>
            <div style={{ fontSize:10, color:C.dim, marginTop:3, textTransform:"uppercase", letterSpacing:.5 }}>
              Dom. · {m.home.homeRecord?.w||0}V {m.home.homeRecord?.d||0}N {m.home.homeRecord?.l||0}D
            </div>
          </div>
          <FormPills form={m.home.form} />
          {m.home.noData && <NoDataBanner name={m.home.name} />}
        </div>

        {/* Score */}
        <div style={{ textAlign:"center" }}>
          {isUpcoming ? (
            <div style={{ fontSize:24, fontWeight:400, color:C.muted, letterSpacing:3 }}>—</div>
          ) : (
            <div style={{ fontSize:32, fontWeight:500, color:C.text, letterSpacing:3, lineHeight:1 }}>{m.score}</div>
          )}
        </div>

        {/* Away */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:10 }}>
          <TeamLogo url={m.away.logo} size={52} name={m.away.name} />
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:14, fontWeight:500, color:C.text, lineHeight:1.2 }}>{m.away.name}</div>
            <div style={{ fontSize:10, color:C.dim, marginTop:3, textTransform:"uppercase", letterSpacing:.5 }}>
              Ext. · {m.away.awayRecord?.w||0}V {m.away.awayRecord?.d||0}N {m.away.awayRecord?.l||0}D
            </div>
          </div>
          <div style={{ display:"flex", justifyContent:"flex-end" }}><FormPills form={m.away.form} /></div>
          {m.away.noData && <NoDataBanner name={m.away.name} />}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Dropdown équipe avec logos — design premium
// ============================================================
function TeamFilterDropdown({ teams, value, onChange }) {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState("");
  const ref                 = useRef(null);
  const inputRef            = useRef(null);

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setSearch(""); } };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);

  const selected  = value === "all" ? null : teams.find(t => t.id === value);
  const filtered  = search.trim()
    ? teams.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
    : teams;

  const LogoOrInitial = ({ logo, name, size = 22 }) => {
    const [err, setErr] = useState(false);
    return (!logo || err)
      ? <div style={{ width:size, height:size, borderRadius:5, background:C.panel2, display:"grid", placeItems:"center", fontSize:size * .45, color:C.dim, flexShrink:0, fontWeight:700 }}>{(name||"?")[0]}</div>
      : <img src={logo} width={size} height={size} style={{ objectFit:"contain", flexShrink:0 }} onError={() => setErr(true)} />;
  };

  return (
    <div ref={ref} style={{ position:"relative" }}>
      {/* Bouton déclencheur */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display:"flex", alignItems:"center", gap:10,
          background: open ? C.panel2 : C.panel,
          border:`1px solid ${open ? C.accent : C.line}`,
          borderRadius:10, padding:"7px 14px 7px 10px",
          cursor:"pointer", color:C.text, fontSize:13, fontWeight:400,
          minWidth:210, transition:"all .15s",
          boxShadow: open ? `0 0 0 3px ${C.accentBg}` : "none",
        }}
      >
        {selected ? (
          <>
            <LogoOrInitial logo={selected.logo} name={selected.name} size={24} />
            <span style={{ flex:1, textAlign:"left", fontWeight:600 }}>{selected.name}</span>
            <button
              onClick={e => { e.stopPropagation(); onChange("all"); setOpen(false); }}
              style={{ background:"none", border:"none", cursor:"pointer", color:C.muted, fontSize:14, padding:"0 2px", lineHeight:1 }}
            >✕</button>
          </>
        ) : (
          <>
            <div style={{ width:24, height:24, borderRadius:6, background:C.panel2, display:"grid", placeItems:"center", fontSize:13, flexShrink:0 }}>⚽</div>
            <span style={{ flex:1, textAlign:"left", color:C.dim }}>Filtrer par équipe</span>
          </>
        )}
        <svg width="10" height="10" viewBox="0 0 10 10" style={{ flexShrink:0, transition:"transform .2s", transform: open ? "rotate(180deg)" : "rotate(0)" }}>
          <path d="M1 3 L5 7 L9 3" stroke={C.muted} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Liste déroulante */}
      {open && (
        <div style={{
          position:"absolute", top:"calc(100% + 6px)", left:0, zIndex:100, width:260,
          background:C.panel, border:`1px solid ${C.line}`, borderRadius:12,
          boxShadow:"0 8px 24px rgba(3,45,96,.12), 0 2px 6px rgba(0,0,0,.06)",
          overflow:"hidden",
        }}>
          {/* Recherche */}
          <div style={{ padding:"10px 10px 8px", borderBottom:`1px solid ${C.line}` }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, background:C.panel2, borderRadius:8, padding:"6px 10px" }}>
              <svg width="12" height="12" viewBox="0 0 12 12"><circle cx="5" cy="5" r="4" stroke={C.muted} strokeWidth="1.5" fill="none"/><line x1="8" y1="8" x2="11" y2="11" stroke={C.muted} strokeWidth="1.5" strokeLinecap="round"/></svg>
              <input
                ref={inputRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher une équipe…"
                style={{ flex:1, background:"none", border:"none", outline:"none", color:C.text, fontSize:12, padding:0 }}
              />
              {search && <button onClick={() => setSearch("")} style={{ background:"none", border:"none", cursor:"pointer", color:C.muted, fontSize:12, padding:0, lineHeight:1 }}>✕</button>}
            </div>
          </div>

          {/* Option "Toutes" */}
          <button
            onClick={() => { onChange("all"); setOpen(false); setSearch(""); }}
            style={{
              width:"100%", textAlign:"left", display:"flex", alignItems:"center", gap:10,
              padding:"9px 14px", background: value === "all" ? `${C.accent}18` : "none",
              border:"none", borderBottom:`1px solid ${C.line}`,
              cursor:"pointer", color: value === "all" ? C.accent : C.dim, fontSize:12, fontWeight:600,
            }}
          >
            <div style={{ width:24, height:24, borderRadius:6, background:C.panel2, display:"grid", placeItems:"center", fontSize:13, flexShrink:0 }}>—</div>
            <span>Toutes les équipes</span>
            {value === "all" && <svg style={{ marginLeft:"auto" }} width="12" height="12" viewBox="0 0 12 12"><path d="M2 6 L5 9 L10 3" stroke={C.accent} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </button>

          {/* Liste des équipes */}
          <div style={{ maxHeight:220, overflowY:"auto" }}>
            {filtered.length === 0 ? (
              <div style={{ padding:"16px", textAlign:"center", color:C.muted, fontSize:12 }}>Aucune équipe trouvée</div>
            ) : filtered.map(t => {
              const active = value === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => { onChange(t.id); setOpen(false); setSearch(""); }}
                  style={{
                    width:"100%", textAlign:"left", display:"flex", alignItems:"center", gap:10,
                    padding:"8px 14px",
                    background: active ? C.accentBg : "none",
                    border:"none", borderBottom:`1px solid ${C.line}44`,
                    cursor:"pointer", transition:"background .1s",
                  }}
                >
                  <LogoOrInitial logo={t.logo} name={t.name} size={24} />
                  <span style={{ flex:1, fontSize:13, fontWeight: active ? 700 : 400, color: active ? C.accent : C.text }}>{t.name}</span>
                  {active && <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6 L5 9 L10 3" stroke={C.accent} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// MatchRow — ligne compacte pour listes verticales
// ============================================================
function MatchRow({ f, selected, loading, onSelect, logoRegistry = {}, compFlag, compLogo }) {
  const isUpcoming = f.status === "upcoming" || f.score == null;
  const homeLogo   = logoRegistry[f.home?.id] || f.home?.logo || "";
  const awayLogo   = logoRegistry[f.away?.id] || f.away?.logo || "";
  const d          = new Date(f.date);
  const dateStr    = d.toLocaleDateString("fr-FR", { weekday:"short", day:"numeric", month:"short" });
  const timeStr    = d.toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit" });
  const showTime   = isUpcoming && timeStr !== "00:00" && timeStr !== "01:00";
  const roundStr   = f.round?.replace(/^Regular Season - (\d+)/, "J.$1").replace(/^Regular Season - /, "") || "";
  // Détection équipes jeunes (U-17 à U-23)
  const youthRx    = /\bU-?1[5-9]\b|\bU-?2[0-3]\b/i;
  const isYouth    = youthRx.test(f.home?.name || "") || youthRx.test(f.away?.name || "");

  return (
    <button
      onClick={() => !loading && onSelect(f.id)}
      disabled={loading}
      style={{
        width:"100%", height:72, padding:"10px 14px",
        background: selected ? C.accentBg : "none",
        borderLeft:`3px solid ${selected ? C.accent : isUpcoming ? "#93C5FD" : "transparent"}`,
        borderRight:"none", borderTop:"none",
        borderBottom:`1px solid ${C.line}`,
        cursor: loading ? "wait" : "pointer",
        transition:"background .1s",
        display:"flex", flexDirection:"column", justifyContent:"center", gap:3,
        outline:"none", boxSizing:"border-box",
      }}
    >
      {/* Row principale */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", alignItems:"center", gap:6 }}>
        {/* Colonne gauche : logo + nom domicile */}
        <div style={{ display:"flex", alignItems:"center", gap:6, minWidth:0 }}>
          <TeamLogo url={homeLogo} size={22} name={f.home?.name||"?"} />
          <span style={{
            fontSize:12, fontWeight: selected ? 500 : 400,
            color: selected ? C.accent : C.text,
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
          }}>{f.home?.name}</span>
        </div>

        {/* Centre : heure/score */}
        {isUpcoming ? (
          <div style={{
            background:C.accentBg, color:C.accent,
            border:`1px solid #B3D9F2`,
            borderRadius:20, padding:"2px 8px",
            fontSize:10, fontWeight:500, whiteSpace:"nowrap", flexShrink:0,
          }}>{showTime ? timeStr : dateStr}</div>
        ) : (
          <div style={{
            background: selected ? C.accentBg : C.panel2,
            color: selected ? C.accent : C.text,
            border:`1px solid ${selected ? "#B3D9F2" : C.line}`,
            borderRadius:8, fontWeight:500, fontSize:13,
            letterSpacing:1, padding:"3px 10px", whiteSpace:"nowrap", flexShrink:0,
          }}>{f.score}</div>
        )}

        {/* Colonne droite : nom extérieur + logo */}
        <div style={{ display:"flex", alignItems:"center", gap:6, justifyContent:"flex-end", minWidth:0 }}>
          <span style={{
            fontSize:12, fontWeight: selected ? 500 : 400,
            color: selected ? C.accent : C.text,
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
          }}>{f.away?.name}</span>
          <TeamLogo url={awayLogo} size={22} name={f.away?.name||"?"} />
        </div>
      </div>

      {/* Row secondaire : date + journée + badge jeunes + compétition */}
      <div style={{ fontSize:10, color:C.dim, textAlign:"center", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
        <span>{dateStr}{roundStr ? " · " + roundStr : ""}</span>
        {isYouth && (
          <span style={{ background:"#EDE9FE", color:"#5B21B6", border:"1px solid #C4B5FD", borderRadius:20, padding:"1px 6px", fontSize:9, fontWeight:600 }}>JEUNES</span>
        )}
        {(compFlag || compLogo) && (
          <span style={{ display:"flex", alignItems:"center", gap:3, marginLeft:"auto" }}>
            <FlagImg emoji={compFlag} height={11} />
            {compLogo && <img src={compLogo} width={11} height={11} style={{ objectFit:"contain" }} onError={e=>e.target.style.display="none"} />}
          </span>
        )}
      </div>
    </button>
  );
}

// ============================================================
// Panel de sélection — 2 colonnes verticales
// ============================================================
function MatchPanel({ fixtures, selectedId, defaultId, onSelect, loading, logoRegistry = {}, filterTeamIds = null }) {
  const [teamFilter, setTeamFilter] = useState("all");

  const teams = useMemo(() => {
    const map = new Map();
    fixtures.forEach(f => {
      const hLogo = logoRegistry[f.home?.id] || f.home?.logo || "";
      const aLogo = logoRegistry[f.away?.id] || f.away?.logo || "";
      if (f.home?.id && !map.has(f.home.id)) map.set(f.home.id, { id: f.home.id, name: f.home.name || "", logo: hLogo });
      if (f.away?.id && !map.has(f.away.id)) map.set(f.away.id, { id: f.away.id, name: f.away.name || "", logo: aLogo });
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [fixtures, logoRegistry]);

  // filterTeamIds (groupes) a priorité sur teamFilter (dropdown)
  const filtered = filterTeamIds
    ? fixtures.filter(f => filterTeamIds.includes(f.home?.id) || filterTeamIds.includes(f.away?.id))
    : teamFilter === "all"
      ? fixtures
      : fixtures.filter(f => f.home?.id === teamFilter || f.away?.id === teamFilter);
  const upcoming = filtered.filter(f => f.status === "upcoming" || f.score == null);
  const past     = filtered.filter(f => f.status !== "upcoming" && f.score != null);
  const activeId = selectedId ?? defaultId;

  if (!fixtures || fixtures.length === 0) return null;

  const ColHeader = ({ label, count, color, isUpcomingCol }) => (
    <div style={{ padding:"9px 12px", display:"flex", alignItems:"center", gap:8, borderBottom:`1px solid ${C.line}`, background:C.panel }}>
      <div style={{ width:7, height:7, borderRadius:"50%", background: isUpcomingCol ? C.accent : C.muted, flexShrink:0 }} />
      <span style={{ fontSize:10, fontWeight:600, color: isUpcomingCol ? C.accent : C.dim, letterSpacing:.8, textTransform:"uppercase" }}>{label}</span>
      <span style={{ marginLeft:"auto", background: isUpcomingCol ? C.accentBg : C.panel2, color: isUpcomingCol ? C.accent : C.dim, border: isUpcomingCol ? `1px solid #B3D9F2` : `1px solid ${C.line}`, borderRadius:20, padding:"2px 9px", fontSize:10, fontWeight:600 }}>{count}</span>
    </div>
  );

  return (
    <div style={{ marginBottom:20 }}>
      {/* Filtre équipe + compteurs */}
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
        <TeamFilterDropdown teams={teams} value={teamFilter} onChange={setTeamFilter} />
        <div style={{ marginLeft:"auto", display:"flex", gap:12, alignItems:"center" }}>
          {upcoming.length > 0 && <span style={{ fontSize:10, color:C.blue, fontWeight:700 }}>● {upcoming.length} à venir</span>}
          {past.length > 0    && <span style={{ fontSize:10, color:C.dim }}>○ {past.length} passés</span>}
        </div>
      </div>

      {/* 2 colonnes */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        {/* Colonne "À venir" */}
        <div style={{ background:C.panel, border:`1px solid ${C.line}`, borderRadius:12, overflow:"hidden" }}>
          <ColHeader label="À venir" count={upcoming.length} color={C.accent} isUpcomingCol={true} />
          <div style={{ maxHeight:340, overflowY:"auto", scrollbarWidth:"thin", scrollbarColor:`${C.line} transparent` }}>
            {upcoming.length === 0 ? (
              <div style={{ padding:"32px 14px", textAlign:"center" }}>
                <div style={{ fontSize:28, marginBottom:8 }}>📅</div>
                <div style={{ fontSize:12, color:C.muted }}>Aucun match à venir</div>
              </div>
            ) : upcoming.map(f => <MatchRow key={f.id} f={f} selected={f.id===activeId} loading={loading} onSelect={onSelect} logoRegistry={logoRegistry} />)}
          </div>
        </div>

        {/* Colonne "Résultats" */}
        <div style={{ background:C.panel, border:`1px solid ${C.line}`, borderRadius:12, overflow:"hidden" }}>
          <ColHeader label="Résultats" count={past.length} color={C.dim} isUpcomingCol={false} />
          <div style={{ maxHeight:340, overflowY:"auto", scrollbarWidth:"thin", scrollbarColor:`${C.line} transparent` }}>
            {past.length === 0 ? (
              <div style={{ padding:"32px 14px", textAlign:"center", color:C.muted, fontSize:12 }}>Aucun résultat</div>
            ) : past.map(f => <MatchRow key={f.id} f={f} selected={f.id===activeId} loading={loading} onSelect={onSelect} logoRegistry={logoRegistry} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Sélecteur de période — style pill
// ============================================================
const PERIODS = [
  { key:90,       label:"90j",    desc:"3 derniers mois" },
  { key:182,      label:"182j",   desc:"6 derniers mois" },
  { key:365,      label:"365j",   desc:"12 derniers mois" },
  { key:"season", label:"Saison", desc:"Saison en cours" },
  { key:"top5",   label:"vs Top 5", desc:"Confrontations contre le top 5 du championnat" },
];

function periodLabel(period) {
  if (period === "season") return "cette saison";
  if (period === "top5")   return "vs Top 5";
  return `${period} j`;
}

function PeriodSelector({ period, onChange }) {
  return (
    <div style={{ display:"flex", gap:4, alignItems:"center", flexWrap:"wrap" }}>
      <span style={{ fontSize:10, color:C.dim, fontWeight:500, textTransform:"uppercase", letterSpacing:.8, marginRight:2 }}>Période</span>
      {PERIODS.map(({ key, label }) => (
        <button key={key} onClick={() => onChange(key)} style={{
          border:`1px solid ${period===key ? C.accent : C.line}`,
          cursor:"pointer", padding:"4px 12px", borderRadius:20,
          fontSize:11, fontWeight:period===key ? 600 : 400,
          background:period===key ? C.accentBg : C.panel,
          color:period===key ? C.accent : C.dim,
          transition:"all .15s",
        }}>{label}</button>
      ))}
    </div>
  );
}

// ============================================================
// Onglets
// ============================================================
const TABS = [
  { id:"resultat",    label:"V/D" },
  { id:"stats_match", label:"📊 Stats Match" },
  { id:"timeline",    label:"📋 Timeline" },
  { id:"preview",     label:"🤖 Aperçu IA" },
  { id:"double",      label:"Double Chance" },
  { id:"ecart",       label:"Écart" },
  { id:"buteur",      label:"Buteur" },
  { id:"buts",        label:"Over/Under" },
  { id:"timing",      label:"Quarts d'heure" },
  { id:"btts",        label:"BTTS & CS" },
  { id:"penalty",     label:"Penalty" },
  { id:"compo",       label:"Compo ⚽" },
  { id:"meteo",       label:"🌤 Météo" },
  { id:"classement",  label:"Classement" },
];

function TabBar({ tab, setTab }) {
  return (
    <div style={{
      display:"flex", gap:2, marginTop:12, marginBottom:16,
      background:C.panel2, borderRadius:8, padding:3,
      overflowX:"auto", scrollbarWidth:"none",
    }}>
      {TABS.map(t => {
        const active = tab === t.id;
        return (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            border:"none", cursor:"pointer", padding:"7px 14px", borderRadius:6,
            fontSize:12, fontWeight:active ? 600 : 400, whiteSpace:"nowrap",
            background: active ? C.accent : "transparent",
            color: active ? "#ffffff" : C.dim,
            transition:"all .15s", flexShrink:0,
          }}>{t.label}</button>
        );
      })}
    </div>
  );
}

// ============================================================
// Onglet : Statistiques de match (tirs, corners, possession)
// ============================================================
function TabMatchStats({ fixtureId }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!fixtureId) return;
    setLoading(true);
    fetchMatchStats(fixtureId)
      .then(d => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [fixtureId]);

  if (loading) return <InfoPanel>Chargement des statistiques…</InfoPanel>;
  if (!stats || stats.length < 2) return <InfoPanel>Statistiques non disponibles pour ce match.</InfoPanel>;

  const [home, away] = stats;
  const getVal = (team, key) => {
    const v = team.stats?.[key];
    return v === null || v === undefined ? "—" : String(v).replace("%","");
  };
  const getNum = (team, key) => parseInt(getVal(team, key)) || 0;

  const StatBar = ({ label, homeVal, awayVal, isPercent }) => {
    const h = isPercent ? parseInt(homeVal)||0 : 0;
    const hPct = isPercent ? h : (getNum(home, label) / (getNum(home, label)+getNum(away, label)||1)) * 100;
    const aPct = 100 - hPct;
    return (
      <div style={{ display:"grid", gridTemplateColumns:"60px 1fr 60px", alignItems:"center", gap:10, marginBottom:10 }}>
        <div style={{ textAlign:"right", fontSize:13, fontWeight:700, color:C.accent }}>{homeVal}</div>
        <div style={{ background:C.panel2, borderRadius:99, height:7, overflow:"hidden", display:"flex" }}>
          <div style={{ width:`${hPct}%`, background:C.accent, transition:"width .5s" }}/>
          <div style={{ width:`${aPct}%`, background:C.blue, transition:"width .5s" }}/>
        </div>
        <div style={{ fontSize:13, fontWeight:700, color:C.blue }}>{awayVal}</div>
      </div>
    );
  };

  const rows = [
    { label:"Possession", key:"Ball Possession", isPercent:true },
    { label:"Tirs total", key:"Total Shots" },
    { label:"Tirs cadrés", key:"Shots on Goal" },
    { label:"Corners", key:"Corner Kicks" },
    { label:"Fautes", key:"Fouls" },
    { label:"Cartons jaunes", key:"Yellow Cards" },
    { label:"Cartons rouges", key:"Red Cards" },
    { label:"Hors-jeu", key:"Offsides" },
    { label:"Arrêts", key:"Goalkeeper Saves" },
    { label:"Passes réussies", key:"Passes accurate" },
  ];

  return (
    <div>
      {/* Header équipes */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", alignItems:"center", gap:12, marginBottom:20, padding:"10px 0" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <TeamLogo url={home.team?.logo} size={28} name={home.team?.name} />
          <span style={{ fontSize:13, fontWeight:600, color:C.accent }}>{home.team?.name}</span>
        </div>
        <span style={{ fontSize:11, color:C.muted, fontWeight:500 }}>vs</span>
        <div style={{ display:"flex", alignItems:"center", gap:8, justifyContent:"flex-end" }}>
          <span style={{ fontSize:13, fontWeight:600, color:C.blue }}>{away.team?.name}</span>
          <TeamLogo url={away.team?.logo} size={28} name={away.team?.name} />
        </div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
        {rows.map(row => {
          const hv = getVal(home, row.key);
          const av = getVal(away, row.key);
          if (hv === "—" && av === "—") return null;
          return (
            <div key={row.label}>
              <div style={{ textAlign:"center", fontSize:10, color:C.muted, textTransform:"uppercase", letterSpacing:.8, marginBottom:4 }}>{row.label}</div>
              <StatBar label={row.label} homeVal={hv} awayVal={av} isPercent={row.isPercent} />
            </div>
          );
        }).filter(Boolean)}
      </div>
    </div>
  );
}

// ============================================================
// Onglet : Victoire / Défaite
// ============================================================
function TabResultat({ m, period }) {
  return (
    <div>
      <SectionTitle>Moyennes par match — {periodLabel(period)}</SectionTitle>
      <StatRow label="Buts marqués"   a={m.home.avgGoalsScored}   b={m.away.avgGoalsScored}   max={3} />
      <StatRow label="Buts encaissés" a={m.home.avgGoalsConceded} b={m.away.avgGoalsConceded} max={3} invert />
      <SectionTitle>Face-à-face — 5 derniers</SectionTitle>
      {m.h2h.length === 0
        ? <div style={{ color:C.dim, fontSize:12 }}>Aucune confrontation directe récente.</div>
        : <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
            {m.h2h.map((h,i) => (
              <div key={i} style={{ display:"grid", gridTemplateColumns:"64px 1fr 64px", alignItems:"center", background:C.panel, border:`1px solid ${C.line}`, borderRadius:8, padding:"9px 14px", fontSize:13 }}>
                <span style={{ color:C.dim, fontSize:11 }}>{h.date}</span>
                <span style={{ textAlign:"center", fontWeight:800, color:h.winner==="home"?C.accent:h.winner==="away"?C.blue:C.dim }}>{h.score}</span>
                <span style={{ textAlign:"right", fontSize:10, color:C.dim, textTransform:"uppercase" }}>{h.winner==="draw"?"Nul":h.winner==="home"?m.home.short:m.away.short}</span>
              </div>
            ))}
          </div>
      }
    </div>
  );
}

// ============================================================
// Onglet : Double Chance
// ============================================================
function TabDoubleChance({ m }) {
  const Block = ({ team, color, side }) => {
    const dc  = team.doubleChance||{notLosing:0,notWinning:0};
    const rec = side==="home" ? team.homeRecord : team.awayRecord;
    const tot = (rec?.w||0)+(rec?.d||0)+(rec?.l||0)||1;
    return (
      <div style={{ background:C.panel, border:`1px solid ${C.line}`, borderRadius:10, padding:"14px 16px" }}>
        <div style={{ fontSize:11, color, fontWeight:600, textTransform:"uppercase", letterSpacing:1, marginBottom:12 }}>{team.short} · {side==="home"?"domicile":"extérieur"}</div>
        <DCRow label={side==="home"?"1N — ne perd pas":"N2 — ne perd pas"} value={dc.notLosing} color={color} sub={`${(rec?.w||0)+(rec?.d||0)}/${tot} matchs`} />
        <DCRow label="Ne gagne pas" value={dc.notWinning} color={C.warn} sub={`${(rec?.d||0)+(rec?.l||0)}/${tot} matchs`} last />
      </div>
    );
  };
  return (
    <div>
      <div style={{ fontSize:11, color:C.dim, marginBottom:14, lineHeight:1.6 }}>Fréquences historiques sur matchs dom./ext. — base pour les marchés Double Chance.</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <Block team={m.home} color={C.accent} side="home" />
        <Block team={m.away} color={C.blue}   side="away" />
      </div>
    </div>
  );
}
function DCRow({ label, value, color, sub, last }) {
  return (
    <div style={{ padding:"9px 0", borderBottom:last?"none":`1px solid ${C.line}` }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:5 }}>
        <span style={{ fontSize:12, color:C.text, fontWeight:600 }}>{label}</span>
        <span style={{ fontSize:20, fontWeight:800, color }}>{value}%</span>
      </div>
      <Bar value={value} color={color} />
      <div style={{ fontSize:11, color:C.dim, marginTop:4 }}>{sub}</div>
    </div>
  );
}

// ============================================================
// Onglet : Écart de buts
// ============================================================
function TabEcart({ m }) {
  const Block = ({ team, color, label }) => (
    <div>
      <div style={{ fontSize:11, color, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>{team.short} · {label}</div>
      <div style={{ fontSize:11, color:C.green, fontWeight:600, marginBottom:6 }}>Victoires par</div>
      {(team.margins?.winBy||[]).map((r,i) => (
        <div key={i} style={{ display:"grid", gridTemplateColumns:"56px 1fr 36px", alignItems:"center", gap:10, marginBottom:7 }}>
          <span style={{ fontSize:12, color:C.text }}>{r.label}</span>
          <Bar value={r.pct} color={C.green} />
          <span style={{ fontSize:12, fontWeight:700, textAlign:"right", color:C.dim }}>{r.pct}%</span>
        </div>
      ))}
      <div style={{ fontSize:11, color:C.red, fontWeight:600, margin:"12px 0 6px" }}>Défaites par</div>
      {(team.margins?.loseBy||[]).map((r,i) => (
        <div key={i} style={{ display:"grid", gridTemplateColumns:"56px 1fr 36px", alignItems:"center", gap:10, marginBottom:7 }}>
          <span style={{ fontSize:12, color:C.text }}>{r.label}</span>
          <Bar value={r.pct} color={C.red} />
          <span style={{ fontSize:12, fontWeight:700, textAlign:"right", color:C.dim }}>{r.pct}%</span>
        </div>
      ))}
    </div>
  );
  return (
    <div>
      <div style={{ fontSize:11, color:C.dim, marginBottom:14, lineHeight:1.6 }}>Fréquences des écarts sur matchs dom./ext.</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24 }}>
        <Block team={m.home} color={C.accent} label="domicile" />
        <Block team={m.away} color={C.blue}   label="extérieur" />
      </div>
    </div>
  );
}

// ============================================================
// Onglet : Buteur
// ============================================================
function TabButeur({ m, period }) {
  return (
    <div>
      {/* Comparaison top buteurs */}
      {m.home.scorers?.length > 0 && m.away.scorers?.length > 0 && (
        <div style={{ background:C.panel2, borderRadius:12, padding:"12px 16px", marginBottom:16 }}>
          <div style={{ fontSize:10, color:C.dim, fontWeight:700, textTransform:"uppercase", letterSpacing:.8, marginBottom:10 }}>⚽ Buteurs clés</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", alignItems:"start", gap:12 }}>
            {/* Home scorers */}
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {m.home.scorers.slice(0,3).map((s,i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <div style={{ width:22, height:22, borderRadius:"50%", background:C.accentBg, display:"grid", placeItems:"center", fontSize:10, fontWeight:700, color:C.accent, flexShrink:0 }}>{s.scored}</div>
                  <span style={{ fontSize:11, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.name}</span>
                </div>
              ))}
            </div>
            <div style={{ width:1, background:C.line, alignSelf:"stretch" }} />
            {/* Away scorers */}
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {m.away.scorers.slice(0,3).map((s,i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:6, justifyContent:"flex-end" }}>
                  <span style={{ fontSize:11, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.name}</span>
                  <div style={{ width:22, height:22, borderRadius:"50%", background:`${C.blue}18`, display:"grid", placeItems:"center", fontSize:10, fontWeight:700, color:C.blue, flexShrink:0 }}>{s.scored}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <div style={{ fontSize:11, color:C.dim, marginBottom:14, lineHeight:1.6 }}>{`Buts inscrits — ${periodLabel(period)}`} — données historiques uniquement.</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        {[{team:m.home,color:C.accent,side:"home",label:"domicile"},{team:m.away,color:C.blue,side:"away",label:"extérieur"}].map(({team,color,side,label}) => (
          <div key={side}>
            <div style={{ fontSize:11, color, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>{team.short} · {label}</div>
            {team.scorers.length===0
              ? <div style={{ color:C.dim, fontSize:12 }}>Pas de buteur classé.</div>
              : team.scorers.map((s,i) => (
                  <div key={i} style={{ background:C.panel, border:`1px solid ${C.line}`, borderRadius:10, padding:"12px 14px", marginBottom:8 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:4 }}>
                      <span style={{ fontWeight:700, fontSize:13 }}>{s.name}</span>
                      <span style={{ fontSize:18, fontWeight:800, color }}>{s.scored}</span>
                    </div>
                    <div style={{ fontSize:11, color:C.dim, marginBottom:6 }}>{s.scored} but{s.scored>1?"s":""} en {s.played} match{s.played>1?"s":""}</div>
                    <Bar value={s.played>0?Math.round((s.scored/s.played)*100):0} color={color} />
                  </div>
                ))
            }
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Onglet : Over/Under
// ============================================================
function TabButs({ m, period }) {
  const Team = ({ team, color, label }) => (
    <div>
      <div style={{ fontSize:11, color, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>{team.short} · {label}</div>
      <div style={{ fontSize:11, color:C.dim, marginBottom:6 }}>Répartition des buts marqués</div>
      {team.goalsDist.map((g,i) => (
        <div key={i} style={{ display:"grid", gridTemplateColumns:"56px 1fr 36px", alignItems:"center", gap:10, marginBottom:7 }}>
          <span style={{ fontSize:12, color:C.text }}>{g.label}</span>
          <Bar value={g.pct} color={color} />
          <span style={{ fontSize:12, fontWeight:700, textAlign:"right", color:C.dim }}>{g.pct}%</span>
        </div>
      ))}
      <div style={{ fontSize:11, color:C.dim, margin:"12px 0 6px" }}>Seuils (over)</div>
      {team.over.map((o,i) => (
        <div key={i} style={{ display:"grid", gridTemplateColumns:"56px 1fr 36px", alignItems:"center", gap:10, marginBottom:7 }}>
          <span style={{ fontSize:12, color:C.text }}>{o.label}</span>
          <Bar value={o.pct} color={`${color}88`} />
          <span style={{ fontSize:12, fontWeight:700, textAlign:"right", color:C.dim }}>{o.pct}%</span>
        </div>
      ))}
    </div>
  );
  return (
    <div>
      <div style={{ fontSize:11, color:C.dim, marginBottom:14, lineHeight:1.6 }}>{`Fréquences observées — ${periodLabel(period)}`} — repère pour les marchés over/under.</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24 }}>
        <Team team={m.home} color={C.accent} label="domicile" />
        <Team team={m.away} color={C.blue}   label="extérieur" />
      </div>
    </div>
  );
}

// ============================================================
// Onglet : Quarts d'heure
// ============================================================
function TabTiming({ m }) {
  const Block = ({ team, color, label }) => {
    const slots = team.minuteGoals?.for||[];
    const tot   = slots.reduce((s,sl) => s+sl.total, 0)||1;
    return (
      <div>
        <div style={{ fontSize:11, color, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>{team.short} · {label}</div>
        {slots.length===0 ? <div style={{ color:C.dim, fontSize:12 }}>Données indisponibles.</div> : slots.map((sl,i) => {
          const first = sl.label==="0-15", last = sl.label==="90+";
          const hi = first ? C.green : last ? C.warn : color;
          return (
            <div key={i} style={{ display:"grid", gridTemplateColumns:"48px 1fr 56px", alignItems:"center", gap:10, marginBottom:8 }}>
              <span style={{ fontSize:11, color:first||last?hi:C.text, fontWeight:first||last?700:400 }}>{sl.label}{first?" ⚡":last?" 🔔":""}</span>
              <Bar value={Math.round((sl.total/tot)*100)} color={hi} />
              <span style={{ fontSize:11, textAlign:"right", color:C.dim }}>{sl.total} but{sl.total>1?"s":""}</span>
            </div>
          );
        })}
      </div>
    );
  };
  return (
    <div>
      <div style={{ fontSize:11, color:C.dim, marginBottom:14, lineHeight:1.6 }}>Buts par tranche de 15 min. ⚡ premières · 🔔 dernières.</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24 }}>
        <Block team={m.home} color={C.accent} label="domicile" />
        <Block team={m.away} color={C.blue}   label="extérieur" />
      </div>
    </div>
  );
}

// ============================================================
// Onglet : BTTS & Clean Sheet
// ============================================================
function TabBTTS({ m, period }) {
  const Row = ({ label, hv, av, ch, ca, sub }) => (
    <div style={{ background:C.panel, border:`1px solid ${C.line}`, borderRadius:10, padding:"12px 16px", marginBottom:8 }}>
      <div style={{ fontSize:11, color:C.dim, textTransform:"uppercase", letterSpacing:.8, fontWeight:500, marginBottom:10 }}>{label}</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 100px 1fr", alignItems:"center", gap:14, marginBottom:6 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontWeight:800, fontSize:17, color:ch, width:38 }}>{hv}%</span>
          <div style={{ flex:1, transform:"scaleX(-1)" }}><Bar value={hv} color={ch} /></div>
        </div>
        <div style={{ textAlign:"center", fontSize:11, color:C.dim }}>{m.home.short} · {m.away.short}</div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ flex:1 }}><Bar value={av} color={ca} /></div>
          <span style={{ fontWeight:800, fontSize:17, color:ca, width:38, textAlign:"right" }}>{av}%</span>
        </div>
      </div>
      {sub && <div style={{ fontSize:11, color:C.dim, textAlign:"center" }}>{sub}</div>}
    </div>
  );
  return (
    <div>
      <div style={{ fontSize:11, color:C.dim, marginBottom:14, lineHeight:1.6 }}>{`Fréquences — ${periodLabel(period)} — tous matchs`} (dom. + ext.).</div>
      <Row label="Les deux équipes marquent (BTTS)" hv={m.home.btts} av={m.away.btts} ch={C.accent} ca={C.blue} sub="% de matchs où les deux équipes ont marqué" />
      <Row label="Clean sheet — sans encaisser"      hv={m.home.cleanSheet} av={m.away.cleanSheet} ch={C.green} ca={C.green} sub="% de matchs sans but encaissé" />
      <Row label="N'a pas marqué"                    hv={m.home.failedToScore} av={m.away.failedToScore} ch={C.warn} ca={C.warn} sub="% de matchs sans but inscrit" />
    </div>
  );
}

// ============================================================
// Onglet : Penalty
// ============================================================
function TabPenalty({ m }) {
  const Pen = ({ team, color, label }) => {
    const p = team.penalties||{awarded:0,scored:0,played:0,conceded:null};
    const rate = p.played>0 ? (p.awarded/p.played).toFixed(2) : "—";
    const conv = p.awarded>0 ? Math.round((p.scored/p.awarded)*100) : 0;
    return (
      <div style={{ background:C.panel, border:`1px solid ${C.line}`, borderRadius:10, padding:"14px 16px" }}>
        <div style={{ fontSize:11, color, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:12 }}>{team.short} · {label}</div>
        {[
          { label:"Obtenus", value:p.awarded, sub:`${rate}/match`, color },
          ...(p.conceded!=null ? [{ label:"Concédés", value:p.conceded, sub:`${p.played>0?(p.conceded/p.played).toFixed(2):"—"}/match`, color:C.warn }] : []),
          { label:"Conversion", value:`${conv}%`, sub:`${p.scored}/${p.awarded} marqués`, color, last:true },
        ].map((row,i) => (
          <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 0", borderBottom:row.last?"none":`1px solid ${C.line}` }}>
            <div>
              <div style={{ fontSize:13, color:C.text, fontWeight:600 }}>{row.label}</div>
              <div style={{ fontSize:11, color:C.dim, marginTop:2 }}>{row.sub}</div>
            </div>
            <div style={{ fontSize:20, fontWeight:800, color:row.color }}>{row.value}</div>
          </div>
        ))}
      </div>
    );
  };
  return (
    <div>
      <div style={{ fontSize:11, color:C.dim, marginBottom:14, lineHeight:1.6 }}>Saison principale. Penalties obtenus et taux de conversion.</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <Pen team={m.home} color={C.accent} label="domicile" />
        <Pen team={m.away} color={C.blue}   label="extérieur" />
      </div>
    </div>
  );
}

function StatRow({ label, a, b, max, invert }) {
  const aPct = Math.min(100,(a/max)*100), bPct = Math.min(100,(b/max)*100);
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 110px 1fr", alignItems:"center", gap:12, marginBottom:10 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ fontWeight:500, width:30, fontSize:14, color:C.text }}>{a}</span>
        <div style={{ flex:1, transform:"scaleX(-1)" }}><Bar value={aPct} color={invert ? C.warn : C.accent} /></div>
      </div>
      <div style={{ textAlign:"center", fontSize:10, color:C.dim, textTransform:"uppercase", letterSpacing:.8 }}>{label}</div>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <div style={{ flex:1 }}><Bar value={bPct} color={invert ? C.warn : C.blue} /></div>
        <span style={{ fontWeight:500, width:30, fontSize:14, textAlign:"right", color:C.text }}>{b}</span>
      </div>
    </div>
  );
}

// ============================================================
// Vue Tennis (données réelles API-Tennis)
// ============================================================
const SURF_LABEL = { clay:"Terre battue", grass:"Gazon", hard:"Dur" };
const SURF_COLOR = { clay:"#c2692d", grass:C.green, hard:C.blue };

function SurfaceCard({ surface, stats, color }) {
  const pct = stats ? Math.round((stats.wins / (stats.total||1)) * 100) : null;
  return (
    <div style={{ background:C.panel2, borderRadius:8, padding:"10px 12px", textAlign:"center" }}>
      <div style={{ fontSize:10, color, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>{SURF_LABEL[surface]||surface}</div>
      {stats?.total > 0 ? (
        <>
          <div style={{ fontSize:18, fontWeight:900, color }}>{pct}%</div>
          <div style={{ fontSize:10, color:C.dim, marginTop:2 }}>{stats.wins}V {stats.losses}D</div>
        </>
      ) : (
        <div style={{ fontSize:11, color:C.muted }}>—</div>
      )}
    </div>
  );
}

function RankingWinsCard({ rw }) {
  const rows = [
    { key:"top20",   ...rw?.top20   },
    { key:"mid",     ...rw?.mid     },
    { key:"rank100", ...rw?.rank100 },
    { key:"lowRank", ...rw?.lowRank },
  ];
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      {rows.map(r => {
        const pct = r.m > 0 ? Math.round((r.w / r.m) * 100) : null;
        return (
          <div key={r.key} style={{ display:"grid", gridTemplateColumns:"90px 1fr 52px", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:11, color:C.text }}>{r.label}</span>
            <Bar value={pct??0} color={r.key==="top20"?C.accent:r.key==="mid"?C.warn:C.dim} />
            <span style={{ fontSize:11, color:C.dim, textAlign:"right" }}>{pct!==null?`${r.w}/${r.m}`:"—"}</span>
          </div>
        );
      })}
    </div>
  );
}

function PlayerBlock({ p, name, color }) {
  const fmtPrize = (v) => {
    if (!v) return null;
    const sym = p.prizeCurrency === "EUR" ? "€" : "$";
    return v >= 1e6 ? `${sym}${(v / 1e6).toFixed(2)}M` : `${sym}${(v / 1000).toFixed(0)}k`;
  };
  const playsLabel = p.plays === "right-handed" ? "Droitier" : p.plays === "left-handed" ? "Gaucher" : p.plays || null;
  const StatBox = ({ label, val, col }) => (
    <div style={{ background:C.panel2, borderRadius:8, padding:"10px 12px", textAlign:"center" }}>
      <div style={{ fontSize:10, color:C.dim, marginBottom:4, textTransform:"uppercase", letterSpacing:1 }}>{label}</div>
      {val != null
        ? <div style={{ fontSize:14, fontWeight:800, color: col || C.text }}>{val}</div>
        : <div style={{ fontSize:11, color:C.muted }}>—</div>}
    </div>
  );

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
        {p.photo ? <img src={p.photo} alt={p.name} width={40} height={40} style={{ borderRadius:8, objectFit:"cover" }} onError={e => e.target.style.display="none"} /> : null}
        <div>
          <div style={{ fontSize:15, fontWeight:800, color }}>{p.name}</div>
          <div style={{ fontSize:10, color:C.dim, textTransform:"uppercase", letterSpacing:1 }}>{p.country} · #{p.rank??'?'} · {p.points?.toLocaleString()||'—'} pts</div>
        </div>
      </div>

      {/* Classement */}
      <div style={{ fontSize:10, color:C.dim, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Classement</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6, marginBottom:14 }}>
        <StatBox label="Actuel"    val={`#${p.rank}`}                                   col={color}  />
        <StatBox label="Précédent" val={p.previousRank != null ? `#${p.previousRank}` : null} />
        <StatBox label="Meilleur"  val={p.bestRank != null ? `#${p.bestRank}` : null}   col={C.warn} />
      </div>

      {/* Profil */}
      <div style={{ fontSize:10, color:C.dim, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Profil</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:14 }}>
        <StatBox label="Taille"     val={p.height    ? `${p.height}m`  : null} />
        <StatBox label="Poids"      val={p.weight    ? `${p.weight}kg` : null} />
        <StatBox label="Jeu"        val={playsLabel} />
        <StatBox label="Pro depuis" val={p.turnedPro || null} />
      </div>

      {/* Saison */}
      <div style={{ fontSize:10, color:C.dim, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Cette saison</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6, marginBottom:14 }}>
        <StatBox label="Tournois"       val={p.tournamentsPlayed != null ? `${p.tournamentsPlayed}` : null} />
        <StatBox label="Gains saison"   val={fmtPrize(p.prizeCurrent)} col={C.green} />
        <StatBox label="Gains carrière" val={fmtPrize(p.prizeTotal)}   col={color}   />
      </div>
    </div>
  );
}

function TennisView({ tennisId }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const tournaments = [
    { id:"atp",          name:"ATP Tour",         surface:"hard",  flag:"🎾" },
    { id:"wta",          name:"WTA Tour",         surface:"hard",  flag:"🎾" },
    { id:"atp-rg",       name:"Roland Garros",    surface:"clay",  flag:"🇫🇷" },
    { id:"atp-wimbledon",name:"Wimbledon",        surface:"grass", flag:"🏴" },
    { id:"atp-uso",      name:"US Open",          surface:"hard",  flag:"🇺🇸" },
    { id:"atp-ao",       name:"Australian Open",  surface:"hard",  flag:"🇦🇺" },
  ];
  const current = tournaments.find(t => t.id === tennisId) || tournaments[0];

  useEffect(() => {
    if (!tennisId) return;
    setLoading(true); setError(""); setData(null);
    fetchTennisMatch(current.id, current.season)
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [tennisId]);

  if (!tennisId) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"60px 20px", textAlign:"center", color:C.dim }}>
      <div style={{ fontSize:48, marginBottom:16 }}>🎾</div>
      <div style={{ fontSize:18, fontWeight:800, color:C.text, marginBottom:8 }}>Tennis — Sélectionne un tournoi</div>
      <div style={{ fontSize:13 }}>Clique sur un tournoi dans la sidebar pour charger l'analyse.</div>
    </div>
  );

  if (loading) return <InfoPanel>Chargement du match tennis… (première consultation ~20 s)</InfoPanel>;
  if (error) {
    const isKeyError = error.includes("TENNIS_NON_CONFIGURÉ") || error.includes("HTML");
    return (
      <div style={{ background:C.panel, border:`1px solid ${isKeyError?C.warn:C.red}`, borderRadius:10, padding:"20px 18px" }}>
        <div style={{ fontSize:15, fontWeight:800, color:isKeyError?C.warn:C.red, marginBottom:12 }}>
          {isKeyError ? "🎾 Clé API Tennis requise" : "❌ Erreur API Tennis"}
        </div>
        {isKeyError ? (
          <div style={{ fontSize:13, color:C.text, lineHeight:2 }}>
            <b>api-sports.io ne propose pas de Tennis.</b><br/>
            Pour activer le tennis, crée un compte <b>gratuit</b> sur RapidAPI :<br/>
            <span style={{ color:C.accent }}>①</span> Va sur <span style={{ color:C.blue }}>rapidapi.com</span> → crée un compte (gratuit)<br/>
            <span style={{ color:C.accent }}>②</span> Cherche <b>"API-Tennis"</b> par sportdataio → Subscribe (plan Free : 500 req/mois)<br/>
            <span style={{ color:C.accent }}>③</span> Copie ta clé dans <b>Header Parameters → X-RapidAPI-Key</b><br/>
            <span style={{ color:C.accent }}>④</span> Ajoute dans <code style={{ background:C.panel2, padding:"1px 5px", borderRadius:3 }}>backend/.env</code> :<br/>
            <code style={{ display:"block", background:C.panel2, padding:"8px 12px", borderRadius:6, marginTop:6, color:C.green, fontSize:12 }}>
              TENNIS_RAPIDAPI_KEY=ta_clé_rapidapi{"\n"}
              TENNIS_HOST=api-tennis.p.rapidapi.com
            </code>
          </div>
        ) : (
          <div style={{ fontSize:12, color:C.dim, lineHeight:1.6, whiteSpace:"pre-wrap" }}>{error}</div>
        )}
      </div>
    );
  }
  if (!data)   return <InfoPanel>Sélectionne un tournoi dans la sidebar.</InfoPanel>;

  const SURF_COLOR_MATCH = { clay:"#c2692d55", grass:`${C.green}33`, hard:`${C.blue}33` };

  return (
    <div>
      {/* Header du match */}
      <div style={{ background:C.panel, border:`1px solid ${C.line}`, borderRadius:12, overflow:"hidden", marginBottom:2 }}>
        <div style={{ background:C.sidebar, borderBottom:`1px solid ${C.line}`, padding:"8px 16px", display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:13 }}>{current.flag}</span>
          <span style={{ fontSize:11, fontWeight:700, color:C.dim, letterSpacing:1, textTransform:"uppercase" }}>{data.tournament}</span>
          <span style={{ color:C.line }}>·</span>
          <span style={{ fontSize:11, color:C.dim }}>{data.date}</span>
          <span style={{ marginLeft:8, fontSize:11, fontWeight:700, color:SURF_COLOR[data.surface]||C.dim }}>{SURF_LABEL[data.surface]||data.surface}</span>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", alignItems:"center", gap:12, padding:"18px 20px" }}>
          <div>
            <div style={{ fontSize:16, fontWeight:800 }}>{data.p1.name}</div>
            <div style={{ fontSize:10, color:C.dim, marginTop:3, textTransform:"uppercase" }}>
              {data.p1.country} · #{data.p1.rank??'?'} · {data.p1.points?.toLocaleString()||'—'} pts
            </div>
          </div>
          <div style={{ textAlign:"center" }}>
            {data.isRankingView
              ? <div style={{ fontSize:11, color:C.dim, fontWeight:700 }}>CLASSEMENT</div>
              : <div style={{ fontSize:22, fontWeight:900 }}>{data.score}</div>
            }
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:16, fontWeight:800 }}>{data.p2.name}</div>
            <div style={{ fontSize:10, color:C.dim, marginTop:3, textTransform:"uppercase" }}>
              {data.p2.country} · #{data.p2.rank??'?'} · {data.p2.points?.toLocaleString()||'—'} pts
            </div>
          </div>
        </div>
      </div>

      {/* Stats des deux joueurs */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginTop:14 }}>
        <PlayerBlock p={data.p1} name={data.p1.name} color={C.accent} />
        <PlayerBlock p={data.p2} name={data.p2.name} color={C.blue}   />
      </div>

      {/* H2H */}
      {data.h2h?.length > 0 && (
        <>
          <SectionTitle>Face-à-face ({data.h2h.length} matchs)</SectionTitle>
          <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
            {data.h2h.map((h,i) => (
              <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", alignItems:"center", background:C.panel, border:`1px solid ${C.line}`, borderRadius:8, padding:"9px 14px", fontSize:12 }}>
                <span style={{ color:C.dim }}>{h.date} <span style={{ fontSize:10, color:SURF_COLOR[h.surface]||C.dim }}>{SURF_LABEL[h.surface]||h.surface}</span></span>
                <span style={{ fontWeight:700, padding:"0 12px" }}>{h.score}</span>
                <span style={{ textAlign:"right", fontSize:11, fontWeight:700, color:h.winner==="p1"?C.accent:C.blue }}>{h.winner==="p1"?data.p1.name:data.p2.name}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ marginTop:16, padding:"10px 14px", background:C.panel, border:`1px solid ${C.line}`, borderRadius:8, fontSize:11, color:C.muted, lineHeight:1.6 }}>
        Données API-Tennis · statistiques historiques uniquement · aucune prédiction.
      </div>
    </div>
  );
}

// ============================================================
// Chat IA flottant
// ============================================================
function ChatWidget({ matchContext, teamDatabase = {} }) {
  const [open, setOpen]     = useState(false);
  const [input, setInput]   = useState("");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const teamCount = Object.keys(teamDatabase).length;

  useEffect(() => { if (open) bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [history, open]);

  async function send() {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    const next = [...history, { role:"user", content:q }];
    setHistory(next);
    setLoading(true);
    try {
      const { answer } = await sendChat(q, matchContext, history, teamDatabase);
      setHistory([...next, { role:"assistant", content:answer }]);
    } catch(e) {
      setHistory([...next, { role:"assistant", content:`Erreur : ${e.message}` }]);
    } finally { setLoading(false); }
  }

  return (
    <>
      <button onClick={() => setOpen(o=>!o)} style={{
        position:"fixed", bottom:24, right:24, zIndex:200,
        width:50, height:50, borderRadius:"50%", border:"none",
        background:C.accent, color:"#fff", fontSize:20, cursor:"pointer",
        boxShadow:`0 4px 20px ${C.accent}55`,
        display:"flex", alignItems:"center", justifyContent:"center",
        transform:open?"rotate(45deg)":"rotate(0)", transition:"transform .2s",
      }}>{open?"✕":"💬"}</button>

      {open && (
        <div style={{
          position:"fixed", bottom:84, right:24, zIndex:200,
          width:330, maxHeight:460,
          background:C.panel, border:`1px solid ${C.line}`, borderRadius:14,
          display:"flex", flexDirection:"column", boxShadow:"0 8px 24px rgba(3,45,96,.15)",
          overflow:"hidden",
        }}>
          <div style={{ padding:"10px 14px", background:C.accent, display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:15 }}>🤖</span>
            <div>
              <div style={{ fontWeight:800, fontSize:12.5, color:"#fff" }}>Assistant EdgeStat</div>
              <div style={{ fontSize:10, color:"#ffffff99" }}>{teamCount} équipe{teamCount>1?"s":""} · pas de prédiction</div>
            </div>
            <div style={{ marginLeft:"auto", fontSize:10, color:"#ffffff99", textAlign:"right" }}>
              {matchContext ? <>{matchContext.home?.name?.split(" ").pop()}<br/>vs {matchContext.away?.name?.split(" ").pop()}</> : "Aucun match"}
            </div>
          </div>
          <div style={{ flex:1, overflowY:"auto", padding:"12px 14px", display:"flex", flexDirection:"column", gap:8 }}>
            {history.length===0 && <div style={{ color:C.dim, fontSize:12, textAlign:"center", marginTop:16, lineHeight:1.6 }}>Pose une question sur n'importe quelle équipe chargée.<br/><em>"Compare PSG et Juventus"</em></div>}
            {history.map((msg,i) => (
              <div key={i} style={{
                alignSelf:msg.role==="user"?"flex-end":"flex-start", maxWidth:"85%",
                background:msg.role==="user"?C.accent:C.panel2,
                color:msg.role==="user"?"#fff":C.text,
                borderRadius:msg.role==="user"?"12px 12px 4px 12px":"12px 12px 12px 4px",
                padding:"8px 12px", fontSize:12.5, lineHeight:1.5,
              }}>{msg.content}</div>
            ))}
            {loading && <div style={{ alignSelf:"flex-start", color:C.dim, fontSize:12 }}>⏳ Analyse…</div>}
            <div ref={bottomRef} />
          </div>
          <div style={{ display:"flex", borderTop:`1px solid ${C.line}`, padding:10, gap:8 }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key==="Enter"&&!e.shiftKey&&send()}
              placeholder="Ta question…" disabled={loading}
              style={{ flex:1, background:C.panel2, border:`1px solid ${C.line}`, borderRadius:8, color:C.text, fontSize:12.5, padding:"7px 11px", outline:"none" }}
            />
            <button onClick={send} disabled={loading||!input.trim()} style={{
              background:C.accent, border:"none", borderRadius:8, color:"#fff", fontWeight:700, fontSize:13,
              padding:"7px 13px", cursor:loading||!input.trim()?"not-allowed":"pointer",
              opacity:loading||!input.trim()?.5:1,
            }}>→</button>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// Modal joueur
// ============================================================
// ============================================================
// Modal Fiche Club
// ============================================================
function ClubModal({ teamId, teamName, teamLogo, onClose, isFav, onToggleFav }) {
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [activeTab, setActiveTab] = useState("info");

  useEffect(() => {
    if (!teamId) return;
    setLoading(true); setError(""); setData(null);
    fetchClubCard(teamId)
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [teamId]);

  const TABS = [
    { id:"info",    label:"Infos" },
    { id:"form",    label:"Forme" },
    { id:"records", label:"Records IA" },
    { id:"honors",  label:"Palmarès" },
  ];

  const ai = data?.aiData || {};

  const StatBox = ({ label, val, color }) => (
    <div style={{ background:C.panel2, borderRadius:8, padding:"8px 10px", textAlign:"center" }}>
      <div style={{ fontSize:9, color:C.dim, textTransform:"uppercase", letterSpacing:.8, marginBottom:3 }}>{label}</div>
      <div style={{ fontSize:13, fontWeight:600, color:color||C.accent }}>{val ?? "—"}</div>
    </div>
  );

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(3,45,96,.55)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center" }} onClick={onClose}>
      <div style={{ width:"100%", maxWidth:540, background:C.panel, borderRadius:16, border:`1px solid ${C.line}`, maxHeight:"90vh", display:"flex", flexDirection:"column", overflow:"hidden" }} onClick={e=>e.stopPropagation()}>

        {loading && <div style={{ padding:40, textAlign:"center", color:C.dim }}>⏳ Chargement de la fiche…</div>}
        {error   && <div style={{ padding:20, color:"#ef4444" }}>{error}</div>}

        {(data || (!loading && !error)) && (
          <>
            {/* Header */}
            <div style={{ padding:"16px 20px", borderBottom:`1px solid ${C.line}`, display:"flex", alignItems:"center", gap:14, flexShrink:0 }}>
              <TeamLogo url={data?.logo||teamLogo||""} size={52} name={data?.name||teamName||"?"} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:18, fontWeight:700, color:C.text }}>{data?.name||teamName}</div>
                <div style={{ fontSize:12, color:C.dim, marginTop:3, display:"flex", gap:10, flexWrap:"wrap" }}>
                  {data?.country && <span>🌍 {data.country}</span>}
                  {data?.founded && <span>📅 Fondé en {data.founded}</span>}
                  {data?.stadium?.name && <span>🏟 {data.stadium.name}{data.stadium.capacity?` (${(data.stadium.capacity/1000).toFixed(0)}k)`:""}</span>}
                </div>
              </div>
              {/* Étoile favori */}
              <button onClick={e=>{ e.stopPropagation(); onToggleFav?.({ id:teamId, name:data?.name||teamName, logo:data?.logo||teamLogo }); }} style={{
                background:"none", border:`1px solid ${isFav?"#f97316":C.line}`, borderRadius:8, padding:"6px 12px",
                cursor:"pointer", fontSize:16, color:isFav?"#f97316":C.muted, transition:"all .15s",
              }}>{isFav?"⭐":"☆"}</button>
              <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:C.muted, fontSize:18, lineHeight:1 }}>✕</button>
            </div>

            {/* Stats rapides (classement actuel) */}
            {data?.currentStanding && (
              <div style={{ padding:"10px 20px", borderBottom:`1px solid ${C.line}`, display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:6, flexShrink:0 }}>
                <StatBox label="Rang"   val={`#${data.currentStanding.rank}`}          color={C.accent} />
                <StatBox label="Pts"    val={data.currentStanding.points}               color={C.warn}  />
                <StatBox label="V"      val={data.currentStanding.won}                  color={C.green} />
                <StatBox label="N"      val={data.currentStanding.drawn}                color="#d97706" />
                <StatBox label="D"      val={data.currentStanding.lost}                 color="#dc2626" />
                <StatBox label="Buts"   val={`${data.currentStanding.gf}:${data.currentStanding.ga}`} />
              </div>
            )}

            {/* Tabs */}
            <div style={{ display:"flex", gap:0, borderBottom:`1px solid ${C.line}`, flexShrink:0 }}>
              {TABS.map(t => (
                <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{
                  border:"none", cursor:"pointer", padding:"10px 18px", fontSize:12,
                  fontWeight:activeTab===t.id?600:400, background:"none",
                  color:activeTab===t.id?C.accent:C.dim,
                  borderBottom:`2px solid ${activeTab===t.id?C.accent:"transparent"}`,
                  marginBottom:"-2px",
                }}>{t.label}</button>
              ))}
            </div>

            {/* Contenu */}
            <div style={{ flex:1, overflowY:"auto", padding:"14px 20px" }}>

              {/* INFOS */}
              {activeTab==="info" && (
                <div>
                  {/* Manager */}
                  {(ai.currentManager?.name || data?.tsdbInfo?.manager) && (
                    <div style={{ background:C.panel2, borderRadius:10, padding:"10px 14px", marginBottom:12, display:"flex", alignItems:"center", gap:10 }}>
                      <span style={{ fontSize:20 }}>🧑‍💼</span>
                      <div>
                        <div style={{ fontSize:12, fontWeight:600, color:C.text }}>{ai.currentManager?.name || data?.tsdbInfo?.manager}</div>
                        {ai.currentManager?.since && <div style={{ fontSize:10, color:C.dim }}>En poste depuis {ai.currentManager.since}</div>}
                      </div>
                    </div>
                  )}

                  {/* Stats IA */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
                    {ai.trophyCount?.total && (
                      <div style={{ background:C.panel2, borderRadius:10, padding:"10px 14px" }}>
                        <div style={{ fontSize:9, color:C.muted, textTransform:"uppercase", letterSpacing:.8, marginBottom:4 }}>🏆 Trophées</div>
                        <div style={{ fontSize:16, fontWeight:700, color:"#d97706" }}>{ai.trophyCount.total} titres</div>
                        {ai.trophyCount.majorTitles && <div style={{ fontSize:10, color:C.dim, marginTop:3 }}>{ai.trophyCount.majorTitles}</div>}
                      </div>
                    )}
                    {ai.clubValue && (
                      <div style={{ background:C.panel2, borderRadius:10, padding:"10px 14px" }}>
                        <div style={{ fontSize:9, color:C.muted, textTransform:"uppercase", letterSpacing:.8, marginBottom:4 }}>💰 Valeur estimée</div>
                        <div style={{ fontSize:14, fontWeight:700, color:C.green }}>{ai.clubValue}</div>
                      </div>
                    )}
                  </div>

                  {/* Stade */}
                  {data?.stadium?.name && (
                    <div style={{ background:C.panel2, borderRadius:10, padding:"10px 14px", marginBottom:12 }}>
                      <div style={{ fontSize:9, color:C.muted, textTransform:"uppercase", letterSpacing:.8, marginBottom:6 }}>🏟 Stade</div>
                      <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
                        <div><div style={{ fontSize:12, fontWeight:600, color:C.text }}>{data.stadium.name}</div>
                          {data.stadium.city && <div style={{ fontSize:10, color:C.dim }}>{data.stadium.city}</div>}
                        </div>
                        {data.stadium.capacity && (
                          <div style={{ marginLeft:"auto", textAlign:"right" }}>
                            <div style={{ fontSize:16, fontWeight:700, color:C.accent }}>{data.stadium.capacity.toLocaleString()}</div>
                            <div style={{ fontSize:9, color:C.muted }}>spectateurs</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Fun fact */}
                  {ai.funFact && (
                    <div style={{ background:`${C.accent}0a`, border:`1px solid ${C.accent}33`, borderRadius:10, padding:"10px 14px" }}>
                      <div style={{ fontSize:9, color:C.accent, textTransform:"uppercase", letterSpacing:.8, marginBottom:4 }}>💡 Le saviez-vous ?</div>
                      <div style={{ fontSize:12, color:C.text, lineHeight:1.6 }}>{ai.funFact}</div>
                    </div>
                  )}

                  {/* Description TheSportsDB */}
                  {data?.tsdbInfo?.description && (
                    <div style={{ marginTop:12, fontSize:11, color:C.dim, lineHeight:1.7 }}>{data.tsdbInfo.description}</div>
                  )}
                </div>
              )}

              {/* FORME */}
              {activeTab==="form" && (
                <div>
                  {/* Prochain match */}
                  {data?.upcomingMatches?.[0] && (
                    <div style={{ background:`${C.blue}0a`, border:`1px solid ${C.blue}33`, borderRadius:10, padding:"10px 14px", marginBottom:14 }}>
                      <div style={{ fontSize:9, color:C.blue, textTransform:"uppercase", letterSpacing:.8, marginBottom:6 }}>Prochain match</div>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <div style={{ flex:1, fontSize:12, fontWeight:600, color:C.text }}>
                          {data.upcomingMatches[0].home.name} vs {data.upcomingMatches[0].away.name}
                        </div>
                        <div style={{ fontSize:11, color:C.dim }}>
                          {new Date(data.upcomingMatches[0].date).toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"})}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Historique des matchs avec pagination */}
                  {(() => {
                    const [visibleCount, setVisibleCount] = React.useState(10);
                    const allMatches = data?.recentForm || [];
                    const visible = allMatches.slice(0, visibleCount);
                    return (
                      <>
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                          <div style={{ fontSize:10, color:C.dim, fontWeight:700, textTransform:"uppercase", letterSpacing:.8 }}>
                            Derniers matchs ({allMatches.length} disponibles)
                          </div>
                          <div style={{ fontSize:10, color:C.dim }}>{visible.length} / {allMatches.length}</div>
                        </div>
                        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                          {visible.map((f,i) => (
                            <div key={f.id||i} style={{ display:"flex", alignItems:"center", gap:10, background:C.panel2, borderRadius:8, padding:"7px 12px" }}>
                              <span style={{ width:18, height:18, borderRadius:4, display:"grid", placeItems:"center", fontSize:9, fontWeight:700,
                                background: f.result==="W"?"#16a34a":f.result==="L"?"#dc2626":"#d97706", color:"#fff" }}>{f.result}</span>
                              <div style={{ display:"flex", alignItems:"center", gap:6, flex:1, minWidth:0 }}>
                                {f.opponent?.logo && <img src={f.opponent.logo} width={14} height={14} style={{ objectFit:"contain" }} onError={e=>e.target.style.display="none"} />}
                                <span style={{ fontSize:11, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                                  {f.opponent?.side} {f.opponent?.name}
                                </span>
                              </div>
                              <span style={{ fontSize:10, color:C.dim, flexShrink:0 }}>{f.league}</span>
                              <span style={{ fontSize:12, fontWeight:600, color:C.text, flexShrink:0 }}>{f.score}</span>
                              <span style={{ fontSize:9, color:C.muted, flexShrink:0 }}>{new Date(f.date).toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"2-digit"})}</span>
                            </div>
                          ))}
                        </div>
                        {/* Boutons de pagination */}
                        <div style={{ display:"flex", gap:8, marginTop:10 }}>
                          {visibleCount < allMatches.length && (
                            <button onClick={() => setVisibleCount(c => c + 10)} style={{
                              flex:1, background:C.panel2, border:`1px solid ${C.line}`, borderRadius:8,
                              padding:"7px 0", cursor:"pointer", fontSize:12, color:C.dim, fontWeight:500,
                            }}>
                              + Voir 10 de plus ({allMatches.length - visibleCount} restants)
                            </button>
                          )}
                          {visibleCount > 10 && (
                            <button onClick={() => setVisibleCount(10)} style={{
                              background:"none", border:`1px solid ${C.line}`, borderRadius:8,
                              padding:"7px 14px", cursor:"pointer", fontSize:12, color:C.muted,
                            }}>▴ Réduire</button>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* RECORDS IA */}
              {activeTab==="records" && (
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {ai.allTimeTopScorer?.name && (
                    <div style={{ background:C.panel2, borderRadius:10, padding:"12px 14px" }}>
                      <div style={{ fontSize:9, color:C.muted, textTransform:"uppercase", letterSpacing:.8, marginBottom:6 }}>⚽ Meilleur buteur de tous les temps</div>
                      <div style={{ fontSize:15, fontWeight:700, color:C.text }}>{ai.allTimeTopScorer.name}</div>
                      <div style={{ fontSize:12, color:C.accent, fontWeight:600 }}>{ai.allTimeTopScorer.goals} buts</div>
                      {ai.allTimeTopScorer.period && <div style={{ fontSize:10, color:C.dim }}>{ai.allTimeTopScorer.period}</div>}
                    </div>
                  )}
                  {ai.bestSeasonPoints?.season && (
                    <div style={{ background:C.panel2, borderRadius:10, padding:"12px 14px" }}>
                      <div style={{ fontSize:9, color:C.muted, textTransform:"uppercase", letterSpacing:.8, marginBottom:6 }}>🏆 Meilleure saison en points</div>
                      <div style={{ fontSize:15, fontWeight:700, color:C.text }}>{ai.bestSeasonPoints.season}</div>
                      <div style={{ fontSize:12, color:"#d97706", fontWeight:600 }}>{ai.bestSeasonPoints.points} pts</div>
                      {ai.bestSeasonPoints.competition && <div style={{ fontSize:10, color:C.dim }}>{ai.bestSeasonPoints.competition}</div>}
                    </div>
                  )}
                  {ai.mostWinsSeason?.season && (
                    <div style={{ background:C.panel2, borderRadius:10, padding:"12px 14px" }}>
                      <div style={{ fontSize:9, color:C.muted, textTransform:"uppercase", letterSpacing:.8, marginBottom:6 }}>✅ Plus de victoires en une saison</div>
                      <div style={{ fontSize:15, fontWeight:700, color:C.text }}>{ai.mostWinsSeason.season}</div>
                      <div style={{ fontSize:12, color:C.green, fontWeight:600 }}>{ai.mostWinsSeason.wins} victoires</div>
                    </div>
                  )}
                  {ai.clubRecord?.description && (
                    <div style={{ background:C.panel2, borderRadius:10, padding:"12px 14px" }}>
                      <div style={{ fontSize:9, color:C.muted, textTransform:"uppercase", letterSpacing:.8, marginBottom:6 }}>📖 Record du club</div>
                      <div style={{ fontSize:12, color:C.text, lineHeight:1.6 }}>{ai.clubRecord.description}</div>
                    </div>
                  )}
                  {!ai.allTimeTopScorer && !ai.bestSeasonPoints && (
                    <div style={{ color:C.muted, fontSize:12, padding:"16px 0" }}>Records IA non disponibles pour ce club.</div>
                  )}
                  <div style={{ fontSize:9, color:C.muted, marginTop:8, padding:"8px 10px", background:C.panel2, borderRadius:8 }}>
                    🤖 Données générées par IA (Groq llama-3.3-70b) · Vérifier les informations importantes
                  </div>
                </div>
              )}

              {/* PALMARÈS */}
              {activeTab==="honors" && (
                <div>
                  {(data?.tsdbHonors||[]).length === 0 ? (
                    <div style={{ color:C.muted, fontSize:12 }}>Palmarès non disponible via TheSportsDB pour ce club.</div>
                  ) : (
                    <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                      {(data?.tsdbHonors||[]).map((h,i) => (
                        <div key={i} style={{ display:"flex", alignItems:"center", gap:10, background:C.panel2, borderRadius:8, padding:"8px 12px" }}>
                          <span style={{ fontSize:14 }}>🏆</span>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:12, color:C.text }}>{h.strHonour}</div>
                            {h.strTeam && <div style={{ fontSize:10, color:C.dim }}>{h.strTeam}</div>}
                          </div>
                          <span style={{ fontSize:11, color:"#d97706", fontWeight:600 }}>{h.strSeason}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PlayerModal({ playerId, playerName, season, onClose, tsdbId }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [activeTab, setActiveTab] = useState("stats");

  useEffect(() => {
    setLoading(true); setError(""); setData(null);
    fetchPlayer(playerId, season, tsdbId)
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [playerId, season, tsdbId]);

  const TABS_PM = [
    { id:"stats",     label:"Stats" },
    { id:"transfers", label:"Transferts" },
    { id:"trophies",  label:"Palmarès" },
  ];

  const S = ({ label, val, color, small }) => (
    <div style={{ background:C.panel2, borderRadius:8, padding:"8px 10px", textAlign:"center" }}>
      <div style={{ fontSize:9, color:C.muted, textTransform:"uppercase", letterSpacing:.8, marginBottom:3 }}>{label}</div>
      <div style={{ fontSize:small?12:16, fontWeight:600, color:color||C.accent }}>{val ?? "—"}</div>
    </div>
  );

  const isGK = data?.player?.position?.toLowerCase().includes("goalkeeper") ||
               data?.statistics?.[0]?.games?.position?.toLowerCase().includes("goalkeeper");

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(3,45,96,.55)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center" }} onClick={onClose}>
      <div style={{ width:"100%", maxWidth:520, background:C.panel, borderRadius:16, border:`1px solid ${C.line}`, maxHeight:"90vh", display:"flex", flexDirection:"column", overflow:"hidden" }} onClick={e=>e.stopPropagation()}>

        {loading && <div style={{ padding:40, textAlign:"center", color:C.dim }}>⏳ Chargement de la fiche…</div>}
        {error   && <div style={{ padding:20, color:C.red }}>{error}</div>}

        {data && (() => {
          const p  = data.player || {};
          const ca = data.career || {};
          const photo = p.photo || p.strCutout || p.strThumb || "";
          const age   = p.age || (p.birth?.date ? Math.floor((Date.now()-new Date(p.birth.date))/31557600000) : null);
          const born  = p.birth?.date || null;
          const pos   = p.position || data.statistics?.[0]?.games?.position || "";

          return (
            <>
              {/* ── HEADER ── */}
              <div style={{ display:"flex", gap:16, padding:"18px 20px 14px", borderBottom:`1px solid ${C.line}`, flexShrink:0 }}>
                {/* Photo */}
                <div style={{ width:80, height:80, borderRadius:12, background:C.panel2, overflow:"hidden", flexShrink:0, border:`1px solid ${C.line}` }}>
                  {photo
                    ? <img src={photo} alt={p.name} width={80} height={80} style={{ objectFit:"cover" }} onError={e=>e.target.style.display="none"} />
                    : <div style={{ width:80, height:80, display:"grid", placeItems:"center", fontSize:28, color:C.muted }}>👤</div>
                  }
                </div>
                {/* Bio */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:18, fontWeight:700, color:C.text, marginBottom:3 }}>{p.name||playerName}</div>
                  <div style={{ fontSize:12, color:C.dim, marginBottom:6, display:"flex", gap:8, flexWrap:"wrap" }}>
                    {p.nationality && <span>🏳 {p.nationality}</span>}
                    {age && <span>🎂 {age} ans{born ? ` (${born})` : ""}</span>}
                    {pos && <span>⚽ {pos}</span>}
                  </div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap", fontSize:11 }}>
                    {p.height && <span style={{ background:C.panel2, borderRadius:5, padding:"2px 7px", color:C.dim }}>📏 {p.height}</span>}
                    {p.weight && <span style={{ background:C.panel2, borderRadius:5, padding:"2px 7px", color:C.dim }}>⚖ {p.weight}</span>}
                    {p.birthPlace && <span style={{ background:C.panel2, borderRadius:5, padding:"2px 7px", color:C.dim }}>📍 {p.birthPlace}</span>}
                  </div>
                </div>
                <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:C.muted, fontSize:18, alignSelf:"flex-start", lineHeight:1 }}>✕</button>
              </div>

              {/* ── STATS RAPIDES ── */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6, padding:"12px 16px", borderBottom:`1px solid ${C.line}`, flexShrink:0 }}>
                <S label="Matchs"  val={ca.appearances}  color={C.text} />
                {isGK ? (
                  <>
                    <S label="Buts enc." val={ca.conceded} color="#dc2626" />
                    <S label="Saves"     val={ca.saves}    color={C.green} />
                  </>
                ) : (
                  <>
                    <S label="Buts"      val={ca.goals}    color={C.accent} />
                    <S label="Passes dé" val={ca.assists}  color={C.blue} />
                  </>
                )}
                <S label="Trophées" val={data.trophies?.length||"—"} color="#d97706" />
              </div>
              <div style={{ padding:"4px 16px 2px", fontSize:9, color:C.muted, borderBottom:`1px solid ${C.line}`, flexShrink:0 }}>
                Stats sur {data.seasonsLoaded?.length||1} saison(s) · Valeur marchande non disponible sans abonnement Transfermarkt
              </div>

              {/* ── TABS ── */}
              <div style={{ display:"flex", gap:2, padding:"8px 12px 0", flexShrink:0 }}>
                {TABS_PM.map(t => (
                  <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{
                    border:"none", cursor:"pointer", padding:"6px 14px", borderRadius:"8px 8px 0 0",
                    fontSize:12, fontWeight:activeTab===t.id?600:400,
                    background:activeTab===t.id ? C.panel2 : "none",
                    color:activeTab===t.id ? C.accent : C.dim,
                    borderBottom:activeTab===t.id ? `2px solid ${C.accent}` : "none",
                  }}>{t.label}</button>
                ))}
              </div>

              {/* ── CONTENU TABS ── */}
              <div style={{ flex:1, overflowY:"auto", padding:"12px 16px 16px" }}>

                {/* STATS */}
                {activeTab==="stats" && (
                  <div>
                    {/* Club actuel */}
                    {data.statistics?.[0]?.team && (
                      <div style={{ display:"flex", alignItems:"center", gap:10, background:C.panel2, borderRadius:10, padding:"10px 12px", marginBottom:12 }}>
                        <img src={data.statistics[0].team.logo||""} width={32} height={32} style={{ objectFit:"contain" }} onError={e=>e.target.style.display="none"} />
                        <div>
                          <div style={{ fontSize:12, fontWeight:600, color:C.text }}>{data.statistics[0].team.name}</div>
                          <div style={{ fontSize:10, color:C.dim }}>Club actuel</div>
                        </div>
                        {data.formationClub?.name && data.formationClub.name !== data.statistics[0].team.name && (
                          <div style={{ marginLeft:"auto", textAlign:"right" }}>
                            <div style={{ fontSize:11, color:C.dim }}>Formation : {data.formationClub.name}</div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Stats par compétition */}
                    <div style={{ fontSize:10, color:C.dim, fontWeight:600, textTransform:"uppercase", letterSpacing:.8, marginBottom:8 }}>Statistiques par compétition</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                      {(data.statistics||[]).slice(0,10).map((s,i) => (
                        <div key={i} style={{ display:"flex", alignItems:"center", gap:8, background:C.panel2, borderRadius:8, padding:"8px 10px" }}>
                          {s.team?.logo && <img src={s.team.logo} width={16} height={16} style={{ objectFit:"contain" }} onError={e=>e.target.style.display="none"} />}
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:11, fontWeight:500, color:C.text }}>{s.team?.name}</div>
                            <div style={{ fontSize:9, color:C.muted }}>{s.league?.name} · {s.league?.season||""}</div>
                          </div>
                          <div style={{ display:"flex", gap:8, fontSize:10 }}>
                            <span style={{ color:C.dim }}>{s.games?.appearences||0}M</span>
                            {isGK ? (
                              <>
                                <span style={{ color:"#dc2626", fontWeight:600 }}>{s.goals?.conceded||0}enc.</span>
                                <span style={{ color:C.green, fontWeight:600 }}>{s.goals?.saves||0}sv</span>
                              </>
                            ) : (
                              <>
                                <span style={{ color:C.accent, fontWeight:600 }}>{s.goals?.total||0}G</span>
                                <span style={{ color:C.blue }}>{s.goals?.assists||0}A</span>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TRANSFERTS */}
                {activeTab==="transfers" && (
                  <div>
                    {(!data.transfers || data.transfers.length === 0) ? (
                      <div style={{ color:C.muted, fontSize:12 }}>Aucun transfert disponible.</div>
                    ) : (
                      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                        {data.transfers.map((t,i) => {
                          const isLoan = t.type?.toLowerCase().includes("loan");
                          const isFree = t.type?.toLowerCase().includes("free");
                          const typeColor = isLoan ? "#d97706" : isFree ? C.green : C.accent;
                          return (
                            <div key={i} style={{ background:C.panel2, border:`1px solid ${C.line}`, borderRadius:10, padding:"10px 12px" }}>
                              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                                {/* Club quittant */}
                                <div style={{ display:"flex", alignItems:"center", gap:5, flex:1, minWidth:0 }}>
                                  {t.teamOut?.logo && <img src={t.teamOut.logo} width={16} height={16} style={{ objectFit:"contain" }} onError={e=>e.target.style.display="none"} />}
                                  <span style={{ fontSize:11, color:C.dim, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.teamOut?.name||"?"}</span>
                                </div>
                                <span style={{ color:C.dim, flexShrink:0 }}>→</span>
                                {/* Club arrivant */}
                                <div style={{ display:"flex", alignItems:"center", gap:5, flex:1, minWidth:0 }}>
                                  {t.teamIn?.logo && <img src={t.teamIn.logo} width={16} height={16} style={{ objectFit:"contain" }} onError={e=>e.target.style.display="none"} />}
                                  <span style={{ fontSize:11, fontWeight:600, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.teamIn?.name||"?"}</span>
                                </div>
                              </div>
                              <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:10 }}>
                                <span style={{ color:C.muted }}>{t.date?.slice(0,7)||"?"}</span>
                                <span style={{ background:`${typeColor}18`, color:typeColor, borderRadius:5, padding:"2px 7px", fontWeight:600 }}>
                                  {isLoan ? "Prêt" : isFree ? "Gratuit" : t.type||"Transfert"}
                                </span>
                                {t.fee ? (
                                  <span style={{ marginLeft:"auto", fontWeight:700, color:C.accent }}>{t.fee}</span>
                                ) : (
                                  <span style={{ marginLeft:"auto", fontSize:9, color:C.muted }}>Montant n.d.</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div style={{ marginTop:10, fontSize:10, color:C.muted, background:C.panel2, borderRadius:8, padding:"8px 10px" }}>
                      💡 Montants des transferts disponibles avec Transfermarkt Premium
                    </div>
                  </div>
                )}

                {/* PALMARÈS */}
                {activeTab==="trophies" && (
                  <div>
                    {(!data.trophies || data.trophies.length===0) ? (
                      <div style={{ color:C.muted, fontSize:12 }}>Aucun trophée trouvé dans TheSportsDB.</div>
                    ) : (
                      <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                        {data.trophies.map((t,i) => (
                          <div key={i} style={{ display:"flex", alignItems:"center", gap:10, background:C.panel2, borderRadius:8, padding:"8px 12px" }}>
                            <span style={{ fontSize:14 }}>🏆</span>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:12, color:C.text }}>{t.league}</div>
                              {t.team && <div style={{ fontSize:10, color:C.dim }}>{t.team}</div>}
                            </div>
                            <span style={{ fontSize:11, color:C.warn, fontWeight:600 }}>{t.season}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}

// ============================================================
// Onglet : Compositions d'équipe
// ============================================================
const POSITION_LABEL = {
  Goalkeeper: "Gardien",
  Defender:   "Défenseur",
  Midfielder: "Milieu",
  Attacker:   "Attaquant",
};
const POSITION_ORDER = ["Goalkeeper", "Defender", "Midfielder", "Attacker"];

function TabCompo({ homeId, awayId, homeName, awayName, season, fixtureId }) {
  const [squads,         setSquads]        = useState({ home: null, away: null });
  const [lineup,         setLineup]        = useState(null);
  const [loading,        setLoading]       = useState(true);
  const [error,          setError]         = useState("");
  const [selectedPlayer, setSelectedPlayer]= useState(null);
  const [goalMap,        setGoalMap]       = useState({});

  useEffect(() => {
    if (!homeId || !awayId) return;
    setLoading(true); setError("");
    Promise.all([
      Promise.all([fetchSquad(homeId), fetchSquad(awayId)]),
      fixtureId ? fetchLineup(fixtureId).catch(() => null)    : Promise.resolve(null),
      fixtureId ? fetchMatchEvents(fixtureId).catch(() => []) : Promise.resolve([]),
    ])
      .then(([[home, away], lu, events]) => {
        setSquads({ home, away });
        setLineup(lu);
        const map = {};
        events.forEach(e => { if (e.playerId) map[e.playerId] = (map[e.playerId]||0)+1; });
        setGoalMap(map);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [homeId, awayId, fixtureId]);

  if (!homeId || !awayId) return <InfoPanel>IDs d'équipes non disponibles.</InfoPanel>;
  if (loading) return <InfoPanel>Chargement des effectifs…</InfoPanel>;
  if (error)   return <InfoPanel tone="error">{error}</InfoPanel>;

  function SquadColumn({ squad, teamName, color }) {
    if (!squad || squad.length === 0) return (
      <div>
        <div style={{ fontSize:13, fontWeight:800, color, marginBottom:10 }}>{teamName}</div>
        <div style={{ color:C.dim, fontSize:12 }}>Effectif non disponible</div>
      </div>
    );
    const grouped = {};
    POSITION_ORDER.forEach(pos => {
      const players = squad.filter(p => p.position === pos);
      if (players.length) grouped[pos] = players;
    });
    return (
      <div>
        <div style={{ fontSize:13, fontWeight:500, color, marginBottom:10, padding:"6px 10px", background:`${color}12`, borderRadius:8, border:`1px solid ${color}30` }}>{teamName}</div>
        {Object.entries(grouped).map(([pos, players]) => (
          <div key={pos} style={{ marginBottom:12 }}>
            <div style={{ fontSize:10, color, fontWeight:600, textTransform:"uppercase", letterSpacing:.8, marginBottom:6, paddingLeft:4 }}>{POSITION_LABEL[pos] || pos}</div>
            {players.map(p => {
              const goals = goalMap[p.id] || 0;
              const isScorer = goals > 0;
              return (
                <button key={p.id} onClick={() => setSelectedPlayer({ id: p.id, name: p.name })}
                  style={{
                    width:"100%", display:"flex", alignItems:"center", gap:8,
                    padding:"6px 8px", marginBottom:3,
                    background: isScorer
                      ? `linear-gradient(90deg, ${C.greenBg}, #F0FDF4)`
                      : C.panel,
                    border: `1px solid ${isScorer ? "#A7F3D0" : C.line}`,
                    borderRadius:8, cursor:"pointer", color:C.text, textAlign:"left",
                    transition:"background .1s",
                    boxShadow: "none",
                  }}
                  onMouseEnter={e => { if(!isScorer) e.currentTarget.style.background = C.panel2; }}
                  onMouseLeave={e => { if(!isScorer) e.currentTarget.style.background = C.panel; }}
                >
                  <span style={{ fontSize:10, color:C.dim, width:20, flexShrink:0, textAlign:"right", fontWeight:400 }}>{p.number ?? ""}</span>
                  {p.photo
                    ? <img src={p.photo} alt={p.name} width={20} height={20} style={{ borderRadius:"50%", objectFit:"cover", flexShrink:0, border: isScorer ? `1.5px solid ${C.green}` : "none" }} onError={e => { e.target.style.display="none"; e.target.nextSibling.style.display="grid"; }} />
                    : null
                  }
                  <div style={{ width:20, height:20, borderRadius:"50%", background: isScorer ? `${C.green}22` : C.panel2, border: isScorer ? `1px solid ${C.green}` : "none", display: p.photo ? "none" : "grid", placeItems:"center", fontSize:9, color: isScorer ? C.green : C.dim, flexShrink:0 }}>{(p.name||"?")[0]}</div>
                  <span style={{ flex:1, fontSize:12, fontWeight:400, color:C.text }}>{p.name}</span>
                  {/* Ballons de foot pour chaque but */}
                  {isScorer && (
                    <span style={{ display:"flex", gap:2 }}>
                      {Array.from({ length: goals }).map((_, i) => (
                        <span key={i} style={{ fontSize:13 }}>⚽</span>
                      ))}
                    </span>
                  )}
                  <span style={{ fontSize:10, color:C.muted }}>{p.age ?? ""}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  // ── Terrain SVG avec photos dans les bulles ────────────────
  const positionPlayers = (side, isHome) => {
    if (!side?.startXI?.length) return [];
    const players = side.startXI.filter(p => p.grid);
    const rows = {};
    players.forEach(p => {
      const [r, c] = p.grid.split(":").map(Number);
      if (!rows[r]) rows[r] = [];
      rows[r].push({ ...p, row:r, col:c });
    });
    const maxRow = Math.max(...Object.keys(rows).map(Number)) || 1;
    const result = [];
    Object.entries(rows).forEach(([rowNum, rPlayers]) => {
      const n = rPlayers.length;
      const frac = (Number(rowNum)-1) / Math.max(maxRow-1, 1);
      const y = isHome ? 515 - frac*215 : 55 + frac*215;
      rPlayers.sort((a,b)=>a.col-b.col).forEach((p,i) => {
        const x = 50 + (n===1 ? 0.5 : i/(n-1))*300;
        result.push({ ...p, x, y });
      });
    });
    return result;
  };

  const hasLineup = lineup?.home?.startXI?.length > 0 || lineup?.away?.startXI?.length > 0;
  const homePlayers = hasLineup ? positionPlayers(lineup.home, true)  : [];
  const awayPlayers = hasLineup ? positionPlayers(lineup.away, false) : [];

  return (
    <>
      {/* ── TERRAIN avec photos ── */}
      {hasLineup && (
        <div style={{ marginBottom:24 }}>
          {/* Légende */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8, padding:"8px 12px", background:C.panel, borderRadius:10, border:`1px solid ${C.line}` }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:12, height:12, borderRadius:"50%", background:C.accent }} />
              <span style={{ fontSize:12, fontWeight:600, color:C.accent }}>{lineup.home?.name}</span>
              <span style={{ fontSize:11, color:C.dim }}>{lineup.home?.formation}</span>
            </div>
            <span style={{ fontSize:10, color:C.muted }}>DOM ↓ · EXT ↑</span>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:11, color:C.dim }}>{lineup.away?.formation}</span>
              <span style={{ fontSize:12, fontWeight:600, color:C.blue }}>{lineup.away?.name}</span>
              <div style={{ width:12, height:12, borderRadius:"50%", background:C.blue }} />
            </div>
          </div>

          <svg viewBox="0 0 400 570" style={{ width:"100%", maxWidth:520, display:"block", margin:"0 auto" }}>
            {/* Terrain */}
            {[0,1,2,3,4,5,6,7].map(i => (
              <rect key={i} x="18" y={18+i*67} width="364" height="67" fill={i%2===0?"#2D8045":"#247038"}/>
            ))}
            <rect x="18" y="18" width="364" height="534" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="2"/>
            <line x1="18" y1="285" x2="382" y2="285" stroke="rgba(255,255,255,.6)" strokeWidth="1.5"/>
            <circle cx="200" cy="285" r="55" fill="none" stroke="rgba(255,255,255,.6)" strokeWidth="1.5"/>
            <circle cx="200" cy="285" r="3" fill="rgba(255,255,255,.8)"/>
            <rect x="98" y="454" width="204" height="98" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="1.5"/>
            <rect x="148" y="499" width="104" height="53" fill="none" stroke="rgba(255,255,255,.4)" strokeWidth="1"/>
            <rect x="172" y="548" width="56" height="10" fill="rgba(255,255,255,.2)" stroke="rgba(255,255,255,.5)" strokeWidth="1"/>
            <rect x="98" y="18" width="204" height="98" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="1.5"/>
            <rect x="148" y="18" width="104" height="53" fill="none" stroke="rgba(255,255,255,.4)" strokeWidth="1"/>
            <rect x="172" y="12" width="56" height="10" fill="rgba(255,255,255,.2)" stroke="rgba(255,255,255,.5)" strokeWidth="1"/>

            {/* Joueurs */}
            {[...awayPlayers.map(p=>({...p,color:C.blue})), ...homePlayers.map(p=>({...p,color:C.accent}))].map((p,i) => {
              const isScorer = (goalMap[p.id]||0) > 0;
              const goals    = goalMap[p.id] || 0;
              const short    = (p.name||"").split(" ").pop().slice(0,9);
              const uid      = `pb-${i}-${p.id}`;
              return (
                <g key={uid} transform={`translate(${p.x},${p.y})`} style={{ cursor:"pointer" }}
                   onClick={() => setSelectedPlayer({ id:p.id, name:p.name })}>
                  {isScorer && <circle r="25" fill="#22c55e" opacity="0.2"/>}
                  <defs>
                    <clipPath id={`cp-${uid}`}><circle r="19"/></clipPath>
                  </defs>
                  {/* Fond coloré */}
                  <circle r="20" fill={p.color} stroke="white" strokeWidth="2"
                    style={{ filter: isScorer ? `drop-shadow(0 0 8px #22c55e)` : "none" }}/>
                  {/* Photo ou numéro */}
                  {p.photo ? (
                    <image href={p.photo} x="-19" y="-19" width="38" height="38"
                      clipPath={`url(#cp-${uid})`} preserveAspectRatio="xMidYMid slice"
                      style={{ pointerEvents:"none" }}/>
                  ) : (
                    <text x="0" y="5" textAnchor="middle" fill="white" fontSize="12" fontWeight="800"
                      style={{ fontFamily:"sans-serif" }}>{p.number??""}</text>
                  )}
                  {/* Numéro sur photo */}
                  {p.photo && (
                    <>
                      <circle r="9" cx="13" cy="13" fill={p.color} opacity="0.9"/>
                      <text x="13" y="17" textAnchor="middle" fill="white" fontSize="8" fontWeight="800"
                        style={{ fontFamily:"sans-serif" }}>{p.number??""}</text>
                    </>
                  )}
                  {/* Nom */}
                  <text x="0" y="32" textAnchor="middle" fill="white" fontSize="8.5"
                    style={{ fontFamily:"sans-serif", textShadow:"0 1px 3px rgba(0,0,0,.9)" }}>{short}</text>
                  {/* Buts */}
                  {isScorer && (
                    <text x="16" y="-10" fontSize="12">{Array.from({length:goals}).fill("⚽").join("")}</text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {/* ── LISTE DES JOUEURS ── */}
      {!loading && !error && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
          <SquadColumn squad={squads.home} teamName={homeName} color={C.accent} />
          <SquadColumn squad={squads.away} teamName={awayName} color={C.blue}   />
        </div>
      )}

      {selectedPlayer && (
        <PlayerModal
          playerId={selectedPlayer.id}
          playerName={selectedPlayer.name}
          season={season}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </>
  );
}

// ============================================================
// CompetitionOverview — affiché quand aucun match n'est sélectionné
// ============================================================
function CompetitionOverview({ stored, fixtures, leagueFlag }) {
  const upcoming = fixtures.filter(f => f.status === "upcoming" || f.score == null);
  const past     = fixtures.filter(f => f.status !== "upcoming" && f.score != null);

  return (
    <div style={{ background:C.panel, borderRadius:14, border:`1px solid ${C.line}`, padding:"48px 24px", textAlign:"center" }}>
      {/* Logo de la ligue */}
      <div style={{ display:"flex", justifyContent:"center", marginBottom:0 }}>
        {stored?.leagueLogo ? (
          <img
            src={stored.leagueLogo}
            alt={stored.league || ""}
            width={80} height={80}
            style={{
              objectFit:"contain",
              width:80, height:80, borderRadius:20,
              background:C.panel2, border:`1px solid ${C.line}`,
              display:"flex", alignItems:"center", justifyContent:"center",
              margin:"0 auto 16px",
            }}
          />
        ) : (
          <div style={{
            width:80, height:80, borderRadius:20,
            background:C.panel2, border:`1px solid ${C.line}`,
            display:"flex", alignItems:"center", justifyContent:"center",
            margin:"0 auto 16px",
            fontSize:40,
          }}>{leagueFlag}</div>
        )}
      </div>

      {/* Nom de la ligue */}
      <div style={{ fontSize:22, fontWeight:500, color:C.text, marginBottom:6 }}>
        {stored?.league || "—"}
      </div>

      {/* Sous-titre */}
      <div style={{ fontSize:13, color:C.dim, marginBottom:28 }}>
        Sélectionne un match pour accéder à son analyse statistique
      </div>

      {/* Cards stats */}
      <div style={{ display:"flex", gap:16, marginTop:24, justifyContent:"center" }}>
        {/* Card À venir */}
        <div style={{ background:C.accentBg, border:`1px solid #B3D9F2`, borderRadius:12, padding:"14px 28px", minWidth:100 }}>
          <div style={{ fontSize:26, fontWeight:500, color:C.accent }}>{upcoming.length}</div>
          <div style={{ fontSize:11, color:C.dim, marginTop:4 }}>À venir</div>
        </div>

        {/* Card Résultats */}
        <div style={{ background:C.panel2, border:`1px solid ${C.line}`, borderRadius:12, padding:"14px 28px", minWidth:100 }}>
          <div style={{ fontSize:26, fontWeight:500, color:C.text }}>{past.length}</div>
          <div style={{ fontSize:11, color:C.dim, marginTop:4 }}>Résultats passés</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Onglet : Formation sur terrain SVG
// ============================================================
function FootballPitch({ children }) {
  return (
    <svg viewBox="0 0 400 570" style={{ width:"100%", maxWidth:480, display:"block", margin:"0 auto" }}>
      {/* Bandes alternées */}
      {[0,1,2,3,4,5,6,7].map(i => (
        <rect key={i} x="18" y={18+i*67} width="364" height="67" fill={i%2===0?"#2D8045":"#247038"}/>
      ))}
      {/* Bordure */}
      <rect x="18" y="18" width="364" height="534" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="2"/>
      {/* Ligne médiane */}
      <line x1="18" y1="285" x2="382" y2="285" stroke="rgba(255,255,255,.6)" strokeWidth="1.5"/>
      {/* Cercle central */}
      <circle cx="200" cy="285" r="55" fill="none" stroke="rgba(255,255,255,.6)" strokeWidth="1.5"/>
      <circle cx="200" cy="285" r="3" fill="rgba(255,255,255,.8)"/>
      {/* Surface de réparation dom (bas) */}
      <rect x="98" y="454" width="204" height="98" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="1.5"/>
      <rect x="148" y="499" width="104" height="53" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="1"/>
      <rect x="172" y="548" width="56" height="10" fill="rgba(255,255,255,.25)" stroke="rgba(255,255,255,.5)" strokeWidth="1"/>
      <circle cx="200" cy="484" r="4" fill="rgba(255,255,255,.5)"/>
      <path d="M168,454 A40,40 0 0,1 232,454" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="1"/>
      {/* Surface de réparation ext (haut) */}
      <rect x="98" y="18" width="204" height="98" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="1.5"/>
      <rect x="148" y="18" width="104" height="53" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="1"/>
      <rect x="172" y="12" width="56" height="10" fill="rgba(255,255,255,.25)" stroke="rgba(255,255,255,.5)" strokeWidth="1"/>
      <circle cx="200" cy="86" r="4" fill="rgba(255,255,255,.5)"/>
      <path d="M168,116 A40,40 0 0,0 232,116" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="1"/>
      {children}
    </svg>
  );
}

function TabFormation({ fixtureId, homeColor, awayColor, goalMap = {} }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    if (!fixtureId) return;
    setLoading(true); setError(""); setData(null);
    fetchLineup(fixtureId)
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [fixtureId]);

  if (loading) return <InfoPanel>Chargement de la formation…</InfoPanel>;
  if (error)   return <InfoPanel tone="error">{error}</InfoPanel>;
  if (!data?.home && !data?.away) return (
    <InfoPanel>Formation non disponible — les données de compo ne sont publiées qu'après le coup d'envoi.</InfoPanel>
  );

  // Positionne les joueurs sur le terrain
  function positionPlayers(side, isHome) {
    if (!side?.startXI?.length) return [];
    const players = side.startXI.filter(p => p.grid);
    const rows = {};
    players.forEach(p => {
      const [r, c] = p.grid.split(":").map(Number);
      if (!rows[r]) rows[r] = [];
      rows[r].push({ ...p, row: r, col: c });
    });
    const maxRow = Math.max(...Object.keys(rows).map(Number)) || 1;
    const result = [];
    Object.entries(rows).forEach(([rowNum, rPlayers]) => {
      const n = rPlayers.length;
      const frac = (Number(rowNum) - 1) / Math.max(maxRow - 1, 1);
      // Home: GK en bas (y≈515), attaque vers haut (y≈300)
      // Away: GK en haut (y≈55), attaque vers bas (y≈265)
      const y = isHome ? 515 - frac * 215 : 55 + frac * 215;
      rPlayers
        .sort((a, b) => a.col - b.col)
        .forEach((p, i) => {
          const xFrac = n === 1 ? 0.5 : i / (n - 1);
          const x = 50 + xFrac * 300;
          result.push({ ...p, x, y });
        });
    });
    return result;
  }

  const PITCH_W = 400;
  const homePlayers = positionPlayers(data.home, true);
  const awayPlayers = positionPlayers(data.away, false);
  const hColor = homeColor || "#f97316";
  const aColor = awayColor || "#3b82f6";

  const PlayerBubble = ({ p, color }) => {
    const isScorer = goalMap[p.id] > 0;
    const goals    = goalMap[p.id] || 0;
    const shortName = (p.name || "").split(" ").pop().slice(0, 9);
    return (
      <g transform={`translate(${p.x},${p.y})`}>
        {isScorer && (
          <circle r="24" fill={`${C.green}`} opacity="0.25"/>
        )}
        <circle r="18" fill={color} stroke="white" strokeWidth="1.8"
          style={{ filter: isScorer ? `drop-shadow(0 0 6px ${C.green})` : "none" }}/>
        <text x="0" y="5" textAnchor="middle" fill="white" fontSize="11" fontWeight="800"
              style={{ fontFamily:"sans-serif" }}>
          {p.number ?? ""}
        </text>
        <text x="0" y="29" textAnchor="middle" fill="white" fontSize="8.5"
              style={{ fontFamily:"sans-serif", textShadow:"0 1px 3px rgba(0,0,0,.9)" }}>
          {shortName}
        </text>
        {isScorer && (
          <text x={14} y={-10} fontSize="13">{Array.from({length:goals}).map(()=>"⚽").join("")}</text>
        )}
      </g>
    );
  };

  return (
    <div>
      {/* Légende formations */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10, padding:"8px 12px", background:C.panel, borderRadius:10, border:`1px solid ${C.line}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:14, height:14, borderRadius:"50%", background:hColor }} />
          <span style={{ fontSize:13, fontWeight:700, color:hColor }}>{data.home?.name}</span>
          <span style={{ fontSize:12, color:C.dim }}>{data.home?.formation}</span>
        </div>
        <span style={{ fontSize:11, color:C.muted }}>DOM ↓ · EXT ↑</span>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:12, color:C.dim }}>{data.away?.formation}</span>
          <span style={{ fontSize:13, fontWeight:700, color:aColor }}>{data.away?.name}</span>
          <div style={{ width:14, height:14, borderRadius:"50%", background:aColor }} />
        </div>
      </div>

      <FootballPitch>
        {awayPlayers.map((p, i) => <PlayerBubble key={`a${i}`} p={p} color={aColor} />)}
        {homePlayers.map((p, i) => <PlayerBubble key={`h${i}`} p={p} color={hColor} />)}
      </FootballPitch>
    </div>
  );
}

// ============================================================
// Colonne publicitaire droite
// ============================================================
function AdUnit({ height, label }) {
  return (
    <div style={{
      width:"100%", height,
      background:C.panel,
      border:`1px solid ${C.line}`,
      borderRadius:10,
      display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      gap:6,
      position:"relative", overflow:"hidden",
    }}>
      {/* Motif de fond subtil */}
      <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", opacity:.04 }} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id={`grid-${height}`} width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#032D60" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#grid-${height})`}/>
      </svg>
      <div style={{ fontSize:9, color:C.muted, textTransform:"uppercase", letterSpacing:1.8, fontWeight:500 }}>Publicité</div>
      <div style={{ fontSize:10, color:C.line, fontWeight:400 }}>{label}</div>
    </div>
  );
}

function AdColumn() {
  return (
    <div style={{
      width:260, flexShrink:0,
      borderLeft:`1px solid ${C.line}`,
      background:C.bg,
      overflowY:"auto",
      padding:"20px 14px",
      display:"flex", flexDirection:"column",
      gap:14,
      scrollbarWidth:"none",
    }}>
      {/* Label section */}
      <div style={{ fontSize:9, color:C.muted, textTransform:"uppercase", letterSpacing:1.5, fontWeight:500, textAlign:"center", paddingBottom:4, borderBottom:`1px solid ${C.line}` }}>
        Espaces publicitaires
      </div>

      {/* Format Leaderboard */}
      <AdUnit height={200} label="260 × 200" />

      {/* Format Medium Rectangle */}
      <AdUnit height={280} label="260 × 280" />

      {/* Format Half Page */}
      <AdUnit height={360} label="260 × 360" />

      {/* Format Skyscraper */}
      <AdUnit height={260} label="260 × 260" />
    </div>
  );
}

// ============================================================
// Bracket de tournoi — style tableur tournament
// ============================================================

// Génère les années valides pour une compétition à cycle fixe
function cyclicSeasons(lastYear, interval, count = 8) {
  return Array.from({ length: count }, (_, i) => lastYear - i * interval);
}

const BRACKET_GROUPS = [
  { label:"🏆 Europe", items:[
    { id:"ucl",     apiId:2,   name:"Champions League", flag:"🏆" },
    { id:"uel",     apiId:3,   name:"Europa League",    flag:"🟠" },
    { id:"uecl",    apiId:848, name:"Conf. League",     flag:"🟢" },
  ]},
  { label:"🌍 Sélections", items:[
    // Coupe du Monde : cycle 2022, tous les 4 ans (2026 est à venir)
    { id:"wc",   apiId:1, name:"Coupe du Monde", flag:"🌍",
      defaultSeason:2022,
      validSeasons:[2022,2018,2014,2010,2006,2002,1998,1994,1990,1986,1982,1978,1974,1970,1966,1962,1958,1954,1950,1938,1934,1930],
    },
    // Euro : cycle 2020 (joué en 2021 cause COVID), tous les 4 ans
    { id:"euro", apiId:4, name:"Euro", flag:"🇪🇺",
      defaultSeason:2024,
      validSeasons:[2024,2020,2016,2012,2008,2004,2000,1996,1992,1988,1984,1980,1976,1972,1968,1964,1960],
    },
    // Copa América : irrégulière — récentes toutes les 2-4 ans
    { id:"copa", apiId:9, name:"Copa América", flag:"🌎",
      defaultSeason:2024,
      validSeasons:[2024,2021,2019,2016,2015,2011,2007,2004,2001,1999,1997,1995,1993,1991,1989,1987,1983,1979,1975,1967,1963,1959,1956,1955,1953,1949],
    },
    // CAN : anciennement tous les 2 ans, maintenant tous les 2 ans décalés
    { id:"can",  apiId:6, name:"CAN", flag:"🌍",
      defaultSeason:2023,
      validSeasons:[2023,2021,2019,2017,2015,2013,2012,2010,2008,2006,2004,2002,2000,1998,1996,1994,1992,1990,1988,1986,1984,1982,1980,1978,1976,1974,1972,1970,1968,1965,1963,1962,1959,1957],
    },
  ]},
  { label:"🇫🇷 France", items:[
    { id:"fr_cup",  apiId:65,  name:"Coupe de France",  flag:"🇫🇷", season:null },
    { id:"fr_lc",   apiId:66,  name:"Coupe Ligue",      flag:"🇫🇷", season:null },
  ]},
  { label:"🏴 Angleterre", items:[
    { id:"fa_cup",  apiId:45,  name:"FA Cup",           flag:"🏴", season:null },
    { id:"lc_eng",  apiId:48,  name:"League Cup",       flag:"🏴", season:null },
  ]},
  { label:"🇩🇪 Allemagne", items:[
    { id:"dfb",     apiId:81,  name:"DFB Pokal",        flag:"🇩🇪", season:null },
  ]},
  { label:"🇪🇸 Espagne", items:[
    { id:"copa_rey",apiId:143, name:"Copa del Rey",     flag:"🇪🇸", season:null },
  ]},
  { label:"🇮🇹 Italie", items:[
    { id:"coppa",   apiId:137, name:"Coppa Italia",     flag:"🇮🇹", season:null },
  ]},
  { label:"🇵🇹 Portugal", items:[
    { id:"taca",    apiId:96,  name:"Taça Portugal",    flag:"🇵🇹", season:null },
  ]},
  { label:"🌎 Amériques", items:[
    { id:"lib",     apiId:11,  name:"Copa Libertadores",flag:"🌎", season:null },
    { id:"suda",    apiId:13,  name:"Copa Sudamericana",flag:"🌎", season:null },
  ]},
];
const BRACKET_COMPS = BRACKET_GROUPS.flatMap(g => g.items);

// Couleurs propres au bracket (fond sombre navy)
const BC = {
  bg:      "#0A1628",
  section: "#0D1F35",
  card:    "#1a2740",
  border:  "#1e3a5f",
  textHi:  "#FFFFFF",
  textDim: "#4A6B8A",
  textNorm:"#E2E8F0",
  accent:  "#0176D3",
  header:  "#9FC3E9",
  line:    "#1e3a5f",
};

function BracketMatchCard({ tie, compact }) {
  const { home, away, score, winner, isAgg } = tie;
  const homeWon = winner?.id === home.id;
  const awayWon = winner?.id === away.id;
  const homeScore = score ? score.split(" - ")[0] : null;
  const awayScore = score ? score.split(" - ")[1] : null;
  const logoSz = compact ? 15 : 18;
  const fs     = compact ? 11 : 12;
  const pad    = compact ? "5px 10px" : "8px 12px";

  const TeamRow = ({ team, goals, won, bottom }) => (
    <div style={{
      display:"flex", alignItems:"center", gap:6,
      padding: bottom ? "4px 0 0" : "0 0 4px",
      borderBottom: !bottom ? `0.5px solid ${BC.border}` : "none",
    }}>
      {team.logo
        ? <img src={team.logo} width={logoSz} height={logoSz} style={{ objectFit:"contain", flexShrink:0 }} onError={e=>e.target.style.display="none"} />
        : <div style={{ width:logoSz, height:logoSz, borderRadius:"50%", background:BC.border, display:"grid", placeItems:"center", fontSize:7, color:BC.textDim, flexShrink:0 }}>{(team.name||"?")[0]}</div>
      }
      <span style={{ flex:1, fontSize:fs, fontWeight:won?600:400, color:won?BC.textHi:BC.textDim, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
        {team.name}
      </span>
      {goals != null && (
        <span style={{ fontSize:fs, fontWeight:won?700:400, color:won?BC.accent:BC.textDim, flexShrink:0, minWidth:14, textAlign:"right" }}>{goals}</span>
      )}
    </div>
  );

  return (
    <div style={{
      background: BC.card,
      border:`1px solid ${BC.border}`,
      borderLeft:`2px solid ${winner ? BC.accent : BC.border}`,
      borderRadius:6, padding:pad, width:"100%", boxSizing:"border-box",
    }}>
      <TeamRow team={home} goals={homeScore} won={homeWon} />
      <TeamRow team={away} goals={awayScore} won={awayWon} bottom />
      {!score && (
        <div style={{ fontSize:8, color:BC.textDim, textAlign:"center", marginTop:3 }}>
          {tie.date ? new Date(tie.date).toLocaleDateString("fr-FR",{day:"numeric",month:"short"}) : "À venir"}
        </div>
      )}
      {isAgg && score && (
        <div style={{ fontSize:8, color:BC.textDim+"88", textAlign:"right" }}>agg.</div>
      )}
    </div>
  );
}

// ============================================================
// Vue Favoris — clubs suivis avec feed IA
// ============================================================
function FavoriteClubCard({ club, onRemove }) {
  const [feed,    setFeed]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!club.id) return;
    fetchClubFeed(club.id)
      .then(d => { setFeed(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [club.id]);

  const lastResult = feed?.pastResults?.[0];
  const nextMatch  = feed?.upcomingMatches?.[0];

  const formPills = (feed?.pastResults || []).slice(0,5).map(f => {
    const teamIsHome = f.home.id === club.id;
    if (teamIsHome) return f.home.winner ? "W" : f.away.winner ? "L" : "D";
    return f.away.winner ? "W" : f.home.winner ? "L" : "D";
  });

  return (
    <div style={{ background:C.panel, border:`1px solid ${C.line}`, borderRadius:14, overflow:"hidden", marginBottom:16 }}>
      {/* Header club */}
      <div style={{ padding:"14px 18px", display:"flex", alignItems:"center", gap:12, borderBottom:`1px solid ${C.line}` }}>
        <TeamLogo url={club.logo||""} size={40} name={club.name} />
        <div style={{ flex:1 }}>
          <div style={{ fontSize:15, fontWeight:700, color:C.text }}>{club.name}</div>
          <div style={{ fontSize:11, color:C.dim }}>{club.leagueName}</div>
        </div>
        {/* Forme */}
        <div style={{ display:"flex", gap:3 }}>
          {formPills.map((r,i) => (
            <span key={i} style={{ width:20, height:20, borderRadius:4, display:"grid", placeItems:"center", fontSize:9, fontWeight:700,
              background: r==="W"?"#16a34a":r==="L"?"#dc2626":"#d97706", color:"#fff" }}>{r}</span>
          ))}
        </div>
        {/* Supprimer favori */}
        <button onClick={() => onRemove(club.id)} style={{ background:"none", border:`1px solid ${C.line}`, borderRadius:8, padding:"5px 10px", cursor:"pointer", fontSize:11, color:C.muted }}>
          ✕ Retirer
        </button>
      </div>

      {loading && <div style={{ padding:"16px 18px", color:C.dim, fontSize:12 }}>⏳ Chargement des données…</div>}
      {error   && <div style={{ padding:"12px 18px", color:"#ef4444", fontSize:12 }}>{error}</div>}

      {feed && !loading && (
        <div style={{ padding:"14px 18px" }}>
          {/* Résultats récents + prochain match */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
            {/* Dernier résultat */}
            {lastResult && (
              <div style={{ background:C.panel2, borderRadius:10, padding:"10px 12px" }}>
                <div style={{ fontSize:9, color:C.muted, textTransform:"uppercase", letterSpacing:.8, marginBottom:6 }}>Dernier match</div>
                <div style={{ fontSize:11, color:C.dim, marginBottom:4 }}>{new Date(lastResult.date).toLocaleDateString("fr-FR",{day:"numeric",month:"short"})}</div>
                <div style={{ fontSize:13, fontWeight:700, color:C.text }}>
                  {lastResult.home.name} <span style={{ color:C.accent }}>{lastResult.score}</span> {lastResult.away.name}
                </div>
                <div style={{ fontSize:10, color:C.dim, marginTop:3 }}>{lastResult.league}</div>
              </div>
            )}
            {/* Prochain match */}
            {nextMatch ? (
              <div style={{ background:`${C.blue}0a`, border:`1px solid ${C.blue}33`, borderRadius:10, padding:"10px 12px" }}>
                <div style={{ fontSize:9, color:C.blue, textTransform:"uppercase", letterSpacing:.8, marginBottom:6 }}>Prochain match</div>
                <div style={{ fontSize:11, color:C.dim, marginBottom:4 }}>
                  {new Date(nextMatch.date).toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"})} · {new Date(nextMatch.date).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}
                </div>
                <div style={{ fontSize:13, fontWeight:700, color:C.text }}>
                  {nextMatch.home.name} <span style={{ color:C.muted, fontWeight:400 }}>vs</span> {nextMatch.away.name}
                </div>
                <div style={{ fontSize:10, color:C.dim, marginTop:3 }}>{nextMatch.league}</div>
              </div>
            ) : (
              <div style={{ background:C.panel2, borderRadius:10, padding:"10px 12px", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <span style={{ fontSize:11, color:C.muted }}>Aucun match à venir</span>
              </div>
            )}
          </div>

          {/* Transferts récents */}
          {feed.recentTransfers?.length > 0 && (
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:10, color:C.dim, fontWeight:700, textTransform:"uppercase", letterSpacing:.8, marginBottom:8 }}>🔄 Transferts récents</div>
              <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                {feed.recentTransfers.slice(0,4).map((t,i) => {
                  const isIn = t.teamIn.name === club.name || t.teamIn.name?.toLowerCase().includes(club.name?.toLowerCase()?.split(" ")[0]||"");
                  return (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:8, fontSize:11, color:C.dim }}>
                      <span style={{ color: isIn ? C.green : "#ef4444", fontWeight:700, width:14 }}>{isIn ? "↓" : "↑"}</span>
                      <span style={{ color:C.text }}>{isIn ? t.teamOut.name : t.teamIn.name}</span>
                      <span style={{ marginLeft:"auto", background: t.type?.toLowerCase().includes("loan") ? "#d97706"+"18" : C.panel2, color: t.type?.toLowerCase().includes("loan") ? "#d97706" : C.dim, borderRadius:4, padding:"1px 6px", fontSize:9, fontWeight:600 }}>
                        {t.type?.toLowerCase().includes("loan") ? "Prêt" : "Transfert"}
                      </span>
                      {t.fee && <span style={{ color:C.accent, fontWeight:600 }}>{t.fee}</span>}
                      <span style={{ color:C.muted, fontSize:9 }}>{t.date?.slice(0,7)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Résumé IA */}
          {feed.aiSummary && (
            <div>
              <button onClick={() => setExpanded(e=>!e)} style={{
                width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between",
                background:"none", border:`1px solid ${C.line}`, borderRadius:8, padding:"8px 12px",
                cursor:"pointer", marginBottom: expanded ? 10 : 0,
              }}>
                <span style={{ fontSize:11, fontWeight:600, color:C.text }}>🤖 Analyse IA — actualités & contexte</span>
                <span style={{ color:C.muted, fontSize:12 }}>{expanded ? "▴" : "▾"}</span>
              </button>
              {expanded && (
                <div style={{ background:C.panel2, borderRadius:8, padding:"12px 14px", fontSize:12, color:C.dim, lineHeight:1.7, whiteSpace:"pre-wrap" }}>
                  {feed.aiSummary}
                  <div style={{ marginTop:10, fontSize:9, color:C.muted, borderTop:`1px solid ${C.line}`, paddingTop:8 }}>
                    Généré par IA (Groq llama-3.3-70b) · Données jusqu'à la connaissance de l'IA · Vérifier les informations récentes
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FavoritesView({ favorites, onToggleFavorite }) {
  const [notifPermission, setNotifPermission] = useState(
    "Notification" in window ? Notification.permission : "denied"
  );

  async function requestNotifications() {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    if (perm === "granted") {
      new Notification("⭐ EdgeStat Notifications activées", {
        body: "Vous recevrez des alertes 24h, 1h et 5min avant les matchs de vos clubs favoris.",
        icon: "/favicon.ico",
      });
    }
  }

  return (
    <div style={{ padding:"20px 24px" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
        <span style={{ fontSize:24 }}>⭐</span>
        <div>
          <div style={{ fontSize:18, fontWeight:700, color:C.text }}>Mes clubs favoris</div>
          <div style={{ fontSize:12, color:C.dim }}>
            {favorites.length} club{favorites.length !== 1 ? "s" : ""} suivi{favorites.length !== 1 ? "s" : ""}
          </div>
        </div>
        <div style={{ flex:1 }} />
        {/* Bouton notifications */}
        {notifPermission !== "granted" && (
          <button onClick={requestNotifications} style={{
            background:`${C.accent}18`, border:`1px solid ${C.accent}44`, borderRadius:8,
            padding:"8px 14px", cursor:"pointer", fontSize:12, fontWeight:600, color:C.accent,
            display:"flex", alignItems:"center", gap:6,
          }}>
            🔔 Activer les notifications
          </button>
        )}
        {notifPermission === "granted" && (
          <div style={{ background:"#D1FAE5", border:"1px solid #A7F3D0", borderRadius:8, padding:"6px 12px", fontSize:11, color:"#065F46", fontWeight:600 }}>
            🔔 Notifications actives
          </div>
        )}
      </div>

      {favorites.length === 0 ? (
        <div style={{ background:C.panel, border:`1px solid ${C.line}`, borderRadius:14, padding:"48px 24px", textAlign:"center" }}>
          <div style={{ fontSize:48, marginBottom:12 }}>⭐</div>
          <div style={{ fontSize:16, fontWeight:600, color:C.text, marginBottom:8 }}>Aucun club favori</div>
          <div style={{ fontSize:13, color:C.dim, maxWidth:400, margin:"0 auto", lineHeight:1.6 }}>
            Clique sur l'étoile ☆ à côté d'un club dans la page de match pour l'ajouter ici.<br/>
            Tu peux aussi chercher un club avec la loupe en haut de la sidebar.
          </div>
        </div>
      ) : (
        favorites.map(club => (
          <FavoriteClubCard
            key={club.id}
            club={club}
            onRemove={id => onToggleFavorite({ id })}
          />
        ))
      )}
    </div>
  );
}

function BracketView() {
  const [selComp, setSelComp] = useState(BRACKET_COMPS[0]);
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [season,  setSeason]  = useState(null);
  const [zoom,    setZoom]    = useState(0.85); // zoom pour adapter la taille

  useEffect(() => {
    if (!selComp) return;
    setData(null); setError(""); setLoading(true);
    const now = new Date();
    // Utiliser la saison fixe si définie sur la compétition, sinon saison courante
    // Priorité : saison choisie → defaultSeason (compétitions cycliques) → saison courante
    const defaultSeason = selComp.defaultSeason || selComp.validSeasons?.[0] || selComp.season
      || (now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear()-1);
    const s = season || defaultSeason;
    fetchBracket(selComp.apiId, s)
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [selComp, season]);

  const CARD_W = 190;
  const CARD_H = 68;
  const GAP    = 12;
  const COL_W  = CARD_W + 24;
  const CONN_W = 32;

  const maxTies = data?.rounds?.[0]?.ties?.length || 1;
  const totalH  = Math.max(maxTies, 1) * (CARD_H + GAP);

  return (
    <div style={{ background:BC.bg, height:"100%", display:"flex", flexDirection:"column", color:BC.textNorm, fontFamily:"'Inter','DM Sans',sans-serif" }}>

      {/* ── Barre de navigation compétitions ── */}
      <div style={{ background:BC.section, borderBottom:`1px solid ${BC.border}`, flexShrink:0 }}>
        {/* Groupes de compétitions */}
        <div style={{ overflowX:"auto", scrollbarWidth:"none", display:"flex", padding:"8px 16px", gap:4 }}>
          {BRACKET_GROUPS.map(group => (
            <div key={group.label} style={{ display:"flex", alignItems:"center", gap:2, flexShrink:0 }}>
              <span style={{ fontSize:9, color:BC.textDim, letterSpacing:.5, padding:"0 6px", whiteSpace:"nowrap" }}>{group.label}</span>
              {group.items.map(c => (
                <button key={c.id} onClick={() => { setSelComp(c); setSeason(null); }} style={{
                  background: selComp.id===c.id ? BC.accent : "transparent",
                  border:`1px solid ${selComp.id===c.id ? BC.accent : BC.border}`,
                  borderRadius:20, padding:"4px 11px", cursor:"pointer",
                  fontSize:11, fontWeight:600, color:selComp.id===c.id?"#fff":BC.textDim,
                  display:"flex", alignItems:"center", gap:5, whiteSpace:"nowrap",
                  transition:"all .15s",
                }}>
                  <span style={{ fontSize:12 }}>{c.flag}</span>{c.name}
                  {c.season && <span style={{ fontSize:9, opacity:.7 }}>{c.season}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Sous-barre : saison + zoom */}
        <div style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 16px 10px", borderTop:`1px solid ${BC.border}44` }}>
          <span style={{ fontSize:11, color:BC.textDim, fontWeight:600 }}>{selComp.flag} {selComp.name}</span>

          {/* Sélecteur de saison : validSeasons si défini, sinon logique annuelle */}
          <div style={{ display:"flex", gap:3, marginLeft:8, overflowX:"auto", maxWidth:340, scrollbarWidth:"none" }}>
            {(() => {
              if (selComp.validSeasons) {
                // Compétition cyclique : afficher toutes les années valides (jusqu'à 12)
                const currentS = season || selComp.defaultSeason || selComp.validSeasons[0];
                return selComp.validSeasons.slice(0, 12).map(s => (
                  <button key={s} onClick={() => setSeason(s)} style={{
                    background: currentS===s ? BC.accent+"33" : "none",
                    border:`1px solid ${currentS===s ? BC.accent : BC.border}`,
                    borderRadius:5, padding:"3px 9px", cursor:"pointer", flexShrink:0,
                    fontSize:10, color: currentS===s ? BC.accent : BC.textDim,
                    fontWeight: currentS===s ? 700 : 400,
                  }}>{s}</button>
                ));
              }
              // Compétition annuelle : 3 dernières saisons
              const b = new Date().getMonth()>=6 ? new Date().getFullYear() : new Date().getFullYear()-1;
              const currentS = season || b;
              return [b, b-1, b-2, b-3].map(s => (
                <button key={s} onClick={() => setSeason(s)} style={{
                  background: currentS===s ? BC.accent+"33" : "none",
                  border:`1px solid ${currentS===s ? BC.accent : BC.border}`,
                  borderRadius:5, padding:"3px 9px", cursor:"pointer", flexShrink:0,
                  fontSize:10, color: currentS===s ? BC.accent : BC.textDim,
                  fontWeight: currentS===s ? 700 : 400,
                }}>{s}-{s+1}</button>
              ));
            })()}
          </div>

          <div style={{ flex:1 }} />
          {/* Contrôles zoom */}
          <span style={{ fontSize:10, color:BC.textDim }}>Zoom</span>
          {[0.6, 0.75, 0.9, 1.0].map(z => (
            <button key={z} onClick={() => setZoom(z)} style={{
              background: zoom===z ? BC.accent+"33" : "none",
              border:`1px solid ${zoom===z ? BC.accent : BC.border}`,
              borderRadius:5, padding:"2px 8px", cursor:"pointer",
              fontSize:10, color: zoom===z ? BC.accent : BC.textDim,
            }}>{Math.round(z*100)}%</button>
          ))}
        </div>
      </div>

      {/* ── Zone bracket scrollable ── */}
      <div style={{ flex:1, overflow:"auto", scrollbarColor:`${BC.border} transparent`, scrollbarWidth:"thin" }}>
        {loading && (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:300, color:BC.textDim, fontSize:13 }}>
            ⏳ Chargement du bracket…
          </div>
        )}
        {error && <div style={{ padding:20, color:"#ef4444", fontSize:13 }}>{error}</div>}

        {data && !loading && data.rounds.length === 0 && (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:200, color:BC.textDim, fontSize:13 }}>
            Aucune donnée de bracket disponible pour cette saison.
          </div>
        )}

        {data && !loading && data.rounds.length > 0 && (
          <div style={{ padding:"20px", transformOrigin:"top left", transform:`scale(${zoom})`, width:`${100/zoom}%` }}>
            <div style={{ display:"flex", gap:0, alignItems:"flex-start" }}>
              {data.rounds.map((round, rIdx) => {
                const ties = round.ties;
                const colH  = Math.max(maxTies, ties.length) * (CARD_H + GAP);
                const slotH = colH / ties.length;

                return (
                  <div key={round.key} style={{ display:"flex", alignItems:"flex-start" }}>
                    {/* Colonne round */}
                    <div style={{ width:COL_W, flexShrink:0 }}>
                      {/* Header */}
                      <div style={{ fontSize:9, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", color:BC.header, textAlign:"center", marginBottom:12, height:18 }}>
                        {round.label}
                      </div>
                      {/* Cartes */}
                      <div style={{ position:"relative", height:colH }}>
                        {ties.map((tie, tIdx) => {
                          const y = tIdx * slotH + (slotH - CARD_H) / 2;
                          return (
                            <div key={tie.id||tIdx} style={{ position:"absolute", top:y, left:12, right:12 }}>
                              <BracketMatchCard tie={tie} compact />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Connecteur SVG */}
                    {rIdx < data.rounds.length - 1 && (() => {
                      const nextTies = data.rounds[rIdx+1].ties;
                      const nextColH = Math.max(maxTies, nextTies.length) * (CARD_H + GAP);
                      const nextSlotH = nextColH / nextTies.length;
                      const svgH = Math.max(colH, nextColH) + 30;

                      return (
                        <svg width={CONN_W} height={svgH} style={{ flexShrink:0, marginTop:30 }} overflow="visible">
                          {nextTies.map((_, nIdx) => {
                            const ratio = ties.length / nextTies.length;
                            const srcA = Math.floor(nIdx * ratio);
                            const srcB = Math.min(Math.ceil((nIdx + 1) * ratio) - 1, ties.length - 1);
                            const slotHCur = colH / ties.length;
                            const yA = srcA * slotHCur + slotHCur / 2;
                            const yB = srcB * slotHCur + slotHCur / 2;
                            const yMid = (yA + yB) / 2;
                            const yNext = nIdx * nextSlotH + nextSlotH / 2;
                            const mid = CONN_W / 2;

                            return (
                              <g key={nIdx}>
                                <line x1={0} y1={yA} x2={mid} y2={yA} stroke={BC.line} strokeWidth="1"/>
                                {srcB !== srcA && <line x1={0} y1={yB} x2={mid} y2={yB} stroke={BC.line} strokeWidth="1"/>}
                                {srcB !== srcA && <line x1={mid} y1={yA} x2={mid} y2={yB} stroke={BC.line} strokeWidth="1"/>}
                                <line x1={mid} y1={yMid} x2={CONN_W} y2={yNext} stroke={BC.line} strokeWidth="1"/>
                              </g>
                            );
                          })}
                        </svg>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// HomeView — page d'accueil avec matchs en direct et à venir
// ============================================================
// Compétitions "prestige" pour la section "Grosses affiches"
// ============================================================
// Histoire du Foot — catalogue de compétitions historiques
// ============================================================
// finalYear:true = la clé dans les données = année de la FINALE
//   (ex: 2017 = Real Madrid vs Juventus 4-1, finale jouée en juin 2017)
//   L'API est appelée avec season=année-1 pour s'aligner
// finalYear absent/false = la clé = année de DÉBUT de saison (ex: ligues)
const HISTORY_CATALOG = [
  { cat:"🏆 Compétitions européennes", items:[
    { apiId:2,   name:"UEFA Champions League",    flag:"🏆", finalYear:true },
    { apiId:3,   name:"UEFA Europa League",       flag:"🟠", finalYear:true },
    { apiId:848, name:"UEFA Conference League",   flag:"🟢", finalYear:true },
    { apiId:530, name:"UEFA Cup (ancienne UEL)",  flag:"🔵", finalYear:true },
  ]},
  { cat:"🇫🇷 France", items:[
    { apiId:61,  name:"Ligue 1",           flag:"🇫🇷" },
    { apiId:62,  name:"Ligue 2",           flag:"🇫🇷" },
    { apiId:65,  name:"Coupe de France",   flag:"🇫🇷", finalYear:true },
    { apiId:66,  name:"Coupe de la Ligue", flag:"🇫🇷", finalYear:true },
  ]},
  { cat:"🏴 Angleterre", items:[
    { apiId:39,  name:"Premier League",  flag:"🏴" },
    { apiId:40,  name:"Championship",   flag:"🏴" },
    { apiId:45,  name:"FA Cup",         flag:"🏴", finalYear:true },
    { apiId:48,  name:"League Cup",     flag:"🏴", finalYear:true },
  ]},
  { cat:"🇩🇪 Allemagne", items:[
    { apiId:78,  name:"Bundesliga",     flag:"🇩🇪" },
    { apiId:79,  name:"2. Bundesliga",  flag:"🇩🇪" },
    { apiId:81,  name:"DFB Pokal",      flag:"🇩🇪", finalYear:true },
  ]},
  { cat:"🇪🇸 Espagne", items:[
    { apiId:140, name:"La Liga",        flag:"🇪🇸" },
    { apiId:141, name:"La Liga 2",      flag:"🇪🇸" },
    { apiId:143, name:"Copa del Rey",   flag:"🇪🇸", finalYear:true },
  ]},
  { cat:"🇮🇹 Italie", items:[
    { apiId:135, name:"Serie A",        flag:"🇮🇹" },
    { apiId:136, name:"Serie B",        flag:"🇮🇹" },
    { apiId:137, name:"Coppa Italia",   flag:"🇮🇹", finalYear:true },
  ]},
  { cat:"🇵🇹 Portugal", items:[
    { apiId:94,  name:"Primeira Liga",  flag:"🇵🇹" },
    { apiId:96,  name:"Taça Portugal",  flag:"🇵🇹", finalYear:true },
  ]},
  { cat:"🌍 Équipes nationales", items:[
    { apiId:1,   name:"FIFA World Cup",          flag:"🌍" },
    { apiId:4,   name:"UEFA Euro",               flag:"🇪🇺" },
    { apiId:5,   name:"UEFA Nations League",     flag:"🏅" },
    { apiId:9,   name:"Copa América",            flag:"🌎" },
    { apiId:6,   name:"Coupe d'Afrique (CAN)",   flag:"🌍" },
    { apiId:22,  name:"Club World Cup",          flag:"🏆" },
  ]},
  { cat:"🌎 Amériques", items:[
    { apiId:11,  name:"Copa Libertadores",       flag:"🌎", finalYear:true },
    { apiId:13,  name:"Copa Sudamericana",       flag:"🌎", finalYear:true },
    { apiId:71,  name:"Brasileirão Série A",     flag:"🇧🇷" },
    { apiId:128, name:"Liga Profesional (ARG)",  flag:"🇦🇷" },
    { apiId:262, name:"Liga MX",                 flag:"🇲🇽" },
  ]},
  { cat:"🌍 Autres ligues", items:[
    { apiId:88,  name:"Eredivisie",              flag:"🇳🇱" },
    { apiId:144, name:"Pro League (BEL)",        flag:"🇧🇪" },
    { apiId:203, name:"Süper Lig",               flag:"🇹🇷" },
    { apiId:98,  name:"J1 League",               flag:"🇯🇵" },
    { apiId:307, name:"Saudi Pro League",        flag:"🇸🇦" },
  ]},
];

// Logo d'équipe avec fallback TheSportsDB (pour les données historiques sans logo API)
function HistoryTeamLogo({ name, logo, size = 48 }) {
  const [src, setSrc] = useState(logo || null);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    setSrc(logo || null);
    setTried(false);
  }, [name, logo]);

  // Si pas de logo API → chercher sur TheSportsDB
  useEffect(() => {
    if (src || tried || !name) return;
    setTried(true);
    fetchTeamLogo(name).then(l => { if (l) setSrc(l); });
  }, [name, src, tried]);

  if (src) {
    return (
      <img src={src} alt={name} width={size} height={size}
        style={{ objectFit:"contain", flexShrink:0 }}
        onError={() => setSrc(null)} />
    );
  }
  return (
    <div style={{ width:size, height:size, borderRadius:10, background:C.panel2, display:"grid", placeItems:"center", fontSize:size*.35, fontWeight:700, color:C.dim, flexShrink:0 }}>
      {(name||"?")[0].toUpperCase()}
    </div>
  );
}

// Ligne de match dans l'historique avec cotes lazy-loaded
function HistoryMatchRow({ f, hFil, aFil, hWon, aWon, teamFilter, setTeamFilter }) {
  const [odds,    setOdds]    = useState(null);
  const [oddsVis, setOddsVis] = useState(false);

  function handleShowOdds(e) {
    e.stopPropagation();
    if (!oddsVis && !odds && f.id) {
      fetchOdds(f.id).then(d => setOdds(d)).catch(()=>{});
    }
    setOddsVis(v => !v);
  }

  return (
    <div style={{ borderBottom:`1px solid ${C.line}44` }}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr auto", alignItems:"center", gap:6, padding:"6px 14px" }}>
        {/* Home */}
        <button onClick={() => setTeamFilter(hFil?null:f.home)} style={{ display:"flex", alignItems:"center", gap:6, background:"none", border:"none", cursor:"pointer", opacity:hFil||!teamFilter?1:0.4, textAlign:"left" }}>
          <HistoryTeamLogo logo={f.home?.logo} name={f.home?.name||"?"} size={16} />
          <span style={{ fontSize:11, fontWeight:hWon?700:400, color:hFil?C.accent:hWon?"#16a34a":C.text }}>{f.home?.name}</span>
          {hWon&&<span style={{ fontSize:9, color:"#16a34a" }}>✓</span>}
        </button>
        {/* Score + cotes toggle */}
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <div style={{ textAlign:"center", fontSize:12, fontWeight:700, color:C.text, background:C.panel2, borderRadius:6, padding:"2px 8px", whiteSpace:"nowrap" }}>{f.score}</div>
          {f.id && (
            <button onClick={handleShowOdds} style={{
              background:oddsVis ? C.accentBg : C.panel2,
              border:`1px solid ${oddsVis ? C.accent : C.line}`,
              borderRadius:5, padding:"2px 6px", cursor:"pointer",
              fontSize:9, color:oddsVis ? C.accent : C.muted, fontWeight:600,
            }}>📊</button>
          )}
        </div>
        {/* Away */}
        <button onClick={() => setTeamFilter(aFil?null:f.away)} style={{ display:"flex", alignItems:"center", gap:6, justifyContent:"flex-end", background:"none", border:"none", cursor:"pointer", opacity:aFil||!teamFilter?1:0.4, textAlign:"right" }}>
          {aWon&&<span style={{ fontSize:9, color:"#16a34a" }}>✓</span>}
          <span style={{ fontSize:11, fontWeight:aWon?700:400, color:aFil?C.accent:aWon?"#16a34a":C.text }}>{f.away?.name}</span>
          <HistoryTeamLogo logo={f.away?.logo} name={f.away?.name||"?"} size={16} />
        </button>
      </div>
      {/* Bloc cotes (lazy) */}
      {oddsVis && (
        <div style={{ padding:"6px 14px 8px", background:C.panel2 }}>
          {!odds ? (
            <span style={{ fontSize:10, color:C.muted }}>Chargement des cotes…</span>
          ) : (
            <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
              {odds.bookmaker && (
                <span style={{ fontSize:10, color:C.dim, fontWeight:600 }}>{odds.bookmaker}</span>
              )}
              {odds.win?.home && <span style={{ fontSize:11, background:C.accentBg, color:C.accent, borderRadius:5, padding:"2px 8px", fontWeight:700 }}>1 {odds.win.home}</span>}
              {odds.win?.draw && <span style={{ fontSize:11, background:C.panel, color:C.dim, borderRadius:5, padding:"2px 8px", fontWeight:600, border:`1px solid ${C.line}` }}>X {odds.win.draw}</span>}
              {odds.win?.away && <span style={{ fontSize:11, background:`${C.blue}15`, color:C.blue, borderRadius:5, padding:"2px 8px", fontWeight:700 }}>2 {odds.win.away}</span>}
              {odds.ou25?.over  && <span style={{ fontSize:11, background:"#D1FAE5", color:"#065F46", borderRadius:5, padding:"2px 8px", fontWeight:600 }}>+2.5 {odds.ou25.over}</span>}
              {odds.ou25?.under && <span style={{ fontSize:11, background:"#FEF3C7", color:"#92400E", borderRadius:5, padding:"2px 8px", fontWeight:600 }}>-2.5 {odds.ou25.under}</span>}
              {!odds.win?.home && !odds.ou25?.over && (
                <span style={{ fontSize:10, color:C.muted }}>Cotes non disponibles pour ce match</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Année de création des compétitions
const COMP_FOUNDED = {
  2:1956, 3:1972,  848:2022, 61:1933,  62:1933, 65:1918, 66:1994,
  39:1888,40:1888, 45:1872,  48:1960,  78:1963, 79:1974, 81:1935,
  135:1929,136:1929,137:1922,140:1929, 141:1977,143:1902,94:1934,
  96:1939,1:1930,  4:1960,   5:2018,   9:1916,  6:1957,  22:2000,
  11:1960,13:1960, 71:1959,  128:1931, 262:1943,88:1956, 144:1995,
  203:1959,98:1965,307:1976,
};
function foundedYear(apiId) {
  return COMP_FOUNDED[apiId] || 2010;
}
// API-Football IDs qui ont une correspondance TheSportsDB (données historiques disponibles)
const TSDB_LEAGUE_IDS = new Set([61,39,78,140,135,94,2,3,1,4,9,6,11,13,71,128,45,65]);

function HistoryView({ initialComp, onConsumeInitComp }) {
  const [selComp,   setSelComp]   = useState(initialComp || null);
  const [seasons,   setSeasons]   = useState([]);      // saisons avec données API
  const [selSeason, setSelSeason] = useState(null);
  const [data,      setData]      = useState(null);
  const [loadingSe, setLoadingSe] = useState(false);
  const [loadingDa, setLoadingDa] = useState(false);
  const [errorDa,   setErrorDa]   = useState("");
  const [teamFilter,setTeamFilter]= useState(null);
  const [expandRound,setExpandRound]= useState({});

  // Charger les saisons quand on sélectionne une compétition
  useEffect(() => {
    if (!selComp) return;
    setSeasons([]); setSelSeason(null); setData(null); setTeamFilter(null); setErrorDa("");
    setLoadingSe(true);
    fetchHistorySeasons(selComp.apiId)
      .then(d => {
        setSeasons(d.seasons || []);
        setLoadingSe(false);
        // Auto-sélection de la saison la plus récente via setTimeout pour éviter la race condition
        if (d.seasons?.[0]) {
          setTimeout(() => setSelSeason(d.seasons[0]), 50);
        }
      })
      .catch(() => setLoadingSe(false));
  }, [selComp]);

  // Charger les données de la saison sélectionnée
  // finalYear:true → l'année affichée est l'année de la FINALE
  //   (ex: 2017 = UCL dont la finale a eu lieu en 2017 = saison 2016-17)
  //   → appel API avec season = année - 1
  // finalYear:false/absent → année = début de saison (convention API-Football pour les ligues)
  useEffect(() => {
    if (!selComp || !selSeason) return;
    setData(null); setErrorDa(""); setTeamFilter(null); setLoadingDa(true);

    const apiSeason = selComp.finalYear ? selSeason - 1 : selSeason;

    fetchHistorySeason(selComp.apiId, apiSeason)
      .then(d => {
        // Corriger l'année affichée pour qu'elle corresponde à ce que l'utilisateur a cliqué
        setData({ ...d, season: selSeason });
        setLoadingDa(false);
      })
      .catch(() => {
        // Pas de données API → utiliser les archives statiques (clé = année affichée)
        const entry = (HISTORICAL_CHAMPIONS[selComp.apiId] || {})[selSeason];
        if (entry) {
          setData({
            season: selSeason,
            isStaticOnly: true,
            champion: { name:entry.champion, logo:"", id:null, points:null, won:0, drawn:0, lost:0, gf:0, ga:0, coach:null },
            staticNote: entry.note || null,
            staticHost: entry.host || null,
            top3:[], topScorers:[], rounds:[], totalMatches:null,
          });
        } else {
          setErrorDa(`Aucune donnée disponible pour ${selSeason}`);
        }
        setLoadingDa(false);
      });
  }, [selComp, selSeason]);

  const [teamDropOpen, setTeamDropOpen] = useState(false);
  const teamDropRef = useRef(null);

  useEffect(() => {
    const h = e => { if (teamDropRef.current && !teamDropRef.current.contains(e.target)) setTeamDropOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const toggleRound = key => setExpandRound(prev => ({ ...prev, [key]: !prev[key] }));

  const rounds = useMemo(() => {
    if (!data?.rounds) return [];
    if (!teamFilter) return data.rounds;
    return data.rounds
      .map(r => ({ ...r, fixtures: r.fixtures.filter(f => f.home?.id===teamFilter.id || f.away?.id===teamFilter.id) }))
      .filter(r => r.fixtures.length > 0);
  }, [data, teamFilter]);

  // Liste de toutes les équipes qui ont joué cette saison (pour le dropdown)
  const teamsInSeason = useMemo(() => {
    if (!data?.rounds) return [];
    const map = new Map();
    data.rounds.forEach(r => r.fixtures.forEach(f => {
      if (f.home?.id && !map.has(f.home.id)) map.set(f.home.id, f.home);
      if (f.away?.id && !map.has(f.away.id)) map.set(f.away.id, f.away);
    }));
    return [...map.values()].sort((a,b) => a.name.localeCompare(b.name));
  }, [data]);

  // Générer uniquement les années qui ont des données réelles
  const currentYear   = new Date().getFullYear();
  const seasonsSet    = new Set(seasons);
  const staticChamps  = selComp ? (HISTORICAL_CHAMPIONS[selComp.apiId] || {}) : {};
  const staticYears   = new Set(Object.keys(staticChamps).map(Number));

  // allYears = UNION des années API + statiques (uniquement celles avec données)
  // → plus d'années fantômes pour les compétitions tous les 4 ans ou sans données
  const allYears = useMemo(() => {
    if (!selComp) return [];
    const valid = new Set([...seasonsSet, ...staticYears]);
    if (valid.size === 0) {
      // Aucune donnée encore chargée — afficher un placeholder minimal
      return [currentYear, currentYear-1, currentYear-2].filter(Boolean);
    }
    return [...valid].sort((a, b) => b - a);
  }, [selComp, seasonsSet, staticYears, currentYear]);

  const StatChip = ({ label, value, color }) => (
    <div style={{ textAlign:"center", background:C.panel2, borderRadius:8, padding:"8px 10px", minWidth:56 }}>
      <div style={{ fontSize:16, fontWeight:700, color: color||C.text }}>{value}</div>
      <div style={{ fontSize:9, color:C.dim, textTransform:"uppercase", letterSpacing:.5 }}>{label}</div>
    </div>
  );

  return (
    <div style={{ display:"flex", gap:0, height:"calc(100vh - 110px)", overflow:"hidden" }}>

      {/* ── Catalogue gauche ── */}
      <div style={{ width:230, flexShrink:0, borderRight:`1px solid ${C.line}`, overflowY:"auto", background:C.panel }}>
        <div style={{ padding:"12px 14px 8px", fontSize:10, fontWeight:700, color:C.text, textTransform:"uppercase", letterSpacing:.8, borderBottom:`1px solid ${C.line}` }}>
          Compétitions
        </div>
        {HISTORY_CATALOG.map(cat => (
          <div key={cat.cat}>
            <div style={{ padding:"7px 14px 3px", fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:1.2 }}>{cat.cat}</div>
            {cat.items.map(item => {
              const active = selComp?.apiId === item.apiId;
              return (
                <button key={item.apiId} onClick={() => setSelComp(item)} style={{
                  width:"100%", display:"flex", alignItems:"center", gap:8,
                  padding:"6px 14px", background: active ? C.accentBg : "none",
                  border:"none", borderLeft:`3px solid ${active ? C.accent : "transparent"}`,
                  cursor:"pointer", textAlign:"left",
                }}>
                  <FlagImg emoji={item.flag} height={12} />
                  <span style={{ fontSize:11.5, color: active ? C.accent : C.text, fontWeight: active ? 600 : 400 }}>{item.name}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── Zone principale ── */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

        {!selComp && (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", flex:1, gap:14, color:C.dim }}>
            <div style={{ fontSize:52 }}>📚</div>
            <div style={{ fontSize:17, fontWeight:600, color:C.text }}>Histoire du Football</div>
            <div style={{ fontSize:13, textAlign:"center", maxWidth:400, lineHeight:1.7 }}>
              Sélectionne une compétition à gauche pour voir toute son histoire.<br/>
              <span style={{ fontSize:11, color:C.muted }}>Données API disponibles depuis ~2010 pour la plupart des ligues</span>
            </div>
          </div>
        )}

        {selComp && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
            {/* Header */}
            <div style={{ padding:"12px 20px", borderBottom:`1px solid ${C.line}`, display:"flex", alignItems:"center", gap:12, flexShrink:0 }}>
              <FlagImg emoji={selComp.flag} height={20} />
              <span style={{ fontSize:16, fontWeight:700, color:C.text }}>{selComp.name}</span>
              <span style={{ fontSize:11, color:C.muted }}>Depuis {founded} · {allYears.length} saisons</span>
              {loadingSe && <span style={{ fontSize:11, color:C.dim }}>Chargement…</span>}
              {teamFilter && (
                <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8, background:C.accentBg, border:`1px solid ${C.accent}44`, borderRadius:20, padding:"4px 12px" }}>
                  <TeamLogo url={teamFilter.logo||""} size={16} name={teamFilter.name} />
                  <span style={{ fontSize:11, color:C.accent, fontWeight:600 }}>Parcours : {teamFilter.name}</span>
                  <button onClick={() => setTeamFilter(null)} style={{ background:"none", border:"none", cursor:"pointer", color:C.accent, fontSize:13, lineHeight:1 }}>✕</button>
                </div>
              )}
            </div>

            {/* Contenu en deux colonnes */}
            <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

              {/* Timeline des années */}
              <div style={{ width:220, flexShrink:0, borderRight:`1px solid ${C.line}`, overflowY:"auto", padding:"8px 0" }}>
                <div style={{ padding:"4px 14px 8px", fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:1 }}>
                  {allYears.length} édition{allYears.length > 1 ? "s" : ""}
                </div>
                {allYears.map(y => {
                  const hasApi = seasonsSet.has(y);
                  const isSel  = selSeason === y;
                  // Toutes les années affichées ont des données (API ou statiques)
                  return (
                    <button key={y}
                      onClick={() => setSelSeason(y)}
                      style={{
                        width:"100%", display:"flex", alignItems:"center", gap:6,
                        padding:"6px 14px",
                        background: isSel ? C.accentBg : "none",
                        border:"none", borderLeft:`3px solid ${isSel ? C.accent : "transparent"}`,
                        cursor:"pointer", textAlign:"left",
                      }}>
                      <span style={{ fontSize:12, fontWeight: isSel ? 700 : 500, color: isSel ? C.accent : C.text }}>
                        {y}
                      </span>
                      {/* Badge source */}
                      {hasApi
                        ? <span style={{ fontSize:8, background:C.accentBg, color:C.accent, borderRadius:3, padding:"1px 4px" }}>API</span>
                        : <span style={{ fontSize:8, background:"#F3E8FF", color:"#7C3AED", borderRadius:3, padding:"1px 4px" }}>Arc.</span>
                      }
                      {isSel && <span style={{ marginLeft:"auto", fontSize:9, color:C.accent, fontWeight:700 }}>●</span>}
                    </button>
                  );
                })}
              </div>

              {/* Détail de la saison sélectionnée */}
              <div style={{ flex:1, overflowY:"auto", padding:"16px 20px" }}>
                {!selSeason && !loadingDa && (
                  <div style={{ color:C.muted, fontSize:12, paddingTop:20 }}>Sélectionne une année à gauche.</div>
                )}
                {loadingDa && <InfoPanel>Chargement de la saison {selSeason}… (10-20s la première fois)</InfoPanel>}
                {errorDa && <InfoPanel tone="error">{errorDa}</InfoPanel>}

                {data && !loadingDa && selSeason && (
                  <div>
                    {/* Badge source */}
                    {data.source === "thesportsdb" && !data.isStaticOnly && (
                      <div style={{ background:"#FFF7ED", border:"1px solid #FED7AA", borderRadius:8, padding:"7px 12px", marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ fontSize:14 }}>🌐</span>
                        <span style={{ fontSize:11, color:"#C2410C" }}>Source : TheSportsDB (données historiques) · matchs et classements disponibles</span>
                      </div>
                    )}
                    {data.isStaticOnly && (
                      <div style={{ background:"#F3E8FF", border:"1px solid #C4B5FD", borderRadius:8, padding:"8px 14px", marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ fontSize:14 }}>📚</span>
                        <div>
                          <span style={{ fontSize:11, fontWeight:600, color:"#5B21B6" }}>Données historiques (archives)</span>
                          <span style={{ fontSize:10, color:"#7C3AED", marginLeft:8 }}>Statistiques complètes non disponibles avant ~2010</span>
                        </div>
                      </div>
                    )}
                    {data.staticHost && (
                      <div style={{ fontSize:11, color:C.dim, marginBottom:10 }}>📍 Organisateur : {data.staticHost}</div>
                    )}
                    {data.staticNote && (
                      <div style={{ background:C.accentBg, border:`1px solid #B3D9F2`, borderRadius:8, padding:"8px 12px", marginBottom:14, fontSize:11, color:C.accent }}>
                        💬 {data.staticNote}
                      </div>
                    )}

                    {/* ═══ CHAMPION ═══ */}
                    {data.champion && (
                      <div style={{ background:"linear-gradient(135deg,#FEF9C3,#FEF3C7)", border:"1px solid #FCD34D", borderRadius:14, padding:"16px 20px", marginBottom:16 }}>
                        <div style={{ fontSize:10, color:"#92400E", fontWeight:700, textTransform:"uppercase", letterSpacing:.8, marginBottom:10 }}>
                          🏆 Vainqueur {selSeason}
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
                          <HistoryTeamLogo logo={data.champion.logo} name={data.champion.name} size={48} />
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:20, fontWeight:800, color:"#78350F" }}>{data.champion.name}</div>
                            {/* Coach */}
                            {data.champion.coach && (
                              <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:6 }}>
                                {data.champion.coach.photo && (
                                  <img src={data.champion.coach.photo} width={24} height={24} style={{ borderRadius:"50%", objectFit:"cover" }} onError={e=>e.target.style.display="none"} />
                                )}
                                <span style={{ fontSize:12, color:"#92400E" }}>🧑‍💼 {data.champion.coach.name}{data.champion.coach.nationality ? ` (${data.champion.coach.nationality})` : ""}</span>
                              </div>
                            )}
                          </div>
                          {/* Stats champion */}
                          {data.champion.points != null && (
                            <div style={{ display:"flex", gap:8 }}>
                              <StatChip label="Pts"   value={data.champion.points} color="#B45309" />
                              <StatChip label="V"     value={data.champion.won}    color="#16a34a" />
                              <StatChip label="N"     value={data.champion.drawn}  color="#d97706" />
                              <StatChip label="D"     value={data.champion.lost}   color="#dc2626" />
                              <StatChip label="Buts"  value={`${data.champion.gf}:${data.champion.ga}`} />
                            </div>
                          )}
                        </div>
                        {/* Bouton parcours */}
                        <button
                          onClick={() => setTeamFilter(teamFilter?.id===data.champion.id ? null : { id:data.champion.id, name:data.champion.name, logo:data.champion.logo })}
                          style={{ marginTop:12, background:teamFilter?.id===data.champion.id?"#B45309":"none", border:"1px solid #F59E0B", borderRadius:20, padding:"4px 14px", cursor:"pointer", color:teamFilter?.id===data.champion.id?"#fff":"#92400E", fontSize:11, fontWeight:600 }}>
                          {teamFilter?.id===data.champion.id ? "✕ Masquer le parcours" : "📋 Voir le parcours du champion"}
                        </button>
                      </div>
                    )}

                    {/* ═══ TOP 3 ═══ */}
                    {data.top3?.length > 1 && (
                      <div style={{ marginBottom:16 }}>
                        <div style={{ fontSize:10, fontWeight:700, color:C.dim, textTransform:"uppercase", letterSpacing:.8, marginBottom:8 }}>Classement final</div>
                        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                          {data.top3.map((t, i) => (
                            <button key={t.team.id}
                              onClick={() => setTeamFilter(teamFilter?.id===t.team.id ? null : t.team)}
                              style={{
                                display:"flex", alignItems:"center", gap:10,
                                padding:"8px 12px", background: teamFilter?.id===t.team.id ? C.accentBg : C.panel,
                                border:`1px solid ${teamFilter?.id===t.team.id ? C.accent : C.line}`,
                                borderRadius:10, cursor:"pointer", textAlign:"left",
                              }}>
                              <span style={{ fontSize:16, width:24, flexShrink:0 }}>{["🥇","🥈","🥉"][i]}</span>
                              <HistoryTeamLogo logo={t.team.logo} name={t.team.name} size={24} />
                              <span style={{ flex:1, fontSize:13, fontWeight:600, color:C.text }}>{t.team.name}</span>
                              <div style={{ display:"flex", gap:10, fontSize:11, color:C.dim }}>
                                <span style={{ fontWeight:700, color:C.accent }}>{t.points} pts</span>
                                <span style={{ color:"#16a34a" }}>{t.won}V</span>
                                <span style={{ color:"#d97706" }}>{t.drawn}N</span>
                                <span style={{ color:"#dc2626" }}>{t.lost}D</span>
                                <span>{t.gf}:{t.ga}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ═══ MEILLEUR BUTEUR ═══ */}
                    {data.topScorers?.length > 0 && (
                      <div style={{ marginBottom:16 }}>
                        <div style={{ fontSize:10, fontWeight:700, color:C.dim, textTransform:"uppercase", letterSpacing:.8, marginBottom:8 }}>⚽ Meilleur(s) buteur(s)</div>
                        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                          {data.topScorers.slice(0,3).map((p,i) => (
                            <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", background:C.panel, border:`1px solid ${C.line}`, borderRadius:10 }}>
                              <span style={{ fontSize:11, color:C.muted, width:16, textAlign:"center" }}>{i+1}</span>
                              {p.photo && <img src={p.photo} width={28} height={28} style={{ borderRadius:"50%", objectFit:"cover", flexShrink:0 }} onError={e=>e.target.style.display="none"}/>}
                              <div style={{ flex:1 }}>
                                <div style={{ fontSize:12, fontWeight:600, color:C.text }}>{p.name}</div>
                                <div style={{ fontSize:10, color:C.dim }}>{p.team}</div>
                              </div>
                              <span style={{ fontSize:18, fontWeight:800, color:"#f97316" }}>{p.goals}</span>
                              <span style={{ fontSize:10, color:C.muted }}>buts</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ═══ MATCHS / PARCOURS ═══ */}

                    {/* Dropdown : Voir le parcours d'une équipe */}
                    {teamsInSeason.length > 0 && (
                      <div style={{ marginBottom:14 }}>
                        <div style={{ fontSize:10, fontWeight:700, color:C.dim, textTransform:"uppercase", letterSpacing:.8, marginBottom:7 }}>
                          Voir le parcours d'une équipe
                        </div>
                        <div ref={teamDropRef} style={{ position:"relative" }}>
                          {/* Bouton déclencheur */}
                          <button onClick={() => setTeamDropOpen(o=>!o)} style={{
                            width:"100%", display:"flex", alignItems:"center", gap:10,
                            background: teamFilter ? C.accentBg : C.panel2,
                            border:`1px solid ${teamFilter ? C.accent : C.line}`,
                            borderRadius:10, padding:"9px 14px", cursor:"pointer",
                            boxShadow: teamDropOpen ? `0 0 0 3px ${C.accentBg}` : "none",
                            transition:"all .15s",
                          }}>
                            {teamFilter ? (
                              <>
                                <TeamLogo url={teamFilter.logo||""} size={22} name={teamFilter.name} />
                                <span style={{ flex:1, textAlign:"left", fontSize:13, fontWeight:600, color:C.accent }}>{teamFilter.name}</span>
                                <button onClick={e=>{ e.stopPropagation(); setTeamFilter(null); setTeamDropOpen(false); }} style={{ background:"none", border:"none", cursor:"pointer", color:C.accent, fontSize:15, lineHeight:1, padding:"0 2px" }}>✕</button>
                              </>
                            ) : (
                              <>
                                <span style={{ fontSize:14, color:C.muted }}>🔍</span>
                                <span style={{ flex:1, textAlign:"left", fontSize:12, color:C.dim }}>Sélectionner une équipe…</span>
                              </>
                            )}
                            <svg width="10" height="10" viewBox="0 0 10 10" style={{ flexShrink:0, transition:"transform .2s", transform:teamDropOpen?"rotate(180deg)":"rotate(0)" }}>
                              <path d="M1 3 L5 7 L9 3" stroke={C.muted} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>

                          {/* Liste déroulante */}
                          {teamDropOpen && (
                            <div style={{
                              position:"absolute", top:"calc(100% + 5px)", left:0, right:0, zIndex:120,
                              background:C.panel, border:`1px solid ${C.line}`, borderRadius:12,
                              maxHeight:260, overflowY:"auto",
                              boxShadow:"0 8px 24px rgba(3,45,96,.12)",
                            }}>
                              {/* Option "Toutes les équipes" */}
                              <button onClick={()=>{ setTeamFilter(null); setTeamDropOpen(false); }} style={{
                                width:"100%", display:"flex", alignItems:"center", gap:9, padding:"9px 14px",
                                background: !teamFilter ? C.accentBg : "none",
                                border:"none", borderBottom:`1px solid ${C.line}`,
                                cursor:"pointer", color: !teamFilter ? C.accent : C.dim, fontSize:12, fontWeight:600,
                              }}>
                                <span style={{ fontSize:14 }}>—</span> Toutes les équipes
                                {!teamFilter && <svg style={{ marginLeft:"auto" }} width="12" height="12" viewBox="0 0 12 12"><path d="M2 6 L5 9 L10 3" stroke={C.accent} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                              </button>

                              {/* Équipes */}
                              {teamsInSeason.map(t => {
                                const active = teamFilter?.id === t.id;
                                return (
                                  <button key={t.id} onClick={()=>{ setTeamFilter(t); setTeamDropOpen(false); }} style={{
                                    width:"100%", display:"flex", alignItems:"center", gap:9, padding:"8px 14px",
                                    background: active ? C.accentBg : "none",
                                    border:"none", borderBottom:`1px solid ${C.line}44`,
                                    cursor:"pointer",
                                  }}>
                                    <TeamLogo url={t.logo||""} size={20} name={t.name} />
                                    <span style={{ flex:1, fontSize:12, fontWeight: active ? 600 : 400, color: active ? C.accent : C.text, textAlign:"left" }}>{t.name}</span>
                                    {active && <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6 L5 9 L10 3" stroke={C.accent} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Résumé du parcours si équipe sélectionnée */}
                        {teamFilter && rounds.length > 0 && (
                          <div style={{ marginTop:8, background:C.accentBg, border:`1px solid ${C.accent}33`, borderRadius:8, padding:"8px 12px", fontSize:11, color:C.accent }}>
                            {rounds.reduce((n, r) => n + r.fixtures.length, 0)} matchs trouvés pour <strong>{teamFilter.name}</strong>
                            {" — "}
                            {(() => {
                              let w=0,d=0,l=0;
                              rounds.forEach(r => r.fixtures.forEach(f => {
                                const isH = f.home?.id===teamFilter.id;
                                if (f.winner==="draw") d++;
                                else if ((f.winner==="home"&&isH)||(f.winner==="away"&&!isH)) w++;
                                else l++;
                              }));
                              return <span><span style={{ color:"#16a34a", fontWeight:700 }}>{w}V</span> <span style={{ color:"#d97706" }}>{d}N</span> <span style={{ color:"#dc2626" }}>{l}D</span></span>;
                            })()}
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{ marginBottom:8, display:"flex", alignItems:"center", gap:10 }}>
                      <div style={{ fontSize:10, fontWeight:700, color:C.dim, textTransform:"uppercase", letterSpacing:.8 }}>
                        {teamFilter ? `📋 Parcours : ${teamFilter.name}` : `Tous les matchs (${data.totalMatches ?? rounds.reduce((n,r)=>n+r.fixtures.length,0)})`}
                      </div>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                      {rounds.map(round => {
                        const key  = round.name;
                        const open = expandRound[key] !== false;
                        return (
                          <div key={key} style={{ background:C.panel, border:`1px solid ${C.line}`, borderRadius:10, overflow:"hidden" }}>
                            <button onClick={() => toggleRound(key)} style={{
                              width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between",
                              padding:"8px 14px", background:"none", border:"none", cursor:"pointer",
                            }}>
                              <span style={{ fontSize:12, fontWeight:600, color:C.text }}>{round.name}</span>
                              <div style={{ display:"flex", gap:8 }}>
                                <span style={{ fontSize:10, color:C.muted }}>{round.fixtures.length} matchs</span>
                                <span style={{ fontSize:10, color:C.dim }}>{open?"▴":"▾"}</span>
                              </div>
                            </button>
                            {open && (
                              <div style={{ borderTop:`1px solid ${C.line}` }}>
                                {round.fixtures.map(f => {
                                  const hWon = f.winner==="home", aWon = f.winner==="away";
                                  const hFil = teamFilter?.id===f.home?.id, aFil = teamFilter?.id===f.away?.id;
                                  return (
                                    <HistoryMatchRow key={f.id} f={f} hFil={hFil} aFil={aFil} hWon={hWon} aWon={aWon} teamFilter={teamFilter} setTeamFilter={setTeamFilter} />
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Vainqueurs historiques par compétition (pour la détection des "Grosses affiches")
// Clé = leagueId API-Football, valeur = mots-clés des noms d'équipes vainqueurs
const COMP_PAST_WINNERS = {
  1:  ["Brazil","France","Germany","Italy","Argentina","Spain","England","Uruguay"],  // World Cup
  2:  ["Real Madrid","Barcelona","Bayern","Liverpool","Milan","Manchester","Ajax","Porto","Juventus","Inter","Benfica","Nottingham","Borussia Dortmund","Chelsea","Arsenal","Atletico","Valencia","Marseille","PSV","Steaua"],
  3:  ["Sevilla","Chelsea","Inter","Atletico","Porto","Manchester","Juventus","Benfica","Liverpool","Barcelona","Real Madrid","Arsenal","Parma","Lazio","Galatasaray","Ajax","Schalke","Valencia","Fiorentina","Eintracht","Tottenham","Roma"],
  4:  ["Germany","Spain","France","Italy","Portugal","Netherlands","Denmark","Greece","Czechoslovakia","Soviet"],  // Euro
  9:  ["Argentina","Uruguay","Brazil","Chile","Peru","Colombia","Paraguay","Ecuador","Bolivia"],  // Copa
  6:  ["Egypt","Cameroon","Ghana","Nigeria","Ivory Coast","Côte d'Ivoire","Senegal","Algeria","Morocco","Tunisia","Congo","Sudan","Ethiopia","Zambia","Cape Verde","Guinea"],  // AFCON
  848:["Chelsea","Roma","Fiorentina","West Ham","Betis","Villarreal","Basel","Copenhagen"],
  22: ["Real Madrid","Barcelona","Bayern","Chelsea","Manchester","Inter","Porto","Santos","São Paulo","Corinthians","Fluminense","River Plate","Olimpia","Nacional"],
};

function isFormerWinner(teamName, leagueApiId) {
  const winners = COMP_PAST_WINNERS[leagueApiId];
  if (!winners || !teamName) return false;
  const n = teamName.toLowerCase();
  return winners.some(w => n.includes(w.toLowerCase()) || w.toLowerCase().includes(n.replace(/\s*(f\.?c\.?|a\.?c\.?|s\.?c\.?|r\.?c\.?|u\.?d\.?)\s*/gi,"").trim().toLowerCase()));
}

function isBigGame(f) {
  if (!f.leagueId) return false;
  return isFormerWinner(f.home?.name, f.leagueId) && isFormerWinner(f.away?.name, f.leagueId);
}

// Score de prestige pour les matchs live (pour trier par engouement)
const LEAGUE_PRESTIGE = {
  1:100, 4:100, 9:95, 6:90,   // Compétitions internationales majeures
  2:98,  3:85, 848:75,          // Coupes européennes clubs
  39:88, 140:87, 78:86, 135:85, 61:84, 94:70, // Top 5 + Portugal
  11:72, 13:65,                  // Copa Libertadores / Sudamericana
  45:60, 65:55, 81:55, 143:55, 137:55, // Coupes domestiques
};
function livePrestige(f) {
  return LEAGUE_PRESTIGE[f.leagueId] || 10;
}

function HomeView({ logoRegistry = {}, onMatchClick, onGoHistory, onGoWC }) {
  const [nextFixtures, setNextFixtures] = useState([]);
  const [liveMatches,  setLiveMatches]  = useState([]);
  const [nextLoading,  setNextLoading]  = useState(true);
  const [liveLoading,  setLiveLoading]  = useState(true);
  const [nextError,    setNextError]    = useState("");

  useEffect(() => {
    fetchNext(60)
      .then(d => { setNextFixtures(d || []); setNextLoading(false); })
      .catch(e => { setNextError(e.message); setNextLoading(false); });
    fetchLive()
      .then(d => { setLiveMatches(d || []); setLiveLoading(false); })
      .catch(() => setLiveLoading(false));
  }, []);

  // Grosses affiches = deux anciens vainqueurs s'affrontent dans une compétition qu'ils ont tous les deux gagnée
  const bigGames = nextFixtures.filter(f => isBigGame(f)).slice(0, 12);

  function UpcomingCard({ f, color = C.accent, onSelect }) {
    const homeLogo = logoRegistry[f.home?.id] || f.home?.logo || "";
    const awayLogo = logoRegistry[f.away?.id] || f.away?.logo || "";
    const d = new Date(f.date || f.kickoff || "");
    const dateStr = isNaN(d) ? "" : d.toLocaleDateString("fr-FR", { weekday:"short", day:"numeric", month:"short" });
    const timeStr = isNaN(d) ? "" : d.toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit" });
    const isLive = f.minute != null;

    return (
      <div
        onClick={() => onSelect?.(f)}
        style={{
          background: C.panel,
          border: `1px solid ${isLive ? "#FCD34D" : C.line}`,
          borderRadius: 12,
          padding: "12px 14px",
          cursor: (onSelect && f.compId) ? "pointer" : "default",
          opacity: (onSelect && !f.compId) ? 0.7 : 1,
          minWidth: 220,
          flexShrink: 0,
          position: "relative",
        }}
      >
        {isLive && (
          <div style={{
            position:"absolute", top:8, right:8,
            background:"#DC2626", color:"#fff",
            fontSize:9, fontWeight:700, letterSpacing:.5,
            borderRadius:20, padding:"2px 6px",
          }}>{f.minute}' 🔴</div>
        )}

        <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:8 }}>
          <FlagImg emoji={countryFlag(f.country) !== "⚽" ? countryFlag(f.country) : (f.compFlag||"⚽")} height={12} />
          {(f.leagueLogo || f.compLogo) && <img src={f.leagueLogo || f.compLogo} width={13} height={13} style={{ objectFit:"contain" }} onError={e=>e.target.style.display="none"} />}
          <span style={{ fontSize:10, color:C.dim, fontWeight:500 }}>{f.league || f.compName}</span>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", alignItems:"center", gap:8 }}>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-start", gap:4 }}>
            <TeamLogo url={homeLogo} size={28} name={f.home?.name||"?"} />
            <span style={{ fontSize:11, fontWeight:500, color:C.text, maxWidth:90, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.home?.name}</span>
          </div>

          <div style={{ textAlign:"center" }}>
            {isLive ? (
              <div style={{ fontSize:16, fontWeight:700, color:"#DC2626", letterSpacing:1 }}>{f.score}</div>
            ) : (
              <div style={{ fontSize:10, color:C.dim, lineHeight:1.4, textAlign:"center" }}>
                <div style={{ fontWeight:500, color:C.accent }}>{timeStr}</div>
                <div>{dateStr}</div>
              </div>
            )}
          </div>

          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
            <TeamLogo url={awayLogo} size={28} name={f.away?.name||"?"} />
            <span style={{ fontSize:11, fontWeight:500, color:C.text, maxWidth:90, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", textAlign:"right" }}>{f.away?.name}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:28 }}>

      {/* ── HISTOIRE DU FOOT ── */}
      <div>
        <button onClick={onGoHistory} style={{
          width:"100%", background:`linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #4C1D95 100%)`,
          border:"none", borderRadius:16, padding:"24px 28px",
          cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", gap:20,
          boxShadow:"0 4px 20px rgba(124,58,237,.3)",
          transition:"transform .15s, box-shadow .15s",
        }}
          onMouseEnter={e => { e.currentTarget.style.transform="scale(1.01)"; e.currentTarget.style.boxShadow="0 8px 28px rgba(124,58,237,.4)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform=""; e.currentTarget.style.boxShadow="0 4px 20px rgba(124,58,237,.3)"; }}
        >
          <div style={{ fontSize:48, lineHeight:1 }}>📚</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:20, fontWeight:800, color:"#fff", marginBottom:6 }}>Histoire du Football</div>
            <div style={{ fontSize:12, color:"#C4B5FD", lineHeight:1.5 }}>
              Explorez l'historique complet de toutes les compétitions · Ligues · Coupes · Europe · Équipes nationales<br/>
              <span style={{ fontSize:11, color:"#A78BFA" }}>Qui a gagné en 2012 ? Quel a été le parcours du PSG ? Découvrez tout.</span>
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:6, flexShrink:0 }}>
            {["🏆 UCL","🇫🇷 Ligue 1","🌍 Coupe du Monde","🇧🇷 Copa Libertadores"].map(c => (
              <span key={c} style={{ background:"rgba(255,255,255,.1)", borderRadius:20, padding:"3px 10px", fontSize:11, color:"#E9D5FF", fontWeight:500 }}>{c}</span>
            ))}
          </div>
          <div style={{ fontSize:20, color:"#C4B5FD" }}>→</div>
        </button>
      </div>

      {/* === COUPE DU MONDE 2026 === */}
      {onGoWC && (
        <div>
          <button onClick={onGoWC} style={{
            width:"100%",
            background:"linear-gradient(135deg, #032D60 0%, #0176D3 40%, #01509B 100%)",
            border:"none", borderRadius:16, padding:"22px 28px",
            cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", gap:20,
            boxShadow:"0 4px 20px rgba(1,118,211,.35)",
            transition:"transform .15s, box-shadow .15s",
          }}
            onMouseEnter={e=>{ e.currentTarget.style.transform="scale(1.01)"; e.currentTarget.style.boxShadow="0 8px 28px rgba(1,118,211,.5)"; }}
            onMouseLeave={e=>{ e.currentTarget.style.transform=""; e.currentTarget.style.boxShadow="0 4px 20px rgba(1,118,211,.35)"; }}
          >
            <div style={{ fontSize:44, lineHeight:1 }}>🌍</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:20, fontWeight:800, color:"#fff", marginBottom:5 }}>Coupe du Monde 2026</div>
              <div style={{ fontSize:12, color:"#93C5FD", lineHeight:1.5 }}>
                USA · Canada · Mexique · 48 équipes · 12 groupes<br/>
                <span style={{ fontSize:11, color:"#BFDBFE" }}>Voir les groupes, les affiches, tous les matchs →</span>
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:5, flexShrink:0 }}>
              {["🇺🇸 Groupe A","🇫🇷 France","🇧🇷 Brésil","⚽ 72 matchs"].map(c => (
                <span key={c} style={{ background:"rgba(255,255,255,.12)", borderRadius:20, padding:"3px 10px", fontSize:11, color:"#DBEAFE", fontWeight:500 }}>{c}</span>
              ))}
            </div>
            <div style={{ fontSize:22, color:"#93C5FD" }}>→</div>
          </button>
        </div>
      )}

      {/* === EN DIRECT === */}
      {(() => {
        const [showAllLive, setShowAllLive] = React.useState(false);
        const sorted  = [...liveMatches].sort((a,b) => livePrestige(b) - livePrestige(a));
        const top4    = sorted.slice(0, 4);
        const rest    = sorted.slice(4);

        return (
          <div>
            {/* Header */}
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:"#DC2626", boxShadow:"0 0 6px #DC2626" }} />
              <span style={{ fontSize:13, fontWeight:600, color:C.text, textTransform:"uppercase", letterSpacing:.8 }}>En direct</span>
              {!liveLoading && liveMatches.length > 0 && (
                <span style={{ background:"#FEE2E2", color:"#DC2626", fontSize:10, fontWeight:700, borderRadius:20, padding:"2px 8px", border:"1px solid #FECACA" }}>
                  {liveMatches.length}
                </span>
              )}
            </div>

            {liveLoading && <div style={{ color:C.dim, fontSize:12 }}>Vérification des matchs en direct…</div>}

            {!liveLoading && liveMatches.length === 0 && (
              <div style={{ background:C.panel, border:`1px solid ${C.line}`, borderRadius:10, padding:"20px", textAlign:"center", color:C.dim, fontSize:12 }}>
                Aucun match en direct pour le moment.
              </div>
            )}

            {!liveLoading && liveMatches.length > 0 && (
              <>
                {/* Top 4 — 2 colonnes */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom: rest.length > 0 ? 10 : 0 }}>
                  {top4.map(f => (
                    <div key={f.id} style={{ position:"relative" }}>
                      <UpcomingCard f={f} onSelect={onMatchClick} />
                      {!f.compId && <div style={{ position:"absolute", bottom:5, right:8, fontSize:8, color:C.muted, background:C.panel2, borderRadius:3, padding:"1px 4px" }}>Non suivi</div>}
                    </div>
                  ))}
                </div>

                {/* Dropdown "X autres matchs en direct" */}
                {rest.length > 0 && (
                  <div style={{ background:C.panel, border:`1px solid ${C.line}`, borderRadius:10, overflow:"hidden" }}>
                    <button
                      onClick={() => setShowAllLive(v => !v)}
                      style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px", background:"none", border:"none", cursor:"pointer" }}
                    >
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <div style={{ width:6, height:6, borderRadius:"50%", background:"#DC2626" }} />
                        <span style={{ fontSize:12, fontWeight:500, color:C.text }}>{rest.length} autre{rest.length > 1 ? "s" : ""} match{rest.length > 1 ? "s" : ""} en direct</span>
                      </div>
                      <span style={{ fontSize:11, color:C.dim, transition:"transform .2s", transform:showAllLive?"rotate(180deg)":"" }}>▾</span>
                    </button>
                    {showAllLive && (
                      <div style={{ borderTop:`1px solid ${C.line}`, padding:"10px 12px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                        {rest.map(f => (
                          <div key={f.id} style={{ position:"relative" }}>
                            <UpcomingCard f={f} onSelect={onMatchClick} />
                            {!f.compId && <div style={{ position:"absolute", bottom:5, right:8, fontSize:8, color:C.muted, background:C.panel2, borderRadius:3, padding:"1px 4px" }}>Non suivi</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })()}

      {/* === GROSSES AFFICHES === */}
      {bigGames.length > 0 && (
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
            <span style={{ fontSize:18 }}>⭐</span>
            <span style={{ fontSize:13, fontWeight:600, color:C.text, textTransform:"uppercase", letterSpacing:.8 }}>Grosses affiches</span>
          </div>
          <div style={{ display:"flex", gap:12, overflowX:"auto", paddingBottom:4, scrollbarWidth:"none" }}>
            {bigGames.map(f => <UpcomingCard key={f.id} f={f} onSelect={onMatchClick} />)}
          </div>
        </div>
      )}

      {/* === TOUS LES MATCHS À VENIR === */}
      <div>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
          <span style={{ fontSize:18 }}>📅</span>
          <span style={{ fontSize:13, fontWeight:600, color:C.text, textTransform:"uppercase", letterSpacing:.8 }}>Matchs à venir</span>
          {!nextLoading && <span style={{ background:C.accentBg, color:C.accent, fontSize:10, fontWeight:700, borderRadius:20, padding:"2px 8px", border:"1px solid #B3D9F2" }}>{nextFixtures.length}</span>}
        </div>
        {nextLoading ? (
          <div style={{ color:C.dim, fontSize:12, padding:"16px 0" }}>Chargement des prochains matchs…</div>
        ) : nextError ? (
          <div style={{ color:C.red, fontSize:12 }}>{nextError}</div>
        ) : nextFixtures.length === 0 ? (
          <div style={{ background:C.panel, border:`1px solid ${C.line}`, borderRadius:10, padding:"20px", textAlign:"center", color:C.dim, fontSize:12 }}>
            Aucun match à venir trouvé.
          </div>
        ) : (() => {
          const byDate = {};
          nextFixtures.forEach(f => {
            const d = new Date(f.date).toLocaleDateString("fr-FR", { weekday:"long", day:"numeric", month:"long" });
            if (!byDate[d]) byDate[d] = [];
            byDate[d].push(f);
          });
          return Object.entries(byDate).map(([dateLabel, matches]) => (
            <div key={dateLabel} style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:600, color:C.dim, textTransform:"capitalize", letterSpacing:.5, marginBottom:8, borderLeft:`3px solid ${C.accent}`, paddingLeft:8 }}>
                {dateLabel}
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                {matches.map(f => {
                  const homeLogo = logoRegistry[f.home?.id] || f.home?.logo || "";
                  const awayLogo = logoRegistry[f.away?.id] || f.away?.logo || "";
                  const t = new Date(f.date).toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit" });
                  return (
                    <div key={f.id}
                      onClick={() => f.compId && onMatchClick?.(f)}
                      style={{ background:C.panel, border:`1px solid ${C.line}`, borderRadius:10, padding:"10px 14px", display:"grid", gridTemplateColumns:"1fr auto 1fr auto", alignItems:"center", gap:10, cursor:f.compId?"pointer":"default", transition:"border-color .1s" }}
                      onMouseEnter={e=>{ if(f.compId) e.currentTarget.style.borderColor=C.accent; }}
                      onMouseLeave={e=>{ e.currentTarget.style.borderColor=C.line; }}
                    >
                      <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:0 }}>
                        <TeamLogo url={homeLogo} size={20} name={f.home?.name||"?"} />
                        <span style={{ fontSize:12, fontWeight:500, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.home?.name}</span>
                      </div>
                      <div style={{ textAlign:"center", minWidth:50 }}>
                        <div style={{ fontSize:12, fontWeight:600, color:C.accent }}>{t}</div>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:8, justifyContent:"flex-end", minWidth:0 }}>
                        <span style={{ fontSize:12, fontWeight:500, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", textAlign:"right" }}>{f.away?.name}</span>
                        <TeamLogo url={awayLogo} size={20} name={f.away?.name||"?"} />
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
                        <FlagImg emoji={countryFlag(f.country)} height={12} />
                        {f.leagueLogo && <img src={f.leagueLogo} width={13} height={13} style={{ objectFit:"contain" }} onError={e=>e.target.style.display="none"} />}
                        <span style={{ fontSize:10, color:C.dim, maxWidth:80, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.league}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ));
        })()}
      </div>

      {/* === CE JOUR DANS L'HISTOIRE === */}
      {(() => {
        const today = new Date();
        const day   = today.getDate();
        const month = today.getMonth()+1;

        const HISTORY_FACTS = [
          { m:5, d:25, year:1967, text:"Le Celtic Glasgow devient le premier club britannique à remporter la Coupe d'Europe (2-1 vs Inter Milan à Lisbonne). Les 'Lions de Lisbonne'." },
          { m:5, d:26, year:1999, text:"Manchester United gagne la Ligue des Champions contre le Bayern Munich 2-1 après deux buts en arrêts de jeu (Sheringham 91', Solskjaer 93')." },
          { m:5, d:29, year:1985, text:"Tragédie du Heysel : 39 morts lors de la finale Juventus-Liverpool. L'UEFA interdit les clubs anglais de coupe d'Europe." },
          { m:6, d:11, year:2010, text:"Le Mondial 2010 s'ouvre en Afrique du Sud — 1ère CdM sur le continent africain. Bafana Bafana fait match nul contre le Mexique 1-1." },
          { m:7, d:13, year:1930, text:"Le tout premier match de Coupe du Monde de l'histoire : France 4-1 Mexique. Lucien Laurent inscrit le 1er but de l'histoire des CdM." },
          { m:7, d:30, year:1966, text:"L'Angleterre remporte sa seule et unique Coupe du Monde à Wembley, 4-2 contre l'Allemagne. Hat-trick de Geoff Hurst." },
          { m:6, d:4,  year:2012, text:"Chelsea remporte sa 1ère Ligue des Champions (1-1 ap vs Bayern, t.a.b. 4-3). Didier Drogba marque à la 88e puis le penalty décisif." },
          { m:5, d:22, year:1999, text:"Manchester United bat la Juventus en demi-finale de LDC (3-2) après avoir été menés 2-0. Roy Keane, suspendu pour la finale, signe une performance légendaire." },
          { m:4, d:6,  year:2005, text:"AC Milan mène 3-0 à la mi-temps de la finale UCL vs Liverpool... Le reste est de l'histoire (miracle d'Istanbul)." },
          { m:5, d:25, year:2005, text:"Le miracle d'Istanbul : Liverpool remonte un 0-3 contre l'AC Milan et gagne aux tirs au but (3-3 ap, 3-2 aux pen)." },
        ];

        const facts = HISTORY_FACTS.filter(f => f.m===month && f.d===day);
        if (!facts.length) return null;

        return (
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
              <span style={{ fontSize:18 }}>📅</span>
              <span style={{ fontSize:13, fontWeight:600, color:C.text, textTransform:"uppercase", letterSpacing:.8 }}>Ce jour dans l'histoire</span>
              <span style={{ fontSize:11, color:C.muted }}>{day}/{month}</span>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {facts.map((f,i) => (
                <div key={i} style={{ background:C.panel, border:`1px solid ${C.line}`, borderRadius:12, padding:"14px 16px", display:"flex", gap:14, alignItems:"flex-start" }}>
                  <div style={{ flexShrink:0, background:`${C.accent}18`, borderRadius:10, padding:"8px 12px", textAlign:"center" }}>
                    <div style={{ fontSize:18, fontWeight:900, color:C.accent }}>{f.year}</div>
                    <div style={{ fontSize:9, color:C.dim }}>il y a {new Date().getFullYear()-f.year} ans</div>
                  </div>
                  <p style={{ fontSize:12, color:C.text, lineHeight:1.7, margin:0 }}>{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ============================================================
// ============================================================
// Onglet : Classement de championnat
// ============================================================
function TabClassement({ compId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const now = new Date();
  const season = now.getMonth()>=6?now.getFullYear():now.getFullYear()-1;

  const API_IDS = {fr:61,en:39,it:135,de:78,es:140,pt:94,ucl:2,uel:3,uecl:848,en_ch:40,fr_l2:62,de_b2:79,es_l2:141,it_sb:136};
  const apiId = API_IDS[compId];

  useEffect(() => {
    if (!apiId) { setLoading(false); return; }
    setLoading(true);
    fetchStandings(apiId, season)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [compId, apiId, season]);

  if (loading) return <InfoPanel>Chargement du classement…</InfoPanel>;
  if (!data || !data.length) return <InfoPanel>Classement non disponible pour cette compétition.</InfoPanel>;

  const group = data[0] || [];

  return (
    <div>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
          <thead>
            <tr style={{ background:C.panel2 }}>
              {["#","Équipe","J","V","N","D","BP","BC","Diff","Pts","Forme"].map(h => (
                <th key={h} style={{ padding:"8px 10px", color:C.dim, fontWeight:600, textAlign:h==="Équipe"?"left":"center", fontSize:10, textTransform:"uppercase", letterSpacing:.5, borderBottom:`1px solid ${C.line}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {group.map((row, i) => {
              const form = (row.form||"").split("").slice(-5);
              const pts = row.points||0;
              const topZone = i < 4;
              const relegation = i >= group.length-3;
              return (
                <tr key={row.team?.id||i} style={{ borderBottom:`1px solid ${C.line}44`, background:i%2===0?"none":C.panel2+"44" }}>
                  <td style={{ padding:"8px 10px", textAlign:"center", fontWeight:700, color:topZone?C.accent:relegation?"#ef4444":C.text }}>{row.rank}</td>
                  <td style={{ padding:"8px 10px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                      {row.team?.logo && <img src={row.team.logo} width={16} height={16} style={{ objectFit:"contain" }} onError={e=>e.target.style.display="none"} />}
                      <span style={{ fontWeight:500, color:C.text }}>{row.team?.name}</span>
                    </div>
                  </td>
                  <td style={{ padding:"8px 10px", textAlign:"center", color:C.dim }}>{row.all?.played||0}</td>
                  <td style={{ padding:"8px 10px", textAlign:"center", color:"#16a34a", fontWeight:600 }}>{row.all?.win||0}</td>
                  <td style={{ padding:"8px 10px", textAlign:"center", color:"#d97706" }}>{row.all?.draw||0}</td>
                  <td style={{ padding:"8px 10px", textAlign:"center", color:"#ef4444" }}>{row.all?.lose||0}</td>
                  <td style={{ padding:"8px 10px", textAlign:"center", color:C.dim }}>{row.all?.goals?.for||0}</td>
                  <td style={{ padding:"8px 10px", textAlign:"center", color:C.dim }}>{row.all?.goals?.against||0}</td>
                  <td style={{ padding:"8px 10px", textAlign:"center", color:C.dim }}>{(row.goalsDiff||0)>0?"+":""}{row.goalsDiff||0}</td>
                  <td style={{ padding:"8px 10px", textAlign:"center", fontWeight:800, color:C.accent, fontSize:13 }}>{pts}</td>
                  <td style={{ padding:"8px 4px" }}>
                    <div style={{ display:"flex", gap:2, justifyContent:"center" }}>
                      {form.map((r,j) => (
                        <span key={j} style={{ width:16, height:16, borderRadius:3, display:"grid", placeItems:"center", fontSize:8, fontWeight:700,
                          background:r==="W"?"#16a34a":r==="L"?"#ef4444":r==="D"?"#d97706":"#94a3b8", color:"#fff" }}>{r}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop:10, display:"flex", gap:16, fontSize:10, color:C.muted }}>
        <span style={{ color:C.accent }}>■ Zone qualificative</span>
        <span style={{ color:"#ef4444" }}>■ Zone de relégation</span>
      </div>
    </div>
  );
}

// ============================================================
// Onglet : Timeline des événements d'un match
// ============================================================
function TabTimeline({ fixtureId, homeName, awayName, homeId }) {
  const [events, setEvents] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!fixtureId) return;
    setLoading(true);
    fetchFullMatchEvents(fixtureId)
      .then(d => { setEvents(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [fixtureId]);

  if (loading) return <InfoPanel>Chargement de la timeline…</InfoPanel>;
  if (!events || events.length === 0) return <InfoPanel>Timeline non disponible (match à venir ou données absentes).</InfoPanel>;

  const getIcon = (type, detail) => {
    if (type === "Goal") {
      if (detail?.includes("Penalty")) return "⚽🥅";
      if (detail?.includes("Own")) return "⚽😬";
      return "⚽";
    }
    if (type === "Card") {
      if (detail?.includes("Red")) return "🟥";
      if (detail?.includes("Yellow Red")) return "🟨🟥";
      return "🟨";
    }
    if (type === "subst") return "🔄";
    if (type === "Var") return "📺";
    return "•";
  };

  const getColor = (type, detail) => {
    if (type === "Goal") return "#16a34a";
    if (type === "Card" && detail?.includes("Red")) return "#dc2626";
    if (type === "Card") return "#d97706";
    if (type === "subst") return C.blue;
    return C.dim;
  };

  return (
    <div>
      <div style={{ position:"relative", padding:"0 20px" }}>
        {/* Ligne centrale */}
        <div style={{ position:"absolute", left:"50%", top:0, bottom:0, width:2, background:C.line, transform:"translateX(-50%)" }} />

        {/* Coup d'envoi */}
        <div style={{ display:"flex", justifyContent:"center", marginBottom:16 }}>
          <div style={{ background:C.accent, color:"#fff", borderRadius:20, padding:"4px 16px", fontSize:11, fontWeight:700, zIndex:1, position:"relative" }}>Coup d'envoi</div>
        </div>

        {/* Événements + Mi-temps */}
        {(() => {
          const items = [];
          let halfAdded = false;
          events.forEach((e, i) => {
            if (e.minute >= 45 && !halfAdded) {
              halfAdded = true;
              items.push(
                <div key="ht" style={{ display:"flex", justifyContent:"center", margin:"12px 0" }}>
                  <div style={{ background:C.panel2, border:`1px solid ${C.line}`, borderRadius:20, padding:"3px 14px", fontSize:10, color:C.dim, fontWeight:600, zIndex:1, position:"relative" }}>Mi-temps</div>
                </div>
              );
            }
            const isHome = e.teamId === homeId;
            const color = getColor(e.type, e.detail);
            const icon  = getIcon(e.type, e.detail);

            // Skip substitutions
            if (e.type === "subst") return;

            items.push(
              <div key={`${e.minute}-${i}`} style={{
                display:"grid", gridTemplateColumns:"1fr 50px 1fr",
                alignItems:"center", gap:8, marginBottom:10,
              }}>
                {/* Côté domicile */}
                {isHome ? (
                  <div style={{ textAlign:"right", fontSize:12 }}>
                    <div style={{ fontWeight:600, color }}>{e.playerName}</div>
                    {e.assistName && <div style={{ fontSize:10, color:C.muted }}>pass. {e.assistName}</div>}
                    {e.detail?.includes("Own") && <div style={{ fontSize:10, color:"#dc2626" }}>CSC</div>}
                    {e.detail?.includes("Penalty") && <div style={{ fontSize:10, color:C.dim }}>Pénalty</div>}
                  </div>
                ) : <div />}

                {/* Centre : minute + icône */}
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2, zIndex:1, position:"relative" }}>
                  <div style={{ background:C.panel, border:`2px solid ${color}`, borderRadius:"50%", width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>
                    {icon}
                  </div>
                  <div style={{ fontSize:10, fontWeight:700, color }}>{e.minute}{e.extra?`+${e.extra}`:""}'</div>
                </div>

                {/* Côté extérieur */}
                {!isHome ? (
                  <div style={{ textAlign:"left", fontSize:12 }}>
                    <div style={{ fontWeight:600, color }}>{e.playerName}</div>
                    {e.assistName && <div style={{ fontSize:10, color:C.muted }}>pass. {e.assistName}</div>}
                    {e.detail?.includes("Own") && <div style={{ fontSize:10, color:"#dc2626" }}>CSC</div>}
                    {e.detail?.includes("Penalty") && <div style={{ fontSize:10, color:C.dim }}>Pénalty</div>}
                  </div>
                ) : <div />}
              </div>
            );
          });
          return items;
        })()}

        {/* Fin du match */}
        <div style={{ display:"flex", justifyContent:"center", marginTop:16 }}>
          <div style={{ background:C.panel2, border:`1px solid ${C.line}`, borderRadius:20, padding:"4px 16px", fontSize:11, fontWeight:700, color:C.dim, zIndex:1, position:"relative" }}>Fin du match</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Composant : Blessés / Suspendus
// ============================================================
function InjuryReport({ homeTeamId, awayTeamId, homeName, awayName }) {
  const [homeInj, setHomeInj] = useState(null);
  const [awayInj, setAwayInj] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!homeTeamId || !awayTeamId) return;
    Promise.all([fetchInjuries(homeTeamId), fetchInjuries(awayTeamId)])
      .then(([h, a]) => { setHomeInj(h); setAwayInj(a); });
  }, [homeTeamId, awayTeamId]);

  const total = (homeInj?.length||0) + (awayInj?.length||0);
  if (total === 0) return null;

  return (
    <div style={{ marginBottom:10, background:C.panel, border:`1px solid #FED7AA`, borderRadius:10, overflow:"hidden" }}>
      <button onClick={() => setOpen(v=>!v)} style={{
        width:"100%", display:"flex", alignItems:"center", gap:8, padding:"9px 14px",
        background:`#FFF7ED`, border:"none", cursor:"pointer", textAlign:"left",
      }}>
        <span style={{ fontSize:14 }}>🚑</span>
        <span style={{ fontSize:12, fontWeight:600, color:"#C2410C" }}>Blessés / Suspendus</span>
        <span style={{ background:"#FED7AA", color:"#C2410C", borderRadius:20, padding:"1px 8px", fontSize:10, fontWeight:700 }}>{total}</span>
        <span style={{ marginLeft:"auto", color:"#C2410C", fontSize:11 }}>{open?"▴":"▾"}</span>
      </button>
      {open && (
        <div style={{ padding:"10px 14px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          {[{ team:homeName, inj:homeInj||[] }, { team:awayName, inj:awayInj||[] }].map(({ team, inj }) => (
            <div key={team}>
              <div style={{ fontSize:10, color:C.dim, fontWeight:700, textTransform:"uppercase", letterSpacing:.8, marginBottom:6 }}>{team} ({inj.length})</div>
              {inj.length===0 ? (
                <div style={{ fontSize:11, color:C.muted }}>Aucun blessé connu ✅</div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                  {inj.slice(0,5).map(p => (
                    <div key={p.playerId} style={{ display:"flex", alignItems:"center", gap:6 }}>
                      {p.playerPhoto && <img src={p.playerPhoto} width={18} height={18} style={{ borderRadius:"50%", objectFit:"cover" }} onError={e=>e.target.style.display="none"} />}
                      <span style={{ fontSize:11, color:C.text }}>{p.playerName}</span>
                      <span style={{ marginLeft:"auto", fontSize:9, background:"#FEE2E2", color:"#DC2626", borderRadius:4, padding:"1px 5px" }}>{p.type}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Onglet : Aperçu IA du match
// ============================================================
function TabPreview({ m, compId }) {
  const [preview, setPreview]   = useState("");
  const [loading, setLoading]   = useState(false);
  const [generated, setGenerated] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const context = {
        league: m.league, date: m.date, score: m.score,
        home: { name:m.home.name, form:m.home.form, avgGoalsScored:m.home.avgGoalsScored, avgGoalsConceded:m.home.avgGoalsConceded, btts:m.home.btts, cleanSheet:m.home.cleanSheet, doubleChance:m.home.doubleChance, homeRecord:m.home.homeRecord },
        away: { name:m.away.name, form:m.away.form, avgGoalsScored:m.away.avgGoalsScored, avgGoalsConceded:m.away.avgGoalsConceded, btts:m.away.btts, cleanSheet:m.away.cleanSheet, doubleChance:m.away.doubleChance, awayRecord:m.away.awayRecord },
        h2h: m.h2h,
      };
      const question = `Génère un aperçu COMPLET de ce match pour un parieur professionnel. Inclus:
1. ANALYSE DES FORCES (forme, stats offensives/défensives)
2. FACE-À-FACE (tendances historiques)
3. ANGLES DE PARIS (avec pourcentages et cotes indicatives):
   - Résultat (1X2)
   - Over/Under 2.5 buts
   - BTTS (les deux marquent)
   - Double chance
   - Handicap asiatique
4. PARI À VALEUR (meilleure opportunité selon les stats)
5. AVERTISSEMENTS (absences supposées, conditions météo typiques, enjeux)

Sois précis avec des chiffres. Format clair avec sections.`;
      const res = await fetch("/api/chat", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ question, context, history:[], teamDatabase:{} }),
      });
      const data = await res.json();
      setPreview(data.answer || "");
      setGenerated(true);
    } catch (e) {
      setPreview("Erreur lors de la génération.");
      setGenerated(true);
    }
    setLoading(false);
  }

  return (
    <div>
      {!generated ? (
        <div style={{ textAlign:"center", padding:"32px 20px" }}>
          <div style={{ fontSize:48, marginBottom:12 }}>🤖</div>
          <div style={{ fontSize:14, fontWeight:600, color:C.text, marginBottom:8 }}>Aperçu IA du match</div>
          <div style={{ fontSize:12, color:C.dim, marginBottom:20, maxWidth:380, margin:"0 auto 20px" }}>
            Analyse complète basée sur les statistiques historiques : forces/faiblesses, H2H, angles de paris avec probabilités.
          </div>
          <button onClick={generate} disabled={loading} style={{
            background:C.accent, color:"#fff", border:"none", borderRadius:10,
            padding:"12px 28px", fontSize:14, fontWeight:700, cursor:loading?"not-allowed":"pointer",
            boxShadow:`0 4px 16px ${C.accent}44`, opacity:loading?.7:1,
          }}>
            {loading ? "Génération en cours…" : "🚀 Générer l'aperçu"}
          </button>
        </div>
      ) : (
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div style={{ fontSize:11, color:C.dim }}>🤖 Généré par IA (Groq llama-3.3-70b) · Pas de garantie de résultat</div>
            <button onClick={() => { setGenerated(false); setPreview(""); }} style={{ background:"none", border:`1px solid ${C.line}`, borderRadius:6, padding:"4px 10px", cursor:"pointer", fontSize:11, color:C.dim }}>↻ Regénérer</button>
          </div>
          <div style={{ background:C.panel2, borderRadius:12, padding:"16px", fontSize:12, color:C.text, lineHeight:1.8, whiteSpace:"pre-wrap" }}>
            {preview}
          </div>
          <div style={{ marginTop:10, padding:"8px 12px", background:"#FEF3C7", border:"1px solid #FCD34D", borderRadius:8, fontSize:10, color:"#92400E" }}>
            ⚠️ Ces analyses sont basées sur des données statistiques historiques. Les paris comportent un risque de perte financière. Pariez de façon responsable.
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Onglet Météo — statistiques V/N/D par conditions climatiques
// ============================================================
function TabMeteo({ compId, fixtureId }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    if (!compId || !fixtureId) return;
    setLoading(true); setError(""); setData(null);
    fetchWeatherStats(compId, fixtureId)
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [compId, fixtureId]);

  if (loading) return (
    <InfoPanel>
      Collecte des données météo Open-Meteo… La 1ère consultation peut prendre 20-30s (géocodage des villes + historique).
    </InfoPanel>
  );
  if (error)  return <InfoPanel tone="error">{error}</InfoPanel>;
  if (!data)  return null;

  const pct = (n, total) => total > 0 ? Math.round((n/total)*100) : 0;

  const StatBar = ({ w, d, l, n }) => (
    <div style={{ display:"flex", height:7, borderRadius:4, overflow:"hidden", gap:1, marginTop:4 }}>
      <div style={{ width:`${pct(w,n)}%`, background:"#16a34a", transition:"width .5s" }} title={`${pct(w,n)}% V`} />
      <div style={{ width:`${pct(d,n)}%`, background:"#d97706", transition:"width .5s" }} title={`${pct(d,n)}% N`} />
      <div style={{ width:`${pct(l,n)}%`, background:"#dc2626", transition:"width .5s" }} title={`${pct(l,n)}% D`} />
    </div>
  );

  const Legend = () => (
    <div style={{ display:"flex", gap:14, marginBottom:12, fontSize:10, color:C.dim }}>
      <span style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ width:10, height:10, borderRadius:2, background:"#16a34a", display:"inline-block" }}/> Victoire</span>
      <span style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ width:10, height:10, borderRadius:2, background:"#d97706", display:"inline-block" }}/> Nul</span>
      <span style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ width:10, height:10, borderRadius:2, background:"#dc2626", display:"inline-block" }}/> Défaite</span>
    </div>
  );

  // Bloc de stats météo pour un contexte (domicile ou extérieur)
  function WeatherBlock({ stats, color, label }) {
    if (!stats || (!stats.tempStats?.length && !stats.condStats?.length)) return (
      <div style={{ background:C.panel2, borderRadius:8, padding:"10px 12px", fontSize:11, color:C.muted }}>
        Pas assez de données pour « {label} ».
      </div>
    );
    return (
      <div>
        <div style={{ fontSize:10, color:C.muted, marginBottom:8 }}>
          {stats.covered || 0} / {stats.total || 0} matchs avec données météo
        </div>

        {stats.tempStats?.length > 0 && (
          <>
            <div style={{ fontSize:9, color:C.dim, fontWeight:700, textTransform:"uppercase", letterSpacing:.8, marginBottom:8, paddingLeft:5, borderLeft:`2px solid ${color}` }}>Température</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:14 }}>
              {stats.tempStats.map(b => (
                <div key={b.label} style={{ display:"grid", gridTemplateColumns:"130px 1fr auto", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:10, color:C.text }}>{b.icon} {b.label}</span>
                  <StatBar w={b.w} d={b.d} l={b.l} n={b.n} />
                  <span style={{ fontSize:10, color:C.dim, whiteSpace:"nowrap" }}>
                    <span style={{ color:"#16a34a", fontWeight:700 }}>{pct(b.w,b.n)}%V</span>
                    <span style={{ color:"#d97706" }}> {pct(b.d,b.n)}%N</span>
                    <span style={{ color:"#dc2626" }}> {pct(b.l,b.n)}%D</span>
                    <span style={{ color:C.muted }}> ({b.n})</span>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {stats.condStats?.length > 0 && (
          <>
            <div style={{ fontSize:9, color:C.dim, fontWeight:700, textTransform:"uppercase", letterSpacing:.8, marginBottom:8, paddingLeft:5, borderLeft:`2px solid ${color}` }}>Conditions</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {stats.condStats.map(c => (
                <div key={c.key||c.label} style={{ display:"grid", gridTemplateColumns:"160px 1fr auto", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:10, color:C.text }}>{c.icon} {c.label}</span>
                  <StatBar w={c.w} d={c.d} l={c.l} n={c.n} />
                  <span style={{ fontSize:10, color:C.dim, whiteSpace:"nowrap" }}>
                    <span style={{ color:"#16a34a", fontWeight:700 }}>{pct(c.w,c.n)}%V</span>
                    <span style={{ color:"#d97706" }}> {pct(c.d,c.n)}%N</span>
                    <span style={{ color:"#dc2626" }}> {pct(c.l,c.n)}%D</span>
                    <span style={{ color:C.muted }}> ({c.n})</span>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // Carte équipe avec deux onglets dom/ext
  function TeamWeatherCard({ teamData, color, matchSide }) {
    const [venueTab, setVenueTab] = useState("home");
    if (!teamData) return null;
    const stats = venueTab === "home" ? teamData.atHome : teamData.atAway;
    return (
      <div style={{ background:C.panel, border:`1px solid ${C.line}`, borderRadius:12, padding:"14px 16px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <span style={{ fontSize:13, fontWeight:600, color }}>{teamData.name}</span>
          <span style={{ fontSize:10, color:C.muted }}>{matchSide}</span>
        </div>
        {/* Toggle domicile / extérieur */}
        <div style={{ display:"flex", gap:3, background:C.panel2, borderRadius:7, padding:3, marginBottom:14 }}>
          {[
            { id:"home", label:"🏠 Domicile" },
            { id:"away", label:"✈️ Extérieur" },
          ].map(t => (
            <button key={t.id} onClick={() => setVenueTab(t.id)} style={{
              flex:1, border:"none", cursor:"pointer", padding:"5px 8px", borderRadius:5,
              fontSize:11, fontWeight: venueTab===t.id ? 600 : 400,
              background: venueTab===t.id ? color : "transparent",
              color: venueTab===t.id ? "#fff" : C.dim,
              transition:"all .15s",
            }}>{t.label}</button>
          ))}
        </div>
        <Legend />
        <WeatherBlock stats={stats} color={color} label={venueTab==="home"?"domicile":"extérieur"} />
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize:11, color:C.dim, marginBottom:16, lineHeight:1.7 }}>
        Performance météo · Dom. = matchs joués à domicile · Ext. = matchs joués à l'extérieur.
        Source : <strong>Open-Meteo</strong> · Tranches de 5°C · 3 niveaux de pluie.
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <TeamWeatherCard teamData={data.home} color={C.accent} matchSide="Joue à domicile ce match" />
        <TeamWeatherCard teamData={data.away} color={C.blue}   matchSide="Joue à l'extérieur ce match" />
      </div>
    </div>
  );
}

// Compétitions avec phases de groupes → apiId + saison
const GROUP_STAGE_COMPS = {
  wc:    { apiId:1,   season:2026 },
  euro:  { apiId:4,   season:2024 },
  copa:  { apiId:9,   season:2024 },
  afcon: { apiId:6,   season:2023 },
  afc:   { apiId:7,   season:2023 },
  conca: { apiId:26,  season:2023 },
  cdc:   { apiId:22,  season:2025 },
  ucl:   { apiId:2,   season:null },
  uel:   { apiId:3,   season:null },
  lib:   { apiId:11,  season:2025 },
};

// ============================================================
// Groupes de compétition (CdM, Euro, Copa, etc.)
// ============================================================
function LeagueGroups({ compId, fixtures, onGroupClick, onTeamClick, activeTeamIds }) {
  const cfg    = GROUP_STAGE_COMPS[compId];
  const [groups,  setGroups]  = useState([]);
  const [loading, setLoading] = useState(true);
  const now = new Date().getFullYear();
  const season = cfg?.season || (now >= 6 ? now : now - 1);

  useEffect(() => {
    if (!cfg) return;
    setLoading(true);
    fetchStandings(cfg.apiId, season)
      .then(d => { setGroups(d || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [compId]);

  if (!cfg) return null;
  if (loading) return <InfoPanel>Chargement des groupes…</InfoPanel>;

  // Fallback : parser les groupes depuis les fixtures si standings vide
  const groupsData = groups.length > 0 ? groups : (() => {
    const map = {};
    fixtures.forEach(f => {
      const m = (f.round || "").match(/Group ([A-L])/i);
      if (!m) return;
      const g = `Group ${m[1].toUpperCase()}`;
      if (!map[g]) map[g] = {};
      [f.home, f.away].forEach(t => { if (t?.id) map[g][t.id] = t; });
    });
    return Object.entries(map).sort(([a],[b])=>a.localeCompare(b)).map(([gname, teams]) =>
      Object.values(teams).map(t => ({ rank:0, group:gname, team:t, played:0,won:0,drawn:0,lost:0,gf:0,ga:0,points:0 }))
    );
  })();

  if (!groupsData.length) return null;

  const activeSet = new Set(activeTeamIds || []);

  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ fontSize:10, fontWeight:600, color:C.dim, textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>
        Phases de groupes · {groupsData.length} groupes
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(175px, 1fr))", gap:10 }}>
        {groupsData.map((group, gi) => {
          const gname = group[0]?.group || `Groupe ${gi+1}`;
          const tids  = group.map(e => e.team.id);
          const gActive = tids.length > 0 && tids.every(id => activeSet.has(id));
          return (
            <div key={gname} style={{
              background: gActive ? C.accentBg : C.panel,
              border:`1px solid ${gActive ? C.accent : C.line}`,
              borderRadius:10, overflow:"hidden",
            }}>
              {/* En-tête du groupe */}
              <button onClick={() => onGroupClick(tids)} style={{
                width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between",
                background:gActive ? `${C.accent}18` : C.panel2,
                border:"none", borderBottom:`1px solid ${C.line}`,
                padding:"7px 10px", cursor:"pointer",
              }}>
                <span style={{ fontSize:11, fontWeight:700, color:gActive ? C.accent : C.text }}>{gname}</span>
                <span style={{ fontSize:9, color:C.dim }}>Voir matchs →</span>
              </button>
              {/* Équipes */}
              {group.map(e => {
                const tActive = activeSet.has(e.team.id) && !gActive;
                return (
                  <button key={e.team.id} onClick={() => onTeamClick(e.team.id)} style={{
                    width:"100%", display:"flex", alignItems:"center", gap:7,
                    background: tActive ? `${C.accent}10` : "none",
                    border:"none", borderBottom:`1px solid ${C.line}44`,
                    padding:"6px 10px", cursor:"pointer",
                  }}>
                    <TeamLogo url={e.team.logo} size={18} name={e.team.name} />
                    <span style={{ flex:1, fontSize:11, color: tActive ? C.accent : C.text, fontWeight: tActive ? 600 : 400, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", textAlign:"left" }}>{e.team.name}</span>
                    {e.played > 0 && <span style={{ fontSize:10, fontWeight:700, color:C.dim, flexShrink:0 }}>{e.points}pts</span>}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// ============================================================
// Affichage des cotes d'un match
// ============================================================
function OddsDisplay({ fixtureId }) {
  const [odds,    setOdds]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!fixtureId) return;
    setOdds(null); setLoading(true);
    fetchOdds(fixtureId)
      .then(d => { setOdds(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [fixtureId]);

  if (loading || !odds) return null; // invisible si pas de cotes

  const OddChip = ({ label, value, color }) => (
    value ? (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2, background:C.panel2, borderRadius:8, padding:"6px 12px", minWidth:52 }}>
        <span style={{ fontSize:9, color:C.dim, textTransform:"uppercase", letterSpacing:.5 }}>{label}</span>
        <span style={{ fontSize:14, fontWeight:700, color: color || C.accent }}>{value}</span>
      </div>
    ) : null
  );

  return (
    <div style={{ background:C.panel, border:`1px solid ${C.line}`, borderRadius:10, padding:"10px 16px", marginBottom:8, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
      {/* Bookmaker */}
      <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
        {odds.logo && <img src={odds.logo} width={16} height={16} style={{ objectFit:"contain" }} onError={e=>e.target.style.display="none"} />}
        <span style={{ fontSize:10, fontWeight:600, color:C.dim }}>{odds.bookmaker}</span>
      </div>
      <div style={{ width:1, height:28, background:C.line, flexShrink:0 }} />
      {/* 1X2 */}
      {(odds.win?.home || odds.win?.draw || odds.win?.away) && (
        <div style={{ display:"flex", gap:5 }}>
          <OddChip label="1" value={odds.win?.home} color={C.accent} />
          <OddChip label="X" value={odds.win?.draw} color={C.dim} />
          <OddChip label="2" value={odds.win?.away} color={C.blue} />
        </div>
      )}
      {/* Over/Under */}
      {(odds.ou25?.over || odds.ou25?.under) && (
        <>
          <div style={{ width:1, height:28, background:C.line, flexShrink:0 }} />
          <div style={{ display:"flex", gap:5 }}>
            <OddChip label="+2.5" value={odds.ou25?.over}  color="#10B981" />
            <OddChip label="-2.5" value={odds.ou25?.under} color="#F59E0B" />
          </div>
        </>
      )}
      {/* BTTS */}
      {(odds.btts?.yes || odds.btts?.no) && (
        <>
          <div style={{ width:1, height:28, background:C.line, flexShrink:0 }} />
          <div style={{ display:"flex", gap:5 }}>
            <OddChip label="BTTS O" value={odds.btts?.yes} color="#10B981" />
            <OddChip label="BTTS N" value={odds.btts?.no}  color="#F59E0B" />
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// Calculateur de paris flottant
// ============================================================
function BetCalculator() {
  const [open, setOpen] = useState(false);
  const [bets, setBets] = useState([{ cote:"", mise:"" }]);
  const [mode, setMode] = useState("simple");

  const totalCote = bets.reduce((acc, b) => acc * (parseFloat(b.cote)||1), 1);
  const mise = parseFloat(bets[0]?.mise||0);
  const gainCombine = mode==="combine" ? totalCote * mise : 0;
  const profitCombine = gainCombine - mise;

  return (
    <>
      <button onClick={() => setOpen(o=>!o)} style={{
        position:"fixed", bottom:24, left:24, zIndex:199,
        width:46, height:46, borderRadius:"50%", border:"none",
        background:"#16a34a", color:"#fff", fontSize:18, cursor:"pointer",
        boxShadow:"0 4px 16px rgba(22,163,74,.4)",
        display:"flex", alignItems:"center", justifyContent:"center",
      }}>🧮</button>

      {open && (
        <div style={{
          position:"fixed", bottom:80, left:24, zIndex:199,
          width:300, background:C.panel, border:`1px solid ${C.line}`,
          borderRadius:14, padding:16, boxShadow:"0 8px 24px rgba(3,45,96,.15)",
        }} onClick={e=>e.stopPropagation()}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <span style={{ fontSize:13, fontWeight:700, color:C.text }}>🧮 Calculateur</span>
            <div style={{ display:"flex", gap:4 }}>
              {["simple","combine"].map(m => (
                <button key={m} onClick={()=>setMode(m)} style={{
                  border:`1px solid ${mode===m?C.green:C.line}`, borderRadius:6,
                  padding:"3px 8px", cursor:"pointer", fontSize:10, fontWeight:600,
                  background:mode===m?"#D1FAE5":"none", color:mode===m?"#065F46":C.dim,
                }}>{m==="simple"?"Simples":"Combiné"}</button>
              ))}
            </div>
          </div>

          {mode==="simple" ? (
            <>
              {bets.map((b,i) => (
                <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 1fr auto", gap:6, marginBottom:6 }}>
                  <input placeholder="Cote (ex: 1.80)" value={b.cote}
                    onChange={e => { const n=[...bets]; n[i].cote=e.target.value; setBets(n); }}
                    style={{ padding:"6px 8px", borderRadius:6, border:`1px solid ${C.line}`, background:C.panel2, color:C.text, fontSize:12, outline:"none" }}/>
                  <input placeholder="Mise (€)" value={b.mise}
                    onChange={e => { const n=[...bets]; n[i].mise=e.target.value; setBets(n); }}
                    style={{ padding:"6px 8px", borderRadius:6, border:`1px solid ${C.line}`, background:C.panel2, color:C.text, fontSize:12, outline:"none" }}/>
                  {bets.length > 1 && <button onClick={()=>setBets(bets.filter((_,j)=>j!==i))} style={{ background:"none", border:"none", cursor:"pointer", color:"#ef4444", fontSize:14 }}>✕</button>}
                </div>
              ))}
              <button onClick={()=>setBets([...bets,{cote:"",mise:""}])} style={{ width:"100%", background:"none", border:`1px dashed ${C.line}`, borderRadius:6, padding:"5px", cursor:"pointer", fontSize:11, color:C.dim, marginBottom:10 }}>+ Ajouter un pari</button>
              <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                {bets.map((b,i) => {
                  const g = (parseFloat(b.cote)||1) * (parseFloat(b.mise)||0);
                  const p = g - (parseFloat(b.mise)||0);
                  if (!b.mise || !b.cote) return null;
                  return (
                    <div key={i} style={{ background:C.panel2, borderRadius:8, padding:"8px 10px", display:"flex", justifyContent:"space-between" }}>
                      <span style={{ fontSize:11, color:C.dim }}>Pari {i+1} ({b.cote})</span>
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontSize:12, fontWeight:700, color:p>0?"#16a34a":"#ef4444" }}>Retour: {g.toFixed(2)}€</div>
                        <div style={{ fontSize:10, color:p>0?"#16a34a":"#ef4444" }}>{p>0?"+":""}{p.toFixed(2)}€</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {bets.map((b,i) => (
                <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:6, marginBottom:6 }}>
                  <input placeholder={`Cote ${i+1}`} value={b.cote}
                    onChange={e => { const n=[...bets]; n[i].cote=e.target.value; setBets(n); }}
                    style={{ padding:"6px 8px", borderRadius:6, border:`1px solid ${C.line}`, background:C.panel2, color:C.text, fontSize:12, outline:"none" }}/>
                  {bets.length > 1 && <button onClick={()=>setBets(bets.filter((_,j)=>j!==i))} style={{ background:"none", border:"none", cursor:"pointer", color:"#ef4444", fontSize:14 }}>✕</button>}
                </div>
              ))}
              <button onClick={()=>setBets([...bets,{cote:"",mise:""}])} style={{ width:"100%", background:"none", border:`1px dashed ${C.line}`, borderRadius:6, padding:"5px", cursor:"pointer", fontSize:11, color:C.dim, marginBottom:8 }}>+ Sélection</button>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:10 }}>
                <input placeholder="Mise totale (€)" value={bets[0]?.mise||""}
                  onChange={e => { const n=[...bets]; n[0].mise=e.target.value; setBets(n); }}
                  style={{ padding:"6px 8px", borderRadius:6, border:`1px solid ${C.line}`, background:C.panel2, color:C.text, fontSize:12, outline:"none" }}/>
                <div style={{ background:C.panel2, borderRadius:6, padding:"6px 8px", fontSize:11, color:C.dim, display:"flex", alignItems:"center" }}>
                  Cote: {totalCote.toFixed(2)}
                </div>
              </div>
              {mise > 0 && (
                <div style={{ background:"#D1FAE5", border:"1px solid #A7F3D0", borderRadius:8, padding:"10px 12px" }}>
                  <div style={{ fontSize:11, color:"#065F46" }}>Retour potentiel</div>
                  <div style={{ fontSize:18, fontWeight:800, color:"#065F46" }}>{gainCombine.toFixed(2)}€</div>
                  <div style={{ fontSize:11, color:profitCombine>=0?"#16a34a":"#ef4444" }}>
                    {profitCombine>=0?"+":""}{profitCombine.toFixed(2)}€ de profit
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}

// Zone principale : analyse d'une compétition
// ============================================================
function AnalysisZone({ compId, allData, onDataLoaded, logoRegistry = {}, pendingFixture, onClearPending, pendingTeam, onClearPendingTeam, onGoHistory, favorites = [], onToggleFavorite, isFavorite = () => false, onOpenClub }) {
  const [tab,           setTab]          = useState("resultat");
  const [selectedId,    setSelectedId]   = useState(null);
  const [matchSelected, setMatchSelected]= useState(false);
  const [matchLoading,  setMatchLoading] = useState(false);
  const [matchError,    setMatchError]   = useState("");
  const [compLoading,   setCompLoading]  = useState(false);
  const [compError,     setCompError]    = useState("");
  const [period,        setPeriod]       = useState(365);
  const [showPreMatch,  setShowPreMatch] = useState(false);
  const [groupTeamIds,  setGroupTeamIds] = useState(null); // filtre groupes/équipes

  const [rebuilding, setRebuilding] = useState(false);

  const stored    = allData[compId];
  const fixtures  = stored?.recentFixtures || [];
  const isOldData = stored && !stored.home?.periods; // données sans multi-périodes
  // defaultId = premier match PASSÉ = ce que le serveur affiche initialement
  const defaultId = fixtures.find(f => f.status !== "upcoming" && f.score != null)?.id
    ?? fixtures[0]?.id;

  async function handleRebuild() {
    setRebuilding(true);
    try {
      await fetch("/api/football?refresh=1");
      window.location.reload();
    } catch { setRebuilding(false); }
  }

  useEffect(() => { setTab("resultat"); setSelectedId(null); setCompError(""); setMatchError(""); setMatchSelected(false); setShowPreMatch(false); setGroupTeamIds(null); }, [compId]);

  // Auto-sélection d'un match depuis l'accueil
  useEffect(() => {
    if (!pendingFixture || pendingFixture.compId !== compId) return;
    if (compLoading) return;
    handleSelectFixture(pendingFixture.fixtureId);
    onClearPending?.();
  }, [pendingFixture, compId, compLoading, stored]);

  // Auto-filtre par équipe depuis la recherche
  useEffect(() => {
    if (!pendingTeam || pendingTeam.compId !== compId) return;
    if (compLoading) return;
    setGroupTeamIds([pendingTeam.teamId]);
    onClearPendingTeam?.();
  }, [pendingTeam, compId, compLoading]);

  useEffect(() => {
    if (stored || !LAZY_IDS.has(compId)) return;
    setCompLoading(true);
    fetchCompetition(compId)
      .then(payload => { onDataLoaded(compId, payload); setCompLoading(false); })
      .catch(e => { setCompError(e.message); setCompLoading(false); });
  }, [compId]);

  async function handleSelectFixture(fixtureId) {
    // Comparaison stricte en nombre pour éviter les faux positifs string vs number
    const numId = Number(fixtureId);
    const currentId = selectedId != null ? Number(selectedId) : (defaultId != null ? Number(defaultId) : null);
    if (numId === currentId && matchSelected) return;
    setSelectedId(numId);
    setMatchSelected(true);
    setMatchError("");
    setMatchLoading(true);
    try {
      const payload = await fetchMatch(compId, numId);
      onDataLoaded(compId, payload, true);
    } catch(e) {
      console.error("[match]", e.message);
      setMatchError(e.message);
    }
    finally { setMatchLoading(false); }
  }

  if (compLoading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:200 }}>
      <div style={{ textAlign:"center", color:C.dim }}>
        <div style={{ fontSize:32, marginBottom:12 }}>⏳</div>
        <div style={{ fontSize:14, marginBottom:6 }}>Chargement de la compétition…</div>
        <div style={{ fontSize:12 }}>Première consultation — environ 20 secondes.</div>
      </div>
    </div>
  );

  if (compError) return <InfoPanel tone="error">{compError}</InfoPanel>;
  if (!stored) return <InfoPanel>Données indisponibles. Vérifie que le backend tourne.</InfoPanel>;

  const m = showPreMatch && stored?.home?.prePeriods
    ? mapLeague({ ...stored, home: { ...stored.home, periods: stored.home.prePeriods }, away: { ...stored.away, periods: stored.away.prePeriods } }, period)
    : mapLeague(stored, period);

  const isUpcomingMatch = stored?.score?.includes("?") || false;

  const currentFixtureId = selectedId ?? defaultId;
  const currentFixture   = fixtures.find(f => f.id === currentFixtureId);
  const homeTeamId       = currentFixture?.home?.id;
  const awayTeamId       = currentFixture?.away?.id;
  const now              = new Date();
  const currentSeason    = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;

  return (
    <div>
      {/* Barre ligue + période */}
      <div style={{
        display:"flex", alignItems:"center", gap:10, paddingBottom:14,
        marginBottom:16, borderBottom:`1px solid ${C.line}`,
      }}>
        <LeagueLogo url={stored.leagueLogo} size={18} />
        <span style={{ fontSize:14, fontWeight:500, color:C.text }}>{stored.league || "—"}</span>
        {/* Boutons favoris des deux équipes si match sélectionné */}
        {matchSelected && currentFixture?.home && currentFixture?.away && (
          <div style={{ display:"flex", gap:6, marginLeft:8 }}>
            {[
              { id: currentFixture.home.id, name: currentFixture.home.name, logo: currentFixture.home.logo || logoRegistry[currentFixture.home.id] || "", leagueId: compId, leagueName: stored.league },
              { id: currentFixture.away.id, name: currentFixture.away.name, logo: currentFixture.away.logo || logoRegistry[currentFixture.away.id] || "", leagueId: compId, leagueName: stored.league },
            ].filter(club => club.id).map(club => (
              <button key={club.id} onClick={() => onToggleFavorite(club)} style={{
                background:"none", border:`1px solid ${isFavorite(club.id) ? "#f97316" : C.line}`,
                borderRadius:20, padding:"3px 10px", cursor:"pointer", fontSize:11,
                color: isFavorite(club.id) ? "#f97316" : C.muted,
                display:"flex", alignItems:"center", gap:4,
              }}>
                {isFavorite(club.id) ? "⭐" : "☆"} {club.name}
              </button>
            ))}
          </div>
        )}
        <div style={{ flex:1 }} />
        {/* Lien vers l'historique de ce championnat */}
        {onGoHistory && (() => {
          const LEAGUES_CFG = [
            {id:"fr",apiId:61},{id:"en",apiId:39},{id:"it",apiId:135},{id:"de",apiId:78},{id:"es",apiId:140},{id:"pt",apiId:94},
            {id:"ucl",apiId:2},{id:"uel",apiId:3},{id:"uecl",apiId:848},{id:"wc",apiId:1},{id:"euro",apiId:4},{id:"copa",apiId:9},
            {id:"afcon",apiId:6},{id:"nl",apiId:5},{id:"cdc",apiId:22},{id:"lib",apiId:11},{id:"en_fac",apiId:45},
            {id:"fr_cup",apiId:65},{id:"de_cup",apiId:81},{id:"es_cup",apiId:143},{id:"it_cup",apiId:137},
          ];
          const historyEntry = HISTORY_CATALOG.flatMap(c=>c.items).find(item =>
            item.apiId === (LEAGUES_CFG.find(l=>l.id===compId)?.apiId)
          );
          if (!historyEntry) return null;
          return (
            <button onClick={() => onGoHistory(historyEntry)} style={{
              display:"flex", alignItems:"center", gap:6,
              background:"#F3E8FF", border:"1px solid #C4B5FD",
              borderRadius:20, padding:"4px 12px", cursor:"pointer",
              fontSize:11, fontWeight:600, color:"#7C3AED",
            }}>
              📚 Historique
            </button>
          );
        })()}
        <PeriodSelector period={period} onChange={setPeriod} />
      </div>

      {/* Bandeau données v1 (sans multi-périodes) */}
      {isOldData && (
        <div style={{
          display:"flex", alignItems:"center", gap:10, marginBottom:14,
          background:C.warnBg, border:"1px solid #FDE68A",
          borderRadius:10, padding:"10px 14px",
        }}>
          <span style={{ fontSize:18 }}>⚠️</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12, fontWeight:600, color:"#92400E" }}>Données anciennes (v1)</div>
            <div style={{ fontSize:11, color:"#B45309", marginTop:2 }}>
              Les logos dans les tuiles et le filtre 90j/182j nécessitent une reconstruction.
              Redémarre le backend <span style={{ fontFamily:"monospace", background:C.panel2, padding:"1px 5px", borderRadius:3 }}>node src\server.js</span> ou clique sur Reconstruire (~3 min).
            </div>
          </div>
          <button
            onClick={handleRebuild}
            disabled={rebuilding}
            style={{
              background: rebuilding ? C.panel2 : "#F59E0B", border:"none", borderRadius:8,
              color: rebuilding ? C.dim : "#fff", fontWeight:600, fontSize:12,
              padding:"7px 14px", cursor: rebuilding ? "wait" : "pointer",
              flexShrink:0,
            }}
          >{rebuilding ? "Reconstruction…" : "Reconstruire"}</button>
        </div>
      )}

      {/* Groupes (CdM, Euro, Copa, etc.) */}
      {GROUP_STAGE_COMPS[compId] && (
        <LeagueGroups
          compId={compId}
          fixtures={fixtures}
          activeTeamIds={groupTeamIds}
          onGroupClick={tids => setGroupTeamIds(prev =>
            prev && prev.length === tids.length && tids.every(id => prev.includes(id)) ? null : tids
          )}
          onTeamClick={tid => setGroupTeamIds(prev =>
            prev?.length === 1 && prev[0] === tid ? null : [tid]
          )}
        />
      )}

      {/* Sélecteur de matchs — TOUJOURS visible */}
      <MatchPanel
        fixtures={fixtures}
        selectedId={selectedId}
        defaultId={defaultId}
        onSelect={handleSelectFixture}
        loading={matchLoading}
        logoRegistry={logoRegistry}
        filterTeamIds={groupTeamIds}
      />

      {/* Séries actuelles */}
      {(() => {
        if (!stored?.recentFixtures?.length) return null;
        const FINISHED = new Set(["FT","AET","PEN"]);
        const teamId1 = currentFixture?.home?.id;
        const teamId2 = currentFixture?.away?.id;
        if (!teamId1 || !teamId2) return null;

        function getStreaks(teamId, fxList) {
          const teamFx = fxList
            .filter(f => FINISHED.has(f.status) && (f.home?.id===teamId || f.away?.id===teamId))
            .sort((a,b) => new Date(b.date)-new Date(a.date));

          const streaks = { wins:0, unbeaten:0, btts:0, over25:0 };

          for (const f of teamFx) {
            const isHome = f.home?.id===teamId;
            const [gf,ga] = f.score ? f.score.split(" - ").map(Number) : [0,0];
            const teamGf = isHome ? gf : ga;
            const teamGa = isHome ? ga : gf;
            const res = teamGf>teamGa?"W":teamGf<teamGa?"L":"D";
            if (res==="W") streaks.wins++; else break;
          }
          let streak=0;
          for (const f of teamFx) {
            const isHome=f.home?.id===teamId;
            const [gf,ga]=f.score?f.score.split(" - ").map(Number):[0,0];
            const tGf=isHome?gf:ga,tGa=isHome?ga:gf;
            if(tGf>=tGa){streak++;}else break;
          }
          streaks.unbeaten=streak;
          streak=0;
          for(const f of teamFx){
            const isHome=f.home?.id===teamId;
            const [gf,ga]=f.score?f.score.split(" - ").map(Number):[0,0];
            const tGf=isHome?gf:ga,tGa=isHome?ga:gf;
            if(tGf>0&&tGa>0)streak++;else break;
          }
          streaks.btts=streak;
          streak=0;
          for(const f of teamFx){
            const [gf,ga]=f.score?f.score.split(" - ").map(Number):[0,0];
            if(gf+ga>2)streak++;else break;
          }
          streaks.over25=streak;
          return streaks;
        }

        const s1=getStreaks(teamId1, fixtures);
        const s2=getStreaks(teamId2, fixtures);
        const homeName=currentFixture?.home?.name||"";
        const awayName=currentFixture?.away?.name||"";

        const items=[
          { label:"Sans défaite", h:s1.unbeaten, a:s2.unbeaten, color:"#16a34a", icon:"🛡" },
          { label:"Victoires consécutives", h:s1.wins, a:s2.wins, color:C.accent, icon:"🔥" },
          { label:"BTTS consécutifs", h:s1.btts, a:s2.btts, color:"#7C3AED", icon:"⚽" },
          { label:"Over 2.5 consécutifs", h:s1.over25, a:s2.over25, color:"#d97706", icon:"📈" },
        ].filter(i=>i.h>0||i.a>0);

        if(!items.length) return null;

        return (
          <div style={{ marginBottom:14, background:C.panel, border:`1px solid ${C.line}`, borderRadius:12, padding:"12px 16px" }}>
            <div style={{ fontSize:10, color:C.dim, fontWeight:700, textTransform:"uppercase", letterSpacing:.8, marginBottom:10 }}>🔥 Séries en cours</div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {items.map(item=>(
                <div key={item.label} style={{ display:"grid", gridTemplateColumns:"50px 1fr 50px", alignItems:"center", gap:8 }}>
                  <div style={{ textAlign:"center" }}>
                    {item.h>0&&<span style={{ background:`${item.color}18`, color:item.color, borderRadius:20, padding:"2px 8px", fontSize:12, fontWeight:800 }}>{item.h}</span>}
                  </div>
                  <div style={{ textAlign:"center", fontSize:10, color:C.dim }}>{item.icon} {item.label}</div>
                  <div style={{ textAlign:"center" }}>
                    {item.a>0&&<span style={{ background:`${item.color}18`, color:item.color, borderRadius:20, padding:"2px 8px", fontSize:12, fontWeight:800 }}>{item.a}</span>}
                  </div>
                </div>
              ))}
              <div style={{ display:"grid", gridTemplateColumns:"50px 1fr 50px", fontSize:9, color:C.muted, textAlign:"center", marginTop:2 }}>
                <span>{homeName.split(" ").slice(-1)[0]}</span><span></span><span>{awayName.split(" ").slice(-1)[0]}</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Contenu — conditionnel */}
      {!matchSelected ? (
        <CompetitionOverview
          stored={stored}
          fixtures={fixtures}
          leagueFlag={NAV.flatMap(s => s.groups.flatMap(g => g.items)).find(i => i.id === compId)?.flag || "⚽"}
        />
      ) : matchLoading ? (
        <InfoPanel>Chargement du match…</InfoPanel>
      ) : matchError ? (
        <InfoPanel tone="error">❌ {matchError}</InfoPanel>
      ) : (
        <>
          {stored?.home?.prePeriods && !isUpcomingMatch && (
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
              <span style={{ fontSize:11, color:C.dim }}>Stats :</span>
              <div style={{ display:"flex", background:C.panel2, borderRadius:8, padding:3, gap:2 }}>
                {[
                  { id:false, label:"Actuelles" },
                  { id:true,  label:"Avant le match" },
                ].map(opt => (
                  <button key={String(opt.id)} onClick={() => setShowPreMatch(opt.id)} style={{
                    border:"none", cursor:"pointer", padding:"5px 12px", borderRadius:6,
                    fontSize:11, fontWeight:showPreMatch===opt.id ? 600 : 400,
                    background:showPreMatch===opt.id ? C.accent : "transparent",
                    color:showPreMatch===opt.id ? "#fff" : C.dim,
                    transition:"all .15s",
                  }}>{opt.label}</button>
                ))}
              </div>
              {showPreMatch && <span style={{ fontSize:10, color:C.dim, fontStyle:"italic" }}>Données au {new Date(currentFixture?.date||"").toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"})}</span>}
            </div>
          )}
          <MatchCard m={m} />
          {/* Boutons fiche club sous le match */}
          {currentFixture && (
            <div style={{ display:"flex", gap:8, marginTop:6, justifyContent:"center" }}>
              {[
                { id:currentFixture.home?.id, name:currentFixture.home?.name, logo:logoRegistry[currentFixture.home?.id]||currentFixture.home?.logo||"" },
                { id:currentFixture.away?.id, name:currentFixture.away?.name, logo:logoRegistry[currentFixture.away?.id]||currentFixture.away?.logo||"" },
              ].filter(c=>c.id).map(club => (
                <button key={club.id} onClick={() => onOpenClub?.({ ...club, leagueId:compId, leagueName:stored.league })} style={{
                  display:"flex", alignItems:"center", gap:6,
                  background:C.panel2, border:`1px solid ${C.line}`,
                  borderRadius:20, padding:"4px 12px", cursor:"pointer", fontSize:11, color:C.dim,
                  transition:"all .15s",
                }}
                  onMouseEnter={e=>{ e.currentTarget.style.borderColor=C.accent; e.currentTarget.style.color=C.accent; }}
                  onMouseLeave={e=>{ e.currentTarget.style.borderColor=C.line; e.currentTarget.style.color=C.dim; }}
                >
                  {club.logo && <img src={club.logo} width={14} height={14} style={{ objectFit:"contain" }} onError={e=>e.target.style.display="none"} />}
                  <span>{club.name}</span>
                  <span style={{ color:isFavorite(club.id)?"#f97316":C.muted }}>{isFavorite(club.id)?"⭐":"☆"}</span>
                </button>
              ))}
            </div>
          )}
          <OddsDisplay fixtureId={selectedId ?? defaultId} />
          {matchSelected && currentFixture && (
            <InjuryReport
              homeTeamId={currentFixture.home?.id}
              awayTeamId={currentFixture.away?.id}
              homeName={m.home.name}
              awayName={m.away.name}
            />
          )}
          <div style={{ marginTop:20 }}>
            <TabBar tab={tab} setTab={setTab} />
            <div style={{ marginTop:20 }}>
              {tab==="resultat"    && <TabResultat m={m} period={period} />}
              {tab==="stats_match" && <TabMatchStats fixtureId={selectedId ?? defaultId} />}
              {tab==="timeline"    && <TabTimeline fixtureId={selectedId ?? defaultId} homeName={m.home.name} awayName={m.away.name} homeId={currentFixture?.home?.id} />}
              {tab==="preview"     && <TabPreview m={m} compId={compId} />}
              {tab==="double"      && <TabDoubleChance m={m} />}
              {tab==="ecart"       && <TabEcart m={m} />}
              {tab==="buteur"      && <TabButeur m={m} period={period} />}
              {tab==="buts"        && <TabButs m={m} period={period} />}
              {tab==="timing"      && <TabTiming m={m} />}
              {tab==="btts"        && <TabBTTS m={m} period={period} />}
              {tab==="penalty"     && <TabPenalty m={m} />}
              {tab==="compo"       && <TabCompo homeId={homeTeamId} awayId={awayTeamId} homeName={m.home.name} awayName={m.away.name} season={currentSeason} fixtureId={selectedId ?? defaultId} />}
              {tab==="meteo"       && <TabMeteo compId={compId} fixtureId={selectedId ?? defaultId} />}
              {tab==="classement"  && <TabClassement compId={compId} />}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// APP
// ============================================================
export default function App() {
  const [token,       setToken]      = useState(() => localStorage.getItem("es_token") || "");
  const [showLogin,   setShowLogin]  = useState(false);

  // Mode public : connexion automatique au premier chargement si le serveur le permet
  useEffect(() => {
    if (token) return; // déjà connecté
    login("").then(res => {
      if (res?.public) { // serveur sans mot de passe
        localStorage.setItem("es_token", res.token);
        setToken(res.token);
      }
    }).catch(() => {}); // mode privé → laisser le modal apparaître normalement
  }, []);
  const [sport,       setSport]      = useState("home");
  const [compId,      setCompId]     = useState("fr");
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem("edgestat_favorites") || "[]"); }
    catch { return []; }
  });
  const [pendingFixture,  setPendingFixture]  = useState(null); // { compId, fixtureId }
  const [historyInitComp, setHistoryInitComp] = useState(null); // pré-sélection HistoryView
  const [globalPlayer,   setGlobalPlayer]   = useState(null); // { id, name } → modal joueur global
  const [globalClub,     setGlobalClub]     = useState(null); // { id, name, logo } → modal club
  const [pendingTeam,    setPendingTeam]     = useState(null); // { compId, teamId } → filtre équipe
  const [tennisId,    setTennisId]   = useState("2"); // Roland Garros par défaut
  const [allData,      setAllData]     = useState({});
  const [leagueLogos,  setLeagueLogos] = useState({});
  const [logoRegistry, setLogoRegistry]= useState({});
  const [teamDatabase, setTeamDatabase]= useState({});
  const [loading,      setLoading]     = useState(true);
  const [error,        setError]       = useState("");
  const [activeMatch,  setActiveMatch] = useState(null);
  const [tennisTournaments] = useState([
    { id:"atp",         name:"ATP Tour",          surface:"hard",  flag:"🎾"  },
    { id:"wta",         name:"WTA Tour",          surface:"hard",  flag:"🎾"  },
    { id:"atp-rg",      name:"Roland Garros",     surface:"clay",  flag:"🇫🇷" },
    { id:"atp-wimbledon",name:"Wimbledon",        surface:"grass", flag:"🏴"  },
    { id:"atp-uso",     name:"US Open",           surface:"hard",  flag:"🇺🇸" },
    { id:"atp-ao",      name:"Australian Open",   surface:"hard",  flag:"🇦🇺" },
  ]);

  useEffect(() => {
    localStorage.setItem("edgestat_favorites", JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    if (favorites.length === 0) return;

    async function checkNotifications() {
      if (!("Notification" in window) || Notification.permission !== "granted") return;

      for (const club of favorites) {
        const nextFixtures = Object.values(allData).flatMap(lg =>
          (lg.recentFixtures || []).filter(f =>
            (f.home?.id === club.id || f.away?.id === club.id) &&
            (f.status === "upcoming" || f.score == null)
          )
        );

        nextFixtures.forEach(f => {
          const matchDate = new Date(f.date).getTime();
          const now = Date.now();
          const diff = matchDate - now;

          const thresholds = [
            { ms: 24*60*60*1000, label: "dans 24h" },
            { ms: 60*60*1000,    label: "dans 1 heure" },
            { ms: 5*60*1000,     label: "dans 5 minutes" },
          ];

          thresholds.forEach(({ ms, label }) => {
            if (diff > 0 && diff < ms + 60000 && diff > ms - 60000) {
              const key = `notif_${f.id}_${ms}`;
              if (!sessionStorage.getItem(key)) {
                sessionStorage.setItem(key, "1");
                const opponent = f.home?.id === club.id ? f.away?.name : f.home?.name;
                new Notification(`⚽ ${club.name} joue ${label}`, {
                  body: `${f.home?.name} vs ${f.away?.name}`,
                  icon: club.logo || "/favicon.ico",
                  tag: key,
                });
              }
            }
          });
        });
      }
    }

    const interval = setInterval(checkNotifications, 60000);
    checkNotifications();
    return () => clearInterval(interval);
  }, [favorites, allData]);

  function toggleFavorite(club) {
    setFavorites(prev => {
      const exists = prev.find(f => f.id === club.id);
      if (exists) return prev.filter(f => f.id !== club.id);
      return [...prev, club];
    });
  }

  function isFavorite(clubId) {
    return favorites.some(f => f.id === clubId);
  }

  useEffect(() => {
    fetchFootball()
      .then(payload => {
        const data = {}, logos = {}, teamLgos = {}, teamDb = {};
        for (const [id, lg] of Object.entries(payload.leagues || {})) {
          data[id] = lg;
          if (lg.leagueLogo) logos[id] = lg.leagueLogo;
          if (lg.home?.id && lg.home?.logo) teamLgos[lg.home.id] = lg.home.logo;
          if (lg.away?.id && lg.away?.logo) teamLgos[lg.away.id] = lg.away.logo;
          (lg.recentFixtures || []).forEach(f => {
            if (f.home?.id && f.home?.logo) teamLgos[f.home.id] = f.home.logo;
            if (f.away?.id && f.away?.logo) teamLgos[f.away.id] = f.away.logo;
          });
          // Base équipes pour le chat
          const mapped = mapLeague(lg);
          if (mapped.home?.name) teamDb[mapped.home.name] = { ...mapped.home, league: mapped.league };
          if (mapped.away?.name) teamDb[mapped.away.name] = { ...mapped.away, league: mapped.league };
        }
        setAllData(data);
        setLeagueLogos(logos);
        setLogoRegistry(teamLgos);
        setTeamDatabase(teamDb);
        if (data.fr) setActiveMatch(mapLeague(data.fr));
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  function handleDataLoaded(id, payload, matchOnly = false) {
    setAllData(prev => {
      const existing = prev[id] || {};
      if (matchOnly) {
        return { ...prev, [id]: { ...payload, recentFixtures: existing.recentFixtures || [] } };
      }
      return { ...prev, [id]: payload };
    });
    if (payload.leagueLogo) setLeagueLogos(prev => ({ ...prev, [id]: payload.leagueLogo }));
    // Enrichir le registre avec les logos des deux équipes du match chargé
    const newLgos = {};
    if (payload.home?.id && payload.home?.logo) newLgos[payload.home.id] = payload.home.logo;
    if (payload.away?.id && payload.away?.logo) newLgos[payload.away.id] = payload.away.logo;
    if (Object.keys(newLgos).length) setLogoRegistry(prev => ({ ...prev, ...newLgos }));
    const mapped = mapLeague(payload);
    setActiveMatch(mapped);
    // Enrichir la base équipes
    const dbUpdates = {};
    if (mapped.home?.name) dbUpdates[mapped.home.name] = { ...mapped.home, league: mapped.league };
    if (mapped.away?.name) dbUpdates[mapped.away.name] = { ...mapped.away, league: mapped.league };
    if (Object.keys(dbUpdates).length) setTeamDatabase(prev => ({ ...prev, ...dbUpdates }));
  }

  function handleSelectComp(id) {
    setCompId(id);
    if (allData[id]) setActiveMatch(mapLeague(allData[id]));
  }

  // Navigation depuis l'accueil (live ou à venir) → page de la compétition + match sélectionné
  function handleMatchClick(f) {
    const cid = f.compId;
    if (!cid) return; // Compétition non suivie — clic silencieux
    setPendingFixture({ compId: cid, fixtureId: f.id });
    setSport("foot");
    setCompId(cid);
    if (allData[cid]) setActiveMatch(mapLeague(allData[cid]));
  }

  return (
    <div style={{ display:"flex", height:"100vh", overflow:"hidden", background:C.bg, color:C.text, fontFamily:"'Inter', 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      {/* Modal login optionnel */}
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onLogin={setToken} />}

      {/* Sidebar */}
      <Sidebar
        activeId={compId}
        onSelect={handleSelectComp}
        leagueLogos={leagueLogos}
        sport={sport}
        onSportChange={setSport}
        token={token}
        onLoginClick={() => setShowLogin(true)}
        onLogout={() => { localStorage.removeItem("es_token"); setToken(""); }}
        tennisId={tennisId}
        onTennisSelect={(id) => setTennisId(id)}
        tennisTournaments={tennisTournaments}
        allData={allData}
        logoRegistry={logoRegistry}
        onSelectTeam={(compId, teamId) => {
          setSport("foot");
          setCompId(compId);
          setPendingTeam({ compId, teamId });
          if (allData[compId]) setActiveMatch(mapLeague(allData[compId]));
        }}
        onOpenPlayer={(id, name, tsdbId) => setGlobalPlayer({ id, name, tsdbId })}
        onOpenClub={club => setGlobalClub(club)}
      />

      {/* Contenu principal */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        {/* Header — pleine largeur */}
        <div style={{
          borderBottom:`1px solid ${C.line}`, padding:"10px 20px",
          display:"flex", alignItems:"center", justifyContent:"space-between",
          background:C.panel, zIndex:10, flexShrink:0,
        }}>
          <div style={{ fontSize:13, color:C.text, fontWeight:500 }}>
            {allData[compId]?.leagueLogo && <LeagueLogo url={allData[compId].leagueLogo} size={14} />}
            {" "}{allData[compId]?.league || "Chargement…"}
          </div>
          <button onClick={() => { localStorage.removeItem("es_token"); setToken(""); }} style={{
            border:`1px solid ${C.line}`, color:C.dim, background:C.panel, fontSize:11, borderRadius:6, padding:"5px 10px", cursor:"pointer",
          }}>Déconnexion</button>
        </div>

        {/* Zone centrale + colonne pub */}
        <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
          {/* Zone d'analyse — scrollable */}
          <div style={{ flex:1, overflowY:"auto", scrollbarWidth:"thin", scrollbarColor:`${C.line} transparent` }}>
            <div style={{ padding:"20px 24px", maxWidth:860, width:"100%", boxSizing:"border-box" }}>
              {loading ? (
                <InfoPanel>Chargement des données football…</InfoPanel>
              ) : error ? (
                <InfoPanel tone="error">{error}</InfoPanel>
              ) : sport === "favs" ? (
                <FavoritesView favorites={favorites} onToggleFavorite={toggleFavorite} />
              ) : sport === "bracket" ? (
                <BracketView />
              ) : sport === "home" ? (
                <HomeView
                  logoRegistry={logoRegistry}
                  onMatchClick={handleMatchClick}
                  onGoHistory={() => setSport("history")}
                  onGoWC={() => { setSport("foot"); setCompId("wc"); }}
                />
              ) : sport === "history" ? (
                <HistoryView initialComp={historyInitComp} onConsumeInitComp={() => setHistoryInitComp(null)} />
              ) : sport === "tennis" ? (
                <TennisView tennisId={tennisId} />
              ) : (
                <AnalysisZone compId={compId} allData={allData} onDataLoaded={handleDataLoaded} logoRegistry={logoRegistry} pendingFixture={pendingFixture} onClearPending={() => setPendingFixture(null)} pendingTeam={pendingTeam} onClearPendingTeam={() => setPendingTeam(null)}
                  onGoHistory={entry => { setHistoryInitComp(entry); setSport("history"); }}
                  onOpenClub={club => setGlobalClub(club)}
                  favorites={favorites} onToggleFavorite={toggleFavorite} isFavorite={isFavorite}
                />
              )}

              {/* Disclaimer */}
              <div style={{ marginTop:24, padding:"10px 14px", background:C.panel, border:`1px solid ${C.line}`, borderRadius:8, fontSize:11, color:C.muted, lineHeight:1.6 }}>
                Outil d'analyse statistique — données historiques uniquement, aucune prédiction. Les paris comportent un risque de perte. Jouer comporte des risques : endettement, isolement, dépendance.
              </div>
            </div>
          </div>

          {/* Colonne publicitaire droite */}
          <AdColumn />
        </div>
      </div>

      {/* Calculateur de paris */}
      <BetCalculator />

      {/* Chat IA */}
      {!loading && <ChatWidget matchContext={activeMatch} teamDatabase={teamDatabase} />}

      {/* Modal joueur global (déclenché depuis la recherche) */}
      {globalPlayer && (
        <PlayerModal
          playerId={globalPlayer.id}
          playerName={globalPlayer.name}
          tsdbId={globalPlayer.tsdbId}
          season={new Date().getMonth() >= 6 ? new Date().getFullYear() : new Date().getFullYear()-1}
          onClose={() => setGlobalPlayer(null)}
        />
      )}
      {globalClub && (
        <ClubModal
          teamId={globalClub.id}
          teamName={globalClub.name}
          teamLogo={globalClub.logo}
          isFav={isFavorite(globalClub.id)}
          onToggleFav={club => toggleFavorite({ ...club, leagueId: globalClub.leagueId||"", leagueName: globalClub.leagueName||"" })}
          onClose={() => setGlobalClub(null)}
        />
      )}
    </div>
  );
}
