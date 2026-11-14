// v9.9.36 BG-3 (Ali picked): the model reads notifications with Attune closed. The 10,000 generator on a 2,500 sample, held-out cases,
// and the phone side (MindBg.kt) matching the rules the generator checks.
import { execFileSync } from "child_process";
import fs from "fs";
const B = await import("../../web-src/mindbg.js");
const ok = (c, t) => { console.log((c ? "PASS " : "FAIL ") + t); if (!c) process.exitCode = 1; };
const out = execFileSync("node", [new URL("../bgmind/gen.mjs", import.meta.url).pathname, "2500"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
ok(/2500 cases, 2500 right/.test(out), "2,500 generated cases all right: " + out.split("\n")[0]);
// held-out
ok(B.bgAllowed({ plugged: true, pct: 5, interactive: true }) && !B.bgAllowed({ pct: 41, interactive: true }) && B.bgAllowed({ pct: 41, interactive: false }) && !B.bgAllowed({ pct: 40, interactive: false }) && !B.bgAllowed({ pct: 90, interactive: false, saver: true }), "charging always; 41% screen off yes; 40% no; screen on no; battery saver waits");
const NOW = Date.parse("2026-11-14T22:00:00");
const notes = [{ id: "a", pkg: "com.whatsapp", ts: NOW - 3600e3, title: "Mona", text: "Can you send me your ID photo before Friday?" }, { id: "b", pkg: "com.whatsapp", ts: NOW - 4 * 86400e3, text: "old" }];
ok(B.bgRound(notes, { now: NOW }).map((x) => x.id).join() === "a", "4 days old is not read");
const saved = {}; B.takeBg([{ id: "a", raw: '{"intent":"request","action":"do","who":"Mona","due":"","amount":0}' }], notes, (id, r) => { saved[id] = r; });
ok(!saved.a || saved.a.action === "do", "Mona's request read with Attune closed → a thing to do (when code was unsure)");
const t = B.bgTemplate(notes, NOW);
ok(/Today is \{DATE\}\./.test(t.system) && t.max === 40, "the phone gets the prompt with the day left as {DATE}, and 40 a day");
// the phone side
const kt = fs.readFileSync(new URL("../../app/src/main/java/com/aldibiki/attune/MindBg.kt", import.meta.url), "utf8"), man = fs.readFileSync(new URL("../../app/src/main/AndroidManifest.xml", import.meta.url), "utf8"), nb = fs.readFileSync(new URL("../../app/src/main/java/com/aldibiki/attune/NativeBridge.kt", import.meta.url), "utf8");
ok(/if \(plugged\) return true/.test(kt) && /pct > 40 && !pm\.isInteractive && !pm\.isPowerSaveMode/.test(kt), "MindBg.kt: the same WHEN rule");
ok(/86_400_000L/.test(kt) && /\.take\(minOf\(12, left\)\)/.test(kt) && /optInt\("max", 40\)/.test(kt) && /!in done/.test(kt) && /!in skip/.test(kt), "MindBg.kt: 3 days, 12 a round, 40 a day, never twice, skips the always-sure apps");
ok(/!allowedNow\(ctx\)\) break/.test(kt), "it stops at once when the phone is picked up or unplugged low");
ok(/cancel\(NOTE_ID\)/.test(kt) && /IMPORTANCE_MIN/.test(kt), "a quiet notification while reading, removed after");
ok(/\.MindBgJob"/.test(man) && /fun mindBgSet/.test(nb) && /fun mindBgTake/.test(nb) && /fun mindBgOn/.test(nb), "declared in the manifest; the page can hand over, take back and switch it off");
const ui = fs.readFileSync(new URL("../../web-src/notifmind-ui.jsx", import.meta.url), "utf8"), lb = fs.readFileSync(new URL("../../web-src/lookback-ui.jsx", import.meta.url), "utf8");
ok(/takeBg\(got, recent\(\), saveMind\)/.test(ui) && /mindBgSet/.test(ui) && /bg-thinking-toggle/.test(lb), "the page merges the answers on open, sends the prompt, and Settings has the switch");
