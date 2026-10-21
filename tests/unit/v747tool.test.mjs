// v6.47 (VISION phase 5): a page carries its own checks in <script type="text/attune-test">. They are counted, required to
// pass (the pass mark) and run only in the test run — the preview and a saved page leave them inert.
globalThis.localStorage = { getItem() { return null; }, setItem() {} };
const { htmlDoc } = await import("../../web-src/sandbox.js");
const { countTests, judge, PASS_MARK } = await import("../../web-src/code.js");
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log("FAIL", m); } else console.log("ok  ", m); };
const page = `<!doctype html><html><body><input id="a"><b id="t">0</b><script type="text/attune-test">fill("#a","2");assertEqual(text("#t"),4,"double");assert(exists("#t"),"there");</script></body></html>`;
ok(countTests(page, "html") === 2, "two checks counted in the page");
ok(countTests("<html><body>no checks</body></html>", "html") === 0, "a page without checks: 0");
const shown = htmlDoc(page, "tok");
ok(shown.includes('type="text/attune-test"') && !shown.includes("__attuneTests"), "the preview / saved page: the checks stay inert");
const test = htmlDoc(page, "tok", { test: true });
ok(!test.includes('type="text/attune-test"') && test.includes("__attuneTests") && test.includes(PASS_MARK), "the test run: the checks become a function the runner calls, then the pass mark");
ok(judge({ ok: true, errors: [], stdout: "" }, page, "html").passed === false, "checks present but no pass mark → not passing");
ok(judge({ ok: true, errors: [], stdout: PASS_MARK }, page, "html").passed === true, "the pass mark → passing");
ok(judge({ ok: false, errors: ["Test failed: double — expected 4, got 2"], stdout: "" }, page, "html").passed === false, "a failed check → not passing");
ok(judge({ ok: true, errors: [], stdout: "" }, "<html><body>x</body></html>", "html").passed === true, "a page without checks: loading cleanly is enough (as before)");
console.log(fails ? fails + " FAILED" : "ALL PASSED"); process.exit(fails ? 1 : 0);
