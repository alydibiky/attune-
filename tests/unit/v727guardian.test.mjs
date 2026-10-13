// v6.27: the Money Guardian — "Attune pays for itself": money found by code in the person's own data, and an honest counter.
import * as G from "../../web-src/guardian.js";
import * as L from "../../web-src/life.js";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const now = new Date("2026-10-13T12:00:00").getTime(), ts = (d, h, m) => new Date(`${d}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`).getTime();
const tx = (date, amount, note, extra = {}) => ({ id: note + date + amount + (extra.ts || ""), type: "expense", amount, cat: "other", account: "c", date, note, ...extra });
const ledger = { currency: "EGP", accounts: [{ id: "c", currency: "EGP" }], txns: [
  tx("2026-10-12", 350, "CARREFOUR · CIB", { ts: ts("2026-10-12", 20, 41) }), tx("2026-10-12", 350, "CARREFOUR · CIB", { ts: ts("2026-10-12", 20, 43) }),   // double
  tx("2026-07-01", 450, "WE Internet · CIB"), tx("2026-08-01", 450, "WE Internet · CIB"), tx("2026-09-01", 450, "WE Internet · CIB"), tx("2026-10-01", 520, "WE Internet · CIB"),   // creep
  tx("2026-08-05", 120, "Shahid VIP · CIB"), tx("2026-09-05", 120, "Shahid VIP · CIB"), tx("2026-10-05", 120, "Shahid VIP · CIB"),   // subscription
  tx("2026-10-03", 25, "Account maintenance fee · CIB"), tx("2026-10-09", 15, "InstaPay commission · CIB"),   // fees
  tx("2026-10-10", 600, "WATANIYA · NBE"), tx("2026-09-10", 580, "WATANIYA · NBE") ],
  recurring: [{ id: "r1", type: "expense", amount: 640, note: "Electricity", nextDate: "2026-10-15", active: true }] };
const life = L.addCommitment({ v: 1, items: [] }, { ...L.parseLife("Ahmed owes me 12,000, 1,000 a month for a year", { now }), start: "2026-10-01" }, now);
const F = G.findings({ ledger, life, now });
const k = (kind) => F.find((f) => f.kind === kind);
ok(k("late") && /Ahmed is 12 days late/.test(k("late").title) && k("late").amount === 1000, "Ahmed is late — 1,000 at stake: " + (k("late") && k("late").title));
ok(/بفكّرك|friendly reminder/.test(k("late").message) && /installment 1 of 12/.test(k("late").message), "a polite reminder, written by code: " + k("late").message);
ok(k("double") && k("double").amount === 350 && /Carrefour/.test(k("double").title), "charged twice at Carrefour within 2 minutes");
ok(k("creep") && /Internet went up 16%/.test(k("creep").title) && k("creep").amount === 840, "internet went up 450 → 520: 840 a year — " + (k("creep") && k("creep").title));
ok(k("subs") && /Shahid/i.test(k("subs").title) && k("subs").amount === 1440, "Shahid every month: 1,440 a year to review");
ok(k("fees") && k("fees").amount === 40, "40 EGP in bank fees this month");
ok(k("due") && /Electricity due 2026-10-15/.test(k("due").title), "the electricity bill is due in 2 days");
ok(!F.some((f) => /Wataniya/i.test(f.title)), "a normal price change (fuel, 2 months) is not flagged");
ok(F[0].kind === "late" && F[1].kind === "double", "most urgent first");
// the honest counter
let g = { saved: [], dismissed: [] };
g = G.markSaved(g, k("double"), now); g = G.markSaved(g, k("subs"), now); g = G.markSaved(g, k("double"), now);
let t = G.savedTotals(g, now);
ok(t.month === 470 && t.all === 470, "refund 350 + one month of Shahid 120 = 470 saved (counted once): " + JSON.stringify(t));
t = G.savedTotals(g, new Date("2027-01-13T12:00:00").getTime());
ok(t.all === 350 + 120 * 4, "a cancelled subscription keeps counting each month: " + t.all);
ok(G.findings({ ledger, life, now, dismissed: g.dismissed }).every((f) => f.kind !== "double" && f.kind !== "subs"), "done ones are not shown again");
g = G.noteReminded(g, k("late").id); g = G.collected(g, life.items[0].id, 0, 1000, now);
ok(G.savedTotals(g, now).month === 1470, "Ahmed paid after the reminder: +1,000 collected");
ok(G.collected({ saved: [], reminded: [] }, life.items[0].id, 0, 1000, now).saved.length === 0, "paid without a reminder is not claimed as Attune's");
console.log(fail ? fail + " FAILED" : "v727guardian ok");
process.exit(fail ? 1 : 0);
