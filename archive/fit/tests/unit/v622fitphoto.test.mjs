// v6.10 Fit photo: one time budget, the fallback chain's pieces, names matched by the reader and the food pack.
import * as P from "../../web-src/fitphoto.js";
import * as F from "../../web-src/fit.js";
import { memoryStore, parseShard, searchPack } from "../../web-src/foodpack.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };

// budget
let t = 0; const b = P.budget(60000, () => t);
ok(b.slice(42000, 14000) === 42000, "the first look gets its full share at the start");
t = 50000; ok(b.left() === 10000 && b.slice(20000, 2000) === 8000, "later calls get only what is left, minus the reserve");
t = 70000; ok(b.left() === 0 && b.slice(5000) === 0, "the budget never goes negative");

// withLimit
let aborted = 0;
try { await P.withLimit(new Promise(() => {}), 30, () => aborted++); ok(false, "a hung call times out"); } catch (e) { ok(e.message === "slow" && aborted === 1, "a hung call times out and the model is cancelled"); }
try { await P.withLimit(Promise.resolve(1), 0, () => aborted++); ok(false, "zero time"); } catch (e) { ok(e.message === "slow" && aborted === 2, "no time left → fails at once, no call left running"); }
ok((await P.withLimit(Promise.resolve(7), 1000)) === 7, "a quick call passes through");

// quick look
ok(P.namesMessages("eggs").length === 2 && P.namesMessages("eggs")[0].content.length < 600, "the quick look prompt is tiny");
ok(P.parseNames("2 fried eggs, baladi bread and tea.").join("|") === "2 fried eggs|baladi bread|tea", "names split on commas and 'and'");
ok(P.parseNames("- Koshari\n- Tomato sauce\n1. Fried onions").join("|") === "Koshari|Tomato sauce|Fried onions", "bullets and numbers are cut");
ok(P.parseNames('{"items":[{"food":"ful medames"},{"food":"taameya"}]}').join("|") === "ful medames|taameya", "a JSON reply still gives names");
ok(P.parseNames("none").length === 0 && P.parseNames("").length === 0, "no food → nothing");
ok(P.parseNames("فول، طعمية، عيش بلدي").length === 3, "Arabic commas split");

// the reader places names the table didn't
const fatta = await P.resolveItem(P.unknownItem("Fatta"), null);
ok(fatta.id === "fatta" && fatta.kcal > 0 && !fatta.unknown && fatta.matched === "reader", "an Egyptian dish name is placed by the offline reader");
const eggs = await P.namesToItems(["2 fried eggs", "baladi bread", "طعمية"], null);
ok(eggs[0].id === "egg-fried" && eggs[0].grams === 92, "a count from the quick look gives the grams (2 eggs = 92 g)");
ok(eggs[1].id && /baladi/.test(eggs[1].id) && eggs[2].id === "taameya", "bread and Arabic names are placed");
ok(eggs.every((x) => x.chosen === false), "a match by code is not counted as the person's own correction");
const kept = await P.resolveItem({ ...P.unknownItem("Fatta", 300), guessGrams: false }, null);
ok(kept.grams === 300, "grams the model judged on the plate are kept");

// the food pack places what the reader can't
const row = (code, en, brand, kcal, egypt = 0) => [code, en, "", brand, kcal, 5, 60, 10, 2, "", "", "", "", egypt, "", ""].join("\t");
const s = memoryStore();
await s.putMany(parseShard([row("1001", "Zorbrex crackers", "", 430, 1), row("1002", "Zorbrex crackers cheese flavour family pack extra large", "BrandX", 480),
  row("1003", "Zorbrex crackers", "BrandY", 440)].join("\n") + "\n"));
const ps = (q, n) => searchPack(s, q, n);
const z = await P.resolveItem(P.unknownItem("zorbrex crackers"), ps);
ok(z.id === "off:1001" && z.kcal != null && z.matched === "pack", "an unknown name is found in the food pack (generic, Egyptian first)");
ok(P.bestPackMatch("zorbrex", [{ en: "Zorbrex crackers cheese flavour family pack extra large", kcal: 1 }]) === null, "a long product sharing one word is not accepted");
const slow = await P.resolveItem(P.unknownItem("qwxyz thing"), () => new Promise(() => {}), 30);
ok(slow.unknown === true, "a slow or empty pack never blocks: the item stays for the person to name");

// the person's note
ok(P.noteItems("2 eggs and baladi bread").length === 2 && P.noteItems("").length === 0 && P.noteItems("glorpfood").length === 0, "the note under the photo is read offline");

// the shorter full-look prompt
const pm = F.photoMessages()[0].content;
ok(pm.length < 3000 && /Koshari/.test(pm) && /Ful medames/.test(pm), "the photo prompt is short and names Egyptian dishes");
ok(F.PHOTO_HINTS.filter((h) => !F.matchFood(h) && !P.noteItems(h).length).length === 0, "every hint name maps to a food");
const pr = F.parsePhoto('{"kind":"meal","items":[{"food":"Fatta","grams":350,"confidence":0.8}]}');
const fixed = await P.resolveItems(pr.items, null);
ok(fixed[0].id === "fatta" && fixed[0].grams === 350, "a photo item the table missed is placed and keeps its grams");
