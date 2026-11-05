/* ---- v6.34 (Ali: "the maid comes every Saturday and takes 600 EGP — when I log in on Saturday and tick that she came, it
   records the expense automatically"): a tick on a "regular" (life.js kind "regular") writes the expense straight into Money's
   ledger — no question asked — and an untick takes that same entry out again. Used by People & plans and Home.
   Tests: tests/unit/v737fixes.test.mjs, tests/e2e_v737maid.py.                                                                  */
import { loadLife, saveLife, togglePaid, tickEntry, payAmount, progressOf } from "./life.js";
import { loadRadar, saveRadar, resolveDeadline, updateDeadline } from "./deadlines.js";
import { appendToLedger } from "./paylog.js";
import { loadLedger } from "./myledger.js";

// v8.9 (Ali: "the maid's 600 got recorded in Bills although there is a Maid category"): the category for a tick —
// 1) the one the person chose last time for this same commitment (they edited it: learn), 2) a category of theirs whose name
// matches who / what it is (maid, driver, tutor, gym, internet, Netflix…), 3) rent → rent, else bills.
const SYN = [/maid|housekeep|cleaner|cleaning|nanny|babysit|شغال|خدام|دادة|داده|نظاف|مربي/i, /driver|سواق|سائق/i, /tutor|teacher|lesson|درس|مدرس|معلم/i,
  /gym|coach|trainer|جيم|مدرب/i, /internet|wifi|wi-fi|نت\b|انترنت|إنترنت/i, /phone|mobile|موبايل|تليفون/i, /electric|كهربا/i, /water|مياه|مية/i, /gas|غاز/i,
  /doorman|bawab|بواب/i, /car wash|غسيل العربية/i, /nurse|ممرض/i, /club|نادي/i, /school|مدرسة|مدارس/i];
export function catForCommitment(led, c, note = "") {
  if (c && c.cat) return c.cat;
  const key = [c && c.person, c && c.title].filter(Boolean).join(" ").trim().toLowerCase();
  if (led && key) {
    const past = (led.txns || []).filter((t) => t && t.type === "expense" && t.cat && String(t.note || "").toLowerCase().startsWith(key)).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    if (past.length) return past[0].cat;
  }
  const words = [c && c.title, c && c.person, c && c.role, note].filter(Boolean).join(" ");
  const cats = ((led && led.customCats) || []).filter((x) => !x.type || x.type === "expense");
  for (const x of cats) {
    const names = [x.id, x.en, x.name, x.ar].filter(Boolean).map(String);
    for (const n of names) {
      const esc = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (n.length >= 2 && new RegExp("(^|[^\\p{L}])" + esc + "($|[^\\p{L}])", "iu").test(words)) return x.id;
      const g = SYN.find((r) => r.test(n)); if (g && g.test(words)) return x.id;
    }
  }
  return c && c.kind === "rent" ? "rent" : "bills";
}

/** Tick (on) / untick payment i of commitment `id`. → { data, recorded: amount or 0, removed: bool }. With no Money ledger yet
 *  the tick is kept and recorded = 0 (the caller hands the sentence to Money instead). */
export function tickRegular(id, i, on, { store, now = Date.now() } = {}) {
  const ls = store || (typeof localStorage !== "undefined" ? localStorage : null);
  let data = loadLife(ls);
  const c = data.items.find((x) => x.id === id); if (!c) return { data, recorded: 0, removed: false };
  const was = (c.paid || []).includes(i);
  if (was !== !!on) data = togglePaid(data, id, i);
  const rec = { ...(c.rec || {}) };
  let recorded = 0, removed = false;
  const led = loadLedger(ls);
  if (on && !rec[i] && led) {
    const e = tickEntry(c, i, now);
    const r = appendToLedger(led, [{ type: c.dir === "in" ? "income" : "expense", amount: e.amount, currency: e.currency, cat: c.dir === "in" ? "other" : catForCommitment(led, c, e.note), note: e.note, date: new Date(e.ts).toISOString().slice(0, 10) }], now);
    if (r.ids.length) { try { ls.setItem("ledger.v3", JSON.stringify(r.ledger)); rec[i] = r.ids[0]; recorded = e.amount; } catch (x) {} }
  } else if (!on && rec[i] && led) {
    const L = { ...led, txns: led.txns.filter((t) => t.id !== rec[i]) };
    try { ls.setItem("ledger.v3", JSON.stringify(L)); removed = L.txns.length < led.txns.length; } catch (x) {}
    delete rec[i];
  }
  data = { ...data, items: data.items.map((x) => (x.id === id ? { ...x, rec } : x)) };
  saveLife(data, ls);
  return { data, recorded, removed };
}

/** v9.5 (Ali, 5 Nov: "when the date comes it asks me if the person really paid, like the Sheikh — when I tick it is recorded in
 *  revenue; if he paid more or less, like 4,000, I write it and the other payments are distributed again"): payment i of a
 *  person's debt / instalments was paid with `amount` (what was due if left out) → the plan is ticked with that amount (the rest
 *  is spread again by scheduleOf) and it is written in Money at once: income when it came to you, an expense when you paid.
 *  → { data, recorded, left, next } */
export function payPerson(id, i, amount, { store, now = Date.now() } = {}) {
  const ls = store || (typeof localStorage !== "undefined" ? localStorage : null);
  let data = loadLife(ls);
  const c0 = data.items.find((x) => x.id === id); if (!c0) return { data, recorded: 0, left: 0, next: null };
  const due = (progressOf(c0, now).schedule[i] || {}).amount || c0.amount || 0;
  const v = amount == null || amount === "" ? due : +amount;
  if (!(v >= 0)) return { data, recorded: 0, left: 0, next: null };
  data = payAmount(data, id, i, v);
  const c = data.items.find((x) => x.id === id);
  const rec = { ...(c.rec || {}) };
  let recorded = 0;
  const led = loadLedger(ls);
  if (led && v > 0) {
    if (rec[i]) led.txns = led.txns.filter((t) => t.id !== rec[i]);   // asked again: the old entry is replaced
    const e = tickEntry(c, i, now);
    const r = appendToLedger(led, [{ type: c.dir === "in" ? "income" : "expense", amount: v, currency: e.currency, cat: c.dir === "in" ? "other" : catForCommitment(led, c, e.note), note: e.note, date: new Date(now).toISOString().slice(0, 10) }], now);
    if (r.ids.length) { try { ls.setItem("ledger.v3", JSON.stringify(r.ledger)); rec[i] = r.ids[0]; recorded = v; } catch (x) {} }
  }
  data = { ...data, items: data.items.map((x) => (x.id === id ? { ...x, rec } : x)) };
  saveLife(data, ls);
  const pr = progressOf(data.items.find((x) => x.id === id), now);
  return { data, recorded, left: pr.left || 0, next: pr.next || null };
}

/** v9.5: "Not yet" — payment i is asked again tomorrow (not today any more). */
export function notYet(id, i, { store, now = Date.now() } = {}) {
  const ls = store || (typeof localStorage !== "undefined" ? localStorage : null);
  const data = loadLife(ls), d = new Date(now + 86400000);
  const day = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const out = { ...data, items: data.items.map((x) => (x.id === id ? { ...x, later: { ...(x.later || {}), [i]: day } } : x)) };
  saveLife(out, ls); return out;
}

/** v6.34 (Ali): a Radar renewal's day came — "Paid?" Yes → the expense in Money (its date, cat bills) and the renewal is done
 *  ("renewed"); No → done as "cancelled" (the Guardian counts it as kept). → { recorded, data } */
export function payRadar(id, paid, { store, now = Date.now() } = {}) {
  const ls = store || (typeof localStorage !== "undefined" ? localStorage : null);
  let data = loadRadar(ls); const x = data.items.find((i) => i.id === id); if (!x) return { recorded: 0, data };
  let recorded = 0;
  if (paid) {
    const led = loadLedger(ls);
    if (led) {
      const r = appendToLedger(led, [{ type: "expense", amount: x.amount, currency: x.currency, cat: catForCommitment(led, { title: x.title, kind: "bill", cat: x.cat }, x.title), note: (x.title || "Renewal") + " · " + x.date, date: x.date }], now);
      if (r.ids.length) { try { ls.setItem("ledger.v3", JSON.stringify(r.ledger)); recorded = x.amount; data = updateDeadline(data, id, { txn: r.ids[0] }); } catch (e) {} }
    }
    if (!recorded) return { recorded: 0, data };   // no Money yet: nothing changes (the caller opens Money)
  }
  data = resolveDeadline(data, id, paid ? "renewed" : "cancelled", now).data;
  saveRadar(data, ls);
  return { recorded, data };
}
