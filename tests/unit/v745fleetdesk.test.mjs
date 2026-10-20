// v6.45 Fleet ← Ali's desktop programs: the Dashboard's cash month, Rates, site profit, Query, report PDFs, the warehouse's
// reference-code issues, destination / supplier history, reference lists, store dashboard.
import * as F from "../../web-src/fleet.js";
import * as D from "../../web-src/fleet-desk.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const T = "2026-10-20";
let s = F.loadDemo(F.heal({}), T);
// ---- Dashboard (cash basis)
s = F.setChequeStatus(s, s.cheques[0].id, "cleared");
const m = D.cashTotals(s, { from: "2026-10-01", to: "2026-10-31" });
ok(m.income === 70000 && m.expenses === 9000 && m.profit === 61000, "this month on a cash basis: cheques not bounced due this month (40,000 cleared + 30,000 waiting) − spent 9,000 = 61,000");
const six = D.monthlyCash(s, 6, T); ok(six.length === 6 && six[5].ym === "2026-10" && six[5].profit === 61000, "the 6-month summary ends with October");
ok(D.topOwing(s)[0].client.name.includes("Orascom") || D.topOwing(s)[0].balance > 0, "the clients who owe most");
ok(JSON.stringify(D.activeCounts(s)) === JSON.stringify({ jobs: 2, sites: 2, clients: 2 }), "Active now: 2 jobs at 2 sites for 2 clients");
// ---- Rates
const [c1, c2] = s.cranes.map((c) => c.id);
s = D.setRates(s, { [c1]: { hourly: 2000, daily: 16000 }, [c2]: { hourly: 1100, daily: 8000 } });
ok(F.byId(s.cranes, c1).hourly === 2000 && F.byId(s.cranes, c2).daily === 8000, "Rates: every crane's rates saved at once");
let e = ""; try { D.setRates(s, { [c1]: { hourly: -1, daily: 0 } }); } catch (x) { e = x.message; } ok(/negative/.test(e), "a negative rate is refused");
// ---- site profit
const sp = D.siteProfit(s);
ok(sp.length === 2 && sp.every((r) => r.income >= 0) && sp[0].profit >= sp[1].profit, "profitability per site, most profitable first: " + sp.map((r) => r.site.name + " " + r.profit).join(" · "));
// ---- query
let q = D.query(s, { table: "cheques", status: "pending" });
ok(q.rows.length === 1 && q.rows[0][0] === "553100" && q.total === 30000, "Query: pending cheques → 553100, 30,000");
q = D.query(s, { table: "jobs", status: "active" }); ok(q.rows.length === 2 && q.head[0] === "Job", "Query: active jobs with their totals");
q = D.query(s, { table: "expenses", from: "2026-10-01", to: "2026-10-31" }); ok(q.rows.length === 1 && q.total === 9000, "Query: this month's expenses");
q = D.query(s, { table: "moves" }); ok(q.rows.length >= 2, "Query: crane moves");
const html = D.tableHTML({ title: "Cheques", head: q.head, rows: q.rows, company: "Adrighem & Aldibiki", rtl: true });
ok(/dir="rtl"/.test(html) && /Adrighem/.test(html), "any report prints as a PDF page (Arabic right-to-left)");
// ---- warehouse
const doc = s.store.tx.find((t) => t.kind === "in").doc;
const ri = D.refIssues(s, doc);
ok(ri.length === 2 && ri.every((x) => x.tech === "Sayed" && /LTM 1100/.test(x.to)), "reference-code report: the 2 issues taken from invoice " + doc + " (Sayed → LTM 1100)");
const h = D.storeHistory(s, "supplier", "[DEMO] El-Nasr Hydraulics"); ok(h.rows.length === 2 && h.total === 34500, "a supplier's history: 2 lines, 34,500");
const hc = D.storeHistory(s, "crane", "[DEMO] Liebherr LTM 1100"); ok(hc.rows.length === 2, "a crane's history: what it received");
const k = D.storeKpis(s, T); ok(k.items >= 2 && k.value > 0 && k.inMonth === 34500 && k.outMonth > 0, "store dashboard: items, stock value, in / out this month");
// ---- reference lists
ok(D.namesOf(s, "techs").find((x) => x.name === "Sayed").used === 2, "reference lists: Sayed is on 2 lines");
s = D.renameName(s, "techs", "Sayed", "Sayed Hassan");
ok(s.store.techs.includes("Sayed Hassan") && s.store.tx.filter((t) => t.tech === "Sayed Hassan").length === 2, "rename a technician → every line follows");
e = ""; try { D.removeName(s, "techs", "Sayed Hassan"); } catch (x) { e = x.message; } ok(/rename it instead/.test(e), "a name in use can't be removed");
s = D.addName(s, "techs", "Karim"); s = D.removeName(s, "techs", "Karim"); ok(!s.store.techs.includes("Karim"), "an unused name is added and removed");
s = D.renameName(s, "items", "Oil filter", "Oil filter 4L"); ok(F.itemBalance(s.store, "Oil filter 4L") === 13, "rename an item → its stock follows (13)");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
