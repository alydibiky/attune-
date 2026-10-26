/* ---- v8.0 Agents (Ali, 25 Oct 2026, picked design A: "a page called Agents where Scout is put, and agents do several things —
   tell me when hotels near Masjid al-Haram are under 45k for 4 nights, order my favourite food from Talabat, tell me when my
   Amazon order arrives … and make sure it can open any app I ask: Uber, Booking, Amazon, Talabat, etc.").
   One sentence → one agent, read by CODE (never guessed; anything missing is asked):
     open   "open Uber" / «افتح طلبات»                → the app opens now (any app on the phone, by its name)
     do     "Uber to the airport", "order pizza on Talabat" → the right app opens with the search ready (agent.js planTask)
     watch  "tell me when hotels in Makkah are under 45k for 4 nights from 10 Dec" → a price watch (checked about every 12 hours,
            even with Attune closed — AgentWatch.kt; Check now opens the page inside Attune and reads the cheapest offer)
     track  "tell me when my Amazon order arrives"   → a delivery agent: the store app's own notifications are watched
            (MessageWatch.kt, rule app "pkgs:…") and Attune tells you "arriving today"
     order  "order my usual from Talabat: koshary Abou Tarek, large" → one tap opens Talabat with the order copied; the person
            presses Order and pays — an agent never pays
     scout  "find me a used Tucson 2022"              → Scout (it lives here now)
     alert  "tell me when Ahmed messages me"          → a message alert (watch.js)
   Pure; tests/unit/v1000agents.test.mjs.                                                                                       */
import { planTask, hotelLinks, shopLinks, tripDates } from "./agent.js";
import { parseWatch } from "./watch.js";
import { looksLikeGoal } from "./scout.js";
import { isoDay } from "./deadlines.js";

export const AGENTS_KEY = "attune:agents:v1";
const DAY = 86400000;
const fold = (s) => String(s || "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة(?=\s|$)/g, "ه").toLowerCase();

// ---- the apps people ask for by name (English, Arabic, Franco) — package, website, and what kind of app it is -----------------------
export const APPS = [
  { id: "uber", label: "Uber", names: "uber|اوبر|أوبر", pkg: "com.ubercab", web: "https://m.uber.com/", kind: "ride" },
  { id: "careem", label: "Careem", names: "careem|كريم", pkg: "com.careem.acma", web: "https://www.careem.com/", kind: "ride" },
  { id: "indrive", label: "inDrive", names: "in ?drive|indriver|ان درايف|اندرايف", pkg: "sinet.startup.inDriver", web: "https://indrive.com/", kind: "ride" },
  { id: "bolt", label: "Bolt", names: "bolt|بولت", pkg: "ee.mtakso.client", web: "https://bolt.eu/", kind: "ride" },
  { id: "swvl", label: "Swvl", names: "swvl|سويفل", pkg: "io.swvl.customer", web: "https://www.swvl.com/", kind: "ride" },
  { id: "booking", label: "Booking.com", names: "booking(?:\\.com)?|بوكينج|بوكنج", pkg: "com.booking", web: "https://www.booking.com/", kind: "stay" },
  { id: "airbnb", label: "Airbnb", names: "airbnb|اير ?بي ?ان ?بي", pkg: "com.airbnb.android", web: "https://www.airbnb.com/", kind: "stay" },
  { id: "agoda", label: "Agoda", names: "agoda|اجودا|أجودا", pkg: "com.agoda.mobile.consumer", web: "https://www.agoda.com/", kind: "stay" },
  { id: "expedia", label: "Expedia", names: "expedia|اكسبيديا", pkg: "com.expedia.bookings", web: "https://www.expedia.com/", kind: "stay" },
  { id: "almosafer", label: "Almosafer", names: "almosafer|المسافر", pkg: "com.almosafer.android", web: "https://www.almosafer.com/", kind: "stay" },
  { id: "skyscanner", label: "Skyscanner", names: "skyscanner|سكاي ?سكانر", pkg: "net.skyscanner.android.main", web: "https://www.skyscanner.net/", kind: "stay" },
  { id: "amazon", label: "Amazon", names: "amazon|امازون|أمازون", pkg: "com.amazon.mShop.android.shopping", alt: ["in.amazon.mShop.android.shopping"], web: "https://www.amazon.eg/", kind: "shop" },
  { id: "noon", label: "noon", names: "noon|نون", pkg: "com.noon.buyerapp", web: "https://www.noon.com/", kind: "shop" },
  { id: "jumia", label: "Jumia", names: "jumia|جوميا", pkg: "com.jumia.android", web: "https://www.jumia.com.eg/", kind: "shop" },
  { id: "shein", label: "SHEIN", names: "shein|شي ?ان", pkg: "com.zzkko", web: "https://www.shein.com/", kind: "shop" },
  { id: "temu", label: "Temu", names: "temu|تيمو", pkg: "com.einnovation.temu", web: "https://www.temu.com/", kind: "shop" },
  { id: "aliexpress", label: "AliExpress", names: "ali ?express|علي ?اكسبريس", pkg: "com.alibaba.aliexpresshd", web: "https://www.aliexpress.com/", kind: "shop" },
  { id: "talabat", label: "Talabat", names: "talabat|طلبات", pkg: "com.talabat", web: "https://www.talabat.com/", kind: "food" },
  { id: "elmenus", label: "elmenus", names: "elmenus|المنيوز|ال ?منيوز", pkg: "com.elmenus.app", web: "https://www.elmenus.com/", kind: "food" },
  { id: "breadfast", label: "Breadfast", names: "breadfast|بريدفاست", pkg: "com.breadfast", web: "https://www.breadfast.com/", kind: "food" },
  { id: "ubereats", label: "Uber Eats", names: "uber ?eats|اوبر ايتس", pkg: "com.ubercab.eats", web: "https://www.ubereats.com/", kind: "food" },
  { id: "aramex", label: "Aramex", names: "aramex|ارامكس|أرامكس", pkg: "com.aramex.android", web: "https://www.aramex.com/track", kind: "post" },
  { id: "bosta", label: "Bosta", names: "bosta|بوسطه|بوسطة", pkg: "com.bosta.customer", web: "https://bosta.co/tracking-shipments", kind: "post" },
  { id: "whatsapp", label: "WhatsApp", names: "whats ?app|واتس ?اب|الواتس", pkg: "com.whatsapp", web: "https://web.whatsapp.com/", kind: "app" },
  { id: "instagram", label: "Instagram", names: "instagram|insta|انستا|انستجرام", pkg: "com.instagram.android", web: "https://www.instagram.com/", kind: "app" },
  { id: "facebook", label: "Facebook", names: "facebook|fb|فيسبوك|فيس بوك|الفيس", pkg: "com.facebook.katana", web: "https://www.facebook.com/", kind: "app" },
  { id: "youtube", label: "YouTube", names: "youtube|يوتيوب|اليوتيوب", pkg: "com.google.android.youtube", web: "https://www.youtube.com/", kind: "app" },
  { id: "maps", label: "Google Maps", names: "google maps|maps|خرائط جوجل|جوجل ماب|الخرايط", pkg: "com.google.android.apps.maps", web: "https://maps.google.com/", kind: "app" },
  { id: "instapay", label: "InstaPay", names: "insta ?pay|انستا ?باي", pkg: "com.egyptianbanks.instapay", web: "https://www.instapay.eg/", kind: "app" },
  { id: "vodafonecash", label: "Vodafone Cash", names: "vodafone cash|فودافون كاش", pkg: "com.emeint.android.myservices", web: "https://web.vodafone.com.eg/", kind: "app" },
  { id: "fawry", label: "Fawry", names: "fawry|فوري", pkg: "com.fawry.myfawry", web: "https://myfawry.com/", kind: "app" },
  { id: "netflix", label: "Netflix", names: "netflix|نتفليكس", pkg: "com.netflix.mediaclient", web: "https://www.netflix.com/", kind: "app" },
  { id: "spotify", label: "Spotify", names: "spotify|سبوتيفاي", pkg: "com.spotify.music", web: "https://open.spotify.com/", kind: "app" },
];
const APP_RE = APPS.map((a) => [a, new RegExp("(?<![\\p{L}])(?:" + a.names + ")(?![\\p{L}])", "iu")]);
/** The catalogued app named in a text ("open Talabat", «من أمازون») — the longest name first (Uber Eats before Uber). */
export function appIn(text) {
  const t = fold(text); let best = null, len = 0;
  for (const [a, re] of APP_RE) { const m = re.exec(t); if (m && m[0].length > len) { best = a; len = m[0].length; } }
  return best;
}
/** Any app on the phone by its name (the phone's own list, [{pkg, label}]) — for apps not in the catalogue. */
export function installedNamed(name, installed = []) {
  const n = fold(name).replace(/[^\p{L}\p{N} ]/gu, "").trim(); if (n.length < 2) return null;
  const list = (installed || []).map((x) => ({ ...x, f: fold(x.label).replace(/[^\p{L}\p{N} ]/gu, "").trim() }));
  return list.find((x) => x.f === n) || list.find((x) => x.f.startsWith(n + " ") || n.startsWith(x.f + " ")) || list.find((x) => x.f.length >= 3 && (x.f.includes(n) || n.includes(x.f))) || null;
}

// ---- reading the sentence ------------------------------------------------------------------------------------------------------
const OPEN = /^\s*(?:please\s+)?(?:open|launch|start|run|go to|افتح|افتحلي|افتح لي|شغل|شغّل|ادخل على|دخلني على|روح على|ekhtah|efta7)\s+(?:the\s+|app\s+|ابلكيشن\s+|تطبيق\s+|برنامج\s+)?(.+?)(?:\s+(?:app|ابلكيشن|تطبيق))?\s*[.!؟?]?\s*$/iu;
const WHEN = /\b(tell|notify|alert|ping|let|warn)\s+me\b|\b(when|once|if)\b.*\b(under|below|less than|drops?|cheaper|goes down|falls?)\b|قولي|قول لي|نبهني|نبّهني|عرفني|عرّفني|بلغني|لما|لو\s.*(اقل|أقل|تحت|ينزل|نزل)/iu;
const PRICE_WORD = /\b(under|below|less than|cheaper than|lower than|drops? (?:to|below|under)|at most|max(?:imum)?|or less)\b|اقل من|أقل من|تحت|ينزل (?:عن|ل|تحت)|يبقي اقل|يبقى أقل|ميعديش|مايعديش|بحد اقصي|بحد أقصى/iu;
const ARRIVE = /\b(arriv\w*|deliver\w*|delivery|shipp\w*|out for delivery|dispatch\w*|track\w*|comes?|reach\w*)\b|يوصل|هيوصل|توصل|هتوصل|وصل|التوصيل|توصيل|الشحنه|الشحنة|اتشحن|في الطريق|يجي|هيجي|امتي|إمتى|امتى/iu;
const ORDER_W = /\b(order|get me|reorder)\b|اطلب|اطلبلي|اطلب لي|هاتلي/iu;
const USUAL = /\b(usual|favou?rite|my regular|same as last time|the same)\b|المعتاد|المفضل|اللي بحبه|اللي بطلبه|بتاعي المعتاد|زي كل مره|زي كل مرة|أكلي المفضل|اكلي المفضل/iu;

/** "45k", "45,000", "45 ألف", "٤٥ الف", "1.2m" → 45000 / 1200000 (the number next to the price words, else the biggest). */
export function limitIn(text) {
  const t = fold(text);
  const nums = [];
  const re = /(\d{1,3}(?:[,.]\d{3})+|\d+(?:\.\d+)?)\s*(k|الف|ألف|آلاف|الاف|m|مليون|million|thousand)?(?![\p{L}\d])/giu;
  let m;
  while ((m = re.exec(t))) {
    const raw = m[1], unit = (m[2] || "").toLowerCase();
    let v = /[,.]\d{3}$/.test(raw) && !/\.\d{1,2}$/.test(raw) ? +raw.replace(/[,.]/g, "") : +raw;
    if (/^(k|الف|ألف|آلاف|الاف|thousand)$/.test(unit)) v *= 1000; else if (/^(m|مليون|million)$/.test(unit)) v *= 1e6;
    // not a count of nights / people / a date / a year
    const after = t.slice(m.index + m[0].length, m.index + m[0].length + 14);
    if (!unit && /^\s*(nights?|ليالي|ليله|ليلة|people|persons?|adults?|guests?|اشخاص|أشخاص|افراد|days?|ايام|أيام|يوم|stars?|نجوم|km|كم)/iu.test(after)) continue;
    if (!unit && v >= 1900 && v <= 2100 && !/[,.]/.test(raw)) continue;
    nums.push({ v, at: m.index });
  }
  if (!nums.length) return 0;
  const pw = PRICE_WORD.exec(t);
  if (pw) { const near = nums.filter((n) => n.at >= pw.index).sort((a, b) => a.at - b.at)[0]; if (near) return near.v; }
  return Math.max(...nums.map((n) => n.v));
}
const CURRENCY = { EG: "EGP", SA: "SAR", AE: "AED", KW: "KWD", QA: "QAR", BH: "BHD", OM: "OMR", JO: "JOD", US: "USD", GB: "GBP", TR: "TRY", DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR" };
const curIn = (t, country) => /\$|usd|dollar|دولار/i.test(t) ? "USD" : /€|eur|euro|يورو/i.test(t) ? "EUR" : /sar|riyal|ريال/i.test(t) ? "SAR" : /aed|dirham|درهم/i.test(t) ? "AED" : /egp|جنيه|ج\.م|le\b/i.test(t) ? "EGP" : CURRENCY[country] || "EGP";
// places people say for Makkah / Madinah hotels → what Booking understands
const PLACES = [[/(masjid|masged|masgid|al|el)?\s*-?\s*haram|الحرم|المسجد الحرام|مكه|مكة|makkah|mecca|makka/i, "Masjid al-Haram, Makkah"], [/nabawi|المسجد النبوي|madinah|medina|المدينه|المدينة/i, "Al-Masjid an-Nabawi, Madinah"]];

/** "4 or 5 stars", "5-star", «٤ أو ٥ نجوم», "4+ stars" → [4, 5] (sorted, 1–5); none → []. */
export function starsIn(text) {
  const t = fold(text);
  const two = /([1-5])\s*(?:or|او|أو|-|–|to|و|,|\/)\s*([1-5])\s*[-\s]?(?:stars?|نجوم|نجمه|نجمة|★)/iu.exec(t);
  if (two) { const a = +two[1], b = +two[2]; const lo = Math.min(a, b), hi = Math.max(a, b); return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i); }
  const plus = /([1-5])\s*\+\s*(?:stars?|نجوم|★)|(?:at least|minimum|min)\s*([1-5])\s*[-\s]?stars?|([1-5])\s*(?:stars?|نجوم)\s*(?:or (?:more|above|better)|و?فوق|او اكتر|أو أكتر)/iu.exec(t);
  if (plus) { const a = +(plus[1] || plus[2] || plus[3]); return Array.from({ length: 6 - a }, (_, i) => a + i); }
  const one = /([1-5])\s*[-\s]?(?:stars?|نجوم|نجمه|نجمة|★)/iu.exec(t);
  return one ? [+one[1]] : [];
}
const NEAR = /\b(near|close|next to|walking|by the)\b|جنب|قريب|قدام|عند/iu;
/** Booking's search page for these fields: the stars and "within 1 km" as Booking's own filters, cheapest first. */
export function bookingUrl(f) {
  const nflt = [...(f.stars || []).map((n) => "class=" + n), ...(f.near ? ["distance=1000"] : [])].join(";");
  return hotelLinks(f)[0].url + (nflt ? "&nflt=" + encodeURIComponent(nflt) : "");
}
/** The start days to try inside a window: up to 6, spread evenly from the first possible day to the last. */
export function windowStarts(w, nights, max = 6) {
  const a = Date.parse(w.from + "T12:00:00"), last = Date.parse(w.to + "T12:00:00") - nights * DAY;
  if (!(last >= a)) return [w.from];
  const n = Math.min(max, Math.floor((last - a) / DAY) + 1), step = n > 1 ? (last - a) / (n - 1) : 0;
  return [...new Set(Array.from({ length: n }, (_, i) => isoDay(a + Math.round(step * i / DAY) * DAY)))];
}

/** The sentence → an agent draft: { kind, … , ask? } (ask = the one thing still missing, as a question) | null. */
export function parseAgent(text, opts = {}) {
  const t0 = String(text || "").replace(/\s+/g, " ").trim(); if (!t0 || t0.length > 400) return null;
  const t = fold(t0), now = opts.now || Date.now(), country = (opts.country || "EG").toUpperCase();
  const app = appIn(t0);
  // open an app — any app the phone has, by name
  const om = OPEN.exec(t0);
  if (om && !PRICE_WORD.test(t) && om[1].split(/\s+/).length <= 4) {
    const named = appIn(om[1]) || null;
    const inst = named ? null : installedNamed(om[1], opts.installed);
    if (named || inst) return { kind: "open", app: named ? { id: named.id, label: named.label, pkg: named.pkg, web: named.web } : { id: inst.pkg, label: inst.label, pkg: inst.pkg, web: "" } };
    return { kind: "open", app: null, name: om[1].trim(), ask: "I can't find “{x}” on this phone — what is the app called?" };
  }
  // a message alert ("tell me when Ahmed messages me") — before the delivery words
  const w = parseWatch(t0);
  if (w && !app) return { kind: "alert", rule: w, title: w.label };
  // a delivery: "tell me when my Amazon order arrives", «امتى طلب أمازون هيوصل»
  if (app && ["shop", "food", "post"].includes(app.kind) && ARRIVE.test(t) && !PRICE_WORD.test(t) && !(ORDER_W.test(t) && USUAL.test(t)) && (WHEN.test(t) || /\b(my|order|package|parcel|shipment)\b|طلب|طلبي|الطلب|الاوردر|الأوردر|الشحنه|الشحنة|الطرد|اوردر|أوردر/iu.test(t))) {
    const what = (/(?:order|package|parcel)\s+(?:of|for|—|-|:)\s*([^,.؟?]+)/i.exec(t0) || /(?:طلب|اوردر|أوردر)\s+(?!امازون|أمازون|نون|طلبات|جوميا)([؀-ۿ\w ]{3,30})/u.exec(t0) || [])[1] || "";
    return { kind: "track", app: { id: app.id, label: app.label, pkg: app.pkg, alt: app.alt || [], web: app.web }, what: what.trim(), title: app.label + " order" + (what ? " — " + what.trim() : "") };
  }
  // order my usual: "order my usual from Talabat: koshary, large", «اطلبلي أكلي المفضل من طلبات»
  if (ORDER_W.test(t) && (USUAL.test(t) || /:\s*\S/.test(t0)) && (!app || app.kind === "food" || app.kind === "shop")) {
    const a = app || APPS.find((x) => x.id === (opts.foodApp || "talabat"));
    const what = (/:\s*(.+)$/.exec(t0) || [])[1] || "";
    const saved = (opts.usual || {})[a.id] || "";
    return { kind: "order", app: { id: a.id, label: a.label, pkg: a.pkg, web: a.web }, what: (what || saved).trim(), title: "My usual from " + a.label,
      ...(what || saved ? {} : { ask: "What is your usual from {app}? (the place and the dish, e.g. Koshary Abou Tarek — large + rice pudding)" }) };
  }
  // a price watch: "tell me when hotels near the Haram are under 45k for 4 nights from 10 Dec"
  const limit = limitIn(t0);
  if ((WHEN.test(t) || PRICE_WORD.test(t)) && PRICE_WORD.test(t) && limit > 0) {
    const cur = curIn(t, country);
    const url0 = (/https:\/\/\S+/.exec(t0) || [])[0];
    if (url0) return { kind: "watch", site: (url0.replace(/^https:\/\/(www\.)?/, "").split("/")[0]), url: url0, below: limit, currency: cur, title: url0.replace(/^https:\/\/(www\.)?/, "").slice(0, 40) };
    if (/\b(hotels?|rooms?|stay|apartments?)\b|فندق|فنادق|اوضه|أوضة|غرفه|غرفة|شقه|شقة|اقامه|إقامة/iu.test(t)) {
      const place = (PLACES.find(([re]) => re.test(t)) || [])[1];
      const m = /(?:^|\s)(?:in|at|near|around|في|جنب|قريب من|عند)\s+([^\d,.،]+?)(?=\s+(?:are|is|for|from|on|under|below|less|become|get|drop|go|من|لمده|لمدة|يبقي|يبقى|بقت|تبقي|تبقى|تنزل|ينزل|اقل|أقل|تحت|ب)(?![\p{L}])|\s*\d|[,.،]|$)/iu.exec(t);
      const city = place || (m ? m[1].trim() : "");
      const nights = +((/(\d{1,2})\s*(?:nights?|ليالي|ليله|ليلة)/i.exec(t) || [])[1] || 0);
      const dates = tripDates(t0, { now });
      // v8.2 (Ali, 26 Oct: "4 nights from 10 December to 29 January … it did all 40 days — it should understand"): when the two days
      // are further apart than the nights, they are a WINDOW — any N nights inside it; the agent checks several start days
      const span = dates[0] && dates[1] ? Math.round((Date.parse(dates[1] + "T12:00:00") - Date.parse(dates[0] + "T12:00:00")) / DAY) : 0;
      const win = nights > 0 && span > nights ? { from: dates[0], to: dates[1] } : null;
      const checkin = dates[0] || "";
      const checkout = win || !dates[1] ? (checkin && nights ? isoDay(Date.parse(checkin + "T12:00:00") + nights * DAY) : "") : dates[1];
      const adults = +((/(\d{1,2})\s*(?:adults?|people|persons?|guests?|اشخاص|أشخاص|افراد|أفراد)/i.exec(t) || [])[1] || (+(opts.prefs || {}).adults > 0 ? +opts.prefs.adults : 2));
      // v8.2: what the sentence doesn't say comes from the person's own trip details (Profile → Your details)
      const pr = opts.prefs || {}, said = starsIn(t);
      const stars = said.length ? said : +pr.hotelStars >= 1 ? Array.from({ length: 6 - +pr.hotelStars }, (_, i) => +pr.hotelStars + i) : [];
      const near = !!place && NEAR.test(t) || /\b(walking distance|close to|next to|near)\b|جنب|قريب|قدام|ماشي/iu.test(t) || !!pr.nearCentre;
      const f = { city, checkin, checkout, adults, rooms: 1, cheapest: true, nights, ...(stars.length ? { stars } : {}), ...(near ? { near: true } : {}), ...(win ? { window: win } : {}) };
      const d = { kind: "watch", site: "Booking.com", fields: f, below: limit, currency: cur, title: "Hotels · " + (city.split(",")[0] || "?") + (nights ? " · " + nights + " nights" : "") + (stars.length ? " · " + stars.join("–") + "★" : "") };
      if (!city) return { ...d, ask: "Hotels in which city or area?" };
      if (!checkin) return { ...d, ask: "From which day? (e.g. from 10 December)" };
      if (checkin < isoDay(now)) return { ...d, ask: "{d} has passed — from which day?", v: { d: checkin } };
      if (!checkout) return { ...d, ask: "For how many nights?" };
      const tries = win ? windowStarts(win, nights).map((ci) => { const co = isoDay(Date.parse(ci + "T12:00:00") + nights * DAY); return { checkin: ci, checkout: co, url: bookingUrl({ ...f, checkin: ci, checkout: co }) }; }) : null;
      return { ...d, url: bookingUrl(f), ...(tries ? { tries } : {}) };
    }
    // a product in a store: "tell me when the iPhone 16 on Amazon is under 40,000" (a car, a flat or anything for sale with no
    // store named is Scout's: "tell me when a Tucson 2022 is under 1.5M")
    const store = app && app.kind === "shop" ? app : null;
    if (!store) return looksLikeGoal(t0) || /\b(used|for sale|rent|flat|apartment|car)\b|مستعمل|للبيع|ايجار|إيجار|شقه|شقة|عربيه|عربية/iu.test(t) ? { kind: "scout", text: t0, title: t0.slice(0, 80) } : null;
    const what = t0.replace(/https:\/\/\S+/g, "").replace(/^(?:please\s+)?(?:tell|notify|alert|ping|let|warn)\s+me\s+(?:when|if|once)\s+(?:the\s+)?|^(?:قولي|نبهني|عرفني|بلغني)\s+(?:لما|لو)\s+/iu, "")
      .replace(/\s+(?:on|at|from|في|على|من)\s+(?:amazon|noon|jumia|امازون|أمازون|نون|جوميا)\b.*$/iu, "")
      .replace(/\s+(?:is|are|goes|gets|drops|becomes|يبقي|يبقى|ينزل|تنزل|بقي|بقى)?\s*(?:under|below|less than|cheaper than|lower than|اقل من|أقل من|تحت).*$/iu, "").trim().slice(0, 70);
    if (!what) return null;
    const links = shopLinks({ what, store: store ? store.id : "" }, country);
    const pick = links.find((l) => store && l.label.toLowerCase().startsWith(store.label.toLowerCase().slice(0, 4))) || links[0];
    return { kind: "watch", site: pick.label, url: pick.url, below: limit, currency: cur, what, title: what + " · " + pick.label };
  }
  // do it now: a ride, food, a hotel, a flight, a product (the right app with the search ready)
  // "Uber to the airport" has no verb of its own: a ride app's name is the verb
  const plan = planTask(t0, { now, country }) || (app && app.kind === "ride" ? planTask("i want " + t0, { now, country }) : null);
  if (plan) return { kind: "do", plan, title: t0.slice(0, 80) };
  // Scout: "find me a used Tucson 2022"
  if (looksLikeGoal(t0) || /\b(used|for sale|second hand)\b|مستعمل|مستعمله|للبيع/iu.test(t)) return { kind: "scout", text: t0, title: t0.slice(0, 80) };
  // just an app's name ("Talabat", «أوبر»): open it
  if (app && t.replace(/[^\p{L}\p{N} ]/gu, "").trim().split(/\s+/).length <= 2) return { kind: "open", app: { id: app.id, label: app.label, pkg: app.pkg, web: app.web } };
  return null;
}

/** An answer to the agent's question goes back into the sentence it asked about. */
export function withAnswer(text, ask, answer) {
  const a = String(answer || "").trim(); if (!a) return text;
  if (/usual/.test(ask || "")) return text.replace(/\s*:.*$/, "") + ": " + a;
  if (/nights/.test(ask || "")) return text + " for " + (/^\d+$/.test(a) ? a + " nights" : a);
  if (/day/.test(ask || "")) return text + " from " + a;
  if (/city|area/.test(ask || "")) return text + " in " + a;
  return text + " " + a;
}

// ---- the saved agents ------------------------------------------------------------------------------------------------------------
export function loadAgents(s = typeof localStorage !== "undefined" ? localStorage : null) {
  try { const v = JSON.parse((s && s.getItem(AGENTS_KEY)) || "null"); if (v && Array.isArray(v.agents)) return { usual: {}, ...v }; } catch (e) {}
  return { agents: [], usual: {} };
}
export function saveAgents(st, s = typeof localStorage !== "undefined" ? localStorage : null) { try { s && s.setItem(AGENTS_KEY, JSON.stringify(st)); } catch (e) {} return st; }
export function makeAgent(d, now = Date.now()) {
  const a = { id: "ag" + now.toString(36) + Math.floor(Math.random() * 1e4).toString(36), kind: d.kind, title: d.title || "", on: true, created: now, checks: [] };
  if (d.kind === "watch") Object.assign(a, { url: d.url, site: d.site, below: d.below, currency: d.currency, fields: d.fields || null, what: d.what || "", ...(d.tries ? { tries: d.tries } : {}) });
  if (d.kind === "track") Object.assign(a, { app: d.app, what: d.what || "" });
  if (d.kind === "order") Object.assign(a, { app: d.app, what: d.what || "" });
  return a;
}
/** A check's result kept on its agent (the last 30); found = at or under the limit. */
export function addCheck(a, c) {
  const row = { at: c.at || Date.now(), ...(c.price > 0 ? { price: Math.round(c.price) } : { blocked: true }), how: c.how || "auto", ...(c.checkin ? { checkin: c.checkin, checkout: c.checkout } : {}) };
  const checks = [...(a.checks || []), row].slice(-30);
  const found = row.price > 0 && a.below > 0 && row.price <= a.below && !(a.found && a.found.price <= row.price && a.found.at > row.at - 2 * DAY);
  return { ...a, checks, ...(found ? { found: { at: row.at, price: row.price, ...(row.checkin ? { checkin: row.checkin, checkout: row.checkout } : {}) } } : {}) };
}
/** The price watches the phone checks with Attune closed (AgentWatch.kt). */
// v8.2: a hotel window sends each start day as its own check ("id~2"); takeChecks folds them back into the agent
export const watchPlan = (st) => (st.agents || []).filter((a) => a.on && a.kind === "watch" && /^https:\/\//.test(a.url || ""))
  .flatMap((a) => (a.tries && a.tries.length ? a.tries.map((x, i) => ({ id: a.id + "~" + i, title: a.title + " · " + x.checkin, url: x.url, below: a.below || 0, currency: a.currency || "" }))
    : [{ id: a.id, title: a.title, url: a.url, below: a.below || 0, currency: a.currency || "" }])).slice(0, 12);
/** The phone's checks ({id or "id~i": [rows]}) → the agents with them added (a window's row keeps its days). */
export function takeChecks(agents, got) {
  return agents.map((a) => {
    const rows = Object.entries(got || {}).filter(([k]) => k === a.id || k.startsWith(a.id + "~"))
      .flatMap(([k, list]) => { const x = k.includes("~") && a.tries ? a.tries[+k.split("~")[1]] : null; return (list || []).map((c) => ({ ...c, ...(x ? { checkin: x.checkin, checkout: x.checkout } : {}) })); })
      .sort((p, q) => (p.at || 0) - (q.at || 0));
    return rows.reduce((x, c) => addCheck(x, { ...c, how: "auto" }), a);
  });
}
/** A delivery agent as a Message-alert rule the phone checks against every notification of that store's app. */
export const trackRule = (a) => ({ id: "agent-" + a.id, on: a.on, created: a.created, who: [], app: "pkgs:" + [a.app.pkg, ...(a.app.alt || [])].filter(Boolean).join("|"),
  words: ["arriving", "arrives", "arrive", "delivered", "delivery", "out for delivery", "shipped", "dispatched", "on its way", "on the way", "يصل", "هيوصل", "توصيل", "التوصيل", "الطريق", "تم الشحن", "تم التوصيل", "شحن", "وصل"],
  once: false, label: a.title });
/** One line about a watch: the latest price and how far from the limit. */
export function watchLine(a, fmt = (n) => n.toLocaleString("en-US")) {
  const last = [...(a.checks || [])].reverse().find((c) => c.price > 0);
  return { last: last ? last.price : null, at: last ? last.at : null, low: Math.min(...(a.checks || []).filter((c) => c.price > 0).map((c) => c.price), Infinity), gap: last && a.below ? last.price - a.below : null, fmt };
}
/** The Agents report: running, found, checks this week, per kind. */
export function agentsReport(st, scoutGoals = [], alerts = [], now = Date.now()) {
  const ag = st.agents || [], wk = now - 7 * DAY;
  const checks = ag.reduce((n, a) => n + (a.checks || []).filter((c) => c.at >= wk).length, 0);
  const found = ag.filter((a) => a.found && a.found.at >= wk).length + scoutGoals.reduce((n, g) => n + ((g.unseen || []).length ? 1 : 0), 0);
  const by = { watch: 0, track: 0, order: 0, scout: scoutGoals.filter((g) => g.on !== false).length, alert: alerts.filter((r) => r.on !== false && !String(r.id).startsWith("agent-")).length };
  for (const a of ag) if (a.on && by[a.kind] != null) by[a.kind]++;
  return { running: by.watch + by.track + by.order + by.scout + by.alert, found, checks, by };
}
