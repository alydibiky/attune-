/* ---- v9.9.22 batch B5 (people), the logic. Ali picked N3-A (a small "a year ago today" card on Home), P1-A (Keep in touch: a list with
   how long since), P3 combined (Occasions page + the card on the day with a wish). Pure; tests: tests/b5/gen.mjs (10,000 each) +
   tests/unit/v9922b5.test.mjs.
   N3 onThisDay: only the person's own records (Mind notes / payments in Money), only the SAME calendar day in an earlier year, never a
      deleted or trashed one; the nearest year first, then the bigger amount.
   P1 keepInTouch: each person has "every N days"; the last REAL contact (a call that was answered, a chat either way) resets it — a
      missed call never does; due when the days since ≥ N; one nudge a day at most.
   P3 occasions: birthdays / anniversaries by month-day; the next one on or after today; 29 Feb → 28 Feb in a year without it; the age
      (or the years married) only when the first year is known; the wish in the person's own language.                          */
const DAY = 864e5;
const mid = (t) => { const d = new Date(t); d.setHours(12, 0, 0, 0); return d.getTime(); };
const iso = (t) => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const ymd = (s) => { const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return { y, m, d }; };
const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
export const daysBetween = (a, b) => Math.round((mid(b) - mid(a)) / DAY);

/** N3: one thing from this calendar day in an earlier year. records: Mind [{ id, ts, title, kind, meta }]; txns: Money [{ id, date, amount, note, type }]. */
export function onThisDay({ records = [], txns = [] } = {}, now = Date.now()) {
  const d = new Date(now), m = d.getMonth() + 1, dd = d.getDate(), y = d.getFullYear(), out = [];
  for (const r of records || []) { if (!r || !r.ts || (r.meta && (r.meta.trashed || r.meta.deleted || r.meta.todo)) || r.deleted || r.kind === "where") continue;
    const x = new Date(r.ts); if (x.getMonth() + 1 === m && x.getDate() === dd && x.getFullYear() < y) out.push({ src: "mind", id: r.id, title: r.title || r.text || "", date: iso(r.ts), years: y - x.getFullYear(), amount: 0 }); }
  for (const t of txns || []) { if (!t || !t.date || t.deleted || !(t.amount > 0)) continue; const p = ymd(t.date);
    if (p.m === m && p.d === dd && p.y < y) out.push({ src: "money", id: t.id, title: t.note || t.cat || "", date: t.date.slice(0, 10), years: y - p.y, amount: +t.amount, type: t.type }); }
  out.sort((a, b) => a.years - b.years || b.amount - a.amount || String(a.id).localeCompare(String(b.id)));
  return out[0] || null;
}

/** P1: people [{ id, name, every (days) }], events [{ who (id), at (ms), kind: "call" | "missed" | "chat" | "visit" }] →
 *  [{ id, name, every, last (ms|null), since (days|null), due }] — the most overdue first. */
export function keepInTouch(people = [], events = [], now = Date.now()) {
  const last = {};
  for (const e of events || []) { if (!e || !e.who || !(e.at > 0) || e.at > now || e.kind === "missed") continue; if (!last[e.who] || e.at > last[e.who]) last[e.who] = e.at; }
  return (people || []).filter((p) => p && p.id && p.every > 0).map((p) => { const l = last[p.id] || p.since || null, since = l ? daysBetween(l, now) : null;
    return { id: p.id, name: p.name, every: p.every, last: l, since, due: since == null ? true : since >= p.every, over: since == null ? 1e6 : since - p.every }; })
    .sort((a, b) => b.over - a.over || String(a.name).localeCompare(String(b.name)));
}
/** P1: the one nudge for today (null when one was already shown today or nobody is due). */
export function nudgeToday(list, shownOn = "", now = Date.now()) { if (shownOn === iso(now)) return null; return (list || []).find((x) => x.due) || null; }

/** P3: dates [{ id, who, kind: "birthday" | "anniversary" | "other", md: "MM-DD", year?: 1990 }] → [{ ..., next: "YYYY-MM-DD", inDays, turns }] sorted. */
export function occasions(dates = [], now = Date.now()) {
  const today = mid(now), y = new Date(now).getFullYear();
  const on = (yr, mo, da) => { if (mo === 2 && da === 29 && !isLeap(yr)) da = 28; return mid(new Date(yr, mo - 1, da).getTime()); };
  return (dates || []).filter((x) => x && /^\d{2}-\d{2}$/.test(x.md || "")).map((x) => { const [mo, da] = x.md.split("-").map(Number);
    let t = on(y, mo, da), yr = y; if (t < today) { yr = y + 1; t = on(yr, mo, da); }
    return { ...x, next: iso(t), inDays: daysBetween(today, t), turns: x.year > 1000 && x.year <= yr ? yr - x.year : null }; })
    .sort((a, b) => a.inDays - b.inDays || String(a.who).localeCompare(String(b.who)));
}
// a short wish in the person's language (their own language when the card says it, else the app's)
const WISH = { en: "Happy birthday {n}! Wishing you a wonderful year 🌸", ar: "كل سنة وانت طيب يا {n}، ربنا يسعدك 🌸", arb: "كل عام وأنت بخير يا {n}، أسعدك الله 🌸",
  es: "¡Feliz cumpleaños, {n}! Que tengas un año maravilloso 🌸", fr: "Joyeux anniversaire {n} ! Je te souhaite une belle année 🌸", de: "Alles Gute zum Geburtstag, {n}! Ein wunderbares Jahr 🌸",
  pt: "Feliz aniversário, {n}! Que seu ano seja maravilhoso 🌸", it: "Buon compleanno {n}! Ti auguro un anno meraviglioso 🌸", ru: "С днём рождения, {n}! Пусть год будет чудесным 🌸",
  tr: "İyi ki doğdun {n}! Harika bir yıl dilerim 🌸", id: "Selamat ulang tahun, {n}! Semoga tahunmu luar biasa 🌸", hi: "जन्मदिन मुबारक हो {n}! आपका साल शानदार हो 🌸",
  ur: "سالگرہ مبارک {n}! آپ کا سال شاندار ہو 🌸", fa: "تولدت مبارک {n}! سال فوق‌العاده‌ای داشته باشی 🌸", bn: "শুভ জন্মদিন {n}! তোমার বছরটা দারুণ কাটুক 🌸",
  sw: "Heri ya siku ya kuzaliwa {n}! Uwe na mwaka mzuri 🌸", th: "สุขสันต์วันเกิดนะ {n} ขอให้ปีนี้เป็นปีที่ดี 🌸", vi: "Chúc mừng sinh nhật {n}! Chúc một năm thật tuyệt 🌸",
  zh: "{n}，生日快乐！祝你新的一年一切美好 🌸", ja: "{n}、誕生日おめでとう！素敵な一年になりますように 🌸", ko: "{n}, 생일 축하해! 멋진 한 해 되길 🌸" };
const ANNIV = { en: "Happy anniversary {n}! 🌸", ar: "كل سنة وانتوا طيبين يا {n} 🌸", arb: "كل عام وأنتما بخير يا {n} 🌸" };
export function wishFor(o, lang = "en") { const L = WISH[lang] ? lang : "en"; const t = o.kind === "anniversary" ? ANNIV[L] || ANNIV.en : WISH[L]; return t.replace("{n}", String(o.who || "").split(" ")[0]); }
