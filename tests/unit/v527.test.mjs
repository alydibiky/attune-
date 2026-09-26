// Unit tests for v5.27: every message gets answered, however long.
import { estTokens, charsPerToken, fitChars, tooLong, splitParts, requestOf, partNotesMessages, fromNotes, continueMessages, glue } from "../../web-src/longread.js";
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }

const en = "The crane lifted the load safely. ".repeat(300), ar = "الونش رفع الحمولة بأمان تام. ".repeat(300);
eq(estTokens(ar) / ar.length > estTokens(en) / en.length, true, "Arabic counts as more tokens per character than English");
eq(charsPerToken(ar) < charsPerToken(en), true, "…so fewer Arabic characters fit");
eq(fitChars(32768, 8192) > 3 * fitChars(8192, 2048) - 1, true, "a 32k window fits far more than an 8k one");
eq([tooLong("short question", 8192, 2048), tooLong(en.repeat(10), 8192, 2048)], [false, true], "a short message goes straight through; a 100k-character one is read in parts");

const big = Array.from({ length: 60 }, (_, i) => "Paragraph " + (i + 1) + ": " + "details about crane maintenance and costs. ".repeat(20)).join("\n\n");
const parts = splitParts(big, 5000);
eq(parts.every((p) => p.length <= 5000), true, "every part fits the size");
eq(parts.join("\n\n").replace(/\s+/g, " ").length >= big.replace(/\s+/g, " ").length - parts.length * 2, true, "nothing is lost between parts");
eq(parts[0].startsWith("Paragraph 1:") && parts[parts.length - 1].includes("Paragraph 60:"), true, "parts keep the original order");
const oneLine = "word ".repeat(5000);
eq(splitParts(oneLine, 3000).every((p) => p.length <= 3001), true, "even one giant line without breaks is split");

const msg = "Please summarise this contract and list every payment date.\n" + "x ".repeat(5000) + "\nFocus on penalties.";
const rq = requestOf(msg);
eq(rq.startsWith("Please summarise") && rq.endsWith("Focus on penalties.") && rq.length < 1600, true, "the request is taken from the start and the end of a long message");
eq(requestOf("short one"), "short one", "…a short one is kept whole");
const pn = partNotesMessages("list payment dates", "part text", 2, 5);
eq(pn[1].content.includes("PART 2 OF 5") && /copied exactly/.test(pn[0].content) && /NONE/.test(pn[0].content), true, "each part is read for the request, numbers copied exactly");
eq(/file "a\.txt" \(3 parts\)/.test(fromNotes("r", "n", 3, "a.txt")) && /do the request completely/.test(fromNotes("r", "n", 3)), true, "the answer is written from the notes of every part");

const answer = "START " + "middle text ".repeat(500) + "LAST WORDS";
const cm = continueMessages("SYS", "question?", answer, false);
eq(cm[2].content.endsWith("LAST WORDS") && !cm[2].content.includes("START"), true, "continuing, the model sees the END of its answer (not the start)");
eq([cm[0].role, cm[1].role, cm[2].role, cm[3].role], ["system", "user", "assistant", "user"], "…in a proper conversation");
eq(/كمّل/.test(continueMessages("", "q", "نص", true).pop().content), true, "…and is asked in Arabic for an Arabic answer");
eq([glue("Hello", "world"), glue("Hello ", "world"), glue("Hello", ", world"), glue("line\n", "next")], ["Hello world", "Hello world", "Hello, world", "line\nnext"], "continuations join without doubled or missing spaces");

console.log(fails.length ? fails.length + " FAILED" : "ALL PASSED");
if (fails.length) process.exit(1);
