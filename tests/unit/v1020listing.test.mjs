// v10.2 L1 (Ali OK'd: "it should still redirect me to the right listing — I don't want to open the product in search and search again"):
// Attune checks that the page it landed on IS the offer before keeping its address; "Open" goes there; never a search page.
import { execFileSync } from "child_process";
import fs from "fs";
import * as LS from "../../web-src/listing.js";
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { console.log("FAIL " + m); fail++; } };
const o = { name: "HUAWEI FreeClip 2", price: 7400, currency: "EGP", site: "Amazon", url: "https://www.amazon.eg/s?k=freeclip+2", key: "a" };
const page = { url: "https://www.amazon.eg/-/en/dp/B0DJ7KXK7Q?ref=sr_1_1&qid=1", canonical: "https://www.amazon.eg/dp/B0DJ7KXK7Q", name: "HUAWEI FreeClip 2 Open-Ear Earbuds, Dual-Driver, Black", price: 7400, currency: "EGP", many: 0 };
const r = LS.verifyListing({ what: "Huawei FreeClip 2" }, o, page);
ok(r.ok && r.url === "https://www.amazon.eg/dp/B0DJ7KXK7Q", "his FreeClip 2 on Amazon → the clean listing address: " + JSON.stringify(r));
ok(!LS.verifyListing({}, o, { ...page, name: "HUAWEI FreeClip Open-Ear Earbuds, Black" }).ok, "the first FreeClip (no 2) is not his offer");
ok(!LS.verifyListing({}, o, { ...page, name: "Silicone Case for HUAWEI FreeClip 2, Pink", price: 350 }).ok, "a case FOR it is not it");
ok(LS.verifyListing({}, o, { ...page, url: "https://www.amazon.eg/s?k=freeclip", canonical: "", many: 24 }).why === "results", "a results page is never kept");
ok(LS.verifyListing({}, o, { ...page, price: 9100 }).why === "other price", "another seller's price is not this offer");
const hotel = { name: "Swissôtel Al Maqam Makkah", price: 41495, currency: "SAR", checkin: "2026-12-12", checkout: "2026-12-15" };
const hr = LS.verifyListing({ fields: { hotel: true }, url: "https://www.booking.com/searchresults.html?ss=Makkah&group_adults=2" }, hotel, { url: "https://www.booking.com/hotel/sa/swissotel-al-maqam-makkah.html", name: "Swissôtel Al Maqam Makkah (updated prices 2026)", many: 0 });
ok(hr.ok && hr.url.includes("checkin=2026-12-12") && hr.url.includes("group_adults=2"), "a hotel keeps his dates and guests in the address: " + hr.url);
ok(!LS.verifyListing({ fields: { hotel: true } }, hotel, { url: "https://www.booking.com/hotel/sa/swissotel-makkah.html", name: "Swissôtel Makkah", many: 0 }).ok, "the hotel next door (Swissôtel Makkah) is not his");
const a = { id: "x", best3: [o, { ...o, key: "b", site: "noon", price: 7650 }] };
const m = LS.markVerified(a, o, r, 1000);
ok(m.best3[0].verified && m.best3[0].verified.url === r.url && m.best3[0].href === r.url && !m.best3[1].verified, "the check is kept on THAT offer only");
ok(LS.toVerify(m).map((x) => x.key).join() === "b", "an offer checked at its price is not checked again");
// the phone: check mode in the browser, the kit reads the page, Open never falls back to a search page
const kt = fs.readFileSync(new URL("../../app/src/main/java/com/aldibiki/attune/AgentBrowser.kt", import.meta.url), "utf8");
const nb = fs.readFileSync(new URL("../../app/src/main/java/com/aldibiki/attune/NativeBridge.kt", import.meta.url), "utf8");
const kit = fs.readFileSync(new URL("../../web-src/agent-kit.js", import.meta.url), "utf8");
const ui = fs.readFileSync(new URL("../../web-src/agents-ui.jsx", import.meta.url), "utf8");
ok(/resolveMode = intent\.getBooleanExtra\("resolve"/.test(kt) && /if \(resolveMode\) gotoFallback = ""/.test(kt) && /"product" -> if \(resolveMode\)/.test(kt), "AgentBrowser: check mode, no search fallback, reads the product");
ok(/putExtra\("resolve"/.test(nb), "the bridge passes check mode");
ok(/const product = \(\) =>/.test(kit) && /hrefOf, product \}/.test(kit), "the kit reads the product page");
ok(/R\.listingKind\(how\.fallback\) !== "no" \? how\.fallback : ""/.test(ui), "when the page can't be confirmed, Attune's browser taps through — never a search address as the fallback");
const run = (env = {}) => +((/\(([\d.]+)%\)/.exec(execFileSync("node", [new URL("../listing/verify.mjs", import.meta.url).pathname, "2500"], { env: { ...process.env, ...env }, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })) || [])[1] || 0);
const a0 = run(), h0 = run({ HELDOUT: "1" });
ok(a0 === 100, "10,000 'is this the offer?' checks, 2,500 sample: " + a0 + "%"); ok(h0 >= 99, "held-out, 2,500 sample: " + h0 + "% (the mark: 99%)");
console.log(fail ? `FAIL ${fail} of ${n}` : `ALL PASSED (${n} checks)`);
process.exit(fail ? 1 : 0);
