// v10.0.2 (Ali, 16 Nov 2026: "agents still does not open to the specific listing so fix it for good") — 2,500 samples of the
// 10,000-link generator and of its held-out set, plus the exact cases behind the fix.
import { execFileSync } from "child_process";
import fs from "fs";
const R = await import("../../web-src/agent-rules.js");
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { console.log("FAIL " + m); fail++; } };
const run = (env = {}) => +((/\(([\d.]+)%\)/.exec(execFileSync("node", [new URL("../listing/gen.mjs", import.meta.url).pathname, "2500"], { env: { ...process.env, ...env }, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })) || [0, 0])[1]);
const a0 = run(), h0 = run({ HELDOUT: "1" });
ok(a0 === 100, "10,000 links, 2,500 sample: " + a0 + "%"); ok(h0 >= 99, "held-out, 2,500 sample: " + h0 + "% (the mark: 99%)");
// the page reader (agent-kit.js, injected into the store's page) knows the SAME listing shapes
const kit = fs.readFileSync(new URL("../../web-src/agent-kit.js", import.meta.url), "utf8"), m = /const LISTING = (\/.*\/i);/.exec(kit);
ok(m && m[1] === R.LISTING_RE.toString(), "agent-kit.js LISTING is agent-rules.js LISTING_RE");
// an Amazon ad link → the product itself
ok(R.cleanListing("https://www.amazon.eg/sspa/click?ie=UTF8&spc=MTo&url=%2FHuawei-FreeClip%2Fdp%2FB0CQ4H3K2N%2Fref%3Dsr_1_1_sspa%3Fkeywords%3Dfreeclip&qualifier=1") === "https://www.amazon.eg/dp/B0CQ4H3K2N", "Amazon /sspa/click → /dp/B0CQ4H3K2N");
ok(R.cleanListing("https://www.google.com/url?q=https://www.noon.com/egypt-en/huawei-freeclip/N70012345A/p/%3Futm_source%3Dg&sa=U") === "https://www.noon.com/egypt-en/huawei-freeclip/N70012345A/p/", "Google /url?q= → noon's product page, no utm");
const a = { kind: "buy", what: "Huawei FreeClip 2", site: "10 stores", url: "https://www.jumia.com.eg/catalog/?q=huawei+freeclip+2" };
for (const [href, why] of [["https://www.jumia.com.eg/mlp-huawei-official-store/", "the brand's shop"], ["https://www.jumia.com.eg/catalog/?q=huawei+freeclip+2", "the search itself"], ["https://www.jumia.com.eg/seller/tech-zone/", "the seller"], ["https://www.googleadservices.com/pagead/aclk?sa=L&ai=x", "a bare ad hop"], ["", "no link"]]) {
  const r = R.offerOpen(a, { name: "Huawei FreeClip 2 Black", price: 7400, href, url: a.url, site: "Jumia" });
  ok(!r.direct && r.url === a.url && r.goto.name === "Huawei FreeClip 2 Black" && r.goto.price === 7400, why + " is never opened as the product — found by name on the results: " + JSON.stringify(r)); }
const j = R.offerOpen(a, { name: "Huawei FreeClip 2 Black", price: 7400, href: "https://www.jumia.com.eg/huawei-freeclip-2-black-98765432.html?utm_source=x", url: a.url, site: "Jumia" });
ok(j.direct && j.url === "https://www.jumia.com.eg/huawei-freeclip-2-black-98765432.html", "Jumia's product page opens directly, clean: " + j.url);
const mb = R.offerOpen({ ...a, url: "https://shop.example.com/find?term=freeclip" }, { name: "Huawei FreeClip 2", price: 7400, href: "https://shop.example.com/view/freeclip2", url: "https://shop.example.com/find?term=freeclip" });
ok(!mb.direct && mb.fallback === "https://shop.example.com/view/freeclip2" && R.listingKind("https://shop.example.com/view/freeclip2") === "maybe", "a link whose shape says nothing: found by name first, the link only as the fallback");
ok(R.offerOpen(a, { name: "Some review", price: 7400, href: "https://techsite.example.com/huawei-freeclip-2-review", web: true }).direct, "a web result (its page IS the offer) opens directly");
// the page it landed on is kept on the offer
const ag = { best3: [{ key: "k1", name: "FreeClip 2", price: 7400, site: "Jumia", href: "" }, { key: "k2", name: "FreeClip 2", price: 7600, site: "noon", href: "" }], pending: { name: "FreeClip 2", price: 7400, site: "Jumia", href: "" } };
const kept = R.keepListing(ag, ag.best3[0], "https://www.jumia.com.eg/huawei-freeclip-2-black-98765432.html");
ok(kept.best3[0].href.endsWith("98765432.html") && kept.best3[1].href === "" && kept.pending.href.endsWith("98765432.html"), "the landed page is kept on that offer (and the same find waiting), not on the others");
ok(R.offerOpen(a, kept.best3[0]).direct, "…so the next tap is direct");
console.log(fail ? `FAIL ${fail} of ${n}` : `ALL PASSED (${n} checks)`);
process.exit(fail ? 1 : 0);
