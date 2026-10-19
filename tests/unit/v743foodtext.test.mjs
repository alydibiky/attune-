// v6.43 (Ali: Yazio's "Tell us what you're having" — "150 grams chicken Alfredo pasta and 7 chicken strips" was accurate there):
// the same sentences read by code, with the dish and the strips as foods of their own.
globalThis.localStorage = { _: {}, getItem(k) { return this._[k] ?? null; }, setItem(k, v) { this._[k] = String(v); }, removeItem(k) { delete this._[k]; } };
const { readMealText } = await import("../../web-src/fitread.js");
let bad = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) bad++; };
const sum = (r, k) => Math.round(r.items.reduce((a, x) => a + x[k], 0));
let r = readMealText("150 grams chicken Alfredo pasta and 7 chicken strips");
ok(r.items.length === 2 && r.items[0].id === "chicken-alfredo" && r.items[0].grams === 150, "chicken Alfredo pasta, 150 g: " + r.items.map((x) => x.name));
ok(r.items[1].id === "chicken-strips" && r.items[1].qty === 7 && !r.items[1].flag, "7 chicken strips (not 7 portions of grilled breast)");
ok(Math.abs(sum(r, "kcal") - 947) < 80 && Math.abs(sum(r, "p") - 69) < 10, "close to Yazio's 947 kcal / 69 g protein: " + sum(r, "kcal") + " / " + sum(r, "p"));
r = readMealText("One coffee and one small butter croissant");
ok(r.items.map((x) => x.id).join() === "coffee,croissant", "a butter croissant is one croissant, not butter + croissant: " + r.items.map((x) => x.id));
ok(readMealText("spaghetti bolognese 300g").items[0].id === "pasta-meat", "bolognese is the meat-sauce pasta");
ok(readMealText("a mango smoothie").items.length === 1, "a mango smoothie is one drink");
ok(readMealText("beef burrito").items[0].id === "burrito", "a beef burrito is a burrito");
console.log(bad ? bad + " FAILED" : "ALL PASSED");
