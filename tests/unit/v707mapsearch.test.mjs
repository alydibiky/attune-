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
// v6.27: one Google-like order — name match, then importance, then distance
const cairo = { lat: 30.05, lon: 31.25 };
let rk = M.rankPlaces([
  { name: "Madinaty Pharmacy", kind: "amenity/pharmacy", lat: 30.05, lon: 31.25, rank: 42 },
  { name: "مدينتي", kind: "place/town", lat: 30.1, lon: 31.65, rank: 85 },
  { name: "Madinaty", kind: "place/town", lat: 30.1, lon: 31.65, rank: 85 },
], "Madinaty", cairo);
ok(rk[0].name === "Madinaty" && rk[1].name === "Madinaty Pharmacy", "the town named exactly «Madinaty» beats a pharmacy next door named after it: " + rk.map((p) => p.name).join(" | "));
rk = M.rankPlaces([
  { name: "City Stars", kind: "shop/mall", lat: 31.2, lon: 29.9, rank: 35 },   // Alexandria, 180 km
  { name: "City Stars", kind: "shop/mall", lat: 30.07, lon: 31.35, rank: 35 },  // Cairo, 10 km
], "city stars", cairo);
ok(rk[0].lat === 30.07, "two places with the same name: the nearer first");
rk = M.rankPlaces([
  { name: "Seoudi Market Zamalek", kind: "shop/supermarket", lat: 30.06, lon: 31.22, rank: 35 },
  { name: "Street of Seoudi", kind: "street/residential", lat: 30.05, lon: 31.25, rank: 30 },
], "seoudi", cairo);
ok(rk[0].name === "Seoudi Market Zamalek", "a name that STARTS with the words beats one that only contains them");
rk = M.rankPlaces([{ name: "Gym", kind: "leisure/fitness_centre", lat: 30.05, lon: 31.25 }, { name: "My gym", kind: "", lat: 30.2, lon: 31.4, local: true }], "gym", cairo);
ok(rk[0].name === "Gym", "a saved place gets a small lift, not a free pass: " + rk.map((p) => p.name).join(" | "));
console.log(fail ? `${fail} FAILED` : "ALL PASSED");
// v6.42 (Ali: "Emerald park compound" listed Saraia / Sierra / Sharbatly compounds): only real matches count
{
  const MS2 = await import("../../web-src/mapsearch.js");
  const junk = [{ name: "Saraia Compound" }, { name: "Sierra Compound" }, { name: "Sharbatly Village Compound" }];
  console.log((MS2.keepMatching(junk, "Emerald park compound").length === 0 ? "PASS" : "FAIL") + " v6.42: other compounds sharing only the word 'compound' are not a match");
  console.log((MS2.keepMatching([...junk, { name: "Emerald Park" }], "Emerald park compound").map((p) => p.name).join() === "Emerald Park" ? "PASS" : "FAIL") + " v6.42: Emerald Park is kept");
  console.log((MS2.matches({ name: "إيميرالد بارك", alt: ["Emerald Park"] }, "emerald park") ? "PASS" : "FAIL") + " v6.42: the English name counts when the shown name is Arabic");
  console.log((MS2.keepMatching(junk, "compound").length === 3 ? "PASS" : "FAIL") + " v6.42: a search of only 'compound' still lists compounds");
}
