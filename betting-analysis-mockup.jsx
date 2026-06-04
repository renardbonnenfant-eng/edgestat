import React, { useState } from "react";

// ============================================================
// DONNÉES D'EXEMPLE (fictives) — remplaceront l'API plus tard
// Architecture pensée multi-sports : chaque sport a son schéma.
// ============================================================

// Fabrique d'équipe : compacte les données et calcule les seuils over/under
// automatiquement depuis la distribution [p0, p1, p2, p3+].
function mkTeam(side, { name, short, form, avgFor, avgAgainst, rec, scorers, dist, p4, pen }) {
  const [p0, p1, p2, p3] = dist;
  const t = {
    name,
    short,
    form,
    avgGoalsScored: avgFor,
    avgGoalsConceded: avgAgainst,
    scorers,
    goalsDist: [
      { label: "0 but", pct: p0 },
      { label: "1 but", pct: p1 },
      { label: "2 buts", pct: p2 },
      { label: "3+ buts", pct: p3 },
    ],
    over: [
      { label: "+0.5 but", pct: 100 - p0 },
      { label: "+1.5 but", pct: p2 + p3 },
      { label: "+2.5 but", pct: p3 },
      { label: "+3.5 but", pct: p4 },
    ],
    penalties: pen,
  };
  if (side === "home") t.homeRecord = rec;
  else t.awayRecord = rec;
  return t;
}

// Liste des championnats disponibles (ordre d'affichage)
const FOOT_LEAGUES = [
  { id: "fr", flag: "🇫🇷", country: "France" },
  { id: "en", flag: "🏴", country: "Angleterre" },
  { id: "it", flag: "🇮🇹", country: "Italie" },
  { id: "de", flag: "🇩🇪", country: "Allemagne" },
  { id: "es", flag: "🇪🇸", country: "Espagne" },
  { id: "pt", flag: "🇵🇹", country: "Portugal" },
];

// Un match d'exemple par championnat (données fictives)
const FOOTBALL_DATA = {
  fr: {
    league: "Ligue 1",
    date: "Sam. 14 juin — 21:00",
    home: mkTeam("home", {
      name: "Olympique Lyonnais", short: "OL", form: ["W", "W", "D", "L", "W"],
      avgFor: 1.9, avgAgainst: 1.0, rec: { w: 6, d: 2, l: 1 },
      scorers: [
        { name: "A. Lacazette", scored: 6, played: 11, homeScored: 4, homeMatches: 6 },
        { name: "R. Cherki", scored: 4, played: 10, homeScored: 3, homeMatches: 5 },
        { name: "G. Mikautadze", scored: 3, played: 9, homeScored: 2, homeMatches: 5 },
      ],
      dist: [11, 33, 33, 23], p4: 22, pen: { awarded: 4, conceded: 2, played: 11, scored: 3 },
    }),
    away: mkTeam("away", {
      name: "Stade Rennais", short: "SRFC", form: ["L", "W", "W", "D", "W"],
      avgFor: 1.4, avgAgainst: 1.3, rec: { w: 3, d: 3, l: 3 },
      scorers: [
        { name: "A. Kalimuendo", scored: 5, played: 10, awayScored: 2, awayMatches: 5 },
        { name: "L. Blas", scored: 3, played: 9, awayScored: 1, awayMatches: 4 },
      ],
      dist: [30, 30, 30, 10], p4: 10, pen: { awarded: 2, conceded: 5, played: 10, scored: 2 },
    }),
    h2h: [
      { date: "2025-02", score: "2 - 1", winner: "home" },
      { date: "2024-09", score: "1 - 1", winner: "draw" },
      { date: "2024-03", score: "0 - 2", winner: "away" },
      { date: "2023-11", score: "3 - 1", winner: "home" },
      { date: "2023-04", score: "2 - 2", winner: "draw" },
    ],
  },
  en: {
    league: "Premier League",
    date: "Dim. 15 juin — 17:30",
    home: mkTeam("home", {
      name: "Arsenal", short: "ARS", form: ["W", "W", "W", "D", "W"],
      avgFor: 2.3, avgAgainst: 0.8, rec: { w: 7, d: 1, l: 1 },
      scorers: [
        { name: "B. Saka", scored: 7, played: 12, homeScored: 5, homeMatches: 7 },
        { name: "K. Havertz", scored: 5, played: 12, homeScored: 3, homeMatches: 7 },
      ],
      dist: [8, 25, 34, 33], p4: 18, pen: { awarded: 5, conceded: 1, played: 12, scored: 4 },
    }),
    away: mkTeam("away", {
      name: "Liverpool", short: "LIV", form: ["W", "L", "W", "W", "D"],
      avgFor: 2.0, avgAgainst: 1.1, rec: { w: 5, d: 2, l: 2 },
      scorers: [
        { name: "M. Salah", scored: 8, played: 12, awayScored: 4, awayMatches: 6 },
        { name: "D. Núñez", scored: 4, played: 11, awayScored: 2, awayMatches: 6 },
      ],
      dist: [12, 28, 30, 30], p4: 16, pen: { awarded: 3, conceded: 2, played: 12, scored: 3 },
    }),
    h2h: [
      { date: "2025-01", score: "2 - 2", winner: "draw" },
      { date: "2024-10", score: "1 - 0", winner: "home" },
      { date: "2024-02", score: "1 - 3", winner: "away" },
      { date: "2023-12", score: "1 - 1", winner: "draw" },
      { date: "2023-04", score: "2 - 2", winner: "draw" },
    ],
  },
  it: {
    league: "Serie A",
    date: "Sam. 14 juin — 20:45",
    home: mkTeam("home", {
      name: "Inter Milan", short: "INT", form: ["W", "D", "W", "W", "W"],
      avgFor: 2.1, avgAgainst: 0.9, rec: { w: 6, d: 3, l: 0 },
      scorers: [
        { name: "L. Martínez", scored: 7, played: 12, homeScored: 5, homeMatches: 6 },
        { name: "M. Thuram", scored: 5, played: 11, homeScored: 3, homeMatches: 6 },
      ],
      dist: [10, 30, 35, 25], p4: 14, pen: { awarded: 4, conceded: 1, played: 12, scored: 4 },
    }),
    away: mkTeam("away", {
      name: "Juventus", short: "JUV", form: ["D", "W", "D", "L", "W"],
      avgFor: 1.5, avgAgainst: 1.0, rec: { w: 4, d: 3, l: 2 },
      scorers: [
        { name: "D. Vlahović", scored: 6, played: 12, awayScored: 2, awayMatches: 6 },
        { name: "K. Yıldız", scored: 3, played: 10, awayScored: 1, awayMatches: 5 },
      ],
      dist: [22, 38, 28, 12], p4: 8, pen: { awarded: 2, conceded: 3, played: 12, scored: 2 },
    }),
    h2h: [
      { date: "2025-02", score: "1 - 0", winner: "home" },
      { date: "2024-11", score: "2 - 2", winner: "draw" },
      { date: "2024-02", score: "1 - 1", winner: "draw" },
      { date: "2023-09", score: "0 - 1", winner: "away" },
      { date: "2023-03", score: "2 - 0", winner: "home" },
    ],
  },
  de: {
    league: "Bundesliga",
    date: "Sam. 14 juin — 18:30",
    home: mkTeam("home", {
      name: "Bayern Munich", short: "FCB", form: ["W", "W", "W", "W", "D"],
      avgFor: 2.8, avgAgainst: 1.0, rec: { w: 8, d: 1, l: 0 },
      scorers: [
        { name: "H. Kane", scored: 10, played: 12, homeScored: 6, homeMatches: 7 },
        { name: "J. Musiala", scored: 5, played: 11, homeScored: 3, homeMatches: 6 },
      ],
      dist: [5, 18, 32, 45], p4: 28, pen: { awarded: 6, conceded: 1, played: 12, scored: 5 },
    }),
    away: mkTeam("away", {
      name: "Borussia Dortmund", short: "BVB", form: ["W", "L", "W", "D", "W"],
      avgFor: 2.0, avgAgainst: 1.4, rec: { w: 4, d: 2, l: 3 },
      scorers: [
        { name: "S. Guirassy", scored: 7, played: 12, awayScored: 3, awayMatches: 6 },
        { name: "K. Adeyemi", scored: 4, played: 11, awayScored: 2, awayMatches: 6 },
      ],
      dist: [14, 26, 30, 30], p4: 17, pen: { awarded: 3, conceded: 4, played: 12, scored: 2 },
    }),
    h2h: [
      { date: "2025-01", score: "3 - 1", winner: "home" },
      { date: "2024-11", score: "2 - 2", winner: "draw" },
      { date: "2024-03", score: "0 - 2", winner: "away" },
      { date: "2023-11", score: "4 - 0", winner: "home" },
      { date: "2023-04", score: "1 - 1", winner: "draw" },
    ],
  },
  es: {
    league: "La Liga",
    date: "Dim. 15 juin — 21:00",
    home: mkTeam("home", {
      name: "Real Madrid", short: "RMA", form: ["W", "W", "D", "W", "W"],
      avgFor: 2.4, avgAgainst: 0.9, rec: { w: 7, d: 2, l: 0 },
      scorers: [
        { name: "K. Mbappé", scored: 9, played: 12, homeScored: 5, homeMatches: 7 },
        { name: "Vinícius Jr", scored: 6, played: 11, homeScored: 4, homeMatches: 6 },
        { name: "J. Bellingham", scored: 4, played: 12, homeScored: 2, homeMatches: 7 },
      ],
      dist: [8, 24, 33, 35], p4: 20, pen: { awarded: 5, conceded: 1, played: 12, scored: 5 },
    }),
    away: mkTeam("away", {
      name: "FC Barcelone", short: "BAR", form: ["W", "W", "L", "W", "W"],
      avgFor: 2.5, avgAgainst: 1.2, rec: { w: 6, d: 1, l: 2 },
      scorers: [
        { name: "R. Lewandowski", scored: 9, played: 12, awayScored: 4, awayMatches: 6 },
        { name: "Lamine Yamal", scored: 5, played: 12, awayScored: 3, awayMatches: 6 },
      ],
      dist: [9, 22, 34, 35], p4: 21, pen: { awarded: 4, conceded: 2, played: 12, scored: 3 },
    }),
    h2h: [
      { date: "2025-01", score: "2 - 1", winner: "home" },
      { date: "2024-10", score: "0 - 4", winner: "away" },
      { date: "2024-04", score: "3 - 2", winner: "home" },
      { date: "2023-10", score: "1 - 2", winner: "away" },
      { date: "2023-03", score: "2 - 2", winner: "draw" },
    ],
  },
  pt: {
    league: "Primeira Liga",
    date: "Dim. 15 juin — 20:30",
    home: mkTeam("home", {
      name: "Benfica", short: "SLB", form: ["W", "W", "W", "D", "W"],
      avgFor: 2.2, avgAgainst: 0.8, rec: { w: 7, d: 1, l: 1 },
      scorers: [
        { name: "V. Pavlidis", scored: 8, played: 12, homeScored: 5, homeMatches: 7 },
        { name: "Á. Di María", scored: 5, played: 11, homeScored: 3, homeMatches: 6 },
      ],
      dist: [9, 27, 34, 30], p4: 16, pen: { awarded: 5, conceded: 1, played: 12, scored: 4 },
    }),
    away: mkTeam("away", {
      name: "FC Porto", short: "POR", form: ["W", "D", "W", "L", "W"],
      avgFor: 1.8, avgAgainst: 1.1, rec: { w: 5, d: 2, l: 2 },
      scorers: [
        { name: "S. Omorodion", scored: 6, played: 12, awayScored: 2, awayMatches: 6 },
        { name: "P. Gonçalves", scored: 4, played: 11, awayScored: 2, awayMatches: 6 },
      ],
      dist: [16, 30, 32, 22], p4: 11, pen: { awarded: 3, conceded: 3, played: 12, scored: 3 },
    }),
    h2h: [
      { date: "2025-02", score: "1 - 1", winner: "draw" },
      { date: "2024-09", score: "2 - 0", winner: "home" },
      { date: "2024-04", score: "0 - 1", winner: "away" },
      { date: "2023-11", score: "2 - 1", winner: "home" },
      { date: "2023-05", score: "1 - 1", winner: "draw" },
    ],
  },
};

const TENNIS_MATCH = {
  tournament: "Roland-Garros — 1/8 finale",
  surface: "Terre battue",
  date: "Lun. 9 juin — 14:00",
  p1: {
    name: "C. Alcaraz",
    rank: 2,
    form: ["W", "W", "W", "L", "W"],
    surfaceWinRate: 82, // % sur cette surface
    acesAvg: 6.2,
    setsWonPct: 71,
  },
  p2: {
    name: "J. Sinner",
    rank: 1,
    form: ["W", "W", "W", "W", "L"],
    surfaceWinRate: 74,
    acesAvg: 8.1,
    setsWonPct: 68,
  },
  h2h: [
    { date: "2025 Madrid", surface: "Terre", score: "6-4 7-6", winner: "p1" },
    { date: "2024 RG", surface: "Terre", score: "3-6 6-4 6-3", winner: "p2" },
    { date: "2024 Pékin", surface: "Dur", score: "7-6 6-3", winner: "p1" },
    { date: "2023 Indian Wells", surface: "Dur", score: "6-3 6-2", winner: "p2" },
  ],
  trends: [
    { label: "Match en +3 sets", value: 65, sub: "tendance H2H récente" },
    { label: "Tie-break joué", value: 50, sub: "2 des 4 derniers" },
    { label: "Alcaraz sur terre", value: 82, sub: "saison en cours" },
  ],
};

// ============================================================
// COMPOSANTS PARTAGÉS
// ============================================================

const C = {
  bg: "#0a0e14",
  panel: "#121821",
  panel2: "#1a2230",
  line: "#222c3a",
  text: "#e6edf3",
  dim: "#8b98a9",
  accent: "#3ddc97",
  accentDim: "#1c7a55",
  warn: "#f0a04b",
  red: "#e5484d",
  blue: "#5b9bd5",
};

function FormPills({ form }) {
  const color = (r) =>
    r === "W" ? C.accent : r === "L" ? C.red : C.dim;
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {form.map((r, i) => (
        <span
          key={i}
          style={{
            width: 22,
            height: 22,
            borderRadius: 5,
            display: "grid",
            placeItems: "center",
            fontSize: 11,
            fontWeight: 700,
            color: C.bg,
            background: color(r),
            opacity: 0.55 + (i / form.length) * 0.45, // récent = plus vif
          }}
        >
          {r}
        </span>
      ))}
    </div>
  );
}

function Bar({ value, color = C.accent }) {
  return (
    <div
      style={{
        height: 8,
        background: C.panel2,
        borderRadius: 99,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${value}%`,
          height: "100%",
          background: color,
          borderRadius: 99,
          transition: "width .6s cubic-bezier(.2,.8,.2,1)",
        }}
      />
    </div>
  );
}

function TrendCard({ t }) {
  return (
    <div
      style={{
        background: C.panel,
        border: `1px solid ${C.line}`,
        borderRadius: 12,
        padding: "14px 16px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>
          {t.label}
        </span>
        <span style={{ fontSize: 18, fontWeight: 800, color: C.accent }}>
          {t.value}%
        </span>
      </div>
      <Bar value={t.value} />
      <div style={{ fontSize: 11, color: C.dim, marginTop: 8 }}>{t.sub}</div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div
      style={{
        fontSize: 11,
        letterSpacing: 2,
        textTransform: "uppercase",
        color: C.dim,
        fontWeight: 700,
        margin: "26px 0 14px",
      }}
    >
      {children}
    </div>
  );
}

// ============================================================
// VUE FOOTBALL
// ============================================================

const FOOT_TABS = [
  { id: "resultat", label: "Victoire / Défaite" },
  { id: "buteur", label: "Buteur" },
  { id: "buts", label: "Buts par match" },
  { id: "penalty", label: "Penalty" },
];

function FootballView() {
  const [leagueId, setLeagueId] = useState("fr");
  const [tab, setTab] = useState("resultat");
  const m = FOOTBALL_DATA[leagueId];
  return (
    <div>
      {/* Sélecteur de championnat */}
      <div
        style={{
          display: "flex",
          gap: 6,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        {FOOT_LEAGUES.map((l) => (
          <button
            key={l.id}
            onClick={() => setLeagueId(l.id)}
            style={{
              border: `1px solid ${leagueId === l.id ? C.accent : C.line}`,
              cursor: "pointer",
              padding: "7px 13px",
              borderRadius: 9,
              fontSize: 12.5,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 7,
              background: leagueId === l.id ? `${C.accent}1a` : C.panel,
              color: leagueId === l.id ? C.accent : C.dim,
              transition: "all .15s",
            }}
          >
            <span style={{ fontSize: 15 }}>{l.flag}</span>
            {l.country}
          </button>
        ))}
      </div>

      <div style={{ color: C.dim, fontSize: 12, marginBottom: 4 }}>
        {m.league} · {m.date}
      </div>

      {/* Confrontation */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: 16,
          background: C.panel,
          border: `1px solid ${C.line}`,
          borderRadius: 16,
          padding: "22px 20px",
        }}
      >
        <div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{m.home.name}</div>
          <div style={{ fontSize: 11, color: C.dim, margin: "6px 0 10px" }}>
            DOMICILE · {m.home.homeRecord.w}V {m.home.homeRecord.d}N{" "}
            {m.home.homeRecord.l}D
          </div>
          <FormPills form={m.home.form} />
        </div>
        <div
          style={{
            fontSize: 13,
            color: C.dim,
            fontWeight: 700,
            padding: "0 8px",
          }}
        >
          VS
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{m.away.name}</div>
          <div style={{ fontSize: 11, color: C.dim, margin: "6px 0 10px" }}>
            EXTÉRIEUR · {m.away.awayRecord.w}V {m.away.awayRecord.d}N{" "}
            {m.away.awayRecord.l}D
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <FormPills form={m.away.form} />
          </div>
        </div>
      </div>

      {/* Barre d'onglets */}
      <div
        style={{
          display: "flex",
          gap: 6,
          marginTop: 18,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        {FOOT_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              border: `1px solid ${tab === t.id ? C.accent : C.line}`,
              cursor: "pointer",
              padding: "8px 14px",
              borderRadius: 9,
              fontSize: 12.5,
              fontWeight: 700,
              background: tab === t.id ? `${C.accent}1a` : C.panel,
              color: tab === t.id ? C.accent : C.dim,
              transition: "all .15s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "resultat" && <TabResultat m={m} />}
      {tab === "buteur" && <TabButeur m={m} />}
      {tab === "buts" && <TabButs m={m} />}
      {tab === "penalty" && <TabPenalty m={m} />}
    </div>
  );
}

// --- Onglet : Victoire / Défaite (forme, bilans, comparaison, H2H) ---
function TabResultat({ m }) {
  return (
    <div>
      <SectionTitle>Comparaison — moyennes par match</SectionTitle>
      <StatRow
        label="Buts marqués"
        a={m.home.avgGoalsScored}
        b={m.away.avgGoalsScored}
        max={2.5}
      />
      <StatRow
        label="Buts encaissés"
        a={m.home.avgGoalsConceded}
        b={m.away.avgGoalsConceded}
        max={2.5}
        invert
      />

      <SectionTitle>Face-à-face — 5 dernières</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {m.h2h.map((h, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "70px 1fr 70px",
              alignItems: "center",
              background: C.panel,
              border: `1px solid ${C.line}`,
              borderRadius: 10,
              padding: "10px 14px",
              fontSize: 13,
            }}
          >
            <span style={{ color: C.dim, fontSize: 11 }}>{h.date}</span>
            <span
              style={{
                textAlign: "center",
                fontWeight: 800,
                color:
                  h.winner === "home"
                    ? C.accent
                    : h.winner === "away"
                    ? C.blue
                    : C.dim,
              }}
            >
              {h.score}
            </span>
            <span
              style={{
                textAlign: "right",
                fontSize: 10,
                color: C.dim,
                textTransform: "uppercase",
              }}
            >
              {h.winner === "draw"
                ? "Nul"
                : h.winner === "home"
                ? m.home.short
                : m.away.short}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Onglet : Buteur (fréquence de but) ---
function TabButeur({ m }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: C.dim,
          marginBottom: 14,
          lineHeight: 1.5,
        }}
      >
        Part des matchs où le joueur a marqué. Donnée historique — ne prédit pas
        le match à venir.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <div
            style={{
              fontSize: 11,
              color: C.accent,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 8,
            }}
          >
            {m.home.short} · domicile
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {m.home.scorers.map((s, i) => (
              <ScorerCard key={i} s={s} side="home" teamColor={C.accent} />
            ))}
          </div>
        </div>
        <div>
          <div
            style={{
              fontSize: 11,
              color: C.blue,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 8,
            }}
          >
            {m.away.short} · extérieur
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {m.away.scorers.map((s, i) => (
              <ScorerCard key={i} s={s} side="away" teamColor={C.blue} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Onglet : Buts par match (distribution + over/under) ---
function TabButs({ m }) {
  const Team = ({ team, color, label }) => (
    <div>
      <div
        style={{
          fontSize: 11,
          color,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 1,
          marginBottom: 10,
        }}
      >
        {team.short} · {label}
      </div>

      <div style={{ fontSize: 11, color: C.dim, marginBottom: 8 }}>
        Répartition des buts marqués
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
        {team.goalsDist.map((g, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "60px 1fr 40px", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: C.text }}>{g.label}</span>
            <Bar value={g.pct} color={color} />
            <span style={{ fontSize: 12, fontWeight: 700, textAlign: "right", color: C.dim }}>{g.pct}%</span>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, color: C.dim, marginBottom: 8 }}>
        Seuils (over)
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {team.over.map((o, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "60px 1fr 40px", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: C.text }}>{o.label}</span>
            <Bar value={o.pct} color={color} />
            <span style={{ fontSize: 12, fontWeight: 700, textAlign: "right", color: C.dim }}>{o.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ fontSize: 11, color: C.dim, marginBottom: 14, lineHeight: 1.5 }}>
        Fréquences observées sur les matchs récents de chaque équipe — repère
        pour les marchés over/under.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <Team team={m.home} color={C.accent} label="domicile" />
        <Team team={m.away} color={C.blue} label="extérieur" />
      </div>
    </div>
  );
}

// --- Onglet : Penalty ---
function TabPenalty({ m }) {
  const Pen = ({ team, color, label }) => {
    const ratePerMatch = (team.penalties.awarded / team.penalties.played).toFixed(2);
    const concededPerMatch = (team.penalties.conceded / team.penalties.played).toFixed(2);
    const convPct = Math.round((team.penalties.scored / team.penalties.awarded) * 100);
    return (
      <div
        style={{
          background: C.panel,
          border: `1px solid ${C.line}`,
          borderRadius: 12,
          padding: "16px 18px",
        }}
      >
        <div
          style={{
            fontSize: 11,
            color,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 1,
            marginBottom: 14,
          }}
        >
          {team.short} · {label}
        </div>
        <PenStat label="Penalty obtenus" value={team.penalties.awarded} sub={`${ratePerMatch} / match`} color={color} />
        <PenStat label="Penalty concédés" value={team.penalties.conceded} sub={`${concededPerMatch} / match`} color={C.warn} />
        <PenStat label="Taux de conversion" value={`${convPct}%`} sub={`${team.penalties.scored}/${team.penalties.awarded} marqués`} color={color} last />
      </div>
    );
  };

  return (
    <div>
      <div style={{ fontSize: 11, color: C.dim, marginBottom: 14, lineHeight: 1.5 }}>
        Sur les matchs récents. Penalty obtenus et concédés — repère pour les
        marchés liés aux penalties.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Pen team={m.home} color={C.accent} label="domicile" />
        <Pen team={m.away} color={C.blue} label="extérieur" />
      </div>
    </div>
  );
}

function PenStat({ label, value, sub, color, last }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 0",
        borderBottom: last ? "none" : `1px solid ${C.line}`,
      }}
    >
      <div>
        <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{sub}</div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function ScorerCard({ s, side, teamColor }) {
  const pct = Math.round((s.scored / s.played) * 100);
  // découpage contextuel : domicile pour l'équipe à domicile, extérieur sinon
  const ctxScored = side === "home" ? s.homeScored : s.awayScored;
  const ctxMatches = side === "home" ? s.homeMatches : s.awayMatches;
  const ctxPct =
    ctxMatches > 0 ? Math.round((ctxScored / ctxMatches) * 100) : null;
  const ctxLabel = side === "home" ? "à domicile" : "à l'extérieur";

  return (
    <div
      style={{
        background: C.panel,
        border: `1px solid ${C.line}`,
        borderRadius: 12,
        padding: "14px 16px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 6,
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</span>
        <span style={{ fontSize: 20, fontWeight: 800, color: teamColor }}>
          {pct}%
        </span>
      </div>
      <div style={{ fontSize: 11, color: C.dim, marginBottom: 8 }}>
        a marqué dans {s.scored} de ses {s.played} matchs
      </div>
      <Bar value={pct} color={teamColor} />
      {ctxPct !== null && (
        <div style={{ fontSize: 11, color: C.dim, marginTop: 8 }}>
          {ctxLabel} :{" "}
          <span style={{ color: C.text, fontWeight: 600 }}>{ctxPct}%</span> (
          {ctxScored}/{ctxMatches})
        </div>
      )}
    </div>
  );
}

function StatRow({ label, a, b, max, invert }) {
  const aPct = Math.min(100, (a / max) * 100);
  const bPct = Math.min(100, (b / max) * 100);
  // pour "encaissés", moins c'est mieux → on garde la couleur neutre
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 120px 1fr",
        alignItems: "center",
        gap: 14,
        marginBottom: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontWeight: 800, width: 34 }}>{a}</span>
        <div style={{ flex: 1, transform: "scaleX(-1)" }}>
          <Bar value={aPct} color={invert ? C.warn : C.accent} />
        </div>
      </div>
      <div
        style={{
          textAlign: "center",
          fontSize: 11,
          color: C.dim,
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Bar value={bPct} color={invert ? C.warn : C.blue} />
        </div>
        <span style={{ fontWeight: 800, width: 34, textAlign: "right" }}>
          {b}
        </span>
      </div>
    </div>
  );
}

// ============================================================
// VUE TENNIS
// ============================================================

function TennisView() {
  const m = TENNIS_MATCH;
  return (
    <div>
      <div style={{ color: C.dim, fontSize: 12, marginBottom: 4 }}>
        {m.tournament} · {m.date}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: 16,
          background: C.panel,
          border: `1px solid ${C.line}`,
          borderRadius: 16,
          padding: "22px 20px",
        }}
      >
        <div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{m.p1.name}</div>
          <div style={{ fontSize: 11, color: C.dim, margin: "6px 0 10px" }}>
            ATP #{m.p1.rank}
          </div>
          <FormPills form={m.p1.form} />
        </div>
        <div style={{ fontSize: 13, color: C.dim, fontWeight: 700 }}>VS</div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{m.p2.name}</div>
          <div style={{ fontSize: 11, color: C.dim, margin: "6px 0 10px" }}>
            ATP #{m.p2.rank}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <FormPills form={m.p2.form} />
          </div>
        </div>
      </div>

      {/* Surface — facteur clé tennis */}
      <div
        style={{
          marginTop: 14,
          background: `linear-gradient(135deg, ${C.accentDim}22, transparent)`,
          border: `1px solid ${C.accentDim}`,
          borderRadius: 12,
          padding: "12px 16px",
          fontSize: 12,
          color: C.text,
        }}
      >
        <span style={{ color: C.accent, fontWeight: 700 }}>SURFACE</span> ·{" "}
        {m.surface} — facteur déterminant au tennis
      </div>

      <SectionTitle>Performance sur la surface ({m.surface})</SectionTitle>
      <StatRow
        label="% victoires surface"
        a={m.p1.surfaceWinRate}
        b={m.p2.surfaceWinRate}
        max={100}
      />
      <StatRow label="Aces / match" a={m.p1.acesAvg} b={m.p2.acesAvg} max={12} />
      <StatRow
        label="% sets gagnés"
        a={m.p1.setsWonPct}
        b={m.p2.setsWonPct}
        max={100}
      />

      <SectionTitle>Face-à-face</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {m.h2h.map((h, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr",
              alignItems: "center",
              background: C.panel,
              border: `1px solid ${C.line}`,
              borderRadius: 10,
              padding: "10px 14px",
              fontSize: 12,
            }}
          >
            <span style={{ color: C.dim }}>
              {h.date}
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 10,
                  color: h.surface === "Terre" ? C.warn : C.blue,
                }}
              >
                {h.surface}
              </span>
            </span>
            <span style={{ fontWeight: 700, padding: "0 12px" }}>
              {h.score}
            </span>
            <span
              style={{
                textAlign: "right",
                fontSize: 11,
                fontWeight: 700,
                color: h.winner === "p1" ? C.accent : C.blue,
              }}
            >
              {h.winner === "p1" ? m.p1.name : m.p2.name}
            </span>
          </div>
        ))}
      </div>

      <SectionTitle>Tendances</SectionTitle>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
        }}
      >
        {m.trends.map((t, i) => (
          <TrendCard key={i} t={t} />
        ))}
      </div>
    </div>
  );
}

// ============================================================
// APP
// ============================================================

export default function App() {
  const [sport, setSport] = useState("foot");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.text,
        fontFamily:
          "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
        padding: "0 0 60px",
      }}
    >
      {/* Header */}
      <div
        style={{
          borderBottom: `1px solid ${C.line}`,
          padding: "18px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          background: `${C.bg}ee`,
          backdropFilter: "blur(8px)",
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: C.accent,
              display: "grid",
              placeItems: "center",
              color: C.bg,
              fontWeight: 900,
              fontSize: 16,
            }}
          >
            ⌁
          </div>
          <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: -0.3 }}>
            EdgeStat
          </span>
          <span
            style={{
              fontSize: 10,
              color: C.dim,
              border: `1px solid ${C.line}`,
              borderRadius: 5,
              padding: "2px 6px",
              marginLeft: 4,
            }}
          >
            MAQUETTE — données fictives
          </span>
        </div>

        {/* Sélecteur sport */}
        <div
          style={{
            display: "flex",
            background: C.panel,
            border: `1px solid ${C.line}`,
            borderRadius: 9,
            padding: 3,
          }}
        >
          {[
            { id: "foot", label: "⚽ Football" },
            { id: "tennis", label: "🎾 Tennis" },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => setSport(s.id)}
              style={{
                border: "none",
                cursor: "pointer",
                padding: "7px 16px",
                borderRadius: 7,
                fontSize: 13,
                fontWeight: 700,
                background: sport === s.id ? C.accent : "transparent",
                color: sport === s.id ? C.bg : C.dim,
                transition: "all .15s",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenu */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 24px" }}>
        {sport === "foot" ? <FootballView /> : <TennisView />}

        {/* Disclaimer — angle défendable, pas de promesse de gain */}
        <div
          style={{
            marginTop: 36,
            padding: "14px 16px",
            background: C.panel,
            border: `1px solid ${C.line}`,
            borderRadius: 10,
            fontSize: 11,
            color: C.dim,
            lineHeight: 1.6,
          }}
        >
          Outil d'analyse statistique et de visualisation. Les données présentées
          sont des aides à la décision et ne constituent pas une prédiction ni
          une garantie de résultat. Les paris comportent un risque de perte. Jouer
          comporte des risques : endettement, isolement, dépendance.
        </div>
      </div>
    </div>
  );
}
