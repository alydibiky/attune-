// v10.8 (Ali, 21 Nov 2026: "read every line of the 18 languages other than Arabic"): what the full read found, kept from coming back.
//   · a batch that slipped by one line (Japanese: every Cancel button read «言い方が違いますか？ 修正する →») or two lines swapped (Bengali:
//     Cancel read «সংশোধন সেভ করুন» "Save the correction") — none of the app's 300 most-used lines may sit in a shifted run, in any language
//   · one English word, two meanings: "From" / "To" of a date or time range, of a transfer, of an e-mail ("From§range" …) — Egyptian showed
//     «المصدر» ("the source") above the Money date filter, Japanese «到着地» ("arrival place") above an e-mail's address
//   · single wrong words: "Later" as «뒤로» (Back) / «後ろへ» / «靠后» / «ถัดไป» (Next), "{n} late" as "{n} doses late"
import fs from "fs";
const W = new URL("../../web-src/", import.meta.url).pathname;
const { deep } = await import("../../tools/i18n/deep.mjs");
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { console.log("FAIL " + m); fail++; } };
const LANGS = ["ar", "arb", "es", "fr", "de", "pt", "it", "ru", "tr", "id", "hi", "ur", "fa", "bn", "sw", "th", "vi", "zh", "ja", "ko"];
const D = {}; for (const l of LANGS) D[l] = Object.values(await import(`${W}i18n-${l}.js`)).find((v) => v && typeof v === "object" && Object.keys(v).length > 50);
// the most-used lines in the code
const cnt = new Map();
for (const f of fs.readdirSync(W).filter((f) => /\.(jsx?|mjs)$/.test(f) && !/^i18n/.test(f))) for (const m of fs.readFileSync(W + f, "utf8").matchAll(/\b(?:tr|T)\("((?:[^"\\]|\\.){1,40})"/g)) cnt.set(m[1], (cnt.get(m[1]) || 0) + 1);
const TOP = new Set([...cnt].sort((a, b) => b[1] - a[1]).slice(0, 300).map((x) => x[0]));
const shifted = await deep(null, "shifted");
for (const [l, probs] of Object.entries(shifted)) { const hit = probs.filter(([, en]) => TOP.has(en)); ok(!hit.length, `${l}: a most-used line in a shifted run — ${hit.slice(0, 2).map((p) => p[1] + " → " + p[2]).join(" | ")}`); }
for (const l of ["ar"]) { const r = await deep(l, "shifted"); const hit = (r[l] || []).filter(([, en]) => TOP.has(en)); ok(!hit.length, `${l}: a most-used line in a shifted run`); }
// the exact lines that were wrong
ok(D.ja.Cancel === "キャンセル" && D.ja["Not how you'd put it? Correct it →"].startsWith("言い方") && D.ja["Deep answer"] === "じっくり回答", "Japanese block 1708–1725 back in place");
ok(D.bn.Cancel === "বাতিল" && D.bn["Save the correction"].includes("সংশোধন"), "Bengali Cancel / Save the correction no longer swapped");
ok(D.bn["e.g. the taxi driver won't turn the meter on, what do I say? / is this price fair for a carpet? / can I drink the tap water?"].startsWith("যেমন"), "Bengali Know-tab lines no longer swapped");
ok(D.zh["Printed on the load chart (often 9.8 m/s)."].includes("9.8"), "Chinese load-chart line is a sentence, not «幅度»");
ok(!/[؀-ۿ]/.test(D.hi.Assiut), "Hindi Assiut has no Arabic letters");
for (const [l, bad] of [["ko", "뒤로"], ["ja", "後ろへ"], ["zh", "靠后"], ["th", "ถัดไป"], ["vi", "Xuống sau"], ["tr", "Sona al"], ["id", "Lebih akhir"]]) ok(D[l].Later !== bad, `${l}: "Later" is not ${bad}`);
ok(!/剂|liều/.test(D.zh["{n} late"] + D.vi["{n} late"]), "\"{n} late\" (late to-dos) is not \"{n} doses late\"");
// one word, two meanings — every language has each meaning, and English still shows the word
for (const k of ["From§range", "To§range", "From§account", "To§account", "To§email", "To (city or code)"]) for (const l of LANGS) ok(typeof D[l][k] === "string" && D[l][k] && !D[l][k].includes("§"), `${l}: ${k}`);
ok(D.ar["From§range"] === "من" && D.ja["To§email"] === "宛先" && D.de["To§range"] === "Bis", "the range / e-mail meanings are the right words");
const i18n = await import("../../web-src/i18n.js");
ok(i18n.tr("From§range") === "From" && i18n.tr("To§email") === "To", "English shows the word without its tag");
for (const [f, re] of [["money-calm-ui.jsx", /tr\("From§range"\)[^]*tr\("To§range"\)/], ["weekplan-ui.jsx", /tr\("From§range"\)/], ["money-pages-ui.jsx", /tr\("To§account"\)/], ["email-ui.jsx", /tr\("To§email"\)/]])
  ok(re.test(fs.readFileSync(W + f, "utf8")), `${f} uses the meaning it shows`);
console.log(fail ? `FAIL ${fail}/${n}` : `PASS ${n}/${n}`);
process.exit(fail ? 1 : 0);
