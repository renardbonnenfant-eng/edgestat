// Accès au backend EdgeStat. Le frontend ne parle qu'à son propre backend,
// jamais directement à API-Football (la clé reste côté serveur).

export async function login(password) {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Erreur de connexion");
  return body; // { ok, token }
}

export async function fetchTennisTournaments() {
  const res = await fetch("/api/tennis/tournaments");
  return res.json();
}

export async function fetchTennisMatch(tournamentId, season) {
  const url = `/api/tennis/${tournamentId}${season ? `?season=${season}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erreur HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchCompetition(id) {
  const res = await fetch(`/api/competition/${id}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erreur HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchFootball() {
  const res = await fetch("/api/football");
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erreur backend (HTTP ${res.status})`);
  }
  return res.json();
}

export async function sendChat(question, context, history, teamDatabase = {}) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, context, history, teamDatabase }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erreur backend (HTTP ${res.status})`);
  }
  return res.json();
}

export async function fetchMatch(leagueId, fixtureId) {
  const res = await fetch(`/api/match?league=${leagueId}&fixtureId=${fixtureId}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erreur backend (HTTP ${res.status})`);
  }
  return res.json();
}

export async function fetchOdds(fixtureId) {
  if (!fixtureId) return null;
  const res = await fetch(`/api/odds/${fixtureId}`);
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

export async function fetchTeamLogo(teamName) {
  if (!teamName) return null;
  const res = await fetch(`/api/team-logo?name=${encodeURIComponent(teamName)}`);
  if (!res.ok) return null;
  const d = await res.json().catch(() => null);
  return d?.logo || null;
}

export async function fetchHistorySeasons(leagueId) {
  const res = await fetch(`/api/history/seasons/${leagueId}`);
  if (!res.ok) return { seasons:[], name:"", logo:"" };
  return res.json().catch(() => ({ seasons:[], name:"", logo:"" }));
}

export async function fetchHistorySeason(leagueId, season) {
  const res = await fetch(`/api/history/season/${leagueId}/${season}`);
  if (!res.ok) throw new Error((await res.json().catch(()=>({}))).error || `HTTP ${res.status}`);
  return res.json();
}

export async function fetchWeatherStats(leagueId, fixtureId) {
  const res = await fetch(`/api/weather-stats?league=${leagueId}&fixtureId=${fixtureId}`);
  if (!res.ok) throw new Error((await res.json().catch(()=>({}))).error || `HTTP ${res.status}`);
  return res.json();
}

export async function fetchPlayerSearch(q) {
  if (!q || q.length < 3) return [];
  const res = await fetch(`/api/player-search?q=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  return res.json().catch(() => []);
}

export async function fetchStandings(leagueId, season) {
  const url = `/api/standings/${leagueId}${season ? `?season=${season}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  return res.json().catch(() => []);
}

export async function fetchNext(n = 50) {
  const res = await fetch(`/api/next?n=${n}`);
  if (!res.ok) return [];
  return res.json().catch(() => []);
}

export async function fetchLive() {
  const res = await fetch("/api/live");
  if (!res.ok) return [];
  return res.json().catch(() => []);
}

export async function fetchLineup(fixtureId) {
  const res = await fetch(`/api/lineup/${fixtureId}`);
  if (!res.ok) return { home: null, away: null };
  return res.json().catch(() => ({ home: null, away: null }));
}

export async function fetchMatchEvents(fixtureId) {
  const res = await fetch(`/api/events/${fixtureId}`);
  if (!res.ok) return [];
  return res.json().catch(() => []);
}

export async function fetchFullMatchEvents(fixtureId) {
  const res = await fetch(`/api/match-events/${fixtureId}`);
  if (!res.ok) return [];
  return res.json().catch(() => []);
}

export async function fetchInjuries(teamId, season) {
  const url = `/api/injuries/${teamId}${season ? `?season=${season}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  return res.json().catch(() => []);
}

export async function fetchSquad(teamId) {
  const res = await fetch(`/api/squad/${teamId}`);
  if (!res.ok) throw new Error((await res.json().catch(()=>({}))).error || `HTTP ${res.status}`);
  return res.json();
}

export async function fetchBracket(leagueId, season) {
  const url = `/api/bracket/${leagueId}${season ? `?season=${season}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json().catch(()=>({}))).error || `HTTP ${res.status}`);
  return res.json();
}

export async function fetchClubCard(teamId, season) {
  const url = `/api/club-card/${teamId}${season ? `?season=${season}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json().catch(()=>({}))).error || `HTTP ${res.status}`);
  return res.json();
}

export async function fetchPlayer(playerId, season, tsdbId) {
  const params = new URLSearchParams();
  if (season) params.set("season", season);
  if (tsdbId) params.set("tsdbId", tsdbId);
  const url = `/api/player/${playerId}?${params}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json().catch(()=>({}))).error || `HTTP ${res.status}`);
  return res.json();
}

export async function fetchMatchStats(fixtureId) {
  const res = await fetch(`/api/match-stats/${fixtureId}`);
  if (!res.ok) return [];
  return res.json().catch(() => []);
}

export async function fetchClubFeed(teamId, season) {
  const url = `/api/club-feed/${teamId}${season ? `?season=${season}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json().catch(()=>({}))).error || `HTTP ${res.status}`);
  return res.json();
}
