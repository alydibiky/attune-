/* ---- v8.7 (Ali, 29 Oct: "instead of Chat X-Ray, something that takes a WhatsApp chat or group and understands what's in it with
   photos and organizes them — my group of design and furniture pictures, my world-news group, my Hadith and stories group…";
   he picked design A: albums, like Pinterest, with a search box on top). The WhatsApp groups library.
     1. the export (WhatsApp → ⋮ → More → Export chat → With media → Attune): its text (chatxray.js parseExport) + its photos
     2. items(): one item per message — its text (the caption), its photo / video / file, who, when
     3. the phone looks at each photo (WaGroups.kt: ML Kit labels "Couch", "Kitchen"… + the words written in it) → seen{}
     4. kindOf(): what the group is about — design · news · religion · recipes · other (by words + photo labels, by code)
     5. albums(): the albums for that kind (rooms and things; news topics; Hadith themes…), an item can sit in two
        ("Living room" and "Sofas"); what fits none goes to "More"; a move by hand is remembered (moves{})
     6. hadithOf(): the Hadith card — the narrator, the text, the source and grade when the message says them
     7. search(): free text over everything (lookback.js — synonyms in EN / Arabic / Franco, typos)
   Nothing here needs a model; pure; tests: tests/unit/v870wagroups.test.mjs. The idea of reading an export follows MIT-licensed
   viewers (Pustur/whatsapp-chat-parser-website, KnugiHK/WhatsApp-Chat-Exporter); the sorting is Attune's own.             */
import { parseExport } from "./chatxray.js";
import { recallSearch, fold } from "./lookback.js";

// ---- 1–2. the export → items ----------------------------------------------------------------------------------------------------
const MEDIA_EXT = /\.(jpe?g|png|webp|gif|heic|mp4|3gp|mov|opus|ogg|m4a|mp3|aac|pdf|docx?|xlsx?|pptx?|txt|vcf|zip)$/i;
const ATTACH = [
  /^\s*[‎‏]?([^\n<>:]+?\.(?:jpe?g|png|webp|gif|heic|mp4|3gp|mov|opus|ogg|m4a|mp3|aac|pdf|docx?|xlsx?|pptx?|vcf|zip))\s*\((?:file attached|ملف مرفق|fichier joint|archivo adjunto|dosya ekli)\)\s*/i,   // Android
  /^\s*[‎‏]?<(?:attached|مرفق):\s*([^>]+)>\s*/i,                                                                                    // iPhone
];
export const kindOfFile = (n) => (/\.(jpe?g|png|webp|gif|heic)$/i.test(n) ? "photo" : /\.(mp4|3gp|mov)$/i.test(n) ? "video" : /\.(opus|ogg|m4a|mp3|aac)$/i.test(n) ? "audio" : "file");
/** A message's text → { file, caption } (file = the attached file's name, or ""). */
export function attachmentOf(text) {
  const s = String(text || "");
  for (const rx of ATTACH) { const m = s.match(rx); if (m) return { file: m[1].trim(), caption: s.slice(m[0].length).trim() }; }
  return { file: "", caption: s.trim() };
}
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
const URL_RX = /https?:\/\/\S+/i;
/** The export's text (+ the names of the files that came with it) → items, oldest first. */
export function itemsOf(raw, files = []) {
  const have = new Set((files || []).map((f) => String(f).split("/").pop()));
  const { messages } = parseExport(raw);
  const out = [];
  for (const m of messages) {
    const { file, caption } = attachmentOf(m.text);
    if (!file && !caption) continue;
    if (/^(this message was deleted|you deleted this message|تم حذف هذه الرسالة|لقد حذفت هذه الرسالة)$/i.test(caption)) continue;
    const kind = file ? kindOfFile(file) : URL_RX.test(caption) && caption.replace(URL_RX, "").trim().length < 20 ? "link" : "text";
    out.push({ id: hash(m.t + "|" + m.who + "|" + file + "|" + caption.slice(0, 200)), t: m.t, who: m.who, text: caption, file: file || "", kind, has: !!(file && have.has(file)) });
  }
  return out;
}
/** New items join the group's old ones (an item already there is kept as it is — with its photo's labels and moves). */
export function mergeItems(old, fresh) {
  const ids = new Set((old || []).map((x) => x.id)), add = (fresh || []).filter((x) => !ids.has(x.id));
  return { items: [...(old || []), ...add].sort((a, b) => a.t - b.t), added: add.length };
}

// ---- 4–5. what the group is about, and its albums ---------------------------------------------------------------------------------
// each album: words (EN / Egyptian Arabic / Franco, folded) and the photo labels (ML Kit's English names) that put an item in it
const A = (id, en, ar, words, labels = "") => ({ id, en, ar, words: words.split("|").map(fold), labels: labels ? labels.split("|").map((x) => x.toLowerCase()) : [] });
export const KINDS = {
  design: { en: "Design & furniture", ar: "ديكور وأثاث", rows: [
    { en: "Rooms", ar: "الأوض", albums: [
      A("living", "Living room", "الريسبشن", "living room|living|reception|lounge|salon|ريسبشن|الريسبشن|صالة|الصالة|صالون|الصالون|ليفنج|ليفينج|انتريه|الانتريه|نتريه", "living room"),
      A("bedroom", "Bedroom", "أوضة النوم", "bedroom|master bedroom|اوضة نوم|اوضه نوم|غرفة نوم|غرفه نوم|اوضة النوم|اوضه النوم|نوم|سرير|السرير|دولاب|الدولاب", "bedroom|bed|bed frame|duvet|pillow"),
      A("kids", "Kids' room", "أوضة الأطفال", "kids room|kids|nursery|children|اطفال|الاطفال|العيال|اوضة الولاد|اوضة الاطفال|بيبي|baby", "crib|toy"),
      A("kitchen", "Kitchen", "المطبخ", "kitchen|مطبخ|المطبخ|kitchen cabinet|كاونتر|الكاونتر|countertop|island|جزيرة", "kitchen|countertop|cabinetry|stove|oven|sink|refrigerator"),
      A("dining", "Dining", "السفرة", "dining|dining room|dining table|سفرة|السفره|السفرة|سفره|نيش|النيش", "dining table|dining room"),
      A("bath", "Bathroom", "الحمام", "bathroom|bath|toilet|shower|حمام|الحمام|دش|بانيو|حوض|الحوض|مرايه|مراية", "bathroom|bathtub|shower|toilet|plumbing fixture|tap"),
      A("office", "Office", "المكتب", "office|study|desk|مكتب|المكتب|ستادي", "desk|office|computer"),
      A("entrance", "Entrance & corridor", "المدخل والطرقة", "entrance|entry|hall|hallway|corridor|مدخل|المدخل|طرقة|الطرقه|الطرقة|ريسبشن المدخل|جزامة|جزامه", "door"),
      A("outdoor", "Outdoor & balcony", "البلكونة والجنينة", "balcony|garden|terrace|roof|outdoor|pool|بلكونة|البلكونه|البلكونة|جنينة|الجنينه|تراس|الروف|روف|حديقة|بيسين", "garden|patio|swimming pool|lawn|yard|deck"),
    ] },
    { en: "Things", ar: "الحاجات", albums: [
      A("sofas", "Sofas & seating", "الكنب والقعدة", "sofa|couch|sectional|armchair|chair|chairs|كنبة|كنبه|الكنبة|كنب|الكنب|فوتيه|فوتيهات|كرسي|كراسي|ركنة|ركنه|ليزي بوي|بوف", "couch|chair|loveseat|stool|armrest|sofa bed"),
      A("tables", "Tables", "الترابيزات", "table|tables|coffee table|side table|console|ترابيزة|ترابيزه|ترابيزات|طاولة|كونسول|ترابيزة وسط|ترابيزة جنب", "table|coffee table|end table|nightstand|countertop"),
      A("beds", "Beds", "السراير", "bed|beds|headboard|سرير|سراير|السرير|راسية|الراسيه", "bed|bed frame|headboard"),
      A("storage", "Wardrobes & storage", "الدواليب والتخزين", "wardrobe|closet|cabinet|shelf|shelves|bookcase|tv unit|دولاب|دواليب|خزانة|رفوف|رف|مكتبة|وحدة تلفزيون|وحده تليفزيون|شوز|نيش|بوفيه|كومود|تسريحة|تسريحه", "shelf|cabinetry|bookcase|drawer|chest of drawers|cupboard|shelving"),
      A("lighting", "Lighting", "الإضاءة", "lamp|lamps|light|lighting|chandelier|spot|pendant|نجفة|نجفه|نجف|اباجورة|اباجوره|ابليك|سبوت|سبوتات|اضاءة|اضاءه|لمبة|ليد|led|بروفايل", "lamp|light fixture|chandelier|lampshade|light|ceiling"),
      A("curtains", "Curtains & textiles", "الستاير والمفروشات", "curtain|curtains|blind|blinds|rug|carpet|cushion|pillow|throw|ستارة|ستاره|ستاير|ستائر|سجادة|سجاده|سجاد|كليم|مخدة|مخده|خدادية|مفرش|مفروشات", "curtain|window blind|carpet|rug|cushion|pillow|textile|linens"),
      A("walls", "Walls, paint & colours", "الحيطان والدهانات والألوان", "paint|wall|walls|colour|color|wallpaper|panel|cladding|دهان|دهانات|نقاشة|نقاشه|الوان|ألوان|لون|ورق حائط|ورق حيطة|بانوه|بانوهات|تجليد|حيطة|حيطه|جبس|جبسوم بورد|بديل رخام|بديل خشب", "wall|paint|wallpaper|molding"),
      A("floors", "Floors & tiles", "الأرضيات والسيراميك", "floor|floors|tile|tiles|ceramic|porcelain|marble|parquet|hdf|سيراميك|بورسلين|رخام|باركيه|ارضية|ارضيات|أرضيات|بلاط|جرانيت", "tile|flooring|floor|hardwood|marble|laminate flooring"),
      A("decor", "Decor & plants", "الديكور والزرع", "decor|decoration|accessories|vase|mirror|frame|plant|plants|art|painting|انتيكة|انتيكات|تحف|فازة|زرع|زرعة|نباتات|برواز|براويز|لوحة|لوحات|مراية|اكسسوارات|ديكور", "houseplant|flowerpot|vase|mirror|picture frame|painting|plant|art|sculpture|interior design|candle"),
      A("appliances", "Appliances", "الأجهزة", "fridge|tv|television|oven|washing machine|ac|air conditioner|تلاجة|تلاجه|تلفزيون|تليفزيون|شاشة|بوتاجاز|غسالة|تكييف|مكيف|ديب فريزر|ميكروويف", "television|refrigerator|home appliance|oven|microwave oven|washing machine"),
    ] },
  ], hint: /design|decor|furniture|interior|ديكور|اثاث|أثاث|عفش|موبيليا|فرش|تشطيب|تشطيبات/i },
  news: { en: "News", ar: "أخبار", rows: [
    { en: "Topics", ar: "المواضيع", albums: [
      A("egypt", "Egypt", "مصر", "egypt|egyptian|cairo|sisi|مصر|المصري|المصرية|القاهرة|السيسي|الحكومة المصرية|مدبولي"),
      A("arab", "Middle East", "الشرق الأوسط", "gaza|palestine|israel|lebanon|syria|iran|iraq|yemen|saudi|uae|qatar|sudan|libya|غزة|فلسطين|اسرائيل|إسرائيل|لبنان|سوريا|ايران|إيران|العراق|اليمن|السعودية|الامارات|قطر|السودان|ليبيا|حماس|حزب الله"),
      A("world", "World", "العالم", "us|usa|america|trump|biden|russia|ukraine|china|europe|uk|france|germany|un|nato|امريكا|أمريكا|ترامب|روسيا|اوكرانيا|أوكرانيا|الصين|اوروبا|أوروبا|بريطانيا|فرنسا|المانيا|ألمانيا|الامم المتحدة|الناتو"),
      A("economy", "Economy & money", "الاقتصاد والفلوس", "economy|dollar|gold|price|prices|inflation|bank|interest|stock|oil|budget|imf|اقتصاد|الدولار|دولار|الذهب|دهب|سعر|اسعار|أسعار|التضخم|البنك|الفايدة|الفائدة|البورصة|البترول|النفط|الموازنة|صندوق النقد|الجنيه"),
      A("politics", "Politics", "السياسة", "election|elections|president|parliament|minister|government|war|ceasefire|attack|army|انتخابات|رئيس|البرلمان|وزير|الحكومة|حرب|هدنة|وقف اطلاق النار|هجوم|الجيش|قصف|غارة"),
      A("sport", "Sport", "الرياضة", "football|match|league|cup|goal|ahly|zamalek|salah|liverpool|real madrid|barcelona|olympic|كورة|الكورة|مباراة|ماتش|الدوري|كأس|كاس|الاهلي|الأهلي|الزمالك|صلاح|المنتخب|اولمبياد"),
      A("tech", "Tech & science", "التكنولوجيا والعلوم", "ai|artificial intelligence|iphone|apple|google|samsung|tech|technology|science|space|nasa|chatgpt|gemini|claude|ذكاء اصطناعي|الذكاء الاصطناعي|تكنولوجيا|ايفون|آيفون|ابل|جوجل|سامسونج|علم|علماء|الفضاء|ناسا"),
      A("health", "Health", "الصحة", "health|virus|vaccine|disease|hospital|doctor|cancer|covid|صحة|الصحة|فيروس|لقاح|مرض|مستشفى|دكتور|سرطان|كورونا|علاج"),
      A("weather", "Weather", "الطقس", "weather|rain|storm|heat|temperature|earthquake|flood|الطقس|الجو|امطار|أمطار|مطر|عاصفة|حر|حرارة|زلزال|سيول|الارصاد|الأرصاد"),
    ] },
  ], hint: /news|breaking|اخبار|أخبار|خبر|عاجل|نيوز/i },
  religion: { en: "Hadith & stories", ar: "أحاديث وقصص", rows: [
    { en: "Themes", ar: "المواضيع", albums: [
      A("prayer", "Prayer", "الصلاة", "prayer|salah|pray|mosque|wudu|فجر|الفجر|صلاة|الصلاة|صلى|يصلي|المسجد|وضوء|الوضوء|ركعة|ركعتين|السجود|القيام|الجمعة|قيام الليل"),
      A("fasting", "Fasting & Ramadan", "الصيام ورمضان", "fasting|fast|ramadan|suhoor|iftar|صيام|الصيام|صوم|رمضان|السحور|الافطار|الإفطار|صائم"),
      A("charity", "Charity", "الصدقة", "charity|sadaqah|zakat|poor|orphan|give|صدقة|الصدقة|صدقه|زكاة|الزكاة|الفقير|الفقراء|اليتيم|المسكين|انفق|أنفق|ينفق"),
      A("parents", "Parents & family", "الوالدين والأهل", "parents|mother|father|family|kinship|wife|husband|children|الوالدين|بر الوالدين|امك|أمك|ابوك|أبيك|الام|الأم|الاب|الأب|صلة الرحم|الرحم|الزوجة|الزوج|اهله|أهله|اولاده"),
      A("patience", "Patience & trust", "الصبر والتوكل", "patience|patient|trust|tawakkul|hardship|test|trial|الصبر|صبر|اصبر|يصبر|التوكل|توكل|البلاء|ابتلاء|المصيبة|الشدة"),
      A("manners", "Manners & character", "الأخلاق", "manners|character|honesty|truth|lie|kindness|smile|anger|tongue|neighbor|الاخلاق|الأخلاق|خلق|الصدق|الكذب|الرفق|الابتسامة|تبسمك|الغضب|لا تغضب|اللسان|الجار|حسن الخلق|الغيبة|النميمة|الحياء"),
      A("knowledge", "Knowledge", "العلم", "knowledge|learn|scholar|quran|العلم|طلب العلم|العلماء|عالم|القران|القرآن|تعلم|علمه"),
      A("remembrance", "Dua & dhikr", "الدعاء والذكر", "dua|dhikr|remembrance|istighfar|tasbih|الدعاء|دعاء|ادع|الذكر|ذكر الله|سبحان الله|الحمد لله|استغفر|الاستغفار|لا اله الا الله|لا حول ولا قوة"),
      A("hereafter", "Death & the hereafter", "الموت والآخرة", "death|grave|paradise|jannah|hell|judgement|الموت|القبر|الجنة|النار|يوم القيامة|الآخرة|الاخرة|الحساب"),
      A("prophets", "The Prophet & companions", "سيرة النبي والصحابة", "prophet|companion|sahaba|seerah|abu bakr|umar|uthman|ali|aisha|khadija|بلال|النبي|الرسول|رسول الله|السيرة|الصحابة|الصحابي|ابو بكر|أبو بكر|عمر بن الخطاب|عثمان|علي بن ابي طالب|عائشة|خديجة"),
      A("stories", "Stories", "قصص", "story|stories|once upon|قصة|قصه|حكاية|يحكى|يحكي|كان هناك|كان فيه|يروى"),
    ] },
  ], hint: /hadith|islam|islamic|deen|quran|sunnah|حديث|احاديث|أحاديث|اسلام|إسلام|دين|ديني|دينية|قران|قرآن|سنة|سنه|قصص الانبياء|ذكر|أذكار|اذكار/i },
  recipes: { en: "Recipes", ar: "وصفات", rows: [
    { en: "Dishes", ar: "الأكلات", albums: [
      A("mains", "Main dishes", "أطباق رئيسية", "chicken|meat|beef|fish|rice|pasta|فراخ|لحمة|لحم|سمك|رز|مكرونة|محشي|ملوخية|كفتة|طاجن", "food|dish|cuisine|meat|chicken|fish|rice|pasta"),
      A("sweets", "Desserts", "حلويات", "cake|dessert|sweet|cookies|chocolate|كيك|كيكة|حلويات|حلو|بسبوسة|كنافة|جاتوه|شوكولاتة|بسكويت", "cake|dessert|cookie|chocolate|baked goods|pastry"),
      A("salads", "Salads & sides", "سلطات ومقبلات", "salad|soup|appetizer|سلطة|سلطات|شوربة|مقبلات", "salad|soup|vegetable"),
      A("drinks", "Drinks", "مشروبات", "juice|drink|coffee|tea|smoothie|عصير|مشروب|قهوة|شاي|سموزي", "drink|juice|coffee|tea|beverage|cocktail"),
    ] },
  ], hint: /recipe|recipes|cooking|food|وصفة|وصفات|اكل|أكل|طبخ|مطبخ/i },
  other: { en: "Other", ar: "تاني", rows: [], hint: /^$/ },
};

const textOf = (it, seen) => { const s = seen && seen[it.file]; return [it.text, s && s.text].filter(Boolean).join(" "); };
const labelsOf = (it, seen) => ((seen && seen[it.file] && seen[it.file].labels) || []).map((l) => String(l.text || l).toLowerCase());
const hasWord = (f, w) => (w.length <= 3 ? new RegExp("(^|[^\\p{L}\\p{N}])" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^\\p{L}\\p{N}]|$)", "u").test(f) : f.includes(w));
/** How well an item fits an album: 2 per word in its text, 1.5 per photo label. */
export function fit(it, album, seen) {
  const f = " " + fold(textOf(it, seen)).replace(/[^\p{L}\p{N} ]+/gu, " ").replace(/\s+/g, " ") + " ";
  let s = 0; for (const w of album.words) if (w && hasWord(f, w)) s += 2;
  const ls = labelsOf(it, seen); for (const l of album.labels) if (ls.includes(l)) s += 1.5;
  return s;
}
/** What the group is about: its name first, then which kind's albums its items fit most. → "design" | "news" | … | "other" */
export function kindOf(items, { title = "", seen = {} } = {}) {
  for (const k of ["design", "news", "religion", "recipes"]) if (KINDS[k].hint.test(title)) return k;
  const score = {};
  const sample = (items || []).slice(-400);
  for (const k of ["design", "news", "religion", "recipes"]) {
    let n = 0; for (const it of sample) if (KINDS[k].rows.some((r) => r.albums.some((a) => fit(it, a, seen) > 0))) n++;
    score[k] = n / Math.max(1, sample.length);
  }
  // Hadith have their own marks («قال رسول الله»، «رواه البخاري»)
  score.religion += sample.filter((it) => /رسول الله|صلى الله عليه وسلم|ﷺ|رواه|رضي الله عنه|prophet muhammad|narrated/i.test(it.text)).length / Math.max(1, sample.length);
  const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] >= 0.2 ? best[0] : "other";
}

/** The group's albums: rows of { id, en, ar, ids: [item ids], cover } + "More" (what fits none) + "Latest". moves = { itemId: albumId }. */
export function albumsOf(items, kind, { seen = {}, moves = {} } = {}) {
  const K = KINDS[kind] || KINDS.other;
  const rows = K.rows.map((r) => ({ en: r.en, ar: r.ar, albums: r.albums.map((a) => ({ id: a.id, en: a.en, ar: a.ar, ids: [] })) }));
  const all = rows.flatMap((r) => r.albums), byId = Object.fromEntries(all.map((a) => [a.id, a]));
  const more = { id: "more", en: "More", ar: "حاجات تانية", ids: [] };
  for (const it of items || []) {
    if (moves[it.id]) { (byId[moves[it.id]] || more).ids.push(it.id); continue; }
    let put = false;
    for (const r of K.rows) {
      // in each row, the best album (and any other that fits as well)
      const sc = r.albums.map((a) => [a.id, fit(it, a, seen)]).filter(([, s]) => s > 0).sort((x, y) => y[1] - x[1]);
      if (sc.length) { for (const [id, s] of sc) if (s >= sc[0][1]) byId[id].ids.push(it.id); put = true; }
    }
    if (!put) more.ids.push(it.id);
  }
  const itemById = Object.fromEntries((items || []).map((x) => [x.id, x]));
  const cover = (ids) => { const p = [...ids].reverse().map((id) => itemById[id]).find((x) => x && x.kind === "photo" && x.has); return p ? p.file : ""; };
  for (const a of [...all, more]) { a.ids.sort((x, y) => (itemById[y] ? itemById[y].t : 0) - (itemById[x] ? itemById[x].t : 0)); a.cover = cover(a.ids); a.count = a.ids.length; }
  return { rows: rows.map((r) => ({ ...r, albums: r.albums.filter((a) => a.count) })).filter((r) => r.albums.length), more: more.count ? more : null };
}

// ---- 6. the Hadith card ------------------------------------------------------------------------------------------------------------
const SOURCES = ["البخاري", "مسلم", "الترمذي", "أبو داود", "ابو داود", "النسائي", "ابن ماجه", "أحمد", "احمد", "مالك", "الدارمي", "البيهقي", "الطبراني", "ابن حبان", "الحاكم"];
/** A Hadith in a message → { narrator, text, source, grade, isHadith }. */
export function hadithOf(text) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  const narr = s.match(/عن\s+((?:أبي|ابي|أبو|ابو|أم|ام|ابن|عبد|عبدالله|عبد الله)?\s*[؀-ۿ]+(?:\s+(?:بن|ابن|بنت)\s+[؀-ۿ]+)?)\s+(?:رضي الله عن(?:ه|ها|هما|هم))/) || s.match(/\bnarrated\s+(?:by\s+)?([A-Z][\w'’ -]{2,40}?)(?:\s*[:,(]|\s+that\b)/i);
  const src = s.match(/(?:رواه|أخرجه|اخرجه)\s+([؀-ۿ ]{2,40}?)(?:[.،,)\]]|$|\s+(?:وصححه|وحسنه|وقال|بسند))/) || s.match(/\(?(متفق عليه)\)?/) || s.match(/\b(Sahih (?:al-)?Bukhari|Sahih Muslim|(?:Jami[`'’]? )?(?:at-)?Tirmidhi|Sunan Abi Dawud|Abu Dawud|An-?Nasa'?i|Ibn Majah|Musnad Ahmad|Muwatta Malik)\b/i);
  const grade = s.match(/(صحيح|حسن صحيح|حسن|ضعيف|موضوع)(?:\s+الإسناد|\s+الاسناد)?(?=[\s.،)]|$)/) || s.match(/\b(sahih|hasan|da'?if|weak|authentic)\b/i);
  let body = s;
  const q = s.match(/[«"“]([^»"”]{4,})[»"”]/); if (q) body = q[1];
  else { const m = s.match(/(?:قال|يقول)\s+(?:رسول الله|النبي)\s*(?:صلى الله عليه وسلم|ﷺ)?\s*:?\s*(.+)$/); if (m) body = m[1]; }
  body = body.replace(/(?:رواه|أخرجه|اخرجه)\s+[\s\S]*$/, "").replace(/\(?متفق عليه\)?/, "").trim().replace(/^[«"“]|[»"”]$/g, "").trim();
  const isHadith = /رسول الله|صلى الله عليه وسلم|ﷺ|النبي|prophet|messenger of allah/i.test(s) && !!(src || narr || q);
  let source = src ? src[1].trim() : "";
  if (source && !/متفق|bukhari|muslim|tirmidhi|dawud|nasa|majah|ahmad|malik/i.test(source) && !SOURCES.some((x) => source.startsWith(x))) source = source.split(/\s+/).slice(0, 3).join(" ");
  return { isHadith, narrator: narr ? narr[1].trim() : "", text: body, source, grade: grade ? grade[1] : "" };
}

// ---- news line ----------------------------------------------------------------------------------------------------------------------
/** The first line that says something, ≤ 140 letters. */
export function headline(text) {
  const s = String(text || "").replace(/https?:\/\/\S+/g, "").replace(/[*_~]/g, "").trim();
  const l = s.split(/\n+/).map((x) => x.trim()).find((x) => /\p{L}{3}/u.test(x) && !/^(عاجل|breaking)\s*[:|-]?\s*$/i.test(x)) || s;
  const first = l.split(/(?<=[.!?؟])\s+/)[0];
  return (first.length > 140 ? first.slice(0, 137) + "…" : first).trim();
}

// ---- 7. search -----------------------------------------------------------------------------------------------------------------------
/** Free text over every group: → [{ group, item, score }] best first. library = { groups: [{ id, title, items, seen, kind }] } */
export function searchLibrary(library, q, { limit = 60 } = {}) {
  const docs = [];
  for (const g of (library && library.groups) || []) for (const it of g.items || []) {
    const s = g.seen && g.seen[it.file];
    docs.push({ id: g.id + "|" + it.id, kind: "chat", title: g.title, text: [it.text, s && s.text, s && (s.labels || []).map((l) => l.text || l).join(" "), it.who].filter(Boolean).join("\n"), ts: it.t, g, it });
  }
  return recallSearch(docs, q, { limit }).hits.map((h) => ({ group: h.doc.g, item: h.doc.it, score: h.score, snip: h.snip }));
}

/** The photos still to be looked at by the phone (labels + words in them). */
export const unseen = (items, seen) => (items || []).filter((x) => x.kind === "photo" && x.has && !(seen && seen[x.file])).map((x) => x.file);
export const groupIdOf = (title) => "g" + hash(String(title || "").trim().toLowerCase() || String(Date.now()));
export const titleOf = (name) => String(name || "").replace(/^WhatsApp Chat (?:with|-)\s*/i, "").replace(/^محادثة واتساب مع\s*/, "").replace(/\.(txt|zip)$/i, "").trim() || "WhatsApp group";
