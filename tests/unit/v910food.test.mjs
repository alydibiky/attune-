// v9.0 (the food bank: "give me tips to sleep better" was butter): real meals in English and Egyptian Arabic are read; everyday sentences never become food.
import { readMealText } from "../../web-src/fitread.js";
const C = [
 ["2 eggs and toast", ["egg", "toast"]], ["koshary", ["koshar"]], ["a chicken shawarma sandwich", ["shawarma"]], ["ful sandwich and a tea", ["ful", "tea"]], ["big salad", ["salad"]],
 ["banana", ["banana"]], ["an apple and a coffee with milk", ["apple", "coffee"]], ["grilled chicken with rice", ["chicken", "rice"]], ["pizza margherita 2 slices", ["pizza"]],
 ["بيضتين وعيش", ["egg|بيض", "bread|عيش"]], ["كشري", ["koshar|كشري"]], ["طعمية وفول", ["falafel|طعمية|taameya", "ful|فول"]], ["فراخ مشوية ورز", ["chicken|فراخ", "rice|رز"]], ["موزة", ["banana|موز"]], ["شاي بلبن", ["tea|شاي"]],
];
const NOT = ["give me tips to sleep better", "I'm feeling better", "call my brother", "the meeting was long", "I need a break", "pay the electricity", "better late than never", "my battery is dying", "I am at the bank", "nothing much"];
let bad = 0;
for (const [s, want] of C) { const m = readMealText(s), names = m.items.filter((x) => x.kcal != null).map((x) => (x.name + " " + (x.id || "")).toLowerCase());
  const ok = want.every((w) => names.some((n) => new RegExp(w, "i").test(n))); if (!ok) { bad++; console.log(`FAIL ${s} → ${JSON.stringify(m.items.map((x) => [x.name, x.kcal]))}`); } }
for (const s of NOT) { const m = readMealText(s), f = m.items.filter((x) => x.kcal != null); if (f.length) { bad++; console.log(`FAIL NOT food: ${s} → ${JSON.stringify(f.map((x) => x.name))}`); } }
console.log(bad ? bad + " FAILED" : `PASS v910food: ${C.length} meals read right, ${NOT.length} everyday sentences never taken for food`);
