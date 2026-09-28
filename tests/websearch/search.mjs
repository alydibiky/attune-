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

/** WebTools.search("duckduckgo", q, pages): both engines at once, interleaved, then the top pages read. */
export async function search(q, pages = 6) {
  const t0 = Date.now();
  const [d, b] = await Promise.all([duckduckgo(q + " " + NO_WIKI, 10), bing(q + " " + NO_WIKI, 8)]);
  const seen = new Set(), merged = [];
  for (let i = 0; i < Math.max(d.length, b.length); i++) for (const h of [d[i], b[i]].filter(Boolean)) if (!isWiki(h.url) && !seen.has(urlKey(h.url))) { seen.add(urlKey(h.url)); merged.push(h); }
  const hits = merged.slice(0, 14);
  const tSearch = Date.now() - t0;
  const n = Math.max(0, Math.min(8, pages));
  await Promise.all(hits.slice(0, n).map(async (h) => {
    const text = await withTimeout(TIMEOUTS.pageWait, pageText(h.url, 16000)).catch(() => "");
    if (text.length > h.text.length + 80) h.text = (h.text + "\n" + text).slice(0, 16000);
  }));
  return { hits: hits.filter((h) => (h.text || "").length > 40), via: `ddg ${d.length} + bing ${b.length}`, ms: { search: tSearch, read: Date.now() - t0 - tSearch } };
}
