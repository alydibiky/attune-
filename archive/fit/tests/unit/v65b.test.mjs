// v6.5 — Ali: "make sure there is a huge database". USDA's branded foods (~450,000 packaged products)
// join Open Food Facts (millions of products) and USDA's generic foods; a barcode Open Food Facts
// doesn't know is looked up in USDA's branded foods; no internet still says "no internet".
const mem = {}; globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); } };
const D = await import("../../web-src/fitdb.js");
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }
const N = (id, v) => ({ nutrientId: id, value: v });
const bar = { fdcId: 2345, dataType: "Branded", description: "PROTEIN BAR, CHOCOLATE PEANUT", brandOwner: "Quest", gtinUpc: "0888849000012", servingSize: 60, servingSizeUnit: "g", householdServingFullText: "1 bar",
  foodNutrients: [N(1008, 333), N(1003, 33), N(1005, 38), N(1004, 13), N(1079, 23), N(2000, 2)] };
const calls = [];
const fetchJson = async (url) => { calls.push(url);
  if (url.includes("usda") && url.includes("Branded")) return { foods: [bar] };
  if (url.includes("usda")) return { foods: [] };
  if (url.includes("/product/")) return { status: 0 };
  return { products: [] }; };

const f = D.fromUSDA(bar);
eq([f.brand, f.barcode, f.portions["1 bar"], f.kcal, f.names.includes("Quest PROTEIN BAR, CHOCOLATE PEANUT")], ["Quest", "0888849000012", 60, 333, true], "a USDA branded food keeps its brand, barcode and label serving");
const r = await D.searchAll("protein bar", fetchJson);
eq(r.foods.some((x) => x.id === "usda:2345"), true, "few answers → USDA's branded products are searched too");
eq(calls.filter((u) => u.includes("Branded")).length, 1, "…with one extra call only (the free USDA key allows ~30 an hour)");
calls.length = 0;
const many = async (url) => { calls.push(url); return url.includes("usda") ? { foods: Array.from({ length: 15 }, (_, i) => ({ ...bar, fdcId: 9000 + i, dataType: "SR Legacy", description: "RICE " + i })) } : { products: [] }; };
await D.searchAll("rice", many);
eq(calls.some((u) => u.includes("Branded")), false, "enough answers → no extra branded call");
eq((await D.byBarcode("888849000012", fetchJson))?.id, "usda:2345", "a barcode Open Food Facts doesn't know → found in USDA's branded foods (leading zeros ignored)");
eq(await D.byBarcode("1234567890128", async (u) => (u.includes("usda") ? { foods: [] } : { status: 0 })), null, "unknown everywhere → null");
let msg = ""; try { await D.byBarcode("5000000000001", async () => { throw new Error("offline"); }); } catch (e) { msg = e.message; }
eq(msg, "offline", "no internet → the network error, not “unknown product”");
if (fails.length) { console.log(`\n${fails.length} FAILED`); process.exit(1); } else console.log("\nALL PASSED");
