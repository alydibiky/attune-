/* ---- v6.14: Fit & Food — everything Yazio has, and more ----------------------------------------------------------------------
   Ali: "everything in Yazio should be in my app, and my app should have features Yazio doesn't". The gaps found by comparing
   with Yazio: quick-add calories, body measurements over time, progress photos, a different calorie goal per weekday,
   more fasting plans with the body's stages, nutrition averages and a diary export. Pure logic; the screens are in fit-ui.jsx.
   Tests: tests/unit/v720fityazio.test.mjs.                                                                                      */

/** Quick add: just the calories (and macros if known), no food chosen — like Yazio's "Quick add". */
export function quickItem({ kcal, p = 0, c = 0, f = 0, name = "" } = {}, ar = false) {
  const k = Math.round(Number(kcal));
  if (!(k > 0 && k < 5000)) return null;
  const n = (x) => Math.max(0, Math.round(Number(x) * 10) / 10 || 0);
  const label = String(name || "").trim().slice(0, 60) || (ar ? "إضافة سريعة" : "Quick add");
  return { name: label, ar: label, quick: true, grams: 0, kcal: k, p: n(p), c: n(c), f: n(f), fib: 0, src: "quick" };
}

/** Fasting: the body's stages by hours fasted (general guidance, as Yazio shows them). */
export const FAST_STAGES = [
  [0, "Digesting — blood sugar rises", "الهضم — يرتفع سكر الدم"],
  [4, "Blood sugar falls back to normal", "يعود سكر الدم إلى طبيعته"],
  [8, "Glycogen stores are being used", "يستهلك الجسم مخزون الجليكوجين"],
  [12, "Fat burning begins", "يبدأ حرق الدهون"],
  [16, "Fat burning is in full swing", "حرق الدهون في أعلى مستوياته"],
  [18, "Ketosis begins", "تبدأ الكيتوزية"],
  [24, "Autophagy (cell clean-up) increases", "تزداد الالتهام الذاتي (تجديد الخلايا)"],
  [36, "Deep ketosis — break the fast gently", "كيتوزية عميقة — أفطر بلطف"],
];
export const MORE_FASTS = { "23:1 (OMAD)": 23, "36 h": 36 };
/** The stage for this many hours, and the next one. */
export function fastStage(hours) {
  let i = 0; for (let k = 0; k < FAST_STAGES.length; k++) if (hours >= FAST_STAGES[k][0]) i = k;
  const next = FAST_STAGES[i + 1] || null;
  return { now: FAST_STAGES[i], next, inH: next ? Math.max(0, Math.round((next[0] - hours) * 10) / 10) : null };
}

/**
 * Calorie goal by weekday ("calorie cycling"). extra: { 4: 400, 5: 400 } = +400 kcal on Thu and Fri (0 = Sunday).
 * Unlike Yazio, the extra is taken evenly from the other days, so the WEEK's total — and the weight plan — stays the same.
 * → the goal for that date.
 */
export function dayGoal(base, dateKey, extra = {}) {
  const days = Object.entries(extra || {}).filter(([, v]) => Number(v)).map(([d, v]) => [Number(d), Number(v)]);
  if (!base || !days.length) return base;
  const wd = new Date(dateKey + "T12:00:00").getDay();
  const total = days.reduce((a, [, v]) => a + v, 0), others = 7 - days.length;
  const hit = days.find(([d]) => d === wd);
  return Math.round(base + (hit ? hit[1] : others ? -total / others : 0));
}

/** Body measurements over time. list: [{ d: "YYYY-MM-DD", waist, hip, chest, arm, thigh, neck }] → the change per part since the first. */
export const PARTS = [["waist", "Waist", "الخصر"], ["hip", "Hips", "الأرداف"], ["chest", "Chest", "الصدر"], ["arm", "Arm", "الذراع"], ["thigh", "Thigh", "الفخذ"], ["neck", "Neck", "الرقبة"]];
export function addMeasure(list, entry) {
  const clean = { d: entry.d };
  for (const [k] of PARTS) { const v = Number(entry[k]); if (v > 10 && v < 300) clean[k] = Math.round(v * 10) / 10; }
  if (Object.keys(clean).length < 2) return list;
  return [...(list || []).filter((x) => x.d !== clean.d), clean].sort((a, b) => (a.d < b.d ? -1 : 1));
}
export function measureChange(list) {
  const out = {};
  for (const [k] of PARTS) {
    const xs = (list || []).filter((x) => x[k] != null);
    if (xs.length) out[k] = { first: xs[0][k], last: xs[xs.length - 1][k], change: Math.round((xs[xs.length - 1][k] - xs[0][k]) * 10) / 10, since: xs[0].d };
  }
  return out;
}

/** Average calories and macros (and the energy split) over the last n logged days. */
export function nutritionAverages(days, n = 7, today = new Date()) {
  const rows = [];
  for (let i = 0; i < 60 && rows.length < n; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    const items = Object.values(((days || {})[k] || {}).meals || {}).flat().filter((x) => x && x.kcal != null);
    if (items.length) rows.push(items.reduce((a, x) => ({ kcal: a.kcal + (+x.kcal || 0), p: a.p + (+x.p || 0), c: a.c + (+x.c || 0), f: a.f + (+x.f || 0), fib: a.fib + (+x.fib || 0) }), { kcal: 0, p: 0, c: 0, f: 0, fib: 0 }));
  }
  if (!rows.length) return null;
  const avg = (k) => Math.round(rows.reduce((a, r) => a + r[k], 0) / rows.length);
  const a = { days: rows.length, kcal: avg("kcal"), p: avg("p"), c: avg("c"), f: avg("f"), fib: avg("fib") };
  const e = a.p * 4 + a.c * 4 + a.f * 9 || 1;
  a.split = { p: Math.round(a.p * 4 / e * 100), c: Math.round(a.c * 4 / e * 100), f: Math.round(a.f * 9 / e * 100) };
  return a;
}

/** The diary as CSV (date, meal, food, grams, kcal, protein, carbs, fat) — open it in Excel. */
export function diaryCSV(days) {
  const q = (s) => /[",\n]/.test(String(s)) ? '"' + String(s).replace(/"/g, '""') + '"' : String(s);
  const lines = ["date,meal,food,grams,kcal,protein_g,carbs_g,fat_g"];
  for (const k of Object.keys(days || {}).sort()) for (const [m, items] of Object.entries(days[k].meals || {}))
    for (const x of items || []) lines.push([k, m, q(x.name || ""), x.grams || "", Math.round(+x.kcal || 0), x.p ?? "", x.c ?? "", x.f ?? ""].join(","));
  return lines.join("\n");
}

/** A progress photo, shrunk so many fit on the phone: a data URL → a smaller JPEG data URL (browser only). */
export function shrinkPhoto(dataUrl, max = 560) {
  return new Promise((ok, bad) => {
    const im = new Image();
    im.onload = () => { const s = Math.min(1, max / Math.max(im.width, im.height)); const c = document.createElement("canvas"); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
      c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL("image/jpeg", 0.7)); };
    im.onerror = () => bad(new Error("photo")); im.src = dataUrl;
  });
}

/* ---- challenges (Yazio has them; these are checked from your own diary, nothing to tick by hand) ---- */
const SWEET_DRINK = /cola|soda|juice|sugarcane|karkadeh|energy|pepsi|عصير|كولا|بيبسي|قصب/i;
const VEG = new Set(["salad", "tomato", "cucumber", "lettuce", "carrot", "onion", "pepper", "zucchini", "spinach", "broccoli", "peas", "molokhia", "molokhia-leaves", "mahshi", "bamia", "fasolia"]);
const items = (day) => Object.values((day && day.meals) || {}).flat().filter(Boolean);
export const CHALLENGES = [
  { id: "water", days: 7, emoji: "💧", en: ["Water week", "Drink 2 L of water every day for 7 days"], ar: ["أسبوع الماء", "اشرب 2 لتر ماء يوميًا لمدة 7 أيام"], ok: (d) => (d.water || 0) >= 2000 },
  { id: "protein", days: 7, emoji: "💪", en: ["Protein week", "Reach your protein target 7 days"], ar: ["أسبوع البروتين", "حقّق هدف البروتين 7 أيام"], ok: (d, tg) => tg && items(d).reduce((a, x) => a + (+x.p || 0), 0) >= tg.protein },
  { id: "nosugar", days: 7, emoji: "🚫🥤", en: ["No sugary drinks", "7 days without soft drinks or juice"], ar: ["بلا مشروبات سكرية", "7 أيام بلا مشروبات غازية أو عصائر"], ok: (d) => items(d).length > 0 && !items(d).some((x) => SWEET_DRINK.test((x.id || "") + " " + (x.name || "") + " " + (x.ar || ""))) },
  { id: "veg", days: 5, emoji: "🥗", en: ["Vegetables every day", "Vegetables at least once a day, 5 days"], ar: ["خضار كل يوم", "خضار مرة على الأقل يوميًا، لمدة 5 أيام"], ok: (d) => items(d).some((x) => VEG.has(x.id)) },
  { id: "logall", days: 14, emoji: "📒", en: ["Log every day", "Log at least 3 meals a day for 14 days"], ar: ["سجّل كل يوم", "سجّل 3 وجبات على الأقل يوميًا لمدة 14 يومًا"], ok: (d) => Object.values((d && d.meals) || {}).filter((m) => (m || []).length).length >= 3 },
  { id: "goal", days: 10, emoji: "🎯", en: ["On target", "Stay within your calorie goal (±10%) for 10 days"], ar: ["في الهدف", "ابقَ ضمن هدف السعرات (±10%) لمدة 10 أيام"], ok: (d, tg) => tg && items(d).length > 0 && Math.abs(items(d).reduce((a, x) => a + (+x.kcal || 0), 0) - tg.kcal) <= tg.kcal * 0.1 },
];
const keyOf = (dt) => dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0");
/** A running challenge { id, start } → { done (days met), days, left (days remaining), state: "on" | "won" | "ended", marks: [true/false/null per day] }. */
export function challengeProgress(ch, days, tg, today = new Date()) {
  const c = CHALLENGES.find((x) => x.id === ch.id); if (!c) return null;
  const t0 = new Date(ch.start + "T12:00:00"), marks = [];
  for (let i = 0; i < c.days; i++) {
    const d = new Date(t0); d.setDate(d.getDate() + i); const k = keyOf(d);
    marks.push(k > keyOf(today) ? null : !!c.ok((days || {})[k] || {}, tg));
  }
  const done = marks.filter((m) => m === true).length, past = marks.filter((m) => m !== null).length;
  const state = done >= c.days ? "won" : past >= c.days ? "ended" : "on";
  return { c, done, days: c.days, left: c.days - past, state, marks };
}
