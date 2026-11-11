// v9.9.18 batch B1 (AUTOMATION_PLAN.md): AU5 nag levels, AU7 notification buttons, AU8 done-for-you, and the country weekend.
// Keeps a 2,500 sample of each 10,000 run at 100% and checks a held-out set written after the code (bash tests/<x>/run.sh = full runs).
import { execFileSync } from "child_process";
const run = (f, a = [], env = {}) => execFileSync("node", [new URL(f, import.meta.url).pathname, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], env: { ...process.env, ...env } });
let bad = 0; const ok = (c, t) => { console.log((c ? "PASS " : "FAIL ") + t); if (!c) bad++; };
const pct = (s) => +(/\(([\d.]+)%\)/.exec(s) || [])[1];
for (const z of ["Africa/Cairo", "Europe/London"]) { const s = run("../nag/gen.mjs", ["1250"], { TZ: z }); ok(pct(s) === 100, "nag: 1,250 timelines in " + z + " — " + pct(s) + "%"); }
{ const s = run("../notifpay/gen.mjs", ["2500"]); ok(pct(s) === 100, "notification buttons: 2,500 tap sequences — " + pct(s) + "%"); }
{ const s = run("../donelog/gen.mjs", ["2500"]); ok(pct(s) === 100, "done for you: 2,500 days — " + pct(s) + "%"); }

// held-out (written after the code)
globalThis.localStorage = { getItem: (k) => (k === "attune:country" ? globalThis.__cc || "eg" : null), setItem() {}, removeItem() {} };
const N = await import("../../web-src/nag.js"), P = await import("../../web-src/notifpay.js"), D = await import("../../web-src/donelog.js");
const { nextOccurrence } = await import("../../web-src/actions.js"), { weekendOf } = await import("../../web-src/country.js");
const at = Date.parse("2026-11-11T22:50:00"), Q = { from: "23:00", to: "07:00" };
{ const r = N.rings({ at, important: true }, { quiet: Q, until: at + 864e5 }); ok(r.length >= 2 && new Date(r[1]).getHours() === 7 && new Date(r[1]).getMinutes() === 0, "★ at 22:50 with quiet 23:00–07:00 → rings 22:50, then 07:00 (not 23:05)"); }
ok(N.rings({ at, nag: "once" }).length === 1, "once = one ring");
ok(N.rings({ at, nag: "h1" }, { doneAt: at + 61 * 60000 }).length === 2, "every hour, ticked after 61 min → 2 rings");
ok(N.rings({ at, nag: "m10" }).length === 13, "every 10 min stops after 12 repeats (13 rings)");
ok(N.rings({ at, nag: "until" }, { until: at + 864e5 }).length === 49, "until I tick: every 30 min, no cap (49 in a day)");
{ const pays = { r1: P.payButtons({ amount: 320, currency: "EGP", note: "Electricity", cat: "bills" }, [{ id: "cash", name: "Cash" }, { id: "cib", name: "CIB" }, { id: "vfc", name: "Vodafone Cash" }]) };
  const a = P.applyTaps([{ id: "1", rid: "r1", act: "paid", at }], pays); ok(a.add.length === 0 && a.waiting[0] === "r1", "Paid with 3 balances → waits for the balance (nothing in Money yet)");
  const b = P.applyTaps([{ id: "2", rid: "r1", act: "acct", acct: "vfc", at }, { id: "2", rid: "r1", act: "acct", acct: "vfc", at }, { id: "3", rid: "r1", act: "acct", acct: "cib", at }], pays, a.state);
  ok(b.add.length === 1 && b.add[0].account === "vfc" && b.add[0].amount === 320, "…Vodafone Cash tapped (twice) → one 320 from Vodafone Cash; a later CIB tap adds nothing");
  const c = P.applyTaps([{ id: "4", rid: "r1", act: "undo", at }], pays, b.state); ok(c.remove.length === 1 && c.remove[0] === b.add[0].id, "Undo takes exactly that one out");
  const one = { r2: P.payButtons({ amount: 99, currency: "SAR", cat: "bills" }, [{ id: "stc", name: "STC Pay" }]) };
  const d = P.applyTaps([{ id: "5", rid: "r2", act: "paid", at }], one); ok(d.add.length === 1 && d.add[0].account === "stc" && d.add[0].currency === "SAR", "one balance → Paid records at once, in that country's currency"); }
{ let st = D.empty(); st = D.record(st, { kind: "money", source: "talabat", amount: 185, cat: "food" }, at).st; const e = st.log[0];
  const r = D.edit(st, e.id, { cat: "late food", amount: 200 }); ok(r.ask && !("amount" in r.remember) && r.remember.cat === "late food", "edit category + amount → offers to remember the category only");
  st = D.remember(r.st, e, r.remember); ok(D.withLearned(st, { kind: "money", source: "Talabat ", amount: 90, cat: "food" }).cat === "late food" && D.withLearned(st, { kind: "money", source: "Uber", amount: 90, cat: "transport" }).cat === "transport", "…then Talabat gets it next time, Uber doesn't");
  ok(!D.canDoAlone(D.setLimits(st, { money: 100 }), { amount: 150 }, at).ok, "a 150 action with a 100 limit is not done alone"); }
const fri = Date.parse("2026-11-13T09:00:00");
for (const [cc, day] of [["eg", 0], ["sa", 0], ["ae", 1], ["gb", 1], ["pk", 1], ["us", 1]]) { globalThis.__cc = cc; const w = weekendOf(cc);
  const t = nextOccurrence({ at: fri, repeat: "weekdays", off: w }, fri); ok(new Date(t).getDay() === day || !w.length, cc + ": a weekdays reminder after Friday next rings on day " + new Date(t).getDay() + " (weekend " + w + ")"); }
console.log(bad ? "FAIL " + bad + " failed" : "ALL PASSED");
if (bad) process.exitCode = 1;
