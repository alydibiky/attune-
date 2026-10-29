/* ---- v6.40 Recall (agent C): one search box for everything on the phone, found by meaning, all on the phone. -------------
   What it searches: the screenshots and photos you add (their text is read on the phone), the notifications you chose to keep
   (30 days, never SMS — RecallLog.kt), your chats, Mind, saved pages and the payments Money saw.
   "the wifi code from the screenshot last week", «العنوان اللي أحمد بعته على الواتس», "the receipt for the AC in March".
   How "by meaning": the question's dates, kind (screenshot, notification, chat…) and app (WhatsApp, Gmail…) become filters,
   and every other word also matches the words that mean the same in English, Egyptian Arabic and Franco (receipt = فاتورة =
   bill = fatora). Pure; tests/unit/v740lookback.test.mjs; the page is lookback-ui.jsx.                                  */

import { CLUBS } from "./livefacts.js";
const DAY = 86400000;
export const fold = (s) => String(s || "").toLowerCase()
  .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة(?![\p{L}])/gu, "ه").replace(/[ً-ْـ]/g, "")
  .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660));
const W = (alts) => new RegExp("(?<![\\p{L}\\p{N}])(?:" + alts + ")(?![\\p{L}\\p{N}])", "giu");

// words that mean the same thing (every word in a group finds the others)
export const MEANINGS = [
  "receipt|receipts|invoice|invoices|bill|bills|total|subtotal|vat|فاتوره|فواتير|ايصال|إيصال|وصل|الاجمالي|اجمالي|المجموع|fatora|fatoura|wasl",   // a receipt says "Total"
  "password|passcode|pin|باسورد|الباسورد|كلمه السر|كلمة السر|باسوورد|basword|pass",
  "wifi|wi-fi|wireless|router|واي فاي|الواي فاي|وايفاي|الوايفاي|راوتر|wayfay",
  "code|otp|كود|الكود|رمز|كود التفعيل|verification",
  "address|location|map|pin|عنوان|العنوان|لوكيشن|اللوكيشن|مكان|المكان|خريطه|location|3nwan|lokeshn",
  "flight|ticket|tickets|boarding|booking|airline|طياره|الطياره|تذكره|تذاكر|حجز|الحجز|رحله|tazkara|7agz",
  "hotel|reservation|فندق|الفندق|حجز",
  "car|vehicle|عربيه|العربيه|سياره|العربية|3arabeya|3arabia",
  "money|transfer|instapay|sent|paid|payment|فلوس|تحويل|حول|حولت|انستاباي|دفعت|دفع|فلوس|flos|7awel",
  "salary|pay|مرتب|المرتب|راتب|morattab",
  "rent|إيجار|ايجار|الايجار|egar",
  "doctor|clinic|hospital|appointment|دكتور|الدكتور|دكتوره|عياده|مستشفي|كشف|doktor",
  "medicine|medication|pills|drug|دوا|الدوا|دواء|علاج|برشام|dawa",
  "order|delivery|shipment|parcel|package|اوردر|الاوردر|طلب|الطلب|دليفري|شحنه|الشحنه|order",
  "meeting|call|appointment|ميعاد|الميعاد|معاد|اجتماع|الاجتماع|ma3ad",
  "phone|number|mobile|رقم|الرقم|نمره|موبايل|رقمه|nemra|rakam",
  "email|mail|gmail|ايميل|الايميل|بريد|email",
  "price|cost|how much|سعر|السعر|بكام|تمن|التمن|se3r",
  "passport|id|national id|بطاقه|البطاقه|باسبور|جواز|الباسبور|ba6a2a",
  "school|exam|homework|مدرسه|المدرسه|امتحان|واجب|madrasa",
  "warranty|guarantee|ضمان|الضمان|daman",
  "electricity|power|كهربا|الكهربا|كهرباء|kahraba",
  "internet|data|we|vodafone|orange|etisalat|نت|النت|باقه|الباقه",
  "birthday|عيد ميلاد|عيد الميلاد|3eed milad",
  "gift|present|هديه|الهديه|hedeya",
  "dollar|dollars|usd|الدولار|دولار|دولارات|dolar",
  "gold|ذهب|الذهب|دهب|الدهب|dahab",
  "sofa|couch|كنبه|الكنبه|كنب|الكنب|kanaba",
  "lamp|light|chandelier|نجفه|النجفه|اباجوره|lamba",
  "curtain|curtains|ستاره|الستاره|ستاير|الستاير",
  "hadith|حديث|الحديث|احاديث|الاحاديث",
  // v8.7 (Ali: "the search should be free text and get me what I mean"): a match, the weather, the news, a delivery on its way
  "score|scores|match|game|goal|goals|result|live|vs|كوره|الكوره|ماتش|الماتش|مباراه|المباراه|نتيجه|النتيجه|جون|اجوان|اهداف|match|el match|natiga",
  "football|soccer|league|premier league|كوره|الدوري|دوري",
  "weather|temperature|hot|cold|warm|degrees|rain|feels|°|حر|برد|الجو|جو|الطقس|طقس|حراره|درجه الحراره|مطر|el gaw",
  "news|breaking|headline|اخبار|الاخبار|خبر|عاجل|akhbar",
  "message|messages|texted|wrote|رساله|رسايل|الرساله|مسدج|ماسدج|بعت|massage",
  "photo|picture|image|صوره|الصوره",
  ...CLUBS.map((g) => g.join("|")),
].map((g) => g.split("|").map(fold));
const PHRASES = [...new Set(MEANINGS.flat().filter((w) => w.includes(" ")))].sort((a, b) => b.length - a.length);   // «واي فاي», «كلمه السر»
const MEANING_OF = new Map();
MEANINGS.forEach((g, i) => g.forEach((w) => { if (!MEANING_OF.has(w)) MEANING_OF.set(w, []); MEANING_OF.get(w).push(i); }));

// where it came from
export const KINDS = {
  photo: { en: "Screenshots & photos", ar: "سكرينات وصور" },
  note:  { en: "Notifications", ar: "إشعارات" },
  chat:  { en: "Chats", ar: "شاتات" },
  mind:  { en: "Mind", ar: "العقل" },
  page:  { en: "Saved pages", ar: "صفحات محفوظة" },
  pay:   { en: "Payments", ar: "مدفوعات" },
};
const KIND_WORDS = [
  ["screenshots?|screen shots?|photos?|pictures?|images?|pics?|سكرين|سكرينات|سكرينشوت|اسكرين|صوره|الصوره|صور|الصور|sakreen|sora", "photo"],
  ["notifications?|alerts?|إشعار|اشعار|الاشعار|اشعارات|الإشعارات|نوتيفيكيشن", "note"],
  ["chats? with attune|my chats?|الشات|شاتات|المحادثه", "chat"],
  ["saved pages?|artifacts?|الصفحه المحفوظه|الصفحات المحفوظه", "page"],
  ["payments?|transactions?|bank|المدفوعات|البنك|معاملات", "pay"],
].map(([a, k]) => [W(a), k]);
// an app named in the question → only its notifications
const APP_WORDS = [
  ["whatsapp|whats app|واتس|الواتس|واتساب|الواتساب|wats", /whatsapp/],
  ["gmail|email|e-mail|mail|ايميل|الايميل|الإيميل|جيميل", /\.gm$|gmail|mail|outlook|yahoo|proton/],
  ["telegram|تليجرام|التليجرام", /telegram/],
  ["messenger|facebook|ماسنجر|فيسبوك|الفيس", /facebook|orca/],
  ["instagram|انستا|انستجرام", /instagram/],
  ["teams|تيمز", /teams/], ["slack|سلاك", /slack/],
].map(([a, rx]) => [W(a), rx]);
const MONTHS_EN = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTHS_AR = ["يناير", "فبراير", "مارس", "ابريل", "مايو", "يونيو", "يوليو", "اغسطس", "سبتمبر", "اكتوبر", "نوفمبر", "ديسمبر"];
// words that only glue the question together
const STOP = new Set(("the a an of from to in on at for with my me i you it that this was were is are and or what where when which who how did do " +
  "find show give get last sent send told said about any all one some there here have has had want need " +
  "saw seen see remember remind got came again latest now just thing things something which whats what's was it " +
  "شفت شوفت جالي جاتلي وصلي افتكر فاكر حاجه دلوقتي تاني " +
  "اللي الي في من على علي عن مع ده دي دا كان كانت انا انت هو هي ايه إيه فين امتي امتى مين ازاي هات وريني عايز عاوز " +
  "بتاع بتاعت بتوع بتاعي بتاعتي كل حاجه اي او و يا لي ليا بعتهولي بعته بعتلي بعتها قالي قال لقيت دور دورلي فيه " +
  "eh fen meen ely elly men fe 3ala da di").split(/\s+/).map(fold));

const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

/** "the wifi code from the screenshot last week" → { from, to, kind, app, terms: ["wifi","code"] }. */
export function parseAsk(q, now = Date.now()) {
  let s = " " + fold(q) + " ";
  let kind = null, app = null, from = null, to = null;
  const take = (rx) => { rx.lastIndex = 0; if (!rx.test(s)) return false; rx.lastIndex = 0; s = s.replace(rx, " "); return true; };
  for (const [rx, k] of KIND_WORDS) if (take(rx)) { kind = k; break; }
  for (const [rx, a] of APP_WORDS) if (take(rx)) { app = a; if (!kind) kind = "note"; break; }
  const today = startOfDay(now), d0 = new Date(now);
  const T = [
    ["today|النهارده|النهارده|انهارده|اليوم|ennaharda", () => [today, now + 1]],
    ["yesterday|امبارح|امس|embare7", () => [today - DAY, today]],
    ["this week|الاسبوع ده|هذا الاسبوع", () => [today - 6 * DAY, now + 1]],
    ["last week|الاسبوع اللي فات|الاسبوع الي فات|الاسبوع الماضي", () => [today - 13 * DAY, today - 6 * DAY]],
    ["this month|الشهر ده|هذا الشهر", () => [new Date(d0.getFullYear(), d0.getMonth(), 1).getTime(), now + 1]],
    ["last month|الشهر اللي فات|الشهر الي فات|الشهر الماضي", () => [new Date(d0.getFullYear(), d0.getMonth() - 1, 1).getTime(), new Date(d0.getFullYear(), d0.getMonth(), 1).getTime()]],
  ];
  for (const [a, f] of T) if (take(W(a))) { [from, to] = f(); break; }
  if (from == null) {
    const m = s.match(W("(\\d{1,2}) days? ago|من (\\d{1,2}) (?:ايام|يوم)"));
    if (m) { const n = +(m[0].match(/\d+/)[0]); from = today - n * DAY; to = today - (n - 1) * DAY; s = s.replace(m[0], " "); }
  }
  if (from == null) {
    let k = MONTHS_EN.findIndex((m) => W(/^(may|march)$/.test(m) ? `in ${m}|${m} \\d{4}` : m).test(s));
    let rx = k >= 0 ? W(/^(may|march)$/.test(MONTHS_EN[k]) ? `in ${MONTHS_EN[k]}(?: \\d{4})?|${MONTHS_EN[k]} \\d{4}` : `(?:in )?${MONTHS_EN[k]}(?: \\d{4})?`) : null;
    if (k < 0) { k = MONTHS_AR.findIndex((m) => W("(?:في )?" + m).test(s)); if (k >= 0) rx = W("(?:في )?" + MONTHS_AR[k]); }
    if (k >= 0) { let y = d0.getFullYear(); if (k > d0.getMonth()) y--; from = new Date(y, k, 1).getTime(); to = new Date(y, k + 1, 1).getTime(); s = s.replace(rx, " "); }
  }
  for (const ph of PHRASES) if (s.includes(" " + ph + " ")) s = s.split(" " + ph + " ").join(" " + ph.replace(/ /g, "_") + " ");   // a two-word meaning stays one word
  const terms = s.split(/[^\p{L}\p{N}@._]+/u).map((w) => w.replace(/^\.+|\.+$/g, "")).filter((w) => w && !STOP.has(w) && !(w.length < 2 && !/\d/.test(w)));
  return { from, to, kind, app, terms: [...new Set(terms)] };
}

// light stemming: Arabic article and joined letters, English plurals — so «بالفاتوره» finds «فاتوره», "receipts" finds "receipt"
const stems = (w) => {
  const out = [w];
  if (/[؀-ۿ]/.test(w)) {
    let x = w;
    for (const p of ["وبال", "فال", "بال", "كال", "لل", "وال", "ال", "و", "ب", "ل"]) if (x.startsWith(p) && x.length - p.length >= 3) { x = x.slice(p.length); out.push(x); break; }
    for (const suf of ["ات", "ها", "هم", "ه", "ي"]) if (x.endsWith(suf) && x.length - suf.length >= 3) { out.push(x.slice(0, -suf.length)); break; }
  } else if (/[a-z]{4,}s$/.test(w)) out.push(w.replace(/(?:es|s)$/, ""), w.slice(0, -1));
  return out;
};
const tokens = (text) => { const t = new Set(); for (const w of fold(text).split(/[^\p{L}\p{N}@.]+/u)) { const c = w.replace(/^\.+|\.+$/g, ""); if (!c) continue; for (const x of stems(c)) t.add(x); } return t; };

// a typo or a word cut short: the same start (4+ letters) or one/two letters different (Damerau, two only for long words)
function near(a, b) {
  if (a === b || b.length < 4) return a === b;
  if (b.startsWith(a) && a.length >= 4) return true;
  const max = a.length >= 7 ? 2 : 1;
  if (Math.abs(a.length - b.length) > max || a[0] !== b[0]) return false;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[a.length][b.length] <= max;
}

/** v8.7 (Recall keeps messages forever — the phone lists the newest 3000, older ones are asked for by words): the words to ask
 *  the phone's database for — the question's own words and the words that mean the same (at most 8). */
export function wordsFor(q, now = Date.now()) {
  const ask = parseAsk(q, now), out = [];
  for (const w of ask.terms) {
    const ph = w.includes("_") ? w.replace(/_/g, " ") : null;
    for (const x of ph ? [ph] : stems(w)) { if (!out.includes(x)) out.push(x); for (const gi of MEANING_OF.get(x) || []) for (const y of MEANINGS[gi]) if (y.length >= 3 && !out.includes(y)) out.push(y); }
  }
  return out.filter((w) => w.length >= 2).slice(0, 8);
}

/** Everything Recall can find, as one list: [{ id, kind, title, text, ts, app?, pkg?, open? }]. */
export function recallDocs({ memory = [], notes = [], chats = [], pages = [], pays = [] } = {}) {
  const docs = [];
  for (const r of memory) {
    const photo = r.kind === "photo" || (r.meta && r.meta.thumb);
    docs.push({ id: "m:" + r.id, kind: photo ? "photo" : "mind", title: r.title || "", text: [r.text, r.output, r.note, (r.tags || []).join(" ")].filter(Boolean).join("\n"), ts: r.ts || 0, thumb: photo ? r.id : null, open: { mode: "memory", id: r.id } });
  }
  for (const n of notes) docs.push({ id: "n:" + n.id, kind: "note", title: n.title || "", text: n.text || "", ts: n.ts || 0, app: n.app || "", pkg: n.pkg || "", raw: n.id });
  for (const c of chats) {
    const msgs = (c.messages || []).filter((m) => m.text);
    if (!msgs.length) continue;
    docs.push({ id: "c:" + c.id, kind: "chat", title: c.title || (msgs[0].text || "").slice(0, 60), text: msgs.map((m) => m.text).join("\n").slice(0, 20000), ts: c.updated || c.ts || (msgs[msgs.length - 1].ts) || 0, open: { mode: "chat", id: c.id } });
  }
  for (const a of pages) { const v = (a.versions || [])[a.versions.length - 1]; docs.push({ id: "a:" + a.id, kind: "page", title: a.title || "", text: v ? String(v.content).replace(/<[^>]+>/g, " ").slice(0, 8000) : "", ts: a.updated || 0, open: { artifact: a.id } }); }
  for (const p of pays) docs.push({ id: "p:" + p.id, kind: "pay", title: p.title || p.app || "", text: p.text || "", ts: p.ts || 0, app: p.app || "", pkg: p.pkg || "" });
  return docs;
}

/** The line of `text` that best shows why it was found (≤ 160 letters). */
export function snippet(text, want) {
  const lines = String(text || "").split(/\n|(?<=[.!?؟])\s+/).map((l) => l.trim()).filter(Boolean);
  let best = lines[0] || "", bs = -1;
  for (const l of lines) { const t = tokens(l); let s = 0; for (const w of want) if (t.has(w)) s++; if (s > bs) { bs = s; best = l; } }
  return best.length > 160 ? best.slice(0, 157) + "…" : best;
}

/**
 * Search: the filters by code, then every word — or a word that means the same (weight 0.7) — scored by how rare it is
 * (BM25-like). Numbers count double (a code, an amount). → { ask, hits: [{ doc, score, snip }] } newest first on ties.
 */
export function recallSearch(docs, q, { now = Date.now(), limit = 40 } = {}) {
  const ask = parseAsk(q, now);
  let pool = docs.filter((d) => (!ask.kind || d.kind === ask.kind || (ask.kind === "note" && d.kind === "pay") || (ask.kind === "pay" && d.kind === "note" && /bank|بنك|instapay|paid|دفع|تحويل/i.test(d.text)))
    && (ask.from == null || (d.ts >= ask.from && d.ts < ask.to))
    && (!ask.app || ask.app.test(d.pkg || "") || ask.app.test(fold(d.app || ""))));
  if (!ask.terms.length) return { ask, hits: pool.sort((a, b) => b.ts - a.ts).slice(0, limit).map((doc) => ({ doc, score: 0, snip: snippet(doc.text, []) })) };
  const toks = pool.map((d) => ({ d, t: tokens(d.title + "\n" + d.text), title: tokens(d.title), f: " " + fold(d.title + " " + d.text).replace(/[^\p{L}\p{N}]+/gu, " ") + " " }));
  const N = toks.length || 1;
  // each asked word → the words that count for it: itself (1) and its meanings (0.7)
  const wants = ask.terms.map((w) => {
    const m = new Map(), ph = w.includes("_") ? w.replace(/_/g, " ") : null;
    const keys = ph ? [ph] : stems(w);
    if (!ph) for (const x of keys) m.set(x, 1);
    const phr = [];   // the two-word meanings, looked for as phrases in the text
    for (const x of keys) for (const gi of MEANING_OF.get(x) || []) for (const y of MEANINGS[gi]) { if (y.includes(" ")) phr.push(y); else if (!m.has(y) && !STOP.has(y)) m.set(y, ph ? 1 : 0.7); }
    return { w, m, phr, num: /^\d{2,}$/.test(w) };
  });
  // a two-word meaning («كلمه السر», "how much") also counts when the text has it as a phrase
  const inText = (x, phr) => phr.some((p) => x.f.includes(" " + p + " "));
  const df = wants.map(({ m, phr }) => toks.filter((x) => [...m.keys()].some((k) => x.t.has(k)) || inText(x, phr)).length);
  const hits = [], loose = [];
  for (const x of toks) {
    const { d, t, title } = x;
    let s = 0, got = 0; const seen = [];
    wants.forEach(({ w, m, phr, num }, i) => {
      let best = 0, bw = null; for (const [k, wt] of m) if (t.has(k) && wt > best) { best = wt; bw = k; }
      if (!best && phr.length && inText(x, phr)) { best = 0.7; bw = phr.find((p) => x.f.includes(" " + p + " ")).split(" ")[0]; }
      if (!best && !num && w.length >= 4 && !w.includes("_")) for (const k of t) if (near(w, k)) { best = 0.6; bw = k; break; }   // v8.7: "chelsy" finds "chelsea", "liverpol" "liverpool"
      if (!best) return;
      got++; seen.push(bw);
      const idf = Math.log(1 + N / (df[i] || 1));
      s += best * idf * (num ? 2 : 1) * (title.has(bw) ? 1.5 : 1);
    });
    const need = wants.length <= 2 ? 1 : Math.ceil(wants.length * 0.5);   // most of the words, not every one
    if (got >= need && s > 0) hits.push({ doc: d, score: s * (got / wants.length), snip: snippet(d.text || d.title, seen) });
    else if (got && s > 0) loose.push({ doc: d, score: s * (got / wants.length) * 0.5, snip: snippet(d.text || d.title, seen) });
  }
  // v8.7: nothing has most of the words → the things that have some of them, best first (free text never ends on "nothing")
  const out = hits.length ? hits : loose;
  out.sort((a, b) => b.score - a.score || b.doc.ts - a.doc.ts);
  return { ask, hits: out.slice(0, limit), loose: !hits.length && !!loose.length };
}

/** A short title for a screenshot from the text read in it: the first line that says something. */
export function shotTitle(text, fallback = "Screenshot") {
  const lines = String(text || "").split(/\n/).map((l) => l.trim()).filter((l) => /[\p{L}]{3}/u.test(l) && !/^\d{1,2}[:.]\d{2}/.test(l) && l.length >= 4);
  return (lines[0] || fallback).slice(0, 60);
}

/** Old enough to forget (notifications are kept 30 days; the phone drops them too). */
export const NOTE_DAYS = 30;
