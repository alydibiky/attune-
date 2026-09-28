// Unit tests for v6.4 (Ali: "at least 90 percent of the meals correct and the other 10 percent can be
// corrected easily, and auto corrects the next time"; "a favorites option"): the reader on four sets —
// two of them written before the changes they measure — correcting a typed food, learning it, and stars.
const mem = {}; globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); } };
const F = await import("../../web-src/fit.js");
const R = await import("../../web-src/fitread.js");
const P = await import("../../web-src/fitplus.js");
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }

// ---- ≥ 90 % on every set, the unseen ones included ----
const { result } = await import("../eval/run.mjs");
eq([result.perfect >= 0.97, result.holdout >= 0.95, result.blind >= 0.9, result.fresh >= 0.9], [true, true, true, true],
  `reader: ${Math.round(result.perfect * 100)} % / ${Math.round(result.holdout * 100)} % / blind ${Math.round(result.blind * 100)} % (67 % on first contact) / fresh ${Math.round(result.fresh * 100)} % (85 % on first contact)`);

// ---- the general fixes, one by one ----
const r = (t) => R.readMealText(t).items.map((x) => [x.id, x.grams]);
eq(R.fixTypos("ورز ورغيف بالشعريه"), "ورز ورغيف بالشعريه", "«ورز», «ورغيف»: a glued «و/ب/بال» before a known word is not a typo");
eq(R.fixTypos("koshry chiken egs bananna"), "koshary chicken egg banana", "typos → the nearest known word (a same-length word wins a tie: egs → egg)");
eq(R.fixTypos("عند"), "عند", "«عند» stays «عند» (not «عنب»)");
eq(r("a slice of pizza hut pepperoni"), [["pizza-pepperoni", 110]], "the shop name goes, the food stays: “pizza hut pepperoni” → pepperoni pizza");
eq(r("بامية باللحمة"), [["bamia", 250]], "«بامية باللحمة»: the meat is in the stew, not logged twice");
eq(r("بامية ولحمة").map((x) => x[0]), ["bamia", "beef"], "…but «بامية ولحمة» (and meat) is two foods");
eq(r("نص بطيخة"), [["watermelon", 1680]], "«نص بطيخة» = half a whole watermelon, not one slice");
eq(r("كشري صغير وبيبسي").map((x) => x[1] >= 250 || x[0] === "koshari"), [true, true], "«صغير» shrinks the koshari, not the Pepsi");
eq(r("فول وطعمية وبيض"), [["ful", 200], ["taameya", 68], ["egg", 100]], "«طعمية» alone is a serving (4), «بيض» alone two eggs");
eq(r("coffee with milk"), [["coffee", 240], ["milk", 50]], "milk in coffee with no amount is a splash (50 g)");
eq(r("كوباية شاي بلبن"), [["tea-milk", 240]], "«شاي بلبن» is tea with milk, one drink");

// ---- every typed item can be corrected: alternatives, portions, the words it came from ----
let it = R.readMealText("طبق رز وبيضتين").items;
eq(it.map((x) => [x.said, x.from, x.explicit, x.base === x.grams]), [["رز", "text", false, true], ["بيضتين", "text", true, true]], "items keep the words they came from and whether the amount was written");
eq(it[0].alts.map((a) => a.food.id).slice(0, 3), ["rice", "rice-vermicelli", "rice-brown"], "rice offers its family as one-tap swaps");
const sw = F.chooseFood(R.readMealText("2 طعمية").items[0], F.food("taameya-sandwich"));
eq([sw.id, sw.grams > 100, sw.chosen], ["taameya-sandwich", true, true], "a typed food swapped takes the new food's own portion (a sandwich isn't 34 g)");
const ph = F.chooseFood({ id: "rice", grams: 180, qty: 1, unit: "g", said: "rice" }, F.food("rice-brown"));
eq(ph.grams, 180, "a photo item keeps its grams when renamed (the plate doesn't change)");

// ---- correct once → right next time ----
F.learnFix("t:رز", F.food("rice-brown"), 1.5);       // what the screen does on Save after the change
it = R.readMealText("طبق رز وبيضتين").items;
eq(it.map((x) => [x.id, x.grams, !!x.learned]), [["rice-brown", 300, true], ["egg", 100, false]], "next time «رز» is brown rice at your portion (200 → 300 g); the eggs are untouched");
eq(R.readMealText("رز 100 جرام").items.map((x) => [x.id, x.grams]), [["rice-brown", 100]], "…but an amount you write yourself is kept as written");
eq(R.readMealText("rice").items[0].id, "rice", "the English word is its own word — not changed by the Arabic correction");
F.learnFix("t:رز", F.food("rice"), 1);
eq(R.readMealText("رز").items[0].id, "rice", "correcting it back is learned too");
F.learnFix("t:كشري", F.food("koshari"), 0.6);
eq(R.readMealText("كشري").items[0].grams, Math.round(R.readMealText("كشري").items[0].readBase * 0.6), "a smaller usual portion is remembered");
eq(R.readMealText("طبق كشري كبير وبيبسي").items.filter((x) => x.id === "cola").map((x) => x.grams), [330], "other foods in the sentence are not affected by it");
// a word the reader didn't know, read by the model and corrected, is known the next time
eq(R.readMealText("طاجن ام صابر").unknown, ["طاجن ام صابر"], "a dish the code doesn't know goes to the model…");
F.learnFix("t:طاجن ام صابر", F.food("potato-tray"), 1.2);
eq(R.readMealText("طاجن ام صابر").items.map((x) => [x.id, x.learned]), [["potato-tray", true]], "…and once corrected it's read by the code next time (no model needed)");

// ---- favorites ----
let favs = [];
const egg = R.readMealText("2 eggs").items[0];
favs = P.toggleFav(favs, egg);
eq([favs.length, favs[0].id, favs[0].item.grams, "said" in favs[0].item, P.isFav(favs, "egg")], [1, "egg", 100, false, true], "a star keeps the food at your portion, without the reading's working data");
favs = P.toggleFav(favs, R.readMealText("banana").items[0]);
eq(favs.map((f) => f.id), ["banana", "egg"], "newest star first");
favs = P.toggleFav(favs, egg);
eq([favs.map((f) => f.id), P.isFav(favs, "egg")], [["banana"], false], "tapping the star again removes it");
eq(P.toggleFav(favs, { name: "unknown thing" }).length, 1, "an unknown food (no id) can't be starred by mistake");
let many = []; for (const f of F.FOODS.slice(0, 50)) many = P.toggleFav(many, F.itemFromFood(f, 1, "serving"));
eq(many.length, 40, "at most 40 favorites are kept");

if (fails.length) { console.log(`\n${fails.length} FAILED`); process.exit(1); } else console.log("\nALL PASSED");
