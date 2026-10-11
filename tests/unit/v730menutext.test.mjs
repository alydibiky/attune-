// v6.16c (Ali: a menu photo «Big BAIK … 1000 kcal» was logged as «fish, 600 kcal») — the text in a food photo comes first.
const P = await import("../../web-src/fitphoto.js");
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const baik = { lines: [{ text: "7:11", h: 30, y: 10 }, { text: "Big BAIK", h: 52, y: 1300 }, { text: "14.50", h: 50, y: 1305 }, { text: "Gianormous chicken fillet breast sandwich", h: 34, y: 1400 },
  { text: "loaded with coleslaw, pickles, and our special", h: 34, y: 1450 }, { text: "sauce", h: 34, y: 1500 }, { text: "Add to order", h: 38, y: 1660 },
  { text: "1000 kcal", h: 34, y: 1830 }, { text: "Dietary", h: 34, y: 1830 }, { text: "Allergens", h: 34, y: 1830 }] };
const m = P.menuFromText(baik);
ok(m && m.name === "Big BAIK" && m.kcal === 1000, "Ali's AlBaik screenshot: the dish and the printed 1000 kcal (not a guess): " + JSON.stringify(m));
const it = P.menuItem(m);
ok(it.quick && it.grams === 0 && it.kcal === 1000 && it.from === "photo-text", "logged as printed (calories, no invented grams)");
ok(JSON.stringify(P.menuFromText({ lines: [{ text: "Big Mac", h: 50 }, { text: "Calories 550", h: 30 }, { text: "$5.99", h: 40 }] })) === JSON.stringify({ name: "Big Mac", kcal: 550 }), "«Calories 550» (word first), the price ignored");
ok(P.menuFromText({ lines: [{ text: "Nutrition Facts", h: 40 }, { text: "Calories 250", h: 30 }] }) === null, "a full nutrition label is left to the label reader (serving vs 100 g)");
ok(P.menuFromText({ lines: [{ text: "A plate of rice", h: 40 }] }) === null && P.menuFromText(null) === null, "no calories printed → no text answer (the photo is looked at as before)");
console.log(fail ? `v730menutext: ${fail} FAILED` : "v730menutext ok");
