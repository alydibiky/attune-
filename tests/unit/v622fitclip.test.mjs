// v6.10 Fit photo fast path (fitclip.js): the bank file, ranking, the confidence rule, the draft items, the names list.
import * as C from "../../web-src/fitclip.js";
import * as F from "../../web-src/fit.js";
import { readFileSync } from "fs";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };

// a tiny bank: 6 names on 6 axes (int8 + one scale per row, base64 — the same layout the build script writes)
const DIM = 8;
const items = [["id", "koshari", "Koshari", "كشري"], ["id", "ful", "Ful medames", "فول"], ["like", "cake", "Cheesecake", "تشيز كيك"],
  ["name", "", "Lupini beans", "ترمس"], ["not", "", "a person's face", ""], ["id", "egg-fried", "Fried egg", "بيض مقلي"]];
const q = new Int8Array(items.length * DIM);
items.forEach((_, i) => { q[i * DIM + i] = 127; q[i * DIM + 7] = 20; });
const raw = { v: 1, dim: DIM, items, scale: items.map(() => 0.01), bias: items.map((_, i) => (i === 1 ? 0.2 : 0)), biasWeight: 0.5,
  vec: Buffer.from(q.buffer).toString("base64"), image: { size: 4, mean: [0.5, 0.5, 0.5], std: [0.5, 0.5, 0.5] } };
const bank = C.parseBank(raw);
ok(bank.n === 6 && bank.dim === DIM && bank.vec.length === 48, "the bank file is read: 6 names × 8 numbers");
let n0 = 0; for (let d = 0; d < DIM; d++) n0 += bank.vec[d] ** 2;
ok(Math.abs(n0 - 1) < 1e-5, "every name's vector is a unit vector after the int8 is undone");
ok(Math.abs(bank.bias[1] - 0.1) < 1e-6 && bank.bias[0] === 0, "the per-name bias is weighted (0.5 × 0.2)");
let threw = false; try { C.parseBank({}); } catch (e) { threw = true; } ok(threw, "a broken bank file is refused");

const v = (...pairs) => { const e = new Float32Array(DIM); for (let k = 0; k < pairs.length; k += 2) e[pairs[k]] = pairs[k + 1]; return e; };
let r = C.rank(bank, v(0, 1), 5);
ok(r.length === 5 && r[0].i === 0 && r[0].p > 0.99, "a photo close to koshari → koshari first, sure");
ok(r.every((x, k) => k === 0 || x.score <= r[k - 1].score), "the list is best first");
const p = r.reduce((a, x) => a + x.p, 0); ok(p <= 1.0001, "shares come from one softmax over the whole bank");
r = C.rank(bank, v(0, 1, 1, 1.05), 5);
ok(r[0].i === 0, "the bias takes the 'close to every brown plate' pull off ful medames (it would win by 0.05 without it)");
ok(C.rank(bank, v(0, 3), 1)[0].p === C.rank(bank, v(0, 1), 1)[0].p, "the photo vector's length doesn't matter");

// the confidence rule
let d = C.decide(bank, C.rank(bank, v(0, 1)));
ok(d.status === "auto" && d.items.length === 1, "sure → taken as the answer");
const it = d.items[0];
ok(it.id === "koshari" && it.kcal > 0 && it.grams > 0 && it.base === it.grams && it.fast, "the item is the table's koshari with its own portion and calories, at once");
ok(it.conf >= 0.75 && it.conf <= 0.99, "the dot is green");
ok(it.alts.length >= 3 && it.alts[0].food.id === "koshari" && it.alts.every((a) => a.food && a.food.kcal != null), "the next names are the one-tap alternatives (foods with calories)");
ok(new Set(it.alts.map((a) => a.food.id + a.food.en)).size === it.alts.length, "no alternative twice");
d = C.decide(bank, C.rank(bank, v(0, 0.02, 5, 0.02, 7, 1)));
ok(d.status === "guess" && d.items[0].conf < 0.75, "close call → a guess (the chat model may look first)");
d = C.decide(bank, C.rank(bank, v(4, 1)));
ok(d.status === "notfood" && d.items.length === 0, "a face → not food, the usual chain runs");
d = C.decide(bank, C.rank(bank, v(2, 1)));
ok(d.items[0].name === "Cheesecake" && d.items[0].ar === "تشيز كيك" && d.items[0].estimate && d.items[0].like === "cake" && d.items[0].kcal === Math.round(F.food("cake").kcal * d.items[0].grams / 100), "a dish the table lacks keeps its own name, calories estimated from the nearest table food");
d = C.decide(bank, C.rank(bank, v(3, 1)));
ok(d.items[0].unknown && d.items[0].said === "Lupini beans" && d.items[0].ar === "ترمس", "a dish found by name goes to the reader / food pack with its Arabic name");
ok(C.decide(bank, []).status === "notfood", "nothing ranked → the usual chain");
ok(C.decide(bank, C.rank(bank, v(0, 1)), 1.01).status === "guess", "the threshold is a parameter");

// portions: same as picking the food in search
ok(C.defaultItem(F.food("koshari")).grams === F.food("koshari").portions[Object.keys(F.food("koshari").portions)[0]], "the first portion of the food (a plate of koshari)");
ok(C.defaultItem({ id: "x", en: "X", kcal: 100, p: 1, c: 1, f: 1, portions: {} }).grams === 100, "no portion → 100 g");

// pixels
ok(JSON.stringify(C.centerSquare(400, 300)) === JSON.stringify({ sx: 50, sy: 0, s: 300 }) && C.centerSquare(300, 500).sy === 100, "the centre square of a wide and a tall photo");
const px = new Uint8ClampedArray(4 * 4 * 4); for (let i = 0; i < 16; i++) { px[i * 4] = 255; px[i * 4 + 1] = 0; px[i * 4 + 2] = 127.5; px[i * 4 + 3] = 255; }
const t = C.toTensor(px, 4, [0.5, 0.5, 0.5], [0.5, 0.5, 0.5]);
ok(t.length === 48 && t[0] === 1 && t[16] === -1 && Math.abs(t[32]) < 0.01, "pixels → channels first, normalised (red 1, green −1, blue 0)");

// the names list the bank is built from: every table id exists, every shown Arabic name is Arabic only
const here = typeof __dirname !== "undefined" ? __dirname : "tests/unit";   // bundled to tests/unit/.out-*.cjs by run.mjs
const tsv = readFileSync(here + "/../../tools/food_clip_names.tsv", "utf8").split("\n").filter((l) => l.trim() && !l.startsWith("#")).map((l) => l.split("\t"));
const bad = tsv.filter(([tag]) => tag !== "-" && tag !== "!" && !F.food(tag.replace(/^~/, "")));
ok(tsv.length > 250 && bad.length === 0, `the names list (${tsv.length} lines) only names foods the table has${bad.length ? ": " + bad.map((x) => x[0]).join(", ") : ""}`);
const noAr = tsv.filter(([tag, , a]) => (tag === "-" || tag.startsWith("~")) && (!a || /[A-Za-z]/.test(a)));
ok(noAr.length === 0, "every dish the table lacks has an Arabic name with no Latin letters" + (noAr.length ? ": " + noAr.map((x) => x[1]).join(", ") : ""));
const egypt = ["koshari", "ful", "taameya", "molokhia", "fatta", "mahshi", "hawawshi", "kofta", "shawarma", "feteer", "om ali", "basbousa", "konafa", "bechamel"];
const allNames = tsv.map((x) => x[1].toLowerCase()).join("|") + "|" + F.FOODS.map((f) => f.names.join("|").toLowerCase()).join("|");
ok(egypt.every((w) => allNames.includes(w)), "the Egyptian dishes Ali named are all in the bank");

// ---- v6.17: bank v2 — two models, the user's cuisine first (Ali: "53 percent is not accurate at all") ----
{
  const items2 = [["like", "kofta", "Kibbeh", "كبة", "lb"], ["like", "kofta", "Arancini", "أرانشيني", "it"], ["id", "koshari", "Koshari", "كشري", "base"],
    ["id", "egg-fried", "Fried egg", "بيض مقلي", "plain"], ["not", "", "a person's face", "", "not"], ["like", "cake", "Cheesecake", "تشيز كيك", "intl"]];
  const D = 6, enc = (rows) => { const q = new Int8Array(items2.length * D); rows.forEach((r, i) => r.forEach((x, d) => { q[i * D + d] = x; })); return Buffer.from(q.buffer).toString("base64"); };
  const eye = items2.map((_, i) => Array.from({ length: D }, (_, d) => (d === i ? 127 : 5)));
  const raw2 = { v: 2, count: items2.length, items: items2, prior: { own: 0.5, region: 0.5, other: -1 }, temp: 1.5, auto: 0.6,
    encoders: [{ file: "a.onnx", dim: D, output: "image_embeds", image: { size: 4, mean: [0, 0, 0], std: [1, 1, 1], fit: "crop" }, scale: items2.map(() => 0.01), vec: enc(eye) },
               { file: "b.onnx", dim: D, output: "pooler_output", image: { size: 4, mean: [0, 0, 0], std: [1, 1, 1], fit: "stretch" }, scale: items2.map(() => 0.01), vec: enc(eye) }] };
  const b2 = C.parseBank(raw2);
  ok(b2.v === 2 && b2.encoders.length === 2 && b2.items[0].cc === "lb" && b2.auto === 0.6, "bank v2 is read: two models, each dish's country, its own confidence rule");
  ok(C.priorOf("eg", "eg", raw2.prior) === 0.5 && C.priorOf("lb", "eg", raw2.prior) === 0.5 && C.priorOf("it", "eg", raw2.prior) === -1 && C.priorOf("intl", "eg", raw2.prior) === 0 && C.priorOf("base", "eg", raw2.prior) === 0.5,
    "for a user in Egypt: Egyptian and Arab dishes up, a far cuisine down, international and plain foods neutral");
  ok(C.priorOf("base", "tr", raw2.prior) === 0 && C.priorOf("tr", "tr", raw2.prior) === 0.5, "a user in Turkey: Turkish dishes up, Egypt's own table neutral");
  const e = (i, j, w) => { const x = new Float32Array(D); x[i] = 1; x[j] = w; return x; };
  // a photo halfway between kibbeh (Lebanese) and arancini (Italian): the region decides for a user in Egypt, not for one in Italy
  let r = C.rankAll(b2, [e(0, 1, 0.98), e(1, 0, 0.98)], 3, "eg");
  ok(b2.items[r[0].i].en === "Kibbeh", "Egypt: a fried bulgur ball is Kibbeh, not Arancini");
  r = C.rankAll(b2, [e(0, 1, 0.98), e(1, 0, 0.98)], 3, "it");
  ok(b2.items[r[0].i].en === "Arancini", "Italy: the same photo is Arancini");
  r = C.rankAll(b2, [e(2, 3, 0), e(2, 3, 0)], 5, "eg");
  ok(b2.items[r[0].i].en === "Koshari" && r[0].p > 0.6 && C.decide(b2, r).status === "auto", "both models agree on koshari → taken at once");
  r = C.rankAll(b2, [e(2, 3, 0), e(0, 3, 0)], 5, "eg");   // one model says koshari, the other kibbeh (both home dishes)
  ok(C.decide(b2, r).status === "guess", "the models disagree → not taken blindly: the choices are shown");
}

// ---- v6.17: the phone learns from your own photos ----
{
  const items3 = [["like", "kofta", "Kibbeh", "كبة", "lb"], ["id", "kofta", "Kofta", "كفتة", "base"], ["id", "koshari", "Koshari", "كشري", "base"], ["like", "cake", "Cheesecake", "تشيز كيك", "intl"]];
  const D = 4, eye = items3.map((_, i) => Array.from({ length: D }, (_, d) => (d === i ? 127 : 0)));
  const enc = () => { const q = new Int8Array(items3.length * D); eye.forEach((r, i) => r.forEach((x, d) => { q[i * D + d] = x; })); return Buffer.from(q.buffer).toString("base64"); };
  const b3 = C.parseBank({ v: 2, items: items3, prior: { own: 0.5, region: 0.5, other: -1 }, temp: 2, auto: 0.6,
    encoders: [0, 1].map(() => ({ file: "x.onnx", dim: D, image: {}, scale: items3.map(() => 0.01), vec: enc() })) });
  const mem = new Map(), store = { getItem: (k) => mem.get(k) || null, setItem: (k, v) => mem.set(k, v) };
  const photo = [new Float32Array([0.1, 0.55, 0.6, 0.1]), new Float32Array([0.1, 0.55, 0.6, 0.1])];   // a close call: koshari just ahead of kofta
  ok(b3.items[C.rankAll(b3, photo, 3, "eg")[0].i].en === "Koshari", "before: the matcher says Koshari");
  ok(C.remember(b3, photo, "kofta", "", store), "you corrected it to Kofta: the photo is remembered with Kofta");
  ok(b3.items[C.remember(b3, photo, "kofta", "Kibbeh", store) && C.loadMemory(store).length === 2 ? 0 : 0].en === "Kibbeh" && JSON.parse(mem.get(C.MEM_KEY))[1].key === "kofta|Kibbeh",
    "a dish estimated from another food is remembered as itself (Kibbeh, not Kofta)");
  mem.set(C.MEM_KEY, JSON.stringify(JSON.parse(mem.get(C.MEM_KEY)).slice(0, 1)));
  const again = [new Float32Array([0.12, 0.55, 0.6, 0.1]), new Float32Array([0.1, 0.56, 0.6, 0.11])];   // a new photo of the same plate
  ok(b3.items[C.rankAll(b3, again, 3, "eg", C.loadMemory(store))[0].i].en === "Kofta", "next time a photo like it is Kofta");
  const other = [new Float32Array([0, 0, 0, 1]), new Float32Array([0, 0, 0, 1])];
  ok(b3.items[C.rankAll(b3, other, 3, "eg", C.loadMemory(store))[0].i].en === "Cheesecake", "a photo that doesn't look like it is untouched");
}
