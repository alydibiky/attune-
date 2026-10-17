/* Attune Pro search relay (v6.32) — a Cloudflare Worker that holds the search key so it never ships inside the app.
   The app (web-src/cloud.js, proLookup) sends POST /search { q, pages } with the header X-Attune-Device; the relay asks
   Serper (Google results — the best Arabic) and opens the top pages, then returns { hits: [{ title, url, text, date }] },
   the same shape the free search gives, so the app's grounded answers and checks work unchanged.
   Limits: DAILY_CAP searches per device per day (KV namespace LIMITS; without it, no cap). Setup: SETUP_CLOUD.md part B. */
const DAILY_CAP = 150;

export default {
  async fetch(req, env) {
    const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, X-Attune-Device", "Access-Control-Allow-Methods": "POST, OPTIONS" };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    const url = new URL(req.url);
    if (req.method !== "POST" || url.pathname !== "/search") return json({ error: "not found" }, 404, cors);
    let body; try { body = await req.json(); } catch (e) { return json({ error: "bad request" }, 400, cors); }
    const q = String(body.q || "").trim().slice(0, 300);
    const pages = Math.min(6, Math.max(1, +body.pages || 5));
    if (!q) return json({ error: "empty question" }, 400, cors);
    const device = String(req.headers.get("X-Attune-Device") || req.headers.get("CF-Connecting-IP") || "anon").slice(0, 64);
    if (env.LIMITS) {
      const k = new Date().toISOString().slice(0, 10) + ":" + device;
      const n = +(await env.LIMITS.get(k)) || 0;
      if (n >= DAILY_CAP) return json({ error: "daily limit" }, 429, cors);
      await env.LIMITS.put(k, String(n + 1), { expirationTtl: 60 * 60 * 26 });
    }
    const r = await fetch("https://google.serper.dev/search", { method: "POST",
      headers: { "Content-Type": "application/json", "X-API-KEY": env.SERPER_KEY },
      body: JSON.stringify({ q: q + " -site:wikipedia.org", num: pages + 2 }) });
    if (!r.ok) return json({ error: "search " + r.status }, 502, cors);
    const j = await r.json();
    const top = (j.organic || []).filter((x) => x.link && !/wikipedia\.org/i.test(x.link)).slice(0, pages);
    const hits = await Promise.all(top.map(async (x) => ({ title: x.title || "", url: x.link, date: x.date || "", text: (await pageText(x.link)) || x.snippet || "" })));
    return json({ hits }, 200, cors);
  },
};

/** The page's readable text (scripts, styles and menus removed), at most 6,000 characters; "" if it can't be opened in 6 s. */
async function pageText(link) {
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch(link, { signal: ctl.signal, headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 14) AttuneSearch/1.0", "Accept-Language": "ar,en;q=0.8" } });
    clearTimeout(t);
    if (!r.ok || !/html|text/i.test(r.headers.get("content-type") || "")) return "";
    const html = (await r.text()).slice(0, 600000);
    return html.replace(/<(script|style|nav|footer|header|noscript|svg)[\s\S]*?<\/\1>/gi, " ").replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim().slice(0, 6000);
  } catch (e) { return ""; }
}
const json = (o, status, headers) => new Response(JSON.stringify(o), { status, headers: { ...headers, "Content-Type": "application/json" } });
