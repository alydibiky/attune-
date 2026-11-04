// Unit tests for web-src/erp.js — the Access-like business database.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as E from "../../web-src/erp.js";
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }

(async () => {
const tpl = E.TEMPLATES.find((t) => t.id === "cranes");
let s = E.systemFromSpec(tpl.spec);
const T = (n) => E.findTable(s, n), F = (t, n) => E.findField(T(t), n);
eq(s.tables.map((t) => t.name), ["Customers", "Equipment", "Jobs", "Invoices", "Maintenance", "Crew"], "the crane-rental template builds 6 tables");
eq([F("Jobs", "Customer").type, F("Jobs", "Customer").link === T("Customers").id], ["link", true], "links point at tables by id");
eq(E.formulaToNames(F("Jobs", "Total").formula, T("Jobs")), "[Days] * [Daily rate]", "formulas are stored by id and shown by name");

// records
let r = E.addRow(s, T("Customers").id, { Name: "Orascom", Phone: "0100 123 4567", City: "Cairo" }); s = r.sys;
eq([r.errors.length, r.row[F("Customers", "Phone").id]], [0, "01001234567"], "a customer is added; the phone is cleaned");
r = E.addRow(s, T("Equipment").id, { Model: "LTM 1100", Brand: "liebherr", "Capacity (t)": "١٠٠", Status: "Available", "Daily rate": "25,000" }); s = r.sys;
eq([r.row[F("Equipment", "Code").id], r.row[F("Equipment", "Brand").id], r.row[F("Equipment", "Capacity (t)").id], r.row[F("Equipment", "Daily rate").id]], ["EQ-0001", "Liebherr", 100, 25000], "auto number EQ-0001; choice matched; Arabic digits and commas read");
eq(E.addRow(s, T("Equipment").id, { Model: "X", Status: "Flying" }).errors[0].error.startsWith('"Flying" is not one of'), true, "a value that is not one of the choices is refused");
eq(E.addRow(s, T("Customers").id, { Phone: "0100" }).errors.map((e) => e.error), ['"0100" is not a phone number', "Name is required"], "required fields and bad values are reported, nothing saved");
r = E.addRow(s, T("Jobs").id, { Customer: "orascom", Crane: "LTM 1100", Start: "20/09/2026", End: "2026-09-24", "Daily rate": 25000, Status: "Running" }); s = r.sys;
const job = E.viewRows(s, T("Jobs").id)[0];
eq([job[F("Jobs", "Job no").id], job[F("Jobs", "Days").id], job[F("Jobs", "Total").id], E.show(s, F("Jobs", "Customer"), job[F("Jobs", "Customer").id])],
   ["JOB-0001", 5, 125000, "Orascom"], "a job: links found by name, day-first date read, Days = 5 and Total = 125,000 computed");
r = E.addRow(s, T("Jobs").id, { Customer: "Orascom", Start: "2026-10-01", End: "2026-10-02", "Daily rate": 30000, Status: "Quoted" }); s = r.sys;
eq(E.totals(T("Jobs"), E.viewRows(s, T("Jobs").id))[F("Jobs", "Total").id], 185000, "column totals include formulas");
eq(E.summary(s, T("Jobs").id, F("Jobs", "Status").id, F("Jobs", "Total").id).map((x) => [x.group, x.sum]), [["Running", 125000], ["Quoted", 60000]], "summary: total by status");
eq(E.viewRows(s, T("Jobs").id, { sort: { field: F("Jobs", "Total").id, dir: "desc" } }).map((x) => x[F("Jobs", "Total").id]), [125000, 60000], "sort by a formula");
eq(E.viewRows(s, T("Jobs").id, { search: "quot" }).length, 1, "search");
eq(E.usedBy(s, T("Customers").id, E.viewRows(s, T("Customers").id)[0]._id), 2, "deleting a customer warns: 2 jobs use it");

// design changes, like Access
let a = E.applyOps(s, [{ op: "addField", table: "Jobs", name: "Driver phone", type: "phone" },
  { op: "renameField", table: "jobs", field: "Daily rate", to: "Rate per day" },
  { op: "addField", table: "Jobs", name: "With VAT", type: "formula", formula: "ROUND([Total] * 1.14, 0)" },
  { op: "setOptions", table: "Equipment", field: "Status", add: ["Sold"] },
  { op: "deleteField", table: "Jobs", field: "Nope" }]);
s = a.sys;
eq([a.done.length, a.errors], [4, ['No field called "Nope" in Jobs']], "several changes at once; the impossible one is reported, the rest applied");
const j2 = E.viewRows(s, T("Jobs").id)[0];
eq([j2[F("Jobs", "Total").id], j2[F("Jobs", "With VAT").id], E.formulaToNames(F("Jobs", "Total").formula, T("Jobs"))], [125000, 142500, "[Days] * [Rate per day]"], "renaming a column keeps its data and its formulas");
eq(E.applyOps(s, [{ op: "deleteField", table: "Jobs", field: "Total" }]).errors[0], "Total is used by the formula With VAT — change that first", "a column a formula needs can't be deleted by accident");
a = E.applyOps(s, [{ op: "changeType", table: "Customers", field: "City", type: "choice" }]); s = a.sys;
eq(F("Customers", "City").options, ["Cairo"], "text → choice: the existing values become the choices");
a = E.applyOps(s, [{ op: "changeType", table: "Equipment", field: "Model", type: "number" }]);
eq(a.done[0].includes("1 value could not be converted"), true, "text → number says what could not be converted");
const u = E.undo(s);
eq([u.what.startsWith("Changed Customers › City"), E.findField(E.findTable(u.sys, "Customers"), "City").type], [true, "text"], "undo restores the design before the last change");
a = E.applyOps(s, [{ op: "deleteTable", table: "Customers" }]);
const jobsAfter = E.viewRows(a.sys, E.findTable(a.sys, "Jobs").id)[0];
eq([E.findField(E.findTable(a.sys, "Jobs"), "Customer").type, jobsAfter[E.findField(E.findTable(a.sys, "Jobs"), "Customer").id]], ["text", "Orascom"], "deleting a table turns links to it into text (no data goes blank)");
a = E.applyOps(s, [{ op: "addTable", table: "Fuel", fields: [{ name: "Crane", type: "link", link: "Equipment" }, { name: "Litres", type: "number" }, { name: "Price/l", type: "money" }, { name: "Cost", type: "formula", formula: "[Litres] * [Price/l]" }] }]);
eq([a.done.length, E.findTable(a.sys, "Fuel").fields.map((f) => f.type)], [1, ["link", "number", "money", "formula"]], "a new table with a link and a formula");
eq(E.applyOps(s, [{ op: "addField", table: "Jobs", name: "Bad", type: "formula", formula: "[Nope] * 2" }]).errors[0], 'There is no field called "Nope" in Jobs.', "a formula with an unknown field is refused");
eq(E.parseFormula("{a} * (2 + ").ok, false, "a broken formula is caught");

// AI output is messy — it is cleaned
const spec = E.jsonFrom("Sure! ```json\n{name: 'Bakery', tables: [{name: 'Products', fields: [{name: 'Product', type: 'string'}, {name: 'Price', type: 'currency'},]}, {name: 'Orders', columns: ['Customer', {name:'Product', type:'relation', link:'Products'}, {name:'Status', type:'enum', options:'New, Paid'}]}]}\n```");
const b = E.systemFromSpec(spec);
eq(b.tables.map((t) => t.fields.map((f) => f.type).join("/")), ["text/money", "text/link/choice"], "messy JSON from the model (bare keys, single quotes, synonyms) becomes a clean design");
eq(E.designMessages("crane rental in Cairo")[0].content.includes('"formula":"[Qty] * [Unit price]"'), true, "the design prompt shows an example");
eq(E.changeMessages(s, "add driver phone")[0].content.includes("Jobs (2 records): Job no [auto]"), true, "the change prompt shows the current design");

// CSV
const csv = E.toCSV(s, T("Jobs").id);
eq(csv.startsWith("﻿Job no,Customer,Crane"), true, "CSV export has a BOM (Arabic opens right in Excel) and the column names");
const rows = E.parseCSV('Name,Phone,Joined,Level,Salary\n"Ali, Jr",0100 111 2222,2025-01-05,Senior,"12,000"\nMona,0122 333 4444,2025-02-01,Junior,9000\nOmar,0111 555,2025-03-01,Junior,8000\nSara,0100 777 8888,2025-04-01,Senior,15000\n');
eq(rows[1][0], "Ali, Jr", "CSV with quoted commas");
const imp = E.tableFromData(s, "Staff", rows[0], rows.slice(1));
eq([imp.table.fields.map((f) => f.type), imp.added, imp.errors.length], [["text", "phone", "date", "choice", "money"], 4, 0], "a spreadsheet becomes a table: phone, date, choice and money columns guessed");

// licences
const cs = E.systemFromSpec(E.TEMPLATES[4].spec);
let big = cs; const t0 = cs.tables[0].id;
for (let i = 0; i < E.FREE_ROWS; i++) big = E.addRow(big, t0, { Name: "r" + i }).sys;
eq(E.addRow(big, t0, { Name: "one more" }).errors[0].limit, true, `the free version keeps ${E.FREE_ROWS} records per table`);
// a throwaway key pair, so CI can test without the seller's secret key
const TOOL = [join(process.cwd(), "tools/erp-licence.mjs"), typeof __dirname !== "undefined" ? join(__dirname, "../../tools/erp-licence.mjs") : ""].find((p) => p && existsSync(p));
const tmpKey = join(mkdtempSync(join(tmpdir(), "erp-")), "k.json");
const pub = JSON.parse(execFileSync("node", [TOOL, "keygen", tmpKey]).toString().trim().split("\n").pop());
const code = execFileSync("node", [TOOL, "issue", tmpKey, E.requestCode(cs)]).toString().trim();
const ok = await E.checkLicence(cs, code, { publicKey: pub });
eq([ok.ok, ok.plan], [true, "full"], "a signed code activates that system");
eq((await E.checkLicence(s, code, { publicKey: pub })).error, "That code is for a different system.", "…and not any other");
const forged = code.slice(0, -6) + (code.slice(-6, -5) === "A" ? "B" : "A") + code.slice(-5);
eq((await E.checkLicence(cs, forged, { publicKey: pub })).ok, false, "a tampered code is refused");
eq((await E.checkLicence(cs, code)).ok, false, "a code from another key is refused by the app's own key");
const SELLER_KEY = "/home/claude/out/attune-erp-private-key.json";
if (existsSync(SELLER_KEY)) eq((await E.checkLicence(cs, execFileSync("node", [TOOL, "issue", SELLER_KEY, E.requestCode(cs)]).toString().trim())).ok, true, "the app's built-in key matches the seller's private key");
const act = { ...big, licence: ok };
eq(E.addRow(act, t0, { Name: "one more" }).errors.length, 0, "an activated system has no limit");

console.log(fails.length ? fails.length + " FAILED" : "ALL PASSED");
process.exit(fails.length ? 1 : 0);
})();
