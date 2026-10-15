/* ---- v6.28 Scout — goals that hunt for days (Ali: "I like Scout if it is made correctly, very strong, very accurate and works with
   everything"). You say once what you are looking for — a flat, a car, a product, a job, a supplier, a tender — and Scout searches the
   sites that matter for it, reads each ad, checks EVERY wish against what the ad itself says (quoting it), merges the same ad seen on
   two sites, keeps a price history to say whether a price is fair, learns from 👍 / 👎, and tells you only about the few really good
   new ones, with a message to the seller. Everything here is CODE (pure, unit-tested: tests/unit/v731scout.test.mjs); the page
   (scout-ui.jsx) runs the searches with the app's own free web search (DuckDuckGo + Bing + Mojeek, pages read in full).
   A wish the ad doesn't mention is "not stated" — never assumed.                                                                  */

const AR_D = "٠١٢٣٤٥٦٧٨٩", FA_D = "۰۱۲۳۴۵۶۷۸۹";
export const latin = (s) => String(s || "").replace(/[٠-٩]/g, (d) => AR_D.indexOf(d)).replace(/[۰-۹]/g, (d) => FA_D.indexOf(d)).replace(/٫/g, ".").replace(/٬/g, ",");
const fold = (s) => latin(s).replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة(?=\s|$|[^؀-ۿ])/g, "ه").replace(/[ًٌٍَُِّْـ]/g, "").toLowerCase();
const num = (v) => Math.round(v).toLocaleString("en-US");
const B = (src) => new RegExp("(?<![\\p{L}\\p{N}])(?:" + src + ")(?![\\p{L}\\p{N}])", "iu");

// ---- 1. the goal ---------------------------------------------------------------------------------------------------------------------
const KIND_WORDS = [
  ["rent", B("rent|for rent|to rent|lease|renting|ايجار|إيجار|للايجار|للإيجار|ايجار شهري|مفروش للايجار")],
  ["job", B("job|jobs|vacancy|vacancies|position|hiring|career|وظيفه|وظيفة|شغل|فرصه عمل|فرصة عمل")],
  ["tender", B("tender|tenders|rfq|bid|bids|مناقصه|مناقصة|مناقصات|ممارسه|ممارسة")],
  ["car", B("car|cars|sedan|suv|hatchback|pickup|toyota|hyundai|kia|nissan|chevrolet|mercedes|bmw|mg|chery|skoda|peugeot|renault|fiat|honda|mitsubishi|suzuki|byd|geely|jetour|tucson|elantra|accent|corolla|cerato|sportage|lancer|عربيه|عربية|سياره|سيارة|تويوتا|هيونداي|كيا|نيسان|شيفروليه|مرسيدس|بي ام|ام جي|شيري|اسكودا|بيجو|رينو|فيات|هوندا|ميتسوبيشي|سوزوكي|توسان|النترا|اكسنت|كورولا|سيراتو|سبورتاج|لانسر")],
  ["buy-home", B("flat|apartment|villa|duplex|penthouse|studio|chalet|townhouse|twin house|land|plot|شقه|شقة|فيلا|دوبلكس|بنتهاوس|ستوديو|شاليه|تاون هاوس|ارض|أرض")],
  ["service", B("crane hire|crane rental|rent a crane|supplier|suppliers|contractor|plumber|electrician|carpenter|movers|moving company|مورد|موردين|مقاول|سباك|كهربائي|نجار|نقل عفش|ونش|اوناش|أوناش|رافعه|رافعة")],
  ["product", B("iphone|samsung|galaxy|laptop|macbook|ipad|tablet|tv|television|fridge|refrigerator|washing machine|air ?conditioner|ac|playstation|ps5|xbox|camera|headphones|airpods|watch|phone|موبايل|ايفون|سامسونج|لابتوب|تابلت|شاشه|شاشة|تلاجه|تلاجة|غساله|غسالة|تكييف|بلايستيشن|كاميرا|سماعه|سماعة|ساعه|ساعة")],
];
/** "3-bedroom flat in Maadi under 15,000" / «شقة ٣ غرف في المعادي أقل من ١٥ ألف» → the goal: what, where, how much, every wish. */
export function parseGoal(text) {
  const raw = String(text || "").trim(), t = fold(raw);
  let kind = (KIND_WORDS.find(([, re]) => re.test(t)) || ["product"])[0];
  if (kind === "rent" && !KIND_WORDS[4][1].test(t) && !/(flat|apartment|villa|studio|chalet|شقه|فيلا|ستوديو|شاليه|room|غرفه|اوضه)/.test(t)) {
    // "rent a crane", "car rental" → a service / a car, not a home
    if (KIND_WORDS[5][1].test(t)) kind = "service"; else if (KIND_WORDS[3][1].test(t)) kind = "car";
  }
  if (kind === "buy-home" && KIND_WORDS[0][1].test(t)) kind = "rent";
  const g = { raw, kind, place: placeOf(raw), max: null, min: null, wish: [] };
  // money: "under 15,000", "max 900k", «أقل من ١٥ ألف», «في حدود 2 مليون», "between 10k and 15k"
  const M = (s) => { s = s.replace(/,/g, ""); const m = /(\d+(?:\.\d+)?)\s*(k|الف|ألف|آلاف|thousand|m|مليون|million)?/i.exec(s); if (!m) return null; let v = +m[1]; const u = (m[2] || "").toLowerCase(); if (/^(k|الف|ألف|آلاف|thousand)$/.test(u)) v *= 1000; else if (/^(m|مليون|million)$/.test(u)) v *= 1e6; return v; };
  const lt = /(?:under|below|less than|max(?:imum)?|up to|budget|not more than|<|اقل من|أقل من|لحد|حتي|حتى|في حدود|ميزانيه|ميزانية|مش اكتر من|ما يزيدش عن)\s*([\d.,]+\s*(?:k|الف|ألف|آلاف|thousand|m|مليون|million)?)/i.exec(latin(raw));
  if (lt) g.max = M(lt[1]);
  const gt = /(?:over|above|more than|at least|min(?:imum)?|from|اكتر من|أكثر من|على الاقل|على الأقل|من)\s*([\d.,]+\s*(?:k|الف|ألف|آلاف|thousand|m|مليون|million)?)\s*(?:to|-|–|الى|إلى|لـ|ل)\s*([\d.,]+\s*(?:k|الف|ألف|آلاف|thousand|m|مليون|million)?)/i.exec(latin(raw));
  if (gt) { g.min = M(gt[1]); g.max = M(gt[2]); }
  // rooms, floor, size, year, km, owners, condition, pets, metro, furnished, remote…
  const beds = /(\d+)\s*(?:-?\s*)(?:bed(?:room)?s?|br|rooms?|غرف|غرفه|اوض|أوض|اوضه)/i.exec(latin(t)) || /(?:غرفتين|اوضتين)/.exec(t);
  if (beds) g.wish.push({ k: "beds", min: beds[1] ? +beds[1] : 2, say: [`${beds[1] || 2}+ bedrooms`, `${beds[1] || 2} غرف أو أكثر`] });
  if (/not (on the )?ground|no ground|مش ارضي|غير ارضي|مش دور ارضي|بلاش ارضي/.test(t)) g.wish.push({ k: "notGround", say: ["not ground floor", "ليس الدور الأرضي"] });
  const area = /(\d{2,4})\s*(?:m2|m²|sqm|square met|متر|م2|م²)/i.exec(latin(t));
  if (area) g.wish.push({ k: "area", min: +area[1], say: [`${area[1]} m² or more`, `${area[1]} م² أو أكثر`] });
  const yr = /(20[0-3]\d|19[89]\d)\s*(?:-|–|to|الى|إلى|لـ)\s*(20[0-3]\d)/.exec(latin(t)) || /(?:from|after|newer than|بعد|من)\s*(20[0-3]\d)/.exec(latin(t)) || /(?:model|موديل)\s*(20[0-3]\d)/.exec(latin(t));
  if (yr) g.wish.push({ k: "year", min: +yr[1], max: yr[2] ? +yr[2] : null, say: [yr[2] ? `model ${yr[1]}–${yr[2]}` : `model ${yr[1]} or newer`, yr[2] ? `موديل ${yr[1]}–${yr[2]}` : `موديل ${yr[1]} أو أحدث`] });
  const km = /(?:under|below|less than|max|اقل من|أقل من)\s*([\d.,]+)\s*(k\s*)?(?:km|كم|كيلو)/i.exec(latin(t));
  if (km) g.wish.push({ k: "km", max: +km[1].replace(/,/g, "") * (km[2] ? 1000 : 1), say: [`under ${km[1]}${km[2] ? "k" : ""} km`, `أقل من ${km[1]}${km[2] ? " ألف" : ""} كم`] });
  if (/one owner|first owner|1 owner|اول مالك|أول مالك|فابريكه|فابريكة/.test(t)) g.wish.push({ k: "oneOwner", say: ["one owner", "أول مالك"] });
  if (/no accident|accident.free|never crashed|بدون حوادث|مفيهاش حوادث|مش مدهونه|فابريكا بره وجوه|فبريكة/.test(t)) g.wish.push({ k: "noAccident", say: ["no accidents", "بدون حوادث"] });
  if (/automatic|اوتوماتيك|أوتوماتيك/.test(t)) g.wish.push({ k: "auto", say: ["automatic", "أوتوماتيك"] });
  if (/\bnew\b|جديد|زيرو/.test(t) && kind !== "rent") g.wish.push({ k: "new", say: ["new", "جديد"] });
  if (/\bused\b|مستعمل/.test(t)) g.wish.push({ k: "used", say: ["used", "مستعمل"] });
  if (/metro|مترو/.test(t)) g.wish.push({ k: "metro", say: ["near the metro", "قريب من المترو"] });
  if (/\bpets?\b|\bcats?\b|\bdogs?\b|قطه|قطة|كلب|حيوانات اليفه/.test(t)) g.wish.push({ k: "pets", say: ["pets allowed", "يسمح بالحيوانات"] });
  if (/\bfurnished\b|مفروش/.test(t) && !/unfurnished|مش مفروش|فاضي/.test(t)) g.wish.push({ k: "furnished", say: ["furnished", "مفروش"] });
  if (/unfurnished|مش مفروش|بدون فرش/.test(t)) g.wish.push({ k: "unfurnished", say: ["unfurnished", "غير مفروش"] });
  if (/\belevator\b|\blift\b|اسانسير|أسانسير|مصعد/.test(t)) g.wish.push({ k: "elevator", say: ["elevator", "أسانسير"] });
  if (/\bgarage\b|parking|جراج|باركينج/.test(t)) g.wish.push({ k: "parking", say: ["parking", "جراج"] });
  if (/\bremote\b|work from home|عن بعد|ريموت/.test(t)) g.wish.push({ k: "remote", say: ["remote", "عن بعد"] });
  if (/full.time|دوام كامل/.test(t)) g.wish.push({ k: "fullTime", say: ["full-time", "دوام كامل"] });
  if (/warranty|ضمان/.test(t)) g.wish.push({ k: "warranty", say: ["with warranty", "بضمان"] });
  // a home with a budget a monthly rent would have ("flat in Maadi under 15,000") is a rent
  if (g.kind === "buy-home" && g.max && g.max < 200000) g.kind = "rent";
  g.what = whatOf(raw, g);
  // v6.28: the exact item (make, model, numbers, storage) — an iPhone 16 Pro Max or an Elantra is not what was asked for
  if (g.kind === "product" || g.kind === "car") g.model = modelOf(g);
  // a job: the years of experience you have ("with 2 years experience") and the salary you want
  const ex = /(\d{1,2})\s*\+?\s*(?:years?|yrs?|سنين|سنوات|سنه|سنة)\s*(?:of\s+)?(?:experience|exp|خبره|خبرة)/i.exec(latin(raw));
  if (g.kind === "job" && ex) g.wish.push({ k: "exp", have: +ex[1], say: [`asks ≤ ${ex[1]} years' experience`, `يطلب خبرة ${ex[1]} سنوات أو أقل`] });
  return g;
}
const PLACES = ["new cairo", "التجمع", "التجمع الخامس", "fifth settlement", "maadi", "المعادي", "zamalek", "الزمالك", "heliopolis", "مصر الجديده", "مصر الجديدة", "nasr city", "مدينه نصر", "مدينة نصر", "dokki", "الدقي", "mohandessin", "المهندسين", "sheikh zayed", "الشيخ زايد", "zayed", "زايد", "6th of october", "october", "اكتوبر", "أكتوبر", "6 اكتوبر", "6 أكتوبر", "shorouk", "الشروق", "madinaty", "مدينتي", "rehab", "الرحاب", "obour", "العبور", "giza", "الجيزه", "الجيزة", "haram", "الهرم", "faisal", "فيصل", "downtown", "وسط البلد", "garden city", "جاردن سيتي", "mokattam", "المقطم", "shubra", "شبرا", "ain shams", "عين شمس", "helwan", "حلوان", "alexandria", "اسكندريه", "الإسكندرية", "اسكندرية", "smouha", "سموحه", "sidi gaber", "سيدي جابر", "north coast", "الساحل", "sahel", "hurghada", "الغردقه", "الغردقة", "sharm", "شرم", "ain sokhna", "السخنه", "العين السخنة", "new capital", "العاصمه الاداريه", "العاصمة الإدارية", "mansoura", "المنصوره", "المنصورة", "tanta", "طنطا", "zagazig", "الزقازيق", "cairo", "القاهره", "القاهرة", "remote", "dubai", "دبي", "riyadh", "الرياض", "jeddah", "جده", "جدة", "doha", "الدوحه", "kuwait", "الكويت"];
// ---- the exact item ------------------------------------------------------------------------------------------------------------------
// Arabic names → the words the ads use (stores write models in Latin letters)
const TRANSLIT = { "ايفون": "iphone", "آيفون": "iphone", "برو": "pro", "ماكس": "max", "بلس": "plus", "الترا": "ultra", "ألترا": "ultra", "ميني": "mini", "سامسونج": "samsung", "جالاكسي": "galaxy", "شاومي": "xiaomi", "ريدمي": "redmi", "اوبو": "oppo", "اوبو": "oppo", "ريلمي": "realme", "هواوي": "huawei", "ابل": "apple", "ماك": "mac", "ماك بوك": "macbook", "ايباد": "ipad", "بلايستيشن": "playstation", "سوني": "sony", "ال جي": "lg",
  "هيونداي": "hyundai", "توسان": "tucson", "النترا": "elantra", "إلنترا": "elantra", "اكسنت": "accent", "كريتا": "creta", "كيا": "kia", "سبورتاج": "sportage", "سيراتو": "cerato", "بيكانتو": "picanto", "تويوتا": "toyota", "كورولا": "corolla", "ياريس": "yaris", "نيسان": "nissan", "صني": "sunny", "سنترا": "sentra", "قشقاي": "qashqai", "شيفروليه": "chevrolet", "افيو": "aveo", "اوبترا": "optra", "مرسيدس": "mercedes", "بي ام دبليو": "bmw", "ام جي": "mg", "شيري": "chery", "تيجو": "tiggo", "اسكودا": "skoda", "اوكتافيا": "octavia", "بيجو": "peugeot", "رينو": "renault", "لوجان": "logan", "فيات": "fiat", "تيبو": "tipo", "هوندا": "honda", "سيفيك": "civic", "ميتسوبيشي": "mitsubishi", "سوزوكي": "suzuki", "سويفت": "swift", "جيلي": "geely", "بي واي دي": "byd", "جيتور": "jetour" };
const VARIANTS = ["pro", "max", "plus", "ultra", "mini", "lite", "fe", "air", "edge", "neo"];
const ITEM_STOP = new Set(["new", "used", "brand", "original", "sealed", "cheap", "cheapest", "best", "price", "for", "sale", "with", "and", "the", "a", "an", "in", "near", "under", "below", "less", "than", "up", "to", "from", "max.", "budget", "one", "owner", "first", "no", "accident", "accidents", "automatic", "manual", "km", "egp", "model", "car", "cars", "phone", "mobile", "egypt", "cairo", "جديد", "مستعمل", "عربيه", "عربية", "سياره", "سيارة", "موبايل", "موديل", "اول", "أول", "مالك", "بدون", "حوادث", "اوتوماتيك", "أوتوماتيك", "اقل", "أقل", "من", "في", "على", "لـ", "الى", "إلى"]);
const normItem = (s) => { let t = " " + fold(s).replace(/(\d+)\s*(gb|tb|جيجابايت|جيجا|تيرا)(?![\p{L}])/gu, (m, n, u) => " " + n + (/t|تيرا/.test(u) ? "tb" : "gb") + " ") + " ";
  for (const [a, l] of Object.entries(TRANSLIT).sort((x, y) => y[0].length - x[0].length)) t = t.split(" " + fold(a) + " ").join(" " + l + " ");
  return t.replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim(); };
/** The words an ad must have to be the item asked for, and the variants that make it a different one. */
export function modelOf(g) {
  const place = new Set(normItem(g.place || "").split(" "));
  let toks = normItem(g.what || g.raw).split(" ").filter((w) => w && (w.length > 1 || /\d/.test(w)) && !ITEM_STOP.has(w) && !place.has(w) && !/^(19|20)\d{2}$/.test(w) && !/^\d{4,}$/.test(w) && !/^\d+k$/.test(w));
  if (g.kind === "car") toks = toks.filter((w) => !/^\d+$/.test(w));   // a car: make and model words (the years are checked apart)
  const must = [...new Set(toks)].slice(0, 6);
  return { must, avoid: VARIANTS.filter((v) => !must.includes(v)) };
}
export function placeOf(text) {
  const t = fold(text);
  const hit = PLACES.filter((p) => t.includes(fold(p))).sort((a, b) => b.length - a.length)[0];
  if (hit) return hit;
  const m = /\b(?:in|near|around|at)\s+([a-z][a-z ]{2,24}?)(?=\s+(?:under|below|with|for|less|max|up|near|not|and)\b|[,.]|$)/i.exec(String(text)) || /(?:في|ف|جنب|قريب من)\s+([؀-ۿ]+(?:\s[؀-ۿ]+)?)/.exec(String(text));
  return m ? m[1].trim() : "";
}
function whatOf(raw, g) {
  // the search words: the goal without the money and the wish phrases ("3 bedroom flat in Maadi")
  let s = latin(raw).replace(/(?:under|below|less than|max(?:imum)?|up to|budget|not more than|اقل من|أقل من|لحد|حتى|في حدود|ميزانيه|ميزانية)\s*[\d.,]+\s*(?:k|الف|ألف|آلاف|thousand|m|مليون|million)?\s*(?:egp|جنيه|pounds)?/gi, " ");
  s = s.replace(/\b(find me|look for|looking for|i want|i need|search for|get me|hunt for)\b|دورلي على|دور لي على|عايز|عاوز|محتاج|ابحث عن|ابحثلي عن|هات لي/gi, " ");
  return s.replace(/\s+/g, " ").trim().replace(/\s+([,.])/g, "$1").replace(/^(a|an|the)\s+/i, "").replace(/[,\s]+$/, "").trim().slice(0, 90);
}

// ---- 2. where to look ----------------------------------------------------------------------------------------------------------------
// the sites that matter for each kind of goal (Egypt first; elsewhere the plain search runs with the country's name)
export const SITES = {
  rent: ["aqarmap.com.eg", "propertyfinder.eg", "dubizzle.com.eg", "bayut.eg", "olx.com.eg"],
  "buy-home": ["aqarmap.com.eg", "propertyfinder.eg", "dubizzle.com.eg", "bayut.eg", "nawy.com"],
  car: ["hatla2ee.com", "dubizzle.com.eg", "contactcars.com", "olx.com.eg", "carsemsar.com"],
  product: ["amazon.eg", "noon.com", "btech.com", "2b.com.eg", "jumia.com.eg", "dubizzle.com.eg"],
  job: ["wuzzuf.net", "linkedin.com/jobs", "bayt.com", "forasna.com", "indeed.com"],
  tender: ["etenders.gov.eg", "tenders.gov.eg", "egypttenders.com"],
  service: ["dubizzle.com.eg", "olx.com.eg", "yellowpages.com.eg", "facebook.com"],
};
/** v6.28: when the site searches bring no ad at all — the item's own words alone, and with the place. */
export function fallbackSearches(g) {
  const core = g.model && g.model.must.length ? g.model.must.join(" ") : (g.what || g.raw).split(/\s+/).slice(0, 5).join(" ");
  return [core + (g.place ? " " + g.place : ""), core + (g.kind === "rent" ? " للإيجار" : g.kind === "car" ? " للبيع" : g.kind === "job" ? " jobs" : " price")];
}
/** The searches for a goal: the goal's words on each site that matters, plus one open search. */
export function searchesFor(g, max = 6) {
  const base = [g.what || g.raw, g.place && !fold(g.what || "").includes(fold(g.place)) ? g.place : ""].filter(Boolean).join(" ");
  return [...(SITES[g.kind] || SITES.product).map((s) => `${base} site:${s}`), base + (g.kind === "rent" ? " للإيجار" : g.kind === "job" ? " وظيفة" : "")].slice(0, max);
}

// ---- 3. reading one ad -----------------------------------------------------------------------------------------------------------------
// a page that IS one ad (not a search / category page with many prices)
const AD_URL = [/olx\.com\.eg\/(?:en\/)?ad\//i, /dubizzle\.com\.eg\/(?:en\/)?ad\//i, /aqarmap\.com\.eg\/(?:[a-z]{2}\/)?listing\//i, /propertyfinder\.eg\/(?:[a-z]{2}\/)?plp\//i, /bayut\.eg\/(?:[a-z]{2}\/)?property\/details/i,
  /hatla2ee\.com\/(?:[a-z]{2}\/)?car\/details/i, /hatla2ee\.com\/(?:[a-z]{2}\/)?car\/used\/[^/]+\/[^/]+\/\d+/i, /contactcars\.com\/(?:[a-z]{2}\/)?(?:used-cars|cars)\/[^/]+\/\d+/i, /amazon\.eg\/.*\/dp\//i, /noon\.com\/.*\/p\//i, /btech\.com\/.+\.html/i, /jumia\.com\.eg\/[^/]+\.html/i,
  /wuzzuf\.net\/jobs\/p\//i, /linkedin\.com\/jobs\/view\//i, /bayt\.com\/[a-z]{2}\/.+\/jobs\/.+-\d+/i, /forasna\.com\/(?:a\/)?job/i, /indeed\.com\/viewjob/i, /nawy\.com\/compound|nawy\.com\/property/i];
const SEARCH_URL = /[?&](q|query|keywords|search|k)=|\/search\b|\/s\?|\/(?:results|category|categories|listing\/?$|properties-for|for-rent\/?$|for-sale\/?$)|\/l\/|\/jobs\/?\?|\/cars\/?$/i;
export const isAdPage = (url, text) => AD_URL.some((re) => re.test(url)) || (!SEARCH_URL.test(url) && pricesIn(text).length >= 1 && pricesIn(text).length <= 3);
export const siteOf = (url) => String(url || "").replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
const urlKey = (u) => String(u || "").toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/[?#].*$/, "").replace(/\/$/, "");

/** Money amounts on a page with their place: not a phone number, a year, a size or a count. → [{ v, at, cur }] */
export function pricesIn(text) {
  // phone numbers first blanked out (same length, so positions stay): 01001234567, 0100 123 4567, +20 100 123 4567
  const t = latin(text).replace(/(?:\+?20[\s-]?)?0?1[0125][\s-]?\d{3,4}[\s-]?\d{4}(?!\d)/g, (m) => " ".repeat(m.length)), out = [];
  const re = /(?:(egp|le|l\.e\.?|usd|\$|aed|sar|ج\.م|جنيه|جنية)\s*)?(\d{1,3}(?:[,.\s]\d{3})+|\d{3,9})(?:\s*(k|الف|ألف|m|مليون|million))?\s*(egp|le\b|l\.e\.?|usd|aed|sar|ج\.م\.?|جنيه|جنية|pounds?|ريال|درهم)?/gi;
  let m;
  while ((m = re.exec(t))) {
    const raw = m[2], cur = (m[1] || m[4] || "").toLowerCase(), mul = (m[3] || "").toLowerCase();
    const near = t.slice(Math.max(0, m.index - 40), m.index + m[0].length + 25).toLowerCase();
    if (/^01[0125]\d{8}$/.test(raw.replace(/\D/g, "")) || /\+?20\s?1/.test(t.slice(Math.max(0, m.index - 4), m.index + 2))) continue;   // a phone number
    let v = +raw.replace(/[,.\s](?=\d{3}\b)/g, "");
    if (/^(k|الف|ألف)$/.test(mul)) v *= 1000; else if (/^(m|مليون|million)$/.test(mul)) v *= 1e6;
    const priced = !!cur || /price|سعر|السعر|بسعر|egp|جنيه|per month|monthly|شهري|\/month|asking|للبيع|for sale|للايجار|للإيجار|salary|راتب|مرتب/.test(near);
    if (!priced) continue;
    if (/^(19|20)\d{2}$/.test(raw) && !cur) continue;                                     // a year
    const after = t.slice(m.index + m[0].indexOf(raw) + raw.length, m.index + m[0].indexOf(raw) + raw.length + 8).toLowerCase();
    if (!cur && /^\s*(gb|tb|mb|g\b|جيجا|تيرا|ram|mah|hz|mp\b|w\b|inch|بوصة|cc\b|hp\b|حصان)/.test(after)) continue;   // a storage size / spec (256GB, 5000mAh), not a price
    if (/(m2|m²|sqm|متر|م2|km|كم|كيلو)/.test(t.slice(m.index + m[0].length, m.index + m[0].length + 6).toLowerCase()) && !cur) continue;   // a size / distance
    if (v < 100) continue;
    out.push({ v, at: m.index, cur: /usd|\$/.test(cur) ? "USD" : /aed|درهم/.test(cur) ? "AED" : /sar|ريال/.test(cur) ? "SAR" : "EGP" });
  }
  return out;
}
const firstNum = (re, t) => { const m = re.exec(t); return m ? +String(m[1]).replace(/,/g, "") : null; };
const FLOOR_W = { ground: 0, "ارضي": 0, "أرضي": 0, first: 1, "الاول": 1, "الأول": 1, second: 2, "التاني": 2, "الثاني": 2, third: 3, "التالت": 3, "الثالث": 3, fourth: 4, "الرابع": 4, fifth: 5, "الخامس": 5, sixth: 6, "السادس": 6, seventh: 7, "السابع": 7, eighth: 8, "الثامن": 8, "التامن": 8, ninth: 9, "التاسع": 9, tenth: 10, "العاشر": 10 };
/** One ad page → the listing: what code can read from it, each fact with the words it came from. */
/** The ad's own words around a place in it, cut at whole words: «… 5 minutes walk to Maadi metro station …» */
export function snip(text, at, len, pad = 22) {
  const t = String(text || ""); if (at < 0) return "";
  // the sentence the words are in (it ends with . ! ? ؟ or a new line) …
  let sa = at, sb = Math.min(t.length, at + len);
  while (sa > 0 && !/[.!?؟\n]/.test(t[sa - 1])) sa--;
  while (sb < t.length && !/[.!?؟\n]/.test(t[sb])) sb++;
  // … and within it, `pad` characters each side, widened to whole words
  let a = Math.max(sa, at - pad), b = Math.min(sb, at + len + pad);
  while (a > sa && /\S/.test(t[a - 1])) a--;
  while (b < sb && /\S/.test(t[b])) b++;
  return ((a > sa ? "…" : "") + t.slice(a, b).replace(/\s+/g, " ").trim().replace(/[,;:\s]+$/, "") + (b < sb ? "…" : "")).slice(0, 120);
}
export function readAd(hit, g) {
  const text = String(hit.text || ""), t = latin(text), f = fold(text), out = { id: urlKey(hit.url), url: hit.url, site: siteOf(hit.url), title: String(hit.title || "").slice(0, 120), image: hit.image || "", facts: {}, quotes: {} };
  // (a quote is the ad's own words: the phrase found again in the original text, case kept, cut at whole words)
  const q = (k, m) => { if (!m) return; const w = String(m).trim(); const i = latin(text).toLowerCase().indexOf(w.toLowerCase()); out.quotes[k] = i >= 0 ? snip(text, i, w.length, 0).replace(/^…|…$/g, "") : w.slice(0, 90); };
  // the price: the first priced amount (a rent: per month); skip "down payment / deposit / installment" amounts when there is another
  const ps = pricesIn(text);
  const pick = ps.find((p) => !/(down ?payment|deposit|installment|instalment|مقدم|تأمين|قسط|اقساط|أقساط)/i.test(t.slice(Math.max(0, p.at - 30), p.at))) || ps[0];
  if (pick) { out.facts.price = pick.v; out.facts.cur = pick.cur; out.quotes.price = snip(text, pick.at, String(pick.v).length + 4, 12); }
  let m;
  if ((m = /(\d{2,4})\s*(?:m2|m²|sqm|sq\.?\s?m|square met\w*|متر مربع|متر|م2|م²)/i.exec(t))) { out.facts.area = +m[1]; q("area", m[0]); }
  if ((m = /(\d{1,2})\s*(?:bed(?:room)?s?|br\b|rooms?|غرف|غرفه|غرفة|اوض|أوض|اوضه|أوضة)/i.exec(t))) { out.facts.beds = +m[1]; q("beds", m[0]); }
  else if ((m = /(?:bedrooms?|غرف النوم|عدد الغرف)\s*[:\-]?\s*(\d{1,2})/i.exec(t))) { out.facts.beds = +m[1]; q("beds", m[0]); }
  if ((m = /(?:floor|level|الدور|دور|الطابق)\s*[:\-]?\s*(\d{1,2}|ground|ارضي|أرضي|[؀-ۿ]+)/i.exec(t)) || (m = /(\d{1,2})(?:st|nd|rd|th)\s+floor/i.exec(t)) || (m = /(ground)\s+floor/i.exec(t))) {
    const w = String(m[1]).toLowerCase(), v = /^\d+$/.test(w) ? +w : FLOOR_W[w] != null ? FLOOR_W[w] : FLOOR_W[fold(w)] != null ? FLOOR_W[fold(w)] : null;
    if (v != null) { out.facts.floor = v; q("floor", m[0]); }
  }
  if ((m = /(?:model|year|موديل|سنه الصنع|سنة الصنع)\s*[:\-]?\s*((?:19|20)\d{2})/i.exec(t)) || (g && g.kind === "car" && (m = /\b((?:199|20[0-3])\d)\b/.exec(t)))) { out.facts.year = +m[1]; q("year", m[0]); }
  if ((m = /([\d,.]{1,9})\s*(k)?\s*(?:km|كم|كيلو(?:متر)?)(?!\s*\/)/i.exec(t)) && g && g.kind === "car") { out.facts.km = +m[1].replace(/[,.]/g, "") * (m[2] ? 1000 : 1); q("km", m[0]); }
  // (whole words only — «بالمعادي» holds the letters of «عادي»; an Arabic word may carry و / ب / ف / ل / ال in front)
  const W = (re) => (re ? new RegExp("(?<![\\p{L}\\p{N}])(?:[وبفل]?(?:ال)?)(?:" + re.source + ")(?:ه|ات|ين)?(?![\\p{L}\\p{N}])", "u") : null);
  const yes = (k, re0, no0) => { const re = W(re0), no = W(no0); const mm = re.exec(f); const nn = no ? no.exec(f) : null; const say = (m0) => { const i = f.indexOf(m0); out.quotes[k] = i >= 0 && f.length === text.length ? snip(text, i, m0.length, 14) : m0; };
    if (nn) { out.facts[k] = false; say(nn[0]); } else if (mm) { out.facts[k] = true; say(mm[0]); } };
  yes("oneOwner", /(one owner|first owner|1st owner|اول مالك|مالك واحد|فابريكه)/, /(second owner|2nd owner|تاني مالك|ثاني مالك)/);
  yes("noAccident", /(no accidents?|accident.free|never (been )?(crashed|in an accident)|بدون حوادث|مفيهاش حوادث|فبريكه بالكامل|فابريكه بالكامل)/, /(accident history|had an accident|مدهونه|عمرة|عموره|حادثه|حادثة)/);
  yes("auto", /(automatic|اوتوماتيك|اتوماتيك)/, /(manual|مانيوال|عادي)/);
  yes("new", /(\bbrand new\b|\bnew\b|زيرو|جديد)/, /(\bused\b|مستعمل)/);
  yes("used", /(\bused\b|مستعمل)/);
  yes("metro", /(metro|مترو)/);
  yes("pets", /(pets? (allowed|friendly|welcome)|يسمح بالحيوانات)/, /(no pets|pets not allowed|ممنوع الحيوانات)/);
  yes("furnished", /(\bfully furnished\b|\bfurnished\b|مفروش)/, /(unfurnished|not furnished|بدون فرش|مش مفروش)/);
  yes("unfurnished", /(unfurnished|not furnished|بدون فرش|مش مفروش)/, /(\bfully furnished\b|مفروش بالكامل)/);
  yes("elevator", /(elevator|\blift\b|اسانسير|مصعد)/);
  yes("parking", /(garage|parking|جراج|باركينج)/);
  yes("remote", /(remote|work from home|wfh|عن بعد)/, /(on.?site|من المكتب)/);
  yes("fullTime", /(full.time|دوام كامل)/, /(part.time|دوام جزئي)/);
  yes("warranty", /(warranty|ضمان)/, /(no warranty|بدون ضمان)/);
  if (g && g.kind === "job" && (m = /(\d{1,2})\s*(?:\+|-\s*\d{1,2})?\s*(?:years?|yrs?|سنين|سنوات|سنه|سنة)\s*(?:of\s+)?(?:experience|exp|خبره|خبرة)/i.exec(t))) { out.facts.exp = +m[1]; q("exp", m[0]); }
  out.item = normItem(out.title + " " + text.slice(0, 300));
  out.facts.place = (g && g.place && f.includes(fold(g.place))) ? g.place : placeOf(text.slice(0, 600));
  if (out.facts.place) q("place", out.facts.place);
  return out;
}

// ---- 4. checking every wish against the ad -----------------------------------------------------------------------------------------
/** → { ok: [say], bad: [say], unknown: [say], score 0–100, out (a hard "no") }. Every ✓ / ✗ comes with the ad's own words. */
export function check(ad, g) {
  const ok = [], bad = [], unknown = [];
  const F = ad.facts;
  const line = (w, good, quote) => (good === true ? ok : good === false ? bad : unknown).push({ k: w.k, en: w.say[0], ar: w.say[1], quote: quote || "" });
  // the budget
  if (g.max) line({ k: "price", say: [`under ${num(g.max)}`, `أقل من ${num(g.max)}`] }, F.price == null ? null : F.price <= g.max * 1.0001, ad.quotes.price);
  if (g.min) line({ k: "minPrice", say: [`over ${num(g.min)}`, `أكثر من ${num(g.min)}`] }, F.price == null ? null : F.price >= g.min, ad.quotes.price);
  if (g.model && g.model.must.length) {
    const have = " " + (ad.item || normItem(ad.title)) + " ";
    const miss = g.model.must.filter((w) => !have.includes(" " + w + " "));
    const extra = g.model.avoid.filter((v) => have.includes(" " + v + " ") && !(v === "pro" && g.model.must.includes("pro")));
    line({ k: "model", say: [`exactly ${g.model.must.join(" ")}`, `بالضبط ${g.model.must.join(" ")}`] }, miss.length ? false : extra.length ? false : true, miss.length ? "missing: " + miss.join(", ") : extra.length ? "it is a " + extra.join(" / ") + " model" : ad.title.slice(0, 60));
  }
  // a rent: a price a monthly rent can't be (a sale ad) is out
  if (g.kind === "rent" && F.price && F.price > 300000 && (!g.max || g.max < 300000)) line({ k: "price", say: ["a monthly rent (this is a sale price)", "إيجار شهري (هذا سعر بيع)"] }, false, ad.quotes.price);
  if (g.place) line({ k: "place", say: [`in ${g.place}`, `في ${g.place}`] }, F.place ? fold(F.place) === fold(g.place) || fold(F.place).includes(fold(g.place)) || fold(g.place).includes(fold(F.place)) : null, ad.quotes.place);
  for (const w of g.wish) {
    let r = null;
    if (w.k === "beds") r = F.beds == null ? null : F.beds >= w.min;
    else if (w.k === "notGround") r = F.floor == null ? null : F.floor > 0;
    else if (w.k === "area") r = F.area == null ? null : F.area >= w.min;
    else if (w.k === "year") r = F.year == null ? null : F.year >= w.min && (!w.max || F.year <= w.max);
    else if (w.k === "km") r = F.km == null ? null : F.km <= w.max;
    else if (w.k === "exp") r = F.exp == null ? null : F.exp <= w.have;
    else r = F[w.k] == null ? null : F[w.k];
    line(w, r, ad.quotes[w.k === "notGround" ? "floor" : w.k]);
  }
  const hard = bad.some((b) => ["price", "minPrice", "beds", "year", "km", "notGround", "place", "model", "exp"].includes(b.k));
  const total = ok.length + bad.length + unknown.length || 1;
  const score = Math.max(0, Math.round(100 * (ok.length + 0.3 * unknown.length) / total - (hard ? 40 : 0) - 15 * bad.length));
  return { ok, bad, unknown, score, out: hard };
}

// ---- 5. the same ad on two sites --------------------------------------------------------------------------------------------------------
/** A key for "the same thing": price + size + rooms (+ year / km for a car), close enough. */
export const twinKey = (ad) => { const F = ad.facts; return F.price ? [Math.round(F.price / 500), F.area || "", F.beds || "", F.year || "", F.km ? Math.round(F.km / 5000) : ""].join("|") : ""; };
export function mergeTwins(ads) {
  const by = new Map(), out = [];
  for (const a of ads) {
    const k = twinKey(a);
    const same = k && (k.split("|").filter(Boolean).length >= 3) ? by.get(k) : null;
    if (same && same.site !== a.site) { same.also = [...(same.also || []), { site: a.site, url: a.url }]; continue; }
    if (k) by.set(k, a);
    out.push(a);
  }
  return out;
}

// ---- 6. is the price fair? ----------------------------------------------------------------------------------------------------------------
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
/** Compared with similar ads Scout has seen for this goal: per m² for homes (when sizes are known), else the price. → { pct, basis, n } | null */
export function fairness(ad, seen) {
  const F = ad.facts; if (!F.price) return null;
  const like = (seen || []).filter((s) => s.id !== ad.id && s.facts && s.facts.price && s.facts.cur === F.cur && (!F.beds || !s.facts.beds || Math.abs(s.facts.beds - F.beds) <= 1));
  const perM = F.area && like.filter((s) => s.facts.area).length >= 4;
  const vals = perM ? like.filter((s) => s.facts.area).map((s) => s.facts.price / s.facts.area) : like.map((s) => s.facts.price);
  if (vals.length < 4) return null;
  const mid = median(vals), mine = perM ? F.price / F.area : F.price;
  return { pct: Math.round(((mine - mid) / mid) * 100), basis: perM ? "m2" : "price", n: vals.length, median: perM ? Math.round(mid) : Math.round(mid) };
}

// ---- 7. learning from 👍 / 👎 -----------------------------------------------------------------------------------------------------------
const tokens = (ad) => [...new Set(fold(ad.title + " " + ad.site + " " + (ad.facts.place || "")).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3))];
/** taste = { up: {word: n}, down: {word: n} } → a nudge of −15…+15 for an ad like the ones liked / disliked. */
export function tasteNudge(ad, taste) {
  if (!taste) return 0;
  let s = 0; for (const w of tokens(ad)) s += ((taste.up || {})[w] || 0) - ((taste.down || {})[w] || 0);
  return Math.max(-15, Math.min(15, s * 3));
}
export function learn(taste, ad, up) {
  const t = { up: { ...((taste && taste.up) || {}) }, down: { ...((taste && taste.down) || {}) } }, side = up ? t.up : t.down;
  for (const w of tokens(ad)) side[w] = (side[w] || 0) + 1;
  return t;
}

// ---- 8. one run of a goal --------------------------------------------------------------------------------------------------------------
/** hits from the searches → this run's results, merged with what was seen before.
 *  goal = { id, g, seen: [ad], taste, votes: {id: 1|-1} } → { found: [ad with check/fair/score], fresh: [ids new this run], seen }. */
export function runGoal(goal, hits, { now = Date.now() } = {}) {
  const g = goal.g, seenIds = new Set((goal.seen || []).map((s) => s.id));
  const ads = mergeTwins((hits || []).filter((h) => h && h.url && isAdPage(h.url, h.text || "")).map((h) => readAd(h, g)));
  const seen = [...(goal.seen || [])];
  for (const a of ads) { const i = seen.findIndex((s) => s.id === a.id); const rec = { ...a, firstSeen: i >= 0 ? seen[i].firstSeen : now, lastSeen: now, history: [...((i >= 0 && seen[i].history) || []), ...(a.facts.price ? [[now, a.facts.price]] : [])].slice(-30) }; if (i >= 0) seen[i] = rec; else seen.push(rec); }
  const found = seen.filter((a) => a.lastSeen >= now - 14 * 86400000 && (goal.votes || {})[a.id] !== -1).map((a) => {
    const c = check(a, g), fair = fairness(a, seen);
    const score = Math.max(0, Math.min(100, c.score + tasteNudge(a, goal.taste) + (fair && fair.pct <= -5 ? 8 : fair && fair.pct >= 15 ? -8 : 0) + ((goal.votes || {})[a.id] === 1 ? 20 : 0)));
    const dropped = a.history && a.history.length >= 2 && a.history[a.history.length - 1][1] < a.history[0][1] ? a.history[0][1] - a.history[a.history.length - 1][1] : 0;
    return { ...a, check: c, fair, score, dropped };
  }).filter((a) => !a.check.out).sort((a, b) => b.score - a.score);
  // a product: the same item in several stores → the cheapest is marked (and ranks first among equals)
  if (g.kind === "product") {
    const priced = found.filter((a) => a.facts.price && a.check.ok.some((x) => x.k === "model"));
    const sites = new Set(priced.map((a) => a.site));
    if (sites.size >= 2) { const min = Math.min(...priced.map((a) => a.facts.price)); for (const a of priced) if (a.facts.price === min) { a.cheapest = sites.size; a.score = Math.min(100, a.score + 5); } found.sort((a, b) => b.score - a.score); }
  }
  return { found, fresh: ads.filter((a) => !seenIds.has(a.id)).map((a) => a.id), seen: seen.slice(-400) };
}
/** The few worth a notification: new this run (or cheaper than before) and strong. */
export function worthTelling(run, min = 75) {
  return run.found.filter((a) => (run.fresh.includes(a.id) || a.dropped > 0) && a.score >= min).slice(0, 3);
}

// ---- 9. the message to the seller ----------------------------------------------------------------------------------------------------------
export function sellerMessage(ad, g, { ar = true } = {}) {
  const F = ad.facts, fair = ad.fair;
  const offer = F.price ? Math.round((fair && fair.pct > 0 ? F.price * (1 - Math.min(fair.pct, 15) / 100) : F.price * 0.95) / 500) * 500 : null;
  const what = ad.title || g.what;
  if (ar) return [`السلام عليكم، بخصوص إعلان «${what}»${ad.site ? " على " + ad.site : ""}.`,
    `هل ما زال متاحًا؟${F.price ? ` وهل السعر ${num(F.price)} قابل للتفاوض؟` : ""}`,
    fair && fair.pct > 0 ? `الإعلانات المشابهة${fair.basis === "m2" ? " في نفس المنطقة" : ""} في حدود ${fair.basis === "m2" ? num(fair.median) + " للمتر" : num(fair.median)}، فهل يمكن ${num(offer)}؟` : offer ? `هل يمكن ${num(offer)}؟` : "",
    "شكرًا."].filter(Boolean).join("\n");
  return [`Hello, about your ad "${what}"${ad.site ? " on " + ad.site : ""}.`, `Is it still available?${F.price ? ` Is ${num(F.price)} negotiable?` : ""}`,
    fair && fair.pct > 0 ? `Similar listings are around ${fair.basis === "m2" ? num(fair.median) + " per m²" : num(fair.median)} — would you take ${num(offer)}?` : offer ? `Would you take ${num(offer)}?` : "", "Thank you."].filter(Boolean).join("\n");
}

// ---- the store --------------------------------------------------------------------------------------------------------------------------
export const SCOUT_KEY = "attune:scout:v1";
export function loadScout(ls = typeof localStorage !== "undefined" ? localStorage : null) { try { const j = JSON.parse((ls && ls.getItem(SCOUT_KEY)) || "null"); return j && Array.isArray(j.goals) ? j : { goals: [] }; } catch (e) { return { goals: [] }; } }
export function saveScout(d, ls = typeof localStorage !== "undefined" ? localStorage : null) { try { ls && ls.setItem(SCOUT_KEY, JSON.stringify(d)); } catch (e) {} return d; }
export function addGoal(d, text, now = Date.now()) {
  const g = parseGoal(text);
  const goal = { id: "s" + now.toString(36) + Math.random().toString(36).slice(2, 5), text: String(text).trim(), g, created: now, lastRun: 0, seen: [], votes: {}, taste: { up: {}, down: {} }, on: true };
  return { data: { ...d, goals: [goal, ...d.goals] }, goal };
}
/** Due for a run: never run, or the last run is older than `hours` (twice a day by default). */
export const dueGoals = (d, now = Date.now(), hours = 12) => (d.goals || []).filter((x) => x.on !== false && now - (x.lastRun || 0) >= hours * 3600000);
/** Is this sentence a Scout goal? ("find me a flat in Maadi under 15k", «دورلي على عربية …») */
export const looksLikeGoal = (text) => /^\s*(find me|look for|hunt for|search for|scout|keep looking for|watch for|alert me when|tell me when)\b|^\s*(دورلي|دور لي|دوّرلي|ابحثلي|ابحث لي|شوفلي|شوف لي|نبهني لما|قولي لما)/i.test(String(text || ""));
