// v9.3 (Ali on A3: "wasn't that already available via Deal Check?") — Deal Check's scam signs, folded into Money Guardian, + message signs.
import * as S from "../../web-src/scamcheck.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const v = (t) => S.scamCheck(t);
const a = v("مبروك! كسبت ٥٠٠٠ جنيه من إنستاباي 🎉 ابعت كود التفعيل اللي هيوصلك في رسالة عشان نحوّلك المبلغ: instapay-gift.co");
ok(a.level === "scam" && ["code", "prize", "fake-link"].every((id) => a.reasons.some((r) => r.id === id)), "the InstaPay prize message → Scam: asks for the code, a prize, a fake link: " + a.reasons.map((r) => r.id).join(","));
ok(a.reasons.find((r) => r.id === "fake-link").link === "instapay-gift.co", "…the fake link is named");
ok(v("CIB: Your card will be blocked within 24 hours. Click the link to verify your account: cib-secure-login.com").level === "scam", "“your card will be blocked” + a link that isn't cibeg.com → Scam");
ok(v("Hi Mama, this is my new number, my phone broke. Can you send me 2000 on Vodafone Cash?").level === "scam", "“this is my new number” + money to a wallet → Scam");
ok(v("Your parcel is on hold. Pay the 25 EGP customs fee here: aramex-eg-delivery.net").level === "scam", "a parcel held for a small fee on a fake Aramex site → Scam");
ok(v("Work from home: earn $50 per day just like videos and earn!").level !== "none", "easy money for liking videos → at least Be careful");
ok(v("تعالى بكرة الساعة ٥ نتقابل في الكافيه").level === "none" && v("Your Amazon order has shipped: https://www.amazon.eg/orders").level === "none", "a normal message, and a real amazon.eg link → no warning signs");
ok(v("Hurry, last chance — only 2 left!").level === "none" && v("Hurry, last chance — only 2 left! Pay a deposit first").level === "scam", "pressure alone is not enough; pressure + pay first is");
ok(S.fakeLinks("see https://www.instapay.com.eg/help and vodafone.com.eg").length === 0, "the real InstaPay and Vodafone sites are not fake");
ok(v("").level === "none" && v("   ").reasons.length === 0, "nothing → nothing");
