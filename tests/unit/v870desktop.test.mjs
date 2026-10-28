// v8.7 (Ali: "I want the fixes to be on the desktop app"): the desktop reminders repeat like the phone's Reminders.kt
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { next } = createRequire(import.meta.url)("../../desktop/lib/reminders.js");
const t = new Date(2026, 9, 30, 9).getTime();   // Friday 30 Oct 2026, 9:00
const d = (ms) => { const x = new Date(ms); return `${x.getFullYear()}-${x.getMonth() + 1}-${x.getDate()} ${x.getHours()}`; };
assert.equal(d(next(t, "last:5", t)), "2026-11-27 9", "every last Friday of the month → 27 Nov");
assert.equal(d(next(t, "monthly", t)), "2026-11-30 9", "monthly → 30 Nov");
assert.equal(d(next(t, "days:0,2", t)), "2026-11-1 9", "Sundays and Tuesdays → Sunday 1 Nov");
assert.equal(next(t, "none", t), t, "once stays once");
console.log("v870desktop: 4 checks passed");
