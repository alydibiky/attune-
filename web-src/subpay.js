/* ---- v9.9 a subscription payment seen in a notification (autopilot.js "subscription") → People & plans (pure).
   Already there (same name) → this month's payment is ticked with what was paid; new → a monthly subscription from that day, its
   first payment ticked. The item remembers which notification did it (apKeys) so Undo takes back exactly that. Tests: v990subs. */
const fold = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
import { scheduleOf, addCommitment, payAmount, togglePaid } from "./life.js";

export function findSub(data, name) {
  const n = fold(name), first = n.split(" ").slice(-1)[0];
  return (data.items || []).find((c) => ["subscription", "bill", "regular"].includes(c.kind) && c.dir !== "in" && !c.ended && (() => { const t = fold(c.title || c.person || c.name); return t && (t === n || t.includes(first) || n.includes(t)); })());
}
export function subPay(data, a, now = Date.now()) {
  const c = findSub(data, a.name);
  if (c) {
    const s = scheduleOf(c, Date.parse(a.date + "T12:00:00") + 40 * 864e5);
    const slot = s.find((x) => x.date.slice(0, 7) === a.date.slice(0, 7)) || s.find((x) => !x.paid && x.date >= a.date) || null;
    if (!slot || slot.paid) return { data, isNew: false, id: c.id };
    let d = payAmount(data, c.id, slot.i, a.amount);
    d = { ...d, items: d.items.map((x) => (x.id === c.id ? { ...x, apKeys: { ...(x.apKeys || {}), [a.key]: slot.i } } : x)) };
    return { data: d, isNew: false, id: c.id };
  }
  const d = addCommitment(data, { kind: "subscription", dir: "out", person: "", title: a.name, amount: a.amount, count: 0, total: 0, every: "month", start: a.date, currency: a.cur || "", paid: [0], apNew: a.key, auto: true }, now);
  return { data: d, isNew: true, id: d.items[d.items.length - 1].id };
}
/** Undo of what one notification did. */
export function undoSubPay(data, key) {
  const items = [];
  for (const c of data.items || []) {
    if (c.apNew === key) continue;
    if (c.apKeys && key in c.apKeys) { const i = c.apKeys[key], { [key]: _, ...rest } = c.apKeys; const t = togglePaid({ items: [c] }, c.id, i).items[0]; items.push({ ...t, apKeys: rest }); continue; }
    items.push(c);
  }
  return { ...data, items };
}
