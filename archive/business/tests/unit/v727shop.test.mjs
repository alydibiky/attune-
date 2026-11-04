// v6.27 Shop in your pocket (shop.js on Books): set up from a sentence, shelf prices with tax exact to the cent, sales through
// Books' own operations (invoice, receipt, stock, ledger), recipes, the day's close, re-order messages.
import * as S from "../../web-src/shop.js";
import * as Ops from "../../web-src/books-ops.js";
import * as B from "../../web-src/books.js";
let bad = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) bad++; };
const E = (n) => Math.round(n * 100);
// setup
const su = S.setupFromSentence("A bakery called Nour in Lagos — we sell bread, meat pies and coffee, 3 staff", { country: "NG", currency: "NGN" });
ok(su.type === "bakery" && su.name === "Nour", "bakery, its name: " + su.name);
ok(su.staff === 3 && su.taxPct === 7.5 && su.taxInclusive && su.currency === "NGN", "3 staff, Nigeria's usual 7.5% to confirm, prices include tax, NGN");
ok(su.items.some((i) => i.name === "Meat pies" && i.mentioned) && su.items.some((i) => i.name === "Coffee") && su.items.every((i) => i.price === 0), "the items said are added; no price is invented: " + su.items.slice(0, 4).map((i) => i.name).join(", "));
ok(S.setupFromSentence("محل موبايلات واكسسوارات في القاهرة اسمه النور", { country: "EG" }).type === "phones" && S.setupFromSentence("محل موبايلات واكسسوارات في القاهرة اسمه النور", { country: "EG" }).name === "النور", "Arabic: a phone shop called النور");
ok(!S.setupFromSentence("A cafe called Bean — we sell muffins, 2 staff").items.some((i) => /staff/i.test(i.name)) && S.setupFromSentence("A cafe called Bean — we sell muffins, 2 staff").staff === 2, "'2 staff' is a head count, not an item");
ok(S.setupFromSentence("A cafe called Bean — we sell muffins, 2 staff").items.some((i) => i.name === "Muffins"), "…while muffins are an item");
ok(S.setupFromSentence("barbershop in Texas", { country: "US" }).taxPct === null && !S.setupFromSentence("x", { country: "US" }).taxInclusive, "the US: the sales tax is asked (it differs by state); prices before tax");
// books from the setup
let s = S.applySetup(Ops.EMPTY(), { ...S.setupFromSentence("a cafe called Bean", { country: "GB", currency: "GBP" }) }, { at: "2026-10-14T08:00:00Z" });
ok(s.currency === "GBP" && s.tax.vatCodes.S.bp === 2000 && s.company.name === "Bean" && s.customers.some((c) => c.walkIn), "Books set: GBP, 20% VAT, the walk-in customer");
const id = (n) => s.items.find((i) => i.name === n).id;
const item = (n) => s.items.find((i) => i.name === n);
s = Ops.upsert(s, "items", { ...item("Cappuccino"), price: E(3.2) }).state;
s = Ops.upsert(s, "items", { ...item("Croissant"), price: E(2.45), reorder: 5 }).state;
s = Ops.adjustStock(s, { item: id("Croissant"), date: "2026-10-14", qty: 12, unitCost: E(0.8) });
s = Ops.adjustStock(s, { item: id("Coffee beans"), date: "2026-10-14", qty: 2, unitCost: E(18) });
s = Ops.adjustStock(s, { item: id("Milk"), date: "2026-10-14", qty: 10, unitCost: E(1) });
s = Ops.adjustStock(s, { item: id("Cups"), date: "2026-10-14", qty: 100, unitCost: E(0.05) });
// tax-inclusive: the receipt total IS the shelf price — brute force over many prices, rates, quantities and discounts
let off = 0, n = 0, rounded = 0;
for (const bp of [500, 750, 1000, 1400, 1500, 1900, 2000, 2100, 2500]) for (let p = 1; p < 3000; p += 13) for (const q of [1, 2, 3, 7]) for (const dsc of [0, 1000]) {
  const st = { ...s, tax: { ...B.DEFAULT_TAX, vatCodes: { S: { bp } } }, items: [{ id: "x", name: "X", price: p, vat: "S" }] };
  const r = S.cartLines(st, [{ item: "x", qty: q }], { taxInclusive: true, discountBp: dsc }); n++;
  if (r.total !== r.target) off++; if (r.rounding) rounded++;
}
ok(off === 0, `the receipt total equals the shelf total in every one of ${n} lines (rates 5–25%, qty 1–7, with and without discount); ${rounded} needed a 0.01–0.03 rounding line`);
// a cash sale
const recipes = S.recipesFor(s, S.setupFromSentence("a cafe", { country: "GB" }));
recipes[id("Cappuccino")].confirmed = true;
let r = S.sell(s, [{ item: id("Cappuccino"), qty: 2 }, { item: id("Croissant"), qty: 1 }], { method: "cash", given: E(10), today: "2026-10-14", recipes });
ok(r.total === E(8.85) && r.change === E(1.15) && /^INV-2026-/.test(r.number), `cash sale: 2 × 3.20 + 2.45 = 8.85 exactly, change 1.15 (${B.fmt(r.total)})`);
s = r.state;
const inv = s.docs.find((d) => d.number === r.number), pay = s.payments.find((p) => p.allocations[0].doc === r.number);
ok(inv && inv.status === "posted" && pay && pay.amount === r.total && pay.method === "cash", "…a posted invoice and its cash receipt");
const lv = Ops.levels(s);
ok(lv[id("Croissant")].qty === 11 && Math.abs(lv[id("Coffee beans")].qty - (2 - 0.036)) < 1e-9 && Math.abs(lv[id("Milk")].qty - 9.7) < 1e-9 && lv[id("Cups")].qty === 98, "stock: 1 croissant sold; the confirmed cappuccino recipe used 36 g beans, 0.3 l milk, 2 cups");
const tb = B.trialBalance(s.journal);
ok(tb.balanced === true, "the ledger still balances (debits = credits)");
// errors are said
let e1 = ""; try { S.sell(s, [{ item: id("Latte"), qty: 1 }], { today: "2026-10-14" }); } catch (e) { e1 = e.message; }
ok(/Set a price for Latte/.test(e1), "an item without a price can't be sold by mistake: " + e1);
let e2 = ""; try { S.sell(s, [{ item: id("Croissant"), qty: 1 }], { method: "credit", today: "2026-10-14" }); } catch (e) { e2 = e.message; }
ok(/needs the customer/.test(e2), "on credit needs a named customer");
let e3 = ""; try { S.sell(s, [{ item: id("Croissant"), qty: 1 }], { method: "cash", given: E(1), today: "2026-10-14" }); } catch (e) { e3 = e.message; }
ok(/less than the total/.test(e3), "not enough cash is refused");
// card and credit sales, then the day's close
r = S.sell(s, [{ item: id("Croissant"), qty: 2 }], { method: "card", today: "2026-10-14" }); s = r.state;
s = Ops.upsert(s, "customers", { name: "Mr Okafor" }).state; const ok1 = s.customers.find((c) => c.name === "Mr Okafor").id;
r = S.sell(s, [{ item: id("Cappuccino"), qty: 1 }], { method: "credit", customer: ok1, today: "2026-10-14" }); s = r.state;
const z = S.dayClose(s, "2026-10-14", E(108.85), E(100));
ok(z.count === 3 && z.sales === E(8.85 + 4.9 + 3.2) && z.byMethod.cash === E(8.85) && z.byMethod.card === E(4.9) && z.byMethod.credit === E(3.2), `the day: 3 sales, by method cash 8.85 / card 4.90 / credit 3.20`);
ok(z.expectedCash === E(108.85) && z.difference === 0, "cash expected = float 100 + 8.85; counted 108.85 → difference 0");
ok(z.top[0].name === "Cappuccino" || z.top[0].name === "Croissant", "top items by sales");
// re-order
s = Ops.adjustStock(s, { item: id("Croissant"), date: "2026-10-14", qty: -5 });
const msg = S.reorderMessage(s, { supplier: "Ade Bakery Supplies", shop: "Bean" });
ok(/Croissant: \d+ pcs/.test(msg) && /Hello Ade Bakery Supplies/.test(msg), "a re-order message for what is low: " + msg.replace(/\n/g, " | "));
console.log(bad ? bad + " FAILED" : "v727shop ok");
