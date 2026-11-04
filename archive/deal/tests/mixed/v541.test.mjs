// Unit tests for v5.41: Ali's phone test after v5.40 — websites, PDF → Word, Deal Check, Chat X-Ray,
// model names in web answers, deck commands.
import { looksLikeWebsiteTask, looksLikeCodeTask } from "../../web-src/verify.js";
import { detectArtifact } from "../../web-src/spaces.js";
import * as C from "../../web-src/convert.js";
import * as D from "../../web-src/deal.js";
import * as X from "../../web-src/chatxray.js";
import { fixModelNames } from "../../web-src/answerfix.js";
import * as S from "../../web-src/slides.js";
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }

// ---- #9/#10 websites go the code route (no anti-repeat sampling), Preview even when the fence isn't closed ----
eq(["A landing page for my crane rental company with services, fleet and a contact form", "اعمل موقع لشركة الأوناش", "make me a website for my shop", "what is a landing page?", "How do websites make money?"].map(looksLikeWebsiteTask),
  [true, true, true, false, false], "a website / landing page to build is recognised (a question about websites is not)");
eq(looksLikeCodeTask("A landing page for my crane rental company with services, fleet and a contact form"), true, "…so it takes the code route (written, run and checked)");
const cut = "Here it is:\n```html\n<!DOCTYPE html><html><head><style>body{margin:0}</style></head><body><div>Cranes</div></body></html>\n";
eq((detectArtifact(cut) || {}).kind, "html", "a page whose closing ``` never came still gets its Preview");

// ---- #5 PDF → Word: headings, numbered lists with their wrapped lines, tables with a centred header, superscripts ----
const L = (y, s, b, ...sp) => ({ y, x: sp[0][0], s, b, sp: sp.map(([x, t]) => [x, t, s, t.split(" ").map((w, i) => [x + i * 30, w])]) });
const page = { lines: [
  L(60, 18, true, [72, "Lab Assignment 3"]),
  L(90, 12, true, [72, "Case 1 — Is Gene X induced?"]),
  L(110, 11, false, [72, "Cells were treated with Drug A and measured by"]),
  L(124, 11, false, [72, "RT-qPCR against a reference gene."]),
  L(150, 11, true, [72, "Sample"], [189, "Ct Gene X"], [290, "Ct Ref"]),
  L(166, 11, false, [76, "Control"], [214, "27.0"], [300, "20.0"]),
  L(182, 11, false, [76, "Drug A"], [214, "24.0"], [300, "20.0"]),
  L(210, 11, true, [72, "Questions"]),
  L(228, 11, false, [90, "1. Calculate the fold change using 2^(−ΔΔCt)."]),
  L(242, 11, false, [90, "2. Suppose the reference gene rises fourfold after"]),
  L(256, 11, false, [104, "treatment. How does this change the conclusion?"]),
] };
const pb = C.pdfLinesToBlocks([page]);
eq(pb.map((b) => b.type), ["h1", "h3", "p", "table", "h3", "li", "li"], "title, heading, one paragraph, a table, questions as a list");
eq(pb[2].text, "Cells were treated with Drug A and measured by RT-qPCR against a reference gene.", "wrapped lines of a paragraph are joined");
eq(pb[3].rows, [["Sample", "Ct Gene X", "Ct Ref"], ["Control", "27.0", "20.0"], ["Drug A", "24.0", "20.0"]], "the table keeps its bold header row, 3 columns");
eq([pb[5].num, pb[6].num, pb[6].text], ["1", "2", "Suppose the reference gene rises fourfold after treatment. How does this change the conclusion?"], "numbered questions keep their numbers and their second line");
const dz = await C.unzip(C.docxFromBlocks(pb, "T"));
const doc = new TextDecoder().decode(dz.get("word/document.xml"));
eq([/<w:tbl>/.test(doc), /1\.\t/.test(doc), /<w:vertAlign w:val="superscript"\/><\/w:rPr><w:t xml:space="preserve">−ΔΔCt<\/w:t>/.test(doc)], [true, true, true], "Word: a real table, “1.” numbering, 2^(−ΔΔCt) as a superscript");

// ---- #6 Deal Check: installment plans read by code ----
const offer = `iPhone 15 Pro 256GB, like new, 38,000 EGP, deposit on Vodafone Cash to hold it "12,400 EGP or 3 × 4,133 with valU"`;
const plan = D.plansIn(offer)[0];
eq([plan.months, plan.monthly, plan.cash], [3, 4133, 12400], "“12,400 or 3 × 4,133” = cash 12,400 OR 3 payments (not a down payment plus 3)");
const pc = D.planCost({ cash: plan.cash, down: 0, monthly: plan.monthly, months: plan.months });
eq([pc.total, pc.yearlyRate], [12399, 0], "3 × 4,133 = 12,399 — a real 0%");
eq(D.priceMismatch(offer, plan), { hi: 38000, lo: 12400 }, "two very different prices in one offer are noticed");
eq(D.planCost({ cash: 38000, down: 12400, monthly: 4133, months: 3 }).inconsistent, true, "a plan cheaper than cash is flagged as misread, never shown as −13,201");
eq(["4,133 a month for 12 months", "12 installments of 4,133 EGP", "قسط 4133 جنيه على 12 شهر", "down payment 5,000 then 2,000 × 10"].map((t) => { const p = D.plansIn(t)[0]; return p ? [p.months, p.monthly, p.down] : null; }),
  [[12, 4133, null], [12, 4133, null], [12, 4133, null], [10, 2000, 5000]], "other ways of writing a plan (English and Arabic)");

// ---- #4 Chat X-Ray: "what was it about?" and "was X mentioned?" ----
eq(["What was the conversation about", "ملخص الشات", "was “LTM 1100” mentioned?", "هل اتقال \"العربون\"؟", "did anyone mention the deposit?", "What price did we agree?"].map(X.askKind),
  ["about", "about", "mention", "mention", "mention", "other"], "question kinds");
eq(X.mentionTerm("did anyone mention the deposit?"), "deposit", "the phrase to look for");
const msgs = [{ i: 1, t: Date.parse("2026-09-01"), who: "Hassan", text: "Send the عربون today" }, { i: 2, t: Date.parse("2026-09-03"), who: "Ali", text: "The LTM 1100 is free" }, { i: 3, t: Date.parse("2026-09-05"), who: "Hassan", text: "ok, the ltm 1100 then" }];
const hits = X.findMentions(msgs, "LTM 1100");
eq([hits.length, X.mentionAnswer("LTM 1100", hits, 3, false)], [2, "Yes — “LTM 1100” was mentioned 2 times: first on 2026-09-03 by Ali, last on 2026-09-05 by Hassan. Said by: Ali, Hassan."], "was X mentioned — answered by code, with who and when");
eq(X.findMentions(msgs, "العربون").length, 1, "Arabic spelling (with or without ال) found");
eq(X.mentionAnswer("crane oil", [], 3, false), "No — “crane oil” doesn't appear anywhere in this chat (all 3 messages checked).", "…and a clear no");
const many = Array.from({ length: 300 }, (_, k) => ({ i: k + 1, t: k * 1000, who: k % 2 ? "A" : "B", text: "message number " + k + " about " + (k < 150 ? "cranes and prices" : "the new office") }));
const smp = X.overviewSample(many, 3000);
eq([smp.length > 10, smp[0].i < 40, smp[smp.length - 1].i > 260], [true, true, true], "the overview reads messages from the start to the end of the chat");

// ---- #8 web answers: the model name's number put back ----
const src = [{ title: "Lynk & Co 900 review", text: "The Lynk & Co 900 is a plug-in hybrid SUV. Lynk & Co 900 prices start at 259,900 yuan. The Lynk & Co 09 is older. Liebherr LTM 1100-5.2 lifts 100 t." }];
eq(fixModelNames("The Lynk & Co 90 is a plug-in hybrid SUV. The Lynk & Co 09 was earlier.", "Lynk and co 900", src).text, "The Lynk & Co 900 is a plug-in hybrid SUV. The Lynk & Co 09 was earlier.",
  "“Lynk & Co 90” → 900 (the question and sources say 900); the real older 09 stays");
eq(fixModelNames("The LTM 110 lifts 100 t.", "Liebherr LTM 1100 capacity", src).text, "The LTM 1100 lifts 100 t.", "LTM 110 → LTM 1100");
eq(fixModelNames("In 90 days the model 90 sold.", "Lynk and co 900", src).fixed, [], "no false fixes on ordinary numbers");

// ---- #1 change a deck by a sentence ----
eq(["delete slide 5", "امسح الشريحة ٥", "move slide 6 to 3", "slide 4: shorter, add prices", "خلي الشريحة 3 جدول", "add a slide about safety after slide 5", "change the title to Crane Rentals 2027", "make every slide more detailed"].map((c) => S.parseDeckCommand(c).ops[0]),
  [{ op: "delete", at: 5 }, { op: "delete", at: 5 }, { op: "move", at: 6, to: 3, after: false }, { op: "rewrite", at: 4, ask: "shorter, add prices", kind: null }, { op: "rewrite", at: 3, ask: "جدول", kind: "table" },
   { op: "add", topic: "safety", after: 5, kind: null }, { op: "title", text: "Crane Rentals 2027" }, { op: "rewrite", at: "all", ask: "make every slide more detailed", kind: null }], "deck commands in English and Arabic");
eq(S.parseDeckCommand("dark blue theme with push transitions"), { ops: [], style: { theme: "midnight", transition: "push" } }, "a design-only command changes no words");

if (fails.length) { console.log(`\n${fails.length} FAILED`); process.exit(1); } else console.log("\nALL PASSED");
