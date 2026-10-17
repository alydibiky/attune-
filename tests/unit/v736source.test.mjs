// v6.32 a "from your data / pack / web / calculated" label on every Chat answer.
import { answerSources, sourceLine } from "../../web-src/sourcelabel.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const A = (x) => ({ role: "assistant", text: "answer", ...x });
ok(answerSources(A({})).join() === "model", "nothing behind it → the model's own knowledge");
ok(answerSources(A({ sources: [{ url: "https://a.com", title: "A" }] })).join() === "web", "web pages → the web");
ok(answerSources(A({ sources: [{ url: "note-1" }] })).join() === "model", "a source that is not a web page does not count as the web");
ok(answerSources(A({ kchips: [{ title: "Quran" }] })).join() === "pack", "a knowledge pack");
ok(answerSources(A({ calc: true })).join() === "calc" && answerSources(A({ verified: { code: "x" } })).join() === "calc", "the calculator and a program that was run → calculated");
ok(answerSources(A({ fromFile: "a.pdf", knowledgeUsed: 2, sources: [{ url: "http://x" }], computed: 1 })).join() === "file,pack,web,calc", "several, in order");
ok(answerSources(A({ learnedUsed: 1 })).join() === "data", "what you taught it → your data");
ok(answerSources({ role: "assistant", card: { title: "x" }, text: "" }).length === 0 && answerSources({ role: "user", text: "hi" }).length === 0, "no label on cards or your own messages");
ok(sourceLine(A({ calc: true, sources: [{ url: "https://x" }] })) === "From: the web · calculated on this phone", "the line people read");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
