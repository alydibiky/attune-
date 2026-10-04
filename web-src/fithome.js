/* ---- Fit & Food home, "Log bar" (v6.10, item 14) ---------------------------------------------------------------------
   Pure logic for the new home: the one-tap chips (meals the person eats again, at their usual portion), the
   week mini-chart, the timeline of today's meals, the 3-question first visit, and targets from a plain calorie goal.
   No data is changed or moved: the stored log, plan and favourites keep their exact shape
   (tests/unit/fithome.test.mjs proves old → new equality). */
import * as F from "./fit.js";
import { dishesOf } from "./fit-cuisines.js";

const strip = ({ t, k, ...x }) => x;
const median = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
/** An item scaled to `grams` (calories and nutrients follow); items without calories just take the grams. */
export function atGrams(x, grams) {
  const g = Math.max(1, Math.round(+grams || 0));
  if (x.kcal == null || !x.grams) return { ...x, grams: g };
  const s = g / x.grams, r1 = (v) => Math.round(v * s * 10) / 10, q = {};
  for (const key of ["sug", "sat", "salt"]) if (x[key] != null) q[key] = r1(x[key]);
  return { ...x, ...q, grams: g, kcal: Math.round(x.kcal * s), p: r1(x.p || 0), c: r1(x.c || 0), f: r1(x.f || 0), fib: r1(x.fib || 0) };
}

/**
 * Meals eaten again → one-tap chips: [{ key, item (at the usual portion), count, last, meal }].
 * Usual portion = the median grams of the last 30 days. A food counts when eaten at least `min` times,
 * then the most recent foods fill the row up to `limit`. The chip's meal is the slot it is eaten in most.
 */
export function frequentChips(days, { n = 30, limit = 8, min = 2, from = new Date() } = {}) {
  const m = new Map();
  for (let i = 0; i < n; i++) {
    const d = new Date(from); d.setDate(d.getDate() - i);
    const day = days && days[F.today(d)]; if (!day || !day.meals) continue;
    for (const slot of Object.keys(day.meals)) for (const x of day.meals[slot] || []) {
      const key = x.id || x.recipe || String(x.name || "").trim().toLowerCase(); if (!key || !(x.grams > 0)) continue;
      const e = m.get(key) || { key, item: x, count: 0, last: -1, grams: [], slots: {} };
      e.count++; e.grams.push(+x.grams); e.slots[slot] = (e.slots[slot] || 0) + 1;
      if ((x.t || 0) >= e.last) { e.last = x.t || 0; e.item = x; }
      m.set(key, e);
    }
  }
  const all = [...m.values()].map((e) => ({ key: e.key, count: e.count, last: e.last, meal: Object.entries(e.slots).sort((a, b) => b[1] - a[1])[0][0], item: strip(atGrams(e.item, median(e.grams))) }));
  const often = all.filter((e) => e.count >= min).sort((a, b) => b.count - a.count || b.last - a.last);
  const recent = all.filter((e) => e.count < min).sort((a, b) => b.last - a.last);
  return [...often, ...recent].slice(0, limit);
}

/** Today's meals as one timeline, in the order eaten: [{ meal, i (index in its slot), x }]. */
export function timeline(day) {
  const out = [];
  for (const meal of F.MEALS) ((day && day.meals && day.meals[meal]) || []).forEach((x, i) => out.push({ meal, i, x }));
  return out.sort((a, b) => (a.x.t || 0) - (b.x.t || 0) || F.MEALS.indexOf(a.meal) - F.MEALS.indexOf(b.meal) || a.i - b.i);
}

/** The last 7 days' calories, oldest first: [{ d, kcal }]. */
export function weekKcal(days, from = new Date()) {
  const out = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(from); d.setDate(d.getDate() - i); const k = F.today(d); out.push({ d: k, day: d.getDay(), kcal: F.dayTotals((days || {})[k]).kcal || 0 }); }
  return out;
}

/** Remove one logged item (meal slot, index) → the new day and the removed item (for "Undo"). */
export function removeAt(day, meal, i) {
  const list = ((day.meals || {})[meal] || []);
  return { day: { ...day, meals: { ...day.meals, [meal]: list.filter((_, k) => k !== i) } }, removed: list[i] };
}
/** Put a removed item back where it was. */
export function insertAt(day, meal, i, x) {
  const list = [...((day.meals || {})[meal] || [])]; list.splice(Math.min(i, list.length), 0, x);
  return { ...day, meals: { ...(day.meals || {}), [meal]: list } };
}

/** Targets from a plain daily calorie goal (the "just a number" answer): a balanced split, by code. */
export function targetsFromKcal(kcal, goal = "maintain") {
  kcal = Math.round(+kcal / 10) * 10;
  if (!(kcal >= 800 && kcal <= 6000)) return null;
  const protein = Math.round(kcal * (goal === "maintain" ? 0.2 : 0.25) / 4), fat = Math.round(kcal * 0.3 / 9);
  const carbs = Math.round((kcal - protein * 4 - fat * 9) / 4);
  return { bmr: null, tdee: null, kcal, protein, carbs, fat, fibre: Math.round(kcal / 1000 * 14), water: 2000, bmi: null, goal, notes: [], weeks: null };
}
/** The plan's targets: the full formula when the body numbers are there; a calorie goal overrides the calories. */
export function targetsOf(pr) {
  if (!pr) return null;
  const full = F.targets(pr);
  if (!(+pr.kcalGoal > 0)) return full;
  const own = targetsFromKcal(pr.kcalGoal, pr.goal);
  if (!own) return full;
  return full ? { ...full, kcal: own.kcal, carbs: Math.max(0, Math.round((own.kcal - full.protein * 4 - full.fat * 9) / 4)) } : own;
}

/**
 * The first visit's 3 answers → { profile, country } or { error }.
 * a = { goal, mode: "body"|"kcal", sex, age, cm, kg, kcal, country }
 */
export function quickProfile(a) {
  const goal = ["lose", "maintain", "gain"].includes(a.goal) ? a.goal : "maintain";
  const base = { sex: a.sex === "f" ? "f" : "m", age: "", cm: "", kg: "", activity: "light", goal, rate: 0.5, goalKg: "", diet: "balanced" };
  let profile;
  if (a.mode === "kcal") {
    if (!targetsFromKcal(a.kcal, goal)) return { error: "kcal" };
    profile = { ...base, kcalGoal: Math.round(+a.kcal / 10) * 10 };
  } else {
    profile = { ...base, age: +a.age || "", cm: +a.cm || "", kg: +a.kg || "" };
    if (!F.targets(profile)) return { error: "body" };
  }
  return { profile, country: a.country || null };
}

/** Dishes of the chosen country for this time of day (the home's suggestions): [{ id, en, ar, item }]. */
export function countrySuggestions(cc, meal, n = 4, seed = 0) {
  const want = meal === "snacks" ? "snack" : meal;
  const list = dishesOf(cc).filter((d) => d.meals.includes(want) && !d.tags.includes("drink"));
  const out = [];
  for (let i = 0; i < list.length && out.length < n; i++) {
    const d = list[(i + seed) % list.length], ps = d.perServing || {};
    out.push({ id: d.id, en: d.en, ar: d.ar, item: { id: F.dishFoodId(d.id), name: d.en, ar: d.ar, grams: d.serving, kcal: Math.round(ps.kcal || 0), p: ps.p || 0, c: ps.c || 0, f: ps.f || 0, fib: ps.fib || 0 } });
  }
  return out;
}
