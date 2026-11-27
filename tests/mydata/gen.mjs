// v10.9.9 A2 (Ali picked: "every 'from my data' question, tested like the barber"). 10,000 HARD composed people: each has a month of
// Money (spending in categories and shops, a salary, older months), People & plans (who owes whom, subscriptions), papers with dates,
// reminders and notes — with distractors — and asks ONE of 18 everyday questions about their own data, in English / Egyptian / Franco.
// The answer is checked for the right NUMBER / DATE / NAME, worked out by code from the same data:
//   cat-month, shop-month, last-paid, total-ever, top-cat, subs, owed-in, owed-out, who-owes, expiry, tomorrow, week, appointment,
//   earned, spent-month, about, spent-day, cat-lastmonth
//   node tests/mydata/gen.mjs [seed]   → the score per type, the share of different shapes, the first misses
import { harden, shapeReport } from "../lib/hard.mjs";
const L = await import("../../web-src/lifeask.js");
export const NOW = Date.parse("2026-11-26T15:00:00");
const D = 864e5, iso = (t) => new Date(t).toISOString().slice(0, 10), num = (n) => Math.round(n).toLocaleString("en-US");
const CATS = [["food", ["food", "eating out"], ["الأكل", "الاكل"], ["el akl"]], ["groceries", ["groceries"], ["البقالة", "البقاله"], ["el be2ala"]], ["transport", ["transport", "transportation"], ["المواصلات"], ["el mowasalat"]],
  ["bills", ["bills"], ["الفواتير"], ["el fawateer"]], ["health", ["health"], ["الصحة", "الصحه"], ["el se7a"]], ["shopping", ["shopping"], ["التسوق", "الشوبينج"], ["el shopping"]]];
const SHOPS = [["uber", "transport", ["Uber", "UBER trip", "uber"], ["اوبر"], ["uber"]], ["talabat", "food", ["Talabat", "talabat order", "TALABAT"], ["طلبات"], ["talabat"]],
  ["carrefour", "groceries", ["Carrefour", "carrefour maadi", "CARREFOUR"], ["كارفور"], ["carrefour"]], ["netflix", "bills", ["Netflix", "NETFLIX.COM"], ["نتفليكس"], ["netflix"]],
  ["gym", "health", ["gym membership", "Gold's Gym", "gym"], ["الجيم"], ["el gym"]], ["internet", "bills", ["WE internet", "internet bill", "Vodafone internet"], ["النت"], ["el net"]],
  ["rent", "bills", ["rent", "rent November", "rent for the flat"], ["الإيجار", "الايجار"], ["el egar"]], ["fuel", "transport", ["Total Energies fuel", "fuel", "benzine 92"], ["البنزين"], ["el benzine"]]];
const PEOPLE = ["Ahmed", "Sara", "Mona", "Karim", "Hany", "Omar", "Laila", "Youssef"], PEOPLE_AR = { Ahmed: "أحمد", Sara: "سارة", Mona: "منى", Karim: "كريم", Hany: "هاني", Omar: "عمر", Laila: "ليلى", Youssef: "يوسف" };
const PAPERS = [["passport", ["passport"], ["الباسبور", "جواز السفر"], ["el basbor"]], ["driving licence", ["driving licence", "driver's license"], ["الرخصة", "رخصة السواقة"], ["el ro5sa"]],
  ["car insurance", ["car insurance"], ["تأمين العربية"], ["ta2meen el 3arabeya"]], ["national ID", ["national ID", "ID card"], ["البطاقة"], ["el beta2a"]]];
const APPTS = [["dentist", ["dentist appointment", "dentist"], ["دكتور الاسنان", "الدكتور"], ["el doctor"]], ["haircut", ["barber", "haircut"], ["الحلاق"], ["el 7ala2"]], ["meeting with Karim", ["meeting with Karim"], ["الاجتماع مع كريم"], ["el meeting m3 Karim"]]];
const TYPES = ["cat-month", "shop-month", "last-paid", "total-ever", "top-cat", "subs", "owed-in", "owed-out", "who-owes", "expiry", "tomorrow", "week", "appointment", "earned", "spent-month", "about", "spent-day", "cat-lastmonth"];
export function gen(seed = 7, n = 10000) {
  let st = seed >>> 0; const rnd = () => { st = (st + 0x6D2B79F5) >>> 0; let z = st; z = Math.imul(z ^ (z >>> 15), z | 1); z ^= z + Math.imul(z ^ (z >>> 7), z | 61); return ((z ^ (z >>> 14)) >>> 0) / 4294967296; };
  const pick = (a) => a[Math.floor(rnd() * a.length)], int = (a, b) => a + Math.floor(rnd() * (b - a + 1)), cases = [];
  const monthStart = "2026-11-01", today = iso(NOW);
  for (let i = 0; i < n; i++) {
    const type = TYPES[i % TYPES.length], lang = pick(["en", "en", "en", "ar", "ar", "fr"]);
    const txns = [], life = [], radar = [], reminders = [], memory = []; let id = 0;
    const tx = (o) => txns.push({ id: "t" + id++, type: "expense", account: "a1", ...o });
    // a month of life: shops, categories, older months, a salary
    for (let k = 0, m = int(8, 30); k < m; k++) { const s = pick(SHOPS); tx({ amount: int(20, 2000), cat: s[1], note: pick(s[2]), date: iso(NOW - int(0, 25) * D) }); }
    for (let k = 0, m = int(5, 20); k < m; k++) { const s = pick(SHOPS); tx({ amount: int(20, 2000), cat: s[1], note: pick(s[2]), date: iso(NOW - int(27, 120) * D) }); }
    if (rnd() < 0.8) txns.push({ id: "inc" + id++, type: "income", amount: int(8, 40) * 1000, cat: "salary", note: pick(["salary", "Salary Nov", "مرتب"]), date: iso(NOW - int(0, 24) * D), account: "a1" });
    const ppl = [...PEOPLE].sort(() => rnd() - 0.5);
    for (let k = 0; k < int(0, 3); k++) life.push({ id: "li" + k, kind: "debt", dir: "in", person: ppl[k], amount: int(2, 60) * 100, currency: "EGP", start: iso(NOW - int(2, 60) * D), created: NOW - int(2, 60) * D });
    for (let k = 3; k < 3 + int(0, 2); k++) life.push({ id: "lo" + k, kind: "debt", dir: "out", person: ppl[k], amount: int(2, 60) * 100, currency: "EGP", start: iso(NOW - int(2, 60) * D), created: NOW - int(2, 60) * D });
    const subs = [...SHOPS.filter((s) => ["netflix", "gym", "internet"].includes(s[0]))].filter(() => rnd() < 0.5);
    for (const s of subs) life.push({ id: "s" + s[0], kind: "subscription", title: s[2][0], amount: int(100, 600), currency: "EGP", every: "month", start: iso(NOW - int(60, 400) * D) });
    for (const p of PAPERS) if (rnd() < 0.5) radar.push({ id: "r" + p[0], title: p[1][0].replace(/^./, (c) => c.toUpperCase()), date: iso(NOW + int(-20, 400) * D), kind: "paper" });
    for (const a of APPTS) if (rnd() < 0.5) reminders.push({ id: "m" + a[0], at: NOW + int(-3, 20) * D + int(-5, 5) * 3600e3, title: a[1][0] });
    if (rnd() < 0.6) memory.push({ id: "car", kind: "note", title: "", text: pick(["my car is a Kia Cerato 2019, plate 123 ABC", "car: Hyundai Elantra 2021 — plate س ص ٤٥٦", "the car is a Toyota Corolla 2018"]), ts: NOW - int(20, 300) * D });
    memory.push({ id: "q", kind: "chat", title: "", text: pick(["how much did I spend on food?", "who owes me money?", "when does my passport expire?"]), output: "…", ts: NOW - 60000 });
    const s = { ledger: { currency: "EGP", accounts: [{ id: "a1", currency: "EGP" }], txns }, life: { items: life }, radar: { items: radar }, reminders, memory };
    const exp = txns.filter((t) => t.type === "expense"), inMonth = (t) => t.date >= monthStart && t.date <= today;
    let q = "", want = null, prev = "";
    const say = (en, ar, fr) => (lang === "ar" ? pick(ar) : lang === "fr" ? pick(fr) : pick(en));
    if (type === "cat-month") { const c = pick(CATS), sum = exp.filter((t) => inMonth(t) && t.cat === c[0]).reduce((a, t) => a + t.amount, 0);
      q = say([`how much did I spend on ${pick(c[1])} this month?`, `how much on ${pick(c[1])} this month`, `${pick(c[1])} this month — how much did I spend?`, `what did I spend on ${pick(c[1])} this month?`],
        [`صرفت كام على ${pick(c[2])} الشهر ده؟`, `${pick(c[2])} الشهر ده صرفت فيه كام؟`, `كام صرفت على ${pick(c[2])} الشهر ده`], [`sraft kam 3ala ${pick(c[3])} el shahr da?`, `kam sraft 3la ${pick(c[3])} el shahr da`]);
      want = { num: sum }; }
    if (type === "shop-month") { const sh = pick(SHOPS.filter((x) => !["rent"].includes(x[0]))), sum = exp.filter((t) => inMonth(t) && sh[2].includes(t.note)).reduce((a, t) => a + t.amount, 0);   // (every spelling of the shop — the first run summed only one: a generator mistake)
      if (!sum) { i--; continue; }
      q = say([`how much did I spend on ${sh[0]} this month?`, `how much did I pay for ${sh[0]} this month?`, `${sh[0]} this month, how much?`], [`صرفت كام على ${pick(sh[3])} الشهر ده؟`, `دفعت كام ل${pick(sh[3])} الشهر ده؟`], [`sraft kam 3ala ${pick(sh[4])} el shahr da?`]);
      want = { num: sum }; }
    if (type === "last-paid") { const sh = pick(SHOPS), hits = exp.filter((t) => sh[2].some((v) => t.note === v)).sort((a, b) => b.date.localeCompare(a.date));
      if (!hits.length) { i--; continue; }
      q = say([`when did I last pay for ${sh[0]}?`, `when was the last time I paid ${sh[0]}?`, `last time I paid for ${sh[0]}?`], [`آخر مرة دفعت ${pick(sh[3])} امتى؟`, `امتى آخر مرة دفعت ${pick(sh[3])}`], [`a5er mara dafa3t ${pick(sh[4])} emta?`]);
      want = { date: hits[0].date }; }
    if (type === "total-ever") { const sh = pick(SHOPS), sum = exp.filter((t) => sh[2].some((v) => t.note === v)).reduce((a, t) => a + t.amount, 0);
      if (!sum) { i--; continue; }
      q = say([`how much have I paid for ${sh[0]} in total?`, `how much have I spent on ${sh[0]} so far?`, `total I paid for ${sh[0]}?`], [`دفعت كام على ${pick(sh[3])} لحد دلوقتي؟`, `صرفت كام على ${pick(sh[3])} إجمالًا؟`], [`dafa3t kam 3ala ${pick(sh[4])} le7ad delwa2ty?`]);
      want = { num: sum, notWord: "this month" }; }
    if (type === "top-cat") { const by = {}; for (const t of exp.filter(inMonth)) by[t.cat] = (by[t.cat] || 0) + t.amount; const top = Object.entries(by).sort((a, b) => b[1] - a[1])[0];
      if (!top) { i--; continue; }
      q = say(["where did most of my money go this month?", "what did I spend the most on this month?", "my biggest expense this month?", "what took most of my money this month"], ["فلوسي راحت فين الشهر ده؟", "أكتر حاجة صرفت عليها الشهر ده ايه؟"], ["felousi ra7et fein el shahr da?"]);
      want = { num: top[1], word: top[0] }; }
    if (type === "subs") { if (!subs.length) { i--; continue; }
      // (a Netflix charge in Money in the last 2 months is a subscription too, once per brand — the first run expected only People & plans)
      const fromMoney = exp.some((t) => t.date >= iso(NOW - 62 * D) && /netflix/i.test(t.note)) && !subs.some((x) => x[0] === "netflix") ? 1 : 0;
      q = say(["what are my subscriptions?", "which subscriptions do I pay?", "list my subscriptions"], ["اشتراكاتي ايه؟", "انا مشترك في ايه؟"], ["eshtrakaty eh?"]);
      want = { count: subs.length + fromMoney }; }
    if (type === "owed-in") { const c = life.find((x) => x.dir === "in"); if (!c) { i--; continue; }
      q = say([`how much does ${c.person} owe me?`, `does ${c.person} still owe me money?`, `${c.person} owes me how much?`], [`${PEOPLE_AR[c.person]} عليه كام؟`, `${PEOPLE_AR[c.person]} لسه عليه فلوس ليا؟`], [`${c.person} 3aleh kam?`]);
      want = { num: c.amount, name: c.person }; }
    if (type === "owed-out") { const c = life.find((x) => x.dir === "out"); if (!c) { i--; continue; }
      q = say([`how much do I owe ${c.person}?`, `what do I owe ${c.person}?`, `do I still owe ${c.person} money?`], [`عليا كام ل${PEOPLE_AR[c.person]}؟`, `انا مديون ل${PEOPLE_AR[c.person]} بكام؟`], [`3alaya kam l ${c.person}?`]);
      want = { num: c.amount, name: c.person }; }
    if (type === "who-owes") { const ins = life.filter((x) => x.dir === "in"); if (!ins.length) { i--; continue; }
      q = say(["who owes me money?", "who still owes me?", "people who owe me"], ["مين عليه فلوس ليا؟", "مين لسه عليه فلوس؟"], ["meen 3aleh felous leya?"]);
      want = { num: ins.reduce((a, c) => a + c.amount, 0) }; }
    if (type === "expiry") { const r = radar[0]; if (!r) { i--; continue; } const p = PAPERS.find((x) => x[1][0].toLowerCase() === r.title.toLowerCase());
      q = say([`when does my ${pick(p[1])} expire?`, `when is my ${pick(p[1])} renewal?`, `${pick(p[1])} expiry date?`], [`${pick(p[2])} بتاعي بينتهي امتى؟`, `${pick(p[2])} بتنتهي امتى؟`], [`${pick(p[3])} beyentehy emta?`]);
      want = { date: r.date }; }
    if (type === "tomorrow") { const day = iso(NOW + D), list = reminders.filter((r) => iso(r.at) === day);
      if (!list.length) { const a = pick(APPTS); reminders.push({ id: "tm", at: Date.parse(day + "T10:30:00"), title: a[1][0] }); }
      const t2 = reminders.filter((r) => iso(r.at) === day);
      q = say(["what do I have tomorrow?", "anything planned for tomorrow?", "what's on tomorrow"], ["عندي ايه بكرة؟", "ورايا ايه بكرة؟"], ["3andi eh bokra?"]);
      want = { words: t2.map((r) => r.title) }; }
    if (type === "week") { const end = NOW + 7 * D, list = reminders.filter((r) => r.at >= NOW && r.at <= end).length + radar.filter((x) => x.date >= today && x.date <= iso(end)).length;
      if (!list) { i--; continue; }
      q = say(["what's due this week?", "what do I have this week?", "anything coming up this week?"], ["ورايا ايه الاسبوع ده؟", "عندي ايه الأسبوع ده؟"], ["3andi eh el esbo3 da?"]);
      // (an expired paper IS late — the first run forbade any "already late": a generator mistake; subscriptions and open loans never are)
      const late = radar.filter((x) => x.date < today).length;
      want = { late }; }
    if (type === "appointment") { const r = reminders.filter((x) => x.at >= NOW).sort((a, b) => a.at - b.at)[0]; if (!r) { i--; continue; } const a = APPTS.find((x) => x[1][0] === r.title);
      if (reminders.some((x) => x !== r && x.title === r.title)) { i--; continue; }
      q = say([`when is my ${pick(a[1])}?`, `when do I have the ${pick(a[1])}?`, `what time is my ${pick(a[1])}?`], [`${pick(a[2])} امتى؟`, `ميعاد ${pick(a[2])} امتى؟`], [`${pick(a[3])} emta?`]);
      want = { date: iso(r.at) }; }
    if (type === "earned") { const sum = txns.filter((t) => t.type === "income" && inMonth(t)).reduce((a, t) => a + t.amount, 0); if (!sum) { i--; continue; }
      q = say(["how much did I earn this month?", "my income this month?", "how much money came in this month?"], ["دخلي كام الشهر ده؟", "قبضت كام الشهر ده؟"], ["2abadt kam el shahr da?"]);
      want = { num: sum }; }
    if (type === "spent-month") { const sum = exp.filter(inMonth).reduce((a, t) => a + t.amount, 0);
      q = say(["how much did I spend this month?", "total spending this month?", "what did I spend in total this month?"], ["صرفت كام الشهر ده؟", "مصاريفي الشهر ده كام؟"], ["sraft kam el shahr da?"]);
      want = { num: sum }; }
    if (type === "about") { const car = memory.find((r) => r.id === "car"); if (!car) { i--; continue; }
      q = say(["tell me about my car", "what's my car?", "what do I know about my car?"], ["عربيتي ايه؟", "قولي عن عربيتي"], ["3arabeyty eh?"]);
      want = { words: [car.text.split(" ").slice(3, 5).join(" ")] }; }
    if (type === "spent-day") { const ago = pick([0, 1]), day = iso(NOW - ago * D), sum = exp.filter((t) => t.date === day).reduce((a, t) => a + t.amount, 0);
      q = ago ? say(["how much did I spend yesterday?", "what did I spend yesterday?"], ["صرفت كام امبارح؟"], ["sraft kam embare7?"]) : say(["how much did I spend today?", "what did I spend today?"], ["صرفت كام النهارده؟"], ["sraft kam el naharda?"]);
      want = { num: sum }; }
    if (type === "cat-lastmonth") { const c = pick(CATS), sum = exp.filter((t) => t.date >= "2026-10-01" && t.date <= "2026-10-31" && t.cat === c[0]).reduce((a, t) => a + t.amount, 0);
      q = say([`how much did I spend on ${pick(c[1])} last month?`, `${pick(c[1])} last month, how much?`], [`صرفت كام على ${pick(c[2])} الشهر اللي فات؟`], [`sraft kam 3ala ${pick(c[3])} el shahr elly fat?`]);
      want = { num: sum }; }
    // (more ways people say the same: the month by name, an opener, an ending — composed, not one template per type)
    if (lang === "en" && /this month/.test(q) && rnd() < 0.45) q = q.replace("this month", pick(["in November", "for November", "in Nov", "this month so far".replace(" so far", ""), "during November"]));
    if (lang === "en" && rnd() < 0.3) q = pick(["hey attune, ", "quick q: ", "btw ", "ok so ", "Attune, ", "question: "]) + q;
    if (rnd() < 0.25) q = q.replace(/[?؟]?$/, (m) => pick([" pls?", " 🙏", "?!", " — thanks", "؟؟", "? (roughly)"]));
    q = harden(q, rnd, { human: true, allowCut: false, lang: lang === "ar" ? "ar" : "en", keep: /\d{3,}/ });
    cases.push({ type, lang, q, prev, s, want });
  }
  return cases;
}
const fmtD = (d) => d;
const P = await import("../../web-src/personal.js");
export function check(c) {
  // (what Chat does: your data's readers first, then Mind's answer from your notes — chat.jsx chatAsk → mindAnswer)
  let a = null; try { a = L.chatAsk(c.q, c.s, { now: NOW, prev: c.prev }) || P.mindAnswer(c.q, c.s, { now: NOW }); } catch (e) { return { ok: false, why: "crash " + e.message }; }
  if (!a) return { ok: false, why: "null" };
  const en = String(a.en || "") + " " + (a.rows || []).map((r) => r.join(" ")).join(" "), w = c.want;
  if (w.num != null && !(w.num === 0 ? /\b(?:nothing|no |0\b)/i.test(en) : en.includes(num(w.num)))) return { ok: false, why: "num " + num(w.num), a };
  if (w.date && !en.includes(w.date)) return { ok: false, why: "date " + w.date, a };
  if (w.name && !en.includes(w.name)) return { ok: false, why: "name " + w.name, a };
  if (w.word && !en.toLowerCase().includes(w.word)) return { ok: false, why: "word " + w.word, a };
  if (w.notWord && String(a.en || "").includes(w.notWord)) return { ok: false, why: "said " + w.notWord, a };
  if (w.words && !w.words.every((x) => en.toLowerCase().includes(String(x).toLowerCase()))) return { ok: false, why: "words " + w.words.join("/"), a };
  if (w.count != null && !(new RegExp("\\b" + w.count + " subscription")).test(en)) return { ok: false, why: "count " + w.count, a };
  if (w.late != null && (w.late ? !new RegExp("\\b" + w.late + " already late").test(en) : /already late/.test(en))) return { ok: false, why: "late " + w.late, a };
  return { ok: true };
}
if (process.argv[1] && process.argv[1].endsWith("gen.mjs")) {
  const cs = gen(+(process.argv[2] || 7)); const by = {}, ex = {};
  for (const c of cs) { const r = check(c); const b = (by[c.type] = by[c.type] || { ok: 0, n: 0 }); b.n++; if (r.ok) b.ok++; else if ((ex[c.type] = ex[c.type] || []).length < 2) ex[c.type].push(`[${c.lang}] ${JSON.stringify(c.q)} → ${r.why} | ${r.a ? r.a.kind + ": " + String(r.a.en).slice(0, 90) : ""}`); }
  const good = Object.values(by).reduce((a, b) => a + b.ok, 0), sh = shapeReport(cs.map((c) => c.q)), shAll = shapeReport(cs.map((c) => c.q + " | " + c.s.ledger.txns.map((t) => t.note).join(",") + " | " + c.s.life.items.map((x) => x.person || x.title).join(",")));
  console.log(`mydata 10,000 HARD: ${(good / cs.length * 100).toFixed(2)} % · ${(shAll.share * 100).toFixed(0)} % different cases (question + that person's data) · ${(sh.share * 100).toFixed(0)} % different question shapes`);
  for (const [t, b] of Object.entries(by)) console.log(`  ${t.padEnd(14)} ${(b.ok / b.n * 100).toFixed(1).padStart(5)} %`);
  for (const [t, e] of Object.entries(ex)) for (const x of e) console.log("   ✗ " + t + " " + x);
}
