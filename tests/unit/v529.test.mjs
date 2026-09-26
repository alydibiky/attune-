// Unit tests for v5.29: the tips library.
import { tipsFor, tipsBlock, TIP_COUNT, TIP_AREAS } from "../../web-src/tips.js";
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }
const has = (q, re, n = 3) => tipsFor(q, n).some((t) => re.test(t));

eq(TIP_COUNT >= 200, true, "at least 200 tips (" + TIP_COUNT + ")");
eq(TIP_AREAS.length >= 20, true, "covering " + TIP_AREAS.length + " areas");
eq(has("3 cranes × 4 days × 12,500 EGP + 14% VAT — total?", /VAT is 14%/), true, "a crane-hire sum gets the Egyptian VAT tip");
eq(has("What should I check on a mobile crane outrigger before a 40 t lift on soft clay?", /Outrigger ground pressure/), true, "an outrigger question gets the ground-pressure tip");
eq(has("Write a formal email to reject a supplier quotation", /email|Formal tone/), true, "an email gets writing tips");
eq(has("ترجم الرسالة دي للتركي", /Translate meaning|Turkish/), true, "an Arabic translation request gets translation tips");
eq(has("اكتب كود بايثون يحسب المتوسط", /runnable code/), true, "an Arabic code request gets coding tips");
eq(has("Lynk & Co 900 all trims hp torque price", /Car prices differ|every trim/), true, "a car question gets car tips");
eq(tipsFor("What should I check on a mobile crane before a lift", 5).some((t) => /For 'what if'/.test(t)), false, "'if' inside 'lift' doesn't call up the what-if tip");
eq(tipsFor("Write a formal email", 5).some((t) => /AI vs general software/.test(t)), false, "'ai' inside 'email' doesn't call up the AI-career tip");
eq(tipsFor("اكتب كود يحسب المتوسط", 5).some((t) => /Symptoms/.test(t)), false, "'الم' inside 'المتوسط' doesn't call up the health tip");
eq(tipsFor("ترجم دي للتركي", 5).some((t) => /1 m³/.test(t)), false, "'لتر' inside 'للتركي' doesn't call up the litres tip");
eq(tipsFor("hi there", 3).length, 1, "a greeting gets one general tip");
eq(tipsFor("crane crane crane outrigger sling wind lift plan", 5).length, 5, "a strong model gets up to 5 tips");
eq(tipsFor("crane outrigger sling wind lift plan", 2).length, 2, "a small model gets 2");
eq(/^\n\n\(Expert tips for this answer:\n- /.test(tipsBlock("VAT on 1000 EGP")), true, "the tips go after the question as a short block");

console.log(fails.length ? fails.length + " FAILED" : "ALL PASSED");
if (fails.length) process.exit(1);
