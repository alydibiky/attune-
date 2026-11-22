// v10.8 (Ali's problem report, 21 Nov 2026: "Attune closed by itself · the system stopped it (signal 11) · model Blaze", and the
// report's "Battery, last 24 h:" part was empty). The fast engine marks each answer (who asked, on which chip) and clears it when it
// ends; at the next start a mark left behind + Android saying the app ended unexpectedly → a line in the problem report, and on the
// GPU twice in 7 days → the CPU with a note. The battery part always says something. (Kotlin is compiled by CI; this reads the source.)
import fs from "fs";
const rd = (f) => fs.readFileSync(new URL("../../app/src/main/java/com/aldibiki/attune/" + f, import.meta.url), "utf8");
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { console.log("FAIL " + m); fail++; } };
const fe = rd("FastEngine.kt"), chat = fe.slice(fe.indexOf("fun chat("), fe.indexOf("private fun markTurn"));
ok(/markTurn\(ctx, id\)\s*\n\s*try \{/.test(chat), "an answer is marked just before it starts");
ok(/finally \{[\s\S]{0,200}clearTurn\(ctx\)[\s\S]{0,40}turn\.release\(\)/.test(chat), "… and cleared when it ends, whatever happens");
ok(/"fast_turn"[\s\S]{0,200}\.commit\(\)/.test(fe.slice(fe.indexOf("private fun markTurn"))), "the mark is written at once (commit — the app may die a moment later)");
const cc = fe.slice(fe.indexOf("fun checkCrash("));
ok(/ExitWatch\.unexpectedAt >= at/.test(cc), "a mark counts only when Android says the app ended unexpectedly (not swiped away)");
ok(/CrashLog\.add\(ctx, "closed while the fast engine was answering"/.test(cc), "it goes into the problem report");
ok(/7 \* 24 \* 3600_000L[\s\S]{0,80}Prefs\.setFastCpu\(ctx, true(, auto = true)?\)/.test(cc), "on the GPU twice in 7 days → the CPU (v10.9: for 3 days or until an update, then the GPU again)");
ok(/unexpectedAt = e\.timestamp/.test(rd("ExitWatch.kt")), "ExitWatch remembers the newest unexpected ending, on screen or in the background");
const cl = rd("CrashLog.kt");
ok(/Battery, last 24 h \(now \$\{BatteryGuard\.level\(ctx\)\} %/.test(cl) && /nothing of Attune's ran in the background/.test(cl), "the battery part says the level now, or that nothing ran");
ok(/BatteryGuard\.log\(ctx, "AI reading/.test(rd("MindBg.kt")), "the background notification reader writes to the battery log");
ok(rd("MainActivity.kt").indexOf("ExitWatch.check(this)") < rd("MainActivity.kt").indexOf("FastEngine.checkCrash(this)"), "ExitWatch reads Android's reason before FastEngine checks its mark");
console.log(fail ? `FAIL ${fail}/${n}` : `PASS v1080crashmark ${n}/${n}`); process.exit(fail ? 1 : 0);
