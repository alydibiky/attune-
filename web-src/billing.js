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

import { guessCountry } from "./country.js";

export const TRIAL_DAYS = 7;
/** v8.7 (Ali picked persona 3's point 4): Lifetime is a launch offer only — shown until this day (Ali: set it to 30 days after
 *  the Play launch), then it disappears so it doesn't pull the best customers out of the subscription. */
export const LIFETIME_UNTIL = "2027-01-31";
export const lifetimeOffer = (now = Date.now()) => new Date(now).toISOString().slice(0, 10) <= LIFETIME_UNTIL;
/** v8.6: where a reported AI answer is e-mailed (Google Play's AI-content policy). ALI: put the app's support e-mail here before release —
    empty = the report is only kept on the phone (Settings can show it). */
export const SUPPORT_EMAIL = "";

/** v5.32 — Ali is testing: every Pro feature is unlocked on every phone. Set to false before
    the public release (then the 7-day trial, Free limits and Pro codes apply again). */
export const TESTING_ALL_PRO = true;     // the testing FEATURE exists; it is OFF for everyone unless developer mode is on (below)
/** v6.11 release: developer mode is hidden — tap the version number 7 times (More, bottom). Off on every fresh install, so customers
    always get the 7-day trial, the Free limits and Pro by purchase; Ali turns it on to test Pro features. */
/** v6.29: the Android app says whether it is a test build (signed with the test key). A Play build signed with the real key says no,
    and then developer mode can never be on — the 7-tap trick unlocks nothing for customers. (No such answer → the browser tests.) */
export function devAllowed() { try { const N = typeof window !== "undefined" && window.AttuneNative; return !(N && typeof N.testBuild === "function") || !!N.testBuild(); } catch (e) { return false; } }
export function devMode() { try { return devAllowed() && localStorage.getItem("attune:dev") === "1"; } catch (e) { return false; } }
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
/* v9.1 (Ali, 4 Nov, picked "3 tiers": "the app is global and for the Gulf too — not all countries pay; prices should be adjusted
   based on the region"): one app everywhere, the price by what people in each country can pay, in their own currency.
     high  — the Gulf, the US, the UK, the EU, Canada: ≈ $7.99 a month · $59.99 a year
     mid   — Türkiye, Malaysia, Brazil, Mexico, South Africa, Jordan, Lebanon: ≈ $3.99 · $29.99
     low   — Egypt, India, Pakistan, Indonesia, Nigeria, Morocco, Algeria, Tunisia: ≈ $1.99 · $14.99
   These are the shown prices and the list to copy into the Play Console (Monetize → Subscriptions → each plan → prices by
   country); on Google Play the phone shows Play's own local price. A country not listed pays the high tier in dollars.
   Business (a company system, sold once) keeps its price: EGP 14,999 in Egypt, $299.99 elsewhere. */
const L = (tier, cur, sym, month, year, life, business) => ({ tier, cur, sym, month, year, life, business });
export const REGION_PRICES = {
  us: L("high", "USD", "$", 7.99, 59.99, 149.99, 299.99), ca: L("high", "CAD", "CA$", 10.99, 79.99, 199.99, 399.99), gb: L("high", "GBP", "£", 6.49, 47.99, 119.99, 239.99),
  de: L("high", "EUR", "€", 7.49, 54.99, 139.99, 279.99), fr: L("high", "EUR", "€", 7.49, 54.99, 139.99, 279.99), es: L("high", "EUR", "€", 7.49, 54.99, 139.99, 279.99),
  it: L("high", "EUR", "€", 7.49, 54.99, 139.99, 279.99), pt: L("high", "EUR", "€", 7.49, 54.99, 139.99, 279.99), nl: L("high", "EUR", "€", 7.49, 54.99, 139.99, 279.99),
  sa: L("high", "SAR", "SAR ", 29.99, 219.99, 549.99, 1099.99), ae: L("high", "AED", "AED ", 29.99, 219.99, 549.99, 1099.99), qa: L("high", "QAR", "QAR ", 29.99, 219.99, 549.99, 1099.99),
  kw: L("high", "KWD", "KWD ", 2.49, 17.99, 45.99, 89.99), bh: L("high", "BHD", "BHD ", 2.99, 22.99, 56.99, 112.99), om: L("high", "OMR", "OMR ", 2.99, 22.99, 56.99, 112.99),
  tr: L("mid", "TRY", "₺", 169.99, 1249.99, 3149.99, 6299.99), my: L("mid", "MYR", "RM ", 17.99, 129.99, 319.99, 639.99), br: L("mid", "BRL", "R$ ", 21.99, 164.99, 409.99, 819.99),
  mx: L("mid", "MXN", "MX$", 74.99, 549.99, 1399.99, 2799.99), za: L("mid", "ZAR", "R ", 72.99, 539.99, 1349.99, 2699.99), jo: L("mid", "JOD", "JOD ", 2.99, 21.99, 52.99, 105.99),
  lb: L("mid", "USD", "$", 3.99, 29.99, 74.99, 149.99),
  eg: L("low", "EGP", "EGP ", 99, 799, 1999, 14999), in: L("low", "INR", "₹", 169, 1299, 3399, 6799), pk: L("low", "PKR", "Rs ", 549, 4199, 10999, 21999),
  id: L("low", "IDR", "Rp ", 32900, 249000, 649000, 1299000), ng: L("low", "NGN", "₦", 2999, 22999, 59999, 119999), ma: L("low", "MAD", "MAD ", 19.99, 149.99, 399.99, 799.99),
  dz: L("low", "DZD", "DZD ", 269, 1999, 5399, 10799), tn: L("low", "TND", "TND ", 5.99, 44.99, 119.99, 239.99),
};
const BUSINESS_KEEP = { eg: 14999 };   // the company system keeps Ali's price; elsewhere $299.99 in the local money (the table above)
const money = (sym, v) => sym + (v % 1 ? v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : v.toLocaleString("en-US"));
const nice = (v) => { if (v < 1000) return v; const m = 10 ** (Math.floor(Math.log10(v)) - 2); return m <= 100 ? Math.round(v / m) * m - 1 : Math.round(v / m) * m; };   // 25,496 → 25,499 · 4,871,250 → 4,870,000
/** v9.1: the phone companies whose balance Google Play takes in each country (carrier billing) — a Saudi was told "Vodafone /
 *  Orange / Etisalat". A country not listed: "mobile" (the Plan page's own word). */
export const CARRIERS = { eg: "Vodafone / Orange / Etisalat", sa: "STC / Mobily / Zain", ae: "du / e&", kw: "Zain / Ooredoo / stc", qa: "Ooredoo / Vodafone",
  bh: "Batelco / Zain / stc", om: "Omantel / Ooredoo", jo: "Zain / Orange / Umniah", ma: "Maroc Telecom / Orange / inwi", tr: "Turkcell / Vodafone / Türk Telekom",
  pk: "Jazz / Telenor / Zong", in: "Airtel / Jio / Vi", id: "Telkomsel / Indosat / XL", my: "Maxis / CelcomDigi / U Mobile", ng: "MTN / Airtel / Glo" };
/** A country's prices, as the Plan page shows them: { cur, tier, month, year, life, business, yearNote: {t, v}, lifeNote, businessNote }. */
export function regionPrices(code) {
  const k = String(code || "").toLowerCase(), r = REGION_PRICES[k] || REGION_PRICES.us;
  const perMonth = r.year / 12, save = Math.round((1 - r.year / (12 * r.month)) * 100);
  // the company system costs the same everywhere (≈ $299.99, in the local money) — except Egypt's own price
  const biz = BUSINESS_KEEP[k] || (r.tier === "high" ? r.business : r.cur === "USD" ? 299.99 : nice(r.business * (r.tier === "mid" ? 2 : 3.75)));
  return { code: REGION_PRICES[k] ? k : "us", carriers: CARRIERS[k] || "", cur: r.cur, tier: r.tier, month: money(r.sym, r.month), year: money(r.sym, r.year), life: money(r.sym, r.life),
    business: money(r.sym, biz), yearNote: { t: "≈ {p} a month — save {n}%", v: { p: money(r.sym, perMonth >= 10 ? Math.round(perMonth) : Math.round(perMonth * 100) / 100), n: save } },
    lifeNote: "pay once, yours forever", businessNote: "per company system, once" };
}
/** Google Play product ids (create them with these exact ids in the Play Console). */
export const PLAY = { month: "attune_pro_monthly", year: "attune_pro_yearly", life: "attune_pro_lifetime", business: "attune_business_system" };
/** Which Play products make this phone Pro (a Business system activation doesn't). */
export const proFromOwned = (items) => (items || []).find((x) => x && x.purchased !== false && [PLAY.month, PLAY.year, PLAY.life].includes(x.productId)) || null;

/** v9.1: the country whose prices this phone gets — the one the person chose in Attune first (v8.6: a phone in Egypt set to en-US +
 *  UTC still pays Egyptian prices), then where the phone is (its time zone), then its language's region. Lower-case code. */
export function region(tz, lang) {
  try { const c = typeof localStorage !== "undefined" && localStorage.getItem("attune:country"); if (c) return REGION_PRICES[c.toLowerCase()] ? c.toLowerCase() : "us"; } catch (e) {}
  return guessCountry({ language: String(lang || ""), languages: [String(lang || "")] }, String(tz || "")) || "us";
}
export function pricesFor(tz, lang) { return regionPrices(region(tz, lang)); }

/** What Pro gives — the reasons to pay, in the order people care about. */
export const PRO_BENEFITS = [   // v9.9.34 FP-4 (Ali's pick): Pro = Attune does it for you, everywhere
  "Bank and wallet messages saved by themselves, with Undo",
  "Automations, phone rules and agents — as many as you need",
  "Close the day, week plan and scheduled messages",
  "Phone and computer always the same, Money for two",
  "Every year of Money kept, with PDF and Excel",
  "Unlimited photo reads, Chat X-Rays, conversions and slides",
  "The whole “Set up your life” guide and a monthly check-up",
  "Expert review and deep web research",
]
// v8.7 (Ali picked persona 3's point 2): Free answers are unlimited; one agent to try
export const FREE_LIMITS = { answersPerDay: Infinity, picturesPerDay: 3, agents: 1 };   // (v9.9.34: the full FP-4 limits are in plan.js LIMITS)
/** v6.16c (Ali: "I won't take money from people for the Dorar service"): a hadith question — answered with الدرر السنية's live
 *  search — never counts toward a daily limit, on any plan. Whatever enforces FREE_LIMITS.answersPerDay asks this first. */
export function countsTowardLimit(question, isHadithQuestion) {
  return !(typeof isHadithQuestion === "function" && isHadithQuestion(String(question || "")));
}

/** v6.10 — Plans & billing page: what Pro gives, grouped by the app it belongs to (Money is included in Pro). */
export const BILLING_GROUPS = [   // v9.9.34 FP-4: what Attune does for you with Pro, place by place
  { id: "money", icon: "💰", title: "Money", items: [
    "Bank and wallet messages saved by themselves, with Undo", "Every year of Money kept, with PDF and Excel", "Money for two: one budget with your partner" ] },
  { id: "day", icon: "📅", title: "Your day", items: [
    "Automations and phone rules — as many as you need", "Close the day, week plan and scheduled messages", "The whole “Set up your life” guide and a monthly check-up" ] },
  { id: "tools", icon: "🧰", title: "Tools", items: [
    "Agents that find, watch and buy for you (you confirm every order)", "Unlimited photo reads, Chat X-Rays, conversions and slides", "As many papers with dates as you need" ] },
  { id: "chat", icon: "💬", title: "Chat & answers", items: [
    "Expert review and deep web research", "Phone and computer always the same" ] },
]
/** Free / Pro / Business columns for the compare table. */
export const COMPARE_ROWS = [   // v9.9.34 FP-4: Free = you do it, Attune keeps it · Pro = Attune does it for you, everywhere
  ["Chat, voice and answers, offline", "Unlimited", "+ expert review, deep research"],
  ["Money, reminders, debts, lists, dates — just say it", "Unlimited", "Unlimited"],
  ["Money history", "Last 3 months", "Every year + PDF and Excel"],
  ["Bank messages → Money", "Asks you each time", "By itself, with Undo"],
  ["Automations and phone rules", "1 rule", "Unlimited"],
  ["Agents that find, watch and buy", "1 agent", "Unlimited"],
  ["Morning brief", "✓", "✓"],
  ["Close the day, week plan, scheduled messages", "—", "✓"],
  ["Papers with dates", "10", "Unlimited"],
  ["Photo reads, Chat X-Ray, conversions, slides", "3 a day each", "Unlimited"],
  ["Sync with your computer, Money for two", "—", "✓"],
  ["“Set up your life” guide", "First 3 steps", "Everything + monthly check-up"],
  ["Hadith search (Dorar), prayers, emergency card", "Free, unlimited", "Free, unlimited"],
]

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
export function trialDaysLeft(first, now = Date.now(), days = TRIAL_DAYS) {
  if (!first || !isFinite(+first)) return days;
  const left = days - Math.floor((now - +first) / 86400000);
  return Math.max(0, Math.min(days, left));
}

/* ---- v8.7 (Ali picked persona 3's point 9): "give a friend a month of Pro" ------------------------------------------------
   The link is the Play page with referrer=attune_ref=<this phone's request code>; the friend's app reads it once (Install
   Referrer) and its trial is a month instead of 7 days. The giver's month needs one small server to confirm the friend
   installed (or a code Ali sends by hand) — see ALI_LIST_2026-10-28.md.                                                     */
export const REFERRAL_DAYS = 30;
export const PLAY_PAGE = "https://play.google.com/store/apps/details?id=com.aldibiki.attune";
export const referralLink = (req) => PLAY_PAGE + "&referrer=" + encodeURIComponent("attune_ref=" + String(req || ""));
/** The friend's code from the install referrer ("utm_source=…&attune_ref=PRO-ABCD1234"), or "". */
export function referralFrom(referrer) { const m = /(?:^|&)attune_ref=([A-Z0-9-]{4,20})(?:&|$)/i.exec(String(referrer || "")); return m ? m[1].toUpperCase() : ""; }

/** The message to send the seller for a purchase. */
export function buyMessage(req, plan, price) {
  return `Hello, I'd like Attune Pro (${plan}, ${price}).\nMy request code: ${req}\n\nمرحبًا، أريد الاشتراك في Attune Pro (${plan}، ${price}).\nرمز الطلب: ${req}`;
}
