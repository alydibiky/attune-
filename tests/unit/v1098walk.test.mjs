// v10.9.8 the new-user walk-through (24 Nov 2026): a typical Egyptian phone that is NOT Ali's — Arabic + English bank SMS, a wallet,
// an OTP, an advert, a salary, a refund, an ATM withdrawal, a declined payment, a dollar charge — through the first minute.
// Mistakes it found (each one checked here, plain and HARD — every message 200× through tests/lib/hard.mjs harden()):
//   1. a 9.99 USD Netflix charge was written into the pound account as 9.99 EGP (no account held dollars)
//   2. Netflix was "transport": "tfl" (London transport) matched inside "neTFLix" — brands now match only where a word starts
//   3. InstaPay «إلى محمد سامي بنجاح» kept «بنجاح» ("successfully") in the name
//   4. «ماكينة الصراف الآلي فرع» (cut half-way) instead of "ATM"
//   5. a transfer and an ATM withdrawal were "bills": the bank's «رصيدك» (your balance) read as phone credit
//   6. a wallet's «تم شحن رصيد 100 جنيه» (airtime bought) was missed — the balance in the NEXT sentence pulled the 100 down
const mem = {}; globalThis.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; }, key: () => null, length: 0 };
const { readNotification, categorise, appendToLedger } = await import("../../web-src/paylog.js");
const F = await import("../../web-src/firstmin.js");
const { harden } = await import("../lib/hard.mjs");
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c || process.env.V) console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };
const now = Date.parse("2026-11-24T20:00:00"), H = 3600000, D = 24 * H;
const SMS = [
  { id: "a1", title: "BanqueMisr", text: "تم خصم مبلغ 450.00 جنيه من بطاقتكم رقم ****5521 لدى SPINNEYS ZAYED بتاريخ 22/11", ts: now - 2 * D, want: [450, "EGP", "out", "SPINNEYS ZAYED", "groceries"] },
  { id: "a2", title: "InstaPay", text: "تم تحويل 1,500 جنيه إلى محمد سامي بنجاح. رقم المرجع 88213. رصيدك الحالي 12,340.50 جنيه", ts: now - D, want: [1500, "EGP", "out", "محمد سامي", "other"] },
  { id: "a3", title: "VF-Cash", text: "تم شحن رصيد 100 جنيه لرقم 01001234567. رصيد محفظتك 230.75 جنيه", ts: now - 5 * H, want: [100, "EGP", "out", null, "bills"] },
  { id: "a4", title: "NBE", text: "Dear Customer, your account 1234XXXX was credited with EGP 18,500.00 SALARY on 20/11/2026", ts: now - 4 * D, want: [18500, "EGP", "in", null, "salary"] },
  { id: "a5", title: "CIB", text: "Your OTP for transaction of EGP 2,300.00 at NOON.COM is 482913. Do not share it with anyone.", ts: now - 3 * H, want: null },
  { id: "a6", title: "CIB", text: "Your credit card ending 7710 was charged for EGP 2,300.00 at NOON.COM", ts: now - 3 * H + 60000, want: [2300, "EGP", "out", "NOON", "shopping"] },
  { id: "a8", title: "NBE", text: "تم سحب مبلغ 2000 جنيه من ماكينة الصراف الآلي فرع المعادي. الرصيد المتاح 9,880 جنيه", ts: now - 6 * D, want: [2000, "EGP", "out", "ATM", "other"] },
  { id: "a9", title: "Etisalat", text: "عرض خاص! احصل على 20 جيجا بـ 150 جنيه فقط. اطلب *225#", ts: now - D, want: null },
  { id: "a10", title: "CIB", text: "Your credit card ending 7710 was charged for USD 9.99 at NETFLIX.COM", ts: now - 8 * D, want: [9.99, "USD", "out", "NETFLIX", "bills"] },
  { id: "a11", title: "CIB", text: "Your credit card ending 7710 was charged for EGP 89.00 at UBER *TRIP", ts: now - 10 * H, want: [89, "EGP", "out", "UBER", "transport"] },
  { id: "a12", title: "BanqueMisr", text: "عزيزنا العميل، تم رفض عملية بمبلغ 5,000 جنيه لدى AMAZON.EG لعدم كفاية الرصيد", ts: now - 7 * H, want: null },
];
const read = (m, text) => readNotification({ id: m.id, app: "SMS", title: m.title, text, ts: m.ts }, { home: "EGP" });
const check = (m, r, label) => {
  if (!m.want) return ok(r == null, `${label} ${m.id}: not a payment → nothing (${r && r.amount})`);
  const [a, c, d, p, cat] = m.want;
  ok(r && Math.abs(r.amount - a) < 0.001 && r.currency === c && r.direction === d, `${label} ${m.id}: ${a} ${c} ${d} (${r && [r.amount, r.currency, r.direction]})`);
  if (r && p) ok(String(r.party || "").replace(/[‎‏]/g, "").trim() === p, `${label} ${m.id}: party "${p}" ("${r.party}")`);
  if (r) ok(categorise([r.party, r.text].join(" "), r.direction) === cat, `${label} ${m.id}: category ${cat} (${categorise([r.party, r.text].join(" "), r.direction)})`);
};
for (const m of SMS) check(m, read(m, m.text), "plain");
// HARD: 200 versions of each message (spaces, line breaks, direction marks, Arabic-Indic digits, currency spellings, alef forms…)
let seed = 20261124; const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
let hard = 0, hardOk = 0; const f0 = fail;
for (const m of SMS) for (let i = 0; i < 200; i++) { const before = fail; check(m, read(m, harden(m.text, rnd, { sms: true, allowCut: false })), "hard"); hard++; if (fail === before) hardOk++; }
console.log(`${fail === f0 ? "PASS" : "FAIL"} hard: ${hardOk} / ${hard} versions right`);
// brands only where a word starts (2)
for (const [t, c] of [["NETFLIX.COM", "bills"], ["PAYPAL *NETFLIX", "bills"], ["TFL TRAVEL CH", "transport"], ["COCA-COLA 25", "other"], ["UBER *TRIP", "transport"], ["CARREFOURMAADI", "groceries"], ["بنزين وطنية", "transport"]])
  ok(categorise(t, "out") === c, `category of "${t}" = ${c} (${categorise(t, "out")})`);
// the first minute on this phone: the month without the declined / OTP / advert, NOON once, ATM named, dollars kept apart (1)
const sms = SMS.map(({ want, ...m }) => ({ ...m, app: "SMS" }));
const r = F.firstMonth({ sms, emails: [], now, home: "EGP" });
const names = [...r.spend, ...r.subs].map((l) => l.name);
ok(names.includes("ATM") && names.includes("محمد سامي") && !names.some((x) => /بنجاح|ماكينة/.test(x)), "first minute names: " + names.join(", "));
ok(r.total === 2300 + 89 + 1500 + 450 + 2000 + 100 && r.foreign.USD === 9.99, `this month ${r.total} EGP + ${JSON.stringify(r.foreign)} (no rate known → the dollars stay dollars)`);
// W6 (Ali: a refund "can be added to income"): NOON's 300 back is kept as a refund (never spending), in any wording
for (const t of ["A refund of EGP 300.00 from NOON.COM has been credited to your card ending 7710", "تم رد مبلغ 300 جنيه من NOON إلى بطاقتك", "Refund: EGP 300.00 from NOON.COM credited to your card ending 7710"]) {
  const rf = F.firstMonth({ sms: [{ id: "rf", app: "SMS", title: "CIB", text: t, ts: now - H }], emails: [], now, home: "EGP" });
  ok(rf.refunds.length === 1 && rf.refunds[0].amount === 300 && rf.total === 0, "a refund is kept for income, not spending: " + t + " → " + JSON.stringify(rf.refunds.map((x) => [x.name, x.amount])));
}
// OK-W3: "Safe to spend today 0 · about 2,070 a day until Nov 30" — now "From tomorrow" from what is really left after today
{ const { safeToSpend } = await import("../../web-src/safespend.js");
  const day = (d) => `2026-11-${String(d).padStart(2, "0")}`, at = Date.parse("2026-11-25T15:00:00");   // 6 days to Nov 30 (25…30)
  const base = { currency: "EGP", accounts: [{ id: "a", name: "Cash", currency: "EGP", start: 0 }], recurring: [], debts: [] };
  const mk = (spentToday) => ({ ...base, txns: [{ id: "i", type: "income", amount: 12420, cat: "salary", account: "a", date: day(1) }, ...(spentToday ? [{ id: "t", type: "expense", amount: spentToday, cat: "shopping", account: "a", date: day(25) }] : [])] });
  const a = safeToSpend({ ledger: mk(0), now: at }), b = safeToSpend({ ledger: mk(4140), now: at }), c = safeToSpend({ ledger: mk(1000), now: at });
  ok(a.perDay === 2070 && a.today === 2070 && a.days === 6, `nothing spent: 2,070 today, 2,070 a day (${a.today}, ${a.perDay}, ${a.days} days)`);
  ok(b.today === 0 && b.over === 2070 && b.fromTomorrow === Math.floor((12420 - 4140) / 5), `4,140 spent today: 0 left, 2,070 over, from tomorrow ${b.fromTomorrow} (= 8,280 ÷ 5)`);
  ok(c.today === 1070 && c.over === 0 && c.fromTomorrow === 2070, `1,000 spent: 1,070 left today, still 2,070 from tomorrow (${c.today}, ${c.fromTomorrow})`);
  ok(b.fromTomorrow * b.afterToday <= 12420 - 4140 && c.today + c.fromTomorrow * c.afterToday <= 12420 - 1000, "never promises more than is left");
}
// OK-W2: "This month" on Home — per currency (never added together), top 3 categories, refunds back
{ const { monthSummary } = await import("../../web-src/monthcard.js");
  const L = { currency: "EGP", accounts: [{ id: "e", currency: "EGP" }, { id: "u", currency: "USD" }], txns: [
    { type: "expense", amount: 2300, cat: "shopping", account: "e", date: "2026-11-24" }, { type: "expense", amount: 1500, cat: "other", account: "e", date: "2026-11-23" },
    { type: "expense", amount: 450, cat: "groceries", account: "e", date: "2026-11-22" }, { type: "expense", amount: 89, cat: "transport", account: "e", date: "2026-11-24" },
    { type: "expense", amount: 9.99, cat: "bills", account: "u", date: "2026-11-16" }, { type: "expense", amount: 999, cat: "fun", account: "e", date: "2026-10-30" },
    { type: "income", amount: 300, cat: "other", account: "e", date: "2026-11-24", note: "NOON ↩" }, { type: "income", amount: 18500, cat: "salary", account: "e", date: "2026-11-20", note: "salary" }] };
  const m = monthSummary(L, Date.parse("2026-11-24T20:00:00"));
  ok(m && JSON.stringify(m.spent) === JSON.stringify([["EGP", 4339], ["USD", 9.99]]) && m.top.map((x) => x[0]).join() === "shopping,other,groceries" && m.back === 300 && m.n === 5,
    "This month: 4,339 EGP + 9.99 USD (October's 999 not counted), top Shopping · Other · Groceries, 300 back: " + JSON.stringify(m));
  ok(monthSummary({ currency: "EGP", accounts: [{ id: "e", currency: "EGP" }], txns: [] }, Date.now()) === null, "no spending this month → no card");
}
const L0 = { currency: "EGP", accounts: [{ id: "c", name: "Cash", currency: "EGP", start: 0 }], txns: [] };
const L = appendToLedger(L0, [{ type: "expense", amount: 9.99, currency: "USD", note: "NETFLIX", cat: "bills" }, { type: "expense", amount: 450, currency: "EGP", note: "SPINNEYS" }, { type: "expense", amount: 5, currency: "USD", note: "x" }, { type: "expense", amount: 7, note: "no currency" }], now).ledger;
const usd = L.accounts.find((a) => a.currency === "USD");
ok(usd && L.accounts.length === 2, "a dollar payment opens ONE dollar account: " + JSON.stringify(L.accounts));
ok(L.txns.filter((t) => t.account === usd.id).map((t) => t.amount).join() === "9.99,5" && L.txns.filter((t) => t.account === "c").map((t) => t.amount).join() === "450,7", "dollars in the dollar account, pounds (and no-currency) in the pound account");
// the own-data questions the walk-through found answered wrong ("who owes me", "when does my passport expire", "what do I have tomorrow",
// "how much on food") — tests/walk/gen.mjs, HARD and composed: a 2,500 sample and a 1,000 held-out (another seed) must stay at 99.5 %+
const W = await import("../walk/gen.mjs");
for (const [cnt, shift, label] of [[2500, 0, "sample"], [1000, 7, "held-out"]]) {
  const r = W.run(cnt, shift, { quiet: true });
  ok(r.ok / r.total >= 0.995 && r.shapes.share >= 0.6, `own-data questions ${label}: ${r.ok}/${r.total} right, ${(100 * r.shapes.share).toFixed(1)} % different shapes ${r.bad.slice(0, 3).join(" ‖ ")}`);
}
// OK-W4: things to buy sorted into lists by themselves — tests/autolist/gen.mjs (HARD, composed): a 2,500 sample + a held-out seed
{ const A = await import("../autolist/gen.mjs");
  for (const [cnt, shift, label] of [[2500, 0, "sample"], [1000, 9, "held-out"]]) { const r = A.run(cnt, shift, { quiet: true });
    ok(r.ok / r.total >= 0.995 && r.shapes.share >= 0.6, `shopping lists ${label}: ${r.ok}/${r.total}, ${(100 * r.shapes.share).toFixed(1)} % shapes ${r.bad.slice(0, 2).join(" ‖ ")}`); }
  const AL = await import("../../web-src/autolist.js");
  const r1 = AL.applyAuto({ lists: [] }, AL.readShopping("buy milk, eggs and bread")), g = r1.st.lists.find((l) => l.auto === "groceries");
  ok(g && g.items.map((x) => x.text).join() === "Milk,Eggs,Bread" && !g.items.some((x) => x.done), "3 checkboxes in Groceries: " + JSON.stringify(g && g.items.map((x) => x.text)));
  const r2 = AL.applyAuto(r1.st, AL.readShopping("buy rice and milk")), g2 = r2.st.lists.find((l) => l.auto === "groceries");
  ok(r2.st.lists.length === 1 && g2.items.map((x) => x.text).join() === "Milk,Eggs,Bread,Rice", "the next time joins the same list, milk not twice: " + JSON.stringify(g2.items.map((x) => x.text)));
  const own = { lists: [{ id: "t", name: "Talabat", items: [], repeat: { every: "once" } }] }, r3 = AL.applyAuto(own, AL.readShopping("buy milk"));
  ok(r3.st.lists.find((l) => l.id === "t").items.length === 0 && r3.st.lists.some((l) => l.auto === "groceries"), "the person's own list (Talabat) is never filled by itself");
  for (const t of ["bring the charger", "I bought milk 50", "buy me a Kindle under 5000", "remind me to buy milk at 5", "buy tickets to Dubai", "call the bank"]) ok(AL.readShopping(t) == null, "not a list: " + t);
}
console.log(fail ? `FAIL ${fail} of ${n}` : `ALL PASSED v1098walk: ${n} checks (${hard} hard versions)`);
