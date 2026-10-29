/* ---- v8.7 (Ali, 29 Oct: "I had the notification from the app that Liverpool and Chelsea is 1-1, so I asked the chat… make the chat much
   smarter, it is stupid as hell"): live questions answered BY CODE, from the phone first, then from the web pages — never a small model
   saying "Passage 1 mentions …".
     isLive(q)            a question about right now: a score, a result, the weather, a price now, "now / today / live"
     teamsOf(q)           "score of Chelsea and Liverpool" → ["chelsea", "liverpool"] (English, Arabic, Franco)
     scoreIn(text, teams) "Liverpool 1 - 1 Chelsea" / «ليفربول ١-١ تشيلسي» → { home, away, a, b, line } when BOTH teams are in it
     fromNotes(notes, q)  the newest kept notification (Recall, last 6 h) that has the score → the answer and where it came from
     fromPassages(ps, q)  the same in web pages (the score most pages agree on)
     isMetaAnswer(text)   "Passage 1 mentions …" / "the passages say …" — an answer that answers nothing
   Pure. Tests: tests/unit/v870livefacts.test.mjs.                                                                          */
const LIVE = /\b(score|scores|result|results|who (?:won|is winning)|winning|live|now|right now|today|tonight|weather|temperature|price (?:of|now|today)|exchange rate|match|game|kick ?off|half ?time|full ?time)\b|النتيجة|نتيجة|كام كام|مين كسب|ماتش|مباراة|مباراه|الجو|الطقس|درجة الحرارة|دلوقتي|النهارده|حالا|سعر .* (?:النهارده|دلوقتي)|el score|natiga|el match|dlw2ty|delwa2ty/i;
export const isLive = (q) => LIVE.test(String(q || ""));
const SPORT = /\b(score|scores|result|won|win|winning|match|game|vs\.?|versus|v|goal|goals)\b|النتيجة|نتيجة|كام كام|كسب|ماتش|مباراة|مباراه|ضد|جون|اجوان|أهداف|el score|natiga|el match/i;
export const isScoreQuestion = (q) => SPORT.test(String(q || ""));

const fold = (s) => String(s || "").toLowerCase().replace(/[إأآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").normalize("NFKD").replace(/[\u0300-\u036f\u064b-\u065f\u0670]/g, "")
  .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
  .replace(/(^|\s)[وب](?=ال)/g, "$1");   // «والزمالك» / «بالأهلي» → «الزمالك» / «الاهلي»
// the clubs people ask about most — English, Arabic, Franco spellings → one key (any other capitalised name still works)
export const CLUBS = [["liverpool", "ليفربول", "liverbool"], ["chelsea", "تشيلسي", "تشلسي", "شيلسي"], ["arsenal", "ارسنال", "أرسنال"], ["manchester city", "man city", "مانشستر سيتي", "السيتي"],
  ["manchester united", "man united", "man utd", "مانشستر يونايتد", "اليونايتد"], ["tottenham", "spurs", "توتنهام"], ["real madrid", "ريال مدريد", "الريال"], ["barcelona", "barca", "برشلونة", "برشلونه", "البارسا"],
  ["bayern", "بايرن", "البايرن"], ["al ahly", "ahly", "الاهلي", "الأهلي", "ahli"], ["zamalek", "الزمالك", "zamalk"], ["pyramids", "بيراميدز"], ["juventus", "يوفنتوس"], ["inter", "انتر", "إنتر"],
  ["milan", "ميلان"], ["psg", "paris saint-germain", "باريس"], ["egypt", "مصر", "المنتخب"], ["al hilal", "الهلال"], ["al nassr", "النصر"], ["magdeburg"], ["newcastle", "نيوكاسل"], ["aston villa", "استون فيلا"]];
const ALIAS = new Map(); for (const g of CLUBS) for (const n of g) ALIAS.set(fold(n), g[0]);
const STOPCAP = new Set(["what", "who", "when", "the", "is", "and", "of", "score", "now", "live", "today", "match", "game", "result", "vs", "a"]);

/** The teams the question names: known clubs (any spelling), else capitalised names around "and / vs / و / ضد". */
export function teamsOf(q) {
  const f = " " + fold(q).replace(/[^\p{L}\p{N} ]+/gu, " ") + " ", out = [];
  for (const [alias, key] of ALIAS) if (f.includes(" " + alias + " ") && !out.includes(key)) out.push(key);
  if (out.length >= 2) return out.slice(0, 2);
  const m = String(q || "").match(/([A-Z][\w.]+(?:\s[A-Z][\w.]+)?)\s+(?:and|vs\.?|v|versus|against|-)\s+([A-Z][\w.]+(?:\s[A-Z][\w.]+)?)/);
  if (m) for (const x of [m[1], m[2]]) { const k = ALIAS.get(fold(x)) || fold(x); if (!STOPCAP.has(k) && !out.includes(k)) out.push(k); }
  return out.slice(0, 2);
}
const has = (text, team) => { const f = " " + fold(text).replace(/[^\p{L}\p{N} ]+/gu, " ") + " "; if (f.includes(" " + team + " ")) return true; for (const [a, k] of ALIAS) if (k === team && f.includes(" " + a + " ")) return true; return false; };

/** "Liverpool 1 - 1 Chelsea" in text, with both teams → { line, a, b, first, second } (first/second = the names as written). */
export function scoreIn(text, teams) {
  if (!teams || teams.length < 2) return null;
  const t = fold(text).replace(/\s+/g, " ");
  if (!teams.every((x) => has(t, x))) return null;
  // «Team 1 - 1 Team», «Team 1–1 Team», «1-1» near both names
  const rx = /([\p{L}][\p{L} .'’-]{1,30}?)\s+(\d{1,2})\s*[-–—:]\s*(\d{1,2})\s+([\p{L}][\p{L} .'’-]{1,30})/gu;
  let m;
  while ((m = rx.exec(t))) {
    const A = m[1].trim(), B = m[4].trim();
    const ia = teams.findIndex((x) => has(A.split(" ").slice(-3).join(" "), x)), ib = teams.findIndex((x) => has(B.split(" ").slice(0, 3).join(" "), x));
    if (ia >= 0 && ib >= 0 && ia !== ib) return { first: teams[ia], second: teams[ib], a: +m[2], b: +m[3] };
  }
  return null;
}
const cap = (k) => k.replace(/\b\w/g, (c) => c.toUpperCase());
const phase = (text) => (/second half|2nd half|الشوط الثاني/i.test(text) ? "second half" : /first half|1st half|الشوط الاول|الشوط الأول/i.test(text) ? "first half" : /half ?time|استراحة/i.test(text) ? "half-time" : /full ?time|\bft\b|انتهت|نهاية المباراة/i.test(text) ? "full time" : /live|مباشر/i.test(text) ? "live" : "");

/** The newest kept notification (last `hours`) with the score. notes = Recall's [{ title, text, ts, app }]. → { en, ar, src, at } | null */
/** How far back a question looks: "now / live" 6 h · "today / tonight" 24 h · "yesterday / last night" 48 h · else a week. */
export function hoursFor(q) {
  const t = String(q || "");
  if (/\b(now|live|right now|currently)\b|دلوقتي|دلوقت|حالا|مباشر/i.test(t)) return 6;
  if (/\b(today|tonight|this evening)\b|النهارده|انهارده|الليلة|الليله/i.test(t)) return 24;
  if (/\b(yesterday|last night)\b|امبارح|إمبارح|البارح|أمس|امس/i.test(t)) return 48;
  return 24 * 7;
}
/** Search words that find a match's result ("Liverpool vs Chelsea score"), or [] when the question isn't about a match. */
export function scoreQueries(q) {
  const t = teamsOf(q); if (t.length < 2 || !isScoreQuestion(q)) return [];
  const [a, b] = t.map(cap);
  return [`${a} vs ${b} score`, `${a} ${b} result`, `${b} vs ${a}`];
}
export function fromNotes(notes, q, { now = Date.now(), hours = hoursFor(q) } = {}) {
  const teams = teamsOf(q); if (teams.length < 2) return null;
  const fresh = (notes || []).filter((n) => n && n.ts && now - n.ts <= hours * 3600e3).sort((a, b) => b.ts - a.ts);
  for (const n of fresh) {
    const text = [n.title, n.text].filter(Boolean).join(" · "), s = scoreIn(text, teams);
    if (!s) continue;
    const ph = phase(text), when = new Date(n.ts).toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" }), app = n.app || "a notification";
    const line = `${cap(s.first)} ${s.a} – ${s.b} ${cap(s.second)}`;
    return { en: `**${line}**${ph ? ` (${ph})` : ""} — from your ${app} notification at ${when}. It may have changed since; ask "latest" to check the web.`,
      ar: `**${line}**${ph ? ` (${({ "second half": "الشوط التاني", "first half": "الشوط الأول", "half-time": "استراحة", "full time": "انتهت", live: "مباشر" })[ph]})` : ""} — من إشعار ${app} الساعة ${when}. ممكن تكون اتغيرت؛ قول «آخر نتيجة» عشان أدوّر على النت.`,
      src: app, at: n.ts, score: s };
  }
  return null;
}

/** The score most of the web pages agree on. passages = [{ title, text, url }] → { en, ar, score, n } | null */
export function fromPassages(passages, q) {
  const teams = teamsOf(q); if (teams.length < 2) return null;
  const votes = new Map(), seen = new Set();
  for (const p of passages || []) {
    if (p && p.url) { if (seen.has(p.url)) continue; seen.add(p.url); }
    const s = scoreIn([p.title, p.text].filter(Boolean).join(" · "), teams); if (!s) continue;
    const k = `${s.first}|${s.a}|${s.b}|${s.second}`, v = votes.get(k) || { s, n: 0, ph: "", src: [] };
    v.n++; v.ph = v.ph || phase(p.text || ""); try { v.src.push(new URL(p.url).hostname.replace(/^www\./, "")); } catch (e) {} votes.set(k, v);
  }
  const best = [...votes.values()].sort((a, b) => b.n - a.n)[0]; if (!best) return null;
  const line = `${cap(best.s.first)} ${best.s.a} – ${best.s.b} ${cap(best.s.second)}`;
  return { en: `**${line}**${best.ph ? ` (${best.ph})` : ""} — ${best.n} of the pages I read say so (${[...new Set(best.src)].slice(0, 3).join(", ")}).`,
    ar: `**${line}**${best.ph ? ` (${best.ph})` : ""} — ${best.n} من الصفحات اللي قريتها بتقول كده (${[...new Set(best.src)].slice(0, 3).join("، ")}).`, score: best.s, n: best.n };
}

/** An answer that only describes the sources ("Passage 1 mentions …") instead of answering. */
export function isMetaAnswer(text) {
  const t = String(text || "").trim(); if (!t) return true;
  const lines = t.split(/\n+/).filter((l) => l.trim());
  const meta = lines.filter((l) => /\b(passage|source|page|result)s?\s*\[?\(?\d+\)?\]?\s+(mentions|says|talks about|is about|contains|discusses|refers to)\b|^\W*(the )?(passages|sources|search results) (mention|say|contain|discuss)/i.test(l) || /^\W*(المقطع|المصدر|الصفحة)\s*\d+\s*(بيقول|يذكر|بيتكلم)/.test(l));
  return meta.length >= Math.max(1, Math.ceil(lines.length / 2));
}

const QSTOP = new Set("what is the of and a an to in on for now live today who how many much does did do are was were me my please tell score result match game".split(" "));
/** When the model only described the pages: the sentence of each of the best pages that answers the most of the question's words,
 *  with its source number — code's answer instead of "Passage 1 mentions …". passages = the numbered sources [{ text, title }]. */
export function keyLines(passages, q, max = 3) {
  const words = fold(q).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3 && !QSTOP.has(w));
  if (!words.length) return "";
  const out = [];
  (passages || []).forEach((p, i) => {
    const sents = String(p.text || "").replace(/\s+/g, " ").split(/(?<=[.!?؟])\s+|\s·\s|\n/).filter((s) => s.length >= 20 && s.length <= 320);
    let best = null, bs = 0;
    for (const s of sents) { const f = fold(s), n = words.filter((w) => f.includes(w)).length + (/\d/.test(s) ? 0.5 : 0); if (n > bs) { bs = n; best = s; } }
    if (best && bs >= Math.min(2, words.length)) out.push({ s: best.trim(), n: bs, i: i + 1 });
  });
  return out.sort((a, b) => b.n - a.n).slice(0, max).map((x) => `- ${x.s} [${x.i}]`).join("\n");
}
