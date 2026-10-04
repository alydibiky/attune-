// v6.12 — web search: dictionary pages (a poisoned search's answer) are never read; when every page is off-topic
// the reading list says so, so the chat searches again instead of answering from pages about something else.
const R = await import("../../web-src/research.js");
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const Q = "What is the maximum lifting capacity of the Liebherr LTM 1100-4.2?";
const junk = [{ title: "Maximum Definition & Meaning", url: "https://www.merriam-webster.com/dictionary/maximum", text: "maximum: the greatest quantity" }, { title: "MAXIMUM | Cambridge", url: "https://dictionary.cambridge.org/dictionary/english/maximum", text: "maximum meaning" }, { title: "Maxim", url: "https://www.maxim.com/", text: "magazine" }];
const r = R.mergeHits([junk], 5, Q);
ok(!r.some((h) => /merriam|cambridge/.test(h.url)), "dictionary pages are dropped");
ok(r.offTopic === true, "nothing about the Liebherr: the list is marked off-topic (measured on the web benchmark: Bing answered with these)");
const good = [{ title: "Liebherr LTM 1100-4.2 specifications", url: "https://cranemarket.com/specs/liebherr/ltm-1100-4-2", text: "Max capacity 100 t" }];
const r2 = R.mergeHits([junk, good], 5, Q);
ok(r2.length === 1 && !r2.offTopic && /cranemarket/.test(r2[0].url), "with one on-topic page, only it is read");
ok(!R.isJunk("https://www.merriam-webster.com/dictionary/crane", "What does crane mean?") && R.isJunk("https://www.dictionary.com/browse/tall", "How tall is the Cairo Tower?"), "a word-meaning question may still read a dictionary");
console.log(fail ? `${fail} FAILED` : "ALL PASSED");
