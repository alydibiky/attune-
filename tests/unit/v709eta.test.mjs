// v6.12 — Business books → ETA e-invoice JSON (v1.0): the figures equal the printed invoice; missing fields are listed.
const O = await import("../../web-src/books-ops.js");
const E = await import("../../web-src/books-eta.js");
const B = await import("../../web-src/books.js");
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const s = O.sampleShop(O.EMPTY(), "2026-10-04");
const inv = s.docs.filter((d) => d.type === "invoice" && d.status === "posted");
ok(inv.length >= 5, "the sample shop has posted invoices");
// the invoice with a 5% discount on the drills (Hassan Hardware)
const d2 = inv.find((d) => d.lines.some((l) => l.discBp === 500));
const j = E.etaDocument(s, d2);
const t = B.docTotals(d2, s.tax);
ok(j.documentType.toUpperCase() === "I" && j.documentTypeVersion === "1.0" && j.internalID === d2.number, "document type, version and our number");
ok(Math.abs(j.totalSalesAmount - t.gross / 100) < 1e-6 && Math.abs(j.netAmount - t.net / 100) < 1e-6 && Math.abs(j.totalDiscountAmount - t.discount / 100) < 1e-6, "sales, discount and net equal the books");
ok(Math.abs(j.totalAmount - t.total / 100) < 1e-6, "the total equals the printed invoice: " + j.totalAmount);
ok(j.taxTotals.find((x) => x.taxType === "T1").amount === t.vat / 100 && j.invoiceLines.every((l) => l.taxableItems[0].subType === "V009" && l.taxableItems[0].rate === 14), "VAT 14% as T1 / V009");
const w = E.etaDocument(s, inv.find((d) => d.lines.some((l) => l.wht === "supplies")));
const wl = w.invoiceLines[0], wt = wl.taxableItems.find((x) => x.taxType === "T4");
ok(wt && wt.rate === 1 && Math.abs(wl.total - (wl.netTotal + wl.taxableItems[0].amount - wt.amount)) < 1e-6, "withholding 1% as T4, taken off the line total");
const miss = E.etaCheck(j);
ok(miss.some((m) => /activity code/.test(m.en)) && miss.some((m) => /itemCode|EGS or GS1/.test(m.en)) && miss.every((m) => m.ar), "missing activity code and item codes are listed, in English and Arabic");
const s2 = JSON.parse(JSON.stringify(s));
s2.company.taxId = "123456789"; s2.company.eta = { activityCode: "4663", address: { governate: "Cairo", regionCity: "Downtown", street: "Tahrir St", buildingNumber: "12" } };
for (const it of s2.items) it.eta = { itemType: "EGS", itemCode: "EG-123456789-" + it.sku };
const c = s2.customers.find((x) => x.id === d2.customer); c.taxId = "987654321"; c.eta = { type: "B", address: { governate: "Giza", regionCity: "Dokki", street: "Tahrir", buildingNumber: "5" } };
ok(E.etaCheck(E.etaDocument(s2, d2)).length === 0, "with the fields filled in, nothing is missing");
const txt = E.etaJson(E.etaDocument(s2, d2));
ok(JSON.parse(txt).documents.length === 1 && !txt.includes("_sign"), "the file is {documents:[…]} with nothing of ours in it");
console.log(fail ? `${fail} FAILED` : "ALL PASSED");
