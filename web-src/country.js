/* ---- v6.47 country packs (VISION phase 4 "Global": "country packs — currencies, taxes, holidays…"). One row per country:
   currency, the standard VAT / sales tax, the weekend, the emergency numbers, units, and the public holidays — fixed dates,
   dates that follow Easter (Western, and Orthodox for Egypt's Sham el-Nessim), "the 3rd Monday of …" rules, and the Islamic
   holidays computed from the Umm al-Qura calendar the phone already knows (Intl, no table to go out of date). Moon-sighting can
   move an Islamic holiday by a day, so those are marked `lunar`. Everything is pure code; tests: tests/unit/v747country.test.mjs.
   The person's country is picked once (Settings → Your country; guessed from the phone at first) and feeds Money's currency,
   the VAT in Fleet / Books, Home's Today line ("Tomorrow: Eid al-Adha — banks closed") and Fleet's cheques (a cheque due on a
   bank holiday clears on the next working day).                                                                              */
import { tr } from "./i18n.js";

export const COUNTRY_KEY = "attune:country";

// Islamic holidays: [id, English name, Hijri month, day, days]
const ISL = {
  newyear: ["Islamic New Year", 1, 1, 1], ashura: ["Ashura", 1, 10, 1], ashura2: ["Ashura", 1, 9, 2], mawlid: ["The Prophet's Birthday", 3, 12, 1],
  isra: ["Isra and Mi'raj", 7, 27, 1], fitr: ["Eid al-Fitr", 10, 1, 3], fitr2: ["Eid al-Fitr", 10, 1, 2], fitr4: ["Eid al-Fitr", 9, 29, 4],
  arafat: ["Arafat Day", 12, 9, 1], adha: ["Eid al-Adha", 12, 10, 3], adha4: ["Eid al-Adha", 12, 10, 4], adha2: ["Eid al-Adha", 12, 10, 2],
};
// Days after Western Easter Sunday (Orthodox Easter for "oe:")
const EAS = { goodfri: ["Good Friday", -2], easter: ["Easter Sunday", 0], eastermon: ["Easter Monday", 1], ascension: ["Ascension Day", 39],
  whitmon: ["Whit Monday", 50], corpus: ["Corpus Christi", 60], carnmon: ["Carnival", -48], carntue: ["Carnival", -47] };

/* f: fixed "MM-DD name"; n: "MM-wd-k name" (k-th weekday wd of the month, k = -1 for the last); e: Easter keys; i: Islamic keys;
   o: "offset name" after Orthodox Easter. vat in %, null = no single national rate (see note). weekend: day numbers (0 = Sunday). */
export const COUNTRIES = {
  eg: { name: "Egypt", cur: "EGP", vat: 14, weekend: [5, 6], tel: { police: "122", ambulance: "123", fire: "180" }, units: "metric",
    f: ["01-07 Coptic Christmas", "01-25 Revolution Day (25 January)", "04-25 Sinai Liberation Day", "05-01 Labour Day", "06-30 30 June Revolution", "07-23 Revolution Day (23 July)", "10-06 Armed Forces Day"],
    o: ["1 Sham el-Nessim"], i: ["newyear", "mawlid", "fitr", "arafat", "adha"] },
  sa: { name: "Saudi Arabia", cur: "SAR", vat: 15, weekend: [5, 6], tel: { all: "911" }, units: "metric", f: ["02-22 Founding Day", "09-23 National Day"], i: ["fitr4", "arafat", "adha"] },
  ae: { name: "United Arab Emirates", cur: "AED", vat: 5, weekend: [6, 0], tel: { police: "999", ambulance: "998", fire: "997" }, units: "metric",
    f: ["01-01 New Year's Day", "12-01 Commemoration Day", "12-02 National Day", "12-03 National Day"], i: ["newyear", "mawlid", "fitr", "arafat", "adha"] },
  kw: { name: "Kuwait", cur: "KWD", vat: 0, weekend: [5, 6], tel: { all: "112" }, units: "metric", f: ["01-01 New Year's Day", "02-25 National Day", "02-26 Liberation Day"], i: ["isra", "newyear", "mawlid", "fitr", "arafat", "adha"] },
  qa: { name: "Qatar", cur: "QAR", vat: 0, weekend: [5, 6], tel: { all: "999" }, units: "metric", f: ["12-18 National Day"], n: ["02-2-2 National Sport Day"], i: ["fitr", "adha"] },
  bh: { name: "Bahrain", cur: "BHD", vat: 10, weekend: [5, 6], tel: { all: "999" }, units: "metric", f: ["01-01 New Year's Day", "05-01 Labour Day", "12-16 National Day", "12-17 National Day"], i: ["newyear", "ashura2", "mawlid", "fitr", "arafat", "adha"] },
  om: { name: "Oman", cur: "OMR", vat: 5, weekend: [5, 6], tel: { all: "9999" }, units: "metric", f: ["01-11 Accession Day", "11-20 National Day", "11-21 National Day"], i: ["isra", "newyear", "mawlid", "fitr", "arafat", "adha"] },
  jo: { name: "Jordan", cur: "JOD", vat: 16, weekend: [5, 6], tel: { all: "911" }, units: "metric", f: ["01-01 New Year's Day", "05-01 Labour Day", "05-25 Independence Day", "12-25 Christmas Day"], i: ["isra", "newyear", "mawlid", "fitr", "arafat", "adha"] },
  lb: { name: "Lebanon", cur: "LBP", vat: 11, weekend: [6, 0], tel: { police: "112", ambulance: "140", fire: "175" }, units: "metric",
    f: ["01-01 New Year's Day", "01-06 Armenian Christmas", "02-09 Saint Maroun's Day", "03-25 Annunciation", "05-01 Labour Day", "08-15 Assumption", "11-22 Independence Day", "12-25 Christmas Day"],
    e: ["goodfri", "eastermon"], i: ["newyear", "ashura", "mawlid", "fitr", "adha"] },
  ma: { name: "Morocco", cur: "MAD", vat: 20, weekend: [6, 0], tel: { police: "19", ambulance: "15", fire: "15" }, units: "metric",
    f: ["01-01 New Year's Day", "01-11 Independence Manifesto Day", "01-14 Amazigh New Year", "05-01 Labour Day", "07-30 Throne Day", "08-14 Oued Ed-Dahab Day", "08-20 Revolution Day", "08-21 Youth Day", "11-06 Green March", "11-18 Independence Day"],
    i: ["newyear", "mawlid", "fitr2", "adha2"] },
  dz: { name: "Algeria", cur: "DZD", vat: 19, weekend: [5, 6], tel: { police: "17", ambulance: "14", fire: "14" }, units: "metric",
    f: ["01-01 New Year's Day", "01-12 Amazigh New Year", "05-01 Labour Day", "07-05 Independence Day", "11-01 Revolution Day"], i: ["newyear", "ashura", "mawlid", "fitr2", "adha2"] },
  tn: { name: "Tunisia", cur: "TND", vat: 19, weekend: [6, 0], tel: { police: "197", ambulance: "190", fire: "198" }, units: "metric",
    f: ["01-01 New Year's Day", "03-20 Independence Day", "04-09 Martyrs' Day", "05-01 Labour Day", "07-25 Republic Day", "08-13 Women's Day", "10-15 Evacuation Day", "12-17 Revolution Day"], i: ["newyear", "mawlid", "fitr2", "adha2"] },
  tr: { name: "Türkiye", cur: "TRY", vat: 20, weekend: [6, 0], tel: { all: "112" }, units: "metric",
    f: ["01-01 New Year's Day", "04-23 National Sovereignty and Children's Day", "05-01 Labour Day", "05-19 Youth and Sports Day", "07-15 Democracy Day", "08-30 Victory Day", "10-29 Republic Day"], i: ["fitr", "adha4"] },
  pk: { name: "Pakistan", cur: "PKR", vat: 18, weekend: [6, 0], tel: { police: "15", ambulance: "1122", fire: "16" }, units: "metric",
    f: ["02-05 Kashmir Day", "03-23 Pakistan Day", "05-01 Labour Day", "05-28 Youm-e-Takbeer", "08-14 Independence Day", "11-09 Iqbal Day", "12-25 Quaid-e-Azam Day"], i: ["ashura2", "mawlid", "fitr", "adha"] },
  in: { name: "India", cur: "INR", vat: 18, weekend: [0], tel: { all: "112" }, units: "metric", f: ["01-26 Republic Day", "08-15 Independence Day", "10-02 Gandhi Jayanti"],
    note: "GST 18 % is the standard rate (5 % and 40 % also apply). Other holidays (Diwali, Holi, Eid…) vary by state." },
  id: { name: "Indonesia", cur: "IDR", vat: 12, weekend: [6, 0], tel: { police: "110", ambulance: "118", fire: "113" }, units: "metric",
    f: ["01-01 New Year's Day", "05-01 Labour Day", "06-01 Pancasila Day", "08-17 Independence Day", "12-25 Christmas Day"], e: ["goodfri", "ascension"], i: ["isra", "newyear", "mawlid", "fitr2", "adha2"],
    note: "VAT is 12 % on the books but 11 % in effect for most goods. Nyepi, Vesak and Chinese New Year are holidays too (moving dates)." },
  my: { name: "Malaysia", cur: "MYR", vat: 10, weekend: [6, 0], tel: { all: "999" }, units: "metric", f: ["05-01 Labour Day", "08-31 National Day", "09-16 Malaysia Day", "12-25 Christmas Day"], n: ["06-1-1 King's Birthday"], i: ["newyear", "mawlid", "fitr2", "adha"],
    note: "Sales tax 10 % (service tax 8 %). Some states keep a Friday–Saturday weekend." },
  us: { name: "United States", cur: "USD", vat: null, weekend: [6, 0], tel: { all: "911" }, units: "imperial",
    f: ["01-01 New Year's Day", "06-19 Juneteenth", "07-04 Independence Day", "11-11 Veterans Day", "12-25 Christmas Day"],
    n: ["01-1-3 Martin Luther King Jr. Day", "02-1-3 Presidents' Day", "05-1--1 Memorial Day", "09-1-1 Labor Day", "10-1-2 Columbus Day", "11-4-4 Thanksgiving"], note: "No national VAT — sales tax is set by each state and city." },
  gb: { name: "United Kingdom", cur: "GBP", vat: 20, weekend: [6, 0], tel: { all: "999" }, units: "imperial", f: ["01-01 New Year's Day", "12-25 Christmas Day", "12-26 Boxing Day"],
    n: ["05-1-1 Early May bank holiday", "05-1--1 Spring bank holiday", "08-1--1 Summer bank holiday"], e: ["goodfri", "eastermon"], note: "England and Wales; Scotland and Northern Ireland add their own days." },
  ca: { name: "Canada", cur: "CAD", vat: 5, weekend: [6, 0], tel: { all: "911" }, units: "metric", f: ["01-01 New Year's Day", "07-01 Canada Day", "09-30 Truth and Reconciliation Day", "11-11 Remembrance Day", "12-25 Christmas Day", "12-26 Boxing Day"],
    n: ["09-1-1 Labour Day", "10-1-2 Thanksgiving"], e: ["goodfri"], victoria: true, note: "GST 5 % federal; provinces add PST or use HST (13–15 %)." },
  de: { name: "Germany", cur: "EUR", vat: 19, weekend: [6, 0], tel: { all: "112" }, units: "metric", f: ["01-01 New Year's Day", "05-01 Labour Day", "10-03 German Unity Day", "12-25 Christmas Day", "12-26 Second Day of Christmas"], e: ["goodfri", "eastermon", "ascension", "whitmon"] },
  fr: { name: "France", cur: "EUR", vat: 20, weekend: [6, 0], tel: { all: "112" }, units: "metric", f: ["01-01 New Year's Day", "05-01 Labour Day", "05-08 Victory in Europe Day", "07-14 Bastille Day", "08-15 Assumption", "11-01 All Saints' Day", "11-11 Armistice Day", "12-25 Christmas Day"], e: ["eastermon", "ascension", "whitmon"] },
  es: { name: "Spain", cur: "EUR", vat: 21, weekend: [6, 0], tel: { all: "112" }, units: "metric", f: ["01-01 New Year's Day", "01-06 Epiphany", "05-01 Labour Day", "08-15 Assumption", "10-12 National Day", "11-01 All Saints' Day", "12-06 Constitution Day", "12-08 Immaculate Conception", "12-25 Christmas Day"], e: ["goodfri"] },
  it: { name: "Italy", cur: "EUR", vat: 22, weekend: [6, 0], tel: { all: "112" }, units: "metric", f: ["01-01 New Year's Day", "01-06 Epiphany", "04-25 Liberation Day", "05-01 Labour Day", "06-02 Republic Day", "08-15 Ferragosto", "11-01 All Saints' Day", "12-08 Immaculate Conception", "12-25 Christmas Day", "12-26 Saint Stephen's Day"], e: ["eastermon"] },
  pt: { name: "Portugal", cur: "EUR", vat: 23, weekend: [6, 0], tel: { all: "112" }, units: "metric", f: ["01-01 New Year's Day", "04-25 Freedom Day", "05-01 Labour Day", "06-10 Portugal Day", "08-15 Assumption", "10-05 Republic Day", "11-01 All Saints' Day", "12-01 Restoration of Independence", "12-08 Immaculate Conception", "12-25 Christmas Day"], e: ["goodfri", "easter", "corpus"] },
  nl: { name: "Netherlands", cur: "EUR", vat: 21, weekend: [6, 0], tel: { all: "112" }, units: "metric", f: ["01-01 New Year's Day", "04-27 King's Day", "12-25 Christmas Day", "12-26 Second Day of Christmas"], e: ["goodfri", "easter", "eastermon", "ascension", "whitmon"] },
  br: { name: "Brazil", cur: "BRL", vat: null, weekend: [6, 0], tel: { police: "190", ambulance: "192", fire: "193" }, units: "metric",
    f: ["01-01 New Year's Day", "04-21 Tiradentes", "05-01 Labour Day", "09-07 Independence Day", "10-12 Our Lady of Aparecida", "11-02 All Souls' Day", "11-15 Republic Day", "11-20 Black Consciousness Day", "12-25 Christmas Day"],
    e: ["carnmon", "carntue", "goodfri"], note: "Taxes on sales (ICMS, ISS, PIS/COFINS) depend on the state and the product." },
  mx: { name: "Mexico", cur: "MXN", vat: 16, weekend: [6, 0], tel: { all: "911" }, units: "metric", f: ["01-01 New Year's Day", "05-01 Labour Day", "09-16 Independence Day", "12-25 Christmas Day"], n: ["02-1-1 Constitution Day", "03-1-3 Benito Juárez Day", "11-1-3 Revolution Day"] },
  ng: { name: "Nigeria", cur: "NGN", vat: 7.5, weekend: [6, 0], tel: { all: "112" }, units: "metric", f: ["01-01 New Year's Day", "05-01 Workers' Day", "06-12 Democracy Day", "10-01 Independence Day", "12-25 Christmas Day", "12-26 Boxing Day"], e: ["goodfri", "eastermon"], i: ["mawlid", "fitr2", "adha2"] },
  za: { name: "South Africa", cur: "ZAR", vat: 15, weekend: [6, 0], tel: { police: "10111", ambulance: "10177", fire: "10177" }, units: "metric",
    f: ["01-01 New Year's Day", "03-21 Human Rights Day", "04-27 Freedom Day", "05-01 Workers' Day", "06-16 Youth Day", "08-09 National Women's Day", "09-24 Heritage Day", "12-16 Day of Reconciliation", "12-25 Christmas Day", "12-26 Day of Goodwill"],
    e: ["goodfri", "eastermon"], sundayRule: true },
};
// a phone set to one of these regions → that country; anything else asks
export const ALIASES = { uk: "gb" };

const pad = (n) => String(n).padStart(2, "0");
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const at = (y, m, d) => new Date(y, m - 1, d, 12);   // noon: no daylight-saving edge
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

/** Western Easter Sunday (Anonymous Gregorian computus). */
export function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  return at(y, mo, da);
}
/** Orthodox (and Coptic) Easter Sunday, in the Gregorian calendar (Meeus' Julian computus + the 13-day gap, valid 1900–2099). */
export function orthodoxEaster(y) {
  const a = y % 4, b = y % 7, c = y % 19, d = (19 * c + 15) % 30, e = (2 * a + 4 * b - d + 34) % 7;
  const mo = Math.floor((d + e + 114) / 31), da = ((d + e + 114) % 31) + 1;
  return addDays(at(y, mo, da), 13);
}
/** The k-th weekday `wd` of month `m` (k = -1: the last one). */
export function nthWeekday(y, m, wd, k) {
  if (k > 0) { const first = at(y, m, 1); return addDays(first, ((wd - first.getDay() + 7) % 7) + (k - 1) * 7); }
  const last = at(y, m + 1, 0); return addDays(last, -((last.getDay() - wd + 7) % 7));
}

let HFMT = null;
const hijriParts = (d) => {
  try { HFMT = HFMT || new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { day: "numeric", month: "numeric", year: "numeric" }); } catch (e) { return null; }
  const p = HFMT.formatToParts(d), g = (t) => +((p.find((x) => x.type === t) || {}).value || 0);
  return { y: g("year"), m: g("month"), d: g("day") };
};
const H_CACHE = new Map();
/** Gregorian days of year y with their Umm al-Qura date — one scan per year, kept. */
function hijriYear(y) {
  if (H_CACHE.has(y)) return H_CACHE.get(y);
  const out = [];
  for (let d = at(y, 1, 1); d.getFullYear() === y; d = addDays(d, 1)) { const h = hijriParts(d); if (!h) break; out.push([iso(d), h]); }
  H_CACHE.set(y, out); return out;
}
/** Today's date in the Hijri calendar, e.g. { y: 1448, m: 4, d: 29 } (or null where the phone lacks it). */
export const hijriOf = (date) => hijriParts(date instanceof Date ? date : new Date(date));

/** Every public holiday of a country in year y, in order: [{ date: "2026-05-27", name, lunar? }]. */
export function holidays(code, y) {
  const c = COUNTRIES[code]; if (!c) return [];
  const out = [], put = (d, name, extra) => out.push({ date: iso(d), name, ...(extra || {}) });
  for (const s of c.f || []) { const [md, ...n] = s.split(" "); const [m, d] = md.split("-").map(Number); put(at(y, m, d), n.join(" ")); }
  for (const s of c.n || []) { const m = /^(\d\d)-(\d)-(-?\d) (.*)$/.exec(s); if (m) put(nthWeekday(y, +m[1], +m[2], +m[3]), m[4]); }
  if (c.victoria) { let d = at(y, 5, 24); while (d.getDay() !== 1) d = addDays(d, -1); put(d, "Victoria Day"); }
  const E = easter(y), O = orthodoxEaster(y);
  for (const k of c.e || []) put(addDays(E, EAS[k][1]), EAS[k][0]);
  for (const s of c.o || []) { const [off, ...n] = s.split(" "); put(addDays(O, +off), n.join(" ")); }
  if ((c.i || []).length) {
    const days = hijriYear(y);
    for (const k of c.i) {
      const [name, hm, hd, n] = ISL[k];
      // the holiday's first day may fall in this Gregorian year once or (rarely) twice
      days.forEach(([d, h], idx) => { if (h.m === hm && h.d === hd) for (let j = 0; j < n; j++) { const dd = addDays(at(y, +d.slice(5, 7), +d.slice(8)), j); out.push({ date: iso(dd), name, lunar: true, ...(n > 1 ? { day: j + 1 } : {}) }); } });
    }
  }
  if (c.sundayRule) for (const h of [...out]) { const d = at(y, +h.date.slice(5, 7), +h.date.slice(8)); if (d.getDay() === 0) { const mon = iso(addDays(d, 1)); if (!out.some((x) => x.date === mon)) out.push({ date: mon, name: h.name + " " + tr("(observed)") }); } }
  const seen = new Set();
  return out.filter((h) => h.date.startsWith(String(y)) && !seen.has(h.date + h.name) && seen.add(h.date + h.name)).sort((a, b) => a.date.localeCompare(b.date));
}
/** The holiday on a day ("2026-05-27"), or null. */
export function holidayOn(code, day) { return holidays(code, +day.slice(0, 4)).find((h) => h.date === day) || null; }
/** A working day: not the weekend, not a public holiday. */
export function isWorkingDay(code, day) {
  const c = COUNTRIES[code]; if (!c) return true;
  const d = at(+day.slice(0, 4), +day.slice(5, 7), +day.slice(8, 10));
  return !c.weekend.includes(d.getDay()) && !holidayOn(code, day);
}
/** The first working day on or after `day` (a cheque due on Eid clears after it). */
export function nextWorkingDay(code, day) {
  let d = at(+day.slice(0, 4), +day.slice(5, 7), +day.slice(8, 10));
  for (let i = 0; i < 20 && !isWorkingDay(code, iso(d)); i++) d = addDays(d, 1);
  return iso(d);
}
/** The next holidays from `day` on (default the next 3, within a year). */
export function upcoming(code, day, n = 3) {
  const y = +day.slice(0, 4);
  return [...holidays(code, y), ...holidays(code, y + 1)].filter((h) => h.date >= day).slice(0, n);
}
/** Whole days from a to b ("YYYY-MM-DD"). */
export const daysBetween = (a, b) => Math.round((at(+b.slice(0, 4), +b.slice(5, 7), +b.slice(8, 10)) - at(+a.slice(0, 4), +a.slice(5, 7), +a.slice(8, 10))) / 864e5);

/** A guess from the phone: its time zone (Africa/Cairo → eg), else its region (ar-EG → eg), else null. */
export function guessCountry(nav = typeof navigator !== "undefined" ? navigator : {}, tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return ""; } })()) {
  const TZ = { "Africa/Cairo": "eg", "Asia/Riyadh": "sa", "Asia/Dubai": "ae", "Asia/Kuwait": "kw", "Asia/Qatar": "qa", "Asia/Bahrain": "bh", "Asia/Muscat": "om", "Asia/Amman": "jo", "Asia/Beirut": "lb",
    "Africa/Casablanca": "ma", "Africa/Algiers": "dz", "Africa/Tunis": "tn", "Europe/Istanbul": "tr", "Asia/Karachi": "pk", "Asia/Kolkata": "in", "Asia/Calcutta": "in", "Asia/Jakarta": "id", "Asia/Kuala_Lumpur": "my",
    "Europe/London": "gb", "Europe/Berlin": "de", "Europe/Paris": "fr", "Europe/Madrid": "es", "Europe/Rome": "it", "Europe/Lisbon": "pt", "Europe/Amsterdam": "nl", "America/Sao_Paulo": "br", "America/Mexico_City": "mx",
    "Africa/Lagos": "ng", "Africa/Johannesburg": "za", "America/Toronto": "ca", "America/Vancouver": "ca" };
  // where the phone IS (its time zone) says more than its language (an Egyptian phone is often set to en-US)
  if (TZ[tz]) return TZ[tz];
  if (/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage)|^Pacific\/Honolulu/.test(tz || "")) return "us";
  // a language's region is a weaker hint ("en-US" is just most phones' default, so it is not counted)
  for (const l of [].concat(nav.languages || [], nav.language || [])) { if (/^en[-_]US$/i.test(String(l))) continue; const m = /[-_]([A-Za-z]{2})\b/.exec(String(l)); if (m) { const k = ALIASES[m[1].toLowerCase()] || m[1].toLowerCase(); if (COUNTRIES[k]) return k; } }
  return null;
}
/** The person's country: the saved choice, else the phone's guess (not saved until they confirm). */
export function myCountry(store = typeof localStorage !== "undefined" ? localStorage : null) {
  try { const v = store && store.getItem(COUNTRY_KEY); if (v && COUNTRIES[v]) return v; } catch (e) {}
  return guessCountry();
}
/** Only a country the person chose — what defaults (currency, VAT) follow; a guess never changes their numbers. */
export function savedCountry(store = typeof localStorage !== "undefined" ? localStorage : null) {
  try { const v = store && store.getItem(COUNTRY_KEY); return v && COUNTRIES[v] ? v : null; } catch (e) { return null; }
}
export function setCountry(code, store = typeof localStorage !== "undefined" ? localStorage : null) {
  try { if (COUNTRIES[code]) store.setItem(COUNTRY_KEY, code); else store.removeItem(COUNTRY_KEY); } catch (e) {}
}
/** The emergency numbers as short lines: ["Police 122", "Ambulance 123", "Fire 180"] or ["Emergency 112"]. */
export function emergencyLines(code) {
  const t = (COUNTRIES[code] || {}).tel || {};
  if (t.all) return [tr("Emergency {n}", { n: t.all })];
  return [["police", "Police {n}"], ["ambulance", "Ambulance {n}"], ["fire", "Fire {n}"]].filter(([k]) => t[k]).map(([k, s]) => tr(s, { n: t[k] }));
}
/** A holiday's name in the app's language: "Eid al-Adha (day 2)". */
export const holidayName = (h) => tr(h.name) + (h.day ? " (" + tr("day {n}", { n: h.day }) + ")" : "");
/** What Home's Today line shows for the country: a holiday today, or tomorrow (with "banks closed"), within 2 days. */
export function holidayNote(code, now = Date.now()) {
  if (!COUNTRIES[code]) return null;
  const today = iso(new Date(now));
  const h = upcoming(code, today, 1)[0]; if (!h) return null;
  const d = daysBetween(today, h.date);
  if (d > 2) return null;
  const name = holidayName(h);
  return { date: h.date, days: d, lunar: !!h.lunar, title: d === 0 ? tr("Today: {h}", { h: name }) : d === 1 ? tr("Tomorrow: {h}", { h: name }) : tr("In 2 days: {h}", { h: name }),
    sub: tr("A public holiday — banks and offices are closed") + (h.lunar ? " · " + tr("the date can move a day with the moon") : "") };
}
/** What a new Fleet / business system starts with in the chosen country (nothing when no country was chosen). */
export function countryDefaults(store) {
  const c = COUNTRIES[savedCountry(store)]; if (!c) return {};
  return { currency: c.cur, vat: c.vat == null ? 0 : c.vat, weekend: c.weekend };
}
