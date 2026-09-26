// Unit tests for v5.19: web passages that answer the question; ERP tables connected.
import { passages, rankPassages, qWords } from "../../web-src/webrank.js";
import * as E from "../../web-src/erp.js";
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }

// a car page: 6,000 characters of menus and story, then the spec table
const filler = Array.from({ length: 40 }, (_, i) => `Our newsroom story number ${i} about the brand's heritage, design philosophy and the people behind it.`).join("\n");
const page = "Home | News | Cars | Contact\nAccept all cookies to continue\n" + filler + "\n## Trims and prices\nTrim | Power | Torque | Price\nLynk & Co 900 Pro | 598 hp | 1,000 Nm | CNY 309,900\nLynk & Co 900 Max | 598 hp | 1,000 Nm | CNY 339,900\nLynk & Co 900 Ultra | 845 hp | 1,200 Nm | CNY 369,900\n## Range\nCLTC range 1,400 km; electric range 280 km (CLTC)";
eq(page.indexOf("Ultra") > 2200, true, "(the table is past the first 2,200 characters — v5.18 never saw it)");
const ps = passages(page);
eq(ps.some((p) => p.table && p.text.includes("900 Ultra") && p.head === "Trims and prices"), true, "a table stays together as a passage, with its heading");
const r = rankPassages("Lynk & Co 900 all trims with hp, torque and price", [{ title: "Lynk & Co 900", url: "https://x/900", text: page }, { title: "Weather", url: "https://w", text: "Sunny in Cairo today with 31 degrees." }], { budget: 1500 });
eq(r[0].text.includes("845 hp") && r[0].text.includes("CNY 309,900"), true, "the spec table is picked for a trims/specs question");
eq(r[0].text.includes("newsroom story number 3"), false, "…and the filler is left out");
eq(r[0].text.length <= 1600, true, "…within the budget");
eq(rankPassages("x", []).length, 0, "no hits → nothing, no crash");
eq(qWords("What is the price of the LTM 1100?"), ["price", "ltm", "1100"], "question words: stop words dropped, names and numbers kept");

// ---- ERP: fields that name another table become links ----
const spec = { name: "Workshop", tables: [
  { name: "Suppliers", fields: [{ name: "SupplierID", type: "auto" }, { name: "SupplierName", type: "text" }] },
  { name: "Parts", fields: [{ name: "PartID", type: "auto" }, { name: "PartName", type: "text" }, { name: "SupplierID", type: "number" }, { name: "Unit price", type: "money" }] },
  { name: "Customers", fields: [{ name: "Name", type: "text" }] },
  { name: "Repairs", fields: [{ name: "RepairNo", type: "auto" }, { name: "Customer name", type: "text" }, { name: "Part", type: "text" }, { name: "Date", type: "date" }] },
] };
eq(E.findConnections(spec).map((c) => c.table + "." + c.field + "→" + c.to), ["Parts.SupplierID→Suppliers", "Repairs.Customer name→Customers", "Repairs.Part→Parts"], "SupplierID, Customer name and Part are recognised as references");
const ac = E.autoConnect(spec);
const sys = E.systemFromSpec(ac.spec);
eq(E.relationships(sys).length, 3, "the created system is connected (3 links)");
eq(E.findConnections(ac.spec).length, 0, "nothing left to connect");
const ar = { name: "ورشة", tables: [{ name: "العملاء", fields: [{ name: "الاسم", type: "text" }] }, { name: "الإصلاحات", fields: [{ name: "رقم", type: "auto" }, { name: "العميل", type: "text" }] }] };
eq(E.findConnections(ar).map((c) => c.to), ["العملاء"], "Arabic: العميل → العملاء");
let s2 = E.systemFromSpec(spec);
const cust = s2.tables.find((t) => t.name === "Customers"), rep = s2.tables.find((t) => t.name === "Repairs");
s2 = E.addRow(s2, cust.id, { Name: "Orascom" }).sys;
s2 = E.addRow(s2, rep.id, { "Customer name": "Orascom" }).sys;
const done = E.applyOps(s2, E.connectOps(s2));
const f = done.sys.tables.find((t) => t.name === "Repairs").fields.find((x) => x.name === "Customer name");
eq([f.type, done.sys.rows[rep.id][0][f.id] === done.sys.rows[cust.id][0]._id], ["link", true], "connecting an existing system turns the text 'Orascom' into a link to the Orascom record");
eq(E.designMessages("a workshop")[0].content.includes("FULLY CONNECTED"), true, "the design prompt asks for a fully connected design");

console.log(fails.length ? fails.length + " FAILED" : "ALL PASSED");
if (fails.length) process.exit(1);
