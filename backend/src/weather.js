// ============================================================
// Météo historique — Open-Meteo (gratuit, sans clé API)
// https://archive-api.open-meteo.com  +  geocoding-api.open-meteo.com
// ============================================================
import { readCache, writeCache } from "./cache.js";

const sleep      = ms => new Promise(r => setTimeout(r, ms));
const FINISHED   = new Set(["FT","AET","PEN"]);
const TTL_GEO    = 30 * 24 * 60 * 60 * 1000;  // 30 jours
const TTL_WX     =  7 * 24 * 60 * 60 * 1000;  // 7 jours

// ── Géocodage ville → { lat, lon } ─────────────────────────
export async function geocodeCity(city) {
  const key = `geo:${city.toLowerCase().replace(/\s+/g,"-")}`;
  const cached = await readCache(key, TTL_GEO);
  if (cached?.fresh) return cached.value;

  await sleep(200); // poli avec l'API gratuite
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&format=json&language=fr`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const data = await res.json();
  const r = data.results?.[0];
  const result = r ? { lat: r.latitude, lon: r.longitude, name: r.name } : null;
  if (result) await writeCache(key, result);
  return result;
}

// ── Météo journalière sur une plage de dates ────────────────
export async function fetchDailyWeather(lat, lon, startDate, endDate) {
  const key = `wx:${lat.toFixed(1)},${lon.toFixed(1)}:${startDate}:${endDate}`;
  const cached = await readCache(key, TTL_WX);
  if (cached?.fresh) return cached.value;

  const url = [
    "https://archive-api.open-meteo.com/v1/archive",
    `?latitude=${lat}&longitude=${lon}`,
    `&start_date=${startDate}&end_date=${endDate}`,
    "&daily=temperature_2m_mean,temperature_2m_max,precipitation_sum",
    "&timezone=Europe%2FParis&format=json",
  ].join("");

  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  const data = await res.json();

  const result = {};
  (data.daily?.time || []).forEach((d, i) => {
    result[d] = {
      temp:   data.daily.temperature_2m_mean?.[i] ?? null,
      tempMax:data.daily.temperature_2m_max?.[i]  ?? null,
      precip: data.daily.precipitation_sum?.[i]   ?? 0,
    };
  });

  await writeCache(key, result);
  return result;
}

// ── Calcul des statistiques météo pour une équipe ──────────
export async function computeWeatherStats(fixtures, teamId, side) {
  const relevant = fixtures.filter(f =>
    FINISHED.has(f.fixture?.status?.short) && f.fixture?.venue?.city
  ).filter(f => {
    const isHome = f.teams?.home?.id === teamId;
    return side === "home" ? isHome : !isHome;
  });

  if (relevant.length === 0) return null;

  // Grouper par ville pour minimiser les appels API
  const byCity = {};
  relevant.forEach(f => {
    const city = f.fixture.venue.city;
    if (!byCity[city]) byCity[city] = [];
    byCity[city].push(f);
  });

  // Fetch météo par ville (données groupées sur toute la plage de dates)
  const weatherMap = {}; // fixtureId → { temp, tempMax, precip }
  for (const [city, cityFx] of Object.entries(byCity)) {
    let coords;
    try { coords = await geocodeCity(city); } catch { continue; }
    if (!coords) continue;

    const dates = cityFx.map(f => f.fixture.date.slice(0,10)).sort();
    // Open-Meteo archive limité à avant-hier ; ignorer les dates trop récentes
    const yesterday = new Date(Date.now() - 2*24*60*60*1000).toISOString().slice(0,10);
    const validEnd  = dates[dates.length-1] < yesterday ? dates[dates.length-1] : yesterday;
    if (dates[0] > yesterday) continue; // que des matchs futurs
    const validDates = dates.filter(d => d <= yesterday);
    if (!validDates.length) continue;

    try {
      const wx = await fetchDailyWeather(coords.lat, coords.lon, validDates[0], validEnd);
      cityFx.forEach(f => {
        const d = f.fixture.date.slice(0,10);
        if (wx[d]) weatherMap[f.fixture.id] = wx[d];
      });
    } catch { /* ville non trouvée */ }
  }

  // ── Tranches de température (5°C) ──────────────────────
  const TEMP_BRACKETS = [
    { label:"Gel / Neige",    icon:"🥶", min:-100, max:0   },
    { label:"0 – 5°C",        icon:"❄",  min:0,    max:5   },
    { label:"5 – 10°C",       icon:"🌬", min:5,    max:10  },
    { label:"10 – 15°C",      icon:"🌤", min:10,   max:15  },
    { label:"15 – 20°C",      icon:"⛅", min:15,   max:20  },
    { label:"20 – 25°C",      icon:"☀", min:20,   max:25  },
    { label:"25 – 30°C",      icon:"🌡", min:25,   max:30  },
    { label:"Canicule > 30°C",icon:"🔥", min:30,   max:100 },
  ];

  const tempStats = TEMP_BRACKETS.map(b => ({ ...b, w:0, d:0, l:0, n:0 }));

  // ── Conditions météo ────────────────────────────────────
  const condStats = [
    { key:"rain",  icon:"🌧", label:"Forte pluie (> 5 mm)",            w:0, d:0, l:0, n:0 },
    { key:"drizzle",icon:"🌦",label:"Pluie modérée (2 – 5 mm)",        w:0, d:0, l:0, n:0 },
    { key:"dry",   icon:"🌤", label:"Sec (< 2 mm)",                     w:0, d:0, l:0, n:0 },
    { key:"cold",  icon:"❄",  label:"Froid (< 5°C)",                   w:0, d:0, l:0, n:0 },
    { key:"mild",  icon:"⛅", label:"Tempéré (10 – 20°C, sec)",         w:0, d:0, l:0, n:0 },
    { key:"hot",   icon:"🌡", label:"Forte chaleur (> 30°C)",           w:0, d:0, l:0, n:0 },
  ];

  let covered = 0;
  relevant.forEach(f => {
    const wx = weatherMap[f.fixture.id];
    if (!wx || wx.temp == null) return;
    covered++;

    const isHome = f.teams.home.id === teamId;
    const gf = isHome ? (f.goals.home ?? 0) : (f.goals.away ?? 0);
    const ga = isHome ? (f.goals.away ?? 0) : (f.goals.home ?? 0);
    const res = gf > ga ? "w" : gf < ga ? "l" : "d";

    // Température
    const b = tempStats.find(x => wx.temp >= x.min && wx.temp < x.max);
    if (b) { b[res]++; b.n++; }

    // Conditions
    const p = wx.precip || 0;
    const t = wx.temp;
    if (p > 5)                              { condStats[0][res]++; condStats[0].n++; }
    else if (p >= 2 && p <= 5)             { condStats[1][res]++; condStats[1].n++; }
    else                                    { condStats[2][res]++; condStats[2].n++; }
    if (t < 5)                              { condStats[3][res]++; condStats[3].n++; }
    if (t >= 10 && t <= 20 && p < 2)       { condStats[4][res]++; condStats[4].n++; }
    if (t > 30)                             { condStats[5][res]++; condStats[5].n++; }
  });

  return {
    tempStats:  tempStats.filter(b => b.n > 0),
    condStats:  condStats.filter(c => c.n > 0),
    total:      relevant.length,
    covered,
  };
}
