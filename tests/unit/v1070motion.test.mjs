// v10.7 — Ali OK'd OK-AN (lively motion: a tick pops and the row slides away; pages slide in), "make to-do lists editable easily"
// (tap the words), OK-WR (the Writing page: tabs, versions, "For which AI like ChatGPT or Gemini" — Attune itself picks the engine)
// and OK-FO (an unfolded foldable gets the computer's layout with a rail). Source checks; the real page is tests/e2e_v1070.py.
import fs from "fs";
const rd = (f) => fs.readFileSync(new URL("../../web-src/" + f, import.meta.url), "utf8");
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { console.log("FAIL " + m); fail++; } };
const motion = rd("motion.js"), lists = rd("lists-ui.jsx"), app = rd("attune.jsx"), wr = rd("writing-ui.jsx"), side = rd("side-ui.jsx"), css = rd("build/tw.css");
ok(/prefers-reduced-motion/.test(motion) && /export function tickOut/.test(motion) && /export function pageIn/.test(motion), "motion.js: tickOut + pageIn, and both follow the phone's 'remove animations'");
ok(/setTimeout\(fin, 1000\)/.test(motion), "a tick always saves even if the motion never finishes");
for (const f of ["lists-ui.jsx", "timeline-ui.jsx", "paylog-ui.jsx", "care-ui.jsx"]) ok(/tickOut/.test(rd(f)) && /data-tickrow|data-tickbox/.test(rd(f)), f + ": ticks use the motion");
ok(/onLabel/.test(lists) && /testid \+ "-words"/.test(lists), "to-dos: tapping the words opens the edit");
ok(/pageIn\(/.test(app) && /navDir/.test(app), "pages slide in, back the other way");
ok(/WritingStudio/.test(app) && /TOOLS\)\.map/.test(app), "Write = the new Writing page, every AI from the tools list");
ok(!/model|engine.*choose/i.test(wr.match(/MAIN_AIS = \[[^\]]*\]/)[0]) && /"chatgpt"/.test(wr) && /"gemini"/.test(wr), "For: ChatGPT, Gemini… (which AI the prompt is for, not which model writes)");
ok(!/data-testid="writing-engine"/.test(wr), "no engine picker on the page: Attune picks the best way itself");
ok(/versions\.slice\(-20\)/.test(wr), "the last 20 versions are kept");
// addVersion logic (copied shape)
const addVersion = new Function("words", "return " + wr.match(/export function addVersion[\s\S]*?\n\}/)[0].replace("export ", ""))((t) => (String(t || "").trim().match(/\S+/g) || []).length);
let st = { versions: [] }; st = addVersion(st, { text: " a b c ", tool: "improve", now: 1 }); st = addVersion(st, { text: "a b", tool: "shorten", from: 2, now: 2 });
ok(st.versions.map((v) => v.n).join() === "2,3" && st.versions[0].text === "a b c" && st.versions[1].words === 2 && st.versions[1].from === 2, "versions are numbered after the original (v1) and count words");
ok(/RAIL_Q/.test(side) && /export function SideRail/.test(side) && /min-width: 640px/.test(side), "foldable open (≥640 px): computer layout with a rail");
ok(/att-cq/.test(css) && /att-2col/.test(css), "pages answer their own width (container queries)");
for (const l of ["ar", "arb", "es", "fr", "de", "pt", "it", "ru", "tr", "id", "hi", "ur", "fa", "bn", "sw", "th", "vi", "zh", "ja", "ko"]) {
  const s = rd("i18n-" + l + ".js");
  for (const k of ["Improve for {a}", "Keep going from v{n}", "Write my next prompt for {a}", "Clear the versions", "Tick", "Untick"]) ok(s.includes(JSON.stringify(k) + ":"), l + " has “" + k + "”");
}
console.log(fail ? `FAIL ${fail}/${n}` : `PASS ${n}/${n}`); process.exit(fail ? 1 : 0);
