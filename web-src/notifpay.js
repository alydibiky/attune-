/* ---- v9.9.18 AU7 Buttons on Attune's notifications (Ali picked A + B combined, 11 Nov 2026: "following up — if I choose Paid it
   stays popped and asks Cash, CIB or Vodafone Cash"). A payment reminder's notification has Paid · Tomorrow · In 1 hour; after Paid
   the SAME notification asks from which balance (skipped with one balance), then shows ✓ with Undo. The phone (Reminders.kt) only
   records what was tapped, each tap with its own id; the page turns the taps into Money EXACTLY ONCE when it opens (applyTaps).
   Pure; tests: tests/notifpay (10,000 tap sequences) + tests/unit/v9918notifpay.test.mjs.                                          */

/** What the phone needs to show the buttons — built by the page when it schedules a payment reminder.
 *  item: { amount, currency, note, cat }, accounts: [{ id, name }] (the person's Money balances), labels: tr() words. */
export function payButtons(item, accounts = [], labels = {}) {
  const accs = (accounts || []).filter((a) => a && a.id).slice(0, 3).map((a) => ({ id: String(a.id), name: String(a.name || a.id).slice(0, 24) }));
  return { amount: +item.amount || 0, currency: item.currency || "", note: String(item.note || "").slice(0, 80), cat: item.cat || "other",
    accounts: accs, more: Math.max(0, (accounts || []).length - 3),
    labels: { paid: labels.paid || "Paid", tomorrow: labels.tomorrow || "Tomorrow", hour: labels.hour || "In 1 hour", which: labels.which || "Paid {a} — from which balance?", done: labels.done || "✓ {a} from {b}", undo: labels.undo || "Undo", open: labels.open || "Open Attune" } };
}

/** The taps the phone kept → what to do, once each. state = { seen: { tapId: 1 }, paid: { reminderId: txnId } } (kept by the page).
 *  taps: [{ id, rid, act: "paid" | "acct" | "tomorrow" | "hour" | "undo", acct, at }] in the order tapped.
 *  pays: { reminderId: payButtons(...) }. → { state, add: [txn], remove: [txnId], move: [{ rid, at }], done: [rid] } */
export function applyTaps(taps = [], pays = {}, state = { seen: {}, paid: {} }, now = Date.now()) {
  const st = { seen: { ...(state.seen || {}) }, paid: { ...(state.paid || {}) } };
  const out = { add: [], remove: [], move: [], done: [] };
  const waiting = {};   // reminder → Paid tapped, balance not yet
  const record = (rid, acct, at) => {
    if (st.paid[rid]) return;   // already in Money: a second Paid / balance tap adds nothing
    const p = pays[rid]; if (!p || !(p.amount > 0)) return;
    const txnId = "np-" + rid + "-" + at;
    out.add.push({ id: txnId, type: "expense", amount: p.amount, currency: p.currency, cat: p.cat, note: p.note, account: acct || (p.accounts[0] && p.accounts[0].id) || "", date: isoDay(at), src: "notification" });
    st.paid[rid] = txnId; if (!out.done.includes(rid)) out.done.push(rid);
  };
  for (const t of taps || []) {
    if (!t || !t.id || st.seen[t.id]) continue;   // the same tap twice (a double tap, a retry) counts once
    st.seen[t.id] = 1;
    const p = pays[t.rid];
    if (t.act === "paid") { if (!p) continue; if ((p.accounts || []).length <= 1) record(t.rid, p.accounts[0] && p.accounts[0].id, t.at); else waiting[t.rid] = true; }
    else if (t.act === "acct") { if (!p) continue; if (!(p.accounts || []).some((a) => a.id === t.acct)) continue; record(t.rid, t.acct, t.at); delete waiting[t.rid]; }
    else if (t.act === "undo") { const x = st.paid[t.rid]; if (x) { out.remove.push(x); delete st.paid[t.rid]; out.add = out.add.filter((a) => a.id !== x); out.done = out.done.filter((r) => r !== t.rid); } }
    else if (t.act === "tomorrow") { if (!st.paid[t.rid]) out.move.push({ rid: t.rid, at: (t.at || now) + 864e5 }); }
    else if (t.act === "hour") { if (!st.paid[t.rid]) out.move.push({ rid: t.rid, at: (t.at || now) + 36e5 }); }
  }
  // keep the seen list short: the last 2,000 taps are plenty to stop a repeat
  const keys = Object.keys(st.seen); if (keys.length > 2000) for (const k of keys.slice(0, keys.length - 2000)) delete st.seen[k];
  return { state: st, ...out, waiting: Object.keys(waiting) };
}
const isoDay = (t) => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
