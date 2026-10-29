// v8.7 (Ali: "restore the other zakat calculators") — the ledger's rules, unchanged
import assert from "node:assert/strict";
import * as Z from "../../web-src/zakatcalc.js";
assert.deepEqual(Z.calc("camels", { head: 4 }), { due: false });
assert.deepEqual(Z.calc("camels", { head: 30 }).options, [[[1, "bintMakhad"]]]);
assert.deepEqual(Z.calc("cattle", { head: 70 }).options, [[[1, "musinnah"], [1, "tabi"]]]);
assert.deepEqual(Z.calc("sheep", { head: 130 }).options, [[[2, "shah"]]]);
assert.deepEqual(Z.calc("crops", { kg: 1000, rain: true }), { due: true, kg: 100, rate: 10 });
assert.deepEqual(Z.calc("crops", { kg: 1000, rain: false }), { due: true, kg: 50, rate: 5 });
assert.equal(Z.calc("crops", { kg: 500 }).need, 112);
assert.deepEqual(Z.calc("trade", { stock: 300000, cash: 50000, owedToYou: 0, youOwe: 50000 }, { nisab: 620000 }), { due: false, need: 320000, net: 300000 });
assert.equal(Z.calc("trade", { stock: 900000 }, { nisab: 620000 }).amount, 22500);
assert.equal(Z.calc("rikaz", { value: 10000 }).amount, 2000);
assert.equal(Z.calc("fitr", { people: 5, perPerson: 35 }).amount, 175);
console.log("v870zakatcalc: 11 checks passed");
