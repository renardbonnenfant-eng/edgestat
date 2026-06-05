// ============================================================
// Système de pronostics — soumission, résolution, points
// ============================================================
import store, { persist } from "./db.js";

// Points
const PTS = { result: 3, result_diff: 5, exact_score: 10 };

// ── Soumettre un pronostic ───────────────────────────────────
export function submitPronostic(userId, data) {
  const { matchId, homeTeam, awayTeam, competition, predResult, predScore } = data;
  if (!matchId || !homeTeam || !awayTeam || !predResult) throw new Error("Données incomplètes.");
  if (!["1","N","2"].includes(predResult)) throw new Error("Résultat invalide (1/N/2).");

  // Vérifier qu'il n'existe pas déjà un pronostic pour ce match
  const existing = Object.values(store.pronostics).find(p => p.user_id === userId && p.match_id === matchId);
  if (existing) throw new Error("Tu as déjà soumis un pronostic pour ce match.");

  const user = store.users[userId];
  if (!user) throw new Error("Utilisateur introuvable.");

  // Limite pronostics pour les gratuits (3/jour)
  if (user.plan === "free") {
    const today = new Date().toISOString().slice(0, 10);
    const todayCount = Object.values(store.pronostics).filter(p =>
      p.user_id === userId && p.created_at.slice(0, 10) === today
    ).length;
    if (todayCount >= 3) throw new Error("Limite de 3 pronostics/jour atteinte (plan Gratuit).");
  }

  const id = store.nextPronosticId++;
  store.pronostics[id] = {
    id,
    user_id: userId,
    match_id: matchId,
    home_team: homeTeam,
    away_team: awayTeam,
    competition: competition || "",
    pred_result: predResult,
    pred_score: predScore || null,
    actual_result: null,
    actual_score: null,
    points_earned: null,
    status: "pending",
    created_at: new Date().toISOString(),
    resolved_at: null,
  };
  persist();
  return store.pronostics[id];
}

// ── Résoudre un pronostic (appelé quand le match est terminé) ─
export function resolvePronostic(pronosticId, actualResult, actualScore) {
  const p = store.pronostics[pronosticId];
  if (!p || p.status !== "pending") return;

  p.actual_result = actualResult;
  p.actual_score = actualScore;
  p.resolved_at = new Date().toISOString();
  p.status = "resolved";

  let pts = 0;
  if (p.pred_result === actualResult) {
    pts = PTS.result;
    // Score exact
    if (p.pred_score && actualScore && p.pred_score.trim() === actualScore.trim()) {
      pts = PTS.exact_score;
    } else if (p.pred_score && actualScore) {
      // Différence de buts correcte
      const [ph, pa] = p.pred_score.split("-").map(Number);
      const [ah, aa] = actualScore.split("-").map(Number);
      if (!isNaN(ph) && !isNaN(pa) && !isNaN(ah) && !isNaN(aa)) {
        if (ph - pa === ah - aa) pts = PTS.result_diff;
      }
    }
  }

  p.points_earned = pts;

  // Mettre à jour stats utilisateur
  const user = store.users[p.user_id];
  if (user) {
    user.pronostics_count = (user.pronostics_count || 0) + 1;
    user.points_pronostics = (user.points_pronostics || 0) + pts;
    if (pts > 0) {
      user.good_pronostics = (user.good_pronostics || 0) + 1;
      user.current_streak = (user.current_streak || 0) + 1;
      user.best_streak = Math.max(user.best_streak || 0, user.current_streak);
    } else {
      user.current_streak = 0;
    }
    // Points mensuels
    const month = new Date().toISOString().slice(0, 7);
    if (!user.monthly_points) user.monthly_points = {};
    user.monthly_points[month] = (user.monthly_points[month] || 0) + pts;
  }

  persist();
  return p;
}

// ── Mes pronostics ───────────────────────────────────────────
export function getUserPronostics(userId, status = null) {
  return Object.values(store.pronostics)
    .filter(p => p.user_id === userId && (status ? p.status === status : true))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 100);
}

// ── Pronostics d'un match ────────────────────────────────────
export function getMatchPronostics(matchId) {
  return Object.values(store.pronostics).filter(p => p.match_id === matchId);
}

// ── Stats globales pronostics ────────────────────────────────
export function getPronosticStats() {
  const all = Object.values(store.pronostics);
  const resolved = all.filter(p => p.status === "resolved");
  const winners = resolved.filter(p => (p.points_earned || 0) > 0);
  return {
    total: all.length,
    resolved: resolved.length,
    pending: all.filter(p => p.status === "pending").length,
    successRate: resolved.length > 0 ? Math.round(winners.length / resolved.length * 100) : 0,
  };
}
