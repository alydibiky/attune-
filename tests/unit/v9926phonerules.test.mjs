// v9.9.26 phone rules (R1-C + R2-A): a 2,500 sample of tests/phonerules/gen.mjs must stay at 100%, a held-out 500, plus the rules one by one.
import { run } from "../phonerules/gen.mjs";
import * as P from "../../web-src/phonerules.js";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const r = run(2500, 0); ok(r.pass === 2500, "2,500 generated event sequences: " + r.pass + " / 2500 " + JSON.stringify(r.bad.slice(0, 1)));
const h = run(500, 90000); ok(h.pass === 500, "500 held-out: " + h.pass + " / 500");
const T = (hh, mm = 0, day = 12) => new Date(2026, 10, day, hh, mm).getTime();   // 12 Nov 2026 = Thursday
const car = { id: "c", when: { type: "bluetooth", device: { address: "AA:01", name: "KIA Cerato" } }, if: [] };
let d = P.decide([car], { kind: "bt", address: "AA:01", name: "My KIA" }, {}, T(8));
ok(d.fire.join() === "c", "a renamed car still matches by its address");
ok(P.decide([car], { kind: "bt", address: "AA:01", name: "KIA Cerato" }, d.state, T(8) + 30000).fire.length === 0, "it reconnects 30 s later → counts once");
ok(P.decide([car], { kind: "bt", address: "AA:02", name: "KIA Cerato" }, {}, T(8)).fire.length === 0, "another device with the same name → not the car");
const chg = { id: "g", when: { type: "charging" }, if: [{ type: "after", at: { h: 21, m: 0 } }] };
ok(P.decide([chg], { kind: "power", on: true, since: T(22) - 10000 }, {}, T(22)).fire.length === 0, "a 10-second charge doesn't fire");
ok(P.decide([chg], { kind: "power", on: true, since: T(22) - 600000 }, {}, T(22)).fire.join() === "g", "charging for 10 minutes after 21:00 → fires");
ok(P.decide([chg], { kind: "power", on: true, since: T(15) - 600000 }, {}, T(15)).fire.length === 0, "…but not at 15:00 (its hours)");
const wifi = { id: "w", when: { type: "wifi", ssid: "Home-5G" }, if: [{ type: "weekdays" }] };
ok(P.decide([wifi], { kind: "wifi", ssid: "<unknown ssid>" }, {}, T(19)).blind === true, "an unseen Wi-Fi name (location off) never fires — and it's reported");
ok(P.decide([wifi], { kind: "wifi", ssid: "Home-5G" }, { ssid: "Office" }, T(19)).fire.join() === "w", "moving onto Home-5G on a Thursday → fires");
ok(P.decide([wifi], { kind: "wifi", ssid: "Home-5G" }, { ssid: "Office" }, T(19, 0, 13)).fire.length === 0, "…not on Friday (the Egyptian weekend)");
ok(P.allowedNow([{ type: "after", at: { h: 22, m: 0 } }, { type: "before", at: { h: 6, m: 0 } }], T(2)), "after 22:00 and before 06:00 goes over midnight (02:00 is in)");
console.log(fail ? "FAILED " + fail : "ALL PASSED");
