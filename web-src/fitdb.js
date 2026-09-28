/* ---- Fit & Food: the big food database (v6.1) ---------------------------------------------
   Ali: "a database bigger than Yazio in everything". Yazio's size comes from packaged products;
   here the built-in table (Egyptian / Arab foods, recipes — offline) is joined by:
     · Open Food Facts — ~3.5 million products with barcodes, Egyptian ones included (free, open data)
     · USDA FoodData Central — the reference values for 380,000+ foods (public domain)
   asked through the phone (NativeBridge.fetchJson: only these two hosts, the Offline lock and the
   Network log apply), and every food found is kept on the phone, so it works offline next time.
   Every number is read from the database and checked by code (energy vs macros); nothing guessed. */
import { FOODS, matchFood } from "./fit.js";

export const CACHE_KEY = "attune:fit:foods:v1";
const MAX_CACHE = 4000;
const r1 = (v) => Math.round(v * 10) / 10;
const num = (x) => { const n = typeof x === "number" ? x : parseFloat(String(x ?? "").replace(",", ".")); return isFinite(n) ? n : null; };
const norm = (s) => String(s || "").toLowerCase().replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
const isArabic = (s) => /[؀-ۿ]/.test(String(s || ""));

// ---- addresses ----
const OFF_FIELDS = "code,product_name,product_name_ar,product_name_en,generic_name,brands,nutriments,serving_size,serving_quantity,quantity,countries_tags,image_small_url";
export function offSearchUrl(q, { egypt = false, size = 24 } = {}) {
  return "https://world.openfoodfacts.org/cgi/search.pl?action=process&json=1&search_simple=1&sort_by=unique_scans_n&page_size=" + size +
    "&search_terms=" + encodeURIComponent(q) + (egypt ? "&tagtype_0=countries&tag_contains_0=contains&tag_0=egypt" : "") + "&fields=" + OFF_FIELDS;
}
export const offProductUrl = (code) => `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(String(code).replace(/\D/g, ""))}.json?fields=${OFF_FIELDS}`;
export const usdaSearchUrl = (q, key = "DEMO_KEY") =>
  `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(key)}&pageSize=15&dataType=${encodeURIComponent("Foundation,SR Legacy,Survey (FNDDS)")}&query=${encodeURIComponent(q)}`;

/** A barcode's check digit (EAN-13 / EAN-8 / UPC-A) is right. */
export function validBarcode(code) {
  const d = String(code || "").replace(/\D/g, "");
  if (![8, 12, 13, 14].includes(d.length)) return false;
  const digits = d.split("").map(Number), check = digits.pop();
  const sum = digits.reverse().reduce((a, x, i) => a + x * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** Energy and macros agree (4/4/9 kcal a gram, fibre ~2)? A product whose label is wrong is flagged, not trusted blindly. */
export function consistent(f) {
  if (!(f.kcal > 0)) return f.kcal === 0 && !(f.p + f.c + f.f > 1);
  const est = f.p * 4 + (f.c - (f.fib || 0)) * 4 + (f.fib || 0) * 2 + f.f * 9;
  return Math.abs(est - f.kcal) <= Math.max(25, f.kcal * 0.3);
}

// ---- Open Food Facts product → a food ----
export function fromOFF(p) {
  if (!p) return null;
  const n = p.nutriments || {};
  let kcal = num(n["energy-kcal_100g"]);
  if (kcal == null && num(n.energy_100g) != null) kcal = num(n.energy_100g) / 4.184;       // kJ → kcal
  const pr = num(n.proteins_100g), c = num(n.carbohydrates_100g), f = num(n.fat_100g), fib = num(n.fiber_100g) || 0;
  if (kcal == null || pr == null || c == null || f == null) return null;                     // incomplete label: not used
  if (kcal < 0 || kcal > 950) return null;
  const en = String(p.product_name_en || p.product_name || p.generic_name || "").trim(), ar = String(p.product_name_ar || "").trim();
  const name = en || ar; if (!name) return null;
  const brand = String(p.brands || "").split(",")[0].trim();
  const sg = num(p.serving_quantity) || (/(\d+(?:[.,]\d+)?)\s*(g|ml)\b/i.exec(String(p.serving_size || "")) || [])[1];
  const food = { id: "off:" + p.code, src: "off", barcode: String(p.code || ""), en: brand && !norm(name).includes(norm(brand)) ? `${name} (${brand})` : name, ar: ar || name, brand,
    names: [name, ar, brand ? `${brand} ${name}` : ""].filter(Boolean), kcal: Math.round(kcal), p: r1(pr), c: r1(c), f: r1(f), fib: r1(fib),
    portions: sg ? { serving: Math.round(num(sg)) } : {}, group: "packaged", egypt: (p.countries_tags || []).includes("en:egypt"), image: p.image_small_url || "" };
  food.check = !consistent(food);
  return food;
}

// ---- USDA food → a food ----
const NID = { kcal: [1008, 2047, 2048], kj: [1062], p: [1003], c: [1005, 1050], f: [1004, 1085], fib: [1079] };
export function fromUSDA(u) {
  if (!u || !Array.isArray(u.foodNutrients)) return null;
  const get = (ids) => { for (const id of ids) { const x = u.foodNutrients.find((n) => (n.nutrientId || (n.nutrient && n.nutrient.id)) === id); if (x) return num(x.value ?? x.amount); } return null; };
  let kcal = get(NID.kcal); if (kcal == null && get(NID.kj) != null) kcal = get(NID.kj) / 4.184;
  const p = get(NID.p), c = get(NID.c), f = get(NID.f);
  if (kcal == null || p == null || c == null || f == null) return null;
  const name = String(u.description || "").replace(/\s+/g, " ").trim(); if (!name) return null;
  const portions = {};
  for (const m of u.foodMeasures || []) { const g = num(m.gramWeight), t = String(m.disseminationText || m.measureUnitName || "").toLowerCase().trim(); if (g > 0 && t && t !== "quantity not specified" && Object.keys(portions).length < 4) portions[t] = Math.round(g); }
  const food = { id: "usda:" + u.fdcId, src: "usda", en: name.charAt(0) + name.slice(1).toLowerCase(), ar: "", names: [name], kcal: Math.round(kcal), p: r1(p), c: r1(c), f: r1(f), fib: r1(get(NID.fib) || 0), portions, group: "reference" };
  food.check = !consistent(food);
  return food;
}

// ---- the phone's copy: every food used or found is kept ----
export function loadCache() { try { const v = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } }
export function keepFoods(list, cache = loadCache()) {
  const now = Date.now();
  for (const f of list) if (f && f.id) cache[f.id] = { ...f, t: now };
  const ids = Object.keys(cache);
  if (ids.length > MAX_CACHE) ids.sort((a, b) => (cache[a].t || 0) - (cache[b].t || 0)).slice(0, ids.length - MAX_CACHE).forEach((k) => delete cache[k]);
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch (e) {}
  return cache;
}
export const cachedFood = (id) => loadCache()[id] || null;
export function byBarcodeCached(code) { const c = String(code).replace(/\D/g, ""); return Object.values(loadCache()).find((f) => f.barcode === c) || null; }

/** Score of a food for a query: all words found, name starts with it, Egyptian product, complete label. */
function score(f, q) {
  const qn = norm(q), words = qn.split(" ").filter(Boolean);
  const list = (f.names || [f.en, f.ar]).map(norm), names = list.join(" | ");
  if (list.includes(qn)) return 30 + (f.src === "table" ? 4 : 0);                 // the exact name first
  const hit = words.filter((w) => names.includes(w)).length;
  if (!hit) return -1;
  return hit / words.length * 10 + (names.startsWith(qn) ? 3 : 0) + (f.egypt ? 2 : 0) + (f.src === "table" ? 4 : f.src === "usda" ? 1 : 0) - (f.check ? 3 : 0);
}
/** Offline search: the built-in table + everything kept on the phone. */
export function searchOffline(q, n = 30) {
  const all = [...FOODS.map((f) => ({ ...f, src: "table" })), ...Object.values(loadCache())];
  return rank(all, q).slice(0, n);
}
function rank(list, q) {
  const seen = new Set();
  return list.map((f) => [f, score(f, q)]).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]).map(([f]) => f)
    .filter((f) => { const k = f.barcode || norm(f.en) + "|" + norm(f.brand); if (seen.has(k)) return false; seen.add(k); return true; });
}

/**
 * The full search: offline first, then Open Food Facts (Egyptian products first, then the world)
 * and USDA (English names; an Arabic query uses the table's English name when it knows the food).
 * fetchJson(url) → parsed JSON (the phone's NativeBridge.fetchJson). → { foods, online: bool, errors }
 */
export async function searchAll(q, fetchJson, { usdaKey = "DEMO_KEY" } = {}) {
  const local = searchOffline(q, 20);
  if (!fetchJson || !String(q || "").trim()) return { foods: local, online: false, errors: [] };
  const known = isArabic(q) ? matchFood(q) : null;
  const enQ = isArabic(q) ? (known ? known.en : "") : q;
  const errors = [];
  const tries = [
    fetchJson(offSearchUrl(q, { egypt: true, size: 20 })).then((j) => (j.products || []).map(fromOFF)).catch((e) => { errors.push(String(e.message || e)); return []; }),
    fetchJson(offSearchUrl(q, { size: 24 })).then((j) => (j.products || []).map(fromOFF)).catch((e) => { errors.push(String(e.message || e)); return []; }),
    enQ ? fetchJson(usdaSearchUrl(enQ, usdaKey)).then((j) => (j.foods || []).map(fromUSDA)).catch((e) => { errors.push(String(e.message || e)); return []; }) : Promise.resolve([]),
  ];
  const got = (await Promise.all(tries)).flat().filter(Boolean);
  keepFoods(got.slice(0, 60));
  return { foods: rank([...local, ...got], enQ && isArabic(q) ? q + " " + enQ : q).slice(0, 50), online: true, errors: errors.length === tries.length ? errors : [] };
}

/** A barcode → the product (kept on the phone), or null when no database knows it. */
export async function byBarcode(code, fetchJson) {
  const c = String(code || "").replace(/\D/g, "");
  if (!c) return null;
  const hit = byBarcodeCached(c); if (hit) return hit;
  if (!fetchJson) return null;
  const j = await fetchJson(offProductUrl(c));
  const f = j && j.product ? fromOFF({ ...j.product, code: j.product.code || c }) : null;
  if (f) keepFoods([f]);
  return f;
}
