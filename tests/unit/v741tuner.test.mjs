// v6.41 X2 the engine tuner: what to try, and which to keep.
import * as T from "../../web-src/tuner.js";
let bad = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) bad++; };
const c8 = T.candidates({ cores: 8, bigCores: 4 });
ok(JSON.stringify(c8.map((c) => c.gen)) === "[3,4,5]" && c8.every((c) => c.batch >= c.gen && c.batch <= 6), "8 cores, 4 fast: tries 3, 4 and 5 threads; prompt threads a bit more: " + JSON.stringify(c8));
const c4 = T.candidates({ cores: 4, bigCores: 2 });
ok(c4.every((c) => c.gen >= 2 && c.gen <= 3), "4 cores: never more than 3 (one core stays for the screen): " + JSON.stringify(c4));
ok(T.candidates({ cores: 12, bigCores: 8 }).every((c) => c.gen <= 6), "never more than 6");
let r = T.choose([{ gen: 3, batch: 5, tps: 13.1 }, { gen: 4, batch: 6, tps: 13.5 }, { gen: 5, batch: 6, tps: 11.0 }], { tps: 12 });
ok(r.best.gen === 3 && r.gainPct === 9, "4 threads is only 3% faster than 3 → keep 3 (cooler): " + JSON.stringify(r));
r = T.choose([{ gen: 3, batch: 5, tps: 10 }, { gen: 4, batch: 6, tps: 14 }]);
ok(r.best.gen === 4 && r.gainPct === null, "clearly faster wins");
ok(T.choose([{ gen: 3, tps: 0 }]) === null && T.choose([]) === null, "nothing measured → no change");
console.log(bad ? bad + " FAILED" : "v741tuner ok");
