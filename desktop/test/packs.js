// Desktop Knowledge packs and maps (lib/packs.js).
//  1. search on a small FTS4 pack made here (BM25, coverage, quoted phrases, ids filter);
//  2. maps: list, mapRead byte ranges, the places search, path escapes refused;
//  3. LIVE (when the network allows, or ATTUNE_LIVE=1 in CI): the real "cranes" pack downloaded, checked and searched.
"use strict";
const assert = require("assert");
const fs = require("fs"), os = require("os"), path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { makePacks } = require("../lib/packs");

if (process.env.HTTPS_PROXY || process.env.https_proxy) {
  try { const { setGlobalDispatcher, EnvHttpProxyAgent } = require("undici"); setGlobalDispatcher(new EnvHttpProxyAgent()); } catch (e) {}
}
const data = fs.mkdtempSync(path.join(os.tmpdir(), "attune-packs-"));
const gate = [];
const P = makePacks({ data, online: (url, why) => gate.push(why) });

// ---- 1. a small pack, the builder's schema (tools/build_know_pack.py) ----
const kd = path.join(data, "know", "cars"); fs.mkdirSync(kd, { recursive: true });
const db = new DatabaseSync(path.join(kd, "cars.sqlite"));
db.exec("CREATE TABLE passages(id INTEGER PRIMARY KEY, title TEXT, text TEXT, url TEXT, lang TEXT); CREATE VIRTUAL TABLE passages_fts USING fts4(key)");
const rows = [
  ["BYD Seal — specifications", "The BYD Seal is an electric sedan with 82.5 kWh battery and 570 km range."],
  ["BYD Seal U — specifications", "The BYD Seal U is an SUV, plug-in hybrid DM-i."],
  ["Lynk & Co 900 — versions and prices", "Lynk & Co 900 large plug-in hybrid SUV, three rows, launched 2025."],
  ["Toyota Corolla — specifications", "The Corolla is a compact sedan with a 1.8 litre hybrid."],
];
for (let i = 0; i < 40; i++) rows.push(["Filler car " + i, "A car with an engine and four wheels number " + i]);
const ins = db.prepare("INSERT INTO passages(id, title, text, url, lang) VALUES (?, ?, ?, ?, 'en')"), fts = db.prepare("INSERT INTO passages_fts(rowid, key) VALUES (?, ?)");
rows.forEach(([t, x], i) => { ins.run(i + 1, t, x, "https://example/" + i); fts.run(i + 1, P.normalize(t + " " + x)); });
db.close();
fs.writeFileSync(path.join(kd, "manifest.json"), JSON.stringify({ id: "cars", name: "Cars", count: rows.length, files: [] }));

assert.equal(P.knowList().length, 1);
let r = P.knowSearch({ q: "BYD Seal range", k: 5 });
assert.equal(r.passages[0].title, "BYD Seal — specifications", "the exact model ranks above «Seal U»: " + r.passages.map((p) => p.title));
r = P.knowSearch({ q: "lynk co 900 price", k: 5 });
assert.equal(r.passages[0].pack, "cars"); assert.ok(r.passages[0].title.startsWith("Lynk & Co 900"));
r = P.knowSearch({ q: "corolla", k: 5, ids: ["other"] });
assert.equal(r.passages.length, 0, "ids limits the packs searched");
assert.equal(P.knowSearch({ q: "the of and" }).passages.length, 0, "stop words alone find nothing");
console.log("PASS knowledge search (BM25 + coverage + names), the same ranking as the phone");

// ---- 2. maps ----
const md = path.join(data, "maps", "eg"); fs.mkdirSync(md, { recursive: true });
fs.writeFileSync(path.join(md, "eg.pmtiles"), Buffer.from("0123456789abcdef"));
const pl = new DatabaseSync(path.join(md, "eg-places.sqlite"));
pl.exec("CREATE TABLE places(id INTEGER PRIMARY KEY, name TEXT, name_ar TEXT, name_en TEXT, kind TEXT, lat REAL, lon REAL, rank INTEGER); CREATE VIRTUAL TABLE places_fts USING fts4(key)");
const pi = pl.prepare("INSERT INTO places VALUES (?,?,?,?,?,?,?,?)"), pf = pl.prepare("INSERT INTO places_fts(rowid, key) VALUES (?, ?)");
[[1, "Cairo Tower", "برج القاهرة", "Cairo Tower", "tourism/attraction", 30.0459, 31.2243, 40], [2, "Cairo Festival City", "", "", "shop/mall", 30.03, 31.41, 30],
 [3, "Shell", "", "", "amenity/fuel", 30.05, 31.23, 10]].forEach((x) => { pi.run(...x); pf.run(x[0], P.normalize(x[1] + " " + x[2] + " " + x[3])); });
pl.close();
fs.writeFileSync(path.join(md, "manifest.json"), JSON.stringify({ code: "eg", name: "Egypt", files: [{ name: "eg.pmtiles", bytes: 16 }, { name: "eg-places.sqlite", bytes: fs.statSync(path.join(md, "eg-places.sqlite")).size }, { name: "eg-route.bin", bytes: 999 }] }));
const ml = P.mapList();
assert.equal(ml.length, 1); assert.equal(ml[0].routes, false, "the optional directions file is not there");
assert.equal(Buffer.from(P.mapRead({ path: "eg/eg.pmtiles", offset: 4, length: 6 }), "base64").toString(), "456789", "byte range read");
assert.equal(P.mapRead({ path: "../know/cars/manifest.json" }), "", "no reading outside maps/");
assert.equal(P.mapRead({ path: "eg/missing.bin" }), "");
let s = P.mapSearch({ q: "برج القاهره" });
assert.equal(s[0].name, "Cairo Tower", "Arabic search with a different spelling");
s = P.mapSearch({ q: "cairo" });
assert.equal(s[0].name, "Cairo Tower", "the most important kind first");
s = P.mapSearch({ kinds: ["amenity/fuel"], lat: 30.04, lon: 31.23 });
assert.equal(s[0].name, "Shell", "a category near a point");
console.log("PASS maps: list, byte ranges, search, no path escapes");

// ---- 3. LIVE: the real cranes pack from GitHub ----
(async () => {
  if (process.env.ATTUNE_LIVE === "0") { console.log("packs: all passed (live skipped)"); return; }
  let man;
  try { man = await P.knowRemote("cranes"); }
  catch (e) { if (process.env.ATTUNE_LIVE === "1") throw e; console.log("SKIP live pack (no network here: " + e.message + ")"); console.log("packs: all passed"); return; }
  let last = 0;
  const got = await P.knowInstall("cranes", (d, t) => { last = d; }, () => false);
  assert.ok(got.installed && last > 0, "installed with progress");
  assert.ok(gate.includes("knowledge pack"), "downloads pass the offline-lock gate");
  const hits = P.knowSearch({ q: "crane outrigger ground pressure", k: 5, ids: ["cranes"] });
  assert.ok(hits.passages.length > 0 && hits.passages[0].pack === "cranes", "the real pack answers: " + (hits.passages[0] && hits.passages[0].title));
  console.log("PASS live: the cranes pack (" + man.count + " passages) downloaded, checked and searched → " + hits.passages[0].title);
  assert.ok(P.knowRemove("cranes") && !P.knowList().some((p) => p.id === "cranes"));
  console.log("packs: all passed");
})().catch((e) => { console.error("FAIL", e.message); process.exit(1); });
