// v6.42 (Ali's lunch photo: breaded chicken read as grilled breast, the soup and the potatoes missed).
import * as F from "../../web-src/fit.js";
let bad = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) bad++; };
ok(F.matchFood("Chicken soup").id === "chicken-soup" && F.matchFood("Mushroom soup").id === "mushroom-soup", "the dish kind decides: chicken soup is a soup, mushroom soup is a soup");
ok(F.matchFood("Chicken pané (breaded, fried)").id === "chicken-panee" && F.matchFood("Fried chicken").id === "chicken-fried", "pané and fried chicken keep their own foods");
ok(F.matchFood("Egg sandwich").id === "egg-sandwich" && F.matchFood("Chicken breast").id === "chicken-breast", "sandwiches and plain chicken breast unchanged");
const sys = F.photoMessages("", "eg")[0].content;
ok(/Chicken pané/.test(sys) && /crumbed = breaded and fried/.test(sys) && /Bowls \(soup/.test(sys), "the photo prompt names pané, how to tell cooking styles, and to look for bowls and sides");
ok(/another dish or bowl \(soup/.test(F.hiddenMessages([{ name: "Chicken pané" }])[0].content), "the second look asks for other dishes too, not only oil and sauces");
// F1 (Ali picked B): a bank card or the plate's width as the ruler
const mem = {}; globalThis.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
const rice = { food: "White rice", plate_share: 0.5, height: "normal", grams: 200, confidence: 0.9 };
const plain = F.parsePhoto(JSON.stringify({ kind: "meal", plate: "dinner plate", items: [rice] }));
ok(plain.ruler === null && plain.items[0].ruler === undefined, "no card, no plate set: no ruler (the 26 cm guess)");
// a 26 cm plate = 531 cm²; a card 8.56 × 5.4 cm. Plate box 0.6 × 0.6, card box w×h so that the plate measures 32 cm
const cardFor = (cm, pb = 0.6) => { const area = Math.PI * (cm / 2) ** 2, box = pb * pb * (Math.PI / 4) * F.CARD_CM2 / area; const w = Math.sqrt(box * 1.585), h = box / w; return [0.05, 0.05, w, h]; };
const big = F.parsePhoto(JSON.stringify({ kind: "meal", plate: "dinner plate", card: cardFor(32), plate_box: [0.2, 0.2, 0.6, 0.6], items: [rice] }));
ok(big.ruler && big.ruler.by === "card" && Math.abs(big.ruler.plateCm - 32) <= 1 && big.items[0].ruler === "card", "a card in the photo measures the plate: " + (big.ruler && big.ruler.plateCm) + " cm");
ok(big.items[0].grams > plain.items[0].grams * 1.2, "a bigger real plate → more rice (" + plain.items[0].grams + " g → " + big.items[0].grams + " g)");
const absurd = F.parsePhoto(JSON.stringify({ kind: "meal", plate: "dinner plate", card: cardFor(80), plate_box: [0.2, 0.2, 0.6, 0.6], items: [rice] }));
ok(!absurd.ruler || absurd.ruler.plateCm2 === null, "a card that makes the plate 80 cm is not used for the plate");
F.setMyPlateCm(20);
const mine = F.parsePhoto(JSON.stringify({ kind: "meal", plate: "dinner plate", items: [rice] }));
ok(F.myPlateCm() === 20 && mine.ruler.by === "plate" && mine.items[0].grams < plain.items[0].grams && mine.items[0].ruler === "plate", "my plate is 20 cm → less rice than the 26 cm guess (" + mine.items[0].grams + " g)");
F.setMyPlateCm(""); ok(F.myPlateCm() === null, "clearing the plate width forgets it");
const loose = F.parsePhoto(JSON.stringify({ kind: "meal", plate: "none", card: [0.1, 0.1, 0.2, 0.12], items: [{ food: "White rice", height: "normal", box: [0.4, 0.4, 0.3, 0.3], grams: 150 }] }));
ok(loose.ruler && loose.ruler.by === "card" && loose.items[0].grams > 0 && loose.items[0].grams < 600, "no plate: each food measured against the card (" + loose.items[0].grams + " g)");
ok(/bank card is a ruler, never an item/.test(sys) && /"card": box of a bank card/.test(sys), "the prompt asks for the card's box and never to list it as food");
console.log(bad ? bad + " FAILED" : "v742food ok");
