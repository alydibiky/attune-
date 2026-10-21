// v6.47 (VISION phase 2: every area on Home's Today line): doses at their time, today's payments and deadlines, the lesson.
globalThis.localStorage = { _s: {}, getItem(k) { return this._s[k] ?? null; }, setItem(k, v) { this._s[k] = String(v); }, removeItem(k) { delete this._s[k]; } };
const { todayLine } = await import("../../web-src/home.js");
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log("FAIL", m); } else console.log("ok  ", m); };
const now = new Date(2026, 9, 21, 12, 0).getTime();
const care = { members: [], meds: [{ id: "m1", name: "Metformin", times: ["09:00", "21:00"], start: "2026-10-01" }], taken: { "m1|2026-10-21|09:00": now - 3e6 } };
const line = todayLine({ care, now }).line;
const doses = line.filter((x) => x.app === "care");
ok(doses.length === 2 && doses[0].hm === "09:00" && doses[0].sub === "Taken" && doses[1].hm === "21:00" && doses[1].ahead, "doses at 09:00 (taken) and 21:00 (ahead): " + doses.map((x) => x.hm + " " + x.sub).join(", "));
ok(line.map((x) => x.t).every((t, i, a) => !i || a[i - 1] <= t), "the line stays in time order");
const empty = todayLine({ now }).line;
ok(Array.isArray(empty) && !empty.length, "nothing saved: an empty line, no errors");
console.log(fails ? fails + " FAILED" : "ALL PASSED"); process.exit(fails ? 1 : 0);
