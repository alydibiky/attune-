/* ---- v6.8 Mind — "like mymind, but better" (Ali) -----------------------------------------------
   Memory becomes a private second brain: save anything (a note, a link, a photo, a quote, a product,
   a recipe, a to-do, a contact, a place…) and it files itself. No folders:
     - its KIND is read by code (a link, a price, a phone number, a quote…), instantly and offline;
     - the model adds a short title, a one-line summary and a few tags in the background (on the phone);
     - search takes plain words, with the filters said the way people say them
       ("photos from last week", «لينكات الونش الشهر اللي فات»);
     - Spaces are made by themselves from the tags, and your own Spaces are saved searches;
     - "From your past" brings back an old item a day (mymind's Serendipity);
     - "Ask your Mind" answers from your items — the sources are shown by CODE, not by the model.
   Better than mymind: works with no internet, Arabic and Egyptian Arabic throughout, reads photos,
   finds promises and sets reminders, and nothing ever leaves the phone.
   Pure functions here (tests: tests/unit/v68mind.test.mjs); the screen is mind-ui.jsx.            */

export const KINDS = {
  note:    { en: "Notes",    ar: "ملاحظات",  icon: "✎" },
  link:    { en: "Links",    ar: "لينكات",   icon: "🔗" },
  photo:   { en: "Photos",   ar: "صور",      icon: "🖼" },
  quote:   { en: "Quotes",   ar: "اقتباسات", icon: "❝" },
  product: { en: "Products", ar: "منتجات",   icon: "🏷" },
  recipe:  { en: "Recipes",  ar: "وصفات",    icon: "🍳" },
  todo:    { en: "To-dos",   ar: "مهام",     icon: "☐" },
  contact: { en: "People",   ar: "أشخاص",    icon: "👤" },
  place:   { en: "Places",   ar: "أماكن",    icon: "📍" },
  code:    { en: "Code",     ar: "كود",      icon: "</>" },
  answer:  { en: "Answers",  ar: "إجابات",   icon: "✦" },
};
// records made by the app's tools (instant, travel, chat, field…) are "answers"
const TOOL_KINDS = new Set(["instant", "travel", "field", "chat", "ask", "smart"]);

const URL_RX = /\bhttps?:\/\/[^\s<>"')\]]+/i;
const PRICE_RX = /(?:\b(?:egp|usd|eur|sar|aed|le|l\.e\.)\s?\d[\d,.]*|\d[\d,.]*\s?(?:egp|usd|eur|sar|aed|جنيه|ج\.م|جم|دولار|ريال|درهم|يورو|\$|€|£)|[$€£]\s?\d[\d,.]*)/i;
const PHONE_RX = /(?:\+?\d[\d\s-]{8,}\d)/;
const EMAIL_RX = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/;

/** What kind of thing a saved item is — by code, from its own words. */
export function kindOf(rec) {
  if (!rec) return "note";
  if (rec.kind === "photo" || (rec.meta && rec.meta.thumb)) return "photo";
  if (TOOL_KINDS.has(rec.kind) || (rec.output && rec.output.trim())) return "answer";
  if (rec.meta && rec.meta.mindKind && KINDS[rec.meta.mindKind]) return rec.meta.mindKind;
  const t = String(rec.text || "").trim();
  const lines = t.split("\n").map((l) => l.trim()).filter(Boolean);
  const url = t.match(URL_RX);
  if (url && t.replace(url[0], "").trim().length < 140) {
    if (/maps\.(google|app\.goo)|goo\.gl\/maps|maps\.apple|openstreetmap/i.test(url[0])) return "place";
    return "link";
  }
  if (/^```|^\s*(def |function |class |import |const |let |SELECT |#include)/m.test(t)) return "code";
  if (/(ingredients|مكونات|المقادير|طريقة التحضير|method:|instructions:)/i.test(t) && lines.length >= 2) return "recipe";
  const tasks = lines.filter((l) => /^(\[ ?[x ]?\]|☐|☑|- \[|todo:|to do:|مهمة:|•\s*(لازم|اتصل|ابعت|اشتري|call|buy|send|pay))/i.test(l)).length;
  if (tasks >= 1 && tasks >= lines.length / 2) return "todo";
  if (/^(buy|call|send|pay|book|remind|لازم|اشتري|اتصل ب|ابعت|ادفع|احجز)(?![\p{L}])/iu.test(t) && t.length < 140) return "todo";
  if ((PHONE_RX.test(t) || EMAIL_RX.test(t)) && t.length < 260 && lines.length <= 6) return "contact";
  if (/^\s*[«"“'].{8,400}[»"”']\s*(?:[—–-]\s*.{2,60})?$/s.test(t) || /^.{8,400}\n\s*[—–-]\s*\S.{1,60}$/s.test(t)) return "quote";
  if (PRICE_RX.test(t) && t.length < 400) return "product";
  if (/\b(address|location|street|st\.|road|rd\.)\b|عنوان|شارع|ميدان|كمبوند|مدينة نصر|التجمع/i.test(t) && t.length < 200) return "place";
  return "note";
}

const DOMAIN_NAMES = { "youtube.com": "YouTube", "youtu.be": "YouTube", "facebook.com": "Facebook", "instagram.com": "Instagram", "x.com": "X", "twitter.com": "X", "linkedin.com": "LinkedIn", "amazon.eg": "Amazon", "amazon.com": "Amazon", "noon.com": "noon", "jumia.com.eg": "Jumia", "wikipedia.org": "Wikipedia", "github.com": "GitHub", "tiktok.com": "TikTok", "olx.com.eg": "OLX", "dubizzle.com.eg": "Dubizzle" };
/** A link's parts for its card: {url, domain, site, path}. */
export function linkParts(text) {
  const m = String(text || "").match(URL_RX);
  if (!m) return null;
  let url = m[0].replace(/[.,;:!?]+$/, "");
  try {
    const u = new URL(url);
    const domain = u.hostname.replace(/^www\.|^m\./, "");
    const site = DOMAIN_NAMES[domain] || DOMAIN_NAMES[domain.split(".").slice(-2).join(".")] || domain;
    const path = decodeURIComponent(u.pathname).replace(/[-_/]+/g, " ").replace(/\.\w+$/, "").trim();
    return { url, domain, site, path };
  } catch (e) { return { url, domain: "", site: "", path: "" }; }
}
/** The price in a product note, for its badge. */
export function priceIn(text) { const m = String(text || "").match(PRICE_RX); return m ? m[0].trim() : ""; }

/* ---- tags ------------------------------------------------------------------------------------ */
// Tags by code at once (so a new item is findable before the model has read it); the model's tags
// join them later. Short, lower-case, no duplicates across Arabic spelling variants.
const TOPICS = [
  [/\b(crane|cranes|boom|jib|outrigger|liebherr|grove|demag|tadano|xcmg|sany|zoomlion|terex|lift plan)\b|ونش|اوناش|أوناش|رافعة|كرين/i, "cranes"],
  [/\b(invoice|payment|paid|owes?|price|quote|egp|usd|vat|tax|bank|instapay)\b|فاتورة|فلوس|دفع|حساب|سعر|ضريبة|جنيه|انستاباي/i, "money"],
  [/\b(meeting|call|client|customer|site|project|contract)\b|اجتماع|عميل|موقع|مشروع|عقد/i, "work"],
  [/\b(recipe|cook|dinner|lunch|breakfast)\b|أكل|اكل|طبخ|وصفة|غدا|عشا|فطار/i, "food"],
  [/\b(gym|workout|run|steps|protein|diet)\b|جيم|تمرين|رجيم|دايت/i, "health"],
  [/\b(flight|hotel|trip|travel|visa|airport)\b|سفر|رحلة|فندق|طيارة|فيزا|مطار/i, "travel"],
  [/\b(turkish|türkçe|english|course|lesson|learn)\b|تركي|انجليزي|درس|كورس|اتعلم/i, "learning"],
  [/\b(car|opel|grandland|service|tyre|tire|oil change)\b|عربية|صيانة|كاوتش|زيت/i, "car"],
  [/\b(idea|ideas|startup|app|business plan)\b|فكرة|افكار|أفكار|مشروع جديد/i, "ideas"],
  [/\b(book|books|read|article|paper)\b|كتاب|كتب|مقال/i, "reading"],
];
export function codeTags(rec) {
  const t = `${rec.title || ""}\n${rec.text || ""}`;
  const tags = [];
  for (const [rx, tag] of TOPICS) if (rx.test(t)) tags.push(tag);
  const lp = linkParts(rec.text);
  if (lp && lp.site) tags.push(lp.site.toLowerCase());
  return tags;
}
export function normTag(x) {
  return String(x || "").trim().toLowerCase().replace(/^#/, "").replace(/[أإآ]/g, "ا").replace(/ة$/, "ه").replace(/\s+/g, " ").slice(0, 24);
}
/** Everything a card is tagged with: yours first, then the model's, then the code's. No duplicates. */
export function tagsOf(rec) {
  const m = (rec && rec.meta) || {};
  const all = [...(m.myTags || []), ...(m.aiTags || []), ...(rec.tags || []).filter((t) => !/^(note|kept|dropped|saved|shared|photo|chat)$/.test(t)), ...codeTags(rec || {})];
  const out = [], seen = new Set();
  for (const t of all) { const n = normTag(t); if (n && !seen.has(n) && !(m.hidden || []).includes(n)) { seen.add(n); out.push(n); } }
  return out.slice(0, 10);
}

/** The model reads one item: a title, one line of what it is, 3–5 tags, and its kind. */
// v6.8 — the share of the letters that are Arabic (the trials: a 2–4B model filed English items in Arabic)
const arShareOf = (s) => { const t = String(s || ""), ar = (t.match(/[\u0600-\u06FF]/g) || []).length, la = (t.match(/[A-Za-z]/g) || []).length; return ar + la ? ar / (ar + la) : 0.5; };
/** The item's language: "ar", "en", or "" when it's mixed. */
export function itemLang(rec) {
  const a = arShareOf(String((rec && rec.text) || "").replace(/https?:\/\/\S+/g, ""));
  return a >= 0.6 ? "ar" : a <= 0.25 ? "en" : "";
}
export function tagMessages(rec) {
  const body = String(rec.text || "").slice(0, 1500) + (rec.output ? "\n\n" + String(rec.output).slice(0, 600) : "");
  const lang = itemLang(rec);
  const say = lang === "en" ? "\n\n(This item is in ENGLISH: write the title, summary and tags in English.)" : lang === "ar" ? "\n\n(This item is in Arabic: write the title, summary and tags in Arabic.)" : "";
  return [
    { role: "system", content: `You file one item in someone's private notebook. Reply with ONLY JSON:
{"title":"3-8 words naming it","summary":"one short sentence: what it is and why it may matter later","tags":["3 to 5 short topic words"],"kind":"note|link|quote|product|recipe|todo|contact|place|code"}
Rules: write title, summary and tags in the SAME language as the item (Arabic item → Arabic; Egyptian is fine). Tags are topics a person would search by (a person's name, a company, a product, a place, a subject) — not "note" or "text". Only what the item says; never invent details. Egyptian words: ونش = crane (a crane hire, not shipping), عربية = car, فلوس = money, الموقع = the site.` },
    { role: "user", content: body + say },
  ];
}
export function parseTagReply(raw, rec = null) {
  let j = null;
  try { const s = String(raw || ""); j = JSON.parse(s.slice(s.indexOf("{"), s.lastIndexOf("}") + 1)); } catch (e) { return null; }
  if (!j || typeof j !== "object") return null;
  const clean = (x, n) => String(x || "").replace(/\s+/g, " ").trim().slice(0, n);
  const tags = (Array.isArray(j.tags) ? j.tags : String(j.tags || "").split(/[,،]/)).map(normTag).filter((t) => t && t.length >= 2 && !/^(note|text|item|ملاحظه|نص)$/.test(t)).slice(0, 5);
  const kind = KINDS[String(j.kind || "").toLowerCase()] ? String(j.kind).toLowerCase() : null;
  let title = clean(j.title, 80), summary = clean(j.summary, 200);
  // v6.8: a filing in the wrong language is not kept (an English item titled in Arabic reads as a
  // translation, often a wrong one: "outriggers" → «جرار»). The card keeps its own first line, and
  // only the tags that are in the item's language stay.
  const lang = rec ? itemLang(rec) : "";
  if (lang) {
    const wrong = (x) => (lang === "en" ? arShareOf(x) > 0.5 : arShareOf(x) < 0.3);
    if (title && wrong(title)) title = "";
    if (summary && wrong(summary)) summary = "";
    const keep = tags.filter((t) => !wrong(t) || arShareOf(t) === 0.5);
    tags.length = 0; tags.push(...keep);
  }
  if (!title && !summary && !tags.length) return null;
  return { title, summary, tags, kind };
}

/* ---- search in plain words ------------------------------------------------------------------- */
const DAY = 86400000;
// whole words only, in any script (JS's \b knows only English letters: «في» must not match inside «وظيفي»)
const W = (alts) => new RegExp("(?<![\\p{L}\\p{N}])(?:" + alts + ")(?![\\p{L}\\p{N}])", "giu");
const TYPE_WORDS = [
  ["photos?|pictures?|images?|screenshots?|صور|صوره|الصور|سكرينات|سكرين", "photo"],
  ["links?|urls?|websites?|articles?|لينك|لينكات|اللينكات|روابط|الروابط|رابط", "link"],
  ["quotes?|sayings?|اقتباس|اقتباسات|مقوله|مقولات", "quote"],
  ["products?|things to buy|منتج|منتجات|المنتجات", "product"],
  ["recipes?|وصفه|وصفات|الوصفات", "recipe"],
  ["to-?dos?|tasks?|مهام|المهام|تاسكات", "todo"],
  ["contacts?|people|phone numbers|ارقام|أرقام|الارقام|اشخاص|أشخاص|نمر", "contact"],
  ["places?|locations?|addresses|اماكن|أماكن|الاماكن|عناوين|لوكيشن", "place"],
  ["notes?|ملاحظات|الملاحظات|نوتس", "note"],
  ["answers?|اجابات|إجابات|الاجابات", "answer"],
  ["code|كود|اكواد", "code"],
].map(([a, k]) => [W(a), k]);
const MONTHS_EN = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTHS_AR = ["يناير", "فبراير", "مارس", "ابريل|أبريل", "مايو", "يونيو", "يوليو", "اغسطس|أغسطس", "سبتمبر", "اكتوبر|أكتوبر", "نوفمبر", "ديسمبر"];
const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const GLUE = W("my|all|the|from|of|about|in|on|with|saved|show me|find|that|i|بتاع|بتاعت|بتوع|اللي|حفظتها|حفظته|عن|من|في|كل|وريني|هات|بتاعتي|بتاعي");
const PINNED = W("pinned|starred|favou?rites?|المثبت|المثبته|المفضله|المفضلة");

/**
 * "photos of the crane from last week" → { kind: "photo", from, to, words: "crane" }.
 * The filters are taken out of the words; what is left goes to the full-text search.
 */
export function parseQuery(q, now = Date.now()) {
  let s = " " + String(q || "").trim().replace(/[أإآ]/g, "ا").replace(/ة(?![\p{L}])/gu, "ه") + " ";   // «الأماكن» = «الاماكن»
  let kind = null, from = null, to = null, pinned = false;
  const hit = (rx) => { rx.lastIndex = 0; const ok = rx.test(s); rx.lastIndex = 0; return ok; };
  for (const [rx, k] of TYPE_WORDS) if (hit(rx)) { kind = k; s = s.replace(rx, " "); break; }
  const today = startOfDay(now), d0 = new Date(now);
  const T = [
    ["today|النهارده|النهاردة|اليوم", () => [today, now + 1]],
    ["yesterday|امبارح|أمس|امس", () => [today - DAY, today]],
    ["this week|الاسبوع ده|الأسبوع ده|هذا الاسبوع", () => [today - 6 * DAY, now + 1]],
    ["last week|الاسبوع اللي فات|الأسبوع اللي فات|الاسبوع الماضي|الأسبوع الماضي", () => [today - 13 * DAY, today - 6 * DAY]],
    ["this month|الشهر ده|هذا الشهر", () => [new Date(d0.getFullYear(), d0.getMonth(), 1).getTime(), now + 1]],
    ["last month|الشهر اللي فات|الشهر الماضي", () => [new Date(d0.getFullYear(), d0.getMonth() - 1, 1).getTime(), new Date(d0.getFullYear(), d0.getMonth(), 1).getTime()]],
    ["this year|السنه دي|السنة دي", () => [new Date(d0.getFullYear(), 0, 1).getTime(), now + 1]],
    ["last year|السنه اللي فاتت|السنة اللي فاتت", () => [new Date(d0.getFullYear() - 1, 0, 1).getTime(), new Date(d0.getFullYear(), 0, 1).getTime()]],
  ].map(([a, f]) => [W(a), f]);
  for (const [rx, f] of T) if (hit(rx)) { [from, to] = f(); s = s.replace(rx, " "); break; }
  if (from == null) {
    // "may" and "march" are also ordinary words: only as "in May" / "May 2026"
    const mi = MONTHS_EN.findIndex((m) => hit(W(/^(may|march)$/.test(m) ? `in ${m}|${m} \\d{4}` : `(?:in )?${m}`)));
    const ai = mi >= 0 ? -1 : MONTHS_AR.findIndex((m) => hit(W(m)));
    const k = mi >= 0 ? mi : ai;
    if (k >= 0) {
      let y = d0.getFullYear(); if (k > d0.getMonth()) y--;
      from = new Date(y, k, 1).getTime(); to = new Date(y, k + 1, 1).getTime();
      s = s.replace(mi >= 0 ? W(`(?:in )?${MONTHS_EN[k]}(?: \\d{4})?`) : W(MONTHS_AR[k]), " ");
    }
  }
  if (hit(PINNED)) { pinned = true; s = s.replace(PINNED, " "); }
  const words = s.replace(GLUE, " ").replace(/\s+/g, " ").trim();
  return { kind, from, to, pinned, words };
}

/** Does a record pass the filters (kind, dates, pinned, tag)? */
export function passes(rec, f) {
  if (!f) return true;
  if (f.kind && kindOf(rec) !== f.kind) return false;
  if (f.from != null && rec.ts < f.from) return false;
  if (f.to != null && rec.ts >= f.to) return false;
  if (f.pinned && !rec.pinned) return false;
  if (f.tag && !tagsOf(rec).includes(normTag(f.tag))) return false;
  return true;
}

/**
 * The search the screen runs: filters by code, words by the app's BM25 search (passed in, so the
 * Arabic normalisation and ranking are the ones Memory always had). `search(words, limit)` → [{rec}].
 */
export function mindSearch(records, q, search, { now = Date.now(), tag = null, limit = 120 } = {}) {
  const f = { ...parseQuery(q, now), tag };
  let list;
  if (f.words) {
    list = search(f.words, 400).map((h) => h.rec);
    // a word that is one of the item's tags always finds it, even if the text never says it
    const tw = normTag(f.words);
    for (const r of records) if (!list.includes(r) && tagsOf(r).includes(tw)) list.push(r);
  } else list = records.slice();
  return { filters: f, items: list.filter((r) => passes(r, f)).slice(0, limit) };
}

/* ---- Spaces ---------------------------------------------------------------------------------- */
/** Spaces that made themselves: the tags used on 3+ items, biggest first. */
export function autoSpaces(records, { min = 3, max = 12 } = {}) {
  const n = new Map();
  for (const r of records) for (const t of tagsOf(r)) n.set(t, (n.get(t) || 0) + 1);
  return [...n.entries()].filter(([, c]) => c >= min).sort((a, b) => b[1] - a[1]).slice(0, max).map(([tag, count]) => ({ tag, count }));
}
/** How many items of each kind there are, for the chips (only kinds that exist). */
export function kindCounts(records) {
  const n = {};
  for (const r of records) { const k = kindOf(r); n[k] = (n[k] || 0) + 1; }
  return Object.keys(KINDS).filter((k) => n[k]).map((k) => ({ kind: k, count: n[k] }));
}

/* ---- From your past (serendipity) ------------------------------------------------------------ */
/**
 * Up to n older items to see again today: first "on this day" (a month / a year ago ±1 day), then
 * pinned or tagged items older than 2 weeks, picked by the date so it changes daily but not on
 * every screen refresh.
 */
export function resurface(records, now = Date.now(), n = 3) {
  const old = records.filter((r) => now - r.ts > 14 * DAY);
  if (!old.length) return [];
  const near = (t, ago) => Math.abs(now - ago - t) <= 1.5 * DAY;
  const onThisDay = old.filter((r) => near(r.ts, 365 * DAY) || near(r.ts, 30 * DAY) || near(r.ts, 7 * 30 * DAY)).map((r) => ({ rec: r, why: now - r.ts > 300 * DAY ? "a year ago" : "on this day" }));
  let seed = Math.floor(now / DAY);
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const pool = old.filter((r) => !onThisDay.some((x) => x.rec === r)).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || a.ts - b.ts);
  const picks = [];
  while (picks.length < n - Math.min(onThisDay.length, n) && pool.length) picks.push({ rec: pool.splice(Math.floor(rnd() * pool.length), 1)[0], why: "from your past" });
  return [...onThisDay.slice(0, n), ...picks].slice(0, n);
}

/** Items like this one (its title and tags as the search), for "Similar" on an open card. */
export function similar(rec, search, n = 4) {
  const q = [rec.meta && rec.meta.aiTitle, rec.title, ...tagsOf(rec)].filter(Boolean).join(" ").slice(0, 200);
  return search(q, n + 1).map((h) => h.rec).filter((r) => r.id !== rec.id).slice(0, n);
}

/** The shown title: yours, else the model's, else the first line. */
export function titleOf(rec) {
  const m = rec.meta || {};
  return m.myTitle || m.aiTitle || rec.title || "";
}
/** Items the model hasn't filed yet (newest first) — the background tagger works through these. */
export function needsFiling(records, max = 5) {
  return records.filter((r) => !(r.meta && (r.meta.aiAt || r.meta.aiFailed >= 2)) && String(r.text || "").trim().length >= 12).slice(0, max);
}
/** Save the model's filing onto a record (pure: returns the new record). */
export function fileRecord(rec, parsed, now = Date.now()) {
  const m = { ...(rec.meta || {}) };
  if (!parsed) return { ...rec, meta: { ...m, aiFailed: (m.aiFailed || 0) + 1 } };
  m.aiAt = now;
  if (parsed.title) m.aiTitle = parsed.title;
  if (parsed.summary) m.summary = parsed.summary;
  if (parsed.tags && parsed.tags.length) m.aiTags = parsed.tags;
  // the model's kind only where code saw a plain note (code wins on links, prices, phones…)
  if (parsed.kind && kindOf(rec) === "note" && parsed.kind !== "note") m.mindKind = parsed.kind;
  return { ...rec, meta: m };
}
