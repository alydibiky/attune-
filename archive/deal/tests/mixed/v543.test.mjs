// Unit tests for v5.43: a website cut off mid-page is finished; Deal Check asks "do you mean…?";
// slides keep only figures the sources have and never repeat a point.
import { workLoop, isCutHtml, joinCont } from "../../web-src/code.js";
import * as D from "../../web-src/deal.js";
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

// ---- Deal Check: "do you mean…?" ----
const t1 = { item: "iPhone 15 Pro", price: 38000, cash: 38000, currency: "EGP", down: 12400, monthly: 4133, months: 3, unclear: "" };
eq(!!D.needsConfirm(t1, "iPhone 15 Pro 38,000 EGP, 12,400 then 3 × 4,133", null), true, "installments that add up to less than cash → ask first");
eq(D.readingOf(t1, "en"), "Do you mean: iPhone 15 Pro for 38,000 EGP cash, or in installments: 12,400 EGP down + 3 × 4,133 EGP (24,799 EGP in total)?", "the reading shown back in one sentence");
eq(D.readingOf(t1, "ar").startsWith("قصدك: iPhone 15 Pro بسعر 38,000 EGP كاش"), true, "…and in Arabic");
eq(D.needsConfirm({ item: "iPhone", price: 18000, currency: "EGP", unclear: "" }, "iPhone 15 Pro 256GB, only 18,000 EGP! Send 2,000 EGP deposit on Vodafone Cash", null), null, "a clear price with a deposit → no question");
eq(D.needsConfirm({ item: "iPhone", price: 18000, currency: "EGP", unclear: "" }, "ايفون ١٨٠٠٠ جنيه وعربون 2000 جنيه", null), null, "…in Arabic too (عربون)");
eq(!!D.needsConfirm({ item: "iPhone", price: 18000, currency: "EGP", unclear: "" }, "iPhone 15 Pro 18,000 EGP. Price 45,000 EGP", null), true, "two different prices → ask");
eq(!!D.needsConfirm({ item: "car", price: null, currency: null, unclear: "" }, "nice car, call me", null), true, "no price at all → ask");
eq(D.needsConfirm({ item: "TV", price: 20000, currency: "EGP", unclear: "Is the 500 fee paid once or monthly?" }, "TV 20,000 EGP", null).en, "Is the 500 fee paid once or monthly?", "the model's own question is used when it saw two readings");
eq(D.parseTerms('{"item":"TV","price":20000,"unclear":"Is the fee monthly?"}').unclear, "Is the fee monthly?", "the reading carries the model's question");
eq(/trust this over the offer's wording: 12,400 is the down payment/.test(D.withClarification("offer", "12,400 is the down payment")), true, "the buyer's explanation goes with the offer for the second reading");

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
