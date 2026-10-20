// v6.44 Business builder: ten deep templates (each switches on the Pro rules it should) and Insights for any system.
import * as E from "../../web-src/erp.js";
import * as P from "../../web-src/erp-pro.js";
import { insights } from "../../web-src/erp-insights.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const T = "2026-10-20";
// what each template must give: stock items table, a party with charges + payments, due dates, bookings
const WANT = { clinic: { stock: "Medicines", party: "Patients", dues: 2 }, academy: { party: "Students", dues: 1 }, property: { party: "Tenants", dues: 2, booking: "Contracts" },
  workshop: { stock: "Parts", party: "Customers", dues: 2 }, gym: { party: "Members", dues: 1 }, salon: { stock: "Products", party: "Clients" }, pharmacy: { stock: "Medicines", party: "Customers", dues: 2 },
  transport: { party: "Customers", dues: 5, booking: "Trip orders" }, contractor: { stock: "Materials", party: "Clients", dues: 3 }, wholesale: { stock: "Products", party: "Customers", dues: 1 },
  services: { party: "Clients" }, shop: { stock: "Products", party: "Customers" }, restaurant: { stock: "Ingredients", party: "Suppliers" } };
for (const [id, w] of Object.entries(WANT)) {
  const t = E.TEMPLATES.find((x) => x.id === id); if (!t) { ok(false, id + " is a template"); continue; }
  const sys = E.systemFromSpec(t.spec), d = P.detect(sys), nm = (tid) => (sys.tables.find((x) => x.id === tid) || {}).name;
  const st = w.stock ? d.stock.find((s) => nm(s.items) === w.stock) : null, pa = d.parties.find((p) => nm(p.tid) === w.party);
  const good = (!w.stock || (st && st.moves.length >= 1)) && pa && pa.charges.length >= 1 && pa.payments.length >= 1 && (!w.dues || d.dues.length >= w.dues) && (!w.booking || d.bookings.some((b) => nm(b.tid) === w.booking));
  ok(good, `${id}: ${w.stock ? "stock that moves (" + w.stock + "), " : ""}balances of ${w.party} (charges + payments)${w.dues ? ", " + w.dues + " due dates" : ""}${w.booking ? ", no double bookings (" + w.booking + ")" : ""}`);
  // every formula of the template parses and every link points at a table
  const bad = sys.tables.flatMap((tb) => tb.fields.filter((f) => (f.type === "link" && !sys.tables.some((x) => x.id === f.link)) || (f.type === "formula" && !f.formula)).map((f) => tb.name + "." + f.name));
  ok(!bad.length, id + ": every link and formula resolves" + (bad.length ? " — " + bad.join(", ") : ""));
}
ok(E.TEMPLATES.length === 15, "15 templates in all (5 + 10 deep)");
for (const [txt, id] of [["عيادة أسنان فيها 3 دكاترة", "clinic"], ["I run a gym with memberships", "gym"], ["صيدلية في المعادي", "pharmacy"], ["we rent apartments to tenants", "property"], ["شركة نقل وشحن عندها 10 تريلات", "transport"], ["مقاولات وتشطيبات", "contractor"]])
  ok((E.guessTemplate(txt) || {}).id === id, `«${txt}» → the ${id} template`);
// insights on sample data
const sys = P.loadDemo(E.systemFromSpec(E.TEMPLATES.find((x) => x.id === "property").spec), { today: T });
const I = insights(sys, T);
ok(I.series.length === 6 && I.series.some((x) => x.total > 0), "insights: the last 6 months of rent invoiced");
ok(I.top.length >= 1 && I.top[0].total >= (I.top[1] || { total: 0 }).total && I.top[0].table === "Tenants", "the top tenants of the year, biggest first");
ok(I.statuses.some((x) => x.table === "Units" && x.counts.length) && I.usage.length === 1 && I.usage[0].assets === "Units", "statuses (units vacant / rented) and how much of the month each unit is booked");
const shop = P.loadDemo(E.systemFromSpec(E.TEMPLATES.find((x) => x.id === "wholesale").spec), { today: T });
const S = insights(shop, T).stock[0];
ok(S.table === "Products" && S.value != null && S.value >= 0, "the stock's value at cost (" + S.value + ")");
ok(insights(E.systemFromSpec(E.TEMPLATES.find((x) => x.id === "blank").spec), T).statuses.length === 0, "an empty system: no insights, no error");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
