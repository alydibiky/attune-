// v10.9.12 REPAIR P1 (the money audit, 28 Nov: two InstaPay transfers of 500 to Ahmed and to Mona became ONE — a payment lost; "You
// sent EGP 20" and "charged USD 20" one; two Claude accounts "charged twice"). ONE decision: web-src/dedupe.js samePayment(a, b).
// 10,000 HARD composed PAIRS, as the readers really hold them (paylog entries, Money entries, overpay charges):
//   SAME      one payment seen twice — the bank's SMS + the shop's email (days apart for a receipt), a notification + what the person
//             typed (no time, their own words), the same notification read again (minutes apart) — the payee written another way
//             (CAPITALS, a branch, «سعودي ماركت» / "Seoudi", "Ahmed Ali" / «أحمد علي», a Franco nickname is NOT used: real banks)
//   DIFFERENT two payments with the SAME amount — another payee (two people, two shops, same family name), another currency, another
//             email account, the other direction, the same payee far apart in time
// Every payee / note goes through harden(). node tests/dedupe/gen.mjs [seed]
import { harden, shapeReport } from "../lib/hard.mjs";
const D = await import("../../web-src/dedupe.js");
export const NOW = Date.parse("2026-11-28T12:00:00");
const iso = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
// one payee, several real spellings (Latin as the bank writes it / the shop's own name / Arabic)
const SHOPS = [["SEOUDI MARKET", "Seoudi", "سعودي ماركت"], ["CARREFOUR MAADI", "Carrefour", "كارفور"], ["TALABAT EG", "talabat", "طلبات"], ["AMAZON.EG", "Amazon", "أمازون"],
  ["UBER *TRIP", "Uber", "اوبر"], ["CAREEM", "Careem", "كريم"], ["ELEZABY PHARMACY", "El Ezaby", "العزبي"], ["NETFLIX.COM", "Netflix", "نتفليكس"], ["VODAFONE", "Vodafone", "فودافون"],
  ["ZARA CITY STARS", "Zara", "زارا"], ["SPINNEYS", "Spinneys", "سبينس"], ["KHEIR ZAMAN", "Kheir Zaman", "خير زمان"], ["B.TECH", "B.TECH", "بي تك"], ["NOON", "noon", "نون"]];
const FIRST = [["AHMED", "Ahmed", "أحمد"], ["MONA", "Mona", "منى"], ["OMAR", "Omar", "عمر"], ["SARA", "Sara", "سارة"], ["KARIM", "Karim", "كريم"], ["YOUSSEF", "Youssef", "يوسف"], ["NOUR", "Nour", "نور"], ["HANY", "Hany", "هاني"], ["MARWA", "Marwa", "مروة"], ["TAREK", "Tarek", "طارق"], ["DINA", "Dina", "دينا"], ["MOSTAFA", "Mostafa", "مصطفى"], ["SHERIF", "Sherif", "شريف"], ["LAILA", "Laila", "ليلى"], ["HOSSAM", "Hossam", "حسام"], ["RANA", "Rana", "رنا"]];
const LAST = [["ALI", "Ali", "علي"], ["HASSAN", "Hassan", "حسن"], ["SAMIR", "Samir", "سمير"], ["ADEL", "Adel", "عادل"], ["MAHMOUD", "Mahmoud", "محمود"], ["HELAL", "Helal", "هلال"], ["FAROUK", "Farouk", "فاروق"], ["GAMAL", "Gamal", "جمال"], ["NABIL", "Nabil", "نبيل"], ["RAMADAN", "Ramadan", "رمضان"], ["SALAH", "Salah", "صلاح"], ["ZAKI", "Zaki", "زكي"]];
const PEOPLE0 = [["AHMED ALI", "Ahmed Ali", "أحمد علي"], ["MONA SAMIR", "Mona", "منى سمير"], ["OMAR HASSAN", "Omar", "عمر حسن"], ["SARA ADEL", "Sara Adel", "سارة عادل"],
  ["AHMED HASSAN", "Ahmed Hassan", "أحمد حسن"], ["KARIM MAHMOUD", "Karim", "كريم محمود"], ["NOUR EL DIN", "Nour", "نور الدين"], ["YOUSSEF HELAL", "Youssef", "يوسف هلال"]];
const MAILS = ["ali.work@gmail.com", "ali.home@gmail.com", "a.dibiky@outlook.com"];
export function gen(seed = 23, n = 10000) {
  let st = seed >>> 0; const rnd = () => { st = (st + 0x6D2B79F5) >>> 0; let z = st; z = Math.imul(z ^ (z >>> 15), z | 1); z ^= z + Math.imul(z ^ (z >>> 7), z | 61); return ((z ^ (z >>> 14)) >>> 0) / 4294967296; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const cases = [];
  for (let i = 0; i < n; i++) {
    const mkPerson = () => { const f = pick(FIRST), l = pick(LAST); return [f[0] + " " + l[0], pick([f[1], f[1] + " " + l[1]]), f[2] + " " + l[2]]; };
    const person = rnd() < 0.4, P = person ? mkPerson() : pick(SHOPS), amount = pick([20, 85, 120, 199, 250, 450, 500, 1200, 3899, 9.99, 20.5]), cur = pick(["EGP", "EGP", "EGP", "USD", ""]);
    const at = NOW - Math.floor(rnd() * 20) * 864e5 - Math.floor(rnd() * 8e7), dir = rnd() < 0.85 ? "out" : "in";
    const branch = () => (person ? "" : pick(["", "", " " + pick(["MAADI", "ZAMALEK", "CAIRO EG", "#" + Math.floor(rnd() * 9000), "BR " + Math.floor(rnd() * 40), "CITY STARS", "NASR CITY", "MALL OF ARABIA"])]));   // (a branch only for a shop — banks don't add one to a person's transfer)
    const sp = () => harden(pick(P) + branch(), rnd, { allowCut: false, human: false });
    // the bank's / wallet's notification entry (paylog shape)
    const bank = (t = at) => ({ direction: dir, amount, currency: cur, party: sp(), ts: t, source: "notification", acct: "" });
    // a Money entry the person typed (their own words, no time)
    const typed = () => ({ type: dir === "in" ? "income" : "expense", amount, note: pick([P[1], P[2], P[1].toLowerCase()]) + pick(["", " · Cash", " " + pick(["lunch", "groceries", "تحويل", "dinner", "غدا", "coffee", "gift", "half"])]), date: iso(at), currency: cur });
    // the shop's email receipt (overpay charge shape, days later)
    const email = (d) => ({ type: "charge", amount, currency: cur, merchant: P[1], date: iso(at + d * 864e5), src: { kind: "email", at: at + d * 864e5 }, acct: pick(MAILS) });
    const same = rnd() < 0.5;
    let a, b, o = {}, why;
    if (same) {
      const how = pick(["sms-email", "sms-typed", "sms-again", "typed-sms"]);
      why = how;
      if (how === "sms-email") { if (person || dir === "in") { a = bank(); b = bank(at + Math.floor(rnd() * 9) * 60000); why = "sms-again"; } else { a = bank(); b = email(Math.floor(rnd() * 3)); o = { days: 3, byDay: true }; } }
      if (how === "sms-typed") { a = bank(); b = typed(); }
      if (how === "typed-sms") { a = typed(); b = bank(); }
      if (how === "sms-again") { a = bank(); b = bank(at + Math.floor(rnd() * 9) * 60000 + Math.floor(rnd() * 59000)); }
    } else {
      const how = pick(["other-payee", "other-cur", "other-acct", "other-dir", "far-time", "other-day-typed"]);
      why = how; a = bank();
      // (another person with another first name: "Mona" alone can't tell two Monas apart — nobody could)
      if (how === "other-payee") { let Q; do { Q = person ? mkPerson() : pick(SHOPS); } while (Q[0] === P[0] || (person && Q[0].split(" ")[0] === P[0].split(" ")[0])); b = { ...bank(at + Math.floor(rnd() * 9) * 60000), party: pick(Q) }; }
      if (how === "other-cur") { b = { ...bank(at + 60000), currency: cur === "USD" ? "EGP" : "USD" }; a = { ...a, currency: cur || "EGP" }; }
      if (how === "other-acct") { const [m1, m2] = [pick(MAILS), pick(MAILS.filter((x) => true))]; a = { ...a, acct: m1 }; b = { ...bank(at + 60000), acct: m2 === m1 ? MAILS[(MAILS.indexOf(m1) + 1) % MAILS.length] : m2 }; }
      if (how === "other-dir") b = { ...bank(at + 120000), direction: dir === "in" ? "out" : "in" };
      if (how === "far-time") b = bank(at + (11 + Math.floor(rnd() * 300)) * 60000);
      if (how === "other-day-typed") b = { ...typed(), date: iso(at + (1 + Math.floor(rnd() * 5)) * 864e5) };
    }
    if (rnd() < 0.5) [a, b] = [b, a];
    cases.push({ a, b, o, want: same, why });
  }
  return cases;
}
export const check = (c) => D.samePayment(c.a, c.b, c.o) === c.want;
if (process.argv[1] && process.argv[1].endsWith("gen.mjs")) {
  const cs = gen(+(process.argv[2] || 23)); let good = 0; const by = {}; const ex = [];
  for (const c of cs) { if (check(c)) good++; else { by[c.why] = (by[c.why] || 0) + 1; if (ex.length < 12) ex.push(`[${c.why}] want ${c.want}: ${JSON.stringify(D.viewOf(c.a))} ~ ${JSON.stringify(D.viewOf(c.b))}`); } }
  const sh = shapeReport(cs.map((c) => [D.viewOf(c.a).payee, D.viewOf(c.b).payee, c.why].join(" | ")));
  const uniq = new Set(cs.map((c) => JSON.stringify([D.viewOf(c.a), D.viewOf(c.b)]))).size;
  // (honest: shapeOf blanks every name, and a pair IS two names — so the shape share stays low; the variety is in the names, scripts and
  // branches, counted as different cases)
  console.log(`dedupe 10,000 HARD pairs: ${(good / cs.length * 100).toFixed(2)} % · ${(uniq / cs.length * 100).toFixed(0)} % different cases · ${(sh.share * 100).toFixed(0)} % different shapes (names blanked) · misses ${JSON.stringify(by)}`);
  for (const e of ex) console.log("  " + e.slice(0, 330));
}
