// v9.9.21 OK-3 / OK-4 — exactly 10,000 edits of real-looking agents (hotels in 12 cities, flights on 10 routes, products in 6 stores'
// countries), every kind of setting, valid and invalid values. Each case says what MUST happen (the oracle is written here, not taken
// from agentedit.js): the new value is there, the search link follows it, old offers are cleared only when the search changed, and a
// bad value changes NOTHING. node tests/agentedit/gen.mjs [n] → prints the pass rate; writes report.md.
import fs from "fs";
const E = await import(process.env.AGENTEDIT || "../../web-src/agentedit.js");
const N = +(process.argv[2] || 10000), now = Date.parse("2026-11-12T10:00:00");
let seed = 7 + 7919 * +(process.env.SEED_SHIFT || 0); const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff) / 2147483648), pick = (l) => l[Math.floor(rnd() * l.length)], int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const iso = (t) => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const day = (n) => iso(now + n * 864e5), span = (a, b) => Math.round((Date.parse(b + "T12:00:00") - Date.parse(a + "T12:00:00")) / 864e5);
const CITIES = ["Masjid al-Haram, Makkah", "Madinah", "Dubai Marina", "Sharm El Sheikh", "Istanbul", "Paris", "London", "Cairo", "Jeddah", "Riyadh", "Kuala Lumpur", "Bali"];
const ROUTES = [["CAI", "JED"], ["CAI", "DXB"], ["RUH", "IST"], ["JED", "CAI"], ["LHR", "CAI"], ["CAI", "MED"], ["DXB", "BKK"], ["CAI", "AMM"], ["KWI", "CAI"], ["CGK", "JED"]];
const PRODUCTS = ["Huawei FreeClip 2", "iPhone 16 Pro 256GB", "Samsung Galaxy S25", "Sony WH-1000XM5", "PlayStation 5 Slim", "Dyson V15"];
const offers = () => Array.from({ length: int(0, 10) }, (_, i) => ({ name: "Offer " + i, price: 1000 + i * 100, href: "https://x/" + i }));
const hotel = () => { const ci = day(int(3, 120)), n = int(1, 14); return { id: "h", kind: "watch", site: "Booking.com", below: int(0, 1) ? int(5000, 90000) : 0, currency: "EGP",
  fields: { city: pick(CITIES), checkin: ci, checkout: iso(Date.parse(ci + "T12:00:00") + n * 864e5), nights: n, adults: int(1, 4), rooms: int(1, 2), ...(int(0, 1) ? { stars: [5] } : {}), near: !!int(0, 1) }, rules: {}, best3: offers(), checks: [{ at: 1, price: 1 }] }; };
const flight = () => { const [f, t] = pick(ROUTES), dep = day(int(3, 200)); return { id: "f", kind: "watch", site: "5 sites", below: 0, currency: "EGP", fields: { flight: { from: f, to: t, depart: dep, adults: 1, ...(int(0, 1) ? { ret: iso(Date.parse(dep + "T12:00:00") + int(2, 20) * 864e5) } : {}) } }, rules: {}, best3: offers(), checks: [] }; };
const product = () => ({ id: "p", kind: "watch", site: "3 stores", what: pick(PRODUCTS), below: int(0, 1) ? int(100, 90000) : 0, currency: "EGP", url: "https://www.amazon.eg/s?k=x", rules: {}, best3: offers(), checks: [] });
const cases = [];
for (let i = 0; i < N; i++) {
  const kind = pick(["hotel", "hotel", "flight", "product"]), a = kind === "hotel" ? hotel() : kind === "flight" ? flight() : product();
  const keys = E.settingsOf(a).map((s) => s.k), key = pick(keys), bad = rnd() < 0.25;
  let v, want;   // want(b) → "" when right, else what is wrong
  const same = (b) => (b === a ? "" : "a bad value changed the agent");
  const keepOffers = (b) => (b.best3.length === a.best3.length ? "" : "a rule change cleared the offers");
  const cleared = (b) => (b.best3.length === 0 ? "" : "old offers kept after the search changed");
  if (key === "budget") { const n = bad ? 0 : int(100, 200000); v = { below: n }; want = (b) => (n ? (b.below === n && b.rules.below === n ? keepOffers(b) : "budget not saved") : !b.below && !b.rules.below ? "" : "no-limit not cleared"); }
  else if (key === "hours") { const n = bad ? pick([0, 200, -3]) : pick([1, 3, 6, 12, 24, 48]); v = { hours: n }; want = (b) => (bad ? same(b) : b.rules.hours === n ? keepOffers(b) : "hours not saved"); }
  else if (key === "sites") { const list = E.settingsOf(a).find((s) => s.k === "sites").v.list, only = list.filter(() => rnd() < 0.4); v = { only, avoid: [] }; want = (b) => (JSON.stringify(b.rules.onlySites || []) === JSON.stringify(only) ? keepOffers(b) : "sites not saved"); }
  else if (key === "must" || key === "avoid") { const words = ["breakfast", "free cancellation", "pool", "hostel", "shared bathroom", "parking"].filter(() => rnd() < 0.3); v = { words }; const rk = key === "must" ? "mustHave" : "avoid";
    want = (b) => (JSON.stringify(b.rules[rk] || []) === JSON.stringify(words) ? keepOffers(b) : rk + " not saved"); }
  else if (key === "stars") { const s = bad ? pick([7, -1]) : pick([0, 3, 4, 5]); v = { stars: s }; want = (b) => (bad ? (b.fields.stars === a.fields.stars || JSON.stringify(b.fields.stars) === undefined ? "" : (!b.rules.minStars ? "" : "bad stars saved")) : s ? (b.rules.minStars === s && b.fields.stars[0] === s && b.fields.stars[b.fields.stars.length - 1] === 5 && b.url.includes("class%3D" + s) ? cleared(b) : "stars not saved / not in the link") : !b.rules.minStars && !b.fields.stars ? cleared(b) : "any-stars not cleared"); }
  else if (key === "guests") { const ad = bad ? pick([0, 31]) : int(1, 6), ro = bad ? 1 : int(1, 3); v = { adults: ad, rooms: ro }; want = (b) => (bad ? same(b) : b.fields.adults === ad && b.fields.rooms === ro && b.url.includes("group_adults=" + ad) && b.url.includes("no_rooms=" + ro) ? cleared(b) : "guests not in the agent / link"); }
  else if (key === "city") { const c = bad ? "  " : pick(CITIES); v = { city: c, near: !!int(0, 1), walk: pick([0, 500, 1000]) }; want = (b) => (bad ? same(b) : b.fields.city === c && b.url.includes(encodeURIComponent(c).slice(0, 12)) && b.title.includes(c.split(",")[0]) && (v.walk ? b.rules.maxWalk === v.walk : !b.rules.maxWalk) ? cleared(b) : "city not in the agent / link / title"); }
  else if (key === "dates") {
    if (rnd() < 0.3 && !bad) { const from = day(int(3, 60)), n = int(2, 7), to = iso(Date.parse(from + "T12:00:00") + int(n + 1, 40) * 864e5); v = { window: { from, to }, nights: n };
      want = (b) => (b.fields.window && b.fields.window.from === from && b.fields.window.to === to && b.fields.nights === n && Array.isArray(b.tries) && b.tries.length >= 1 && b.tries.every((t) => t.checkin >= from && t.checkout <= to && span(t.checkin, t.checkout) === n && t.url.includes("checkin=" + t.checkin)) ? cleared(b) : "window not saved / tries wrong"); }
    else { const from = bad ? pick([day(-3), day(10)]) : day(int(1, 200)), to = bad ? (from < day(0) ? day(5) : from) : iso(Date.parse(from + "T12:00:00") + int(1, 21) * 864e5); v = { from, to };
      want = (b) => (bad ? same(b) : b.fields.checkin === from && b.fields.checkout === to && b.fields.nights === span(from, to) && !b.fields.window && !b.tries && b.url.includes("checkin=" + from) && b.url.includes("checkout=" + to) && b.title.includes(span(from, to) + " nights") ? cleared(b) : "dates not in the agent / link / title"); } }
  else if (key === "fdates") { const from = bad ? day(-2) : day(int(1, 250)), to = int(0, 1) ? iso(Date.parse(from + "T12:00:00") + int(2, 30) * 864e5) : "", flex = int(0, 3); v = { from, to, flex };
    want = (b) => (bad ? same(b) : b.fields.flight.depart === from && (to ? b.fields.flight.ret === to : !b.fields.flight.ret) && b.fields.flight.flex === flex && b.tries.length >= 3 && b.tries.some((t) => /skyscanner/.test(t.url) && t.url.includes(from.slice(2).replace(/-/g, ""))) ? cleared(b) : "flight dates not in the agent / links"); }
  else if (key === "route") { const [f, t] = bad ? ["CAI", "CAI"] : pick(ROUTES); v = { from: f.toLowerCase(), to: t };
    want = (b) => (bad ? same(b) : b.fields.flight.from === f && b.fields.flight.to === t && b.title.includes(f + " → " + t) && b.tries.some((x) => x.url.toLowerCase().includes(f.toLowerCase())) ? cleared(b) : "route not in the agent / links"); }
  else if (key === "stops") { const n = pick([-1, 0, 1, 2]); v = { n }; want = (b) => ((n < 0 ? b.rules.maxStops == null : b.rules.maxStops === n) ? keepOffers(b) : "stops not saved"); }
  else if (key === "cabin") { const c = bad ? "luxury" : pick(["economy", "premium", "business", "first"]); v = { cabin: c }; want = (b) => (bad ? same(b) : (c === "economy" ? !b.rules.cabin : b.rules.cabin === c) ? keepOffers(b) : "cabin not saved"); }
  else if (key === "bags") { const n = int(0, 3); v = { n }; want = (b) => (b.rules.bags === (n || undefined) || (n === 0 && b.rules.bags === 0) ? keepOffers(b) : "bags not saved"); }
  else if (key === "what") { const w = bad ? "x" : pick(PRODUCTS.filter((x) => x !== a.what)); v = { what: w, country: "eg" };
    want = (b) => (bad ? same(b) : b.title === w && b.url && !b.url.includes("k=x") && b.url.toLowerCase().includes(encodeURIComponent(w.split(" ")[0]).toLowerCase()) ? cleared(b) : "product not in the agent / store links"); }
  cases.push({ i, kind, key, v, bad, a, want });
}
let pass = 0; const miss = {};
for (const c of cases) { let b, why; try { b = E.applyEdit(c.a, c.key, c.v, now); why = c.want(b); } catch (e) { why = "crash: " + e.message; } if (!why) pass++; else { const k = c.kind + "/" + c.key + ": " + why; (miss[k] = miss[k] || []).push(c.i); } }
const pct = (100 * pass / cases.length).toFixed(2);
const rep = ["# Agent edits — " + cases.length + " cases", "", "Passed: **" + pass + " / " + cases.length + " (" + pct + "%)**", "", ...Object.entries(miss).sort((x, y) => y[1].length - x[1].length).map(([k, l]) => "- " + k + " — " + l.length + " (e.g. #" + l.slice(0, 3).join(", #") + ")")].join("\n");
if (N === 10000) fs.writeFileSync(new URL(+process.env.SEED_SHIFT ? "../onemillion/B-agentedit-s" + process.env.SEED_SHIFT + ".md" : "./report.md", import.meta.url), rep + "\n");
console.log(rep.split("\n").slice(0, 14).join("\n"));
export const result = { pass, total: cases.length, pct: +pct };
