// v9.6 (Ali picked A3 + A4): "more than 1 option in more than 1 date" — a grid of dates × the best offers on each
import assert from "node:assert/strict";
const LS = {}; globalThis.localStorage = { getItem: (k) => LS[k] ?? null, setItem: (k, v) => { LS[k] = String(v); }, removeItem: (k) => delete LS[k] };
const A = await import("../../web-src/agents.js");
const o = (d, name, price) => ({ checkin: d, checkout: "x", name, price });
const seen = [o("2026-12-10", "Swissôtel", 41800), o("2026-12-10", "Pullman", 43200), o("2026-12-10", "Hilton", 44900), o("2026-12-10", "Fairmont", 47000), o("2026-12-10", "Swissôtel", 42000),
  o("2026-12-12", "Swissôtel", 42500), o("2026-12-12", "Mövenpick", 44100), o("2026-12-14", "Hilton", 43000), o("2026-12-16", "Raffles", 60000)];
const g = A.offersByDay(seen, 3, 3);
assert.deepEqual(g.map((x) => x.date), ["2026-12-10", "2026-12-12", "2026-12-14"], "the 3 cheapest dates, in date order");
assert.equal(g[0].offers.length, 3, "3 offers on a date"); assert.deepEqual(g[0].offers.map((x) => x.name), ["Swissôtel", "Pullman", "Hilton"], "the same hotel once, cheapest first");
const grid = A.datesGrid({ byDay: g });
assert.equal(grid.kind, "dates"); assert.equal(grid.best.price, 41800);
const g2 = A.datesGrid({ best3: seen.slice(0, 3) });
assert.equal(g2.kind, "dates", "one date with several offers still shows as a grid");
const g3 = A.datesGrid({ checks: [{ at: Date.parse("2026-11-01"), price: 9400 }, { at: Date.parse("2026-11-03"), price: 8650 }] });
assert.equal(g3.kind, "checks"); assert.equal(g3.best.price, 8650, "a single product: its price over the check days");
const chat = A.agentChat({ said: "Tell me when hotels near the Haram are under 45k", created: 1, every: 360, checks: [{ at: 5, price: 41800 }], found: { at: 6, price: 41800 } });
assert.equal(chat[0].who, "me"); assert.ok(chat.some((m) => m.found)); assert.equal(chat[chat.length - 1].found, true);
// v9.6 Ali's screenshot: four "didn't show prices" in a row → one message with the count; "Price" is never a hotel's name
const c2 = A.agentChat({ said: "x", created: 1, checks: [{ at: 2, price: 41495 }, { at: 3, blocked: true }, { at: 4, blocked: true }, { at: 5, blocked: true }, { at: 6, blocked: true }] });
const misses = c2.filter((m) => m.T && /didn't show prices/.test(m.T[0]));
assert.equal(misses.length, 1, "one message for the misses in a row"); assert.equal(misses[0].T[1].n, 4);
const R = await import("../../web-src/agent-rules.js");
assert.ok(R.isSiteName("Price", "Booking.com") && R.isSiteName("Book now") && !R.isSiteName("Swissotel Makkah", "Booking.com"));
console.log("ALL PASSED v960agents (14 checks)");
