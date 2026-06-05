// ============================================================
// Tavily Search — Recherche web en temps réel pour l'IA
// Donne à l'IA accès aux actualités football du jour
// ============================================================
import "dotenv/config";

const TAVILY_KEY = process.env.TAVILY_API_KEY;
const CACHE_TTL  = 10 * 60 * 1000; // cache 10 min
const cache      = new Map(); // cache en mémoire (léger)

// ── Construire la requête de recherche depuis la question ────
function buildSearchQuery(question, matchContext) {
  const q = question.toLowerCase();

  // Extraire les noms d'équipes / joueurs mentionnés
  const keywords = [];

  // Si contexte de match disponible
  if (matchContext?.home?.name) keywords.push(matchContext.home.name);
  if (matchContext?.away?.name) keywords.push(matchContext.away.name);

  // Détecter les sujets clés dans la question
  if (q.includes("transfert") || q.includes("mercato") || q.includes("recrut") || q.includes("signe"))
    keywords.push("transfert 2025 2026");
  if (q.includes("blessé") || q.includes("blessure") || q.includes("forfait") || q.includes("absent"))
    keywords.push("blessure absent");
  if (q.includes("entraîneur") || q.includes("coach") || q.includes("manager") || q.includes("licencié"))
    keywords.push("entraîneur");
  if (q.includes("résultat") || q.includes("score") || q.includes("match"))
    keywords.push("résultat match");
  if (q.includes("classement") || q.includes("classement"))
    keywords.push("classement");

  // Construire la requête finale
  const base = keywords.slice(0, 3).join(" ") || question.slice(0, 100);
  return `football ${base} 2025 2026 actualités`;
}

// ── Appel Tavily ─────────────────────────────────────────────
export async function searchFootballNews(question, matchContext = null, maxResults = 5) {
  if (!TAVILY_KEY) return null;

  const query = buildSearchQuery(question, matchContext);
  const cacheKey = query.toLowerCase().slice(0, 80);

  // Vérifier le cache
  if (cache.has(cacheKey)) {
    const { data, ts } = cache.get(cacheKey);
    if (Date.now() - ts < CACHE_TTL) return data;
  }

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_KEY,
        query,
        search_depth: "basic",
        max_results: maxResults,
        include_answer: true,
        include_raw_content: false,
        include_domains: [
          "lequipe.fr", "goal.com", "eurosport.fr", "bbc.com",
          "skysports.com", "football365.fr", "transfermarkt.com",
          "footmercato.net", "sofoot.com", "rmc.fr", "beinsports.com",
        ],
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;
    const data = await res.json();

    // Formater les résultats pour l'injection dans le prompt
    const results = {
      answer:  data.answer || null,
      sources: (data.results || []).slice(0, maxResults).map(r => ({
        title:   r.title,
        url:     r.url,
        content: r.content?.slice(0, 300) || "",
        date:    r.published_date || null,
      })),
      query,
    };

    cache.set(cacheKey, { data: results, ts: Date.now() });
    return results;
  } catch (err) {
    console.warn("[Tavily]", err.message);
    return null;
  }
}

// ── Formater les résultats pour le prompt ────────────────────
export function formatSearchForPrompt(searchResults) {
  if (!searchResults) return "";

  const lines = [
    `\n═══════════════════════════════════════`,
    `ACTUALITÉS FOOTBALL EN TEMPS RÉEL (Source: Tavily Search)`,
    `Requête: "${searchResults.query}"`,
    `═══════════════════════════════════════`,
  ];

  if (searchResults.answer) {
    lines.push(`Résumé: ${searchResults.answer}`);
    lines.push("");
  }

  searchResults.sources.forEach((s, i) => {
    if (s.content) {
      lines.push(`[${i+1}] ${s.title}${s.date ? ` (${s.date.slice(0,10)})` : ""}`);
      lines.push(`    ${s.content}`);
    }
  });

  lines.push(`═══════════════════════════════════════`);
  return lines.join("\n");
}
