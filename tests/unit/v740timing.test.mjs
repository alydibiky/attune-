// v6.37 D2: wait or buy, from the market book (days ads stay up, how often prices drop).
import { addToMarket, timingOf, timingText } from "../../web-src/scout.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const D = 86400000, t0 = Date.parse("2026-09-01T12:00:00"), g = { kind: "car", model: { must: ["corolla"] } };
const ad = (id, price) => ({ id, facts: { price, cur: "EGP", year: 2022, km: 50000 } });
// day 0: 8 ads; day 5: two cut their price; day 12: the search runs again, 3 ads are gone; day 20: again
let b = addToMarket({}, g, [1, 2, 3, 4, 5, 6, 7, 8].map((i) => ad("a" + i, 900000 + i * 1000)), t0);
b = addToMarket(b, g, [ad("a1", 860000), ad("a2", 870000), ...[3, 4, 5, 6, 7, 8].map((i) => ad("a" + i, 900000 + i * 1000))], t0 + 5 * D);
b = addToMarket(b, g, [ad("a1", 860000), ad("a2", 870000), ad("a4", 904000), ad("a5", 905000), ad("a6", 906000)], t0 + 12 * D);
b = addToMarket(b, g, [ad("a1", 850000), ad("a2", 870000), ad("a4", 904000), ad("a9", 899000)], t0 + 20 * D);
const L = b["car:corolla"];
ok(L.find((x) => x.id === "a1").first === t0 && L.find((x) => x.id === "a1").p0 === 901000, "the first sighting and first price are kept");
const t = timingOf(L, null, t0 + 20 * D);
ok(t && t.gone === 5 && t.days === 5, "5 ads gone (3 after 5 days, 2 after 12) → they stay up about 5 days (" + JSON.stringify(t) + ")");
ok(t.dropShare >= 0.2 && t.dropPct >= 3, "a share of ads cut their price");
const fresh = timingOf(L, { id: "a9", fair: { verdict: "fair" } }, t0 + 20 * D);
ok(fresh.verdict === "buy", "a fair-priced ad where good ones go in ~5 days → buy now");
const old = timingOf(L, { id: "a4", fair: { verdict: "high" } }, t0 + 20 * D);
ok(old.verdict !== "buy", "an expensive one is not 'buy now'");
ok(timingOf(L.slice(0, 4), null, t0 + 20 * D) === null, "too few ads → no advice");
ok(timingOf(addToMarket({}, g, [1, 2, 3, 4, 5, 6, 7].map((i) => ad("b" + i, 1e6)), t0)["car:corolla"], null, t0) === null, "a book younger than 10 days → no advice");
ok(/fast/.test(timingText(fresh)) && /متستناش/.test(timingText(fresh, "ar")), "the advice in words, English and Egyptian");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
