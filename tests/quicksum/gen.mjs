// v10.9 S1 (Ali: "make the speed much faster" — a sum in words took 40–60 s with the real phone model). 10,000 sums COMPOSED from parts
// in random order with many phrasings (English, Egyptian Arabic, Franco-free), every way amounts are written (1,250 · 1250 · «١٢٥٠» ·
// «900 ألف» · 15k), hardened (tests/lib/hard.mjs). Truth computed HERE. Each kind:
//   split · rate (× count, + tax / − discount) · percent (of / tip / discount / before discount / before VAT) · save · instalment · interest
//   and NEGATIVES that code must leave to the model or to Money: a spending log, a reminder, an extra number nobody placed, a question
//   with no sum shape, "before" with no discount or tax, interest over several years (compound or not is the model's to ask).
// Checked: quickSum gives the exact value (to the cent) — or nothing for a negative.
//   node tests/quicksum/gen.mjs        (N=2500 for the unit test; HELD=1 for the held-out set written after the fixes)
import { quickSum } from "../../web-src/quicksum.js";
import { harden, shapeReport, SHAPE_BAR } from "../lib/hard.mjs";
const N = +(process.env.N || 10000), HELD = !!process.env.HELD;
let seed = 7177 + (HELD ? 2231 : 0); const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const r2 = (x) => Math.round(x * 100) / 100;
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const AR_D = "٠١٢٣٤٥٦٧٨٩";
// an amount as people write it
function amt(v, ar) {
  const w = rnd();
  if (ar && v >= 1000 && v % 1000 === 0 && w < 0.25) return (v / 1000) + " " + pick(["ألف", "الف"]);
  if (!ar && v >= 1000 && v % 1000 === 0 && w < 0.12) return (v / 1000) + "k";
  const s = w < 0.55 && v >= 1000 ? v.toLocaleString("en-US") : String(v);
  return ar && rnd() < 0.3 ? s.replace(/\d/g, (d) => AR_D[+d]) : s;
}
const cur = (ar) => (ar ? pick(["جنيه", "ج", "", ""]) : pick(["EGP", "LE", "pounds", "", ""]));
const ASK_EN = ["how much?", "how much is that?", "total?", "what's the total?", "how much each?", "calculate it", "how much will it be?"];
const ASK_AR = ["كام؟", "المجموع كام؟", "يبقى كام؟", "الحساب كام", "هيبقى كام؟", "احسبلي", "الإجمالي كام؟"];
const SEP = [" ", ", ", " — ", "\n", ". ", "، "];
const join = (parts) => parts.filter(Boolean).map((p) => p.trim()).reduce((a, p, i) => a + (i ? pick(SEP) : "") + p, "");
const LEAD = ["", "", "", "سؤال: ", "Quick one: ", "btw ", "يا Attune ", "📌 ", "Hi! ", "مساء الخير، ", "Ali: ", "Q: ", "😅 ", "عايز أعرف: ", "hey — ", "ممكن تحسبلي: "];

function one() {
  const ar = rnd() < 0.5, kind = pick(["split", "rate", "rate", "percent", "percent", "save", "instalment", "interest", "left", "neg", "neg", "neg"]);
  let text = "", want = null;
  if (kind === "split") {
    const n = pick(HELD ? [3, 6, 8, 11, 15] : [2, 4, 5, 9, 10, 12, 24]), x = pick(HELD ? [9000, 13500, 48000, 7250] : [22000, 1800, 60000, 5000, 3600, 125000]);
    const unit = ar ? pick(["شهور", "أشهر", "قسط", "أقساط", "أفراد", "أشخاص"]) : pick(["months", "instalments", "people", "friends", "payments"]);
    const parts = ar ? [pick(["عندي", "معايا", "مبلغ", ""]) + " " + amt(x, ar) + " " + cur(ar), pick(["هقسمهم على", "عايز أقسمهم على", "بالتقسيط على", "على"]) + " " + n + " " + unit, pick(["كام كل واحد؟", "كام كل شهر؟", "كام؟", "يطلع كام؟"])]
      : [pick(["split", "divide", "share"]) + " " + amt(x, ar) + " " + cur(ar), pick(["between", "over", "into", "among"]) + " " + n + " " + unit, pick(["how much each?", "how much per month?", "how much is each part?"])];
    text = join(parts); want = r2(x / n);
  } else if (kind === "rate") {
    const sub = pick(["days", "kilo", "nights"]);
    const rate = pick(HELD ? [850, 1650, 95, 2300] : [12500, 480, 1200, 350, 75, 3000]), count = pick(sub === "kilo" ? [2.5, 3, 1.5, 4] : HELD ? [6, 9, 11] : [3, 2, 5, 7, 10, 14]);
    const tx = rnd() < 0.45 ? pick([14, 12, 10, 5]) : 0, dc = !tx && rnd() < 0.25 ? pick([10, 15, 20]) : 0;
    let rateP, cntP;
    if (ar) {
      if (sub === "kilo") { rateP = pick([`كيلو ${pick(["اللحمة", "الفراخ", "السمك", "الجبنة"])} بـ ${amt(rate, ar)}`, `الكيلو بـ ${amt(rate, ar)} ${cur(ar)}`, `بـ ${amt(rate, ar)} للكيلو`]); cntP = pick([`عايز ${count} كيلو`, `هاخد ${count} كيلو`, `${count} كيلو`]); }
      else { const u = sub === "days" ? ["في اليوم", "اليوم", "أيام"] : ["في الليلة", "الليلة", "ليالي"]; rateP = `بـ ${amt(rate, ar)} ${cur(ar)} ${u[0]}`; cntP = pick([`${count} ${u[2]}`, `${pick(["إيجار", "حجز", ""])} ${count} ${u[2]}`]); }
    } else {
      if (sub === "kilo") { rateP = pick([`${amt(rate, ar)} ${cur(ar)} per kilo`, `${amt(rate, ar)} a kg`, `at ${amt(rate, ar)} per kg`]); cntP = pick([`I need ${count} kg`, `${count} kilos`, `buying ${count} kg`]); }
      else { const u = sub === "days" ? ["a day", "per day", "days"] : ["a night", "per night", "nights"]; rateP = `${amt(rate, ar)} ${cur(ar)} ${pick(u.slice(0, 2))}`; cntP = pick([`${count} ${u[2]}`, `for ${count} ${u[2]}`, `rent for ${count} ${u[2]}`]); }
    }
    const extra = tx ? (ar ? pick([`وعليهم ${tx}٪ ضريبة`, `+ ${tx}% ضريبة`, `ضريبة ${tx}%`, `و${tx}% خدمة`]) : pick([`plus ${tx}% VAT`, `+ ${tx}% tax`, `with ${tx}% service`, `and ${tx}% tax`])) : dc ? (ar ? pick([`وعليهم خصم ${dc}%`, `بخصم ${dc}%`]) : pick([`with a ${dc}% discount`, `minus ${dc}% discount`, `${dc}% off`])) : "";
    text = join([...shuffle([rateP, cntP]), extra, pick(ar ? ASK_AR : ASK_EN)]);
    want = r2(rate * count * (1 - dc / 100) * (1 + tx / 100));
  } else if (kind === "percent") {
    const sub = pick(["tip", "disc", "before-disc", "before-vat", "of"]), p = pick(HELD ? [12, 35, 7, 18] : [15, 20, 25, 10, 14, 30]), x = pick(HELD ? [960, 4400, 27000] : [640, 1500, 1800, 18000, 2400, 75000]);
    if (sub === "tip") { text = ar ? pick([`بقشيش ${p}% على ${amt(x, ar)}`, `${p}% بقشيش على ${amt(x, ar)} ${cur(ar)} كام؟`]) : pick([`${p}% tip on ${amt(x, ar)} ${cur(ar)}`, `what's a ${p}% tip on ${amt(x, ar)}?`, `tip ${p}% on ${amt(x, ar)}`]); want = r2(x * p / 100); }
    else if (sub === "disc") { text = ar ? pick([`خصم ${p}% على ${amt(x, ar)} يبقى كام؟`, `${amt(x, ar)} ${cur(ar)} عليها خصم ${p}% هتبقى بكام؟`]) : pick([`${amt(x, ar)} with ${p}% off, how much?`, `${p}% discount on ${amt(x, ar)} ${cur(ar)} — how much do I pay?`]); want = r2(x * (1 - p / 100)); }
    else if (sub === "before-disc") { text = ar ? pick([`الجاكيت بقى بـ ${amt(x, ar)} بعد خصم ${p}%، كان بكام قبل الخصم؟`, `بعد خصم ${p}% السعر ${amt(x, ar)}، السعر الأصلي كام؟`]) : pick([`A jacket is ${amt(x, ar)} after a ${p}% discount. What was the price before?`, `after ${p}% off it costs ${amt(x, ar)} — what was the original price?`]); want = r2(x / (1 - p / 100)); }
    else if (sub === "before-vat") { text = ar ? pick([`موبايل بـ ${amt(x, ar)} شامل ${p}% ضريبة، سعره قبل الضريبة كام؟`, `${amt(x, ar)} ${cur(ar)} بالضريبة ${p}%، من غير الضريبة كام؟`]) : pick([`A phone costs ${amt(x, ar)} with ${p}% VAT included. What is the price before VAT?`, `${amt(x, ar)} including ${p}% tax — how much without tax?`]); want = r2(x / (1 + p / 100)); }
    else { text = ar ? pick([`${p}% من ${amt(x, ar)} كام؟`, `كام ${p}% من ${amt(x, ar)}؟`]) : pick([`what is ${p}% of ${amt(x, ar)}?`, `${p}% of ${amt(x, ar)} ${cur(ar)} = ?`]); want = r2(x * p / 100); }
  } else if (kind === "save") {
    const s = pick(HELD ? [1750, 3200, 800] : [2500, 1000, 5000, 1500]), target = pick(HELD ? [42000, 15000, 100000] : [60000, 30000, 25000, 90000]);
    text = ar ? pick([`لو بحوش ${amt(s, ar)} في الشهر، محتاج كام شهر عشان أوصل لـ ${amt(target, ar)}؟`, `عايز أجمع ${amt(target, ar)} ${cur(ar)}، لو هحط ${amt(s, ar)} كل شهر هاخد كام شهر؟`])
      : pick([`If I save ${amt(s, ar)} a month, how many months to reach ${amt(target, ar)}?`, `I want to collect ${amt(target, ar)}. If I save ${amt(s, ar)} per month, how long?`]);
    want = Math.ceil(target / s - 1e-9);
  } else if (kind === "instalment") {
    const price = pick(HELD ? [650000, 1200000, 480000] : [900000, 750000, 1500000, 300000]), p = pick([20, 30, 25, 10]), n = pick([3, 4, 5, 2]), yrs = rnd() < 0.7;
    const months = yrs ? n * 12 : n * 6, nShown = yrs ? n : n * 6;
    text = ar ? `${pick(["عربية", "شقة", "موتوسيكل"])} بـ ${amt(price, ar)} ${pick(["مقدم", "دفعة أولى"])} ${p}% والباقي على ${nShown} ${yrs ? pick(["سنين", "سنوات"]) : "شهور"}، القسط الشهري كام${pick([" من غير فوايد", ""])}؟`
      : `A car for ${amt(price, ar)} with a ${p}% down payment and the rest over ${nShown} ${yrs ? "years" : "months"}${pick([" without interest", ""])} — monthly payment?`;
    want = r2(price * (1 - p / 100) / months);
  } else if (kind === "left") {
    // (the spent part is always smaller than what there was — the first run paired them at random, "had 3, spent 9,000": the generator's fault)
    const pair = pick(HELD ? [[7500, 2250], [40, 15], [950, 300], [3200, 1999]] : [[12000, 9000], [3, 2], [500, 320], [5000, 1800], [20, 7], [60000, 45500]]), x = pair[0], y = pair[1];
    const thing = ar ? pick(["تفاحات", "جنيه", "كيلو", ""]) : pick(["apples", "pounds", "kg", ""]);
    text = ar ? pick([`عندي ${amt(x, ar)} ${thing} و${pick(["صرفت", "أكلت", "اديت", "استعملت"])} ${amt(y, ar)}، ${pick(["فاضل كام؟", "الباقي كام؟", "فاضلي كام"])}`, `مرتبي ${amt(x, ar)} وبصرف ${amt(y, ar)}، فاضل كام؟`, `دفعت ${amt(y, ar)} من ${amt(x, ar)} والباقي كام`])
      : pick([`I had ${amt(x, ar)} ${thing}, ${pick(["spent", "ate", "used", "gave away"])} ${amt(y, ar)}, how much is left?`, `I earn ${amt(x, ar)} and spend ${amt(y, ar)}, how much is left?`, `paid ${amt(y, ar)} out of ${amt(x, ar)}, how much remains?`]);
    want = r2(x - y);
  } else if (kind === "interest") {
    const x = pick(HELD ? [250000, 40000] : [100000, 50000, 200000]), p = pick([20, 22, 18, 27]), month = rnd() < 0.4;
    text = ar ? `لو حطيت ${amt(x, ar)} في شهادة بعائد ${p}% سنوي، هاخد كام ${month ? "في الشهر" : "في السنة"}؟` : `If I put ${amt(x, ar)} in a certificate at ${p}% a year, how much do I get ${month ? "a month" : "a year"}?`;
    want = r2(month ? x * p / 100 / 12 : x * p / 100);
  } else {
    // negatives: code must NOT answer
    text = ar ? pick([`صرفت ${amt(pick([300, 1500, 450]), ar)} على الغدا`, `فكرني بكرة الساعة 9 أدفع ${amt(1200, ar)}`, `دفعت ${amt(2500, ar)} لأحمد امبارح`, `إيجار ونش 3 أيام بـ 12500 في اليوم و2 سواقين بـ 500، كام؟`, `السعر قبل ${amt(1800, ar)} و${pick([25, 30])}% ايه رأيك؟`, `لو حطيت ${amt(100000, ar)} بعائد 20% سنوي لمدة 3 سنين هاخد كام؟`, `عندي 3 عيال و2 عربيات، كام حاجة؟`])
      : pick([`I spent ${amt(pick([300, 1500, 450]), ar)} on lunch`, `remind me tomorrow at 9 to pay ${amt(1200, ar)}`, `paid ${amt(2500, ar)} to Ahmed yesterday`, `crane rent 3 days at 12500 a day and 2 drivers at 500, total?`, `what was it before 1800 and 25%?`, `100000 at 20% a year for 3 years, how much in the end?`, `I have 3 kids and 2 cars, how many things?`]);
    want = null;
  }
  // how people wrap a question (the first run had 48.8 % shapes — the templates were too even: the generator's fault)
  if (rnd() < 0.5) text = text.replace(/, | — |\. /g, () => pick(SEP));
  if (rnd() < 0.3) text = text.replace(/\?$/, "") + pick(["??", " ?", " pls", " بليز", " 🙏", " (quick)", " :)", "!", " … thanks", ""]);
  if (rnd() < 0.25) text = pick(["(", "« ", "- ", "* ", "> "]) + text + pick([")", " »", "", ""]);
  text = pick(LEAD) + text;
  text = harden(text, rnd, { lang: ar ? "ar" : "en", human: true, allowCut: false, keep: /\d/ });
  return { kind, text, want };
}
const cases = Array.from({ length: N }, one);
let ok = 0; const fails = [], by = {};
for (const c of cases) {
  let q = null; try { q = quickSum(c.text); } catch (e) { q = { err: String(e) }; }
  const good = c.want == null ? !q : !!(q && Math.abs(q.value - c.want) < 0.011);
  by[c.kind] = by[c.kind] || [0, 0]; by[c.kind][1]++;
  if (good) { ok++; by[c.kind][0]++; } else if (fails.length < 80) fails.push(`[${c.kind}] ${JSON.stringify(c.text)} — want ${c.want}, got ${q ? JSON.stringify(q.value ?? q) : "nothing"}`);
}
const sh = shapeReport(cases.map((c) => c.text));
console.log(`${HELD ? "held-out" : "generated"} ${N}: ${ok}/${N} = ${(100 * ok / N).toFixed(2)} % · shapes ${(100 * sh.share).toFixed(1)} % (bar ${SHAPE_BAR * 100} %)`);
console.log(Object.entries(by).map(([k, [a, b]]) => `${k} ${a}/${b}`).join(" · "));
if (fails.length) console.log(fails.slice(0, +(process.env.SHOW || 30)).join("\n"));
export const RESULT = { ok, n: N, share: sh.share };
