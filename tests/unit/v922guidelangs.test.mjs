// v9.2 round 3: every text of How to use (guide.js, guide-demo.js, guide-areas.js) is in all 20 languages — the i18n audit
// does not read the guide's [English, Arabic] pairs, so the To-dos & lists guide (round 2) went out in English only.
import fs from "fs";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const here = new URL("../../web-src/", import.meta.url).pathname;
const en = new Set();
const walk = (x) => { if (Array.isArray(x)) { if (x.length === 2 && typeof x[0] === "string" && typeof x[1] === "string" && /[؀-ۿ]/.test(x[1]) && /[A-Za-z]/.test(x[0])) en.add(x[0]); else x.forEach(walk); } else if (x && typeof x === "object") Object.values(x).forEach(walk); };
for (const m of ["guide.js", "guide-demo.js", "guide-areas.js"]) walk(await import(here + m));
ok(en.size > 500, "the guide's texts are found (" + en.size + ")");
for (const l of ["arb", "es", "fr", "de", "pt", "it", "ru", "tr", "id", "hi", "ur", "fa", "bn", "sw", "th", "vi", "zh", "ja", "ko"]) {
  const s = fs.readFileSync(here + "i18n-" + l + ".js", "utf8");
  const miss = [...en].filter((k) => !s.includes(JSON.stringify(k) + ":"));
  ok(!miss.length, l + ": every guide text translated" + (miss.length ? " — missing " + miss.length + ": " + miss[0].slice(0, 60) : ""));
}
