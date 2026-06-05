// ============================================================
// Auth — inscription, connexion, JWT, plans
// ============================================================
import bcrypt   from "bcryptjs";
import jwt      from "jsonwebtoken";
import store, { persist } from "./db.js";

const JWT_SECRET  = process.env.JWT_SECRET || "foxlab-secret-2024";
const JWT_EXPIRES = "30d";

const AVATAR_COLORS = ["#00D4AA","#3b82f6","#f97316","#a78bfa","#f43f5e","#facc15","#22d3ee","#fb7185","#34d399","#f59e0b"];

// ── Inscription ─────────────────────────────────────────────
export async function register(email, username, password) {
  if (!email || !username || !password) throw new Error("Tous les champs sont requis.");
  if (password.length < 6) throw new Error("Mot de passe trop court (6 caractères minimum).");
  if (username.length < 3 || username.length > 20) throw new Error("Pseudo entre 3 et 20 caractères.");
  if (!/^[a-zA-Z0-9_\-\.]+$/.test(username)) throw new Error("Pseudo : lettres, chiffres, _ - . uniquement.");

  const emailLc = email.toLowerCase().trim();
  const usernameTr = username.trim();
  const usernameLc = usernameTr.toLowerCase();

  if (store.usersByEmail[emailLc]) throw new Error("Cette adresse email est déjà utilisée.");
  if (store.usersByUsername[usernameLc]) throw new Error("Ce pseudo est déjà pris.");

  const hash  = await bcrypt.hash(password, 10);
  const id    = store.nextId++;
  const color = AVATAR_COLORS[id % AVATAR_COLORS.length];

  const user = {
    id, email: emailLc, username: usernameTr, password_hash: hash,
    avatar_color: color,
    plan: "free",           // free | premium | vip
    plan_expires_at: null,  // timestamp expiration abonnement
    created_at: Date.now(),
    // Stats pronostics
    pronostics_count: 0,
    good_pronostics: 0,
    points_pronostics: 0,
    monthly_points: {},     // { "2026-06": 42 }
    // Streak
    current_streak: 0,
    best_streak: 0,
  };
  store.users[id]                   = user;
  store.usersByEmail[emailLc]       = id;
  store.usersByUsername[usernameLc] = id;
  store.stats[id] = { user_id: id, total_correct: 0, total_wrong: 0, total_games: 0, total_wins: 0, total_response_ms: 0, questions_answered: 0, points: 0 };
  persist();

  const pub = publicUser(user);
  return { user: pub, token: makeToken(user) };
}

// ── Connexion ────────────────────────────────────────────────
export async function login(emailOrUsername, password) {
  if (!emailOrUsername || !password) throw new Error("Identifiants requis.");
  const key = emailOrUsername.toLowerCase().trim();
  const id  = store.usersByEmail[key] ?? store.usersByUsername[key];
  if (!id) throw new Error("Compte introuvable.");

  const user = store.users[id];
  if (!user) throw new Error("Compte introuvable.");

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw new Error("Mot de passe incorrect.");

  return { user: publicUser(user), token: makeToken(user) };
}

// ── JWT ──────────────────────────────────────────────────────
function makeToken(user) {
  return jwt.sign({ id: user.id, username: user.username, plan: user.plan }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); }
  catch { return null; }
}

// ── Profil public ────────────────────────────────────────────
function publicUser(u) {
  const winRate = u.pronostics_count > 0 ? Math.round(u.good_pronostics / u.pronostics_count * 100) : 0;
  return {
    id: u.id, email: u.email, username: u.username,
    avatar_color: u.avatar_color, plan: u.plan,
    plan_expires_at: u.plan_expires_at,
    created_at: u.created_at,
    pronostics_count: u.pronostics_count || 0,
    good_pronostics: u.good_pronostics || 0,
    points_pronostics: u.points_pronostics || 0,
    win_rate: winRate,
    current_streak: u.current_streak || 0,
    best_streak: u.best_streak || 0,
  };
}

export function getUserById(id) {
  const u = store.users[id];
  if (!u) return null;
  const stats = store.stats[id] || {};
  const avgMs = stats.questions_answered > 0 ? Math.round(stats.total_response_ms / stats.questions_answered) : null;
  return { ...publicUser(u), quizStats: { ...stats, avg_response_ms: avgMs } };
}

// ── Mise à jour plan ─────────────────────────────────────────
export function updatePlan(userId, plan, expiresAt = null) {
  const u = store.users[userId];
  if (!u) return;
  u.plan = plan;
  u.plan_expires_at = expiresAt;
  persist();
}

// ── Classements quiz ─────────────────────────────────────────
export function getLeaderboard(limit = 50) {
  return Object.values(store.stats)
    .filter(s => s.questions_answered > 0)
    .map(s => {
      const u   = store.users[s.user_id] || {};
      const avg = s.questions_answered > 0 ? Math.round(s.total_response_ms / s.questions_answered) : null;
      return { id: u.id, username: u.username, avatar_color: u.avatar_color, created_at: u.created_at, ...s, avg_response_ms: avg };
    })
    .sort((a, b) => (b.points||0) - (a.points||0) || b.total_correct - a.total_correct)
    .slice(0, limit);
}

// ── Classement pronostics ────────────────────────────────────
export function getPronosticLeaderboard(month, league = "free", limit = 50) {
  return Object.values(store.users)
    .filter(u => league === "premium" ? (u.plan === "premium" || u.plan === "vip") : true)
    .map(u => {
      const monthPts = month ? (u.monthly_points?.[month] || 0) : (u.points_pronostics || 0);
      const winRate = u.pronostics_count > 0 ? Math.round(u.good_pronostics / u.pronostics_count * 100) : 0;
      return {
        id: u.id, username: u.username, avatar_color: u.avatar_color, plan: u.plan,
        points: monthPts,
        total_points: u.points_pronostics || 0,
        pronostics_count: u.pronostics_count || 0,
        win_rate: winRate,
        current_streak: u.current_streak || 0,
      };
    })
    .filter(u => u.points > 0 || u.pronostics_count > 0)
    .sort((a, b) => b.points - a.points || b.win_rate - a.win_rate)
    .slice(0, limit);
}

// ── Mise à jour stats quiz ───────────────────────────────────
export function updateStats(userId, { correct, wrong, responseMs, won, pointsEarned = 0 }) {
  if (!store.stats[userId]) {
    store.stats[userId] = { user_id: userId, total_correct: 0, total_wrong: 0, total_games: 0, total_wins: 0, total_response_ms: 0, questions_answered: 0, points: 0 };
  }
  const s = store.stats[userId];
  s.total_correct      += correct || 0;
  s.total_wrong        += wrong || 0;
  s.total_games        += 1;
  if (won) s.total_wins++;
  s.total_response_ms  += responseMs || 0;
  s.questions_answered += (correct || 0) + (wrong || 0);
  s.points             = (s.points || 0) + (pointsEarned || 0);
  persist();
}
