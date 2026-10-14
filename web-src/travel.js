/* ---- v6.27 Travel — the logic behind the Calm travel page (travel-ui.jsx). Code decides; nothing here asks the model. ----------
   · costRanges / fairPrice: "is this price fair?" from the pack's own price lines ("Taxi 5km in Istanbul: 150–250 TRY") — the line
     used is always shown, and when no line matches the answer is "no price for that here", never a guess.
   · passportCheck: the passport in Deadline Radar against the trip's return date (+6 months, the strictest common rule).
   · tripFlights / tripHotels: the agent's links for this trip (agent.js), with the destination's main airport shown so a wrong one is seen.
   · tripDeadlines: the trip and its visa reminder for Deadline Radar.
   Tests: tests/unit/v727travel.test.mjs.                                                                                          */
import { flightLinks, hotelLinks } from "./agent.js";

const DAY = 86400000;
const SYM = [["S$", "SGD"], ["A$", "AUD"], ["C$", "CAD"], ["HK$", "HKD"], ["£", "GBP"], ["€", "EUR"], ["₹", "INR"], ["₩", "KRW"], ["₺", "TRY"], ["฿", "THB"], ["₫", "VND"], ["$", "USD"], ["¥", ""], ["R", "ZAR"]];
const num = (s) => { let t = String(s).replace(/\s/g, "").replace(/[.,]+$/, ""); if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, ""); else t = t.replace(",", "."); return Number(t); };

/** "Taxi 5km in Bangkok: 60–100 THB on the meter" → { label, lo, hi, cur, line }. Lines without a number are skipped. */
export function costRanges(costs, packCur = "") {
  const out = [];
  for (const line of costs || []) {
    const i = line.indexOf(":"); if (i < 0) continue;
    const label = line.slice(0, i).trim(), rest = line.slice(i + 1);
    const m = rest.match(/(S\$|A\$|C\$|HK\$|[£€₹₩₺฿₫$¥]|\bR(?=\d)|\b[A-Z]{3}(?=\s*\d))?\s*(\d[\d,.]*)\s*(?:[–-]\s*(?:S\$|A\$|C\$|HK\$|[£€₹₩₺฿₫$¥]|R)?\s*(\d[\d,.]*))?\s*([A-Z]{3}(?![a-z]))?/);
    if (!m) continue;
    const lo = num(m[2]), hi = m[3] ? num(m[3]) : lo;
    if (!isFinite(lo) || !isFinite(hi) || hi <= 0) continue;
    const sym = !m[1] ? "" : /^[A-Z]{3}$/.test(m[1]) ? m[1] : (SYM.find(([s]) => s === m[1]) || [])[1];
    out.push({ label, lo: Math.min(lo, hi), hi: Math.max(lo, hi), cur: m[4] || sym || packCur, line });
  }
  return out;
}

// the same thing said many ways (and in Arabic); a word that names one of these matches any other in its group
const CONCEPTS = [
  ["taxi", "uber", "bolt", "grab", "didi", "careem", "auto", "cab", "ride", "lyft", "تاكسي", "اوبر", "أوبر", "كريم", "مشوار"],
  ["meal", "restaurant", "lunch", "dinner", "food", "eat", "trattoria", "taverna", "warung", "hawker", "pub", "formule", "اكل", "أكل", "وجبة", "مطعم", "غدا", "غداء", "عشا", "عشاء"],
  ["coffee", "espresso", "cappuccino", "latte", "café", "cafe", "قهوة", "كافيه"],
  ["metro", "subway", "tube", "mrt", "bts", "tram", "train", "underground", "مترو", "قطر", "قطار", "ترام"],
  ["street", "snack", "shawarma", "simit", "koshari", "شاورما", "كشري"],
  ["bus", "dolmus", "dolmuş", "minibus", "اتوبيس", "باص"],
  ["beer", "drink", "بيرة"],
  ["water", "مية", "مياه", "ماء"],
];
const words = (s) => String(s || "").toLowerCase().replace(/[0-9.,:;()~–\-\/]+/g, " ").split(/\s+/).filter((w) => w.length >= 2).map((w) => w.replace(/(?<=[a-z]{3})s$/, ""));
const conceptOf = (w) => CONCEPTS.findIndex((g) => g.some((x) => x === w || (x.length > 3 && w.startsWith(x))));

/** The pack line that best matches what was asked, or null. */
export function matchCost(ranges, what) {
  const q = words(what), qc = new Set(q.map(conceptOf).filter((i) => i >= 0));
  let best = null, bestScore = 0;
  for (const r of ranges) {
    const lw = words(r.label); let score = 0;
    for (const w of q) if (w.length >= 3 && lw.includes(w)) score += 2;
    const lc = new Set(lw.map(conceptOf).filter((i) => i >= 0));
    for (const c of qc) if (lc.has(c)) score += 1;
    if (score > bestScore) { best = r; bestScore = score; }
  }
  return best;
}

/** "taxi 400" (or "taxi 400 TRY", "10 USD for a meal") → a verdict from the pack's own range.
    convert(amount, from, to) → number|null converts when the price was said in another currency. */
export function fairPrice(costs, text, { packCur = "", convert = null } = {}) {
  const t = String(text || "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
  // the price is the last number that isn't a distance, weight, time or count ("taxi 5km 120" → 120)
  const all = [...t.matchAll(/(S\$|A\$|C\$|[£€₹₩₺฿₫$¥])?\s*(\d[\d,.]*)\s*([A-Z]{3}(?![A-Za-z])|(?:usd|eur|gbp|egp|try|aed|sar|thb|jpy|inr|myr|idr|vnd)\b|جنيه|دولار|يورو|ليرة|درهم|ريال)?(?!\s*(?:km|KM|Km|kg|g\b|m\b|min|h\b|hours?|people|persons?|nights?|days?|كيلو|كم|ساع|دقي|ليل|يوم|ايام|أيام))/g)].filter((x) => x[2].replace(/[.,]+$/, ""));
  const m = all.filter((x) => x[1] || x[3]).pop() || all.pop();
  if (!m) return { status: "no-amount" };
  let amount = num(m[2]);
  if (!(amount > 0)) return { status: "no-amount" };
  const ranges = costRanges(costs, packCur);
  const what = t.replace(m[0], " ");
  const r = matchCost(ranges, what);
  if (!r) return { status: "unknown", amount };
  const word = { "جنيه": "EGP", "دولار": "USD", "يورو": "EUR", "درهم": r.cur === "MAD" ? "MAD" : "AED", "ريال": r.cur === "OMR" || r.cur === "QAR" ? r.cur : "SAR", "ليرة": r.cur === "LBP" ? "LBP" : "TRY" };
  let said = (m[1] ? (SYM.find(([s]) => s === m[1]) || [])[1] : "") || word[m[3]] || (m[3] && /^[A-Za-z]{3}$/.test(m[3]) ? m[3].toUpperCase() : "") || "";
  if (m[1] === "¥") said = r.cur;                                 // ¥ is yen or yuan — the pack's own currency decides
  let shown = amount;
  if (said && r.cur && said !== r.cur) {
    const c = convert ? convert(amount, said, r.cur) : null;
    if (!(c > 0)) return { status: "need-rate", amount, from: said, to: r.cur, line: r.line };
    amount = c;
  }
  const ratio = amount / r.hi;
  const status = amount < r.lo * 0.75 ? "low" : amount <= r.hi * 1.2 ? "fair" : amount <= r.hi * 1.6 ? "bit-high" : "high";
  return { status, amount: Math.round(amount * 100) / 100, said: said || r.cur, shown, lo: r.lo, hi: r.hi, cur: r.cur, line: r.line, label: r.label, times: Math.round(ratio * 10) / 10 };
}

/** The passport in Deadline Radar against the trip. Many countries refuse entry (and airlines refuse boarding) when the
    passport has less than 6 months left after you leave — the strictest common rule, so "ok" here is ok everywhere. */
export function passportCheck(radarItems, { ret, depart, months = 6 } = {}) {
  const pp = (radarItems || []).filter((x) => x.status !== "done" && x.kind === "expiry" && x.doc === "passport" && x.date).sort((a, b) => a.date.localeCompare(b.date));
  if (!pp.length) return { status: "none" };
  const end = ret || depart; if (!end) return { status: "no-dates", expires: pp[pp.length - 1].date };
  const exp = pp[pp.length - 1].date;                            // the newest passport if several were saved
  const need = addMonths(end, months);
  const status = exp < (depart || end) ? "expired" : exp < end ? "expires-during" : exp < need ? "short" : "ok";
  return { status, expires: exp, need, months };
}
export function addMonths(iso, n) { const d = new Date(iso + "T12:00:00"); const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, last)); return d.toISOString().slice(0, 10); }
export const daysUntil = (iso, now = Date.now()) => { const a = new Date(now); a.setHours(12, 0, 0, 0); return Math.round((Date.parse(iso + "T12:00:00") - a.getTime()) / DAY); };

/** A trip is valid only with a return on/after departure; nights are counted by code. */
export function tripShape(trip) {
  const t = trip || {}; const issues = [];
  if (!t.depart) issues.push("When do you leave?");
  if (t.depart && t.ret && t.ret < t.depart) issues.push("The return is before the departure");
  const nights = t.depart && t.ret && t.ret >= t.depart ? Math.round((Date.parse(t.ret) - Date.parse(t.depart)) / DAY) : 0;
  return { ok: !issues.length, issues, nights };
}

export function tripFlights(trip, toAirport) {
  if (!trip.from || !toAirport || !trip.depart) return [];
  return flightLinks({ from: trip.from.toUpperCase(), to: toAirport, depart: trip.depart, ret: trip.ret || "", adults: Math.max(1, trip.adults || 1), cabin: "economy" });
}
export function tripHotels(trip, city) {
  if (!city || !trip.depart || !trip.ret || trip.ret <= trip.depart) return [];
  return hotelLinks({ city, checkin: trip.depart, checkout: trip.ret, adults: Math.max(1, trip.adults || 1), rooms: 1 });
}

/** What goes to Deadline Radar for this trip: the departure, and — when a visa or e-visa is needed — a reminder 3 weeks before
    (processing times differ, so the note says to check the official portal; the day is a reminder, not a rule). */
export function tripDeadlines(trip, { country, entryStatus } = {}) {
  if (!trip || !trip.depart) return [];
  const out = [{ kind: "other", title: "Trip to " + country, date: trip.depart, note: trip.ret ? "Back " + trip.ret : "" }];
  if (/^(visa|evisa|eta)$/.test(entryStatus || "")) {
    const d = new Date(trip.depart + "T12:00:00"); d.setDate(d.getDate() - 21);
    out.push({ kind: "other", title: "Visa for " + country + " — apply", date: d.toISOString().slice(0, 10), note: "Processing times differ — check the official portal" });
  }
  return out;
}

export const TRIP_KEY = "attune:trip:v1";
export const loadTrip = () => { try { return JSON.parse(localStorage.getItem(TRIP_KEY) || "{}") || {}; } catch (e) { return {}; } };
export const saveTrip = (t) => { try { localStorage.setItem(TRIP_KEY, JSON.stringify(t)); } catch (e) {} return t; };
