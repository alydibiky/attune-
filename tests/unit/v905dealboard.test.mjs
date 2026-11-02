// v9.0 (Ali picked "A and B in a smart way"): the best deal big (the cheapest REAL store) + every store as a bar against the limit.
import { dealBoard } from "../../web-src/agents.js";
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log("FAIL " + m); } };
const offers = [{ price: 8250, site: "Amazon", href: "https://www.amazon.eg/dp/x" }, { price: 7950, site: "Jumia", href: "https://www.jumia.com.eg/x" },
  { price: 7800, site: "facebook.com", web: true, href: "https://www.facebook.com/x" }, { price: 8899, site: "2B", href: "https://2b.com.eg/x" }];
const b = dealBoard(offers, 8400);
ok(b.best.site === "Jumia" && b.gap === 450, "the winner is the cheapest real store (Jumia), 450 under the limit");
ok(b.cheaper && b.cheaper.o.site === "facebook.com", "a cheaper Facebook post is shown as 'check the seller first', not as the winner");
ok(b.rows.map((r) => r.o.price).join() === "7800,7950,8250,8899" && b.rows[0].pct < b.rows[1].pct && b.rows[3].pct > b.limitPct, "bars cheapest first, the over-limit one past the limit line");
ok(b.rows[1].pct - b.rows[0].pct >= 3, "150 pounds apart is visible (bars don't start at 0)");
ok(b.under === 3 && b.rows[3].under === false, "3 under the limit");
const b2 = dealBoard([{ price: 900, site: "Amazon", href: "https://www.amazon.com/x" }], 0);
ok(!b2.bars && b2.limitPct === null && b2.gap === null, "one offer, no limit → no bars, no limit line");
ok(dealBoard([{ price: 9000, site: "noon", href: "https://www.noon.com/x" }, { price: 9500, site: "Amazon", href: "https://www.amazon.eg/x" }], 8400).gap === -600, "over the limit says how much over");
ok(dealBoard([], 100) === null, "nothing found → nothing drawn");
console.log(bad ? bad + " FAILED" : "PASS v905dealboard: best deal + bars against the limit");
