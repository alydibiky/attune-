// v8.9 (Ali: Yazio read "mushroom sauce and sourdough bread", Attune said "cream of mushroom soup 225 kcal"): the new café dishes,
// a sauce alone gives way to the dish served in it, the sauce's quarters count for that dish, and bread at the side is added.
const C = await import("../../web-src/fitclip.js");
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log("FAIL " + m); } };
const it = (id, en) => ({ kind: "id", id, en, ar: "" });
const bank = { auto: 0.5, items: [it("mushroom-sauce", "Creamy mushroom sauce"), it("chicken-mushroom", "Chicken in creamy mushroom sauce"), it("mushroom-soup", "Cream of mushroom soup"),
  it("ciabatta", "Ciabatta bread"), it("garlic-bread", "Garlic bread"), it("rice", "White rice (cooked)")] };
const full = [{ i: 0, p: 0.67 }, { i: 1, p: 0.23 }, { i: 2, p: 0.02 }];
const d = C.decide(bank, full);
ok(d.items[0].said === "Chicken in creamy mushroom sauce", "a sauce alone gives way to the dish served in it");
const regions = [[{ i: 4, p: 0.05 }, { i: 3, p: 0.04 }], [{ i: 1, p: 0.21 }, { i: 0, p: 0.21 }], [{ i: 0, p: 0.3 }, { i: 1, p: 0.15 }], [{ i: 0, p: 0.37 }, { i: 1, p: 0.21 }]];
const p = C.plateScan(bank, full, regions);
ok(p.items.length === 2, "two items: the dish and the bread (" + p.items.map((x) => x.said).join(" + ") + ")");
ok(p.items[0].said === "Chicken in creamy mushroom sauce" && p.items[0].grams === 350, "the sauce's quarters count for the dish: a full plate (350 g)");
ok(p.items[1].said === "Ciabatta bread" && p.items[1].grams === 80 && p.items[1].side, "bread at the side: plain bread, two slices, removable");
const bank2 = { ...bank, items: [...bank.items, it("omelette-mushroom", "Omelette with creamy mushroom sauce")] };
const full2 = [{ i: 0, p: 0.67 }, { i: 1, p: 0.23 }, { i: 6, p: 0.03 }, { i: 2, p: 0.02 }];
ok(C.plateScan(bank2, full2, regions, { meal: "breakfast" }).items[0].said === "Omelette with creamy mushroom sauce", "breakfast: the egg dish under the sauce (Ali's omelette)");
ok(C.plateScan(bank2, full2, regions, { meal: "lunch" }).items[0].said === "Chicken in creamy mushroom sauce", "lunch: the photo's own order");
const rice = C.plateScan(bank, [{ i: 5, p: 0.8 }], [[{ i: 5, p: 0.6 }], [{ i: 5, p: 0.6 }], [{ i: 5, p: 0.6 }], [{ i: 5, p: 0.6 }]]);
ok(rice.items.length === 1, "a plate of rice gets no bread");
console.log(bad ? bad + " FAILED" : "PASS v890photo: sauce plates and bread on the side");
