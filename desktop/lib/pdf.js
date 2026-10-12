// PDFs on the desktop — the phone's DocTools.kt answers, made here:
//   reading (pdfText, pdfWords, pdfOutline, pdfImages) → pdf.js in a hidden window (pdfworker.html; it has a canvas)
//   htmlToPdf → Chromium's own printing (printToPDF): the page's CSS sets the size, margins, header and footer
//   makePdf   → pictures with pdf-lib; text blocks laid out as HTML and printed
//   pdfEdit   → pdf-lib: merge, split, pick, rotate, annotate (highlights and notes drawn into the pages)
"use strict";
const { PDFDocument, degrees, rgb } = require("pdf-lib");

const LOCKED = "This PDF is locked with a password — open it, save a copy without the password, and try again.";

function makePdf({ BrowserWindow, nativeImage }) {
  let worker = null, ready = null, printBlocked = false;
  function getWorker() {
    if (worker && !worker.isDestroyed()) return ready;
    worker = new BrowserWindow({ show: false, width: 800, height: 600, webPreferences: { offscreen: false, contextIsolation: true, nodeIntegration: false, sandbox: true } });
    ready = worker.loadURL("app://attune/__pdf/worker.html").then(async () => {
      for (let i = 0; i < 100; i++) { if (await worker.webContents.executeJavaScript("!!window.pdfReady")) return; await new Promise((r) => setTimeout(r, 50)); }
      throw new Error("The PDF reader did not start");
    });
    worker.on("closed", () => { worker = null; });
    return ready;
  }
  let queue = Promise.resolve();
  /** one PDF job at a time in the worker (a 300-page book and a page picture never fight over memory) */
  function read(op, arg) {
    const job = queue.then(async () => {
      await getWorker();
      const out = await worker.webContents.executeJavaScript("window.pdfOp(" + JSON.stringify(op) + "," + JSON.stringify(arg) + ")", true);
      return JSON.parse(out);
    });
    queue = job.catch(() => {});
    return job;
  }

  /** {html, w, h (points)} → {b64, bytes} */
  async function htmlToPdf({ html, w = 595.3, h = 841.9 }) {
    // its own session: the page is printed as it is — no scripts, no network (the converter's HTML is self-contained)
    const win = new BrowserWindow({ show: false, webPreferences: { javascript: false, sandbox: true, contextIsolation: true, partition: "attune-print" } });
    if (!printBlocked) { printBlocked = true; win.webContents.session.webRequest.onBeforeRequest({ urls: ["http://*/*", "https://*/*"] }, (d, cb) => cb({ cancel: true })); }
    try {
      await win.loadURL("data:text/html;charset=utf-8;base64," + Buffer.from(String(html || ""), "utf8").toString("base64"));
      const pdf = await Promise.race([
        win.webContents.printToPDF({ pageSize: { width: w / 72, height: h / 72 }, margins: { marginType: "none" }, printBackground: true, preferCSSPageSize: true }),
        new Promise((_, bad) => setTimeout(() => bad(new Error("Printing took too long")), 90000)),
      ]);
      if (!pdf || pdf.length < 200) throw new Error("The printed PDF is empty");
      return { b64: Buffer.from(pdf).toString("base64"), bytes: pdf.length };
    } finally { if (!win.isDestroyed()) win.destroy(); }
  }

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  /** the phone's makePdf block types → print HTML (A4, 40 pt margins, Arabic lines from the right) */
  function blocksHtml(blocks) {
    const body = blocks.map((b) => {
      const t = esc(b.text);
      switch (b.type || "p") {
        case "h1": case "h2": case "h3": return "<" + b.type + " dir=auto>" + t + "</" + b.type + ">";
        case "li": return "<p class=li dir=auto>" + (b.num ? esc(b.num) + ".&nbsp; " : "•&nbsp; ") + t + "</p>";
        case "title": return "<div class=title dir=auto>" + t + "</div>";
        case "subtitle": return "<div class=sub dir=auto>" + t + "</div>";
        case "caption": return "<div class=cap dir=auto>" + t + "</div>";
        case "pagebreak": return "<div class=pb></div>";
        case "image": return b.b64 ? "<img src=\"" + (String(b.b64).startsWith("data:") ? esc(b.b64) : "data:image/png;base64," + esc(b.b64)) + "\">" : "";
        case "table": return "<table>" + (b.rows || []).map((r, i) => "<tr>" + (r || []).map((c) => (i ? "<td dir=auto>" : "<th dir=auto>") + esc(c) + (i ? "</td>" : "</th>")).join("") + "</tr>").join("") + "</table>";
        default: return "<p dir=auto>" + t + "</p>";
      }
    }).join("\n");
    return "<!doctype html><meta charset=utf-8><style>@page{size:A4;margin:40pt}body{font:11pt/1.4 'Segoe UI',Tahoma,Arial,sans-serif;color:#141414}" +
      "h1{font-size:19pt;margin:14pt 0 6pt}h2{font-size:15.5pt;margin:10pt 0 6pt}h3{font-size:13pt;margin:8pt 0 4pt}p{margin:0 0 6pt}.li{margin-inline-start:12pt}" +
      ".title{font-size:28pt;font-weight:700;margin:150pt 0 10pt}.sub{font-size:15pt;color:#5a5a5a;margin-bottom:24pt}.cap{font-size:9.5pt;color:#5a5a5a;margin-bottom:10pt}" +
      ".pb{break-after:page}img{max-width:100%;margin:6pt 0}table{border-collapse:collapse;width:100%;margin:6pt 0;font-size:10pt}td,th{border:.6pt solid #969696;padding:3pt 4pt;text-align:start}" +
      "</style><body>" + body + "</body>";
  }

  async function embedPicture(doc, dataUrl) {
    const raw = Buffer.from(String(dataUrl).split("base64,").pop(), "base64");
    if (raw[0] === 0xff && raw[1] === 0xd8) return doc.embedJpg(raw);
    if (raw[0] === 0x89 && raw[1] === 0x50) return doc.embedPng(raw);
    const img = nativeImage.createFromBuffer(raw);     // WebP and others: through Chromium to JPEG
    if (img.isEmpty()) return null;
    return doc.embedJpg(img.toJPEG(90));
  }
  /** {blocks, images, fullPage} → {b64, bytes} */
  async function makeFile({ blocks = [], images = [], fullPage = false }) {
    const PW = 595, PH = 842;
    const doc = await PDFDocument.create();
    for (const s of images) {
      const img = await embedPicture(doc, s); if (!img) continue;
      if (fullPage) { const w = PH, h = Math.max(1, Math.round(PH * img.height / img.width)); doc.addPage([w, h]).drawImage(img, { x: 0, y: 0, width: w, height: h }); continue; }
      const land = img.width > img.height; const [w, h] = land ? [PH, PW] : [PW, PH];
      const k = Math.min((w - 48) / img.width, (h - 48) / img.height); const dw = img.width * k, dh = img.height * k;
      doc.addPage([w, h]).drawImage(img, { x: (w - dw) / 2, y: (h - dh) / 2, width: dw, height: dh });
    }
    if (blocks.length) {
      const printed = await htmlToPdf({ html: blocksHtml(blocks), w: PW, h: PH });
      const src = await PDFDocument.load(Buffer.from(printed.b64, "base64"));
      for (const p of await doc.copyPages(src, src.getPageIndices())) doc.addPage(p);
    }
    if (!doc.getPageCount()) throw new Error("Nothing to put in the PDF");
    const bytes = await doc.save();
    return { b64: Buffer.from(bytes).toString("base64"), bytes: bytes.length };
  }

  async function load(b64) {
    try { return await PDFDocument.load(Buffer.from(b64, "base64"), { ignoreEncryption: false }); }
    catch (e) { if (/encrypt/i.test(String(e && e.message))) throw new Error(LOCKED); throw e; }
  }
  const out64 = async (d) => Buffer.from(await d.save()).toString("base64");
  const hex = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(c || ""); const n = m ? parseInt(m[1], 16) : 0xffd54a; return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); };

  /** op = merge {files} | split {b64} | pick {b64, pages} | rotate {b64, pages, degrees} | annotate {b64, anns} → {files: [{n, b64, pages}]} */
  async function pdfEdit(a) {
    const files = [];
    if (a.op === "merge") {
      const doc = await PDFDocument.create();
      for (const f of a.files || []) { const s = await load(f); for (const p of await doc.copyPages(s, s.getPageIndices())) doc.addPage(p); }
      files.push({ n: 1, b64: await out64(doc), pages: doc.getPageCount() });
    } else if (a.op === "split") {
      const s = await load(a.b64);
      for (let i = 0; i < s.getPageCount(); i++) { const d = await PDFDocument.create(); const [p] = await d.copyPages(s, [i]); d.addPage(p); files.push({ n: i + 1, b64: await out64(d), pages: 1 }); }
    } else if (a.op === "pick" || a.op === "rotate") {
      const d = await load(a.b64); const count = d.getPageCount();
      const want = new Set((a.pages || []).filter((x) => x >= 1 && x <= count));
      if (a.op === "pick") {
        if (!want.size) throw new Error("None of those page numbers are in this PDF (it has " + count + " pages).");
        for (let i = count; i >= 1; i--) if (!want.has(i)) d.removePage(i - 1);
      } else {
        const deg = (((a.degrees == null ? 90 : a.degrees) % 360) + 360) % 360;
        d.getPages().forEach((p, i) => { if (!want.size || want.has(i + 1)) p.setRotation(degrees((p.getRotation().angle + deg) % 360)); });
      }
      files.push({ n: 1, b64: await out64(d), pages: d.getPageCount() });
    } else if (a.op === "annotate") {
      const d = await load(a.b64);
      for (const an of a.anns || []) {
        const pg = d.getPages()[(an.page || 0) - 1]; if (!pg) continue;
        const box = pg.getCropBox(); const pw = box.width, ph = box.height, x0 = box.x, top = box.y + box.height;
        if (an.kind === "note") {
          const nx = x0 + (an.x == null ? 0.02 : an.x) * pw, ny = top - (an.y == null ? 0.02 : an.y) * ph - 14;
          pg.drawRectangle({ x: nx, y: ny, width: 14, height: 14, color: hex(an.color), opacity: 0.9 });
        } else {
          for (const q of an.rects || []) pg.drawRectangle({ x: x0 + q[0] * pw, y: top - (q[1] + q[3]) * ph, width: q[2] * pw, height: q[3] * ph, color: hex(an.color), opacity: 0.38 });
        }
      }
      files.push({ n: 1, b64: await out64(d), pages: d.getPageCount() });
    } else throw new Error("Unknown PDF tool: " + a.op);
    return { files };
  }

  return { read, htmlToPdf, makeFile, pdfEdit, blocksHtml, close: () => { if (worker && !worker.isDestroyed()) worker.destroy(); } };
}

module.exports = { makePdf };
