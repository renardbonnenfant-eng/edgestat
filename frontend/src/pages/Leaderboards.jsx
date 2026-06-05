import { useState, useEffect } from "react";
const FX = { bg:"#141C28",card:"#1A2030",border:"#243548",accent:"#00D4AA",accentBg:"rgba(0,212,170,.12)",dark:"#D0E8F4",mid:"#8AABBD",muted:"#4A6A7A",blue:"#3b82f6",green:"#16a34a",red:"#DC2626",warn:"#d97706" };

const PLAN_COLORS = { free:{color:FX.muted}, premium:{color:FX.accent}, vip:{color:FX.warn} };
const MEDALS = ["🥇","🥈","🥉"];
const REWARDS_FREE = ["3 mois Premium","2 mois Premium","1 mois Premium"];
const REWARDS_PREMIUM = ["100€ Fnac + FoxChampion 🏆","50€ Amazon + FoxElite ⭐","1 mois VIP + FoxPro 🦊"];

function Avatar({ username, color, size=36 }) {
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", background:color||FX.accent, display:"grid", placeItems:"center", fontSize:size*.35, fontWeight:800, color:"#0A1428", flexShrink:0 }}>
      {(username||"?")[0].toUpperCase()}
    </div>
  );
}

function PlayerRow({ player, rank, rewardLabel }) {
  const isTop = rank <= 3;
  const winColor = player.win_rate >= 60 ? FX.green : player.win_rate >= 40 ? FX.warn : FX.red;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:12, background: isTop?"rgba(0,212,170,.06)":FX.card, border:`1px solid ${isTop?FX.accent+"44":FX.border}`, borderRadius:10, padding:"10px 14px", marginBottom:6 }}>
      <div style={{ width:28, textAlign:"center", flexShrink:0 }}>
        {rank <= 3 ? <span style={{ fontSize:18 }}>{MEDALS[rank-1]}</span> : <span style={{ fontSize:13, fontWeight:700, color:FX.muted }}>#{rank}</span>}
      </div>
      <Avatar username={player.username} color={player.avatar_color} size={32} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:700, color:FX.dark, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          {player.username}
          {player.plan !== "free" && <span style={{ marginLeft:6, fontSize:9, background:PLAN_COLORS[player.plan]?.color+"22", color:PLAN_COLORS[player.plan]?.color, borderRadius:4, padding:"1px 5px", fontWeight:700 }}>{player.plan.toUpperCase()}</span>}
        </div>
        {rewardLabel && <div style={{ fontSize:9, color:FX.warn, marginTop:1 }}>🎁 {rewardLabel}</div>}
      </div>
      <div style={{ display:"flex", gap:14, flexShrink:0 }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:15, fontWeight:900, color:FX.accent }}>{player.points}</div>
          <div style={{ fontSize:8, color:FX.muted, textTransform:"uppercase" }}>Pts</div>
        </div>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:13, fontWeight:700, color:winColor }}>{player.win_rate}%</div>
          <div style={{ fontSize:8, color:FX.muted, textTransform:"uppercase" }}>Réussite</div>
        </div>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:13, color:FX.mid }}>{player.pronostics_count}</div>
          <div style={{ fontSize:8, color:FX.muted, textTransform:"uppercase" }}>Pronos</div>
        </div>
        {player.current_streak > 1 && (
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:13, fontWeight:700, color:FX.warn }}>🔥{player.current_streak}</div>
            <div style={{ fontSize:8, color:FX.muted, textTransform:"uppercase" }}>Série</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Leaderboards({ userAccount }) {
  const [league, setLeague] = useState("free");
  const [period, setPeriod] = useState("current");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  const currentMonth = new Date().toISOString().slice(0,7);
  const prevMonth = new Date(new Date().setMonth(new Date().getMonth()-1)).toISOString().slice(0,7);
  const month = period === "current" ? currentMonth : period === "prev" ? prevMonth : null;

  useEffect(() => {
    setLoading(true);
    const qs = month ? `?month=${month}` : "";
    Promise.all([
      fetch(`/api/leaderboard/${league}${qs}`).then(r=>r.json()).catch(()=>[]),
      fetch("/api/pronostics/stats").then(r=>r.json()).catch(()=>null),
    ]).then(([d,s]) => { setData(Array.isArray(d)?d:[]); setStats(s); setLoading(false); });
  }, [league, period]);

  const daysLeft = () => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth()+1, 1);
    return Math.ceil((end-now)/86400000);
  };

  const rewards = league === "premium" ? REWARDS_PREMIUM : REWARDS_FREE;
  const myRank = data.findIndex(p => p.id === userAccount?.id) + 1;

  return (
    <div style={{ padding:"20px 24px", background:FX.bg, minHeight:"100%", color:FX.dark }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20 }}>
        <span style={{ fontSize:28 }}>🏆</span>
        <div>
          <div style={{ fontSize:20, fontWeight:900, color:FX.dark }}>Classements</div>
          <div style={{ fontSize:11, color:FX.muted }}>Pronostics · Points mensuels · Lots à gagner</div>
        </div>
        {stats && (
          <div style={{ marginLeft:"auto", background:FX.card, border:`1px solid ${FX.border}`, borderRadius:8, padding:"8px 14px", fontSize:11, color:FX.mid, textAlign:"center" }}>
            <strong style={{ color:FX.dark }}>{stats.total}</strong> pronos · <strong style={{ color:FX.accent }}>{stats.successRate}%</strong> réussite
          </div>
        )}
      </div>

      {/* Tabs ligue */}
      <div style={{ display:"flex", gap:8, marginBottom:14 }}>
        {[{id:"free",label:"🏅 Ligue Gratuite"},{id:"premium",label:"⭐ Ligue Premium"}].map(l => (
          <button key={l.id} onClick={()=>setLeague(l.id)} style={{
            padding:"8px 18px", borderRadius:20, border:`1px solid ${league===l.id?FX.accent:FX.border}`,
            background:league===l.id?FX.accentBg:"none", color:league===l.id?FX.accent:FX.muted,
            cursor:"pointer", fontSize:12, fontWeight:league===l.id?700:400,
          }}>{l.label}</button>
        ))}
        <div style={{ marginLeft:"auto", fontSize:11, color:FX.warn, display:"flex", alignItems:"center", gap:5 }}>
          ⏱ <strong>{daysLeft()}j</strong> avant la fin du mois
        </div>
      </div>

      {/* Tabs période */}
      <div style={{ display:"flex", gap:6, marginBottom:16 }}>
        {[{id:"current",label:"Ce mois"},{id:"prev",label:"Mois précédent"},{id:"all",label:"Tous les temps"}].map(p => (
          <button key={p.id} onClick={()=>setPeriod(p.id)} style={{
            padding:"5px 12px", borderRadius:6, border:`1px solid ${period===p.id?FX.blue:FX.border}`,
            background:period===p.id?"rgba(59,130,246,.15)":"none", color:period===p.id?FX.blue:FX.muted,
            cursor:"pointer", fontSize:11, fontWeight:period===p.id?700:400,
          }}>{p.label}</button>
        ))}
      </div>

      {/* Lots */}
      {period === "current" && (
        <div style={{ background:FX.card, border:`1px solid ${FX.warn}44`, borderRadius:10, padding:"12px 16px", marginBottom:16, display:"flex", gap:14, flexWrap:"wrap" }}>
          <span style={{ fontSize:11, color:FX.warn, fontWeight:700, alignSelf:"center" }}>🎁 Lots du mois :</span>
          {rewards.slice(0,3).map((r,i) => (
            <span key={i} style={{ fontSize:11, background:`${FX.warn}15`, color:FX.warn, border:`1px solid ${FX.warn}33`, borderRadius:20, padding:"3px 12px" }}>
              {MEDALS[i]} {r}
            </span>
          ))}
        </div>
      )}

      {/* Mon rang */}
      {myRank > 0 && (
        <div style={{ background:FX.accentBg, border:`1px solid ${FX.accent}33`, borderRadius:8, padding:"8px 14px", marginBottom:14, fontSize:12, color:FX.accent }}>
          Tu es <strong>#{myRank}</strong> dans ce classement · {data[myRank-1]?.points||0} pts
        </div>
      )}

      {loading ? (
        <div style={{ textAlign:"center", padding:"40px", color:FX.muted }}>Chargement…</div>
      ) : data.length === 0 ? (
        <div style={{ textAlign:"center", padding:"40px", color:FX.muted }}>
          <div style={{ fontSize:32, marginBottom:8 }}>🎯</div>
          Aucun pronostic encore — sois le premier !
        </div>
      ) : (
        <div>
          {data.map((player, i) => (
            <PlayerRow key={player.id} player={player} rank={i+1} rewardLabel={i<3&&period==="current"?rewards[i]:null} />
          ))}
        </div>
      )}
    </div>
  );
}
