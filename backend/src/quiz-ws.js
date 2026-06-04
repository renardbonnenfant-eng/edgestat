// ============================================================
// Quiz multijoueur — WebSocket (package ws)
// Protocole :
//   Client → { type, payload }
//   Server → { type, payload }
// ============================================================
import { WebSocketServer, WebSocket } from "ws";
import { verifyToken, updateStats } from "./auth.js";
import db from "./db.js";

// Questions serveur (100 questions de qualité pour le multi)
const SERVER_QUESTIONS = [
  { id:"q1",  q:"Combien de Ballons d'Or Lionel Messi a-t-il remportés ?", options:["8","7","6","9"], correct:0, pts:100 },
  { id:"q2",  q:"Quel club a remporté le plus de Ligues des Champions ?", options:["Real Madrid","Barcelone","Bayern Munich","AC Milan"], correct:0, pts:100 },
  { id:"q3",  q:"Qui détient le record de buts en Coupe du Monde (une édition) ?", options:["Just Fontaine","Gerd Müller","Ronaldo","Pelé"], correct:0, pts:100 },
  { id:"q4",  q:"En quelle année s'est produit le 'Miracle d'Istanbul' ?", options:["2005","2003","2007","2001"], correct:0, pts:100 },
  { id:"q5",  q:"Pour combien d'euros Neymar a-t-il rejoint le PSG en 2017 ?", options:["222M€","180M€","200M€","150M€"], correct:0, pts:100 },
  { id:"q6",  q:"Quel joueur a remporté la LDC avec 3 clubs différents ?", options:["Clarence Seedorf","Ronaldo","Maldini","Zidane"], correct:0, pts:150 },
  { id:"q7",  q:"Quel est le record de buts en une saison calendaire ?", options:["91 (Messi 2012)","85 (Müller 1972)","76 (Ronaldo 2013)","69 (Mbappé 2023)"], correct:0, pts:150 },
  { id:"q8",  q:"Quel club anglais a été banni d'Europe après la tragédie du Heysel ?", options:["Tous les clubs anglais","Liverpool seulement","Manchester United","Aston Villa"], correct:0, pts:150 },
  { id:"q9",  q:"Quel pays a organisé la première Coupe du Monde ?", options:["Uruguay","Italie","France","Brésil"], correct:0, pts:100 },
  { id:"q10", q:"Quel joueur porte le record de buts en Premier League ?", options:["Alan Shearer","Wayne Rooney","Andrew Cole","Thierry Henry"], correct:0, pts:100 },
  { id:"q11", q:"En quelle année Arsenal a-t-il réalisé une saison 'Invincibles' ?", options:["2003-04","2001-02","2004-05","2002-03"], correct:0, pts:100 },
  { id:"q12", q:"Quel entraîneur a remporté le plus de titres de PL ?", options:["Sir Alex Ferguson","Arsène Wenger","José Mourinho","Pep Guardiola"], correct:0, pts:100 },
  { id:"q13", q:"Combien de fois le Brésil a-t-il remporté la Coupe du Monde ?", options:["5","4","6","3"], correct:0, pts:100 },
  { id:"q14", q:"Quel joueur a inscrit le but le plus rapide en PL (7,69 sec) ?", options:["Shane Long","Alan Shearer","Ledley King","Solskjaer"], correct:0, pts:200 },
  { id:"q15", q:"Quelle est la plus grande victoire de l'histoire de la CdM ?", options:["Hongrie 10-1 El Salvador (1982)","Allemagne 7-1 Brésil (2014)","Yougoslavie 9-0 Zaïre","France 6-0 Jamaïque"], correct:0, pts:150 },
  { id:"q16", q:"Quel est le seul gardien à avoir remporté le Ballon d'Or ?", options:["Lev Yachine","Buffon","Neuer","Casillas"], correct:0, pts:100 },
  { id:"q17", q:"Quel pays a remporté l'Euro 2020 (joué en 2021) ?", options:["Italie","Angleterre","Espagne","France"], correct:0, pts:100 },
  { id:"q18", q:"Combien de fois Ronaldo (CR7) a-t-il remporté la LDC ?", options:["5","4","3","6"], correct:0, pts:100 },
  { id:"q19", q:"Dans quel club Zidane a-t-il terminé sa carrière de joueur ?", options:["Real Madrid","Juventus","Marseille","Bordeaux"], correct:0, pts:100 },
  { id:"q20", q:"Quel est le vrai nom de Pelé ?", options:["Edson Arantes do Nascimento","Eduardo Pelé Silva","Emerson Arantes","Eusébio Pelé"], correct:0, pts:100 },
  { id:"q21", q:"Quel club a le plus grand nombre de titres en Serie A ?", options:["Juventus","Inter Milan","AC Milan","Roma"], correct:0, pts:100 },
  { id:"q22", q:"En quelle année la Premier League a-t-elle été créée ?", options:["1992","1988","1985","1995"], correct:0, pts:100 },
  { id:"q23", q:"Quel pays a remporté la CdM 2022 au Qatar ?", options:["Argentine","France","Brésil","Allemagne"], correct:0, pts:100 },
  { id:"q24", q:"Qui a marqué le but de la victoire en finale UCL 1999 pour Man United ?", options:["Ole Gunnar Solskjaer","Teddy Sheringham","Dwight Yorke","Andy Cole"], correct:0, pts:150 },
  { id:"q25", q:"Quel stade a la plus grande capacité officielle pour le football ?", options:["Narendra Modi Stadium (Inde)","Rungrado (Corée du Nord)","Camp Nou","Wembley"], correct:0, pts:200 },
  { id:"q26", q:"Quel joueur a marqué un hat-trick en finale de CdM 2022 ?", options:["Kylian Mbappé","Lionel Messi","Antoine Griezmann","Olivier Giroud"], correct:0, pts:100 },
  { id:"q27", q:"Combien de CdM le Brésil a-t-il organisées ?", options:["2 (1950 et 2014)","1 (1950)","3","1 (2014)"], correct:0, pts:150 },
  { id:"q28", q:"Quel entraîneur a remporté le plus de Ligues des Champions ?", options:["Carlo Ancelotti (5)","Bob Paisley (3)","Zidane (3)","Ferguson (2)"], correct:0, pts:150 },
  { id:"q29", q:"Quelle nation a remporté le plus de Coupes d'Afrique des Nations ?", options:["Égypte (7)","Cameroun (5)","Ghana (4)","Sénégal (1)"], correct:0, pts:150 },
  { id:"q30", q:"Quel joueur détient le record de sélections internationales mondiales ?", options:["Bader Al-Mutawa (Koweït, 196)","Sergio Ramos (180)","Ronaldo (130+)","Messi (175+)"], correct:0, pts:200 },
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length-1; i > 0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function genCode() {
  return Math.random().toString(36).slice(2,8).toUpperCase();
}

// ── État global des salles ───────────────────────────────────
// rooms: Map<roomCode, Room>
const rooms = new Map();

class Room {
  constructor({ code, creatorId, creatorName, targetScore, category, difficulty }) {
    this.code        = code;
    this.creatorId   = creatorId;
    this.targetScore = targetScore;
    this.category    = category;
    this.difficulty  = difficulty;
    this.status      = "waiting"; // waiting | playing | finished
    this.players     = new Map(); // userId → { ws, username, avatar_color, score, correct, wrong, responseMs }
    this.questions   = shuffle(SERVER_QUESTIONS);
    this.qIdx        = 0;
    this.currentAnswers = new Map(); // userId → { correct, responseMs, answeredAt }
    this.roundTimer  = null;
    this.createdAt   = Date.now();
  }

  addPlayer(userId, username, avatarColor, ws) {
    if (this.players.has(userId)) {
      // Reconnexion
      this.players.get(userId).ws = ws;
      return;
    }
    this.players.set(userId, { ws, username, avatarColor, score: 0, correct: 0, wrong: 0, responseMs: 0 });
  }

  removePlayer(userId) {
    this.players.delete(userId);
    if (this.players.size === 0) {
      clearTimeout(this.roundTimer);
      rooms.delete(this.code);
    }
  }

  broadcast(msg) {
    const str = JSON.stringify(msg);
    for (const [, p] of this.players) {
      if (p.ws.readyState === WebSocket.OPEN) p.ws.send(str);
    }
  }

  playersState() {
    return [...this.players.entries()].map(([id, p]) => ({
      id, username: p.username, avatarColor: p.avatarColor, score: p.score,
    })).sort((a,b) => b.score - a.score);
  }

  startGame() {
    this.status = "playing";
    this.broadcast({ type:"game_started", players: this.playersState(), targetScore: this.targetScore });
    setTimeout(() => this.sendQuestion(), 1000);
  }

  sendQuestion() {
    if (this.status !== "playing") return;
    const q = this.questions[this.qIdx % this.questions.length];
    this.currentAnswers.clear();
    const questionStart = Date.now();
    this._questionStart = questionStart;

    this.broadcast({
      type: "question",
      question: {
        id: q.id,
        q:  q.q,
        options: q.options,
        pts: q.pts,
        index: this.qIdx,
        timeLimit: 20,
      }
    });

    // Timer 20s → fermer la question
    this.roundTimer = setTimeout(() => this.closeRound(), 20500);
  }

  receiveAnswer(userId, answeredAt, answerIdx) {
    if (this.currentAnswers.has(userId)) return; // déjà répondu
    const q = this.questions[this.qIdx % this.questions.length];
    const responseMs = answeredAt - this._questionStart;
    const correct = answerIdx === q.correct;
    this.currentAnswers.set(userId, { correct, responseMs, answerIdx });

    // Fermer si tous ont répondu
    if (this.currentAnswers.size >= this.players.size) {
      clearTimeout(this.roundTimer);
      this.closeRound();
    }
  }

  closeRound() {
    if (this.status !== "playing") return;
    const q = this.questions[this.qIdx % this.questions.length];

    // Trier les bonnes réponses par vitesse
    const corrects = [...this.currentAnswers.entries()]
      .filter(([, a]) => a.correct)
      .sort((a, b) => a[1].responseMs - b[1].responseMs);

    // Attribuer les points
    const roundResults = [];
    for (const [uid, p] of this.players) {
      const ans = this.currentAnswers.get(uid);
      let ptsEarned = 0;
      if (ans?.correct) {
        const rank  = corrects.findIndex(([id]) => id === uid);
        const total = corrects.length;
        // Fastest: +12%, Slowest: -2%, Others: base
        if      (rank === 0 && total > 1) ptsEarned = Math.round(q.pts * 1.12);
        else if (rank === total - 1 && total > 1) ptsEarned = Math.round(q.pts * 0.98);
        else    ptsEarned = q.pts;
      }
      p.score    += ptsEarned;
      if (ans?.correct) { p.correct++; p.responseMs += ans.responseMs; }
      else if (ans)      { p.wrong++; }

      roundResults.push({
        userId: uid, username: p.username, avatarColor: p.avatarColor,
        correct: ans?.correct ?? false,
        answerIdx: ans?.answerIdx ?? -1,
        ptsEarned, score: p.score,
        responseMs: ans?.responseMs ?? null,
      });
    }

    this.broadcast({
      type: "round_result",
      correctAnswer: q.correct,
      results: roundResults.sort((a,b) => b.score - a.score),
      targetScore: this.targetScore,
    });

    // Vérifier si quelqu'un a gagné
    const winner = [...this.players.entries()].find(([, p]) => p.score >= this.targetScore);
    if (winner) {
      setTimeout(() => this.endGame(winner[0]), 3000);
      return;
    }

    this.qIdx++;
    setTimeout(() => this.sendQuestion(), 3500);
  }

  endGame(winnerId) {
    this.status = "finished";
    const winner = this.players.get(winnerId);
    this.broadcast({
      type: "game_over",
      winner: { id: winnerId, username: winner?.username },
      finalScores: this.playersState(),
    });

    // Sauvegarder les stats (comptes enregistrés uniquement, pas les invités)
    for (const [uid, p] of this.players) {
      if (String(uid).startsWith("guest_")) continue;
      try {
        updateStats(uid, {
          correct: p.correct, wrong: p.wrong,
          responseMs: p.responseMs, won: uid === winnerId,
        });
      } catch {}
    }

    // Nettoyer après 30s
    setTimeout(() => rooms.delete(this.code), 30000);
  }
}

// ── Démarrage WebSocket Server ───────────────────────────────
export function initQuizWS(server) {
  const wss = new WebSocketServer({ server, path: "/ws/quiz" });

  wss.on("connection", (ws, req) => {
    let userId = null, username = null, avatarColor = "#00D4AA", currentRoom = null;

    ws.on("message", (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }
      const { type, payload = {} } = msg;

      // ── Auth (compte) OU invité ────────────────────────────
      if (type === "auth") {
        if (payload.token) {
          const decoded = verifyToken(payload.token);
          if (decoded) {
            userId      = decoded.id;
            username    = decoded.username;
            avatarColor = payload.avatarColor || "#00D4AA";
          }
        }
        // Mode invité : pseudo fourni sans token
        if (!userId && payload.guestName) {
          username    = payload.guestName.trim().slice(0, 20) || "Invité";
          userId      = `guest_${genCode()}`;  // ID temporaire
          avatarColor = "#8AABBD";
        }
        if (!userId) { ws.send(JSON.stringify({ type:"error", message:"Identifie-toi (compte ou pseudo invité)." })); return; }
        ws.send(JSON.stringify({ type:"auth_ok", userId, username, isGuest: String(userId).startsWith("guest_") }));
        return;
      }

      if (!userId) { ws.send(JSON.stringify({ type:"error", message:"Identifie-toi d'abord (envoie auth)." })); return; }

      // ── Créer une salle ───────────────────────────────────
      if (type === "create_room") {
        let code;
        do { code = genCode(); } while (rooms.has(code));

        const room = new Room({
          code, creatorId: userId, creatorName: username,
          targetScore: Math.min(Math.max(parseInt(payload.targetScore)||200, 50), 2000),
          category:   payload.category   || "mix",
          difficulty: payload.difficulty || "moyen",
        });
        room.addPlayer(userId, username, avatarColor, ws);
        rooms.set(code, room);
        currentRoom = room;
        ws.send(JSON.stringify({ type:"room_created", roomCode: code, targetScore: room.targetScore, players: room.playersState() }));
        return;
      }

      // ── Rejoindre une salle ───────────────────────────────
      if (type === "join_room") {
        const room = rooms.get(payload.roomCode?.toUpperCase());
        if (!room)                    { ws.send(JSON.stringify({ type:"error", message:"Salle introuvable." })); return; }
        if (room.status !== "waiting"){ ws.send(JSON.stringify({ type:"error", message:"Partie déjà en cours." })); return; }
        if (room.players.size >= 8)   { ws.send(JSON.stringify({ type:"error", message:"Salle pleine (8 joueurs max)." })); return; }

        room.addPlayer(userId, username, avatarColor, ws);
        currentRoom = room;
        ws.send(JSON.stringify({ type:"room_joined", roomCode: room.code, targetScore: room.targetScore, players: room.playersState() }));
        room.broadcast({ type:"player_joined", player:{ id:userId, username, avatarColor }, players: room.playersState() });
        return;
      }

      // ── Lancer la partie ──────────────────────────────────
      if (type === "start_game") {
        if (!currentRoom || currentRoom.creatorId !== userId) return;
        if (currentRoom.status !== "waiting") return;
        currentRoom.startGame();
        return;
      }

      // ── Répondre ──────────────────────────────────────────
      if (type === "answer") {
        if (!currentRoom || currentRoom.status !== "playing") return;
        currentRoom.receiveAnswer(userId, Date.now(), parseInt(payload.answerIdx));
        return;
      }

      // ── Quitter la salle ──────────────────────────────────
      if (type === "leave_room") {
        if (currentRoom) {
          currentRoom.removePlayer(userId);
          currentRoom.broadcast({ type:"player_left", userId, username, players: currentRoom.playersState() });
          currentRoom = null;
        }
        return;
      }

      // ── Liste des salles ouvertes ──────────────────────────
      if (type === "list_rooms") {
        const open = [...rooms.values()]
          .filter(r => r.status === "waiting")
          .map(r => ({
            code: r.code, targetScore: r.targetScore,
            players: r.players.size, creatorName: [...r.players.values()][0]?.username,
          }));
        ws.send(JSON.stringify({ type:"rooms_list", rooms: open }));
        return;
      }
    });

    ws.on("close", () => {
      if (currentRoom && userId) {
        currentRoom.removePlayer(userId);
        if (currentRoom.players.size > 0) {
          currentRoom.broadcast({ type:"player_left", userId, username, players: currentRoom.playersState() });
        }
      }
    });
  });

  // Nettoyage des salles inactives toutes les 5 min
  setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms) {
      if (now - room.createdAt > 60 * 60 * 1000) rooms.delete(code); // 1h max
    }
  }, 5 * 60 * 1000);

  console.log("[QuizWS] WebSocket quiz démarré sur /ws/quiz");
}
