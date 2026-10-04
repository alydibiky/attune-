// v6.12 — Maps: "Address east compound" is found (Photon + Nominatim at once, simpler wordings, nearby named places).
const M = await import("../../web-src/mapsearch.js");
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const center = { lat: 30.018, lon: 31.50 };   // New Cairo, by the AUC (Ali's screenshot)
ok(M.variants("Address east compound", "Cairo").includes("Address east"), "the generic word goes: «Address east»");
ok(M.variants("كمبوند ادرس ايست").includes("ادرس ايست"), "Arabic «كمبوند» goes too");
const calls = [];
const fetchJson = async (u) => {
  calls.push(u);
  if (u.includes("photon") && /q=Address\+east(&|$)/.test(u)) return { features: [{ properties: { name: "Address East", osm_key: "landuse", osm_value: "residential", city: "New Cairo", country: "Egypt" }, geometry: { coordinates: [31.503, 30.021] } }] };
  if (u.includes("photon")) return { features: [] };
  if (u.includes("nominatim")) return [];
  if (u.includes("overpass")) return { elements: [] };
  return null;
};
const r = await M.findPlaces("Address east compound", { center, area: "Cairo", fetchJson });
ok(r.places.length === 1 && /Address East/.test(r.places[0].name) && r.places[0].dist < 1, "found by the simpler wording, 0.4 km from the map's centre: " + (r.places[0] || {}).name);
ok(calls.some((u) => u.includes("viewbox=")) && calls.some((u) => u.includes("photon") && u.includes("lat=30.0180")), "both services are told where the map is looking");
const near = await M.findPlaces("Mivida", { center, fetchJson: async (u) => (u.includes("overpass") ? { elements: [{ type: "way", center: { lat: 30.01, lon: 31.53 }, tags: { name: "Mivida", landuse: "residential" } }] } : u.includes("photon") ? { features: [] } : []) });
ok(near.places.length === 1 && near.places[0].via === "overpass", "nothing by name anywhere → named places within 40 km (Overpass)");
const m = M.mergePlaces([[{ name: "Cairo Festival City Mall, New Cairo", lat: 30.0287, lon: 31.4085, via: "photon" }], [{ name: "Cairo Festival City Mall, Road 90, New Cairo, Egypt", lat: 30.0289, lon: 31.4087, via: "osm" }, { name: "Cairo Festival City Mall, Dubai", lat: 25.2, lon: 55.3, via: "osm" }]], center, "Cairo Festival City Mall");
ok(m.length === 2 && m[0].via === "photon + osm" && m[0].dist < m[1].dist, "the same place from two services is shown once; the nearer one first");
console.log(fail ? `${fail} FAILED` : "ALL PASSED");
