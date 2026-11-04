// v7.9 (Ali, mango cake photo: Attune "Cake" with "Mango" as another guess, and "Mango cake" last in the search; Yazio "Mango
// sponge cake with whipped cream"): a dish + a flavour is named together, and a food with every word typed ranks first.
import * as F from "../../web-src/fit.js";
import { decide } from "../../web-src/fitclip.js";
import { rankFoods } from "../../web-src/fitdb.js";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const alt = (q) => ({ label: q, food: F.searchFoods(q, 1)[0] });
let c = F.composeDish([alt("Cake"), alt("Mango"), alt("Tres leches cake"), alt("Peach")]);
ok(c && c.food.en === "Mango cake" && c.food.ar === "كيك مانجا" && c.dishId === "cake" && c.food.kcal === 380, "Cake + Mango → \"Mango cake\" («كيك مانجا»), with the cake's numbers: " + JSON.stringify(c && [c.food.en, c.food.ar, c.food.kcal]));
ok(F.composeDish([alt("Mango"), alt("Peach")]) === null && F.composeDish([alt("Cake"), alt("Tres leches cake")]) === null, "two fruits, or two cakes, make no new dish");
ok(F.composeDish([alt("Mango juice"), alt("Mango")]) === null, "a mango juice is already mango");
// the quick photo reader: Cake first, Mango second → the item is "Mango cake", its first choice too
const bank = { items: [{ kind: "id", id: "cake", en: "Cake" }, { kind: "id", id: "mango", en: "Mango" }, { kind: "id", id: "peach", en: "Peach" }], auto: 0.5 };
const d = decide(bank, [{ i: 0, p: 0.62 }, { i: 1, p: 0.21 }, { i: 2, p: 0.08 }]);
ok(d.items[0].name === "Mango cake" && d.items[0].alts[0].food.en === "Mango cake" && d.items[0].kcal > 0, "the photo says \"Mango cake\": " + JSON.stringify([d.items[0].name, d.items[0].kcal, d.items[0].alts.map((a) => a.food.en)]));
// the search: every word typed beats one of them
const list = [{ id: "mango", en: "Mango", names: ["Mango"], kcal: 60, src: "table" }, { id: "cake", en: "Cake", names: ["Cake"], kcal: 380, src: "table" },
  { id: "p1", en: "Mango cake", brand: "Sugar bowl bakery", kcal: 474, src: "pack" }, { id: "p2", en: "Mango sponge cake", kcal: 320, src: "pack" }];
const r = rankFoods(list, "mango cake").map((f) => f.en);
ok(r[0] === "Mango cake" && r[1] === "Mango sponge cake" && r.indexOf("Mango") > 1, "searching \"mango cake\": the mango cakes first: " + JSON.stringify(r));
console.log(fail ? "FAILED " + fail : "ALL PASSED");
