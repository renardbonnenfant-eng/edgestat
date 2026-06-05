import { useState } from "react";
const FX = { bg:"#141C28",card:"#1A2030",border:"#243548",accent:"#00D4AA",accentBg:"rgba(0,212,170,.12)",dark:"#D0E8F4",mid:"#8AABBD",muted:"#4A6A7A",blue:"#3b82f6",green:"#16a34a",red:"#DC2626",warn:"#d97706" };

const PLANS = [
  {
    id:"free", name:"Gratuit", price:"0€", period:"pour toujours",
    color:FX.muted, badge:null,
    features:[
      { ok:true,  text:"Stats de base" },
      { ok:true,  text:"15% des analyses IA" },
      { ok:true,  text:"Classement Ligue Gratuite" },
      { ok:true,  text:"3 pronostics / jour" },
      { ok:false, text:"Analyse IA complète" },
      { ok:false, text:"Ligue Premium (lots mensuels)" },
      { ok:false, text:"Historique illimité" },
      { ok:false, text:"Support prioritaire" },
    ],
  },
  {
    id:"premium", name:"Premium", price:"10€", period:"/ mois",
    color:FX.accent, badge:"⭐ Populaire",
    features:[
      { ok:true, text:"Tout du Gratuit" },
      { ok:true, text:"Analyse IA complète (50+ variables)" },
      { ok:true, text:"Pronostics illimités" },
      { ok:true, text:"Ligue Premium (lots mensuels 100€+)" },
      { ok:true, text:"Stats avancées : xG, BTTS, Over/Under" },
      { ok:true, text:"Alertes matchs importants" },
      { ok:true, text:"Badge Premium 🏅" },
      { ok:false, text:"IA prédictive avancée" },
    ],
  },
  {
    id:"vip", name:"VIP", price:"20€", period:"/ mois",
    color:FX.warn, badge:"🦊 Exclusif",
    features:[
      { ok:true, text:"Tout du Premium" },
      { ok:true, text:"IA prédictive modèle avancé" },
      { ok:true, text:"Value bets identifiés automatiquement" },
      { ok:true, text:"Analyse cotes en temps réel" },
      { ok:true, text:"Accès API personnel" },
      { ok:true, text:"Support dédié 24h" },
      { ok:true, text:"Invitation tournois VIP exclusifs" },
      { ok:true, text:"Badge FoxVIP ✨ doré" },
    ],
  },
];

const TESTIMONIALS = [
  { pseudo:"MarcoParis75", months:6, color:"#00D4AA", text:"FoxLab a changé ma façon de parier. 68% de réussite ce mois !" },
  { pseudo:"LaureB_Foot",  months:3, color:"#3b82f6", text:"L'analyse IA est bluffante. Elle voit des stats que je n'aurais jamais trouvées seul." },
  { pseudo:"TonyProno",    months:11, color:"#f59e0b", text:"Top 3 du classement Premium pendant 4 mois consécutifs. La Ligue Premium ça motive vraiment !" },
];

const FAQ = [
  { q:"Puis-je annuler à tout moment ?", a:"Oui, sans engagement. L'annulation est immédiate depuis ton profil. Tu gardes l'accès jusqu'à la fin de la période payée." },
  { q:"Comment fonctionnent les tournois ?", a:"Chaque mois, les meilleurs pronostiqueurs du classement Premium remportent des lots réels (chèques cadeaux, mois offerts)." },
  { q:"L'IA est-elle vraiment fiable ?", a:"L'IA analyse des données historiques et des tendances. Elle donne des probabilités basées sur des faits, pas des garanties. Le taux de réussite moyen est de 65%." },
  { q:"Comment recevoir mes récompenses ?", a:"Les lots sont envoyés par email dans les 5 jours ouvrés après la fin du mois. Un email de confirmation te sera envoyé." },
  { q:"Y a-t-il une période d'essai ?", a:"Le plan Gratuit permet de tester l'essentiel sans carte bancaire. Upgrade quand tu veux." },
];

export default function Premium({ userAccount, onSubscribe }) {
  const [faqOpen, setFaqOpen] = useState(null);
  const [loading, setLoading] = useState("");

  const subscribe = async (planId) => {
    if (!userAccount) { alert("Connecte-toi d'abord pour t'abonner."); return; }
    if (planId === "free") return;
    setLoading(planId);
    try {
      const jwt = localStorage.getItem("vdk_jwt");
      const res = await fetch("/api/payment/create-checkout-session", {
        method:"POST", headers:{"Content-Type":"application/json","Authorization":`Bearer ${jwt}`},
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert(data.error || "Erreur Stripe — configure tes clés dans .env");
    } catch { alert("Erreur de connexion au serveur."); }
    finally { setLoading(""); }
  };

  return (
    <div style={{ background:FX.bg, minHeight:"100%", fontFamily:"'DM Sans',sans-serif", color:FX.dark }}>
      <div style={{ padding:"32px 24px 60px", maxWidth:960, margin:"0 auto" }}>

        {/* Hero */}
        <div style={{ textAlign:"center", marginBottom:48 }}>
          <div style={{ width:64, height:64, borderRadius:16, overflow:"hidden", margin:"0 auto 16px", border:"2px solid rgba(0,212,170,.3)" }}>
            <img src="/fox-mascot.avif" style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"center top", transform:"scale(1.1)" }} alt="FoxLab"/>
          </div>
          <div style={{ fontSize:32, fontWeight:900, color:FX.dark, marginBottom:8, lineHeight:1.2 }}>
            Le renard qui prédit.<br/><span style={{ color:FX.accent }}>Vous qui gagnez.</span>
          </div>
          <div style={{ fontSize:14, color:FX.mid, maxWidth:500, margin:"0 auto 20px", lineHeight:1.7 }}>
            L'IA qui analyse 50+ variables par match. Les statistiques que les bookmakers ne veulent pas que vous voyiez.
          </div>
          {/* Compteurs */}
          <div style={{ display:"flex", justifyContent:"center", gap:32, flexWrap:"wrap" }}>
            {[
              { val:"2 847", label:"pronostics ce mois" },
              { val:"68%", label:"taux de réussite moyen" },
              { val:"127", label:"abonnés actifs" },
            ].map(c => (
              <div key={c.label} style={{ textAlign:"center" }}>
                <div style={{ fontSize:24, fontWeight:900, color:FX.accent }}>{c.val}</div>
                <div style={{ fontSize:10, color:FX.muted, textTransform:"uppercase", letterSpacing:.8 }}>{c.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Plans */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(260px, 1fr))", gap:16, marginBottom:48 }}>
          {PLANS.map(p => (
            <div key={p.id} style={{
              background: p.id==="premium" ? "linear-gradient(135deg,#0d2e2a,#182030)" : FX.card,
              border:`2px solid ${p.id==="premium"?FX.accent:p.id==="vip"?"rgba(245,158,11,.5)":FX.border}`,
              borderRadius:16, padding:"24px 22px",
              transform: p.id==="premium" ? "scale(1.03)" : "none",
              boxShadow: p.id==="premium" ? `0 8px 32px ${FX.accent}22` : "none",
              position:"relative",
            }}>
              {p.badge && (
                <div style={{ position:"absolute", top:-12, left:"50%", transform:"translateX(-50%)", background:p.color, color:"#0A1428", borderRadius:20, padding:"3px 14px", fontSize:11, fontWeight:800, whiteSpace:"nowrap" }}>{p.badge}</div>
              )}
              <div style={{ fontSize:20, fontWeight:800, color:p.color, marginBottom:4 }}>{p.name}</div>
              <div style={{ display:"flex", alignItems:"baseline", gap:4, marginBottom:16 }}>
                <span style={{ fontSize:32, fontWeight:900, color:FX.dark }}>{p.price}</span>
                <span style={{ fontSize:12, color:FX.muted }}>{p.period}</span>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:7, marginBottom:20 }}>
                {p.features.map((f,i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:12, color:f.ok?p.color:"#374151", flexShrink:0 }}>{f.ok?"✓":"✗"}</span>
                    <span style={{ fontSize:12, color:f.ok?FX.dark:FX.muted }}>{f.text}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => subscribe(p.id)} disabled={loading===p.id || p.id==="free" || userAccount?.plan===p.id} style={{
                width:"100%", padding:"11px", borderRadius:9, border:"none", cursor:p.id==="free"||userAccount?.plan===p.id?"default":"pointer",
                background: p.id==="free" ? "#243548" : p.id==="premium" ? FX.accent : "rgba(245,158,11,.9)",
                color: p.id==="free" ? FX.muted : "#0A1428",
                fontSize:13, fontWeight:800,
              }}>
                {loading===p.id ? "Chargement…" : userAccount?.plan===p.id ? "✓ Ton plan actuel" : p.id==="free" ? "Plan actuel par défaut" : `Passer ${p.name}`}
              </button>
            </div>
          ))}
        </div>

        {/* Témoignages */}
        <div style={{ marginBottom:48 }}>
          <div style={{ fontSize:18, fontWeight:800, color:FX.dark, textAlign:"center", marginBottom:20 }}>Ce que disent nos abonnés</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(260px, 1fr))", gap:14 }}>
            {TESTIMONIALS.map((t,i) => (
              <div key={i} style={{ background:FX.card, border:`1px solid ${FX.border}`, borderRadius:12, padding:"16px 18px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                  <div style={{ width:36, height:36, borderRadius:"50%", background:t.color, display:"grid", placeItems:"center", fontSize:14, fontWeight:800, color:"#0A1428" }}>
                    {t.pseudo[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:FX.dark }}>{t.pseudo}</div>
                    <div style={{ fontSize:10, color:FX.muted }}>Abonné depuis {t.months} mois</div>
                  </div>
                </div>
                <div style={{ fontSize:12, color:FX.mid, lineHeight:1.6, fontStyle:"italic" }}>"{t.text}"</div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div>
          <div style={{ fontSize:18, fontWeight:800, color:FX.dark, textAlign:"center", marginBottom:20 }}>Questions fréquentes</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {FAQ.map((f,i) => (
              <div key={i} style={{ background:FX.card, border:`1px solid ${faqOpen===i?FX.accent:FX.border}`, borderRadius:10, overflow:"hidden" }}>
                <button onClick={()=>setFaqOpen(faqOpen===i?null:i)} style={{ width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 16px", background:"none", border:"none", cursor:"pointer" }}>
                  <span style={{ fontSize:13, fontWeight:600, color:FX.dark, textAlign:"left" }}>{f.q}</span>
                  <span style={{ color:FX.accent, fontSize:16, flexShrink:0, marginLeft:8 }}>{faqOpen===i?"▴":"▾"}</span>
                </button>
                {faqOpen===i && <div style={{ padding:"0 16px 14px", fontSize:12, color:FX.mid, lineHeight:1.7 }}>{f.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
