import assert from "node:assert";
import { parseLine, parseShard, toFood, memoryStore, searchPack, packByBarcode, installPack, tokensOf, norm } from "../../web-src/foodpack.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const L = (code, en, ar, brand, kcal, egypt = 0) => [code, en, ar, brand, kcal, 0, 10.6, 0, 0, "10.6", "", "0.01", "330", egypt, "E", "4"].join("\t");

const r = parseLine(L("6221000000001", "Cola Zero", "كولا زيرو", "Pepsi", 1, 1));
ok(r && r.kcal === 1 && r.egypt === true && r.serving === 330 && r.grade === "E" && r.nova === 4, "a pack line is read");
ok(parseLine("bad line") === null && parseLine("\t\t") === null, "a bad line is skipped");
const f = toFood(r);
ok(f.id === "off:6221000000001" && f.barcode === "6221000000001" && f.en.includes("Pepsi") && f.portions.serving === 330 && f.group === "packaged", "…and becomes the app's food shape");
ok(tokensOf("Coca-Cola Zero 330ml").join() === "coca,cola,zero,330ml" && tokensOf("بسكويت").length === 1, "word starts are the index");

const s = memoryStore();
const lines = [L("6221000000001", "Cola Zero", "كولا زيرو", "Pepsi", 1, 1), L("5449000000002", "Coca-Cola Zero Sugar", "", "Coca-Cola", 0), L("6221000000003", "Cola Light", "", "Local", 2, 1),
  L("6221000000004", "Chocolate wafer", "ويفر شوكولاتة", "Bisco", 520, 1), L("00123456789", "Peanut butter", "", "Skippy", 588)];
await s.putMany(parseShard(lines.join("\n") + "\n"));
ok((await s.count()) === 5, "five products stored");
let res = await searchPack(s, "cola zero");
ok(res.length === 2 && res.every((x) => /zero/i.test(x.en)), "every word must start a word of the name");
res = await searchPack(s, "cola");
ok(res.length === 3 && res[0].egypt, "an Egyptian product comes first");
res = await searchPack(s, "كولا");
ok(res.length === 1 && res[0].barcode === "6221000000001", "Arabic names are found");
res = await searchPack(s, "choc waf");
ok(res.length === 1 && res[0].en.startsWith("Chocolate"), "word starts are enough (choc waf)");
ok((await searchPack(s, "xyz")).length === 0, "nothing found is empty");
ok((await packByBarcode(s, "6221000000003")).en.includes("Cola Light"), "a barcode is one lookup");
ok((await packByBarcode(s, "123456789")) !== null, "a barcode with its zeros cut still matches");
ok((await packByBarcode(s, "999")) === null, "an unknown barcode is null");

// install: shards, progress, resume
const shard = (a, n) => Array.from({ length: n }, (_, i) => L("1" + String(a + i).padStart(12, "0"), "Product " + (a + i), "", "B", 100)).join("\n");
const man = { version: 1, built: "2026-10-03", count: 9000, shards: [{ name: "a", bytes: 1e6 }, { name: "b", bytes: 1e6 }, { name: "c", bytes: 2e6 }] };
const store2 = memoryStore(); const got = []; let asked = [];
const getText = async (n) => { asked.push(n); return n === "a" ? shard(1, 3000) : n === "b" ? shard(5000, 3000) : shard(9000, 3000); };
await installPack({ store: store2, manifest: man, getText, shards: 2, onProgress: (p) => got.push(p.count) });
ok((await store2.count()) === 6000 && got.join() === "3000,6000", "the first shards are installed with progress");
asked = [];
const out = await installPack({ store: store2, manifest: man, getText, onProgress: () => {} });
ok(asked.join() === "c" && out.count === 9000, "a second run only downloads what is missing (resume)");
// scale: 200k products, search stays fast
const big = memoryStore(); const t0 = Date.now();
const words = ["milk", "cola", "bread", "rice", "tuna", "juice", "cheese", "olive", "honey", "tea"]; const rows = [];
for (let i = 0; i < 200000; i++) rows.push(parseLine(L(String(1000000000000 + i), `${words[i % 10]} ${words[(i * 7) % 10]} brand${i % 500} ${i}`, "", "B" + (i % 300), 100 + (i % 400), i % 9 === 0 ? 1 : 0)));
await big.putMany(rows);
const t1 = Date.now(); const rr = await searchPack(big, "cola olive brand1"); const dt = Date.now() - t1;
ok(rr.length > 0 && dt < 400, `200,000 products: a 3-word search answers in ${dt} ms with ${rr.length} results`);
