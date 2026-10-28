/* ---- persona 9 (Ali picked H-E): the month in review ------------------------------------------------------------------------
   On the 1st (and the two days after), Home shows last month in one card, worked out by code from what is on the phone:
   "October: spent 15,350 · earned 32,000 · 52 % kept · food the most (26 %) · Sara still owes you 9,369 · 22 days of meals".
   Pure: stores in, numbers out — the card and the notification only print them.                                               */
import { progressOf } from "./life.js";

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const MONTHS = { en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  ar: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"] };

/** Last month (or the month before `now`): { month, from, to, spent, earned, keptPct, top: {cat, pct}, owedToYou: [{who, left}],
    youOwe, mealDays, kg: {from, to} } — or null when nothing was written that month. */
export function monthReview({ ledger, life, fit } = {}, now = Date.now()) {
  const n = new Date(now), first = new Date(n.getFullYear(), n.getMonth() - 1, 1, 12), last = new Date(n.getFullYear(), n.getMonth(), 0, 12);
  const from = iso(first), to = iso(last), inM = (d) => d >= from && d <= to;
  const tx = ((ledger && ledger.txns) || []).filter((t) => inM(t.date || ""));
  const spent = tx.filter((t) => t.type === "expense").reduce((a, t) => a + (+t.amount || 0), 0);
  const earned = tx.filter((t) => t.type === "income").reduce((a, t) => a + (+t.amount || 0), 0);
  const byCat = {}; for (const t of tx) if (t.type === "expense") byCat[t.cat || "other"] = (byCat[t.cat || "other"] || 0) + (+t.amount || 0);
  const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
  const people = new Map(); let youOwe = 0;
  for (const c of (life && life.items) || []) {
    if (!["debt", "installment"].includes(c.kind) || !c.person) continue;
    const left = progressOf(c, now).left || 0; if (!(left > 0)) continue;
    if (c.dir === "in") { const k = String(c.person).toLowerCase(); people.set(k, { who: c.person, left: (people.has(k) ? people.get(k).left : 0) + left }); } else youOwe += left;
  }
  const days = (fit && fit.days) || {};
  const mealDays = Object.entries(days).filter(([d, v]) => inM(d) && v && Object.values(v.meals || {}).some((m) => (m || []).length)).length;
  const w = ((fit && fit.weights) || []).filter((x) => inM(x.d || "")).sort((a, b) => a.d.localeCompare(b.d));
  if (!tx.length && !mealDays && !w.length) return null;
  return { month: first.getMonth(), year: first.getFullYear(), from, to, spent: Math.round(spent), earned: Math.round(earned),
    keptPct: earned > 0 ? Math.round(((earned - spent) / earned) * 100) : null, top: topCat ? { cat: topCat[0], pct: Math.round((topCat[1] / (spent || 1)) * 100) } : null,
    owedToYou: [...people.values()].sort((a, b) => b.left - a.left).slice(0, 3).map((x) => ({ ...x, left: Math.round(x.left) })), youOwe: Math.round(youOwe),
    mealDays, kg: w.length ? { from: w[0].kg, to: w[w.length - 1].kg } : null };
}

/** The review as short lines for the card / the notification, in English or Egyptian Arabic. */
export function reviewLines(r, lang = "en", cur = "") {
  if (!r) return [];
  const ar = lang === "ar", f = (v) => Math.round(v).toLocaleString("en-US"), m = MONTHS[ar ? "ar" : "en"][r.month];
  const CAT = { food: ["food", "الأكل"], groceries: ["groceries", "البقالة"], transport: ["transport", "المواصلات"], bills: ["bills", "الفواتير"], rent: ["rent", "الإيجار"], shopping: ["shopping", "التسوق"], health: ["health", "الصحة"], fun: ["fun", "الخروج"], coffee: ["coffee", "القهوة"], gifts: ["gifts", "الهدايا"], other: ["other", "حاجات تانية"] };
  const out = [];
  if (r.spent || r.earned) out.push(ar ? `${m}: صرفت ${f(r.spent)} ${cur}${r.earned ? ` · دخلك ${f(r.earned)}` : ""}${r.keptPct != null ? ` · حوّشت ${r.keptPct}%` : ""}` : `${m}: spent ${f(r.spent)} ${cur}${r.earned ? ` · earned ${f(r.earned)}` : ""}${r.keptPct != null ? ` · ${r.keptPct}% kept` : ""}`);
  if (r.top) out.push(ar ? `أكتر حاجة: ${(CAT[r.top.cat] || [r.top.cat, r.top.cat])[1]} (${r.top.pct}%)` : `Most went on ${(CAT[r.top.cat] || [r.top.cat])[0]} (${r.top.pct}%)`);
  for (const p of r.owedToYou) out.push(ar ? `لسه على ${p.who} ليك ${f(p.left)}` : `${p.who} still owes you ${f(p.left)}`);
  if (r.youOwe) out.push(ar ? `لسه عليك ${f(r.youOwe)}` : `You still owe ${f(r.youOwe)}`);
  if (r.mealDays) out.push(ar ? `سجلت أكلك ${r.mealDays} يوم` : `Meals logged on ${r.mealDays} days`);
  if (r.kg && r.kg.from !== r.kg.to) { const d = Math.round((r.kg.to - r.kg.from) * 10) / 10; out.push(ar ? `الوزن: ${r.kg.from} ← ${r.kg.to} كجم (${d > 0 ? "+" : ""}${d})` : `Weight: ${r.kg.from} → ${r.kg.to} kg (${d > 0 ? "+" : ""}${d})`); }
  return out;
}
