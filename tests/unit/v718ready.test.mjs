// v6.13 — Learn daily: ready courses (Turkish beginner → expert in 30 lessons) start without a model plan.
import assert from "node:assert/strict";
import { READY_COURSES, readyCourse } from "../../web-src/daily.js";
const t = READY_COURSES.find((r) => r.id === "turkish");
assert.equal(t.plan.length, 30, "Turkish has 30 lessons");
for (const r of READY_COURSES) for (const p of r.plan) assert.ok(p[0] && p[1], r.id + ": every lesson has an English and an Arabic title");
const c = readyCourse("turkish", { lang: "ar" });
assert.equal(c.plan.length, 30); assert.match(c.title, /التركية/); assert.match(c.plan[0], /الأبجدية/);
assert.equal(readyCourse("turkish").plan[29], "Speaking like a native: rhythm, fillers and slang");
assert.equal(readyCourse("nope"), null);
console.log("v718ready ok");
