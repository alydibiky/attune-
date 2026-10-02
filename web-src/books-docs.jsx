/* ---- Books → documents: a bilingual invoice / quotation / credit note / statement as a PDF, shared to WhatsApp ------
   The page is built here as plain print-ready HTML (English and Arabic side by side, the company letterhead, the VAT
   breakdown) and printed to PDF by the phone's own Chrome engine (NativeBridge.htmlToPdf). Nothing is uploaded.     */
import * as B from "./books.js";
import * as C from "./convert.js";

const esc = (x) => String(x ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const money = (m) => B.fmt(m || 0);
const dmy = (iso) => (iso ? iso.split("-").reverse().join("/") : "");
const TITLES = { invoice: ["TAX INVOICE", "فاتورة ضريبية"], quote: ["QUOTATION", "عرض سعر"], credit: ["CREDIT NOTE", "إشعار دائن"], statement: ["STATEMENT OF ACCOUNT", "كشف حساب"] };

const CSS = `
@page{size:A4;margin:14mm 13mm}
*{box-sizing:border-box}
body{font-family:"Noto Naskh Arabic","Segoe UI",Roboto,Arial,sans-serif;color:#0f172a;font-size:10.5pt;line-height:1.35;margin:0}
.row{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
.co{flex:1}.co h1{font-size:15pt;margin:0 0 2px}.co .ar{direction:rtl;font-size:13pt;font-weight:700}.muted{color:#64748b;font-size:9pt}
.logo{max-height:60px;max-width:150px;object-fit:contain}
.title{background:#0f766e;color:#fff;padding:7px 12px;margin:12px 0 10px;display:flex;justify-content:space-between;font-weight:700;border-radius:4px}
.title .ar{direction:rtl}
.box{border:1px solid #cbd5e1;border-radius:4px;padding:7px 10px;flex:1}.box b{display:block;font-size:8.5pt;color:#64748b;font-weight:600;margin-bottom:2px}
table{width:100%;border-collapse:collapse;margin-top:10px}
th{background:#f1f5f9;border:1px solid #cbd5e1;padding:5px 6px;font-size:8.5pt;text-align:center}
th span{display:block;direction:rtl}
td{border:1px solid #e2e8f0;padding:5px 6px;vertical-align:top}
td.n{text-align:right;white-space:nowrap}
.tot{margin-top:10px;margin-inline-start:auto;width:60%}
.tot div{display:flex;justify-content:space-between;padding:3px 8px;border-bottom:1px solid #e2e8f0}
.tot .grand{background:#0f766e;color:#fff;font-weight:700;font-size:11.5pt;border:0;border-radius:4px;margin-top:4px}
.small{font-size:8.5pt;color:#475569;margin-top:10px}
.foot{margin-top:18px;border-top:1px solid #cbd5e1;padding-top:6px;text-align:center;font-size:8.5pt;color:#64748b}
.ar{direction:rtl}
`;

function letterhead(co) {
  const names = [co.name ? `<h1>${esc(co.name)}</h1>` : "", co.nameAr ? `<div class="ar">${esc(co.nameAr)}</div>` : ""].join("");
  const lines = [co.address, co.phone && "☎ " + co.phone, co.email, co.taxId && `الرقم الضريبي / Tax ID: ${co.taxId}`, co.regNo && `السجل التجاري / C.R.: ${co.regNo}`].filter(Boolean).map(esc).join("<br>");
  return `<div class="row"><div class="co">${names}<div class="muted">${lines}</div></div>${co.logo ? `<img class="logo" src="${co.logo}" alt="">` : ""}</div>`;
}
const head2 = (en, ar) => `<th>${en}<span>${ar}</span></th>`;

/** The HTML of one sales document. */
export function documentHtml({ s, doc, kind }) {
  const co = s.company, t = B.docTotals(doc, s.tax), cust = s.customers.find((c) => c.id === doc.customer) || {};
  const [te, ta] = TITLES[kind] || TITLES.invoice;
  const rows = doc.lines.map((l, i) => { const f = B.lineFigures(l, s.tax); const it = s.items.find((x) => x.id === l.item);
    return `<tr><td>${i + 1}</td><td>${esc(l.desc || (it && it.name) || "")}</td><td class="n">${esc(l.qty)}</td><td class="n">${money(l.price)}</td><td class="n">${l.discBp ? l.discBp / 100 + "%" : ""}</td><td class="n">${f.vatBp / 100}%</td><td class="n">${money(f.total)}</td></tr>`; }).join("");
  const vatRows = Object.entries(t.byVat).filter(([, v]) => v.base).map(([bp, v]) => `<div><span>VAT ${Number(bp) / 100}% on ${money(v.base)} · <bdi>ضريبة ${Number(bp) / 100}%</bdi></span><span>${money(v.vat)}</span></div>`).join("");
  const sign = kind === "credit" ? -1 : 1;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>
${letterhead(co)}
<div class="title"><span>${te}</span><span>${esc(doc.number || "DRAFT")}</span><span class="ar">${ta}</span></div>
<div class="row"><div class="box"><b>العميل / Customer</b>${esc(cust.name || "")}<div class="muted">${[cust.address, cust.phone, cust.taxId && "الرقم الضريبي / Tax ID: " + cust.taxId].filter(Boolean).map(esc).join("<br>")}</div></div>
<div class="box"><b>التاريخ / Date</b>${dmy(doc.date)}${doc.due ? `<br><b style="margin-top:4px">الاستحقاق / Due</b>${dmy(doc.due)}` : ""}${doc.against ? `<br><b style="margin-top:4px">بخصوص / Against</b>${esc(doc.against)}` : ""}</div></div>
<table><thead><tr>${head2("#", "م")}${head2("Description", "الوصف")}${head2("Qty", "الكمية")}${head2("Unit price", "سعر الوحدة")}${head2("Disc.", "خصم")}${head2("VAT", "ضريبة")}${head2("Total", "الإجمالي")}</tr></thead><tbody>${rows}</tbody></table>
<div class="tot">
<div><span>Subtotal · الإجمالي</span><span>${money(sign * t.gross)}</span></div>
${t.discount ? `<div><span>Discount · الخصم</span><span>-${money(Math.abs(t.discount))}</span></div>` : ""}
${t.tableTax ? `<div><span>Table tax · ضريبة الجدول</span><span>${money(t.tableTax)}</span></div>` : ""}
${vatRows}
<div class="grand"><span>Total · الإجمالي المستحق</span><span>${money(t.total)} ${esc(s.currency)}</span></div>
${t.wht ? `<div><span>Withheld at source · خصم من المنبع</span><span>-${money(Math.abs(t.wht))}</span></div><div><b>Net payable · الصافي المطلوب</b><b>${money(t.cashDue)}</b></div>` : ""}
</div>
${doc.notes ? `<div class="small"><b>Notes · ملاحظات:</b> ${esc(doc.notes)}</div>` : ""}
${co.bank && kind !== "quote" ? `<div class="small"><b>Bank · البنك:</b> ${esc(co.bank)}</div>` : ""}
${kind === "quote" ? `<div class="small">This quotation is not a tax invoice. · هذا العرض ليس فاتورة ضريبية.</div>` : ""}
<div class="foot">${esc(co.footer || "")}</div>
</body></html>`;
}

/** The HTML of a customer statement. */
export function statementHtml({ s, customer, statement, from, to }) {
  const co = s.company, c = s.customers.find((x) => x.id === customer) || {};
  const rows = statement.lines.map((l) => `<tr><td>${dmy(l.date)}</td><td>${esc(l.ref)}</td><td class="n">${l.debit ? money(l.debit) : ""}</td><td class="n">${l.credit ? money(l.credit) : ""}</td><td class="n">${money(l.balance)}</td></tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${letterhead(co)}
<div class="title"><span>${TITLES.statement[0]}</span><span>${esc(c.name || "")}</span><span class="ar">${TITLES.statement[1]}</span></div>
<div class="small">${from || to ? `${dmy(from)} → ${dmy(to)} · ` : ""}${esc(s.currency)}</div>
<table><thead><tr>${head2("Date", "التاريخ")}${head2("Reference", "المرجع")}${head2("Debit", "مدين")}${head2("Credit", "دائن")}${head2("Balance", "الرصيد")}</tr></thead><tbody>
<tr><td colspan="4"><b>Opening balance · رصيد أول المدة</b></td><td class="n">${money(statement.opening)}</td></tr>${rows}
<tr><td colspan="4"><b>Closing balance · الرصيد الختامي</b></td><td class="n"><b>${money(statement.closing)}</b></td></tr></tbody></table>
<div class="foot">${esc(co.footer || "")}</div></body></html>`;
}

/** A polite Arabic message to go with the file (WhatsApp / SMS). */
export function whatsappText({ s, doc, kind }) {
  const co = s.company, cust = s.customers.find((c) => c.id === doc.customer) || {}, t = B.docTotals(doc, s.tax);
  const what = { invoice: "فاتورة", quote: "عرض سعر", credit: "إشعار دائن" }[kind] || "مستند";
  return `السلام عليكم ${cust.name || ""}،\nمرفق ${what} رقم ${doc.number} بمبلغ ${money(t.total)} ${s.currency}.` + (doc.due && kind === "invoice" ? `\nموعد السداد: ${dmy(doc.due)}.` : "") + `\nشكراً لتعاملكم — ${co.nameAr || co.name || ""}`;
}
export function reminderText({ s, customer, owed, oldest }) {
  const co = s.company, c = s.customers.find((x) => x.id === customer) || {};
  return `السلام عليكم ${c.name || ""}،\nتذكير ودّي بوجود مبلغ مستحق ${money(owed)} ${s.currency}${oldest ? ` (أقدم فاتورة بتاريخ ${dmy(oldest)})` : ""}. برجاء التفضل بالسداد في أقرب وقت. شكراً — ${co.nameAr || co.name || ""}`;
}

/** HTML → a PDF file → the phone's share sheet (or Save), with a plain fallback. Returns true when something was shared. */
export async function sharePdf({ html, name, text, flash }) {
  const call = typeof window !== "undefined" ? window.__attuneNativeCall : null;     // set by the app when it runs inside Android
  try {
    if (!call) throw new Error("native");
    const pdf = await call("htmlToPdf", { html, w: 595.3, h: 841.9 });
    if (!pdf || !pdf.b64) throw new Error("pdf");
    await call("shareFile", { name: name + ".pdf", mime: "application/pdf", b64: pdf.b64, text });
    return true;
  } catch (e) {
    try { const w = window.open("", "_blank"); if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 400); return true; } } catch (x) {}
    flash && flash("Open the Android app to share PDFs");
    return false;
  }
}
export const shareDocument = ({ s, doc, kind, flash }) => sharePdf({ html: documentHtml({ s, doc, kind }), name: (doc.number || kind).replace(/[^\w-]+/g, "_"), text: whatsappText({ s, doc, kind }), flash });
export const shareStatement = ({ s, customer, statement, from, to, flash }) => sharePdf({ html: statementHtml({ s, customer, statement, from, to }), name: "statement-" + ((s.customers.find((c) => c.id === customer) || {}).name || "customer").replace(/[^\w]+/g, "_"), flash });

// ---- the same document as an editable Word file ------------------------------------------------------------------------
/** The blocks of a sales document for convert.js's Word writer: letterhead, title, customer, a ruled items table, totals, notes. */
export function documentBlocks({ s, doc, kind }) {
  const co = s.company, t = B.docTotals(doc, s.tax), cust = s.customers.find((c) => c.id === doc.customer) || {};
  const [te, ta] = TITLES[kind] || TITLES.invoice;
  const blocks = [];
  const line = (text, o = {}) => blocks.push({ type: "p", text, size: o.size || 10, align: o.align || "left", ...(o.b ? { runs: [{ t: text, b: true }] } : {}), ...(o.rtl ? { rtl: true } : {}), before: o.before || 0 });
  if (co.name) line(co.name, { size: 16, b: true });
  if (co.nameAr) line(co.nameAr, { size: 14, b: true, rtl: true, align: "right" });
  const info = [co.address, co.phone && "Tel " + co.phone, co.email, co.taxId && `Tax ID / الرقم الضريبي: ${co.taxId}`, co.regNo && `C.R. / السجل التجاري: ${co.regNo}`].filter(Boolean);
  info.forEach((x) => line(x, { size: 9 }));
  blocks.push({ type: "h2", text: `${te} · ${ta}   ${doc.number || "DRAFT"}`, before: 10 });
  line(`Customer · العميل: ${cust.name || ""}${cust.taxId ? "   Tax ID: " + cust.taxId : ""}`, { b: true, before: 4 });
  if (cust.address) line(cust.address, { size: 9 });
  line(`Date · التاريخ: ${dmy(doc.date)}${doc.due ? "      Due · الاستحقاق: " + dmy(doc.due) : ""}${doc.against ? "      Against · بخصوص: " + doc.against : ""}`, { before: 2 });
  const head = ["#", "Description · الوصف", "Qty · الكمية", "Unit price · السعر", "Disc.", "VAT", "Total · الإجمالي"];
  const rows = [head, ...doc.lines.map((l, i) => { const f = B.lineFigures(l, s.tax); const it = s.items.find((x) => x.id === l.item); return [String(i + 1), l.desc || (it && it.name) || "", String(l.qty), money(l.price), l.discBp ? l.discBp / 100 + "%" : "", f.vatBp / 100 + "%", money(f.total)]; })];
  blocks.push({ type: "table", rows, bold: rows.map((_, i) => rows[0].map(() => i === 0)), widths: [22, 160, 46, 70, 38, 38, 94], shade: rows.map((_, i) => (i === 0 ? "D9EEF0" : null)), align: ["center", "left", "right", "right", "right", "right", "right"], border: { c: "B8C4CC", sz: 4 }, size: 9.5, before: 8 });
  const tot = [["Subtotal · الإجمالي", money(t.gross)]];
  if (t.discount) tot.push(["Discount · الخصم", "-" + money(t.discount)]);
  if (t.tableTax) tot.push(["Table tax · ضريبة الجدول", money(t.tableTax)]);
  for (const [bp, v] of Object.entries(t.byVat)) if (v.base) tot.push([`VAT ${Number(bp) / 100}% on ${money(v.base)} · ضريبة`, money(v.vat)]);
  tot.push([`Total · الإجمالي المستحق (${s.currency})`, money(t.total)]);
  if (t.wht) { tot.push(["Withheld at source · خصم من المنبع", "-" + money(Math.abs(t.wht))]); tot.push(["Net payable · الصافي المطلوب", money(t.cashDue)]); }
  blocks.push({ type: "table", rows: tot, bold: tot.map((_, i) => [false, false].map(() => i === tot.length - 1 - (t.wht ? 2 : 0) || (t.wht && i === tot.length - 1))), widths: [330, 138], align: ["right", "right"], border: { c: "B8C4CC", sz: 4 }, size: 10, before: 8, ind: 0 });
  if (doc.notes) line("Notes · ملاحظات: " + doc.notes, { size: 9, before: 8 });
  if (co.bank && kind !== "quote") line("Bank · البنك: " + co.bank, { size: 9, before: 4 });
  if (co.footer) line(co.footer, { size: 8.5, align: "center", before: 12 });
  return blocks;
}
export async function shareDocumentWord({ s, doc, kind, flash, saveFile }) {
  try {
    const name = (doc.number || kind).replace(/[^\w-]+/g, "_");
    const bytes = C.docxFromBlocks(documentBlocks({ s, doc, kind }), name);
    const call = typeof window !== "undefined" ? window.__attuneNativeCall : null;
    if (call) { await call("shareFile", { name: name + ".docx", mime: C.MIME.docx, b64: C.bytesToB64(bytes), text: whatsappText({ s, doc, kind }) }); return true; }
    if (saveFile) { await saveFile(name + ".docx", null, C.MIME.docx, C.bytesToB64(bytes)); return true; }
    flash && flash("Open the Android app to share files");
  } catch (e) { flash && flash("Could not make the Word file"); }
  return false;
}
