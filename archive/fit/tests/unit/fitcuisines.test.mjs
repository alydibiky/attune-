// v6.10 Fit: the food of each country — the data is sane, and search, the typed log, suggestions and photo hints follow the country.
import * as C from "../../web-src/fit-cuisines.js";
import * as F from "../../web-src/fit.js";
import * as R from "../../web-src/fitread.js";
import * as P from "../../web-src/fitphoto.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };

// ---- the data ----
const NEED = ["eg", "sa", "ae", "ma", "dz", "tn", "lb", "sy", "jo", "iq", "tr", "ir", "pk", "in", "bd", "id", "my", "cn", "jp", "kr", "ph", "es", "it", "fr", "de", "gb", "us", "mx", "br", "ng", "et", "za", "ru"];
ok(NEED.every((cc) => C.COUNTRIES[cc]), "every required country is there");
ok(Object.keys(C.COUNTRIES).length >= 30, "at least 30 countries (" + Object.keys(C.COUNTRIES).length + ")");
const counts = Object.keys(C.COUNTRIES).map((cc) => [cc, C.dishesOf(cc).length]);
ok(counts.every(([, n]) => n >= 25 && n <= 40), "25–40 dishes for each country: " + counts.map(([c, n]) => c + " " + n).join(", "));
const missing = C.DISHES.filter((d) => !d.id || !d.en || !d.local || !d.ar || !(d.serving > 0) || [d.kcal, d.p, d.c, d.f].some((v) => typeof v !== "number" || v < 0) || !d.meals.length || !d.tags.length || !d.perServing || !Array.isArray(d.aliases));
ok(missing.length === 0, "no dish misses a field " + missing.map((d) => d.id).join(", "));
const ids = new Set(), dupIds = []; for (const d of C.DISHES) { if (ids.has(d.id)) dupIds.push(d.id); ids.add(d.id); }
ok(dupIds.length === 0, "no duplicate ids " + dupIds.join(", "));
const dupNames = [];
for (const cc of Object.keys(C.COUNTRIES)) { const seen = new Set(); for (const d of C.dishesOf(cc)) { const k = d.en.toLowerCase(); if (seen.has(k)) dupNames.push(d.id); seen.add(k); } }
ok(dupNames.length === 0, "no dish twice in one country " + dupNames.join(", "));
const off = C.DISHES.filter((d) => { const m = 4 * d.p + 4 * d.c + 9 * d.f; return Math.abs(m - d.kcal) > Math.max(d.kcal * 0.12, 8); });
ok(off.length === 0, "kcal agrees with 4/4/9 × protein/carbs/fat within 12 % " + off.map((d) => d.id).join(", "));
ok(C.DISHES.every((d) => d.kcal <= 900 && d.p <= 60 && d.c <= 100 && d.f <= 60 && d.serving <= 1000), "per-100 g numbers are in a believable range");
ok(C.DISHES.every((d) => Math.abs(d.perServing.kcal - d.kcal * d.serving / 100) <= 1), "per-serving numbers follow from per 100 g × serving");
ok(C.DISHES.every((d) => !/[A-Za-z]/.test(d.ar) && /[؀-ۿ]/.test(d.ar)), "every Arabic name is Arabic letters only");
ok(C.DISHES.every((d) => d.meals.every((m) => ["breakfast", "lunch", "dinner", "snack"].includes(m))), "meal types are breakfast / lunch / dinner / snack");
ok(C.DISHES.filter((d) => d.same).every((d) => F.food(F.dishFoodId(d.id))), "a dish that is already in the table points at a real food");
ok(C.DISHES.every((d) => F.food(F.dishFoodId(d.id))), "every dish can be logged as a food");

// allDishNames(): the flat list for a photo name bank
const names = C.allDishNames();
ok(names.length > C.DISHES.length * 3 && names.every((x) => x.id && x.foodId && x.cc && x.name && x.lang), "allDishNames(): one row per name with its dish and food id (" + names.length + ")");
ok(names.some((x) => x.name === "ラーメン" && x.foodId === "jp.ramen") && names.some((x) => x.name === "كشري" && x.foodId === "koshari"), "…local script and Arabic names included, Egyptian dishes keep the table's id");

// ---- the default country ----
ok(C.defaultCountry("Africa/Cairo", "en-US") === "eg" && C.defaultCountry("Europe/Istanbul", "en-US") === "tr", "the phone's time zone says the country");
ok(C.defaultCountry("UTC", "ja-JP") === "jp" && C.defaultCountry("UTC", "en-GB") === "gb" && C.defaultCountry("UTC", "xx") === "eg" && C.defaultCountry("", "ar-SA") === "sa", "…else the language's region, else Egypt");
ok(F.getCountry() === "eg", "pure code starts at Egypt");

// ---- search by local script, Arabic and English ----
F.setCountry("tr");
ok(F.searchFoods("Menemen")[0].id === "tr.menemen" && F.searchFoods("منمن")[0].id === "tr.menemen", "Turkey: search finds menemen by its name and its Arabic name");
ok(F.searchFoods("kebab")[0].cc === "tr", "Turkey: «kebab» lists Turkish kebabs first");
F.setCountry("jp");
ok(F.searchFoods("ラーメン")[0].id === "jp.ramen" && F.searchFoods("رامن")[0].id === "jp.ramen", "Japan: ラーメン and رامن find ramen");
F.setCountry("in"); ok(F.searchFoods("बिरयानी")[0].id === "in.hyderabadi-biryani", "India: Devanagari search");
F.setCountry("ru"); ok(F.searchFoods("Борщ")[0].id === "ru.borscht", "Russia: Cyrillic search");
F.setCountry("eg"); ok(F.searchFoods("koshari")[0].id === "koshari" && F.searchFoods("kebab")[0].id === "kebab", "Egypt: the table's own foods first, as before");

// ---- the typed / spoken log ----
const read = (cc, t) => R.readMealText(t, cc);
let r = read("tr", "menemen and 2 simit");
ok(r.items.length === 2 && r.items[0].id === "tr.menemen" && r.items[0].grams === 250 && r.items[1].id === "tr.simit" && r.items[1].grams === 200 && !r.unknown.length, "Turkey: «menemen and 2 simit» → the dishes with their default portions");
r = read("tr", "köfte"); ok(r.items[0] && r.items[0].id === "tr.kofte", "…«köfte» with the accent");
r = read("tr", "kofte"); ok(r.items[0] && r.items[0].id === "tr.kofte", "…and without it (not «corrected» into another word)");
r = read("jp", "ラーメン"); ok(r.items[0] && r.items[0].id === "jp.ramen" && r.items[0].grams === 600, "Japan: ラーメン → a 600 g bowl of ramen");
r = read("jp", "ramen and gyoza"); ok(r.items.map((x) => x.id).join() === "jp.ramen,jp.gyoza", "Japan: «ramen and gyoza»");
r = read("ma", "خبز"); ok(r.items[0] && r.items[0].id === "ma.khobz", "Morocco: «خبز» is Moroccan khobz");
r = read("eg", "خبز"); ok(r.items[0] && r.items[0].id === "baladi", "Egypt: «خبز» is still baladi bread");
r = read("eg", "طبق كشري"); ok(r.items[0] && r.items[0].id === "koshari", "Egypt: «طبق كشري» unchanged");
r = read("ma", "طاجين دجاج"); ok(r.items[0] && r.items[0].id === "ma.tagine-chicken", "Morocco: Arabic «طاجين دجاج»");
r = read("ng", "jollof rice and suya"); ok(r.items.map((x) => x.id).join() === "ng.jollof,ng.suya", "Nigeria: «jollof rice and suya»");
r = read("eg", "menemen"); ok(r.items[0] && r.items[0].id === "tr.menemen", "another country's dish is still found by its exact name");

// ---- suggestions change with the country ----
const tg = { kcal: 2000 };
const ids3 = (cc) => { const p = F.mealPlan(tg, { country: cc, seed: 5 }); return Object.values(p.meals).map((m) => m.recipe.id); };
const eg = ids3("eg"), tr = ids3("tr"), jp = ids3("jp");
ok(eg.every((id) => !id.startsWith("dish:")), "Egypt: the day's plan from the recipe book, as before");
ok(tr.filter((id) => id.startsWith("dish:tr.")).length >= 3 && jp.filter((id) => id.startsWith("dish:jp.")).length >= 3, "Turkey / Japan: breakfast, lunch and dinner are the country's dishes " + tr.join(",") + " | " + jp.join(","));
ok(tr.some((id) => !id.startsWith("dish:")) , "…with an international staple mixed in (the snack)");
ok(JSON.stringify(tr) !== JSON.stringify(jp), "the suggestions differ between countries");
const veg = F.mealPlan(tg, { country: "in", diet: "vegetarian", seed: 1 });
ok(Object.values(veg.meals).every((m) => m.recipe.tags.includes("vegetarian")), "India, vegetarian: every suggestion is vegetarian");
ok(F.countryRecipes("tr").every((rc) => rc.tags.includes("c-tr") && F.recipeNutrients(rc).kcal > 0), "a country's dishes as one-serving recipes with calories");
F.setCountry("tr"); ok(F.mealPlan(tg, { seed: 2 }).meals.lunch.recipe.id.startsWith("dish:tr."), "the plan follows the chosen country by default");

// ---- photo hints ----
const hEg = F.photoHintsFor("eg"), hTr = F.photoHintsFor("tr"), hJp = F.photoHintsFor("jp");
ok(hEg === F.PHOTO_HINTS, "Egypt keeps its photo hints");
ok(hTr.includes("Menemen") && hTr.includes("Lahmacun") && !hTr.includes("Koshari") && hTr.length <= 40, "Turkey: Turkish dishes in the photo hints (" + hTr.length + ")");
ok(hJp.includes("Ramen") && hJp.length <= 40 && JSON.stringify(hJp) !== JSON.stringify(hTr), "Japan: Japanese dishes, different from Turkey's");
const pmTr = F.photoMessages("", "tr")[0].content, pmEg = F.photoMessages("", "eg")[0].content;
ok(/Menemen/.test(pmTr) && /dishes from Turkey/.test(pmTr) && !/Koshari/.test(pmTr) && pmTr.length < 3000, "the photo prompt names Turkish dishes and stays short");
ok(/Koshari/.test(pmEg) && /Egyptian dishes/.test(pmEg), "…the Egyptian prompt is unchanged");
ok(/Japan/.test(P.namesMessages("", "jp")[0].content) && /Egyptian/.test(P.namesMessages("", "eg")[0].content), "the quick look asks for the country's dish names");
ok(hTr.filter((h) => !F.matchFood(h, "tr")).length === 0 && hJp.filter((h) => !F.matchFood(h, "jp")).length === 0, "every hint name maps to a food");
const it = await P.resolveItem(P.unknownItem("Lahmacun"), null); ok(it.id === "tr.lahmacun" && it.grams === 150, "a model's «Lahmacun» is placed, with its serving");
F.setCountry("eg");
