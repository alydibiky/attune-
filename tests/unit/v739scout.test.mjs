// v6.36 Scout (Ali: "this already should be in scouting so it's more accurate"): fair-price meter, scam check, follow, gold, offer
import * as S from "../../web-src/scout.js";
let fails = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const g = S.parseGoal("Hyundai Tucson 2022 used");
const car = (id, price, year, km, extra = {}) => ({ id, url: "https://www.dubizzle.com.eg/en/ad/" + id, title: "Hyundai Tucson " + year, facts: { price, cur: "EGP", year, km }, ...extra });
const market = [car("a", 1400000, 2022, 60000), car("b", 1450000, 2022, 50000), car("c", 1500000, 2022, 40000), car("d", 1350000, 2021, 70000), car("e", 1550000, 2023, 30000), car("f", 900000, 2017, 150000)];
const f1 = S.fairness(car("x", 1300000, 2022, 60000), market, g);
ok(f1 && f1.n === 5, "the meter compares the same model within a year (a 2017 car left out): n=" + (f1 && f1.n));
ok(f1 && f1.verdict === "cheap" && f1.low < f1.high, "1.30 M for a 2022 Tucson is cheap against " + (f1 && f1.low) + "–" + (f1 && f1.high));
ok(S.fairness(car("y", 800000, 2022, 60000), market, g).verdict === "too-cheap", "far under the market = suspicious");
ok(S.fairness(car("z", 1700000, 2022, 60000), market, g).verdict === "high", "over the market = expensive");
// the market book learns across searches
const b = S.addToMarket({}, g, market.map((m) => ({ ...m })));
ok((b[S.marketKey(g)] || []).length === 6 && S.marketKey(g) === "car:hyundai tucson", "the market book keeps what every search saw, by model: " + S.marketKey(g));
// scam check
const fake = S.readAd({ url: "https://www.dubizzle.com.eg/en/ad/q-ID9.html", title: "Hyundai Tucson 2022", text: "Hyundai Tucson model 2022 price EGP 800,000. I am abroad, send the money first and we ship. Call 01001234567" }, g);
ok(fake.redFlag && /send the money|abroad/i.test(fake.redFlag), "words that ask for money first are caught: " + fake.redFlag);
ok(fake.phones[0] === "01001234567", "the phone number is read");
const r = S.risksOf({ ...fake, fair: { verdict: "too-cheap", pct: -45 } }, [{ id: "o1", title: "Kia Sportage 2020", phones: ["01001234567"] }, { id: "o2", title: "Toyota Corolla 2019", phones: ["01001234567"] }]);
ok(["cheap", "money", "phone"].every((k) => r.some((x) => x.k === k)), "too cheap + money first + one phone on many ads: " + r.map((x) => x.k).join(", "));
ok(r.every((x) => x.ar && x.en), "each warning in English and Egyptian Arabic");
// follow: a lower price or sold
let goal = { g, seen: [{ ...car("ad1", 1500000, 2022, 40000), history: [[1, 1500000]] }], follow: { ad1: 1 } };
goal = S.followUpdate(goal, "ad1", { title: "Hyundai Tucson 2022", text: "Hyundai Tucson model 2022, asking price EGP 1,420,000" }, 2);
ok(goal.seen[0].facts.price === 1420000 && goal.seen[0].history.length === 2, "a followed ad's new price is recorded");
const run = S.runGoal(goal, [], { now: 2 });
ok(run.found[0].followed && run.found[0].dropped === 80000, "…it shows as followed with the drop");
ok(S.worthTelling(run).length === 1, "…and is told even when its score is low");
ok(S.followUpdate(goal, "ad1", { title: "", text: "This ad is no longer available" }, 3).seen[0].sold, "a sold / removed ad is marked sold");
ok(!S.toggleFollow(S.toggleFollow({ follow: {} }, "x"), "x").follow.x, "follow and unfollow");
// offer helper
const o = S.offerFor({ facts: { price: 1500000 }, fair: { basis: "price", median: 1450000, low: 1400000 } });
ok(o < 1500000 && o >= 1360000 && o % 5000 === 0, "the first offer is under the asking price, not under the cheap end of the market: " + o);
ok(/ينفع|فيه فصال/.test(S.sellerMessage({ title: "Tucson", site: "dubizzle", facts: { price: 1500000 }, fair: { basis: "price", pct: 4, median: 1450000, low: 1400000 } }, g, { ar: true })), "the message to the seller is in Egyptian Arabic");
// gold
const gg = S.parseGoal("tell me when 21 karat gold is under 3,500 a gram");
ok(gg.kind === "gold" && gg.karat === 21 && gg.max === 3500, "a gold goal: karat and the price");
ok(S.goldGram(2400, 48, 21) === Math.round(2400 / 31.1034768 * 48 * 21 / 24), "a gram's price by code from the world price and the rate");
ok(S.goldCheck(gg, 3400).hit && !S.goldCheck(gg, 3600).hit, "told only at or under the target");
ok(S.parseGoal("gold necklace 21k").kind !== "gold", "a gold necklace is a product, not the gold price");
if (fails) { console.log(fails + " FAILED"); process.exit(1); } else console.log("ALL PASSED");
