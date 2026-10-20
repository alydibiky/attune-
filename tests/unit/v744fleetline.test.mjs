// v6.44: Fleet & rentals on Home's Today line — the cranes working today, and what needs you there (cheque overdue…).
import { todayLine } from "../../web-src/home.js";
import { heal, loadDemo } from "../../web-src/fleet.js";
let bad = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) bad++; };
const now = new Date("2026-10-20T15:00:00").getTime();
const fleet = loadDemo(heal({}), "2026-10-20");
const r = todayLine({ fleet, now });
const fl = r.line.filter((x) => x.app === "fleet");
ok(fl.length >= 2, "fleet lines: " + fl.map((x) => x.hm + " " + x.title + " | " + x.sub).join(" ; "));
ok(fl[0].hm === "07:00" && fl[0].title === "2 cranes working" && /LTM 1100 @ \[DEMO\] New Capital/.test(fl[0].sub), "the cranes working, with their sites, at 07:00");
const q = fl.find((x) => /Cheque overdue/.test(x.title));
ok(q && q.hm === "09:00" && /40,000 EGP · #100245/.test(q.sub) && /Orascom/.test(q.title), "the overdue cheque: client, amount, number");
ok(fl.every((x) => x.open === "fleet-rentals"), "every Fleet line opens Fleet & rentals");
ok(!fl.some((x) => /553100/.test(x.sub)), "a cheque due in 4 days (info) is not on today's line");
ok(todayLine({ fleet: heal({}), now }).line.length === 0, "an empty Fleet adds nothing");
ok(todayLine({ now }).line.length === 0, "no Fleet at all — nothing, no error");
console.log(bad ? bad + " FAILED" : "ALL PASSED");
