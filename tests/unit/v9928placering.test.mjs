// v9.9.28 place reminders on the phone: a 2,500 sample of tests/placering/gen.mjs must stay at 100%, a held-out 500, plus by hand.
import { run } from "../placering/gen.mjs";
import * as P from "../../web-src/placering.js";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const r = run(2500, 0); ok(r.pass === 2500, "2,500 generated event sequences: " + r.pass + " / 2500 " + JSON.stringify(r.bad.slice(0, 1)));
const h = run(500, 90000); ok(h.pass === 500, "500 held-out: " + h.pass + " / 500");
const M = 60000, T0 = Date.parse("2026-11-13T18:00:00"), seq = (rem, evs) => { let st = {}; const out = []; for (const [m, e] of evs) { const d = P.placeRing(rem, { entering: e }, st, T0 + m * M); st = d.state; if (d.ring) out.push(m); } return out; };
ok(JSON.stringify(seq({ on: "arrive" }, [[0, true], [0.1, true], [25, false]])) === "[0]", "arrive: rings once on entering (Android's repeat ignored)");
ok(JSON.stringify(seq({ on: "arrive" }, [[0, true], [20, false], [21, true], [40, false]])) === "[0]", "a GPS bounce (out 1 minute) doesn't ring again");
ok(JSON.stringify(seq({ on: "arrive" }, [[0, true], [20, false], [45, true]])) === "[0,45]", "back 25 minutes later = a new visit → rings again");
ok(JSON.stringify(seq({ on: "leave" }, [[0, true], [0.5, false]])) === "[]", "leave: driving past (30 s inside) doesn't ring");
ok(JSON.stringify(seq({ on: "leave" }, [[0, true], [15, false]])) === "[15]", "leave: after 15 minutes inside → rings on leaving");
ok(JSON.stringify(seq({ on: "arrive", done: true }, [[0, true]])) === "[]", "a done reminder never rings");
console.log(fail ? "FAILED " + fail : "ALL PASSED");
