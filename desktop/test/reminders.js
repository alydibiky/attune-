// Desktop reminders (lib/reminders.js): the next time of repeating ones, a reminder rings once, replace by id, after a restart.
"use strict";
const assert = require("assert"), fs = require("fs"), os = require("os"), path = require("path");
const { makeReminders, next } = require("../lib/reminders");
const thu = new Date(2026, 9, 15, 9, 0).getTime();   // Thursday 15 Oct 2026, 09:00
assert.equal(new Date(next(thu, "weekdays", thu)).getDay(), 0, "after Thursday comes Sunday (Friday + Saturday are the weekend)");
assert.equal(next(thu, "daily", thu + 3600e3), thu + 864e5, "daily: the next day");
assert.equal(next(thu, "weekly", thu), thu + 7 * 864e5);
assert.equal(next(thu, "none", thu + 1), thu, "a one-off has no next time");
console.log("PASS next(): daily, weekly, weekdays (Egypt's weekend), one-off");
const data = fs.mkdtempSync(path.join(os.tmpdir(), "attune-rem-"));
const rang = [];
const R = makeReminders({ data, notify: (r) => rang.push(r.id) });
const t0 = Date.now();
assert.ok(R.schedule({ id: "a", at: t0 + 150, title: "Water", repeat: "none" }));
assert.ok(R.schedule({ id: "b", at: t0 + 150, title: "Pills", repeat: "daily" }));
assert.ok(R.schedule({ id: "b", at: t0 + 200, title: "Pills (moved)", repeat: "daily" }), "the same id replaces");
assert.equal(R.all().length, 2);
assert.equal(R.schedule({ id: "c" }), false, "no time, no reminder");
setTimeout(() => {
  assert.deepEqual(rang.sort(), ["a", "b"], "both rang once: " + rang);
  assert.ok(!R.all().some((r) => r.id === "a"), "a one-off is gone after ringing");
  const b = R.all().find((r) => r.id === "b"); assert.ok(b.at > Date.now() + 23 * 3600e3, "a daily one moved to tomorrow");
  R.stop();
  const R2 = makeReminders({ data, notify: () => {} });
  assert.equal(R2.all().length, 1, "kept on disk for the next start"); R2.rearmAll(); R2.stop();
  assert.ok(R2.unschedule("b") && R2.all().length === 0);
  console.log("PASS ring once, repeat moves on, one-off removed, kept after a restart");
  console.log("reminders: all passed");
}, 700);
