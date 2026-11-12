// v9.9.18 M5 wiring: after "Always put Seoudi in Groceries", a NEW payment written to Money (notification, chat) follows the rule —
// only for exactly that shop; nothing changes without a rule.
const mem = {}; globalThis.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
const { appendToLedger } = await import("../../web-src/paylog.js");
const CL = await import("../../web-src/catlearn.js");
let bad = 0; const ok = (c, t) => { console.log((c ? "PASS " : "FAIL ") + t); if (!c) bad++; };
const L = { accounts: [{ id: "b", name: "CIB", currency: "EGP" }], txns: [] };
const add = (note, cat) => appendToLedger(L, [{ type: "expense", amount: 100, cat, note }]).ledger.txns[0].cat;
ok(add("Seoudi", "food") === "food", "no rule → the category as read");
CL.saveCatRules({ rules: CL.learn({}, "Seoudi", "groceries"), names: { seoudi: "Seoudi" } });
ok(add("SEOUDI", "food") === "groceries", "rule → a new Seoudi payment goes to Groceries (any case)");
ok(add("Seoudi Market Online", "food") === "food", "…not a different shop with a longer name");
ok(add("talabat", "food") === "food", "…nor any other shop");
console.log(bad ? "FAIL " + bad + " failed" : "ALL PASSED"); if (bad) process.exitCode = 1;
