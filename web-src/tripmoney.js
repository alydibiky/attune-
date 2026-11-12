/* ---- v9.9.25 B7 TR3 the trip's money and papers (Ali picked A: Money · Papers tabs on the trip). Pure.
   Money: the budget in BOTH currencies (home ↔ the trip's), worked in whole piastres / cents so nothing drifts; what was spent (in either
     currency) and what is left; costs shared with others settled so the transfers always add up to zero, with as few as possible.
   Papers: the passport against the destination's rule (6 months from arrival in the Gulf, Egypt, Jordan, Indonesia, Malaysia, India; 3 months
     after leaving the Schengen countries; valid for the whole stay in the UK and Canada; elsewhere the strict common rule — 6 months after
     you leave), the visa, insurance — a checklist with the date to renew by. Rules change: the card says to check the official portal.
   Tests: tests/tr3/gen.mjs (10,000 trips) + tests/unit/v9925tr3.test.mjs. */
const cents = (v) => Math.round((+v || 0) * 100);
const fromCents = (c) => c / 100;
/** amount in one currency → the other, at "1 home = rate trip" (to the piastre). */
export const toTrip = (home, rate) => fromCents(Math.round(cents(home) * rate));
export const toHome = (trip, rate) => fromCents(Math.round(cents(trip) / rate));
/** budget { home: 30000, rate: 0.0767 (1 EGP = 0.0767 SAR) }, spent [{ amount, cur: "home" | "trip" }] → both columns. */
export function budget({ home = 0, rate = 1 } = {}, spent = []) {
  let used = 0; for (const s of spent || []) used += s.cur === "trip" ? Math.round(cents(s.amount) / rate) : cents(s.amount);
  const total = cents(home), left = total - used;
  return { home: fromCents(total), trip: fromCents(Math.round(total * rate)), spentHome: fromCents(used), spentTrip: fromCents(Math.round(used * rate)),
    leftHome: fromCents(left), leftTrip: fromCents(Math.round(left * rate)), share: total ? Math.min(1, Math.max(0, used / total)) : 0, over: left < 0 };
}
/** costs [{ who: "Ali", amount, for: ["Ali", "Mona"] (empty = everyone) }] → { net: { name: cents-balance }, transfers: [{ from, to, amount }] } — sums to 0. */
export function settle(people = [], costs = []) {
  const net = Object.fromEntries(people.map((p) => [p, 0]));
  for (const c of costs || []) {
    const among = (c.for && c.for.length ? c.for : people).filter((p) => p in net); if (!among.length || !(c.who in net)) continue;
    const total = cents(c.amount), each = Math.floor(total / among.length); let rest = total - each * among.length;
    net[c.who] += total;
    // the odd piastres go one each to the first people, so the shares add up to the cost exactly
    among.forEach((p) => { net[p] -= each + (rest > 0 ? 1 : 0); if (rest > 0) rest--; });
  }
  const debt = Object.entries(net).filter(([, v]) => v < 0).map(([p, v]) => [p, -v]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const cred = Object.entries(net).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const transfers = []; let i = 0, j = 0;
  while (i < debt.length && j < cred.length) { const x = Math.min(debt[i][1], cred[j][1]); transfers.push({ from: debt[i][0], to: cred[j][0], amount: fromCents(x) });
    debt[i][1] -= x; cred[j][1] -= x; if (!debt[i][1]) i++; if (!cred[j][1]) j++; }
  return { net: Object.fromEntries(Object.entries(net).map(([p, v]) => [p, fromCents(v)])), transfers };
}
// the passport rule by destination (country code): months of validity left, counted from the day you ARRIVE or the day you LEAVE
export const PASSPORT_RULE = { sa: [6, "arrive"], ae: [6, "arrive"], kw: [6, "arrive"], qa: [6, "arrive"], bh: [6, "arrive"], om: [6, "arrive"], jo: [6, "arrive"], eg: [6, "arrive"],
  id: [6, "arrive"], my: [6, "arrive"], in: [6, "arrive"], de: [3, "leave"], fr: [3, "leave"], es: [3, "leave"], it: [3, "leave"], pt: [3, "leave"], nl: [3, "leave"], gb: [0, "leave"], ca: [0, "leave"] };
const addMonths = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); const x = new Date(y, m - 1 + n, 1); const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate(); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(Math.min(d, last)).padStart(2, "0"); };
/** { to: "sa", arrive, leave, passport: "YYYY-MM-DD" | "", visa: true|false|null (not needed), insurance: bool } → the papers list */
export function papers({ to = "", arrive = "", leave = "", passport = "", visa = null, insurance = false } = {}) {
  const [months, from] = PASSPORT_RULE[to] || [6, "leave"];   // (unknown: the strict common rule)
  const base = from === "arrive" ? arrive : leave || arrive, mustLast = base ? addMonths(base, months) : "";
  const items = [];
  if (!passport) items.push({ key: "passport", ok: false, why: "missing" });
  else items.push({ key: "passport", ok: !mustLast || passport >= mustLast, why: !mustLast || passport >= mustLast ? "" : "renew", mustLast, months, from });
  if (visa !== null) items.push({ key: "visa", ok: !!visa });
  items.push({ key: "insurance", ok: !!insurance });
  return { items, ok: items.every((x) => x.ok), rule: { months, from, known: !!PASSPORT_RULE[to] } };
}
