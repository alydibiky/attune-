// v6.18 — the amount question (Ali: "I want an accuracy of above 80 percent").
// Measured on 40 real plates: the photo readers name most foods right but misjudge the amount (median calorie error
// 24–45 % whichever model). The amount is what the person knows at a glance, so each photo item that is not exact gets
// ONE question with concrete choices — "how many eggs? 1 2 3 4", "how much of the plate? ¼ ½ ¾ full" — and the answer
// is remembered for that dish (fit.js learnFix, applied to the next photo of it).
import * as F from "./fit.js";

const COUNT_KEYS = ["egg", "piece", "loaf", "slice", "skewer", "date", "disc", "sandwich"];
const DRINK_KEYS = ["glass", "cup", "can", "bottle", "mug"];
const DRINK_AR = { glass: "كوب", cup: "كوب", can: "علبة", bottle: "زجاجة", mug: "كوب" };
// a full 26 cm dinner plate of the food, as served (g) — choices are shares of it
function fullPlate(fd) {
  const id = String(fd.like || fd.id || ""), g = String(fd.group || "");
  if (/salad|lettuce|rocket|spinach|cabbage|fattoush|tabbouleh/.test(id) || g === "veg") return 250;
  if (/fries|chips/.test(id)) return 220;
  if (/rice|koshari|biryani|kabsa|mandi|maqluba|freekeh|bulgur|couscous|mujadara|fatta/.test(id)) return 450;
  if (/pasta|noodles|lasagna|bechamel|negresco|macarona/.test(id)) return 420;
  if (/soup|molokhia|stew|bamia|fasolia|lentil|ful/.test(id)) return 350;
  if (/cake|basbousa|konafa|om-ali|baklava|kahk|pudding/.test(id) || g === "sweets") return 300;
  return 380;
}
const r5 = (g) => Math.max(5, Math.round(g / 5) * 5);

/**
 * The question for one draft item, or null when its amount is already exact (a barcode, a printed label or menu,
 * an amount the person wrote, a quick add) or there is nothing sensible to offer.
 *   { kind: "count" | "plate" | "drink" | "spoon", en, ar, choices: [{ en, ar, grams }], at: index of the choice nearest the item now }
 */
export function amountQuestion(x) {
  if (!x || x.quick || x.explicit || x.from === "photo-text" || x.src === "label" || x.src === "off" || x.barcode) return null;
  const fd = (x.id && (F.food(x.id) || (x.like && F.food(x.like)))) || null;
  const P = (fd && fd.portions) || {};
  const name = (x.ar || x.name || ""), nameEn = x.name || "";
  let q = null;
  const per = COUNT_KEYS.map((k) => P[k]).find((v) => v > 0);
  const drink = Object.keys(P).find((k) => DRINK_KEYS.includes(k) && P[k] > 0);   // the food's own first container (cola: a can)
  if (drink && fd && fd.group === "drinks") {
    const ml = P[drink];
    q = { kind: "drink", en: `How much ${nameEn}?`, ar: `كم من ${name}؟`,
      choices: [0.5, 1, 2, 3].map((n) => ({ en: (n === 0.5 ? "½ " : n + " ") + drink + (n > 1 ? "s" : ""), ar: (n === 0.5 ? "نصف " : n + " ") + (DRINK_AR[drink] || drink), grams: r5(n * ml), n })) };
  } else if (per && !(P.plate || P.bowl) && per < 400) {
    const ns = per <= 30 ? [1, 2, 3, 4, 5, 6, 8, 10] : per <= 150 ? [1, 2, 3, 4, 5, 6] : [0.5, 1, 2, 3];
    const choices = ns.map((n) => ({ en: n === 0.5 ? "½" : String(n), ar: n === 0.5 ? "½" : String(n), grams: Math.max(1, Math.round(n * per)), n }));
    q = { kind: "count", en: `How many? (${nameEn})`, ar: `كم عددها؟ (${name})`, choices };
  } else if ((P.tbsp || P.spoon) && !(P.plate || P.bowl || P.piece)) {
    const sp = P.tbsp || P.spoon;
    q = { kind: "spoon", en: `How many spoons? (${nameEn})`, ar: `كم ملعقة؟ (${name})`,
      choices: [1, 2, 3, 4].map((n) => ({ en: String(n), ar: String(n), grams: r5(n * sp), n })) };
  } else if (fd) {
    const full = fullPlate(fd);
    q = { kind: "plate", en: `How much of the plate? (${nameEn})`, ar: `كم من الطبق؟ (${name})`,
      choices: [[0.25, "¼ plate", "ربع طبق"], [0.5, "½ plate", "نصف طبق"], [0.75, "¾ plate", "ثلاثة أرباع"], [1, "full plate", "طبق كامل"], [1.4, "heaped", "طبق ممتلئ جدًا"]]
        .map(([s, en, ar]) => ({ en, ar, grams: r5(s * full) })) };
  }
  if (!q || !q.choices.length) return null;
  let at = 0;
  q.choices.forEach((c, i) => { if (Math.abs(Math.log(c.grams / (x.grams || 1))) < Math.abs(Math.log(q.choices[at].grams / (x.grams || 1)))) at = i; });
  return { ...q, at };
}

/** Which items to ask about first: the not-sure ones, the biggest calories first — at most `max` (the rest keep their chips). */
export function askFirst(items, max = 3) {
  return (items || []).map((x, i) => ({ x, i, q: amountQuestion(x) }))
    .filter((o) => o.q && !o.x.answered && !(o.x.learned && o.x.learnedN >= 2) && (o.x.fast || o.x.conf == null || o.x.conf < 0.8 || o.x.estimate || o.x.flag))
    .sort((a, b) => (b.x.kcal || 0) - (a.x.kcal || 0)).slice(0, max).map((o) => o.i);
}

/** The person's answer → the item with those grams (the nutrients scale with them); `answered` marks it done. */
export function answerAmount(x, grams) {
  const g = Math.max(1, Math.round(+grams || 0));
  if (x.kcal == null || !x.grams) return { ...x, grams: g, answered: true };
  const s = g / x.grams, q = {};
  for (const k of ["sug", "sat", "salt"]) if (x[k] != null) q[k] = Math.round(x[k] * s * 10) / 10;
  return { ...x, ...q, grams: g, answered: true, k: x.base ? Math.round(g / x.base * 100) / 100 : 1,
    kcal: Math.round(x.kcal * s), p: Math.round(x.p * s * 10) / 10, c: Math.round(x.c * s * 10) / 10, f: Math.round(x.f * s * 10) / 10, fib: Math.round((x.fib || 0) * s * 10) / 10 };
}
