/* ---- v8.7 (persona 8 M-C / persona 4 idea 7): the router — a tiny model that says where a sentence belongs -------------------
   Multinomial naive Bayes over character 2–4-grams (word-boundary marked), trained on the built-in examples below in English,
   Egyptian Arabic and Franco, plus the person's own choices (learn()). < 1 ms, a few KB, no download, works for any script.
   Classes: money · food · reminder · health · todo · translate · open · question (= the AI answers).
   SHADOW MODE first: when the Home readers find nothing, the page records what the router would have said next to the sentence
   ("Copy what Home didn't understand" in Engine shows both), so we measure it on real phones before it changes anything.
   Pure: text in, { kind, p } out. Tests: tests/unit/v870homeroute.test.mjs (router.js is the other router: which MODEL answers a question).                                                      */
const EX = {
  money: ["spent 200 on lunch", "paid 1500 rent", "uber 85", "got my salary 20000", "coffee 45", "bought shoes for 900", "groceries 650 from carrefour", "noon order 1200", "elmenus 300",
    "صرفت 200 على الغدا", "دفعت الايجار 3000", "اوبر 85", "قبضت المرتب", "اشتريت جزمة ب 900", "كارفور 650", "sraft 200 3la el akl", "dafa3t el egar", "transferred 500 to ahmed", "حولت 500 لأحمد"],
  food: ["ate 2 eggs and toast", "had koshary for lunch", "breakfast oatmeal with banana", "drank a coffee with milk", "dinner grilled chicken and rice",
    "كلت طبق كشري", "فطرت فول وطعمية", "اتعشيت فراخ ورز", "شربت قهوة بلبن", "kalt koshary", "fetart fool w ta3meya", "snack an apple"],
  reminder: ["remind me to call mom at 6", "wake me at 7", "alarm 6:30", "remind me tomorrow to pay the internet", "every friday remind me to water the plants",
    "فكرني اكلم ماما الساعة 6", "صحيني 7", "فكرني بكرة ادفع النت", "كل جمعة فكرني اسقي الزرع", "fakarny akalem mama", "sa7eeny 7", "set a timer for 10 minutes"],
  health: ["my blood pressure 120/80", "sugar 140", "took my pills", "slept 7 hours", "weight 82 kg", "headache since morning",
    "ضغطي 120 على 80", "السكر 140", "خدت الدوا", "نمت 7 ساعات", "وزني 82", "sokkary 140", "da8ty 13 3ala 8"],
  todo: ["todo buy a charger", "add to my list fix the door", "i need to renew my passport", "don't forget to book the dentist",
    "لازم اجدد الباسبور", "ضيف للحاجات اللي عليا اصلح الباب", "محتاج اشتري شاحن", "lazem ag'aded el passport"],
  translate: ["translate good morning to french", "how do you say thank you in german", "what is apple in spanish",
    "ترجم صباح الخير بالانجليزي", "يعني ايه serendipity", "ezay a2ool shokran bel almany"],
  open: ["open maps", "open money", "go to fit", "show my reminders", "open the metro", "افتح الخريطة", "افتح الفلوس", "وريني التفكير", "efta7 el metro"],
  question: ["what is the capital of japan", "why is the sky blue", "explain how a car engine works", "write an email to my boss asking for leave",
    "how do i make pasta", "is coffee bad for you", "summarize this article", "give me ideas for a birthday",
    "ايه عاصمة اليابان", "ليه السما زرقا", "اشرحلي المحرك بيشتغل ازاي", "اكتب ايميل لمديري", "اكتبلي بوست عن السفر", "اعمل مكرونة ازاي", "eh a7san mobile", "ezay a3mel cv"],
};
export const KINDS = Object.keys(EX);
export const ROUTER_KEY = "attune:homeroute:v1";

const fold = (s) => String(s || "").toLowerCase().replace(/[إأآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/\d+/g, "0").replace(/[^\p{L}\p{N}:/ ]+/gu, " ").replace(/\s+/g, " ").trim();
/** The features: character 2–4-grams of each word (with ^ $ edges), and the words themselves. */
export function grams(s) {
  const out = [];
  for (const w of fold(s).split(" ")) {
    if (!w) continue;
    out.push("w:" + w);
    const x = "^" + w + "$";
    for (let n = 2; n <= 4; n++) for (let i = 0; i + n <= x.length; i++) out.push(x.slice(i, i + n));
  }
  return out;
}

/** A model from examples ({ kind: [text] }) → { count: {kind: {gram: n}}, total: {kind: n}, docs: {kind: n}, vocab } */
export function train(ex = EX, extra = []) {
  const m = { count: {}, total: {}, docs: {}, vocab: new Set() };
  const add = (kind, text, w = 1) => {
    if (!KINDS.includes(kind)) return;
    const c = (m.count[kind] = m.count[kind] || {});
    for (const g of grams(text)) { c[g] = (c[g] || 0) + w; m.total[kind] = (m.total[kind] || 0) + w; m.vocab.add(g); }
    m.docs[kind] = (m.docs[kind] || 0) + 1;
  };
  for (const [k, list] of Object.entries(ex)) for (const t of list) add(k, t);
  for (const e of extra) add(e.kind, e.text, 3);   // the person's own choices weigh 3 examples
  return m;
}

/** → { kind, p, all: [[kind, p]] } — p is the share of the probability (softmax of the log scores). */
export function route(model, text) {
  const g = grams(text), V = model.vocab.size + 1, D = Object.values(model.docs).reduce((a, b) => a + b, 0);
  const score = KINDS.map((k) => {
    const c = model.count[k] || {}, T = model.total[k] || 0;
    let s = Math.log(((model.docs[k] || 0) + 1) / (D + KINDS.length));
    for (const x of g) s += Math.log(((c[x] || 0) + 0.5) / (T + 0.5 * V));
    return [k, s];
  });
  const mx = Math.max(...score.map((x) => x[1])), ex = score.map(([k, s]) => [k, Math.exp(s - mx)]), Z = ex.reduce((a, x) => a + x[1], 0);
  const all = ex.map(([k, e]) => [k, e / Z]).sort((a, b) => b[1] - a[1]);
  return { kind: all[0][0], p: Math.round(all[0][1] * 1000) / 1000, all };
}

let cached = null;
const loadLearned = () => { try { const v = JSON.parse(localStorage.getItem(ROUTER_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
/** The router with the built-in examples and this phone's learned choices (built once). */
export function router() { if (!cached) cached = train(EX, typeof localStorage !== "undefined" ? loadLearned() : []); return cached; }
/** The person picked where a sentence belongs → remembered (the last 300), the router rebuilt. */
export function learn(text, kind) {
  if (!KINDS.includes(kind) || !String(text || "").trim()) return;
  try { const l = loadLearned().filter((x) => x.text !== text); l.push({ text: String(text).slice(0, 200), kind }); localStorage.setItem(ROUTER_KEY, JSON.stringify(l.slice(-300))); } catch (e) {}
  cached = null;
}
/** Shadow mode: what the router would say for a sentence the readers missed. */
export const guess = (text) => { try { const r = route(router(), text); return { kind: r.kind, p: r.p }; } catch (e) { return null; } };
