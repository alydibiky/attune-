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
  return /\b(all|every|each|full|detailed|details|compare|comparison|vs|versus|specs?|specifications?|trims?|versions?|prices?|review|pros|cons|advantages|disadvantages)\b(?!-)|كل|مواصفات|مقارنة|الفرق|فئات|أسعار|اسعار|بالتفصيل|تفاصيل/i.test(q) || q.length > 80 ? 8 : 5;
}

export const FINAL_ADD = "\n\n(These passages are research NOTES taken page by page. Write the COMPLETE, detailed answer: cover every part of the question and every item the notes mention (all trims / versions / options, each with its figures — a table when comparing), cite the source number after each fact. Each fact once; never write what the sources don't say.)";

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
/* ---- v6.8: the relevance gate ------------------------------------------------------------------
   The web benchmark (tests/websearch) found search engines answering with pages about something else
   entirely — "How tall is the Cairo Tower?" → dictionary pages for "tall", "Who won the 2022 FIFA World
   Cup?" → dictionary pages for "who". A page that never names what was asked about can't answer it, so
   it is dropped before anything reads it. The names are the question's capitalised words, model numbers
   and figures (Cairo, Tower, Liebherr, LTM, 1100-4.2, 2022, FIFA); in Arabic, its content words.       */
const Q_WORDS = new Set("what which who whom whose when where why how is are was were do does did can could should would will the a an of in on at to for and or with from by about tell me please give show list explain find".split(" "));
const AR_STOP = new Set("ما ماذا من متى أين اين كيف كم هل هو هي هم في على من إلى الى عن مع ال و أو او أن ان التي الذي هذا هذه ذلك كان يكون ايه إيه امتى إمتى فين ازاي إزاي كام بكام عايز اعرف قولي قوللي".split(" "));
const normT = (s) => String(s || "").toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");
export function keyTerms(question) {
  const q = String(question || "").replace(/[?؟!،,;:()"“”«»]/g, " ");
  const words = q.split(/\s+/).filter(Boolean);
  const named = [], content = [];
  for (const w of words) {
    const lw = normT(w).replace(/^[.'’-]+|[.'’-]+$/g, "");
    if (!lw || lw.length < 2) continue;
    if (/[\u0600-\u06FF]/.test(lw)) { const b = lw.replace(/^(وال|بال|فال|كال|لل|ال)/, ""); if (b.length >= 3 && !AR_STOP.has(lw) && !AR_STOP.has(b)) content.push(b); continue; }
    if (Q_WORDS.has(lw)) continue;
    if (/\d/.test(lw) || /^[A-Z]/.test(w)) named.push(lw); else if (lw.length >= 4) content.push(lw);
  }
  return { named: [...new Set(named)], content: [...new Set(content)] };
}
/** Does this page name what was asked about? (title, address and the first part of its text) */
export function onTopic(hit, question) {
  const { named, content } = keyTerms(question);
  const hay = normT((hit.title || "") + " " + decodeURIComponentSafe(hit.url || "") + " " + String(hit.text || "").slice(0, 6000));
  const has = (t) => hay.includes(t) || (/\d/.test(t) && hay.replace(/[\s,.-]/g, "").includes(t.replace(/[\s,.-]/g, "")));
  if (named.length) {
    const need = named.length <= 2 ? named.length : Math.ceil(named.length * 0.6);
    return named.filter(has).length >= need;
  }
  if (content.length) return content.filter(has).length >= Math.max(1, Math.ceil(content.length * 0.5));
  return true;
}
function decodeURIComponentSafe(u) { try { return decodeURIComponent(u).replace(/[-_/]+/g, " "); } catch (e) { return u; } }

/* v6.12: dictionaries, thesauruses and grammar sites — what a poisoned search returns for the question's
   common words ("maximum", "tall", "who": measured on the web benchmark). Never read, unless the question is
   about a word's meaning or a translation. */
const JUNK = /(^|\.)(merriam-webster\.com|dictionary\.cambridge\.org|dictionary\.com|thefreedictionary\.com|wordreference\.com|collinsdictionary\.com|vocabulary\.com|thesaurus\.com|oxfordlearnersdictionaries\.com|lexico\.com|britannicaenglish\.com|wiktionary\.org|yourdictionary\.com|grammarly\.com|macmillandictionary\.com|ldoceonline\.com|urbandictionary\.com|definitions\.net|almaany\.com|reverso\.net|lingolandedu\.com|todaysdatenow\.com|whichyr\.com)$/;
const WORD_Q = /\b(mean(ing|s)?|defin(e|ition)|translat\w*|synonyms?|antonyms?|spell(ing)?|pronounc\w*|grammar|word for)\b|معنى|معني|ترجم|مرادف|عكس كلمة|تعريف كلمة/i;
export const isJunk = (url, question = "") => !WORD_Q.test(question) && JUNK.test(host(url));

export function mergeHits(lists, cap, question = "", perSite = 2, strict = false) {
  const seen = new Set(), per = new Map(), picked = [];
  let queues = (lists || []).map((l) => [...(l || [])].filter((h) => h && h.url && !isJunk(h.url, question)));
  // v6.8: pages that never name the subject are dropped (the best two are kept if nothing passes —
  // unless strict: a second search for what's missing adds nothing rather than off-topic pages)
  // v6.12: when nothing passes, the list says so (`offTopic`) — the chat searches again another way instead
  // of writing the answer from pages about something else
  let offTopic = false;
  if (question) {
    const gated = queues.map((l) => l.filter((h) => onTopic(h, question)));
    if (strict || gated.some((l) => l.length)) queues = gated; else offTopic = queues.some((l) => l.length);
  }
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
  const out = picked.map((p, i) => ({ ...p, k: p.round - Math.min(1, p.s / 2) + (p.s <= -2 ? 100 : 0) + i / 1000 }))
    .sort((a, b) => a.k - b.k).slice(0, cap).map((p) => p.h);
  if (offTopic) out.offTopic = true;
  return out;
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

export const REPORT_ADD = "\n\n(These are research NOTES from several searches, taken page by page; \"(also in [n])\" means another site gives the same figure — that figure is CONFIRMED. Write a complete, expert research report like Gemini would:\n1. Start with a direct 2–3 line answer to the question.\n2. Then sections with ## headings covering every part of the question and EVERY item the notes mention (all trims / versions / options / dates, each with all its figures). Use tables for specs, prices and comparisons.\n3. Cite the source number after each fact, e.g. [2]. Prefer confirmed figures.\n4. If sources give DIFFERENT values for the same thing, show both with their sources under \"Where sources differ\".\n5. Never fill a gap from memory; a figure no source gives is \"—\" in its table, never a sentence about what is missing. Each fact once.)";

/**
 * v5.28 — the notes from every page, cut to fit the model's window (the fast engine has only
 * 8k tokens; 9 pages of notes + a long answer overflowed it and it wrote garbage). Every source
 * keeps its first lines (the most relevant); lines another site confirms are kept first.
 * → same shape, total text ≤ maxChars
 */
export function fitNotes(notes, maxChars) {
  const list = (notes || []).filter((n) => n && n.text);
  const total = list.reduce((k, n) => k + n.text.length, 0);
  if (total <= maxChars) return list;
  let budget = maxChars;
  const order = list.map((n, i) => ({ i, len: n.text.length })).sort((a, b) => a.len - b.len);
  const allow = new Array(list.length).fill(0);
  order.forEach((o, k) => { const share = Math.floor(budget / (order.length - k)); allow[o.i] = Math.min(o.len, share); budget -= allow[o.i]; });
  return list.map((n, i) => {
    const lines = n.text.split("\n");
    const keep = new Set(); let used = 0;
    const tryAdd = (j) => { const l = lines[j]; if (keep.has(j) || used + l.length + 1 > allow[i]) return; keep.add(j); used += l.length + 1; };
    lines.forEach((l, j) => { if (/\(also in /.test(l)) tryAdd(j); });
    lines.forEach((l, j) => tryAdd(j));
    return { ...n, text: lines.filter((l, j) => keep.has(j)).join("\n") };
  }).filter((n) => n.text.trim());
}

/* ---- v5.30: FAST research — as close to Gemini's speed as a phone can get ------------------
   Ali: "as close, as fast and as accurate as Gemini". The page-by-page notes (v5.20) made the
   model WRITE ~700 tokens per page — on a phone that is minutes even on the GPU. Gemini is
   fast because it reads everything in one pass. So by default:
     1. the searches are planned by code (no model call) and run AT THE SAME TIME;
     2. code picks the relevant passages from every page (webrank.js) within the window;
     3. code cross-checks the figures: a number+unit found on 2+ sites is listed as confirmed;
     4. ONE model pass reads it all (reading is very fast on the GPU) and writes the answer.
   The page-by-page deep mode remains for "deep research" / «بحث عميق» and strong models.  */

const FACET_WORDS = /\b(specs?|specifications?|hp|horsepower|torque|power|capacity|range|dimensions?|prices?|costs?|trims?|versions?|variants?|models?|reviews?|pros|cons|problems?|latest|news|today|compare|comparison|vs|versus)\b|مواصفات|أسعار|اسعار|سعر|فئات|فئة|مراجعة|عيوب|مميزات|أحدث|اخبار|أخبار/gi;
const FILLER = /\b(please|give me|tell me|show me|what (is|are)|how (much|many)|all( the)?|with|and|the|a|an|of|for|about|in|on|me|its|their|full|detailed|details|complete|list)\b/gi;
/** The subject of a question, without filler words ("Lynk & Co 900 all trims with hp…" → "Lynk & Co 900 trims hp …"). */
export function topicOf(q) {
  return String(q || "").replace(/[?؟!،]+|(?<!\d)[.,]|[.,](?!\d)/g, " ").replace(FILLER, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

/**
 * Several searches from the question, by code: the question itself, then one per facet it asks
 * about (specifications, prices, versions/trims, reviews, latest news, each side of a comparison).
 * → up to n different queries, the user's own first
 */
export function expandQueries(question, n = 3) {
  const q = String(question || "").trim(), y = new Date().getFullYear();
  // the bare subject ("Lynk & Co 900"): the topic without the facet words it asks about
  const ar = /[\u0600-\u06FF]/.test(q);
  const t = (topicOf(q).replace(FACET_WORDS, " ")
    .replace(/(^|\s)(و|كل|ال|عن|في|من|على|إيه|ايه|ما|هي|هو|بتاع|بتاعة|عايز|اعرف)(?=\s|$)/g, " ")
    .replace(/(^|\s)[\u0600-\u06FF](?=\s|$)/g, " ").replace(/\s+/g, " ").trim()) || topicOf(q) || q;
  const F = ar ? { spec: "مواصفات", price: "سعر", trims: "الفئات", review: "مراجعة عيوب مميزات", news: "أحدث أخبار", official: "الموقع الرسمي" }
    : { spec: "specifications", price: "price", trims: "trims versions", review: "review", news: "latest news", official: "official" };
  const out = [q];
  const add = (s) => { s = s.replace(/\s+/g, " ").trim(); if (s && !out.some((x) => x.toLowerCase() === s.toLowerCase())) out.push(s); };
  const vs = q.split(/\s+(?:vs\.?|versus|or|ولا|مقابل|مقارنة ب)\s+/i);
  if (vs.length === 2 && vs[0].length > 2 && vs[1].length > 2) { add(topicOf(vs[0]) + " " + F.spec + " " + F.price); add(topicOf(vs[1]) + " " + F.spec + " " + F.price); }
  if (/spec|hp|torque|power|capacity|range|dimension|مواصفات|قوة|عزم|سعة|مدى/i.test(q)) add(t + " " + F.spec);
  if (/price|cost|how much|سعر|أسعار|اسعار|بكام|كام/i.test(q)) add(t + " " + F.price + " " + y);
  if (/trim|version|variant|model|فئات|فئة|نسخ|موديلات/i.test(q)) add(t + " " + F.trims);
  if (/review|pros|cons|problem|reliab|مراجعة|عيوب|مشاكل|مميزات/i.test(q)) add(t + " " + F.review);
  if (/latest|new|news|today|this year|release|launch|أحدث|جديد|أخبار|اخبار|نزل/i.test(q)) add(t + " " + F.news + " " + y);
  if (out.length < n) add(t + " " + y);
  if (out.length < n) add(t + " " + F.official);
  return out.slice(0, Math.max(1, n));
}

const FIG = /(?:(?:EGP|USD|US\$|\$|€|£|CNY|RMB|¥|AED|SAR|EUR)\s?\d[\d,.]*(?:\s?(?:million|m|k|bn))?|\d[\d,.]*\s?(?:hp|ps|bhp|kw|nm|n·m|lb-?ft|km\/h|mph|km|kwh|kg|tons?|t\b|mm|cm|m\b|seconds?|s\b|%|l\/100 ?km|mpg|egp|usd|cny|yuan|جنيه|دولار|يوان|حصان|كم))/gi;
const normFig = (s) => String(s).toLowerCase().replace(/\s+/g, "").replace(/(\d),(?=\d{3}\b)/g, "$1").replace(/us\$/, "$").replace(/n·m/, "nm");
/**
 * Figures (a number with its unit or currency) that 2+ different sources give.
 * hits: [{text}] (the ranked passages, numbered in order) → { list: [{fig, sources:[1,3]}], block }
 */
export function confirmedFigures(hits, max = 25) {
  const seen = new Map(), shown = new Map();
  (hits || []).forEach((h, i) => {
    const found = (String((h && h.text) || "").match(FIG) || []).filter((f) => /\d{2}|\d[.,]\d/.test(f));
    for (const raw of found) { const f = normFig(raw); if (!seen.has(f)) { seen.set(f, new Set()); shown.set(f, raw.trim()); } seen.get(f).add(i + 1); }
  });
  const list = [...seen.entries()].filter(([, s]) => s.size >= 2).map(([f, s]) => ({ fig: shown.get(f), sources: [...s].sort((a, b) => a - b) }))
    .sort((a, b) => b.sources.length - a.sources.length).slice(0, max);
  const block = list.length ? "\n\nFIGURES CONFIRMED BY 2+ SOURCES (prefer these when sources differ):\n" + list.map((x) => "- " + x.fig + " " + x.sources.map((n) => "[" + n + "]").join("")).join("\n") : "";
  return { list, block };
}

/** Does the person ask for the slow, thorough page-by-page research? */
export function wantsDeep(text) {
  return /\b(deep research|research (it )?(deeply|thoroughly|in depth)|in[- ]depth research|dig deep)\b|بحث عميق|ابحث بعمق|بحث شامل|بعمق/i.test(String(text || ""));
}

export const FAST_REPORT_ADD = "\n\n(Write a complete, accurate answer from ALL the passages, like a research assistant: a direct 2–3 line answer first, then sections with ## headings and tables for specs, prices and comparisons, covering every part of the question and every item the passages name. Cite the source number after each fact. Copy numbers exactly. Where sources give different values, show both with their sources; prefer the confirmed figures. Each fact once — no repeated bullets. Never write what the sources don't say, and never use the word \"passages\".)";

/** v5.31 — like Gemini's "does this need a search?": questions about things that change
    (prices, latest models, news, today, specs of a named product) are offered a web search
    when Web is off. */
export function needsWeb(text) {
  const t = String(text || "");
  if (t.length < 8) return false;
  return /\b(latest|newest|today|tonight|this (week|month|year)|news|current|currently|price|prices|cost|how much|release[ds]?|launch(ed)?|specs?|specifications?|trims?|who won|score|weather|exchange rate|stock|20[2-3]\d)\b|أحدث|احدث|أخبار|اخبار|النهارده|انهارده|سعر|أسعار|اسعار|بكام|مواصفات|فئات|نزل امتى|الطقس|الجو/i.test(t);
}

/** v6.8 — a quick question (one fact: a figure, a name, a date) doesn't need a full window of
    passages: the answer sits in the best few, and every extra token is read on the phone before
    the first word appears. Measured on the web benchmark: the answer is still in the passages at
    6,000 characters for every question, and the prompt is about a third shorter. Comparisons,
    lists, specs and reports keep the full budget. */
export function quickBudget(question, budget, deep = false) {
  const q = String(question || "");
  if (deep || q.length > 160) return budget;
  if (/\b(compare|comparison|vs\.?|versus|difference|differences|all|every|list|trims?|versions?|specs?|specifications?|pros|cons|review|explain|how (do|does|to)|why)\b|قارن|مقارنة|الفرق|فرق|كل |جميع|فئات|مواصفات|اشرح|ليه|إزاي|ازاي|كيف|لماذا/i.test(q)) return budget;
  return Math.min(budget, 6000);
}

/* ---- v6.12: answers shaped like Gemini's, by topic ---------------------------------------------------------------------------
   Ali: "web search better than Gemini, I don't care how" (his example: a car question, answered by Gemini with every version,
   price and spec). What makes those answers good is their SHAPE: a direct answer, then the same sections every time for that
   kind of subject, with tables. A small model writes far better when it is handed that shape. `topicKind` names the subject's
   kind; `topicSearches` adds the searches that fill each section; `answerTemplate` is the shape the final answer must follow. */
const KIND_RX = {
  vehicle: /\b(car|cars|suv|sedan|hatchback|pickup|truck|ev|hybrid|phev|motorcycle|bike|lynk|byd|chery|geely|toyota|hyundai|kia|nissan|bmw|mercedes|audi|vw|volkswagen|skoda|peugeot|renault|mg|jetour|haval|tesla|honda|mazda|ford|chevrolet|jeep|land rover|range rover|porsche|lexus|mitsubishi|suzuki|opel|citroen|fiat|seat|cupra|zeekr|xpeng|nio|li auto|xiaomi su7|exeed|omoda|baic|changan|gac|jaecoo|proton)\b|سيارة|سيارات|عربية|عربيه|فئات|موديل \d{4}|تويوتا|هيونداي|هيونداى|كيا|نيسان|شيفروليه|شيفرولية|بي واي دي|جيلي|شيري|إم جي|ام جي|هافال|شانجان|جيتور|بيجو|رينو|سكودا|فولكس|مرسيدس|بي إم دبليو|بى ام دبليو|أودي|اودي|ميتسوبيشي|سوزوكي|هوندا|مازدا|فورد|جيب|أوبل|اوبل|ستروين|فيات|سيات|كوبرا|تسلا|زيكر|أومودا|اومودا|جيكو|إكسيد|اكسيد|بايك|لينك آند كو|بستيون|دونج فينج|دونغ فنغ|كايي|سوايست|بروتون|لادا|ماكسوس|فورثينج|جيتور/i,
  machine: /\b(crane|excavator|loader|forklift|bulldozer|grader|telehandler|aerial|boom lift|generator|compressor|liebherr|tadano|grove|demag|terex|xcmg|sany|zoomlion|manitowoc|kobelco|komatsu|caterpillar|cat \d|jcb|hitachi|volvo ce|ltm|gmk|atf|rough terrain)\b|ونش|كرين|لودر|حفار|بلدوزر|مولد/i,
  gadget: /\b(iphone|ipad|macbook|galaxy|pixel|xiaomi|redmi|poco|oppo|vivo|realme|honor|huawei|oneplus|nothing phone|laptop|notebook|tablet|smartwatch|watch|earbuds|headphones|airpods|camera|tv|monitor|gpu|rtx|cpu|ryzen|intel core|playstation|ps5|xbox|switch)\b|موبايل|تليفون|لابتوب|تابلت|ساعة ذكية|سماعة/i,
  place: /\b(hotel|resort|restaurant|beach|museum|city|visit|trip|travel|things to do|tour|flight|airport)\b|فندق|مطعم|شاطئ|متحف|رحلة|سفر|أماكن/i,
  org: /\b(company|ceo|founder|net worth|startup|brand|who is|biography|born)\b|شركة|مؤسس|مين هو|مين هي/i,
};
const CN_CAR = /\b(byd|chery|geely|zeekr|lynk|xpeng|nio|li auto|xiaomi|exeed|omoda|jaecoo|jetour|haval|great wall|gwm|tank|changan|gac|aion|hongqi|baic|bestune|dongfeng|voyah|leapmotor|seres|aito|avatr|deepal|wuling|kaiyi|forthing|maxus|mg|jac|dfsk|swm|soueast)\b|بي واي دي|شيري|جيلي|زيكر|جيتور|هافال|شانجان|أومودا|اومودا|جيكو|إكسيد|اكسيد|بايك|بستيون|كايي|ماكسوس|فورثينج|إم جي|ام جي|دونغ فنغ|دونج فينج/i;
/** v6.16: today's rates (open.er-api.com JSON) → a note so every price also shows in US dollars (and the maker's currency). */
export function fxNote(body, q = "") {
  let j; try { j = typeof body === "string" ? JSON.parse(body) : body; } catch (e) { return ""; }
  const r = j && j.rates; if (!r || !r.EGP) return "";
  const pick = ["EGP", ...(isChineseCar(q) ? ["CNY"] : []), "EUR", "AED", "SAR"].filter((c) => r[c]);
  const date = String(j.time_last_update_utc || "").replace(/ \d\d:\d\d:\d\d.*$/, "");
  return "\n\n(Exchange rates" + (date ? " on " + date : "") + " (open.er-api.com): 1 USD = " + pick.map((c) => (+r[c]).toFixed(c === "EGP" ? 2 : 3) + " " + c).join(" = ") +
    ". Next to every price write its value in US dollars (≈ $…) using these rates" + (isChineseCar(q) ? ", and for a price in China give yuan (CNY) and US dollars" : "") + ". Prices without a source stay \"—\".)";
}
/** v6.16: the official test figures from the Cars pack (US EPA / EU EEA) → a block placed before the web sources. */
export function officialSpecsNote(passages) {
  const ps = (passages || []).filter((p) => p && p.text).slice(0, 4);
  if (!ps.length) return "";
  return "\n\n(OFFICIAL TEST DATA from government records — use these exact figures in the specs tables and say they are official (US EPA / EU EEA):\n" +
    ps.map((p) => "• " + p.title + ": " + String(p.text).slice(0, 700)).join("\n") + ")";
}
/** A Chinese brand? Its price at home (in yuan) is searched too. */
export const isChineseCar = (q) => CN_CAR.test(String(q || ""));
/** What kind of subject the question is about: vehicle | machine | gadget | place | org | general */
export function topicKind(q) {
  const t = String(q || "");
  for (const k of ["machine", "vehicle", "gadget", "place", "org"]) if (KIND_RX[k].test(t)) return k;
  return "general";
}
/** The extra searches that fill each section (on top of expandQueries). */
export function topicSearches(q, kind = topicKind(q), n = 4) {
  const ar = /[؀-ۿ]/.test(q), y = new Date().getFullYear();
  const t = topicOf(q).replace(FACET_WORDS, " ").replace(/\b(in|of|for)?\s*egypt\b|في مصر|بمصر/gi, " ").replace(/\s+/g, " ").replace(/(^|\s)(و|and)(?=\s|$)/gi, " ").replace(/\s+/g, " ").trim() || topicOf(q);
  const F = {
    // v6.16 (Ali): the official price AND the market price (overprice, used), every spec, from reliable sites; a Chinese car's home price too
    vehicle: ar ? [`${t} الفئات والسعر الرسمي ${y}`, `${t} specifications horsepower torque 0-100 top speed ground clearance dimensions`, `${t} range WLTP CLTC electric range battery`, `${t} سعر السوق أوفر برايس مستعمل هتلاقي كونتكت كارز`, `${t} review pros cons features trims`, ...(isChineseCar(t) ? [`${t} price China yuan trims`] : [`${t} عيوب ومميزات`])]
      : [`${t} trims official price ${y}`, `${t} specifications horsepower torque 0-100 top speed ground clearance dimensions`, `${t} range WLTP CLTC electric range battery`, `${t} market price used price Egypt hatla2ee`, `${t} review pros cons features trims`, ...(isChineseCar(t) ? [`${t} price China yuan trims`] : [`${t} price Egypt ${y}`])],
    machine: ar ? [`${t} مواصفات الحمولة طول الذراع`, `${t} load chart`, `${t} سعر`] : [`${t} specifications capacity boom length`, `${t} load chart`, `${t} engine transport dimensions`],
    gadget: ar ? [`${t} مواصفات`, `${t} سعر في مصر ${y}`, `${t} مراجعة عيوب`] : [`${t} specifications`, `${t} price ${y}`, `${t} review pros cons`],
    place: ar ? [`${t} أسعار مواعيد`, `${t} مراجعات`] : [`${t} prices opening hours tickets`, `${t} reviews`],
    org: ar ? [`${t} أخبار ${y}`] : [`${t} latest news ${y}`, `${t} history founded headquarters`],
    general: [],
  }[kind] || [];
  return [...new Set(F)].slice(0, n);
}
const TPL = {
  // v6.16 — Ali's car answer (his "bare minimum"): written like a 20-year expert driver and enthusiast; overview, every trim, prices in
  // US dollars and the maker's home currency, every figure per trim (WLTP and CLTC ranges), features, advantages, disadvantages
  vehicle: "Write as an expert driver and car enthusiast with 20 years of experience: precise, complete and highly detailed — never a short summary. Use EVERY figure the sources give; a figure no source gives is \"—\".\n1. ## Overview — what the car is: maker and its country, body type, powertrains (petrol / hybrid / plug-in / range-extender / electric), launch and model year, platform, the price range (US dollars and the maker's home currency), who it is for, and what stands out from behind the wheel.\n2. ## Trims and versions — a table of EVERY trim: | Trim | Powertrain | Power (hp) | Torque (Nm) | 0–100 km/h | Top speed | Price (USD) | Price (home currency) | — official price; and the market price when the sources give it (Egypt in EGP when given).\n3. ## Detailed specifications — for EACH trim its own table (or one table with a column per trim): | Spec | Value | — engine / motor(s), battery (kWh), power (hp), torque (Nm), gearbox, drive, 0–100 km/h, top speed, length × width × height (mm), wheelbase (mm), ground clearance (mm), kerb weight (kg), boot (L), seats, total range WLTP (km), total range CLTC (km), pure-electric range WLTP (km) and CLTC (km) for hybrids, fuel use (L/100 km) or energy use (kWh/100 km), charging (AC / DC kW, 10–80 % time).\n4. ## Features — by trim: safety and driver assistance, screens and tech, comfort, lights, wheels — what each trim adds over the one below.\n5. ## Prices: official vs market — official price, market price, used prices by model year, and the price in the maker's home country in its own currency — each with US dollars, its source and date.\n6. ## Advantages — detailed points, as an experienced driver judges them (drive, comfort, efficiency, value, reliability, tech).\n7. ## Disadvantages — detailed points the same way.\n8. ## Rivals — 2–4 competitors with their price, one line each.\n9. ## Availability in Egypt — dealer, price in EGP, warranty, if the sources say so.",
  machine: "1. **Quick answer** (2–3 lines).\n2. ## Main specifications — a table: | Item | Value | (max capacity, at what radius, main boom length, with jib, max tip height, axles, engine, travel speed, weight / transport dimensions, counterweight).\n3. ## Load chart highlights — capacities at key radii if the sources give them.\n4. ## Versions / configurations.\n5. ## Strengths and limits for real jobs.\n6. ## Comparable models — a table with their capacity and boom.\n7. ## Price and availability (new / used), if given.",
  gadget: "1. **Quick answer** (2–3 lines).\n2. ## Versions and prices — a table (storage / RAM / colour if relevant, price with currency and market, Egypt first when given).\n3. ## Key specifications — a table (screen, chip, cameras, battery and charging, weight).\n4. ## Pros and cons.\n5. ## Rivals — 2–4 alternatives with price.\n6. ## Verdict — who should buy it.",
  place: "1. **Quick answer**.\n2. ## Essentials — a table: address / area, hours, ticket or price range, how to get there, best time.\n3. ## What to see / do / eat.\n4. ## Tips.\n5. ## Reviews — what people praise and complain about.",
  org: "1. **Quick answer**.\n2. ## Key facts — a table (founded, headquarters, leaders, size, revenue if given).\n3. ## What it does.\n4. ## Latest news (with dates).\n5. ## Notes.",
  general: "",
};
/**
 * v6.13: "A vs B" — the two things compared, or null. "Geely Galaxy M9 vs Lynk & Co 900", "compare X and Y",
 * «X ولا Y», «الفرق بين X و Y», «قارن X و Y». Ali's quality bar: Gemini's answer (tests/websearch/targets/README.md).
 */
export function compareParts(q) {
  const t = String(q || "").replace(/[?؟!.]+\s*$/, "").trim();
  let m = /^(?:compare|comparison(?: of| between)?|difference between|قارن(?: بين)?|مقارنة(?: بين)?|الفرق بين|ايه الفرق بين|إيه الفرق بين)\s+(.+?)\s+(?:and|with|vs\.?|versus|و|مع|ولا|أو)\s+(.+)$/i.exec(t)
    || /^(.+?)\s+(?:vs\.?|versus|v\.?|against|compared (?:to|with)|ولا|مقابل|ضد|أو أحسن من|أحسن من|ولا أحسن)\s+(.+)$/i.exec(t);
  if (!m) return null;
  const clean = (x) => x.replace(/^(the|a|an)\s+/i, "").replace(/\s+(which is better|which one|أيهما أفضل|أنهي أحسن|انهي احسن|مين أحسن)\s*$/i, "").trim();
  const a = clean(m[1]), b = clean(m[2]);
  if (a.length < 2 || b.length < 2 || a.split(/\s+/).length > 8 || b.split(/\s+/).length > 8) return null;
  return [a, b];
}
const CMP = {
  vehicle: (a, b) => `1. **Quick verdict** (3–4 lines: the main difference, the price gap, who each one suits).
2. ## ${a} — a table: | Version | Engine / motor | Power (hp) | Torque (Nm) | Range or fuel use | 0–100 km/h | Price | — every version the sources name; then 2–3 lines on what stands out.
3. ## ${b} — the same table for every version; then 2–3 lines on what stands out.
4. ## Head to head — a table: | | ${a} | ${b} | Better | — rows: starting price (USD and home currency), top price, power (hp), torque (Nm), 0–100 km/h, top speed, total range WLTP and CLTC, pure-electric range WLTP and CLTC, fuel use, battery, length × width × height, wheelbase, ground clearance, seats, boot, charging, warranty. Put "—" where no source gives a figure.
5. ## Advantages of each — ${a}: 3–5 bullets; ${b}: 3–5 bullets (only what the sources support).
6. ## Which to choose — by buyer: e.g. "for long trips…", "for the best price…", "for tech…".
7. ## Availability in Egypt — dealers and EGP prices for both, if the sources say so.`,
  machine: (a, b) => `1. **Quick verdict**.\n2. ## Head to head — a table: | | ${a} | ${b} | Better | — max capacity (and at what radius), main boom, with jib, max tip height, axles, engine power, travel speed, weight, transport dimensions, counterweight.\n3. ## Load chart at key radii — both, if the sources give them.\n4. ## Strengths of each.\n5. ## Which to choose — by job type.`,
  gadget: (a, b) => `1. **Quick verdict**.\n2. ## ${a} — versions and prices.\n3. ## ${b} — versions and prices.\n4. ## Head to head — a table: | | ${a} | ${b} | Better | — price, screen, chip, RAM / storage, cameras, battery and charging, weight, software updates.\n5. ## Advantages of each.\n6. ## Which to choose — by buyer.`,
  general: (a, b) => `1. **Quick verdict**.\n2. ## Head to head — a table: | | ${a} | ${b} | — every measurable point the sources give.\n3. ## Advantages of each.\n4. ## Which to choose and when.`,
};
/** Searches for a comparison: each side's versions/prices and specs, then the direct comparison. */
export function compareSearches(q, kind = topicKind(q), n = 6) {
  const p = compareParts(q); if (!p) return [];
  const ar = /[؀-ۿ]/.test(q), y = new Date().getFullYear(), [a, b] = p;
  const side = (x) => kind === "vehicle" ? (ar ? [`${x} الفئات والأسعار ${y}`, `${x} مواصفات`] : [`${x} trims prices ${y}`, `${x} specifications horsepower range dimensions`])
    : kind === "machine" ? [`${x} specifications capacity boom length`, `${x} load chart`] : [`${x} specifications price ${y}`];
  return [...new Set([`${a} vs ${b}`, ...side(a), ...side(b), ar ? `مقارنة ${a} و ${b}` : `${a} vs ${b} comparison review`])].slice(0, n);
}

/** The shape the final answer follows for this kind of subject ("" for general questions). */
export function answerTemplate(q, kind = topicKind(q)) {
  const p = compareParts(q);
  if (p) return "\n\n(This is a COMPARISON. Write it in this structure — fill every section the sources can, cover EVERY version of both, put \"—\" in a table cell no source gives, and cite the source number after each fact.)\n" + (CMP[kind] || CMP.general)(p[0], p[1]);
  const t = TPL[kind] || "";
  return t ? "\n\n(Write the answer in this structure — use every section the sources can fill, skip a section only when no source says anything for it, and put \"—\" in a table cell no source gives. Cite the source number after each fact.)\n" + t : "";
}
/** Should the answer get the full topic shape? A detail question ("all trims", "specs", "compare") or a bare subject ("Lynk & Co 900"). */
export function wantsShape(q, kind = topicKind(q)) {
  if (compareParts(q)) return true;
  if (kind === "general") return false;
  const t = String(q || "").trim();
  if (pagesFor(t) === 8) return true;
  return t.split(/\s+/).length <= 6 && !/[?؟]|\b(what|who|when|where|why|how|which|is|are|does|can)\b|^(ما|مين|امتى|فين|ليه|ازاي|كام|هل)/i.test(t);
}
