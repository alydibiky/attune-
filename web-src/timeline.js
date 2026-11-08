/* ---- v6.38 (upgrade M3) — One timeline for all follow-ups: reminders, dates (trials, renewals, returns, warranties, papers),
   People & plans payments, bills that repeat in Money, debts, and the promises people made in chats (Chat X-Ray) — on one
   list by day, each with "what slips if you skip this". Pure: it only reads the same stores those pages keep.
   Tests: tests/unit/v740timeline.test.mjs.                                                                                  */
import { dueList, nameOf } from "./errands.js";
import { tr } from "./i18n.js";
import { scheduleOf } from "./life.js";
import { occurrences } from "./safespend.js";

const DAY = 86400000;
const iso = (t) => { const x = new Date(t); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
const at12 = (s) => Date.parse(s + "T12:00:00");
const num = (v) => (Number(v) > 0 ? Number(v) : 0);

/** The next time a reminder rings at or after `now` (daily / weekly / weekdays move forward; one-off = its own time). */
export function nextRing(r, now) {
  if (!r || r.done || !r.at) return null;
  let t = Number(r.at);
  if (!r.repeat || r.repeat === "none") return t >= now ? t : null;
  const step = r.repeat === "weekly" ? 7 * DAY : DAY;
  if (t < now) t += Math.ceil((now - t) / step) * step;
  if (r.repeat === "weekdays") for (let g = 0; g < 3 && [5, 6].includes(new Date(t).getDay()); g++) t += DAY;   // Fri/Sat off (Egypt's weekend)
  return t;
}

/**
 * → [{ date, kind, what, amount, cur, page, slip: [text, vars], late, id }] sorted by day (late ones first, today, then ahead).
 * kind: reminder | trial | renewal | return | warranty | expiry | other | pay | collect | bill | owe | owed | promise
 * page: the page that owns it (reminders, radar, life, money, xray). `slip` is an English sentence for tr() with its values.
 */
export function timeline({ reminders = [], radar = null, life = null, ledger = null, xray = [], guardian = [], errands = [], now = Date.now(), days = 30, back = 14 } = {}) {
  const today = iso(now), until = iso(now + days * DAY), from = iso(now - back * DAY), out = [];
  const add = (x) => { if (x.date >= from && x.date <= until) out.push({ late: x.date < today, ...x }); };
  for (const r of reminders || []) {
    const t = nextRing(r, now); if (t == null) continue;
    add({ id: "r:" + r.id, date: iso(t), time: t, kind: "reminder", what: r.title || "Reminder", page: "reminders", slip: ["Only a reminder — nothing happens by itself if you skip it."] });
  }
  const SLIP = {
    trial: (x) => x.amount ? ["The free trial turns into a paid plan: {amount}."] : ["The free trial turns into a paid plan."],
    renewal: (x) => x.amount ? ["It renews and charges {amount} again."] : ["It renews and charges you again."],
    return: () => ["The last day to return it — after this you keep it."],
    warranty: () => ["The warranty ends — a repair after this is on you."],
    expiry: () => ["It expires — renewing late can cost a fine or a trip."],
    other: () => ["The date passes."],
  };
  for (const x of (radar && radar.items) || []) {
    if (x.status && x.status !== "active") continue;
    if (!x.date) continue;
    const k = SLIP[x.kind] ? x.kind : "other";
    add({ id: "d:" + x.id, date: x.date, kind: k, what: x.title || k, amount: num(x.amount), cur: x.currency, page: "radar", slip: SLIP[k](x) });
  }
  for (const c of (life && life.items) || []) {
    if (c.done) continue;
    const s = scheduleOf(c, c.kind === "regular" ? now + days * DAY : now);
    for (const p of s) {
      if (p.paid || p.open) continue;   // (an open loan, no date: never late — persona 9)
      // v9.9 FU6: "Didn't come" (skip) is answered for good; "Not yet" asks again the next day (c.later[i] = that day)
      if ((c.skip || []).includes(p.i) || ((c.later || {})[p.i] && c.later[p.i] > today)) continue;
      // a regular day that passed = maybe they didn't come, not "late": kept only for the 7 days a tap may still record it
      // (Ali, 8 Nov: "7 days as the maximum") — FU1 asks "Maid came?" there
      if (c.kind === "regular" && p.date < today && p.date < iso(now - 7 * DAY)) continue;
      const who = c.person || "";
      add({ id: "p:" + c.id + ":" + p.i, date: p.date, kind: c.dir === "in" ? "collect" : "pay", what: [who, c.title || c.kind].filter(Boolean).join(" · "), amount: num(p.amount), cur: c.currency, page: "life", ck: c.kind, ...(c.kind === "regular" ? { late: false } : {}),
        slip: c.dir === "in" ? (who ? ["{who} pays you {amount} — ask if it doesn't come."] : ["{amount} should come in — ask if it doesn't."]) : (who ? ["You pay {who} {amount} — late, and trust drops."] : ["{amount} to pay — late fees or a cut service."]), who });
      if (c.kind !== "regular" && p.date >= today) break;   // only the next one ahead of an installment plan
    }
  }
  const cur0 = (ledger && ledger.currency) || null;
  for (const r of (ledger && ledger.recurring) || []) {
    if (r.active === false || r.type === "income") continue;
    for (const d of occurrences(r, today, until).slice(0, 2)) add({ id: "b:" + (r.id || r.note) + ":" + d, date: d, kind: "bill", what: (r.note || r.cat || "Bill").replace(" ↻", ""), amount: num(r.amount), cur: r.currency || cur0, page: "money", slip: ["{amount} goes out of your money — keep it there."] });
  }
  const left = (d) => num(d.amount) - ((d.payments || []).reduce((a, p) => a + (Number(p.amount) || 0), 0));
  for (const d of (ledger && ledger.debts) || []) {
    if (d.settled || !d.dueDate || left(d) <= 0.004) continue;
    const mine = d.type === "owed_to_me";
    add({ id: "o:" + d.id, date: d.dueDate, kind: mine ? "owed" : "owe", what: d.person || (mine ? "Owed to you" : "You owe"), amount: Math.round(left(d) * 100) / 100, cur: d.currency || cur0, page: "money", who: d.person,
      slip: mine ? ["{who} owes you {amount} — remind them, or it gets forgotten."] : ["You owe {who} {amount} — paying late costs trust."] });
  }
  // promises made to you in chats that are still open
  for (const a of xray || []) {
    const pays = ((a && a.items) || []).filter((x) => x.type === "paid");
    for (const pr of ((a && a.items) || []).filter((x) => x.type === "promise" && x.due)) {
      const who = pr.from || pr.author; if (!who || who === a.me) continue;
      if (pays.some((p) => (p.from || p.author) === who && p.t >= pr.t && (pr.amount == null || p.amount == null || Math.abs(p.amount - pr.amount) < 0.01))) continue;
      add({ id: "x:" + a.id + ":" + pr.t, date: pr.due, kind: "promise", what: who + (pr.what ? " — " + pr.what : ""), amount: num(pr.amount), page: "xray", who,
        slip: ["{who} promised this — follow up, or it slips."] });
    }
  }
  // v8.2 (Ali picked 1A: "follow-ups, guardian, reminders, timeline and dates in one page"): what the Guardian caught is on the list
  // today (a person late with a payment is already here as a late payment, so not twice)
  for (const f of guardian || []) {
    if (!f || f.kind === "late") continue;
    add({ id: "g:" + f.id, date: today, kind: "guardian", what: f.title || "Guardian", T: f.T || null, D: f.D || null, detail: f.detail || "", amount: num(f.amount), cur: f.currency, page: "guardian", slip: ["The Guardian caught this — check it before it costs you."] });
  }
  // v9.8 N3: errands that need you (a licence to renew, a fine to pay, a meter to check) — on their day, late ones on top
  try { for (const d of dueList(errands || [], now)) add({ id: "e:" + d.e.id, date: iso(d.date), kind: "errand", what: nameOf(d.e, false, tr), amount: num(d.amount || 0), page: "errands",
    slip: [d.why === "check" ? "Time to look at the official page." : "Renew it before it expires — a late renewal can cost a fine."] }); } catch (e) {}
  return out.sort((a, b) => a.date.localeCompare(b.date) || (a.time || 0) - (b.time || 0) || b.amount - a.amount);
}

/** The list cut into days: [{ date, items }]; with the totals going out / coming in per currency for the window. */
/** v8.2 the chips on top of Follow-ups: which group an item is in. */
export const GROUP_OF = { errand: "reminders", pay: "money", collect: "money", bill: "money", owe: "money", owed: "money", promise: "money", reminder: "reminders",
  trial: "dates", renewal: "dates", return: "dates", warranty: "dates", expiry: "dates", other: "dates", guardian: "guardian" };
export function byDay(list) {
  const days = [];
  for (const x of list) { const d = days[days.length - 1]; if (d && d.date === x.date) d.items.push(x); else days.push({ date: x.date, items: [x] }); }
  return days;
}
export function totals(list) {
  const out = {}, inn = {};
  for (const x of list) {
    if (!x.amount || x.late) continue;
    const c = x.cur || "";
    if (["collect", "owed"].includes(x.kind)) inn[c] = (inn[c] || 0) + x.amount;
    else if (["pay", "bill", "owe", "trial", "renewal"].includes(x.kind)) out[c] = (out[c] || 0) + x.amount;
  }
  return { out, in: inn };
}
export const daysFrom = (date, now = Date.now()) => Math.round((at12(date) - at12(iso(now))) / DAY);

/* ---- v9.6 (Ali picked F4 + F1, 5 Nov: "integrate them in a good way" — MOCKUPS.md): a week strip on top, one list by day under it.
   weekDays → the 7 days from `start` with a dot for anything due and a red one when money goes out; searchItems → the one box
   filters the list by what, who and kind; byDayLate → everything late in ONE "Late" group first, then each day.               */
const OUT_KINDS = new Set(["pay", "bill", "owe", "trial", "renewal"]);
export function weekDays(list, start, n = 7) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const date = iso(at12(start) + k * DAY), items = (list || []).filter((x) => x.date === date);
    out.push({ date, count: items.length, pays: items.some((x) => OUT_KINDS.has(x.kind) && x.amount > 0) });
  }
  return out;
}
export function searchItems(list, q) {
  const s = String(q || "").trim().toLowerCase(); if (s.length < 2) return list || [];
  const words = s.split(/\s+/).filter((w) => w.length >= 2);
  return (list || []).filter((x) => { const hay = [x.what, x.who, x.kind, x.detail, x.cur, x.amount ? String(x.amount) : ""].filter(Boolean).join(" ").toLowerCase(); return words.every((w) => hay.includes(w)); });
}
export function byDayLate(list, now = Date.now()) {
  const today = iso(now), late = (list || []).filter((x) => x.date < today), rest = (list || []).filter((x) => x.date >= today);
  return [...(late.length ? [{ date: "late", items: late }] : []), ...byDay(rest)];
}

/* ---- v9.8 FU1 (Ali picked "one feed: Today · This week · Later" — MOCKUPS.md, https://claude.ai/artifact/2QaqFEiB5AyWHcmugbaZfC; he
   said Follow-ups was "so confusing and scattered"). → { today: [late first, then today's], week: [the next 7 days], later: [the rest] },
   each in time order. Pure; tests/unit/v980fu1.test.mjs. */
export function feedOf(list = [], now = Date.now()) {
  const today = iso(now), week = iso(now + 7 * DAY), by = (a, b) => a.date.localeCompare(b.date) || (a.time || 0) - (b.time || 0);
  const late = list.filter((x) => x.date < today).sort(by).map((x) => ({ ...x, late: x.ck !== "regular" }));   // a regular day that passed is a question, not late
  return { today: [...late, ...list.filter((x) => x.date === today).sort(by)], week: list.filter((x) => x.date > today && x.date <= week).sort(by), later: list.filter((x) => x.date > week).sort(by) };
}
/** What a row does when its box is ticked: "pay" (a payment you make — recorded in Money), "ask" (did the person pay?), "done" (a
 *  reminder), "errand" (its page: a licence needs the new date), "" (no box: a date to watch, a promise — a tap opens its page).
 *  Money only by a tap for today and the 7 days before (Ali, 8 Nov). */
export function actionOf(x, now = Date.now()) {
  const d = daysFrom(x.date, now);
  if (x.page === "life" && x.kind === "pay" && ["regular", "subscription", "bill", "rent"].includes(x.ck)) return d <= 0 && d >= -7 ? "pay" : "";
  if (x.page === "life" && x.kind === "collect" && ["debt", "installment"].includes(x.ck)) return d <= 0 && d >= -7 ? "ask" : "";
  if (x.kind === "reminder") return d <= 0 ? "done" : "";
  if (x.kind === "errand") return "errand";
  return "";
}
