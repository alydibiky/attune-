// v6.34 — the Fleet ideas of HANDOFF §5.77: maintenance by engine hours, a client statement of account, the reminders as one
// phone notification at 09:00.
import assert from "node:assert/strict";
import * as F from "../../web-src/fleet.js";
let s = F.loadDemo(F.EMPTY(), "2026-10-17");
const crane = F.live(s.cranes)[0];
const h0 = F.craneHours(s, crane.id);
assert.ok(h0 >= 0);
assert.equal(F.serviceStatus(s, crane.id), null, "no interval → no service tracking");
s = F.upsert(s, "cranes", { ...crane, serviceEvery: Math.max(1, Math.floor(h0)) });   // already used up
const sv = F.serviceStatus(s, crane.id, "2026-10-17");
assert.ok(sv && sv.left <= 0, "service due when the hours since the last one reach the interval: " + JSON.stringify(sv));
assert.ok(F.warnings(s, "2026-10-17").some((w) => w.kind === "serviceDue" && w.id === crane.id), "…and it is on Today's list");
s = F.markServiced(s, crane.id, "2026-10-17");
assert.equal(F.serviceStatus(s, crane.id, "2026-10-17").used, 0, "serviced → the count starts again");
assert.ok(!F.warnings(s, "2026-10-17").some((w) => w.kind === "serviceDue" && w.id === crane.id));
// the statement: opening + work − payments = the same balance as the client's card
for (const c of F.live(s.clients)) {
  const st = F.statement(s, c.id), b = F.clientBalance(s, c.id);
  assert.equal(st.balance, b.balance, "statement balance = client balance for " + c.name);
  const html = F.statementHTML(s, c.id, { rtl: true });
  assert.match(html, /كشف حساب/); assert.match(html, /<tfoot>/);
}
// the notification
const n = F.reminderNote(s, new Date("2026-10-17T08:00:00").getTime());
if (n) { assert.equal(n.id, "fleet-needs"); assert.equal(new Date(n.at).getHours(), 9); assert.match(n.title, /needs? you/); }
assert.equal(F.reminderNote(F.EMPTY()), null, "nothing needs you → no notification");
const late = F.reminderNote(s, new Date("2026-10-17T15:00:00").getTime());
if (late) assert.equal(new Date(late.at).getDate(), 18, "after 9:00 → tomorrow at 9:00");
console.log("PASS v737fleet");
