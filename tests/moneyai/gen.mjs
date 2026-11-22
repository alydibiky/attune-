// v10.8 (Ali, 22 Nov 2026: "what's the use of AI if it didn't do anything" — the model now re-reads money the code wasn't sure of; code
// checks its answer). 10,000 cases: a sentence COMPOSED from parts in random order with one of his categories, hardened, the item the code
// saved, and a MODEL REPLY of one of eight kinds — right; a category that is not in his list; an amount he didn't write; note words he
// didn't write; the amount inside the note; broken JSON / prose; an extra item; the right category in a different case. Truth written
// HERE. Checked: moneyai.verify accepts exactly the safe parts (his category, his amount, his words) and nothing else.
//   node tests/moneyai/gen.mjs        (N=2500 for the unit test; HELD=1 for the held-out set)
import { verify, needsCheck, prompt } from "../../web-src/moneyai.js";
import { harden, shapeReport, SHAPE_BAR } from "../lib/hard.mjs";
const N = +(process.env.N || 10000), HELD = !!process.env.HELD;
let seed = 5501 + (HELD ? 4441 : 0); const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const CATS = HELD ? [{ id: "c_sara", en: "masroof sara", ar: "مصروف سارة" }, { id: "c_club", en: "Club", ar: "النادي" }, { id: "c_wed", en: "Wedding fund", ar: "فلوس الفرح" }]
  : [{ id: "c_nada", en: "masroof nada", ar: "مصروف ندى" }, { id: "c_car", en: "Car", ar: "العربية" }, { id: "c_kids", en: "Kids school", ar: "مدرسة الولاد" }, { id: "c_gym", en: "Gym", ar: "الجيم" }];
const LEDGER = { currency: "EGP", customCats: CATS };
const WHAT = { en: HELD ? ["running shoes", "birthday present", "tyre change"] : ["shopping winter clothes", "new shoes", "monthly fee", "oil change", "books and uniform"],
  ar: HELD ? ["جزمة جري", "هدية عيد ميلاد"] : ["هدوم الشتا", "جزمة جديدة", "الاشتراك الشهري", "تغيير زيت"] };
const KINDS = ["right", "notmine", "amount", "invented", "digits", "broken", "extra", "case"];
function one() {
  const c = pick(CATS), ar = rnd() < 0.4, L = ar ? "ar" : "en", what = pick(WHAT[L]), amount = pick(HELD ? [1750, 640, 95000] : [25000, 300, 1200, 850, 60000]);
  const name = ar ? c.ar : pick([c.en, c.en.toLowerCase()]);
  const parts = ar ? [pick(["صرفت", "دفعت", "مصروف"]), String(amount), pick(["جنيه", "ج", ""]), pick(["تحت", "بند", "في"]) + " " + name, pick(["عشان", "علشان", ""]) + " " + what]
    : [pick(["spent", "paid", "expense", ""]), String(amount), pick(["egp", "LE", ""]), pick(["under", "category", "in"]) + " " + name, pick(["for", "—", ""]) + " " + what];
  // more parts, any order, joined the way people type (the first run had 32.8 % shapes — too uniform: the generator's fault)
  if (rnd() < 0.5) parts.push(ar ? pick(["النهارده", "امبارح", "من الكاش", "من البنك", "يوم الخميس"]) : pick(["today", "yesterday", "cash", "from the bank", "on Thursday", "via Instapay"]));
  for (let i = parts.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [parts[i], parts[j]] = [parts[j], parts[i]]; }
  const SEP = [" ", " ", ", ", " — ", ": ", " - ", "\n", " / "], LEADW = ["", "", "", "Ali: ", "📌 ", "btw ", "OK ", "💸 ", "Note - ", "#money "];
  let text = pick(LEADW) + parts.filter((x) => x && x.trim()).map((x) => x.trim()).reduce((a, x, i) => a + (i ? pick(SEP) : "") + (rnd() < 0.15 ? x.toUpperCase() : rnd() < 0.2 ? x[0].toUpperCase() + x.slice(1) : x), "")
    + pick(["", "", " 🙏", "!", " ok", " ✅", "!!", " (cash)", " 😅", " thanks"]);
  text = harden(text, rnd, { lang: L, human: true, allowCut: false, keep: what });
  const item = { type: "expense", amount, cat: pick(["other", "shopping", "other"]), note: text.slice(0, 60) };
  const kind = pick(KINDS);
  let reply, want;   // want: null = no change; { cat, note } = what must be accepted (note null = the old note stays)
  const goodNote = what;
  if (kind === "right") { reply = { items: [{ amount, cat: c.id, note: goodNote }] }; want = { cat: c.id, note: goodNote }; }
  else if (kind === "notmine") { reply = { items: [{ amount, cat: pick(["clothes", "Shopping clothes", "c_fake", "nada"]), note: goodNote }] }; want = null; }
  else if (kind === "amount") { reply = { items: [{ amount: amount + pick([1, 100, -50, amount]), cat: c.id, note: goodNote }] }; want = null; }
  else if (kind === "invented") { reply = { items: [{ amount, cat: c.id, note: pick(["designer winter coat", "Zara jacket sale", "something for the kids"]) }] }; want = { cat: c.id, note: null }; }
  else if (kind === "digits") { reply = { items: [{ amount, cat: c.id, note: amount + " " + goodNote }] }; want = { cat: c.id, note: null }; }
  else if (kind === "broken") { reply = pick(["Sure! It goes under " + name + ".", '{"items":[{"amount":' + amount + ',"cat":', "", "{}", '{"items":"none"}']); want = null; }
  else if (kind === "extra") { reply = { items: [{ amount, cat: c.id, note: goodNote }, { amount: 999999, cat: "food", note: "lunch" }] }; want = { cat: c.id, note: goodNote }; }
  else { reply = { items: [{ amount, cat: c.id.toUpperCase(), note: goodNote }] }; want = null; }   // ids are exact
  return { L, text, item, kind, raw: typeof reply === "string" ? reply : (rnd() < 0.3 ? "Here you go: " : "") + JSON.stringify(reply), want };
}
const cases = Array.from({ length: N }, one);
let ok = 0; const fails = [];
for (const c of cases) {
  const out = verify(c.raw, c.text, LEDGER, [c.item]); let why = "";
  if (!c.want) { if (out.length) why = `accepted ${JSON.stringify(out[0])}`; }
  else if (out.length !== 1) why = "nothing accepted";
  else if (out[0].cat !== c.want.cat) why = `category ${out[0].cat}`;
  else if (c.want.note && out[0].note !== c.want.note) why = `note «${out[0].note}» (want «${c.want.note}»)`;
  else if (!c.want.note && out[0].note !== c.item.note) why = `took the model's note «${out[0].note}»`;
  if (!needsCheck(c.item, c.text, LEDGER) && c.item.cat === "other") why = why || "an Others item was not checked";
  if (!prompt(c.text, LEDGER, [c.item]).includes(LEDGER.customCats[0].id)) why = why || "his categories are not in the question";
  if (!why) ok++; else if (fails.length < 60) fails.push(`[${c.L} ${c.kind}] ${JSON.stringify(c.text)} — ${why}`);
}
const sh = shapeReport(cases.map((c) => c.text));
console.log(`${HELD ? "held-out" : "generated"} ${N}: ${ok}/${N} = ${(100 * ok / N).toFixed(2)} % · shapes ${(100 * sh.share).toFixed(1)} % (bar ${SHAPE_BAR * 100} %)`);
if (fails.length) console.log(fails.slice(0, +(process.env.SHOW || 25)).join("\n"));
export const RESULT = { ok, n: N, share: sh.share };
