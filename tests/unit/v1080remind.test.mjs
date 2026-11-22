// v10.8 (the persona 6 re-run, 22 Nov 2026): repeating reminders. "remind me every Friday to pay rent" went to Chat, «فكرني كل جمعة …» had
// no date, «كل يوم سبت» became every day, "each Friday" / "on Fridays" / "of each month" didn't repeat, "on the 5th of every month" was
// titled «of to pay rent» ("mon" matched "month"), "remind me every Monday to call mum" asked who mum is, "every day at 07:00" said at
// 10:00 became 19:00, "8 a.m." was 8 pm, "send the weekly report" lost «weekly». 2,500 hardened composed cases of
// tests/reminders/repeat.mjs (full run 10,000: 72.86 % → 81.00 % on the harder generator → 100 %; held-out 10,000: 89.85 % → 100 %).
process.env.N = "2500";
const { RESULT } = await import("../reminders/repeat.mjs");
const { understand } = await import("../../web-src/doit.js");
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { console.log("FAIL " + m); fail++; } };
const NOW = Date.parse("2026-11-22T10:00:00");
const one = (t) => { const r = understand(t, { now: NOW }); const a = r.actions && r.actions[0] && r.actions[0].action; return a ? { title: a.title, repeat: a.repeat, d: new Date(a.at) } : null; };
for (const [t, title, repeat, day, hour] of [
  ["remind me every Friday to pay rent", "pay rent", "weekly", 5, null], ["فكرني كل جمعة ادفع الإيجار", "ادفع الإيجار", "weekly", 5, null],
  ["فكرني كل يوم سبت ادفع الإيجار", "ادفع الإيجار", "weekly", 6, null], ["remind me each Friday to pay rent", "pay rent", "weekly", 5, null],
  ["Remind me to pay rent on Sundays", "pay rent", "weekly", 0, null], ["remind me on the 5th of every month to pay rent", "pay rent", "monthly", null, null],
  ["remind me every last Friday of the month to pay rent", "pay rent", "last:5", 5, null], ["remind me every Monday to call mum", "call mum", "weekly", 1, null],
  ["Remind me every day at 07:00 to take my pills", "take my pills", "daily", null, 7], ["remind me daily at 8 a.m. to take my pills", "take my pills", "daily", null, 8],
  ["remind me every Thursday to send the weekly report", "send the weekly report", "weekly", 4, null], ["فكّرني: كل الاتنين 8 الصبح اخد الدوا", "اخد الدوا", "weekly", 1, 8]]) {
  const a = one(t);
  ok(a && a.title === title, `${JSON.stringify(t)} → a reminder titled «${title}» (got ${a && a.title})`);
  ok(a && a.repeat === repeat, `${JSON.stringify(t)} repeats ${repeat} (got ${a && a.repeat})`);
  if (a && day != null) ok(a.d.getDay() === day, `${JSON.stringify(t)} falls on day ${day} (got ${a.d.getDay()})`);
  if (a && hour != null) ok(a.d.getHours() === hour, `${JSON.stringify(t)} at ${hour}:00 (got ${a.d.getHours()})`);
}
ok(RESULT.ok / RESULT.n >= 0.995, `2,500 composed cases: ${RESULT.ok}/${RESULT.n}`);
ok(RESULT.share >= 0.6, `different shapes ${(100 * RESULT.share).toFixed(1)} %`);
console.log(fail ? `FAIL ${fail}/${n}` : `PASS ${n}/${n}`);
process.exit(fail ? 1 : 0);
