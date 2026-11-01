// v8.9 (Ali: "the barcode database is very lame — Yazio read the same barcode"): every spelling of a code, a product with a name
// but no numbers gets estimated ones, and a product the person logs by hand is kept for its barcode.
const mem = {}; globalThis.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
const DB = await import("../../web-src/fitdb.js");
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log("FAIL " + m); } };
ok(DB.barcodeVariants("012000161155").includes("0012000161155"), "UPC-A → EAN-13 with a leading 0");
ok(DB.barcodeVariants("0012000161155").includes("012000161155"), "EAN-13 with a leading 0 → UPC-A");
const N = { "energy-kcal_100g": 42, proteins_100g: 0, carbohydrates_100g: 10.6, fat_100g: 0 };
// 1) Open Food Facts knows it only under the other spelling
let f = await DB.byBarcode("012000161155", async (u) => (u.includes("/0012000161155.json") ? { product: { code: "0012000161155", product_name: "Cola", brands: "Pepsi", nutriments: N } } : {}));
ok(f && f.kcal === 42 && /Cola/.test(f.en), "found under the EAN-13 spelling");
// 2) a name but no numbers → estimated from a same-name product, flagged to check
f = await DB.byBarcode("6221007012415", async (u) => (u.includes("/product/6221007012415.json") ? { product: { code: "6221007012415", product_name: "Juhayna Full Cream Milk", brands: "Juhayna", nutriments: {} } }
  : u.includes("search") ? { products: [{ code: "1", product_name: "Full cream milk", brands: "Juhayna", nutriments: { "energy-kcal_100g": 62, proteins_100g: 3.1, carbohydrates_100g: 4.7, fat_100g: 3.4 } }] } : {}));
ok(f && f.estimate && f.kcal === 62 && /Juhayna/.test(f.en) && f.barcode === "6221007012415", "a name with no numbers → estimated numbers, checked");
// 3) unknown everywhere → null; then logged by hand → the next scan finds it offline
f = await DB.byBarcode("6223000000001", async () => ({}));
ok(f === null, "unknown everywhere → null");
DB.rememberBarcode("6223000000001", { id: "x", en: "Baladi cheese", kcal: 250, p: 15, c: 3, f: 20, portions: {} });
f = await DB.byBarcode("6223000000001", null);
ok(f && f.en === "Baladi cheese", "a product logged by hand is found by its barcode next time (offline)");
console.log(bad ? bad + " FAILED" : "PASS v890barcode: more barcodes found, estimates, products remembered");
