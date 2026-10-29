/* ---- v8.7 (Ali, 29 Oct: "and also reads Gmail by itself"): the money emails, read on the phone once a day.
   Connect once (Google's own screen asks for "read your email" — gmail.readonly; GmailRead.kt keeps the token, the page never
   sees it). Then, once a day when Attune opens (silently — never Google's screen again), the last days' emails about money:
     → the Overpaying check (subscriptions, trials, price rises — overpay.js addEmails, the same path as the Gmail export)
     → Money's review list, for the ones that are a payment (a bank / wallet / store receipt with an amount) — never added by themselves
     → Recall, so "the email from Amazon about the refund" is found
   Never a one-time code (the phone drops them). Setup Ali does once: docs/GMAIL_SIGNIN.md. Tests: tests/unit/v870gmail.test.mjs. */
import { loadOverpay, saveOverpay, addEmails } from "./overpay.js";

export const GMAIL_KEY = "attune:gmail:v1";
export const WAIT_KEY = "attune:sms-old:v1";   // the review list's "waiting" items (old SMS and payment emails)
const DAY = 864e5;
const ls = () => (typeof localStorage !== "undefined" ? localStorage : null);
export const loadGmail = (s = ls()) => { try { return { on: false, last: 0, emails: [], ...(JSON.parse((s && s.getItem(GMAIL_KEY)) || "null") || {}) }; } catch (e) { return { on: false, last: 0, emails: [] }; } };
const saveGmail = (g, s = ls()) => { try { s && s.setItem(GMAIL_KEY, JSON.stringify(g)); } catch (e) {} return g; };
/** Time for the daily read: connected, and the last read was 20 hours ago or more. */
export const gmailDue = (g = loadGmail(), now = Date.now()) => !!g.on && now - (g.last || 0) >= 20 * 3600e3;

// a payment (not a newsletter that mentions prices): a money word AND an amount with a currency, near the start
const PAY = /\b(debited|credited|charged|payment (?:of|received|confirmed)|you paid|you sent|you received|receipt|order (?:total|confirmed)|amount)\b|تم خصم|تم إيداع|تم ايداع|تم تحويل|إيصال|ايصال|إجمالي|اجمالي|المبلغ/i;
const AMT = /(\d[\d,٬.]*\s*(?:EGP|USD|EUR|GBP|SAR|AED|KWD|QAR|LE|L\.E|جنيه|ج\.م|ريال|درهم|\$|€|£))|((?:EGP|USD|EUR|GBP|SAR|AED|\$|€|£|جنيه)\s*\d)/i;
export const isPaymentEmail = (e) => { const t = String((e && e.title) || "") + " " + String((e && e.text) || "").slice(0, 700); return PAY.test(t) && AMT.test(t); };

/** Put read emails where they belong. → { added, payments } */
export function takeEmails(list, { s = ls(), now = Date.now() } = {}) {
  const g = loadGmail(s), have = new Set(g.emails.map((e) => e.id));
  const fresh = (list || []).filter((e) => e && e.id && !have.has(e.id));
  // Recall keeps 90 days (like the notifications it sits with), at most 400
  const emails = [...fresh, ...g.emails].filter((e) => (e.at || now) >= now - 90 * DAY).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 400);
  saveGmail({ ...g, emails, last: now }, s);
  // the Overpaying check
  try { const o = loadOverpay(s); saveOverpay({ ...addEmails(o, fresh), added: undefined }, s); } catch (e) {}
  // Money's review list: the payments, as the first 700 letters (the part with the amount), waiting for a tap
  const pays = fresh.filter(isPaymentEmail);
  if (pays.length) { try {
    const wait = JSON.parse((s && s.getItem(WAIT_KEY)) || "[]"), ids = new Set(wait.map((x) => x.id));
    const add = pays.filter((e) => !ids.has(e.id)).map((e) => ({ id: e.id, pkg: "gmail", app: "Gmail", who: e.from, title: e.title || e.from, text: String(e.text || "").slice(0, 700), ts: e.at || now }));
    s && s.setItem(WAIT_KEY, JSON.stringify([...wait, ...add].slice(-600)));
  } catch (e) {} }
  return { added: fresh.length, payments: pays.length };
}

/** Read Gmail now. silent = the daily read (no Google screen). `call` = nativeCall. → { added, payments } */
export async function readGmail(call, { silent = false, days, now = Date.now(), s = ls() } = {}) {
  const g = loadGmail(s);
  const d = days || (g.last ? Math.min(30, Math.max(2, Math.ceil((now - g.last) / DAY) + 1)) : 365);   // the first read: the last year
  const r = await call("gmailRead", { days: d, max: g.last ? 40 : 100, silent });
  if (!silent && !g.on) saveGmail({ ...loadGmail(s), on: true }, s);
  return takeEmails((r && r.emails) || [], { s, now });
}
export const disconnectGmail = (s = ls()) => saveGmail({ on: false, last: 0, emails: [] }, s);

/** The kept emails as Recall's notification-like items (app "Gmail"). */
export const gmailNotes = (s = ls()) => loadGmail(s).emails.map((e) => ({ id: e.id, pkg: "gmail", app: "Gmail", title: [e.from && e.from.replace(/<[^>]+>/, "").trim(), e.title].filter(Boolean).join(" · "), text: e.text, ts: e.at, link: e.link }));
