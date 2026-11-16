// v10.0.3 — Ali's 16 Nov phone list (round 2), each kept as a test: his agent "Huawei free clips 2" never matched the stores'
// "HUAWEI FreeClip 2" (so every round said "couldn't read the prices" while Google showed 7,400); a scanned bank card put its whole
// number in the note and found no expiry.
import { execFileSync } from "child_process";
import * as A from "../../web-src/agents.js";
import * as B from "../../web-src/bankcard.js";
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { console.log("FAIL " + m); fail++; } };
const s = (w, x) => A.matchScore(w, { name: x });
ok(s("Huawei free clips 2", "HUAWEI FreeClip 2 Open-Ear Earbuds, Black") === 1, "“free clips 2” = “FreeClip 2”");
ok(s("huawei freeclip 2", "Huawei Free Clip 2 earbuds") === 1, "“freeclip 2” = “Free Clip 2”");
ok(s("air pods pro 2", "Apple AirPods Pro 2 USB-C") === 1, "“air pods pro 2” = “AirPods Pro 2”");
ok(s("Huawei free clips 2", "HUAWEI FreeClip Open-Ear Earbuds") === 0, "the first FreeClip (no 2) is not the FreeClip 2");
ok(s("Huawei free clips 2", "Silicone Case for HUAWEI FreeClip 2") === 0, "a case for it is not it");
ok(s("Huawei free clips 2", "Huawei FreeBuds 6i free delivery 2 days") === 0, "“2 days” is not the model number 2");
const r = A.takeBuyRound({ kind: "buy", what: "Huawei free clips 2", below: 8000, currency: "EGP", checks: [] },
  [{ name: "HUAWEI FreeClip 2 Open-Ear Earbuds", price: 7400, currency: "EGP", site: "Amazon" }, { name: "HUAWEI FreeClip 2", price: 8758.71, currency: "EGP", site: "Amazon" }]);
ok(r.step === "confirm" && r.pending.price === 7400 && !r.checks[0].blocked, "his agent now finds Amazon's 7,400 (under 8,000) and asks him");
// the bank card (Ali's own scan, as the phone's OCR read it)
const c = B.readBankCard("CB WealthEGP5576 0199 17 3251\nVALID FROM 03/24\nVALID THRU 08/29\nALY ALDIBIKI\nVISA");
ok(c && c.last4 === "3251" && c.expiry === "2029-08-31" && c.network === "Visa", "his card → ·· 3251, expires 31 Aug 2029: " + JSON.stringify(c));
ok(!JSON.stringify(c).includes("5576") && B.cardTitle(c, "Bank card").replace(/\D/g, "") === "3251", "the card's number is never kept — title: " + B.cardTitle(c, "Bank card"));
ok(B.readBankCard("Carrefour Maadi\nTotal EGP 450.00\n12/11/2026") === null, "a receipt is not a card");
const run = (env = {}) => +((/\(([\d.]+)%\)/.exec(execFileSync("node", [new URL("../bankcard/gen.mjs", import.meta.url).pathname, "2500"], { env: { ...process.env, ...env }, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })) || [0, 0])[1]);
const a0 = run(), h0 = run({ HELDOUT: "1" });
ok(a0 === 100, "10,000 bank-card texts, 2,500 sample: " + a0 + "%"); ok(h0 >= 99, "held-out, 2,500 sample: " + h0 + "% (the mark: 99%)");
console.log(fail ? `FAIL ${fail} of ${n}` : `ALL PASSED (${n} checks)`);
process.exit(fail ? 1 : 0);
