/* ---- v6.34 (Ali: "the maid comes every Saturday and takes 600 EGP — when I log in on Saturday and tick that she came, it
   records the expense automatically"): a tick on a "regular" (life.js kind "regular") writes the expense straight into Money's
   ledger — no question asked — and an untick takes that same entry out again. Used by People & plans and Home.
   Tests: tests/unit/v737fixes.test.mjs, tests/e2e_v737maid.py.                                                                  */
import { loadLife, saveLife, togglePaid, tickEntry } from "./life.js";
import { loadRadar, saveRadar, resolveDeadline, updateDeadline } from "./deadlines.js";
import { appendToLedger } from "./paylog.js";
import { loadLedger } from "./myledger.js";

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
    const r = appendToLedger(led, [{ type: "expense", amount: e.amount, currency: e.currency, cat: c.kind === "rent" ? "rent" : "bills", note: e.note, date: new Date(e.ts).toISOString().slice(0, 10) }], now);
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

/** v6.34 (Ali): a Radar renewal's day came — "Paid?" Yes → the expense in Money (its date, cat bills) and the renewal is done
 *  ("renewed"); No → done as "cancelled" (the Guardian counts it as kept). → { recorded, data } */
export function payRadar(id, paid, { store, now = Date.now() } = {}) {
  const ls = store || (typeof localStorage !== "undefined" ? localStorage : null);
  let data = loadRadar(ls); const x = data.items.find((i) => i.id === id); if (!x) return { recorded: 0, data };
  let recorded = 0;
  if (paid) {
    const led = loadLedger(ls);
    if (led) {
      const r = appendToLedger(led, [{ type: "expense", amount: x.amount, currency: x.currency, cat: "bills", note: (x.title || "Renewal") + " · " + x.date, date: x.date }], now);
      if (r.ids.length) { try { ls.setItem("ledger.v3", JSON.stringify(r.ledger)); recorded = x.amount; data = updateDeadline(data, id, { txn: r.ids[0] }); } catch (e) {} }
    }
    if (!recorded) return { recorded: 0, data };   // no Money yet: nothing changes (the caller opens Money)
  }
  data = resolveDeadline(data, id, paid ? "renewed" : "cancelled", now).data;
  saveRadar(data, ls);
  return { recorded, data };
}
