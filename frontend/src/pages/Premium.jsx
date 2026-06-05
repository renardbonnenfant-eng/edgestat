import { useState } from "react";
const FX = { bg:"#141C28",card:"#1A2030",border:"#243548",accent:"#00D4AA",accentBg:"rgba(0,212,170,.12)",dark:"#D0E8F4",mid:"#8AABBD",muted:"#4A6A7A",blue:"#3b82f6",green:"#16a34a",red:"#DC2626",warn:"#d97706" };

// Tarifs mensuel / trimestriel
const PRICING = {
  premium: {
    monthly:   { price:10,    display:"10€",    period:"/ mois",     planId:"premium",    saving:null },
    quarterly: { price:25.99, display:"25,99€", period:"/ 3 mois",   planId:"premium_3m", saving:{ pct:13, euros:4.01, tag:"🔥 PRIX CHOC" } },
  },
  vip: {
    monthly:   { price:20,    display:"20€",    period:"/ mois",     planId:"vip",        saving:null },
    quarterly: { price:49.99, display:"49,99€", period:"/ 3 mois",   planId:"vip_3m",     saving:{ pct:17, euros:10.01, tag:"⚡ MEILLEURE OFFRE" } },
  },
};

const PLANS = [
  {
    id:"free", name:"Gratuit", color:FX.muted, badge:null,
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
    id:"premium", name:"Premium", color:FX.accent, badge:"⭐ Populaire",
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
    id:"vip", name:"VIP", color:FX.warn, badge:"🦊 Exclusif",
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
  { q:"Comment fonctionnent les abonnements trimestriels ?", a:"Tu paies 3 mois d'un coup et bénéficies d'un tarif réduit. L'abonnement se renouvelle automatiquement tous les 3 mois sauf annulation." },
  { q:"Comment fonctionnent les tournois ?", a:"Chaque mois, les meilleurs pronostiqueurs du classement Premium remportent des lots réels (chèques cadeaux, mois offerts)." },
  { q:"L'IA est-elle vraiment fiable ?", a:"L'IA analyse des données historiques et des tendances. Elle donne des probabilités basées sur des faits, pas des garanties. Le taux de réussite moyen est de 65%." },
  { q:"Comment recevoir mes récompenses ?", a:"Les lots sont envoyés par email dans les 5 jours ouvrés après la fin du mois. Un email de confirmation te sera envoyé." },
];

export default function Premium({ userAccount, onSubscribe }) {
  const [faqOpen,   setFaqOpen]   = useState(null);
  const [loading,   setLoading]   = useState("");
  const [billing,   setBilling]   = useState("monthly"); // monthly | quarterly

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
      <div style={{ padding:"32px 24px 60px", maxWidth:980, margin:"0 auto" }}>

        {/* Hero */}
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <div style={{ width:64, height:64, borderRadius:16, overflow:"hidden", margin:"0 auto 16px", border:"2px solid rgba(0,212,170,.3)" }}>
            <img src="/fox-mascot.avif" style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"center top" }} alt="FoxLab"/>
          </div>
          <div style={{ fontSize:32, fontWeight:900, color:FX.dark, marginBottom:8, lineHeight:1.2 }}>
            Le renard qui prédit.<br/><span style={{ color:FX.accent }}>Vous qui gagnez.</span>
          </div>
          <div style={{ fontSize:14, color:FX.mid, maxWidth:500, margin:"0 auto 20px", lineHeight:1.7 }}>
            L'IA qui analyse 50+ variables par match. Les statistiques que les bookmakers ne veulent pas que vous voyiez.
          </div>
          {/* Compteurs */}
          <div style={{ display:"flex", justifyContent:"center", gap:32, flexWrap:"wrap", marginBottom:28 }}>
            {[{val:"2 847",label:"pronostics ce mois"},{val:"68%",label:"taux de réussite moyen"},{val:"127",label:"abonnés actifs"}].map(c=>(
              <div key={c.label} style={{ textAlign:"center" }}>
                <div style={{ fontSize:24, fontWeight:900, color:FX.accent }}>{c.val}</div>
                <div style={{ fontSize:10, color:FX.muted, textTransform:"uppercase", letterSpacing:.8 }}>{c.label}</div>
              </div>
            ))}
          </div>

          {/* ── Toggle Mensuel / Trimestriel ── */}
          <div style={{ display:"inline-flex", background:"#0E1A28", border:"1px solid #243548", borderRadius:12, padding:4, position:"relative" }}>
            {[{id:"monthly",label:"Mensuel"},{id:"quarterly",label:"Trimestriel"}].map(b=>(
              <button key={b.id} onClick={()=>setBilling(b.id)} style={{
                padding:"8px 20px", borderRadius:9, border:"none", cursor:"pointer",
                background: billing===b.id?"#182030":"none",
                color: billing===b.id?FX.dark:FX.muted,
                fontSize:13, fontWeight:billing===b.id?700:400, transition:"all .2s",
                position:"relative",
              }}>
                {b.label}
                {b.id==="quarterly" && (
                  <span style={{
                    position:"absolute", top:-10, right:-8,
                    background:"linear-gradient(135deg,#DC2626,#f97316)",
                    color:"#fff", fontSize:8, fontWeight:900, borderRadius:10,
                    padding:"2px 6px", whiteSpace:"nowrap",
                  }}>ÉCONOMIES</span>
                )}
              </button>
            ))}
          </div>
          {billing==="quarterly" && (
            <div style={{ fontSize:12, color:FX.accent, marginTop:8, fontWeight:600 }}>
              🎉 Jusqu'à -17% sur l'abonnement trimestriel !
            </div>
          )}
        </div>

        {/* ── Plans ── */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:16, marginBottom:48 }}>
          {PLANS.map(plan => {
            const pricing = plan.id !== "free" ? PRICING[plan.id][billing] : null;
            const saving  = pricing?.saving;
            const isActive = userAccount?.plan === plan.id;

            return (
              <div key={plan.id} style={{
                background: plan.id==="premium" ? "linear-gradient(135deg,#0d2e2a,#182030)" : FX.card,
                border:`2px solid ${plan.id==="premium"?FX.accent:plan.id==="vip"?"rgba(245,158,11,.5)":FX.border}`,
                borderRadius:16, padding:"24px 22px",
                transform: plan.id==="premium" ? "scale(1.03)" : "none",
                boxShadow: plan.id==="premium" ? `0 8px 32px ${FX.accent}22` : "none",
                position:"relative", overflow:"visible",
              }}>
                {/* Badge plan */}
                {plan.badge && (
                  <div style={{ position:"absolute", top:-12, left:"50%", transform:"translateX(-50%)", background:plan.color, color:"#0A1428", borderRadius:20, padding:"3px 14px", fontSize:11, fontWeight:800, whiteSpace:"nowrap", zIndex:1 }}>{plan.badge}</div>
                )}

                {/* Badge économie trimestriel — PRIX CHOC */}
                {saving && billing==="quarterly" && (
                  <div style={{
                    position:"absolute", top:-14, right:12,
                    background:"linear-gradient(135deg,#DC2626 0%,#f97316 100%)",
                    color:"#fff", borderRadius:20, padding:"5px 12px",
                    fontSize:10, fontWeight:900, zIndex:2,
                    boxShadow:"0 4px 12px rgba(220,38,38,.4)",
                    animation:"pricePulse 2s ease-in-out infinite",
                  }}>
                    {saving.tag} −{saving.pct}%
                    <style>{`@keyframes pricePulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}`}</style>
                  </div>
                )}

                <div style={{ fontSize:20, fontWeight:800, color:plan.color, marginBottom:4 }}>{plan.name}</div>

                {/* Prix */}
                {plan.id === "free" ? (
                  <div style={{ display:"flex", alignItems:"baseline", gap:4, marginBottom:16 }}>
                    <span style={{ fontSize:32, fontWeight:900, color:FX.dark }}>0€</span>
                    <span style={{ fontSize:12, color:FX.muted }}>pour toujours</span>
                  </div>
                ) : (
                  <div style={{ marginBottom:16 }}>
                    {/* Prix barré si trimestriel */}
                    {billing==="quarterly" && pricing && (
                      <div style={{ fontSize:13, color:FX.muted, textDecoration:"line-through", marginBottom:2 }}>
                        {plan.id==="premium"?"30€":"60€"} / 3 mois
                      </div>
                    )}
                    <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
                      <span style={{ fontSize:34, fontWeight:900, color:billing==="quarterly"?"#f97316":FX.dark }}>
                        {pricing?.display}
                      </span>
                      <span style={{ fontSize:12, color:FX.muted }}>{pricing?.period}</span>
                    </div>
                    {/* Économie en euros */}
                    {saving && billing==="quarterly" && (
                      <div style={{ marginTop:4, fontSize:12, color:"#f97316", fontWeight:700 }}>
                        💰 Économisez {saving.euros.toFixed(2).replace(".",",")}€ — soit {(pricing.price/3).toFixed(2).replace(".",",")}€/mois
                      </div>
                    )}
                    {billing==="monthly" && (
                      <div style={{ marginTop:4, fontSize:11, color:FX.muted }}>
                        ou <button onClick={()=>setBilling("quarterly")} style={{ background:"none", border:"none", cursor:"pointer", color:FX.accent, fontSize:11, fontWeight:700, padding:0, textDecoration:"underline" }}>économisez {plan.id==="premium"?"13%":"17%"} en trimestriel</button>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display:"flex", flexDirection:"column", gap:7, marginBottom:20 }}>
                  {plan.features.map((f,i)=>(
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:12, color:f.ok?plan.color:"#374151", flexShrink:0 }}>{f.ok?"✓":"✗"}</span>
                      <span style={{ fontSize:12, color:f.ok?FX.dark:FX.muted }}>{f.text}</span>
                    </div>
                  ))}
                </div>

                <button onClick={() => subscribe(pricing?.planId || plan.id)}
                  disabled={loading===pricing?.planId || plan.id==="free" || isActive} style={{
                  width:"100%", padding:"11px", borderRadius:9, border:"none",
                  cursor: plan.id==="free"||isActive ? "default" : "pointer",
                  background: plan.id==="free" ? "#243548"
                    : isActive ? "#243548"
                    : billing==="quarterly" && plan.id!=="free"
                      ? "linear-gradient(135deg,#DC2626,#f97316)"
                      : plan.id==="premium" ? FX.accent : "rgba(245,158,11,.9)",
                  color: plan.id==="free"||isActive ? FX.muted : "#0A1428",
                  fontSize:13, fontWeight:800, transition:"all .15s",
                  boxShadow: billing==="quarterly" && plan.id!=="free" && !isActive ? "0 4px 16px rgba(220,38,38,.3)" : "none",
                }}>
                  {loading===pricing?.planId ? "Chargement…"
                    : isActive ? "✓ Ton plan actuel"
                    : plan.id==="free" ? "Plan actuel par défaut"
                    : billing==="quarterly"
                      ? `🔥 Choisir 3 mois — ${pricing?.display}`
                      : `Passer ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>

        {/* Comparatif trimestriel */}
        {billing === "quarterly" && (
          <div style={{ background:"rgba(220,38,38,.08)", border:"1px solid rgba(220,38,38,.3)", borderRadius:14, padding:"20px 24px", marginBottom:40, textAlign:"center" }}>
            <div style={{ fontSize:16, fontWeight:800, color:"#f97316", marginBottom:12 }}>⚡ Récapitulatif des économies trimestrielles</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, maxWidth:500, margin:"0 auto" }}>
              {[
                { name:"Premium", monthly:30, quarterly:25.99, saving:4.01, pct:13, color:FX.accent },
                { name:"VIP",     monthly:60, quarterly:49.99, saving:10.01, pct:17, color:FX.warn },
              ].map(p=>(
                <div key={p.name} style={{ background:FX.card, borderRadius:12, padding:"14px 16px", border:`1px solid ${p.color}44` }}>
                  <div style={{ fontSize:14, fontWeight:700, color:p.color, marginBottom:8 }}>{p.name}</div>
                  <div style={{ fontSize:12, color:FX.muted, marginBottom:4, textDecoration:"line-through" }}>{p.monthly}€ / 3 mois</div>
                  <div style={{ fontSize:22, fontWeight:900, color:"#f97316" }}>{p.quarterly}€</div>
                  <div style={{ fontSize:11, color:FX.green, fontWeight:700, marginTop:4 }}>💰 −{p.saving.toFixed(2).replace(".",",")}€ économisés</div>
                  <div style={{ marginTop:6, background:"linear-gradient(135deg,#DC2626,#f97316)", color:"#fff", borderRadius:20, padding:"3px 10px", fontSize:10, fontWeight:900, display:"inline-block" }}>−{p.pct}% PRIX CHOC</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Témoignages */}
        <div style={{ marginBottom:48 }}>
          <div style={{ fontSize:18, fontWeight:800, color:FX.dark, textAlign:"center", marginBottom:20 }}>Ce que disent nos abonnés</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(260px, 1fr))", gap:14 }}>
            {TESTIMONIALS.map((t,i)=>(
              <div key={i} style={{ background:FX.card, border:`1px solid ${FX.border}`, borderRadius:12, padding:"16px 18px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                  <div style={{ width:36, height:36, borderRadius:"50%", background:t.color, display:"grid", placeItems:"center", fontSize:14, fontWeight:800, color:"#0A1428" }}>{t.pseudo[0].toUpperCase()}</div>
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
            {FAQ.map((f,i)=>(
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
