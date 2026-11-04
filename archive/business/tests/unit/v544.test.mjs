// Unit tests for v5.44: Business — combining databases (links found by the phone, merge by a key,
// one combined view) and phones that keep their leading 0.
import * as E from "../../web-src/erp.js";
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }

eq([E.guessType("Phone", ["01001234567", "0111 222 3334"]).type, E.guessType("Code", ["00123", "00456"]).type, E.guessType("Qty", ["12", "7"]).type], ["phone", "text", "number"], "phones and 0-codes are not numbers (the 0 would be lost); quantities still are");

let sys = E.systemFromSpec({ name: "Cranes", tables: [] });
sys = E.tableFromData(sys, "Customers", ["Name", "Phone", "City"], [["Hassan Co.", "01001234567", "Cairo"], ["Nile Build", "01112223334", "Giza"], ["Delta Steel", "01223334445", "Tanta"]]).sys;
sys = E.tableFromData(sys, "Jobs", ["Job", "Customer", "Crane", "Amount"], [["J1", "Hassan Co.", "LTM 1100", "35000"], ["J2", "nile build", "AC 100", "28000"], ["J3", "Hassan Co", "LTM 1100", "40000"], ["J4", "Orascom", "GMK 5250", "90000"]]).sys;
const sug = E.linkSuggestions(sys);
eq(sug.map((s) => [s.table, s.field, s.to, s.matched, s.total, s.missing]), [["Jobs", "Customer", "Customers", 3, 4, ["Orascom"]]], "Jobs › Customer is found to name Customers (spelling and case ignored), only that way round");
const L = E.linkColumn(sys, sug[0]);
const jobs = L.sys.tables.find((t) => t.name === "Jobs"), cust = L.sys.tables.find((t) => t.name === "Customers");
eq([jobs.fields.find((f) => f.name === "Customer").type, L.added, (L.sys.rows[cust.id] || []).length], ["link", 1, 4], "linked; the missing Orascom was added to Customers first");
eq(E.undo(L.sys).sys.tables.find((t) => t.name === "Jobs").fields.find((f) => f.name === "Customer").type, "text", "one Undo takes the link (and the added customer) back");
const cv = E.combinedView(L.sys, jobs.id);
eq([cv.header.slice(4), cv.rows[1].slice(4)], [["Customer › Phone", "Customer › City"], ["01112223334", "Giza"]], "the combined view: each job with its customer's phone and city");
const k = E.keyFor(L.sys, cust.id, ["Name", "City"], [["Nile Build", "6th of October"], ["Petrojet", "Suez"]]);
eq(k && k.field, "Name", "the key column of a second sheet is found (unique, and matching records)");
const m = E.mergeRows(L.sys, cust.id, ["Name", "City"], [["Nile Build", "6th of October"], ["Petrojet", "Suez"]], k.col);
const rows = E.viewRows(m.sys, cust.id), nameF = cust.fields.find((f) => f.name === "Name"), cityF = cust.fields.find((f) => f.name === "City"), phoneF = cust.fields.find((f) => f.name === "Phone");
const nile = rows.filter((r) => r[nameF.id] === "Nile Build");
eq([m.updated, m.added, nile.length, nile[0][cityF.id], nile[0][phoneF.id]], [1, 1, 1, "6th of October", "01112223334"], "merge: the same customer is updated (its phone kept), the new one added, nothing duplicated");

if (fails.length) { console.log(`\n${fails.length} FAILED`); process.exit(1); } else console.log("\nALL PASSED");
