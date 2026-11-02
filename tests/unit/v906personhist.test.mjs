// v9.0 (Ali: "open each person's history by pressing on him"): everything with one person, by code.
import { personHistory } from "../../web-src/personhist.js";
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log("FAIL " + m); } };
const now = Date.parse("2026-11-02T12:00:00");
const life = { items: [
  { id: "a", kind: "debt", person: "Sara", dir: "in", amount: 5000, currency: "EGP", start: "2026-08-01", count: 1, paid: [0], got: { 0: 2000 } },
  { id: "b", kind: "installment", person: "سارة", dir: "in", amount: 1000, count: 4, total: 4000, currency: "EGP", every: "month", start: "2026-09-01", paid: [0, 1] },
  { id: "c", kind: "debt", person: "Sara", dir: "out", amount: 700, currency: "EGP", start: "2026-10-10", count: 1, paid: [] },
  { id: "d", kind: "debt", person: "Ahmed", dir: "in", amount: 9000, currency: "EGP", start: "2026-07-01", count: 1, paid: [] }] };
const ledger = { currency: "EGP", txns: [
  { type: "expense", amount: 450, note: "Dinner with Sara", date: "2026-10-20" },
  { type: "income", amount: 1000, note: "Sara — installment 1 of 4", date: "2026-09-01" },
  { type: "expense", amount: 300, note: "Sarah's gift", date: "2026-10-01" },
  { type: "expense", amount: 200, note: "Ahmed lunch", date: "2026-10-02" }] };
const h = personHistory("Sara", { life, ledger }, { aliases: ["سارة"], now });
ok(h.plans.length === 3 && !h.plans.some((p) => p.c.person === "Ahmed"), "her three plans (English and Arabic name), not Ahmed's");
ok(h.youOwe === 700 && h.gotBack === 4000 && h.owesYou === 5000, "sums: you owe 700, got back 2,000 + 2,000, she still owes 3,000 + 2,000: " + JSON.stringify([h.owesYou, h.youOwe, h.gotBack]));
ok(h.events.some((e) => e.kind === "money-out" && e.amount === 450) && !h.events.some((e) => e.text === "Sara — installment 1 of 4") && !h.events.some((e) => e.amount === 200), "Money entries that name her; not a tick's own entry; not Ahmed's");
ok(h.events[0].date >= h.events[h.events.length - 1].date, "newest first");
ok(h.events.filter((e) => e.kind === "lent").length === 2 && h.events.filter((e) => e.kind === "borrowed").length === 1 && h.events.filter((e) => e.kind === "paid-in").length === 3, "each loan and each payment is a line");
ok(personHistory("Nobody", { life, ledger }, { now }).events.length === 0, "someone with nothing → an empty history");
console.log(bad ? bad + " FAILED" : "PASS v906personhist: a person's whole history");
