// Unit tests for v6.1 Fit & Food: the big food database (Open Food Facts + USDA, kept on the phone)
// and the on-device photo recognition (guesses, hidden calories, labels, learned corrections).
const mem = {}; globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); } };
const D = await import("../../web-src/fitdb.js");
const F = await import("../../web-src/fit.js");
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }

const molto = { code: "6221033000018", product_name: "Molto Magnum Chocolate", product_name_ar: "مولتو ماجنوم شوكولاتة", brands: "Edita", serving_quantity: 60, countries_tags: ["en:egypt"],
  nutriments: { "energy-kcal_100g": 430, proteins_100g: 7, carbohydrates_100g: 52, fat_100g: 21, fiber_100g: 2 } };
const m = D.fromOFF(molto);
eq([m.id, m.en, m.kcal, m.portions, m.egypt, m.check], ["off:6221033000018", "Molto Magnum Chocolate (Edita)", 430, { serving: 60 }, true, false], "Open Food Facts product → a food (brand, serving, Egyptian)");
eq(D.fromOFF({ code: "1", product_name: "x", nutriments: { energy_100g: 1674, proteins_100g: 0, carbohydrates_100g: 0, fat_100g: 0 } }).check, true, "kJ read as kcal (1674 kJ = 400 kcal), and a label whose macros can't make 400 kcal is flagged");
eq(D.fromOFF({ code: "2", product_name: "y", nutriments: { "energy-kcal_100g": 100 } }), null, "an incomplete label is never used");
const egg = D.fromUSDA({ fdcId: 171287, description: "EGG, WHOLE, RAW, FRESH", foodNutrients: [{ nutrientId: 1008, value: 143 }, { nutrientId: 1003, value: 12.6 }, { nutrientId: 1005, value: 0.72 }, { nutrientId: 1004, value: 9.51 }], foodMeasures: [{ disseminationText: "1 large", gramWeight: 50 }] });
eq([egg.id, egg.en, egg.kcal, egg.portions], ["usda:171287", "Egg, whole, raw, fresh", 143, { "1 large": 50 }], "USDA food → a food with its household measures");
eq([D.validBarcode("5449000000996"), D.validBarcode("6221033000018"), D.validBarcode("5449000000997"), D.validBarcode("123")], [true, true, false, false], "barcode check digits");
eq(/countries.*egypt/.test(D.offSearchUrl("molto", { egypt: true })) && /api_key=DEMO_KEY/.test(D.usdaSearchUrl("egg")), true, "search addresses: Egyptian products first; USDA");

const fetchJson = async (url) => url.includes("usda") ? { foods: [] } : url.includes("/product/") ? (url.includes("5449000000996") ? { product: { code: "5449000000996", product_name: "Coca-Cola", nutriments: { "energy-kcal_100g": 42, proteins_100g: 0, carbohydrates_100g: 10.6, fat_100g: 0 } } } : { status: 0 }) : { products: [molto] };
const r = await D.searchAll("molto", fetchJson);
eq([r.online, r.foods[0].id], [true, "off:6221033000018"], "online search finds it");
eq(D.searchOffline("molto").map((f) => f.id), ["off:6221033000018"], "…and it is kept on the phone");
eq((await D.byBarcode("5449000000996", fetchJson)).en, "Coca-Cola", "a barcode → the product");
eq(await D.byBarcode("0000000000000", fetchJson), null, "an unknown barcode → null");
eq(D.searchOffline("بيض", 3)[0].id, "egg", "an exact Arabic name first («بيض» → Egg, not shakshuka)");
eq(F.itemFromFood(m, 1, "serving").kcal, 258, "one Molto (60 g) = 258 kcal");

// ---- photos ----
const ph = F.parsePhoto(JSON.stringify({ kind: "meal", items: [{ food: "pasta", alternatives: ["koshari", "rice with lentils"], grams: 300, confidence: 0.45 }] }));
eq([ph.items[0].id, ph.items[0].grams, ph.items[0].alts.map((a) => a.food && a.food.id), ph.items[0].conf], ["pasta", 300, ["pasta", "koshari", "rice"], 0.45], "a plate item with its guesses and how sure the model is");
eq(F.parseHidden(JSON.stringify({ items: [{ food: "olive oil", grams: 10 }, { food: "pasta", grams: 50 }, { food: "ghee", grams: 900 }] }), ph.items).map((x) => [x.id, x.hidden]), [["olive-oil", true]], "the second look: oil added; the pasta not twice; an absurd 900 g ghee dropped");
const k = F.scaleItem(F.chooseFood(ph.items[0], F.food("koshari")), 1.5);
eq([k.id, k.grams, k.kcal], ["koshari", 450, Math.round(F.food("koshari").kcal * 4.5)], "pick Koshari, ×1.5 → 450 g");
F.learnFix("pasta", F.food("koshari"), 1.5);
const again = F.parsePhoto(JSON.stringify({ items: [{ food: "pasta", grams: 300 }] })).items[0];
eq([again.id, again.grams, again.learned], ["koshari", 450, true], "the next “pasta” is your Koshari at your portion");
const lab = F.parsePhoto(JSON.stringify({ kind: "label", label: { name: "Juhayna Greek Yogurt", per: "100g", serving_g: 150, kcal: 97, protein: 9, carbs: 4, fat: 5 } }));
eq([lab.kind, lab.label.kcal, F.itemFromFood(lab.label, 1, "serving").kcal], ["label", 97, 146], "a nutrition label is read exactly (per 100 g; a 150 g serving = 146 kcal)");
const perServ = F.parsePhoto(JSON.stringify({ kind: "label", label: { name: "Bar", per: "serving", serving_g: 50, kcal: 200, protein: 10, carbs: 20, fat: 8 } })).label;
eq([perServ.kcal, perServ.p], [400, 20], "a label per serving is turned into per 100 g");

if (fails.length) { console.log(`\n${fails.length} FAILED`); process.exit(1); } else console.log("\nALL PASSED");
