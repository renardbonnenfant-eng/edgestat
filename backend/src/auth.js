// ============================================================
// Auth — inscription, connexion, JWT
// Stockage : JSON pur via db.js (aucune dépendance native)
// ============================================================
import bcrypt   from "bcryptjs";
import jwt      from "jsonwebtoken";
import store, { persist } from "./db.js";

const JWT_SECRET  = process.env.JWT_SECRET || "verdikt-secret-2024";
const JWT_EXPIRES = "30d";

const AVATAR_COLORS = ["#00D4AA","#3b82f6","#f97316","#a78bfa","#f43f5e","#facc15","#22d3ee","#fb7185"];

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

  const user = { id, email: emailLc, username: usernameTr, password_hash: hash, avatar_color: color, created_at: Date.now() };
  store.users[id]                   = user;
  store.usersByEmail[emailLc]       = id;
  store.usersByUsername[usernameLc] = id;
  store.stats[id] = { user_id: id, total_correct: 0, total_wrong: 0, total_games: 0, total_wins: 0, total_response_ms: 0, questions_answered: 0, points: 0 };
  persist();

  const pub = { id, email: emailLc, username: usernameTr, avatar_color: color };
  return { user: pub, token: jwt.sign({ id, username: usernameTr }, JWT_SECRET, { expiresIn: JWT_EXPIRES }) };
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

  const pub = { id: user.id, email: user.email, username: user.username, avatar_color: user.avatar_color };
  return { user: pub, token: jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRES }) };
}

// ── Vérification JWT ─────────────────────────────────────────
export function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); }
  catch { return null; }
}

// ── Profil + stats ───────────────────────────────────────────
export function getUserStats(userId) {
  const user  = store.users[userId];
  if (!user) return null;
  const stats = store.stats[userId] || {};
  const avgMs = stats.questions_answered > 0
    ? Math.round(stats.total_response_ms / stats.questions_answered) : null;
  const { password_hash, ...pub } = user;
  return { ...pub, stats: { ...stats, avg_response_ms: avgMs } };
}

// ── Classement ───────────────────────────────────────────────
export function getLeaderboard(limit = 50) {
  return Object.values(store.stats)
    .filter(s => s.questions_answered > 0)
    .map(s => {
      const u   = store.users[s.user_id] || {};
      const avg = s.questions_answered > 0
        ? Math.round(s.total_response_ms / s.questions_answered) : null;
      return { id: u.id, username: u.username, avatar_color: u.avatar_color, created_at: u.created_at, ...s, avg_response_ms: avg };
    })
    .sort((a, b) => (b.points||0) - (a.points||0) || b.total_correct - a.total_correct)
    .slice(0, limit);
}

// ── Mise à jour stats ────────────────────────────────────────
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
