// Golden tests for the Business extras: ETA e-invoice JSON + validator, encrypted backups, price lists, delivery notes,
// roles, multi-currency. Every figure below was worked out by hand (see the comments).
import * as B from "../../web-src/books.js";
import * as O from "../../web-src/books-ops.js";
import * as O2 from "../../web-src/books-ops2.js";
import * as M from "../../web-src/books-more.js";
import * as ETA from "../../web-src/books-eta.js";
import * as V from "../../web-src/books-vault.js";
import { writeFileSync, mkdirSync } from "node:fs";
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }
function throws(fn, what, part) { try { fn(); console.log("FAIL " + what + " (no error)"); fails.push(what); } catch (e) { const ok = !part || String(e.message).includes(part); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : " → " + e.message)); if (!ok) fails.push(what); } }
async function rejects(p, what, part) { try { await p; console.log("FAIL " + what + " (no error)"); fails.push(what); } catch (e) { const ok = !part || String(e.message).includes(part); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : " → " + e.message)); if (!ok) fails.push(what); } }
const E = (n) => Math.round(n * 100);
const AT = "2026-09-01T09:00:00.000Z";
const step = (r) => { s = r.state || r; return r; };

// ---- a small company -----------------------------------------------------------------------------------------------
let s = O.EMPTY();
s = O.setCompany(s, { name: "Nile Trading Co.", taxId: "123-456-789", address: "12 Tahrir St" }, { at: AT });
s.eta = { activityCode: "4690", branchID: "0", governate: "Cairo", regionCity: "Downtown", street: "Tahrir St", buildingNumber: "12" };
const bolts = step(O.upsert(s, "items", { name: "Bolts box", sku: "BLT", price: E(100), vat: "S", etaCode: "EG-123456789-BLT", etaUnit: "BX" }, { at: AT })).id;
const nuts = step(O.upsert(s, "items", { name: "Nuts bag", sku: "NUT", price: E(3.33), vat: "Z", etaCode: "EG-123456789-NUT" }, { at: AT })).id;
const acme = step(O.upsert(s, "customers", { name: "Acme Contracting", taxId: "222333444", group: "wholesale" }, { at: AT })).id;
const mona = step(O.upsert(s, "customers", { name: "Mona", group: "retail" }, { at: AT })).id;
const delta = step(O.upsert(s, "suppliers", { name: "Delta" }, { at: AT })).id;
let r = step(O.saveDraft(s, { type: "bill", supplier: delta, date: "2026-09-02", lines: [{ item: bolts, qty: 30, price: E(60), vat: "S" }, { item: nuts, qty: 100, price: E(2), vat: "S" }] }, { at: AT }));
step(O.postBill(s, r.id, { at: AT }));

// ==== (1) ETA e-invoice =============================================================================================
// line 1: 10 × 100.00, VAT 14% = 140.00, withholding supplies 1% = 10.00 → ETA total 1,130.00
// line 2: 3 × 3.33 = 9.99, 10% discount = 0.999 → 1.00, net 8.99, zero-rated → 8.99
// document: sales 1,009.99, discount 1.00, net 1,008.99, T1 140.00, T4 10.00, total 1,138.99
r = step(O.saveDraft(s, { type: "invoice", customer: acme, date: "2026-09-05", lines: [{ item: bolts, desc: "Bolts box", qty: 10, price: E(100), vat: "S", wht: "supplies" }, { item: nuts, desc: "Nuts bag", qty: 3, price: E(3.33), vat: "Z", discBp: 1000 }] }, { at: AT }));
const invId = r.id;
step(O.post(s, invId, { at: "2026-09-05T10:15:30.123Z" }));
const inv = s.docs.find((d) => d.id === invId);
const J = ETA.etaDocument(s, inv);
eq([J.documentType, J.documentTypeVersion, J.dateTimeIssued, J.internalID, J.taxpayerActivityCode], ["i", "1.0", "2026-09-05T10:15:30Z", "INV-2026-00001", "4690"], "ETA header: type i, v1.0, UTC time without ms, number, activity");
eq([J.issuer.id, J.issuer.type, J.receiver.id, J.receiver.type], ["123456789", "B", "222333444", "B"], "issuer / receiver: 9-digit tax numbers, business");
const l1 = J.invoiceLines[0], l2 = J.invoiceLines[1];
eq([l1.itemType, l1.itemCode, l1.unitType, l1.quantity, l1.unitValue], ["EGS", "EG-123456789-BLT", "BX", 10, { currencySold: "EGP", amountEGP: 100 }], "line 1 identity and unit value");
eq([l1.salesTotal, l1.netTotal, l1.total, l1.taxableItems], [1000, 1000, 1130, [{ taxType: "T1", amount: 140, subType: "V009", rate: 14 }, { taxType: "T4", amount: 10, subType: "W002", rate: 1 }]], "line 1: VAT T1/V009 140, withholding T4/W002 10, total 1,130");
eq([l2.salesTotal, l2.discount, l2.netTotal, l2.total, l2.taxableItems[0]], [9.99, { rate: 10, amount: 1 }, 8.99, 8.99, { taxType: "T1", amount: 0, subType: "V001", rate: 0 }], "line 2: 9.99 − 1.00 discount = 8.99, zero rate");
eq([J.totalSalesAmount, J.totalDiscountAmount, J.netAmount, J.taxTotals, J.totalAmount, J.extraDiscountAmount, J.totalItemsDiscountAmount], [1009.99, 1, 1008.99, [{ taxType: "T1", amount: 140 }, { taxType: "T4", amount: 10 }], 1138.99, 0, 0], "document totals reconcile: 1,008.99 + 140 − 10 = 1,138.99");
eq(B.docTotals(inv).cashDue, E(1138.99), "ETA totalAmount = the books' cash due");
let v = ETA.validateEta(J);
eq([v.ok, v.errors], [true, []], "the validator accepts the exported invoice");
const bad = (f) => { const x = JSON.parse(JSON.stringify(J)); f(x); return ETA.validateEta(x).errors; };
eq(bad((x) => { x.invoiceLines[0].total = 1130.01; }).some((e) => e.includes("line 1: total")), true, "validator: a line total off by 0.01 is caught");
eq(bad((x) => { x.totalAmount = 1139; }).some((e) => e.startsWith("totalAmount")), true, "validator: a document total off is caught");
eq(bad((x) => { x.invoiceLines[0].salesTotal = 1000.000001; }).some((e) => e.includes("5 decimals")), true, "validator: more than 5 decimals is caught");
eq(bad((x) => { x.taxTotals[0].amount = 141; }).some((e) => e.startsWith("taxTotals")), true, "validator: tax totals must equal the lines");
eq(bad((x) => { x.invoiceLines[0].taxableItems[0].amount = 150; x.invoiceLines[0].total = 1140; x.totalAmount = 1148.99; x.taxTotals[0].amount = 150; }).some((e) => e.includes("T1 ≠")), true, "validator: VAT not equal to net × rate is caught even when totals are made to add up");
eq(bad((x) => { x.issuer.id = "12345"; x.taxpayerActivityCode = ""; x.dateTimeIssued = "2026-09-05 10:15"; }).length, 3, "validator: issuer id, activity code and UTC date are required");
eq(bad((x) => { x.invoiceLines[1].itemCode = ""; }).some((e) => e.includes("itemCode")), true, "validator: an item without its ETA code is refused");
eq(bad((x) => { x.receiver = { type: "P", id: "", name: "Walk-in", address: x.receiver.address }; x.totalAmount = 60000; }).some((e) => e.includes("national ID")), true, "validator: a person buying ≥ 50,000 needs a national ID");

// table tax 5% before VAT: 100.00 → T2 5.00, VAT on 105.00 = 14.70, total 119.70
r = step(O.saveDraft(s, { type: "invoice", customer: acme, date: "2026-09-06", lines: [{ item: bolts, qty: 1, price: E(100), vat: "S", tableBp: 500 }] }, { at: AT }));
step(O.post(s, r.id, { at: AT }));
const Jt = ETA.etaDocument(s, s.docs.find((d) => d.id === r.id));
eq([Jt.invoiceLines[0].taxableItems, Jt.totalAmount, ETA.validateEta(Jt).ok], [[{ taxType: "T2", amount: 5, subType: "Tbl01", rate: 5 }, { taxType: "T1", amount: 14.7, subType: "V009", rate: 14 }], 119.7, true], "table tax T2 5.00, then VAT 14.70 on 105.00 = 119.70, valid");

// credit note: type c, positive figures, references the original
let cn = O.creditNoteFor(s, invId, { lines: [inv.lines[0]], date: "2026-09-08", reason: "2 boxes back" });
cn.lines[0].qty = -2;
r = step(O.saveDraft(s, cn, { at: AT })); step(O.post(s, r.id, { at: AT }));
const Jc = ETA.etaDocument(s, s.docs.find((d) => d.id === r.id));
v = ETA.validateEta(Jc);
eq([Jc.documentType, Jc.internalID, Jc.references, Jc.invoiceLines[0].quantity, Jc.invoiceLines[0].total, Jc.totalAmount, v.ok, v.warnings.length], ["c", "CN-2026-00001", ["INV-2026-00001"], 2, 226, 226, true, 1], "credit note: type c, 2 × 100 + 28 VAT − 2 WHT = 226.00, references the invoice (warning: use the ETA UUID)");
const batch = ETA.etaBatch(s, "2026-09-01", "2026-09-30");
eq([batch.count, batch.ok, batch.documents.map((d) => d.internalID)], [3, true, ["INV-2026-00001", "INV-2026-00002", "CN-2026-00001"]], "batch export: every posted invoice and credit note of the period, in order, all valid");
mkdirSync(new URL("../fixtures/", import.meta.url), { recursive: true });
writeFileSync(new URL("../fixtures/eta-sample-invoice.json", import.meta.url), ETA.etaFileText(J) + "\n");

// ==== (3a) price lists ==============================================================================================
// wholesale: list A from 1 Jan (any qty 90.00, 50+ → 85.00); list B from 15 Sep (88.00) replaces A after that date
r = step(O2.savePriceList(s, { name: "Wholesale 2026", group: "wholesale", from: "2026-01-01", prices: { [bolts]: [{ minQty: 0, price: E(90) }, { minQty: 50, price: E(85) }] } }, { at: AT }));
r = step(O2.savePriceList(s, { name: "Wholesale autumn", group: "wholesale", from: "2026-09-15", to: "2026-12-31", prices: { [bolts]: [{ minQty: 0, price: E(88) }] } }, { at: AT }));
const P = (customer, qty, date) => O2.priceOf(s, { customer, item: bolts, qty, date }).price;
eq([P(acme, 10, "2026-09-10"), P(acme, 60, "2026-09-10"), P(acme, 60, "2026-09-20"), P(mona, 60, "2026-09-20"), P(acme, 5, "2027-01-05")], [E(90), E(85), E(88), E(100), E(90)], "price lists: group, quantity break, newest effective list, other group, after the end date");
throws(() => O2.savePriceList(s, { name: "x", group: "g", from: "2026-02-01", to: "2026-01-01", prices: {} }), "a list ending before it starts is refused", "end date");
throws(() => O2.savePriceList(s, { name: "x", group: "g", prices: { a: [{ minQty: 5, price: 1 }, { minQty: 5, price: 2 }] } }), "the same quantity break twice is refused", "twice");

// ==== (4) roles =====================================================================================================
eq(M.permMatrix().map((x) => [x.perm, x.owner, x.accountant, x.cashier, x.viewer]), [["post", true, true, true, false], ["void", true, true, false, false], ["prices", true, true, false, false], ["profit", true, true, false, false], ["export", true, true, false, false], ["restore", true, false, false, false], ["users", true, false, false, false]], "the permission matrix");
throws(() => O2.saveUser(s, { name: "Sara", role: "cashier", pin: "1111" }), "the first user must be the owner", "owner");
const ali = step(O2.saveUser(s, { name: "Ali", role: "owner", pin: "1234" }, { at: AT, salt: "s1" })).id;
O.setActor(O2.userByPin(s, "1234"));
const sara = step(O2.saveUser(s, { name: "Sara", role: "cashier", pin: "5555" }, { at: AT, salt: "s2" })).id;
step(O2.saveUser(s, { name: "Omar", role: "viewer", pin: "7777" }, { at: AT, salt: "s3" }));
throws(() => O2.saveUser(s, { name: "Dup", role: "viewer", pin: "5555" }), "two users cannot share a PIN", "already");
throws(() => O2.saveUser(s, { id: ali, name: "Ali", role: "accountant" }), "the last owner cannot be demoted", "owner");
eq([O2.userByPin(s, "5555").name, O2.userByPin(s, "0000")], ["Sara", null], "a PIN opens its own user");
O.setActor(O2.userByPin(s, "5555"));                                   // Sara, cashier
r = step(O.saveDraft(s, { type: "invoice", customer: acme, date: "2026-09-10", lines: [{ item: bolts, qty: 2, price: E(90), vat: "S" }] }, { at: AT }));
r = step(O.post(s, r.id, { at: AT }));
eq([r.number, s.audit[s.audit.length - 1].user], ["INV-2026-00003", "Sara"], "a cashier posts at the list price; the audit entry carries her name");
r = step(O.saveDraft(s, { type: "invoice", customer: acme, date: "2026-09-10", lines: [{ item: bolts, qty: 2, price: E(70), vat: "S" }] }, { at: AT }));
throws(() => O.post(s, r.id, { at: AT }), "a cashier cannot sell below the list price", "change a price");
step(O.deleteDraft(s, r.id, { at: AT }));
r = step(O.saveDraft(s, O.creditNoteFor(s, invId, { date: "2026-09-10" }), { at: AT }));
throws(() => O.post(s, r.id, { at: AT }), "a cashier cannot void (credit note)", "not allowed");
step(O.deleteDraft(s, r.id, { at: AT }));
throws(() => O2.saveUser(s, { name: "X", role: "owner", pin: "9999" }), "a cashier cannot add users", "not allowed");
O.setActor(O2.userByPin(s, "7777"));                                   // Omar, viewer
throws(() => O.receive(s, { customer: acme, date: "2026-09-11", amount: E(10) }), "a viewer cannot take a receipt", "not allowed");
O.setActor(O2.userByPin(s, "1234"));                                   // back to Ali
eq(O.verifyAudit(s).ok, true, "the audit chain is intact with several users");

// ==== (3b) delivery notes ===========================================================================================
const before = O.levels(s)[bolts];
r = step(O.saveDraft(s, { type: "order", customer: mona, date: "2026-09-12", lines: [{ item: bolts, desc: "Bolts box", qty: 10, price: E(100), vat: "S" }, { desc: "Packing", qty: 1, price: E(20), vat: "S" }] }, { at: AT }));
const orderId = r.id; r = step(O.post(s, orderId, { at: AT }));
eq([r.number, O.levels(s)[bolts].qty], ["SO-2026-00001", before.qty], "posting an order numbers it and does not move stock");
const avg = O.levels(s)[bolts].avgCost;
r = step(O2.postDelivery(s, { docId: orderId, date: "2026-09-13", lines: [{ line: 0, qty: 4 }] }, { at: AT }));
eq([r.number, O.levels(s)[bolts].qty, s.deliveries[0].cogs], ["DN-2026-00001", before.qty - 4, 4 * avg], "partial delivery of 4: numbered DN-2026-00001, stock −4 at the average cost");
throws(() => O2.postDelivery(s, { docId: orderId, date: "2026-09-14", lines: [{ line: 0, qty: 7 }] }), "cannot deliver more than is left (6)", "Only 6");
r = step(O2.postDelivery(s, { docId: orderId, date: "2026-09-14", lines: [{ line: 0, qty: 6 }] }, { at: AT }));
eq([r.number, O2.toDeliver(s, orderId).left[0].left, O.levels(s)[bolts].qty], ["DN-2026-00002", 0, before.qty - 10], "second delivery 6: nothing left, gapless numbering");
const fromOrder = O2.invoiceFromOrder(s, orderId, "2026-09-14");
r = step(O.saveDraft(s, fromOrder, { at: AT })); step(O.post(s, r.id, { at: AT }));
eq([fromOrder.lines[0].qty, fromOrder.lines[0].delivered, O.levels(s)[bolts].qty], [10, true, before.qty - 10], "the invoice from the order does not move the stock again");
r = step(O2.postDelivery(s, { docId: invId, date: "2026-09-15", lines: [{ line: 0, qty: 10 }] }, { at: AT }));
eq([r.number, O.levels(s)[bolts].qty], ["DN-2026-00003", before.qty - 10], "a delivery note from an invoice records the delivery only (stock left at invoicing)");
eq(B.trialBalance(s.journal).balanced, true, "the ledger balances after deliveries");

// ==== (5) multi-currency ============================================================================================
eq([M.toRate5("48.5"), M.toRate5("49.12345"), M.toRate5("1.123456"), M.toEGP(E(100), 4850000)], [4850000, 4912345, null, E(4850)], "rates: 5 decimals exact; 100.00 USD × 48.5 = 4,850.00 EGP");
step(O2.setRate(s, { currency: "USD", date: "2026-09-01", rate: "48.50" }, { at: AT }));
step(O2.setRate(s, { currency: "USD", date: "2026-09-20", rate: "49.10" }, { at: AT }));
step(O2.setRate(s, { currency: "USD", date: "2026-09-25", rate: "48.00" }, { at: AT }));
eq([M.rateOn(s.fxRates, "USD", "2026-09-19"), M.rateOn(s.fxRates, "USD", "2026-09-20"), M.rateOn(s.fxRates, "EUR", "2026-09-20"), M.rateOn(s.fxRates, "EGP", "2026-01-01")], [4850000, 4910000, null, 100000], "the rate in force on a date");
// 10 × 100.00 USD + 14% → 1,140.00 USD; at 48.50 → EGP 48,500 + 6,790 = 55,290.00
const usdDoc = M.toBaseDoc({ type: "invoice", customer: acme, date: "2026-09-16", lines: [{ item: bolts, qty: 10, price: E(100), vat: "S" }] }, "USD", M.rateOn(s.fxRates, "USD", "2026-09-16"));
r = step(O.saveDraft(s, usdDoc, { at: AT })); const usdId = r.id; r = step(O.post(s, usdId, { at: AT }));
const usdInv = s.docs.find((d) => d.id === usdId), FT = M.fxTotals(usdInv);
eq([FT.currency, FT.own.total, FT.egp.net, FT.egp.vat, FT.egp.total], ["USD", E(1140), E(48500), E(6790), E(55290)], "a USD invoice: 1,140.00 USD = 55,290.00 EGP in the books");
const Ju = ETA.etaDocument(s, usdInv);
eq([Ju.invoiceLines[0].unitValue, Ju.totalAmount, ETA.validateEta(Ju).ok], [{ currencySold: "USD", amountEGP: 4850, amountSold: 100, currencyExchangeRate: 48.5 }, 55290, true], "ETA: foreign currency line with amountSold, rate and EGP amount");
// pay 500 USD at 49.10: clears 24,250.00 at the invoice rate, receives 24,550.00 → gain 300.00
r = step(O2.receiveFx(s, { customer: acme, date: "2026-09-21", currency: "USD", amountFx: E(500) }, { at: AT }));
eq([r.cleared, r.received, r.gain], [E(24250), E(24550), E(300)], "part payment at a higher rate: realised gain 300.00");
// the remaining 640 USD at 48.00: clears exactly what is left (31,040.00), receives 30,720.00 → loss 320.00
r = step(O2.receiveFx(s, { customer: acme, date: "2026-09-26", currency: "USD", amountFx: E(640) }, { at: AT }));
eq([r.cleared, r.received, r.gain], [E(31040), E(30720), E(-320)], "final payment at a lower rate: clears the rest exactly, loss 320.00");
eq([O2.fxOpen(s, usdInv.number).openFx, O.openInvoices(s).find((o) => o.number === usdInv.number).open], [0, 0], "the USD invoice is fully settled in USD and in EGP");
const pl = B.profitAndLoss(s.journal, "2026-09-21", "2026-09-26");
eq(pl.fxGain, E(-20), "P&L shows the net exchange loss 300 − 320 = −20.00 (in EGP)");
throws(() => O2.receiveFx(s, { customer: acme, date: "2026-09-26", currency: "USD", amountFx: E(1) }), "nothing left to pay in USD", "Allocate");
throws(() => O2.receiveFx(s, { customer: acme, date: "2026-08-01", currency: "USD", amountFx: E(1) }), "no rate before the first one", "No USD rate");
eq(B.trialBalance(s.journal).balanced, true, "the ledger balances after foreign-currency receipts");
const st = B.statement({ customer: acme, invoices: s.docs.filter((d) => d.type === "invoice" && d.status === "posted"), credits: s.docs.filter((d) => d.type === "credit" && d.status === "posted"), payments: s.payments });
eq(st.lines.filter((l) => l.ref === usdInv.number || l.kind === "payment").reduce((a, l) => a + l.debit - l.credit, 0), 0, "the customer's statement nets the USD invoice to zero (exchange difference kept out of their balance)");

// ==== (2) encrypted backup ==========================================================================================
O.setActor(null);
const ITER = 2000;          // the app uses 600,000; tests use fewer so they run fast — the code path is the same
const file = await V.seal(s, "my passphrase", { iterations: ITER, now: "2026-10-01T08:00:00.000Z" });
const head = V.header(file);
eq([head.format, head.kdf.name, head.kdf.hash, head.kdf.iter, head.summary.docs, file.includes("Acme")], ["attune-books-vault", "PBKDF2", "SHA-256", ITER, s.docs.length, false], "the backup is encrypted: readable header, no customer names in clear");
eq(V.VAULT_ITER, 600000, "the app derives the key with 600,000 PBKDF2 iterations");
const back = await V.open(file, "my passphrase");
eq([JSON.stringify(back.state) === JSON.stringify({ ...O.EMPTY(), ...s }), back.check], [true, { fingerprint: true, audit: true, auditBrokenAt: null, balanced: true, ok: true }], "round trip: the same books, fingerprint, audit and balance all checked");
await rejects(V.open(file, "wrong passphrase"), "a wrong passphrase is refused", "Wrong");
const tam = JSON.parse(file); tam.summary.docs = 1;
await rejects(V.open(JSON.stringify(tam), "my passphrase"), "tamper: an edited header is detected", "changed");
const tam2 = JSON.parse(file); const raw = atob(tam2.data); tam2.data = btoa(raw.slice(0, 40) + String.fromCharCode(raw.charCodeAt(40) ^ 1) + raw.slice(41));
await rejects(V.open(JSON.stringify(tam2), "my passphrase"), "tamper: one flipped bit in the data is detected", "changed");
const tam3 = JSON.parse(file); tam3.fp = "0".repeat(64);
await rejects(V.open(JSON.stringify(tam3), "my passphrase"), "tamper: a swapped fingerprint is detected", "changed");
const edited = JSON.parse(JSON.stringify(s)); edited.audit[3].detail = "nothing to see";
const back2 = await V.open(await V.seal(edited, "1234", { iterations: ITER }), "1234");
eq([back2.check.audit, back2.check.auditBrokenAt, back2.check.ok], [false, 4, false], "a backup of books whose audit log was edited opens but is flagged (entry 4)");
await rejects(V.seal(s, "12", { iterations: ITER }), "a too-short secret is refused", "PIN or passphrase");
// dry run
const later = JSON.parse(JSON.stringify(s));
step(O.upsert(later, "customers", { name: "New Co" }, { at: AT })); const later2 = s;
s = back.state;
const diff = V.diffBooks(later2, back.state);
eq([diff.lists.customers, diff.same], [{ now: 3, backup: 2, added: 0, removed: 1, changed: 0 }, false], "dry run: restoring would remove the customer added after the backup");
eq(V.diffBooks(back.state, back.state).same, true, "dry run: identical books → nothing changes");
// snapshot policy
const fp1 = await V.fingerprint(back.state);
eq([fp1 === await V.fingerprint(JSON.parse(JSON.stringify(back.state))), fp1.length], [true, 64], "the fingerprint is stable (SHA-256)");
eq(V.planSnapshots([{ name: "a", date: "2026-10-01", fp: fp1 }], "2026-10-02", fp1).take, false, "no snapshot when nothing changed");
const days = []; for (let i = 0; i < 70; i++) days.push({ name: "d" + i, date: O.addDays("2026-10-01", -i), fp: "f" + i });
const plan = V.planSnapshots(days, "2026-10-02", "new");
eq([plan.take, plan.keep.length, plan.keep.slice(0, 7).map((x) => x.date), plan.keep.slice(7).map((x) => x.date), plan.drop.length], [true, 9,
  ["2026-10-02", "2026-10-01", "2026-09-30", "2026-09-29", "2026-09-28", "2026-09-27", "2026-09-26"], ["2026-08-31", "2026-07-31"], 62], "keep the last 7 + the newest of each older month (Aug 31, Jul 31); drop 62");
eq(V.planSnapshots([{ name: "x", date: "2026-10-02", fp: "old" }], "2026-10-02", "new", "y").drop, ["x"], "a second snapshot the same day replaces the first");

console.log(fails.length ? `\n${fails.length} FAILED` : "\nall passed");
process.exit(fails.length ? 1 : 0);
