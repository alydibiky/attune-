/* ---- v9.2 Talk to an agent (Ali, 4 Nov 2026, picked 2A: "make sure that I can interact with the agents and set any rules I want and it
   understands"). Each agent keeps RULES, said in plain words (English, Egyptian Arabic, Franco numbers), read by CODE:
     price      "under 40,000" · "max 40k" · «أقل من ٤٠ ألف»                         → below
     stars      "only 4 stars" · "4 stars or more" · «٥ نجوم»                          → minStars
     rating     "rating 8 or more" · "rated above 4.5" · «تقييم ٨»                     → minRating
     walk       "walking under 500 m" · "within 1 km of the Haram" · «ماشي ٥٠٠ متر»   → maxWalk (metres)
     must have  "with breakfast" · "free cancellation" · «بفطار» · "must have parking"  → mustHave words
     avoid      "no hostels" · "not Agoda" · «بلاش …» · "avoid flynas"                  → avoid words / avoidSites
     only site  "only Booking" · «بوكينج بس»                                           → onlySites
     how often  "check every 6 hours" · «كل يوم» · "twice a day"                       → hours
     flights    "direct only" · "max 1 stop" · "1 bag" · "morning flights" · "not before 8am" · "EgyptAir only" · "business class"
   A sentence code can't read goes to the phone's model (the page passes it), whose JSON is cleaned by cleanRules — never trusted raw.
   applyRules(offers, rules) keeps the offers that follow every rule. Pure; tests: tests/unit/v922agentrules.test.mjs.            */
const AR_D = "٠١٢٣٤٥٦٧٨٩";
const latin = (s) => String(s || "").replace(/[٠-٩]/g, (d) => AR_D.indexOf(d)).replace(/٫/g, ".").replace(/،/g, ",");
const fold = (s) => latin(s).replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة(?=\s|$)/g, "ه").toLowerCase();
/** "40,000" / "40k" / "40 الف" / "1.5 مليون" → 40000 */
import { autonomyIn } from "./agents2.js";
import { tr } from "./i18n.js";   // v9.4 G7
export function amountIn(s) {
  const m = /(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|الف|ألف|آلاف|الاف|m|million|مليون)?/i.exec(latin(s)); if (!m) return null;
  let v = parseFloat(m[1].replace(/,/g, "")); const u = (m[2] || "").toLowerCase();
  if (/^(k|thousand|الف|ألف|آلاف|الاف)$/.test(u)) v *= 1000; if (/^(m|million|مليون)$/.test(u)) v *= 1e6;
  return isFinite(v) && v > 0 ? Math.round(v) : null;
}
const SITES = { booking: "booking", "بوكينج": "booking", "بوكنج": "booking", agoda: "agoda", "اجودا": "agoda", expedia: "expedia", airbnb: "airbnb", almosafer: "almosafer", "المسافر": "almosafer",
  amazon: "amazon", "امازون": "amazon", noon: "noon", "نون": "noon", jumia: "jumia", "جوميا": "jumia", skyscanner: "skyscanner", kayak: "kayak", momondo: "momondo", wego: "wego", "google flights": "google",
  egyptair: "egyptair", "مصر للطيران": "egyptair", "مصر للطيران": "egyptair", saudia: "saudia", "السعوديه": "saudia", flynas: "flynas", "طيران ناس": "flynas", flyadeal: "flyadeal", "nile air": "nileair", "نايل اير": "nileair",
  "air arabia": "airarabia", "العربيه للطيران": "airarabia", emirates: "emirates", "الاماراتيه": "emirates", qatar: "qatar", "القطريه": "qatar", turkish: "turkish", "التركيه": "turkish" };
export const AIRLINES = ["egyptair", "saudia", "flynas", "flyadeal", "nileair", "airarabia", "emirates", "qatar", "turkish"];
const siteWords = (t) => Object.keys(SITES).filter((k) => new RegExp("(^|[^\\p{L}])" + k + "($|[^\\p{L}])", "iu").test(t)).map((k) => SITES[k]);

export function cleanRules(r = {}) {
  const o = {}, num = (v, lo, hi) => { const x = +v; return isFinite(x) && x >= lo && x <= hi ? x : null; };
  const words = (l) => [...new Set((Array.isArray(l) ? l : []).map((x) => String(x || "").trim().toLowerCase().slice(0, 40)).filter((x) => x.length >= 2))].slice(0, 12);
  if (num(r.below, 1, 1e9)) o.below = Math.round(+r.below);
  if (num(r.minStars, 1, 5)) o.minStars = Math.round(+r.minStars);
  if (num(r.minRating, 1, 10)) o.minRating = +r.minRating;
  if (num(r.maxWalk, 50, 50000)) o.maxWalk = Math.round(+r.maxWalk);
  if (num(r.hours, 1, 168)) o.hours = Math.round(+r.hours);
  if (num(r.maxStops, 0, 3) != null) o.maxStops = Math.round(+r.maxStops);
  if (num(r.bags, 0, 4) != null) o.bags = Math.round(+r.bags);
  if (["morning", "afternoon", "evening", "night"].includes(r.timeOfDay)) o.timeOfDay = r.timeOfDay;
  if (num(r.notBefore, 0, 23) != null) o.notBefore = Math.round(+r.notBefore);
  if (num(r.notAfter, 0, 23) != null) o.notAfter = Math.round(+r.notAfter);
  if (["economy", "premium", "business", "first"].includes(r.cabin)) o.cabin = r.cabin;
  for (const k of ["mustHave", "avoid", "onlySites", "avoidSites"]) { const w = words(r[k]); if (w.length) o[k] = w; }
  if (r.autonomy === "notify" || r.autonomy === "ask") o.autonomy = r.autonomy;
  else if (r.autonomy && typeof r.autonomy === "object" && num(r.autonomy.auto, 1, 1e9)) o.autonomy = { auto: Math.round(+r.autonomy.auto) };
  return o;
}
/** Merge a new rule into the agent's rules (a new value replaces the old one; word lists add up; "any" clears). */
export function mergeRules(old = {}, add = {}) {
  const o = { ...old };
  for (const [k, v] of Object.entries(add)) o[k] = Array.isArray(v) ? [...new Set([...(o[k] || []), ...v])] : v;
  if (o.onlySites && o.avoidSites) o.avoidSites = o.avoidSites.filter((s) => !o.onlySites.includes(s));
  return cleanRules(o);
}
export const dropRule = (rules, key, val) => { const o = { ...rules }; if (val != null && Array.isArray(o[key])) { o[key] = o[key].filter((x) => x !== val); if (!o[key].length) delete o[key]; } else delete o[key]; return o; };

/** A sentence → { rules } (what it sets) or null when code can't read it. */
export function parseRule(text) {
  const raw = String(text || "").trim(), t = fold(raw);
  if (!t) return null;
  const r = {};
  // v9.4 G7: how much the agent may do by itself — "only tell me" · "ask me first" · "buy by itself under 7,500"
  const au = autonomyIn(raw); if (au) { r.autonomy = au; return r; }
  // how often
  let m = /every\s+(\d{1,3})\s*(h|hours?|ساعه|ساعات)|كل\s+(\d{1,3})\s*(ساعه|ساعات)/i.exec(t);
  if (m) r.hours = +(m[1] || m[3]);
  else if (/\b(every hour|hourly)\b|كل ساعه/.test(t)) r.hours = 1;
  else if (/\btwice a day\b|مرتين في اليوم/.test(t)) r.hours = 12;
  else if (/\b(every day|daily|once a day)\b|كل يوم|مره في اليوم/.test(t) && /\b(check|look|search)\b|دور|شوف|اتاكد|افحص/.test(t)) r.hours = 24;
  // price
  m = /\b(under|below|less than|max(?:imum)?|at most|no more than|up to|cheaper than)\s+(?:egp|le|sar|aed|usd|\$)?\s*(\d[\d,.]*\s*(?:k|thousand|m|million)?)|(?:اقل من|تحت|مش اكتر من|ميزيدش عن|بحد اقصي|لحد)\s*(\d[\d,.]*\s*(?:الف|ألف|مليون)?)/i.exec(t);
  if (m) { const v = amountIn(m[2] || m[3]); if (v && v >= 20) r.below = v; }
  // stars
  m = /(\d)\s*[- ]?\s*(?:stars?|نجوم|نجمه|نجمات|\*)/i.exec(t); if (m && +m[1] >= 1 && +m[1] <= 5) r.minStars = +m[1];
  // rating
  m = /(?:rating|rated|score|reviews?|تقييم|تقيمه|ريفيو)\s*(?:of\s*|above\s*|over\s*|at least\s*|from\s*|فوق\s*|اكتر من\s*|من\s*)?(\d(?:\.\d)?|10)/i.exec(t); if (m) r.minRating = +m[1];
  // walking distance
  m = /(\d[\d,.]*)\s*(km|kilometers?|كيلو|كم|m|meters?|metres?|متر|م)(?![a-z؀-ۿ])/i.exec(t);
  if (m && /\b(walk|walking|within|close|near|from|distance|away)\b|مشي|ماشي|قريب|بعيد|المسافه|من الحرم|عن الحرم/.test(t)) { const v = parseFloat(m[1].replace(/,/g, "")); r.maxWalk = Math.round(/^(km|kilo|كيلو|كم)/i.test(m[2]) ? v * 1000 : v); }
  // flights
  if (/\b(direct|non-?stop|no stops?)\b|مباشر|من غير ترانزيت|بدون ترانزيت|من غير توقف/.test(t)) r.maxStops = 0;
  m = /\b(?:max(?:imum)?|at most|up to)\s*(\d)\s*stops?\b|(\d)\s*stops? (?:max|at most)|ترانزيت واحد|توقف واحد/.exec(t); if (m) r.maxStops = m[1] ? +m[1] : m[2] ? +m[2] : 1;
  m = /(\d)\s*(?:checked\s*)?bags?\b|(\d)\s*(?:شنط|شنطه|شنطة)|\b(?:a|one|with)\s+(?:checked\s+)?bag\b|بشنطه|بشنطة|شنطه واحده/.exec(t); if (m) r.bags = m[1] ? +m[1] : m[2] ? +m[2] : 1;
  if (/\b(no bags?|hand luggage only|carry-?on only)\b|من غير شنط|شنطه يد بس/.test(t)) r.bags = 0;
  if (/\bmorning\b|الصبح|صباحي/.test(t)) r.timeOfDay = "morning"; else if (/\bafternoon\b|الضهر|بعد الضهر/.test(t)) r.timeOfDay = "afternoon";
  else if (/\bevening\b|بالليل|المسا|مسائي/.test(t) && !/\bnight\b/.test(t)) r.timeOfDay = "evening"; else if (/\b(night|red-?eye)\b/.test(t)) r.timeOfDay = "night";
  m = /\b(?:not before|after)\s*(\d{1,2})\s*(am|pm)?\b|(?:مش قبل|بعد)\s*(?:الساعه\s*)?(\d{1,2})/i.exec(t); if (m && /\b(not before|after|flight|leave|depart)\b|مش قبل|بعد الساعه/.test(t)) { let h = +(m[1] || m[3]); if (/pm/i.test(m[2] || "") && h < 12) h += 12; r.notBefore = h; }
  m = /\b(?:not after|before)\s*(\d{1,2})\s*(am|pm)?\b|(?:مش بعد|قبل)\s*(?:الساعه\s*)?(\d{1,2})/i.exec(t); if (m && /\b(not after|before)\b|مش بعد|قبل الساعه/.test(t) && !r.notBefore) { let h = +(m[1] || m[3]); if (/pm/i.test(m[2] || "") && h < 12) h += 12; r.notAfter = h; }
  if (/\bbusiness( class)?\b|بيزنس|درجه رجال الاعمال/.test(t)) r.cabin = "business"; else if (/\bfirst class\b|الدرجه الاولي/.test(t)) r.cabin = "first"; else if (/\bpremium economy\b/.test(t)) r.cabin = "premium"; else if (/\beconomy\b|اقتصادي|سياحي/.test(t)) r.cabin = "economy";
  // sites / airlines: only … / not …
  const named = siteWords(t);
  if (named.length) {
    if (/\b(only|just)\b|بس\b|فقط/.test(t) && !/\b(not|no|avoid|except|without)\b|مش|بلاش|غير|ماعدا|من غير/.test(t)) r.onlySites = named;
    else if (/\b(not|no|avoid|never|except|without|skip)\b|مش|بلاش|ماعدا|من غير|متجيبش|ابعد عن/.test(t)) r.avoidSites = named;
    else if (/\b(prefer|use|on)\b|عايز|يفضل|احسن/.test(t)) r.onlySites = named;
  }
  // must have / avoid words (the hotel / product words people care about)
  const HAVE = [["breakfast", /breakfast|فطار|افطار|إفطار/], ["free cancellation", /free cancell?ation|الغاء مجاني|إلغاء مجاني|cancel for free|cancel free/],
    ["pay at property", /pay at (?:the )?(?:property|hotel)|no prepayment|pay (?:later|on arrival)|الدفع في الفندق|ادفع في الفندق|الدفع عند الوصول|من غير دفع مقدم|بدون دفع مقدم|من غير ما ادفع مقدم/], ["parking", /parking|جراج|ركنه|موقف عربيات/],
    ["pool", /\bpool\b|حمام سباحه|بيسين/], ["wifi", /wi-?fi|واي فاي|نت/], ["haram view", /haram view|view of the haram|كعبه|فيو الحرم|اطلاله علي الحرم/], ["new", /\bnew only\b|\bbrand new\b|جديد بس|متبرشم/],
    ["warranty", /warranty|ضمان/], ["family room", /family room|غرفه عائليه|اوضه عيله/], ["kitchen", /kitchen|مطبخ/]];
  const AVOID = [["hostel", /hostels?|نزل/], ["used", /\bused\b|مستعمل/], ["refurbished", /refurb(ished)?|متجدد/], ["shared bathroom", /shared bath(room)?|حمام مشترك/], ["apartment", /\bapartments?\b|شقق|شقه/]];
  const neg = /\b(no|not|avoid|without|never|don'?t want|skip|except)\b|من غير|بدون|بلاش|مش عايز|ماعدا/;
  for (const [w, re] of AVOID) if (re.test(t) && (neg.test(t) || w === "used" || w === "refurbished") && !(w === "used" && /\bused is ok\b|مستعمل عادي/.test(t))) (r.avoid = r.avoid || []).push(w);
  for (const [w, re] of HAVE) if (re.test(t) && !(r.avoid || []).includes(w)) { if (neg.test(t) && !/\b(with|must|need|include)\b|ب\S|لازم|محتاج|يكون فيه/.test(t)) (r.avoid = r.avoid || []).push(w); else (r.mustHave = r.mustHave || []).push(w); }
  if (/\bnew only\b|جديد بس/.test(t)) r.avoid = [...new Set([...(r.avoid || []), "used", "refurbished"])];
  const c = cleanRules(r);
  return Object.keys(c).length ? c : null;
}

/** The rules as chips: [{ key, val?, en, v }] — each can be removed on its own. */
export function ruleChips(rules = {}) {
  const out = [], R = rules;
  if (R.below) out.push({ key: "below", en: "under {p}", v: { p: R.below.toLocaleString("en-US") } });
  if (R.minStars) out.push({ key: "minStars", en: "{n}+ stars", v: { n: R.minStars } });
  if (R.minRating) out.push({ key: "minRating", en: "rating {n}+", v: { n: R.minRating } });
  if (R.maxWalk) out.push({ key: "maxWalk", en: "walk under {d}", v: { d: R.maxWalk >= 1000 ? (R.maxWalk / 1000) + " km" : R.maxWalk + " m" } });
  if (R.maxStops === 0) out.push({ key: "maxStops", en: "Direct only" }); else if (R.maxStops) out.push({ key: "maxStops", en: "max {n} stops", v: { n: R.maxStops } });
  if (R.bags != null) out.push({ key: "bags", en: R.bags ? "{n} bags" : "No checked bag", v: { n: R.bags } });
  if (R.timeOfDay) out.push({ key: "timeOfDay", en: { morning: "Morning", afternoon: "Afternoon", evening: "Evening", night: "Night" }[R.timeOfDay] });
  if (R.notBefore != null) out.push({ key: "notBefore", en: "not before {h}:00", v: { h: R.notBefore } });
  if (R.notAfter != null) out.push({ key: "notAfter", en: "not after {h}:00", v: { h: R.notAfter } });
  if (R.cabin) out.push({ key: "cabin", en: { economy: "Economy", premium: "Premium economy", business: "Business", first: "First class" }[R.cabin] });
  for (const w of R.mustHave || []) out.push({ key: "mustHave", val: w, en: "with {w}", v: { w: tr(w) } });
  for (const w of R.avoid || []) out.push({ key: "avoid", val: w, en: "no {w}", v: { w: tr(w) } });
  for (const w of R.onlySites || []) out.push({ key: "onlySites", val: w, en: "only {w}", v: { w: brandName(w) } });
  for (const w of R.avoidSites || []) out.push({ key: "avoidSites", val: w, en: "not {w}", v: { w: brandName(w) } });
  if (R.hours) out.push({ key: "hours", en: R.hours === 24 ? "check every day" : "check every {n} h", v: { n: R.hours } });
  if (R.autonomy === "notify") out.push({ key: "autonomy", en: "Only tell me" });
  else if (R.autonomy === "ask") out.push({ key: "autonomy", en: "Ask me first" });
  else if (R.autonomy && R.autonomy.auto) out.push({ key: "autonomy", en: "By itself under {p}", v: { p: R.autonomy.auto.toLocaleString("en-US") } });
  return out;
}

const siteKey = (o) => fold(o && (o.site || o.seller || o.airline || "") + " " + ((o && o.href) || "")).replace(/\s+/g, "");
const hourOf = (o) => { const m = /\b(\d{1,2}):(\d{2})\b/.exec(String((o && (o.depart || o.text)) || "")); return m ? +m[1] : null; };
const starsOf = (o) => { const m = /(\d)\s*[- ]?\s*(?:stars?|star hotel|نجوم|نجمات|★{0,1}\s*hotel)/i.exec(String((o && o.text) || "")); return m ? +m[1] : (o && o.stars) || null; };
const ratingOf = (o) => { if (o && o.rating) return +o.rating; const m = /(?:scored|rating|rated|تقييم)?\s*(\d[.,]\d)\b/.exec(String((o && o.text) || "")); return m ? parseFloat(m[1].replace(",", ".")) : null; };
const distOf = (o) => { const d = /(\d+(?:[.,]\d+)?)\s*(km|كم|m\b|متر|م\b)/i.exec(" " + String((o && o.text) || "") + " "); return d ? Math.round(parseFloat(d[1].replace(",", ".")) * (/km|كم/i.test(d[2]) ? 1000 : 1)) : (o && o.dist) || null; };
// v9.8 (Ali: "I want to filter free cancellation, pay at property, with breakfast"): what the offer's own card must SAY — "breakfast
// available for EGP 300" is not breakfast included
const WORD_RE = { breakfast: /breakfast (?:is )?included|includes breakfast|with breakfast|breakfast & |free breakfast|الإفطار مشمول|الافطار مشمول|شامل الإفطار|شامل الافطار|فطار مجاني|إفطار مجاني|إفطار مشمول/i,
  "free cancellation": /free cancell?ation|cancel for free|إلغاء مجاني|الغاء مجاني/i,
  "pay at property": /no prepayment|pay at (?:the )?(?:property|hotel)|pay (?:later|on arrival)|reserve now,? pay|لا (?:يلزم|حاجة ل)(?:ل)?(?:ال)?دفع (?:ال)?مسبق|بدون دفع مسبق|الدفع (?:في|عند) (?:الفندق|مكان الإقامة|الوصول)/i, hostel: /hostel/i, used: /\bused\b|مستعمل|pre-?owned/i,
  refurbished: /refurb|renewed|متجدد/i, "shared bathroom": /shared bath/i, apartment: /apartment|شقه|شقة/i, "haram view": /haram view|kaaba view|view of the haram/i };
const hasWord = (o, w) => (WORD_RE[w] || new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")).test(`${(o && o.name) || ""} ${(o && o.text) || ""}`);
/** Does this offer follow every rule? A rule that can't be checked on this offer (no stars written) does not drop it. */
export function followsRules(o, R = {}) {
  if (!o) return false;
  if (R.below && o.price > R.below) return false;
  const st = starsOf(o); if (R.minStars && st != null && st < R.minStars) return false;
  const rt = ratingOf(o); if (R.minRating && rt != null && (R.minRating > 5 ? rt : rt <= 5 ? rt : rt / 2) < R.minRating) return false;
  const d = distOf(o); if (R.maxWalk && d != null && d > R.maxWalk) return false;
  if (R.maxStops != null && o.stops != null && o.stops > R.maxStops) return false;
  const h = o.departHour != null ? o.departHour : hourOf(o);
  if (h != null) { if (R.notBefore != null && h < R.notBefore) return false; if (R.notAfter != null && h > R.notAfter) return false;
    if (R.timeOfDay) { const ok = { morning: h >= 5 && h < 12, afternoon: h >= 12 && h < 17, evening: h >= 17 && h < 22, night: h >= 22 || h < 5 }[R.timeOfDay]; if (!ok) return false; } }
  const sk = siteKey(o);
  if ((R.onlySites || []).length && !R.onlySites.some((s) => sk.includes(s))) return false;
  if ((R.avoidSites || []).some((s) => sk.includes(s))) return false;
  if ((R.avoid || []).some((w) => hasWord(o, w))) return false;
  if ((R.mustHave || []).some((w) => !hasWord(o, w) && /breakfast|cancell?ation|view|pay at property/.test(w) && String(o.text || "").length > 40)) return false;
  return true;
}
export const applyRules = (offers, R) => (!R || !Object.keys(R).length ? offers || [] : (offers || []).filter((o) => followsRules(o, R)));

/** Where an agent is: needs you (an OK to buy) · found (something under the limit / offers) · working · paused · done. */
/** v9.9.4 (Ali's screenshot: "Found one under your price: 41,495" while his rules were 5★ within 1 km and the best that followed them
 *  was 45,711 — over his 45,000): what an agent "found" must follow its rules. → the agent with `found` = the cheapest offer that
 *  follows every rule and is at or under the limit, or without `found` when none does (offers read with no hotel facts are kept). */
export function withRuleFound(a) {
  if (!a || !a.found || !a.rules || !Object.keys(a.rules).length || !(a.best3 || []).length || !(a.below > 0)) return a;
  const ok = applyRules(a.best3, a.rules).filter((o) => o.price > 0).sort((x, y) => x.price - y.price)[0];
  if (ok && ok.price <= a.below) return ok.price === a.found.price ? a : { ...a, found: { ...a.found, price: ok.price, ...(ok.href ? { href: ok.href } : {}), ...(ok.name ? { name: ok.name } : {}), ...(ok.checkin ? { checkin: ok.checkin, checkout: ok.checkout } : {}) } };
  const { found, ...rest } = a; return rest;
}
export function agentStatus(a, now = Date.now()) {
  if (!a) return "working";
  // v9.4 the new agents
  if (a.kind === "send") return a.state === "sent" || a.state === "opened" ? "done" : a.on === false ? "paused" : "working";
  if (a.kind === "trip") return a.at && a.at < now ? "done" : a.on === false ? "paused" : "working";
  if (a.kind === "slot") return a.on === false ? "paused" : a.slot && (a.slot.state === "open" || a.slot.state === "login") ? "needs" : "working";
  if (a.kind === "protect") { if (a.on === false) return "paused"; const p = ((a.checks || []).filter((c) => c.price > 0).slice(-1)[0] || {}).price; return p && a.paid && p <= a.paid * 0.97 ? "needs" : "working"; }
  if (a.step === "ordered") return "done";
  if (a.on === false) return "paused";
  if (a.pending && (a.step === "confirm" || a.kind === "buy")) return "needs";
  if (withRuleFound(a).found || applyRules(a.best3 || [], a.rules).length || (a.kind === "follow" && (a.runs || []).length)) return "found";
  return "working";
}
export const STATUS = { needs: ["Needs you", "amber"], found: ["Found", "blue"], working: ["Working", "blue"], paused: ["Paused", "gray"], done: ["Done", "gray"] };

// ---- the site's mark (a logo drawn by Attune — never a picture from the internet, never the plain word) ------------------------------
export const BRANDS = {
  booking: ["Booking.com", "B.", "#003580", "#fff"], agoda: ["Agoda", "a", "#5392f9", "#fff"], expedia: ["Expedia", "e", "#FFC72C", "#191E3B"], airbnb: ["Airbnb", "a", "#FF385C", "#fff"],
  almosafer: ["Almosafer", "al", "#1a2b6d", "#fff"], amazon: ["Amazon", "a", "#232F3E", "#FF9900"], noon: ["noon", "n", "#FEEE00", "#000"], jumia: ["Jumia", "J", "#F68B1E", "#fff"],
  google: ["Google Flights", "G", "#fff", "#1a73e8"], skyscanner: ["Skyscanner", "S", "#0062E3", "#fff"], kayak: ["KAYAK", "K", "#FF690F", "#fff"], momondo: ["momondo", "m", "#6e1fff", "#fff"],
  wego: ["Wego", "W", "#44B50C", "#fff"], egyptair: ["EgyptAir", "MS", "#00265D", "#fff"], saudia: ["Saudia", "SV", "#006C35", "#fff"], flynas: ["flynas", "XY", "#00A0DE", "#fff"],
  flyadeal: ["flyadeal", "F3", "#EC008C", "#fff"], nileair: ["Nile Air", "NP", "#00205B", "#C9A227"], airarabia: ["Air Arabia", "G9", "#E30613", "#fff"], emirates: ["Emirates", "EK", "#D71921", "#fff"],
  qatar: ["Qatar Airways", "QR", "#5C0632", "#fff"], turkish: ["Turkish Airlines", "TK", "#C70A0C", "#fff"], talabat: ["Talabat", "t", "#FF5A00", "#fff"], uber: ["Uber", "U", "#000", "#fff"],
};
const brandKey = (s) => { const f = fold(s).replace(/[^a-z0-9؀-ۿ]/g, ""); return Object.keys(BRANDS).find((k) => f.includes(k) || f.includes(fold(BRANDS[k][0]).replace(/[^a-z0-9]/g, ""))) || ""; };
/** The brand of a site / airline name or link → [name, mark, background, ink] (an unknown site: its first letter on the app's colour). */
export function brandOf(s) { const k = brandKey(s); if (k) return BRANDS[k]; const n = String(s || "").replace(/^https?:\/\/(www\.)?/, "").split(/[/.]/)[0]; return [n || "?", (n || "?").charAt(0).toUpperCase(), "var(--c-soft)", "var(--c-acc)"]; }
export const brandName = (k) => (BRANDS[k] ? BRANDS[k][0] : k);
/** Is this "name" only the website (an offer read before the hotel's own name was found)? */
// v9.6: a site's own label read as a name ("Price", "Book now") counts as no name
const GENERIC_NAME = /^(price|prices|total|total price|per night|a night|book|book now|reserve|select|choose|view deal|see availability|show prices|deal|deals|cheapest|best value|sponsored|السعر|احجز|الإجمالي)$/i;
export const isSiteName = (name, site = "") => { const n = String(name || "").trim(); return !n || n === site || GENERIC_NAME.test(n) || /^(www\.)?[a-z0-9-]+\.[a-z.]{2,}$/i.test(n) || !!(brandKey(n) && fold(n).replace(/[^a-z]/g, "").length <= 14 && BRANDS[brandKey(n)] && fold(BRANDS[brandKey(n)][0]).replace(/[^a-z]/g, "") === fold(n).replace(/[^a-z]/g, "")); };

/** v9.2 round 3 (Ali: "when it opens Booking it doesn't open the specific listing"): an offer read without its own link is searched by
 *  ITS name on the same site (Booking ss=, Amazon k=, a q= search) with the same dates — that hotel / product first, not the whole list. */
/** v9.8 (Ali: "filter free cancellation, pay at property, with breakfast"): Booking's search page gets its own filters for the two
 *  whose codes are known (free cancellation nflt fc=2, breakfast mealplan=1); every site's offers are then checked by their card's
 *  words (followsRules) — "pay at the property" has no known code, so it is checked by the words only. */
export function withHotelFilters(url, R = {}) {
  try { const u = new URL(url); if (!/booking\.com$/.test(u.hostname.replace(/^www\.|^m\./, "")) || !/searchresults/.test(u.pathname)) return url;
    const want = []; if ((R.mustHave || []).includes("free cancellation")) want.push("fc=2"); if ((R.mustHave || []).includes("breakfast")) want.push("mealplan=1");
    if (!want.length) return url; const have = (u.searchParams.get("nflt") || "").split(";").filter(Boolean);
    u.searchParams.set("nflt", [...new Set([...have, ...want])].join(";")); return u.toString(); } catch (e) { return url; }
}
/** v9.8 (Ali, 7 Nov: "the agents still don't redirect to the specific listing — fix it for good"): is this link an offer's OWN page
 *  (a hotel, a room, a product) — not a search, a map, a filter or a site's home? The same patterns as agent-kit.js LISTING. */
export const LISTING_RE = /\/hotel\/[a-z]{2}\/|\/hotel\/[^/?#]+\.html|[?&]hotel_?id=\d|\/hotels?\/detail|\/travel\/hotels\/[^?#]*entity|\.ksp(?:$|[?#])|\/hotel-detail|\/hotels\/[a-z-]+\/[a-z0-9-]*\d|\/hotels?\/[^?]*\d|\/rooms\/\d|\.h\d+\.hotel|hotel-information|\/ho\d+|\/property\/|\/dp\/[a-z0-9]{6,}|\/itm\/|\/p\/?(?:$|[?#])|\/p\/[a-z0-9-]+|-p-\d|\/product\/|\/products\/|\/ip\/|\/item\//i;
const NOT_OWN = /[?&#](?:map|sort|order|filter|nflt|page|offset|rows)=|\/(?:search|searchresults|map|reviews?|filter|login|signin|account|help|deals)(?:[/.?#]|$)/i;
export function isOwnPage(href) {
  if (!href || !/^https:\/\//.test(href)) return false;
  try { const u = new URL(href); if (LISTING_RE.test(u.pathname + u.search)) return true; if (NOT_OWN.test(href) || u.pathname.length < 6) return false; return true; } catch (e) { return false; }
}
/** How to open one offer: { url, direct } — direct = its own page (open it as it is, in the phone's browser);
 *  else the results page it came from + `goto` {name, price} so Attune's browser finds THAT offer and goes into its page. */
export function offerOpen(a, o) {
  const url = offerUrl(a, o);
  if (o && o.href && isOwnPage(o.href)) return { url, direct: true };
  const name = o && o.name && !isSiteName(o.name, a && a.site) ? String(o.name).slice(0, 120) : "";
  const results = (o && o.url) || (a && a.url) || url;
  return { url: results, direct: false, goto: { name, price: (o && o.price) || 0 } };
}
export function offerUrl(a, o) {
  if (o && o.href && /^https:\/\//.test(o.href)) {
    // a hotel's own page without the dates shows no price — the offer's days (and the search's guests) go into it
    try { const u = new URL(o.href); if (o.checkin && o.checkout && /booking\.com|agoda\.|expedia\.|airbnb\./.test(u.hostname) && !u.searchParams.has("checkin") && !u.searchParams.has("checkIn")) {
      u.searchParams.set("checkin", o.checkin); u.searchParams.set("checkout", o.checkout);
      try { const g = new URL(a.url || "").searchParams.get("group_adults") || new URL(a.url || "").searchParams.get("adults"); if (g) u.searchParams.set(/airbnb/.test(u.hostname) ? "adults" : "group_adults", g); } catch (e) {}
      return u.toString(); } } catch (e) {}
    return o.href;
  }
  const base = (o && o.url) || a.url || "", name = o && o.name && !isSiteName(o.name, a.site) ? String(o.name) : "";
  if (!name || !/^https:\/\//.test(base)) return base;
  try { const u = new URL(base); for (const k of ["ss", "k", "q", "query", "search", "textToSearch"]) if (u.searchParams.has(k)) { u.searchParams.set(k, name); return u.toString(); } } catch (e) {}
  return base;
}
