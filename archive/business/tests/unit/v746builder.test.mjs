// v6.46 (Ali: "I run a clinic with appointments" sat on "Designing the tables…" for ages): a short description of a business
// we have a deep template for is built from the template at once, by code; a detailed or unknown one goes to the model.
import * as E from "../../web-src/erp.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const id = (d) => (E.clearTemplate(d) || {}).id || null;
ok(id("I run a clinic with appointments") === "clinic", "a clinic → the clinic template at once");
ok(id("I rent out cranes with operators") === "cranes" && id("I run a small shop with stock") === "shop" && id("مطعم كشري") === "restaurant", "the builder's own suggestions → their templates (Arabic too)");
ok(id("A laundry with delivery drivers") === null, "a kind no template knows → the model");
ok(id("We rent mobile cranes (20-500 t) with operators in Egypt. We track customers, jobs per site, daily rates, invoices and payments, maintenance, etc") === null, "a detailed description → the model (it says what it needs)");
const c = E.clearTemplate("I run a clinic with appointments");
ok(c.spec.tables.length >= 4 && c.spec.tables.some((t) => /patient/i.test(t.name)), "the clinic template has its tables (patients, …)");
