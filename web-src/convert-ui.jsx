/* ---- More → File Converter (v5.36; v5.37 "as many converters as you can") ----------------------
   PDF → Word / text / pictures / Excel / web page / Markdown / LibreOffice, and PDF tools (merge,
   split, keep pages, rotate); Word, PowerPoint, LibreOffice, e-books, web pages, RTF, text → Word /
   PDF / text / web page / Markdown; Excel, LibreOffice sheets, CSV, JSON ↔ each other; photos → PDF /
   JPG / PNG / WebP / text; subtitles SRT ↔ VTT. On the phone: Word / Excel / CSV in convert.js, PDFs by Android
   (NativeBridge pdfText / pdfImages / makePdf). Scanned pages and photos of paper are read by the
   AI model (a model that reads photos). Nothing is uploaded. */
import React, { useState, useRef } from "react";
import { FileText, Loader2, X, Download, Check, ImagePlus, ChevronRight, Eye } from "lucide-react";
import { tr } from "./i18n.js";
import { useSubBack } from "./backstack.js";
import * as C from "./convert.js";

const TARGET_LABEL = { docx: "Word (.docx)", pdf: "PDF", txt: "Text (.txt)", images: "Pictures (.zip)", csv: "CSV", xlsx: "Excel (.xlsx)",
  html: "Web page (.html)", md: "Markdown (.md)", odt: "LibreOffice text (.odt)", ods: "LibreOffice sheet (.ods)", json: "JSON",
  jpg: "JPG photo", png: "PNG photo", webp: "WebP photo", srt: "Subtitles (.srt)", vtt: "Subtitles (.vtt)",
  merge: "Merge into one PDF", split: "Split into pages", pick: "Keep some pages", rotate: "Rotate pages" };
const KIND_LABEL = { pdf: "PDF", pdfs: "PDFs", docx: "Word document", pptx: "PowerPoint", odt: "LibreOffice text", ods: "LibreOffice sheet", epub: "E-book",
  html: "Web page", rtf: "Rich Text", image: "Photo", images: "Photos", text: "Text", xlsx: "Excel workbook", csv: "CSV sheet", json: "JSON data", srt: "Subtitles", vtt: "Subtitles" };
const ROWS = ["xlsx", "ods", "csv", "json"], SUBS = ["srt", "vtt"], PDF_TOOLS = ["merge", "split", "pick", "rotate", "images"], PHOTO = ["jpg", "png", "webp"];
const ACCEPT = ".pdf,.docx,.pptx,.odt,.ods,.epub,.html,.htm,.xhtml,.rtf,.txt,.md,.xlsx,.csv,.tsv,.json,.srt,.vtt,image/*,application/pdf";
// a photo → another photo format, in the page (the browser's own canvas)
const recode = (file, fmt) => new Promise((ok, bad) => {
  const url = URL.createObjectURL(file), img = new Image();
  img.onload = () => {
    try {
      const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext("2d"); if (fmt === "jpg") { g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); }
      g.drawImage(img, 0, 0); URL.revokeObjectURL(url);
      const d = c.toDataURL(C.MIME[fmt], 0.92);
      if (!d.startsWith("data:" + C.MIME[fmt])) return bad(new Error("This phone can't write that photo type — try JPG or PNG."));
      ok({ b64: d.split(",")[1], w: c.width, h: c.height });
    } catch (e) { bad(e); }
  };
  img.onerror = () => { URL.revokeObjectURL(url); bad(new Error("This photo can't be opened here (HEIC photos: convert them to PDF instead).")); };
  img.src = url;
});
const readB64 = (f) => new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] || ""); r.onerror = () => bad(new Error("Couldn't read that file")); r.readAsDataURL(f); });
const readUrl = (f) => new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => bad(new Error("Couldn't read that file")); r.readAsDataURL(f); });
const kb = (n) => (n > 1e6 ? (n / 1e6).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1e3)) + " KB");

export function FileConverter({ nativeCall, native, saveFile, llm, modelReady, canReadPhotos, openEngine, flash, pro, openPlan }) {
  const [files, setFiles] = useState(null);       // { kind, list: File[] }
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(null);         // text
  const [out, setOut] = useState(null);           // { name, mime, b64?, text?, size, preview, note }
  const [err, setErr] = useState("");
  const [pages, setPages] = useState("");         // PDF tools: "1-3, 5"
  const [deg, setDeg] = useState(90);
  const run = useRef(0);
  const fileRef = useRef(null);
  useSubBack(!!files, () => { if (out) setOut(null); else { setFiles(null); setTarget(null); } });

  const pick = (list) => {
    const arr = [...(list || [])];
    if (!arr.length) return;
    const kinds = arr.map((f) => C.kindOf(f.name, f.type));
    if (kinds.some((k) => !k)) { setErr(tr("That kind of file can't be converted here yet. Try PDF, Word, PowerPoint, Excel, CSV, photos, text, e-books, web pages or subtitles.")); return; }
    const multi = arr.length > 1 && kinds.every((k) => k === kinds[0]) && C.MULTI[kinds[0]];
    const kind = arr.length > 1 ? (multi ? multi.kind : null) : kinds[0];
    if (!kind) { setErr(tr("Pick one file — or several photos (→ one PDF), or several PDFs (→ merged).")); return; }
    setErr(""); setOut(null); setPages("");
    setFiles({ kind, list: arr });
    setTarget(targetsOf(kind)[0]);
  };

  const targetsOf = (kind) => (kind === "images" ? C.MULTI.image.targets : kind === "pdfs" ? C.MULTI.pdf.targets : C.KINDS[kind].targets);
  const needsNative = (k, t) => k === "pdf" || k === "pdfs" || t === "pdf";
  const base = () => (files.list[0].name || "file").replace(/\.[^.]+$/, "") + (files.list.length > 1 ? "-" + files.list.length : "");

  // the AI reads a picture of a page (scans, photos of paper)
  const readPicture = async (dataUrl, n, total) => {
    const img = { media: "image/jpeg", data: dataUrl.split(",")[1] };
    return String(await llm(C.readPageMessages(n, total), img, { maxTokens: 1800, temperature: 0 }) || "").trim();
  };

  const convert = async () => {
    if (!files || !target) return;
    const today = new Date().toISOString().slice(0, 10);
    let used = 0; try { used = JSON.parse(localStorage.getItem("attune:convert:day") || "{}")[today] || 0; } catch (e) {}
    if (!pro && used >= 5) { flash && flash(tr("Free includes 5 conversions a day — Pro is unlimited")); openPlan && openPlan(); return; }
    if (needsNative(files.kind, target) && !nativeCall) { setErr(tr("PDF files are converted by the Android app — open Attune on your phone.")); return; }
    const id = ++run.current, alive = () => run.current === id;
    setErr(""); setOut(null); setBusy(tr("Reading the file…"));
    try {
      const k = files.kind, f0 = files.list[0];
      let blocks = null, rows = null, note = "";
      // 1. read the source into blocks (text) or rows (sheets)
      let cues = null;
      if (k === "pdf" && !PDF_TOOLS.includes(target)) {
        const r = await nativeCall("pdfText", { b64: await readB64(f0) });
        if (!alive()) return;
        const scans = r.pages.filter((p) => p.scan).map((p) => p.n);
        const text = {};
        for (const p of r.pages) text[p.n] = p.text;
        if (scans.length) {
          if (!modelReady || !canReadPhotos) note = tr("{n} scanned page(s) have no text layer — install a model marked 📷 in Engine to read them.", { n: scans.length });
          else {
            const imgs = await nativeCall("pdfImages", { b64: await readB64(f0), pages: scans.slice(0, 40), width: 1400 });
            for (let i = 0; i < imgs.images.length; i++) {
              if (!alive()) return;
              setBusy(tr("The AI is reading scanned page {n} of {t}…", { n: i + 1, t: imgs.images.length }));
              text[imgs.images[i].n] = await readPicture(imgs.images[i].image, i + 1, imgs.images.length);
            }
            note = tr("{n} scanned page(s) were read by the AI — check names and numbers.", { n: imgs.images.length });
          }
        }
        blocks = r.pages.flatMap((p) => C.textToBlocks(text[p.n] || ""));
        if (r.count > r.pages.length) note = (note ? note + " " : "") + tr("Only the first {n} pages were converted.", { n: r.pages.length });
      } else if (k === "docx") blocks = await C.docxToBlocks(new Uint8Array(await f0.arrayBuffer()));
      else if (k === "pptx") blocks = await C.pptxToBlocks(new Uint8Array(await f0.arrayBuffer()));
      else if (k === "odt") blocks = await C.odtToBlocks(new Uint8Array(await f0.arrayBuffer()));
      else if (k === "epub") blocks = await C.epubToBlocks(new Uint8Array(await f0.arrayBuffer()));
      else if (k === "html") blocks = C.htmlToBlocks(await f0.text());
      else if (k === "rtf") blocks = C.textToBlocks(C.rtfToText(await f0.text()));
      else if (k === "text") blocks = C.textToBlocks(await f0.text());
      else if (k === "xlsx") rows = await C.xlsxToRows(new Uint8Array(await f0.arrayBuffer()));
      else if (k === "ods") rows = await C.odsToRows(new Uint8Array(await f0.arrayBuffer()));
      else if (k === "csv") rows = C.csvParse(await f0.text());
      else if (k === "json") rows = C.jsonToRows(await f0.text());
      else if (SUBS.includes(k)) cues = C.subsParse(await f0.text());
      else if ((k === "image" || k === "images") && target !== "pdf" && !PHOTO.includes(target)) {
        if (!modelReady || !canReadPhotos) { setErr(tr("Reading a photo needs a model marked 📷 — open Engine.")); openEngine && openEngine(); return; }
        const parts = [];
        for (let i = 0; i < files.list.length; i++) {
          if (!alive()) return;
          setBusy(tr("The AI is reading photo {n} of {t}…", { n: i + 1, t: files.list.length }));
          parts.push(await readPicture(await readUrl(files.list[i]), i + 1, files.list.length));
        }
        blocks = C.textToBlocks(parts.join("\n\n"));
        note = tr("Read by the AI — check names and numbers.");
      }
      if (!alive()) return;
      if (blocks && !blocks.length && !note) throw new Error("No text was found in that file.");
      // a PDF → Excel: its tables (read as "a | b" rows), else each line split at wide gaps
      if (target === "xlsx" && blocks) {
        const t = blocks.filter((b) => b.type === "table").flatMap((b) => b.rows);
        rows = t.length ? t : blocks.flatMap((b) => (b.type === "table" ? b.rows : String(b.text || "").split("\n").map((l) => l.split(/\t|\s{2,}/).map((c) => c.trim()))));
        if (!t.length) note = (note ? note + " " : "") + tr("This PDF has no clear table, so each line became a row — check the columns.");
      }
      // sheets → Word / web page / PDF: one table
      if (rows && ["docx", "html", "md", "odt"].includes(target)) blocks = [{ type: "h2", text: base() }, { type: "table", rows: rows.slice(0, 5000) }];
      setBusy(tr("Making the {t} file…", { t: tr(TARGET_LABEL[target]) }));
      // 2. write the target
      let o = null;
      const textOut = (ext, t) => ({ name: base() + "." + ext, mime: C.MIME[ext], text: t, size: new Blob([t]).size, show: t });
      if (target === "docx") { const b = C.docxFromBlocks(blocks || [], base()); o = { name: base() + ".docx", mime: C.MIME.docx, b64: C.bytesToB64(b), size: b.length }; }
      else if (target === "txt") o = textOut("txt", cues ? C.cuesToText(cues) : C.blocksToText(blocks || []));
      else if (target === "html") o = textOut("html", C.blocksToHtml(blocks || [], base()));
      else if (target === "md") o = textOut("md", C.blocksToMarkdown(blocks || []));
      else if (target === "json") o = textOut("json", C.rowsToJson(rows || []));
      else if (target === "srt") o = textOut("srt", C.srtFromCues(cues));
      else if (target === "vtt") o = textOut("vtt", C.vttFromCues(cues));
      else if (target === "odt") { const b = C.odtFromBlocks(blocks || []); o = { name: base() + ".odt", mime: C.MIME.odt, b64: C.bytesToB64(b), size: b.length }; }
      else if (target === "ods") { const b = C.odsFromRows(rows || [], base()); o = { name: base() + ".ods", mime: C.MIME.ods, b64: C.bytesToB64(b), size: b.length }; }
      else if (PHOTO.includes(target)) {
        const done = [];
        for (let i = 0; i < files.list.length; i++) {
          if (!alive()) return;
          setBusy(tr("Converting photo {n} of {t}…", { n: i + 1, t: files.list.length }));
          done.push({ name: files.list[i].name.replace(/\.[^.]+$/, "") + "." + target, ...(await recode(files.list[i], target)) });
        }
        if (done.length === 1) o = { name: done[0].name, mime: C.MIME[target], b64: done[0].b64, size: Math.floor(done[0].b64.length * 0.75), dims: done[0].w + "×" + done[0].h };
        else { const z = C.zipStore(done.map((d) => ({ name: d.name, data: C.b64ToBytes(d.b64) }))); o = { name: base() + "-" + target + ".zip", mime: C.MIME.zip, b64: C.bytesToB64(z), size: z.length, count: done.length }; }
      } else if (["merge", "split", "pick", "rotate"].includes(target)) {
        const list = target === "pick" || (target === "rotate" && pages.trim()) ? C.pageList(pages) : [];
        if (target === "pick" && !list.length) { setErr(tr("Type the pages to keep, like 1-3, 5")); return; }
        const r = await nativeCall("pdfEdit", target === "merge" ? { op: "merge", files: await Promise.all(files.list.map(readB64)) } : { op: target, b64: await readB64(f0), pages: list, degrees: deg });
        if (!alive()) return;
        const suffix = { merge: "-merged", pick: "-pages", rotate: "-rotated" }[target];
        if (target === "split") {
          const z = C.zipStore(r.files.map((f) => ({ name: base() + "-page-" + String(f.n).padStart(2, "0") + ".pdf", data: C.b64ToBytes(f.b64) })));
          o = { name: base() + "-pages.zip", mime: C.MIME.zip, b64: C.bytesToB64(z), size: z.length, count: r.files.length, countOf: "pdfs" };
        } else o = { name: (target === "merge" ? (files.list[0].name || "file").replace(/\.[^.]+$/, "") : base()) + suffix + ".pdf", mime: C.MIME.pdf, b64: r.files[0].b64, size: Math.floor(r.files[0].b64.length * 0.75), pagesOut: r.files[0].pages };
      }
      else if (target === "csv") { const t = C.csvStringify(rows || []); o = { name: base() + ".csv", mime: C.MIME.csv, text: t, size: new Blob([t]).size }; }
      else if (target === "xlsx") { const b = C.xlsxFromRows(rows || [], base()); o = { name: base() + ".xlsx", mime: C.MIME.xlsx, b64: C.bytesToB64(b), size: b.length }; }
      else if (target === "images") {
        const r = await nativeCall("pdfImages", { b64: await readB64(f0), width: 1600, max: 60 });
        const z = C.zipStore(r.images.map((im) => ({ name: base() + "-page-" + String(im.n).padStart(2, "0") + ".jpg", data: C.b64ToBytes(im.image.split(",")[1]) })));
        o = { name: base() + "-pages.zip", mime: C.MIME.zip, b64: C.bytesToB64(z), size: z.length, count: r.images.length };
      } else if (target === "pdf") {
        let arg;
        if (k === "image" || k === "images") arg = { images: await Promise.all(files.list.map(readUrl)) };
        else if (rows) arg = { blocks: [{ type: "h2", text: base() }, { type: "table", rows: rows.slice(0, 2000) }] };
        else arg = { blocks: blocks || [] };
        const r = await nativeCall("makePdf", arg);
        o = { name: base() + ".pdf", mime: C.MIME.pdf, b64: r.b64, size: r.bytes };
      }
      if (!alive()) return;
      o.preview = o.show ? o.show.slice(0, 1500) : blocks ? C.blocksToText(blocks).slice(0, 1500) : rows ? rows.slice(0, 8).map((r) => r.join(" | ")).join("\n") : "";
      o.note = note;
      setOut(o);
      try { const d = JSON.parse(localStorage.getItem("attune:convert:day") || "{}"); localStorage.setItem("attune:convert:day", JSON.stringify({ [today]: (d[today] || 0) + 1 })); } catch (e) {}
    } catch (e) {
      if (alive()) setErr(tr(String((e && e.message) || e)));
    } finally { if (alive()) setBusy(null); }
  };

  const save = async () => {
    if (!out) return;
    try {
      if (saveFile) { await saveFile(out.name, out.text || "", out.mime, out.b64); flash && flash(tr("Saved")); return; }
      const blob = out.b64 ? new Blob([C.b64ToBytes(out.b64)], { type: out.mime }) : new Blob([out.text], { type: out.mime });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = out.name; a.click();
    } catch (e) { if (String(e && e.message) !== "Cancelled") flash && flash(String((e && e.message) || e)); }
  };

  const chip = (on) => `px-3 py-2 rounded-xl text-[13px] border ${on ? "border-teal-600 bg-teal-500/10 text-teal-200" : "border-slate-700 text-slate-300"}`;
  const targets = files ? targetsOf(files.kind) : [];
  return (
    <div className="space-y-4 max-w-2xl mx-auto" data-testid="convert">
      <div className="px-1">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2"><FileText size={19} className="text-teal-300" />{tr("File Converter")}</h2>
        <p className="text-[12.5px] text-slate-400 leading-relaxed mt-1">{tr("PDF ↔ Word, PowerPoint → PDF, photos → PDF, scanned paper → editable Word, Excel ↔ CSV ↔ JSON, e-books, web pages, subtitles, merge and split PDFs — on your phone. Your files are never uploaded to a converter website.")}</p>
      </div>

      <section className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-3">
        <input ref={fileRef} type="file" multiple accept={ACCEPT} className="hidden" data-testid="convert-file"
          onChange={(e) => { const l = e.target.files; pick(l); e.target.value = ""; }} />
        {!files ? (
          <button onClick={() => fileRef.current && fileRef.current.click()} className="w-full py-6 rounded-xl border-2 border-dashed border-slate-700 text-slate-300 flex flex-col items-center gap-2" data-testid="convert-pick">
            <ImagePlus size={22} className="text-teal-300" /><span className="text-[14px] font-medium">{tr("Choose a file")}</span>
            <span className="text-[11.5px] text-slate-500">{tr("PDF · Word · PowerPoint · Excel · CSV · photos · e-books · web pages · subtitles — several photos → one PDF, several PDFs → merged")}</span>
          </button>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13.5px] text-slate-100 truncate" data-testid="convert-source">{tr(KIND_LABEL[files.kind])} · {files.list.length > 1 ? tr(files.kind === "pdfs" ? "{n} PDFs" : "{n} photos", { n: files.list.length }) : files.list[0].name} <span className="text-slate-500 text-[11px]">{kb(files.list.reduce((n, f) => n + f.size, 0))}</span></p>
              <button onClick={() => { setFiles(null); setOut(null); }} aria-label={tr("Remove")} className="p-2 -m-2 text-slate-500"><X size={16} /></button>
            </div>
            <div>
              <p className="text-[12px] text-slate-400 mb-1.5 flex items-center gap-1"><ChevronRight size={12} className="rtl:-scale-x-100" />{tr("Convert to")}</p>
              <div className="flex flex-wrap gap-1.5">{targets.map((t) => <button key={t} onClick={() => { setTarget(t); setOut(null); }} className={chip(target === t)} data-testid={"convert-to-" + t}>{tr(TARGET_LABEL[t])}</button>)}</div>
              {(files.kind === "image" || files.kind === "images") && target !== "pdf" ? <p className="text-[11.5px] text-slate-500 mt-1.5">{tr("The AI reads the text in the photo — Arabic too.")}</p> : null}
              {files.kind === "pdf" && !PDF_TOOLS.includes(target) ? <p className="text-[11.5px] text-slate-500 mt-1.5">{tr("Scanned pages (pictures of paper) are read by the AI.")}</p> : null}
              {files.kind === "pdfs" ? <p className="text-[11.5px] text-slate-500 mt-1.5">{tr("The PDFs are joined in the order you picked them.")}</p> : null}
              {target === "pick" || target === "rotate" ? (
                <div className="mt-2 space-y-2">
                  <input value={pages} onChange={(e) => setPages(e.target.value)} dir="ltr" inputMode="text" placeholder={target === "pick" ? tr("Pages to keep, e.g. 1-3, 5") : tr("Pages to turn (empty = all)")} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-[13px] text-slate-100" data-testid="convert-pages" />
                  {target === "rotate" ? <div className="flex gap-1.5">{[90, 180, 270].map((d) => <button key={d} onClick={() => setDeg(d)} className={chip(deg === d)} data-testid={"convert-deg-" + d}>{d === 270 ? tr("↺ 90° left") : d === 90 ? tr("↻ 90° right") : tr("180°")}</button>)}</div> : null}
                </div>
              ) : null}
            </div>
            {busy ? (
              <div className="flex items-center justify-between text-[12.5px] text-teal-200" data-testid="convert-busy">
                <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" />{busy}</span>
                <button onClick={() => { run.current++; setBusy(null); }} className="px-3 py-1.5 rounded-lg border border-rose-800 text-rose-200">{tr("Stop")}</button>
              </div>
            ) : (
              <button onClick={convert} className="w-full py-2.5 rounded-xl bg-teal-500 text-slate-950 font-semibold text-sm" data-testid="convert-go">{tr("Convert")}</button>
            )}
          </>
        )}
        {err ? <p className="text-[12.5px] text-rose-300" data-testid="convert-error">{err}</p> : null}
      </section>

      {out ? (
        <section className="bg-slate-900 rounded-2xl border border-emerald-900/60 p-4 space-y-3" data-testid="convert-result">
          <div className="flex items-center gap-2"><Check size={16} className="text-emerald-300" /><p className="text-[14px] text-slate-100 truncate" data-testid="convert-out-name">{out.name}</p><span className="text-[11px] text-slate-500 shrink-0">{kb(out.size || 0)}{out.count ? " · " + tr(out.countOf === "pdfs" ? "{n} PDFs" : "{n} pictures", { n: out.count }) : ""}{out.pagesOut ? " · " + tr("{n} pages", { n: out.pagesOut }) : ""}{out.dims ? " · " + out.dims : ""}</span></div>
          {out.note ? <p className="text-[12px] text-amber-200">{out.note}</p> : null}
          {out.preview ? (
            <details><summary className="text-[12px] text-slate-400 cursor-pointer flex items-center gap-1"><Eye size={12} />{tr("Preview")}</summary>
              <pre dir="auto" className="att-scroll mt-2 max-h-60 overflow-auto whitespace-pre-wrap text-[12px] text-slate-300 bg-slate-950 rounded-lg p-2" data-testid="convert-preview">{out.preview}</pre></details>
          ) : null}
          <button onClick={save} className="w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2" data-testid="convert-save"><Download size={16} />{tr("Save the file")}</button>
          <button onClick={() => { setFiles(null); setOut(null); }} className="w-full py-2 rounded-xl border border-slate-700 text-slate-200 text-sm">{tr("Convert another file")}</button>
        </section>
      ) : null}
    </div>
  );
}
