/* ---- v6.14: vitamins & minerals (Yazio Pro shows them; Fit didn't) ------------------------------------------------------------
   Per 100 g, rounded from USDA FoodData Central (SR Legacy / Foundation) and, for Egyptian dishes, typical home recipes built
   from those ingredients. Order: [iron mg, calcium mg, vitamin C mg, vitamin D µg, potassium mg, magnesium mg, vitamin B12 µg,
   vitamin A µg RAE]. Foods without a row are simply not counted, and the screen says how many of the day's foods were.
   Products from Open Food Facts bring their own values when the label gives them (fitdb.js keeps iron/calcium/vitamin C/D).
   Tests: tests/unit/v721fitmicro.test.mjs.                                                                                        */

export const NUTRIENTS = [
  // key, English, Arabic, unit, daily reference for men, for women (NIH / EFSA adult values)
  ["fe", "Iron", "الحديد", "mg", 8, 18], ["ca", "Calcium", "الكالسيوم", "mg", 1000, 1000], ["vc", "Vitamin C", "فيتامين C", "mg", 90, 75],
  ["vd", "Vitamin D", "فيتامين D", "µg", 15, 15], ["k", "Potassium", "البوتاسيوم", "mg", 3400, 2600], ["mg", "Magnesium", "المغنيسيوم", "mg", 400, 310],
  ["b12", "Vitamin B12", "فيتامين B12", "µg", 2.4, 2.4], ["va", "Vitamin A", "فيتامين A", "µg", 900, 700],
];
const T = {
  baladi: [2.4, 30, 0, 0, 200, 70, 0, 0], shami: [1.6, 50, 0, 0, 120, 25, 0, 0], "toast-white": [3.6, 150, 0, 0, 115, 23, 0, 0], "toast-brown": [2.5, 110, 0, 0, 250, 75, 0, 0],
  fino: [2.5, 60, 0, 0, 120, 25, 0, 0], rice: [0.2, 10, 0, 0, 35, 12, 0, 0], "rice-vermicelli": [0.4, 10, 0, 0, 40, 13, 0, 0], "rice-brown": [0.4, 10, 0, 0, 80, 40, 0, 0],
  pasta: [0.5, 7, 0, 0, 45, 18, 0, 0], oats: [4.7, 54, 0, 0, 430, 140, 0, 0], cornflakes: [8, 5, 0, 0, 80, 15, 1.5, 0], freekeh: [1.5, 15, 0, 0, 150, 50, 0, 0],
  bulgur: [1, 10, 0, 0, 70, 32, 0, 0], "rice-dry": [0.8, 28, 0, 0, 115, 25, 0, 0], "pasta-dry": [1.3, 21, 0, 0, 220, 53, 0, 0], potato: [0.3, 8, 7, 0, 330, 20, 0, 0],
  fries: [0.8, 15, 5, 0, 580, 35, 0, 0], "sweet-potato": [0.7, 38, 20, 0, 475, 27, 0, 960], corn: [0.5, 3, 6, 0, 270, 37, 0, 9], croissant: [2, 37, 0, 0, 120, 16, 0.2, 200],
  feteer: [1.5, 30, 0, 0, 100, 15, 0.1, 150], ful: [1.5, 36, 0.3, 0, 270, 43, 0, 0], taameya: [3.4, 55, 1, 0, 585, 82, 0, 0], koshari: [1.2, 20, 2, 0, 150, 25, 0, 0],
  molokhia: [1.5, 100, 15, 0, 250, 30, 0, 150], "lentil-soup": [1.5, 15, 2, 0, 200, 25, 0, 0], mahshi: [0.8, 20, 8, 0, 200, 18, 0, 30], bechamel: [1, 90, 0, 0.1, 150, 18, 0.4, 60],
  bamia: [1.2, 50, 10, 0, 250, 30, 0.5, 20], fasolia: [1.2, 30, 6, 0, 220, 22, 0.5, 20], shakshuka: [1.3, 40, 12, 1, 250, 15, 0.6, 100], hawawshi: [2, 30, 1, 0, 200, 25, 1, 0],
  "om-ali": [0.8, 90, 0, 0.1, 150, 20, 0.3, 50], "roz-laban": [0.2, 100, 0, 0.1, 140, 12, 0.3, 30], basbousa: [1, 40, 0, 0, 80, 15, 0, 20], konafa: [1, 40, 0, 0, 70, 12, 0, 80],
  hummus: [2.4, 38, 0, 0, 230, 70, 0, 0], baba: [0.8, 30, 2, 0, 250, 20, 0, 0], "fried-eggplant": [0.4, 10, 1, 0, 200, 12, 0, 0],
  "shawarma-sandwich": [1.5, 40, 3, 0, 220, 25, 0.2, 10], "ful-sandwich": [1.8, 35, 1, 0, 220, 50, 0, 0], "taameya-sandwich": [2.5, 45, 3, 0, 330, 60, 0, 5],
  "liver-sandwich": [4, 25, 1, 0.5, 220, 25, 25, 3000], burger: [2.4, 60, 0, 0.1, 220, 20, 1.2, 10], pizza: [2.2, 190, 1.5, 0.2, 170, 23, 0.5, 70],
  egg: [1.8, 56, 0, 2, 138, 12, 0.9, 160], "egg-fried": [1.9, 62, 0, 2.2, 150, 13, 0.9, 190], "egg-white": [0.1, 7, 0, 0, 163, 11, 0.1, 0],
  "chicken-breast": [1, 15, 0, 0.1, 256, 29, 0.3, 9], "chicken-thigh": [1.3, 12, 0, 0.1, 220, 22, 0.3, 20], "chicken-raw": [0.4, 5, 0, 0.1, 330, 28, 0.2, 9],
  beef: [2.9, 10, 0, 0.1, 320, 22, 2.6, 0], kofta: [2.5, 20, 1, 0.1, 280, 20, 2, 5], "beef-mince-raw": [2.2, 15, 0, 0.1, 270, 18, 2.1, 0],
  liver: [6.5, 6, 1.9, 1.2, 350, 21, 70, 9400], "tuna-oil": [1.4, 13, 0, 6.7, 210, 31, 2.2, 23], "tuna-water": [1.5, 11, 0, 1.7, 240, 27, 2.5, 17],
  fish: [0.5, 20, 0, 3, 400, 30, 1.5, 15], "fish-fried": [0.8, 25, 0, 2.5, 350, 28, 1.2, 15], "fish-raw": [0.4, 15, 0, 2.5, 350, 25, 1.3, 10],
  salmon: [0.5, 15, 0, 13, 380, 30, 3, 50], shrimp: [0.5, 90, 0, 0.1, 170, 39, 1.5, 0], "lentils-dry": [6.5, 35, 4.5, 0, 680, 47, 0, 2], chickpeas: [2.9, 49, 1.3, 0, 290, 48, 0, 1],
  whey: [1, 450, 0, 0, 600, 150, 1, 0], feta: [0.6, 490, 0, 0.4, 62, 19, 1.7, 125], roumi: [0.7, 800, 0, 0.5, 90, 30, 1.5, 250], cottage: [0.1, 80, 0, 0, 100, 8, 0.6, 30],
  "triangle-cheese": [0.3, 400, 0, 0.3, 150, 20, 0.7, 200], mozzarella: [0.4, 500, 0, 0.4, 75, 20, 2.3, 180], labneh: [0.1, 120, 0, 0.1, 150, 10, 0.4, 100],
  "greek-yogurt": [0.1, 110, 0, 0, 141, 11, 0.75, 4], yogurt: [0.1, 121, 0.5, 0.1, 155, 12, 0.4, 27], milk: [0, 113, 0, 0.1, 132, 10, 0.45, 46], "milk-skim": [0, 122, 0, 0, 156, 11, 0.5, 2],
  "olive-oil": [0.6, 1, 0, 0, 1, 0, 0, 0], butter: [0, 24, 0, 1.5, 24, 2, 0.2, 684], ghee: [0, 4, 0, 1.5, 5, 0, 0, 840], tahini: [9, 420, 0, 0, 410, 95, 0, 3],
  "peanut-butter": [1.9, 43, 0, 0, 650, 170, 0, 0], almonds: [3.7, 270, 0, 0, 730, 270, 0, 0], peanuts: [4.6, 92, 0, 0, 705, 168, 0, 0], walnuts: [2.9, 98, 1.3, 0, 440, 158, 0, 1],
  "mixed-nuts": [2.6, 70, 0, 0, 600, 230, 0, 1], avocado: [0.6, 12, 10, 0, 485, 29, 0, 7], dates: [0.9, 64, 0, 0, 696, 54, 0, 7], apple: [0.1, 6, 4.6, 0, 107, 5, 0, 3],
  banana: [0.3, 5, 8.7, 0, 358, 27, 0, 3], orange: [0.1, 40, 53, 0, 181, 10, 0, 11], mango: [0.2, 11, 36, 0, 168, 10, 0, 54], guava: [0.3, 18, 228, 0, 417, 22, 0, 31],
  grapes: [0.4, 10, 3.2, 0, 191, 7, 0, 3], watermelon: [0.2, 7, 8, 0, 112, 10, 0, 28], strawberries: [0.4, 16, 59, 0, 153, 13, 0, 1], pomegranate: [0.3, 10, 10, 0, 236, 12, 0, 0],
  figs: [0.4, 35, 2, 0, 232, 17, 0, 7], pear: [0.2, 9, 4, 0, 116, 7, 0, 1], peach: [0.3, 6, 6.6, 0, 190, 9, 0, 16], kiwi: [0.3, 34, 93, 0, 312, 17, 0, 4],
  salad: [0.8, 30, 15, 0, 250, 12, 0, 150], tomato: [0.3, 10, 14, 0, 237, 11, 0, 42], cucumber: [0.3, 16, 2.8, 0, 147, 13, 0, 5], lettuce: [0.9, 36, 9, 0, 194, 13, 0, 370],
  carrot: [0.3, 33, 6, 0, 320, 12, 0, 835], onion: [0.2, 23, 7.4, 0, 146, 10, 0, 0], pepper: [0.4, 7, 128, 0, 211, 12, 0, 157], zucchini: [0.4, 16, 18, 0, 261, 18, 0, 10],
  spinach: [2.7, 99, 28, 0, 558, 79, 0, 469], broccoli: [0.7, 47, 89, 0, 316, 21, 0, 31], peas: [1.5, 25, 40, 0, 244, 33, 0, 38], "molokhia-leaves": [4.8, 208, 37, 0, 559, 64, 0, 280],
  garlic: [1.7, 181, 31, 0, 401, 25, 0, 0], "tomato-paste": [3, 36, 22, 0, 1014, 42, 0, 76], lemon: [0.1, 6, 39, 0, 103, 6, 0, 1], honey: [0.4, 6, 0.5, 0, 52, 2, 0, 0],
  "dark-chocolate": [11.9, 73, 0, 0, 715, 228, 0.3, 2], chocolate: [2.4, 189, 0, 0, 372, 63, 0.8, 59], "ice-cream": [0.1, 128, 0.6, 0.2, 199, 14, 0.4, 118],
  "tea-milk": [0, 30, 0, 0, 60, 4, 0.1, 10], latte: [0.1, 110, 0, 0.1, 160, 12, 0.4, 40], cappuccino: [0.1, 90, 0, 0.1, 140, 10, 0.3, 30],
  "orange-juice": [0.2, 11, 50, 0, 200, 11, 0, 10], sugarcane: [0.4, 10, 1, 0, 120, 8, 0, 0], karkadeh: [0.5, 8, 2, 0, 20, 2, 0, 1],
};
export const hasMicro = (id) => !!T[id];

/** One logged item → its micronutrients ({ fe, ca, … } for its grams), or null when unknown. Products may carry `micro` per 100 g. */
export function itemMicro(x) {
  const row = T[x && x.id] || (x && x.micro ? NUTRIENTS.map(([k]) => +x.micro[k] || 0) : null);
  if (!row || !(x.grams > 0)) return null;
  const out = {}; NUTRIENTS.forEach(([k], i) => { out[k] = row[i] * x.grams / 100; });
  return out;
}

/** A day's vitamins & minerals: totals, % of the daily reference, how many foods were counted. sex: "m" | "f". */
export function dayMicros(day, sex = "m") {
  const items = Object.values((day && day.meals) || {}).flat().filter((x) => x && x.kcal != null);
  const tot = Object.fromEntries(NUTRIENTS.map(([k]) => [k, 0])); let known = 0;
  for (const x of items) { const m = itemMicro(x); if (!m) continue; known++; for (const k in m) tot[k] += m[k]; }
  const rows = NUTRIENTS.map(([k, en, ar, unit, rm, rf]) => { const ref = sex === "f" ? rf : rm, v = tot[k]; return { k, en, ar, unit, v: v >= 10 ? Math.round(v) : Math.round(v * 10) / 10, ref, pct: Math.round(v / ref * 100) }; });
  return { rows, known, total: items.length, low: rows.filter((r) => r.pct < 50).map((r) => r.k) };
}

/** Foods (from the table) richest in a nutrient per 100 g — "eat more of these" for the low ones. */
export function bestSources(k, n = 4) {
  const i = NUTRIENTS.findIndex((x) => x[0] === k); if (i < 0) return [];
  const skip = new Set(["liver", "liver-sandwich", "whey", "tomato-paste", "cornflakes", "molokhia-leaves", "lentils-dry", "rice-dry", "pasta-dry"]);
  return Object.entries(T).filter(([id]) => !skip.has(id)).sort((a, b) => b[1][i] - a[1][i]).slice(0, n).map(([id]) => id);
}
