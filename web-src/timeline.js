/* ---- v6.38 (upgrade M3) — One timeline for all follow-ups: reminders, dates (trials, renewals, returns, warranties, papers),
   People & plans payments, bills that repeat in Money, debts, and the promises people made in chats (Chat X-Ray) — on one
   list by day, each with "what slips if you skip this". Pure: it only reads the same stores those pages keep.
   Tests: tests/unit/v740timeline.test.mjs.                                                                                  */
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
export function timeline({ reminders = [], radar = null, life = null, ledger = null, xray = [], guardian = [], now = Date.now(), days = 30, back = 14 } = {}) {
  const today = iso(now), until = iso(now + days * DAY), from = iso(now - back * DAY), out = [];
  const add = (x) => { if (x.date >= from && x.date <= until) out.push({ ...x, late: x.date < today }); };
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
      if (p.paid) continue;
      if (c.kind === "regular" && p.date < today) continue;   // a regular day that passed = they didn't come, not late
      const who = c.person || "";
      add({ id: "p:" + c.id + ":" + p.i, date: p.date, kind: c.dir === "in" ? "collect" : "pay", what: [who, c.title || c.kind].filter(Boolean).join(" · "), amount: num(p.amount), cur: c.currency, page: "life", ck: c.kind,
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
  return out.sort((a, b) => a.date.localeCompare(b.date) || (a.time || 0) - (b.time || 0) || b.amount - a.amount);
}

/** The list cut into days: [{ date, items }]; with the totals going out / coming in per currency for the window. */
/** v8.2 the chips on top of Follow-ups: which group an item is in. */
export const GROUP_OF = { pay: "money", collect: "money", bill: "money", owe: "money", owed: "money", promise: "money", reminder: "reminders",
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
