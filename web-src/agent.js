/* ---- v6.27: "Do it for me" — the agent's brain (Ali, 14 Oct 2026: book a flight, order food… through the person's apps) ----
   Levels: 1 = DEEP LINKS — the right app or site opens with the search already filled in (this file);
           2 = WEB AGENT  — inside the app's own browser, it reads the results, ranks them by the person's rules and fills
                            the forms from their profile (agent-web.js + AgentBrowser.kt);
           3 = full phone control — later (Google Play's rules on accessibility services; see HANDOFF §5.68).
   Safety rules (Ali: "the code should be smart and strong enough so the app doesn't make mistakes"):
     - CODE reads the request (where, when, how many, what) — never a guess; anything missing is ASKED, not assumed;
     - a date in the past, a return before the departure, an unknown airport → a question, not a booking;
     - it NEVER pays: it stops at the payment page and hands it to the person.
   Pure logic. Tests: tests/unit/v727agent.test.mjs.                                                                      */
import { datesIn, isoDay } from "./deadlines.js";

const DAY = 86400000;
const fold = (s) => String(s || "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة(?=\s|$)/g, "ه");
const W = (words) => new RegExp("(?<![\\p{L}])(?:" + words + ")(?![\\p{L}])", "iu");

// ---- airports: the city (English, Arabic and local names) → its main IATA code(s) -----------------------------------------
// Public facts (IATA codes). The first code of a city is its main airport; flight sites search all of a city's airports.
const AIRPORTS = [
  ["CAI", "cairo|القاهره|القاهرة|مصر الجديده"], ["HRG", "hurghada|الغردقه|الغردقة"], ["SSH", "sharm el sheikh|sharm|شرم الشيخ|شرم"], ["HBE", "alexandria|borg el arab|اسكندريه|الاسكندريه|الإسكندرية|برج العرب"],
  ["LXR", "luxor|الاقصر|الأقصر"], ["ASW", "aswan|اسوان|أسوان"], ["RMF", "marsa alam|مرسي علم|مرسى علم"], ["SPX", "sphinx|سفنكس"],
  ["DXB", "dubai|دبي"], ["AUH", "abu dhabi|ابوظبي|أبوظبي|ابو ظبي"], ["SHJ", "sharjah|الشارقه|الشارقة"], ["DOH", "doha|qatar|الدوحه|الدوحة|قطر"],
  ["RUH", "riyadh|الرياض"], ["JED", "jeddah|jedda|جده|جدة"], ["DMM", "dammam|الدمام"], ["MED", "medina|madinah|المدينه|المدينة المنورة|المدينه المنوره"],
  ["KWI", "kuwait|الكويت"], ["BAH", "bahrain|manama|البحرين|المنامه"], ["MCT", "muscat|oman|مسقط|عمان مسقط"], ["AMM", "amman|عمان"],
  ["BEY", "beirut|بيروت"], ["BGW", "baghdad|بغداد"], ["EBL", "erbil|اربيل|أربيل"], ["CMN", "casablanca|الدار البيضاء"], ["RAK", "marrakech|marrakesh|مراكش"],
  ["TUN", "tunis|تونس"], ["ALG", "algiers|الجزائر"], ["KRT", "khartoum|الخرطوم"], ["IST", "istanbul|اسطنبول|إسطنبول"], ["SAW", "sabiha"],
  ["AYT", "antalya|انطاليا|أنطاليا"], ["ESB", "ankara|انقره|أنقرة"], ["TLV", "tel aviv"], ["LHR", "london|heathrow|لندن"], ["LGW", "gatwick"],
  ["MAN", "manchester|مانشستر"], ["EDI", "edinburgh"], ["DUB", "dublin|دبلن"], ["CDG", "paris|باريس"], ["NCE", "nice airport|nice france|nice côte d'azur|côte d'azur|نيس"], ["LYS", "lyon|ليون"],
  ["FRA", "frankfurt|فرانكفورت"], ["MUC", "munich|münchen|ميونخ"], ["BER", "berlin|برلين"], ["HAM", "hamburg|هامبورغ"], ["DUS", "düsseldorf|dusseldorf"],
  ["AMS", "amsterdam|امستردام|أمستردام"], ["BRU", "brussels|bruxelles|بروكسل"], ["ZRH", "zurich|zürich|زيورخ"], ["GVA", "geneva|genève|جنيف"], ["VIE", "vienna|wien|فيينا"],
  ["FCO", "rome|roma|روما"], ["MXP", "milan|milano|ميلانو"], ["VCE", "venice|venezia|البندقيه"], ["NAP", "naples|napoli"], ["MAD", "madrid|مدريد"], ["BCN", "barcelona|برشلونه|برشلونة"],
  ["AGP", "malaga|málaga"], ["LIS", "lisbon|lisboa|لشبونه"], ["OPO", "porto"], ["ATH", "athens|athína|اثينا|أثينا"], ["CPH", "copenhagen|كوبنهاجن"],
  ["ARN", "stockholm|ستوكهولم"], ["OSL", "oslo|اوسلو"], ["HEL", "helsinki"], ["WAW", "warsaw|warszawa|وارسو"], ["PRG", "prague|praha|براغ"],
  ["BUD", "budapest|بودابست"], ["OTP", "bucharest|bucurești"], ["SOF", "sofia"], ["BEG", "belgrade|beograd"], ["TBS", "tbilisi|تبليسي"], ["GYD", "baku|باكو"],
  ["SVO", "moscow|moskva|москва|موسكو"], ["LED", "saint petersburg|st petersburg"], ["KBP", "kyiv|kiev"], ["JFK", "new york|nyc|نيويورك"], ["EWR", "newark"],
  ["LAX", "los angeles|لوس انجلوس"], ["SFO", "san francisco"], ["ORD", "chicago|شيكاغو"], ["MIA", "miami|ميامي"], ["IAD", "washington|واشنطن"], ["BOS", "boston"],
  ["ATL", "atlanta"], ["DFW", "dallas"], ["IAH", "houston|هيوستن"], ["SEA", "seattle"], ["LAS", "las vegas"], ["MCO", "orlando"], ["DEN", "denver"],
  ["YYZ", "toronto|تورنتو"], ["YUL", "montreal|montréal|مونتريال"], ["YVR", "vancouver"], ["MEX", "mexico city|ciudad de méxico|cdmx"], ["CUN", "cancun|cancún"],
  ["GRU", "são paulo|sao paulo|ساو باولو"], ["GIG", "rio de janeiro|rio"], ["EZE", "buenos aires"], ["SCL", "santiago"], ["BOG", "bogotá|bogota"], ["LIM", "lima"],
  ["DEL", "delhi|new delhi|دلهي"], ["BOM", "mumbai|bombay|مومباي"], ["BLR", "bangalore|bengaluru"], ["MAA", "chennai"], ["HYD", "hyderabad"], ["CCU", "kolkata"],
  ["COK", "kochi|cochin"], ["KHI", "karachi|كراتشي"], ["LHE", "lahore|لاهور"], ["ISB", "islamabad|اسلام اباد"], ["DAC", "dhaka|دكا"], ["CMB", "colombo"],
  ["KTM", "kathmandu"], ["MLE", "malé|maldives|المالديف"], ["BKK", "bangkok|بانكوك"], ["HKT", "phuket|بوكيت"], ["KUL", "kuala lumpur|كوالالمبور"],
  ["SIN", "singapore|سنغافوره|سنغافورة"], ["CGK", "jakarta|جاكرتا"], ["DPS", "bali|denpasar|بالي"], ["MNL", "manila|مانيلا"], ["SGN", "ho chi minh|saigon"],
  ["HAN", "hanoi"], ["HKG", "hong kong|هونغ كونغ"], ["PEK", "beijing|بكين"], ["PVG", "shanghai|شنغهاي"], ["CAN", "guangzhou|قوانغتشو"], ["SZX", "shenzhen"],
  ["TPE", "taipei"], ["ICN", "seoul|سيول"], ["NRT", "tokyo|طوكيو"], ["KIX", "osaka"], ["SYD", "sydney|سيدني"], ["MEL", "melbourne|ملبورن"],
  ["BNE", "brisbane"], ["PER", "perth"], ["AKL", "auckland"], ["JNB", "johannesburg|جوهانسبرغ"], ["CPT", "cape town|كيب تاون"], ["NBO", "nairobi|نيروبي"],
  ["ADD", "addis ababa|اديس ابابا|أديس أبابا"], ["LOS", "lagos|لاغوس"], ["ABV", "abuja"], ["ACC", "accra"], ["DKR", "dakar"], ["DAR", "dar es salaam"],
  ["ZNZ", "zanzibar|زنجبار"], ["MRU", "mauritius|موريشيوس"],
];
const AIR_RE = AIRPORTS.map(([code, names]) => [code, new RegExp("(?<![\\p{L}])(?:" + names + ")(?![\\p{L}])", "iu")]);
const CODE_SET = new Set(AIRPORTS.map(([c]) => c));
/** "Cairo" / "القاهرة" / "CAI" → "CAI" (or ""). */
export function airportOf(text) {
  const t = fold(String(text || "")).trim();
  const up = t.toUpperCase(); if (/^[A-Z]{3}$/.test(up) && CODE_SET.has(up)) return up;
  let best = "", at = 1e9;
  for (const [code, re] of AIR_RE) { const m = re.exec(t); if (m && m.index < at) { best = code; at = m.index; } }
  return best;
}
export const cityName = (code) => { const a = AIRPORTS.find(([c]) => c === code); return a ? a[1].split("|")[0].replace(/\b\w/g, (c) => c.toUpperCase()) : code; };

// ---- what kind of task --------------------------------------------------------------------------------------------------
const VERB = W("book|find|get|order|reserve|buy|search|look for|i want|i need|can you|please|احجز|احجزلي|احجز لي|اطلب|اطلبلي|اطلب لي|هات|هاتلي|عايز|عاوز|ابغي|ابغى|اريد|أريد|ابي|دورلي|ابحث|réserve|réserver|commande|commander|trouve|reserva|reservar|pide|pedir|busca|buscar|reserve|peça|pedir|bestell|buche|buchen|finde|prenota|ordina|cerca|rezervasyon|sipariş|ayarla|pesan|cari|bestel|boek");
const FLIGHT = W("round trip|one way|return flight|رايح جاي|ذهاب وعوده|flights?|plane tickets?|air tickets?|fly|flying|airfare|طياره|طيارة|طيران|رحله طيران|تذكره طيران|تذاكر طيران|vol|vols|billet d'avion|vuelo|vuelos|pasaje|voo|voos|passagem|flug|flüge|volo|voli|uçak|uçuş|bilet|penerbangan|tiket pesawat|vlucht");
const HOTEL = W("hotel|hotels|room|rooms|stay|airbnb|apartment|فندق|فنادق|اوضه|اوضة|غرفه|غرفة|شقه|شقة|hôtel|chambre|hospedaje|alojamiento|habitación|hotel|quarto|hospedagem|unterkunft|zimmer|albergo|camera|otel|oda|penginapan|kamar|verblijf");
const FOOD = W("order food|food|meal|dinner|lunch|breakfast|pizza|burger|sushi|shawarma|koshary|kfc|mcdonald'?s|delivery|deliver|اكل|أكل|عشا|عشاء|غدا|غداء|فطار|فطور|بيتزا|برجر|شاورما|كشري|ديليفري|توصيل|طلبات|repas|livraison|comida|domicilio|entrega|essen|lieferung|cibo|consegna|yemek|makanan|antar|eten|bezorgen");
const RIDE = W("ride|taxi|cab|uber|careem|bolt|lyft|car to|take me to|pick me up|تاكسي|اوبر|أوبر|كريم|عربيه توصلني|توصيله|توصيلة|وصلني|خدني|course|taxi|viaje|carona|corrida|fahrt|corsa|araç|taksi|ojek");
const SHOP = W("buy|purchase|shop for|اشتري|أشتري|اشتريلي|achète|acheter|comprar|compra|kaufen|kauf|acquista|comprare|satın al|al|beli");

/** The task in a sentence: "flight" | "hotel" | "food" | "ride" | "shop" | null. Questions stay in Chat. */
export function taskOf(text) {
  const t = fold(String(text || "")).toLowerCase().trim();
  if (!t || t.length > 300) return null;
  if (/[?؟]\s*$/.test(t) && !/^(can you|could you|ممكن|can i get)/i.test(t)) return null;   // "what is the cheapest airline?" is a question
  if (/\b(how|why|what is|what are|explain|history of|meaning of|recommend|suggest|ideas?|tips|advice|best way|is it|should i|healthy|calories|recipe)\b|اشرح|ازاي|ليه|يعني ايه|ما هو|ما هي|اقترح|انصحني|نصيحه|نصيحة|افضل طريقه|وصفه|سعرات/i.test(t)) return null;
  const verb = VERB.test(t);
  // the words that really mean "do it": book / order / reserve (not "can you…", which also starts questions)
  const BOOK = W("book|reserve|find me|get me|search for|look for|احجز|احجزلي|احجز لي|دورلي|réserve|réserver|trouve-moi|reserva|reservar|búscame|reserve|reservar|buche|buchen|such mir|prenota|cerca|rezervasyon|ayarla|pesan|carikan|boek");
  const ORDER = W("order|get me|deliver|send me|اطلب|اطلبلي|اطلب لي|هاتلي|ابعتلي|commande|commander|pide|pedir|peça|pedir|bestell|bestellen|ordina|sipariş|pesan|bestel");
  // a flight: a booking word, or a route ("to / from …") together with a day — "flight to London on 20 November"
  const route = /(?:^|\s)(to|from|من|الى|إلى|de|desde|von|nach|para|à)\s|(?:^|\s)ل(?=\p{L})/u.test(t);
  const day = /\d|tomorrow|today|tonight|next week|بكره|بكرة|النهارده|الاسبوع الجاي/.test(t) || WEEKDAYS.some(([n]) => new RegExp("(?<![\\p{L}])(?:" + n + ")(?![\\p{L}])", "iu").test(t));
  if (FLIGHT.test(t) && (BOOK.test(t) || (verb || day) && route)) return "flight";
  if (HOTEL.test(t) && BOOK.test(t)) return "hotel";
  if (RIDE.test(t) && (verb || /take me|pick me|وصلني|خدني/.test(t))) return "ride";
  if (FOOD.test(t) && (ORDER.test(t) || /طلبات|talabat|deliveroo|doordash|uber ?eats/.test(t))) return "food";
  if (verb && SHOP.test(t) && /\b(on|from)\s+(amazon|noon|jumia|ebay|aliexpress|temu|shein)\b|من (امازون|نون|جوميا)/i.test(t)) return "shop";
  return null;
}

// ---- dates: "on Thursday", "tomorrow", "16 Oct", "from 3 to 6 November", "next Friday" ------------------------------------------
const WEEKDAYS = [["sun(?:day)?|الاحد|الأحد|dimanche|domingo|sonntag|domenica|pazar|minggu", 0], ["mon(?:day)?|الاتنين|الاثنين|lundi|lunes|segunda|montag|lunedì|pazartesi|senin", 1],
  ["tue(?:s|sday)?|التلات|الثلاثاء|mardi|martes|terça|dienstag|martedì|salı|selasa", 2], ["wed(?:nesday)?|الاربع|الأربعاء|الاربعاء|mercredi|miércoles|quarta|mittwoch|mercoledì|çarşamba|rabu", 3],
  ["thu(?:rs|rsday)?|الخميس|jeudi|jueves|quinta|donnerstag|giovedì|perşembe|kamis", 4], ["fri(?:day)?|الجمعه|الجمعة|vendredi|viernes|sexta|freitag|venerdì|cuma|jumat", 5],
  ["sat(?:urday)?|السبت|samedi|sábado|sabado|samstag|sabato|cumartesi|sabtu", 6]];
const at12 = (t) => { const d = new Date(t); d.setHours(12, 0, 0, 0); return d.getTime(); };
/** The dates in a request, in order, as YYYY-MM-DD (weekdays → the next one; "next week" → +7). */
export function tripDates(text, { now = Date.now(), order = "dmy" } = {}) {
  const t = fold(String(text || "")).toLowerCase(), out = [];
  for (const d of datesIn(text, { now, order })) out.push({ at: d.at, iso: isoDay(d.t) });
  const today = at12(now);
  const rel = [[W("today|tonight|النهارده|النهاردة|اليوم|الليله|الليلة|aujourd'hui|hoy|hoje|heute|oggi|bugün|hari ini|vandaag"), 0], [W("tomorrow|بكره|بكرة|غدا|غداً|demain|mañana|amanhã|morgen|domani|yarın|besok"), 1], [W("day after tomorrow|بعد بكره|بعد بكرة|après-demain|pasado mañana|übermorgen"), 2]];
  for (const [re, k] of rel) { const m = re.exec(t); if (m && !out.some((x) => Math.abs(x.at - m.index) < 3)) out.push({ at: m.index, iso: isoDay(today + k * DAY) }); }
  for (const [names, wd] of WEEKDAYS) {
    const m = new RegExp("(?<![\\p{L}])(next\\s+|الجاي\\s+|this\\s+|يوم\\s+)?(?:" + names + ")(?![\\p{L}])(\\s+(?:الجاي|الجاية|القادم|next))?", "iu").exec(t);
    if (!m) continue;
    let add = (wd - new Date(today).getDay() + 7) % 7 || 7;
    if (/next|الجاي|القادم/.test((m[1] || "") + (m[2] || "")) && add < 7 && /next week/.test(t)) add += 7;
    out.push({ at: m.index, iso: isoDay(today + add * DAY) });
  }
  // "for 3 nights" / "3 ليالي" after a check-in date → the check-out
  return out.sort((a, b) => a.at - b.at).map((x) => x.iso).filter((v, i, a) => a.indexOf(v) === i);
}
const nightsOf = (t) => { const m = /(\d{1,2})\s*(?:nights?|ليالي|ليله|ليلة|nuits?|noches?|noites?|nächte|nacht|notti|gece|malam)/i.exec(fold(t)); return m ? +m[1] : 0; };
const peopleOf = (t) => {
  const f = fold(t).toLowerCase();
  const m = /(\d{1,2})\s*(?:adults?|people|persons?|passengers?|pax|guests?|travellers?|travelers?|اشخاص|أشخاص|افراد|أفراد|نفر|ركاب|بالغين|personnes|adultes|personas|adultos|pessoas|personen|erwachsene|persone|adulti|kişi|yetişkin|orang|dewasa)/i.exec(f);
  if (m) return +m[1];
  if (/\b(we two|two of us|me and my (?:wife|husband|friend|brother|sister|partner)|with my (?:wife|husband|partner))\b|انا ومراتي|أنا وزوجتي|انا وجوزي|انا وصاحبي|احنا الاتنين|نحن الاثنين/i.test(f)) return 2;
  return 0;
};
const cabinOf = (t) => (/\b(business|بيزنس|درجه رجال الاعمال|affaires|negocios|executiva)\b/i.test(fold(t)) ? "business" : /\bfirst class|درجه اولي|الدرجه الاولي|première\b/i.test(fold(t)) ? "first" : "economy");

// ---- flights: from / to --------------------------------------------------------------------------------------------------------
const FROMW = "from|من|de|desde|von|da|dari|van", TOW = "to|الى|إلى|à|a|para|nach|per|ke|naar";
const STOPW = "on|في|يوم|le|el|am|il|pada|op|tomorrow|today|tonight|next|this|for|with|in the|mañana|demain|morgen|amanhã|domani|yarın|besok|بكره|بكرة|النهارده|الليله|غدا";
const AFTER = "(?=\\s+(?:" + STOPW + ")(?![\\p{L}])|\\s*\\d|\\s*[,.،!]|$)";
// "to X" / Arabic "لX" (the preposition written as one word with the city)
const TO_RE = "(?:\\s+(?:" + TOW + ")\\s+|\\s+لـ?(?=\\p{L}))";
function routeOf(text, home) {
  const t = fold(String(text || ""));
  let m = new RegExp("(?:^|\\s)(?:" + FROMW + ")\\s+(.+?)" + TO_RE + "(.+?)" + AFTER, "iu").exec(t);
  if (m) return { from: airportOf(m[1]), to: airportOf(m[2]), fromText: m[1].trim(), toText: m[2].trim() };
  m = new RegExp("(?:^|\\s)(?:to|الى|إلى|à|para|nach|ke|naar)\\s+(.+?)\\s+(?:" + FROMW + ")\\s+(.+?)" + AFTER, "iu").exec(t);
  if (m) return { from: airportOf(m[2]), to: airportOf(m[1]), fromText: m[2].trim(), toText: m[1].trim() };
  // only a destination: "flight to Dubai" → from the person's home airport (asked if unknown)
  m = new RegExp("(?:(?:^|\\s)(?:to|الى|إلى|à|para|nach|ke|naar)\\s+|(?:^|\\s)لـ?(?=\\p{L}))(.+?)" + AFTER, "iu").exec(t);
  const to = m ? airportOf(m[1]) : airportOf(t);
  return { from: home || "", to, fromText: "", toText: m ? m[1].trim() : "" };
}

/**
 * A request → a plan: { task, fields, missing: [questions], links: [{ label, url, app?, why }], warnings }.
 * opts: { now, order, home (currency), country (ISO-2), homeAirport }.
 */
export function planTask(text, opts = {}) {
  const task = taskOf(text); if (!task) return null;
  const now = opts.now || Date.now(), today = isoDay(now);
  const dates = tripDates(text, { now, order: opts.order });
  const missing = [], warnings = [];
  const p = { task, fields: {}, missing, warnings, links: [] };
  if (task === "flight") {
    const r = routeOf(text, opts.homeAirport);
    const back = /\b(return|round trip|roundtrip|and back|coming back|رايح جاي|ذهاب وعوده|ذهاب وعودة|عوده|عودة|aller-retour|ida y vuelta|ida e volta|hin und zurück|andata e ritorno|gidiş dönüş|pulang pergi|retour)\b/i.test(fold(text));
    const f = { from: r.from, to: r.to, depart: dates[0] || "", ret: back || dates.length > 1 ? dates[1] || "" : "", adults: peopleOf(text) || 1, cabin: cabinOf(text),
      cheapest: /\b(cheap|cheapest|lowest|budget|ارخص|أرخص|رخيص|moins cher|más barato|mais barato|günstig|economico|en ucuz|termurah)\b/i.test(fold(text)),
      direct: /\b(direct|non-?stop|مباشر|مباشره|sans escale|directo|direto|direkt|diretto|aktarmasız|langsung)\b/i.test(fold(text)),
      time: /\b(morning|صباح|الصبح|matin|mañana temprano|manhã|morgens|mattina|sabah|pagi)\b/i.test(fold(text)) ? "morning" : /\b(evening|night|مساء|بالليل|soir|noche|noite|abends|sera|akşam|malam)\b/i.test(fold(text)) ? "evening" : "" };
    p.fields = f;
    if (!f.from) missing.push(r.fromText ? { t: "I don't know the airport for “{x}” — which city or airport code?", v: { x: r.fromText } } : "Flying from where?");
    if (!f.to) missing.push(r.toText ? { t: "I don't know the airport for “{x}” — which city or airport code?", v: { x: r.toText } } : "Flying to where?");
    if (f.from && f.from === f.to) missing.push("The departure and the destination are the same airport.");
    if (!f.depart) missing.push("Which day do you want to fly?");
    if (f.depart && f.depart < today) missing.push({ t: "{d} has passed — which day?", v: { d: f.depart } });
    if (f.ret && f.depart && f.ret < f.depart) missing.push("The return is before the departure — which days?");
    if (back && !f.ret) missing.push("Which day do you come back?");
    if (!missing.length) p.links = flightLinks(f);
  } else if (task === "hotel") {
    const t = fold(text);
    const m = /(?:^|\s)(?:in|at|near|في|à|en|em|di|bei|nahe|dans|ke|nel|nella)\s+([^\d,.،]+?)(?=\s+(?:from|for|on|with|من|لمده|لمدة|يوم|du|del|vom|dal|desde|ab)(?![\p{L}])|\s*\d|[,.،]|$)/iu.exec(t);
    const city = m ? m[1].trim() : "";
    const nights = nightsOf(text);
    const f = { city, checkin: dates[0] || "", checkout: dates[1] || (dates[0] && nights ? isoDay(Date.parse(dates[0] + "T12:00:00") + nights * DAY) : ""), adults: peopleOf(text) || (opts.adults || 2), rooms: 1,
      cheapest: /\b(cheap|cheapest|budget|ارخص|أرخص)\b/i.test(t) };
    p.fields = f;
    if (!f.city) missing.push("A hotel in which city or area?");
    if (!f.checkin) missing.push("Checking in on which day?");
    if (f.checkin && !f.checkout) missing.push("For how many nights (or which day do you check out)?");
    if (f.checkin && f.checkin < today) missing.push({ t: "{d} has passed — which day?", v: { d: f.checkin } });
    if (f.checkout && f.checkin && f.checkout <= f.checkin) missing.push("The check-out must be after the check-in.");
    if (!missing.length) p.links = hotelLinks(f);
  } else if (task === "food") {
    const t = fold(text);
    const app = (/talabat|طلبات/i.exec(t) || /deliveroo|doordash|uber ?eats|grubhub|just ?eat|swiggy|zomato|glovo|wolt|rappi|ifood|getir|yemeksepeti|jahez|hungerstation|noon food|elmenus|breadfast|grab ?food|gofood|foodpanda|careem/i.exec(t) || [""])[0].toLowerCase();
    const what = t.replace(/(?:order|get|i want|i need|please|can you|اطلب|اطلبلي|اطلب لي|عايز|عاوز|هات|هاتلي|ابغي|ابي|commande|pide|peça|bestell|ordina|sipariş|pesan)\s*(?:me\s+|لي\s+)?/iu, "")
      .replace(/\s+(?:on|from|via|عن طريق|من|على|sur|en|no|auf|su|dari)\s+(talabat|طلبات|deliveroo|doordash|uber ?eats|grubhub|just ?eat|swiggy|zomato|glovo|wolt|rappi|ifood|getir|yemeksepeti|jahez|hungerstation|noon food|elmenus|breadfast|grab ?food|gofood|foodpanda|careem)\b.*$/iu, "")
      .replace(/\s+(?:from|من|de|von|da|dari|chez)\s+.*$/iu, "").replace(/^(?:some|a|an)\s+/i, "").trim().slice(0, 60);
    p.fields = { what, app, from: (/(?:from|من|de|von|da|dari)\s+([^\d,.،]+?)(?=\s+(?:on|via|عن طريق|على)|[,.،]|$)/iu.exec(t) || [])[1] || "" };
    if (!what) missing.push("What would you like to order?");
    if (!missing.length) p.links = foodLinks(p.fields, opts.country);
  } else if (task === "ride") {
    const t = fold(text);
    const m = /(?:(?:^|\s)(?:to|الى|إلى|à|para|nach|ke|naar)\s+|(?:^|\s)(?:وصلني|خدني)\s*لـ?|(?:^|\s)لـ?(?=\p{L}))(.+?)(?=\s*[,.،!]|\s+(?:now|asap|دلوقتي|حالا)(?![\p{L}])|$)/iu.exec(t);
    const dest = m ? m[1].trim() : "";
    p.fields = { to: dest, app: (/uber|careem|bolt|lyft|indrive|didi|grab|gojek|ola|كريم|اوبر|أوبر/i.exec(t) || [""])[0].toLowerCase() };
    if (!dest) missing.push("A ride to where?");
    if (!missing.length) p.links = rideLinks(p.fields, opts.country);
  } else if (task === "shop") {
    const t = fold(text);
    const store = (/(amazon|noon|jumia|ebay|aliexpress|temu|shein|امازون|نون|جوميا)/i.exec(t) || [""])[0].toLowerCase();
    const what = t.replace(/^(?:please\s+)?(?:buy|purchase|order|get|find|اشتري|اشتريلي|هات|عايز|achète|comprar|kaufen|acquista|satın al|beli)\s*(?:me\s+|لي\s+)?/iu, "").replace(/\s+(?:on|from|من|sur|en|auf|su|dari)\s+\S+.*$/iu, "").trim().slice(0, 80);
    p.fields = { what, store };
    if (!what) missing.push("What should I look for?");
    if (!missing.length) p.links = shopLinks(p.fields, opts.country);
  }
  return p;
}

// ---- level 1: the links (formats published by each site; anything unsure → the app opens, the search is copied) ------------
const enc = encodeURIComponent;
const yymmdd = (iso) => iso.slice(2, 4) + iso.slice(5, 7) + iso.slice(8, 10);
export function flightLinks(f) {
  const cab = f.cabin === "business" ? "business" : f.cabin === "first" ? "first" : "economy";
  const q = `Flights from ${f.from} to ${f.to} on ${f.depart}${f.ret ? " returning " + f.ret : " one way"}${f.adults > 1 ? " " + f.adults + " adults" : ""}${f.direct ? " nonstop" : ""}${cab !== "economy" ? " " + cab + " class" : ""}`;
  return [
    { label: "Google Flights", url: "https://www.google.com/travel/flights?q=" + enc(q), why: "compares airlines" },
    { label: "Skyscanner", url: `https://www.skyscanner.net/transport/flights/${f.from.toLowerCase()}/${f.to.toLowerCase()}/${yymmdd(f.depart)}/${f.ret ? yymmdd(f.ret) + "/" : ""}?adults=${f.adults}&cabinclass=${cab}${f.direct ? "&preferdirects=true" : ""}`, app: "net.skyscanner.android.main", why: "cheapest across sites" },
    { label: "Kayak", url: `https://www.kayak.com/flights/${f.from}-${f.to}/${f.depart}${f.ret ? "/" + f.ret : ""}/${f.adults}adults${cab !== "economy" ? "/" + cab : ""}?sort=${f.cheapest ? "price_a" : "bestflight_a"}${f.direct ? "&fs=stops=0" : ""}`, why: "price calendar" },
  ];
}
export function hotelLinks(f) {
  return [
    { label: "Booking.com", url: `https://www.booking.com/searchresults.html?ss=${enc(f.city)}&checkin=${f.checkin}&checkout=${f.checkout}&group_adults=${f.adults}&no_rooms=${f.rooms}${f.cheapest ? "&order=price" : ""}`, app: "com.booking", why: "hotels, free cancellation" },
    { label: "Airbnb", url: `https://www.airbnb.com/s/${enc(f.city)}/homes?checkin=${f.checkin}&checkout=${f.checkout}&adults=${f.adults}`, app: "com.airbnb.android", why: "apartments" },
    { label: "Google Hotels", url: "https://www.google.com/travel/search?q=" + enc(`hotels in ${f.city} ${f.checkin} to ${f.checkout} ${f.adults} adults`), why: "compares prices" },
  ];
}
// food and rides: the apps people use in each country (most used first); a link only where its format is published
const FOOD_APPS = {
  talabat: { label: "Talabat", app: "com.talabat", url: "https://www.talabat.com/" }, "uber eats": { label: "Uber Eats", app: "com.ubercab.eats", url: (q) => "https://www.ubereats.com/search?q=" + enc(q) },
  doordash: { label: "DoorDash", app: "com.dd.doordash", url: (q) => "https://www.doordash.com/search/store/" + enc(q) + "/" }, deliveroo: { label: "Deliveroo", app: "com.deliveroo.orderapp", url: "https://deliveroo.co.uk/" },
  swiggy: { label: "Swiggy", app: "in.swiggy.android", url: "https://www.swiggy.com/search?query=" }, zomato: { label: "Zomato", app: "com.application.zomato", url: "https://www.zomato.com/" },
  glovo: { label: "Glovo", app: "com.glovo", url: "https://glovoapp.com/" }, grab: { label: "Grab", app: "com.grabtaxi.passenger", url: "https://food.grab.com/" },
  gojek: { label: "Gojek", app: "com.gojek.app", url: "https://gofood.co.id/" }, careem: { label: "Careem", app: "com.careem.acma", url: "https://www.careem.com/" },
  elmenus: { label: "elmenus", app: "", url: (q) => "https://www.elmenus.com/cairo/search?q=" + enc(q) },
};
const FOOD_BY_COUNTRY = { EG: ["talabat", "elmenus", "uber eats"], SA: ["careem", "talabat"], AE: ["talabat", "deliveroo", "careem"], KW: ["talabat", "deliveroo"], QA: ["talabat", "deliveroo"],
  BH: ["talabat"], OM: ["talabat"], JO: ["talabat", "careem"], US: ["doordash", "uber eats"], CA: ["doordash", "uber eats"], GB: ["deliveroo", "uber eats"], IE: ["deliveroo"],
  FR: ["uber eats", "deliveroo"], ES: ["glovo", "uber eats"], IT: ["glovo", "deliveroo"], DE: ["uber eats"], IN: ["swiggy", "zomato"], ID: ["gojek", "grab"], MY: ["grab"], SG: ["grab", "deliveroo"],
  TH: ["grab"], PH: ["grab"], VN: ["grab"], AU: ["uber eats", "doordash", "deliveroo"], MX: ["uber eats"], BR: ["uber eats"] };
export function foodLinks(f, country = "") {
  const key = f.app.replace("طلبات", "talabat").replace(/ubereats/, "uber eats");
  const list = [key && FOOD_APPS[key] ? key : null, ...(FOOD_BY_COUNTRY[country] || ["uber eats", "doordash"])].filter((x, i, a) => x && a.indexOf(x) === i).slice(0, 3);
  const q = [f.what, f.from].filter(Boolean).join(" ");
  return list.map((k) => { const a = FOOD_APPS[k]; return { label: a.label, app: a.app, url: typeof a.url === "function" ? a.url(q) : a.url, copy: typeof a.url === "function" ? "" : q, why: "search: " + q }; });
}
const RIDE_APPS = { uber: { label: "Uber", app: "com.ubercab", url: (d) => "https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=" + enc(d) },
  careem: { label: "Careem", app: "com.careem.acma", url: "https://www.careem.com/" }, bolt: { label: "Bolt", app: "ee.mtakso.client", url: "https://bolt.eu/" },
  lyft: { label: "Lyft", app: "me.lyft.android", url: "https://www.lyft.com/" }, indrive: { label: "inDrive", app: "sinet.startup.inDriver", url: "https://indrive.com/" },
  grab: { label: "Grab", app: "com.grabtaxi.passenger", url: "https://www.grab.com/" }, gojek: { label: "Gojek", app: "com.gojek.app", url: "https://www.gojek.com/" },
  ola: { label: "Ola", app: "com.olacabs.customer", url: "https://www.olacabs.com/" } };
const RIDE_BY_COUNTRY = { EG: ["uber", "careem", "indrive"], SA: ["careem", "uber"], AE: ["careem", "uber"], KW: ["careem", "uber"], QA: ["uber", "careem"], JO: ["careem", "uber"],
  US: ["uber", "lyft"], CA: ["uber", "lyft"], GB: ["uber", "bolt"], FR: ["uber", "bolt"], DE: ["uber", "bolt"], PL: ["bolt", "uber"], IN: ["uber", "ola"], ID: ["gojek", "grab"],
  MY: ["grab"], SG: ["grab"], TH: ["grab", "bolt"], PH: ["grab"], VN: ["grab"], NG: ["bolt", "uber"], KE: ["bolt", "uber"], ZA: ["bolt", "uber"], MX: ["uber", "indrive"], BR: ["uber"] };
export function rideLinks(f, country = "") {
  const key = f.app.replace(/كريم/, "careem").replace(/اوبر|أوبر/, "uber");
  const list = [RIDE_APPS[key] ? key : null, ...(RIDE_BY_COUNTRY[country] || ["uber"])].filter((x, i, a) => x && a.indexOf(x) === i).slice(0, 3);
  return list.map((k) => { const a = RIDE_APPS[k]; return { label: a.label, app: a.app, url: typeof a.url === "function" ? a.url(f.to) : a.url, copy: typeof a.url === "function" ? "" : f.to, why: "to: " + f.to }; })
    .concat([{ label: "Google Maps", url: "https://www.google.com/maps/dir/?api=1&destination=" + enc(f.to) + "&travelmode=driving", why: "the route and time" }]);
}
const AMAZON_TLD = { US: "com", GB: "co.uk", DE: "de", FR: "fr", ES: "es", IT: "it", CA: "ca", IN: "in", JP: "co.jp", AE: "ae", SA: "sa", EG: "eg", TR: "com.tr", MX: "com.mx", BR: "com.br", AU: "com.au", NL: "nl", SE: "se", PL: "pl", SG: "sg" };
export function shopLinks(f, country = "") {
  const q = f.what, out = [];
  const amazon = { label: "Amazon", url: `https://www.amazon.${AMAZON_TLD[country] || "com"}/s?k=${enc(q)}`, app: "com.amazon.mShop.android.shopping", why: "search: " + q };
  const noon = { label: "noon", url: `https://www.noon.com/${country === "SA" ? "saudi-en" : country === "AE" ? "uae-en" : "egypt-en"}/search/?q=${enc(q)}`, why: "search: " + q };
  if (/noon|نون/.test(f.store)) out.push(noon);
  out.push(amazon);
  if (["EG", "SA", "AE"].includes(country) && !out.includes(noon)) out.push(noon);
  out.push({ label: "Google Shopping", url: "https://www.google.com/search?tbm=shop&q=" + enc(q), why: "compare prices" });
  return out.slice(0, 3);
}

// ---- level 2: the web agent's rules (run inside the page by AgentBrowser) -----------------------------------------------------------
/** Ranks offers read from a results page by the person's rules. offers: [{ price, currency, text, stops?, depart? }]. */
export function rankOffers(offers, f = {}) {
  const ok = (offers || []).filter((o) => o && o.price > 0 && isFinite(o.price));
  const score = (o) => o.price * (f.direct && o.stops > 0 ? 1.6 : 1) * (f.time === "morning" && o.hour != null && (o.hour < 5 || o.hour > 12) ? 1.25 : 1) * (f.time === "evening" && o.hour != null && o.hour < 16 ? 1.25 : 1);
  return ok.sort((a, b) => score(a) - score(b));
}
