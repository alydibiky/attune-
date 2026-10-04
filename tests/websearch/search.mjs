// v6.8 — the phone's web search (app/src/main/java/com/aldibiki/attune/WebTools.kt) ported to Node,
// line for line, so the web-search benchmark measures what the phone does: DuckDuckGo + Bing at the
// same time (interleaved, Wikipedia dropped), then the top pages opened in parallel and read as
// structured text (tables kept as "cell | cell" rows). Needs `cheerio` (npm i cheerio).
import * as cheerio from "cheerio";

const UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";
const isArabic = (s) => /[؀-ۿ]/.test(s);
const NO_WIKI = "-site:wikipedia.org";
const isWiki = (u) => /^https?:\/\/([a-z0-9-]+\.)*wikipedia\.org\//i.test(u);
const withTimeout = (ms, p) => Promise.race([p, new Promise((_, bad) => setTimeout(() => bad(new Error("timeout")), ms))]);
export const TIMEOUTS = { search: 12000, page: 9000, pageWait: 14000 };

function unwrapDdg(href) {
  const h = href.startsWith("//") ? "https:" + href : href;
  const i = h.indexOf("uddg="); if (i < 0) return h;
  try { return decodeURIComponent(h.slice(i + 5).split("&")[0]); } catch (e) { return h; }
}
function unwrapBing(href) {
  if (!href.includes("bing.com/ck/a")) return href;
  const m = href.match(/[?&]u=a1([^&]+)/); if (!m) return href;
  try { return Buffer.from(m[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"); } catch (e) { return href; }
}
const urlKey = (u) => u.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/[?#].*$/, "").replace(/\/+$/, "");

export async function duckduckgo(q, max = 6, recent = "") {
  const ar = isArabic(q), out = [];
  const hdr = { "User-Agent": UA, "Accept-Language": ar ? "ar,en;q=0.8" : "en,ar;q=0.8", "Content-Type": "application/x-www-form-urlencoded" };
  for (const method of ["GET", "POST"]) try {   // v6.8: GET first (a POST often gets the anomaly page)
    const params = new URLSearchParams({ q, kl: ar ? "xa-ar" : "wt-wt", df: recent });
    const r = await withTimeout(TIMEOUTS.search, method === "GET" ? fetch("https://html.duckduckgo.com/html/?" + params, { headers: { "User-Agent": UA, "Accept-Language": hdr["Accept-Language"], Referer: "https://html.duckduckgo.com/" } })
      : fetch("https://html.duckduckgo.com/html/", { method: "POST", headers: { ...hdr, Referer: "https://html.duckduckgo.com/" }, body: params }));
    const $ = cheerio.load(await r.text());
    $("div.result").each((_, el) => {
      const e = $(el);
      if (out.length >= max || e.hasClass("result--ad") || e.find(".badge--ad").length) return;
      const a = e.find("a.result__a").first(); if (!a.length) return;
      const url = unwrapDdg(a.attr("href") || ""); if (!url.startsWith("http")) return;
      out.push({ title: a.text().trim(), url, text: e.find(".result__snippet").first().text().trim(), source: "web" });
    });
    if (out.length) return out;
  } catch (e) {}
  for (const method of ["GET", "POST"]) try {
    const params = new URLSearchParams({ q, kl: ar ? "xa-ar" : "wt-wt" });
    const r = await withTimeout(TIMEOUTS.search, method === "GET" ? fetch("https://lite.duckduckgo.com/lite/?" + params, { headers: { "User-Agent": UA } }) : fetch("https://lite.duckduckgo.com/lite/", { method: "POST", headers: hdr, body: params }));
    const $ = cheerio.load(await r.text());
    const snips = $("td.result-snippet").toArray();
    $("a.result-link").each((i, el) => {
      if (out.length >= max) return;
      const url = unwrapDdg($(el).attr("href") || ""); if (!url.startsWith("http")) return;
      out.push({ title: $(el).text().trim(), url, text: snips[i] ? $(snips[i]).text().trim() : "", source: "web" });
    });
    if (out.length) return out;
  } catch (e) {}
  return out;
}

export async function bing(q, max = 8) {
  const ar = isArabic(q), out = [];
  try {
    const u = "https://www.bing.com/search?" + new URLSearchParams({ q, setlang: ar ? "ar" : "en", cc: ar ? "EG" : "US" });
    const r = await withTimeout(TIMEOUTS.search, fetch(u, { headers: { "User-Agent": UA, "Accept-Language": ar ? "ar,en;q=0.8" : "en,ar;q=0.8" } }));
    const $ = cheerio.load(await r.text());
    $("li.b_algo").each((_, el) => {   // v6.8: any layout (the phone layout has no "h2 a")
      if (out.length >= max) return;
      const r0 = $(el);
      let a = r0.find("h2 a[href]").first(); if (!a.length) a = r0.find(".b_algoheader a[href]").first(); if (!a.length) a = r0.find("a.tilk[href]").first();
      if (!a.length) a = r0.find("a[href^='http']").first(); if (!a.length) return;
      const url = unwrapBing(a.attr("href") || "");
      if (!url.startsWith("http") || url.includes("bing.com/")) return;
      const title = (r0.find("h2").first().text() || a.text()).trim(); if (!title) return;
      out.push({ title, url, text: (r0.find(".b_caption p").first().text() || r0.find("[class*=b_lineclamp]").first().text() || r0.find("p").first().text()).trim(), source: "web" });
    });
  } catch (e) {}
  return out;
}

const BLOCKS = new Set(["li", "tr", "p", "dd", "dt", "blockquote", "figcaption", "pre"]);
/** WebTools.pageText: the readable text of a page, line by line, tables as rows. */
export async function pageText(url, maxChars = 2200) {
  if (!url.startsWith("http")) return "";
  try {
    const r = await withTimeout(TIMEOUTS.page, fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" }));
    const html = (await r.text()).slice(0, 2_000_000);
    const $ = cheerio.load(html);
    $("script,style,noscript,nav,header,footer,aside,form,iframe,svg,button,.ad,.ads,.advert,[role=navigation]").remove();
    let main = $("article").first(); if (!main.length) main = $("main").first(); if (!main.length) main = $("body").first();
    if (!main.length) return "";
    let sb = "";
    main.find("h1,h2,h3,h4,h5,p,li,tr,dt,dd,blockquote,pre,figcaption,caption").each((_, el) => {
      if (sb.length >= maxChars) return false;
      const tag = el.tagName.toLowerCase();
      if (tag !== "tr" && $(el).parents().toArray().some((p) => BLOCKS.has(p.tagName && p.tagName.toLowerCase()))) return;
      const line = tag === "tr" ? $(el).children("th,td").toArray().map((c) => $(c).text().replace(/\s+/g, " ").trim()).join(" | ").replace(/^[ |]+|[ |]+$/g, "")
        : $(el).text().replace(/\s+/g, " ").trim();
      if (line.length < 2) return;
      if (tag.length === 2 && tag[0] === "h") sb += "\n## ";
      sb += line + "\n";
    });
    sb = sb.trim().slice(0, maxChars);
    return sb.length >= 300 ? sb : main.text().replace(/\s+/g, " ").trim().slice(0, maxChars);
  } catch (e) { return ""; }
}

/** WebTools.kt v6.8: pages read at once; go on when 60 % are in and 4 s passed (or all in), stop at 9 s. */
export async function readPages(list) {
  const t0 = Date.now(); let done = 0; const enough = Math.max(1, Math.ceil(list.length * 0.6));
  await new Promise((finish) => {
    if (!list.length) return finish();
    const check = () => { const w = Date.now() - t0; if (done >= list.length || w >= 9000 || (done >= enough && w >= 4000)) { clearInterval(tick); finish(); } };
    const tick = setInterval(check, 100);
    for (const h of list) pageText(h.url, 16000).then((text) => { if (text.length > h.text.length + 80) h.text = (h.text + "\n" + text).slice(0, 16000); }).catch(() => {}).finally(() => { done++; check(); });
  });
}
/** WebTools.search("duckduckgo", q, pages): both engines at once, interleaved, then the top pages read. */
// v6.12 — the phone also asks Brave's and Mojeek's own indexes, drops dictionary pages, and ranks by agreement
export async function braveHtml(q, max = 8) {
  const out = [];
  try {
    const r = await withTimeout(TIMEOUTS.search, fetch("https://search.brave.com/search?" + new URLSearchParams({ q, source: "web" }), { headers: { "User-Agent": UA, "Accept-Language": isArabic(q) ? "ar,en;q=0.8" : "en,ar;q=0.8" } }));
    const $ = cheerio.load(await r.text());
    $("div.snippet[data-type=web], #results div[data-pos], div.snippet").each((_, el) => {
      if (out.length >= max) return;
      const e = $(el); const a = e.find("a[href]").toArray().map((x) => $(x)).find((x) => /^http/.test(x.attr("href") || "") && !/brave\.com/.test(x.attr("href")));
      if (!a) return; const url = a.attr("href");
      const title = (e.find(".title, .snippet-title, .heading-serpresult").first().text() || a.text()).trim();
      if (title && !out.some((h) => h.url === url)) out.push({ title, url, text: e.find(".snippet-description, .description, .content, .generic-snippet").first().text().trim(), source: "web" });
    });
  } catch (e) {}
  return out;
}
export async function mojeek(q, max = 8) {
  const out = [];
  try {
    const r = await withTimeout(TIMEOUTS.search, fetch("https://www.mojeek.com/search?" + new URLSearchParams({ q }), { headers: { "User-Agent": UA } }));
    const $ = cheerio.load(await r.text());
    $("ul.results-standard > li, .results-standard li").each((_, el) => {
      if (out.length >= max) return;
      const e = $(el); let a = e.find("h2 a[href]").first(); if (!a.length) a = e.find("a.title[href]").first(); if (!a.length) a = e.find("a.ob[href]").first(); if (!a.length) return;
      const url = a.attr("href"); if (!/^http/.test(url) || /mojeek\.com/.test(url)) return;
      const title = (e.find("h2").first().text() || a.text()).trim();
      if (title && !out.some((h) => h.url === url)) out.push({ title, url, text: e.find("p.s").first().text().trim(), source: "web" });
    });
  } catch (e) {}
  return out;
}
const JUNK = /(^|\.)(merriam-webster\.com|dictionary\.cambridge\.org|dictionary\.com|thefreedictionary\.com|wordreference\.com|collinsdictionary\.com|vocabulary\.com|thesaurus\.com|oxfordlearnersdictionaries\.com|britannicaenglish\.com|wiktionary\.org|yourdictionary\.com|urbandictionary\.com|definitions\.net|almaany\.com|reverso\.net)$/;
const WORD_Q = /\b(mean(ing|s)?|defin(e|ition)|translat\w*|synonyms?|spell(ing)?|pronounc\w*)\b|معنى|معني|ترجم|مرادف/i;
const hostOf = (u) => String(u).toLowerCase().replace(/^https?:\/\//, "").split(/[/?#]/)[0].replace(/^www\./, "");
const isJunk = (u, q) => !WORD_Q.test(q) && JUNK.test(hostOf(u));

export async function search(q, pages = 6) {
  const t0 = Date.now();
  const [d, b, r, m] = await Promise.all([duckduckgo(q, 12), bing(q, 10), braveHtml(q, 10), mojeek(q, 10)]);
  const lists = [d, b, r, m].map((l) => l.filter((h) => !isWiki(h.url))).map((l) => (l.length && l.filter((h) => isJunk(h.url, q)).length * 2 >= l.length ? [] : l.filter((h) => !isJunk(h.url, q))));
  const score = new Map(), first = new Map();
  for (const l of lists) l.forEach((h, i) => { const k = urlKey(h.url); score.set(k, (score.get(k) || 0) + 1 / (8 + i)); const had = first.get(k); if (!had) first.set(k, { ...h }); else if ((h.text || "").length > (had.text || "").length) had.text = h.text; });
  const hits = [...first.entries()].sort((a, b2) => score.get(b2[0]) - score.get(a[0])).map(([, h]) => h).slice(0, 14);
  const tSearch = Date.now() - t0;
  const n = Math.max(0, Math.min(8, pages));
  await readPages(hits.slice(0, n));
  return { hits: hits.filter((h) => (h.text || "").length > 40), via: `ddg ${d.length} + bing ${b.length} + brave ${r.length} + mojeek ${m.length}`, ms: { search: tSearch, read: Date.now() - t0 - tSearch } };
}
