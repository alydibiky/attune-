// Web lookup for the desktop — the same work as the phone's WebTools.kt, in Node:
// three keyless engines at once (DuckDuckGo, Bing, Mojeek; Brave removed in v6.27) with one shared deadline,
// reciprocal-rank fusion, no Wikipedia (Ali's rule), no dictionary pages unless the question
// is about a word, the top pages read in full with their tables kept as rows, and the main
// picture of each page as a small JPEG. Google News RSS for Daily news.
// Only the query and the pages opened leave the computer; `online(url, why)` is the offline-lock gate.
"use strict";
const cheerio = require("cheerio");

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const isArabic = (s) => /[؀-ۿ]/.test(s);
const lang = (q) => (isArabic(q) ? "ar,en;q=0.8" : "en,ar;q=0.8");

// Electron passes its own `net.fetch` (Chromium's network stack: the system proxy and certificates, like a browser)
let FETCH = (...a) => fetch(...a);
async function get(url, { timeout = 9000, method = "GET", form = null, headers = {}, max = 2_000_000 } = {}) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await FETCH(url, { method, signal: ctl.signal, redirect: "follow",
      headers: { "User-Agent": UA, ...headers, ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
      body: form ? new URLSearchParams(form).toString() : undefined });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const buf = Buffer.from(await r.arrayBuffer());
    return { text: buf.subarray(0, max).toString("utf8"), url: r.url || url, type: r.headers.get("content-type") || "" };
  } finally { clearTimeout(t); }
}
const qs = (o) => Object.entries(o).filter(([, v]) => v !== "" && v != null).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");

function unwrapDdg(href) {
  const h = href.startsWith("//") ? "https:" + href : href;
  const i = h.indexOf("uddg="); if (i < 0) return h;
  try { return decodeURIComponent(h.slice(i + 5).split("&")[0]); } catch (e) { return h; }
}
function unwrapBing(href) {
  if (!href.includes("bing.com/ck/a")) return href;
  const m = /[?&]u=a1([^&]+)/.exec(href); if (!m) return href;
  try { return Buffer.from(m[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"); } catch (e) { return href; }
}
const txt = (el) => (el && el.length ? el.first().text().replace(/\s+/g, " ").trim() : "");

function makeEngines(online) {
  async function duckduckgo(q, max = 6, recent = "") {
    const out = [];
    const params = { q, kl: isArabic(q) ? "xa-ar" : "wt-wt", df: recent };
    for (const method of ["get", "post"]) {
      try {
        online("https://html.duckduckgo.com/html/", "web search (DuckDuckGo)");
        const r = method === "get" ? await get("https://html.duckduckgo.com/html/?" + qs(params), { timeout: 8000, headers: { "Accept-Language": lang(q), Referer: "https://html.duckduckgo.com/" } })
          : await get("https://html.duckduckgo.com/html/", { method: "POST", form: params, timeout: 8000, headers: { "Accept-Language": lang(q), Referer: "https://html.duckduckgo.com/" } });
        const $ = cheerio.load(r.text);
        $("div.result").each((_, el) => {
          const e = $(el); if (e.hasClass("result--ad") || e.find(".badge--ad").length) return;
          const a = e.find("a.result__a").first(); if (!a.length) return;
          const url = unwrapDdg(a.attr("href") || ""); if (!url.startsWith("http")) return;
          out.push({ title: a.text().trim(), url, text: txt(e.find(".result__snippet")), source: "web" });
          if (out.length >= max) return false;
        });
        if (out.length) return out;
      } catch (e) { /* the other method, then lite */ }
    }
    for (const method of ["get", "post"]) {
      try {
        online("https://lite.duckduckgo.com/lite/", "web search (DuckDuckGo Lite)");
        const p2 = { q, kl: params.kl };
        const r = method === "get" ? await get("https://lite.duckduckgo.com/lite/?" + qs(p2), { timeout: 8000, headers: { "Accept-Language": lang(q) } })
          : await get("https://lite.duckduckgo.com/lite/", { method: "POST", form: p2, timeout: 8000, headers: { "Accept-Language": lang(q) } });
        const $ = cheerio.load(r.text);
        const sn = $("td.result-snippet");
        $("a.result-link").each((i, el) => {
          const url = unwrapDdg($(el).attr("href") || ""); if (!url.startsWith("http")) return;
          out.push({ title: $(el).text().trim(), url, text: sn.eq(i).text().trim(), source: "web" });
          if (out.length >= max) return false;
        });
        if (out.length) return out;
      } catch (e) {}
    }
    return out;
  }
  async function bing(q, max = 8) {
    const out = []; const ar = isArabic(q);
    try {
      online("https://www.bing.com/search", "web search (Bing)");
      const r = await get("https://www.bing.com/search?" + qs({ q, setlang: ar ? "ar" : "en", cc: ar ? "EG" : "US" }), { timeout: 12000, headers: { "Accept-Language": lang(q) } });
      const $ = cheerio.load(r.text);
      $("li.b_algo").each((_, el) => {
        const e = $(el);
        let a = e.find("h2 a[href]").first(); if (!a.length) a = e.find(".b_algoheader a[href]").first(); if (!a.length) a = e.find("a.tilk[href]").first();
        if (!a.length) a = e.find("a[href]").filter((_, x) => ($(x).attr("href") || "").startsWith("http")).first();
        if (!a.length) return;
        const url = unwrapBing(a.attr("href") || ""); if (!url.startsWith("http") || url.includes("bing.com/")) return;
        const title = (txt(e.find("h2")) || a.text()).trim();
        let sn = e.find(".b_caption p"); if (!sn.length) sn = e.find("[class*=b_lineclamp]"); if (!sn.length) sn = e.find("p");
        if (title) out.push({ title, url, text: txt(sn), source: "web" });
        if (out.length >= max) return false;
      });
    } catch (e) {}
    return out;
  }
  async function mojeek(q, max = 8) {
    const out = [];
    try {
      online("https://www.mojeek.com/search", "web search (Mojeek)");
      const r = await get("https://www.mojeek.com/search?" + qs({ q }), { timeout: 9000, headers: { "Accept-Language": lang(q) } });
      const $ = cheerio.load(r.text);
      $("ul.results-standard > li, .results-standard li").each((_, el) => {
        const e = $(el);
        let a = e.find("h2 a[href]").first(); if (!a.length) a = e.find("a.title[href]").first(); if (!a.length) a = e.find("a.ob[href]").first();
        if (!a.length) return;
        const url = a.attr("href"); if (!url.startsWith("http") || url.includes("mojeek.com")) return;
        const title = (txt(e.find("h2")) || a.text()).trim();
        if (title && !out.some((h) => h.url === url)) out.push({ title, url, text: txt(e.find("p.s")), source: "web" });
        if (out.length >= max) return false;
      });
    } catch (e) {}
    return out;
  }
  return { duckduckgo, bing, mojeek };
}

const JUNK = /(^|\.)(merriam-webster\.com|dictionary\.cambridge\.org|dictionary\.com|thefreedictionary\.com|wordreference\.com|collinsdictionary\.com|vocabulary\.com|thesaurus\.com|oxfordlearnersdictionaries\.com|britannicaenglish\.com|wiktionary\.org|yourdictionary\.com|urbandictionary\.com|definitions\.net|almaany\.com|reverso\.net)$/;
const WORD_Q = /\b(mean(ing|s)?|defin(e|ition)|translat\w*|synonyms?|spell(ing)?|pronounc\w*)\b|معنى|معني|ترجم|مرادف/i;
const hostOf = (u) => u.toLowerCase().replace(/^https?:\/\//, "").split("/")[0].split("?")[0].replace(/^www\./, "");
const isJunk = (url, q) => !WORD_Q.test(q) && JUNK.test(hostOf(url));
const isWiki = (url) => /^https?:\/\/([a-z0-9-]+\.)*wikipedia\.org\//i.test(url);
const urlKey = (u) => u.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/[?#].*$/, "").replace(/\/+$/, "");

/** Lines of the readable part of a page; tables kept as "a | b | c" rows (spec sheets live in tables). */
function structured($, main, maxChars) {
  const BLOCKS = new Set(["li", "tr", "p", "dd", "dt", "blockquote", "figcaption", "pre"]);
  let out = "";
  main.find("h1,h2,h3,h4,h5,p,li,tr,dt,dd,blockquote,pre,figcaption,caption").each((_, el) => {
    const tag = el.tagName;
    if (tag !== "tr" && $(el).parents().toArray().some((p) => BLOCKS.has(p.tagName))) return;
    const line = tag === "tr" ? $(el).children("th,td").toArray().map((c) => $(c).text().replace(/\s+/g, " ").trim()).join(" | ").replace(/^[\s|]+|[\s|]+$/g, "")
      : $(el).text().replace(/\s+/g, " ").trim();
    if (line.length < 2) return;
    if (/^h\d$/.test(tag)) out += "\n## ";
    out += line + "\n";
    if (out.length >= maxChars) return false;
  });
  return out.trim().slice(0, maxChars);
}

function makeWeb({ online, thumb, fetch: f }) {
  if (f) FETCH = f;
  const E = makeEngines(online);
  const pageImages = new Map();

  async function pageText(url, maxChars = 2200) {
    if (!/^https?:/.test(url)) return "";
    try {
      online(url, "reading a search result");
      const r = await get(url, { timeout: 9000 });
      if (r.type && !/html|xml|text\/plain/.test(r.type)) return "";
      const $ = cheerio.load(r.text);
      try {
        let img = $("meta[property='og:image']").attr("content") || $("meta[name='twitter:image']").attr("content") || $("meta[property='og:image:url']").attr("content") || "";
        if (img) img = new URL(img, r.url).toString();
        if (thumb && img.startsWith("https://") && img.length < 600 && !/logo|icon|favicon|sprite|placeholder/i.test(img)) {
          const t = await thumb(img); if (t) pageImages.set(url, t);
        }
      } catch (e) {}
      $("script,style,noscript,nav,header,footer,aside,form,iframe,svg,button,.ad,.ads,.advert,[role=navigation]").remove();
      let main = $("article").first(); if (!main.length) main = $("main").first(); if (!main.length) main = $("body").first();
      if (!main.length) return "";
      const s = structured($, main, maxChars);
      return s.length >= 300 ? s : main.text().replace(/\s+/g, " ").trim().slice(0, maxChars);
    } catch (e) { return ""; }
  }

  async function search({ provider = "duckduckgo", q, key = "", pages = 3 }) {
    let via = provider, hits = [], why = "";
    if (!hits.length) {
      // one shared deadline: DuckDuckGo + Bing up to 8 s together; Mojeek gets ≈ 1.2 s more once those answered
      const t0 = Date.now();
      const wait = (p, until) => Promise.race([p.catch(() => []), new Promise((r) => setTimeout(() => r(null), Math.max(1, until - (Date.now() - t0))))]);
      const dj = E.duckduckgo(q, 12), bj = E.bing(q, 10), mj = E.mojeek(q, 10);
      const [d, b] = [(await wait(dj, 8000)) || [], (await wait(bj, 8000)) || []];
      const extra = d.length + b.length >= 6 ? Date.now() - t0 + 1200 : 9000;
      const m = (await wait(mj, extra)) || [];
      const lists = [d, b, m].map((l) => l.filter((h) => !isWiki(h.url)))
        .map((l) => (l.length && l.filter((h) => isJunk(h.url, q)).length * 2 >= l.length ? [] : l.filter((h) => !isJunk(h.url, q))));
      const score = new Map(), first = new Map();
      for (const l of lists) l.forEach((h, i) => { const k = urlKey(h.url); score.set(k, (score.get(k) || 0) + 1 / (8 + i)); const had = first.get(k); if (!had) first.set(k, { ...h }); else if (h.text.length > had.text.length) had.text = h.text; });
      hits = [...first.entries()].sort((a, c) => score.get(c[0]) - score.get(a[0])).map((e) => e[1]).slice(0, 14);
      via = ["duckduckgo", "bing", "mojeek"].filter((_, i) => lists[i].length).join(" + ") || "duckduckgo";
      if (!hits.length && !why) why = "The search engines returned nothing";
    }
    // the top pages read in full, in parallel; a quick question goes on with half of them after 2.5 s (cap 6 s)
    const n = Math.max(0, Math.min(8, pages | 0));
    if (n && hits.length) {
      const list = hits.slice(0, n), quick = n <= 5;
      const enough = Math.max(1, Math.ceil(list.length * (quick ? 0.5 : 0.6))), minWait = quick ? 2500 : 4000, cap = quick ? 6000 : 9000;
      let done = 0; const t0 = Date.now();
      await new Promise((res) => {
        const check = () => { const w = Date.now() - t0; if (done >= list.length || w >= cap || (done >= enough && w >= minWait)) { res(); return true; } return false; };
        const timer = setInterval(() => { if (check()) clearInterval(timer); }, 100);
        list.forEach((h) => pageText(h.url, 16000).then((t) => { if (t.length > h.text.length + 80) h.text = (h.text + "\n" + t).slice(0, 16000); }).finally(() => { done++; }));
      });
    }
    return { hits: hits.map((h) => ({ title: h.title, url: h.url, text: h.text.slice(0, 16000), source: h.source, image: pageImages.get(h.url) || "" })), via, why };
  }

  async function news({ q, lang: lg = "", pages = 3 }) {
    const arabic = lg === "ar"; const items = []; let why = "";
    try {
      const hl = arabic ? "hl=ar&gl=EG&ceid=EG:ar" : "hl=en-US&gl=US&ceid=US:en";
      const u = "https://news.google.com/rss/search?q=" + encodeURIComponent(q + " when:2d") + "&" + hl;
      online(u, "news headlines (Google News)");
      const r = await get(u, { timeout: 15000 });
      const $ = cheerio.load(r.text, { xmlMode: true });
      $("item").each((_, el) => {
        const e = $(el); const d = Date.parse(e.find("pubDate").text().trim());
        const o = { title: e.find("title").text(), url: e.find("link").text().trim(), source: e.find("source").text(), snippet: cheerio.load(e.find("description").text() || "").text().slice(0, 400) };
        if (!isNaN(d)) o.date = d;
        if (o.title.trim()) items.push(o);
        if (items.length >= 30) return false;
      });
    } catch (e) { why = e.message || "Google News failed"; }
    const hits = [];
    try {
      const web = (await E.duckduckgo(q + (arabic ? " أخبار" : " news"), 8, "d")).filter((h) => !isWiki(h.url));
      const k = Math.max(0, Math.min(4, pages | 0));
      await Promise.all(web.slice(0, k).map(async (h) => { const t = await Promise.race([pageText(h.url, 2400), new Promise((r) => setTimeout(() => r(""), 12000))]); if (t.length > h.text.length) h.text = t; }));
      for (const h of web) hits.push({ title: h.title, url: h.url, text: h.text.slice(0, 2400) });
    } catch (e) { if (!why) why = e.message || "search failed"; }
    if (!items.length && !hits.length && !why) why = "Nothing came back for that topic.";
    return { items, hits, why };
  }

  return { search, news, pageText, engines: E };
}

module.exports = { makeWeb, isWiki, isJunk, urlKey, structured, unwrapDdg, unwrapBing };
