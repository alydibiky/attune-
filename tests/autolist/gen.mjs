// v10.9.8 (Ali's OK-W4: "things by categories that seem similar under 1 category … each one a checkbox like the to-do, done
// automatically"). EXACTLY 10,000 HARD sentences COMPOSED from parts in random order: who asks and how (English, Egyptian Arabic,
// Franco; "buy / get / pick up / we're out of / I need", «هات / اشتري / محتاج / ناقصنا», "hat / e4tery / me7tag"), 1–5 items from
// six kinds in any of the three languages, with quantities ("2 kilo", «علبة», "a bottle of"), joined by ", / and / & / w / و", fillers
// in front and behind — and the sentences that must NEVER become a list (money spent, a reminder at a time, an agent's price, a
// question, a chat). Truth is written HERE (not read from the app). HARD: tests/lib/hard.mjs harden() (human: true).
//     node tests/autolist/gen.mjs [count]        (SEED_SHIFT=n → a held-out set)
const mem = {}; globalThis.localStorage = globalThis.localStorage || { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; }, key: () => null, length: 0 };
const { readShopping } = await import("../../web-src/autolist.js");
const { harden, shapeReport, SHAPE_BAR } = await import("../lib/hard.mjs");

// [english, arabic, franco] per thing, by kind (the truth)
const THINGS = {
  groceries: [["milk", "لبن", "laban"], ["eggs", "بيض", "beid"], ["bread", "عيش", "3eish"], ["rice", "رز", "roz"], ["sugar", "سكر", "sokkar"], ["oil", "زيت", "zeit"], ["cheese", "جبنة", "gebna"],
    ["butter", "زبدة", "zebda"], ["yogurt", "زبادي", "zabadi"], ["tea", "شاي", "shay"], ["coffee", "قهوة", "ahwa"], ["pasta", "مكرونة", "makarona"], ["tomatoes", "طماطم", "tamatem"],
    ["potatoes", "بطاطس", "batates"], ["onions", "بصل", "basal"], ["chicken", "فراخ", "ferakh"], ["meat", "لحمة", "la7ma"], ["fish", "سمك", "samak"], ["bananas", "موز", "mooz"],
    ["apples", "تفاح", "toffa7"], ["flour", "دقيق", "de2ee2"], ["salt", "ملح", "malh"], ["juice", "عصير", "3aseer"], ["lentils", "عدس", "3ads"], ["honey", "عسل", "3asal"], ["tuna", "تونة", "tuna"], ["cucumbers", "خيار", "khiyar"], ["lemons", "ليمون", "lamoon"]],
  pharmacy: [["panadol", "بنادول", "panadol"], ["vitamins", "فيتامينات", "vitamin"], ["bandages", "شاش", "shash"], ["brufen", "بروفين", "brufen"], ["cough syrup", "شراب كحة", "dawa"], ["insulin", "انسولين", "insulin"], ["plasters", "بلاستر", "plaster"]],
  home: [["detergent", "مسحوق", "mas7oo2"], ["soap", "صابون", "sabon"], ["shampoo", "شامبو", "shampoo"], ["toilet paper", "ورق تواليت", "manadeel"], ["tissues", "مناديل", "manadeel"], ["bleach", "كلور", "kolor"],
    ["sponges", "سفنج", "sfong"], ["trash bags", "أكياس زبالة", "akyas zbala"], ["toothpaste", "معجون أسنان", "ma3goon"], ["dish soap", "فيري", "fairy"]],
  clothes: [["socks", "جوارب", "shorrab"], ["a shirt", "قميص", "amees"], ["jeans", "بنطلون جينز", "bantalon"], ["shoes", "جزمة", "gazma"], ["a jacket", "جاكيت", "jaket"], ["pyjamas", "بيجامة", "bejama"]],
  electronics: [["a charger", "شاحن", "sha7en"], ["a cable", "كابل", "cable"], ["headphones", "سماعات", "sama3at"], ["batteries", "بطاريات", "battarya"], ["a power bank", "باور بانك", "powerbank"], ["a phone case", "جراب", "garab"]],
  gifts: [["flowers", "ورد", "ward"], ["a gift", "هدية", "hedeya"], ["a birthday card", "كارت معايدة", "kart mo3ayda"], ["balloons", "بالونات", "balonat"], ["a toy", "لعبة", "lo3ba"]],
};
const Q = { en: ["2 ", "a bottle of ", "a pack of ", "1 kg ", "some ", "half a kilo of ", "a box of ", "3 "], ar: ["٢ ", "علبة ", "كيلو ", "ازازة ", "نص كيلو ", "باكو "], fr: ["2 ", "kilo ", "3elbet ", "nos kilo "] };
const VERB = {
  en: ["buy ", "get ", "pick up ", "grab ", "we need ", "i need ", "need to buy ", "please buy ", "don't forget to buy ", "we're out of ", "can you buy ", "remember to get ", "shopping: "],
  ar: ["هات ", "اشتري ", "محتاج ", "لازم نشتري ", "ناقصنا ", "جيب ", "عايز اشتري ", "هاتي ", "ياريت تجيب "],
  fr: ["hat ", "e4tery ", "eshtery ", "me7tag ", "gib ", "lazem eshtery ", "na2esna ", "3ayez "],
};
const AND = { en: [", ", " and ", " & ", ", and "], ar: [" و", "، ", " و ", "، و"], fr: [" w ", ", ", " we "] };
const PRE = { en: ["", "", "", "hey Attune, ", "ok ", "btw ", "Attune ", "um "], ar: ["", "", "", "يا أتيون ", "معلش ", "بص ", "طب "], fr: ["", "", "", "ya attune ", "bos ", "tab "] };
const POST = { en: ["", "", "", " please", " thanks", " 🙏", " pls", " for the house"], ar: ["", "", "", " لو سمحت", " 🙏", " شكرا", " للبيت"], fr: ["", "", "", " law sama7t", " 🙏", " shokran"] };
// must never become a list — and they need the details of a real one to be tempting
const NEVER = [
  (it, r) => `I bought ${it} ${r} EGP`, (it, r) => `paid ${r} for ${it}`, (it, r) => `اشتريت ${it} ب ${r}`, (it, r) => `spent ${r} on ${it}`, (it, r) => `${it} ${r}`,
  (it) => `remind me to buy ${it} tomorrow at 5`, (it) => `فكرني اشتري ${it} بكرة`, (it) => `fakarny eshtery ${it} bokra`, (it) => `remind me at 6 to get ${it}`,
  (it, r) => `buy me ${it} under ${r}`, (it, r) => `tell me when ${it} is under ${r}`, (it) => `order ${it} from talabat`, (it) => `اطلب ${it} من طلبات`,
  (it) => `how much is ${it}?`, (it) => `where do I buy ${it}?`, (it) => `did I buy ${it}?`, (it) => `${it} فين؟`, (it) => `should I buy ${it}?`,
];
export function run(total = 10000, shift = 0, { quiet = false } = {}) {
  let seed = 20261125 + 7919 * shift; const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const kinds = Object.keys(THINGS), cases = [];
  for (let i = 0; i < total; i++) {
    const L = pick(["en", "en", "ar", "fr"]), li = { en: 0, ar: 1, fr: 2 }[L];
    if (rnd() < 0.25) {   // a sentence that must not become a list
      const k = pick(kinds), it = pick(THINGS[k])[li === 2 ? 0 : li], r = pick(["150", "250", "1,200", "5000", "75", "3,400"]);
      cases.push({ q: harden(pick(PRE[L]) + pick(NEVER)(it, r), rnd, { human: true, allowCut: false }), want: null }); continue;
    }
    const n = 1 + Math.floor(rnd() * (rnd() < 0.3 ? 5 : 3)), used = new Set(), items = [];
    while (items.length < n) {
      const k = pick(rnd() < 0.55 ? ["groceries"] : kinds), t = pick(THINGS[k]); if (used.has(t[0])) continue; used.add(t[0]);
      const lang = rnd() < 0.8 ? li : pick([0, 1, 2]);   // mixed: "هات milk و عيش"
      let w = t[lang]; if (rnd() < 0.25 && !/^a /.test(w)) w = pick(Q[["en", "ar", "fr"][lang]]) + w;
      items.push({ k, w });
    }
    const and = AND[L];
    let list = items.map((x) => x.w).reduce((a, w, j) => (j === 0 ? w : a + (j === items.length - 1 ? pick(and) : pick([", ", "، "].includes(pick(and)) ? and : [", "])) + w), "");
    list = list.replace(/ و (?=\S)/g, pick([" و", " و "]));
    // the shape people write a list in: one line, one item per line, bullets, numbered, a header first
    const shape = rnd();
    if (shape < 0.18) { const b = pick(["- ", "• ", "* ", "", "▫️ "]); list = "\n" + items.map((x, j) => (pick([b, (j + 1) + ") ", (j + 1) + ". "])) + x.w).join("\n"); }
    else if (shape < 0.26) list = items.map((x) => x.w).join(pick([" + ", " / ", "; ", ",", " ، "]));
    const head = shape < 0.18 && rnd() < 0.5 ? pick(L === "en" ? ["shopping list:", "for the house:", "need from the market:", "supermarket:"] : L === "ar" ? ["طلبات البيت:", "مشتريات:", "من السوبر ماركت هات:"] : ["talabat el beit:", "hat men el market:"]) : "";
    const PRE2 = L === "en" ? ["", "", "", "hey, ", "Attune — ", "quick one: ", "on your way home ", "when you go out "] : L === "ar" ? ["", "", "", "وانت راجع ", "بعد الشغل ", "لو نزلت "] : ["", "", "", "w enta rage3 ", "law nzelt "];
    const q = (head ? head + "\n" : pick(PRE[L]) + pick(PRE2) + pick(VERB[L])) + list + pick(POST[L]) + (rnd() < 0.2 ? pick(["!", "!!", ".", " :)", " x"]) : "");
    const want = {}; for (const x of items) want[x.k] = (want[x.k] || 0) + 1;
    cases.push({ q: harden(q, rnd, { human: true, allowCut: false }), want, items });
  }
  let ok = 0; const bad = [], by = { list: [0, 0], never: [0, 0] };
  for (const c of cases) {
    let r = null; try { r = readShopping(c.q); } catch (e) { r = { err: String(e) }; }
    let good;
    if (!c.want) good = r == null;
    else { const got = {}; for (const g of (r && r.groups) || []) got[g.cat] = g.items.length; good = !!r && !(r.rest || []).length && JSON.stringify(Object.keys(got).sort().map((k) => [k, got[k]])) === JSON.stringify(Object.keys(c.want).sort().map((k) => [k, c.want[k]])); }
    const key = c.want ? "list" : "never"; by[key][1]++; if (good) { ok++; by[key][0]++; } else if (bad.length < 40) bad.push(`${key} | ${JSON.stringify(c.q)} → ${JSON.stringify(r && (r.groups || r.err))}${r && r.rest && r.rest.length ? " rest " + JSON.stringify(r.rest) : ""} | want ${JSON.stringify(c.want)}`);
  }
  const sh = shapeReport(cases.map((c) => c.q));
  if (!quiet) { console.log(Object.entries(by).map(([k, [a, b]]) => `${k} ${a}/${b}`).join(" · ")); for (const b of bad.slice(0, 25)) console.log("  ✗ " + b); }
  return { ok, total: cases.length, shapes: sh, by, bad };
}
if (import.meta.url === "file://" + process.argv[1]) {
  const r = run(+(process.argv[2] || 10000), +(process.env.SEED_SHIFT || 0));
  console.log(`shopping lists: ${r.ok} / ${r.total} right (${(100 * r.ok / r.total).toFixed(2)} %) · ${r.shapes.shapes} different shapes (${(100 * r.shapes.share).toFixed(1)} %, bar ${100 * SHAPE_BAR} %)`);
}
