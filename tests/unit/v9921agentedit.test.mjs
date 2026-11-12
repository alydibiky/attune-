// v9.9.21 OK-3 / OK-4 (Ali OK'd 12 Nov): every agent editable — a 2,500 sample of tests/agentedit/gen.mjs (10,000) must stay ≥ 99%,
// plus held-out cases written AFTER it (Ali's own agents, Arabic names, edge dates) that the generator never made.
import { execFileSync } from "child_process";
import * as E from "../../web-src/agentedit.js";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const out = execFileSync("node", [new URL("../agentedit/gen.mjs", import.meta.url).pathname, "2500"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const m = /Passed: \*\*(\d+) \/ (\d+)/.exec(out); ok(m && +m[1] / +m[2] >= 0.99, "2,500 generated edits ≥ 99%: " + (m ? m[1] + "/" + m[2] : out.slice(0, 80)));
const now = Date.parse("2026-11-12T10:00:00");
// held-out — Ali's hotel near Masjid al-Haram
const h = { id: "h1", kind: "watch", site: "Booking.com", below: 45000, currency: "EGP", fields: { city: "Masjid al-Haram, Makkah", checkin: "2027-01-08", checkout: "2027-01-12", nights: 4, adults: 2, rooms: 1, stars: [5], near: true }, rules: {}, best3: [{ name: "Swissôtel", price: 41495 }], checks: [{ at: 1, price: 41495 }] };
ok(E.settingsOf(h).map((s) => s.k).join() === "dates,city,stars,guests,budget,sites,must,avoid,hours", "a hotel agent shows 9 settings, in this order");
const w = E.applyEdit(h, "dates", { window: { from: "2027-01-01", to: "2027-01-31" }, nights: 4 }, now);
ok(w.fields.window && w.tries.length === 6 && w.tries.every((t) => t.checkout > t.checkin), "flexible: the cheapest 4 nights in January → 6 start days are tried");
ok(E.applyEdit(h, "dates", { from: "2027-01-12", to: "2027-01-08" }, now) === h, "check-out before check-in changes nothing");
ok(E.applyEdit(h, "dates", { from: "2026-11-01", to: "2026-11-05" }, now) === h, "dates in the past change nothing");
ok(E.applyEdit(h, "city", { city: "المدينة المنورة", near: true }, now).title.startsWith("Hotels · المدينة المنورة"), "an Arabic city name is kept as written");
ok(E.applyEdit(h, "budget", { below: 0 }, now).below === 0, "No limit clears the budget");
const two = E.applyEdit(E.applyEdit(h, "must", { words: ["breakfast"] }, now), "avoid", { words: ["hostel"] }, now);
ok(two.rules.mustHave[0] === "breakfast" && two.rules.avoid[0] === "hostel" && two.best3.length === 1, "two rule edits add up and keep the offers");
// held-out — the FreeClip, renamed in Arabic
const p = { id: "p1", kind: "watch", what: "Huawei FreeClip 2", below: 7500, currency: "EGP", site: "3 stores", url: "x", rules: {}, best3: [{ price: 7999 }], checks: [] };
const p2 = E.applyEdit(p, "what", { what: "سماعة هواوي فري كليب 2", country: "eg" }, now);
ok(p2 !== p && p2.title === "سماعة هواوي فري كليب 2" && /huawei/i.test(p2.url) && p2.best3.length === 0, "an Arabic product name → searched in English in the stores (" + p2.url.slice(0, 60) + ")");
// held-out — a flight CAI → JED
const f = { id: "f1", kind: "watch", site: "5 sites", below: 0, currency: "EGP", fields: { flight: { from: "CAI", to: "JED", depart: "2027-01-07", adults: 1 } }, rules: {}, best3: [], checks: [] };
ok(E.settingsOf(f).map((s) => s.k).join() === "fdates,route,stops,cabin,bags,budget,sites,hours", "a flight agent shows its 8 settings (Airlines for sites)");
const f2 = E.applyEdit(f, "fdates", { from: "2027-01-09", to: "2027-01-20", flex: 2 }, now);
ok(f2.fields.flight.depart === "2027-01-09" && f2.fields.flight.ret === "2027-01-20" && f2.title.includes("09/01 → 20/01"), "flight dates → depart, return and title");
ok(E.applyEdit(f, "stops", { n: 0 }, now).rules.maxStops === 0 && E.applyEdit(f, "cabin", { cabin: "business" }, now).rules.cabin === "business", "direct only, business class");
ok(E.applyEdit(f, "route", { from: "CAIRO", to: "JED" }, now) === f, "a route that isn't an airport code changes nothing");
// a message alert / a reply agent: nothing to break
ok(E.settingsOf({ kind: "reply" }).length === 0 && E.applyEdit({ kind: "reply" }, "budget", { below: 5 }).kind === "reply", "agents without settings are left alone");
console.log(fail ? "FAILED " + fail : "ALL PASSED");
