/* ---- v9.8 I1 Autopilot (Ali, 7 Nov: "I1 ok" — MOCKUPS.md, https://claude.ai/artifact/2QaqFEiB5AyWHcmugbaZfC "what I understood"):
   every kept notification, understood (notifmeaning.js), becomes ONE suggested card — waiting for one tap:
     a bank debit → an expense (with its category) · a credit → income · "Arriving Thursday" → a follow-up on Thursday that closes
     itself on "Delivered" · a message that asks for something («ابعتلي الورق بكرة») → a to-do tomorrow · two missed calls from the same
     person → "call back" · "bill due 15th" → a bill to pay on the 15th.
   Nothing is saved without a tap (Add / Not this). After 3 accepted of the same kind from the same app it asks "do these by yourself
   from now on?"; then they are added alone and listed as "done for you", each with Undo. Never twice: the bank SMS and the bank app's
   notification for the same amount are one; an expense already typed is matched, not added again. "Not this" teaches it (that app's
   offers are never suggested again). One-time codes are never kept (RecallLog.kt). Pure; tests/unit/v980autopilot.test.mjs.        */
import { isChatApp } from "./paylog.js";   // v9.9.9 (Ali: a WhatsApp group's wages became income)
import { understandNote } from "./notifmeaning.js";

export const AP_KEY = "attune:autopilot:v1";
export const emptyState = () => ({ v: 1, seen: {}, ok: {}, no: {}, always: [], asked: [], done: [], skipApps: [] });
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
const ASKS = /\b(send|bring|call|pay|transfer|remind|don't forget|please|can you|could you|tomorrow|tonight)\b|ابعت|ابعتلي|هات|كلمني|اتصل|حول|حوّل|ادفع|متنساش|ماتنساش|بكرة|بكره|النهارده|بليل|لو سمحت|ممكن/i;

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
const OFFER_W = /\b(get|try|free for|save|discount|deal|offer|limited time|\d+\s*%|for just|starting at|join now|upgrade now|ends soon|trial ends)\b|جرب|عرض|خصم \d|وفر/i;
const curOf = (t) => { const m = /\b(egp|usd|sar|aed|eur|gbp|kwd|qar|try)\b|(e£|£|\$|€|جنيه|ريال|درهم)/i.exec(String(t || "")); if (!m) return ""; const k = (m[1] || m[2]).toLowerCase(); return { "e£": "EGP", "جنيه": "EGP", "$": "USD", "€": "EUR", "£": "GBP", "ريال": "SAR", "درهم": "AED" }[k] || k.toUpperCase(); };

/** One notification → one suggestion (or null). s = the Autopilot state; recent = the other notifications (for missed calls). */
export function suggestFrom(n, { now = Date.now(), recent = [], s = emptyState() } = {}) {
  if (!n) return null;
  const u = understandNote(n), app = String(n.app || n.pkg || ""), text = String(n.text || ""), title = String(n.title || "");
  if ((s.skipApps || []).includes(app + ":" + u.kind)) return null;
  const base = { src: String(n.id), app, at: n.ts || now, kind: "", full: { title, text } };   // (v9.8: the whole message, to read before adding)
  { const all = title + " " + text, svc = subOf(all);
    if (svc && u.amount > 0 && !isChatApp(n) && u.kind !== "promo" && u.state !== "money in" && PAID_W.test(all) && !OFFER_W.test(all)) {
      const d = iso(n.ts || now);
      return { ...base, kind: "subscription", title: svc, amount: u.amount, cur: curOf(all), date: d, key: "sb:" + svc + ":" + d.slice(0, 7), line: "Subscription" };
    } }
  if (u.kind === "bank" && u.amount > 0 && !isChatApp(n) && (u.state === "money out" || u.state === "money in")) {   // v9.9.9: never from a chat
    const shop = shopIn(title + " " + text), out = u.state === "money out";
    return { ...base, kind: out ? "expense" : "income", amount: u.amount, cat: out ? catOf(shop + " " + text) : "other", note: shop || app, date: iso(n.ts || now),
      key: (out ? "x:" : "i:") + Math.round(u.amount * 100) + ":" + iso(n.ts || now), line: (out ? "Expense" : "Income") };
  }
  if (u.kind === "delivery") {
    if (u.state === "delivered") return { ...base, kind: "delivered", key: "dl:" + app, line: "Delivered" };
    const when = dayIn(text + " " + title, n.ts || now) || 0;
    if (when) return { ...base, kind: "followup", at: when, title: "Delivery · " + app.replace(/ shopping$/i, "") + (text ? " — " + text.slice(0, 60) : ""), key: "dv:" + app + ":" + iso(when), line: "Follow-up" };
    return null;
  }
  if (u.kind === "message" && u.who && ASKS.test(text)) {
    const when = dayIn(text, n.ts || now) || at9((n.ts || now) + DAY);
    return { ...base, kind: "todo", at: when, who: u.who, title: u.who.replace(/\s*\(.*\)\s*$/, "").replace(/\s+\d[\d ]*$/, "") + ": " + text.slice(0, 80), key: "td:" + String(n.id), line: "To-do" };
  }
  if (u.kind === "call" && u.who) {
    const same = (recent || []).filter((r) => r.id !== n.id && Math.abs((r.ts || 0) - (n.ts || 0)) < DAY && (() => { const v = understandNote(r); return v.kind === "call" && v.who === u.who; })());
    if (same.length >= 1 || /whatsapp|telegram|messenger|viber|botim|imo/i.test(app + " " + (n.pkg || ""))) return { ...base, kind: "callback", at: now + 15 * 60000, who: u.who, title: "Call back " + u.who, key: "cb:" + u.who + ":" + iso(n.ts || now), line: "Call back" };
    return null;
  }
  if (u.kind === "bill" && u.amount > 0 && /\bdue\b|مستحق|آخر ميعاد|اخر ميعاد/i.test(title + " " + text)) {
    const when = dayIn(text + " " + title, n.ts || now) || at9((n.ts || now) + 3 * DAY);
    return { ...base, kind: "bill", amount: u.amount, at: when, title: app + " bill", key: "bl:" + app + ":" + iso(when), line: "Bill" };
  }
  return null;
}

/** Already in the money book? (the same amount, same day, same direction — typed by hand or from the other copy of the notice) */
export function inLedger(x, ledger) {
  if (!ledger || !(x.kind === "expense" || x.kind === "income")) return false;
  return (ledger.txns || []).some((t) => t.type === x.kind && Math.abs((+t.amount || 0) - x.amount) < 0.01 && String(t.date || "").slice(0, 10) === x.date);
}

/** Every waiting suggestion: newest first, one per key, minus what was added, said no to, or is in Money already. */
export function suggestions(notes = [], { now = Date.now(), s = emptyState(), ledger = null, days = 3 } = {}) {
  const since = now - days * DAY, keys = new Set(), out = [];
  const list = [...notes].filter((n) => (n.ts || 0) >= since).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  for (const n of list) {
    const x = suggestFrom(n, { now, recent: list, s }); if (!x || x.kind === "delivered") continue;
    if (keys.has(x.key) || s.ok[x.key] || s.no[x.key] || inLedger(x, ledger)) continue;
    // a subscription whose expense is already in Money (the bank SMS came first) adds only the plan
    if (x.kind === "subscription") x.noMoney = inLedger({ kind: "expense", amount: x.amount, date: x.date }, ledger);
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
/** Done by itself without asking: what the person allowed — and (v9.9) a subscription payment, unless they said "not these" */
export const isAuto = (s, x) => (s.always || []).includes(ruleOf(x)) || (x.kind === "subscription" && !(s.skipApps || []).includes(x.app + ":subscription"));
/** Accepted (by a tap or by itself): remembered, counted; after 3 of the same rule → ask once "do these by yourself?" */
export function accept(s, x, { auto = false, rid = "", now = Date.now() } = {}) {
  const r = ruleOf(x), count = Object.values(s.ok).filter((v) => v.rule === r).length + 1;
  const done = auto ? [{ key: x.key, kind: x.kind, app: x.app, title: x.title || x.note || "", amount: x.amount || 0, at: now, rid }, ...(s.done || [])].slice(0, 60) : (x.kind === "followup" ? [{ key: x.key, kind: x.kind, app: x.app, title: x.title, at: now, rid }, ...(s.done || [])].slice(0, 60) : s.done || []);
  return { ...s, ok: { ...s.ok, [x.key]: { rule: r, at: now, auto } }, done, ask: !auto && count >= 3 && !s.always.includes(r) && !s.asked.includes(r) ? r : s.ask || "" };
}
export function refuse(s, x, { app = false } = {}) {
  return { ...s, no: { ...s.no, [x.key]: Date.now() }, skipApps: app ? [...new Set([...(s.skipApps || []), x.app + ":" + (x.kind === "expense" || x.kind === "income" ? "bank" : x.kind === "followup" ? "delivery" : x.kind)])] : s.skipApps || [] };
}
export const allow = (s, rule, yes) => ({ ...s, always: yes ? [...new Set([...s.always, rule])] : s.always, asked: [...new Set([...s.asked, rule])], ask: "" });
export const undoDone = (s, key) => { const { [key]: _, ...ok } = s.ok; return { ...s, ok, no: { ...s.no, [key]: Date.now() }, done: (s.done || []).filter((d) => d.key !== key) }; };
/** "Autopilot did 31 things for you this week" */
export const weekCount = (s, now = Date.now()) => Object.values(s.ok || {}).filter((v) => v.at > now - 7 * DAY).length;

/** A suggestion → the actions the Home box would run (doit.js apply). */
export function actionsFor(x) {
  if (x.kind === "expense" || x.kind === "income") return [{ kind: "money", items: [{ type: x.kind, amount: x.amount, cat: x.cat || "other", note: x.note || "", date: x.date, source: "notification" }] }];
  if (x.kind === "subscription") return [{ kind: "subPay", name: x.title, amount: x.amount, date: x.date, cur: x.cur || "", key: x.key },
    ...(x.noMoney ? [] : [{ kind: "money", items: [{ type: "expense", amount: x.amount, cat: "bills", note: x.title, date: x.date, source: "notification" }] }])];
  if (x.kind === "bill") return [{ kind: "life", c: { kind: "bill", dir: "out", amount: x.amount, count: 1, total: x.amount, every: null, start: iso(x.at), title: x.title, person: "", paid: [], currency: "" } }];
  return [{ kind: "reminder", action: { kind: "reminder", at: x.at, title: x.title } }];
}
export function loadAP() { try { return { ...emptyState(), ...JSON.parse(localStorage.getItem(AP_KEY) || "{}") }; } catch (e) { return emptyState(); } }
export function saveAP(s) { try { localStorage.setItem(AP_KEY, JSON.stringify(s)); } catch (e) {} return s; }
