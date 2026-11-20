// v10.8 (launch: "read every Arabic screen"): the app's name is "Attune" everywhere in Arabic (Ali's pick, 2 Nov) — only the spoken
// wake word stays «يا أتيون»; one word for paste («الصق»); family reminders are «تذكيرات» (not «تفكير» = thinking); no removed
// feature (Studio) in the device levels.
const AR = (await import("../../web-src/i18n-ar.js")).AR, ARB = (await import("../../web-src/i18n-arb.js")).ARB;
import fs from "fs";
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { console.log("FAIL " + m); fail++; } };
for (const [nm, d] of [["ar", AR], ["arb", ARB]]) {
  const bad = Object.entries(d).filter(([k, v]) => /أتيون/.test(v) && !/يا أتيون/.test(v) && !/Ya Attune|Hey Attune|wake/i.test(k));
  ok(!bad.length, nm + ": «أتيون» only in the wake word: " + bad.slice(0, 3).map((x) => x[1].slice(0, 50)).join(" | "));
}
ok(!Object.values(AR).some((v) => /الزق/.test(v)), "ar: «الصق», never «الزق»");
ok(!Object.values(AR).some((v) => /تفكير ل(ل|و|ح)/.test(v)), "ar: family reminders are «تذكيرات»");
ok(AR["Your week"] === "أسبوعك", "ar: «أسبوعك» with its hamza");
ok(!/Studio/.test(fs.readFileSync(new URL("../../web-src/device.js", import.meta.url), "utf8").match(/what: "[^"]*"/g).join()), "device levels don't mention Studio (archived)");
const dl = fs.readFileSync(new URL("../../web-src/safespend-ui.jsx", import.meta.url), "utf8");
ok(/toLocaleDateString\(dateLocale\(\)/.test(dl), "safe-to-spend dates are in the app's language («٣٠ نوفمبر», not “Nov 30”)");
const und = fs.readdirSync(new URL("../../web-src/", import.meta.url)).filter((f) => /-ui\.jsx$|^chat\.jsx$/.test(f)).filter((f) => /toLocale(?:Date|Time)String\(undefined/.test(fs.readFileSync(new URL("../../web-src/" + f, import.meta.url), "utf8")));
ok(!und.length, "no screen draws a date in the phone's language instead of the app's: " + und.join(", "));
console.log(fail ? `FAIL ${fail}/${n}` : `PASS ${n}/${n}`); process.exit(fail ? 1 : 0);
