/* ---- v9.9.25 B8 AU4 scheduled AI jobs (file aijobs.js — jobs.js is the v6.48 "/" command queue, a different thing) (Ali picked A: a Jobs page + the result on Home in the morning). A job = a task for the AI on a
   schedule, said the way people say it: "every Sunday 9 pm plan my week", «كل يوم خميس لخصلي المشروع», "on the 25th tell me what's left
   until salary", "every day at 7 summarise my messages", "le 1er de chaque mois…". Code reads the schedule (weekly days and time by the
   rules reader in 20 languages, the day of the month here — 31 → the month's last day, every day) and works out the next run; the
   phone runs due jobs at night while charging (or when the app opens after the time), and the answer is checked against the person's
   own data: a number in the answer that isn't in the data is flagged, never shown as a fact. Pure.
   Tests: tests/au4/gen.mjs (10,000 sentences) + tests/unit/v9925au4.test.mjs. */
import { daysIn, timeIn } from "./rules.js";
const latin = (s) => String(s || "").replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0)).replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x966));
// (letter-aware edges, not \b — \b is ASCII-only: «каждый день», «हर दिन», «هر روز» need these)
const B0 = "(?<![\\p{L}\\p{M}])", B1 = "(?![\\p{L}\\p{M}])";
const DAILY = new RegExp(B0 + "(every ?day|daily|each day|every (?:morning|night|evening)|كل يوم(?! (?:ال)?(?:حد|احد|اتنين|اثنين|تلات|ثلاثاء|اربع|اربعاء|خميس|جمعه|سبت))|يوميا|كل ليله|كل صباح|tous les jours|chaque (?:jour|soir|matin)|todos los d[ií]as|cada d[ií]a|jeden tag|t[aä]glich|todos os dias|ogni giorno|каждый день|ежедневно|her g[uü]n|setiap hari|tiap hari|हर दिन|रोज़|रोज|روزانہ|ہر روز|هر روز|প্রতিদিন|kila siku|ทุกวัน|mỗi ngày|hằng ngày|每天|毎日|매일)" + "(?![\\p{L}])", "iu");
const MONTHLY = new RegExp(B0 + "(every month|monthly|each month|كل شهر|شهريا|chaque mois|tous les mois|cada mes|todos los meses|jeden monat|monatlich|todo m[eê]s|ogni mese|каждый месяц|ежемесячно|her ay|setiap bulan|tiap bulan|हर महीने|ہر مہینے|هر ماه|প্রতি মাসে|kila mwezi|ทุกเดือน|mỗi tháng|hằng tháng|每月|毎月|매월|매달)", "iu");
// Urdu «ہفتہ» is both "week" and "Saturday": "my / this / next / every week" is the week, not a Saturday
const WEEK_UR = /(میرا|اس|اگلے|پورا|ہر|پچھلے)\s+ہفت[ہے]|ہفتے\s+کا/g;
const DOM = [/(?<![\p{L}])(?:on the |the |يوم |le |el d[ií]a |el |am |dia |il |tanggal |tarehe |ngày |วันที่ |ayın )(\d{1,2})(?:st|nd|rd|th|er|\.|'?[iıuü]|º)?(?!\d|[.,:]\d)/iu,
  /(?<![\d.,])(\d{1,2})(?:(?:st|nd|rd|th| तारीख| تاریخ| তারিখ|-го|-e| ام)(?![\p{L}\d])|(?:号|日|일)(?!\d))/iu];
/** The schedule in a sentence → { kind: "daily" | "weekly" | "monthly", days: [0-6], dom, at: { h, m } } | null */
const fold = (s) => latin(s).toLowerCase().normalize("NFKC").replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة(?=\s|$|[.,!?؟،])/g, "ه").replace(/\s+/g, " ").trim();   // (as rules.js reads it)
export function readSchedule(text) {
  const t = fold(text);
  let dom = null, cut = t; for (const re of DOM) { const m = re.exec(t); if (m && +m[1] >= 1 && +m[1] <= 31) { dom = +m[1]; cut = t.replace(m[0], " "); break; } }
  // the time: an explicit HH:MM first; else the rules reader on the text without the day of the month ("25-го" is not 25 o'clock)
  const hmm = /(?<!\d)([01]?\d|2[0-3])[:.]([0-5]\d)(?!\d)/.exec(cut);
  let at = hmm ? { h: +hmm[1], m: +hmm[2] } : timeIn(cut) || { h: 21, m: 0 };
  // (whole words only: «جمعرات» — Thursday — holds «رات», night)
  if (hmm && at.h < 12 && /(?<![\p{L}])(pm|p\.m\.|مساء|بالليل|soir|abend|akşam|sore|malam|शाम|رات|شام)(?![\p{L}])|晚上|下午|午後|저녁|오후/iu.test(cut)) at = { h: at.h + 12, m: at.m };
  if (dom != null && (MONTHLY.test(t) || !daysIn(t.replace(WEEK_UR, " ")).length)) return { kind: "monthly", days: [], dom, at };
  const days = daysIn(t.replace(WEEK_UR, " "));
  if (days.length && !DAILY.test(t.replace(/كل يوم/g, ""))) return { kind: "weekly", days: [...days].sort(), dom: null, at };
  if (DAILY.test(t)) return { kind: "daily", days: [], dom: null, at };
  if (days.length) return { kind: "weekly", days: [...days].sort(), dom: null, at };
  return null;
}
/** The next run after now (local time). */
export function nextRun(s, now = Date.now()) {
  if (!s) return null;
  const d = new Date(now); d.setSeconds(0, 0); d.setHours(s.at.h, s.at.m);
  if (s.kind === "daily") { if (d.getTime() <= now) d.setDate(d.getDate() + 1); return d.getTime(); }
  if (s.kind === "weekly") { for (let k = 0; k < 8; k++) { const x = new Date(d); x.setDate(d.getDate() + k); if (s.days.includes(x.getDay()) && x.getTime() > now) return x.getTime(); } return null; }
  // monthly: the dom-th, or the month's last day when the month is shorter
  for (let k = 0; k < 14; k++) { const y = d.getFullYear(), mo = d.getMonth() + k, last = new Date(y, mo + 1, 0).getDate(); const x = new Date(y, mo, Math.min(s.dom, last), s.at.h, s.at.m, 0, 0); if (x.getTime() > now) return x.getTime(); }
  return null;
}
/** A job from a sentence → { id, text, schedule, next } | null (no schedule found — the screen asks "when?") */
export function makeJob(text, now = Date.now()) { const s = readSchedule(text); return s ? { id: "j" + now.toString(36), text: String(text).trim(), schedule: s, next: nextRun(s, now), created: now } : null; }
/** Every number in the answer must be in the data (or a count / date the question itself gave). → { ok, unknown: ["14,000"] } */
export function checkNumbers(answer, data, question = "") {
  const norm = (s) => latin(s).replace(/(\d)[,٬\s](?=\d{3}\b)/g, "$1");
  const have = new Set((norm(data + " " + question).match(/\d+(?:\.\d+)?/g) || []).map((x) => String(+x)));
  const unknown = [];
  for (const m of norm(answer).matchAll(/(?<![\w.])(\d+(?:\.\d+)?)(?![\w])/g)) { const v = String(+m[1]); if (+v <= 10 && !/\./.test(v)) continue;   // small counts ("3 big things") are fine
    if (!have.has(v) && !/^(19|20)\d{2}$/.test(v)) unknown.push(m[1]); }
  return { ok: !unknown.length, unknown: [...new Set(unknown)] };
}
/** The jobs due by now (ran after their time, not yet run for it). */
export const dueJobs = (jobs = [], now = Date.now()) => (jobs || []).filter((j) => j && j.on !== false && j.next && j.next <= now);
/** What a job may use: the person's own next days, as plain facts (the model is told to use only these). stores = lifeask.loadStores() */
export function jobData(stores = {}, now = Date.now()) {
  const DAY = 864e5, iso = (t) => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const lines = [], soon = (t, n) => t >= now - DAY / 2 && t <= now + n * DAY;
  for (const r of stores.reminders || []) { const t = +r.at || 0; if (!r.done && soon(t, 7)) lines.push("Reminder " + iso(t) + ": " + (r.title || r.text || "")); }
  for (const x of (stores.radar && stores.radar.items) || []) { const t = Date.parse((x.date || "") + "T12:00:00"); if (x.status !== "done" && soon(t, 30)) lines.push("Date " + x.date + ": " + (x.title || x.name || "") + (x.amount ? " " + x.amount : "")); }
  for (const c of (stores.life && stores.life.items) || []) if (c && c.person && (c.amount || c.total)) lines.push("Follow-up: " + c.person + " " + (c.title || c.kind || "") + " " + (c.amount || c.total) + (c.start ? " from " + c.start : ""));
  const L = stores.ledger, month = iso(now).slice(0, 7);
  if (L && L.txns) { let out = 0, inn = 0; for (const t of L.txns) if (String(t.date || "").startsWith(month)) { if (t.type === "expense") out += +t.amount || 0; if (t.type === "income") inn += +t.amount || 0; }
    lines.push("Money this month: spent " + Math.round(out) + ", received " + Math.round(inn) + (L.currency ? " " + L.currency : "")); }
  return lines.slice(0, 60).join("\n");
}
