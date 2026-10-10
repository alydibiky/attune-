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

/** v5.32 — Ali is testing: every Pro feature is unlocked on every phone. Set to false before
    the public release (then the 7-day trial, Free limits and Pro codes apply again). */
export const TESTING_ALL_PRO = true;     // the testing FEATURE exists; it is OFF for everyone unless developer mode is on (below)
/** v6.11 release: developer mode is hidden — tap the version number 7 times (More, bottom). Off on every fresh install, so customers
    always get the 7-day trial, the Free limits and Pro by purchase; Ali turns it on to test Pro features. */
export function devMode() { try { return localStorage.getItem("attune:dev") === "1"; } catch (e) { return false; } }
export function setDevMode(on) { try { localStorage.setItem("attune:dev", on ? "1" : "0"); localStorage.setItem("attune:testing-pro", on ? "on" : "off"); } catch (e) {} }
/** In developer mode every Pro feature is unlocked; Plan can switch it off to see the app as a Free user ("attune:testing-pro" = "off"). */
export function testingPro() {
  if (!TESTING_ALL_PRO || !devMode()) return false;
  try { return localStorage.getItem("attune:testing-pro") !== "off"; } catch (e) { return true; }
}

// v5.32 prices (MONETIZATION.md §3): the first ones were too low for what Pro gives — an
// offline, private AI with deep research, Studio and Business systems. Still far below
// ChatGPT Plus (≈ EGP 1,000 a month in Egypt), yearly still the obvious best value.
// v6.7 (Ali: "the prices a bit more — I offer a lot"): Pro now also carries Fit & Food (a Yazio-class
// app), Deal Check, Chat X-Ray, the converter, slides and Business. Still under a third of ChatGPT Plus.
// These are the shown fallbacks; on Google Play the phone shows Play's own local price for each product.
export const PRICES = {
  EG: { cur: "EGP", month: "EGP 299", year: "EGP 2,499", life: "EGP 5,999", business: "EGP 14,999", yearNote: "≈ EGP 208 a month — save 30%", lifeNote: "pay once, yours forever", businessNote: "per company system, once" },
  US: { cur: "USD", month: "$7.99", year: "$59.99", life: "$149.99", business: "$299.99", yearNote: "≈ $5 a month — save 37%", lifeNote: "pay once, yours forever", businessNote: "per company system, once" },
};
/** Google Play product ids (create them with these exact ids in the Play Console). */
export const PLAY = { month: "attune_pro_monthly", year: "attune_pro_yearly", life: "attune_pro_lifetime", business: "attune_business_system" };
/** Which Play products make this phone Pro (a Business system activation doesn't). */
export const proFromOwned = (items) => (items || []).find((x) => x && x.purchased !== false && [PLAY.month, PLAY.year, PLAY.life].includes(x.productId)) || null;

/** "EG" for phones set to Egypt (time zone or Arabic-Egypt locale), else "US" prices. */
export function region(tz, lang) {
  const z = String(tz || ""), l = String(lang || "");
  return /Africa\/Cairo/i.test(z) || /-EG\b/i.test(l) ? "EG" : "US";
}
export function pricesFor(tz, lang) { return PRICES[region(tz, lang)]; }

/** What Pro gives — the reasons to pay, in the order people care about. */
export const PRO_BENEFITS = [
  "Unlimited answers — no daily limit",
  "Unlimited Deal Checks: the real cost, the market price and scam signs before you pay",
  "Unlimited Chat X-Rays: who owes you, promises and unanswered questions in your WhatsApp chats",
  "Unlimited file conversions, including scanned paper → editable Word",
  "Unlimited video downloads in the quality you choose",
  "Unlimited presentations (PowerPoint) and reports (Word / PDF)",
  "Expert review: strong models check and improve their own answers",
  "Deep web research: several searches, more pages, cross-checked facts",
  "Unlimited Studio pictures",
  "Fit & Food: unlimited photo meals, the week's meal plan and shopping list, the week report",
  "Business systems: unlimited records and Excel / app export",
  "Memory that remembers everything and can search it",
];
export const FREE_LIMITS = { answersPerDay: 15, picturesPerDay: 3 };

/** v6.10 — Plans & billing page: what Pro gives, grouped by the app it belongs to (Money is included in Pro). */
export const BILLING_GROUPS = [
  { id: "chat", icon: "💬", title: "Chat & answers", items: [
    "Unlimited answers — no daily limit", "Expert review: strong models check and improve their own answers",
    "Deep web research: several searches, more pages, cross-checked facts", "Mind: remembers everything and searches it" ] },
  { id: "tools", icon: "🧰", title: "Tools", items: [
    "Deal Check: the real cost, the market price and scam signs before you pay", "Chat X-Ray: who owes you, promises and unanswered questions in WhatsApp chats",
    "File converters, including scanned paper → editable Word", "Presentations (PowerPoint) and reports (Word / PDF)", "Video downloads in the quality you choose", "Studio pictures" ] },
  { id: "fit", icon: "🥗", title: "Fit & Food", items: [
    "Unlimited photo meals", "The week's meal plan and shopping list", "The week report" ] },
  { id: "money", icon: "💰", title: "Money (Yusr)", items: [
    "Receipt photos on transactions", "Sync, PDF export and projects", "Every Money Premium feature — included, no second plan" ] },
  { id: "biz", icon: "🏗️", title: "Business systems", items: [
    "Unlimited records while you try a system", "Excel and app export", "Activating a system for good is a separate, one-time price (below)" ] },
];
/** Free / Pro / Business columns for the compare table. */
export const COMPARE_ROWS = [
  ["Answers", "15 a day", "Unlimited", "Unlimited"],
  ["Deal Check", "3 a day", "Unlimited", "Unlimited"],
  ["Chat X-Ray", "1 a day", "Unlimited", "Unlimited"],
  ["File conversions", "5 a day", "Unlimited", "Unlimited"],
  ["Video downloads", "3 a day", "Unlimited", "Unlimited"],
  ["Presentations & reports", "2 a day", "Unlimited", "Unlimited"],
  ["Studio pictures", "3 a day", "Unlimited", "Unlimited"],
  ["Fit & Food photo meals", "3 a day", "Unlimited", "Unlimited"],
  ["Money: receipt photos, sync, PDF, projects", "—", "✓", "✓"],
  ["Business systems", "30 records a table", "30 records a table", "Unlimited, per system"],
];

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
  if (!first || !isFinite(+first)) return TRIAL_DAYS;
  const left = TRIAL_DAYS - Math.floor((now - +first) / 86400000);
  return Math.max(0, Math.min(TRIAL_DAYS, left));
}

/** The message to send the seller for a purchase. */
export function buyMessage(req, plan, price) {
  return `Hello, I'd like Attune Pro (${plan}, ${price}).\nMy request code: ${req}\n\nمرحبًا، أريد الاشتراك في Attune Pro (${plan}، ${price}).\nرمز الطلب: ${req}`;
}
