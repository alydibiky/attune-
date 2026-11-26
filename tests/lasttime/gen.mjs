// v10.9.9 (Ali, 26 Nov 2026: "last time I went to the barber should look on notes, money, everything — I saved it as a note in Money"):
// 10,000 HARD composed people. Each one saved a visit SOMEWHERE (a Money note in another word or language, a name his own note gives the
// place, People & plans, a note that says it was done) among distractors (other spending, his own past questions kept in Mind, a
// reminder for next week, an older visit), then asks "the last time…" in English / Egyptian / Franco, sometimes as a bare follow-up.
// Attune must answer with the date of the newest real visit — never a question, never a future reminder, never another place.
//   node tests/lasttime/gen.mjs [seed]     → the score, the share of different shapes, the first misses
import { harden, shapeReport } from "../lib/hard.mjs";
const L = await import("../../web-src/lifeask.js");
export const NOW = Date.parse("2026-11-26T15:00:00");
const iso = (t) => new Date(t).toISOString().slice(0, 10), D = 864e5;
const PLACES = [
  { key: "barber", ask: ["the barber", "the barbershop", "a haircut", "get a haircut"], askAr: ["الحلاق", "احلق"], askFr: ["el 7ala2"], saved: ["barber", "haircut", "hair cut", "حلاق", "حلاقة", "الحلاق", "Barber", "shave + haircut"], names: ["hany rabee3", "ahmed me8awry", "kareem 7assan", "salon nour"] },
  { key: "dentist", ask: ["the dentist", "the dental clinic"], askAr: ["دكتور الاسنان"], askFr: ["doctor el asnan"], saved: ["dentist", "dental cleaning", "teeth cleaning", "اسنان", "دكتور اسنان"], names: ["dr samir 3adel", "smile clinic2"] },
  { key: "gym", ask: ["the gym"], askAr: ["الجيم"], askFr: ["el gym"], saved: ["gym", "gym session", "جيم", "workout gym"], names: ["gold's gym5", "oxygen club7"] },
  { key: "pharmacy", ask: ["the pharmacy", "the chemist"], askAr: ["الصيدلية"], askFr: ["el saydaleya"], saved: ["pharmacy", "صيدلية", "chemist"], names: ["seif pharmacy9", "el ezaby3"] },
  { key: "mechanic", ask: ["the mechanic", "the garage"], askAr: ["الميكانيكي"], askFr: ["el mekaneeky"], saved: ["mechanic", "garage", "ميكانيكي", "ورشة"], names: ["3am sayed", "ward workshop4"] },
];
const OTHER = ["lunch with ahmed", "Uber", "Carrefour", "electricity", "netflix", "coffee", "taxi", "groceries", "Vodafone recharge", "شاورما", "بنزين ٩٢"];
export function gen(seed = 7, n = 10000) {
  let st = seed >>> 0; const rnd = () => { st = (st + 0x6D2B79F5) >>> 0; let z = st; z = Math.imul(z ^ (z >>> 15), z | 1); z ^= z + Math.imul(z ^ (z >>> 7), z | 61); return ((z ^ (z >>> 14)) >>> 0) / 4294967296; };
  const pick = (a) => a[Math.floor(rnd() * a.length)], cases = [];
  for (let i = 0; i < n; i++) {
    const P = pick(PLACES), others = PLACES.filter((x) => x !== P);
    const lastAgo = 1 + Math.floor(rnd() * 60), last = iso(NOW - lastAgo * D);
    const memory = [], txns = [], life = [], reminders = [];
    const name = pick(P.names); let viaName = false;
    // how the newest visit was saved
    const how = pick(["money", "money", "money-name", "note-done", "life"]);
    const amt = 50 + Math.floor(rnd() * 400);
    if (how === "money") txns.push({ id: "v", type: "expense", amount: amt, cat: pick(["other", "personal", "health", "car"]), note: pick(P.saved) + (rnd() < 0.3 ? " " + pick(["", "tip", "+ tip", "w tip"]) : ""), date: last, account: "a1" });
    if (how === "money-name") { viaName = true; txns.push({ id: "v", type: "expense", amount: amt, cat: "other", note: (rnd() < 0.5 ? name : name.toUpperCase()) + pick(["", " ✂️", " cash"]), date: last, account: "a1" }); }
    if (how === "note-done") memory.push({ id: "nd", kind: "note", title: "", text: pick(["went to ", "today I went to ", "روحت "]) + pick(P.saved), ts: Date.parse(last + "T12:00:00") });
    if (how === "life") life.push({ id: "l1", kind: pick(["visit", "appointment"]), title: pick(P.saved), person: "", start: last, created: Date.parse(last) });
    // his note that says who / where the place is (always when the visit was saved by name)
    if (viaName || rnd() < 0.5) memory.push({ id: "who", kind: "note", title: "", text: pick(["that in the ", "my ", "the ", "for the "]) + P.saved[0] + pick([" I go to ", " is ", " = ", ": "]) + name + pick(["", " near the club", " every month"]), ts: NOW - (70 + Math.floor(rnd() * 100)) * D });
    // an older visit
    if (rnd() < 0.6) txns.push({ id: "old", type: "expense", amount: amt, cat: "other", note: pick(P.saved), date: iso(NOW - (lastAgo + 5 + Math.floor(rnd() * 80)) * D), account: "a1" });
    // distractors: other spending newer than the visit, his own questions, a reminder next week, another place's visit
    for (let k = 0, m = 1 + Math.floor(rnd() * 5); k < m; k++) txns.push({ id: "o" + k, type: "expense", amount: 20 + Math.floor(rnd() * 900), cat: "food", note: pick(OTHER), date: iso(NOW - Math.floor(rnd() * lastAgo) * D), account: "a1" });
    if (rnd() < 0.7) memory.push({ id: "q" + i, kind: pick(["chat", "ask", "note"]), title: "", text: pick(["Last time I went to ", "when did I last go to ", "Tell me about my ", "who is my "]) + pick(P.ask), output: "", ts: NOW - 60000 });
    if (rnd() < 0.4) reminders.push({ id: "r1", at: NOW + (1 + Math.floor(rnd() * 9)) * D, title: pick(P.saved) + pick(["", " appointment", " at 5"]) });
    if (rnd() < 0.5) { const O = pick(others); txns.push({ id: "x", type: "expense", amount: 300, cat: "other", note: pick(O.saved), date: iso(NOW - Math.floor(rnd() * lastAgo) * D), account: "a1" }); }
    // the question
    const lang = pick(["en", "en", "en", "ar", "fr"]), thing = lang === "ar" ? pick(P.askAr) : lang === "fr" ? pick(P.askFr) : pick(P.ask);
    let q, prev = "";
    if (lang === "en") q = pick([`when is the last time I went to ${thing}`, `when did I last go to ${thing}`, `last time I went to ${thing}?`, `when was the last time I went to ${thing}`, `hey, when did I last ${/^get/.test(thing) ? thing : "go to " + thing}?`, `quick q: last time I went to ${thing}??`]);
    if (lang === "ar") q = pick([`اخر مرة روحت ${thing} امتى؟`, `امتى اخر مرة روحت ${thing}`, `آخر مره روحت ${thing} كان امتى`]);
    if (lang === "fr") q = pick([`a5er mara ro7t ${thing} emta?`, `emta a5er mara ro7t ${thing}`]);
    if (lang === "en" && rnd() < 0.2) { prev = pick([`tell me about my ${P.ask[0].replace(/^the /, "")}`, `Tell me about my ${P.ask[0].replace(/^the /, "")}`]); q = pick(["When is the last time I went", "when is the last time I went?", "last time I went?"]); }
    if (lang === "fr") q = q.replace("a5er mara ro7t", "a5er mara ro7t");
    q = harden(q, rnd, { human: true, allowCut: false, lang: lang === "ar" ? "ar" : "en" });
    cases.push({ q, prev, stores: { memory, life: { items: life }, reminders, ledger: { currency: "EGP", accounts: [{ id: "a1", currency: "EGP" }], txns } }, want: last, place: P.key, how });
  }
  return cases;
}
export function check(c) { const a = L.chatAsk(c.q, c.stores, { now: NOW, prev: c.prev }); return !!(a && a.kind === "last" && a.v && a.v.d === c.want); }
if (process.argv[1] && process.argv[1].endsWith("gen.mjs")) {
  const cs = gen(+(process.argv[2] || 7)); let good = 0; const bad = {}; const ex = [];
  for (const c of cs) { if (check(c)) good++; else { bad[c.how] = (bad[c.how] || 0) + 1; if (ex.length < 12) { const a = L.chatAsk(c.q, c.stores, { now: NOW, prev: c.prev }); ex.push(`[${c.how}/${c.place}] ${JSON.stringify(c.q)}${c.prev ? " (after " + JSON.stringify(c.prev) + ")" : ""} want ${c.want} → ${a ? a.en : "null"}`); } } }
  const sh = shapeReport(cs.map((c) => c.q + " | " + c.stores.ledger.txns.map((t) => t.note).join(",")));
  console.log(`lasttime 10,000 HARD: ${(good / cs.length * 100).toFixed(2)} % · ${(sh.share * 100).toFixed(0)} % different shapes · misses by how ${JSON.stringify(bad)}`);
  for (const e of ex) console.log("  " + e);
}
