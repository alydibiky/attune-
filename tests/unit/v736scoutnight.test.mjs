// v6.32 Scout at night: the plan handed to the phone, and night hits checked like any run.
import * as S from "../../web-src/scout.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
let d = { goals: [] };
d = S.addGoal(d, "3-bedroom flat for rent in Maadi under 15,000", 1e12).data;
d = S.addGoal(d, "iPhone 16 Pro 256GB new under 70,000", 1e12).data;
d.goals[0].seen = [{ id: "a", url: "https://www.olx.com.eg/ad/1" }];
d.goals[1].on = false;
const p = S.nightPlan(d);
ok(p.length === 1, "paused goals are not searched at night");
ok(p[0].queries.length >= 1 && p[0].queries.length <= 6, "the goal's searches go with it (" + p[0].queries.length + ")");
ok(p[0].seen[0] === "https://www.olx.com.eg/ad/1", "links already seen go too, so only new ads are kept");
ok(p[0].title.length <= 40 && p[0].id === d.goals[0].id, "short title and the goal's id");
ok(S.nightPlan({ goals: [] }).length === 0, "no goals → an empty plan (the night run turns off)");
// distance to the metro, from the offline map's answers
const area = S.pointFor([{ name: "Maadi Street", kind: "street/primary", lat: 29.95, lon: 31.25, rank: 40 }, { name: "Maadi", kind: "place/suburb", lat: 29.9602, lon: 31.2569, rank: 70 }]);
ok(area && area.name === "Maadi", "the area itself is used, not a street with its name");
const st = S.nearestStation(29.9602, 31.2569, [
  { name: "Tram stop", kind: "transport/station", lat: 29.9612, lon: 31.2569 },
  { name: "Maadi", name_ar: "محطة مترو المعادي", name_en: "Maadi Metro Station", lat: 29.9602, lon: 31.2579 },
  { name: "Far", lat: 30.1, lon: 31.4 }]);
ok(st && st.name === "Maadi Metro Station" && st.metro && st.km < 0.2 && st.walk >= 1 && st.walk <= 3, "the metro station near the area, with minutes on foot (" + JSON.stringify(st) + ")");
const st2 = S.nearestStation(29.9602, 31.2569, [{ name: "Tram stop", lat: 29.9612, lon: 31.2569 }, { name: "Metro Far", lat: 29.99, lon: 31.2569 }]);
ok(st2.name === "Tram stop" && !st2.metro, "a metro far away is not preferred over a close station");
ok(S.nearestStation(29.9, 31.2, [], {}) === null, "no stations → nothing shown");
ok(Math.round(S.kmBetween(30.0444, 31.2357, 29.9602, 31.2569)) === 10, "Tahrir to Maadi ≈ 10 km");
ok(S.wantsStation({ kind: "rent", wish: [] }) && !S.wantsStation({ kind: "product", wish: [] }), "shown for homes, not for a phone");
// the photo check
const g1 = Array.from({ length: 72 }, (_, i) => (i * 37) % 255), g2 = g1.map((v) => Math.min(255, v + 3)), g3 = Array.from({ length: 72 }, (_, i) => (i * 11 + 50) % 255);
const h1 = S.dhash(g1), h2 = S.dhash(g2), h3 = S.dhash(g3);
ok(h1.length === 16 && S.hamming(h1, h2) === 0, "the same photo a little brighter → the same fingerprint (" + h1 + ")");
ok(S.hamming(h1, h3) > S.PHOTO_NEAR, "a different photo → far apart (" + S.hamming(h1, h3) + " bits)");
const ads = [{ id: "a", site: "olx.com.eg", facts: { price: 9000 } }, { id: "b", site: "dubizzle.com.eg", facts: { price: 14000 } }, { id: "c", site: "x", facts: {} }, { id: "d", site: "y", also: [{ url: "u-e" }], facts: {} }, { id: "e", url: "u-e", site: "z", facts: {} }];
const tw = S.photoTwins(ads, { a: h1, b: h2, c: h3, d: h3.replace(/.$/, "0"), e: h3 });
ok(tw.a && tw.a[0].id === "b" && tw.a[0].price === 14000 && tw.b[0].id === "a", "the same photo in two different ads → both marked, with the other's site and price");
ok(!tw.c || !tw.c.some((x) => x.id === "a"), "a different photo is not marked");
ok(!(tw.d || []).some((x) => x.id === "e"), "the same ad on two sites is not a copy");
// (bug found on the way: "170 m2. Price 8,000" was read as 170 million — the "m" of m2 taken for "million")
ok(JSON.stringify(S.pricesIn("3 bedrooms, 170 m2. Price 8,000 EGP monthly").map((x) => x.v)) === "[8000]", "«170 m2. Price 8,000» → 8,000");
ok(S.pricesIn("asking 850 k EGP")[0].v === 850000 && S.pricesIn("price 3 m EGP").length === 0 && S.pricesIn("price 900 m EGP")[0].v === 9e8, "«850 k» and «900 m» still multiply");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
