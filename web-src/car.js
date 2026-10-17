/* ---- v6.32: car manager — fuel, service, licence, insurance (roadmap "Car manager") ---------------------------------------
   Type it the way you'd say it: "fuel 600, 40 L at 45,200 km" · «بنزين ٥٠٠ ج ٢٧ لتر العداد ٤٥٢٠٠» · "oil change 1,500 at 45,000 km" ·
   «غيرت الزيت ب ١٥٠٠ على ٤٥ ألف» · "tyres 8,000" · «الرخصة بتخلص 1/3/2027» (dates go to the Deadline Radar, which already warns
   before a licence or insurance ends). Code works out: litres per 100 km, cost per km, fuel per month, and when each service is
   next due (by km or by months, whichever comes first). Pure; tests: tests/unit/v736car.test.mjs.                              */
import { normDigits } from "./yusr/logtext.js";
import { readDeadlines } from "./deadlines.js";

// service → [words, every km, every months]
export const SERVICES = {
  oil: [/\boil(?: change)?\b|زيت|الزيت|aceite|vidange|óleo|ölwechsel|yağ değişimi|ganti oli/i, 10000, 12],
  filter: [/\b(?:air |oil )?filters?\b|فلتر|فلاتر|filtro|filtre/i, 15000, 12],
  tyres: [/\btyres?\b|\btires?\b|كاوتش|كاوتشات|اطارات|إطارات|neumáticos|pneus|reifen|lastik|\bban\b/i, 40000, 48],
  brakes: [/\bbrakes?\b|(?:brake )?pads\b|فرامل|تيل|frenos|freins|bremsen|fren/i, 30000, 24],
  battery: [/\bbattery\b|بطاريه|بطارية|batería|batterie|bateria|akü|aki/i, 0, 36],
  service: [/\b(?:service|maintenance|servicing)\b|صيانه|صيانة|عمرة|عمره|mantenimiento|entretien|revisão|inspektion|bakım|servis/i, 15000, 12],
  wash: [/\b(?:car )?wash\b|غسيل|lavado|lavage|lavagem|wäsche|yıkama|cuci/i, 0, 0],
};
const FUEL = /\b(?:fuel|petrol|gas(?:oline)?|diesel|benzine?|filled up|fill(?:ed)? up)\b|بنزين|سولار|بانزين|موّنت|مونت|gasolina|essence|benzin|bensin/i;
const r1 = (x) => Math.round(x * 10) / 10, r2 = (x) => Math.round(x * 100) / 100;
const numOf = (s) => +String(s).replace(/,/g, "");

/** One sentence → { kind: "fuel"|"service"|"km"|"deadline", amount, liters, km, service, deadline } or null. */
export function parseCar(text, { today = new Date().toISOString().slice(0, 10), now = Date.now() } = {}) {
  const raw = String(text || "").trim(); if (!raw) return null;
  const t = normDigits(raw).replace(/(\d)\s*(?:ألف|الف|k)\b/gi, (m, d) => d + "000").replace(/(\d+)\s*(?:ألف|الف)/g, (m, d) => d + "000");
  // licence / insurance / registration with a date → the Deadline Radar
  if (/licen[cs]e|insurance|registration|رخص|تامين|تأمين|ترخيص|seguro|assurance|versicherung|sigorta|asuransi/i.test(t)) {
    const d = readDeadlines(raw, { now });
    if (d.length) return { kind: "deadline", deadline: { ...d[0], car: true }, date: today };
  }
  const km = (/(?:at|@|odometer|العداد|عداد|على|علي|a los|à|bei|em)\s*(\d[\d,]{2,})\s*(?:km|كم|كيلو)?/i.exec(t) || /(\d[\d,]{3,})\s*(?:km|كم)(?![\p{L}])/iu.exec(t) || [])[1];
  const liters = (/(\d+(?:\.\d+)?)\s*(?:l|lt|litres?|liters?|لتر|litros?|litres?)(?![\p{L}])/iu.exec(t) || [])[1];
  // the money: the numbers that are not the km or the litres (the first one left)
  const used = [km, liters].filter(Boolean).map(String);
  const nums = [...t.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => m[0]).filter((n) => !used.includes(n) && !/^\d{4}-/.test(n));
  const amount = nums.length ? numOf(nums[0]) : 0;
  const kmN = km ? numOf(km) : 0;
  if (FUEL.test(t)) return amount || liters ? { kind: "fuel", amount, liters: liters ? +liters : 0, km: kmN, date: today } : null;
  for (const [k, [re]] of Object.entries(SERVICES)) if (re.test(t)) return { kind: "service", service: k, amount, km: kmN, date: today, note: raw };
  if (kmN && /odometer|العداد|عداد|\bkm\b|كم/i.test(t) && !amount) return { kind: "km", km: kmN, date: today };
  return null;
}

/** The numbers: fuel per 100 km, cost per km, fuel per month, odometer now, and each service's next time. */
export function carStats(car, now = Date.now()) {
  const log = [...((car && car.log) || [])].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.km || 0) - (b.km || 0)));
  const fuel = log.filter((x) => x.kind === "fuel");
  const kmNow = Math.max(car && car.km || 0, ...log.map((x) => x.km || 0));
  // litres per 100 km: between the first and last fill that have km, the litres of every fill after the first
  const fk = fuel.filter((x) => x.km);
  let per100 = null, costKm = null;
  if (fk.length >= 2) {
    const dist = fk[fk.length - 1].km - fk[0].km, lit = fk.slice(1).reduce((a, x) => a + (x.liters || 0), 0), money = fk.slice(1).reduce((a, x) => a + (x.amount || 0), 0);
    if (dist > 0 && lit > 0) per100 = r1((lit / dist) * 100);
    if (dist > 0 && money > 0) costKm = r2(money / dist);
  }
  const month = new Date(now).toISOString().slice(0, 7);
  const fuelMonth = fuel.filter((x) => x.date.startsWith(month)).reduce((a, x) => a + (x.amount || 0), 0);
  const spent = log.reduce((a, x) => a + (x.amount || 0), 0);
  const next = [];
  for (const [k, [, everyKm, everyMo]] of Object.entries(SERVICES)) {
    const last = [...log].reverse().find((x) => x.kind === "service" && x.service === k);
    if (!last || (!everyKm && !everyMo)) continue;
    const dueKm = everyKm && last.km ? last.km + everyKm : null;
    const d = new Date(last.date + "T12:00:00"); d.setMonth(d.getMonth() + everyMo);
    const dueDate = everyMo ? d.toISOString().slice(0, 10) : null;
    const kmLeft = dueKm && kmNow ? dueKm - kmNow : null, daysLeft = dueDate ? Math.round((Date.parse(dueDate + "T12:00:00") - now) / 86400000) : null;
    next.push({ service: k, dueKm, dueDate, kmLeft, daysLeft, due: (kmLeft != null && kmLeft <= 500) || (daysLeft != null && daysLeft <= 14) });
  }
  next.sort((a, b) => Number(b.due) - Number(a.due) || (a.kmLeft ?? 1e9) - (b.kmLeft ?? 1e9));
  return { kmNow, per100, costKm, fuelMonth, spent, next, fills: fuel.length };
}

// ---- storage -------------------------------------------------------------------------------------------------------------------
const KEY = "attune:car:v1";
export function loadCar(ls = typeof localStorage !== "undefined" ? localStorage : null) { try { const j = JSON.parse((ls && ls.getItem(KEY)) || "null"); if (j && Array.isArray(j.log)) return j; } catch (e) {} return { name: "", km: 0, log: [] }; }
export function saveCar(d, ls = typeof localStorage !== "undefined" ? localStorage : null) { try { ls && ls.setItem(KEY, JSON.stringify(d)); } catch (e) {} return d; }
export function addCarEntry(car, e, now = Date.now()) {
  if (!e || e.kind === "deadline") return car;
  return { ...car, km: Math.max(car.km || 0, e.km || 0), log: [...car.log, { ...e, id: "k" + now.toString(36) + Math.random().toString(36).slice(2, 5) }].slice(-1000) };
}
/** The sentence Money reads for a fuel or service payment (confirmed there, as every payment is). */
export function carMoneyText(e) {
  if (!e || !e.amount) return "";
  return e.kind === "fuel" ? `Fuel ${e.amount}` + (e.liters ? ` (${e.liters} L)` : "") : `Car ${e.service} ${e.amount}`;
}
