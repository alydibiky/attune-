// v6.32 Fleet & rentals: Ali's Crane Management + Crane Warehouse rules, kept exactly, joined in one place.
import * as F from "../../web-src/fleet.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const throws = (fn, re, m) => { try { fn(); ok(false, m + " (did not refuse)"); } catch (e) { ok(e instanceof F.FleetError && (!re || re.test(e.message)), m + " — «" + e.message + "»"); } };
const T = "2026-10-17";

// ---- dates: DD/MM always
ok(F.readDate("17/10/2026") === T && F.readDate("17-10-26") === T && F.readDate("2026-10-17") === T && F.readDate("١٧/١٠/٢٠٢٦") === T, "DD/MM/YYYY, DD-MM-YY, ISO and Arabic digits read");
ok(F.readDate("31/02/2026") === "" && F.readDate("10/17/2026") === "", "an impossible date (31 Feb, month 17) is refused — never read as M/D");
ok(F.showDate(T) === "17/10/2026", "shown as DD/MM/YYYY");

// ---- lists + location
let s = F.EMPTY();
s = F.upsert(s, "garages", { name: "Main garage" });
s = F.upsert(s, "sites", { name: "Tower A" }); s = F.upsert(s, "sites", { name: "Port" });
s = F.upsert(s, "clients", { name: "Orascom", opening: 10000 });
s = F.upsert(s, "cranes", { name: "LTM 1100", hourly: 1800, daily: 14000 });
s = F.upsert(s, "cranes", { name: "QY50", hourly: 950, daily: 7500 });
const [g] = s.garages.map((x) => x.id), [st1, st2] = s.sites.map((x) => x.id), [k] = s.clients.map((x) => x.id), [c1, c2] = s.cranes.map((x) => x.id);
ok(F.whereIs(s, c1).kind === "garage" && F.whereIs(s, c1).id === g, "a new crane starts in the garage");
throws(() => F.upsert(s, "cranes", { name: " ltm  1100 " }), /already/, "a duplicate name is refused");

// ---- job orders: free crane or already at that site
s = F.addJob(s, { crane: c1, client: k, site: st1, mode: "hourly", start: "2026-10-01", end: "2026-10-20" });
const j1 = s.jobs[0].id;
ok(F.whereIs(s, c1).kind === "site" && F.whereIs(s, c1).id === st1 && s.jobs[0].rate === 1800 && s.jobs[0].no === "JO-001", "starting a job moves the free crane to the site, rate from the crane");
throws(() => F.addJob(s, { crane: c1, client: k, site: st2, mode: "daily", start: "2026-10-05" }), /another site/, "a crane at another site is blocked (Move Crane first)");
ok(F.canStartJob(s, c1, st1).ok, "a second job at the SAME site is allowed");
throws(() => F.moveCrane(s, { crane: c1, to: { kind: "site", id: st2 } }), /active job/, "moving a crane with an active job elsewhere is refused");

// ---- hours: 08→14 = 6, 08 day1 → 08 day2 = 24, crossing midnight
ok(F.hoursOf({ date: "2026-10-02", start: "08:00", end: "14:00" }) === 6, "08:00→14:00 = 6 h");
ok(F.hoursOf({ date: "2026-10-02", start: "08:00", end: "08:00", endDate: "2026-10-03" }) === 24, "08:00 day 1 → 08:00 day 2 = 24 h");
ok(F.hoursOf({ date: "2026-10-02", start: "22:00", end: "02:00" }) === 4, "22:00→02:00 crosses midnight = 4 h");

// ---- entries: evidence required, no overlap
throws(() => F.addEntry(s, { job: j1, date: "02/10/2026", start: "08:00", end: "14:00" }), /evidence/, "evidence is required for every work entry");
s = F.addEntry(s, { job: j1, date: "02/10/2026", start: "08:00", end: "14:00", evidence: "ph1" });
ok(s.entries[0].hours === 6 && s.entries[0].amount === 10800 && s.entries[0].ym === "2026-10", "6 h × 1,800 = 10,800 saved, filed under 2026-10");
throws(() => F.addEntry(s, { job: j1, date: "02/10/2026", start: "13:00", end: "15:00", evidence: "x" }), /overlap/, "overlapping hours for the same crane are blocked");
s = F.addEntry(s, { job: j1, date: "02/10/2026", start: "14:00", end: "16:00", evidence: "x" });
ok(s.entries.length === 2, "touching hours (14:00 end, 14:00 start) are fine");
throws(() => F.addEntry(s, { job: j1, date: "2026-09-30", start: "08:00", end: "09:00", evidence: "x" }), /before the job/, "work dated before the job started is refused");
const months = F.monthsOf(s, j1);
ok(months.length === 1 && months[0].hours === 8 && months[0].amount === 14400, "work grouped by month: 8 h, 14,400");

// ---- daily job on the other crane
s = F.addJob(s, { crane: c2, client: k, site: st2, mode: "daily", start: "2026-10-01" });
const j2 = s.jobs[1].id;
s = F.addEntry(s, { job: j2, date: "2026-10-03", qty: 2, evidence: "x" });
ok(s.entries[2].amount === 15000, "daily: 2 days × 7,500 = 15,000");

// ---- cheques + balances
s = F.addCheque(s, { dir: "in", client: k, no: "1001", bank: "CIB", amount: 20000, due: "2026-10-16" });
s = F.addCheque(s, { dir: "in", client: k, no: "1002", bank: "CIB", amount: 5000, due: "2026-10-20" });
s = F.addCheque(s, { dir: "in", client: k, method: "cash", amount: 1000 });
let b = F.clientBalance(s, k);
ok(b.balance === 10000 + 14400 + 15000 - 26000 && b.pending === 25000, "balance = opening + work − payments: " + b.balance);
s = F.setChequeStatus(s, s.cheques[0].id, "bounced");
ok(F.clientBalance(s, k).balance === b.balance + 20000, "a bounced cheque stays owed (+20,000)");
throws(() => F.addCheque(s, { dir: "in", client: k, amount: 100, due: T }), /cheque number/, "a cheque needs its number");
s = F.setChequeStatus(s, s.cheques[0].id, "pending");

// ---- warnings
const w = F.warnings(s, T);
ok(w[0].kind === "chequeOverdue" && w[0].days === 1, "an overdue cheque comes first: " + w.map((x) => x.kind).join(","));
ok(w.some((x) => x.kind === "chequeSoon" && x.days === 3) && w.some((x) => x.kind === "jobEnding" && x.days === 3), "a cheque due in 3 days and a job ending in 3 days are flagged");

// ---- expenses
s = F.addExpense(s, { date: "2026-10-05", crane: c1, lines: [{ type: "Fuel", amount: 3000 }, { type: "Driver", amount: 1000 }] });
s = F.addExpense(s, { date: "2026-10-06", lines: [{ type: "Office rent", amount: 8000 }] });
ok(s.expenses[0].total === 4000 && s.expTypes.includes("Office rent"), "expense lines add up; a new type joins the list");
ok(F.expensesByType(s, { general: true })["Office rent"] === 8000 && !F.expensesByType(s, { general: true }).Fuel, "general expenses = neither crane nor site");

// ---- STORE: internal code, planOut, balances
ok(F.docCode(1, "2026-05-10") === "1/526" && F.docCode(12, "2026-10-01") === "12/1026", "internal code {seq}/{month}{yy}: 1/526, 12/1026");
let r = F.addIncoming(s, { date: "2026-10-01", purchaser: "Mahmoud", supplier: "El-Nasr", lines: [{ item: "Hydraulic oil", qty: 5, total: 500 }, { item: "Filter", qty: 4, total: 400 }] });
s = r.state;
ok(r.doc === "1/1026" && s.store.tx.filter((t) => t.doc === "1/1026").length === 2, "one invoice, two items → two lines with one code 1/1026");
throws(() => F.addIncoming(s, { date: T, lines: [{ item: "x", qty: 1, total: 1 }] }), /bought/, "the purchaser is required");
s = F.setItem(s, "Hydraulic oil", { opening: 1 });
ok(F.itemBalance(s.store, "Hydraulic oil") === 6, "balance = opening 1 + in 5");
let p = F.planOut(s.store, { item: "Hydraulic oil", qty: 3, ref: "1/1026" });
ok(p.ok && p.lines.length === 1 && p.lines[0].total === 300 && p.lines[0].auto, "3 ≤ remaining 5 → one linked line, price automatic 3 × 100");
p = F.planOut(s.store, { item: "Hydraulic oil", qty: 6, ref: "1/1026" });
ok(p.ok && p.lines.length === 2 && p.lines[0].qty === 5 && p.lines[0].total === 500 && p.lines[1].qty === 1 && p.lines[1].total === null, "6 > remaining 5 → split: 5 linked (500) + 1 from the general balance (price typed)");
p = F.planOut(s.store, { item: "Hydraulic oil", qty: 7, ref: "1/1026" });
ok(!p.ok && /total balance is 6/.test(p.error), "7 > total balance 6 → refused with the reason");
p = F.planOut(s.store, { item: "Hydraulic oil", qty: 7 });
ok(!p.ok && /available: 6/.test(p.error), "no reference, 7 > 6 → refused naming what is available");
r = F.addOutgoing(s, { date: "2026-10-02", item: "Hydraulic oil", qty: 5, ref: "1/1026", tech: "Sayed", crane: c1 });
s = r.state;
ok(r.doc === "2/1026", "the counter is shared: the issue takes 2/1026");
p = F.planOut(s.store, { item: "Hydraulic oil", qty: 1, ref: "1/1026" });
ok(p.ok && p.lines.length === 1 && p.lines[0].ref === "" && p.lines[0].fromInvoiceDepleted, "invoice used up → all from the general balance, no zero line");
throws(() => F.addOutgoing(s, { date: T, item: "Filter", qty: 1 }), /Where/, "an issue needs a crane or a destination");
const rows = F.runningBalances(s.store);
ok(rows.map((x) => x.balance).join(",") === "6,4,1", "running balance per item in entry order: " + rows.map((x) => x.balance).join(","));
const inv = F.invoiceItems(s.store, "1/1026");
ok(inv[0].issued === 5 && inv[0].remaining === 0 && inv[0].unit === 100 && inv[1].remaining === 4, "Reference-code report: original / issued / remaining / unit");

// ---- improvements over the original
throws(() => F.deleteLines(s, { doc: "1/1026" }), /linked/, "deleting an invoice that issues are linked to is refused (no orphans)");
throws(() => F.editLine(s, s.store.tx[0].id, { qty: 4 }), /already issued/, "an invoice line can't drop below what was issued from it");
s = F.editLine(s, s.store.tx[2].id, { qty: 4 });
ok(s.store.tx[2].total === 400 && F.itemBalance(s.store, "Hydraulic oil") === 2, "editing a linked issue re-prices it from the invoice (4 × 100)");
s = F.setItem(s, "Filter", { min: 5 });
ok(F.warnings(s, T).some((x) => x.kind === "lowStock" && x.item === "Filter"), "an item at/below its minimum is flagged");
const pr = F.craneProfit(s, c1);
ok(pr.income === 14400 && pr.expenses === 4000 && pr.parts === 400 && pr.profit === 10000, "crane profit = income − expenses − parts issued to it: " + JSON.stringify(pr));
ok(F.storeBy(s, "tech")[0].name === "Sayed" && F.cranePartsReport(s, c1).total === 400, "cost per technician and per crane");
ok(F.searchStore(s.store, { item: "Hydraulic oil" }).count === 2 && F.searchStore(s.store, { text: "el-nasr" }).count === 2, "search by item and by text");
ok(/1\/1026/.test(F.docHTML(s, "1/1026")) && /فاتورة وارد/.test(F.docHTML(s, "1/1026", { rtl: true })), "a printable invoice in English and Arabic");
ok(F.exportRows(s, "store").length === 4 && F.exportRows(s, "profit").some((r) => r[0] === "LTM 1100" && r[5] === 10000), "Excel rows: store lines and profit per crane");

// ---- close a job → crane back to the garage
s = F.closeJob(s, j1, "completed", "2026-10-17");
ok(F.whereIs(s, c1).kind === "garage" && F.whereIs(s, c1).id === g && s.moves.some((m) => m.note === "JO-001" && m.to.kind === "garage"), "completing a job returns the crane to its garage (logged)");
s = F.moveCrane(s, { crane: c1, to: { kind: "site", id: st2 }, date: T });
ok(F.whereIs(s, c1).id === st2, "Move Crane: garage → site");

// ---- recycle bin
throws(() => F.remove(s, "clients", k), /Still used/, "a client with jobs can't be deleted (orphans)");
const now = Date.parse("2026-10-17T10:00:00Z");
s = F.remove(s, "jobs", j2, now);
ok(F.live(s.jobs).length === 1 && F.live(s.entries).every((e) => e.job !== j2) && F.binList(s, now).length === 1, "deleting a job takes its work to the Recycle Bin");
s = F.restore(s, "jobs", j2);
ok(F.live(s.jobs).length === 2 && F.live(s.entries).some((e) => e.job === j2), "…and restoring brings the work back");
s = F.remove(s, "jobs", j2, now);
ok(F.purge(s, now + 6 * 864e5).purged === 0 && F.purge(s, now + 8 * 864e5).purged === 2, "kept 7 days, then purged for good (the job and its entry)");

// ---- demo data
let d = F.loadDemo(F.EMPTY(), T);
ok(F.hasDemo(d) && d.cranes.length === 3 && d.entries.length === 3 && d.store.tx.length === 4, "demo data loads (3 cranes, 3 entries, 4 store lines)");
d = F.upsert(d, "clients", { name: "Real client" });
const e2 = F.eraseDemo(d);
ok(!F.hasDemo(e2) && e2.clients.length === 1 && e2.clients[0].name === "Real client" && e2.store.items.length === 0, "erasing demo data never touches real data");
ok(F.heal({ cranes: [{ id: "c1", name: "x" }] }).store.tx.length === 0 && F.heal({}).settings.chequeDays === 7, "an old / partial state heals (missing parts added)");
console.log(process.exitCode ? "SOME FAILED" : "ALL PASSED");
