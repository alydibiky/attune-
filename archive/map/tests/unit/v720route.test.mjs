// v6.20 — directions inside Attune, offline (Ali: "what's the point of maps if it will redirect me to another map").
// A real route file of downtown Cairo (tests/fixtures/cairo-route-small.bin, built by tools/build_route_graph.py from
// Overture's road network, OpenStreetMap data, ODbL).
import { readFileSync } from "fs";
const RT = await import("../../web-src/route.js");
let fail = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };
const buf = readFileSync(new URL("../fixtures/cairo-route-small.bin", import.meta.url));
let reads = 0;
const R = await RT.openRoutes(async (o, n) => { reads++; return buf.buffer.slice(buf.byteOffset + o, buf.byteOffset + o + n); });
ok(R.dir.cell === 0.1 && Object.keys(R.dir.cells).length >= 1 && R.names.length > 100, "the file opens: squares of 0.1°, road names");
const tahrir = { lat: 30.0444, lon: 31.2357 }, zamalek = { lat: 30.0590, lon: 31.2243 };
const w = await RT.route(R, tahrir, zamalek, "walk");
ok(!w.error && w.metres > 1200 && w.metres < 3500 && w.steps.some((s) => /قصر النيل/.test(s.name)), `a walk from Tahrir to Zamalek crosses Qasr El Nil bridge: ${w.metres} m, ${Math.round(w.seconds / 60)} min`);
ok(Math.abs(w.seconds - w.metres / 1.35) < 600, "walking pace ≈ 4.9 km/h");
const c = await RT.route(R, tahrir, zamalek, "car");
ok(!c.error && c.line.length > 10 && c.seconds < w.seconds, `by car: ${c.metres} m, ${Math.round(c.seconds / 60)} min — faster than walking`);
ok(c.steps[0].turn === "start" && c.steps.every((s) => s.name || s.metres >= 150 || s === c.steps[0]), "steps: no tiny unnamed link roads as steps of their own");
ok(c.line[0][0] === tahrir.lon && c.line[c.line.length - 1][1] === zamalek.lat, "the line starts and ends at the two places");
const far = await RT.route(R, tahrir, { lat: 30.5, lon: 31.9 }, "car");
ok(far.error, "a place with no roads in the file: an error, not a wrong route (" + far.error + ")");
ok(RT.cellsFor(R, tahrir, zamalek).backbone === false && RT.cellsFor(R, tahrir, { lat: 25.7, lon: 32.6 }).backbone === true, "a short trip reads the squares between; a long one the ends + the main roads");
ok(RT.tidySteps([{ turn: "start", name: "A", metres: 100 }, { turn: "right", name: "", metres: 40 }, { turn: "straight", name: "A", metres: 300 }]).length === 1, "the same road on both sides of a short link is one step");
console.log(fail ? `${fail} FAILED` : "ALL PASSED");
