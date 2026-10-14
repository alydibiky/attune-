/* ---- v6.28 Ask your life — one question, answered from everything Attune keeps for you (Ali: "a feature that helps people,
   automates their lives or does a hard thing no one can do"). A cloud AI doesn't have your money, debts, medicines, lab results,
   meals and deadlines — and you wouldn't give them all to it. Attune has them, on this phone, in separate tools. Here CODE finds the
   right records and does the sums, dates and trends (exact); every answer says where it came from and opens that tool.
   No model is needed; a loaded model may only phrase a question that matched nothing (the page offers Chat).
   askLife(question, stores, { now }) → { kind, en, ar, rows?: [[label, value]], open?: tool id, sources: [tool ids] } | null
   stores = { ledger, life, care, radar, fit, reminders, memory } — the same objects each tool saves (loadStores() reads them).
   Tests: tests/unit/v731lifeask.test.mjs.                                                                                       */
import { myMoneyIntent, catAsked, answerMyMoney, spanOf } from "./myledger.js";
import { progressOf, dueSoon } from "./life.js";
import { trendOf, labTestOf, dosesOn, activeOn, isoDay, mgdl } from "./care.js";

const AR_D = "٠١٢٣٤٥٦٧٨٩";
const fold = (s) => String(s || "").replace(/[٠-٩]/g, (d) => AR_D.indexOf(d)).replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة(?=\s|$)/g, "ه").toLowerCase();
const num = (v) => (Math.round(v * 100) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 });
const DAY = 86400000;
const iso = (t) => isoDay(t);

// ---- what kind of question -------------------------------------------------------------------------------------------------------
const OWED_IN = /\b(owes? me|owe me|owed to me|lent|i lent|who owes|money (?:people|others) owe)\b|ليا عند|لي عند|مين عليه|(?:عليه|عليها|عليهم)[^؟?]{0,20}(?:ليا|لي)(?![\u0600-\u06ff])|مديون لي|مديونين لي|سلفت|سلّفت|اللي ليا|فلوسي عند/i;
const OWED_OUT = /\b(i owe|do i owe|my debts?|installments?|instalments?|i still pay|left to pay)\b|عليا|علي فلوس|ديوني|اقساط|أقساط|القسط|فاضل عليا|باقي عليا|جمعيه|جمعية/i;
const DUE = /\b(due|deadline|deadlines|coming up|upcoming|expir\w*|renew\w*|what(?:'s| is) (?:on|next)|this week|next week|this month|to pay|bills? due|reminders?)\b|مواعيد|موعد|مستحق|هينتهي|ينتهي|تجديد|الاسبوع ده|الأسبوع ده|الجاي|ايه اللي عليا|المطلوب مني/i;
const MEDS = /\b(medicines?|medications?|meds|pills?|tablets?|doses?|insulin|take (?:my|her|his)|when do (?:i|we|they|she|he) take)\b|دوا|ادويه|أدوية|ادوية|العلاج|جرعه|جرعة|حبوب|انسولين|إنسولين/i;
const FOOD = /\b(calories|kcal|protein|carbs?|carbohydrates?|fat|fibre|fiber|did i eat|i ate|eaten|my meals?|diet)\b|سعرات|سعر حراري|بروتين|كربوهيدرات|كارب|دهون|اكلت|أكلت|اكلي|أكلي/i;
const LAB_Q = /\b(lab|labs|test results?|results?|level|levels|blood test|getting better|improv\w*|trend)\b|تحليل|تحاليل|نتيجه|نتيجة|نسبه|نسبة|اتحسن|اتحسنت/i;
const SUGAR_NOW = /\b(blood sugar|glucose|sugar (?:reading|level))\b|السكر|سكري/i;

/** Which family member a question is about ("mum's HbA1c", "ماما", a name in Family health), or null (= everyone / me). */
export function memberAsked(q, members) {
  const t = fold(q);
  // (a whole word: a member called "Me" is not inside "medicines")
  for (const m of members || []) { const n = fold(m.name).trim(); if (n.length >= 2 && new RegExp("(?<![\\p{L}])" + n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![\\p{L}])", "u").test(t)) return m; }
  const REL = [[/\b(mum|mom|mother|mama)\b|ماما|امي|أمي|والدتي/i, /mum|mom|mother|mama|ماما|ام|والدت/i], [/\b(dad|father|papa|baba)\b|بابا|ابويا|أبي|والدي/i, /dad|father|papa|baba|بابا|اب|والد/i]];
  for (const [ask, name] of REL) if (ask.test(q)) { const m = (members || []).find((x) => name.test(fold(x.name))); if (m) return m; }
  return null;
}

export function kindOf(q, stores = {}) {
  const t = String(q || "");
  if (OWED_IN.test(t)) return "owed-in";
  if (/\b(installments?|instalments?|debts?|loans?)\b|اقساط|أقساط|القسط|ديوني|جمعيه|جمعية/i.test(t) || (OWED_OUT.test(t) && !myMoneyIntent(t))) return "owed-out";
  if (labTestOf(t) && (LAB_Q.test(t) || /\b(my|mum|mom|dad|her|his)\b|بتاع|بتاعت|بتاعي|عندي|ماما|بابا/i.test(t) || /\?|؟/.test(t)) && !SUGAR_NOW.test(t.replace(/hba1c|a1c|السكر التراكمي|التراكمي/gi, ""))) return "lab";
  if (SUGAR_NOW.test(t) && !/hba1c|a1c|التراكمي/i.test(t)) return "sugar";
  if (MEDS.test(t)) return "meds";
  if (FOOD.test(t)) return "food";
  if (myMoneyIntent(t) || catAsked(t) || /\b(spend|spent|spending|earn|earned|income|expenses?|balance)\b|صرفت|مصاريف|دخل|رصيد/i.test(t)) return "money";
  if (DUE.test(t)) return "due";
  return "search";
}

// ---- the answers -------------------------------------------------------------------------------------------------------------------
function owedIn(q, s, now) {
  const items = ((s.life && s.life.items) || []).filter((c) => c.dir === "in");
  const who = items.map((c) => c.person).filter(Boolean).find((p) => fold(q).includes(fold(p)));
  const list = (who ? items.filter((c) => c.person === who) : items).map((c) => ({ c, p: progressOf(c, now) })).filter((x) => x.p.left == null || x.p.left > 0);
  if (!list.length) return { kind: "owed-in", en: who ? `${who} owes you nothing in People & plans.` : "Nobody owes you anything in People & plans.", ar: who ? `لا يوجد على ${who} شيء في الأشخاص والخطط.` : "لا أحد مدين لك في الأشخاص والخطط.", open: "life", sources: ["life"] };
  const cur = list[0].c.currency || "";
  const total = list.reduce((a, x) => a + (x.p.left || 0), 0);
  const rows = list.map(({ c, p }) => [c.person || c.title || c.kind, `${num(p.left || 0)} ${c.currency || cur}${p.next ? " → " + p.next.date : ""}`]);
  return { kind: "owed-in", en: who ? `${who} still owes you ${num(total)} ${cur} (${list[0].p.paidCount} payment${list[0].p.paidCount === 1 ? "" : "s"} received so far).` : `${list.length} ${list.length === 1 ? "person owes" : "people owe"} you ${num(total)} ${cur} in all.`,
    ar: who ? `ما زال على ${who} لك ${num(total)} ${cur} (استلمت ${list[0].p.paidCount} دفعة حتى الآن).` : list.length === 1 ? `شخص واحد مدين لك بـ${num(total)} ${cur}.` : `${list.length} أشخاص مدينون لك بإجمالي ${num(total)} ${cur}.`, rows, open: "life", sources: ["life"] };
}
function owedOut(q, s, now) {
  const items = ((s.life && s.life.items) || []).filter((c) => c.dir !== "in").map((c) => ({ c, p: progressOf(c, now) })).filter((x) => x.p.left == null || x.p.left > 0);
  if (!items.length) return { kind: "owed-out", en: "You have no installments or debts in People & plans.", ar: "ليس عليك أقساط أو ديون في الأشخاص والخطط.", open: "life", sources: ["life"] };
  const cur = items[0].c.currency || "", left = items.reduce((a, x) => a + (x.p.left || 0), 0);
  const next = items.map((x) => x.p.next).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date))[0];
  return { kind: "owed-out", en: `You still have ${num(left)} ${cur} to pay across ${items.length} commitment${items.length === 1 ? "" : "s"}${next ? `; the next is ${num(next.amount)} ${cur} on ${next.date}` : ""}.`,
    ar: `ما زال عليك ${num(left)} ${cur} في ${items.length} التزام${next ? `؛ القادم ${num(next.amount)} ${cur} يوم ${next.date}` : ""}.`,
    rows: items.map(({ c, p }) => [c.title || c.person || c.kind, `${num(p.left || 0)} ${c.currency || cur} · ${p.paidCount}/${c.count || "?"}${p.next ? " → " + p.next.date : ""}`]), open: "life", sources: ["life"] };
}
function lab(q, s) {
  const care = s.care || {}, test = labTestOf(q), m = memberAsked(q, care.members);
  const labs = (care.labs || []).filter((x) => !m || x.member === m.id);
  const tr0 = trendOf(labs, test);
  const who = m ? m.name : "";
  if (!tr0.length) return { kind: "lab", en: `No ${test} result${who ? " for " + who : ""} in Family health yet. Add a lab report there.`, ar: `لا توجد نتيجة ${test}${who ? " لـ" + who : ""} في صحة العائلة بعد. أضف تقرير التحليل هناك.`, open: "care", sources: ["care"] };
  const L = tr0[tr0.length - 1], P = tr0.length > 1 ? tr0[tr0.length - 2] : null;
  const range = L.low != null || L.high != null ? ` (the report's range: ${[L.low, L.high].filter((x) => x != null).join("–")})` : "";
  const dir = P ? (L.value < P.value ? "down" : L.value > P.value ? "up" : "the same") : "";
  const verdict = L.flag === "in range" ? "in range" : L.flag ? L.flag : "";
  const en = `${who ? who + "'s" : "Your"} latest ${test} is ${L.value} ${L.unit || ""} on ${L.date}${range}${verdict ? " — " + verdict : ""}.` + (P ? ` It went ${dir} from ${P.value} on ${P.date}.` : "");
  const ar = `آخر ${test}${who ? " لـ" + who : ""}: ${L.value} ${L.unit || ""} يوم ${L.date}${verdict ? " — " + (verdict === "in range" ? "ضمن المعدل" : verdict === "high" ? "مرتفع" : "منخفض") : ""}.` + (P ? ` ${dir === "down" ? "انخفض" : dir === "up" ? "ارتفع" : "لم يتغير"} من ${P.value} يوم ${P.date}.` : "");
  return { kind: "lab", en: en + " Ask your doctor what it means for you.", ar: ar + " اسأل طبيبك عن معناها لك.", rows: tr0.slice(-6).map((x) => [x.date, `${x.value} ${x.unit || ""}`]), open: "care", sources: ["care"] };
}
function sugar(q, s, now) {
  const g = ((s.care && s.care.labs) || []).filter((x) => /glucose/i.test(x.test) && x.at).sort((a, b) => a.at - b.at);
  if (!g.length) return { kind: "sugar", en: "No blood sugar readings yet. Save one on Family health → Today.", ar: "لا توجد قراءات للسكر بعد. سجّل قراءة في صحة العائلة ← اليوم.", open: "care", sources: ["care"] };
  const L = g[g.length - 1], week = g.filter((x) => x.at > now - 7 * DAY), lows = week.filter((x) => mgdl(x.value, x.unit) < 70).length;
  const avg = week.length ? Math.round(week.reduce((a, x) => a + mgdl(x.value, x.unit), 0) / week.length) : null;
  return { kind: "sugar", en: `Last reading: ${L.value} ${L.unit} at ${new Date(L.at).toTimeString().slice(0, 5)} on ${iso(L.at)}.${avg != null ? ` This week: ${week.length} readings, average ${avg} mg/dL, ${lows} low.` : ""}`,
    ar: `آخر قراءة: ${L.value} ${L.unit} الساعة ${new Date(L.at).toTimeString().slice(0, 5)} يوم ${iso(L.at)}.${avg != null ? ` هذا الأسبوع: ${week.length} قراءات، المتوسط ${avg} ملجم/دل، ${lows} منخفضة.` : ""}`,
    rows: g.slice(-6).map((x) => [iso(x.at) + " " + new Date(x.at).toTimeString().slice(0, 5), `${x.value} ${x.unit}`]), open: "care", sources: ["care"] };
}
function meds(q, s, now) {
  const care = s.care || {}, m = memberAsked(q, care.members), day = iso(now);
  const list = (care.meds || []).filter((x) => !x.stopped && activeOn(x, day) && (!m || x.member === m.id));
  if (!list.length) return { kind: "meds", en: `No medicines${m ? " for " + m.name : ""} in Family health.`, ar: `لا توجد أدوية${m ? " لـ" + m.name : ""} في صحة العائلة.`, open: "care", sources: ["care"] };
  const doses = dosesOn(care, now).filter((d) => !m || d.med.member === m.id);
  const left = doses.filter((d) => !d.taken);
  return { kind: "meds", en: `${m ? m.name + " takes" : "Taking"} ${list.length} medicine${list.length === 1 ? "" : "s"}. Today: ${doses.length - left.length} of ${doses.length} doses taken${left.length ? `; next ${left[0].med.name} at ${left[0].time}` : ""}.`,
    ar: `${m ? m.name + " يأخذ" : "تأخذ"} ${list.length} دواء. اليوم: أُخذت ${doses.length - left.length} من ${doses.length} جرعات${left.length ? `؛ التالي ${left[0].med.name} الساعة ${left[0].time}` : ""}.`,
    rows: list.map((x) => [`${x.name} ${x.strength || ""}`.trim(), [x.dose, (x.times || []).join(", "), x.food].filter(Boolean).join(" · ")]), open: "care", sources: ["care"] };
}
function food(q, s, now) {
  const days = (s.fit && s.fit.days) || {}, span = spanOf(q, now);
  const keys = Object.keys(days).filter((k) => k >= span.from && k <= span.to).sort();
  const sumDay = (d) => Object.values(d.meals || {}).flat().filter((x) => x && x.kcal != null).reduce((a, x) => ({ kcal: a.kcal + (x.kcal || 0), p: a.p + (x.p || 0), c: a.c + (x.c || 0), f: a.f + (x.f || 0) }), { kcal: 0, p: 0, c: 0, f: 0 });
  const per = keys.map((k) => [k, sumDay(days[k])]).filter(([, v]) => v.kcal > 0);
  if (!per.length) return { kind: "food", en: `Nothing is logged in Fit & Food for ${span.label[0]}.`, ar: `لا شيء مسجل في اللياقة والطعام لـ${span.label[1]}.`, open: "fit", sources: ["fit"] };
  const tot = per.reduce((a, [, v]) => ({ kcal: a.kcal + v.kcal, p: a.p + v.p, c: a.c + v.c, f: a.f + v.f }), { kcal: 0, p: 0, c: 0, f: 0 });
  const n = per.length, one = n === 1, r = (x) => Math.round(one ? x : x / n);
  const what = /protein|بروتين/i.test(q) ? "p" : /carb|كربوهيدرات|كارب/i.test(q) ? "c" : /\bfat\b|دهون/i.test(q) ? "f" : "kcal";
  const name = { kcal: ["calories", "سعرات"], p: ["protein", "بروتين"], c: ["carbohydrates", "كربوهيدرات"], f: ["fat", "دهون"] }[what], unit = what === "kcal" ? ["kcal", "سعر"] : ["g", "جم"];
  return { kind: "food", en: `${one ? "" : "On average, "}${r(tot[what])} ${unit[0]} of ${name[0]} ${one ? "on " + per[0][0] : `a day over ${n} logged days (${span.label[0]})`}. Calories ${r(tot.kcal)} · protein ${r(tot.p)} g · carbohydrates ${r(tot.c)} g · fat ${r(tot.f)} g${one ? "" : " a day"}.`,
    ar: `${one ? "" : "في المتوسط "}${r(tot[what])} ${unit[1]} ${name[1]} ${one ? "يوم " + per[0][0] : `يوميًا خلال ${n} أيام مسجلة (${span.label[1]})`}. السعرات ${r(tot.kcal)} · بروتين ${r(tot.p)} جم · كربوهيدرات ${r(tot.c)} جم · دهون ${r(tot.f)} جم.`,
    rows: per.slice(-7).map(([k, v]) => [k, `${Math.round(v.kcal)} kcal · P ${Math.round(v.p)} · C ${Math.round(v.c)} · F ${Math.round(v.f)}`]), open: "fit", sources: ["fit"] };
}
function due(q, s, now) {
  const span = /\bmonth\b|الشهر/i.test(q) ? 31 : /\bweek\b|الاسبوع|الأسبوع/i.test(q) ? 7 : 30;
  const today = iso(now), until = iso(now + span * DAY), out = [];
  for (const x of ((s.radar && s.radar.items) || [])) if (x.status !== "done" && x.date && x.date <= until) out.push({ date: x.date, what: x.title + (x.amount ? ` · ${num(x.amount)} ${x.currency || ""}` : ""), src: "radar" });
  for (const d of dueSoon(s.life || { items: [] }, now, span)) out.push({ date: d.date, what: `${d.c.dir === "in" ? "+" : "−"}${num(d.amount)} ${d.c.currency || ""} · ${d.c.person || d.c.title || d.c.kind}`, src: "life" });
  for (const r of s.reminders || []) if (r.at && r.at >= now && r.at <= now + span * DAY) out.push({ date: iso(r.at), what: r.title, src: "reminders" });
  out.sort((a, b) => a.date.localeCompare(b.date));
  const late = out.filter((x) => x.date < today).length;
  if (!out.length) return { kind: "due", en: `Nothing is due in the next ${span} days.`, ar: `لا شيء مستحق خلال ${span} يومًا القادمة.`, sources: ["radar", "life", "reminders"] };
  return { kind: "due", en: `${out.length} thing${out.length === 1 ? "" : "s"} in the next ${span} days${late ? `, ${late} already late` : ""}. First: ${out[0].what} on ${out[0].date}.`,
    ar: `${out.length} أشياء خلال ${span} يومًا القادمة${late ? `، منها ${late} متأخرة` : ""}. أولها: ${out[0].what} يوم ${out[0].date}.`,
    rows: out.slice(0, 12).map((x) => [x.date + (x.date < today ? " ⚠" : ""), x.what]), open: out[0].src, sources: [...new Set(out.map((x) => x.src))] };
}
function search(q, s) {
  const words = fold(q).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3 && !/^(what|when|where|which|how|the|and|did|does|about|my|have|that|with|for|اللي|ايه|امتي|فين|ازاي|هل|كام|عن|في|من)$/.test(w));
  if (!words.length) return null;
  const hit = (txt) => { const t = fold(txt); return words.filter((w) => t.includes(w)).length; };
  const found = [];
  for (const r of s.memory || []) { const n = hit([r.title, r.text, r.output].join(" ")); if (n) found.push({ n, date: r.ts ? iso(r.ts) : "", what: r.title || String(r.text || "").slice(0, 80), src: "memory" }); }
  for (const t of ((s.ledger && s.ledger.txns) || [])) { const n = hit(t.note); if (n) found.push({ n, date: t.date, what: `${t.type === "income" ? "+" : "−"}${num(t.amount)} · ${t.note}`, src: "money" }); }
  for (const x of ((s.radar && s.radar.items) || [])) { const n = hit(x.title + " " + (x.note || "")); if (n) found.push({ n, date: x.date, what: x.title, src: "radar" }); }
  for (const c of ((s.life && s.life.items) || [])) { const n = hit([c.person, c.title, c.kind].join(" ")); if (n) found.push({ n, date: c.start || "", what: [c.person, c.title || c.kind, c.amount ? num(c.amount) + " " + (c.currency || "") : ""].filter(Boolean).join(" · "), src: "life" }); }
  for (const m of ((s.care && s.care.meds) || [])) { const n = hit(m.name); if (n) found.push({ n, date: m.start || "", what: `${m.name} ${m.strength || ""} · ${m.dose || ""}`, src: "care" }); }
  if (!found.length) return null;
  found.sort((a, b) => b.n - a.n || String(b.date).localeCompare(String(a.date)));
  const top = found.slice(0, 10);
  return { kind: "search", en: `Found ${found.length} thing${found.length === 1 ? "" : "s"} about this in your data. The closest: ${top[0].what}${top[0].date ? " (" + top[0].date + ")" : ""}.`,
    ar: `وُجد ${found.length} عنصر عن هذا في بياناتك. الأقرب: ${top[0].what}${top[0].date ? " (" + top[0].date + ")" : ""}.`,
    rows: top.map((x) => [x.date || "—", x.what]), open: top[0].src, sources: [...new Set(top.map((x) => x.src))] };
}

/** The answer, or null when nothing in your data fits (the page then offers Chat). */
export function askLife(question, stores = {}, { now = Date.now() } = {}) {
  const q = String(question || "").trim(); if (!q) return null;
  const k = kindOf(q, stores);
  if (k === "money") {
    const ar = /[؀-ۿ]/.test(q);
    const en = answerMyMoney(q, stores.ledger || null, { now, ar: false, short: true }).text, a = answerMyMoney(q, stores.ledger || null, { now, ar: true, short: true }).text;
    void ar;
    return { kind: "money", en, ar: a, open: "money", sources: ["money"] };
  }
  const f = { "owed-in": owedIn, "owed-out": owedOut, lab, sugar, meds, food, due }[k];
  return (f && f(q, stores, now)) || search(q, stores);
}

/** The stores as each tool saved them (null-safe). */
export function loadStores(ls = typeof localStorage !== "undefined" ? localStorage : null) {
  const j = (k, d) => { try { const v = JSON.parse((ls && ls.getItem(k)) || "null"); return v == null ? d : v; } catch (e) { return d; } };
  const memKey = ls ? Object.keys(ls).find((k) => /^attune:memory:v\d+$/.test(k)) : null;
  const mem = memKey ? j(memKey, []) : [];
  const rem = j("attune:reminders:v1", []);
  return { ledger: j("ledger.v3", null), life: j("attune:life:v1", { items: [] }), care: j("attune:care:v1", { members: [], meds: [], labs: [], taken: {} }), radar: j("attune:radar:v1", { items: [] }),
    fit: j("attune:fit:v1", { days: {} }), reminders: Array.isArray(rem) ? rem : (rem && rem.items) || [], memory: Array.isArray(mem) ? mem : (mem && (mem.records || mem.items)) || [] };
}

/** Example questions for the page (each answered from a different tool). */
export const EXAMPLES = [
  ["How much did I spend on food this month?", "صرفت كام على الأكل الشهر ده؟"],
  ["Who owes me money?", "مين عليه فلوس ليا؟"],
  ["What's due this week?", "ايه المواعيد المستحقة الاسبوع ده؟"],
  ["Is my HbA1c getting better?", "السكر التراكمي بتاعي اتحسن؟"],
  ["How much protein did I eat yesterday?", "أكلت كام بروتين امبارح؟"],
  ["What medicines does mum take?", "ماما بتاخد أدوية ايه؟"],
];

// ---- in Chat: only questions about YOUR OWN things ("what is HbA1c?" stays a normal answer; "is my HbA1c better?" is answered here)
const QUESTION = /\?|؟|^(how|what|who|when|which|is|are|did|do|does|have|has|show|list)\b|^(كام|ايه|إيه|مين|امتى|إمتى|امتي|فين|هل|اعرض)|\b(كام|ايه|مين|امتى)\b/i;
const MINE = /\b(my|me|mine|i|our|mum'?s?|mom'?s?|mother'?s|dad'?s?|father'?s)\b|بتاعي|بتاعتي|بتاع ماما|بتاع بابا|ليا|عليا|عندي|ماما|بابا|امي|أمي|ابويا|اكلت|أكلت|صرفت|دفعت|باخد|بتاخد|بياخد/i;
export function chatAsk(q, stores, { now = Date.now() } = {}) {
  const t = String(q || "").trim();
  if (!t || t.length > 160 || !QUESTION.test(t)) return null;
  const members = (stores && stores.care && stores.care.members) || [];
  if (!MINE.test(t) && !memberAsked(t, members)) return null;
  const k = kindOf(t, stores);
  if (k === "search") return null;
  return askLife(t, stores, { now });
}
