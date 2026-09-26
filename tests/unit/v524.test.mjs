// Unit tests for v5.24: the stronger models do more work per answer.
import { capabilitiesOf, powerFor, worthReview, reviewMessages, pickReviewed, REVIEW_SYS } from "../../web-src/power.js";
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }

const [b, s, e, m] = [powerFor(1, 8192), powerFor(3, 32768), powerFor(4, 32768), powerFor(5, 32768)];
eq([b.review, s.review, e.review, m.review], [false, false, true, true], "only Expert and Master review their own drafts");
eq([m.thinkBudget >= 4 * b.thinkBudget, e.thinkBudget >= 3 * b.thinkBudget], [true, true], "strong models think 3–4× longer");
eq([b.votes, m.votes], [3, 5], "logic questions: 5 tries instead of 3");
eq([b.codeRounds, m.codeRounds], [3, 6], "code: up to 6 fix rounds instead of 3");
eq(m.historyChars > 3 * b.historyChars, true, "strong models remember much more of the chat");
eq([b.fileChars, m.fileChars > 50000], [14000, true], "…and read far more of an attached file");
eq(powerFor(5, 8192).fileChars, 14000, "…but a small window stays at what it read before");

const d = "A draft answer. ".repeat(40);
eq([worthReview("How do I size outrigger mats for a 100 t crane on clay?", d), worthReview("hi", d), worthReview("How do I size outrigger mats for a 100 t crane?", "short")], [true, false, false], "a real question with a real draft is reviewed; hello and short answers aren't");
eq(worthReview("thanks, that was very helpful for the whole team", d), false, "a thank-you isn't reviewed");
const good = "PROBLEMS:\n- the total was wrong (3 × 45 = 135, not 125)\n- no safety factor\nFINAL ANSWER:\n" + "Improved answer text. ".repeat(40);
const r = pickReviewed(good, d);
eq([!!r, r && r.problems.length, r && r.text.startsWith("Improved")], [true, 2, true], "the improved answer and the list of fixes are read from the review");
eq(pickReviewed("**FINAL ANSWER:**\n" + "Improved answer text. ".repeat(40), d) !== null, true, "…also when the model bolds the heading");
eq(pickReviewed("PROBLEMS:\n- none\nFINAL ANSWER:\n" + "Improved answer text. ".repeat(40), d).problems, [], "\"none\" → no fixes listed");
eq(pickReviewed("Looks good to me.", d), null, "no FINAL ANSWER → the draft stays");
eq(pickReviewed("FINAL ANSWER:\nShort.", d), null, "a much shorter rewrite → the draft stays");
eq(/recompute/i.test(REVIEW_SYS) && /edge cases/.test(REVIEW_SYS), true, "the reviewer recomputes numbers and looks for edge cases");
eq(reviewMessages("Q?", "D")[1].content.includes("DRAFT ANSWER:\nD"), true, "the reviewer sees the question and the draft");

eq([powerFor(5, 131072).fileChars > 250000, powerFor(5, 131072).longContext, powerFor(5, 32768).longContext], [true, true, undefined], "a 131k-window model reads a whole book; a 32k one doesn't claim to");
const cx = (t) => capabilitiesOf(t).filter((c) => c.strong).length;
eq([cx({ id: "xs", label: "a" }), cx({ id: "moe-xl", label: "b", ctx: 32768 }) >= 8], [0, true], "the strongest models list far more expert abilities than the smallest");
eq(capabilitiesOf({ id: "moe-xl-long", label: "c", ctx: 131072 }).some((c) => /whole book/.test(c.t)), true, "Maestro Long says it reads a whole book");

console.log(fails.length ? fails.length + " FAILED" : "ALL PASSED");
if (fails.length) process.exit(1);
