const FX = { bg:"#141C28",card:"#1A2030",accent:"#00D4AA",dark:"#D0E8F4",muted:"#4A6A7A",warn:"#d97706" };
export default function PaymentCancel({ onNavigate }) {
  return (
    <div style={{ background:FX.bg, minHeight:"100%", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:FX.card, borderRadius:20, padding:"40px 32px", textAlign:"center", maxWidth:440, border:`1px solid #243548` }}>
        <div style={{ fontSize:28, marginBottom:8 }}>🦊</div>
        <div style={{ fontSize:22, fontWeight:900, color:FX.dark, marginBottom:8 }}>Pas de problème, on t'attend !</div>
        <div style={{ fontSize:13, color:FX.muted, marginBottom:20, lineHeight:1.6 }}>Tu peux revenir quand tu veux. Les avantages Premium t'attendent : analyses complètes, pronostics illimités, lots mensuels.</div>
        <button onClick={()=>onNavigate?.("premium")} style={{ background:"transparent", color:FX.accent, border:`1px solid ${FX.accent}`, borderRadius:9, padding:"11px 28px", cursor:"pointer", fontSize:13, fontWeight:700, marginRight:8 }}>Voir les avantages</button>
        <button onClick={()=>onNavigate?.("home")} style={{ background:"transparent", color:FX.muted, border:`1px solid #243548`, borderRadius:9, padding:"11px 20px", cursor:"pointer", fontSize:13 }}>Retour à l'accueil</button>
      </div>
    </div>
  );
}
