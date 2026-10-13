// v6.27: search a country's places ONLINE without downloading its index — the builder's <code>-find.bin
// (tools/build_map_pack.py build_find) read by the app's netFind() through mapRange, one small piece per search.
import { execFileSync } from "node:child_process";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { loadJsx } from "./jsxload.mjs";
const OM = await loadJsx("web-src/offlinemap.js");
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attune-find-"));
const places = [
  [{ name: "مدينتي", "name:en": "Madinaty", place: "town" }, 30.1, 31.65],
  [{ name: "Palm Hills October", landuse: "residential", residential: "gated" }, 29.98, 30.95],
  [{ name: "مستشفى السلام", amenity: "hospital" }, 30.07, 31.33],
  [{ name: "B.Tech", shop: "electronics" }, 30.06, 31.34],
  [{ name: "Tech Park", place: "locality" }, 30.2, 31.4],
];
for (let i = 0; i < 400; i++) places.push([{ name: "شارع " + i, highway: "residential" }, 30 + i / 1000, 31]);       // "شارع" becomes a common word
for (let i = 0; i < 30; i++) places.push([{ name: "مستشفى رقم " + i, amenity: "hospital" }, 30, 31 + i / 1000]);   // so does "مستشفى"
for (let i = 0; i < 30; i++) places.push([{ name: "مسجد السلام " + i, amenity: "place_of_worship" }, 30, 31 + i / 1000]);
const sq = path.join(dir, "eg-places.sqlite"), bin = path.join(dir, "eg-find.bin");
const stats = JSON.parse(execFileSync("python3", ["-c", `
import json, sys; sys.path.insert(0, 'tools'); import build_map_pack as B
idx = B.Index(sys.argv[1])
for tags, lat, lon in json.loads(sys.argv[3]): idx.add(tags, lat, lon)
idx.close(); print(json.dumps(B.build_find(sys.argv[1], sys.argv[2])))`, sq, bin, JSON.stringify(places)], { cwd: new URL("../..", import.meta.url).pathname }).toString().trim().split("\n").pop());
ok(stats.places === places.length && stats.pieces > 3 && stats.common >= 2, "the builder cut " + stats.places + " places into " + stats.pieces + " pieces (" + stats.common + " common words)");
const file = fs.readFileSync(bin); let asks = [];
const call = async (m, a) => { asks.push(a); ok(m === "mapRange" && a.name === "eg-find.bin" && a.code === "eg", "…read through mapRange"); return { b64: file.subarray(a.offset, a.offset + a.length).toString("base64") }; };
const okQuiet = ok; let r;
r = await OM.netFind(call, "eg", "madinaty");
okQuiet(r[0] && r[0].name === "مدينتي", "Madinaty (English name) finds مدينتي");
asks = []; r = await OM.netFind(call, "eg", "palm hil", { lat: 30, lon: 31 });
okQuiet(r[0] && r[0].name === "Palm Hills October" && r[0].kind === "place/compound", "a compound by the start of its words: " + (r[0] && r[0].kind));
okQuiet(asks.length === 1 && asks[0].length < 4000, "after the first search only ONE small piece is read (" + (asks[0] && asks[0].length) + " bytes)");
r = await OM.netFind(call, "eg", "مستشفي السلام");
okQuiet(r[0] && r[0].name === "مستشفى السلام", "a search made only of common words still finds the place: " + (r[0] && r[0].name));
r = await OM.netFind(call, "eg", "B.TECH");
okQuiet(r[0] && r[0].name === "B.Tech", "a whole-name match comes first: " + r.map((p) => p.name).join(", "));
r = await OM.netFind(call, "eg", "zzzz");
okQuiet(Array.isArray(r) && r.length === 0, "nothing found → an empty list");
// v6.27: the named areas by map square, for the label layer
asks = []; const areas = await OM.netAreas(call, "eg", { s: 29.9, w: 30.9, n: 30.05, e: 31.0 });
okQuiet(areas.some((p) => p.name === "Palm Hills October") && !areas.some((p) => p.kind === "amenity/hospital"), "the areas inside a box: " + areas.map((p) => p.name).join(", "));
okQuiet(asks.length === 1, "one small square read (" + asks.length + ")");
const gj = OM.areasGeoJSON([...areas, { name: "حي الأمل", name_ar: "حي الأمل", name_en: "Hay El Amal", kind: "place/neighbourhood", lat: 30, lon: 31, rank: 65 }], "en");
okQuiet(gj.features[0].properties.name === "Palm Hills October" && gj.features[0].properties.compound === 1 && gj.features[1].properties.name === "Hay El Amal", "compounds first, names in the app's language");
okQuiet((await OM.netAreas(call, "eg", { s: 20, w: 20, n: 35, e: 40 })).length === 0, "zoomed far out: no area names (nothing read)");
fs.rmSync(dir, { recursive: true, force: true });
console.log(fail ? fail + " FAILED" : "v727netfind ok");
process.exit(fail ? 1 : 0);
