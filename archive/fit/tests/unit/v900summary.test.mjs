// v7.9 (Ali picked the food photo design B + slice buttons): the summary's name, portion word and the pill that is on, by code.
import { mealTitle, portionWord, portionOn, portionLabel } from "../../web-src/fit-summary.js";
import * as F from "../../web-src/fit.js";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
ok(mealTitle([{ name: "Mango cake", ar: "كيك مانجا", kcal: 304 }]).en === "Mango cake", "one food: its own name");
const t = mealTitle([{ name: "Rice", ar: "رز", kcal: 260 }, { name: "Chicken pané", ar: "بانيه", kcal: 420 }, { name: "Salad", kcal: 40 }]);
ok(t.en === "Chicken pané + 2 more" && t.ar === "بانيه + صنفين كمان", "several: the biggest and how many more: " + JSON.stringify(t));
const w = portionWord(F.searchFoods("cake", 1)[0]);
ok(w[0] === "slice" && w[1] === "شريحة", "cake → slice / شريحة");
ok(portionWord(null)[0] === "portion", "unknown → portion");
ok(portionOn([{ k: 2 }, { k: 2 }]) === 2 && portionOn([{ k: 1 }, { k: 1.5 }]) === null && portionOn([{}]) === 1, "the pill that is on: the same factor everywhere, else none");
ok(portionLabel(0.5) === "½" && portionLabel(1.5) === "1½" && portionLabel(2) === "2", "labels");
console.log(fail ? "FAILED " + fail : "ALL PASSED");
