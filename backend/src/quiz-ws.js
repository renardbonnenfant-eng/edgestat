// ============================================================
// Quiz multijoueur — WebSocket amélioré
// ============================================================
import { WebSocketServer, WebSocket } from "ws";
import { verifyToken, updateStats } from "./auth.js";

// ── Questions avec images ────────────────────────────────────
const SERVER_QUESTIONS = [
  { id:"q1",  q:"Combien de Ballons d'Or Lionel Messi a-t-il remportés ?",
    options:["8","7","6","9"], correct:0, pts:100,
    img:"https://media.api-sports.io/football/players/154.png",
    fact:"Messi a remporté 8 Ballons d'Or entre 2009 et 2023, loin devant Ronaldo (5)." },

  { id:"q2",  q:"Quel club a remporté le plus de Ligues des Champions ?",
    options:["Real Madrid","Barcelone","Bayern Munich","AC Milan"], correct:0, pts:100,
    img:"https://media.api-sports.io/football/teams/541.png",
    fact:"Le Real Madrid cumule 15 titres de LDC (2024), bien devant l'AC Milan (7)." },

  { id:"q3",  q:"Qui détient le record de buts en CdM en une seule édition ?",
    options:["Just Fontaine","Gerd Müller","Ronaldo","Pelé"], correct:0, pts:100,
    img:"https://flagcdn.com/h80/fr.png",
    fact:"Just Fontaine marque 13 buts avec la France en 6 matchs au Mondial 1958 en Suède." },

  { id:"q4",  q:"En quelle année s'est produit le 'Miracle d'Istanbul' en LDC ?",
    options:["2005","2003","2007","2001"], correct:0, pts:100,
    img:"https://media.api-sports.io/football/teams/40.png",
    fact:"Liverpool remonte 0-3 contre l'AC Milan et gagne aux tirs au but en finale 2005." },

  { id:"q5",  q:"Pour combien d'euros Neymar a-t-il rejoint le PSG en 2017 ?",
    options:["222M€","180M€","200M€","150M€"], correct:0, pts:100,
    img:"https://media.api-sports.io/football/teams/85.png",
    fact:"222M€ : record mondial absolu de transfert, toujours imbattu en 2024." },

  { id:"q6",  q:"Quel joueur a remporté la LDC avec 3 clubs différents ?",
    options:["Clarence Seedorf","Cristiano Ronaldo","Paolo Maldini","Zinédine Zidane"], correct:0, pts:150,
    img:"https://media.api-sports.io/football/teams/489.png",
    fact:"Seedorf : Ajax 1995, Real Madrid 1998, AC Milan 2003 et 2007. Record unique." },

  { id:"q7",  q:"Quel est le record de buts en une saison calendaire ?",
    options:["91 buts en 2012","85 buts en 1972","76 buts en 2013","69 buts en 2023"], correct:0, pts:150,
    img:"https://media.api-sports.io/football/teams/529.png",
    fact:"Messi marque 91 buts en 2012 (clubs + sélection), battant le record de Müller de 1972." },

  { id:"q8",  q:"Après quelle tragédie les clubs anglais ont-ils été bannis d'Europe ?",
    options:["Heysel","Hillsborough","Bradford","Ibrox"], correct:0, pts:150,
    img:"https://media.api-sports.io/football/teams/40.png",
    fact:"39 morts au Heysel lors de la finale Juventus-Liverpool. Tous les clubs anglais bannis 5 ans." },

  { id:"q9",  q:"Quel pays a organisé la première Coupe du Monde (1930) ?",
    options:["Uruguay","Italie","France","Brésil"], correct:0, pts:100,
    img:"https://flagcdn.com/h80/uy.png",
    fact:"L'Uruguay organise la CdM inaugurale pour son centenaire. 13 équipes. Uruguay champion." },

  { id:"q10", q:"Quel joueur détient le record de buts en Premier League ?",
    options:["Alan Shearer","Wayne Rooney","Andrew Cole","Thierry Henry"], correct:0, pts:100,
    img:"https://media.api-sports.io/football/teams/34.png",
    fact:"Alan Shearer marque 260 buts en PL entre 1992 et 2006 (Southampton, Blackburn, Newcastle)." },

  { id:"q11", q:"En quelle saison Arsenal a-t-il réalisé la saison 'Invincibles' ?",
    options:["2003-04","2001-02","2004-05","2002-03"], correct:0, pts:100,
    img:"https://media.api-sports.io/football/teams/42.png",
    fact:"38 matchs sans défaite (26V+12N). Les Invincibles d'Arsène Wenger, record de PL." },

  { id:"q12", q:"Quel entraîneur a remporté le plus de titres de Premier League ?",
    options:["Sir Alex Ferguson","Arsène Wenger","José Mourinho","Pep Guardiola"], correct:0, pts:100,
    img:"https://media.api-sports.io/football/teams/33.png",
    fact:"Ferguson remporte 13 titres de PL avec Man United entre 1993 et 2013." },

  { id:"q13", q:"Combien de fois le Brésil a-t-il remporté la Coupe du Monde ?",
    options:["5 fois","4 fois","6 fois","3 fois"], correct:0, pts:100,
    img:"https://flagcdn.com/h80/br.png",
    fact:"1958, 1962, 1970, 1994, 2002 — le Brésil est le pays le plus titré." },

  { id:"q14", q:"Quel joueur a inscrit le but le plus rapide en Premier League (7,69 sec) ?",
    options:["Shane Long","Alan Shearer","Ledley King","Christian Eriksen"], correct:0, pts:200,
    img:"https://media.api-sports.io/football/teams/33.png",
    fact:"Shane Long (Southampton) contre Watford le 23 avril 2019. Record absolu de PL." },

  { id:"q15", q:"Quelle est la plus grande victoire de l'histoire de la Coupe du Monde ?",
    options:["Hongrie 10-1 El Salvador","Allemagne 7-1 Brésil","Yougoslavie 9-0 Zaïre","France 6-0 Jamaïque"], correct:0, pts:150,
    img:"https://flagcdn.com/h80/hu.png",
    fact:"Hongrie 10-1 El Salvador, 15 juin 1982. Record absolu, 4 buts de László Kiss." },

  { id:"q16", q:"Quel est le seul gardien de but à avoir remporté le Ballon d'Or ?",
    options:["Lev Yachine","Gianluigi Buffon","Manuel Neuer","Iker Casillas"], correct:0, pts:100,
    img:"https://flagcdn.com/h80/ru.png",
    fact:"Lev Yachine, l'Araignée Noire soviétique, unique gardien Ballon d'Or (1963)." },

  { id:"q17", q:"Quel pays a remporté l'Euro 2020 (disputé en 2021) ?",
    options:["Italie","Angleterre","Espagne","France"], correct:0, pts:100,
    img:"https://flagcdn.com/h80/it.png",
    fact:"Italie bat l'Angleterre aux tirs au but (3-2) à Wembley le 11 juillet 2021." },

  { id:"q18", q:"Combien de fois Cristiano Ronaldo a-t-il remporté la LDC ?",
    options:["5 fois","4 fois","3 fois","6 fois"], correct:0, pts:100,
    img:"https://media.api-sports.io/football/players/874.png",
    fact:"Ronaldo remporte la LDC en 2008 (Man Utd), 2014, 2016, 2017, 2018 (Real Madrid)." },

  { id:"q19", q:"Dans quel club Zinédine Zidane a-t-il terminé sa carrière de joueur ?",
    options:["Real Madrid","Juventus","Marseille","Bordeaux"], correct:0, pts:100,
    img:"https://media.api-sports.io/football/teams/541.png",
    fact:"Zidane termine sa carrière au Real Madrid en 2006, après le coup de tête en finale de CdM." },

  { id:"q20", q:"Quel est le vrai prénom de Pelé ?",
    options:["Edson Arantes do Nascimento","Eduardo Pelé Silva","Emerson Arantes","Eusébio Pelé"], correct:0, pts:100,
    img:"https://flagcdn.com/h80/br.png",
    fact:"Edson Arantes do Nascimento, né le 23 octobre 1940 à Três Corações, Brésil." },

  { id:"q21", q:"Quel club a le plus grand nombre de titres en Serie A ?",
    options:["Juventus","Inter Milan","AC Milan","Roma"], correct:0, pts:100,
    img:"https://media.api-sports.io/football/teams/496.png",
    fact:"La Juventus domine avec 36 scudetti, malgré la rétrogradation de 2006 (Calciopoli)." },

  { id:"q22", q:"En quelle année la Premier League a-t-elle été créée ?",
    options:["1992","1888","1975","2000"], correct:0, pts:100,
    img:"https://media.api-sports.io/football/leagues/39.png",
    fact:"La Premier League est fondée en février 1992 et démarre en août 1992." },

  { id:"q23", q:"Quel pays a remporté la Coupe du Monde 2022 au Qatar ?",
    options:["Argentine","France","Brésil","Allemagne"], correct:0, pts:100,
    img:"https://flagcdn.com/h80/ar.png",
    fact:"Argentine bat la France aux tirs au but (4-2) après 3-3 aet. Messi décroche son Graal." },

  { id:"q24", q:"Qui marque le but de la victoire en finale UCL 1999 pour Manchester United ?",
    options:["Ole Gunnar Solskjaer","Teddy Sheringham","Dwight Yorke","Andy Cole"], correct:0, pts:150,
    img:"https://media.api-sports.io/football/teams/33.png",
    fact:"Solskjaer à la 93'+3 (2-1 vs Bayern), après l'égalisation de Sheringham à la 91'." },

  { id:"q25", q:"Quel stade a la plus grande capacité officielle (football) ?",
    options:["Narendra Modi Stadium, Inde","Rungrado, Corée du Nord","Camp Nou","Wembley"], correct:0, pts:200,
    img:"https://flagcdn.com/h80/in.png",
    fact:"Le Narendra Modi Stadium (Ahmedabad, Inde) accueille 132 000 spectateurs." },

  { id:"q26", q:"Quel joueur a marqué un hat-trick en finale de CdM 2022 ?",
    options:["Kylian Mbappé","Lionel Messi","Antoine Griezmann","Olivier Giroud"], correct:0, pts:100,
    img:"https://media.api-sports.io/football/players/278.png",
    fact:"Mbappé marque 3 buts (80', 81', 118') mais la France perd quand même aux tirs au but." },

  { id:"q27", q:"Quel est le surnom de Ronaldo R9 (Ronaldo le Brésilien) ?",
    options:["O Fenômeno","El Loco","O Gordo","O Extraterrestre"], correct:0, pts:100,
    img:"https://flagcdn.com/h80/br.png",
    fact:"R9 est surnommé 'O Fenômeno' (Le Phénomène), considéré comme le meilleur avant-centre." },

  { id:"q28", q:"Quel entraîneur a remporté le plus de Ligues des Champions en carrière ?",
    options:["Carlo Ancelotti","Bob Paisley","Zinédine Zidane","Alex Ferguson"], correct:0, pts:150,
    img:"https://media.api-sports.io/football/teams/541.png",
    fact:"Ancelotti : AC Milan 2003 et 2007, Real Madrid 2014, 2022 et 2024. Seul à 5 titres." },

  { id:"q29", q:"Quelle nation a remporté le plus de Coupes d'Afrique des Nations ?",
    options:["Égypte","Cameroun","Ghana","Sénégal"], correct:0, pts:150,
    img:"https://flagcdn.com/h80/eg.png",
    fact:"L'Égypte est la nation la plus titrée de la CAN avec 7 titres (dernier en 2010)." },

  { id:"q30", q:"Quel joueur détient le record mondial de sélections internationales ?",
    options:["Bader Al-Mutawa (Koweït)","Sergio Ramos","Cristiano Ronaldo","Lionel Messi"], correct:0, pts:200,
    img:"https://flagcdn.com/h80/kw.png",
    fact:"Bader Al-Mutawa (Koweït) détient le record avec 196 sélections (2024)." },

  { id:"q31", q:"Quel joueur a gagné le plus de titres de champion en carrière ?",
    options:["Dani Alves","Lionel Messi","Marcelo","Iniesta"], correct:0, pts:200,
    img:"https://media.api-sports.io/football/players/154.png",
    fact:"Messi dépasse Dani Alves avec 44 trophées collectifs. Record mondial absolu." },

  { id:"q32", q:"Qui détient le record de buts internationaux toutes nations confondues ?",
    options:["Cristiano Ronaldo","Ali Daei","Ferran Torres","Romelu Lukaku"], correct:0, pts:100,
    img:"https://media.api-sports.io/football/players/874.png",
    fact:"Ronaldo dépasse Ali Daei (109 buts) en 2021 et continue d'augmenter son record." },

  { id:"q33", q:"Quel stade accueille le Classique Real Madrid vs FC Barcelone ?",
    options:["Santiago Bernabéu","Camp Nou","Wanda Metropolitano","Mestalla"], correct:0, pts:100,
    img:"https://media.api-sports.io/football/teams/541.png",
    fact:"Les Clasicos à Madrid se jouent au Santiago Bernabéu (81 044 places après rénovation)." },

  { id:"q34", q:"Quel pays a remporté la Copa América le plus souvent ?",
    options:["Uruguay","Argentine","Brésil","Chili"], correct:0, pts:150,
    img:"https://flagcdn.com/h80/uy.png",
    fact:"Uruguay et Argentine partagent le record avec 15 titres chacun." },

  { id:"q35", q:"En quelle année a eu lieu la tragédie d'Hillsborough ?",
    options:["1989","1985","1993","1991"], correct:0, pts:150,
    img:"https://media.api-sports.io/football/teams/40.png",
    fact:"15 avril 1989 : 96 supporters de Liverpool meurent lors d'une demi-finale de FA Cup." },
];

// ── Mélange options + recalcul correct index ─────────────────
function shuffleOptions(q) {
  const indices = [0,1,2,3];
  for (let i = indices.length-1; i > 0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return {
    ...q,
    options: indices.map(i => q.options[i]),
    correct: indices.indexOf(q.correct),
  };
}

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

const rooms = new Map();

class Room {
  constructor({ code, creatorId, creatorName, targetScore, maxQuestions, gameMode, category, difficulty }) {
    this.code         = code;
    this.creatorId    = creatorId;
    this.gameMode     = gameMode || "points"; // "points" | "questions"
    this.targetScore  = targetScore || 2000;
    this.maxQuestions = maxQuestions || 20;
    this.category     = category;
    this.difficulty   = difficulty;
    this.status       = "waiting";
    this.players      = new Map(); // userId → { ws, username, avatarColor, score, correct, wrong, responseMs }
    this.questions    = shuffle(SERVER_QUESTIONS); // ordre aléatoire
    this.qIdx         = 0;
    this.currentAnswers = new Map(); // userId → { correct, responseMs, answerIdx }
    this.roundTimer   = null;
    this.createdAt    = Date.now();
  }

  addPlayer(userId, username, avatarColor, ws) {
    if (this.players.has(userId)) { this.players.get(userId).ws = ws; return; }
    this.players.set(userId, { ws, username, avatarColor, score: 0, correct: 0, wrong: 0, responseMs: 0 });
  }

  removePlayer(userId) {
    this.players.delete(userId);
    if (this.players.size === 0) { clearTimeout(this.roundTimer); rooms.delete(this.code); }
  }

  broadcast(msg) {
    const str = JSON.stringify(msg);
    for (const [, p] of this.players) {
      if (p.ws.readyState === WebSocket.OPEN) p.ws.send(str);
    }
  }

  playersState() {
    return [...this.players.entries()]
      .map(([id, p]) => ({ id, username: p.username, avatarColor: p.avatarColor, score: p.score }))
      .sort((a, b) => b.score - a.score);
  }

  async startGame() {
    this.status = "playing";
    this.broadcast({ type:"game_started", players: this.playersState(), targetScore: this.targetScore, maxQuestions: this.maxQuestions, gameMode: this.gameMode });

    // Enrichir avec des questions IA pour avoir de la variété
    try {
      const groqKey = process.env.GROQ_KEY;
      if (groqKey) {
        const { default: Groq } = await import("groq-sdk");
        const groq = new Groq({ apiKey: groqKey });
        const cats = ["records","champions_league","world_cup","joueurs","clubs","stades","entraineurs","euros","transferts"];
        const randomCat = cats[Math.floor(Math.random()*cats.length)];
        const prompt = `Génère 10 questions de quiz football variées et difficiles sur la catégorie "${randomCat}".
Format JSON strict: { "questions": [{ "id":"ai1", "q":"...", "options":["bonne réponse","mauvaise1","mauvaise2","mauvaise3"], "correct":0, "pts":150, "fact":"explication courte" }] }
IMPORTANT: mélange l'index correct (0,1,2 ou 3 aléatoirement). Réponds UNIQUEMENT avec le JSON.`;
        const completion = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [{ role:"user", content:prompt }],
          max_tokens: 2000, temperature: 0.85,
          response_format: { type: "json_object" },
        });
        const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
        const aiQ = (parsed.questions || []).filter(q => q.q && q.options?.length === 4);
        if (aiQ.length > 0) {
          // Mélanger les questions IA avec les questions de base
          this.questions = shuffle([...this.questions, ...aiQ]);
        }
      }
    } catch { /* continuer sans IA si erreur */ }

    setTimeout(() => this.sendQuestion(), 800);
  }

  sendQuestion() {
    if (this.status !== "playing") return;
    if (this.qIdx >= this.maxQuestions) { this.endGame(null); return; }

    // Accès séquentiel sans modulo pour ne pas recycler
    const rawQ = this.questions[this.qIdx] || this.questions[this.qIdx % this.questions.length];
    const q    = shuffleOptions(rawQ); // réordonne les options aléatoirement à chaque envoi
    this._currentQ = q;
    this.currentAnswers.clear();
    this._questionStart = Date.now();
    this._answeredUsernames = new Map(); // userId → answered (bool, pas l'index)

    this.broadcast({
      type: "question",
      question: {
        id:        q.id,
        q:         q.q,
        options:   q.options,
        img:       q.img || null,
        pts:       q.pts,
        index:     this.qIdx,
        total:     Math.min(this.maxQuestions, this.questions.length),
        timeLimit: 20,
      },
      players: this.playersState(),
    });

    this.roundTimer = setTimeout(() => this.closeRound(), 20500);
  }

  receiveAnswer(userId, answerIdx) {
    if (this.currentAnswers.has(userId)) return;
    const q = this._currentQ;
    if (!q) return;
    const responseMs = Date.now() - this._questionStart;
    const correct    = answerIdx === q.correct;
    this.currentAnswers.set(userId, { correct, responseMs, answerIdx });

    // Broadcast immédiat : "quelqu'un a répondu" (sans révéler le choix)
    const player = this.players.get(userId);
    this.broadcast({
      type: "player_answered",
      userId,
      username: player?.username || "?",
      totalAnswered: this.currentAnswers.size,
      totalPlayers:  this.players.size,
    });

    if (this.currentAnswers.size >= this.players.size) {
      clearTimeout(this.roundTimer);
      this.closeRound();
    }
  }

  closeRound() {
    if (this.status !== "playing") return;
    const q = this._currentQ;

    const corrects = [...this.currentAnswers.entries()]
      .filter(([, a]) => a.correct)
      .sort((a, b) => a[1].responseMs - b[1].responseMs);

    const roundResults = [];
    for (const [uid, p] of this.players) {
      const ans = this.currentAnswers.get(uid);
      let ptsEarned = 0;
      if (ans?.correct) {
        const rank  = corrects.findIndex(([id]) => id === uid);
        const total = corrects.length;
        if (rank === 0 && total > 1)            ptsEarned = Math.round(q.pts * 1.12); // +12% le plus rapide
        else if (rank === total - 1 && total > 1) ptsEarned = Math.round(q.pts * 0.98); // -2% le plus lent
        else                                      ptsEarned = q.pts;
      }
      p.score += ptsEarned;
      if (ans?.correct) { p.correct++; p.responseMs += ans.responseMs; }
      else if (ans)      { p.wrong++; }

      roundResults.push({
        userId: uid, username: p.username, avatarColor: p.avatarColor,
        correct:    ans?.correct ?? false,
        answerIdx:  ans?.answerIdx ?? -1,   // ← index choisi par ce joueur
        ptsEarned,
        score:      p.score,
        responseMs: ans?.responseMs ?? null,
      });
    }

    this.broadcast({
      type: "round_result",
      correctAnswer: q.correct,      // index de la bonne réponse
      correctText:   q.options[q.correct], // texte de la bonne réponse
      fact:          q.fact || null,  // anecdote
      results:       roundResults.sort((a, b) => b.score - a.score),
      targetScore:   this.targetScore,
      questionsDone: this.qIdx + 1,
      maxQuestions:  this.maxQuestions,
    });

    // Vérifier si la partie est terminée
    let winner = null;
    let reachedMax = false;

    if (this.gameMode === "points") {
      const w = [...this.players.entries()].find(([, p]) => p.score >= this.targetScore);
      if (w) winner = w[0];
    } else {
      // mode questions
      reachedMax = (this.qIdx + 1) >= this.maxQuestions;
      if (reachedMax) {
        // Le gagnant est celui avec le meilleur score
        const sorted = [...this.players.entries()].sort(([,a],[,b]) => b.score - a.score);
        winner = sorted[0]?.[0] || null;
      }
    }

    if (winner || reachedMax) {
      setTimeout(() => this.endGame(winner), 7000); // 7s pour voir les résultats
      return;
    }

    this.qIdx++;
    setTimeout(() => this.sendQuestion(), 7000); // 7s entre les questions
  }

  endGame(winnerId) {
    this.status = "finished";
    const winner = winnerId ? this.players.get(winnerId) : null;
    this.broadcast({
      type: "game_over",
      winner: winnerId ? { id: winnerId, username: winner?.username } : null,
      finalScores: this.playersState(),
      totalQuestions: this.qIdx + 1,
    });
    for (const [uid, p] of this.players) {
      if (String(uid).startsWith("guest_")) continue;
      try { updateStats(uid, { correct: p.correct, wrong: p.wrong, responseMs: p.responseMs, won: uid === winnerId }); } catch {}
    }
    setTimeout(() => rooms.delete(this.code), 60000);
  }
}

// ── WebSocket Server ─────────────────────────────────────────
export function initQuizWS(server) {
  const wss = new WebSocketServer({ server, path: "/ws/quiz" });

  wss.on("connection", (ws) => {
    let userId = null, username = null, avatarColor = "#00D4AA", currentRoom = null;

    ws.on("message", (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }
      const { type, payload = {} } = msg;

      if (type === "auth") {
        if (payload.token) {
          const decoded = verifyToken(payload.token);
          if (decoded) { userId = decoded.id; username = decoded.username; avatarColor = payload.avatarColor || "#00D4AA"; }
        }
        if (!userId && payload.guestName) {
          username    = payload.guestName.trim().slice(0, 20) || "Invité";
          userId      = `guest_${genCode()}`;
          avatarColor = "#8AABBD";
        }
        if (!userId) { ws.send(JSON.stringify({ type:"error", message:"Identifie-toi." })); return; }
        ws.send(JSON.stringify({ type:"auth_ok", userId, username, isGuest: String(userId).startsWith("guest_") }));
        return;
      }

      if (!userId) { ws.send(JSON.stringify({ type:"error", message:"Auth requis." })); return; }

      if (type === "create_room") {
        let code; do { code = genCode(); } while (rooms.has(code));
        const room = new Room({
          code, creatorId: userId, creatorName: username,
          targetScore:  Math.min(Math.max(parseInt(payload.targetScore)||2000, 500), 10000),
          maxQuestions: Math.min(Math.max(parseInt(payload.maxQuestions)||20, 5), 100),
          gameMode:     payload.gameMode || "points",
          category:     payload.category  || "mix",
          difficulty:   payload.difficulty || "moyen",
        });
        room.addPlayer(userId, username, avatarColor, ws);
        rooms.set(code, room);
        currentRoom = room;
        ws.send(JSON.stringify({ type:"room_created", roomCode: code, targetScore: room.targetScore, maxQuestions: room.maxQuestions, gameMode: room.gameMode, players: room.playersState() }));
        return;
      }

      if (type === "join_room") {
        const room = rooms.get(payload.roomCode?.toUpperCase());
        if (!room)                    { ws.send(JSON.stringify({ type:"error", message:"Salle introuvable." })); return; }
        if (room.status !== "waiting"){ ws.send(JSON.stringify({ type:"error", message:"Partie déjà en cours." })); return; }
        if (room.players.size >= 8)   { ws.send(JSON.stringify({ type:"error", message:"Salle pleine (8 joueurs max)." })); return; }
        room.addPlayer(userId, username, avatarColor, ws);
        currentRoom = room;
        ws.send(JSON.stringify({ type:"room_joined", roomCode: room.code, targetScore: room.targetScore, maxQuestions: room.maxQuestions, gameMode: room.gameMode, players: room.playersState() }));
        room.broadcast({ type:"player_joined", player:{ id:userId, username, avatarColor }, players: room.playersState() });
        return;
      }

      if (type === "start_game") {
        if (!currentRoom || currentRoom.creatorId !== userId || currentRoom.status !== "waiting") return;
        currentRoom.startGame();
        return;
      }

      if (type === "answer") {
        if (!currentRoom || currentRoom.status !== "playing") return;
        currentRoom.receiveAnswer(userId, parseInt(payload.answerIdx));
        return;
      }

      if (type === "leave_room") {
        if (currentRoom) {
          currentRoom.removePlayer(userId);
          if (currentRoom.players.size > 0) currentRoom.broadcast({ type:"player_left", userId, username, players: currentRoom.playersState() });
          currentRoom = null;
        }
        return;
      }
    });

    ws.on("close", () => {
      if (currentRoom && userId) {
        currentRoom.removePlayer(userId);
        if (currentRoom.players.size > 0) currentRoom.broadcast({ type:"player_left", userId, username, players: currentRoom.playersState() });
      }
    });
  });

  setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms) {
      if (now - room.createdAt > 2 * 60 * 60 * 1000) rooms.delete(code);
    }
  }, 5 * 60 * 1000);

  console.log("[QuizWS] démarré sur /ws/quiz");
}
