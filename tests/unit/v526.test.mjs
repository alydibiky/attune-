// Unit tests for v5.26: tips and tricks that make every model (especially small ones) better.
import { familyOf, taskKind, samplingFor, compactSystem, HONESTY_RULE, reread, partsOf, everyPart, sandwich } from "../../web-src/boost.js";
import { setPower, getPower } from "../../web-src/power.js";
import { sampleMessages } from "../../web-src/reason.js";
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }

eq([familyOf({ label: "Qwen3.5 2B" }), familyOf({ label: "Gemma 4 E4B" }), familyOf({ label: "Phi" }), familyOf(null)], ["qwen", "gemma", "other", "other"], "the model family is recognised");
eq([taskKind("What is 3 × 45 + 14% VAT?"), taskKind("Write a short poem about cranes"), taskKind("how are you doing today"), taskKind("اكتب قصة قصيرة"), taskKind("مواصفات لينك 900")], ["precise", "creative", "chat", "creative", "precise"], "facts / creative / chat are told apart (Arabic too)");
const q = samplingFor("qwen", 3, "precise"), g = samplingFor("gemma", 3, "chat");
eq([q.top_k, q.top_p, g.top_k, g.top_p], [20, 0.8, 64, 0.95], "each family gets its own recommended top_k / top_p");
eq(samplingFor("qwen", 3, "precise").temperature < samplingFor("qwen", 3, "creative").temperature, true, "facts are sampled tighter than stories");
const sm = samplingFor("gemma", 1, "precise"), big = samplingFor("gemma", 5, "precise");
eq([sm.temperature < big.temperature, sm.min_p > big.min_p, sm.top_k <= 20], [true, true, true], "small models get tighter settings and a higher min_p (fewer junk tokens)");
eq(samplingFor("qwen", 1, "creative").temperature > 0.6, true, "…but stories from a small model still aren't robotic");

const cs = compactSystem("Sat Sep 26 2026");
eq([cs.length < 1700, /Example:/.test(cs), /Never invent/.test(cs), /Egyptian Arabic/.test(cs)], [true, true, true, true], "small models get a short prompt with one example");
eq(/Never invent specifications, prices/.test(HONESTY_RULE) && /out of date/.test(HONESTY_RULE), true, "the honesty rule forbids invented specs and prices");

eq(reread("X", "Is 17 prime?"), "X\n\nRead the question again: Is 17 prime?", "re-reading shows the question once more");
eq(reread("X", "a".repeat(1300)), "X", "…but not a very long one");
const sq = sampleMessages("If a crane lifts 3 t twice, how much in total?");
eq(sq[sq.length - 1].content.includes("Read the question again"), true, "the logic-voting tries re-read the question too");

eq(partsOf("What is the capacity of an LTM 1100? And how much does it cost? Where is it made?").length, 3, "three questions in one message are found");
eq(partsOf("1. rental price\n2. transport cost\n3. operator hours").length, 3, "…and a numbered list of asks");
eq(partsOf("What is the capacity of an LTM 1100?"), [], "a single question isn't split");
eq(partsOf("ما هي قدرة الونش؟ وكام سعره؟").length, 2, "Arabic question marks count");
eq(/Answer EVERY one, in order/.test(everyPart(["a?", "b?"])) && everyPart(["a?"]) === "", true, "several parts → a checklist; one → nothing");

const sw = sandwich("What is the total?", "invoice.txt", "LONG DOCUMENT");
eq(sw.indexOf("What is the total?") < sw.indexOf("LONG DOCUMENT") && sw.lastIndexOf("What is the total?") > sw.indexOf("LONG DOCUMENT"), true, "a long file has the question before AND after it");

setPower({ id: "md", label: "Qwen3.5 4B", ctx: 32768 });
eq(getPower().family, "qwen", "the active model's family is known to the whole app");

console.log(fails.length ? fails.length + " FAILED" : "ALL PASSED");
if (fails.length) process.exit(1);
