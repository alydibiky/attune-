// Unit tests for v6.10: exact-length writing rules (Ali: "exactly 17 words, the 17th word must be 'seventeen'").
import { rulesOf, violations, enforce } from "../../web-src/constraints.js";
import { createRequire } from "module";
const { parsePayment } = createRequire(import.meta.url)("../../web-src/yusr/paytext.js");
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }

const q = "Write a coherent response that contains exactly 17 words. The 17th (last) word must be 'seventeen'. No preamble, notes or explanations — only the text.";
const r = rulesOf(q);
eq([r.totalWords, r.lastWord, r.nthWord], [17, "seventeen", { n: 17, word: "seventeen" }], "exactly 17 words + 17th (last) word 'seventeen'");
eq(violations("This is a short answer with seven words.", r).length > 0, true, "8 words is caught, with the exact count");
eq(violations("This is a short answer with seven words.", r)[0], "it has 8 words, it needs exactly 17", "the message gives the real count");
for (const a of ["This is a short answer with seven words.", "One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen seventeen."]) {
  eq(violations(enforce(a, r), r), [], "enforce() makes it right: " + a.slice(0, 20));
}
eq(rulesOf("Each sentence must contain exactly eight words. Write four sentences.").totalWords, undefined, "'each sentence … eight words' is not a whole-answer rule");
eq(rulesOf("Start with the word 'Hello' and end with 'goodbye'").startsWith, "hello", "starts with");
eq(violations("Hello there, friend.", rulesOf("It must end with 'goodbye'")), ['it must end with "goodbye"'], "ends with is caught");
eq(violations("a\n\nb\n\nc", rulesOf("Write exactly 2 paragraphs")), ["it has 3 paragraphs, not 2"], "paragraph count");
eq(violations("- a\n- b", rulesOf("Give 3 bullet points")), ["it has 2 bullet points, not 3"], "bullet count");
eq(rulesOf("Explain gravity"), null, "no rule, no rules");

// Money (item 12): who it was from is kept, the direction comes from the "+" / "from"
const y = parsePayment("+250 EGP from my cousin Youssef");
eq([y.amount, y.direction, y.currency, y.party, y.relation], [250, "in", "EGP", "Youssef", "cousin"], "+250 EGP from my cousin Youssef → in, Youssef, cousin");
const y2 = parsePayment("استلمت 250 جنيه من ابن عمي يوسف");
eq([y2.direction, y2.party, y2.relation], ["in", "يوسف", "ابن عمي"], "Arabic: من ابن عمي يوسف");
eq(parsePayment("You received 500 EGP from Mohamed Ali via InstaPay").party, "Mohamed Ali", "a bank text still reads its party");

// item 6: "Output strictly as a Markdown table" → only the table
const tq = rulesOf("Compare CAN bus and Automotive 100BASE-T1 Ethernet. Output strictly as a Markdown table.");
eq(tq && tq.onlyTable, true, "'strictly as a Markdown table' is a rule");
const wrap = "Here is the comparison:\n\n| Feature | CAN | 100BASE-T1 |\n|---|---|---|\n| Speed | 1 Mbps | 100 Mbps |\n\nChoose CAN bus if you need cheap.";
eq(violations(wrap, tq).length, 1, "text around the table is caught");
eq(enforce(wrap, tq), "| Feature | CAN | 100BASE-T1 |\n|---|---|---|\n| Speed | 1 Mbps | 100 Mbps |", "enforce() leaves only the table");
eq(violations(enforce(wrap, tq), tq), [], "…and it passes");

eq(parsePayment("remind me tomorrow at 9 to call Ahmed").ok, false, "a reminder is not a payment ('at 9 to call')");
eq(parsePayment("meet Ali at 5 to discuss the quote").ok, false, "'at 5 to discuss' is not a payment");

eq(parsePayment("3 cranes × 4 days × 25,000 EGP + 14% VAT").ok, false, "a sum with '+ 14% VAT' is not a payment");
eq(parsePayment("-80 EGP to the shop").direction, "out", "-80 EGP to the shop → out");

if (fails.length) { console.log(`\n${fails.length} FAILED`); process.exit(1); } else console.log("\nALL PASSED");
