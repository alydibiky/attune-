/* ---- v6.12: Business books → Egyptian Tax Authority (ETA) e-invoice JSON (document version 1.0) -------------------------------
   NEXT_SESSION item 26: "store every required field and export the ETA JSON, but never claim to sign or submit (that needs a
   token / online step)". This builds the document the ETA portal / an e-invoicing integrator takes, from a POSTED invoice or
   credit note, and lists every field still missing (the activity code, the address parts, the item codes) so the owner can
   fill them in Settings and on each item. Amounts are in EGP with up to 5 decimals, as the format asks; the figures come from
   books.js (lineFigures), so the JSON equals the printed invoice. Tests: tests/unit/v709eta.test.mjs.                      */
import * as B from "./books.js";

const egp = (minor) => Math.round(minor) / 100;            // piastres → pounds (2 decimals is exact for our figures)
const r5 = (x) => Math.round(x * 100000) / 100000;

/** An address in ETA's parts. Missing parts are left "" and reported by etaCheck. */
function addr(a = {}, country = "EG") {
  return { branchID: String(a.branchID ?? "0"), country: a.country || country, governate: a.governate || "", regionCity: a.regionCity || "", street: a.street || "", buildingNumber: String(a.buildingNumber || ""), ...(a.postalCode ? { postalCode: String(a.postalCode) } : {}) };
}
const digits = (s) => String(s || "").replace(/\D/g, "");

/**
 * One posted sales document → the ETA document.
 * state: the books (company, customers, items, tax); doc: { type: "invoice"|"credit", number, date, customer, lines, … }.
 * company.eta: { activityCode, address: {governate, regionCity, street, buildingNumber, branchID} }
 * customer.eta: { type: "B"|"P"|"F", address: {…} } (B = a company with a tax number, P = a person, F = foreign)
 */
export function etaDocument(state, doc, { issued = null } = {}) {
  const co = state.company || {}, tax = state.tax || B.DEFAULT_TAX;
  const cust = (state.customers || []).find((c) => c.id === doc.customer) || {};
  const items = new Map((state.items || []).map((i) => [i.id, i]));
  const credit = doc.type === "credit";
  const sign = credit ? -1 : 1;                              // a credit note carries negative quantities in the books; ETA wants positives
  const ce = cust.eta || {};
  const rType = ce.type || (digits(cust.taxId).length >= 9 ? "B" : "P");
  const lines = (doc.lines || []).map((l) => {
    const f = B.lineFigures(l, tax), it = items.get(l.item) || {};
    const qty = Math.abs(Number(l.qty ?? 1)) || 1;
    const salesTotal = egp(Math.abs(f.gross)), discount = egp(Math.abs(f.discount)), netTotal = egp(Math.abs(f.net));
    const taxable = [];
    if (f.tableTax) taxable.push({ taxType: "T2", amount: egp(Math.abs(f.tableTax)), subType: "Tbl01", rate: Number(l.tableBp || 0) / 100 });
    const code = (tax.vatCodes || {})[l.vat || "S"] || {};
    taxable.push({ taxType: "T1", amount: egp(Math.abs(f.vat)), subType: code.exempt ? "V003" : f.vatBp === 0 ? "V002" : "V009", rate: f.vatBp / 100 });
    if (f.wht) taxable.push({ taxType: "T4", amount: egp(Math.abs(f.wht)), subType: "W010", rate: (typeof l.wht === "number" ? l.wht : ((tax.whtCodes || {})[l.wht] || { bp: 0 }).bp) / 100 });
    const lineTotal = r5(netTotal + taxable.filter((t) => t.taxType !== "T4").reduce((a, t) => a + t.amount, 0) - taxable.filter((t) => t.taxType === "T4").reduce((a, t) => a + t.amount, 0));
    return {
      description: String(l.desc || it.name || "Item").slice(0, 500),
      itemType: (it.eta && it.eta.itemType) || (it.gs1 ? "GS1" : "EGS"),
      itemCode: (it.eta && it.eta.itemCode) || it.gs1 || "",
      unitType: (it.eta && it.eta.unitType) || "EA",
      quantity: qty,
      internalCode: it.sku || String(l.item || ""),
      salesTotal, total: lineTotal, valueDifference: 0, totalTaxableFees: 0, netTotal, itemsDiscount: 0,
      unitValue: { currencySold: "EGP", amountEGP: r5(egp(Math.abs(Number(l.price || 0)))) },
      discount: { rate: Number(l.discBp || 0) / 100, amount: discount },
      taxableItems: taxable,
    };
  });
  const sum = (k) => r5(lines.reduce((a, x) => a + x[k], 0));
  const taxTotals = {};
  for (const x of lines) for (const t of x.taxableItems) taxTotals[t.taxType] = r5((taxTotals[t.taxType] || 0) + t.amount);
  return {
    issuer: { address: addr((co.eta || {}).address), type: "B", id: digits(co.taxId), name: co.name || co.nameAr || "" },
    receiver: { address: addr(ce.address), type: rType, id: rType === "B" ? digits(cust.taxId) : digits(ce.nationalId || ""), name: cust.name || "" },
    documentType: credit ? "C" : "I",
    documentTypeVersion: "1.0",
    dateTimeIssued: issued || (String(doc.date || "").slice(0, 10) + "T08:00:00Z"),
    taxpayerActivityCode: String((co.eta || {}).activityCode || ""),
    internalID: String(doc.number || doc.id || ""),
    ...(credit && doc.of ? { references: [String(doc.of)] } : {}),
    invoiceLines: lines,
    totalDiscountAmount: r5(lines.reduce((a, x) => a + x.discount.amount, 0)),
    totalSalesAmount: sum("salesTotal"),
    netAmount: sum("netTotal"),
    taxTotals: Object.entries(taxTotals).map(([taxType, amount]) => ({ taxType, amount })),
    totalAmount: sum("total"),
    extraDiscountAmount: 0,
    totalItemsDiscountAmount: 0,
    _sign: sign,
  };
}

/** What the ETA will refuse: every required field that is empty, in plain words (English and Arabic). */
export function etaCheck(d) {
  const miss = [];
  const need = (ok, en, ar) => { if (!ok) miss.push({ en, ar }); };
  need(/^\d{9}$/.test(d.issuer.id), "Your tax registration number (9 digits) — Settings", "رقم تسجيلك الضريبي (9 أرقام) — الإعدادات");
  need(/^\d{4}$/.test(d.taxpayerActivityCode), "Your activity code (4 digits, from your tax card) — Settings", "كود النشاط (٤ أرقام من البطاقة الضريبية) — الإعدادات");
  for (const k of ["governate", "regionCity", "street", "buildingNumber"]) need(d.issuer.address[k], `Your address: ${k} — Settings`, `عنوانك: ${{ governate: "المحافظة", regionCity: "المدينة", street: "الشارع", buildingNumber: "رقم المبنى" }[k]} — الإعدادات`);
  need(d.receiver.name, "The customer's name", "اسم العميل");
  if (d.receiver.type === "B") {
    need(/^\d{9}$/.test(d.receiver.id), "The customer's tax number (9 digits)", "الرقم الضريبي للعميل (٩ أرقام)");
    for (const k of ["governate", "regionCity", "street", "buildingNumber"]) need(d.receiver.address[k], `The customer's address: ${k}`, `عنوان العميل: ${{ governate: "المحافظة", regionCity: "المدينة", street: "الشارع", buildingNumber: "رقم المبنى" }[k]}`);
  } else if (d.totalAmount >= 50000) need(/^\d{14}$/.test(d.receiver.id), "The customer's national ID (14 digits): needed for a person when the invoice is 50,000 EGP or more", "الرقم القومي للعميل (14 رقمًا): مطلوب للأفراد إذا كانت الفاتورة 50,000 جنيه أو أكثر");
  d.invoiceLines.forEach((l, i) => need(l.itemCode, `Line ${i + 1} (${l.description.slice(0, 30)}): the item's EGS or GS1 code — on the item`, `سطر ${i + 1} (${l.description.slice(0, 30)}): كود الصنف EGS أو GS1 — على الصنف`));
  return miss;
}

/** The JSON file's text (the ETA format has no field of ours: `_sign` is dropped). */
export function etaJson(d) { const { _sign, ...doc } = d; return JSON.stringify({ documents: [doc] }, null, 2); }
