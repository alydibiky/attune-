// v9.4: the APK build broke on `Regex("\b\d…")` in AgentWatch.kt — Kotlin rejects "\d" in an ordinary string, and "\b" there is a
// BACKSPACE, not a word boundary. Every Kotlin string is checked here, so it is caught before CI (raw """…""" strings are fine).
import fs from "fs";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const dir = "app/src/main/java/com/aldibiki/attune/";
const bad = [], backspace = [];
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".kt"))) {
  const src = fs.readFileSync(dir + f, "utf8").replace(/"""[\s\S]*?"""/g, '""');
  src.split("\n").forEach((line, i) => {
    const code = line.replace(/^\s*\/\/.*$/, "");
    for (const m of code.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)) {
      for (const e of m[1].matchAll(/\\(.)/g)) if (!"tbnr'\"\\$u".includes(e[1])) bad.push(f + ":" + (i + 1) + " \\" + e[1]);
      if (/Regex\(\s*$/.test(code.slice(0, m.index)) && /(^|[^\\])\\b/.test(m[1])) backspace.push(f + ":" + (i + 1));
    }
  });
}
ok(!bad.length, "no escape Kotlin rejects in an ordinary string: " + bad.slice(0, 5).join(", "));
ok(!backspace.length, "no backspace \\b inside a Regex(\"…\") — use \"\\\\b\" or a raw string: " + backspace.slice(0, 5).join(", "));
