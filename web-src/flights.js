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
import { planTask, tripDates } from "./agent.js";
import { MONTH_NAMES } from "./life.js";
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


// ---- v9.3 (Ali, 5 Nov 2026: "does it understand … check from 1 December to the end of January the cheapest flights to Spain, for 4 days
// go and return?") — a WINDOW of days, the LENGTH of the trip, and a COUNTRY as the destination ----------------------------------
const fold2 = (s) => latin(String(s || "")).toLowerCase().replace(/[أإآ]/g, "ا").replace(/ى/g, "ي");   // same length as the text: indexes stay right
const MONTH_RES = MONTH_NAMES.map((n) => new RegExp("^(?:" + n + ")$", "iu"));
const MONTH_ANY = "(" + MONTH_NAMES.join("|") + ")";
const monthOf = (w) => MONTH_RES.findIndex((re) => re.test(String(w || "").toLowerCase()));
const yearFor = (m, now) => { const d = new Date(now); return m < d.getMonth() ? d.getFullYear() + 1 : d.getFullYear(); };
const lastDay = (y, m) => new Date(y, m + 1, 0).getDate();
const isoOf = (y, m, d) => y + "-" + pad(m + 1) + "-" + pad(d);
const PART_EN = "(?:the\\s+)?(end|beginning|start|middle|mid|early|late)(?:\\s+of)?\\s+";
const PART_AR = "(اخر|نهايه|نهاية|اول|بدايه|بداية|نص|نصف|منتصف)\\s+(?:شهر\\s+)?";
const partDay = (k, y, m) => (/end|late|اخر|نهاي/.test(k) ? lastDay(y, m) : /mid|middle|نص|منتصف/.test(k) ? 15 : 1);

/** The countries people fly to → Skyscanner's country code and the main airports (Kayak takes several, comma-separated). */
export const COUNTRIES = [
  ["ES", "spain|espana|españa|اسبانيا|اسبانيه", ["MAD", "BCN", "AGP", "VLC", "PMI"], "madrid"],
  ["IT", "italy|italia|ايطاليا", ["FCO", "MXP", "VCE", "NAP"], "rome"], ["FR", "france|فرنسا", ["CDG", "ORY", "NCE"], "paris"],
  ["DE", "germany|deutschland|المانيا", ["FRA", "MUC", "BER"], "frankfurt"], ["GB", "uk|united kingdom|england|britain|بريطانيا|انجلترا", ["LHR", "LGW", "MAN"], "london"],
  ["TR", "turkey|turkiye|türkiye|تركيا", ["IST", "SAW", "AYT"], "istanbul"], ["GR", "greece|اليونان", ["ATH", "JTR", "HER"], "athens"],
  ["PT", "portugal|البرتغال", ["LIS", "OPO", "FAO"], "lisbon"], ["NL", "netherlands|holland|هولندا", ["AMS"], "amsterdam"],
  ["CH", "switzerland|سويسرا", ["ZRH", "GVA"], "zurich"], ["AT", "austria|النمسا", ["VIE"], "vienna"],
  ["AE", "uae|the emirates|الامارات", ["DXB", "AUH", "SHJ"], "dubai"], ["SA", "saudi arabia|saudi|السعوديه|السعودية", ["JED", "RUH", "MED"], "jeddah"],
  ["MA", "morocco|المغرب", ["CMN", "RAK"], "casablanca"], ["TH", "thailand|تايلاند", ["BKK", "HKT"], "bangkok"],
  ["MY", "malaysia|ماليزيا", ["KUL", "PEN"], "kuala lumpur"], ["ID", "indonesia|اندونيسيا", ["CGK", "DPS"], "jakarta"],
  ["JP", "japan|اليابان", ["NRT", "HND", "KIX"], "tokyo"], ["US", "usa|united states|america|امريكا", ["JFK", "EWR", "LAX", "MIA"], "new york"],
  ["GE", "georgia|جورجيا", ["TBS", "BUS"], "tbilisi"], ["AZ", "azerbaijan|اذربيجان", ["GYD"], "baku"], ["MV", "maldives|المالديف", ["MLE"], "male"],
];
/** A country named as the destination → { code, airports, city, at, len } | null ("to Spain", «لاسبانيا»). */
export function countryIn(text) {
  const t = fold2(text);
  for (const [code, names, airports, city] of COUNTRIES) {
    const m = new RegExp("(?<![\\p{L}])(?:to\\s+|الي\\s+|ل)?(?:" + names + ")(?![\\p{L}])", "iu").exec(t);
    if (m) { const lead = /^(?:to\s+|الي\s+|ل)/.exec(m[0]); const at = m.index + (lead ? lead[0].length : 0); return { code, airports, city, at, len: m[0].length - (lead ? lead[0].length : 0) }; }
  }
  return null;
}
/** How long the trip is → { nights, at, len } | null. "4 days" = leave on day 1, back on day 4 (3 nights); "4 nights" = 4; "a week" = 7. */
export function stayIn(text) {
  const t = fold2(text);
  let m = /(\d{1,2})\s*(nights?|ليالي|ليله|nuits?|noches?|noites?|nächte|notti|gece|malam)(?![\p{L}])/iu.exec(t);
  if (m) return { nights: +m[1], at: m.index, len: m[0].length };
  m = /(?:for\s+)?(\d{1,2})\s*(days?|ايام|يوم|jours?|días|dias|tage|giorni|gün|hari)(?![\p{L}])/iu.exec(t);
  if (m && +m[1] > 0) return { nights: Math.max(1, +m[1] - 1), days: +m[1], at: m.index, len: m[0].length };
  m = /(?:for\s+)?(?:a|one|1)\s+week(?![\p{L}])|(?:لمده\s+|لمدة\s+)?(?:اسبوع|أسبوع)(?![\p{L}])/iu.exec(t);
  if (m) return { nights: 7, at: m.index, len: m[0].length };
  m = /(?:for\s+)?(?:a|the)\s+(?:long\s+)?weekend(?![\p{L}])|ويك ?اند/iu.exec(t);
  if (m) return { nights: /long/.test(m[0]) ? 3 : 2, at: m.index, len: m[0].length };
  return null;
}
/** A window of days said in the sentence → { from, to, at, len } | null.
 *  "from 1 December to the end of January", "between 1 Dec and 31 Jan", "anytime in December", "December or January", «من ١ ديسمبر لآخر يناير», «في شهر ديسمبر». */
export function windowIn(text, { now = Date.now() } = {}) {
  const t0 = fold2(text);
  // "end of January" / «آخر يناير» → a day of that month (same length kept: the phrase is padded with spaces)
  let t = t0.replace(new RegExp("(?<![\\p{L}])(ل)?(?:" + PART_EN + "|" + PART_AR + ")" + MONTH_ANY + "(?![\\p{L}])", "giu"), (all, li, k1, k2, mon) => {
    const m = monthOf(mon); if (m < 0) return all; const y = yearFor(m, now); const s = (li || "") + partDay(k1 || k2 || "", y, m) + " " + mon; return s.padEnd(all.length, " ");
  });
  // a range with two days: "from X to Y" / «من X لـ Y» — tripDates reads the two days
  const DAYW = "(?:\\d{1,2}(?:st|nd|rd|th)?\\s*(?:of\\s+)?" + MONTH_ANY + "|" + MONTH_ANY + "\\s*\\d{1,2}(?:st|nd|rd|th)?|\\d{1,2}[/.-]\\d{1,2}(?:[/.-]\\d{2,4})?)";
  const R = new RegExp("(?<![\\p{L}])(?:from|between|starting|من|بين|ما بين)\\s+(?:the\\s+)?" + DAYW + "\\s*(?:to|till|until|and|through|-|–|لحد|لغايه|لغاية|الي|و|ل(?=\\s*\\d))\\s*(?:the\\s+)?" + DAYW, "iu");
  let m = R.exec(t);
  if (m) {
    const d = tripDates(m[0], { now });
    if (d.length === 2 && d[1] > d[0]) return { from: d[0], to: d[1], at: m.index, len: m[0].length };
  }
  // whole months: "in December", "anytime in December or January", «في ديسمبر او يناير», "December–January"
  const MW = "(?:شهر\\s+)?" + MONTH_ANY;
  m = new RegExp("(?<![\\p{L}])(?:(?:any\\s*time|whenever|sometime|some time)\\s+)?(?:in|during|over|throughout|في|خلال|طول)\\s+" + MW + "(?:\\s*(?:or|and|to|till|until|-|–|او|أو|و|لحد|ل)\\s*" + MW + ")?(?![\\p{L}])", "iu").exec(t)
    || new RegExp("(?<![\\p{L}])" + MONTH_ANY + "\\s*(?:or|to|-|–|او|أو|لحد)\\s*" + MONTH_ANY + "(?![\\p{L}])", "iu").exec(t);
  if (m) {
    const mons = [...m[0].matchAll(new RegExp(MONTH_ANY, "giu"))].map((x) => monthOf(x[1])).filter((x) => x >= 0);
    if (mons.length) {
      const m1 = mons[0], m2 = mons[mons.length - 1], y1 = yearFor(m1, now), y2 = m2 < m1 ? y1 + 1 : y1;
      let from = isoOf(y1, m1, 1); const today = isoDay(now);
      if (from < today) from = today;
      return { from, to: isoOf(y2, m2, lastDay(y2, m2)), at: m.index, len: m[0].length };
    }
  }
  return null;
}
const isoDay = (t) => { const d = new Date(t); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
/** The departure days tried inside a window: spread evenly, each searched ± 3 days on Kayak / momondo (so up to 8 cover ~2 months). */
export function windowDeparts(w, nights, max = 8) {
  const a = Date.parse(w.from + "T12:00:00"), last = Date.parse(w.to + "T12:00:00") - Math.max(0, nights) * DAY;
  if (!(last >= a)) return [w.from];
  const span = Math.round((last - a) / DAY), n = Math.min(max, Math.max(1, Math.ceil((span + 1) / 7)));
  const step = n > 1 ? span / (n - 1) : 0, first = n > 1 ? 0 : 0;
  return [...new Set(Array.from({ length: n }, (_, i) => isoAdd(w.from, Math.round(first + step * i))))];
}

/** A sentence → { ok, f, rules, flex, missing } — f from planTask, the conditions said as rules. */
export function parseFlight(text, { now = Date.now(), country = "", homeAirport = "" } = {}) {
  // v9.3: a window ("from 1 December to the end of January"), a trip length ("4 days") or a country ("to Spain") — read them, take them
  // out of the sentence (so "1 December" is never taken for an airport), read the rest as before, then put them back in
  const win = windowIn(text, { now }), stay = stayIn(text), ctry = countryIn(text);
  if ((win || ctry) && !String(text).includes("\u0000")) {
    const cut = [win, stay, ctry].filter(Boolean).sort((a, b) => b.at - a.at);
    let t2 = String(text);
    for (const c of cut) t2 = t2.slice(0, c.at) + (c === ctry ? (/ل$/.test(t2.slice(0, c.at)) ? "" : " ") + ctry.city + " " : " ") + t2.slice(c.at + c.len);
    const first = win ? win.from : "", back = stay ? isoAdd(first || isoDay(now), stay.nights) : "";
    const base = parseFlight(t2.replace(/\s+/g, " ").trim() + (win ? " on " + first + (stay ? " returning " + back : "") : "") + "\u0000", { now, country, homeAirport });
    if (!base) return null;
    const f = { ...base.f };
    if (ctry) { f.to = ctry.airports[0]; f.toCountry = ctry.code; f.toAirports = ctry.airports; }
    if (win) { f.window = { from: win.from, to: win.to }; f.depart = win.from; }
    if (stay) { f.stay = stay.nights; if (stay.days) f.days = stay.days; f.ret = isoAdd(f.depart || isoDay(now), stay.nights); }
    const missing = (base.missing || []).filter((x) => !(ctry && /Flying to where|airport for/.test(typeof x === "string" ? x : x.t) && (typeof x === "string" || !new RegExp(ctry.city, "i").test(x.v.x)))
      && !(win && /Which day/.test(typeof x === "string" ? x : x.t)) && !(stay && /come back/.test(typeof x === "string" ? x : x.t)));
    if (win && !stay && !/one ?way|ذهاب بس|ذهاب فقط|رايح بس/i.test(text) && !missing.some((x) => /come back|how many days/i.test(typeof x === "string" ? x : x.t))) missing.push("How many days is the trip? (e.g. 4 days)");
    return { ...base, f, missing, ok: !missing.length };
  }
  // planTask needs a booking word or a route with a day; "cheapest flight to Jeddah" has neither → read it as a booking to ask what is missing
  text = String(text).replace(/\u0000/g, "");
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
  // v9.3 a window: the departure days spread over it, each searched ± 3 days; the sites take turns (Kayak, Skyscanner, momondo), so
  // ~2 months are covered in 8 pages. A country: Kayak gets its main airports together, Skyscanner the country itself.
  if (f.window && !f._one) {
    const days = windowDeparts(f.window, f.stay || 0), order = ["Kayak", "Skyscanner", "momondo"];
    return days.map((d, i) => {
      const one = flightTries({ ...f, _one: true, depart: d, ret: f.stay != null && f.ret ? isoAdd(d, f.stay) : "" }, 3);
      const site = order[i % order.length], x = one.find((y) => y.site === site) || one[0];
      return { ...x, depart: d, ret: f.stay != null && f.ret ? isoAdd(d, f.stay) : "", label: x.site + "|" + d };
    });
  }
  const cab = f.cabin === "business" ? "business" : f.cabin === "first" ? "first" : f.cabin === "premium" ? "premium" : "economy";
  const fx = flex ? "-flexible-" + Math.min(3, flex) + "days" : "", pax = f.adults + "adults" + (f.children ? "/children" + "-11".repeat(f.children) : "");
  const direct = !!f.direct;
  const kayakTo = f.toAirports && f.toAirports.length ? f.toAirports.slice(0, 3).join(",") : f.to;
  const kayakPath = `${f.from}-${kayakTo}/${f.depart}${fx}${f.ret ? "/" + f.ret + fx : ""}/${pax}${cab !== "economy" ? "/" + cab : ""}?sort=price_a${direct ? "&fs=stops=0" : ""}`;
  const q = `Flights from ${f.from} to ${f.toCountry ? (COUNTRIES.find((c) => c[0] === f.toCountry) || [0, f.to])[1].split("|")[0].replace(/^\w/, (c) => c.toUpperCase()) : f.to} on ${f.depart}${f.ret ? " returning " + f.ret : " one way"}${f.adults > 1 ? " " + f.adults + " adults" : ""}${f.children ? " " + f.children + " children" : ""}${direct ? " nonstop" : ""}${cab !== "economy" ? " " + cab + " class" : ""} cheapest`;
  return [
    { site: "Kayak", url: "https://www.kayak.com/flights/" + kayakPath },
    { site: "momondo", url: "https://www.momondo.com/flight-search/" + kayakPath },
    { site: "Google Flights", url: "https://www.google.com/travel/flights?q=" + enc(q) },
    { site: "Skyscanner", url: `https://www.skyscanner.net/transport/flights/${f.from.toLowerCase()}/${(f.toCountry || f.to).toLowerCase()}/${yymmdd(f.depart)}/${f.ret ? yymmdd(f.ret) + "/" : ""}?adultsv2=${f.adults}${f.children ? "&childrenv2=" + Array(f.children).fill(8).join("|") : ""}&cabinclass=${cab}&rtn=${f.ret ? 1 : 0}${direct ? "&preferdirects=true" : ""}&sortby=cheapest` },
    { site: "Expedia", url: `https://www.expedia.com/Flights-Search?mode=search&trip=${f.ret ? "roundtrip" : "oneway"}&leg1=${enc(`from:${f.from},to:${f.to},departure:${mdy(f.depart)}TANYT`)}${f.ret ? "&leg2=" + enc(`from:${f.to},to:${f.from},departure:${mdy(f.ret)}TANYT`) : ""}&passengers=${enc("adults:" + f.adults + (f.children ? ",children:" + Array(f.children).fill("8").join(";") : ""))}&options=${enc("cabinclass:" + cab + (direct ? ",maxhops:0" : ""))}&sortOrder=INCREASING&sortCriteria=PRICE` },
    { site: "Wego", url: `https://www.wego.com/flights/searches/${f.from}-${f.to}/${f.depart}${f.ret ? ":" + f.ret : ""}/${cab}/${f.adults}a:${f.children || 0}c:0i?sort=price&order=asc` },
  ];
}

/** The flight agent itself (agents.js makeAgent "watch" with fields.flight). */
export function flightAgent(text, opts = {}) {
  const r = parseFlight(text, opts); if (!r) return null;
  if (!r.ok) return { kind: "do", plan: { task: "flight", fields: r.f, missing: r.missing, links: [] }, title: String(text).slice(0, 80) };
  const f = r.f, tries = flightTries(f, r.flex), dm = (iso) => iso.slice(8) + "/" + iso.slice(5, 7);
  const when = f.window ? dm(f.window.from) + "–" + dm(f.window.to) + (f.days ? " · " + f.days + "d" : f.stay ? " · " + f.stay + "n" : "") : dm(f.depart) + (f.ret ? " → " + dm(f.ret) : "");
  const dest = f.toCountry ? (COUNTRIES.find((c) => c[0] === f.toCountry) || [0, f.to])[1].split("|")[0].replace(/^\w/, (c) => c.toUpperCase()) : f.to;
  return { kind: "watch", site: tries.length + " sites", url: tries[0].url, tries, below: r.below, currency: opts.currency || "", what: "",
    fields: { flight: { ...f, flex: r.flex } }, rules: r.rules, title: "Flights · " + f.from + " → " + dest + " · " + when + (r.flex && !f.window ? " ±" + r.flex : "") };
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
  const days = {}; for (const r of rows) { const d = r.x.date || r.o.depart || ""; if (d && (!days[d] || r.o.price < days[d])) days[d] = r.o.price; }   // v9.3: a window → the day that was tried
  return { rows, cheapest: rows[0] || null, fastest, direct: pick((r) => r.x.stops === 0), bestTime: pick((r) => inTime(r.x.depHour)), hidden,
    days: Object.entries(days).sort((a, b) => a[0].localeCompare(b[0])).map(([date, price]) => ({ date, price })) };
}
export const fmtDur = (m) => (m == null ? "" : Math.floor(m / 60) + "h" + (m % 60 ? " " + pad(m % 60) + "m" : ""));

/* ---- v9.3 (Ali picked D3 A): "buy now or wait?" — from the agent's OWN checks only, said with how sure it is. It never guesses beyond
   what it saw (the idea of Hopper / Kayak's forecast, kept honest and simple): close to the day → buy; at the lowest seen → buy;
   rising 3 checks in a row → buy; falling and the day is far → wait; otherwise no clear sign. ------------------------------------- */
export function adviseBuy(checks, { depart = "", now = Date.now() } = {}) {
  const ps = (checks || []).filter((c) => c && c.price > 0).map((c) => c.price);
  const conf = ps.length >= 10 ? "high" : ps.length >= 5 ? "medium" : "low";
  if (ps.length < 3) return { say: "", why: "Not enough checks yet — advice after 3 checks", conf, n: ps.length };
  const last = ps[ps.length - 1], low = Math.min(...ps), daysLeft = depart ? Math.round((Date.parse(depart + "T12:00:00") - now) / DAY) : 999;
  const up = ps.length >= 4 && ps[ps.length - 1] > ps[ps.length - 2] && ps[ps.length - 2] > ps[ps.length - 3] && ps[ps.length - 3] > ps[ps.length - 4];
  const down = ps[ps.length - 1] < ps[ps.length - 2] && ps[ps.length - 2] < ps[ps.length - 3];
  if (daysLeft <= 14) return { say: "buy", why: "Less than 2 weeks to go — prices usually rise from here", conf, n: ps.length, low };
  if (last <= low * 1.02) return { say: "buy", why: "This is the lowest price seen so far", conf, n: ps.length, low };
  if (up) return { say: "buy", why: "Prices rose in the last 3 checks", conf, n: ps.length, low };
  if (down && daysLeft > 30) return { say: "wait", why: "Prices are falling and the trip is more than a month away", conf, n: ps.length, low };
  return { say: "", why: "No clear sign yet — buy if the price suits you", conf, n: ps.length, low };
}
