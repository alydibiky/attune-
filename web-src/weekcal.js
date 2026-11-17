/* ---- v10.3 K1 week calendar (Ali, 17 Nov 2026: "I want the calendar to look very good" → picked K1, then OK-G1 G2 G3 —
   MOCKUPS.md, https://claude.ai/artifact/Pfx2JXzwa7sD5KThoBHkmB + https://claude.ai/artifact/3CUkeHy43iX4zzt9xBdwLQ).
   The week in the middle of the computer's Home: each thing at its hour (a line for now), and an "all day" lane on top for bills due,
   deliveries, renewals and trips. Filled ONLY from what Attune already keeps: the Follow-ups timeline (reminders, dates, payments
   people owe / you owe, bills, promises, errands), the payments already made this week (Money), project dates and the trip.
   Pure: no storage here (weekcal-ui.jsx reads the stores). Tests: tests/unit/v1030weekcal.test.mjs + tests/weekcal/gen.mjs.     */
const DAY = 86400000;
export const iso = (t) => { const x = new Date(t); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
const noon = (s) => Date.parse(s + "T12:00:00");
const isIso = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
export const addDays = (s, n) => iso(noon(s) + n * DAY);

/** The first day of the week that holds `now` (startDay: 0 = Sunday … 6 = Saturday). */
export function weekStartOf(now = Date.now(), startDay = 6) {
  const d = new Date(now), back = (d.getDay() - ((+startDay % 7) + 7) % 7 + 7) % 7;
  return addDays(iso(now), -back);
}

// the colour of a thing = what kind of thing it is
const MONEY = new Set(["pay", "collect", "bill", "owe", "owed", "promise", "trial", "renewal", "guardian", "txn"]);
const IN_KINDS = new Set(["collect", "owed", "promise"]);
const OUT_KINDS = new Set(["pay", "bill", "owe", "trial", "renewal"]);
// (a reminder about a person: call, visit, a birthday — in the 20 languages' common words; anything else is home & errands)
const PEOPLE_RE = /\b(call|ring|phone|visit|meet|birthday|bday|anniversary|wedding|dinner with|lunch with)\b|كلم|كلّم|اتصل|رن |زور|زيار|عيد ميلاد|عيد جواز|فرح|قابل|مقابلة|llamar|appeler|anrufen|ligar|chiamare|позвонить|\bara\b|telepon|फ़ोन|फोन|کال|تماس|cumpleaños|anniversaire|geburtstag|aniversário|compleanno|день рождения|doğum günü|ulang tahun|जन्मदिन|سالگرد|تولد/i;
export function kindOf(x) {
  const k = x && x.kind;
  if (k === "trip") return "trip";
  if (k === "project") return "work";
  if (MONEY.has(k)) return "money";
  const what = String((x && x.what) || "").replace(/[‎‏‪-‮⁦-⁩]/g, "").replace(/\s+/g, " ").replace(/[أإآ]/g, "ا");   // (as people type: direction marks, double spaces, line breaks, alef forms)
  if (k === "reminder" && PEOPLE_RE.test(what)) return "people";
  return "home";
}
export function signOf(x) {
  if (!x || !(x.amount > 0)) return "";
  if (x.kind === "txn") return x.dir === "in" ? "+" : "−";
  return IN_KINDS.has(x.kind) ? "+" : OUT_KINDS.has(x.kind) ? "−" : "";
}

/**
 * → { start, days: [7 iso dates], today: index or -1, timed: [{ id, day, h, end, col, cols, kind, what, amount, sign, cur, page, src }],
 *     allday: [{ id, d0, d1, row, kind, what, amount, sign, cur, page, src }], rows, more: [7 counts hidden past maxRows], h0, h1, count }
 * timeline: the Follow-ups list (timeline.js) — items with a `time` sit at their hour, the rest are all day.
 * txns: Money's payments ({ date, type, amount, note, created|ts }) — the ones already made this week, at the hour they happened.
 * projects: [{ id, name, date, text }]; trip: { depart, ret, to|name|country }.
 */
export function weekOf({ timeline = [], txns = [], projects = [], trip = null, now = Date.now(), start = null, startDay = 6, maxRows = 3, cur = "", gridPx = 360, minPx = 40 } = {}) {
  const s = isIso(start) ? start : weekStartOf(now, startDay), days = [0, 1, 2, 3, 4, 5, 6].map((k) => addDays(s, k)), end = days[6];
  const todayIso = iso(now), today = days.indexOf(todayIso), dayIx = (d) => days.indexOf(d);
  const timed = [], all = [], seen = new Set();
  const once = (id) => { if (!id || seen.has(id)) return false; seen.add(id); return true; };
  for (const x of timeline || []) {
    if (!x || !isIso(x.date)) continue;
    const di = dayIx(x.date); if (di < 0) continue;
    if (!once("t:" + (x.id || x.what + x.date))) continue;
    const base = { id: String(x.id || x.what + x.date), kind: kindOf(x), what: String(x.what || ""), amount: +x.amount > 0 ? +x.amount : 0, sign: signOf(x), cur: x.cur || cur, page: x.page || "", src: x };
    const t = +x.time;
    if (t > 0 && iso(t) === x.date) { const d = new Date(t); const h = d.getHours() + d.getMinutes() / 60; timed.push({ ...base, day: di, h, end: Math.min(24, h + 1) }); }
    else all.push({ ...base, d0: di, d1: di });
  }
  // what was already paid this week (and today), at the hour it was paid — never a day still to come
  for (const t of txns || []) {
    if (!t || !isIso(t.date) || t.date > todayIso || (t.type !== "expense" && t.type !== "income")) continue;
    const di = dayIx(t.date); if (di < 0 || !(+t.amount > 0)) continue;
    if (!once("m:" + (t.id || t.date + t.amount + t.note))) continue;
    const x = { kind: "txn", dir: t.type === "income" ? "in" : "out", amount: +t.amount };
    const base = { id: "m:" + (t.id || t.date + t.amount), kind: "money", what: String(t.note || "").replace(" ↻", "") || (t.type === "income" ? "Money in" : "Payment"), amount: +t.amount, sign: signOf(x), cur: t.currency || cur, page: "money", src: t };
    const at = +(t.ts || t.created || 0);
    if (at > 0 && iso(at) === t.date) { const d = new Date(at), h = d.getHours() + d.getMinutes() / 60; timed.push({ ...base, day: di, h, end: Math.min(24, h + 1) }); }
    else all.push({ ...base, d0: di, d1: di });
  }
  for (const p of projects || []) {
    if (!p || !isIso(p.date)) continue; const di = dayIx(p.date); if (di < 0) continue;
    if (!once("p:" + (p.id || p.name + p.date))) continue;
    all.push({ id: "p:" + (p.id || p.name + p.date), kind: "work", what: p.text ? p.name + " · " + p.text : p.name, amount: 0, sign: "", cur, page: "projects", src: p, d0: di, d1: di });
  }
  // a trip = one bar across its days (cut to this week)
  if (trip && isIso(trip.depart)) {
    const ret = isIso(trip.ret) && trip.ret >= trip.depart ? trip.ret : trip.depart;
    if (!(ret < s || trip.depart > end)) {
      const d0 = Math.max(0, dayIx(trip.depart < s ? s : trip.depart)), d1 = dayIx(ret > end ? end : ret);
      all.push({ id: "trip", kind: "trip", what: String(trip.to || trip.name || trip.country || "Trip"), amount: 0, sign: "", cur, page: "travel", src: trip, d0, d1: d1 < 0 ? 6 : d1, until: ret, from: trip.depart });
    }
  }
  // the all-day lane: longest first, then by day; each in the first row where it fits; rows past maxRows → "+N more" on its days
  all.sort((a, b) => (b.d1 - b.d0) - (a.d1 - a.d0) || a.d0 - b.d0 || b.amount - a.amount || a.what.localeCompare(b.what));
  const rowsUsed = [], more = [0, 0, 0, 0, 0, 0, 0], allday = [];
  for (const x of all) {
    let r = 0; while ((rowsUsed[r] || []).some((y) => !(x.d1 < y.d0 || x.d0 > y.d1))) r++;
    if (r >= maxRows) { for (let d = x.d0; d <= x.d1; d++) more[d]++; continue; }
    (rowsUsed[r] = rowsUsed[r] || []).push(x); allday.push({ ...x, row: r });
  }
  // the hours: 8:00 to 22:00, wider when something sits earlier or later
  let h0 = 8, h1 = 22;
  for (const x of timed) { h0 = Math.min(h0, Math.floor(x.h)); h1 = Math.max(h1, Math.ceil(x.end)); }
  h0 = Math.max(0, h0); h1 = Math.min(24, Math.max(h1, h0 + 6));
  // (Ali's screens, 17 Nov: a payment at 00:05 made the grid a whole day tall, and a 23:50 reminder hung under it) — the grid keeps one
  // height (gridPx) whatever hours it shows; each box is at least minPx tall and moved up so it ends inside the day (y0 → y1, hours)
  const pxh = gridPx / (h1 - h0), box = Math.max(1, minPx / pxh);
  for (const x of timed) { x.y0 = Math.max(h0, Math.min(x.h, h1 - box)); x.y1 = x.y0 + box; }
  // things that would touch on the screen sit side by side, never on top of each other
  timed.sort((a, b) => a.day - b.day || a.y0 - b.y0 || b.amount - a.amount || a.what.localeCompare(b.what));
  for (let d = 0; d < 7; d++) {
    const list = timed.filter((x) => x.day === d); let group = [], colsEnd = [], gEnd = -1;
    const close = () => { const n = colsEnd.length; for (const y of group) y.cols = n; group = []; colsEnd = []; };
    for (const x of list) {
      if (x.y0 >= gEnd) close();
      let c = colsEnd.findIndex((e) => e <= x.y0); if (c < 0) { c = colsEnd.length; colsEnd.push(0); }
      colsEnd[c] = x.y1; x.col = c; group.push(x); gEnd = Math.max(gEnd, x.y1);
    }
    close();
  }
  return { start: s, days, today, timed, allday, rows: Math.min(maxRows, rowsUsed.length), more, h0, h1, pxh, count: timed.length + all.length };
}

/** The hour a "now" line sits at on today's column (null when today isn't in this week or it's outside the shown hours). */
export function nowLine(wk, now = Date.now()) {
  if (!wk || wk.today < 0) return null;
  const d = new Date(now), h = d.getHours() + d.getMinutes() / 60;
  return h >= wk.h0 && h <= wk.h1 ? h : null;
}
