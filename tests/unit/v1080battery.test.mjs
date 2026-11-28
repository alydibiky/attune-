// v10.8 (launch, battery): the always-listening wake word holds back on Battery saver / a low battery; the agents' and Scout's
// background rounds wait while the battery is low; every background job writes a line in the on-phone battery log.
import fs from "fs";
const K = (f) => fs.readFileSync(new URL("../../app/src/main/java/com/aldibiki/attune/" + f, import.meta.url), "utf8");
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { console.log("FAIL " + m); fail++; } };
const g = K("BatteryGuard.kt"), w = K("WakeWord.kt"), a = K("AgentWatch.kt"), sc = K("ScoutNight.kt") + K("AgentWatch.kt") /* v10.9.10: the night run moved into BgRunJob (AgentWatch.kt) — a receiver had only ~60 s */, nb = K("NativeBridge.kt");
ok(/LOW = 15/.test(g) && /isPowerSaveMode/.test(g) && /fun holdMic[^\n]*!charging\(ctx\) && \(saver\(ctx\) \|\| low\(ctx\)\)/.test(g), "the mic holds back on Battery saver or ≤ 15 %, never while charging");
ok(/BatteryGuard\.holdMic\(this\)\) return false/.test(w), "the wake word asks the guard before listening");
ok(/ACTION_POWER_SAVE_MODE_CHANGED/.test(w) && /ACTION_BATTERY_LOW/.test(w) && /ACTION_BATTERY_OKAY/.test(w), "…and looks again when Battery saver or the battery level changes");
ok(/BatteryGuard\.low\(c\)\) \{ BatteryGuard\.log\(c, "skipped: agents/.test(a) && /AgentWatch\.arm\(c\)/.test(a), "a low battery: the agents' round waits for the next one (re-armed)");
ok(/BatteryGuard\.low\(c\)\) BatteryGuard\.log\(c, "skipped: scout/.test(sc), "a low battery: Scout's night round waits");
ok(/400/.test(g) && /fun batteryLog\(\)/.test(nb) && /fun batteryNow\(\)/.test(nb), "the log keeps the newest 400 lines and the page can read it");
ok(!/http|URL\(/.test(g), "the battery log is never sent anywhere");
console.log(fail ? `FAIL ${fail}/${n}` : `PASS ${n}/${n}`); process.exit(fail ? 1 : 0);
