/* ---- Egyptian Tax Authority (ETA) e-invoice export: the document JSON of the public SDK, "Invoice v1.0" ---------------
   Builds the unsigned document from a posted invoice / credit note (and debit note), checks it the way the portal does
   (required fields, rounding to at most 5 decimals, every line and the document totals reconcile), and batches them.

   What this does NOT do, on purpose: SIGNING and SUBMISSION. The ETA accepts a document only when it is signed with the
   taxpayer's own certificate (the USB token / HSM issued to the company) and submitted with the company's own API
   credentials (client id and secret from the ETA portal). Those belong to the company; this app never fakes them. The
   exported file is what the signing tool (or the accountant's ERP connector) takes as input.

   Mapping from the books: VAT "S" → T1 / V009 (general sales), "Z" → T1 / V001 (export, 0%), "E" → T1 / V003 (exempt);
   table tax → T2 / Tbl01 (percentage, before VAT — same order as the books); withholding → T4 / W002 supplies,
   W004 services, W010 professional fees. Codes are kept in ETA_CODES so an accountant can change them.
   Figures come from books.js (piastres), so every value has 2 decimals and the reconciliation is exact.
   Tests: tests/unit/v620bizextras.test.mjs.                                                                            */
import * as B from "./books.js";
import { fxView } from "./books-more.js";

export const ETA_CODES = {
  vat: { S: "V009", Z: "V001", E: "V003" },
  wht: { supplies: "W002", services: "W004", professional: "W010" },
  table: "Tbl01",
  docType: { invoice: "i", credit: "c", debit: "d" },
};
const n2 = (minor) => Number((minor / 100).toFixed(2));
const digits = (x) => String(x || "").replace(/\D/g, "");
const RECEIVER_ID_LIMIT = 5000000;        // 50,000 EGP: above this a person (type P) receiver needs a national ID

function address(a = {}, fallback = "") {
  return { branchID: String(a.branchID ?? "0"), country: a.country || "EG", governate: a.governate || "", regionCity: a.regionCity || "", street: a.street || fallback || "", buildingNumber: String(a.buildingNumber || "") };
}
/** dateTimeIssued: UTC, no milliseconds (the portal rejects fractions). The document date plus the posting time. */
export function issuedAt(doc) {
  const t = /T(\d{2}:\d{2}:\d{2})/.exec(doc.postedAt || "");
  return `${doc.date}T${t ? t[1] : "00:00:00"}Z`;
}

/** One invoice line → an ETA invoiceLine (values in EGP). */
export function etaLine(l, s, cur, rate5) {
  const tax = s.tax, f = B.lineFigures(l, tax), sign = Number(l.qty) < 0 ? -1 : 1;
  const A = (m) => n2(sign * m);                               // credit notes are sent with positive figures
  const it = (s.items || []).find((x) => x.id === l.item) || {};
  const code = (tax.vatCodes || {})[l.vat || "S"] || {};
  const taxableItems = [];
  if (f.tableTax) taxableItems.push({ taxType: "T2", amount: A(f.tableTax), subType: ETA_CODES.table, rate: Number(l.tableBp || 0) / 100 });
  taxableItems.push({ taxType: "T1", amount: A(f.vat), subType: ETA_CODES.vat[l.vat || "S"] || "V009", rate: code.exempt ? 0 : f.vatBp / 100 });
  if (f.wht) {
    const wcode = typeof l.wht === "string" ? ETA_CODES.wht[l.wht] : "W002";
    const wbp = typeof l.wht === "number" ? l.wht : ((tax.whtCodes || {})[l.wht] || { bp: 0 }).bp;
    taxableItems.push({ taxType: "T4", amount: A(f.wht), subType: wcode || "W002", rate: wbp / 100 });
  }
  const unitValue = { currencySold: cur || "EGP", amountEGP: n2(l.price) };
  if (cur && cur !== "EGP") { unitValue.amountSold = n2(l.fxPrice); unitValue.currencyExchangeRate = rate5 / 100000; }
  return {
    description: l.desc || it.name || "",
    itemType: it.etaType || "EGS", itemCode: it.etaCode || "", unitType: it.etaUnit || "EA",
    quantity: Math.abs(Number(l.qty)), internalCode: it.sku || l.item || "",
    salesTotal: A(f.gross), total: A(f.total - f.wht), valueDifference: 0, totalTaxableFees: 0,
    netTotal: A(f.net), itemsDiscount: 0, unitValue,
    discount: { rate: Number(l.discBp || 0) / 100, amount: A(f.discount) },
    taxableItems,
  };
}

/** A posted sales document → the ETA document JSON (unsigned). */
export function etaDocument(s, doc) {
  const co = s.company || {}, eta = s.eta || {}, cust = (s.customers || []).find((c) => c.id === doc.customer) || {};
  const cur = doc.fx ? doc.fx.currency : "EGP", rate5 = doc.fx ? doc.fx.rate : 100000;
  const lines = doc.lines.map((l) => etaLine(l, s, cur, rate5));
  const sum = (k) => n2(lines.reduce((a, x) => a + Math.round(x[k] * 100), 0));
  const totals = {};
  for (const x of lines) for (const t of x.taxableItems) totals[t.taxType] = (totals[t.taxType] || 0) + Math.round(t.amount * 100);
  const custTax = digits(cust.taxId);
  const receiver = { address: address(cust.eta, cust.address), type: cust.etaType || (custTax ? "B" : "P"), id: cust.etaType === "P" ? digits(cust.nationalId) : custTax || digits(cust.nationalId), name: cust.name || "" };
  const out = {
    issuer: { address: address(eta, co.address), type: "B", id: digits(co.taxId), name: co.name || co.nameAr || "" },
    receiver,
    documentType: ETA_CODES.docType[doc.type] || "i",
    documentTypeVersion: "1.0",
    dateTimeIssued: issuedAt(doc),
    taxpayerActivityCode: String(eta.activityCode || ""),
    internalID: doc.number || "",
    purchaseOrderReference: doc.poRef || "", purchaseOrderDescription: "", salesOrderReference: doc.from || "", salesOrderDescription: "", proformaInvoiceNumber: "",
    payment: { bankName: "", bankAddress: "", bankAccountNo: "", bankAccountIBAN: "", swiftCode: "", terms: doc.due ? `Due ${doc.due}` : "" },
    delivery: { approach: "", packaging: "", dateValidity: "", exportPort: "", grossWeight: 0, netWeight: 0, terms: "" },
    invoiceLines: lines,
    totalDiscountAmount: n2(lines.reduce((a, x) => a + Math.round(x.discount.amount * 100), 0)),
    totalSalesAmount: sum("salesTotal"),
    netAmount: sum("netTotal"),
    taxTotals: Object.entries(totals).map(([taxType, amount]) => ({ taxType, amount: n2(amount) })),
    totalAmount: sum("total"),
    extraDiscountAmount: 0,
    totalItemsDiscountAmount: 0,
  };
  if (out.documentType !== "i") out.references = [doc.etaRef || doc.against || ""];
  return out;
}

// ---- the validator: the same arithmetic the portal checks ----------------------------------------------------------
const dec5 = (v) => typeof v === "number" && isFinite(v) && Math.abs(Math.round(v * 1e5) - v * 1e5) < 1e-6;
const C = (v) => Math.round(v * 100000);          // compare in 1/100000 so floats never decide
const TOL = 500;                                   // 0.005 EGP: quantity × unit price may carry more decimals than the line's rounded value

/** → { ok, errors: [..], warnings: [..] }. errors = the portal would reject; warnings = check before signing. */
export function validateEta(d) {
  const E = [], W = [];
  const need = (cond, msg) => { if (!cond) E.push(msg); };
  need(["i", "c", "d"].includes(d.documentType), "documentType must be i, c or d");
  need(d.documentTypeVersion === "1.0", "documentTypeVersion must be 1.0");
  need(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(d.dateTimeIssued || ""), "dateTimeIssued must be UTC like 2026-10-04T09:30:00Z");
  need(/^\d{4}$/.test(d.taxpayerActivityCode || ""), "taxpayerActivityCode: the 4-digit activity code from your ETA registration (Settings → E-invoice)");
  need(!!d.internalID, "internalID (the invoice number) is missing");
  const is = d.issuer || {};
  need(/^\d{9}$/.test(is.id || ""), "issuer.id: your 9-digit tax registration number");
  need(!!is.name, "issuer.name is missing");
  for (const k of ["governate", "regionCity", "street", "buildingNumber"]) need(!!(is.address || {})[k], `issuer.address.${k} is missing (Settings → E-invoice)`);
  const rc = d.receiver || {};
  need(["B", "P", "F"].includes(rc.type), "receiver.type must be B (business), P (person) or F (foreigner)");
  if (rc.type === "B") need(/^\d{9}$/.test(rc.id || ""), "receiver.id: the customer's 9-digit tax number");
  if (rc.type === "P" && C(d.totalAmount) >= C(RECEIVER_ID_LIMIT / 100)) need(/^\d{14}$/.test(rc.id || ""), "receiver.id: a person buying 50,000 EGP or more needs a 14-digit national ID");
  need(!!rc.name, "receiver.name is missing");
  if (d.documentType !== "i") { need(Array.isArray(d.references) && d.references.length && d.references[0], "a credit / debit note must reference the original invoice"); if (d.references && !/^[A-Z0-9]{26}$/.test(d.references[0] || "")) W.push("references: replace the invoice number with the ETA UUID of the original after it is accepted"); }
  const lines = d.invoiceLines || [];
  need(lines.length > 0, "the document has no lines");
  const sums = { salesTotal: 0, netTotal: 0, total: 0, discount: 0, taxes: {} };
  lines.forEach((l, i) => {
    const at = `line ${i + 1}`;
    need(!!l.description, `${at}: description is missing`);
    need(["EGS", "GS1"].includes(l.itemType), `${at}: itemType must be EGS or GS1`);
    if (!l.itemCode) E.push(`${at}: itemCode is missing — add the item's ETA code (EGS-xxxxxxxxx-… or a GS1 barcode) on the item`);
    else if (l.itemType === "EGS" && !/^EG-\d{9}-.+/.test(l.itemCode)) W.push(`${at}: an EGS code usually looks like EG-<tax no>-<your code>`);
    need(!!l.unitType, `${at}: unitType is missing`);
    for (const k of ["quantity", "salesTotal", "netTotal", "total", "itemsDiscount", "valueDifference", "totalTaxableFees"]) need(dec5(l[k]), `${at}: ${k} must be a number with at most 5 decimals`);
    need(l.quantity > 0, `${at}: quantity must be more than 0`);
    const u = l.unitValue || {};
    need(dec5(u.amountEGP), `${at}: unitValue.amountEGP must have at most 5 decimals`);
    if (u.currencySold && u.currencySold !== "EGP") {
      need(dec5(u.amountSold) && dec5(u.currencyExchangeRate) && u.currencyExchangeRate > 0, `${at}: a foreign currency needs amountSold and currencyExchangeRate`);
      if (dec5(u.amountSold) && u.currencyExchangeRate) need(Math.abs(C(u.amountSold * u.currencyExchangeRate) - C(u.amountEGP)) <= TOL, `${at}: amountSold × rate does not match amountEGP`);
    }
    need(Math.abs(C(l.quantity * u.amountEGP) - C(l.salesTotal)) <= TOL, `${at}: salesTotal ≠ quantity × unit price`);
    const disc = (l.discount || {}).amount || 0;
    need(C(l.salesTotal) - C(disc) === C(l.netTotal), `${at}: netTotal ≠ salesTotal − discount`);
    let taxAdd = 0, taxLess = 0, t2 = 0;
    for (const t of l.taxableItems || []) {
      need(/^T\d{1,2}$/.test(t.taxType) && !!t.subType, `${at}: every tax needs a taxType and subType`);
      need(dec5(t.amount) && dec5(t.rate), `${at}: ${t.taxType} amount/rate must have at most 5 decimals`);
      if (t.taxType === "T2") { t2 += C(t.amount); need(Math.abs(C(l.netTotal * t.rate / 100) - C(t.amount)) <= TOL, `${at}: T2 ≠ net × rate`); }
      if (t.taxType === "T4") { taxLess += C(t.amount); need(Math.abs(C((l.netTotal - l.itemsDiscount) * t.rate / 100) - C(t.amount)) <= TOL, `${at}: T4 ≠ (net − items discount) × rate`); }
      else taxAdd += C(t.amount);
      sums.taxes[t.taxType] = (sums.taxes[t.taxType] || 0) + C(t.amount);
    }
    const t1 = (l.taxableItems || []).find((t) => t.taxType === "T1");
    if (t1) need(Math.abs((C(l.netTotal) + t2 + C(l.totalTaxableFees) + C(l.valueDifference)) * t1.rate / 100 - C(t1.amount)) <= TOL, `${at}: T1 ≠ (net + table tax + fees) × rate`);
    need(C(l.netTotal) + C(l.totalTaxableFees) + taxAdd - taxLess - C(l.itemsDiscount) === C(l.total), `${at}: total ≠ net + taxes − withholding − items discount`);
    sums.salesTotal += C(l.salesTotal); sums.netTotal += C(l.netTotal); sums.total += C(l.total); sums.discount += C(disc);
  });
  need(sums.salesTotal === C(d.totalSalesAmount), "totalSalesAmount ≠ the sum of the lines' salesTotal");
  need(sums.discount === C(d.totalDiscountAmount), "totalDiscountAmount ≠ the sum of the lines' discounts");
  need(sums.netTotal === C(d.netAmount), "netAmount ≠ the sum of the lines' netTotal");
  need(sums.total - C(d.extraDiscountAmount || 0) === C(d.totalAmount), "totalAmount ≠ the sum of the lines' total − extra discount");
  const tt = Object.fromEntries((d.taxTotals || []).map((t) => [t.taxType, C(t.amount)]));
  need(JSON.stringify(Object.keys(tt).sort()) === JSON.stringify(Object.keys(sums.taxes).sort()) && Object.keys(tt).every((k) => tt[k] === sums.taxes[k]), "taxTotals ≠ the sum of the lines' taxes per type");
  for (const k of ["totalSalesAmount", "netAmount", "totalAmount", "totalDiscountAmount", "extraDiscountAmount", "totalItemsDiscountAmount"]) need(dec5(d[k]), `${k} must have at most 5 decimals`);
  return { ok: !E.length, errors: E, warnings: W };
}

/** Every posted invoice / credit note in a period → { documents: [...] } (the portal's submission envelope) + a report. */
export function etaBatch(s, from, to) {
  const docs = (s.docs || []).filter((d) => d.status === "posted" && (d.type === "invoice" || d.type === "credit" || d.type === "debit") && (!from || d.date >= from) && (!to || d.date <= to))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.number < b.number ? -1 : 1));
  const documents = [], report = [];
  for (const d of docs) { const j = etaDocument(s, d); const v = validateEta(j); documents.push(j); report.push({ number: d.number, ok: v.ok, errors: v.errors, warnings: v.warnings }); }
  return { documents, report, ok: report.every((r) => r.ok), count: documents.length };
}
/** The file text: one document, or the batch envelope. A note explains what the file is for. */
export const etaFileText = (x) => JSON.stringify(Array.isArray(x) ? { documents: x } : x, null, 2);
export const ETA_NOTE = {
  en: "Unsigned ETA document(s). To submit, sign with your company's ETA certificate (USB token) and send with your own ETA portal credentials — this app does not sign or submit.",
  ar: "مستند (أو مستندات) لمصلحة الضرائب غير موقّعة. للإرسال: وقّعها بشهادة شركتك (التوكن) وابعتها ببيانات دخولك على بوابة المصلحة — التطبيق لا يوقّع ولا يرسل.",
};
