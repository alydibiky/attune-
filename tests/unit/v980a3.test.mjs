// v9.8 A3 (Ali picked "what changed on top"): only what is new since yesterday — a find, a drop, a rise, one waiting for the OK
globalThis.localStorage = { _: {}, getItem(k) { return this._[k] ?? null; }, setItem(k, v) { this._[k] = String(v); }, removeItem(k) { delete this._[k]; } };
import assert from "node:assert/strict";
const A = await import("../../web-src/agents.js");
const now = Date.parse("2026-11-07T10:00:00"), H = 3600e3;
const agents = [
  { id: "h", kind: "watch", title: "Hotels · Makkah", checks: [{ at: now - 30 * H, price: 2780 }, { at: now - 2 * H, price: 2450, name: "Swissotel Makkah", href: "https://www.booking.com/hotel/sa/swissotel-makkah.html" }] },
  { id: "f", kind: "watch", title: "Cairo → Jeddah", below: 10000, checks: [{ at: now - 50 * H, price: 11050 }], found: { at: now - 5 * H, price: 9850, name: "EgyptAir" } },
  { id: "q", kind: "watch", title: "Quiet one", checks: [{ at: now - 3 * H, price: 500 }, { at: now - 2 * H, price: 500 }] },
  { id: "o", kind: "watch", title: "Old drop", checks: [{ at: now - 90 * H, price: 900 }, { at: now - 80 * H, price: 700 }] },
  { id: "b", kind: "buy", title: "AirPods", pending: { price: 8900, name: "AirPods Pro 2" }, step: "confirm" },
  { id: "p", kind: "watch", title: "Paused", on: false, found: { at: now - H, price: 1 } },
];
const w = A.whatChanged(agents, now);
assert.deepEqual(w.map((x) => x.id + ":" + x.kind), ["b:needs", "f:found", "h:drop"], "needs first, then finds, then drops; quiet, old and paused ones stay out");
assert.equal(w[2].was, 2780); assert.equal(w[2].price, 2450); assert.ok(/swissotel-makkah/.test(w[2].href), "the drop keeps the listing it came from");
assert.equal(A.whatChanged([], now).length, 0);
console.log("ALL PASSED v980a3 (5 checks)");
