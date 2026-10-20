// v6.44 Fleet in depth: invoices with VAT / withholding, matching payments, aging, the team and payroll, crane papers,
// breakdowns, fuel per hour, utilisation, revenue per month, and the new warnings.
import * as F from "../../web-src/fleet.js";
import * as P from "../../web-src/fleet-pro.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const T = "2026-10-20";
let s = F.heal({});
s = F.upsert(s, "garages", { name: "Yard" }); const g = s.garages[0].id;
s = F.upsert(s, "sites", { name: "New Capital" }); const site = s.sites[0].id;
s = F.upsert(s, "clients", { name: "Orascom", opening: 10000 }); const k = s.clients[0].id;
s = F.upsert(s, "cranes", { name: "LTM 1100", hourly: 2000, daily: 15000, loc: { kind: "garage", id: g }, home: g });
s = F.upsert(s, "cranes", { name: "QY50", hourly: 1000, daily: 7000, loc: { kind: "garage", id: g }, home: g });
const [c1, c2] = s.cranes.map((c) => c.id);
s = F.addJob(s, { crane: c1, client: k, site, mode: "hourly", start: "2026-08-01" }); const j1 = s.jobs[0].id;
for (const [d, a, b] of [["2026-08-03", "08:00", "16:00"], ["2026-08-04", "08:00", "14:00"], ["2026-09-10", "08:00", "18:00"], ["2026-10-05", "08:00", "16:00"]]) s = F.addEntry(s, { job: j1, date: d, start: a, end: b }, { requireEvidence: false });
// ---- invoices
const un = P.uninvoiced(s, k);
ok(un.length === 1 && un[0].qty === 32 && un[0].amount === 64000 && un[0].entries.length === 4, "the work not invoiced: one line for the job, 32 h × 2,000 = 64,000");
let r = P.makeInvoice(s, { client: k, date: "2026-09-01", to: "2026-08-31" });
s = r.state; const v1 = r.invoice;
ok(v1.no === "INV-0001" && v1.sub === 28000 && v1.vat === 3920 && v1.total === 31920 && v1.due === "2026-10-01", "August invoiced: 14 h = 28,000 + VAT 14 % 3,920 = 31,920, due in 30 days");
ok(P.uninvoiced(s, k)[0].amount === 36000, "August's work is marked — only September and October are left to invoice");
let e2 = null; try { F.addEntry(s, { id: s.entries[0].id, job: j1, date: "2026-08-03", start: "08:00", end: "17:00" }, { requireEvidence: false }); } catch (e) { e2 = e.message; }
ok(/INV-0001/.test(e2 || ""), "an invoiced entry can't be changed silently: " + e2);
r = P.makeInvoice(s, { client: k, date: "2026-10-10", wht: 3 }); s = r.state; const v2 = r.invoice;
ok(v2.no === "INV-0002" && v2.sub === 36000 && v2.wht === 1080 && v2.net === 36000 + 5040 - 1080, "a second invoice with 3 % withholding: net = 36,000 + 5,040 − 1,080");
let none = null; try { P.makeInvoice(s, { client: k }); } catch (e) { none = e.message; }
ok(/Nothing to invoice/.test(none || ""), "nothing left → it says so");
const b = F.clientBalance(s, k);
ok(b.tax === 3920 + 5040 - 1080 && b.balance === 10000 + 64000 + 7880, "the client's balance includes the VAT and takes off the withholding tax: " + b.balance);
// payments: the opening first, then invoices oldest first
s = F.addCheque(s, { dir: "in", client: k, method: "transfer", amount: 30000, due: "2026-09-15" });
let st = P.invoiceStatus(s, T), i1 = st.find((x) => x.no === "INV-0001"), i2 = st.find((x) => x.no === "INV-0002");
ok(i1.paid === 20000 && i1.left === 11920 && i1.status === "overdue" && i1.late === 19, "30,000 paid: 10,000 to the opening, 20,000 to INV-0001 → 11,920 left, 19 days overdue");
ok(i2.status === "unpaid" && i2.left === i2.net, "INV-0002 not due yet, unpaid");
s = F.addCheque(s, { dir: "in", client: k, method: "cheque", no: "777", amount: 11920, due: "2026-10-25" });
st = P.invoiceStatus(s, T); ok(st.find((x) => x.no === "INV-0001").onCheque === 11920, "a cheque not yet due shows as 'on a cheque', not paid");
// aging
const a = P.aging(s, T);
ok(a.rows[0].d30 === 11920 && a.rows[0].current === i2.net && a.rows[0].notInvoiced === 0, "aging: 11,920 in 1–30 days, INV-0002 not due yet");
ok(P.exportProRows(s, "aging").length === 3, "aging → Excel rows");
const html = P.invoiceHTML(s, v2.id, { rtl: true });
ok(/فاتورة ضريبية/.test(html) && /INV-0002/.test(html) && /خصم من المنبع 3%/.test(html), "the tax invoice prints in Arabic with the withholding line");
// deleting an invoice frees its work, restoring takes it back
let s2 = F.remove(s, "invoices", v2.id);
ok(P.uninvoiced(s2, k)[0].amount === 36000, "an invoice in the Recycle Bin → its work can be invoiced again");
s2 = F.restore(s2, "invoices", v2.id); ok(P.uninvoiced(s2, k).length === 0, "restored → marked again");
ok(P.makeInvoice(F.remove(s, "invoices", v2.id), { client: k }).invoice.no === "INV-0003", "numbers are never reused");
// ---- team & payroll
s = P.upsertPerson(s, { name: "Sayed", role: "operator", crane: c1, wage: 500, licence: "A-123", licenceExp: "05/11/2026" });
s = P.upsertPerson(s, { name: "Mahmoud", role: "driver", salary: 9000 });
const sayed = s.people[0].id;
s = P.addAdvance(s, { person: sayed, date: "2026-08-10", amount: 300 });
let pay = P.payroll(s, "2026-08");
ok(pay.rows[0].days === 2 && pay.rows[0].gross === 1000 && pay.rows[0].net === 700, "Sayed in August: his crane worked 2 days × 500 − 300 advance = 700");
ok(pay.rows[1].gross === 9000 && pay.sum.net === 9700, "a monthly salary counts as it is; the payroll total");
s = P.setDays(s, sayed, "2026-08", 22); ok(P.payroll(s, "2026-08").rows[0].gross === 11000, "days typed by hand win (attendance)");
// ---- papers, repairs, fuel
s = P.upsertDoc(s, { crane: c1, kind: "loadtest", expiry: "30/10/2026" });
s = P.upsertDoc(s, { crane: c2, kind: "insurance", expiry: "01/10/2026" });
s = P.addRepair(s, { crane: c2, from: "2026-10-12", cause: "Hydraulic pump", cost: 18000 });
ok(F.craneProfit(s, c2).expenses === 18000, "a repair's cost is a Maintenance expense — the crane's profit sees it");
for (const [d, l] of [["2026-08-05", 90], ["2026-09-12", 60], ["2026-10-06", 110]]) s = P.addFuel(s, { crane: c1, date: d, litres: l, cost: l * 15 });
const fr = P.fuelReport(s, c1);
ok(fr.length === 3 && fr[0].lph === 6.43 && fr[1].lph === 6 && fr[2].lph === 13.75 && fr[2].high && !fr[0].high, "fuel per working hour: Aug 6.43, Sep 6, Oct 13.75 L/h → October flagged (usual ≈ 6.2)");
const w = F.warnings(s, T), kinds = w.map((x) => x.kind);
ok(kinds.includes("docExpired") && kinds.includes("docSoon") && kinds.includes("licenceSoon") && kinds.includes("invoiceOverdue") && kinds.includes("repairOpen") && kinds.includes("fuelHigh"), "Today warns: expired insurance, load test soon, licence soon, overdue invoice, crane still down, fuel high — " + kinds.join(","));
ok(F.reminderNote(s, new Date(T + "T08:00:00").getTime()).body.includes("crane paper expired"), "the 09:00 notification names them");
s = P.closeRepair(s, s.repairs[0].id, "2026-10-15");
// ---- reports
const u = P.utilisation(s, "2026-10", T), q = u.find((x) => x.crane.id === c2), l = u.find((x) => x.crane.id === c1);
ok(l.worked === 1 && l.days === 20 && q.down === 4 && q.idle === 16, "October so far: LTM worked 1 of 20 days; QY50 down 4 days (12–15), idle 16");
const m = P.revenueMatrix(s, 2026);
ok(m.rows[0].months[7] === 28000 && m.rows[0].months[8] === 20000 && m.total === 64000, "revenue per crane per month: Aug 28,000 · Sep 20,000 · year 64,000");
ok(P.exportProRows(s, "payroll:2026-08").length === 4 && P.exportProRows(s, "revenue:2026")[0].length === 14 && P.exportProRows(s, "fuel").length === 4, "payroll, revenue and fuel → Excel");
// demo erase keeps working with the new lists
ok(F.eraseDemo(F.loadDemo(F.heal({}))).cranes.length === 0, "demo data still erases cleanly");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
