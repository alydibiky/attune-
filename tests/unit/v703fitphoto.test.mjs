// v6.12 — Ali's eggs-on-toast photo: a cut-off model answer keeps its complete foods, no "Fried egg · Fried egg" chips,
// the prompt asks for every layer and every piece, and the fast look's guesses reach the chat model.
const mem = {}; globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => delete mem[k] };
const F = await import("../../web-src/fit.js");
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
// the real model's answer on Ali's photo (Gemma 4 E4B, measured), cut off half-way through the third item
const cut = '{"kind": "meal", "plate": "bowl", "items": [{"food": "fried egg", "alternatives": ["sunny side up", "over easy"], "count": 4, "container": "none", "plate_share": 0.8, "height": "normal", "grams": 150, "confidence": 0.95}, {"food": "toast", "alternatives": ["bread slice"], "count": 4, "container": "none", "plate_share": 0.8, "height": "flat", "grams": 150, "confidence": 0.9}, {"food": "tomato sa';
const r = F.parsePhoto(cut);
ok(r.items.length >= 2 && r.items[0].name === "Fried egg" && /toast/i.test(r.items[1].name), "a cut-off answer keeps the eggs and the toast: " + r.items.map((x) => x.name + " " + x.grams + " g").join(", "));
ok(r.items[0].grams >= 150 && r.items[0].grams <= 220, "4 eggs counted (≈ 4 × 46 g blended with the model's grams)");
const fe = F.matchFood("fried egg");
const alts = F.uniqAlts([{ label: "Fried egg", food: fe }, { label: "fried eggs", food: fe }, { label: "Fried egg", food: null }, { label: "Shakshuka", food: F.matchFood("shakshuka") }]);
ok(alts.length === 2 && alts[1].label === "Shakshuka", "the same food twice is one chip");
const pm = F.photoMessages("", "eg", ["Eggs with tomatoes", "Shakshuka"])[0].content;
ok(/underneath/.test(pm) && /every egg/.test(pm) && /Eggs with tomatoes, Shakshuka/.test(pm) && /ONE line/.test(pm), "the prompt asks for layers, counts, compact JSON and carries the fast hints");
ok(F.jsonLoose("no json here") === null && F.jsonLoose('{"a":1}').a === 1, "jsonLoose: nothing → null, whole JSON as is");
const h = F.parseHidden('{"items":[{"food":"tomato sauce","grams":60,"confidence":0.7},{"food":"chee', [{ name: "Fried egg" }]);
ok(h.length === 1 && /tomato/i.test(h[0].name || h[0].said), "the hidden-calories pass survives a cut-off too");
console.log(fail ? `${fail} FAILED` : "ALL PASSED");
