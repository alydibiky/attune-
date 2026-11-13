/* ---- v9.8 I1 Autopilot (Ali, 7 Nov: "I1 ok" — MOCKUPS.md, https://claude.ai/artifact/2QaqFEiB5AyWHcmugbaZfC "what I understood"):
   every kept notification, understood (notifmeaning.js), becomes ONE suggested card — waiting for one tap:
     a bank debit → an expense (with its category) · a credit → income · "Arriving Thursday" → a follow-up on Thursday that closes
     itself on "Delivered" · a message that asks for something («ابعتلي الورق بكرة») → a to-do tomorrow · two missed calls from the same
     person → "call back" · "bill due 15th" → a bill to pay on the 15th.
   Nothing is saved without a tap (Add / Not this). After 3 accepted of the same kind from the same app it asks "do these by yourself
   from now on?"; then they are added alone and listed as "done for you", each with Undo. Never twice: the bank SMS and the bank app's
   notification for the same amount are one; an expense already typed is matched, not added again. "Not this" teaches it (that app's
   offers are never suggested again). One-time codes are never kept (RecallLog.kt). Pure; tests/unit/v980autopilot.test.mjs.        */
import { isChatApp, readNotification, codeSure } from "./paylog.js";   // v9.9.9 (Ali: a WhatsApp group's wages became income)
import { understandNote } from "./notifmeaning.js";
import { findSub } from "./subpay.js";
import { notAPayment, fromPhoneNumber } from "./notifwords.js";   // v9.9.17 one list for all four readers
import { understandNote as readMeaning } from "./notelabels.js";

export const AP_KEY = "attune:autopilot:v1";
export const emptyState = () => ({ v: 1, seen: {}, ok: {}, no: {}, always: [], asked: [], done: [], skipApps: [], manual: [] });
const DAY = 864e5;
const iso = (t) => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const at9 = (t) => { const d = new Date(t); d.setHours(9, 0, 0, 0); return d.getTime(); };

// what a shop / payee is spent on
const CAT = [[/carrefour|seoudi|spinneys|hyper|metro market|kazyon|oscar|gourmet|بقال|سوبر ?ماركت|خضار/i, "groceries"], [/talabat|elmenus|mcdonald|kfc|pizza|cafe|coffee|starbucks|restaurant|مطعم|كافيه/i, "food"],
  [/uber|careem|indrive|didi|swvl|bolt|fuel|petrol|gas station|wataniya|total|mobil|chillout|بنزين/i, "transport"], [/pharmac|صيدلي|hospital|clinic|lab/i, "health"],
  [/vodafone|orange|etisalat|\bwe\b|electric|water|gas bill|internet/i, "bills"], [/amazon|noon|jumia|shein|zara|h&m|lc waikiki|mall/i, "shopping"]];
export const catOf = (t) => (CAT.find(([re]) => re.test(String(t || ""))) || [null, "other"])[1];
const shopIn = (text) => { const m = /\b(?:at|@|from|لدى|في|عند)\s+([A-Z0-9][A-Za-z0-9&' .-]{1,30}?)(?=\s+(?:on|card|بطاقة|using|ref|\d)|[.,]|$)/.exec(String(text || "")); return m ? m[1].trim() : ""; };

const WEEKDAY = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, "الأحد": 0, "الاحد": 0, "الاثنين": 1, "الإثنين": 1, "الثلاثاء": 2, "الأربعاء": 3, "الاربعاء": 3, "الخميس": 4, "الجمعة": 5, "السبت": 6 };
/** "Arriving Thursday" / "arrives tomorrow" / "by 12 Nov" → that day (ms, 9:00), else 0. */
export function dayIn(text, now) {
  const t = String(text || "");
  if (/\b(today|اليوم|النهارده)\b/i.test(t)) return at9(now);
  if (/\b(tomorrow|بكرة|بكره|غدا|غداً)\b/i.test(t)) return at9(now + DAY);
  const w = /\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b|(الأحد|الاحد|الاثنين|الإثنين|الثلاثاء|الأربعاء|الاربعاء|الخميس|الجمعة|السبت)/i.exec(t);
  if (w) { const k = (w[1] || w[2]).toLowerCase().slice(0, w[1] ? 3 : 20), want = WEEKDAY[k]; if (want != null) { const d = new Date(now); const add = (want - d.getDay() + 7) % 7; return at9(now + add * DAY); } }
  const dm = /\b(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i.exec(t) || /\b(\d{1,2})(?:st|nd|rd|th)\b/i.exec(t);
  if (dm) { const d = new Date(now), day = +dm[1]; const mon = dm[2] ? "janfebmaraprmayjunjulaugsepoctnovdec".indexOf(dm[2].slice(0, 3).toLowerCase()) / 3 : d.getMonth();
    let x = new Date(d.getFullYear(), mon, day, 9); if (x.getTime() < at9(now)) x = dm[2] ? new Date(d.getFullYear() + 1, mon, day, 9) : new Date(d.getFullYear(), d.getMonth() + 1, day, 9); return x.getTime(); }
  return 0;
}
// a message that asks you to do something (or says when)
// v9.9.17 (the 10,000-notification run): "see you tomorrow", "tonight was fun", "I'll call you tomorrow", "thanks for calling" made
// to-dos — a day word alone asks for nothing, and "I'll call you" is THEIR job; a to-do needs a request
const ASKS0 = /\b(send|bring|pay|transfer|remind|don't forget|dont forget|please|pls|can you|could you|pick up|call (?:me|us|him|her|them|the|dr|mr|your))\b|ابعت|ابعتلي|هات|كلمني|اتصل|(?<![ء-ي])حول|حوّل|ادفع|متنساش|ماتنساش|لو سمحت|ممكن/i;
const NOT_ASK = /^\s*(?:thanks?|thank you|شكرا)\b|\b(?:i'?ll|i will|we'?ll|i can|let me) (?:call|send|bring|pay|transfer|pick)\b|\b(?:i|we) (?:sent|paid|transferred|called|brought)\b|\bthanks for (?:calling|sending|paying)\b|(?<![ء-ي])ه(?:بعت|كلم|جيب|دفع|حول)/i;
const ASKS = { test: (x) => ASKS0.test(x) && !NOT_ASK.test(x) };

// v9.9 (Ali, 9 Nov: "there was a Google one which told me the payment of Gemini, and it wasn't recorded in subscriptions automatically —
// I want users to make low effort and the app makes the most effort"): a payment to a service that only comes as a subscription →
// added to Subscriptions (People & plans, every month) and the expense to Money, BY ITSELF (listed as "done for you" with Undo)
export const SUBS = [
  [/gemini|google one|google ai (?:pro|premium|ultra|plus)|جيميني|جوجل ون/i, "Google Gemini"], [/youtube premium|youtube music|يوتيوب بريميوم/i, "YouTube Premium"],
  [/netflix|نتفليكس/i, "Netflix"], [/spotify|سبوتيفاي/i, "Spotify"], [/shahid|شاهد vip|شاهد في اي بي/i, "Shahid"], [/\bosn\+?|osn plus/i, "OSN+"],
  [/watch ?it|واتش ات/i, "WATCH IT"], [/anghami|انغامي|أنغامي/i, "Anghami"], [/icloud|apple music|apple tv|apple one/i, "Apple"],
  [/chatgpt|openai/i, "ChatGPT"], [/claude\.ai|anthropic|claude pro/i, "Claude"], [/disney\+|disney plus/i, "Disney+"],
  [/amazon prime|prime video/i, "Amazon Prime"], [/canva/i, "Canva"], [/adobe|creative cloud/i, "Adobe"], [/microsoft 365|office 365|xbox game pass|game pass/i, "Microsoft"],
  [/playstation plus|ps plus/i, "PlayStation Plus"], [/duolingo/i, "Duolingo"], [/linkedin premium/i, "LinkedIn Premium"], [/google play pass/i, "Google Play Pass"],
  [/starzplay|starz play/i, "STARZPLAY"], [/notion/i, "Notion"], [/capcut/i, "CapCut"], [/tinder|bumble/i, "Dating app"],
];
export const subOf = (t) => (SUBS.find(([re]) => re.test(String(t || ""))) || [null, ""])[1];
const PAID_W = /\b(paid|payment|charged|renew(?:ed|al)|receipt|billed|purchase|subscription|subscribed|membership|order|invoice|debited|successful)\b|تم الدفع|دفعت|تم خصم|اتخصم|خصم مبلغ|اشتراك|تجديد|تم تجديد|فاتورة|عملية شراء|ايصال|إيصال/i;
const DUE_W = /\b(?:is |are )?(?:now )?(?:due|overdue|payable)\b|pay (?:it |now )?before|\bdue (?:on|by|date|in)\b|مستحق|آخر ميعاد|اخر ميعاد|السداد قبل|سدد قبل/i;
const BILL_W = /\b(bill|invoice|installment|instalment|fees?|fine|tax|rent|premium|payment)\b|فاتور|قسط|مخالف|مصاريف|رسوم|ضريب|ايجار|إيجار/i;
const OFFER_W = /\b(get|try|free for|save|discount|deal|offer|limited time|\d+\s*%|for just|starting at|join now|upgrade now|ends soon|trial ends)\b|جرب|عرض|(?<!تم )خصم \d|وفر/i;
const curOf = (t) => { const m = /\b(egp|usd|sar|aed|eur|gbp|kwd|qar|try)\b|(e£|£|\$|€|جنيه|ج\.م|ريال|درهم)/i.exec(String(t || "")); if (!m) return ""; const k = (m[1] || m[2]).toLowerCase(); return { "e£": "EGP", "جنيه": "EGP", "ج.م": "EGP", "$": "USD", "€": "EUR", "£": "GBP", "ريال": "SAR", "درهم": "AED" }[k] || k.toUpperCase(); };

// v9.9.12: the day the receipt says it was paid ("Order date: 7 Nov 2026", "Receipt from 7 Nov 2026") — the plan renews on that day,
// not on the day the notification was read
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
export function paidDayOf(t, now = Date.now()) {
  const m = /(?:order date|receipt from|date|paid on|charged on|تاريخ الطلب|بتاريخ)\s*:?\s*(\d{1,2})\s+([a-z]{3})[a-z]*\.?,?\s+(\d{4})/i.exec(String(t || ""));
  if (!m || !MON[m[2].toLowerCase()]) return "";
  const d = m[3] + "-" + String(MON[m[2].toLowerCase()]).padStart(2, "0") + "-" + String(+m[1]).padStart(2, "0");
  const ms = Date.parse(d + "T12:00:00");
  return ms && ms <= now + 864e5 && ms > now - 60 * 864e5 ? d : "";
}
/** One notification → one suggestion (or null). s = the Autopilot state; recent = the other notifications (for missed calls). */
export function suggestFrom(n, { now = Date.now(), recent = [], s = emptyState() } = {}) {
  if (!n) return null;
  const u = understandNote(n), app = String(n.app || n.pkg || ""), text = String(n.text || ""), title = String(n.title || "");
  if ((s.skipApps || []).includes(app + ":" + u.kind)) return null;
  const base = { src: String(n.id), app, at: n.ts || now, kind: "", full: { title, text } };   // (v9.8: the whole message, to read before adding)
  // v9.9.17 (the 10,000-notification run): the cards skipped the checks Money's list has — "You will be billed EGP 1,438", "your
  // payment was declined", a code "for your purchase of EGP 567", «سيتم خصم قسط القرض», a prize text became a subscription / an
  // expense / income card. One list for every reader (notifwords.js); an advert or a video is never a card either.
  const all0 = title + " " + text, no = notAPayment(all0, n), lab = (() => { try { return readMeaning(n); } catch (e) { return null; } })(), left = !!(lab && lab.sure && (lab.meaning === "ads" || lab.meaning === "notmoney"));
  const smsFrom = /messag|\bsms\b|mms|رسائل/i.test(app + " " + String(n.pkg || "")) && title && !fromPhoneNumber(n) ? title : app;
  // a bill that is DUE (not paid yet) — whatever kind the app is: "You have a new gas bill: EGP 648 due 5 Dec" (Fawry), «فاتورتك ٢٨٩٨ ر.س مستحقة»
  if (!isChatApp(n) && !left && no !== "code" && no !== "scam" && no !== "person" && u.amount > 0 && DUE_W.test(all0) && BILL_W.test(all0) && !/\b(paid|thank|received your payment|successful(?:ly)?)\b|تم (?:سداد|دفع|الدفع)/i.test(all0)) {
    const when = dayIn(text + " " + title, n.ts || now) || at9((n.ts || now) + 3 * DAY);
    return { ...base, kind: "bill", amount: u.amount, at: when, title: smsFrom + " bill", key: "bl:" + smsFrom + ":" + iso(when), line: "Bill", sure: true };
  }
  { const all = all0, svc = subOf(all);
    if (svc && u.amount > 0 && !isChatApp(n) && !no && !left && u.kind !== "promo" && !(u.state === "money in" && !/payment(?:[^.\n]|\.\d){0,40}received|received your payment/i.test(all)) && PAID_W.test(all) && !OFFER_W.test(all)) {
      const d = paidDayOf(all, n.ts || now) || iso(n.ts || now);
      return { ...base, kind: "subscription", title: svc, amount: u.amount, cur: curOf(all), date: d, key: "sb:" + svc + ":" + d.slice(0, 7), line: "Subscription" };
    } }
  // v9.9.30 (Ali: "not keep asking — really smart"): a shop's / an app's receipt ("Your payment of EGP 3,942.00 was successful",
  // "total charged EGP 5458.00 to card 6907") is an expense Attune adds by itself — it was asked "You paid … add it?" before.
  // If the bank's SMS for it comes too, Money sees the same amount that day and keeps it once (paylog.alreadyIn).
  if (!(u.kind === "bank" && (u.state === "money out" || u.state === "money in")) && u.amount > 0 && !isChatApp(n) && !no && !left && lab && lab.meaning === "paid" && lab.sure) {
    const shop = shopIn(title + " " + text) || (/messag|\bsms\b|gmail|mail|outlook/i.test(app) ? title : app);
    return { ...base, kind: "expense", amount: u.amount, cat: catOf(shop + " " + app + " " + text), note: shop, date: iso(n.ts || now), via: "receipt", sure: true,
      key: "x:" + Math.round(u.amount * 100) + ":" + iso(n.ts || now), line: "Expense" };
  }
  if (u.kind === "bank" && u.amount > 0 && !isChatApp(n) && !no && !left && (u.state === "money out" || u.state === "money in")) {
    // v9.9.30: a bank / wallet message Money is sure of goes into Money by itself — no card on Home asking for a tap
    { let e = null; try { e = readNotification(n); } catch (x) {} if (e && codeSure(e)) return null; }   // v9.9.9: never from a chat
    const shop = shopIn(title + " " + text), out = u.state === "money out";
    const rc = out && !!(lab && lab.meaning === "paid" && lab.sure) && !/messag|\bsms\b|mms|رسائل/i.test(app + " " + String(n.pkg || ""));   // a shop's receipt (Steam, Booking.com), not a bank SMS: sure (v9.9.30)
    return { ...base, kind: out ? "expense" : "income", amount: u.amount, cat: out ? catOf(shop + " " + text) : "other", note: shop || app, date: iso(n.ts || now), ...(rc ? { via: "receipt", sure: true } : {}),
      key: (out ? "x:" : "i:") + Math.round(u.amount * 100) + ":" + iso(n.ts || now), line: (out ? "Expense" : "Income") };
  }
  if (u.kind === "delivery") {
    if (u.state === "delivered") return { ...base, kind: "delivered", key: "dl:" + app, line: "Delivered" };
    const when = dayIn(text + " " + title, n.ts || now) || 0;
    if (when) return { ...base, kind: "followup", sure: true, at: when, title: "Delivery · " + app.replace(/ shopping$/i, "") + (text ? " — " + text.slice(0, 60) : ""), key: "dv:" + app + ":" + iso(when), line: "Follow-up" };
    return null;
  }
  // v9.9.31: a request the model understood (Russian, Chinese, Franco, a long message) — its reading is kept by notification id
  const mind = (() => { try { return (typeof localStorage !== "undefined" && (JSON.parse(localStorage.getItem("attune:notifmind:v1") || "{}") || {})[String(n.id)]) || null; } catch (e) { return null; } })();
  if (u.kind === "message" && u.who && !ASKS.test(text) && mind && mind.by === "code+model" && mind.sure && mind.intent === "request" && /^(?:do|pay|submit|call_back|pickup)$/.test(mind.action)) {
    const when = mind.due && mind.due.date ? Date.parse(mind.due.date + "T" + (mind.due.time || "09:00") + ":00") : at9((n.ts || now) + DAY);
    return { ...base, kind: "todo", sure: true, at: when, who: u.who, title: u.who.replace(/\s*\(.*\)\s*$/, "") + ": " + (mind.summary || text).slice(0, 80), key: "td:" + String(n.id), line: "To-do" };
  }
  if (u.kind === "message" && u.who && ASKS.test(text)) {
    const when = dayIn(text, n.ts || now) || at9((n.ts || now) + DAY);
    return { ...base, kind: "todo", sure: true, at: when, who: u.who, title: u.who.replace(/\s*\(.*\)\s*$/, "").replace(/\s+\d[\d ]*$/, "") + ": " + text.slice(0, 80), key: "td:" + String(n.id), line: "To-do" };
  }
  if (u.kind === "call" && u.who) {
    const same = (recent || []).filter((r) => r.id !== n.id && Math.abs((r.ts || 0) - (n.ts || 0)) < DAY && (() => { const v = understandNote(r); return v.kind === "call" && v.who === u.who; })());
    if (same.length >= 1 || /whatsapp|telegram|messenger|viber|botim|imo/i.test(app + " " + (n.pkg || ""))) return { ...base, kind: "callback", sure: true, at: now + 15 * 60000, who: u.who, title: "Call back " + u.who, key: "cb:" + u.who + ":" + iso(n.ts || now), line: "Call back" };
    return null;
  }
  if (u.kind === "bill" && u.amount > 0 && /\bdue\b|مستحق|آخر ميعاد|اخر ميعاد/i.test(title + " " + text)) {
    const when = dayIn(text + " " + title, n.ts || now) || at9((n.ts || now) + 3 * DAY);
    return { ...base, kind: "bill", amount: u.amount, at: when, title: app + " bill", key: "bl:" + app + ":" + iso(when), line: "Bill", sure: true };
  }
  return null;
}

/** Already in the money book? (the same amount, same day, same direction — typed by hand or from the other copy of the notice) */
export function inLedger(x, ledger) {
  if (!ledger || !(x.kind === "expense" || x.kind === "income")) return false;
  return (ledger.txns || []).some((t) => t.type === x.kind && Math.abs((+t.amount || 0) - x.amount) < 0.01 && String(t.date || "").slice(0, 10) === x.date);
}

/** Every waiting suggestion: newest first, one per key, minus what was added, said no to, or is in Money already. */
export function suggestions(notes = [], { now = Date.now(), s = emptyState(), ledger = null, days = 3, life = null } = {}) {
  // v9.9.13: a subscription receipt counts for 14 days (Ali's Google AI Pro receipt of 7 Nov was gone after 3); the rest for `days`
  const since = now - Math.max(days, 14) * DAY, keys = new Set(), out = [];
  const list = [...notes].filter((n) => (n.ts || 0) >= since).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  for (const n of list) {
    const x = suggestFrom(n, { now, recent: list, s }); if (!x || x.kind === "delivered") continue;
    if (x.kind !== "subscription" && (n.ts || 0) < now - days * DAY) continue;
    if (keys.has(x.key) || s.ok[x.key] || s.no[x.key] || inLedger(x, ledger)) continue;
    // a subscription whose expense is already in Money (the bank SMS came first) adds only the plan
    if (x.kind === "subscription") x.noMoney = inLedger({ kind: "expense", amount: x.amount, date: x.date }, ledger);
    // v9.9.13 (Ali: "an option whether to deduct from my balance or not — this subscription is paid by my father"): someone else pays
    // it → only the plan (and its reminder), never Money; a NEW subscription waits for "Who pays it?" before anything leaves Money
    if (x.kind === "subscription" && life) { const c = findSub(life, x.title);
      if (!c) { x.noMoney = true; x.askPayer = true; } else if (c.payer && c.payer !== "me") x.noMoney = true; else if (c.account) x.account = c.account; }
    keys.add(x.key); out.push(x);
  }
  return out;
}
/** "Delivered" notices → the delivery follow-ups that are now done (their reminder ids, to remove). */
export function deliveredDone(notes = [], s = emptyState()) {
  const apps = new Set(notes.map((n) => { const x = suggestFrom(n, { s }); return x && x.kind === "delivered" ? x.app : null; }).filter(Boolean));
  return (s.done || []).filter((d) => d.kind === "followup" && apps.has(d.app) && !d.closed).map((d) => d.rid).filter(Boolean);
}

/** The kind of a suggestion as "auto" sees it: CIB expenses, Amazon deliveries… */
export const ruleOf = (x) => x.kind + ":" + x.app;
/** Done by itself without asking: what the person allowed, a subscription payment (v9.9), and (v9.9.30, Ali: "not keep asking")
 *  everything Attune is SURE of — a delivery's day, a bill that is due, a call back, a to-do someone asked for, a receipt — each
 *  listed under "done for you" with Undo. An Undo (or "not these") turns that kind from that app back into a card that waits. */
export const isAuto = (s, x) => !(s.manual || []).includes(ruleOf(x)) && ((s.always || []).includes(ruleOf(x)) || (x.kind === "subscription" && !(s.skipApps || []).includes(x.app + ":subscription")) || !!x.sure);
/** Accepted (by a tap or by itself): remembered, counted; after 3 of the same rule → ask once "do these by yourself?" */
export function accept(s, x, { auto = false, rid = "", now = Date.now() } = {}) {
  const r = ruleOf(x), count = Object.values(s.ok).filter((v) => v.rule === r).length + 1;
  const done = auto ? [{ key: x.key, kind: x.kind, app: x.app, title: x.title || x.note || "", amount: x.amount || 0, at: now, rid, ...(x.noMoney ? { noMoney: true } : {}) }, ...(s.done || [])].slice(0, 60) : (x.kind === "followup" ? [{ key: x.key, kind: x.kind, app: x.app, title: x.title, at: now, rid }, ...(s.done || [])].slice(0, 60) : s.done || []);
  return { ...s, ok: { ...s.ok, [x.key]: { rule: r, at: now, auto } }, done, ask: !auto && count >= 3 && !s.always.includes(r) && !s.asked.includes(r) ? r : s.ask || "" };
}
export function refuse(s, x, { app = false } = {}) {
  return { ...s, no: { ...s.no, [x.key]: Date.now() }, skipApps: app ? [...new Set([...(s.skipApps || []), x.app + ":" + (x.kind === "expense" || x.kind === "income" ? "bank" : x.kind === "followup" ? "delivery" : x.kind)])] : s.skipApps || [] };
}
export const allow = (s, rule, yes) => ({ ...s, always: yes ? [...new Set([...s.always, rule])] : s.always, asked: [...new Set([...s.asked, rule])], ask: "" });
export const undoDone = (s, key) => { const { [key]: _, ...ok } = s.ok, d = (s.done || []).find((x) => x.key === key);
  // (v9.9.30) undoing something done alone = "ask me about these": that kind from that app waits for a tap from now on
  const manual = d && d.kind ? [...new Set([...(s.manual || []), d.kind + ":" + d.app])] : s.manual || [];
  return { ...s, ok, no: { ...s.no, [key]: Date.now() }, done: (s.done || []).filter((x) => x.key !== key), manual, always: (s.always || []).filter((r) => !d || r !== d.kind + ":" + d.app) }; };
/** "Autopilot did 31 things for you this week" */
export const weekCount = (s, now = Date.now()) => Object.values(s.ok || {}).filter((v) => v.at > now - 7 * DAY).length;

/** A suggestion → the actions the Home box would run (doit.js apply). */
export function actionsFor(x) {
  if (x.kind === "expense" || x.kind === "income") return [{ kind: "money", items: [{ type: x.kind, amount: x.amount, cat: x.cat || "other", note: x.note || "", date: x.date, source: x.via === "receipt" ? "receipt" : "notification" }] }];
  if (x.kind === "subscription") return [{ kind: "subPay", name: x.title, amount: x.amount, date: x.date, cur: x.cur || "", key: x.key },
    ...(x.noMoney ? [] : [{ kind: "money", items: [{ type: "expense", amount: x.amount, cat: "bills", note: x.title, date: x.date, source: "notification", ...(x.account ? { account: x.account } : {}) }] }])];
  if (x.kind === "bill") return [{ kind: "life", c: { kind: "bill", dir: "out", amount: x.amount, count: 1, total: x.amount, every: null, start: iso(x.at), title: x.title, person: "", paid: [], currency: "" } }];
  return [{ kind: "reminder", action: { kind: "reminder", at: x.at, title: x.title } }];
}
export function loadAP() { try { return { ...emptyState(), ...JSON.parse(localStorage.getItem(AP_KEY) || "{}") }; } catch (e) { return emptyState(); } }
export function saveAP(s) { try { localStorage.setItem(AP_KEY, JSON.stringify(s)); } catch (e) {} return s; }
