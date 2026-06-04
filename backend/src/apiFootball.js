// ============================================================
// Client API-Football
// - La clé est lue depuis l'environnement (jamais exposée au frontend).
// - Chaque appel passe par le cache disque : un appel réel n'est fait que
//   si l'entrée est absente ou périmée.
// - Un garde-fou refuse les appels réels au-delà de DAILY_REQUEST_LIMIT.
// ============================================================
import { API } from "./config.js";
import { readCache, writeCache, getDailyCount, bumpDailyCount } from "./cache.js";

const sleep = ms => new Promise(r => setTimeout(r, ms));

function buildUrl(endpoint, params) {
  const qs = new URLSearchParams(params).toString();
  return `https://${API.host}/${endpoint}${qs ? `?${qs}` : ""}`;
}

function cacheKey(endpoint, params) {
  // clé déterministe (paramètres triés) pour un même appel → même fichier
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return `${endpoint}?${sorted}`;
}

// Appel brut à l'API (utilisé seulement en cas de cache absent/périmé).
async function fetchLive(endpoint, params) {
  if (!API.key) {
    throw new Error(
      "API_FOOTBALL_KEY manquante. Copie backend/.env.example vers backend/.env et renseigne ta clé."
    );
  }
  const url = buildUrl(endpoint, params);
  const res = await fetch(url, {
    headers: { "x-apisports-key": API.key },
  });
  if (!res.ok) {
    throw new Error(`API-Football ${endpoint} → HTTP ${res.status}`);
  }
  const json = await res.json();
  // API-Football renvoie les erreurs métier dans json.errors (HTTP 200).
  if (json.errors && Object.keys(json.errors).length > 0) {
    throw new Error(`API-Football ${endpoint} → ${JSON.stringify(json.errors)}`);
  }
  return json.response || [];
}

// Appel mis en cache. `ttl` = durée de fraîcheur en ms.
// En cas d'échec réseau ou de quota atteint, on retombe sur le cache périmé si dispo.
export async function apiGet(endpoint, params, ttl) {
  const key = cacheKey(endpoint, params);
  const cached = await readCache(key, ttl);
  if (cached && cached.fresh) return cached.value;

  // Garde-fou quota : on ne dépasse pas la limite quotidienne d'appels réels.
  const count = await getDailyCount();
  if (count >= API.dailyLimit) {
    if (cached) {
      console.warn(
        `[quota] ${count}/${API.dailyLimit} atteint — service du cache périmé pour ${key}`
      );
      return cached.value;
    }
    throw new Error(
      `Quota quotidien atteint (${count}/${API.dailyLimit}) et aucune donnée en cache pour ${key}.`
    );
  }

  try {
    await sleep(1200); // rate-limit uniquement sur vrais appels réseau
    const value = await fetchLive(endpoint, params);
    await bumpDailyCount();
    await writeCache(key, value);
    return value;
  } catch (err) {
    if (cached) {
      console.warn(`[fallback cache] ${key} : ${err.message}`);
      return cached.value; // mieux vaut une donnée un peu vieille qu'une erreur
    }
    throw err;
  }
}
