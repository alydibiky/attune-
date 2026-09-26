// Unit tests for v5.17: sums corrected, VAT sums detected, Business designs
// checked, queries/forms from a sentence, related records, preview links.
import { arithmeticSlips, fixSlips, looksLikeMathProblem } from "../../web-src/verify.js";
import * as E from "../../web-src/erp.js";
import { htmlDoc } from "../../web-src/sandbox.js";
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }

// ---- Ali's "And with 5 cranes" screenshot ----
const a = "**Total: 453,000 EGP**\n1. 5 × 4 × 25,000 = **500,000**\n2. 14% of 500,000 = 70,000\n3. 500,000 + 70,000 = **453,000**";
const sl = arithmeticSlips(a);
eq(sl.map((x) => x.right), [570000], "a wrong sum on a numbered line is caught (500,000 + 70,000 ≠ 453,000)");
const f = fixSlips(a, sl);
eq([f.fixed, f.text.includes("Total: 570,000 EGP"), f.text.includes("= **570,000**"), f.text.includes("453")], [1, true, true, false], "…and corrected everywhere, the Total line too");
eq(fixSlips("x = 1,000,453,000", [{ expr: "1 + 1 = 453,000", right: 2 }]).text, "x = 1,000,453,000", "only whole numbers are replaced, not digits inside bigger ones");
eq(looksLikeMathProblem("3 cranes × 4 days × 25,000 EGP + 14% VAT"), true, "a priced sum with VAT goes to the checked maths route");

// ---- Business: language, quality ----
eq([E.designLang("A cafe with coffee and cakes"), E.designLang("كافيه فيه قهوة وحلويات")], ["English", "Arabic"], "names follow the description's language");
eq(E.designMessages("A cafe")[0].content.includes("in English (never Spanish"), true, "the design prompt says so plainly");
const thin = { name: "Cafe", tables: [{ name: "Clientes", fields: [{ name: "ClienteID", type: "auto" }] }, { name: "Productos", fields: [{ name: "ProductoID", type: "auto" }] }, { name: "Pedidos", fields: [{ name: "PedidoID", type: "auto" }] }] };
eq(E.designQuality(thin).ok, false, "a design with ID-only tables is rejected (Ali's Skittlz Cafe)");
eq(E.designQuality(E.TEMPLATES[0].spec).ok, true, "a real design passes");
const thinSys = E.systemFromSpec(thin);
eq(thinSys.tables.every((t) => t.fields.some((x) => x.type === "text")), true, "an ID-only table still gets a Name to fill in");

// ---- relationships, related records ----
let sys = E.systemFromSpec(E.TEMPLATES[0].spec);
const rels = E.relationships(sys);
eq(rels.length > 0 && rels.every((r) => r.fromName && r.toName), true, "the crane template's links are listed as connections");
const rel = rels[0];
const parent = sys.tables.find((t) => t.id === rel.to), child = sys.tables.find((t) => t.id === rel.from);
let r1 = E.addRow(sys, parent.id, { [parent.fields.find((x) => x.type === "text").id]: "Orascom" }); sys = r1.sys;
const pid = sys.rows[parent.id][0]._id;
const childText = child.fields.find((x) => x.type === "text" || x.type === "number");
for (let i = 0; i < 2; i++) { const r = E.addRow(sys, child.id, { [rel.field]: pid }); sys = r.sys; }
const related = E.relatedRows(sys, parent.id, pid);
eq(related.length >= 1 && related[0].rows.length === 2, true, "a record shows the records linked to it (a customer's jobs)");

// ---- queries from a sentence ----
let s2 = E.systemFromSpec({ name: "Shop", tables: [{ name: "Products", fields: [{ name: "Product", type: "text" }, { name: "Price", type: "money" }, { name: "Category", type: "choice", options: ["Food", "Drink"] }] }] });
const P = s2.tables[0], F = (n) => E.findField(P, n).id;
for (const [n, pr, c] of [["Tea", 20, "Drink"], ["Cake", 80, "Food"], ["Coffee", 45, "Drink"], ["Sandwich", 60, "Food"]]) s2 = E.addRow(s2, P.id, { [F("Product")]: n, [F("Price")]: pr, [F("Category")]: c }).sys;
let q = E.makeQuery(s2, { title: "Drinks", table: "products", where: [{ field: "category", op: "=", value: "Drink" }], sort: { field: "Price", dir: "desc" } });
eq(q.error, undefined, "a query names are matched loosely (products / category)");
eq(E.runQuery(s2, q.query).rows.map((r) => r[F("Product")]), ["Coffee", "Tea"], "…and it filters and sorts");
q = E.makeQuery(s2, { table: "Products", where: [{ field: "Price", op: ">", value: 50 }] });
eq(E.runQuery(s2, q.query).rows.length, 2, "number comparison: price > 50");
q = E.makeQuery(s2, { table: "Products", group: { by: "Category", sum: "Price" } });
eq(E.runQuery(s2, q.query).groups.map((g) => [g.group, g.sum]), [["Food", 140], ["Drink", 65]], "group by with a sum");
eq(!!E.makeQuery(s2, { table: "Nope" }).error, true, "an unknown table is a clear error, not a crash");
eq(E.queryMessages(s2, "drinks under 50")[0].content.includes("Products (4 records)"), true, "the query prompt carries the design");

// ---- forms from a sentence ----
const fm = E.makeForm(s2, { title: "Quick add", table: "Products", fields: ["Product", "Price", "Nope"], defaults: { Category: "Drink" } });
eq([fm.form.fields.length, fm.form.defaults[F("Category")]], [2, "Drink"], "a form keeps the real fields in order, with defaults");
s2 = E.saveSaved(s2, "forms", fm.form);
eq(s2.forms.length, 1, "forms are saved with the system (and in its backups)");
eq(E.removeSaved(s2, "forms", fm.form.id).forms.length, 0, "and can be removed");

// ---- previews keep links inside the page ----
const doc = htmlDoc("<html><head></head><body><a href='#menu'>Menu</a></body></html>", "t1");
eq(doc.includes('closest("a[href]")') && doc.includes('addEventListener("submit"'), true, "previewed pages handle #links and forms themselves (no reloading Attune inside)");

console.log(fails.length ? fails.length + " FAILED" : "ALL PASSED");
if (fails.length) process.exit(1);
