// v6.37 M4: promise score per person across X-rayed chats.
import { promiseScores } from "../../web-src/chatxray.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const t = (s) => Date.parse(s + "T12:00:00"), now = t("2026-10-18");
const A = { name: "Ahmed", me: "Ali", items: [
  { type: "promise", from: "Ahmed", t: t("2026-09-01"), amount: 5000, due: "2026-09-05", what: "pay 5000" },
  { type: "paid", from: "Ahmed", t: t("2026-09-04"), amount: 5000 },                       // kept on time
  { type: "promise", from: "Ahmed", t: t("2026-09-10"), amount: 3000, due: "2026-09-12" },
  { type: "paid", from: "Ahmed", t: t("2026-09-30"), amount: 3000 },                       // kept, late
  { type: "promise", from: "Ahmed", t: t("2026-10-01"), amount: 2000, due: "2026-10-03", what: "the rest" },   // broken
  { type: "promise", from: "Ahmed", t: t("2026-10-15"), amount: 1000, due: "2026-10-25" },  // open
  { type: "promise", from: "Ali", t: t("2026-10-01"), amount: 99, due: "2026-10-02" } ] };   // my own promise: not scored
const B = { name: "Work", me: "Ali", items: [{ type: "promise", from: "Mona", t: t("2026-10-01"), due: "2026-10-05" }, { type: "paid", from: "Mona", t: t("2026-10-04") }] };
const s = promiseScores([A, B], now), ah = s.find((x) => x.person === "Ahmed"), mo = s.find((x) => x.person === "Mona");
ok(ah.kept === 2 && ah.late === 1 && ah.broken === 1 && ah.open === 1, "Ahmed: 2 kept (1 late), 1 broken, 1 open");
ok(ah.score === 50 && mo.score === 100, "scores: Ahmed " + ah.score + ", Mona " + mo.score);
ok(!s.find((x) => x.person === "Ali"), "my own promises are not scored");
ok(s[0].person === "Ahmed", "the least reliable comes first");
ok(ah.examples[0].what === "the rest", "a broken promise is shown with its words");
ok(promiseScores([], now).length === 0, "no chats → nothing");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
