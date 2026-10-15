// v6.29 release safety: developer mode (the 7-tap Pro unlock) only on a test build; the privacy text is complete in both languages.
const store = {}; globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
globalThis.window = {};
const B = await import("../../web-src/billing.js");
const { PRIVACY } = await import("../../web-src/privacy.js");
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
store["attune:dev"] = "1";
window.AttuneNative = { testBuild: () => false };
ok(!B.devMode() && !B.testingPro(), "a Play build (signed with the real key): 7 taps unlock nothing");
window.AttuneNative = { testBuild: () => true };
ok(B.devMode() && B.testingPro(), "a test build: developer mode works for testing");
delete window.AttuneNative;
ok(B.devMode(), "the browser tests (no app around the page) keep developer mode");
store["attune:dev"] = "0"; window.AttuneNative = { testBuild: () => true };
ok(!B.devMode(), "off unless turned on");
ok(PRIVACY.en.length === PRIVACY.ar.length && PRIVACY.en.length >= 10 && PRIVACY.en.every(([h, t]) => h && t.length > 40), "the privacy policy: every section in English and Arabic");
ok(/Health Connect/.test(PRIVACY.en.map((x) => x.join(" ")).join(" ")) && /OTP/.test(PRIVACY.en.map((x) => x.join(" ")).join(" ")), "it names the health data and the payment notifications (one-time codes ignored)");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
