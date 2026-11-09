// v9.9.4 M1 (Ali: "make the guidelines strict — I don't want the code saving things wrong")
import assert from "node:assert/strict";
import { understand, strictCheck } from "../../web-src/doit.js";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS " + m); };
const NOW = Date.parse("2026-11-10T10:00:00");
const chk = (t) => strictCheck(t, understand(t, { now: NOW, stores: {} }), { now: NOW, stores: {} });
for (const t of ["spent 200 on lunch", "uber 120", "maid 400", "paid 1,250 at Carrefour", "salary 40000 came in", "remind me tomorrow at 9 to call the bank", "Ahmed owes me 12,000, 1,000 a month for a year"])
  ok(chk(t) === null, "sure → saved at once: “" + t + "”");
ok(!understand("Geely Galaxy M9 1200", { now: NOW, stores: {} }).actions.length, "a car's name + a number is a question, never saved");
for (const t of ["co 900", "ahmed 500"]) { const r = chk(t); ok(r && r.why === "unsure" && /^Save this\?/.test(r.en), "not sure → asks first, saves nothing: “" + t + "” → " + (r && r.s)); }
const big = chk("spent 90000000 on lunch");
ok(big && big.why === "amount", "an amount over 5 million from a sentence → asks first");
ok(chk("hello there") === null, "nothing to save → nothing to ask");
console.log("ALL PASSED v994strict (" + n + " checks)");
