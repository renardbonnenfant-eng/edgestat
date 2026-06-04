// ============================================================
// Authentification : inscription, connexion, vérification JWT
// ============================================================
import bcrypt from "bcryptjs";
import jwt    from "jsonwebtoken";
import db     from "./db.js";

const JWT_SECRET  = process.env.JWT_SECRET || "verdikt-secret-change-me-in-prod";
const JWT_EXPIRES = "30d";

const AVATAR_COLORS = ["#00D4AA","#3b82f6","#f97316","#a78bfa","#f43f5e","#facc15","#22d3ee"];
function randomColor() { return AVATAR_COLORS[Math.floor(Math.random()*AVATAR_COLORS.length)]; }

// ── Inscription ─────────────────────────────────────────────
export async function register(email, username, password) {
  if (!email || !username || !password)
    throw new Error("Tous les champs sont requis.");
  if (password.length < 6)
    throw new Error("Mot de passe trop court (6 caractères minimum).");
  if (username.length < 3 || username.length > 20)
    throw new Error("Pseudo entre 3 et 20 caractères.");
  if (!/^[a-zA-Z0-9_\-\.]+$/.test(username))
    throw new Error("Pseudo : lettres, chiffres, _ - . uniquement.");

  const hash = await bcrypt.hash(password, 10);
  try {
    const user = db.prepare(
      "INSERT INTO users (email, username, password_hash, avatar_color) VALUES (?,?,?,?) RETURNING id, email, username, avatar_color"
    ).get(email.toLowerCase().trim(), username.trim(), hash, randomColor());

    db.prepare("INSERT INTO quiz_stats (user_id) VALUES (?)").run(user.id);
    return { user, token: jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRES }) };
  } catch (e) {
    if (e.message.includes("UNIQUE")) {
      if (e.message.includes("email"))    throw new Error("Cette adresse email est déjà utilisée.");
      if (e.message.includes("username")) throw new Error("Ce pseudo est déjà pris.");
    }
    throw e;
  }
}

// ── Connexion ────────────────────────────────────────────────
export async function login(emailOrUsername, password) {
  if (!emailOrUsername || !password) throw new Error("Identifiants requis.");
  const user = db.prepare(
    "SELECT * FROM users WHERE email = ? OR username = ?"
  ).get(emailOrUsername.toLowerCase().trim(), emailOrUsername.trim());

  if (!user) throw new Error("Compte introuvable.");
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw new Error("Mot de passe incorrect.");

  return {
    user: { id: user.id, email: user.email, username: user.username, avatar_color: user.avatar_color },
    token: jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRES }),
  };
}

// ── Vérification token ───────────────────────────────────────
export function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); }
  catch { return null; }
}

// ── Stats utilisateur ────────────────────────────────────────
export function getUserStats(userId) {
  const user  = db.prepare("SELECT id, email, username, avatar_color, created_at FROM users WHERE id = ?").get(userId);
  const stats = db.prepare("SELECT * FROM quiz_stats WHERE user_id = ?").get(userId);
  if (!user) return null;
  const avgMs = stats?.questions_answered > 0
    ? Math.round(stats.total_response_ms / stats.questions_answered)
    : null;
  return { ...user, stats: { ...stats, avg_response_ms: avgMs } };
}

// ── Classement global ────────────────────────────────────────
export function getLeaderboard(limit = 50) {
  return db.prepare(`
    SELECT u.id, u.username, u.avatar_color, u.created_at,
           s.total_correct, s.total_wrong, s.total_games, s.total_wins,
           s.total_response_ms, s.questions_answered,
           CASE WHEN s.questions_answered > 0
                THEN ROUND(s.total_response_ms * 1.0 / s.questions_answered)
                ELSE NULL END AS avg_response_ms
    FROM users u
    JOIN quiz_stats s ON s.user_id = u.id
    WHERE s.questions_answered > 0
    ORDER BY s.total_correct DESC, avg_response_ms ASC
    LIMIT ?
  `).all(limit);
}

// ── Mise à jour stats après une partie ──────────────────────
export function updateStats(userId, { correct, wrong, responseMs, won }) {
  db.prepare(`
    UPDATE quiz_stats SET
      total_correct     = total_correct + ?,
      total_wrong       = total_wrong + ?,
      total_games       = total_games + 1,
      total_wins        = total_wins + ?,
      total_response_ms = total_response_ms + ?,
      questions_answered = questions_answered + ?
    WHERE user_id = ?
  `).run(correct, wrong, won ? 1 : 0, responseMs, correct + wrong, userId);
}
