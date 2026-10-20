// v6.44 Shop in depth: returns at the counter with a refund, offers (% off, buy 2 get 1, happy hour), loyalty points,
// held carts, sales by hour / cashier — every money change through Books (the ledger balances).
import * as S from "../../web-src/shop.js";
import * as SP from "../../web-src/shop-pro.js";
import * as Ops from "../../web-src/books-ops.js";
import * as B from "../../web-src/books.js";
import * as P from "../../web-src/books-pro.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const E = (n) => Math.round(n * 100), T = "2026-10-20";
let s = S.applySetup(Ops.EMPTY(), { ...S.setupFromSentence("a cafe called Bean", { country: "EG", currency: "EGP" }) }, { at: T + "T08:00:00Z" });
const it = (n) => s.items.find((i) => i.name === n);
s = Ops.upsert(s, "items", { ...it("Cappuccino"), price: E(60) }).state;
s = Ops.upsert(s, "items", { ...it("Croissant"), price: E(45), category: "Bakery" }).state;
s = Ops.adjustStock(s, { item: it("Croissant").id, date: T, qty: 20, unitCost: E(15) });
const cap = it("Cappuccino").id, cro = it("Croissant").id;
let shop = { v: 1, taxInclusive: true, recipes: {}, loyalty: { on: true, every: E(10), value: 10 } };
s = Ops.upsert(s, "customers", { name: "Mona", phone: "01000000000" }).state; const mona = s.customers.find((c) => c.name === "Mona").id;
// ---- a sale by Sayed, then a return
let r = S.sell(s, [{ item: cro, qty: 3 }, { item: cap, qty: 2 }], { method: "cash", customer: mona, today: T, cashier: "Sayed", at: T + "T09:15:00Z" }); s = r.state;
const sale = r.number;
ok(r.total === E(255) && s.docs.find((d) => d.number === sale).cashier === "Sayed", "a sale: 3 croissants + 2 cappuccinos = 255, cashier Sayed");
ok(SP.returnable(s, sale).find((x) => x.item === cro).left === 3, "what can come back: 3 croissants");
const stockBefore = Ops.levels(s)[cro].qty;
r = SP.returnSale(s, { number: sale, items: [{ item: cro, qty: 1 }], restock: true, refund: "cash", reason: "stale", today: T, at: T + "T10:00:00Z" }); s = r.state;
ok(r.refund === E(45) && Ops.levels(s)[cro].qty === stockBefore + 1, "one croissant back: 45 refunded in cash, back on the shelf");
ok(SP.returnable(s, sale).find((x) => x.item === cro).left === 2, "only 2 more can come back now");
let tooMany = ""; try { SP.returnSale(s, { number: sale, items: [{ item: cro, qty: 5 }], today: T }); } catch (e) { tooMany = e.message; }
ok(/only 2 can come back/.test(tooMany), "returning more than was sold is refused");
ok(Ops.openInvoices(s).find((o) => o.number === sale).open === 0, "the receipt is settled: sold − returned − refunded = 0 open");
ok(P.balanceSheet(s.journal, T).balanced && B.trialBalance(s.journal).balanced, "the ledger still balances after the refund");
ok(S.dayClose(s, T).byMethod.cash === E(255 - 45), "the day's cash: 255 in − 45 refunded = 210");
ok(SP.returnsOf(s, T, T)[0].refunded === E(45), "returns report: the credit note and its refund");
// ---- offers
const now = new Date(T + "T17:30:00");   // a Tuesday, 17:30
const offers = [{ id: "o1", name: "Happy hour 20 %", kind: "pct", pct: 20, items: [cap], hours: [17, 19] }, { id: "o2", name: "Buy 2 get 1 croissant", kind: "bxgy", buy: 2, get: 1, category: "Bakery" }, { id: "o3", name: "Old", kind: "pct", pct: 50, to: "2026-01-01" }];
const ao = SP.applyOffers(s, [{ item: cap, qty: 2 }, { item: cro, qty: 3 }], offers, now);
ok(ao.saved === E(24) + E(45) && ao.applied.length === 2, "happy hour: 2 cappuccinos −24; 3 croissants, one free −45; the old offer is over");
ok(SP.applyOffers(s, [{ item: cap, qty: 1 }], offers, new Date(T + "T20:00:00")).saved === 0, "after 19:00 the happy hour ends");
r = S.sell(s, ao.cart, { method: "card", customer: mona, today: T, at: T + "T17:31:00Z" }); s = r.state;
ok(r.total === E(120 + 90 - 24), "the sale with the offers: 186 (the shelf prices minus the offers)");
// ---- loyalty
const pts = SP.points(s, shop, mona);
ok(pts === Math.floor((25500 - 4500 + 18600) / 1000), "loyalty: 1 point per 10 paid, refunds taken off → " + pts + " points");
const rd = SP.redeem(s, shop, mona, [{ item: cap, qty: 1 }], 20);
ok(rd.discount === E(2) && rd.points === 20, "20 points = 2.00 off the next cappuccino");
shop = SP.useRedeemed(shop, mona, rd.points); ok(SP.points(s, shop, mona) === pts - 20, "redeemed points are taken off");
ok(SP.points(s, { ...shop, loyalty: { on: false } }, mona) === 0, "loyalty off → no points");
// ---- held carts
shop = SP.holdCart(shop, { cart: [{ item: cap, qty: 1 }], note: "table 4" }, 1000);
const tk = SP.takeHeld(shop, shop.held[0].id);
ok(tk.held.note === "table 4" && tk.shop.held.length === 0, "a cart held for table 4 and picked up again");
// ---- reports
const hrs = SP.salesByHour(s, T, T);
ok(hrs[new Date(T + "T09:15:00Z").getHours()].count >= 1 && hrs.length === 24, "sales by hour of the day");
ok(SP.salesByCashier(s, T, T)[0].cashier === "Sayed" || SP.salesByCashier(s, T, T).some((x) => x.cashier === "Sayed"), "sales by cashier");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
