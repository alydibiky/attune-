/* ---- v6.38 (upgrade H3) — Ask your life with charts. "How did my food spending change since Ramadan?" → a month-by-month
   chart from your own Money records and one sentence: the monthly average before, the monthly average since, and the change.
   Code only, every number exact (sums of your entries; months are calendar months; "a month" = 30 days of spending).
   Pure; tests/unit/v740lifecharts.test.mjs. Also used for the charts under the food, lab and sugar answers.          */
import { catAsked } from "./myledger.js";
import { homeCurrency } from "./locale.js";

const DAY = 86400000;
const AR_D = "٠١٢٣٤٥٦٧٨٩";
const latin = (s) => String(s || "").replace(/[٠-٩]/g, (d) => String(AR_D.indexOf(d)));
const iso = (t) => { const x = new Date(t); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
const at12 = (s) => Date.parse(s + "T12:00:00");
const num = (v) => Math.round(v).toLocaleString("en-US");

// The first day of Ramadan (Egypt's announcements; ±1 day) and of Eid al-Fitr / al-Adha
const RAMADAN = { 2024: "2024-03-11", 2025: "2025-03-01", 2026: "2026-02-18", 2027: "2027-02-08", 2028: "2028-01-28" };
const FITR = { 2024: "2024-04-10", 2025: "2025-03-30", 2026: "2026-03-20", 2027: "2027-03-10", 2028: "2028-02-27" };
const ADHA = { 2024: "2024-06-16", 2025: "2025-06-06", 2026: "2026-05-27", 2027: "2027-05-16", 2028: "2028-05-05" };
const MONTHS = [["january", "يناير"], ["february", "فبراير"], ["march", "مارس"], ["april", "ابريل|أبريل"], ["may", "مايو"], ["june", "يونيو"], ["july", "يوليو"], ["august", "اغسطس|أغسطس"], ["september", "سبتمبر"], ["october", "اكتوبر|أكتوبر"], ["november", "نوفمبر"], ["december", "ديسمبر"]];
const MON_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MON_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

export const TREND = /\b(chang\w*|since|over time|trend|by month|each month|per month|month by month|monthly|compare\w*|went up|went down|increas\w*|decreas\w*)\b|اتغير|اتغيرت|تغير|من ساعة|من ساعه|من وقت|من بعد|من اول|من أول|مقارن|قارن|كل شهر|شهر بشهر|زاد|زادت|قل|قلت/i;

/** The latest past date for an event or month named in the question → { date, label: [en, ar] } | null. */
export function sinceOf(q, now = Date.now()) {
  const t = latin(q).toLowerCase(), today = iso(now);
  const last = (table) => Object.values(table).filter((d) => d <= today).sort().pop();
  if (/ramadan|رمضان/.test(t)) { const d = last(RAMADAN); return d ? { date: d, label: ["Ramadan", "رمضان"] } : null; }
  if (/eid al.?adha|adha|الاضحى|الأضحى|العيد الكبير/.test(t)) { const d = last(ADHA); return d ? { date: d, label: ["Eid al-Adha", "العيد الكبير"] } : null; }
  if (/\beid\b|العيد/.test(t)) { const d = [last(FITR), last(ADHA)].filter(Boolean).sort().pop(); return d ? { date: d, label: ["the Eid", "العيد"] } : null; }
  const n = new Date(now);
  for (let m = 0; m < 12; m++) {
    const [en, ar] = MONTHS[m];
    if (new RegExp("\\b" + en + "\\b").test(t) || new RegExp("(?:^|\\s|من|ل)(?:" + ar + ")").test(t)) {
      let y = n.getFullYear(); if (m > n.getMonth()) y--;
      const y4 = /\b(20\d\d)\b/.exec(t); if (y4) y = +y4[1];
      return { date: `${y}-${String(m + 1).padStart(2, "0")}-01`, label: [en[0].toUpperCase() + en.slice(1), MON_AR[m]] };
    }
  }
  return null;
}

/** Money spent (or earned) per calendar month, main currency only. → [{ key: "2026-03", label, labelAr, value }] */
export function monthly(ledger, { cat = "", type = "expense", from, to } = {}) {
  const L = ledger || {}, cur = homeCurrency(L);
  const curOf = (id) => { const a = (L.accounts || []).find((x) => x.id === id); return (a && a.currency) || cur; };
  const by = {};
  for (const t of L.txns || []) {
    if (t.type !== type || !t.date || t.date < from || t.date > to || curOf(t.account) !== cur) continue;
    if (cat && (t.cat || "other") !== cat) continue;
    const k = t.date.slice(0, 7); by[k] = (by[k] || 0) + (+t.amount || 0);
  }
  const out = [];
  for (let d = new Date(at12(from.slice(0, 7) + "-01")); iso(d) <= to; d = new Date(d.getFullYear(), d.getMonth() + 1, 1, 12)) {
    const k = iso(d).slice(0, 7);
    out.push({ key: k, label: MON_SHORT[d.getMonth()], labelAr: MON_AR[d.getMonth()], value: Math.round((by[k] || 0) * 100) / 100 });
  }
  return { cur, points: out };
}
const sumBetween = (ledger, cat, type, from, to) => monthly(ledger, { cat, type, from, to }).points.reduce((a, p) => a + p.value, 0);

/** The answer to a money trend question, or null when it isn't one. Same shape as askLife's answers, plus `chart`. */
export function moneyTrend(q, ledger, now = Date.now()) {
  if (!TREND.test(q) || !ledger || !(ledger.txns || []).length) return null;
  const cat = catAsked(q), income = /\b(income|earn\w*|salary)\b|دخل|قبضت|مرتب|راتب/i.test(q) && !/spen|صرف|مصاريف/i.test(q);
  const type = income ? "income" : "expense", today = iso(now), since = sinceOf(q, now);
  const name = cat ? cat : income ? "income" : "spending";
  const CAT_AR = { food: "الأكل", groceries: "البقالة", transport: "المواصلات", bills: "الفواتير", rent: "الإيجار", shopping: "التسوق", health: "الصحة", fun: "الخروج", coffee: "القهوة", gifts: "الهدايا", other: "حاجات تانية" };
  const nameAr = cat ? CAT_AR[cat] || cat : income ? "الدخل" : "المصاريف";
  const what = [cat ? cat[0].toUpperCase() + cat.slice(1) + " spending" : income ? "Income" : "Spending", (cat ? "مصاريف " + nameAr : nameAr)];
  let from, sentence;
  if (since) {
    // whole calendar months: before = the months before the one it started in (from your first entry, up to 12);
    // since = the months after it, up to last month (the month it started in and this month are partial)
    const first = (ledger.txns || []).map((t) => t.date).filter(Boolean).sort()[0] || since.date;
    const n0 = new Date(at12(since.date)), bStart = iso(new Date(n0.getFullYear(), n0.getMonth() - 12, 1, 12));
    from = first > bStart ? first.slice(0, 7) + "-01" : bStart;
    const all = monthly(ledger, { cat, type, from, to: today }).points, sm = since.date.slice(0, 7), cm = today.slice(0, 7);
    const avg = (l) => (l.length ? l.reduce((a, p) => a + p.value, 0) / l.length : null);
    let before = avg(all.filter((p) => p.key < sm)), after = avg(all.filter((p) => p.key > sm && p.key < cm));
    if (after == null) {   // it started this month or last: the days since, as 30-day spending
      const days = Math.max(1, Math.round((at12(today) - at12(since.date)) / DAY) + 1);
      after = sumBetween(ledger, cat, type, since.date, today) / (days / 30);
    }
    const pct = before > 0 ? Math.round(((after - before) / before) * 100) : null;
    const cur = homeCurrency(ledger);
    sentence = {
      en: `${what[0]}: about ${num(before || 0)} ${cur} a month before ${since.label[0]}, ${num(after)} ${cur} a month since${pct == null ? "" : ` (${pct > 0 ? "+" : ""}${pct}%)`}.`,
      ar: `${what[1]}: حوالي ${num(before || 0)} ${cur} في الشهر قبل ${since.label[1]}، و${num(after)} ${cur} في الشهر من ساعتها${pct == null ? "" : ` (${pct > 0 ? "+" : ""}${pct}%)`}.`,
      pct, before: Math.round(before || 0), after: Math.round(after) };
  } else {
    const n = new Date(now); from = iso(new Date(n.getFullYear(), n.getMonth() - 5, 1, 12));
  }
  const m = monthly(ledger, { cat, type, from, to: today });
  if (!m.points.some((p) => p.value > 0)) return { kind: "money-trend", en: `No ${name} entries in Money for this time.`, ar: `مفيش ${nameAr} متسجلة في الفلوس في الوقت ده.`, open: "money", sources: ["money"] };
  if (!sentence) {
    const full = m.points.slice(0, -1).filter((p) => p.value > 0), lastFull = full[full.length - 1], prev = full[full.length - 2];
    const pct = lastFull && prev && prev.value > 0 ? Math.round(((lastFull.value - prev.value) / prev.value) * 100) : null;
    const avg = full.length ? full.reduce((a, p) => a + p.value, 0) / full.length : 0;
    sentence = { en: `${what[0]} by month: about ${num(avg)} ${m.cur} a month${lastFull ? `; ${lastFull.label} ${num(lastFull.value)}` : ""}${pct == null ? "" : ` (${pct > 0 ? "+" : ""}${pct}% on ${prev.label})`}.`,
      ar: `${what[1]} شهر بشهر: حوالي ${num(avg)} ${m.cur} في الشهر${lastFull ? `؛ ${lastFull.labelAr} ${num(lastFull.value)}` : ""}${pct == null ? "" : ` (${pct > 0 ? "+" : ""}${pct}% عن ${prev.labelAr})`}.` };
  }
  return { kind: "money-trend", en: sentence.en, ar: sentence.ar, pct: sentence.pct, before: sentence.before, after: sentence.after,
    rows: m.points.map((p) => [p.key, `${num(p.value)} ${m.cur}`]),
    chart: { type: "bar", unit: m.cur, mark: since ? since.date.slice(0, 7) : null, markLabel: since ? since.label : null, points: m.points.map((p) => ({ label: p.label, labelAr: p.labelAr, key: p.key, value: p.value })) },
    open: "money", sources: ["money"] };
}

/** rows [[date, "123 unit …"]] → a chart of the first number (lab results, sugar, food). */
export function chartOfRows(rows, type = "line", unit = "") {
  const points = (rows || []).map(([k, v]) => ({ label: String(k).slice(5, 10), key: String(k), value: parseFloat(String(v).replace(/,/g, "")) })).filter((p) => Number.isFinite(p.value));
  return points.length >= 2 ? { type, unit, points } : null;
}
