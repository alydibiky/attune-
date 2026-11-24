/* ---- v10.9.7 the first minute (Ali's OK-FM, 24 Nov 2026 — https://claude.ai/artifact/SRbHba7CwMVSndiLqD7LX7):
   the last 30 days of bank / wallet messages AND Gmail money emails → this month, organised, before the person types anything:
     • the month's spending (money that left, this calendar month, in the home currency)
     • the subscriptions, with a monthly and a yearly number (FM3)
     • "Check this one" — anything Attune is not sure of is ASKED, never saved silently (Ali: "I don't want mistakes")
     • ✎ on every line; a fix is learned per sender for the next message (teach)
   Every amount is read by code from the message itself (paylog.readNotification for SMS, scanread.readScan for emails — the readers
   trained on Ali's real screenshots); the same payment in an SMS and an email is joined once. A foreign amount is turned into the
   home currency only with a rate the person's OWN messages give (a PayPal "3,531.67 EGP = 65.00 USD" line); without one it stays in
   its own currency — never an invented rate. Pure: tests/firstmin/gen.mjs (10,000 HARD), tests/unit/v1097firstmin.test.mjs. */
import { readNotification, categorise } from "./paylog.js";
import { readScan } from "./scanread.js";

export const FM_LEARN_KEY = "attune:fm:learn:v1";   // { senderKey: { name?, cat?, sub?: true|false, notMine?: true } }
export const FM_DONE_KEY = "attune:fm:done:v1";
const DAY = 864e5;
const r2 = (v) => Math.round(v * 100) / 100;
const ls = () => (typeof localStorage !== "undefined" ? localStorage : null);
export function loadLearn(s = ls()) { try { return JSON.parse((s && s.getItem(FM_LEARN_KEY)) || "{}") || {}; } catch (e) { return {}; } }
export function saveLearn(v, s = ls()) { try { s && s.setItem(FM_LEARN_KEY, JSON.stringify(v)); } catch (e) {} return v; }

// the name a person knows a sender by: "Anthropic, PBC <invoice+statements@mail.anthropic.com>" → "anthropic"
export function senderKey(x) {
  const raw = String((x && (x.from || x.who || x.app || x.party)) || "");
  const dom = raw.match(/@([a-z0-9.-]+)/i);
  if (dom) { const parts = dom[1].toLowerCase().split(".").filter((p) => !/^(mail|email|e|info|news|noreply|no-reply|billing|payments?|receipts?|accounts?|notify|notifications?|com|net|org|co|io|eg|ae|sa|uk|us|app)$/.test(p)); return parts[parts.length - 1] || dom[1].toLowerCase(); }
  return raw.replace(/<[^>]*>/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(" ").slice(0, 2).join(" ");
}
const nameOf = (raw) => String(raw || "").replace(/<[^>]*>/g, "").replace(/["']/g, "").replace(/,?\s*(?:inc|llc|ltd|pbc|gmbh|s\.?a\.?e?|plc)\.?$/i, "").trim().slice(0, 40);
const normName = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\b(the|inc|llc|ltd|pbc|com|www)\b/g, " ").trim();
const sameName = (a, b) => { if (Array.isArray(a)) return a.some((v) => sameName(v, b)); if (Array.isArray(b)) return b.some((v) => sameName(a, v));
  const x = normName(a), y = normName(b); if (!x || !y) return false; if (x === y || x.includes(y) || y.includes(x)) return true;
  const wa = new Set(x.split(" ").filter((w) => w.length > 2)); return y.split(" ").some((w) => w.length > 2 && wa.has(w)); };
const ACCOUNT_W = /^(?:حساب|حسابكم|حسابك|بطاقة|بطاقتك|بطاقتكم|كارت|your (?:account|card)|account|card)\b|^(?:حساب|حسابكم|حسابك|بطاقتك|بطاقة)/i;
const PROCESSOR = /paypal|stripe|fawry|payoneer|\bwise\b|paymob|checkout\.com|2checkout|paddle|adyen/i;
// the names a card statement shows: "PAYPAL *ENZU.COM", "GOOGLE *Google One"
const aliasOf = (text) => [...String(text || "").matchAll(/\*\s?([A-Za-z0-9][A-Za-z0-9 .-]{1,24})/g)].map((m) => normName(m[1].replace(/\.(com|net|io|co)\b.*$/i, ""))).filter(Boolean);
// two different shops (UBER and Amazon.eg, both 4,505.75 the same day) are not one payment; a store front / processor (GOOGLE PLAY for
// Spotify, PAYPAL *ENZU, APPLE.COM/BILL) names no shop of its own, so it never clashes
const FRONT = /google|apple|itunes|paypal|play|stripe|payment|card|purchase|حساب|بطاقة|^$/i;
const clash = (o, l) => { const a = [o.name, ...(o.alias || [])], b = [l.name, ...(l.alias || [])];
  if (sameName(a, b) || (o.key && o.key === l.key)) return false;
  const front = (x) => x.src.includes("sms") && !x.src.includes("gmail") && FRONT.test(String(x.name || ""));   // (only a card statement's name; "Google One" is a plan)
  return !front(o) && !front(l); };
const monthly = (amount, cycle) => (cycle === "year" ? amount / 12 : cycle === "week" ? amount * 52 / 12 : cycle === "quarter" ? amount / 3 : amount);

/** One email → what it is ({ kind: "sub" | "spend" | "bill" | "skip" }). */
function readEmail(e, { now, home, order }) {
  const text = [e.title, e.text].filter(Boolean).join("\n");
  let s = null; try { s = readScan(text, { now: e.at || now, home, order }); } catch (er) { s = null; }
  const who = nameOf(String(e.from || "").replace(/<[^>]*>.*/, "")) || senderKey(e);
  if (!s) return { kind: "skip" };
  if (s.kind === "subscription" && s.data && s.data.amount > 0 && !s.data.cancelled) {
    const d = s.data; let cycle = d.cycle || "month", guessed = !!d.cycleGuessed;
    // the period from the email's own dates: "Next billing date" about a month after the payment = monthly (Netflix shows no "/month")
    if (guessed && d.next && e.at) { const gap = (Date.parse(d.next + "T12:00:00") - e.at) / DAY; if (gap >= 25 && gap <= 35) { cycle = "month"; guessed = false; } else if (gap >= 355 && gap <= 372) { cycle = "year"; guessed = false; } else if (gap >= 6 && gap <= 8) { cycle = "week"; guessed = false; } }
    return { kind: "sub", name: d.service || who, amount: d.amount, cur: d.currency || home, cycle, cycleGuessed: guessed, next: d.next || "", last4: d.last4 || "", sure: !!s.sure, why: s.why || "" };
  }
  if (s.kind === "bill" && s.data && s.data.amount > 0) return { kind: "bill", name: s.data.title || who, amount: s.data.amount, cur: s.data.currency || home, due: s.data.due || "", sure: !!s.sure };
  if (s.kind === "receipt" && s.data && s.data.amount > 0 && s.data.direction !== "in") {
    const o = s.data.original; let name = s.data.party || who;
    // a payment processor's receipt (PayPal, Stripe, Fawry…) names the real shop in its first line ("Dash Networks Inc") and on the
    // card statement ("PAYPAL *ENZU.COM") — the line keeps both, so the shop's own invoice is matched to it
    if (PROCESSOR.test(String(e.from || "")) || PROCESSOR.test(name)) {
      const first = String(e.text || "").split("\n").map((x) => x.trim()).find((x) => x && !/^(back|inbox|receipt|payment|paid|details|thank you)$/i.test(x) && !/\d{4}|\d[.,]\d{2}|^[-−+]?[$€£]|@/.test(x));
      if (first) name = nameOf(first);
    }
    return { kind: "spend", name, alias: aliasOf(text), amount: s.data.amount, cur: s.data.currency || home, original: o && o.amount > 0 ? { amount: o.amount, cur: o.currency } : null, sure: !!s.sure };
  }
  return { kind: "skip" };
}

/**
 * The first minute's month. sms: [{id, pkg, app, title, text, ts}] · emails: [{id, from, title, text, at}] (gmail.js) ·
 * learn: what the person fixed before (by sender). → { month, total, spend, subs, subsMonthly, subsYearly, foreign, check, counts }
 */
export function firstMonth({ sms = [], emails = [], now = Date.now(), home = "EGP", order = "dmy", teach, learn = {} } = {}) {
  const lines = [], counts = { sms: 0, emails: 0, joined: 0, skipped: 0 };
  const opts = { home, ...(teach !== undefined ? { teach } : {}) };
  for (const n of sms) {
    if (!n || (n.ts && n.ts < now - 31 * DAY)) continue;
    let r = null; try { r = readNotification(n, opts); } catch (e) { r = null; }
    if (!r || r.direction !== "out") { counts.skipped++; continue; }
    counts.sms++;
    let who = r.party || "";
    // "تم خصم … من حسابكم … عملية شراء من سعودي ماركت": the account is not the shop — the shop after من / عند / at
    if (!who || ACCOUNT_W.test(who)) { const m = String(r.full || n.text || "").match(/(?:عملية شراء من|شراء من|عند|لدى|\bat|\bto)\s+([^\d\n.،,]{2,40}?)(?=\s+(?:بتاريخ|في|يوم|on|with|using|via|was|\d)|[.،,\n]|$)/i); who = m ? m[1].trim() : (ACCOUNT_W.test(who) ? "" : who); }
    who = String(who).replace(/\s+(?:يوم|بتاريخ|في|on|at|with|using)(?:\s.*)?$/i, "").trim() || nameOf(n.title) || n.app || "";
    lines.push({ id: "s:" + n.id, src: ["sms"], ids: [n.id], kind: "spend", name: nameOf(who) || "Payment", amount: r.amount, cur: r.currency || home, ts: r.ts || n.ts || now,
      sure: r.confidence !== "low", key: senderKey({ party: who || n.title || n.app }), cat: categorise(r.text || "", "out"), full: r.full || n.text || "", from: r.from || n.title || "" });
  }
  for (const e of emails) {
    // (v10.9.7 held-out run: Gmail's first read is the last YEAR — a yearly plan, last month's renewal and an older PayPal rate live
    // there; only this month's spending and bills come from the last 31 days)
    if (!e || (e.at && e.at < now - 400 * DAY)) continue;
    const x = readEmail(e, { now, home, order });
    if (x.kind === "skip") { counts.skipped++; continue; }
    const old = e.at && e.at < now - 31 * DAY;
    if (old && x.kind !== "sub") { if (x.kind === "spend" && x.original && e.at >= now - 60 * DAY) lines.push({ id: "e:" + e.id, rateOnly: true, ...x, ts: e.at, src: ["gmail"], ids: [e.id] }); continue; }
    counts.emails++;
    const company = nameOf(String(e.from || "").replace(/<[^>]*>.*/, ""));   // ("Anthropic, PBC" — the card SMS says ANTHROPIC, the email says Claude Pro)
    lines.push({ id: "e:" + e.id, src: ["gmail"], ids: [e.id], ...x, alias: [...(x.alias || []), ...(company && !PROCESSOR.test(company) && !/google play|app store/i.test(company) ? [company] : [])], ts: e.at || now, key: senderKey(e), cat: x.kind === "sub" ? "subscriptions" : categorise([e.title, e.text].join(" "), "out"),
      full: String(e.text || "").slice(0, 2000), from: String(e.from || ""), title: String(e.title || "") });
  }
  // the person's own rates: a receipt that shows both (PayPal "3,531.67 EGP = 65.00 USD")
  const rate = {};
  for (const l of lines.slice().sort((a, b) => a.ts - b.ts)) if (l.original && l.cur === home && l.original.cur && l.original.cur !== home && l.original.amount > 0) rate[l.original.cur] = l.amount / l.original.amount;
  for (let i = lines.length - 1; i >= 0; i--) if (lines[i].rateOnly) lines.splice(i, 1);
  const toHome = (amount, cur) => (cur === home ? amount : rate[cur] ? r2(amount * rate[cur]) : null);
  // the same payment twice (an SMS and an email; an email receipt and its subscription email) → one line, the email's name kept
  const out = [];
  for (const l of lines.slice().sort((a, b) => (a.src[0] === "gmail" ? -1 : 1) - (b.src[0] === "gmail" ? -1 : 1) || a.ts - b.ts)) {
    if (l.kind === "bill") { out.push(l); continue; }
    const hv = toHome(l.amount, l.cur);
    const cands = out.filter((o) => o.kind !== "bill" && Math.abs(o.ts - l.ts) <= 3 * DAY && !o.ids.some((i) => l.ids.includes(i)) && (
      (o.cur === l.cur && Math.abs(o.amount - l.amount) < 0.01 && !clash(o, l)) ||   // (the same currency: the SMS and the email show the SAME amount — two Talabat orders of 6,205.50 and 6,209 are two)
      (o.original && o.original.cur === l.cur && Math.abs(o.original.amount - l.amount) < 0.01) ||
      (l.original && l.original.cur === o.cur && Math.abs(l.original.amount - o.amount) < 0.01) ||
      (o.cur !== l.cur && hv != null && toHome(o.amount, o.cur) != null && Math.abs(toHome(o.amount, o.cur) - hv) <= Math.max(0.5, hv * 0.01) && (sameName(o.name, l.name) || (o.key && o.key === l.key)))));
    // (two subscriptions of the same 46.80 the same day: the one whose name / sender is this message's, and one not already joined to such a message)
    const named = (o) => sameName([o.name, ...(o.alias || [])], [l.name]) || (o.key && o.key === l.key);
    const free = cands.filter((o) => !o.src.includes(l.src[0]));
    const twin = free.find(named) || cands.find(named) || (free.length === 1 ? free[0] : cands.length === 1 ? cands[0] : free[0] || null);
    if (twin && (twin.src.includes(l.src[0]) ? sameName(twin.name, l.name) && twin.kind !== l.kind : true)) {
      counts.joined++;
      twin.src = [...new Set([...twin.src, ...l.src])]; twin.ids = [...twin.ids, ...l.ids];
      if (l.kind === "sub" && twin.kind !== "sub") { const keep = { amount: twin.amount, cur: twin.cur, original: twin.original }; Object.assign(twin, { kind: "sub", name: l.name, cycle: l.cycle, next: l.next, last4: l.last4 || twin.last4, sure: twin.sure && l.sure, cat: "subscriptions" }); if (keep.cur === home && l.cur !== home) Object.assign(twin, keep); }
      if (l.original && !twin.original) twin.original = l.original;
      if (twin.cur !== home && l.cur === home) { twin.original = { amount: twin.amount, cur: twin.cur }; twin.amount = l.amount; twin.cur = home; }
      twin.sure = twin.sure || l.sure; continue;
    }
    out.push({ ...l });
  }
  // a year of receipts for the same plan → the plan once (the newest receipt); a plan whose last payment is long overdue has stopped
  const CYCLE_D = { week: 7, month: 31, quarter: 92, year: 366 }, ended = [];
  { const best = new Map();
    for (const l of out) if (l.kind === "sub") { const k = normName(l.name) + "|" + l.cur; const b = best.get(k); if (!b || l.ts > b.ts) best.set(k, l); }
    for (let i = out.length - 1; i >= 0; i--) { const l = out[i]; if (l.kind !== "sub") continue;
      const b = best.get(normName(l.name) + "|" + l.cur);
      if (b !== l) { counts.history = (counts.history || 0) + 1; if (l.ts >= new Date(now).setDate(1) && b.ts >= new Date(now).setDate(1)) { /* two payments this month: both are spending */ out[i] = { ...l, kind: "spend", cat: "subscriptions", repeat: true }; } else out.splice(i, 1); continue; }
      if (now - l.ts > ((CYCLE_D[l.cycle] || 31) + 7) * DAY) { ended.push(l); out.splice(i, 1); } } }
  // what the person taught before (per sender) wins
  const final = [];
  for (const l of out) {
    const t = learn[l.key] || null;
    if (t && t.notMine) continue;
    if (t && t.name) l.name = t.name;
    if (t && t.cat) l.cat = t.cat;
    if (t && t.sub === false && l.kind === "sub") { l.kind = "spend"; l.cat = t.cat || "other"; }
    if (t && t.sub === true && l.kind === "spend") { l.kind = "sub"; l.cycle = t.cycle || "month"; l.cat = "subscriptions"; }
    if (t) l.sure = true;
    final.push(l);
  }
  // "Check this one" — a bill from a service that is also a subscription (Ali's Enzu: a PayPal payment AND an invoice), or a line read
  // without being sure; a subscription whose period is only guessed
  const check = [];
  for (const l of final) {
    if (l.kind === "bill") {
      const inCur = (o) => (o.cur === l.cur ? monthly(o.amount, o.cycle) : o.original && o.original.cur === l.cur ? o.original.amount : null);
      const sib = final.find((o) => o !== l && o.kind !== "bill" && (sameName([o.name, ...(o.alias || [])], [l.name, l.key]) || (l.key && o.key === l.key)) && inCur(o) != null && Math.abs(inCur(o) - l.amount) <= Math.max(0.5, l.amount * 0.02));
      if (sib && !(learn[l.key] && learn[l.key].billSame != null)) check.push({ id: l.id, q: "same", line: l, with: sib.id });
      continue;
    }
    if (!l.sure) check.push({ id: l.id, q: "amount", line: l });
    else if (l.kind === "sub" && l.cycleGuessed && !(learn[l.key] && learn[l.key].cycle)) check.push({ id: l.id, q: "cycle", line: l });
  }
  const unsure = new Set(check.map((c) => c.id));
  const m0 = new Date(now); m0.setDate(1); m0.setHours(0, 0, 0, 0);
  const spend = [], subs = [], foreign = {}, bills = [];
  let total = 0, subsMonthly = 0;
  for (const l of final.sort((a, b) => b.ts - a.ts)) {
    if (l.kind === "bill") { bills.push(l); continue; }
    const hv = toHome(l.amount, l.cur);
    const row = { ...l, home: hv, unsure: unsure.has(l.id) };
    if (l.kind === "sub") subs.push(row); else spend.push(row);
    if (row.unsure) continue;   // asked first — never counted before the person says
    if (l.ts >= m0.getTime() && l.ts <= now) { if (hv != null) total += hv; else foreign[l.cur] = r2((foreign[l.cur] || 0) + l.amount); }
    if (l.kind === "sub") { const mv = toHome(monthly(l.amount, l.cycle), l.cur); if (mv != null) subsMonthly += mv; }
  }
  subsMonthly = r2(subsMonthly);
  return { month: m0.getMonth(), year: m0.getFullYear(), total: r2(total), foreign, spend, subs, bills, ended, subsMonthly, subsYearly: r2(subsMonthly * 12), check, counts, rate };
}

/** ✎ Save: the line changed by the person + what is learned for the next message from the same sender. */
export function fixLine(learn, line, patch) {
  const key = line.key || ""; if (!key) return learn;
  const was = learn[key] || {};
  const t = { ...was };
  if (patch.name && patch.name !== line.name) t.name = String(patch.name).slice(0, 40);
  if (patch.cat) t.cat = patch.cat;
  if (patch.sub === false || patch.sub === true) t.sub = patch.sub;
  if (patch.cycle) t.cycle = patch.cycle;
  if (patch.notMine) t.notMine = true;
  if (patch.billSame != null) t.billSame = !!patch.billSame;
  return { ...learn, [key]: t };
}
