// v6.36 the generic foods in the food pack (USDA FoodData Central): vitamins, real portions, Arabic names, ranked first for plain names
import * as FP from "../../web-src/foodpack.js";
let fails = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const gen = 'usda:168878\tRice, white, long-grain, regular, enriched, cooked\tرز أبيض مطبوخ\t\t130\t2.7\t28.2\t0.3\t0.4\t0.1\t0.1\t0.0\t158.0\t0\t\t0\t{"fe":1.2,"ca":10,"k":35,"mg":12,"zn":0.49}\t{"1 cup":158.0,"2 tablespoons":24}';
const r = FP.parseLine(gen);
ok(r && r.micro && r.micro.fe === 1.2 && r.portions["1 cup"] === 158, "the two extra columns are read (vitamins, portions)");
const f = FP.toFood(r);
ok(f.id === "usda:168878" && f.generic && f.micro.zn === 0.49, "a generic food keeps its vitamins and minerals");
ok(f.portions.cup === 158 && f.portions.tablespoons === 12, "its portions become units (1 cup = 158 g; 2 tablespoons → 12 g each)");
const prod = "6221007012345\tRice pudding\tرز بلبن\tJuhayna\t120\t3\t20\t3\t0\t15\t2\t0.1\t100\t1\tc\t3";
const st = FP.memoryStore();
await st.putMany([FP.parseLine(gen), FP.parseLine(prod), FP.parseLine("1\tRice crackers white\t\tBrandX\t390\t8\t80\t3\t1\t1\t1\t1\t30\t0\t\t0")]);
const hits = await FP.searchPack(st, "rice white", 5);
ok(hits[0] && hits[0].generic, "a plain name finds the generic food first: " + (hits[0] && hits[0].en));
const ar = await FP.searchPack(st, "رز مطبوخ", 5);
ok(ar[0] && ar[0].id === "usda:168878", "…and the Arabic name finds it too");
const b = await FP.searchPack(st, "juhayna rice", 5);
ok(b[0] && !b[0].generic, "a brand name finds the product");
if (fails) { console.log(fails + " FAILED"); process.exit(1); } else console.log("ALL PASSED");
