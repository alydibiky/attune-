// v9.0 (Ali, 2 Nov): agents look in every store + the open web, each offer keeps its OWN listing link, a research agent.
import { parseAgent, makeAgent, addCheck, takeChecks, watchPlan, webOffers, bestAcross } from "../../web-src/agents.js";
import { storeTries, lookLinks } from "../../web-src/agent.js";
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log("FAIL " + m); } };
const now = Date.parse("2026-11-02T10:00:00");
// 1. a new product with no store named → watched in every Egyptian store
const w = parseAgent("tell me when Huawei FreeClip 2 is under 8400", { country: "EG", now });
ok(w.kind === "watch" && w.what === "Huawei FreeClip 2" && w.below === 8400 && w.tries.length >= 5 && ["Amazon", "noon", "Jumia", "B.TECH", "2B"].every((s) => w.tries.some((x) => x.site === s)), "FreeClip 2 → a watch on Amazon, noon, Jumia, B.TECH, 2B…");
ok(parseAgent("tell me when the iPhone 16 on Amazon is under 40000", { country: "EG", now }).tries === undefined, "a store named → that store only");
ok(parseAgent("دورلي على سماعة هواوي فري كليب 2 بأقل من 8400", { country: "EG", now }).said === "سماعة هواوي فري كليب 2", "Arabic: the product words only (searched in English since v9.0)");
ok(parseAgent("find me a used Hyundai Tucson 2022", { country: "EG", now }).kind === "scout" && parseAgent("ابحثلي عن شقة في المعادي", { country: "EG", now }).kind === "scout", "used cars, flats → Scout");
const b = parseAgent("buy me AirPods Pro 2 under 9000", { country: "EG", now });
ok(b.kind === "buy" && b.tries.length >= 5, "a buy agent searches every store");
ok(storeTries("iPhone 16", "SA").some((x) => x.site === "Jarir") && storeTries("iPhone 16", "US")[0].url.includes("amazon.com"), "other countries' stores");
ok(lookLinks("Huawei FreeClip 2", "EG").map((l) => l.label).join() === "Google Shopping,Facebook Marketplace,Google", "Google + Facebook linked to look by hand");
// 2. the phone's checks keep the exact listing; the card's best offers are one per store, each with its own link
let a = makeAgent(w, now);
ok(watchPlan({ agents: [a] }).every((p) => p.what === "Huawei FreeClip 2" && p.site), "the phone is told the product and the store");
a = takeChecks([a], { [a.id + "~0"]: [{ at: now, price: 8399, href: "https://www.amazon.eg/dp/B0XYZ", name: "HUAWEI FreeClip 2 Open-Ear Earbuds" }], [a.id + "~2"]: [{ at: now + 1, price: 8199, href: "https://www.jumia.com.eg/huawei-freeclip-2-123.html", name: "Huawei FreeClip 2 - Black" }] })[0];
ok(a.found && a.found.price === 8199 && a.found.href.includes("jumia.com.eg/huawei") && a.found.site === "Jumia", "found keeps the cheaper listing's link and its store");
ok(a.best3.length === 2 && a.best3[0].site === "Jumia" && a.best3[0].href.includes("jumia"), "best offers: cheapest first, each store's own listing");
// 3. the open web: price next to the product, a case and a monthly instalment are not the product
const offers = webOffers([
  { title: "Huawei FreeClip 2 price in Egypt", url: "https://www.elbadrgroupeg.store/huawei-freeclip-2", text: "Huawei FreeClip 2 EGP 7,950 in stock" },
  { title: "Silicone case for Huawei FreeClip 2", url: "https://shop.example/case", text: "EGP 250" },
  { title: "Huawei FreeClip 2", url: "https://www.valu.com.eg/p/123", text: "from EGP 690/month" },
  { title: "Huawei FreeClip 2 review", url: "https://www.youtube.com/watch?v=1", text: "EGP 8,000" },
  { title: "هواوي FreeClip 2 للبيع", url: "https://www.facebook.com/groups/1/posts/2", text: "Huawei FreeClip 2 جديدة متبرشمة بسعر 7800 جنيه" },
], "Huawei FreeClip 2", { cur: "EGP" });
ok(offers.length === 2 && offers.some((o) => o.price === 7950) && offers.some((o) => o.price === 7800 && o.site === "facebook.com"), "web offers: a shop and a Facebook post; not a case, an instalment or a video: " + JSON.stringify(offers.map((o) => [o.site, o.price])));
const all = bestAcross([...offers, { name: "HUAWEI FreeClip 2", price: 8399, site: "Amazon", href: "https://www.amazon.eg/dp/B0XYZ" }, { name: "HUAWEI FreeClip 2 ear tips", price: 300, site: "noon", href: "https://www.noon.com/x" }, { name: "HUAWEI FreeClip", price: 4000, site: "2B", href: "https://2b.com.eg/y" }], { what: "Huawei FreeClip 2" });
ok(all.map((o) => o.price).join() === "7800,7950,8399", "across everywhere: the exact product only (no ear tips, not the first FreeClip), cheapest first");
// 4. research
const r = parseAgent("gather information on the Chery Tiggo 7 Pro", { country: "EG", now });
ok(r.kind === "research" && r.topic === "the Chery Tiggo 7 Pro", "gather information on X → a research agent");
ok(parseAgent("جمعلي معلومات عن الطاقة الشمسية", { country: "EG", now }).topic === "الطاقة الشمسية", "Egyptian Arabic research");
// 5. an old single-row check (no link) still works
ok(addCheck(makeAgent(parseAgent("tell me when the iPhone 16 on Amazon is under 40000", { country: "EG", now }), now), { price: 39000 }).found.price === 39000, "old rows without a link still count");
console.log(bad ? bad + " FAILED" : "PASS v901agents: every store + the web, the exact listing, research");
