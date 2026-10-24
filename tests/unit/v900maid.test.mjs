// v7.9 (Ali: "in People & plans the app did not ask me via checkbox if the maid came or not"): on her day People & plans asks,
// with a checkbox (came = paid, in Money) or "Didn't come" (nothing paid, not asked again that day).
import { parseLife, askToday, skipDay, dueSoon, togglePaid } from "../../web-src/life.js";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const sat = new Date("2026-10-24T09:00:00").getTime();   // a Saturday
const c = { ...parseLife("The maid comes every Saturday and takes 600 EGP", { now: new Date("2026-10-10T09:00:00").getTime() }), id: "m1" };
ok(c.kind === "regular" && c.dir === "out" && c.amount === 600, "the maid every Saturday is read as a regular: " + JSON.stringify({ k: c.kind, d: c.dir, a: c.amount }));
let data = { items: [c] };
let A = askToday(data, sat);
ok(A.length === 1 && A[0].date === "2026-10-24" && A[0].amount === 600, "on Saturday it asks about today, 600");
ok(askToday(data, new Date("2026-10-23T09:00:00").getTime()).length === 0, "on Friday it asks nothing");
const paid = togglePaid(data, "m1", A[0].i);
ok(askToday(paid, sat).length === 0, "ticked (she came) → not asked again");
const skipped = skipDay(data, "m1", A[0].i);
ok(askToday(skipped, sat).length === 0 && dueSoon(skipped, sat).length === 0, "\"Didn't come\" → not asked again, not due");
ok(askToday(skipDay(skipped, "m1", A[0].i, false), sat).length === 1, "…and it can be undone");
const short = parseLife("maid every saturday 600", { now: sat });
ok(short && short.kind === "regular" && short.amount === 600, "the short way to say it works too (\"Saturday 600\" is money, not the day)");
console.log(fail ? "FAILED " + fail : "ALL PASSED");
