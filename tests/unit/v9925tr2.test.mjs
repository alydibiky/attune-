// v9.9.25 B7 TR2 the flight day: a 2,500 sample of tests/tr2/gen.mjs must stay at 100%, a held-out 500, plus the mock-up's own example.
import { run } from "../tr2/gen.mjs";
import * as F from "../../web-src/flightday.js";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const r = run(2500, 0); ok(r.pass === 2500, "2,500 generated flight days: " + r.pass + " / 2500 " + JSON.stringify(r.bad.slice(0, 1)));
const h = run(500, 90000); ok(h.pass === 500, "500 held-out: " + h.pass + " / 500");
const f = { no: "MS643", airline: "EgyptAir", from: "CAI", to: "JED", date: "2027-03-03", time: "09:40" };
const at = (s) => Date.parse("2027-03-03T" + s + ":00");
const d = F.flightDay(f, { now: at("07:45"), travelMin: 45, checkedIn: true, messages: [{ from: "EgyptAir", ts: at("07:40"), text: "Gate changed to F7. Boarding 09:00" }, { from: "+201001234567", ts: at("07:41"), text: "Gate changed to B2" }] });
ok(d.gate === "F7" && d.boarding === "09:00", "the mock-up: gate F7, boarding 09:00 from EgyptAir — the B2 from an unknown number ignored");
ok(new Date(d.steps[1].at).getHours() === 5 && new Date(d.steps[1].at).getMinutes() === 55, "leave home 05:55 = 09:40 − 3 h (international) − 45 min");
ok(d.progress === 0.5, "checked in + left home → half way");
const dom = F.flightDay({ ...f, to: "HRG" }, { now: at("05:00"), travelMin: 45 });
ok(new Date(dom.steps[1].at).getHours() === 6 && new Date(dom.steps[1].at).getMinutes() === 55, "Cairo → Hurghada (domestic): 2 h at the airport → leave 06:55");
const late = F.flightDay({ ...f, time: "22:30" }, { now: Date.parse("2027-03-03T20:00:00"), messages: [{ from: "EgyptAir", ts: 1, text: "تأخير الرحلة، موعد الإقلاع الجديد 01:15" }] });
ok(late.departAt === Date.parse("2027-03-04T01:15:00") && late.delayMin === 165, "a delay to 01:15 is the next day (165 minutes late), in Arabic");
ok(F.flightDay(f, { now: at("05:00"), messages: [{ from: "Saudia", ts: 1, text: "Gate changed to C3" }] }).gate === "", "another airline's message (not naming MS643) is ignored");
console.log(fail ? "FAILED " + fail : "ALL PASSED");
