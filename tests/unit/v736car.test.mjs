// v6.32 car manager: fuel, service, odometer; per-100-km, cost per km, next service.
import * as C from "../../web-src/car.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const T = Date.UTC(2026, 9, 17, 12);
let e = C.parseCar("fuel 600, 40 L at 45,200 km", { today: "2026-10-01", now: T });
ok(e && e.kind === "fuel" && e.amount === 600 && e.liters === 40 && e.km === 45200, "fuel 600, 40 L at 45,200 km (" + JSON.stringify(e) + ")");
e = C.parseCar("بنزين ٥٠٠ ج ٢٧ لتر العداد ٤٥٦٠٠", { today: "2026-10-08", now: T });
ok(e && e.kind === "fuel" && e.amount === 500 && e.liters === 27 && e.km === 45600, "Arabic fuel entry");
e = C.parseCar("غيرت الزيت ب ١٥٠٠ على ٤٥ ألف", { today: "2026-10-08", now: T });
ok(e && e.kind === "service" && e.service === "oil" && e.amount === 1500 && e.km === 45000, "«غيرت الزيت ب ١٥٠٠ على ٤٥ ألف» → oil change at 45,000 km (" + JSON.stringify(e) + ")");
e = C.parseCar("My driving licence expires on 1 March 2027", { now: T });
ok(e && e.kind === "deadline" && e.deadline.date === "2027-03-01" && e.deadline.car, "a licence date → the Deadline Radar");
ok(C.parseCar("hello", { now: T }) === null, "not about the car → null");
let car = { name: "", km: 0, log: [] };
for (const [s, d] of [["fuel 600 40 L at 45,200 km", "2026-10-01"], ["fuel 560 35 L at 45,700 km", "2026-10-08"], ["fuel 520 33 L at 46,150 km", "2026-10-15"], ["oil change 1500 at 45,000 km", "2026-04-10"]])
  car = C.addCarEntry(car, C.parseCar(s, { today: d, now: T }), T);
const st = C.carStats(car, T);
ok(st.kmNow === 46150 && st.per100 === 7.2, "68 L over 950 km = 7.2 L/100 km (" + st.per100 + ")");
ok(st.costKm === 1.14 && st.fuelMonth === 1680, "1,080 over 950 km = 1.14 a km; fuel this month 1,680");
const oil = st.next.find((x) => x.service === "oil");
ok(oil && oil.dueKm === 55000 && oil.kmLeft === 8850 && oil.dueDate === "2027-04-10" && !oil.due, "oil: next at 55,000 km or April 2027, 8,850 km left");
const st2 = C.carStats(C.addCarEntry(car, { kind: "km", km: 54700, date: "2026-10-17" }), T);
ok(st2.next[0].service === "oil" && st2.next[0].due, "300 km before it → the oil change is due");
ok(C.carMoneyText({ kind: "fuel", amount: 600, liters: 40 }) === "Fuel 600 (40 L)", "a fuel entry can go to Money");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
