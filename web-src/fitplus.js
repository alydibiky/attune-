/* ---- Fit & Food, level 2 (v6.2): "better than Yazio by levels" --------------------------------
   Everything here is code (no model): faster logging (recent / frequent foods, copy a meal, my
   meals, custom foods), food quality (sugar, saturated fat, salt, Nutri-Score, NOVA), Ramadan mode
   (real Fajr / Maghrib times — Egyptian General Authority angles), body fat from measurements
   (US Navy), a 7-day plan with one shopping list, a day score and a weekly report.           */
import { MEALS, RECIPES, food, recipeNutrients, mealPlan, dayTotals, today, sumN } from "./fit.js";

const r1 = (v) => Math.round(v * 10) / 10;

// ---- 1. faster logging ----
/** Foods logged in the last `n` days → [{ key, item, count, last }], most used first (then most recent). */
export function frequentFoods(days, { n = 30, limit = 12, from = new Date() } = {}) {
  const m = new Map();
  for (let i = 0; i < n; i++) {
    const d = new Date(from); d.setDate(d.getDate() - i);
    const day = days[today(d)]; if (!day || !day.meals) continue;
    for (const slot of Object.keys(day.meals)) for (const x of day.meals[slot] || []) {
      const key = x.id || String(x.name || "").toLowerCase(); if (!key) continue;
      const e = m.get(key) || { key, item: x, count: 0, last: 0 };
      e.count++; if ((x.t || 0) >= e.last) { e.last = x.t || 0; e.item = x; }
      m.set(key, e);
    }
  }
  return [...m.values()].sort((a, b) => b.count - a.count || b.last - a.last).slice(0, limit);
}
/** The same meal from another day (fresh copies, new times). */
export function copyMeal(days, fromDay, slot) {
  const src = ((days[fromDay] || {}).meals || {})[slot] || [];
  return src.map(({ t, ...x }) => ({ ...x }));
}
/** A saved combination ("my breakfast") → { id, name, items, kcal }. */
export function myMeal(name, items) {
  const clean = items.map(({ t, ...x }) => x);
  return { id: "mm" + Date.now().toString(36), name: String(name || "My meal").slice(0, 40), items: clean, kcal: sumN(clean.filter((x) => x.kcal != null)).kcal };
}
/**
 * A food the person enters from a label: values per 100 g, or per serving (then serving grams needed).
 * → a food like the table's, or { error }.
 */
export function customFood({ name, per = "100g", serving = null, kcal, p = 0, c = 0, f = 0, fib = 0, sug = null, sat = null, salt = null }) {
  const n = String(name || "").trim(); if (!n) return { error: "name" };
  const nums = [kcal, p, c, f].map(Number);
  if (!(nums[0] >= 0) || nums.some((x) => !isFinite(x) || x < 0)) return { error: "numbers" };
  const k = per === "serving" ? (Number(serving) > 0 ? 100 / Number(serving) : null) : 1;
  if (k == null) return { error: "serving" };
  const sc = (v) => (v == null || v === "" ? null : r1(Number(v) * k));
  return { id: "my:" + Date.now().toString(36), src: "my", en: n, ar: n, names: [n], kcal: Math.round(nums[0] * k), p: r1(nums[1] * k), c: r1(nums[2] * k), f: r1(nums[3] * k), fib: sc(fib) || 0,
    sug: sc(sug), sat: sc(sat), salt: sc(salt), portions: Number(serving) > 0 ? { serving: Math.round(Number(serving)) } : {}, group: "mine" };
}

// ---- 2. food quality ----
/** Daily limits: free sugars ≤ 10 % of energy (WHO), saturated fat < 10 % of energy, salt ≤ 5 g (WHO). */
export function limits(tg) {
  const kcal = (tg && tg.kcal) || 2000;
  return { sug: Math.round(kcal * 0.1 / 4), sat: Math.round(kcal * 0.1 / 9), salt: 5 };
}
/** Sugar, saturated fat and salt of a day — only from foods whose labels give them (`known` counts them). */
export function qualityTotals(day) {
  const items = MEALS.concat(["suhoor", "iftar"]).flatMap((m) => ((day && day.meals && day.meals[m]) || []));
  const out = { sug: 0, sat: 0, salt: 0, known: 0, total: items.length };
  for (const x of items) {
    if (x.sug == null && x.sat == null && x.salt == null) continue;
    out.known++; out.sug += x.sug || 0; out.sat += x.sat || 0; out.salt += x.salt || 0;
  }
  return { ...out, sug: r1(out.sug), sat: r1(out.sat), salt: r1(out.salt) };
}
/** Scale a food's quality values to grams (for a logged item). */
export function qualityOf(fd, grams) {
  const k = grams / 100, q = {};
  for (const key of ["sug", "sat", "salt"]) if (fd && fd[key] != null) q[key] = r1(fd[key] * k);
  return q;
}
export const NOVA = { 1: { en: "Unprocessed", ar: "طبيعي" }, 2: { en: "Kitchen ingredient", ar: "مكوّن مطبخ" }, 3: { en: "Processed", ar: "مصنّع" }, 4: { en: "Ultra-processed", ar: "مصنّع جدًا" } };

// ---- 3. Ramadan mode: Fajr and Maghrib by the sun's position ----
const rad = (d) => (d * Math.PI) / 180, deg = (r) => (r * 180) / Math.PI;
/** The sun's declination and the equation of time for a date (NOAA's approximation, good to ~1 min). */
function sun(date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const n = Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start) / 864e5);
  const g = (2 * Math.PI / 365) * (n - 1 + 0.5);
  const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  return { eqt, decl };
}
/** Minutes after local midnight when the sun is `angle` degrees below the horizon (morning or evening). */
function timeAt(date, lat, lon, tzMin, angle, evening) {
  const { eqt, decl } = sun(date);
  const noon = 720 - 4 * lon - eqt + tzMin;
  const cosH = (Math.sin(rad(-angle)) - Math.sin(rad(lat)) * Math.sin(decl)) / (Math.cos(rad(lat)) * Math.cos(decl));
  if (cosH < -1 || cosH > 1) return null;
  const H = deg(Math.acos(cosH)) * 4;
  return noon + (evening ? H : -H);
}
export const CITIES = {
  cairo: { en: "Cairo", ar: "القاهرة", lat: 30.0444, lon: 31.2357, tz: "Africa/Cairo" }, alex: { en: "Alexandria", ar: "الإسكندرية", lat: 31.2001, lon: 29.9187, tz: "Africa/Cairo" },
  giza: { en: "Giza", ar: "الجيزة", lat: 30.0131, lon: 31.2089, tz: "Africa/Cairo" }, mansoura: { en: "Mansoura", ar: "المنصورة", lat: 31.0409, lon: 31.3785, tz: "Africa/Cairo" },
  tanta: { en: "Tanta", ar: "طنطا", lat: 30.7865, lon: 31.0004, tz: "Africa/Cairo" }, assiut: { en: "Assiut", ar: "أسيوط", lat: 27.1809, lon: 31.1837, tz: "Africa/Cairo" },
  luxor: { en: "Luxor", ar: "الأقصر", lat: 25.6872, lon: 32.6396, tz: "Africa/Cairo" }, aswan: { en: "Aswan", ar: "أسوان", lat: 24.0889, lon: 32.8998, tz: "Africa/Cairo" },
  hurghada: { en: "Hurghada", ar: "الغردقة", lat: 27.2579, lon: 33.8116, tz: "Africa/Cairo" }, sharm: { en: "Sharm El Sheikh", ar: "شرم الشيخ", lat: 27.9158, lon: 34.33, tz: "Africa/Cairo" },
  riyadh: { en: "Riyadh", ar: "الرياض", lat: 24.7136, lon: 46.6753, tz: "Asia/Riyadh" }, jeddah: { en: "Jeddah", ar: "جدة", lat: 21.4858, lon: 39.1925, tz: "Asia/Riyadh" },
  dubai: { en: "Dubai", ar: "دبي", lat: 25.2048, lon: 55.2708, tz: "Asia/Dubai" }, kuwait: { en: "Kuwait", ar: "الكويت", lat: 29.3759, lon: 47.9774, tz: "Asia/Kuwait" },
  doha: { en: "Doha", ar: "الدوحة", lat: 25.2854, lon: 51.531, tz: "Asia/Qatar" }, istanbul: { en: "Istanbul", ar: "إسطنبول", lat: 41.0082, lon: 28.9784, tz: "Europe/Istanbul" },
};
/** The city's own offset from UTC in minutes on that date (summer time included), from the phone's time-zone database. */
export function zoneOffset(date, zone) {
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(date).filter((x) => x.type !== "literal").map((x) => [x.type, +x.value]));
    const asUTC = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute);
    return Math.round((asUTC - Math.floor(date.getTime() / 60000) * 60000) / 60000);
  } catch (e) { return -date.getTimezoneOffset(); }
}
/** Minutes since midnight now, in the city's own time. */
export function cityNowMin(zone, now = new Date()) { const off = zoneOffset(now, zone); const t = (Math.floor(now.getTime() / 60000) + off) % 1440; return (t + 1440) % 1440; }
/**
 * Fajr (sun 19.5° below, Egyptian General Authority of Survey) and Maghrib (sunset, 0.833° below).
 * tzMin = the local offset from UTC in minutes (e.g. Cairo summer +180). → { fajr, maghrib } as "HH:MM", plus minutes.
 */
export function fastTimes(date, lat, lon, tzMin, { fajrAngle = 19.5 } = {}) {
  const f = timeAt(date, lat, lon, tzMin, fajrAngle, false), m = timeAt(date, lat, lon, tzMin, 0.833, true);
  const hm = (x) => (x == null ? null : String(Math.floor(((x % 1440) + 1440) % 1440 / 60)).padStart(2, "0") + ":" + String(Math.round(((x % 1440) + 1440) % 1440 % 60) % 60).padStart(2, "0"));
  const mf = f == null ? null : Math.round(f), mm = m == null ? null : Math.round(m);
  return { fajr: hm(mf), maghrib: hm(mm), fajrMin: mf, maghribMin: mm, hours: mf != null && mm != null ? r1((mm - mf) / 60) : null };
}
/** Ramadan's calories: Iftar 45 %, a light meal after Taraweeh 20 %, Suhoor 35 %; water spread over the night. */
export function ramadanPlan(tg, times) {
  const kcal = tg.kcal, glasses = Math.ceil(tg.water / 250);
  const nightMin = times && times.fajrMin != null && times.maghribMin != null ? 1440 - (times.maghribMin - times.fajrMin) : 600;
  return { iftar: Math.round(kcal * 0.45), snack: Math.round(kcal * 0.2), suhoor: Math.round(kcal * 0.35), glasses,
    everyMin: Math.max(20, Math.floor(nightMin / Math.max(1, glasses))), tips: [
      { en: "Break the fast with water and 2–3 dates, then pray before the main meal — the stomach settles.", ar: "افطر على مية و٢–٣ تمرات، وصلّي قبل الأكل الرئيسي — المعدة بتهدى." },
      { en: "Suhoor: slow food (ful, eggs, oats, yogurt) and water; little salt and sugar so you're less thirsty.", ar: "السحور: أكل بطيء الهضم (فول، بيض، شوفان، زبادي) ومية؛ ملح وسكر قليل عشان متعطشش." },
      { en: "Keep fried food and konafa/qatayef for once or twice a week.", ar: "المقليات والكنافة والقطايف مرة أو مرتين في الأسبوع." },
    ] };
}

// ---- 4. body fat from a tape measure (US Navy method) ----
/** cm: waist (at the navel for men, narrowest for women), neck, hip (women), height. → % or null */
export function bodyFat({ sex, height, waist, neck, hip }) {
  const h = +height, w = +waist, n = +neck, hp = +hip;
  if (!(h > 100 && w > 40 && n > 20)) return null;
  let bf;
  if (sex === "f") { if (!(hp > 50) || w + hp - n <= 0) return null; bf = 495 / (1.29579 - 0.35004 * Math.log10(w + hp - n) + 0.221 * Math.log10(h)) - 450; }
  else { if (w - n <= 0) return null; bf = 495 / (1.0324 - 0.19077 * Math.log10(w - n) + 0.15456 * Math.log10(h)) - 450; }
  return bf > 2 && bf < 70 ? r1(bf) : null;
}
export function bodyFatClass(bf, sex) {
  const t = sex === "f" ? [14, 21, 25, 32] : [6, 14, 18, 25];
  const k = bf < t[0] ? 0 : bf < t[1] ? 1 : bf < t[2] ? 2 : bf < t[3] ? 3 : 4;
  return [{ en: "Essential", ar: "أساسي" }, { en: "Athletic", ar: "رياضي" }, { en: "Fit", ar: "لايق" }, { en: "Average", ar: "متوسط" }, { en: "High", ar: "عالي" }][k];
}

// ---- 5. a week of meals and one shopping list ----
export function weekPlan(tg, { diet = "balanced", from = new Date() } = {}) {
  const out = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(from); d.setDate(d.getDate() + i);
    out.push({ day: today(d), plan: mealPlan(tg, { diet, seed: Math.floor(d.getTime() / 864e5) }) });
  }
  return out;
}
const GROUP_NAMES = { veg: ["Vegetables", "خضار"], fruit: ["Fruit", "فاكهة"], meat: ["Meat & fish", "لحوم وأسماك"], dairy: ["Dairy & eggs", "ألبان وبيض"], grain: ["Bread, rice & grains", "عيش ورز وحبوب"],
  legume: ["Beans & lentils", "بقوليات"], fat: ["Oils & nuts", "زيوت ومكسرات"], other: ["Other", "حاجات تانية"] };
function groupOf(fd) {
  const g = String((fd && fd.group) || "").toLowerCase();
  if (/veg|salad|herb/.test(g)) return "veg"; if (/fruit/.test(g)) return "fruit"; if (/meat|chicken|fish|seafood|protein/.test(g)) return "meat";
  if (/dairy|egg|milk|cheese/.test(g)) return "dairy"; if (/grain|bread|rice|pasta|cereal|bak/.test(g)) return "grain"; if (/legume|bean|lentil/.test(g)) return "legume";
  if (/fat|oil|nut|seed/.test(g)) return "fat"; return "other";
}
/** All the ingredients of a week's plan, summed (grams, rounded up to 50 g), by shop section. */
export function shoppingList(week) {
  const need = new Map();
  for (const { plan } of week) for (const slot of Object.keys((plan && plan.meals) || {})) {
    const { recipe, x } = plan.meals[slot];
    for (const [id, g] of recipe.items) need.set(id, (need.get(id) || 0) + (g / (recipe.serves || 1)) * x);
  }
  const groups = {};
  for (const [id, g] of need) { const fd = food(id); const k = groupOf(fd); (groups[k] = groups[k] || []).push({ id, en: fd ? fd.en : id, ar: fd ? fd.ar : id, grams: Math.ceil(g / 50) * 50 }); }
  return Object.keys(GROUP_NAMES).filter((k) => groups[k]).map((k) => ({ key: k, en: GROUP_NAMES[k][0], ar: GROUP_NAMES[k][1], items: groups[k].sort((a, b) => b.grams - a.grams) }));
}
export function shoppingText(list, lang = "en") {
  const ar = lang === "ar";
  return (ar ? "🛒 قايمة المشتريات للأسبوع" : "🛒 Shopping list for the week") + "\n" + list.map((g) => `\n${ar ? g.ar : g.en}:\n` + g.items.map((x) => `• ${ar ? x.ar : x.en} — ${x.grams >= 1000 ? (x.grams / 1000).toFixed(1) + (ar ? " كجم" : " kg") : x.grams + (ar ? " جم" : " g")}`).join("\n")).join("\n");
}

// ---- 6. the day's score and the week's report ----
/** 0–100 from five parts (20 each): calories near the goal, protein, fibre, water, sugar & salt within limits. */
export function dayScore(day, tg) {
  const t = dayTotals(day), q = qualityTotals(day), L = limits(tg);
  if (!t.kcal) return null;
  const near = (v, goal, tol) => Math.max(0, 1 - Math.max(0, Math.abs(v - goal) - goal * tol) / (goal * 0.4));
  const parts = {
    kcal: near(t.kcal - t.burned, tg.kcal, 0.08), protein: Math.min(1, t.p / (tg.protein * 0.9)), fibre: Math.min(1, t.fib / (tg.fibre * 0.8)),
    water: Math.min(1, t.water / (tg.water * 0.8)),
    limits: q.known ? Math.max(0, 1 - (Math.max(0, q.sug - L.sug) / L.sug + Math.max(0, q.salt - L.salt) / L.salt) / 2) : 0.75,
  };
  return { score: Math.round(Object.values(parts).reduce((a, x) => a + x, 0) * 20), parts };
}
/** The last 7 days by code → { logged, avg, onTarget, proteinDays, best, score, lines: [{en, ar}] } */
export function weekReport(days, weights, tg, from = new Date()) {
  const rows = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(from); d.setDate(d.getDate() - i); const k = today(d); const day = days[k]; const t = dayTotals(day); rows.push({ day: k, t, s: day ? dayScore(day, tg) : null }); }
  const logged = rows.filter((r) => r.t.kcal > 0);
  if (!logged.length) return { logged: 0, lines: [] };
  const avg = Math.round(logged.reduce((a, r) => a + r.t.kcal, 0) / logged.length);
  const onTarget = logged.filter((r) => Math.abs(r.t.kcal - r.t.burned - tg.kcal) <= tg.kcal * 0.1).length;
  const proteinDays = logged.filter((r) => r.t.p >= tg.protein * 0.9).length;
  const scored = logged.filter((r) => r.s);
  const best = scored.sort((a, b) => b.s.score - a.s.score)[0];
  const score = scored.length ? Math.round(scored.reduce((a, r) => a + r.s.score, 0) / scored.length) : null;
  const w = (weights || []).filter((x) => x.d >= rows[0].day).sort((a, b) => (a.d < b.d ? -1 : 1));
  const change = w.length >= 2 ? r1(w[w.length - 1].kg - w[0].kg) : null;
  const lines = [];
  lines.push({ en: `You logged ${logged.length} of 7 days; average ${avg} kcal (goal ${tg.kcal}).`, ar: `سجّلت ${logged.length} من ٧ أيام؛ المتوسط ${avg} سعر (الهدف ${tg.kcal}).` });
  lines.push({ en: `On target ${onTarget} day(s); protein reached on ${proteinDays}.`, ar: `في الهدف ${onTarget} يوم؛ البروتين اتحقق ${proteinDays} يوم.` });
  if (change != null) lines.push({ en: `Weight ${change > 0 ? "+" : ""}${change} kg this week${tg.goal === "lose" ? (change < 0 ? " — right direction." : " — look at the days over target.") : "."}`, ar: `الوزن ${change > 0 ? "+" : ""}${change} كجم الأسبوع ده${tg.goal === "lose" ? (change < 0 ? " — ماشي صح." : " — بص على الأيام اللي عديت فيها الهدف.") : "."}` });
  if (proteinDays < logged.length / 2) lines.push({ en: "Next week: protein at every meal (eggs, chicken, fish, Greek yogurt, lentils).", ar: "الأسبوع الجاي: بروتين في كل وجبة (بيض، فراخ، سمك، زبادي يوناني، عدس)." });
  if (logged.length < 5) lines.push({ en: "Log at least 5 days — a week's picture needs them.", ar: "سجّل ٥ أيام على الأقل — صورة الأسبوع محتاجاهم." });
  return { logged: logged.length, avg, onTarget, proteinDays, best: best ? best.day : null, score, change, lines };
}

// ---- 7. reminders ----
export const REMINDERS = [
  { id: "fit-breakfast", time: "09:00", en: "Log your breakfast", ar: "سجّل فطارك" },
  { id: "fit-lunch", time: "14:30", en: "Log your lunch", ar: "سجّل غداك" },
  { id: "fit-dinner", time: "20:30", en: "Log your dinner", ar: "سجّل عشاك" },
  { id: "fit-water", time: "every2h", en: "Drink a glass of water", ar: "اشرب كوباية مية" },
];

export { RECIPES, recipeNutrients };

// ---- v6.4 favorites: foods you star, kept with the portion you starred them at ----
export const isFav = (favs, id) => !!id && (favs || []).some((f) => f.id === id);
/** Star or un-star a food. The item is kept as it is now (its grams are your usual portion); newest first, 40 at most. */
export function toggleFav(favs, item) {
  const list = favs || [];
  if (!item || !item.id) return list;
  if (isFav(list, item.id)) return list.filter((f) => f.id !== item.id);
  const { t, k, chosen, learned, alts, said, from, explicit, base, readBase, conf, box, zoomed, flag, was, ...keep } = item;
  return [{ id: item.id, item: { ...keep }, at: Date.now() }, ...list].slice(0, 40);
}

// ---- v6.5 two sources for the same day (Health Connect and Huawei Health): the same steps may reach
// both (Health Sync copies Huawei into Health Connect), so each number is the larger one — never the sum ----
export function mergeWatch(a, b) {
  if (!a) return b || null; if (!b) return a;
  const mx = (k) => { const x = a[k], y = b[k]; return x == null ? (y ?? null) : y == null ? x : Math.max(x, y); };
  const out = { ...a, ...b };
  for (const k of ["steps", "activeKcal", "totalKcal", "distanceM", "hrMax"]) out[k] = mx(k);
  out.hrAvg = a.hrAvg ?? b.hrAvg ?? null;
  out.sources = [...new Set([...(a.sources || []), ...(b.sources || [])])];
  out.workouts = (a.workouts || []).length >= (b.workouts || []).length ? a.workouts || [] : b.workouts || [];
  return out;
}
const hasData = (d) => !!d && (d.steps != null || d.activeKcal != null || (d.workouts || []).length > 0);
export { hasData as watchHasData };
