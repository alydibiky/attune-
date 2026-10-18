// v6.35 the plate scan (Ali: "it does not do more than 1 meal, proportions are wrong, not good in seeing sizes")
import * as CL from "../../web-src/fitclip.js";
let fails = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const vec = Buffer.from([100, 0, 0, 0, 0, 100, 0, 0, 0, 0, 100, 0, 0, 0, 0, 100]).toString("base64");
const bank = CL.parseBank({ dim: 4, vec, items: [["id", "mahshi", "Mahshi", ""], ["id", "feteer", "Feteer meshaltet", ""], ["id", "tomato-sauce", "Tomato sauce", ""], ["not", "", "not food", ""]] });
const r = (i, p) => [{ i, p, score: 1 }, { i: (i + 1) % 3, p: 1 - p, score: 0 }];
// the whole photo says mahshi, sure (0.8) — the quarters see feteer at the top right, sauce at the bottom left
const plate = CL.plateScan(bank, r(0, 0.8), [r(0, 0.7), r(1, 0.6), r(2, 0.5), r(0, 0.7)]);
ok(plate.status === "guess", "several foods → never 'sure' (the AI checks): " + plate.status);
ok(plate.items.length === 3, "three foods found: " + plate.items.map((x) => x.name).join(", "));
const g = Object.fromEntries(plate.items.map((x) => [x.id, x.grams]));
ok(g.mahshi > 60 && g.mahshi <= 300, "mahshi from its share of the plate, not one 60 g piece: " + g.mahshi + " g");
ok(plate.items.every((x) => x.kcal > 0 || x.unknown), "each one has its calories");
ok(plate.items.slice(1).every((x) => Array.isArray(x.box) && x.box.length === 4), "each extra food is placed where it was seen (for its label)");
// one dish filling the plate, counted in pieces → starts at the plate's share and the AI counts the pieces
const one = CL.plateScan(bank, r(0, 0.85), [r(0, 0.8), r(0, 0.8), r(0, 0.8), r(0, 0.8)]);
ok(one.items.length === 1 && one.items[0].grams >= 250, "a full plate of mahshi starts at the plate amount: " + one.items[0].grams + " g");
ok(one.status === "guess", "pieces are counted by the AI (not 'sure')");
// a quarter under 30 % is ignored
const weak = CL.plateScan(bank, r(0, 0.8), [r(1, 0.2), r(0, 0.8), r(0, 0.8), r(0, 0.8)]);
ok(weak.items.length === 1, "a weak quarter adds nothing");
ok(CL.gramsForShare({ portions: { plate: 300 } }, 0.5) === 150 && CL.gramsForShare({}, 0.01) === 40, "grams for a share: plate portion × share, at least 40 g");
if (fails) { console.log(fails + " FAILED"); process.exit(1); } else console.log("ALL PASSED");
