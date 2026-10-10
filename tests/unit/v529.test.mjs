// Unit tests for v5.29: the tips library.
import { tipsFor, tipsBlock, TIP_COUNT, TIP_AREAS } from "../../web-src/tips.js";
import { region, pricesFor, requestCode, checkProCode, trialDaysLeft, buyMessage, PRO_BENEFITS } from "../../web-src/billing.js";
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }
const has = (q, re, n = 3) => tipsFor(q, n).some((t) => re.test(t));

eq(TIP_COUNT >= 200, true, "at least 200 tips (" + TIP_COUNT + ")");
eq(TIP_AREAS.length >= 20, true, "covering " + TIP_AREAS.length + " areas");
eq(has("3 cranes × 4 days × 12,500 EGP + 14% VAT — total?", /VAT is 14%/), true, "a crane-hire sum gets the Egyptian VAT tip");
eq(has("What should I check on a mobile crane outrigger before a 40 t lift on soft clay?", /Outrigger ground pressure/), true, "an outrigger question gets the ground-pressure tip");
eq(has("Write a formal email to reject a supplier quotation", /email|Formal tone/), true, "an email gets writing tips");
eq(has("ترجم الرسالة دي للتركي", /Translate meaning|Turkish/), true, "an Arabic translation request gets translation tips");
eq(has("اكتب كود بايثون يحسب المتوسط", /runnable code/), true, "an Arabic code request gets coding tips");
eq(has("Lynk & Co 900 all trims hp torque price", /Car prices differ|every trim/), true, "a car question gets car tips");
eq(tipsFor("What should I check on a mobile crane before a lift", 5).some((t) => /For 'what if'/.test(t)), false, "'if' inside 'lift' doesn't call up the what-if tip");
eq(tipsFor("Write a formal email", 5).some((t) => /AI vs general software/.test(t)), false, "'ai' inside 'email' doesn't call up the AI-career tip");
eq(tipsFor("اكتب كود يحسب المتوسط", 5).some((t) => /Symptoms/.test(t)), false, "'الم' inside 'المتوسط' doesn't call up the health tip");
eq(tipsFor("ترجم دي للتركي", 5).some((t) => /1 m³/.test(t)), false, "'لتر' inside 'للتركي' doesn't call up the litres tip");
eq(tipsFor("hi there", 3).length, 1, "a greeting gets one general tip");
eq(tipsFor("crane crane crane outrigger sling wind lift plan", 5).length, 5, "a strong model gets up to 5 tips");
eq(tipsFor("crane outrigger sling wind lift plan", 2).length, 2, "a small model gets 2");
eq(/^\n\n\(Expert tips for this answer:\n- /.test(tipsBlock("VAT on 1000 EGP")), true, "the tips go after the question as a short block");

// ---- billing ----
eq([region("Africa/Cairo", "en-US"), region("Europe/Berlin", "ar-EG"), region("America/New_York", "en-US")], ["EG", "EG", "US"], "Egypt gets Egyptian prices (by time zone or locale)");
eq([pricesFor("Africa/Cairo").year, pricesFor("UTC").year], ["EGP 2,499", "$59.99"], "yearly: EGP 2,499 / $59.99 (v6.7 prices)");
const rc = requestCode("device-123");
eq([/^PRO-[A-Z0-9]{8}$/.test(rc), rc === requestCode("device-123"), rc !== requestCode("device-124")], [true, true, true], "each phone has its own stable request code (" + rc + ")");
eq([trialDaysLeft(0), trialDaysLeft(Date.now() - 2 * 86400000), trialDaysLeft(Date.now() - 9 * 86400000)], [7, 5, 0], "the 7-day Pro trial counts down");
eq(buyMessage("PRO-ABCD2345", "Yearly", "EGP 999").includes("PRO-ABCD2345") && /رمز الطلب/.test(buyMessage("PRO-ABCD2345", "Yearly", "EGP 999")), true, "the WhatsApp message carries the request code, in English and Arabic");
eq(PRO_BENEFITS.length >= 5, true, "Pro lists its benefits");
{
  const { subtle } = globalThis.crypto;
  const kp = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const pub = await subtle.exportKey("jwk", kp.publicKey);
  const PUB = { kty: "EC", crv: "P-256", x: pub.x, y: pub.y };
  const b64u = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const make = async (body) => { const payload = "PRO1." + b64u(Buffer.from(JSON.stringify(body))); const sig = await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, kp.privateKey, new TextEncoder().encode(payload)); return payload + "." + b64u(sig); };
  const good = await make({ s: rc, p: "pro", e: Date.now() + 86400000 * 30, i: Date.now() });
  eq((await checkProCode(good, rc, PUB)).ok, true, "a signed code for this phone activates Pro");
  eq((await checkProCode(good, requestCode("other-phone"), PUB)).reason, "That code was made for another phone.", "…but not on another phone");
  eq((await checkProCode(await make({ s: rc, p: "pro", e: Date.now() - 1000, i: 1 }), rc, PUB)).ok, false, "an ended month/year code doesn't");
  const parts = good.split("."); const forged = parts[0] + "." + b64u(Buffer.from(JSON.stringify({ s: rc, p: "pro", e: 0, i: 1 }))) + "." + parts[2];
  eq((await checkProCode(forged, rc, PUB)).ok, false, "a code edited to 'lifetime' is rejected (signature)");
  eq((await checkProCode("ATTUNE-xxxx-yyyy", rc, PUB)).ok, false, "a made-up key is rejected");
  const life = await make({ s: rc, p: "pro", e: 0, i: Date.now() });
  eq((await checkProCode(life, rc, PUB)).exp, 0, "a lifetime code never ends");
}

console.log(fails.length ? fails.length + " FAILED" : "ALL PASSED");
if (fails.length) process.exit(1);
