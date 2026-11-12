// v9.9.22 B5 people logic — a 2,500 sample of tests/b5/gen.mjs (10,000 each) must stay 100% (pure date / count logic), + held-out cases.
import { execFileSync } from "child_process";
import * as B from "../../web-src/b5people.js";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const out = execFileSync("node", [new URL("../b5/gen.mjs", import.meta.url).pathname, "2500"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
for (const k of ["N3 on this day", "P1 keep in touch", "P3 occasions"]) ok(new RegExp("\\*\\*" + k + "\\*\\*: 2500 / 2500").test(out), k + " — 2,500 / 2,500");
const now = new Date(2026, 10, 12, 9).getTime();   // Thu 12 Nov 2026
// N3 held-out: Ali's car instalment a year ago
const g = B.onThisDay({ records: [{ id: "n1", ts: new Date(2024, 10, 12, 18).getTime(), title: "Lunch with Karim", kind: "note" }], txns: [{ id: "t1", date: "2025-11-12", amount: 3500, note: "last car instalment", type: "expense" }, { id: "t2", date: "2025-11-12", amount: 40, note: "coffee", type: "expense" }] }, now);
ok(g && g.id === "t1" && g.years === 1, "a year ago (the bigger payment) beats two years ago");
ok(B.onThisDay({ txns: [{ id: "x", date: "2025-11-13", amount: 9 }] }, now) === null, "the day after is not 'today'");
// P1 held-out: mum every 3 days, talked yesterday; Karim monthly, 5 weeks; a missed call from Karim doesn't count
const k = B.keepInTouch([{ id: "mum", name: "Mum", every: 3 }, { id: "karim", name: "Karim", every: 30 }],
  [{ who: "mum", at: now - 864e5, kind: "call" }, { who: "karim", at: now - 35 * 864e5, kind: "chat" }, { who: "karim", at: now - 2 * 864e5, kind: "missed" }], now);
ok(k[0].id === "karim" && k[0].since === 35 && k[0].due && !k[1].due, "Karim is due (35 days; his missed call didn't reset it), Mum isn't");
// P3 held-out: Nada's birthday today, born 1996; a 29 Feb birthday in 2027
const o = B.occasions([{ id: "a", who: "Nada", kind: "birthday", md: "11-12", year: 1996 }, { id: "b", who: "Sara", kind: "birthday", md: "02-29", year: 2000 }], now);
ok(o[0].who === "Nada" && o[0].inDays === 0 && o[0].turns === 30, "today: Nada turns 30");
ok(o[1].next === "2027-02-28" && o[1].turns === 27, "29 Feb → 28 Feb in 2027, turns 27");
ok(B.wishFor(o[0], "ar") === "كل سنة وانت طيب يا Nada، ربنا يسعدك 🌸" && /Nada/.test(B.wishFor(o[0], "fr")) && /Joyeux/.test(B.wishFor(o[0], "fr")), "the wish in the person's language");
console.log(fail ? "FAILED " + fail : "ALL PASSED");
