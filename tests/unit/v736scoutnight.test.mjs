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
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
