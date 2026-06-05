import { useEffect, useState } from "react";
const FX = { bg:"#141C28",card:"#1A2030",accent:"#00D4AA",dark:"#D0E8F4",muted:"#4A6A7A" };
export default function PaymentSuccess({ onNavigate }) {
  const [plan, setPlan] = useState("premium");
  useEffect(() => {
    // Rafraîchir le profil
    const jwt = localStorage.getItem("vdk_jwt");
    if (jwt) fetch("/api/auth/me",{headers:{Authorization:`Bearer ${jwt}`}}).then(r=>r.json()).then(d=>{
      if(d.plan) setPlan(d.plan);
      localStorage.setItem("vdk_user", JSON.stringify(d));
    }).catch(()=>{});
  }, []);
  return (
    <div style={{ background:FX.bg, minHeight:"100%", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:FX.card, borderRadius:20, padding:"40px 32px", textAlign:"center", maxWidth:440, border:`2px solid ${FX.accent}` }}>
        <div style={{ width:72, height:72, borderRadius:16, overflow:"hidden", margin:"0 auto 16px", border:`2px solid ${FX.accent}44` }}>
          <img src="/fox-mascot.avif" style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"center top" }} alt="FoxLab"/>
        </div>
        <div style={{ fontSize:28, marginBottom:8 }}>🎉</div>
        <div style={{ fontSize:22, fontWeight:900, color:FX.dark, marginBottom:8 }}>Bienvenue dans la famille FoxLab !</div>
        <div style={{ fontSize:13, color:FX.muted, marginBottom:6 }}>Plan <strong style={{ color:FX.accent }}>{plan.toUpperCase()}</strong> activé avec succès.</div>
        <div style={{ fontSize:12, color:FX.muted, marginBottom:24 }}>Tu as maintenant accès à toutes les analyses complètes et à la Ligue Premium.</div>
        <button onClick={()=>onNavigate?.("analyze")} style={{ background:FX.accent, color:"#0A1428", border:"none", borderRadius:9, padding:"12px 28px", cursor:"pointer", fontSize:14, fontWeight:800 }}>🦊 Lancer une analyse</button>
      </div>
    </div>
  );
}
