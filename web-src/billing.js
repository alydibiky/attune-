/* ---- Earning money: prices, the 7-day Pro trial, and signed Pro codes (v5.29) -------------
   Ali: "act as an expert marketer and choose the best way to earn money from this app —
   competitive, and that actually makes people pay for as long as possible."
   The strategy (MONETIZATION.md) in code:
     - REGIONAL prices: Egypt pays in EGP at Egyptian prices, everyone else in USD. The yearly
       plan is the default ("2 months free") — yearly subscribers stay ~3× longer.
     - A 7-day REVERSE TRIAL: every new install gets full Pro for 7 days, then Free. People
       keep what they got used to; this converts far better than asking up front.
     - DIRECT SALES that work today, without the Play Store: the phone shows a request code
       (PRO-XXXXXXXX), the buyer pays (InstaPay / Vodafone Cash / card) and sends it on
       WhatsApp, the seller runs `node tools/erp-licence.mjs pro <private-key> <code> year`
       and sends back the activation code. The code is SIGNED with the seller's private key
       (the same one as Business codes) and bound to that one phone; month / year codes carry
       an end date. The app only holds the public key: it can check a code, never make one.
   Pure helpers; tests in tests/unit/v529.test.mjs.                                           */

export const TRIAL_DAYS = 7;

export const PRICES = {
  EG: { cur: "EGP", month: "EGP 149", year: "EGP 999", life: "EGP 2,999", yearNote: "≈ EGP 83 a month — 2 months free", lifeNote: "pay once, yours forever" },
  US: { cur: "USD", month: "$3.99", year: "$24.99", life: "$59", yearNote: "≈ $2.08 a month — 5 months free", lifeNote: "pay once, yours forever" },
};

/** "EG" for phones set to Egypt (time zone or Arabic-Egypt locale), else "US" prices. */
export function region(tz, lang) {
  const z = String(tz || ""), l = String(lang || "");
  return /Africa\/Cairo/i.test(z) || /-EG\b/i.test(l) ? "EG" : "US";
}
export function pricesFor(tz, lang) { return PRICES[region(tz, lang)]; }

/** What Pro gives — the reasons to pay, in the order people care about. */
export const PRO_BENEFITS = [
  "Unlimited answers — no daily limit",
  "Expert review: strong models check and improve their own answers",
  "Deep web research: several searches, more pages, cross-checked facts",
  "Unlimited Studio pictures",
  "Business systems: unlimited records and Excel / app export",
  "Memory that remembers everything and can search it",
];
export const FREE_LIMITS = { answersPerDay: 15, picturesPerDay: 3 };

/** The phone's Pro request code, from its install id: "PRO-" + 8 letters/digits. */
export function requestCode(deviceId) {
  let h = 2166136261 >>> 0;
  for (const ch of String(deviceId || "attune")) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  let h2 = (h ^ 0x9e3779b9) >>> 0, out = "";
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let i = 0; i < 8; i++) { const v = i < 4 ? h : h2; out += A[(v >>> ((i % 4) * 6)) & 31]; h2 = Math.imul(h2 ^ (h >>> 3), 2654435761) >>> 0; }
  return "PRO-" + out;
}

const b64u = (s) => { const pad = String(s).replace(/-/g, "+").replace(/_/g, "/"); const bin = atob(pad + "=".repeat((4 - pad.length % 4) % 4)); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };

/**
 * Check a Pro activation code: "PRO1.<payload>.<signature>", payload {s: request code,
 * p: "pro"|"business", e: end time (0 = lifetime), i: issued}. → { ok, plan, exp, reason }
 */
export async function checkProCode(code, request, publicKey, subtle = (globalThis.crypto || {}).subtle) {
  const parts = String(code || "").trim().split(".");
  if (parts.length !== 3 || parts[0] !== "PRO1") return { ok: false, reason: "That isn't a Pro activation code." };
  let p;
  try { p = JSON.parse(new TextDecoder().decode(b64u(parts[1]))); } catch (e) { return { ok: false, reason: "That code is damaged — copy it again." }; }
  if (!p || p.s !== request) return { ok: false, reason: "That code was made for another phone." };
  if (p.e && Date.now() > p.e) return { ok: false, reason: "That code ended on " + new Date(p.e).toISOString().slice(0, 10) + "." };
  if (!publicKey || !subtle) return { ok: false, reason: "This phone can't check the code." };
  try {
    const k = await subtle.importKey("jwk", { ...publicKey, ext: true }, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const ok = await subtle.verify({ name: "ECDSA", hash: "SHA-256" }, k, b64u(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]));
    return ok ? { ok: true, plan: p.p === "business" ? "business" : "pro", exp: p.e || 0 } : { ok: false, reason: "That code's signature doesn't match." };
  } catch (e) { return { ok: false, reason: "This phone can't check the code (" + (e.message || e) + ")." }; }
}

/** Days left of the 7-day Pro trial (0 when over). `first` = first run time. */
export function trialDaysLeft(first, now = Date.now()) {
  if (!first) return TRIAL_DAYS;
  const left = TRIAL_DAYS - Math.floor((now - first) / 86400000);
  return Math.max(0, Math.min(TRIAL_DAYS, left));
}

/** The message to send the seller for a purchase. */
export function buyMessage(req, plan, price) {
  return `Hello, I'd like Attune Pro (${plan}, ${price}).\nMy request code: ${req}\n\nمرحبا، عايز أتيون برو (${plan}، ${price}).\nكود الطلب: ${req}`;
}
