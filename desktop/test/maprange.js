// v6.27: a country's map read online without downloading it (lib/packs.js mapRange) — with a fake GitHub:
// the manifest, a whole file and a file published in parts; only the asked bytes are fetched (HTTP Range).
"use strict";
const assert = require("assert");
const fs = require("fs"), os = require("os"), path = require("path");
const { makePacks } = require("../lib/packs");

const whole = Buffer.from(Array.from({ length: 5000 }, (_, i) => i % 251));
const big = Buffer.from(Array.from({ length: 2500 }, (_, i) => (i * 7) % 253));
const parts = { "xx.pmtiles.001": big.subarray(0, 1000), "xx.pmtiles.002": big.subarray(1000, 2000), "xx.pmtiles.003": big.subarray(2000) };
const man = { code: "eg", files: [{ name: "eg.pmtiles", bytes: whole.length }, { name: "xx.pmtiles", bytes: big.length, parts: Object.entries(parts).map(([name, b]) => ({ name, bytes: b.length })) }] };
const asked = [];
const fakeFetch = async (url, opt) => {
  const name = url.split("/").pop(), range = opt.headers.Range;
  asked.push(name + (range ? " " + range : ""));
  if (name === "eg-manifest.json") return { ok: true, status: 200, text: async () => JSON.stringify(man) };
  const body = name === "eg.pmtiles" ? whole : parts[name];
  if (!body) return { ok: false, status: 404 };
  const [, a, b] = /bytes=(\d+)-(\d+)/.exec(range);
  return { ok: true, status: 206, arrayBuffer: async () => body.subarray(+a, +b + 1) };
};
const gate = [];
const P = makePacks({ data: fs.mkdtempSync(path.join(os.tmpdir(), "attune-mr-")), online: (url, why) => gate.push(why), fetch: fakeFetch });

(async () => {
  let r = await P.mapRange({ code: "eg", name: "eg.pmtiles", offset: 100, length: 50 });
  assert.ok(Buffer.from(r.b64, "base64").equals(whole.subarray(100, 150)), "a piece of a whole file");
  console.log("PASS a piece of a published map, read online (only bytes 100–149 fetched)");
  assert.ok(asked.includes("eg.pmtiles bytes=100-149"));
  r = await P.mapRange({ code: "eg", name: "xx.pmtiles", offset: 900, length: 1300 });
  assert.ok(Buffer.from(r.b64, "base64").equals(big.subarray(900, 2200)), "a piece across three parts");
  assert.ok(asked.includes("xx.pmtiles.001 bytes=900-999") && asked.includes("xx.pmtiles.002 bytes=0-999") && asked.includes("xx.pmtiles.003 bytes=0-199"));
  console.log("PASS a piece that crosses a file's parts is joined from each part");
  r = await P.mapRange({ code: "eg", name: "eg.pmtiles", offset: 4990, length: 100 });
  assert.strictEqual(Buffer.from(r.b64, "base64").length, 10);
  console.log("PASS a piece past the end is cut at the end");
  assert.strictEqual(asked.filter((x) => x === "eg-manifest.json").length, 1);
  console.log("PASS the list of files is fetched once, then remembered");
  await assert.rejects(P.mapRange({ code: "eg", name: "../x", offset: 0, length: 1 }));
  await assert.rejects(P.mapRange({ code: "eg", name: "nope.pmtiles", offset: 0, length: 1 }));
  console.log("PASS unknown or unsafe file names are refused");
  assert.ok(gate.length && gate.every((w) => w === "map"), "every request passes the offline lock");
  console.log("PASS every request passes the offline lock");
  console.log("maprange: all passed");
})().catch((e) => { console.error("FAIL", e.message); process.exit(1); });
