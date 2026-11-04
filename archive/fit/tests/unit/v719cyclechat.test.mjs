// v6.13 — Cycle answers questions from the logged days.
import assert from "node:assert/strict";
import { loadJsx } from "./jsxload.mjs";
const { cycleAnswer } = await loadJsx("web-src/cycle.jsx");
const st = { settings: {}, days: {} };
const log = (k, n) => { for (let i = 0; i < n; i++) { const d = new Date(k + "T12:00:00"); d.setDate(d.getDate() + i); st.days[d.toISOString().slice(0, 10)] = { flow: "medium", symptoms: i === 0 ? ["cramps"] : [] }; } };
log("2026-07-01", 5); log("2026-07-29", 5); log("2026-08-26", 4); log("2026-09-23", 5);
let a = cycleAnswer("When is my next period?", st, "2026-10-10");
assert.match(a.text, /Next period: about .*21 Oct/); assert.match(a.text, /in 11 day/);
assert.match(cycleAnswer("am I late?", st, "2026-10-25").text, /Yes — 4 day/);
assert.match(cycleAnswer("how long is my cycle on average", st, "2026-10-10").text, /averages 28 days/);
assert.match(cycleAnswer("متى التبويض؟", st, "2026-10-10").text, /التبويض التقديري/);
assert.match(cycleAnswer("show my history", st, "2026-10-10").text, /23 Sept? · 5 days/);
assert.match(cycleAnswer("what symptoms do I get", st, "2026-10-10").text, /\(4\)/);
assert.equal(cycleAnswer("what is the capital of France", st, "2026-10-10"), null);
console.log("v719cyclechat ok");
