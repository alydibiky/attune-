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
  // v6.35: gold — "tell me when 21 karat gold is under 3,500 a gram" (the price of a gram, not ads)
  if (/\bgold\b|ذهب|دهب|الدهب|الذهب/.test(t) && !/\b(ring|necklace|bracelet|chain)\b|خاتم|سلسله|سلسلة|غويشه|غويشة/.test(t)) kind = "gold";
  const g = { raw, kind, place: placeOf(raw), max: null, min: null, wish: [] };
  if (kind === "gold") { const k = /(24|22|21|18)\s*(?:k\b|kt|karat|carat|قيراط|عيار)|(?:عيار|karat)\s*(24|22|21|18)/i.exec(latin(t)); g.karat = k ? +(k[1] || k[2]) : 21; }
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
  // v6.35 (Ali: "Hyundai Tucson 2022 used price" → "it redirected me to 2027, I wanted only 2022"): a car or a product with a
  // plain year is THAT year
  const yr1 = !yr && (kind === "car" || kind === "product") && /(?:^|[^\d])((?:19[89]|20[0-3])\d)(?!\d)/.exec(latin(t));
  if (yr1) g.wish.push({ k: "year", min: +yr1[1], max: +yr1[1], say: [`model ${yr1[1]}`, `موديل ${yr1[1]}`] });
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
  // v6.43 (Ali: "Nissan Tuscon 2022 used" found only Dubizzle pages): the car's maker comes from its model (the Tucson is a
  // Hyundai), a misspelt model is corrected, and the search words are the maker + model + year
  if (g.kind === "car") fixCar(g);
  // v6.28: the exact item (make, model, numbers, storage) — an iPhone 16 Pro Max or an Elantra is not what was asked for
  if (g.kind === "product" || g.kind === "car") g.model = modelOf(g);
  if (g.kind === "car" && g.car) g.model = { must: g.car.model.split(" "), avoid: [] };
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
// ---- v6.43 cars: model → maker, with the Arabic names (Egypt's market first) -------------------------------------------------------
export const CARS = {
  hyundai: ["هيونداي", { tucson: "توسان", elantra: "النترا", accent: "اكسنت", creta: "كريتا", i10: "i10", i20: "i20", sonata: "سوناتا", "santa fe": "سانتافي", verna: "فيرنا", bayon: "بايون", kona: "كونا" }],
  kia: ["كيا", { sportage: "سبورتاج", cerato: "سيراتو", picanto: "بيكانتو", rio: "ريو", sorento: "سورينتو", seltos: "سيلتوس", pegas: "بيجاس", sonet: "سونيت", k5: "k5" }],
  nissan: ["نيسان", { sunny: "صني", sentra: "سنترا", qashqai: "قشقاي", "x-trail": "اكس تريل", juke: "جوك", patrol: "باترول", navara: "نافارا" }],
  toyota: ["تويوتا", { corolla: "كورولا", yaris: "ياريس", camry: "كامري", rav4: "راف فور", fortuner: "فورتشنر", hilux: "هايلكس", "c-hr": "سي اتش ار", "land cruiser": "لاند كروزر", rush: "راش", belta: "بيلتا" }],
  chevrolet: ["شيفروليه", { optra: "اوبترا", aveo: "افيو", cruze: "كروز", lanos: "لانوس", captiva: "كابتيفا" }],
  mitsubishi: ["ميتسوبيشي", { lancer: "لانسر", attrage: "اتراج", "eclipse cross": "اكليبس كروس", pajero: "باجيرو", xpander: "اكسباندر", mirage: "ميراج" }],
  mg: ["ام جي", { zs: "zs", mg5: "mg5", mg6: "mg6", rx5: "rx5", hs: "hs" }],
  chery: ["شيري", { tiggo: "تيجو", arrizo: "اريزو" }],
  skoda: ["سكودا", { octavia: "اوكتافيا", kodiaq: "كودياك", karoq: "كاروك", fabia: "فابيا", superb: "سوبرب", kamiq: "كاميك" }],
  renault: ["رينو", { logan: "لوجان", duster: "داستر", megane: "ميجان", kadjar: "كادجار", sandero: "ساندرو", austral: "اوسترال" }],
  peugeot: ["بيجو", { 301: "301", 2008: "2008", 3008: "3008", 5008: "5008", 508: "508", 408: "408" }],
  honda: ["هوندا", { civic: "سيفيك", city: "سيتي", "cr-v": "سي ار في", accord: "اكورد" }],
  suzuki: ["سوزوكي", { swift: "سويفت", dzire: "ديزاير", ertiga: "ارتيجا", vitara: "فيتارا", ciaz: "سياز" }],
  volkswagen: ["فولكس", { golf: "جولف", passat: "باسات", tiguan: "تيجوان", polo: "بولو" }],
  fiat: ["فيات", { tipo: "تيبو", "500x": "500x" }],
  opel: ["اوبل", { astra: "استرا", corsa: "كورسا", grandland: "جراندلاند", crossland: "كروسلاند" }],
  jetour: ["جيتور", { x70: "x70", dashing: "داشينج" }],
  geely: ["جيلي", { coolray: "كولراي", emgrand: "امجراند" }],
  byd: ["بي واي دي", { f3: "f3", seal: "سيل" }],
};
const MAKE_WORDS = { hyundai: ["hyundai", "هيونداي", "هونداي"], kia: ["kia", "كيا"], nissan: ["nissan", "نيسان"], toyota: ["toyota", "تويوتا"], chevrolet: ["chevrolet", "chevy", "شيفروليه", "شفرليه"], mitsubishi: ["mitsubishi", "ميتسوبيشي"], mg: ["mg", "ام جي"], chery: ["chery", "شيري"], skoda: ["skoda", "سكودا", "اسكودا"], renault: ["renault", "رينو"], peugeot: ["peugeot", "بيجو"], honda: ["honda", "هوندا"], suzuki: ["suzuki", "سوزوكي"], volkswagen: ["volkswagen", "vw", "فولكس"], fiat: ["fiat", "فيات"], opel: ["opel", "اوبل"], jetour: ["jetour", "جيتور"], geely: ["geely", "جيلي"], byd: ["byd"], mercedes: ["mercedes", "مرسيدس"], bmw: ["bmw", "بي ام"] };
const cap = (w) => w.split(/([ -])/).map((x) => (/^[a-z]/.test(x) ? (x.length <= 3 && /\d/.test(x) ? x.toUpperCase() : x[0].toUpperCase() + x.slice(1)) : x)).join("");
/** A car goal: find the model (a word one letter off counts: "tuscon" → tucson), its real maker, and say so when the maker typed is another one. */
export function fixCar(g) {
  const words = normItem(g.raw).split(" ");
  const said = Object.keys(MAKE_WORDS).find((mk) => MAKE_WORDS[mk].some((w) => (" " + fold(g.raw) + " ").includes(" " + fold(w) + " ")));
  let hit = null;
  for (const [make, [, models]] of Object.entries(CARS)) for (const [model, ar] of Object.entries(models)) {
    const parts = model.split(" ");
    const at = words.findIndex((w, i) => parts.every((pt, k) => { const x = words[i + k]; return x && (x === pt || x === pt.replace("-", "") || (pt.length >= 5 && !/\d/.test(pt) && close1(x, pt)) || x === normItem(ar)); }));
    if (at < 0) continue;
    if (/^\d+$/.test(model) && said !== make) continue;          // "301", "2008" alone are a Peugeot only when Peugeot is said
    const exact = words[at] === parts[0];
    if (!hit || (exact && !hit.exact) || (said === make && hit.make !== said)) hit = { make, model, ar, exact };
  }
  if (!hit) return g;
  const year = (g.wish.find((w) => w.k === "year") || {}).min;
  const used = g.wish.some((w) => w.k === "used"), isNew = g.wish.some((w) => w.k === "new");
  g.car = { make: hit.make, model: hit.model, makeAr: CARS[hit.make][0], modelAr: hit.ar, year: year || null };
  if (said && said !== hit.make) g.car.note = [`The ${cap(hit.model)} is made by ${cap(hit.make)}, not ${cap(said)} — searching for the ${cap(hit.make)} ${cap(hit.model)}.`, `${hit.ar} من ${CARS[hit.make][0]} مش ${(MAKE_WORDS[said] || [said]).find((w) => /[؀-ۿ]/.test(w)) || said} — بدوّر على ${CARS[hit.make][0]} ${hit.ar}.`];
  else if (!hit.exact) g.car.note = [`Searching for the ${cap(hit.make)} ${cap(hit.model)}.`, `بدوّر على ${CARS[hit.make][0]} ${hit.ar}.`];
  g.what = [cap(hit.make), cap(hit.model), year || "", used ? "used" : isNew ? "new" : ""].filter(Boolean).join(" ");
  return g;
}
/** The words an ad must have to be the item asked for, and the variants that make it a different one. */
export function modelOf(g) {
  const place = new Set(normItem(g.place || "").split(" "));
  let toks = normItem(g.what || g.raw).split(" ").filter((w) => w && (w.length > 1 || /\d/.test(w)) && !ITEM_STOP.has(w) && !place.has(w) && !/^(19|20)\d{2}$/.test(w) && !/^\d{4,}$/.test(w) && !/^\d+k$/.test(w));
  if (g.kind === "car") toks = toks.filter((w) => !/^\d+$/.test(w));   // a car: make and model words (the years are checked apart)
  const must = [...new Set(toks)].slice(0, 6);
  return { must, avoid: VARIANTS.filter((v) => !must.includes(v)) };
}
// v7.9: the same place in English and Arabic ("6th of october" = «اكتوبر», "new cairo" = «التجمع») — an ad isn't marked
// "not in the place" because it wrote the other language
const SAME_PLACE = [["new cairo", "التجمع", "التجمع الخامس", "fifth settlement"], ["maadi", "المعادي"], ["zamalek", "الزمالك"], ["heliopolis", "مصر الجديده", "مصر الجديدة"],
  ["nasr city", "مدينه نصر", "مدينة نصر"], ["dokki", "الدقي"], ["mohandessin", "المهندسين"], ["sheikh zayed", "الشيخ زايد", "zayed", "زايد"],
  ["6th of october", "october", "اكتوبر", "أكتوبر", "6 اكتوبر", "6 أكتوبر"], ["shorouk", "الشروق"], ["madinaty", "مدينتي"], ["rehab", "الرحاب"], ["obour", "العبور"],
  ["giza", "الجيزه", "الجيزة"], ["haram", "الهرم"], ["faisal", "فيصل"], ["downtown", "وسط البلد"], ["garden city", "جاردن سيتي"], ["mokattam", "المقطم"], ["shubra", "شبرا"],
  ["ain shams", "عين شمس"], ["helwan", "حلوان"], ["alexandria", "اسكندريه", "الإسكندرية", "اسكندرية"], ["smouha", "سموحه"], ["sidi gaber", "سيدي جابر"], ["north coast", "الساحل", "sahel"],
  ["hurghada", "الغردقه", "الغردقة"], ["sharm", "شرم"], ["ain sokhna", "السخنه", "العين السخنة"], ["new capital", "العاصمه الاداريه", "العاصمة الإدارية"], ["mansoura", "المنصوره", "المنصورة"],
  ["tanta", "طنطا"], ["zagazig", "الزقازيق"], ["cairo", "القاهره", "القاهرة"], ["dubai", "دبي"], ["riyadh", "الرياض"], ["jeddah", "جده", "جدة"], ["doha", "الدوحه"], ["kuwait", "الكويت"]].map((g) => g.map(fold));
export function samePlace(a, b) {
  const x = fold(a || ""), y = fold(b || ""); if (!x || !y) return false;
  if (x === y || x.includes(y) || y.includes(x)) return true;
  return SAME_PLACE.some((g) => g.some((p) => x.includes(p)) && g.some((p) => y.includes(p)));
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
  car: ["hatla2ee.com", "dubizzle.com.eg", "contactcars.com", "yallamotor.com", "carsemsar.com"],
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
export function searchesFor(g, max = 9) {
  const base = [g.what || g.raw, g.place && !fold(g.what || "").includes(fold(g.place)) ? g.place : ""].filter(Boolean).join(" ");
  // v6.43 (Ali: "it only searched Dubizzle — open more websites, even ones nobody knows, and compare"): the known sites AND open
  // searches in English and Arabic (they bring the sites Scout doesn't know), and for a car or a product the price guides too
  if (g.kind === "car" && g.car) {
    const c = g.car, y = c.year ? " " + c.year : "", used = !g.wish.some((w) => w.k === "new");
    const en = `${cap(c.make)} ${cap(c.model)}${y}`, ar = `${c.makeAr} ${c.modelAr}${y}`;
    return [`${en} ${used ? "used " : ""}site:hatla2ee.com`, `${en} site:dubizzle.com.eg`, `${en} site:contactcars.com`, `${ar} ${used ? "مستعمل " : ""}للبيع`,
      `${en} ${used ? "used " : ""}for sale Egypt`, `${en} site:yallamotor.com`, `${ar} site:carsemsar.com`, `${en} ${used ? "used " : ""}price Egypt`, `سعر ${ar} ${used ? "مستعمل" : "جديد"}`].slice(0, max);
  }
  const AR = { rent: " للإيجار", "buy-home": " للبيع", car: " للبيع", product: " سعر", job: " وظيفة", service: "", tender: " مناقصة" };
  return [...(SITES[g.kind] || SITES.product).slice(0, 5).map((s) => `${base} site:${s}`), base + (AR[g.kind] || ""), base + (g.kind === "job" ? " jobs Egypt" : g.kind === "rent" ? (/rent|ايجار|إيجار/i.test(base) ? " price Egypt" : " for rent") : " price Egypt"), g.kind === "product" ? base + " best price compare" : base + " Egypt"].slice(0, max);
}

// ---- 3. reading one ad -----------------------------------------------------------------------------------------------------------------
// a page that IS one ad (not a search / category page with many prices)
const AD_URL = [/olx\.com\.eg\/(?:en\/)?ad\//i, /dubizzle\.com\.eg\/(?:en\/)?ad\//i, /aqarmap\.com\.eg\/(?:[a-z]{2}\/)?listing\//i, /propertyfinder\.eg\/(?:[a-z]{2}\/)?plp\//i, /bayut\.eg\/(?:[a-z]{2}\/)?property\/details/i,
  /hatla2ee\.com\/(?:[a-z]{2}\/)?car\/details/i, /yallamotor\.com\/used-cars\/[^?#]+\/\d{4,}/i, /carsemsar\.com\/.*(?:car|ad)[\/-]\d+/i, /hatla2ee\.com\/(?:[a-z]{2}\/)?car\/used\/[^/]+\/[^/]+\/\d+/i, /contactcars\.com\/(?:[a-z]{2}\/)?(?:used-cars|cars)\/[^/]+\/\d+/i, /amazon\.eg\/.*\/dp\//i, /noon\.com\/.*\/p\//i, /btech\.com\/.+\.html/i, /jumia\.com\.eg\/[^/]+\.html/i,
  /wuzzuf\.net\/jobs\/p\//i, /linkedin\.com\/jobs\/view\//i, /bayt\.com\/[a-z]{2}\/.+\/jobs\/.+-\d+/i, /forasna\.com\/(?:a\/)?job/i, /indeed\.com\/viewjob/i, /nawy\.com\/compound|nawy\.com\/property/i];
const SEARCH_URL = /[?&](q|query|keywords|search|k)=|\/search\b|\/s\?|\/(?:results|category|categories|listing\/?$|properties-for|for-rent\/?$|for-sale\/?$)|\/l\/|\/jobs\/?\?|\/cars\/?$/i;
// v6.35: on the sites whose ad addresses are known, only an ad address is an ad (a dubizzle "Hyundai Tucson — Vehicles for sale in
// Egypt" category page had one stray number and was scored 100/100); a title that names a list is never one ad
const KNOWN_AD_SITE = /(^|\.)(olx\.com\.eg|dubizzle\.com\.eg|aqarmap\.com\.eg|propertyfinder\.eg|bayut\.eg|hatla2ee\.com|contactcars\.com|amazon\.eg|noon\.com|jumia\.com\.eg|wuzzuf\.net|bayt\.com|nawy\.com)$/i;
const LIST_TITLE = /\b(for sale in|for rent in|vehicles for sale|cars for sale|properties for|apartments for|\d[\d,]*\s+(ads|results|listings|properties|cars)|buy (&|and) sell|best prices? (in|online))\b|للبيع في مصر|للايجار في|للإيجار في|اعلان|إعلان مبوب/i;
// v6.46 (Ali, 21 Oct: "scouting is absolutely useless" — a Tucson search "compared" nfl.com, calculator.io and a Malaysian forum):
// sites that never carry a sale ad, and an unknown site counts only when its price is written WITH a currency
const NOT_AD = /(^|\.)(bartleby\.com|studocu\.com|coursehero\.com|chegg\.com|ipl\.org|ukessays\.com|gradesaver\.com|sparknotes\.com|scribd\.com|academia\.edu|researchgate\.net|essaytyper\.com|papersowl\.com|brainly\.[a-z.]+|slideshare\.net|wikipedia\.org|wikihow\.com|youtube\.com|youtu\.be|nfl\.com|espn\.com|fifa\.com|imdb\.com|reddit\.com|quora\.com|medium\.com|pinterest\.com|tiktok\.com|instagram\.com|x\.com|twitter\.com|linkedin\.com(?!\/jobs)|github\.com|stackoverflow\.com|bbc\.(com|co\.uk)|cnn\.com|reuters\.com|aljazeera\.(net|com)|youm7\.com|masrawy\.com|almasryalyoum\.com|caranddriver\.com|motortrend\.com|edmunds\.com|kbb\.com|cars\.com|autotrader\.com|carwow\.co\.uk)$|calculator|forum|blog|news|wiki|weather|dictionary|translate/i;
export const isAdPage = (url, text, title = "") => {
  if (NOT_AD.test(siteOf(url)) || /\/(forum|forums|thread|threads|news|blog|wiki)\//i.test(String(url))) return false;
  if (AD_URL.some((re) => re.test(url))) return true;
  if (KNOWN_AD_SITE.test(siteOf(url)) || LIST_TITLE.test(String(title)) || SEARCH_URL.test(url)) return false;
  const ps = pricesIn(text);
  return ps.length >= 1 && ps.length <= 3 && ps.some((p) => p.explicit);
};
export const siteOf = (url) => String(url || "").replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
const urlKey = (u) => String(u || "").toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/[?#].*$/, "").replace(/\/$/, "");

/** Money amounts on a page with their place: not a phone number, a year, a size or a count. → [{ v, at, cur }] */
export function pricesIn(text) {
  // phone numbers first blanked out (same length, so positions stay): 01001234567, 0100 123 4567, +20 100 123 4567
  const t = latin(text).replace(/(?:\+?20[\s-]?)?0?1[0125][\s-]?\d{3,4}[\s-]?\d{4}(?!\d)/g, (m) => " ".repeat(m.length)), out = [];
  const re = /(?:(egp|le|l\.e\.?|usd|\$|aed|sar|ج\.م|جنيه|جنية)\s*)?(\d{1,3}(?:[,.\s]\d{3})+|\d{3,9})(?:\s*(k(?![a-z])|الف|ألف|m(?![2²a-z])|مليون|million))?\s*(egp|le\b|l\.e\.?|usd|aed|sar|ج\.م\.?|جنيه|جنية|pounds?|ريال|درهم)?/gi;
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
    out.push({ v, at: m.index, cur: /usd|\$/.test(cur) ? "USD" : /aed|درهم/.test(cur) ? "AED" : /sar|ريال/.test(cur) ? "SAR" : "EGP", explicit: !!cur });
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
  // v6.35 (a "151 EGP" Tucson): an amount no car / home / rent can cost is not its price
  // v6.46: and not more than it can cost (a car's "1,850 a month" rental or a 2-billion page total is not its price either)
  const inBand = (p) => !(g && BIG[g.kind]) || (p.v >= BAND[g.kind][0] / (p.cur === "EGP" ? 1 : 50) && (g.kind === "rent" || p.v <= BAND[g.kind][1] / (p.cur === "EGP" ? 1 : 50)));   // (a sale price in a rent search stays, so the check can say so)
  const good = pick && inBand(pick) ? pick : ps.find(inBand);
  if (good) { out.facts.price = good.v; out.facts.cur = good.cur; out.quotes.price = snip(text, good.at, String(good.v).length + 4, 12); }
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
  // v6.35 the scam check: the phone numbers in the ad, and words that ask for money before you see the thing
  out.phones = [...new Set((latin(text).match(/(?:\+?20[\s-]?)?0?1[0125][\s-]?\d{3,4}[\s-]?\d{4}(?!\d)/g) || []).map((x) => "0" + x.replace(/\D/g, "").replace(/^20/, "").replace(/^0/, "")))].slice(0, 3);
  const flag = RED_FLAGS.exec(f) || RED_FLAGS.exec(t.toLowerCase());
  if (flag) out.redFlag = snip(text, Math.max(0, latin(text).toLowerCase().indexOf(flag[0])), flag[0].length, 18) || flag[0];
  out.short = text.replace(/\s+/g, " ").trim().length < 160;
  out.item = normItem(out.title + " " + text.slice(0, 300));
  out.facts.place = (g && g.place && (f.includes(fold(g.place)) || samePlace(placeOf(text.slice(0, 600)), g.place))) ? g.place : placeOf(text.slice(0, 600));
  if (out.facts.place) q("place", out.facts.place);
  return out;
}

/** Damerau–Levenshtein distance ≤ 1 (one edit or one swap of neighbours). */
export function close1(a, b) {
  if (a === b) return true;
  if (a.length === b.length) {
    const d = []; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d.push(i);
    return d.length === 1 || (d.length === 2 && d[1] === d[0] + 1 && a[d[0]] === b[d[1]] && a[d[1]] === b[d[0]]);
  }
  const [s, l] = a.length < b.length ? [a, b] : [b, a];
  if (l.length - s.length !== 1) return false;
  for (let i = 0; i < l.length; i++) if (l.slice(0, i) + l.slice(i + 1) === s) return true;
  return false;
}
const RED_FLAGS = /\b(deposit (first|before)|pay (first|before|in advance)|advance payment before|send (the )?money|transfer (the )?money|western union|moneygram|gift ?cards?|shipping only|i am (abroad|outside egypt)|before (viewing|inspection|you see))\b|عربون قبل|مقدم قبل المعاينه|مقدم قبل المعاينة|قبل المعاينه|قبل المعاينة|حول الفلوس|حول المبلغ|حوّل المبلغ|تحويل قبل|ابعت الفلوس|انا مسافر|أنا مسافر|انا بره مصر|أنا بره مصر|خارج مصر|بالشحن فقط|شحن فقط/i;
// ---- 4. checking every wish against the ad -----------------------------------------------------------------------------------------
/** → { ok: [say], bad: [say], unknown: [say], score 0–100, out (a hard "no") }. Every ✓ / ✗ comes with the ad's own words. */
export function check(ad, g) {
  const ok = [], bad = [], unknown = [];
  const F = ad.facts, Q = ad.quotes || {};
  const line = (w, good, quote) => (good === true ? ok : good === false ? bad : unknown).push({ k: w.k, en: w.say[0], ar: w.say[1], quote: quote || "" });
  // the budget
  if (g.max) line({ k: "price", say: [`under ${num(g.max)}`, `أقل من ${num(g.max)}`] }, F.price == null ? null : F.price <= g.max * 1.0001, Q.price);
  if (g.min) line({ k: "minPrice", say: [`over ${num(g.min)}`, `أكثر من ${num(g.min)}`] }, F.price == null ? null : F.price >= g.min, Q.price);
  if (g.model && g.model.must.length) {
    const have = " " + (ad.item || normItem(ad.title)) + " ";
    // v6.35 ("Tuscon" for Tucson): a word of 5+ letters also matches with one letter wrong, missing, extra or two swapped
    const words = have.trim().split(" ");
    const near = (w) => w.length >= 5 && !/\d/.test(w) && words.some((x) => Math.abs(x.length - w.length) <= 1 && close1(x, w));
    const miss = g.model.must.filter((w) => !have.includes(" " + w + " ") && !near(w));
    const extra = g.model.avoid.filter((v) => have.includes(" " + v + " ") && !(v === "pro" && g.model.must.includes("pro")));
    line({ k: "model", say: [`exactly ${g.model.must.join(" ")}`, `بالضبط ${g.model.must.join(" ")}`] }, miss.length ? false : extra.length ? false : true, miss.length ? "missing: " + miss.join(", ") : extra.length ? "it is a " + extra.join(" / ") + " model" : ad.title.slice(0, 60));
  }
  // a rent: a price a monthly rent can't be (a sale ad) is out
  if (g.kind === "rent" && F.price && F.price > 300000 && (!g.max || g.max < 300000)) line({ k: "price", say: ["a monthly rent (this is a sale price)", "إيجار شهري (هذا سعر بيع)"] }, false, Q.price);
  if (g.place) line({ k: "place", say: [`in ${g.place}`, `في ${g.place}`] }, F.place ? samePlace(F.place, g.place) : null, Q.place);
  for (const w of g.wish) {
    let r = null;
    if (w.k === "beds") r = F.beds == null ? null : F.beds >= w.min;
    else if (w.k === "notGround") r = F.floor == null ? null : F.floor > 0;
    else if (w.k === "area") r = F.area == null ? null : F.area >= w.min;
    else if (w.k === "year") r = F.year == null ? null : F.year >= w.min && (!w.max || F.year <= w.max);
    else if (w.k === "km") r = F.km == null ? null : F.km <= w.max;
    else if (w.k === "exp") r = F.exp == null ? null : F.exp <= w.have;
    else r = F[w.k] == null ? null : F[w.k];
    line(w, r, Q[w.k === "notGround" ? "floor" : w.k]);
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
/** v6.35 the fair-price meter (Ali: "this should already be in scouting so it's more accurate"): the ad against ads of THE SAME
    thing — a car of the same make / model within a year (each year ≈ 7 %, each 10,000 km ≈ 0.8 % — both corrected for), a home
    with ±1 bedroom per m² when sizes are known — from this goal and every earlier search (the market book). Needs 4 like it.
    → { pct, basis, n, median, low, high, verdict: "cheap" | "fair" | "high" | "too-cheap" } | null */
const YEAR_K = 0.07, KM_K = 0.008;
export function fairness(ad, seen, g = null, market = []) {
  const F = ad.facts; if (!F.price) return null;
  const pool = [...(seen || []), ...(market || [])].filter((s) => s && s.id !== ad.id && s.facts && s.facts.price && s.facts.cur === F.cur);
  const car = (g && g.kind === "car") || (F.year && F.km != null);
  let like = pool.filter((s) => !F.beds || !s.facts.beds || Math.abs(s.facts.beds - F.beds) <= 1);
  if (car && F.year) like = like.filter((s) => !s.facts.year || Math.abs(s.facts.year - F.year) <= 1);
  const adj = (s) => {   // what that ad would ask for a car of THIS ad's year and km
    let v = s.facts.price;
    if (car && F.year && s.facts.year) v *= Math.pow(1 + YEAR_K, F.year - s.facts.year);
    if (car && F.km != null && s.facts.km != null) v *= Math.max(0.85, Math.min(1.15, 1 - KM_K * (F.km - s.facts.km) / 10000));
    return v;
  };
  const perM = F.area && like.filter((s) => s.facts.area).length >= 4;
  const vals = perM ? like.filter((s) => s.facts.area).map((s) => s.facts.price / s.facts.area) : like.map(adj);
  if (vals.length < 4) return null;
  const sorted = [...vals].sort((a, b) => a - b), q = (p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))];
  const mid = median(vals), mine = perM ? F.price / F.area : F.price, pct = Math.round(((mine - mid) / mid) * 100);
  const low = q(0.25), high = q(0.75);
  const verdict = pct <= -35 ? "too-cheap" : mine < low ? "cheap" : mine > high ? "high" : "fair";
  return { pct, basis: perM ? "m2" : "price", n: vals.length, median: Math.round(mid), low: Math.round(low), high: Math.round(high), verdict };
}
/** The market book: what every search has seen, by the thing it is (make + model words, or kind + place + rooms) — so a new goal
    knows the market at once. book = { key: [ad facts…] } (≤ 120 each, the newest kept). */
export const MARKET_KEY = "attune:scout:market:v1";
export function marketKey(g) {
  if (!g) return "";
  if (g.kind === "car" && g.car) return "car:" + [g.car.make, ...g.car.model.split(" ")].sort().join(" ");   // the same book as before v6.43 ("car:hyundai tucson")
  if ((g.kind === "car" || g.kind === "product") && g.model && g.model.must.length) return g.kind + ":" + [...g.model.must].sort().join(" ");
  if (g.kind === "rent" || g.kind === "buy-home") return g.kind + ":" + fold(g.place || "");
  return "";
}
export function addToMarket(book, g, ads, now = Date.now()) {
  const k = marketKey(g); if (!k) return book || {};
  const b = { ...(book || {}) }, list = [...(b[k] || [])];
  for (const a of ads || []) if (a.facts && a.facts.price) {
    const i = list.findIndex((x) => x.id === a.id), old = i >= 0 ? list[i] : null;
    // v6.37 (D2): when it was first seen and at what price, so "how long ads last" and "how often the price drops" are known
    const rec = { id: a.id, at: now, first: old ? old.first || old.at : now, p0: old ? old.p0 || old.facts.price : a.facts.price,
      facts: { price: a.facts.price, cur: a.facts.cur, year: a.facts.year, km: a.facts.km, area: a.facts.area, beds: a.facts.beds } };
    if (i >= 0) list[i] = rec; else list.push(rec);
  }
  b[k] = list.slice(-120); return b;
}
/**
 * v6.37 (upgrade D2): wait or buy — from the market book of this search. An ad that was seen and then stopped appearing for a
 * week while the search kept running is counted as gone (sold or taken down) after the days it was up. →
 *  { verdict: "wait" | "buy" | "steady", n, gone, days (median days an ad stays up), dropShare (share of ads that cut their
 *    price), dropPct (their median cut, %), age (this ad's days so far, if given) } — or null when the book is too young
 *    (fewer than 6 ads, or tracked under 10 days).
 */
const DAYMS = 86400000;
export function timingOf(list, ad = null, now = Date.now()) {
  const L = (list || []).filter((x) => x && x.facts && x.facts.price && x.first);
  if (L.length < 6) return null;
  const lastRun = Math.max(...L.map((x) => x.at)), span = (lastRun - Math.min(...L.map((x) => x.first))) / DAYMS;
  if (span < 10) return null;
  const med = (a) => { const v = [...a].sort((x, y) => x - y); return v.length ? v[Math.floor((v.length - 1) / 2)] : 0; };
  const gone = L.filter((x) => lastRun - x.at > 7 * DAYMS).map((x) => Math.max(1, Math.round((x.at - x.first) / DAYMS)));
  const drops = L.filter((x) => x.p0 && x.facts.price < x.p0 * 0.99).map((x) => Math.round((1 - x.facts.price / x.p0) * 100));
  const days = gone.length >= 3 ? med(gone) : 0, dropShare = Math.round((drops.length / L.length) * 100) / 100, dropPct = drops.length ? med(drops) : 0;
  const rec = ad ? L.find((x) => x.id === ad.id) : null, age = rec ? Math.round((now - rec.first) / DAYMS) : null;
  const cheapNow = ad && ad.fair && (ad.fair.verdict === "cheap" || ad.fair.verdict === "fair");
  let verdict = "steady";
  if (days && days <= 10 && cheapNow) verdict = "buy";                    // good ones go fast here
  else if (dropShare >= 0.25 && (age == null || !days || age < days)) verdict = "wait";   // many cut their price — and this one is young
  return { verdict, n: L.length, gone: gone.length, days, dropShare, dropPct, age };
}
export function timingText(t, lang = "en") {
  if (!t) return "";
  const ar = lang === "ar", pc = Math.round(t.dropShare * 100);
  if (t.verdict === "buy") return ar ? `الحاجات الكويسة هنا بتتباع بسرعة (حوالي ${t.days} يوم) — لو السعر مناسب متستناش.` : `Good ones go fast here (about ${t.days} days) — if the price is right, don't wait.`;
  if (t.verdict === "wait") return ar ? `${pc}% من الإعلانات هنا نزّلت سعرها (بحوالي ${t.dropPct}%)${t.days ? ` وبتقعد حوالي ${t.days} يوم` : ""} — استنى شوية أو افاصل.` : `${pc}% of ads here cut their price (by about ${t.dropPct}%)${t.days ? `; they stay up about ${t.days} days` : ""} — wait a little, or bargain.`;
  return ar ? `السوق هادي${t.days ? `: الإعلانات بتقعد حوالي ${t.days} يوم` : ""} — مفيش استعجال.` : `A steady market${t.days ? `: ads stay up about ${t.days} days` : ""} — no rush.`;
}

export function loadMarket(ls = typeof localStorage !== "undefined" ? localStorage : null) { try { return JSON.parse((ls && ls.getItem(MARKET_KEY)) || "{}") || {}; } catch (e) { return {}; } }
export function saveMarket(b, ls = typeof localStorage !== "undefined" ? localStorage : null) { try { ls && ls.setItem(MARKET_KEY, JSON.stringify(b)); } catch (e) {} return b; }

/** v6.35 the scam check: → [{ k, en, ar }] — each a reason to be careful with this ad, by code. */
export function risksOf(ad, seen = [], twins = []) {
  const out = [];
  if (ad.fair && ad.fair.verdict === "too-cheap") out.push({ k: "cheap", en: `${-ad.fair.pct}% under the market — the most common sign of a fake ad; see it before paying anything`, ar: `أرخص من السوق بـ ${-ad.fair.pct}% — دي أشهر علامة للإعلان المضروب؛ شوفه بنفسك قبل ما تدفع أي حاجة` });
  if (ad.redFlag) out.push({ k: "money", en: `Asks for money before you see it: «${ad.redFlag}»`, ar: `بيطلب فلوس قبل ما تشوف الحاجة: «${ad.redFlag}»` });
  const phones = ad.phones || [];
  if (phones.length) {
    const others = (seen || []).filter((s) => s.id !== ad.id && (s.phones || []).some((p) => phones.includes(p)));
    const diff = others.filter((s) => normItem(s.title || "").split(" ").slice(0, 3).join(" ") !== normItem(ad.title || "").split(" ").slice(0, 3).join(" "));
    if (diff.length >= 2) out.push({ k: "phone", en: `The same phone number is on ${diff.length + 1} different ads — a dealer, or a fake`, ar: `نفس رقم التليفون على ${diff.length + 1} إعلانات مختلفة — يا تاجر يا إعلان مضروب` });
  }
  const re = (ad.history || []).length >= 2 && (seen || []).filter((s) => s.id !== ad.id && twinKey(s) && twinKey(s) === twinKey(ad)).length;
  if (re >= 2) out.push({ k: "repost", en: `Posted again ${re} times — it hasn't sold; there is room to bargain`, ar: `اتنزل تاني ${re} مرات — مابعش؛ فيه مجال للفصال` });
  if ((twins || []).length) out.push({ k: "photo", en: `The same photo is in another ad (${twins[0].site}) — ask for a new photo or a video call`, ar: `نفس الصورة في إعلان تاني (${twins[0].site}) — اطلب صورة جديدة أو مكالمة فيديو` });
  if (ad.short && !(ad.check && ad.check.ok.length >= 2)) out.push({ k: "thin", en: "Very few details — ask for the papers and more photos", ar: "تفاصيل قليلة جدًا — اطلب الورق وصور أكتر" });
  return out;
}
/** v6.35 the offer helper: a first offer from the market — under the asking price, never under the cheap end of the market. */
export function offerFor(ad) {
  const F = ad.facts; if (!F.price) return null;
  const f = ad.fair, step = F.price >= 200000 ? 5000 : F.price >= 20000 ? 500 : 50;
  let o = F.price * 0.92;
  if (f && f.basis === "price") o = Math.min(o, f.median * 0.97);
  if (f && f.basis === "price" && f.low) o = Math.max(o, f.low * 0.97);
  if (f && f.basis === "m2" && F.area) o = Math.min(o, f.median * F.area * 0.97);
  o = Math.min(o, F.price * 0.97);
  return Math.round(o / step) * step;
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

// ---- v7.9 (Ali: "fix the scout part, what are all these ads" — essays and mobile-phone ads for a flat search): an ad must be
// ABOUT what was asked — the car's make or model, a home word for a rent or a home, the item's own words otherwise
const HOME_W = /\b(apartments?|flats?|villas?|studios?|chalets?|duplex|penthouse|rooms?|house|townhouse|twin ?house|roof|loft|residence|unit)\b|شقه|شقة|شقق|فيلا|فلل|ستوديو|استوديو|شاليه|دوبلكس|بنتهاوس|غرفه|غرفة|اوضه|اوضة|بيت|منزل|تاون ?هاوس|توين ?هاوس|روف|وحده سكنيه|وحدة سكنية/i;
const STOP = new Set(["for", "the", "and", "with", "near", "used", "new", "sale", "rent", "price", "cheap", "best", "egypt", "cairo", "in", "on", "at", "of", "to", "a", "an", "my", "me",
  "في", "من", "على", "علي", "مع", "جديد", "مستعمل", "للبيع", "للايجار", "للإيجار", "سعر", "رخيص", "مصر", "القاهره", "عايز", "محتاج"]);
export function aboutIt(ad, g, text = "") {
  if (!ad || !g) return true;
  const hay = " " + fold([ad.title, ad.item, text.slice(0, 1500)].filter(Boolean).join(" ")).replace(/[^\p{L}\p{N}]+/gu, " ") + " ";
  const words = hay.trim().split(" ");
  const has = (w) => { w = fold(w); return !!w && (hay.includes(" " + w + " ") || (w.length >= 5 && !/\d/.test(w) && words.some((x) => Math.abs(x.length - w.length) <= 1 && close1(x, w)))); };
  if (g.kind === "car" && g.car) return [g.car.make, ...String(g.car.model).split(" "), g.car.makeAr, g.car.modelAr].filter(Boolean).some(has);
  if (g.kind === "rent" || g.kind === "buy-home") return HOME_W.test(hay) || HOME_W.test(String(ad.title || ""));
  if (g.kind === "gold") return true;
  const key = (g.model && g.model.must.length ? g.model.must : fold(g.what || g.raw || "").replace(/[^\p{L}\p{N}]+/gu, " ").split(" "))
    .filter((w) => w && w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w) && !(g.place && fold(g.place).includes(w)));
  return !key.length || key.some(has);
}

// ---- v7.9 (Ali picked the calm list "with an option to select more than 1 and make a table"): the picked ads side by side.
// A row for each fact at least one of them states; the best value in a row is marked (lowest price / km, newest year, most rooms
// or metres, highest score; a yes beats a no). → { cols: [{ id, title, site, url }], rows: [{ k, en, ar, cells: [{ v, best }] }] }
const CMP = [["price", "Price", "السعر", "low"], ["score", "Match", "التطابق", "high"], ["year", "Year", "الموديل", "high"], ["km", "km", "الكيلومترات", "low"],
  ["place", "Place", "المكان", null], ["beds", "Bedrooms", "الغرف", "high"], ["area", "Area m²", "المساحة م²", "high"], ["floor", "Floor", "الدور", null],
  ["oneOwner", "One owner", "أول مالك", "yes"], ["noAccident", "No accidents", "بدون حوادث", "yes"], ["auto", "Automatic", "أوتوماتيك", "yes"],
  ["furnished", "Furnished", "مفروش", "yes"], ["elevator", "Elevator", "أسانسير", "yes"], ["parking", "Parking", "جراج", "yes"], ["metro", "Near the metro", "قريب من المترو", "yes"],
  ["warranty", "Warranty", "ضمان", "yes"], ["remote", "Remote", "عن بعد", "yes"], ["site", "Site", "الموقع", null]];
export function compareAds(ads) {
  const list = (ads || []).filter(Boolean).slice(0, 4);
  const val = (a, k) => (k === "score" ? a.score : k === "site" ? a.site : a.facts ? a.facts[k] : undefined);
  const rows = [];
  for (const [k, en, ar, want] of CMP) {
    const vs = list.map((a) => val(a, k));
    if (vs.every((v) => v == null || v === "")) continue;
    const nums = vs.filter((v) => typeof v === "number");
    const best = want === "low" && nums.length > 1 ? Math.min(...nums) : want === "high" && nums.length > 1 ? Math.max(...nums) : want === "yes" ? true : null;
    rows.push({ k, en, ar, cells: vs.map((v) => ({ v: v == null ? null : v, best: best != null && v === best && (want !== "yes" || vs.some((x) => x !== true)) })) });
  }
  return { cols: list.map((a) => ({ id: a.id, title: a.title || a.site, site: a.site, url: a.url })), rows };
}

// ---- 8. one run of a goal --------------------------------------------------------------------------------------------------------------
/** hits from the searches → this run's results, merged with what was seen before.
 *  goal = { id, g, seen: [ad], taste, votes: {id: 1|-1} } → { found: [ad with check/fair/score], fresh: [ids new this run], seen }. */
export function runGoal(goal, hits, { now = Date.now(), market = null } = {}) {
  const g = goal.g, seenIds = new Set((goal.seen || []).map((s) => s.id));
  const ads = mergeTwins((hits || []).filter((h) => h && h.url && isAdPage(h.url, h.text || "", h.title || "")).map((h) => { const a = readAd(h, g); return { ...a, about: aboutIt(a, g, String(h.text || "")) }; }));
  // v6.46: what earlier runs kept is checked again with today's rules (an old run kept list pages, forums and "151 EGP" Tucsons)
  const band = BIG[g.kind] ? BAND[g.kind] : null;
  const adUrl = (s) => AD_URL.some((re) => re.test(s.url));
  const keep = (s) => s && s.url && !NOT_AD.test(siteOf(s.url)) && (adUrl(s) || (!KNOWN_AD_SITE.test(siteOf(s.url)) && !LIST_TITLE.test(String(s.title || "")) && s.facts && s.facts.price != null)) &&
    (!band || !s.facts || s.facts.price == null || s.facts.price >= band[0] / (s.facts.cur === "EGP" ? 1 : 50));
  const seen = (goal.seen || []).filter(keep);
  for (const a of ads) { const i = seen.findIndex((s) => s.id === a.id); const rec = { ...a, firstSeen: i >= 0 ? seen[i].firstSeen : now, lastSeen: now, history: [...((i >= 0 && seen[i].history) || []), ...(a.facts.price ? [[now, a.facts.price]] : [])].slice(-30) }; if (i >= 0) seen[i] = rec; else seen.push(rec); }
  const found = seen.filter((a) => a.lastSeen >= now - 14 * 86400000 && (goal.votes || {})[a.id] !== -1).map((a) => {
    const c = check(a, g), fair = fairness(a, seen, g, market ? market[marketKey(g)] : []);
    const score = Math.max(0, Math.min(100, c.score + tasteNudge(a, goal.taste) + (fair && fair.pct <= -5 ? 8 : fair && fair.pct >= 15 ? -8 : 0) + ((goal.votes || {})[a.id] === 1 ? 20 : 0)));
    const dropped = a.history && a.history.length >= 2 && a.history[a.history.length - 1][1] < a.history[0][1] ? a.history[0][1] - a.history[a.history.length - 1][1] : 0;
    const r0 = { ...a, check: c, fair, score, dropped, followed: !!(goal.follow || {})[a.id] };
    const risks = risksOf(r0, seen);
    // a find with a warning never ranks as a top match; a followed ad always stays in the list
    return { ...r0, risks, score: Math.max(0, r0.score - 12 * risks.filter((x) => x.k === "cheap" || x.k === "money" || x.k === "phone").length) };
  }).filter((a) => a.followed || (!a.check.out && (a.about != null ? a.about : aboutIt(a, g)))).sort((a, b) => (b.followed - a.followed) || b.score - a.score);
  // a product: the same item in several stores → the cheapest is marked (and ranks first among equals)
  if (g.kind === "product") {
    const priced = found.filter((a) => a.facts.price && a.check.ok.some((x) => x.k === "model"));
    const sites = new Set(priced.map((a) => a.site));
    if (sites.size >= 2) { const min = Math.min(...priced.map((a) => a.facts.price)); for (const a of priced) if (a.facts.price === min) { a.cheapest = sites.size; a.score = Math.min(100, a.score + 5); } found.sort((a, b) => b.score - a.score); }
  }
  // v6.43: the prices on list pages and price guides (14 days kept), and the comparison over all of it
  const lists = [];
  for (const h of hits || []) for (const v of listPrices(h, g)) lists.push({ site: siteOf(h.url), v, t: now });
  const listSeen = [...(goal.listSeen || []).filter((x) => x.t >= now - 14 * 86400000 && !NOT_AD.test(x.site || "") && (!band || (x.v >= band[0] && x.v <= band[1]))), ...lists].slice(-300);
  return { found, fresh: ads.filter((a) => !seenIds.has(a.id)).map((a) => a.id), seen: seen.slice(-400), listSeen, compare: compareOf(found, listSeen, g) };
}
// ---- v6.43 comparing the market: list pages and price guides count too -------------------------------------------------------------
const BAND = { car: [100000, 2e7], "buy-home": [300000, 2e8], rent: [1500, 5e5], product: [300, 5e6] };
const BIG = { car: 1, "buy-home": 1, rent: 1 };   // (a product can cost less than 300 — only these kinds have a floor on one ad's price)
/** A page that lists many ads or a price guide (not one ad) for the same item → its prices (EGP); near the year when a year was asked. */
export function listPrices(hit, g) {
  if (!hit || !hit.url || isAdPage(hit.url, hit.text || "", hit.title || "")) return [];
  // v6.46: never a forum, a news page or a site that sells nothing; on an unknown site only prices written with EGP / جنيه
  if (NOT_AD.test(siteOf(hit.url)) || /\/(forum|forums|topic|thread|threads|news|blog|wiki)\//i.test(hit.url)) return [];
  const known = KNOWN_AD_SITE.test(siteOf(hit.url)) || /\.eg$/.test(siteOf(hit.url));
  const text = String(hit.text || "").slice(0, 16000), item = " " + normItem((hit.title || "") + " " + text.slice(0, 5000)) + " ";
  if (g.model && g.model.must.length && !g.model.must.every((w) => item.includes(" " + w + " "))) return [];
  const [lo, hi] = BAND[g.kind] || [100, 1e9];
  let ps = pricesIn(text).filter((p) => p.cur === "EGP" && (known || p.explicit) && p.v >= lo && p.v <= hi && (!g.max || p.v <= g.max * 1.8));
  const yw = (g.wish || []).find((w) => w.k === "year");
  if (yw) {
    // each price belongs to the year written nearest before it (a price guide lists 2021, 2022, 2023 one after another)
    const L = latin(text), years = []; const re = /(?<![\d,.])((?:199|20[0-3])\d)(?![\d,.])/g; let m; while ((m = re.exec(L))) years.push([m.index, +m[1]]);
    if (!years.some(([, y]) => y === yw.min)) return [];
    ps = ps.filter((p) => { const before = years.filter(([i]) => i < p.at), y = before.length ? before[before.length - 1] : years.find(([i]) => i > p.at); return y && y[1] >= yw.min && y[1] <= (yw.max || yw.min) && p.at - (before.length ? y[0] : p.at) < 400; });
  }
  return [...new Set(ps.map((p) => p.v))].slice(0, 40);
}
const pct = (xs, q) => xs[Math.min(xs.length - 1, Math.max(0, Math.round((xs.length - 1) * q)))];
/** The comparison over everything seen: how many ads on how many sites, the usual price range, and the best value. */
export function compareOf(found, listSeen, g) {
  const ads = found.filter((a) => a.facts.price && a.facts.cur === "EGP" && !(a.check && a.check.bad.some((b) => b.k === "model")));
  const all = [...ads.map((a) => a.facts.price), ...(listSeen || []).map((x) => x.v)].sort((a, b) => a - b);
  const sites = {};
  for (const a of found) sites[a.site] = (sites[a.site] || 0) + 1;
  for (const x of listSeen || []) sites[x.site] = sites[x.site] || 0;
  if (!all.length) return { n: found.length, sites, prices: 0 };
  const cut = all.length >= 8 ? all.slice(Math.floor(all.length * 0.1), Math.ceil(all.length * 0.9)) : all;
  const low = cut[0], high = cut[cut.length - 1], med = pct(cut, 0.5);
  const best = ads.filter((a) => a.score >= 55 && a.facts.price <= med * 1.02 && a.facts.price >= low * 0.8 && !(a.risks || []).some((r) => r.k === "cheap" || r.k === "money"))
    .sort((a, b) => b.score - a.score || a.facts.price - b.facts.price)[0] || null;
  return { n: found.length, sites, prices: all.length, low, med, high, best: best ? { id: best.id, title: best.title, price: best.facts.price, site: best.site } : null };
}
/** The few worth a notification: new this run (or cheaper than before) and strong. */
export function worthTelling(run, min = 75) {
  return run.found.filter((a) => (a.followed && (a.dropped > 0 || a.sold)) || ((run.fresh.includes(a.id) || a.dropped > 0) && a.score >= min && !(a.risks || []).some((x) => x.k === "cheap" || x.k === "money"))).slice(0, 3);
}
/** v6.35 follow one ad: Scout re-reads its page on every run — a lower price or "sold" is told at once.
    page = { text, title } of the ad's page now (or null when it is gone). → the goal with that ad's record updated. */
const SOLD = /\b(sold|no longer available|this ad (is|has been) (removed|deleted|expired)|ad not found|page not found|404)\b|تم البيع|اتباع|اتباعت|الإعلان غير متاح|الاعلان غير متاح|لم يعد متاح/i;
export function followUpdate(goal, id, page, now = Date.now()) {
  const seen = [...(goal.seen || [])], i = seen.findIndex((s) => s.id === id); if (i < 0) return goal;
  const old = seen[i];
  if (!page || SOLD.test(String(page.text || "").slice(0, 4000) + " " + (page.title || ""))) { seen[i] = { ...old, sold: true, lastSeen: now }; return { ...goal, seen }; }
  const a = readAd({ url: old.url, title: page.title || old.title, text: page.text, image: old.image }, goal.g);
  const price = a.facts.price || old.facts.price;
  seen[i] = { ...old, facts: { ...old.facts, ...a.facts, price }, lastSeen: now, sold: false, history: [...(old.history || []), ...(price && price !== (old.history || []).slice(-1)[0]?.[1] ? [[now, price]] : [])].slice(-30) };
  return { ...goal, seen };
}
export const toggleFollow = (goal, id) => { const f = { ...(goal.follow || {}) }; if (f[id]) delete f[id]; else f[id] = 1; return { ...goal, follow: f }; };

/** v6.35 gold watch: a gram of this karat at this price → is it at the goal yet? (pure 24k USD/oz + the exchange rate, by code) */
export function goldGram(usdOz, usdToLocal, karat = 21) { return usdOz && usdToLocal ? Math.round(usdOz / 31.1034768 * usdToLocal * karat / 24) : null; }
export function goldCheck(g, perGram) {
  if (!perGram) return { known: false };
  return { known: true, perGram, hit: (g.max ? perGram <= g.max : false) || (g.min ? perGram >= g.min : false) };
}

// ---- 9. the message to the seller ----------------------------------------------------------------------------------------------------------
export function sellerMessage(ad, g, { ar = true } = {}) {
  // v6.35 (Ali: Egyptian Arabic, and the offer from the market): the first offer is offerFor() — code, not a guess
  const F = ad.facts, fair = ad.fair, offer = offerFor(ad);
  const what = ad.title || g.what;
  const like = fair ? (fair.basis === "m2" ? num(fair.median) + (ar ? " للمتر" : " per m²") : num(fair.median)) : "";
  if (ar) return [`السلام عليكم، بخصوص إعلان «${what}»${ad.site ? " على " + ad.site : ""}.`,
    `لسه متاح؟${F.price ? ` والسعر ${num(F.price)} فيه فصال؟` : ""}`,
    fair && fair.pct > 0 ? `الإعلانات اللي زيه${fair.basis === "m2" ? " في نفس المنطقة" : ""} في حدود ${like}، ينفع ${num(offer)}؟` : offer ? `ينفع ${num(offer)}؟` : "",
    "شكرًا."].filter(Boolean).join("\n");
  return [`Hello, about your ad "${what}"${ad.site ? " on " + ad.site : ""}.`, `Is it still available?${F.price ? ` Is ${num(F.price)} negotiable?` : ""}`,
    fair && fair.pct > 0 ? `Similar listings are around ${like} — would you take ${num(offer)}?` : offer ? `Would you take ${num(offer)}?` : "", "Thank you."].filter(Boolean).join("\n");
}

// ---- the store --------------------------------------------------------------------------------------------------------------------------
export const SCOUT_KEY = "attune:scout:v1";
export function loadScout(ls = typeof localStorage !== "undefined" ? localStorage : null) { try { const j = JSON.parse((ls && ls.getItem(SCOUT_KEY)) || "null"); return j && Array.isArray(j.goals) ? { ...j, goals: j.goals.map(freshGoal) } : { goals: [] }; } catch (e) { return { goals: [] }; } }
export function saveScout(d, ls = typeof localStorage !== "undefined" ? localStorage : null) { try { ls && ls.setItem(SCOUT_KEY, JSON.stringify(d)); } catch (e) {} return d; }
/** v6.46: a goal saved by an older Scout is understood again with today's reader (Ali's "Hyundai Tuscon 2022" goal, saved before
    Scout knew the Tucson or the year, checked nothing but "used" — so any page with a number passed). */
export const PARSE_V = 3;
export const freshGoal = (goal) => (!goal || goal.gv === PARSE_V ? goal : { ...goal, g: parseGoal(goal.text || (goal.g && goal.g.raw) || ""), gv: PARSE_V });
export function addGoal(d, text, now = Date.now()) {
  const g = parseGoal(text);
  const goal = { id: "s" + now.toString(36) + Math.random().toString(36).slice(2, 5), text: String(text).trim(), g, gv: PARSE_V, created: now, lastRun: 0, seen: [], votes: {}, taste: { up: {}, down: {} }, on: true };
  return { data: { ...d, goals: [goal, ...d.goals] }, goal };
}
/** Due for a run: never run, or the last run is older than `hours` (twice a day by default). */
// ---- v6.32 distance to the metro (roadmap "Scout extras"): from the offline map pack, never the web ------------------------------
const rad = (x) => x * Math.PI / 180;
export const kmBetween = (a, b, c, d) => { const x = Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2; return 6371 * 2 * Math.asin(Math.sqrt(x)); };
const METRO = /metro|subway|underground|مترو|محطة/i;
/** The point for an ad's area, from the map's answers for its place name: an area (place/…) first, then the best ranked. */
export function pointFor(places) {
  const ps = (places || []).filter((p) => isFinite(p.lat) && isFinite(p.lon));
  return ps.find((p) => /^place\//.test(p.kind || "")) || ps.sort((a, b) => (b.rank || 0) - (a.rank || 0))[0] || null;
}
/** The station nearest a point. A metro station is preferred when one is within 1.5× the nearest of any kind (trams and halts
    are stations too). Walk = straight line × 1.3 for streets, at 4.8 km/h. → { name, km, walk, metro } | null */
export function nearestStation(lat, lon, stations, { ar = false } = {}) {
  const all = (stations || []).filter((p) => isFinite(p.lat) && isFinite(p.lon)).map((p) => {
    const name = (ar ? p.name_ar || p.name : p.name_en || p.name) || p.name || "";
    return { name, km: kmBetween(lat, lon, p.lat, p.lon), metro: METRO.test([p.name, p.name_ar, p.name_en].join(" ")) };
  }).filter((p) => p.name).sort((a, b) => a.km - b.km);
  if (!all.length) return null;
  const m = all.find((p) => p.metro && p.km <= all[0].km * 1.5);
  const best = m || all[0];
  return { name: best.name, km: Math.round(best.km * 10) / 10, walk: Math.max(1, Math.round(best.km * 1.3 / 4.8 * 60)), metro: best.metro };
}
/** Is a station worth showing for this goal? Homes always; anything that asks to be near the metro. */
export const wantsStation = (g) => !!g && (g.kind === "rent" || g.kind === "buy-home" || (g.wish || []).some((w) => /metro/.test(w.k)));

// ---- v6.32 the photo check (roadmap "Scout extras"): the same picture in two different ads is a classic sign of a copied or fake
// ad. Each ad's picture gets a fingerprint (dHash: 64 bits from a 9×8 grey copy — the same photo resized or re-saved stays within a
// few bits); ads whose fingerprints are this close, and that are not the same ad on two sites, are marked. Pure code.
export const PHOTO_NEAR = 6;
export function hamming(a, b) {
  if (!a || !b || a.length !== b.length) return 64;
  let n = 0;
  for (let i = 0; i < a.length; i++) { let x = parseInt(a[i], 16) ^ parseInt(b[i], 16); while (x) { n += x & 1; x >>= 1; } }
  return n;
}
/** A 9×8 grey picture (72 numbers, row by row) → its 16-hex-digit fingerprint. */
export function dhash(grey) {
  let bits = "";
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += grey[y * 9 + x] > grey[y * 9 + x + 1] ? "1" : "0";
  let hex = ""; for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}
/** ads + {adId: fingerprint} → {adId: [the other ads with the same photo: {id, site, title, price}]} */
export function photoTwins(ads, hashes) {
  const out = {}, list = (ads || []).filter((a) => hashes && hashes[a.id]);
  for (const a of list) for (const b of list) {
    if (a.id === b.id || (a.also || []).some((x) => x.id === b.id || x.url === b.url) || (b.also || []).some((x) => x.id === a.id || x.url === a.url)) continue;
    if (hamming(hashes[a.id], hashes[b.id]) <= PHOTO_NEAR) (out[a.id] = out[a.id] || []).push({ id: b.id, site: b.site, title: b.title, price: b.facts && b.facts.price });
  }
  return out;
}

/** v6.32 Scout at night: what the phone searches around 3:00 with Attune closed (ScoutNight.kt) — each goal that is on, its
    searches and the ad links already seen, so only NEW ads are kept. Max 5 goals, 6 searches, 200 links each. */
export const nightPlan = (d) => (d.goals || []).filter((x) => x.on !== false).slice(0, 5)
  .map((x) => ({ id: x.id, title: String((x.g && x.g.what) || x.text || "").slice(0, 40), queries: searchesFor(x.g).slice(0, 6), seen: (x.seen || []).map((s) => s.url).filter(Boolean).slice(-200) }));
export const dueGoals = (d, now = Date.now(), hours = 12) => (d.goals || []).filter((x) => x.on !== false && now - (x.lastRun || 0) >= hours * 3600000);
/** Is this sentence a Scout goal? ("find me a flat in Maadi under 15k", «دورلي على عربية …») */
export const looksLikeGoal = (text) => /^\s*(find me|look for|hunt for|search for|scout|keep looking for|watch for|alert me when|tell me when)\b|^\s*(دورلي|دور لي|دوّرلي|ابحثلي|ابحث لي|شوفلي|شوف لي|نبهني لما|قولي لما)/i.test(String(text || ""));
