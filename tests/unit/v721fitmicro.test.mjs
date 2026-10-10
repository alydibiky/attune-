// v6.14 — vitamins & minerals per food and per day, challenges from the diary.
import assert from "node:assert/strict";
import * as MI from "../../web-src/fitmicro.js";
import * as Y from "../../web-src/fityazio.js";
const day = { meals: { breakfast: [{ id: "egg", grams: 100, kcal: 143 }, { id: "orange", grams: 150, kcal: 70 }], lunch: [{ id: "off:1", grams: 200, kcal: 300, micro: { fe: 2, ca: 100 } }, { id: "mystery", grams: 50, kcal: 90 }] } };
const m = MI.dayMicros(day, "m");
assert.equal(m.total, 4); assert.equal(m.known, 3, "the label product counts, the unknown food does not");
const row = (k) => m.rows.find((r) => r.k === k);
assert.equal(row("vc").v, 80, "orange 150 g → 79.5 mg vitamin C, shown rounded"); assert.equal(row("fe").v, 6, "egg 1.8 + orange 0.15 + label 4");
assert.equal(row("ca").pct, Math.round((56 + 60 + 200) / 1000 * 100));
assert.ok(m.low.includes("vd") && !m.low.includes("vc"));
assert.equal(MI.dayMicros(day, "f").rows.find((r) => r.k === "fe").ref, 18, "women's iron reference");
assert.ok(MI.bestSources("vc").includes("guava"));
// challenges
const days = {}; for (let i = 0; i < 7; i++) { const d = new Date("2026-10-01T12:00:00"); d.setDate(d.getDate() + i); days[d.toISOString().slice(0, 10)] = { meals: { lunch: [{ id: "salad", kcal: 50 }] }, water: i === 3 ? 1000 : 2500 }; }
let p = Y.challengeProgress({ id: "water", start: "2026-10-01" }, days, null, new Date("2026-10-07T20:00:00"));
assert.deepEqual([p.done, p.state, p.marks[3]], [6, "ended", false]);
p = Y.challengeProgress({ id: "veg", start: "2026-10-01" }, days, null, new Date("2026-10-07T20:00:00"));
assert.equal(p.state, "won");
p = Y.challengeProgress({ id: "logall", start: "2026-10-01" }, days, null, new Date("2026-10-03T20:00:00"));
assert.deepEqual([p.state, p.left, p.marks[5]], ["on", 11, null]);
console.log("v721fitmicro ok");
