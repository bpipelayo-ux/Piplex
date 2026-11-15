// Piplex serverless search API for Vercel
// Set BRAVE_SEARCH_API_KEY in Vercel Project Settings > Environment Variables.
const BASE = "https://api.search.brave.com/res/v1";

const endpoints = {
  web: "web/search",
  images: "images/search",
  videos: "videos/search",
  news: "news/search",
  suggest: "suggest/search"
};

function send(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.end(JSON.stringify(body));
}

function normalizeResults(type, payload) {
  const rows =
    type === "web" ? payload.web?.results :
    type === "images" ? payload.results :
    type === "videos" ? payload.results :
    type === "news" ? payload.results : [];
  return (Array.isArray(rows) ? rows : []).map((item) => {
    const pageUrl = item.url || item.source_url || "";
    const thumb =
      item.thumbnail?.src ||
      item.thumbnail?.original ||
      item.properties?.url ||
      item.video?.thumbnail?.src ||
      "";
    return {
      title: item.title || item.name || "Untitled result",
      url: pageUrl,
      description: item.description || item.extra_snippets?.[0] || "",
      source: item.meta_url?.hostname || item.meta_url?.netloc || item.source || "",
      age: item.age || item.page_age || "",
      image: thumb
    };
  }).filter((item) => /^https?:\/\//i.test(item.url));
}

async function braveRequest(path, params, method = "GET", body) {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) {
    const error = new Error("Piplex is not connected to its search provider yet. Add BRAVE_SEARCH_API_KEY in Vercel Environment Variables.");
    error.status = 503;
    throw error;
  }
  const url = new URL(`${BASE}/${path}`);
  if (method === "GET") {
    for (const [name, value] of Object.entries(params || {})) {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(name, String(value));
    }
  }
  const response = await fetch(url, {
    method,
    headers: {
      "Accept": "application/json",
      "X-Subscription-Token": key,
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      response.status === 401 ? "The Brave API key was rejected. Check the key in Vercel." :
      response.status === 429 ? "The search provider rate limit or plan quota has been reached." :
      data.error?.detail || data.message || `Search provider returned HTTP ${response.status}.`
    );
    error.status = response.status === 429 ? 429 : response.status >= 500 ? 502 : 400;
    throw error;
  }
  return data;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return send(res, 405, { error: "Method not allowed." });
  }

  try {
    const type = String(req.query?.type || "web").toLowerCase();
    const q = String(req.method === "POST" ? (req.body?.q || "") : (req.query?.q || "")).trim();
    if (!q) return send(res, 400, { error: "Enter something to search." });
    if (q.length > 600) return send(res, 400, { error: "Search text is too long. Please use 600 characters or fewer." });

    if (type === "ai") {
      if (req.method !== "POST") return send(res, 405, { error: "AI Mode uses POST requests." });
      const data = await braveRequest("chat/completions", {}, "POST", {
        model: "brave",
        stream: false,
        messages: [{ role: "user", content: q }]
      });
      const message = data.choices?.[0]?.message?.content;
      const answer = typeof message === "string" ? message :
        Array.isArray(message) ? message.map(part => part.text || "").join("\n") : "";
      const rawCitations = data.citations || data.sources || data.choices?.[0]?.message?.citations || [];
      const citations = (Array.isArray(rawCitations) ? rawCitations : []).map((item, index) => ({
        number: item.number || index + 1,
        title: item.title || item.name || item.url || "Source",
        url: item.url || item.link || ""
      })).filter(item => /^https?:\/\//i.test(item.url));
      return send(res, 200, { answer: answer || "No answer was returned.", citations });
    }

    if (!endpoints[type]) return send(res, 400, { error: "Unknown search type." });
    const data = await braveRequest(endpoints[type], {
      q,
      count: type === "suggest" ? 7 : 12,
      country: "NG",
      search_lang: "en",
      safesearch: "strict",
      spellcheck: "true",
      rich: type === "suggest" ? "true" : undefined
    });
    if (type === "suggest") {
      const suggestions = (data.results || []).map(item => item.query || item.title).filter(Boolean);
      return send(res, 200, { suggestions });
    }
    return send(res, 200, { results: normalizeResults(type, data) });
  } catch (error) {
    const status = Number.isInteger(error.status) ? error.status : 502;
    return send(res, status, { error: error.message || "Piplex could not complete this search." });
  }
};
