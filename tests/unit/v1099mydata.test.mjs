// v10.9.9 A2 (Ali picked: every "from my data" question tested like the barber). The wrong answers the first probe found, kept fixed,
// and a 2,500 sample of tests/mydata/gen.mjs (10,000 HARD composed people, 18 kinds of question, English / Egyptian / Franco).
const L = await import("../../web-src/lifeask.js");
const { egyToEnglish } = await import("../../web-src/egyask.js");
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c || process.env.V) console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };
const now = Date.parse("2026-11-26T15:00:00"), D = 864e5;
const st = {
  ledger: { currency: "EGP", accounts: [{ id: "a1", currency: "EGP" }], txns: [
    { id: "t1", type: "expense", amount: 9000, cat: "rent", note: "rent November", date: "2026-11-01", account: "a1" },
    { id: "t2", type: "expense", amount: 850, cat: "transport", note: "Total Energies fuel", date: "2026-11-22", account: "a1" },
    { id: "t3", type: "expense", amount: 120, cat: "transport", note: "Uber", date: "2026-11-20", account: "a1" },
    { id: "t5", type: "expense", amount: 535, cat: "groceries", note: "Carrefour", date: "2026-11-18", account: "a1" },
    { id: "t6", type: "expense", amount: 300, cat: "food", note: "Talabat koshary", date: "2026-11-24", account: "a1" },
    { id: "t7", type: "expense", amount: 600, cat: "health", note: "gym membership", date: "2026-11-03", account: "a1" },
    { id: "t8", type: "income", amount: 25000, cat: "salary", note: "salary", date: "2026-11-25", account: "a1" },
    { id: "t9", type: "expense", amount: 240, cat: "bills", note: "NETFLIX.COM", date: "2026-11-10", account: "a1" },
    { id: "t10", type: "expense", amount: 700, cat: "transport", note: "benzine 92", date: "2026-11-05", account: "a1" },
    { id: "t11", type: "expense", amount: 9000, cat: "rent", note: "rent October", date: "2026-10-01", account: "a1" } ] },
  life: { items: [ { id: "l1", kind: "debt", dir: "in", person: "Laila", amount: 2000, currency: "EGP", start: "2026-11-05", created: Date.parse("2026-11-05") },
    { id: "l2", kind: "debt", dir: "out", person: "Sara", amount: 1500, currency: "EGP", start: "2026-11-02", created: Date.parse("2026-11-02") },
    { id: "l3", kind: "subscription", title: "Netflix", amount: 240, currency: "EGP", every: "month", start: "2026-01-10" } ] },
  radar: { items: [ { id: "r1", title: "Passport", date: "2027-03-03", kind: "paper" } ] },
  reminders: [ { id: "m1", at: now + D - 3 * 3600e3, title: "call the bank" }, { id: "m2", at: now + 3 * D, title: "dentist appointment" } ],
  memory: [ { id: "n2", kind: "note", text: "my car is a Kia Cerato 2019, plate 123 ABC", ts: now - 40 * D } ] };
const P = await import("../../web-src/personal.js");
const A = (q, prev) => L.chatAsk(q, st, { now, prev }) || P.mindAnswer(q, st, { now }) || { en: "", kind: "null" };   // (what Chat does)
const has = (q, re, m) => { const a = A(q); ok(re.test(a.en + " " + (a.rows || []).map((r) => r.join(" ")).join(" ")), m + " — «" + q + "» → " + a.kind + ": " + a.en.slice(0, 90)); };
has("where did most of my money go this month?", /Most went on rent/i, "a ranking, never a list of due dates");
has("when is my dentist appointment?", /2026-11-29/, "an appointment is the reminder's date, never Health spending");
has("how much do I owe Sara?", /owe Sara 1,500/, "one person's debt, not every commitment");
ok(!/already late/.test(A("what's due this week?").en), "a monthly subscription is never 'already late'");
has("آخر مرة دفعت الإيجار امتى؟", /2026-11-01/, "Egyptian: the last rent");
has("a5er mara dafa3t el egar emta?", /2026-11-01/, "Franco: the last rent");
has("tell me about my car", /Kia Cerato/, "about my car → the note");
has("how much on transport this month?", /1,670/, "a category with no 'my' (850 + 120 + 700)");
has("how much have I paid for rent in total?", /18,000/, "in total → all time, never 'this month'");
has("how much did I spend on fuel this month?", /1,550/, "fuel counts 'benzine 92' too (850 + 700)");
has("what are my subscriptions?", /1 subscription/, "NETFLIX.COM in Money and Netflix in People & plans = one");
has("ليلى عليها كام؟", /2,000/, "«ليلى» is Laila (a name that starts with ل is not «ل» + name)");
has("how much did I spend for November?", /You spent [\d,]+ EGP\b.*November|November/, "November is when, not a shop");
ok(egyToEnglish("صرفت كام على الأكل الشهر ده؟") === "how much did I spend on food this month?", "Egyptian → English frame: " + egyToEnglish("صرفت كام على الأكل الشهر ده؟"));
ok(egyToEnglish("sraft kam 3ala el akl el shahr da?") === "how much did I spend on food this month?", "Franco → the same English");
ok(egyToEnglish("hello there") === "" && egyToEnglish("ازيك عامل ايه") === "", "small talk is not a question about your data");
// (the full browser run: "Tell me about an oriental restaurant page" was answered "Nothing is recorded in Money" — the "me" of "tell me")
for (const q of ["What is still open this week?", "Tell me about an oriental restaurant page", "show me a recipe for koshary", "tell me about the history of Egypt", "give me 3 tips to sleep better", "Tell me about a crane simulator page"])
  ok(!L.chatAsk(q, st, { now }), "a general question is never answered from your data: «" + q + "»");
// 2,500 sample
const G = await import("../mydata/gen.mjs");
for (const [seed, nn] of [[7, 2500], [9, 1000]]) { const cs = G.gen(seed, nn); const good = cs.filter((c) => G.check(c).ok).length;
  console.log(`mydata seed ${seed}: ${(good / nn * 100).toFixed(2)} %`); ok(good / nn >= 0.99, `every-day 'my data' questions, seed ${seed} ≥ 99 %`); }
console.log(fail ? `FAIL ${fail} of ${n}` : `ALL PASSED v1099mydata (${n} checks)`);
if (fail) process.exit(1);
