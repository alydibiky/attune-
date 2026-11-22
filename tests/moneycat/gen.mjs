// v10.8 (Ali, 22 Nov 2026: "25000 egp expense under masroof nada for shopping winter clothes" was saved under Others with the whole
// sentence as the note — "fix this generally"). 10,000 money sentences COMPOSED from parts in random order: one of HIS categories
// (English, Franco, Arabic, one or more words, other people's spellings of it), the amount (every way it is written), a money word,
// "under / in / category / تحت / بند …", what it was, a day, fillers — hardened (tests/lib/hard.mjs). Truth written HERE. Checked through
// doit.understandAll with his ledger: one money item, the amount, HIS category, and a note that keeps what it was and drops the amount,
// the currency, the money word and the category phrase. Also cases where a category word is only part of the thing ("car service")
// and built-in words that must not pull a category ("taxi to the shopping mall").
//   node tests/moneycat/gen.mjs        (N=2500 for the unit test; HELD=1 for the held-out set written after the fixes)
import { understandAll } from "../../web-src/doit.js";
import { harden, shapeReport, SHAPE_BAR } from "../lib/hard.mjs";
const N = +(process.env.N || 10000), HELD = !!process.env.HELD;
let seed = 2207 + (HELD ? 6113 : 0); const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
// his categories: how they are saved, and how he may write them
const CATS = HELD ? [
  { id: "c_sara", en: "masroof sara", ar: "مصروف سارة", say: ["masroof sara", "Masroof Sara", "masrouf sara", "مصروف سارة", "مصروف ساره"] },
  { id: "c_club", en: "Club", ar: "النادي", say: ["club", "Club", "النادي", "el nady"] },
  { id: "c_wed", en: "Wedding fund", ar: "فلوس الفرح", say: ["wedding fund", "Wedding Fund", "فلوس الفرح"] },
  { id: "c_mom", en: "Mama", ar: "ماما", say: ["mama", "Mama", "ماما"] }]
  : [{ id: "c_nada", en: "masroof nada", ar: "مصروف ندى", say: ["masroof nada", "Masroof Nada", "masrouf nada", "masroof nda", "مصروف ندى", "مصروف ندي"] },
  { id: "c_car", en: "Car", ar: "العربية", say: ["car", "Car", "العربية", "el 3arabeya"] },
  { id: "c_kids", en: "Kids school", ar: "مدرسة الولاد", say: ["kids school", "Kids School", "مدرسة الولاد"] },
  { id: "c_umrah", en: "Umrah fund", ar: "فلوس العمرة", say: ["umrah fund", "Umrah Fund", "فلوس العمرة"] },
  { id: "c_gym", en: "Gym", ar: "الجيم", say: ["gym", "Gym", "الجيم"] }];
const LEDGER = { currency: "EGP", accounts: [{ id: "a1", name: "Cash", currency: "EGP" }], txns: [], recurring: [], customCats: CATS.map(({ id, en, ar }) => ({ id, en, ar, e: "•" })) };
const WHAT = { en: HELD ? ["new running shoes", "birthday present", "tyre change", "winter jacket", "photographer deposit"] : ["shopping winter clothes", "new shoes", "monthly fee", "oil change", "books and uniform", "hotel deposit", "a dress for the party"],
  ar: HELD ? ["جزمة جري", "هدية عيد ميلاد", "تغيير كاوتش"] : ["هدوم الشتا", "جزمة جديدة", "الاشتراك الشهري", "تغيير زيت", "كتب ويونيفورم", "عربون الفندق"] };
const LEAD = { en: ["under", "under", "in", "category", "for", "on", "under the category", "to"], ar: ["تحت", "تحت", "في", "بند", "على", "من"] };
const VERB = { en: ["expense", "spent", "paid", "", "", "expense of"], ar: ["صرفت", "دفعت", "مصروف", ""] };
const CUR = { en: ["egp", "EGP", "LE", "pounds", "", "", "L.E."], ar: ["جنيه", "ج", "", ""] };
const DAY = { en: ["", "", "", "today", "yesterday"], ar: ["", "", "النهارده", "امبارح"] };
const JOIN = { en: ["for", "for", "—", ",", ":", "-"], ar: ["عشان", "علشان", "—", "،", ":"] };
const AMOUNTS = HELD ? [1750, 4200, 18000, 640, 95000] : [25000, 300, 1200, 850, 60000, 12500, 4000];
const fmtAmt = (n) => pick([String(n), n >= 1000 ? n.toLocaleString("en-US") : String(n), n >= 1000 && n % 1000 === 0 ? n / 1000 + "k" : String(n)]);
function one() {
  const c = pick(CATS), word = pick(c.say), ar = /[؀-ۿ]/.test(word) ? rnd() < 0.75 : rnd() < 0.15, L = ar ? "ar" : "en";
  const amount = pick(AMOUNTS), amt = fmtAmt(amount), cur = pick(CUR[L]), lead = pick(LEAD[L]), what = pick(WHAT[L]), day = pick(DAY[L]), join = pick(JOIN[L]);
  // a bare "850 for Gym monthly fee" may really be a gym subscription — every case says it was spent OR names the category as one
  // (the first runs mixed in such ambiguous cases: the generator's fault)
  let verb = pick(VERB[L]); if (!verb && /^(?:for|on|to|from|على|من)$/.test(lead)) verb = L === "en" ? "spent" : "صرفت";
  const money = [amt, cur].filter(Boolean).join(" ");
  const catP = lead + " " + word, whatP = (join === "for" || join === "عشان" || join === "علشان" ? join + " " : "") + what;
  const sep = () => (join === "for" || join === "عشان" || join === "علشان" ? " " : pick([" ", " ", ", ", " — ", ": "]));
  const orders = [[verb, money, catP, whatP, day], [money, verb, catP, whatP, day], [verb, money, whatP, catP, day], [day, verb, money, catP, whatP], [whatP, money, verb, catP, day]];   // (the first runs' last order left the money word out: the generator's fault)
  let text = pick(orders).filter((x) => x && x.trim()).reduce((a, x, i) => a + (i ? sep() : "") + x, "");
  text = (rnd() < 0.2 ? pick(["ok ", "btw ", "📌 ", "💸 ", "Ali: "]) : "") + text + (rnd() < 0.25 ? pick([" 🙏", ".", "!", " ✅", " thanks"]) : "");
  text = harden(text, rnd, { lang: L, human: true, allowCut: false, keep: what });
  return { L, text, amount, cat: c.id, what, word, lead };
}
const cases = Array.from({ length: N }, one);
let ok = 0; const fails = [];
const norm = (s) => String(s || "").toLowerCase().replace(/[‎‏؜]/g, "").replace(/\s+/g, " ").trim();
for (const c of cases) {
  let r; try { r = understandAll(c.text, { now: Date.parse("2026-11-22T12:00:00"), stores: { "ledger.v3": LEDGER } }); } catch (e) { r = { err: e.message }; }
  const items = ((r && r.actions) || []).filter((a) => a.kind === "money").flatMap((a) => a.items || []);
  const it = items[0]; let why = "";
  if (items.length !== 1) why = items.length ? `${items.length} items` : (r && r.chat ? "went to Chat" : "no money item");
  else if (it.amount !== c.amount) why = `amount ${it.amount}`;
  else if (it.cat !== c.cat) why = `category ${it.cat}`;
  else { const n = norm(it.note), w = norm(c.what).split(" ").filter((x) => x.length > 2);
    if (!w.every((x) => n.includes(x))) why = `note «${it.note}» lost what it was`;
    else if (/\b(?:expense|spent|paid|egp|pounds|under|category)\b|صرفت|دفعت|جنيه|تحت|بند/i.test(n) || /\d{2,}/.test(n)) why = `note «${it.note}» kept money / category words`;
    // the name must leave the note when it was said AS the category ("under Gym"); after "for" / "to" it may be part of the thing
    // ("for car oil change") — the first run counted that as a failure: the generator's fault
    else if (!/^(?:for|to)$/i.test(c.lead) && norm(c.word).split(" ").every((x) => x.length > 2 && n.includes(x)) && !norm(c.what).includes(norm(c.word))) why = `note «${it.note}» kept the category name`; }
  if (!why) ok++; else if (fails.length < 60) fails.push(`[${c.L}] ${JSON.stringify(c.text)} — ${why}`);
}
const sh = shapeReport(cases.map((c) => c.text));
console.log(`${HELD ? "held-out" : "generated"} ${N}: ${ok}/${N} = ${(100 * ok / N).toFixed(2)} % · shapes ${(100 * sh.share).toFixed(1)} % (bar ${SHAPE_BAR * 100} %)`);
if (fails.length) console.log(fails.slice(0, +(process.env.SHOW || 25)).join("\n"));
export const RESULT = { ok, n: N, share: sh.share };
