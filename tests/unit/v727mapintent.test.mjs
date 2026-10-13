// v6.27: Maps understands what people type — code first (mapintent.js), the model only as a fallback.
import { loadJsx } from "./jsxload.mjs";
const MI = await loadJsx("web-src/mapintent.js");
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const cases = [
  ["أقرب صيدلية", { sort: "pharmacy", near: true, area: "", what: "" }],
  ["صيدلية قريبة", { sort: "pharmacy", near: true }],
  ["بنزينة جنبي", { sort: "fuel", near: true }],
  ["nearest gas station", { sort: "fuel", near: true }],
  ["ATM near me", { sort: "atm", near: true }],
  ["كمبوند في التجمع", { sort: "compound", area: "التجمع" }],
  ["مطعم سوري في مدينة نصر", { sort: "restaurant", what: "سوري", area: "مدينه نصر" }],
  ["coffee shop in Zamalek", { sort: "cafe", area: "zamalek" }],
  ["فين المستشفى", { sort: "hospital" }],
  ["Palm Hills", { sort: null, what: "palm hills", area: "", near: false }],
  ["مدينتي", { sort: null, what: "مدينتي" }],
  ["pharmacy in new cairo", { sort: "pharmacy", area: "new cairo" }],
  ["عايز سوبر ماركت ف الرحاب", { sort: "supermarket", area: "الرحاب" }],
];
for (const [q, want] of cases) {
  const p = MI.parseMapQuery(q);
  const bad = Object.entries(want).filter(([k, v]) => p[k] !== v);
  ok(!bad.length, `«${q}» → ${JSON.stringify({ sort: p.sort, what: p.what, area: p.area, near: p.near })}` + (bad.length ? "  wanted " + JSON.stringify(want) : ""));
}
ok(MI.parseMapQuery("أقرب صيدلية").kinds.includes("amenity/pharmacy"), "a sort carries the index's kinds");
ok(!MI.needsModel("Palm Hills", MI.parseMapQuery("Palm Hills")) && MI.needsModel("somewhere quiet to study tonight", MI.parseMapQuery("somewhere quiet to study tonight")), "the model is asked only for a longer request code can't read");
const r = MI.readModel('Sure! {"sort": "cafe", "what": "quiet", "area": "", "near": true}');
ok(r && r.sort === "cafe" && r.kinds.includes("amenity/cafe") && r.near && r.model, "the model's JSON → the same fields");
ok(MI.readModel('{"sort": "casino", "what": "x"}').sort === null && MI.readModel("no json") === null, "anything outside the fixed list is dropped");
ok(/"pharmacy"/.test(MI.modelPrompt("x")), "the prompt lists the fixed sorts");
console.log(fail ? fail + " FAILED" : "v727mapintent ok");
process.exit(fail ? 1 : 0);
