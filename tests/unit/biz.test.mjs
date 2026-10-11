// v6.18 Business: the screens layer (erp-screens.js) and the builder's steps and suggestions (biz-steps.js).
const E = await import("../../web-src/erp.js");
const SC = await import("../../web-src/erp-screens.js");
const B = await import("../../web-src/biz-steps.js");
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };

const sys0 = E.systemFromSpec(E.TEMPLATES[0].spec);
const u0 = SC.uiOf(sys0);
ok(u0.color === "blue" && u0.home.join() === "kpis,latest,tables" && u0.kpis.length >= 2, "a new system: blue, home = key numbers · latest · tables, key numbers made from its tables");
ok(SC.formFields(sys0, sys0.tables[0]).length === sys0.tables[0].fields.length && SC.listFields(sys0, sys0.tables[0]).length === 4, "the form shows every field, a list the first four");

const r = E.applyOps(sys0, [{ op: "setColor", color: "أخضر" }, { op: "setHome", parts: ["alerts", "kpis", "nonsense"] }, { op: "setMenu", position: "top" },
  { op: "setFormOrder", table: "Customers", fields: ["Phone", "Name"] }, { op: "hideField", table: "Customers", field: "City" },
  { op: "setSection", table: "Customers", field: "Email", title: "Contact" }, { op: "addKpi", table: "Equipment", agg: "sum", field: "Daily rate", label: "Fleet day rates" },
  { op: "setListColumns", table: "Equipment", fields: ["Model", "Status"] }, { op: "renameSystem", to: "Aldibiki Cranes" }]);
ok(r.errors.length === 0 && r.done.length === 9, "nine screen changes apply (Arabic colour name too): " + r.errors.join("; "));
const u = SC.uiOf(r.sys), cust = r.sys.tables.find((t) => t.name === "Customers"), eq = r.sys.tables.find((t) => t.name === "Equipment");
ok(u.color === "green" && SC.colorOf(r.sys) === "#15803D" && u.menu === "top" && u.home.join() === "alerts,kpis", "colour green, menu on top, home = alerts · key numbers (unknown parts dropped)");
const ff = SC.formFields(r.sys, cust);
ok(ff[0].field.name === "Phone" && ff[1].field.name === "Name" && !ff.some((x) => x.field.name === "City") && ff.find((x) => x.field.name === "Email").section === "Contact", "the customer form: Phone first, City hidden, a Contact section before Email");
ok(SC.listFields(r.sys, eq).map((f) => f.name).join() === "Model,Status" && r.sys.name === "Aldibiki Cranes", "the equipment list shows Model, Status; the system is renamed");
ok(u.kpis.some((k) => k.label === "Fleet day rates" && k.agg === "sum"), "a key number: the sum of day rates");
let s2 = E.addRow(r.sys, eq.id, { [eq.fields.find((f) => f.name === "Model").id]: "LTM 1100", [eq.fields.find((f) => f.name === "Daily rate").id]: "25000" }).sys;
s2 = E.addRow(s2, eq.id, { [eq.fields.find((f) => f.name === "Model").id]: "GMK 5250", [eq.fields.find((f) => f.name === "Daily rate").id]: "40000" }).sys;
ok(SC.kpiValue(s2, SC.uiOf(s2).kpis.find((k) => k.label === "Fleet day rates")) === 65000, "…its value: 25,000 + 40,000 = 65,000");
const bad = E.applyOps(sys0, [{ op: "setColor", color: "sparkly" }, { op: "setFormOrder", table: "Customers", fields: ["Nope"] }, { op: "addKpi", table: "Customers", agg: "sum", field: "Name" }]);
ok(bad.done.length === 0 && bad.errors.length === 3, "wrong requests are refused with a reason: " + bad.errors.join(" / "));
ok(E.undo(r.sys).sys.ui === undefined, "undo takes the whole screen change back");
const msg = E.changeMessages(r.sys, "make it orange")[0].content;
ok(/setColor/.test(msg) && /The screens now/.test(msg) && /Customers: list shows/.test(msg), "the AI is told the screens and the screen changes it may make");

// the builder's interview: answers computed from the design, each one applies
ok(B.STEPS.map((x) => x.id).join() === "name,data,logic,screens,launch", "the five steps: Name → Data → Logic → Screens → Launch");
for (const st of ["data", "logic", "screens"]) {
  const sg = B.suggestions(sys0, st), errs = sg.flatMap((x) => E.applyOps(sys0, x.ops).errors);
  ok(sg.length >= 1 && errs.length === 0 && sg.every((x) => x.en && x.ar), `${st}: ${sg.length} answers, each applies cleanly, in English and Arabic`);
}
ok(!B.suggestions(sys0, "logic").some((x) => /Capacity/.test(x.en)), "no nonsense total (Capacity × Daily rate is not a total)");
const shop = E.systemFromSpec({ name: "Shop", tables: [{ name: "Orders", fields: [{ name: "Item", type: "text" }, { name: "Qty", type: "number" }, { name: "Price", type: "money" }] }] });
ok(B.suggestions(shop, "logic").some((x) => x.en === "Orders: Total = Qty × Price"), "a quantity and a price → Total = Qty × Price");
ok(B.alerts(sys0).length === 0 && B.checks(E.systemFromSpec({ name: "x", tables: [{ name: "A", fields: [{ name: "N", type: "text" }] }] })).length >= 1, "alerts and launch checks");
