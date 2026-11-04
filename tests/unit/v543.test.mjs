// Unit tests for v5.43: a website cut off mid-page is finished; Deal Check asks "do you mean…?";
// slides keep only figures the sources have and never repeat a point.
import { workLoop, isCutHtml, joinCont } from "../../web-src/code.js";
import * as S from "../../web-src/slides.js";
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }

// ---- the website that didn't finish ----
const full = '<!doctype html><html><head><title>HeavyLift Crane Rentals</title><style>body{margin:0}.card{padding:12px}</style></head><body><h1>HeavyLift Crane Rentals</h1><section id="fleet"><div class="card">Liebherr LTM 1100</div></section><footer>© HeavyLift</footer></body></html>';
eq([isCutHtml(full.slice(0, 150)), isCutHtml(full), isCutHtml("print('hi')")], [true, false, false], "a page that stops before </html> is recognised as cut");
eq(joinCont(full.slice(0, 150), "```html\n" + full.slice(130) + "\n```"), full, "the continuation is joined without the repeated part or its fence");
eq(joinCont(full.slice(0, 150), full), full, "a model that starts the file again: only the new part is kept");
const answers = ["```html\n" + full.slice(0, 140), full.slice(140, 220), full.slice(220)];
const seen = [];
const r = await workLoop({ task: "a website for HeavyLift Crane Rentals", lang: "html", llm: async (m) => { seen.push(m); return answers.shift(); }, run: async () => ({ ok: true, stdout: "", stderr: "", errors: [] }) });
eq([r.code, seen.length, /Output ONLY the rest/.test(seen[1][0].content)], [full, 3, true], "the loop asks for the rest (twice here) until </html>, then runs the whole page");

// (v9.1: this Deal Check part is archived in archive/deal/tests/mixed/v543.test.mjs)
// ---- slides: accuracy ----
const src = "[1] The Liebherr LTM 1100-5.2 lifts 100 t with a 60 m boom.";
const sl = { kind: "bullets", title: "Specs", bullets: [{ lead: "Capacity", text: "Lifts 100 t" }, { lead: "Boom", text: "Reaches 80 m" }, { lead: "Price", text: "Costs about 2 million euros" }, { lead: "Crew", text: "Needs a trained operator and a banksman" }] };
eq(S.figureIssues(sl, src), ["80", "2"], "numbers not in the sources are found — “2 million” too, not only long numbers");
eq(S.figureIssues(sl, ""), [], "no sources → nothing to check against (flagged instead)");
eq(/NOT in the sources: 80, 2/.test(S.figureFixNote(["80", "2"])), true, "the correction names the wrong numbers");
const td = S.tidySlide(sl, src, ["Crew: Needs a trained operator and a banksman"]);
eq([td.slide.bullets.map((b) => b.lead), td.dropped, td.repeats], [["Capacity"], 2, 1], "made-up figures and a point repeated from an earlier slide are left out");
eq(S.tidySlide({ kind: "bullets", title: "X", bullets: [{ lead: "Boom", text: "80 m" }] }, src, []).slide.bullets.length, 1, "a slide is never emptied by the check (it stays, flagged)");
eq(/every sentence must be true and specific to "Specs"/.test(S.slideMessages({ deckTitle: "D", topic: "t", slide: { kind: "bullets", title: "Specs" }, i: 2, n: 5, others: [], lang: "en" })[0].content), true, "the slide prompt forbids filler and unsure facts");

if (fails.length) { console.log(`\n${fails.length} FAILED`); process.exit(1); } else console.log("\nALL PASSED");
