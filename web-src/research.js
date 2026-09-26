/* ---- Deep web research (v5.20) -------------------------------------------------------------
   Ali: "view more pages, one page at a time, and before answering, answer in full detail."
   A phone model can't read eight whole pages at once, so it reads them ONE AT A TIME:

     1. search; the pages come back in full (WebTools.kt reads up to 8)
     2. each page → its passages about the question (webrank.js) → the model writes NOTES:
        every fact that answers the question, numbers copied exactly
     3. every note line with a number that isn't on that page is dropped (a mangled or
        invented figure never reaches the answer)
     4. "what is still missing?" → one more search just for that, read the same way
     5. the final answer is written from all the notes, complete and cited.
   Pure helpers here (unit-tested in tests/unit/v520.test.mjs); the loop is in chat.jsx.  */

export const NOTES_SYS = `You read ONE web page for a question and write NOTES — every fact on the page that helps answer it.
Rules:
- One fact per line, starting with "- ". Keep names, versions, trims, prices, dates, units and figures exactly as the page writes them (copy digits exactly).
- For tables, keep each relevant row as one line: "- <row name>: <column> <value>; <column> <value> …".
- Include everything relevant (all trims, all versions, all prices) — completeness matters more than brevity.
- Nothing from your own knowledge. If the page has nothing relevant, reply exactly: NONE`;

export function notesMessages(question, page) {
  return [
    { role: "system", content: NOTES_SYS },
    { role: "user", content: `QUESTION: ${String(question || "").slice(0, 600)}\n\nPAGE: ${page.title} — ${page.url}\n${String(page.text || "").slice(0, 6000)}\n\nNOTES:` },
  ];
}

const numsIn = (s) => (String(s || "").replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).match(/\d[\d,.]*\d|\d/g) || []).map((n) => n.replace(/[,.]$/, ""));
/**
 * Keep only note lines whose numbers all appear on the page (digits compared with and
 * without thousands separators). → { text, kept, dropped }
 */
export function checkNotes(notes, pageText) {
  const hay = String(pageText || "").replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  const hay2 = hay.replace(/(\d),(?=\d{3}\b)/g, "$1");
  const lines = String(notes || "").split("\n").map((l) => l.trim()).filter((l) => l && !/^none\.?$/i.test(l));
  const kept = [], dropped = [];
  for (const l of lines) {
    const bad = numsIn(l).filter((n) => n.length >= 2 && !hay.includes(n) && !hay2.includes(n.replace(/,/g, "")));
    (bad.length ? dropped : kept).push(l.replace(/^[*•]\s*/, "- ").replace(/^(?!- )/, "- "));
  }
  return { text: kept.join("\n"), kept: kept.length, dropped: dropped.length };
}

export function missingMessages(question, notes) {
  return [
    { role: "system", content: "You check research notes against a question. If an important part of the question is NOT answered by the notes (a trim, a figure, a price, a date that was asked for), reply with ONE short web search query that would find it. If the notes answer everything, reply exactly: NONE. Reply with the query or NONE only." },
    { role: "user", content: `QUESTION: ${String(question || "").slice(0, 600)}\n\nNOTES:\n${String(notes || "").slice(0, 5000)}` },
  ];
}
export function cleanQuery(ans) {
  const q = String(ans || "").split("\n")[0].replace(/^["'“]|["'”]$/g, "").replace(/^(query|search)\s*:\s*/i, "").trim();
  return !q || /^none\b/i.test(q) || q.length < 4 ? "" : q.slice(0, 160);
}

/** How many pages a question deserves: detail-hungry questions get more. */
export function pagesFor(question) {
  const q = String(question || "");
  return /\b(all|every|each|full|detailed|details|compare|comparison|vs|versus|specs?|specifications?|trims?|versions?|prices?|review|pros|cons|advantages|disadvantages)\b|كل|مواصفات|مقارنة|الفرق|فئات|أسعار|اسعار|بالتفصيل|تفاصيل/i.test(q) || q.length > 80 ? 8 : 5;
}

export const FINAL_ADD = "\n\n(These passages are research NOTES taken page by page. Write the COMPLETE, detailed answer: cover every part of the question and every item the notes mention (all trims / versions / options, each with its figures — a table when comparing), cite the source number after each fact, and end with what the sources did not say.)";

/* ---- v5.23: closer to Gemini ---------------------------------------------------------------
   Ali: "web search extremely detailed and accurate, close to Gemini". What Gemini does that
   one search can't:
     - PLAN: the question is split into several searches, one per angle (official specs,
       prices, reviews, latest news, comparison) — stronger models plan more of them;
     - SOURCES by quality: official and well-known sites first, social media / Q&A / copy
       sites last, at most 2 pages from one site so one site can't fill the answer;
     - CROSS-CHECK: a figure found on 2+ independent sites is marked confirmed; the answer
       shows both values when sites disagree;
     - a structured REPORT: direct answer first, sections, tables, disagreements, gaps.     */

export function planMessages(question, n) {
  return [
    { role: "system", content: `You plan web research. Write ${n} DIFFERENT web search queries that together cover EVERY part of the question — each from another angle (official specifications / facts, prices and versions, expert reviews, latest news ${new Date().getFullYear()}, comparisons or problems — only the angles that fit). Name the exact thing (brand, model, year, place) in every query. Keep the question's language; for an international product add one query in English. One query per line, no numbering, no quotes, nothing else.` },
    { role: "user", content: String(question || "").slice(0, 600) },
  ];
}
/** The model's plan → up to n clean, different queries; the user's own search always first. */
export function parsePlan(ans, first, n) {
  const out = [String(first || "").trim()].filter(Boolean);
  const key = (q) => q.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const seen = new Set(out.map(key));
  for (const raw of String(ans || "").split("\n")) {
    const q = cleanQuery(raw.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, ""));
    if (!q || q.length > 140 || /^(here|sure|queries|i will)\b/i.test(q) || seen.has(key(q))) continue;
    seen.add(key(q)); out.push(q);
    if (out.length >= n) break;
  }
  return out;
}

const host = (u) => String(u || "").replace(/^https?:\/\//i, "").split(/[/?#]/)[0].replace(/^www\./, "").toLowerCase();
const LOW = /(^|\.)(pinterest\.|quora\.com|facebook\.com|instagram\.com|tiktok\.com|x\.com|twitter\.com|youtube\.com|reddit\.com|answers\.com|scribd\.com|slideshare\.net|brainly\.|chegg\.com|medium\.com|blogspot\.|wordpress\.com|linkedin\.com)/;
const GOOD = /(^|\.)(reuters\.com|apnews\.com|bbc\.(co\.uk|com)|bloomberg\.com|ft\.com|nytimes\.com|theguardian\.com|cnbc\.com|forbes\.com|economist\.com|nature\.com|who\.int|imf\.org|worldbank\.org|caranddriver\.com|motortrend\.com|topgear\.com|autocar\.co\.uk|autoexpress\.co\.uk|carwow\.co\.uk|whatcar\.com|edmunds\.com|insideevs\.com|carnewschina\.com|gsmarena\.com|anandtech\.com|theverge\.com|arstechnica\.com|techradar\.com|notebookcheck\.net|investopedia\.com|mayoclinic\.org|nih\.gov|khleej\.com|youm7\.com|masrawy\.com|elwatannews\.com|ahram\.org\.eg|almasryalyoum\.com|hatla2ee\.com|contactcars\.com|yallamotor\.com)$/;
/** A rough quality score for a source: + official / well-known, − social media, Q&A, copies. */
export function sourceScore(url, question = "") {
  const h = host(url);
  let s = 0;
  if (/\.(gov|edu|int)(\.[a-z]{2})?$|\.gov\.eg$|\.org\.eg$/.test(h)) s += 2;
  if (GOOD.test(h)) s += 1.5;
  if (LOW.test(h)) s -= 2;
  // the brand's own site ("lynkco.com" for "Lynk & Co", "liebherr.com" for "Liebherr")
  const names = String(question || "").split(/\s+/).filter((w) => /^[A-Z]/.test(w) && w.length > 2).map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const root = h.split(".").slice(-3).join(".").replace(/[^a-z0-9]/g, "");
  if (names.some((w) => w.length > 2 && root.startsWith(w))) s += 2;
  return s;
}

/**
 * Results of several searches → one reading list: taken in turn from each search (so every
 * angle is read), no page twice, at most `perSite` pages from one site, better sources first
 * among equals. → at most `cap` hits
 */
export function mergeHits(lists, cap, question = "", perSite = 2) {
  const seen = new Set(), per = new Map(), picked = [];
  const queues = (lists || []).map((l) => [...(l || [])].filter((h) => h && h.url));
  for (let round = 0; picked.length < cap * 2 && queues.some((q) => q.length); round++) {
    for (const q of queues) {
      while (q.length) {
        const h = q.shift();
        const u = String(h.url).replace(/#.*$/, "").replace(/\/$/, "");
        const site = host(u);
        if (seen.has(u) || (per.get(site) || 0) >= perSite) continue;
        seen.add(u); per.set(site, (per.get(site) || 0) + 1);
        picked.push({ h, round, s: sourceScore(h.url, question) });
        break;
      }
    }
  }
  // quality moves a page up at most one round; social media / Q&A go last
  return picked.map((p, i) => ({ ...p, k: p.round - Math.min(1, p.s / 2) + (p.s <= -2 ? 100 : 0) + i / 1000 }))
    .sort((a, b) => a.k - b.k).slice(0, cap).map((p) => p.h);
}

const bigNums = (s) => numsIn(s).filter((n) => n.replace(/\D/g, "").length >= 3 || /\d[.,]\d/.test(n));
/**
 * Notes from several sites → each note line marked with the other sources that give the
 * same figure: "(also in [2][5])". A line whose figure no other site gives stays as it is.
 * → { notes (same shape), confirmed, lines }
 */
export function crossCheck(notesSrc) {
  const srcNums = (notesSrc || []).map((n) => new Set(bigNums(n.text).map((x) => x.replace(/,/g, ""))));
  let confirmed = 0, lines = 0;
  const notes = (notesSrc || []).map((n, i) => ({
    ...n,
    text: String(n.text || "").split("\n").map((l) => {
      const ns = bigNums(l).map((x) => x.replace(/,/g, ""));
      if (!ns.length) return l;
      lines++;
      const also = [];
      srcNums.forEach((set, j) => { if (j !== i && ns.some((x) => set.has(x))) also.push(j + 1); });
      if (!also.length) return l;
      confirmed++;
      return l + " (also in " + also.map((j) => "[" + j + "]").join("") + ")";
    }).join("\n"),
  }));
  return { notes, confirmed, lines };
}

export const REPORT_ADD = "\n\n(These are research NOTES from several searches, taken page by page; \"(also in [n])\" means another site gives the same figure — that figure is CONFIRMED. Write a complete, expert research report like Gemini would:\n1. Start with a direct 2–3 line answer to the question.\n2. Then sections with ## headings covering every part of the question and EVERY item the notes mention (all trims / versions / options / dates, each with all its figures). Use tables for specs, prices and comparisons.\n3. Cite the source number after each fact, e.g. [2]. Prefer confirmed figures.\n4. If sources give DIFFERENT values for the same thing, show both with their sources under \"Where sources differ\".\n5. End with \"Not found in the sources\" listing what was asked but not found. Never fill a gap from memory.)";
