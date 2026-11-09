// v9.9.4 Ali's hotel agent screenshot (10 Nov): "Found one under your price: 41,495" but the best that follows his rules (5★, within
// 1 km) is 45,711 — over his 45,000 — and it was labelled "Under your limit ✓"; background checks never read Booking's prices
import assert from "node:assert/strict";
import * as R from "../../web-src/agent-rules.js";
import * as A from "../../web-src/agents.js";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS " + m); };
const rules = R.mergeRules(R.parseRule("only 5 stars") || {}, R.parseRule("within 1 km") || {});
const best3 = [
  { name: "Budget Inn", price: 41495, text: "Budget Inn · 3 stars · 2.4 km from Masjid Al Haram", checkin: "2027-01-08", checkout: "2027-01-12", href: "https://www.booking.com/hotel/sa/budget.html" },
  { name: "Swissôtel Makkah", price: 45711, text: "Swissôtel Makkah · 5 stars · 0.6 km from Masjid Al Haram · 8.6", checkin: "2027-01-20", checkout: "2027-01-24", href: "https://www.booking.com/hotel/sa/swissotel.html" }];
const a = { id: "h", kind: "watch", on: true, below: 45000, currency: "EGP", rules, best3, found: { at: 1, price: 41495 } };
ok(R.applyRules(best3, rules).length === 1, "the rules keep only the 5★ hotel within 1 km");
ok(!R.withRuleFound(a).found, "nothing that follows the rules is under 45,000 → no “Found under your price”");
ok(!A.agentChat(a).some((m) => m.found), "the agent's conversation no longer says “Found one under your price: 41,495”");
ok(R.agentStatus(a) === "found", "the card still shows its offers (status Found = offers to look at)");
const cmp = A.compareOffers(R.applyRules(best3, rules), { below: 45000 });
ok(!cmp.why.some(([t]) => /Under your limit/.test(t)), "the hotel shown big (45,711) is NOT labelled “Under your limit ✓”");
const b = { ...a, below: 46000 };
ok(R.withRuleFound(b).found && R.withRuleFound(b).found.price === 45711, "with a 46,000 limit the found one is the rule-following 45,711");
// a background (hidden-browser) read brings the page's best offers with names and links
const ag = { id: "h", kind: "watch", on: true, below: 45000, currency: "EGP", tries: [{ checkin: "2027-01-20", checkout: "2027-01-24", url: "https://www.booking.com/searchresults.html?x" }], what: "hotel", checks: [] };
const got = { "h~0": [{ at: 5, price: 44100, how: "hidden", site: "Booking.com", top: [{ name: "Pullman ZamZam", price: 44100, text: "Pullman ZamZam · 5 stars · 0.2 km", href: "https://www.booking.com/hotel/sa/pullman.html" }] }] };
const [h] = A.takeChecks([ag], got);
ok(h.checks.slice(-1)[0].price === 44100 && h.best3.length === 1 && h.best3[0].name === "Pullman ZamZam" && h.best3[0].checkin === "2027-01-20", "a hidden background read → a priced check + the named offer (Pullman ZamZam, 20 Jan) on the card");
ok(h.found && h.found.price === 44100, "…under 45,000 → Found 44,100");
const plan = A.watchPlan({ agents: [{ ...ag, rules, url: "https://www.booking.com/searchresults.html" }] });
ok(plan.length === 1 && JSON.parse(plan[0].rules).minStars === 5, "the phone's check plan carries the agent's rules (the hidden read follows them)");
console.log("ALL PASSED v994agentfix (" + n + " checks)");
