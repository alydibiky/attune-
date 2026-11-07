/* ---- v9.8 N3 Errands on autopilot (Ali, 7 Nov: "do N3 … in the best way possible … without any mistakes") — MOCKUPS.md,
   https://claude.ai/artifact/2QaqFEiB5AyWHcmugbaZfC. Your car plates, licences, meters, IDs, the cranes' inspections — added once.
   Attune knows when each is due, warns you ahead with the papers to bring, opens the official page with your details filled, reads what
   the page says is due (once you are through its login / code — Egyptian portals ask for one, so nothing is checked silently), and
   keeps the result. You always press Pay yourself. Pure; tests/unit/v980errands.test.mjs.                                       */

const DAY = 864e5;
const DIG = (s) => String(s || "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
const iso = (t) => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
export const DIGITAL_EGYPT = "https://digital.gov.eg/";

/** Every kind: what it is, how far ahead to warn, how often to look, the papers to bring (Egypt). */
export const KINDS = {
  carLicence: { en: "Car licence", ar: "رخصة العربية", lead: 30, papers: { en: ["Old car licence", "National ID", "Traffic fines clearance", "Technical inspection", "Compulsory insurance"], ar: ["رخصة العربية القديمة", "البطاقة", "مخالصة المخالفات", "الفحص الفني", "التأمين الإجباري"] } },
  driving: { en: "Driving licence", ar: "رخصة القيادة", lead: 30, papers: { en: ["Old driving licence", "National ID", "Eye test", "2 photos"], ar: ["رخصة القيادة القديمة", "البطاقة", "كشف نظر", "صورتين"] } },
  fines: { en: "Traffic fines", ar: "مخالفات المرور", every: 1, papers: { en: ["Car plate number", "National ID"], ar: ["رقم اللوحة", "البطاقة"] } },
  bill: { en: "Bill", ar: "فاتورة", every: 1, papers: { en: ["Meter / account number"], ar: ["رقم العداد / الحساب"] } },
  passport: { en: "Passport", ar: "جواز السفر", lead: 180, papers: { en: ["Old passport", "National ID", "4 photos"], ar: ["الجواز القديم", "البطاقة", "٤ صور"] } },
  nationalId: { en: "National ID", ar: "البطاقة", lead: 60, papers: { en: ["Old ID", "Proof of job / address"], ar: ["البطاقة القديمة", "إثبات المهنة / العنوان"] } },
  inspection: { en: "Inspection", ar: "فحص / تفتيش", lead: 21, papers: { en: ["Last inspection certificate", "Load test report", "Operator licence"], ar: ["شهادة الفحص السابقة", "تقرير اختبار التحميل", "رخصة المشغل"] } },
  other: { en: "Errand", ar: "مشوار", lead: 14, papers: { en: [], ar: [] } },
};

const MON = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|يناير|فبراير|مارس|ابريل|أبريل|مايو|يونيو|يوليو|اغسطس|أغسطس|سبتمبر|اكتوبر|أكتوبر|نوفمبر|ديسمبر";
const MON_I = (w) => { const k = w.toLowerCase(); const en = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].findIndex((m) => k.startsWith(m)); if (en >= 0) return en;
  return ["يناير", "فبراير", "مارس", "ابريل", "مايو", "يونيو", "يوليو", "اغسطس", "سبتمبر", "اكتوبر", "نوفمبر", "ديسمبر"].indexOf(k.replace(/^أ/, "ا")); };
/** "3 Feb 2027", "Feb 3, 2027", "2027-02-03", "3/2/2027", «٣ فبراير ٢٠٢٧» → ms (noon) or 0. */
export function dateIn(text, now = Date.now()) {
  const t = DIG(text);
  let m = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t); if (m) return new Date(+m[1], +m[2] - 1, +m[3], 12).getTime();
  m = /\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/.exec(t); if (m) return new Date(+m[3], +m[2] - 1, +m[1], 12).getTime();   // day first (Egypt)
  m = new RegExp("(\\d{1,2})\\s*(" + MON + ")\\s*,?\\s*(\\d{4})?", "i").exec(t) || null;
  if (m) { const y = m[3] ? +m[3] : new Date(now).getFullYear(); let d = new Date(y, MON_I(m[2]), +m[1], 12); if (!m[3] && d.getTime() < now) d = new Date(y + 1, MON_I(m[2]), +m[1], 12); return d.getTime(); }
  m = new RegExp("(" + MON + ")\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s*,?\\s*(\\d{4})?", "i").exec(t);
  if (m) { const y = m[3] ? +m[3] : new Date(now).getFullYear(); let d = new Date(y, MON_I(m[1]), +m[2], 12); if (!m[3] && d.getTime() < now) d = new Date(y + 1, MON_I(m[1]), +m[2], 12); return d.getTime(); }
  return 0;
}
// an Egyptian plate: «أ ب ج ١٢٣٤» / "ABC 1234"
const PLATE = /([ء-ي](?:\s*[ء-ي]){1,2})\s*(\d{1,4})|\b([A-Z]{2,3})\s*-?\s*(\d{1,4})\b/;
const KIND_WORDS = [
  ["carLicence", /car licen[cs]e|vehicle licen[cs]e|car registration|رخصة العربية|رخصة العربيه|رخصه العربيه|رخصة السيارة|ترخيص العربية/i],
  ["driving", /driving licen[cs]e|driver'?s licen[cs]e|رخصة القيادة|رخصة السواقة|رخصه السواقه|رخصتي/i],
  ["fines", /traffic fines?|tickets?|violations?|مخالفات|مخالفة المرور/i],
  ["bill", /electricity|water bill|gas bill|meter|internet bill|landline|كهربا|الكهرباء|عداد|المية|المياه|الغاز|التليفون الأرضي/i],
  ["passport", /passport|جواز|الباسبور|باسبور/i],
  ["nationalId", /national id|id card|البطاقة|بطاقة الرقم القومي/i],
  ["inspection", /inspection|load test|certificate|فحص|تفتيش|شهادة/i],
];
/** "my car licence expires 3 Feb 2027, plate أ ب ج 1234" → an errand (or null). */
export function parseErrand(text, now = Date.now()) {
  const t = String(text || "").trim(); if (!t) return null;
  const k = (KIND_WORDS.find(([, re]) => re.test(t)) || [])[0]; if (!k) return null;
  const date = dateIn(t, now), p = PLATE.exec(DIG(t)), every = /every\s+(\d{1,2})\s*months?|كل\s*(\d{1,2})\s*(?:شهور|اشهر|أشهر|شهر)/i.exec(DIG(t));
  const ref = p ? (p[1] ? p[1].replace(/\s+/g, " ") + " " + p[2] : p[3] + " " + p[4]) : (/(?:meter|account|number|رقم(?: العداد| الحساب)?)\s*[:#]?\s*(\d{4,})/i.exec(DIG(t)) || [])[1] || "";
  const label = k === "inspection" ? (t.match(/\b(LTM|GMK|AC|ATF|QY|STC|XCT|SAC|ZTC)\s?\d{2,4}\b/i) || [""])[0] || "" : k === "bill" ? (/(electricity|water|gas|internet|landline|كهربا|الكهرباء|المية|المياه|الغاز)/i.exec(t) || [""])[0] : "";
  return { kind: k, label, ref, date: date ? iso(date) : "", every: every ? +(every[1] || every[2]) : KINDS[k].every || 0 };
}
export function makeErrand(e, now = Date.now()) {
  return { id: "er" + now.toString(36) + Math.floor(Math.random() * 1e3).toString(36), kind: e.kind, label: e.label || "", ref: e.ref || "", date: e.date || "", every: e.every || 0,
    url: e.url || DIGITAL_EGYPT, lastCheck: 0, last: null, created: now, done: [] };
}
const nextMonthly = (from, every, now) => { let d = new Date(from); d.setHours(12, 0, 0, 0); while (d.getTime() < now - DAY) d.setMonth(d.getMonth() + (every || 1)); return d.getTime(); };
/** What needs you, soonest first: { e, why: "expires"|"check"|"due"|"late", date (ms), days } — only inside each kind's warning time. */
export function dueList(list = [], now = Date.now()) {
  const out = [], noon = (() => { const x = new Date(now); x.setHours(12, 0, 0, 0); return x.getTime(); })(), daysTo = (d) => Math.round((d - noon) / DAY);   // whole calendar days
  for (const e of list) {
    const K = KINDS[e.kind] || KINDS.other;
    if (e.last && e.last.amount > 0 && !e.last.paid) { out.push({ e, why: "due", date: e.last.at || now, days: 0, amount: e.last.amount }); continue; }
    if (e.date && !e.every) { const d = Date.parse(e.date + "T12:00:00"), days = daysTo(d);
      if (days <= (K.lead || 14)) out.push({ e, why: days < 0 ? "late" : "expires", date: d, days }); continue; }
    if (e.every) { const base = e.lastCheck || (e.date ? Date.parse(e.date + "T12:00:00") : e.created || now);
      const next = e.lastCheck ? (() => { const d = new Date(e.lastCheck); d.setMonth(d.getMonth() + e.every); return d.getTime(); })() : nextMonthly(base, e.every, now);
      const days = daysTo(next); if (days <= (e.kind === "inspection" ? K.lead : 3)) out.push({ e, why: e.kind === "inspection" ? (days < 0 ? "late" : "expires") : "check", date: next, days }); }
  }
  const rank = { due: 0, late: 1, expires: 2, check: 3 };
  return out.sort((a, b) => rank[a.why] - rank[b.why] || a.date - b.date);
}
/** What an official page says, read after you opened it (Attune's browser): { amount, count, none } — or null when it says nothing clear. */
export function readPortal(text) {
  const t = DIG(text).replace(/(\d),(\d{3})/g, "$1$2");
  if (/لا توجد مخالفات|لا يوجد مخالفات|مفيش مخالفات|no (?:traffic )?(?:fines|violations)|no outstanding|nothing due|لا توجد مستحقات|لا توجد فواتير/i.test(t)) return { amount: 0, count: 0, none: true };
  const tot = /(?:total|amount due|outstanding|إجمالي|اجمالي|المبلغ المستحق|قيمة المخالفات|المستحق|قيمة الفاتورة)[^\d]{0,30}(\d+(?:\.\d+)?)/i.exec(t);
  const cnt = /(\d+)\s*(?:violations?|fines?|مخالفة|مخالفات)/i.exec(t);
  if (!tot && !cnt) return null;
  return { amount: tot ? Math.round(+tot[1] * 100) / 100 : 0, count: cnt ? +cnt[1] : 0, none: false };
}
/** After a look at the page: keep what it said; a monthly check moves on; nothing due → nothing to show. */
export function afterCheck(e, read, now = Date.now()) {
  return { ...e, lastCheck: now, last: read ? { at: now, amount: read.amount || 0, count: read.count || 0, none: !!read.none, paid: !!read.none } : e.last };
}
/** Renewed / paid: an expiry moves on by its period (a licence: you type the new date), a payment is marked paid. */
export function markDone(e, { newDate = "", now = Date.now() } = {}) {
  return { ...e, ...(newDate ? { date: newDate } : {}), last: e.last ? { ...e.last, paid: true } : e.last, done: [...(e.done || []), { at: now, date: e.date }].slice(-20) };
}
export const nameOf = (e, ar = false, t = (x) => x) => { const K = KINDS[e.kind] || KINDS.other; return [ar ? K.ar : t(K.en), e.label, e.ref].filter(Boolean).join(" · "); };
export const ER_KEY = "attune:errands:v1";
export function loadErrands() { try { const v = JSON.parse(localStorage.getItem(ER_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
export function saveErrands(l) { try { localStorage.setItem(ER_KEY, JSON.stringify(l)); window.dispatchEvent(new Event("attune:errands")); } catch (e) {} return l; }
