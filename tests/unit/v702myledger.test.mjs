// v6.12 — "What are my expenses in the last 4 days" is answered from the Money ledger by code, not "please provide the data".
const M = await import("../../web-src/myledger.js");
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const now = new Date(2026, 9, 4, 14, 0).getTime();   // 4 Oct 2026
ok(M.myMoneyIntent("What are my expenses in the last 4 days") === "expense", "Ali's question is a my-money question");
ok(M.myMoneyIntent("صرفت كام الأسبوع ده؟") === "expense" && M.myMoneyIntent("دخلي الشهر ده كام") === "income", "Egyptian Arabic questions");
ok(!M.myMoneyIntent("What are the average expenses of a crane company?") && !M.myMoneyIntent("how to reduce my expenses"), "general or advice questions are not lookups");
const s = M.spanOf("What are my expenses in the last 4 days", now);
ok(s.from === "2026-10-01" && s.to === "2026-10-04", "last 4 days = 1–4 Oct");
ok(M.spanOf("مصاريفي آخر ٣ أيام", now).from === "2026-10-02", "Arabic digits and words");
ok(M.spanOf("my spending yesterday", now).from === "2026-10-03" && M.spanOf("my spending last month", now).from === "2026-09-01", "yesterday and last month");
const L = { currency: "EGP", accounts: [{ id: "a", name: "Cash", currency: "EGP" }, { id: "u", name: "USD", currency: "USD" }, { id: "g", name: "Gold", unit: "g" }],
  txns: [{ type: "expense", amount: 120, cat: "food", account: "a", date: "2026-10-04", note: "koshari" }, { type: "expense", amount: 300.5, cat: "transport", account: "a", date: "2026-10-02" },
         { type: "expense", amount: 80, cat: "food", account: "a", date: "2026-10-01" }, { type: "expense", amount: 999, cat: "food", account: "a", date: "2026-09-30" },
         { type: "expense", amount: 10, cat: "fun", account: "u", date: "2026-10-03" }, { type: "income", amount: 250, cat: "gifts", account: "a", date: "2026-10-03", note: "from Youssef" }] };
const r = M.answerMyMoney("What are my expenses in the last 4 days", L, { now });
ok(/You spent 500\.5 EGP \+ 10 USD/.test(r.text), "sums per currency, the day before the span is left out: " + r.text.split("\n")[0]);
ok(/\| Food \| 200 EGP \|/.test(r.text) && /koshari/.test(r.text) && !/999/.test(r.text) && !/Youssef/.test(r.text), "by category and each entry; income not mixed in");
const a = M.answerMyMoney("صرفت كام آخر ٤ أيام", L, { now });
ok(/صرفت 500\.5 EGP/.test(a.text) && /طعام/.test(a.text), "Arabic answer");
ok(M.answerMyMoney("my expenses today", null, { now }).noLedger, "no ledger → tells where to record");
ok(/No expenses are recorded/.test(M.answerMyMoney("my expenses last week", { txns: [] }, { now }).text), "nothing in the span is said plainly");
console.log(fail ? `${fail} FAILED` : "ALL PASSED");
