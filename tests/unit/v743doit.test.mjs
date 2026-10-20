// v6.43 Home option 1 (Ali): one sentence acts in every app it touches — the money part is not read as food, and the expense
// is named after what was eaten.
globalThis.localStorage = { _: {}, getItem(k) { return this._[k] ?? null; }, setItem(k, v) { this._[k] = String(v); }, removeItem(k) { delete this._[k]; } };
const D = await import("../../web-src/doit.js");
let bad = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) bad++; };
for (const t of ["I had koshari for lunch and paid 85 pounds", "اتغديت كشري ودفعت ٨٥ جنيه"]) {
  const a = D.understand(t).actions, f = a.find((x) => x.kind === "food"), m = a.find((x) => x.kind === "money");
  ok(f && f.items.map((x) => x.id).join() === "koshari" && !f.unknown.length, t + " → Food: koshari only (no 'paid pounds')");
  ok(m && m.items[0].amount === 85 && m.items[0].note === "Koshari" && m.items[0].cat === "food", t + " → Money: 85, «Koshari», food");
}
ok(D.understand("2 eggs and toast for breakfast").actions.map((x) => x.kind).join() === "food", "a meal with «and» stays one food action");
console.log(bad ? bad + " FAILED" : "ALL PASSED");
