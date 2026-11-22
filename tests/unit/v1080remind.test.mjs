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
// v10.8 (Ali: "fix both"): the n-th weekday of the month, and "every month" with no day asks which day
for (const [t, repeat, date] of [["remind me every first Monday of the month to call mum", "nth:1:1", "2026-12-07"], ["فكرني أول اتنين في الشهر ادفع الجمعية", "nth:1:1", "2026-12-07"],
  ["remind me on the second Friday of every month to pay the club", "nth:2:5", "2026-12-11"], ["remind me every 3rd Sunday of the month at 7pm to visit grandma", "nth:3:0", "2026-12-20"]]) {
  const a = one(t); ok(a && a.repeat === repeat, `${JSON.stringify(t)} repeats ${repeat} (got ${a && a.repeat})`);
  ok(a && `${a.d.getFullYear()}-${String(a.d.getMonth() + 1).padStart(2, "0")}-${String(a.d.getDate()).padStart(2, "0")}` === date, `${JSON.stringify(t)} first on ${date} (got ${a && a.d.toDateString()})`);
}
for (const t of ["remind me every month to pay the internet", "فكرني كل شهر ادفع النت"]) { const r = understand(t, { now: NOW }); ok(r.ask && r.ask.kind === "remind-day" && !r.actions.length, `${JSON.stringify(t)} asks which day`); }
const { nextOccurrence } = await import("../../web-src/actions.js");
{ let x = new Date(2026, 11, 7, 9).getTime(); const seen = []; for (let i = 0; i < 3; i++) { x = nextOccurrence({ at: new Date(2026, 11, 7, 9).getTime(), repeat: "nth:1:1" }, x); seen.push(new Date(x).getDate()); }
  ok(seen.join(",") === "4,1,1", `the next first Mondays: Jan 4, Feb 1, Mar 1 (got ${seen})`); }
const { createRequire } = await import("node:module"); const { next } = createRequire(import.meta.url)("../../desktop/lib/reminders.js");
ok(new Date(next(new Date(2026, 11, 7, 9).getTime(), "nth:1:1", new Date(2026, 11, 7, 9).getTime())).getDate() === 4, "the computer app rings the next first Monday too");
const fs = await import("fs"); ok(/startsWith\("nth:"\)/.test(fs.readFileSync(new URL("../../app/src/main/java/com/aldibiki/attune/Reminders.kt", import.meta.url), "utf8")), "the phone's Reminders.kt knows nth:");
ok(RESULT.ok / RESULT.n >= 0.995, `2,500 composed cases: ${RESULT.ok}/${RESULT.n}`);
ok(RESULT.share >= 0.6, `different shapes ${(100 * RESULT.share).toFixed(1)} %`);
console.log(fail ? `FAIL ${fail}/${n}` : `PASS ${n}/${n}`);
process.exit(fail ? 1 : 0);
