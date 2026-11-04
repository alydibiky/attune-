/* ---- v9.2 The flight agent (Ali, 4 Nov 2026: "I want the app, via agents, to see the cheapest flight tickets with the modifications I
   want" — picked 3A + "make sure it's organised if I am seeing more than 1 option, and that it gets the tickets from many places").
   · One sentence → a flight agent: from / to (agent.js planTask: city → airport), the day, ± flexible days, return, passengers,
     cabin, direct, time of day, bags, a price limit — each condition becomes a RULE the person can change (agent-rules.js).
   · Many places: Kayak and momondo (± 3 days in one search), Google Flights, Skyscanner, Expedia and Wego — each link built with the
     conditions inside it (the idea of AWeirdDev/flights, MIT: put the search in the link, then read the results page). The phone reads
     them one after another in ONE window (AgentBrowser rounds), the person never types anything.
   · Organised: the same flight seen on several sites is ONE row ("on 3 sites, cheapest on Kayak"); the answer first (the cheapest
     that follows the rules), then Cheapest · Fastest · Direct · Best time, the cheapest price of each day, then the rest by price.
   Pure; tests: tests/unit/v922flights.test.mjs.                                                                                      */
import { planTask } from "./agent.js";
import { parseRule, mergeRules, applyRules, amountIn } from "./agent-rules.js";

const latin = (s) => String(s || "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
const DAY = 86400000;
const pad = (n) => String(n).padStart(2, "0");
const isoAdd = (iso, k) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + k); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
const enc = encodeURIComponent;

/** ± flexible days said: "± 3 days", "plus or minus 2 days", "around the 8th" (→ 3), «قبلها او بعدها بيومين», "flexible" (→ 3). */
export function flexIn(text) {
  const t = latin(text).toLowerCase();
  let m = /(?:±|\+\/?-|plus or minus|give or take)\s*(\d)\s*days?/.exec(t) || /(\d)\s*days?\s*(?:either side|before or after|flexible|flex)/.exec(t) || /(?:قبلها|قبل)\s*(?:او|أو|و)\s*(?:بعدها|بعد)\s*ب?\s*(\d)\s*(?:يوم|ايام|أيام)/.exec(t);
  if (m) return Math.min(3, +m[1]);
  if (/قبلها\s*(?:او|أو|و)\s*بعدها\s*بيومين|يومين قبل او بعد/.test(t)) return 2;
  if (/\b(around|about|roughly|flexible|any day near)\b|حوالي|تقريبا|مرن/.test(t)) return 3;
  return 0;
}
const FLY = /\b(flights?|fly|flying|plane|air ?tickets?|airfare|airline)\b|طياره|طيارة|طيران|تذكره طيران|تذكرة طيران|تذاكر طيران|رحله طيران/i;
const AGENTY = /\b(cheapest|cheap|lowest|best price|find|search|look for|watch|tell me|notify|alert|track|keep checking|agent)\b|ارخص|أرخص|رخيص|دور|دورلي|ابحث|نبهني|قولي|عرفني|تابع/i;
/** Is this sentence a flight for an agent to search? (A plain "book me a flight" with no "cheapest / find / tell me" stays a link set.) */
export const isFlightAgent = (text) => FLY.test(text) && AGENTY.test(latin(text));

/** A sentence → { ok, f, rules, flex, missing } — f from planTask, the conditions said as rules. */
export function parseFlight(text, { now = Date.now(), country = "", homeAirport = "" } = {}) {
  // planTask needs a booking word or a route with a day; "cheapest flight to Jeddah" has neither → read it as a booking to ask what is missing
  const p = planTask(text, { now, country, homeAirport }) || planTask("book a flight " + String(text).replace(/^\s*(?:the\s+)?(?:cheapest|cheap|find|search)\s+(?:me\s+)?(?:a\s+|the\s+)?(?:flights?\s+)?/i, ""), { now, country, homeAirport });
  if (!p || p.task !== "flight") return null;
  const f = p.fields, flex = flexIn(text);
  // the conditions → rules (the same chips the person changes later)
  let rules = {};
  for (const part of String(text).split(/[,،;]|\band\b|\bwith\b|\s+و(?=\S)/i)) { const r = parseRule(part); if (r) { delete r.below; delete r.hours; rules = mergeRules(rules, r); } }
  if (f.direct) rules.maxStops = 0;
  if (f.time && !rules.timeOfDay) rules.timeOfDay = f.time;
  if (f.cabin && f.cabin !== "economy") rules.cabin = f.cabin;
  const lim = /\b(?:under|below|less than|max(?:imum)?|budget|up to)\s+[^\d]{0,6}(\d[\d,.]*\s*(?:k|thousand)?)|(?:اقل من|أقل من|تحت|في حدود|بحد اقصي|بحد أقصى)\s*(\d[\d,.]*\s*(?:الف|ألف)?)/i.exec(latin(text));
  const below = lim ? amountIn(lim[1] || lim[2]) || 0 : 0;
  const kids = /(\d)\s*(?:kids?|children|child|اطفال|أطفال|عيال)/i.exec(latin(text));
  return { ok: !p.missing.length, f: { ...f, children: kids ? +kids[1] : 0 }, rules, flex, below, missing: p.missing };
}

const yymmdd = (iso) => iso.slice(2, 4) + iso.slice(5, 7) + iso.slice(8, 10);
const mdy = (iso) => +iso.slice(5, 7) + "/" + +iso.slice(8, 10) + "/" + iso.slice(0, 4);
/** The places a flight is searched, each link carrying the conditions (dates ± days, passengers, cabin, direct). */
export function flightTries(f, flex = 0) {
  const cab = f.cabin === "business" ? "business" : f.cabin === "first" ? "first" : f.cabin === "premium" ? "premium" : "economy";
  const fx = flex ? "-flexible-" + Math.min(3, flex) + "days" : "", pax = f.adults + "adults" + (f.children ? "/children" + "-11".repeat(f.children) : "");
  const direct = !!f.direct;
  const kayakPath = `${f.from}-${f.to}/${f.depart}${fx}${f.ret ? "/" + f.ret + fx : ""}/${pax}${cab !== "economy" ? "/" + cab : ""}?sort=price_a${direct ? "&fs=stops=0" : ""}`;
  const q = `Flights from ${f.from} to ${f.to} on ${f.depart}${f.ret ? " returning " + f.ret : " one way"}${f.adults > 1 ? " " + f.adults + " adults" : ""}${f.children ? " " + f.children + " children" : ""}${direct ? " nonstop" : ""}${cab !== "economy" ? " " + cab + " class" : ""} cheapest`;
  return [
    { site: "Kayak", url: "https://www.kayak.com/flights/" + kayakPath },
    { site: "momondo", url: "https://www.momondo.com/flight-search/" + kayakPath },
    { site: "Google Flights", url: "https://www.google.com/travel/flights?q=" + enc(q) },
    { site: "Skyscanner", url: `https://www.skyscanner.net/transport/flights/${f.from.toLowerCase()}/${f.to.toLowerCase()}/${yymmdd(f.depart)}/${f.ret ? yymmdd(f.ret) + "/" : ""}?adultsv2=${f.adults}${f.children ? "&childrenv2=" + Array(f.children).fill(8).join("|") : ""}&cabinclass=${cab}&rtn=${f.ret ? 1 : 0}${direct ? "&preferdirects=true" : ""}&sortby=cheapest` },
    { site: "Expedia", url: `https://www.expedia.com/Flights-Search?mode=search&trip=${f.ret ? "roundtrip" : "oneway"}&leg1=${enc(`from:${f.from},to:${f.to},departure:${mdy(f.depart)}TANYT`)}${f.ret ? "&leg2=" + enc(`from:${f.to},to:${f.from},departure:${mdy(f.ret)}TANYT`) : ""}&passengers=${enc("adults:" + f.adults + (f.children ? ",children:" + Array(f.children).fill("8").join(";") : ""))}&options=${enc("cabinclass:" + cab + (direct ? ",maxhops:0" : ""))}&sortOrder=INCREASING&sortCriteria=PRICE` },
    { site: "Wego", url: `https://www.wego.com/flights/searches/${f.from}-${f.to}/${f.depart}${f.ret ? ":" + f.ret : ""}/${cab}/${f.adults}a:${f.children || 0}c:0i?sort=price&order=asc` },
  ];
}

/** The flight agent itself (agents.js makeAgent "watch" with fields.flight). */
export function flightAgent(text, opts = {}) {
  const r = parseFlight(text, opts); if (!r) return null;
  if (!r.ok) return { kind: "do", plan: { task: "flight", fields: r.f, missing: r.missing, links: [] }, title: String(text).slice(0, 80) };
  const f = r.f, tries = flightTries(f, r.flex), when = f.depart.slice(8) + "/" + f.depart.slice(5, 7) + (f.ret ? " → " + f.ret.slice(8) + "/" + f.ret.slice(5, 7) : "");
  return { kind: "watch", site: tries.length + " sites", url: tries[0].url, tries, below: r.below, currency: opts.currency || "", what: "",
    fields: { flight: { ...f, flex: r.flex } }, rules: r.rules, title: "Flights · " + f.from + " → " + f.to + " · " + when + (r.flex ? " ±" + r.flex : "") };
}

// ---- reading what the sites showed ---------------------------------------------------------------------------------------------
export const AIRLINE_NAMES = ["EgyptAir", "Saudia", "flynas", "flyadeal", "Nile Air", "Air Cairo", "Air Arabia", "Emirates", "flydubai", "Qatar Airways", "Etihad", "Turkish Airlines", "Pegasus",
  "Royal Jordanian", "Gulf Air", "Kuwait Airways", "Oman Air", "Middle East Airlines", "Royal Air Maroc", "Tunisair", "Ethiopian", "Kenya Airways", "Lufthansa", "British Airways", "Air France", "KLM",
  "Wizz Air", "AJet", "SunExpress", "Air India", "IndiGo", "Pakistan International", "Saudi Arabian", "Jazeera Airways", "Salam Air", "Badr Airlines", "Tarco"];
const AIR_RE = AIRLINE_NAMES.map((n) => [n, new RegExp("\\b" + n.replace(/ /g, "\\s+") + "\\b", "i")]);
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
/** One result card's words → { airline, dep "07:40", arr "09:50", depHour, dur (minutes), stops, date (iso) } — what is not written stays null. */
export function flightFacts(o, year = new Date().getFullYear()) {
  const t = " " + String((o && (o.text || "")) || "") + " " + String((o && o.name) || "") + " ";
  const airline = (AIR_RE.find(([, re]) => re.test(t)) || [null])[0];
  const times = [...t.matchAll(/\b(\d{1,2}):(\d{2})\s*(am|pm|a\.m\.|p\.m\.|ص|م)?(?=[^\d]|$)/gi)].map((m) => { let h = +m[1]; const ap = (m[3] || "").toLowerCase(); if (/^p|م/.test(ap) && h < 12) h += 12; if (/^a|ص/.test(ap) && h === 12) h = 0; return [h, +m[2]]; }).filter(([h, mi]) => h < 24 && mi < 60);
  const dep = times[0] ? pad(times[0][0]) + ":" + pad(times[0][1]) : null, arr = times[1] ? pad(times[1][0]) + ":" + pad(times[1][1]) : null;
  let dur = null; const dm = /(\d{1,2})\s*(?:hours?|hrs|hr|h|ساعه|س)\s*(?:(\d{1,2})\s*(?:minutes?|mins|min|m|دقيقه|د))?/i.exec(t); if (dm) dur = +dm[1] * 60 + (+dm[2] || 0);
  let stops = null; if (/\b(non-?stop|direct)\b|مباشر|بدون توقف/i.test(t)) stops = 0; else { const sm = /\b(\d)\s*stops?\b|(\d)\s*توقف/i.exec(t); if (sm) stops = +(sm[1] || sm[2]); else if (/\b(one|1) stop\b|توقف واحد|ترانزيت/i.test(t)) stops = 1; }
  let date = null; const dd = /\b(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*,?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})\b|\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/i.exec(t);
  if (dd) { const mo = MON[(dd[1] || dd[4]).toLowerCase().slice(0, 3)], d = +(dd[2] || dd[3]); date = year + "-" + pad(mo) + "-" + pad(d); }
  return { airline, dep, arr, depHour: times[0] ? times[0][0] : null, dur, stops, date };
}

/** Everything the sites showed → organised. offers: [{ price, currency, text, name, site, href }].
 *  → { rows: [{ o, x, sites: [names], key }], cheapest, fastest, direct, bestTime, days: [{ date, price }], hidden } */
export function organise(offers, rules = {}, f = {}) {
  const year = f.depart ? +f.depart.slice(0, 4) : new Date().getFullYear();
  const by = new Map(); let hidden = 0;
  for (const o of offers || []) {
    if (!(o && o.price > 0)) continue;
    const x = flightFacts(o, year);
    const withFacts = { ...o, stops: x.stops, departHour: x.depHour, airline: x.airline || o.airline };
    if (!applyRules([withFacts], rules).length) { hidden++; continue; }
    // the same flight on several sites (same airline, same times, same day) is one row; the cheapest site wins
    const key = x.airline && x.dep ? [x.airline, x.dep, x.arr || "", x.date || f.depart || ""].join("|").toLowerCase() : "p" + o.price + "|" + String(o.name || o.text || "").slice(0, 30).toLowerCase();
    const cur = by.get(key);
    if (!cur) by.set(key, { o: withFacts, x, sites: [o.site].filter(Boolean), key });
    else { if (o.site && !cur.sites.includes(o.site)) cur.sites.push(o.site); if (o.price < cur.o.price) { cur.o = withFacts; cur.sites = [o.site, ...cur.sites.filter((s) => s !== o.site)].filter(Boolean); } }
  }
  const rows = [...by.values()].sort((a, b) => a.o.price - b.o.price);
  const pick = (fn) => rows.filter(fn).sort((a, b) => a.o.price - b.o.price)[0] || null;
  const fastest = rows.filter((r) => r.x.dur).sort((a, b) => a.x.dur - b.x.dur || a.o.price - b.o.price)[0] || null;
  const tod = rules.timeOfDay || f.time || "";
  const inTime = (h) => h != null && ({ morning: h >= 5 && h < 12, afternoon: h >= 12 && h < 17, evening: h >= 17 && h < 22, night: h >= 22 || h < 5 }[tod] ?? (h >= 7 && h <= 20));
  const days = {}; for (const r of rows) { const d = r.x.date || ""; if (d && (!days[d] || r.o.price < days[d])) days[d] = r.o.price; }
  return { rows, cheapest: rows[0] || null, fastest, direct: pick((r) => r.x.stops === 0), bestTime: pick((r) => inTime(r.x.depHour)), hidden,
    days: Object.entries(days).sort((a, b) => a[0].localeCompare(b[0])).map(([date, price]) => ({ date, price })) };
}
export const fmtDur = (m) => (m == null ? "" : Math.floor(m / 60) + "h" + (m % 60 ? " " + pad(m % 60) + "m" : ""));
