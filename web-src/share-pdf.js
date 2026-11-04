/* v9.1: "share as PDF" (Android prints the HTML to a PDF and opens the share sheet; elsewhere the browser's print) — used by CV,
   Family health, site photos and Chat; it lived in Business's books-docs.jsx (now archived). The same code. */
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
