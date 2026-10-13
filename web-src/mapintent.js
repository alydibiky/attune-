/* ---- v6.27: Maps understands what people type (Ali: "every place, offline, and AI-powered") ------------------------------
   Code first (the roadmap's rule: code does the work, a model only helps): a search like "أقرب صيدلية", "كمبوند في
   التجمع", "مطعم سوري في مدينة نصر", "ATM near me" or "بنزينة جنبي" is split into
     kinds  what sort of place (the index's kinds: OpenStreetMap words + Overture's, see tools/build_map_pack.py)
     what   name words left over ("سوري", "Palm Hills")
     area   where ("مدينة نصر", "New Cairo") — found in the map's own index, then searched around
     near   "near me / أقرب / جنبي" — around you (or the map's centre)
   Only when code finds no sort and no area in a longer request is the phone's own model asked (askModel) to fill the same
   fields as JSON, from the same fixed list of sorts. Everything works offline. Tests: tests/unit/v727mapintent.test.mjs. */

// [id, English words, Arabic words (formal + Egyptian), kinds in the index]
export const SORTS = [
  ["fuel", "fuel|gas station|petrol|petrol station|gas", "بنزينه|بنزينة|محطه بنزين|محطة بنزين|محطه وقود|محطة وقود|وقود|بنزين", ["amenity/fuel"]],
  ["pharmacy", "pharmacy|pharmacies|chemist|drugstore", "صيدليه|صيدلية|صيدليات|اجزخانه|أجزخانة", ["amenity/pharmacy"]],
  ["hospital", "hospital|hospitals|emergency|er", "مستشفي|مستشفى|مستشفيات|طوارئ|اسعاف|إسعاف", ["amenity/hospital"]],
  ["clinic", "clinic|clinics|doctor|dentist|dental", "عياده|عيادة|عيادات|دكتور|طبيب|اسنان|أسنان", ["amenity/clinic", "amenity/doctors", "amenity/dentist"]],
  ["atm", "atm|cash machine|bank|banks", "صراف|ماكينه صراف|ماكينة صراف|ATM|بنك|بنوك|مصرف", ["amenity/atm", "amenity/bank"]],
  ["mosque", "mosque|mosques|masjid", "مسجد|جامع|مساجد|زاويه|زاوية", ["amenity/place_of_worship"]],
  ["church", "church|churches", "كنيسه|كنيسة|كنائس", ["amenity/place_of_worship"]],
  ["restaurant", "restaurant|restaurants|food|eat|dinner|lunch", "مطعم|مطاعم|اكل|أكل|غدا|غداء|عشا|عشاء", ["amenity/restaurant", "amenity/fast_food"]],
  ["cafe", "cafe|cafes|coffee|coffee shop", "كافيه|كافيهات|قهوه|قهوة|مقهى|مقهي|كوفي", ["amenity/cafe"]],
  ["supermarket", "supermarket|grocery|groceries|market|hypermarket", "سوبر ماركت|سوبرماركت|ماركت|بقاله|بقالة|هايبر", ["shop/supermarket", "shop/convenience", "poi/food_and_beverage_store"]],
  ["mall", "mall|malls|shopping centre|shopping center", "مول|مولات|سنتر تجاري|مركز تجاري", ["shop/mall", "poi/shopping_mall"]],
  ["compound", "compound|compounds|gated community|residence", "كمبوند|كومباوند|كمباوند|كمبوندات|مجمع سكني", ["place/compound", "place/residential_area", "place/neighbourhood"]],
  ["school", "school|schools", "مدرسه|مدرسة|مدارس", ["amenity/school"]],
  ["university", "university|college", "جامعه|جامعة|كليه|كلية", ["amenity/university", "amenity/college"]],
  ["hotel", "hotel|hotels|resort", "فندق|فنادق|اوتيل|أوتيل|منتجع", ["tourism/hotel", "poi/hotel", "poi/resort"]],
  ["parking", "parking|car park", "جراج|موقف سيارات|باركنج|ركنه|ركنة", ["amenity/parking"]],
  ["station", "station|metro|train|bus station", "محطه|محطة|مترو|قطر|قطار|موقف", ["transport/station", "public_transport/station"]],
  ["police", "police|police station", "قسم|قسم شرطه|قسم شرطة|شرطه|شرطة|بوليس", ["amenity/police"]],
  ["gym", "gym|fitness", "جيم|نادي رياضي|صاله العاب|صالة ألعاب", ["leisure/fitness_centre", "poi/gym"]],
  ["park", "park|garden", "حديقه|حديقة|جنينه|جنينة|بارك", ["leisure/park"]],
  ["bakery", "bakery|bread", "مخبز|فرن|عيش", ["shop/bakery"]],
  ["car repair", "mechanic|car repair|garage", "ميكانيكي|ورشه|ورشة|صيانه سيارات|صيانة سيارات", ["shop/car_repair"]],
];

const NEAR = /\b(near me|nearby|nearest|closest|around me|close to me|close by)\b|(^|\s)(اقرب|أقرب|قريب|قريبه|قريبة|جنبي|جمبي|حواليا|حوالي|بالقرب مني)(?=\s|$)/i;
const AREA = /(?:^|\s)(?:in|at|near|around|by|في|ف|فى|جنب|جمب|قريب من|بالقرب من|عند|ناحيه|ناحية|بـ)\s+(.+)$/i;
const FILL = /(?:^|\s)(where is|where's|find|show me|i want|i need|a|an|the|one|any|فين|عايز|عاوز|محتاج|اريد|أريد|ابحث عن|دور على|دوّر على|في|ف|واحد|واحده|واحدة)(?=\s|$)/gi;

const fold = (s) => String(s || "").toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
// longest words first, so "محطة بنزين" wins over "بنزين" and "coffee shop" over "coffee"
const WORDS = SORTS.flatMap(([id, en, ar]) => [...en.split("|"), ...ar.split("|")].map((w) => [fold(w), id])).sort((a, b) => b[0].length - a[0].length);
const sortById = (id) => SORTS.find((s) => s[0] === id) || null;

/** "أقرب صيدلية" → { sort: "pharmacy", kinds, what: "", area: "", near: true } (code only, no model). */
export function parseMapQuery(q) {
  let t = " " + fold(q) + " ";
  const near = NEAR.test(" " + String(q || "") + " ") || NEAR.test(t);
  t = t.replace(new RegExp(NEAR.source, "gi"), " ");
  let sort = null;
  for (const [w, id] of WORDS) {
    const re = new RegExp("(^|\\s)(ال)?" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?=\\s|$)");
    if (re.test(t)) { sort = id; t = t.replace(re, " "); break; }
  }
  let area = "";
  const m = AREA.exec(t.replace(/\s+/g, " ").trim());
  if (m && (sort || m[1].split(" ").length <= 4)) { area = m[1].replace(FILL, " ").replace(/\s+/g, " ").trim(); t = t.slice(0, t.lastIndexOf(m[0].trim().split(" ")[0])); }
  const what = t.replace(FILL, " ").replace(/\s+/g, " ").trim();
  const s = sortById(sort);
  return { sort, kinds: s ? s[3] : [], what, area, near };
}

/** Does code understand enough, or should the model be asked? (a longer request with no sort and no area) */
export const needsModel = (q, p) => !p.sort && !p.area && fold(q).split(" ").length >= 3;

/** The model's prompt: fill the same fields as JSON, from the fixed list only. */
export function modelPrompt(q) {
  return `You turn a map search into JSON. The user typed (any language): «${String(q).slice(0, 200)}»
Reply with ONLY one JSON object, no other text: {"sort": one of [${SORTS.map((s) => '"' + s[0] + '"').join(", ")}] or null, "what": the place's own name or extra words or "", "area": the district/city/landmark to search in or "", "near": true if they want the nearest to them}`;
}

/** The model's reply → the same shape as parseMapQuery (anything outside the list is dropped). */
export function readModel(text) {
  const m = /\{[\s\S]*\}/.exec(String(text || "")); if (!m) return null;
  let j; try { j = JSON.parse(m[0]); } catch (e) { return null; }
  const s = sortById(j.sort);
  return { sort: s ? s[0] : null, kinds: s ? s[3] : [], what: String(j.what || "").slice(0, 80), area: String(j.area || "").slice(0, 80), near: !!j.near, model: true };
}

/** v6.27: a sort's word in both languages ("pharmacy" → ["pharmacy", "صيدليه"]): places are named in either. */
export function sortNames(word) {
  const s = SORTS.find((x) => [...x[1].split("|"), ...x[2].split("|")].includes(word));
  return s ? [s[1].split("|")[0], s[2].split("|")[0]] : [word];
}

/** The words to search the index with for a sort (its first English and Arabic words), when the index can't filter by kind. */
export function sortWords(id, lang) {
  const s = sortById(id); if (!s) return "";
  return (lang === "ar" ? s[2] : s[1]).split("|")[0];
}
