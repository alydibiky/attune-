// v9.0 (Ali: "99 percent accurate"): Zakāt on livestock, crops, trade goods and treasure against the standard tables
// (al-Nawawī's table for camels, the hadith of Muʿādh for cattle, Bukhārī for sheep; 10% / 5% on crops; 2.5% trade; 20% rikāz).
import { camelDue, cattleDue, sheepDue, calc } from "../../web-src/zakatcalc.js";
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log("FAIL " + m); } };
const J = (x) => JSON.stringify(x);
const CAM = { 4: null, 5: [[1, "shah"]], 10: [[2, "shah"]], 15: [[3, "shah"]], 20: [[4, "shah"]], 25: [[1, "bintMakhad"]], 36: [[1, "bintLabun"]], 46: [[1, "hiqqah"]], 61: [[1, "jadhaah"]], 76: [[2, "bintLabun"]], 91: [[2, "hiqqah"]], 120: [[2, "hiqqah"]], 121: [[[3, "bintLabun"]]], 150: [[[3, "hiqqah"]]], 200: [[[5, "bintLabun"]], [[4, "hiqqah"]]] };
for (const [n, w] of Object.entries(CAM)) ok(J(camelDue(+n)) === J(w), `camels ${n} → ${J(w)}, got ${J(camelDue(+n))}`);
const CAT = { 29: null, 30: [[1, "tabi"]], 40: [[1, "musinnah"]], 60: [[[2, "tabi"]]], 70: [[[1, "musinnah"], [1, "tabi"]]], 90: [[[3, "tabi"]]], 120: [[[4, "tabi"]], [[3, "musinnah"]]] };
for (const [n, w] of Object.entries(CAT)) ok(J(cattleDue(+n)) === J(w), `cattle ${n} → ${J(w)}, got ${J(cattleDue(+n))}`);
const SH = { 39: null, 40: [[1, "shah"]], 120: [[1, "shah"]], 121: [[2, "shah"]], 201: [[3, "shah"]], 400: [[4, "shah"]], 500: [[5, "shah"]] };
for (const [n, w] of Object.entries(SH)) ok(J(sheepDue(+n)) === J(w), `sheep ${n} → ${J(w)}, got ${J(sheepDue(+n))}`);
ok(calc("crops", { kg: 1000, rain: true }).kg === 100 && calc("crops", { kg: 1000, rain: false }).kg === 50 && calc("crops", { kg: 500 }).due === false, "crops: 10% rain-fed, 5% irrigated, under 612 kg nothing");
ok(calc("trade", { stock: 100000, cash: 20000, owedToYou: 0, youOwe: 20000 }, { nisab: 300000 }).due === false && calc("trade", { stock: 400000, cash: 20000, youOwe: 20000 }, { nisab: 300000 }).amount === 10000, "trade: net under niṣāb nothing; 400,000 net → 10,000 (2.5%)");
ok(calc("rikaz", { value: 50000 }).amount === 10000 && calc("fitr", { people: 4, perPerson: 35 }).amount === 140, "rikāz 20%; Zakāt al-Fiṭr 4 × 35 = 140");
console.log(bad ? bad + " FAILED" : "PASS v913zakat: livestock, crops, trade, rikāz and al-Fiṭr match the standard tables");
