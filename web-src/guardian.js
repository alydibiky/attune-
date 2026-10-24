/* ---- v6.27: the Money Guardian — "Attune pays for itself" (Ali, 13 Oct 2026: "something that will make people pay") ----------
   It reads the person's own data on the phone (Money's ledger — logged by itself from notifications —, People & plans,
   Money's bills) and finds money, by CODE, never guessed:
     late       someone owes you and is late           → a polite reminder to send (WhatsApp)    saved when it comes back
     double     the same charge twice within minutes    → dispute it with the bank                saved when you mark it refunded
     creep      a regular payment went up               → the yearly cost of the rise             saved when you mark it fixed
     subs       subscriptions you pay every month       → the yearly total, to review             saved when you cancel one
     fees       bank fees and commissions this month    → the total
     due        a bill due in the next 3 days           → pay before the late fee
   The SAVED counter only counts what the person did and marked (honest: it is the number Pro is sold on).
   Pure logic; store "attune:guardian:v1" = { saved: [{id, kind, amount, at, what}], dismissed: [ids] }.
   Tests: tests/unit/v727guardian.test.mjs.                                                                              */
import { progressOf } from "./life.js";
import { homeCurrency } from "./locale.js";

const DAY = 86400000;
const iso = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const money = (n) => (Math.round(n * 100) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 });
/** "CARREFOUR · CIB" / "Carrefour Maadi" → "carrefour" — the merchant a payment was made to. */
// v6.27 global: legal forms, branch words and store numbers are dropped ("STARBUCKS #1234 LONDON GB" → "starbucks")
const NOT_MERCHANT = /\b(egypt|eg|maadi|cairo|branch|store|market|s\.?a\.?e|inc|llc|ltd|limited|plc|gmbh|ag|sarl|sas|srl|spa|bv|nv|pty|pvt|co|corp|company|sa|sl|ltda|tbk|bhd|sdn|kk|online|pos|purchase|card|visa|mastercard|debit|credit|www|com|us|uk|gb|de|fr|es|it|in|ae|sa|london|paris|new york|dubai|riyadh)\b|#\s*\d+|\b\d{3,}\b/g;
export const merchantOf = (note) => String(note || "").split(/ · | - |—|\*/)[0].toLowerCase().replace(/[^\p{L}\p{N}# ]/gu, " ").replace(NOT_MERCHANT, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 2).join(" ");
export const SUBS = /netflix|shahid|spotify|osn|watch ?it|youtube|icloud|google one|google storage|apple\.com\/bill|apple music|apple tv|apple one|anghami|disney|hulu|hbo|paramount|peacock|prime video|amazon prime|crunchyroll|deezer|tidal|audible|kindle unlimited|xbox|game ?pass|playstation|ps plus|nintendo|steam|microsoft 365|office 365|onedrive|dropbox|chatgpt|openai|claude|gemini|copilot|canva|adobe|figma|notion|evernote|grammarly|duolingo|babbel|headspace|calm\b|strava|peloton|linkedin|patreon|onlyfans|twitch|tinder|bumble|hinge|nordvpn|expressvpn|surfshark|1password|lastpass|gym|fitness|نتفليكس|شاهد|انغامي|أنغامي|اشتراك|(?<![\p{L}])(abonnement|suscripción|suscripcion|assinatura|abbonamento|abonelik|langganan|abo|mitgliedschaft|membresía|adhésion)(?![\p{L}])/iu;
const FEES = /\b(fee|fees|commission|charges?|service charge|maintenance fee|annual fee|stamp|overdraft|late fee|atm fee|foreign transaction|fx fee)\b|عمولة|عموله|رسوم|مصاريف إدارية|دمغة|(?<![\p{L}])(frais|commission|cotisation|agios|comisión|comision|cargo por|tarifa|taxa|tarifa bancária|gebühr|gebühren|entgelt|kontoführung|commissione|canone|spese|ücret|masraf|komisyon|biaya|biaya admin|kosten|provisie|комиссия|手续费|수수료|手数料)(?![\p{L}])/iu;

/** Everything the Guardian finds now. → [{ id, kind, title, detail, amount (EGP at stake), action }] */
export function findings({ ledger, life, now = Date.now(), dismissed = [], lang }) {
  const out = [], skip = new Set(dismissed), cur = homeCurrency(ledger);
  const txns = ((ledger && ledger.txns) || []).filter((t) => t && t.amount > 0 && t.date);
  const exp = txns.filter((t) => t.type === "expense");
  const add = (f) => { if (!skip.has(f.id)) out.push({ currency: cur, ...f }); };

  // late: People & plans — someone owes you and the date has passed
  for (const c of (life && life.items) || []) {
    if (c.dir !== "in" || !c.person) continue;
    const late = progressOf(c, now).schedule.filter((s) => !s.paid && s.date < iso(now));
    if (!late.length) continue;
    const amt = late.reduce((a, s) => a + s.amount, 0), days = Math.round((now - Date.parse(late[0].date + "T12:00:00")) / DAY);
    add({ id: "late:" + c.id + ":" + late[0].i, kind: "late", amount: amt, person: c.person, days, commitment: c.id,
      title: `${c.person} is ${days} day${days === 1 ? "" : "s"} late`, detail: `${money(amt)} ${c.currency || cur} due since ${late[0].date}`,
      action: "remind", message: reminderText(c, late[0], days, lang),
      T: [days === 1 ? "{p} is 1 day late" : "{p} is {n} days late", { p: c.person, n: days }], D: ["{a} due since {d}", { a: `${money(amt)} ${c.currency || cur}`, d: late[0].date }] });
  }
  // double: the same amount at the same merchant within 10 minutes
  // v7.9 (Ali: "I don't know where that came from"): each finding carries the two payments (shown on the card). "Charged twice"
  // is said only when both have a time and they are minutes apart and neither was typed by hand; without times, or when one
  // came from a notification and the other was typed, it ASKS ("Same payment twice?") — logged twice is far more likely.
  const tm = (t) => t.ts || t.created || 0;
  const brief = (t) => ({ id: t.id, date: t.date, amount: t.amount, note: t.note || "", account: t.account || "", at: tm(t) || null, source: t.source || "" });
  const byM = new Map();
  for (const t of exp) { const k = merchantOf(t.note) + "|" + t.amount; (byM.get(k) || byM.set(k, []).get(k)).push(t); }
  for (const [k, list] of byM) {
    if (list.length < 2 || !k.split("|")[0]) continue;
    list.sort((a, b) => (tm(a) || Date.parse(a.date)) - (tm(b) || Date.parse(b.date)));
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1], b = list[i], timed = !!(tm(a) && tm(b)), gap = Math.abs(tm(b) - tm(a));
      if (a.date !== b.date || a.id === b.id || (timed ? gap > 10 * 60000 : a.note !== b.note)) continue;
      const mixed = (a.source === "notification") !== (b.source === "notification");
      const sure = timed && !mixed, m = titleCase(merchantOf(b.note)), amt = `${money(b.amount)} ${cur}`;
      add({ id: "double:" + (b.id || k + b.date), kind: "double", sure, amount: b.amount, txns: [brief(a), brief(b)],
        title: sure ? `Charged twice at ${m}` : `Same payment twice at ${m}?`,
        detail: sure ? `${amt} twice on ${b.date} — ask your bank to refund one` : `${amt} twice on ${b.date} — logged twice, or charged twice?`, action: "dispute",
        T: [sure ? "Charged twice at {m}" : "Same payment twice at {m}?", { m }],
        D: [sure ? "{a} twice on {d} — ask your bank to refund one" : "{a} twice on {d} — logged twice, or charged twice?", { a: amt, d: b.date }] });
    }
  }
  // creep: a payment made every month to the same merchant went up ≥ 5 %
  const monthly = new Map();
  for (const t of exp) { const m = merchantOf(t.note); if (!m) continue; (monthly.get(m) || monthly.set(m, []).get(m)).push(t); }
  for (const [m, list] of monthly) {
    const months = [...new Set(list.map((t) => t.date.slice(0, 7)))].sort();
    if (months.length < 3) continue;
    const per = months.map((mo) => list.filter((t) => t.date.startsWith(mo)).reduce((a, t) => a + t.amount, 0));
    const last = per[per.length - 1], before = per.slice(0, -1), avg = before.reduce((a, x) => a + x, 0) / before.length;
    const steady = before.every((x) => Math.abs(x - avg) <= avg * 0.05);
    if (steady && last >= avg * 1.05 && list.filter((t) => t.date.startsWith(months[months.length - 1])).length === 1) {
      const rise = last - avg;
      add({ id: "creep:" + m + ":" + months[months.length - 1], kind: "creep", amount: rise * 12, title: `${titleCase(m)} went up ${Math.round((rise / avg) * 100)}%`,
        detail: `${money(avg)} → ${money(last)} ${cur} a month: ${money(rise * 12)} more a year`, action: "review",
        T: ["{m} went up {n}%", { m: titleCase(m), n: Math.round((rise / avg) * 100) }], D: ["{a} → {b} a month: {y} more a year", { a: money(avg), b: `${money(last)} ${cur}`, y: `${money(rise * 12)} ${cur}` }] });
    }
    // subs: paid every month (3 of the last 3 months) to a subscription
    if (SUBS.test(m + " " + list.map((t) => t.note).join(" ")) && months.length >= 3) {
      const lastAmt = per[per.length - 1];
      add({ id: "subs:" + m, kind: "subs", amount: lastAmt * 12, title: `${titleCase(m)}: ${money(lastAmt * 12)} ${cur} a year`,
        detail: `Paid every month since ${months[0]}. Still using it?`, action: "cancel", monthly: lastAmt,
        T: ["{m}: {a} a year", { m: titleCase(m), a: `${money(lastAmt * 12)} ${cur}` }], D: ["Paid every month since {d}. Still using it?", { d: months[0] }] });
    }
  }
  // fees: bank fees and commissions this month
  const mo = iso(now).slice(0, 7), fees = exp.filter((t) => t.date.startsWith(mo) && FEES.test((t.note || "") + " " + (t.cat || "")));
  if (fees.length) {
    const tot = fees.reduce((a, t) => a + t.amount, 0);
    add({ id: "fees:" + mo, kind: "fees", amount: tot, title: `${money(tot)} ${cur} in bank fees this month`, detail: `${fees.length} fee${fees.length === 1 ? "" : "s"} — ask your bank, or switch to a free account`, action: "review",
      T: ["{a} in bank fees this month", { a: `${money(tot)} ${cur}` }], D: ["{n} fees — ask your bank, or switch to a free account", { n: fees.length }] });
  }
  // due: a bill in the next 3 days (Money's bills)
  for (const r of (ledger && ledger.recurring) || []) {
    if (r.active === false || r.type === "income" || !r.nextDate) continue;
    if (r.nextDate >= iso(now) && r.nextDate <= iso(now + 3 * DAY))
      add({ id: "due:" + (r.id || r.note) + ":" + r.nextDate, kind: "due", amount: Number(r.amount) || 0, title: `${r.note || "A bill"} due ${r.nextDate === iso(now) ? "today" : r.nextDate}`, detail: "Pay it before the late fee", action: "pay",
        T: r.nextDate === iso(now) ? ["{b} due today", { b: r.note || "A bill" }] : ["{b} due {d}", { b: r.note || "A bill", d: r.nextDate }], D: ["Pay it before the late fee", {}] });
  }
  const order = { late: 0, double: 1, due: 2, creep: 3, fees: 4, subs: 5 };
  return out.sort((a, b) => order[a.kind] - order[b.kind] || b.amount - a.amount);
}
/** v7.9: "Logged twice — remove one": the ledger without that payment (Money is not open on the Guardian page, so its saved
 *  ledger is written directly, the way the notification reader does). → the new ledger, or null when it isn't there. */
export function removeTxn(ledger, id) {
  if (!ledger || !Array.isArray(ledger.txns) || !id || !ledger.txns.some((t) => t && t.id === id)) return null;
  return { ...ledger, txns: ledger.txns.filter((t) => !(t && t.id === id)) };
}
const titleCase = (s) => String(s || "").replace(/\b\p{L}/gu, (c) => c.toUpperCase());

/** A polite reminder in the person's language (Egyptian Arabic for an Arabic name, else English) — written by code. */
// v6.27 global: Arabic (neutral, every Arab country) when the name or the app is in Arabic, else English; the person
// edits it in their messaging app before it goes. More languages: add a line to REMIND.
const REMIND = {
  en: (n, a, w, d) => `Hi ${n}, hope you're well! Just a friendly reminder about ${a}${w}, due on ${d}. Thanks a lot 🙏`,
  ar: (n, a, w, d) => `مرحبًا ${n}، أتمنى أن تكون بخير. أذكّرك بلطف بمبلغ ${a}${w} الذي كان موعده ${d}. شكرًا جزيلًا 🙏`,
};
export function reminderText(c, s, days, lang) {
  const amt = money(s.amount) + " " + (c.currency || homeCurrency()), ar = lang === "ar" || /[؀-ۿ]/.test(c.person || "");
  const which = c.kind === "installment" ? (ar ? ` (القسط ${s.i + 1} من ${c.count})` : ` (installment ${s.i + 1} of ${c.count})`) : "";
  return (ar ? REMIND.ar : REMIND.en)(c.person, amt, which, s.date);
}

// ---- the honest counter ----
export const G_KEY = "attune:guardian:v1";
export const loadGuardian = (store = typeof localStorage !== "undefined" ? localStorage : null) => { try { const j = JSON.parse((store && store.getItem(G_KEY)) || "null"); return j && Array.isArray(j.saved) ? j : { saved: [], dismissed: [] }; } catch (e) { return { saved: [], dismissed: [] }; } };
export const saveGuardian = (g, store = typeof localStorage !== "undefined" ? localStorage : null) => { try { store && store.setItem(G_KEY, JSON.stringify(g)); } catch (e) {} return g; };
/** The person did it (got refunded, cancelled, collected…): count it once. A cancelled subscription counts one month now. */
export function markSaved(g, f, now = Date.now()) {
  if (g.saved.some((x) => x.id === f.id)) return g;
  const amount = f.kind === "subs" ? f.monthly || f.amount / 12 : f.kind === "creep" ? f.amount / 12 : f.amount;
  return { ...g, saved: [...g.saved, { id: f.id, kind: f.kind, amount: Math.round(amount * 100) / 100, at: now, what: f.title }], dismissed: [...(g.dismissed || []), f.id] };
}
export const dismiss = (g, id) => ({ ...g, dismissed: [...(g.dismissed || []), id] });
/** Saved this month and in all. A cancelled subscription keeps counting one month for every month since it was cancelled. */
export function savedTotals(g, now = Date.now()) {
  const mo = iso(now).slice(0, 7); let month = 0, all = 0;
  for (const s of g.saved || []) {
    if (s.kind === "subs" || s.kind === "creep") {
      const start = new Date(s.at), n = Math.max(1, (new Date(now).getFullYear() - start.getFullYear()) * 12 + new Date(now).getMonth() - start.getMonth() + 1);
      all += s.amount * n; month += s.amount;
    } else { all += s.amount; if (iso(s.at).slice(0, 7) === mo) month += s.amount; }
  }
  return { month: Math.round(month), all: Math.round(all) };
}
/** "Collected": a late payment that came back after a reminder counts as saved — called when People & plans ticks it. */
export function collected(g, commitmentId, i, amount, now = Date.now()) {
  const id = "late:" + commitmentId + ":" + i;
  if (!(g.reminded || []).includes(id) || g.saved.some((x) => x.id === id)) return g;
  return { ...g, saved: [...g.saved, { id, kind: "late", amount, at: now, what: "Collected after a reminder" }] };
}
export const noteReminded = (g, id) => ({ ...g, reminded: [...new Set([...(g.reminded || []), id])] });
