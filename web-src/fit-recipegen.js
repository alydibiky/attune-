/* ---- v6.18: the recipe book — 20,000+ real dishes, built from families, never typed one by one -----------------------------------
   A dish here is a real combination a person can cook: a protein (or legume, egg, grain…) + a way of cooking it + a flavour +
   a vegetable + a side, with real grams of real foods from the food table. The calories and macros are ALWAYS computed from
   those grams (fit.js recipeNutrients), never written by hand and never guessed by a model. The dishes are built on demand
   from an index (family + position), so 20,000 of them cost no memory and no start-up time; a search walks the families in a
   spread-out order and builds only what it shows.
   Names are written in English and Egyptian Arabic from the same parts, so both always agree.
   Tests: tests/unit/v617recipes.test.mjs (every ingredient exists, calories sane, names unique, search finds things).          */

const o = (id, en, ar, g, extra = {}) => ({ id, en, ar, g, ...extra });
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ---- shared parts ------------------------------------------------------------------------------------------------------------
const VEG = [
  o("broccoli", "broccoli", "بروكلي", 120), o("zucchini", "zucchini", "كوسة", 120), o("cauliflower", "cauliflower", "قرنبيط", 120),
  o("green-beans", "green beans", "فاصوليا خضراء", 120), o("carrot", "carrots", "جزر", 100), o("eggplant", "eggplant", "باذنجان", 120),
  o("okra", "okra", "بامية", 120), o("mushrooms", "mushrooms", "مشروم", 100), o("pepper", "peppers", "فلفل ألوان", 100), o("spinach", "spinach", "سبانخ", 120),
];
const SIDES = [
  o("rice", "rice", "أرز", 150), o("potato", "potatoes", "بطاطس", 180), o("sweet-potato", "sweet potato", "بطاطا حلوة", 160),
  o("freekeh", "freekeh", "فريك", 150), o("quinoa", "quinoa", "كينوا", 150), o("baladi", "baladi bread", "عيش بلدي", 60),
];
const OIL = (g) => ["olive-oil", g];

// ---- family 1: protein plates (12 × 4 × 6 × 10 × 6 = 17,280 → counted as built) ----------------------------------------------
const PROT = [
  o("chicken-breast", "chicken breast", "صدور فراخ", "f", { cls: "chicken", amt: 160 }),
  o("chicken-thigh", "chicken thighs", "وراك فراخ", "f", { cls: "chicken", amt: 170 }),
  o("beef", "beef cubes", "لحمة بقري", "f", { cls: "meat", amt: 140 }),
  o("kofta", "kofta", "كفتة", "f", { cls: "meat", amt: 140 }),
  o("fish", "white fish fillet", "فيليه سمك", "m", { cls: "fish", amt: 170 }),
  o("salmon", "salmon", "سلمون", "m", { cls: "fish", amt: 150 }),
  o("shrimp", "shrimp", "جمبري", "m", { cls: "fish", amt: 140 }),
  o("lamb", "lamb", "لحمة ضاني", "f", { cls: "meat", amt: 140 }),
  o("turkey", "turkey breast", "صدر ديك رومي", "m", { cls: "chicken", amt: 150 }),
  o("sea-bass", "sea bass", "قاروص", "m", { cls: "fish", amt: 170 }),
  o("mackerel", "mackerel", "ماكريل", "m", { cls: "fish", amt: 150 }),
  o("veal", "veal", "لحم بتلو", "m", { cls: "meat", amt: 140 }),
];
const METHODS = [
  { k: "grill", pre: "Grilled", post: "", ar: (g) => (g === "f" ? "مشوية" : "مشوي"), mins: 25, extra: [OIL(6)], step: "Grill on a hot grill pan, about 5–7 minutes a side, until cooked through." },
  { k: "bake", pre: "Oven-baked", post: "", ar: () => "في الفرن", mins: 35, extra: [OIL(8)], step: "Bake in a 200 °C oven for 20–25 minutes until cooked through." },
  { k: "pan", pre: "Pan-seared", post: "", ar: () => "على الطاسة", mins: 20, extra: [OIL(8)], step: "Sear in a hot non-stick pan, 4–6 minutes a side, until golden and cooked through." },
  { k: "stew", pre: "", post: " slow-cooked in tomato sauce", ar: () => "بصلصة الطماطم", mins: 50, extra: [["tomato-paste", 25], ["onion", 60], OIL(6)], step: "Brown it with the onion, add the tomato paste and a cup of water, cover and simmer 30–35 minutes." },
];
const FLAV = [
  { en: "lemon-garlic marinade", ar: "بتتبيلة الليمون والثوم", items: [["lemon", 10], ["garlic", 4], OIL(5)] },
  { en: "cumin and coriander rub", ar: "بتتبيلة الكمون والكزبرة", items: [["garlic", 3], OIL(5)] },
  { en: "tahini-lemon sauce", ar: "بصوص الطحينة والليمون", items: [["tahini", 15], ["lemon", 10]] },
  { en: "spiced yogurt marinade", ar: "بتتبيلة الزبادي والتوابل", items: [["yogurt", 50], ["garlic", 3]] },
  { en: "tomato and herb sauce", ar: "بصوص الطماطم والأعشاب", items: [["tomato", 80], ["parsley", 5], OIL(5)] },
  { en: "chili and paprika rub", ar: "بتتبيلة الشطة والبابريكا", items: [["hot-pepper", 8], OIL(5)] },
];
const F1 = {
  sizes: [PROT.length, METHODS.length, FLAV.length, VEG.length, SIDES.length],
  tags: (s) => ["lunch", "dinner", "high-protein", PROT[s[0]].cls, ...(s[4] === 5 ? [] : ["gluten-light"])],
  build(s) {
    const p = PROT[s[0]], m = METHODS[s[1]], f = FLAV[s[2]], v = VEG[s[3]], sd = SIDES[s[4]];
    const en = cap(`${m.pre ? m.pre + " " : ""}${p.en}${m.post} with ${f.en}, ${v.en} and ${sd.en}`.trim());
    const ar = `${p.ar} ${m.ar(p.g)} ${f.ar} مع ${v.ar} و${sd.ar}`;
    const items = [[p.id, p.amt], ...m.extra, ...f.items, [v.id, v.g], [sd.id, sd.g]];
    const steps = [
      `Season the ${p.en} with salt, pepper and the ${f.en}; leave it 15 minutes.`,
      m.step,
      `Cook the ${sd.en} and prepare the ${v.en}: steam, sauté or roast until just tender.`,
      `Plate the ${p.en} with the ${sd.en} and ${v.en}.`,
    ];
    return { en, ar, items, steps, mins: m.mins };
  },
};

// ---- family 2: legume dishes (5 × 5 × 10 × 6 = 1,500) ------------------------------------------------------------------------
const LEG = [
  o("lentils-dry", "lentil", "عدس", 60, { arb: "بالعدس" }), o("chickpeas", "chickpea", "حمص", 150, { arb: "بالحمص" }), o("kidney-beans", "kidney bean", "فاصوليا حمراء", 150, { arb: "بالفاصوليا الحمراء" }),
  o("black-eyed", "black-eyed bean", "لوبيا", 150, { arb: "باللوبيا" }), o("beans-white", "white bean", "فاصوليا بيضا", 180, { arb: "بالفاصوليا البيضا" }),
];
const STYLES2 = [
  { k: "soup", en: (l, v, f) => `${cap(l.en)} soup with ${v.en} and ${f.en}`, ar: (l, v, f) => `شوربة ${l.ar} مع ${v.ar} و${f.ar}`, mins: 35, extra: [["onion", 50], OIL(5)], step: "Simmer with the onion and 2 cups of water for 25 minutes, then blend half for body." },
  { k: "stew", en: (l, v, f) => `${cap(l.en)} and ${v.en} stew with ${f.en}`, ar: (l, v, f) => `يخنة ${l.ar} و${v.ar} مع ${f.ar}`, mins: 40, extra: [["tomato-paste", 20], ["onion", 50], OIL(6)], step: "Sauté the onion, add the tomato paste, then everything with a cup of water; simmer 25 minutes." },
  { k: "salad", en: (l, v, f) => `${cap(l.en)} salad bowl with ${v.en} and ${f.en}`, ar: (l, v, f) => `سلطة ${l.ar} مع ${v.ar} و${f.ar}`, mins: 15, extra: [["tomato", 60], ["cucumber", 60]], step: "Toss everything together while the legumes are still slightly warm." },
  { k: "rice", en: (l, v, f) => `${cap(l.en)} and rice bowl with ${v.en} and ${f.en}`, ar: (l, v, f) => `طبق أرز ${l.arb} مع ${v.ar} و${f.ar}`, mins: 30, extra: [["rice", 120]], step: "Serve the cooked legumes and vegetables over the rice." },
  { k: "tray", en: (l, v, f) => `Roasted ${l.en} and ${v.en} tray with ${f.en}`, ar: (l, v, f) => `صينية ${l.ar} و${v.ar} في الفرن مع ${f.ar}`, mins: 35, extra: [OIL(8), ["onion", 50]], step: "Roast on a tray at 200 °C for 25 minutes, turning once." },
];
const FLAV2 = [
  { en: "lemon-cumin dressing", ar: "صوص الليمون والكمون", items: [["lemon", 12], OIL(5)] },
  { en: "tahini drizzle", ar: "رشة طحينة", items: [["tahini", 15]] },
  { en: "garlic and tomato", ar: "الثوم والطماطم", items: [["garlic", 4], ["tomato", 70]] },
  { en: "mint yogurt", ar: "زبادي بالنعناع", items: [["yogurt", 60]] },
  { en: "chili and lemon", ar: "الشطة والليمون", items: [["hot-pepper", 8], ["lemon", 10]] },
  { en: "parsley and olive oil", ar: "البقدونس وزيت الزيتون", items: [["parsley", 8], OIL(6)] },
];
const F2 = {
  sizes: [LEG.length, STYLES2.length, VEG.length, FLAV2.length],
  tags: () => ["lunch", "dinner", "vegetarian", "high-fibre", "light"],
  build(s) {
    const l = LEG[s[0]], st = STYLES2[s[1]], v = VEG[s[2]], f = FLAV2[s[3]];
    return { en: st.en(l, v, f), ar: st.ar(l, v, f), items: [[l.id, l.g], [v.id, 100], ...st.extra, ...f.items],
      steps: [`Rinse the ${l.en}s and chop the ${v.en}.`, st.step, `Finish with the ${f.en}, taste and adjust the salt.`], mins: st.mins };
  },
};

// ---- family 3: egg dishes (5 × 12 × 6 × 4 = 1,440) --------------------------------------------------------------------------
const EGGST = [
  { en: "omelette", ar: "أومليت", mins: 10, extra: [["butter", 5]], step: "Whisk the eggs, pour into a hot pan and fold when just set." },
  { en: "scrambled eggs", ar: "بيض مخفوق", mins: 8, extra: [["butter", 5]], step: "Stir the eggs gently over low heat until creamy." },
  { en: "baked eggs in tomato sauce", ar: "بيض في صلصة الطماطم", mins: 20, extra: [["tomato", 120], ["onion", 40], OIL(5)], step: "Simmer the sauce 8 minutes, make wells, crack in the eggs, cover until set." },
  { en: "fried eggs", ar: "بيض مقلي", mins: 8, extra: [OIL(6)], step: "Fry in a little oil until the whites are set." },
  { en: "egg and vegetable scramble", ar: "بيض مخلوط بالخضار", mins: 12, extra: [OIL(5), ["onion", 30]], step: "Soften the vegetables, then pour in the beaten eggs and stir until cooked." },
];
const ADDIN = [
  o("tomato", "tomato", "طماطم", 80, { arb: "بالطماطم" }), o("onion", "onion", "بصل", 40, { arb: "بالبصل" }), o("pepper", "pepper", "فلفل", 50, { arb: "بالفلفل" }), o("spinach", "spinach", "سبانخ", 60, { arb: "بالسبانخ" }),
  o("mushrooms", "mushrooms", "مشروم", 60, { arb: "بالمشروم" }), o("zucchini", "zucchini", "كوسة", 70, { arb: "بالكوسة" }), o("feta", "feta", "جبنة فيتا", 30, { arb: "بجبنة الفيتا" }), o("halloumi", "halloumi", "جبنة حلومي", 40, { arb: "بجبنة الحلومي" }),
  o("cottage", "cottage cheese", "جبنة قريش", 50, { arb: "بالجبنة القريش" }), o("avocado", "avocado", "أفوكادو", 60, { arb: "بالأفوكادو" }), o("parsley", "parsley", "بقدونس", 10, { arb: "بالبقدونس" }), o("carrot", "carrot", "جزر", 50, { arb: "بالجزر" }),
];
const EGGSIDE = [
  o("baladi", "baladi bread", "عيش بلدي", 60), o("pita-brown", "brown pita", "عيش بيتا أسمر", 55), o("toast-brown", "brown toast", "توست أسمر", 60),
  o("potato", "potato", "بطاطس", 120), o("oats", "oats", "شوفان", 40), o("cucumber", "cucumber salad", "سلطة خيار", 100),
];
const EGGAMT = [2, 3, 2, 3]; const EGGSPICE = [["cumin", "cumin", "الكمون"], ["black pepper", "black pepper", "الفلفل الأسود"], ["chili flakes", "chili flakes", "الشطة"], ["herbs", "fresh herbs", "الأعشاب"]];
const F3 = {
  sizes: [EGGST.length, ADDIN.length, EGGSIDE.length, EGGSPICE.length],
  tags: () => ["breakfast", "dinner", "high-protein", "vegetarian"],
  build(s) {
    const st = EGGST[s[0]], a = ADDIN[s[1]], sd = EGGSIDE[s[2]], sp = EGGSPICE[s[3]];
    const eggs = EGGAMT[s[3]] * 50;
    const side = sd.id === "oats" ? { en: "a bowl of oats", ar: "طبق شوفان" } : sd;
    return { en: cap(`${st.en} with ${a.en} and ${sp[1]}, with ${side.en}`), ar: `${st.ar} ${a.arb} و${sp[2]} مع ${side.ar}`,
      items: [["egg", eggs], ...st.extra, [a.id, a.g], [sd.id, sd.g]],
      steps: [`Prepare the ${a.en} and season the eggs with salt and ${sp[1]}.`, st.step, `Serve with the ${side.en}.`], mins: st.mins };
  },
};

// ---- family 4: grain and pasta bowls (8 × 6 × 10 × 6 = 2,880) ---------------------------------------------------------------
const GRAIN = [
  o("pasta", "pasta", "مكرونة", 160), o("rice-brown", "brown rice", "أرز بني", 150), o("bulgur", "bulgur", "برغل", 160), o("freekeh", "freekeh", "فريك", 150),
  o("couscous", "couscous", "كسكسي", 150), o("quinoa", "quinoa", "كينوا", 150), o("noodles", "noodles", "نودلز", 150), o("rice", "rice", "أرز", 150),
];
const TOP = [
  o("chicken-breast", "chicken", "فراخ", 120, { arb: "بالفراخ" }), o("tuna-water", "tuna", "تونة", 100, { arb: "بالتونة" }), o("shrimp", "shrimp", "جمبري", 110, { arb: "بالجمبري" }),
  o("beef-mince-raw", "minced beef", "لحمة مفرومة", 100, { arb: "باللحمة المفرومة" }), o("feta", "feta", "جبنة فيتا", 50, { arb: "بجبنة الفيتا" }), o("chickpeas", "chickpeas", "حمص", 120, { arb: "بالحمص" }),
];
const SAUCE = [
  { en: "tomato sauce", ar: "صلصة الطماطم", items: [["tomato", 100], ["tomato-paste", 15], OIL(5)] },
  { en: "garlic and olive oil", ar: "الثوم وزيت الزيتون", items: [["garlic", 4], OIL(10)] },
  { en: "creamy yogurt sauce", ar: "صوص الزبادي", items: [["yogurt", 80], ["garlic", 3]] },
  { en: "lemon-tahini dressing", ar: "صوص الطحينة والليمون", items: [["tahini", 15], ["lemon", 10]] },
  { en: "spicy tomato sauce", ar: "صلصة طماطم حارة", items: [["tomato", 100], ["hot-pepper", 8], OIL(5)] },
  { en: "herb and lemon dressing", ar: "صوص الأعشاب والليمون", items: [["parsley", 8], ["lemon", 10], OIL(6)] },
];
const F4 = {
  sizes: [GRAIN.length, TOP.length, VEG.length, SAUCE.length],
  tags: () => ["lunch", "dinner"],
  build(s) {
    const g = GRAIN[s[0]], t = TOP[s[1]], v = VEG[s[2]], sc = SAUCE[s[3]];
    return { en: cap(`${g.en} bowl with ${t.en}, ${v.en} and ${sc.en}`), ar: `طبق ${g.ar} ${t.arb} مع ${v.ar} و${sc.ar}`,
      items: [[g.id, g.g], [t.id, t.g], [v.id, 100], ...sc.items],
      steps: [`Cook the ${g.en} as the packet says.`, `Cook the ${t.en} and sauté the ${v.en} until just tender.`, `Toss with the ${sc.en} and serve warm.`], mins: 30 };
  },
};

// ---- family 5: breakfast bowls and smoothies (10 × 5 × 6 × 3 = 900) --------------------------------------------------------
const FRUIT = [
  o("banana", "banana", "موز", 118), o("apple", "apple", "تفاح", 150), o("strawberries", "strawberries", "فراولة", 120), o("mango", "mango", "مانجو", 120),
  o("orange", "orange", "برتقال", 130), o("pear", "pear", "كمثرى", 150), o("peach", "peach", "خوخ", 150), o("kiwi", "kiwi", "كيوي", 100),
  o("pineapple", "pineapple", "أناناس", 120), o("pomegranate", "pomegranate", "رمان", 100),
];
const BASE5 = [
  { en: "Greek yogurt bowl", ar: "بول زبادي يوناني", items: [["greek-yogurt", 170]] },
  { en: "overnight oats", ar: "شوفان بالليل", items: [["oats", 40], ["milk-skim", 150]] },
  { en: "cottage cheese bowl", ar: "بول جبنة قريش", items: [["cottage", 150]] },
  { en: "smoothie", ar: "سموذي", items: [["milk-skim", 250]] },
  { en: "chia pudding", ar: "تشيا بودينج", items: [["chia", 24], ["milk", 200]] },
];
const TOPS5 = [
  o("honey", "honey", "", 10, { arb: "بالعسل" }), o("almonds", "almonds", "", 20, { arb: "باللوز" }), o("walnuts", "walnuts", "", 20, { arb: "بعين الجمل" }),
  o("peanut-butter", "peanut butter", "", 16, { arb: "بزبدة الفول السوداني" }), o("dates", "dates", "", 24, { arb: "بالتمر" }), o("chia", "chia seeds", "", 10, { arb: "ببذور الشيا" }),
];
const EXTRA5 = [[null, "", ""], ["banana", "a banana", "ومعاه موزة"], ["whey", "a scoop of protein", "ومعاه سكوب بروتين"]];
const F5 = {
  sizes: [FRUIT.length, BASE5.length, TOPS5.length, EXTRA5.length],
  tags: () => ["breakfast", "snack", "vegetarian"],
  build(s) {
    const fr = FRUIT[s[0]], b = BASE5[s[1]], tp = TOPS5[s[2]], ex = EXTRA5[s[3]];
    const exId = ex[0];
    return { en: cap(`${fr.en} ${b.en} with ${tp.en}${exId ? " and " + ex[1] : ""}`), ar: `${b.ar} ${fr.ar} ${tp.arb}${exId ? " " + ex[2] : ""}`,
      items: [...b.items, [fr.id, fr.g], [tp.id, tp.g], ...(exId ? [[exId, exId === "whey" ? 30 : 10]] : [])],
      steps: [`Prepare the ${b.en} base.`, `Add the ${fr.en}${exId ? ` and ${ex[1]}` : ""}.`, `Top with the ${tp.en}.`], mins: 8 };
  },
};

// ---- family 6: wraps and sandwiches (8 × 4 × 8 × 5 = 1,280) ----------------------------------------------------------------
const FILL = [
  o("chicken-breast", "grilled chicken", "فراخ مشوية", 100), o("tuna-water", "tuna", "تونة", 90), o("egg", "egg", "بيض", 100), o("kofta", "kofta", "كفتة", 100),
  o("turkey", "turkey", "ديك رومي", 80), o("halloumi", "halloumi", "حلومي", 60), o("feta", "feta", "جبنة فيتا", 50), o("falafel", "falafel", "طعمية", 100, { alias: "taameya" }),
];
const BREAD = [o("baladi", "baladi bread", "عيش بلدي", 70), o("pita-brown", "brown pita", "عيش بيتا أسمر", 55), o("toast-brown", "brown toast", "توست أسمر", 60), o("tortilla", "tortilla wrap", "تورتيلا", 60)];
const VEG6 = [o("lettuce", "lettuce", "خس", 30), o("tomato", "tomato", "طماطم", 60), o("cucumber", "cucumber", "خيار", 50), o("pepper", "pepper", "فلفل", 40),
  o("rocket", "rocket", "جرجير", 20), o("carrot", "carrot", "جزر", 40), o("onion", "onion", "بصل", 25), o("pickles", "pickles", "مخلل", 30)];
const SPREAD = [
  { en: "garlic yogurt", ar: "زبادي بالثوم", items: [["yogurt", 40], ["garlic", 2]] }, { en: "tahini", ar: "طحينة", items: [["tahini", 15]] },
  { en: "hummus", ar: "حمص", items: [["hummus", 40]] }, { en: "light mayo", ar: "مايونيز", items: [["mayonnaise", 10]] }, { en: "mustard", ar: "مسطردة", items: [["mustard", 6]] },
];
const F6 = {
  sizes: [FILL.length, BREAD.length, VEG6.length, SPREAD.length],
  tags: () => ["lunch", "dinner", "snack"],
  build(s) {
    const f = FILL[s[0]], b = BREAD[s[1]], v = VEG6[s[2]], sp = SPREAD[s[3]];
    const fid = f.alias || f.id;
    return { en: cap(`${f.en} ${b.id === "tortilla" ? "wrap" : "sandwich on " + b.en} with ${v.en} and ${sp.en}`), ar: `ساندويتش ${f.ar} مع ${v.ar} و${sp.ar} في ${b.ar}`,
      items: [[fid, f.g], [b.id, b.g], [v.id, v.g], ...sp.items],
      steps: [`Warm the ${b.en}.`, `Spread the ${sp.en} and add the ${f.en} and ${v.en}.`, "Roll or fold, and serve."], mins: 10 };
  },
};

const FAMS = [F1, F2, F3, F4, F5, F6];
const sizeOf = (fm) => fm.sizes.reduce((a, b) => a * b, 1);
const SIZES = FAMS.map(sizeOf);
const OFFS = SIZES.reduce((acc, n) => { acc.push(acc[acc.length - 1] + n); return acc; }, [0]);
export const GENERATED_COUNT = OFFS[OFFS.length - 1];
export const GENERATED_FAMILIES = SIZES.slice();

function decode(fm, idx) {
  const s = []; let r = idx;
  for (let i = fm.sizes.length - 1; i >= 0; i--) { s[i] = r % fm.sizes[i]; r = Math.floor(r / fm.sizes[i]); }
  return s;
}
/** "g2-1234" → the full recipe (same shape as the hand-written ones), or null. */
export function getGenerated(id) {
  const m = /^g(\d)-(\d+)$/.exec(String(id || ""));
  if (!m) return null;
  const fi = +m[1] - 1, idx = +m[2];
  if (!FAMS[fi] || idx >= SIZES[fi]) return null;
  const fm = FAMS[fi], s = decode(fm, idx), b = fm.build(s);
  const merged = [];                                  // the same food twice (oil in the method and in the marinade) is one line
  for (const [fid, g] of b.items) { const m = merged.find((x) => x[0] === fid); if (m) m[1] += g; else merged.push([fid, g]); }
  return { id, en: b.en, ar: b.ar, serves: 1, mins: b.mins, tags: fm.tags(s), items: merged, steps: b.steps, generated: true };
}
/** Every id, in a fixed order. */
export const generatedId = (global) => { let fi = 0; while (global >= OFFS[fi + 1]) fi++; return `g${fi + 1}-${global - OFFS[fi]}`; };

const norm = (s) => String(s || "").toLowerCase().replace(/[ً-ٰٟـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
/**
 * Search the whole book: every word of `q` must appear in the English or Arabic name or in an ingredient's name. Walks the
 * dishes in a spread-out order (so the first answers are varied, not twelve versions of one dish) and stops after `n`.
 * `has(id)` → the ingredient names (for matching ingredients), `tag` filters by tag.
 */
export function searchGenerated(q, { tag = "all", n = 40, ingredientNames = () => [] } = {}) {
  const words = norm(q).split(/\s+/).filter(Boolean);
  const out = [];
  const step = Math.max(1, Math.floor(GENERATED_COUNT * 0.6180339887)); let st = step; while (gcd(st, GENERATED_COUNT) !== 1) st++;
  for (let k = 0, g = 0; k < GENERATED_COUNT && out.length < n; k++, g = (g + st) % GENERATED_COUNT) {
    const id = generatedId(g), fm = FAMS[+id[1] - 1];
    if (tag !== "all" && tag !== "fav" && !fm.tags(decode(fm, +id.split("-")[1])).includes(tag)) continue;
    if (!words.length) { out.push(getGenerated(id)); continue; }
    const rc = getGenerated(id);
    const hay = norm(rc.en + " " + rc.ar + " " + rc.items.map(([i]) => (ingredientNames(i) || []).join(" ")).join(" "));
    if (words.every((w) => hay.includes(w))) out.push(rc);
  }
  return out;
}
