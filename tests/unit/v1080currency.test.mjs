// v10.8 (found making the store screenshots): an English (US) phone in Egypt with every account in EGP showed Money as "0 USD".
// With no currency set in Money and no country chosen, the person's own accounts decide (most of them), before the phone's region.
globalThis.localStorage = { _: {}, getItem(k) { return this._[k] ?? null; }, setItem(k, v) { this._[k] = v; }, removeItem(k) { delete this._[k]; } };
const { homeCurrency } = await import("../../web-src/locale.js");
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { console.log("FAIL " + m); fail++; } };
const A = (...c) => ({ accounts: c.map((x) => ({ currency: x })) });
ok(homeCurrency(A("EGP", "EGP"), "en-US") === "EGP", "all accounts in EGP on a US phone → EGP");
ok(homeCurrency(A("EGP"), "en-US") === "EGP", "one EGP account → EGP");
ok(homeCurrency(A("EGP", "EGP", "USD"), "en-US") === "EGP", "most accounts in EGP → EGP");
ok(homeCurrency(A("EGP", "USD"), "en-US") === "USD", "a tie → the phone's region decides");
ok(homeCurrency(A(), "ar-EG") === "EGP" && homeCurrency(A(), "en-US") === "USD", "no accounts → the phone's region");
ok(homeCurrency({ currency: "SAR", ...A("EGP") }, "en-US") === "SAR", "Money's own setting comes first");
localStorage.setItem("attune:country", "ae"); ok(homeCurrency(A("EGP"), "en-US") === "AED", "the country the person chose comes before the accounts");
console.log(fail ? `FAIL ${fail}/${n}` : `PASS ${n}/${n}`); process.exit(fail ? 1 : 0);
