import { useState, useEffect } from "react";
const FX = { bg:"#141C28",card:"#1A2030",border:"#243548",accent:"#00D4AA",accentBg:"rgba(0,212,170,.12)",dark:"#D0E8F4",mid:"#8AABBD",muted:"#4A6A7A",blue:"#3b82f6",green:"#16a34a",red:"#DC2626",warn:"#d97706" };

export default function Pronostics({ userAccount, nextFixtures = [], onLogin }) {
  const [myPronos, setMyPronos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ matchId:"", predResult:"", predScore:"" });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");

  const jwt = localStorage.getItem("vdk_jwt");

  const fetchMyPronos = async () => {
    if (!jwt) return;
    const r = await fetch("/api/pronostics/my", { headers:{ Authorization:`Bearer ${jwt}` } });
    if (r.ok) setMyPronos(await r.json());
  };

  useEffect(() => { fetchMyPronos(); }, []);

  const submit = async () => {
    if (!form.matchId || !form.predResult) { setMsg("Sélectionne un match et un résultat."); return; }
    setSubmitting(true); setMsg("");
    try {
      const selected = nextFixtures.find(f => f.id === parseInt(form.matchId));
      if (!selected) throw new Error("Match introuvable.");
      const r = await fetch("/api/pronostics", {
        method:"POST", headers:{"Content-Type":"application/json","Authorization":`Bearer ${jwt}`},
        body: JSON.stringify({
          matchId: String(selected.id),
          homeTeam: selected.home?.name, awayTeam: selected.away?.name,
          competition: selected.league,
          predResult: form.predResult, predScore: form.predScore || null,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMsg("✅ Pronostic soumis !");
      setForm({ matchId:"", predResult:"", predScore:"" });
      fetchMyPronos();
    } catch(e) { setMsg("❌ "+e.message); }
    finally { setSubmitting(false); }
  };

  if (!userAccount) return (
    <div style={{ padding:"60px 24px", textAlign:"center", background:FX.bg, minHeight:"100%" }}>
      <div style={{ fontSize:40, marginBottom:12 }}>🎯</div>
      <div style={{ fontSize:18, fontWeight:700, color:FX.dark, marginBottom:8 }}>Connexion requise</div>
      <div style={{ fontSize:13, color:FX.muted, marginBottom:20 }}>Connecte-toi pour soumettre des pronostics et participer aux classements.</div>
      <button onClick={onLogin} style={{ background:FX.accent, color:"#0A1428", border:"none", borderRadius:9, padding:"11px 28px", cursor:"pointer", fontSize:13, fontWeight:800 }}>🔑 Se connecter</button>
    </div>
  );

  const planColor = userAccount.plan === "vip" ? FX.warn : userAccount.plan === "premium" ? FX.accent : FX.muted;
  const todayPronos = myPronos.filter(p => p.created_at?.slice(0,10) === new Date().toISOString().slice(0,10)).length;
  const maxPronos = userAccount.plan === "free" ? 3 : "∞";
  const upcomingMatches = nextFixtures.filter(f => f.compId).slice(0, 20);

  return (
    <div style={{ padding:"20px 24px 60px", background:FX.bg, minHeight:"100%", color:FX.dark }}>
      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20 }}>
        <span style={{ fontSize:28 }}>🎯</span>
        <div>
          <div style={{ fontSize:20, fontWeight:900, color:FX.dark }}>Mes Pronostics</div>
          <div style={{ fontSize:11, color:FX.muted }}>Soumets tes prédictions et gagne des points</div>
        </div>
        <div style={{ marginLeft:"auto", textAlign:"right" }}>
          <div style={{ fontSize:12, color:planColor, fontWeight:700 }}>{userAccount.plan.toUpperCase()}</div>
          <div style={{ fontSize:10, color:FX.muted }}>Aujourd'hui: {todayPronos}/{maxPronos} pronos</div>
        </div>
      </div>

      {/* Formulaire */}
      <div style={{ background:FX.card, border:`1px solid ${FX.border}`, borderRadius:12, padding:"18px 20px", marginBottom:16 }}>
        <div style={{ fontSize:11, color:FX.muted, textTransform:"uppercase", letterSpacing:.8, marginBottom:12 }}>Nouveau pronostic</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
          <div>
            <div style={{ fontSize:9, color:FX.muted, textTransform:"uppercase", marginBottom:5 }}>Match</div>
            <select value={form.matchId} onChange={e=>setForm(f=>({...f,matchId:e.target.value}))} style={{ width:"100%", padding:"9px 10px", borderRadius:7, border:`1px solid ${FX.border}`, background:"#0E1A28", color:FX.dark, fontSize:12, outline:"none" }}>
              <option value="">Choisir un match à venir…</option>
              {upcomingMatches.map(m => (
                <option key={m.id} value={m.id}>{m.home?.name} vs {m.away?.name} ({m.league})</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize:9, color:FX.muted, textTransform:"uppercase", marginBottom:5 }}>Résultat prédit</div>
            <div style={{ display:"flex", gap:6 }}>
              {[{v:"1",l:"1 (Dom.)"},{v:"N",l:"Nul"},{v:"2",l:"2 (Ext.)"}].map(r => (
                <button key={r.v} onClick={()=>setForm(f=>({...f,predResult:r.v}))} style={{
                  flex:1, padding:"9px 4px", borderRadius:7, border:`1px solid ${form.predResult===r.v?FX.accent:FX.border}`,
                  background:form.predResult===r.v?FX.accentBg:"none", color:form.predResult===r.v?FX.accent:FX.muted,
                  cursor:"pointer", fontSize:12, fontWeight:form.predResult===r.v?700:400,
                }}>{r.l}</button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:9, color:FX.muted, textTransform:"uppercase", marginBottom:5 }}>Score exact (optionnel · +10 pts)</div>
            <input value={form.predScore} onChange={e=>setForm(f=>({...f,predScore:e.target.value}))} placeholder="ex: 2-1" style={{ width:"100%", padding:"9px 10px", borderRadius:7, border:`1px solid ${FX.border}`, background:"#0E1A28", color:FX.dark, fontSize:12, outline:"none", boxSizing:"border-box" }}/>
          </div>
          <button onClick={submit} disabled={submitting} style={{ marginTop:18, padding:"10px 20px", background:FX.accent, color:"#0A1428", border:"none", borderRadius:9, cursor:"pointer", fontSize:13, fontWeight:800, flexShrink:0 }}>
            {submitting?"…":"🎯 Soumettre"}
          </button>
        </div>
        {msg && <div style={{ marginTop:8, fontSize:12, color:msg.startsWith("✅")?FX.green:FX.red }}>{msg}</div>}
        <div style={{ marginTop:10, fontSize:10, color:FX.muted }}>
          🏆 Résultat correct: +3 pts · Différence buts correcte: +5 pts · Score exact: +10 pts
        </div>
      </div>

      {/* Stats perso */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:16 }}>
        {[
          { l:"Pronostics",    v:userAccount.pronostics_count||0, c:FX.dark },
          { l:"Réussite",      v:`${userAccount.win_rate||0}%`,   c:userAccount.win_rate>=60?FX.green:userAccount.win_rate>=40?FX.warn:FX.muted },
          { l:"Points",        v:userAccount.points_pronostics||0, c:FX.accent },
          { l:"Série",         v:`🔥${userAccount.current_streak||0}`, c:FX.warn },
        ].map(s => (
          <div key={s.l} style={{ background:FX.card, border:`1px solid ${FX.border}`, borderRadius:9, padding:"10px 8px", textAlign:"center" }}>
            <div style={{ fontSize:18, fontWeight:900, color:s.c }}>{s.v}</div>
            <div style={{ fontSize:8, color:FX.muted, textTransform:"uppercase", letterSpacing:.5 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Liste pronostics */}
      <div style={{ fontSize:11, color:FX.muted, textTransform:"uppercase", letterSpacing:.8, marginBottom:8 }}>Historique ({myPronos.length})</div>
      {myPronos.length === 0 ? (
        <div style={{ background:FX.card, border:`1px solid ${FX.border}`, borderRadius:10, padding:"24px", textAlign:"center", color:FX.muted, fontSize:12 }}>
          Aucun pronostic encore. Soumet ton premier pronostic ci-dessus !
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {myPronos.map(p => (
            <div key={p.id} style={{ background:FX.card, border:`1px solid ${p.status==="resolved"?(p.points_earned>0?FX.green+"44":FX.red+"44"):FX.border}`, borderRadius:9, padding:"10px 14px", display:"flex", alignItems:"center", gap:12 }}>
              <span style={{ fontSize:16, flexShrink:0 }}>
                {p.status==="pending"?"⏳":p.points_earned>0?"✅":"❌"}
              </span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:600, color:FX.dark, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {p.home_team} vs {p.away_team}
                </div>
                <div style={{ fontSize:10, color:FX.muted }}>
                  Prédit: <strong style={{ color:FX.accent }}>{p.pred_result}{p.pred_score?` (${p.pred_score})`:""}</strong>
                  {p.actual_result && <> · Réel: <strong>{p.actual_result}{p.actual_score?` (${p.actual_score})`:""}</strong></>}
                </div>
              </div>
              {p.status === "resolved" && (
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontSize:15, fontWeight:900, color:p.points_earned>0?FX.green:FX.red }}>
                    {p.points_earned>0?`+${p.points_earned}pts`:"0 pt"}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
