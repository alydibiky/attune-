/* ---- More → File Converter (v5.36; v5.37 "as many converters as you can") ----------------------
   PDF → Word / text / pictures / Excel / web page / Markdown / LibreOffice, and PDF tools (merge,
   split, keep pages, rotate); Word, PowerPoint, LibreOffice, e-books, web pages, RTF, text → Word /
   PDF / text / web page / Markdown; Excel, LibreOffice sheets, CSV, JSON ↔ each other; photos → PDF /
   JPG / PNG / WebP / text; subtitles SRT ↔ VTT. On the phone: Word / Excel / CSV in convert.js, PDFs by Android
   (NativeBridge pdfText / pdfImages / makePdf). Scanned pages and photos of paper are read by the
   AI model (a model that reads photos). Nothing is uploaded. */
import React, { useState, useRef } from "react";
import { FileText, Loader2, X, Download, Check, ImagePlus, ChevronRight, Eye } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import { useSubBack, useSticky } from "./backstack.js";
import * as C from "./convert.js";

const TARGET_LABEL = { docx: "Word (.docx)", pdf: "PDF", txt: "Text (.txt)", images: "Pictures (.zip)", csv: "CSV", xlsx: "Excel (.xlsx)",
  html: "Web page (.html)", md: "Markdown (.md)", odt: "LibreOffice text (.odt)", ods: "LibreOffice sheet (.ods)", json: "JSON",
  jpg: "JPG photo", png: "PNG photo", webp: "WebP photo", srt: "Subtitles (.srt)", vtt: "Subtitles (.vtt)",
  translate: "Translate…", merge: "Merge into one PDF", split: "Split into pages", pick: "Keep some pages", rotate: "Rotate pages" };
const KIND_LABEL = { pdf: "PDF", pdfs: "PDFs", docx: "Word document", pptx: "PowerPoint", odt: "LibreOffice text", ods: "LibreOffice sheet", epub: "E-book",
  html: "Web page", rtf: "Rich Text", image: "Photo", images: "Photos", text: "Text", xlsx: "Excel workbook", csv: "CSV sheet", json: "JSON data", srt: "Subtitles", vtt: "Subtitles" };
const ROWS = ["xlsx", "ods", "csv", "json"], SUBS = ["srt", "vtt"], PDF_TOOLS = ["merge", "split", "pick", "rotate", "images"], PHOTO = ["jpg", "png", "webp"];
// v5.39: languages a document can be translated into (names shown in the app's language)
const T_LANGS = { en: "English", ar: "Arabic", fr: "French", es: "Spanish", de: "German", tr: "Turkish", it: "Italian", pt: "Portuguese", ru: "Russian", zh: "Chinese (Simplified)", ja: "Japanese", ko: "Korean",
  hi: "Hindi", ur: "Urdu", fa: "Persian", id: "Indonesian", nl: "Dutch", pl: "Polish", bn: "Bengali", sw: "Swahili", el: "Greek", uk: "Ukrainian", ro: "Romanian", ms: "Malay", th: "Thai", vi: "Vietnamese" };
const langLabel = (k) => { const l = getLang(); if (l !== "en") try { return new Intl.DisplayNames([l], { type: "language" }).of(k) || tr(T_LANGS[k]); } catch (e) {} return T_LANGS[k]; };
// v5.41 (Ali: "give me all the options — how can I merge PDFs?"): every tool shown before a file is picked
const QUICK = [
  { id: "merge", label: "Merge PDFs", desc: "Several PDFs → one", accept: ".pdf,application/pdf", multiple: true, target: "merge", icon: "📑" },
  { id: "pdf2word", label: "PDF → Word", desc: "Edit a PDF in Word", accept: ".pdf,application/pdf", target: "docx", icon: "📝" },
  { id: "photos2pdf", label: "Photos → PDF", desc: "Pictures into one PDF", accept: "image/*", multiple: true, target: "pdf", icon: "🖼️" },
  { id: "scan2word", label: "Scan → Word", desc: "Photo of paper → editable text", accept: "image/*", multiple: true, target: "docx", icon: "📷" },
  { id: "translate", label: "Translate", desc: "PDF, Word, subtitles…", accept: null, target: "translate", icon: "🌍" },
  { id: "split", label: "Split a PDF", desc: "One PDF per page", accept: ".pdf,application/pdf", target: "split", icon: "✂️" },
  { id: "pick", label: "Keep some pages", desc: "e.g. pages 1-3, 5", accept: ".pdf,application/pdf", target: "pick", icon: "📄" },
  { id: "rotate", label: "Rotate pages", desc: "Turn sideways pages", accept: ".pdf,application/pdf", target: "rotate", icon: "🔄" },
  { id: "word2pdf", label: "Word → PDF", desc: "Also PowerPoint, text…", accept: ".docx,.pptx,.odt,.txt,.md,.rtf,.html,.htm,.epub", target: "pdf", icon: "📕" },
  { id: "pdf2img", label: "PDF → pictures", desc: "Each page as a JPG", accept: ".pdf,application/pdf", target: "images", icon: "🗂️" },
  { id: "sheets", label: "Excel ↔ CSV", desc: "Sheets, JSON, LibreOffice", accept: ".xlsx,.csv,.tsv,.ods,.json", target: null, icon: "📊" },
  { id: "photo", label: "Photo format", desc: "JPG · PNG · WebP", accept: "image/*", target: "jpg", icon: "🎨" },
];
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
  const [files, setFiles] = useSticky("convert:files", null);       // { kind, list: File[] }
  const [target, setTarget] = useSticky("convert:target", null);
  const [busy, setBusy] = useState(null);         // text
  const [out, setOut] = useSticky("convert:out", null);           // { name, mime, b64?, text?, size, preview, note }
  const [err, setErr] = useState("");
  const [pages, setPages] = useState("");         // PDF tools: "1-3, 5"
  const [deg, setDeg] = useState(90);
  const [tLang, setTLang] = useState(() => { try { return localStorage.getItem("attune:convert:tlang") || (getLang() === "ar" ? "en" : "ar"); } catch (e) { return "ar"; } });
  const [tFmt, setTFmt] = useState("pdf");
  const run = useRef(0);
  const fileRef = useRef(null);
  const intentRef = useRef(null);   // the tool tapped before picking (QUICK)
  const [intent, setIntent] = useState(null);
  const startTool = (q) => {
    intentRef.current = q; setIntent(q); setErr("");
    const el = fileRef.current; if (!el) return;
    el.accept = q.accept || ACCEPT; el.multiple = !!q.multiple; el.click();
  };
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
    const q = intentRef.current; intentRef.current = null;
    if (q && q.id === "merge" && kind !== "pdfs") { setErr(tr("To merge, pick two or more PDFs together (tap and hold to select several).")); setFiles(null); return; }
    setFiles({ kind, list: arr });
    setTarget(q && q.target && targetsOf(kind).includes(q.target) ? q.target : targetsOf(kind)[0]);
  };

  const targetsOf = (kind) => (kind === "images" ? C.MULTI.image.targets : kind === "pdfs" ? C.MULTI.pdf.targets : C.KINDS[kind].targets);
  const needsNative = (k, t) => k === "pdf" || k === "pdfs" || t === "pdf" || (t === "translate" && tFmt === "pdf" && !["srt", "vtt"].includes(k));
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
    if (target === "translate" && !modelReady) { setErr(tr("Translating needs an AI model — open Engine and install one.")); openEngine && openEngine(); return; }
    if (needsNative(files.kind, target) && !nativeCall) { setErr(tr("PDF files are converted by the Android app — open Attune on your phone.")); return; }
    const id = ++run.current, alive = () => run.current === id;
    setErr(""); setOut(null); setBusy(tr("Reading the file…"));
    try {
      const k = files.kind, f0 = files.list[0];
      let blocks = null, rows = null, note = "", docOpts = null;
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
        // v5.41: pages that came with their layout are rebuilt with headings, lists and tables
        const laid = r.pages.filter((p) => !p.scan && p.lines && p.lines.length);
        // v6.8: a PDF with no scanned pages is read as one document (a paragraph can go on over a page
        // break, the body size and spacing come from all of it) and the Word file gets its page set-up
        const allLaid = laid.length && laid.length === r.pages.length;
        blocks = allLaid ? C.pdfLinesToBlocks(r.pages)
          : laid.length === r.pages.filter((p) => !p.scan).length && laid.length
          ? r.pages.flatMap((p) => (!p.scan && p.lines && p.lines.length ? C.pdfLinesToBlocks([p]) : C.textToBlocks(text[p.n] || "")))
          : r.pages.flatMap((p) => C.textToBlocks(text[p.n] || ""));
        if (allLaid) docOpts = C.pdfDocOptions(r.pages);
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
      // v5.39: translate — numbered pieces go to the model in batches; code puts them back in place
      let outTarget = target, suffix = "";
      if (target === "translate") {
        try { localStorage.setItem("attune:convert:tlang", tLang); } catch (e) {}
        const cueBlocks = cues ? cues.map((c) => ({ type: "p", text: c.text })) : null;
        const src = cueBlocks || blocks || [];
        const units = C.translateUnits(src), batches = C.batchUnits(units);
        const texts = Array(units.length).fill(null);
        let missed = 0;
        for (let bi = 0; bi < batches.length; bi++) {
          if (!alive()) return;
          setBusy(tr("Translating into {l} — part {n} of {t}…", { l: langLabel(tLang), n: bi + 1, t: batches.length }));
          const idx = batches[bi];
          const reply = await llm(C.translateMessages(idx.map((i) => units[i].text), T_LANGS[tLang]), null, { maxTokens: Math.min(3500, 300 + Math.round(idx.reduce((n, i) => n + units[i].text.length, 0) * 1.6)), temperature: 0.2 });
          const got = C.parseTranslated(reply, idx.length);
          for (let j = 0; j < idx.length; j++) {
            if (got[j] == null) {   // a piece the model skipped: once more on its own
              if (!alive()) return;
              const one = C.parseTranslated(await llm(C.translateMessages([units[idx[j]].text], T_LANGS[tLang]), null, { maxTokens: 1500, temperature: 0.2 }), 1)[0];
              if (one == null) missed++;
              texts[idx[j]] = one;
            } else texts[idx[j]] = got[j];
          }
        }
        const tb = C.applyTranslations(src, units, texts);
        if (cues) cues = cues.map((c, i) => ({ ...c, text: tb[i].text })); else blocks = tb;
        note = (note ? note + " " : "") + (missed ? tr("{n} piece(s) couldn't be translated and were left as they were.", { n: missed }) + " " : "") + tr("Translated by the AI on your phone — check important names and numbers.");
        outTarget = cues ? files.kind : tFmt; suffix = "-" + tLang;
      }
      // a PDF → Excel: its tables (read as "a | b" rows), else each line split at wide gaps
      if (target === "xlsx" && blocks) {
        const t = blocks.filter((b) => b.type === "table").flatMap((b) => b.rows);
        rows = t.length ? t : blocks.flatMap((b) => (b.type === "table" ? b.rows : String(b.text || "").split("\n").map((l) => l.split(/\t|\s{2,}/).map((c) => c.trim()))));
        if (!t.length) note = (note ? note + " " : "") + tr("This PDF has no clear table, so each line became a row — check the columns.");
      }
      // sheets → Word / web page / PDF: one table
      if (rows && ["docx", "html", "md", "odt"].includes(target)) blocks = [{ type: "h2", text: base() }, { type: "table", rows: rows.slice(0, 5000) }];
      setBusy(tr("Making the {t} file…", { t: tr(TARGET_LABEL[outTarget]) }));
      // 2. write the target
      let o = null;
      const textOut = (ext, t) => ({ name: base() + suffix + "." + ext, mime: C.MIME[ext], text: t, size: new Blob([t]).size, show: t });
      if (outTarget === "docx") { const b = C.docxFromBlocks(blocks || [], base(), docOpts || {}); o = { name: base() + suffix + ".docx", mime: C.MIME.docx, b64: C.bytesToB64(b), size: b.length }; }
      else if (outTarget === "txt") o = textOut("txt", cues ? C.cuesToText(cues) : C.blocksToText(blocks || []));
      else if (outTarget === "html") o = textOut("html", C.blocksToHtml(blocks || [], base()));
      else if (outTarget === "md") o = textOut("md", C.blocksToMarkdown(blocks || []));
      else if (outTarget === "json") o = textOut("json", C.rowsToJson(rows || []));
      else if (outTarget === "srt") o = textOut("srt", C.srtFromCues(cues));
      else if (outTarget === "vtt") o = textOut("vtt", C.vttFromCues(cues));
      else if (outTarget === "odt") { const b = C.odtFromBlocks(blocks || []); o = { name: base() + ".odt", mime: C.MIME.odt, b64: C.bytesToB64(b), size: b.length }; }
      else if (outTarget === "ods") { const b = C.odsFromRows(rows || [], base()); o = { name: base() + ".ods", mime: C.MIME.ods, b64: C.bytesToB64(b), size: b.length }; }
      else if (PHOTO.includes(outTarget)) {
        const done = [];
        for (let i = 0; i < files.list.length; i++) {
          if (!alive()) return;
          setBusy(tr("Converting photo {n} of {t}…", { n: i + 1, t: files.list.length }));
          done.push({ name: files.list[i].name.replace(/\.[^.]+$/, "") + "." + outTarget, ...(await recode(files.list[i], outTarget)) });
        }
        if (done.length === 1) o = { name: done[0].name, mime: C.MIME[outTarget], b64: done[0].b64, size: Math.floor(done[0].b64.length * 0.75), dims: done[0].w + "×" + done[0].h };
        else { const z = C.zipStore(done.map((d) => ({ name: d.name, data: C.b64ToBytes(d.b64) }))); o = { name: base() + "-" + outTarget + ".zip", mime: C.MIME.zip, b64: C.bytesToB64(z), size: z.length, count: done.length }; }
      } else if (["merge", "split", "pick", "rotate"].includes(outTarget)) {
        const list = outTarget === "pick" || (outTarget === "rotate" && pages.trim()) ? C.pageList(pages) : [];
        if (outTarget === "pick" && !list.length) { setErr(tr("Type the pages to keep, like 1-3, 5")); return; }
        const r = await nativeCall("pdfEdit", outTarget === "merge" ? { op: "merge", files: await Promise.all(files.list.map(readB64)) } : { op: target, b64: await readB64(f0), pages: list, degrees: deg });
        if (!alive()) return;
        const sfx = { merge: "-merged", pick: "-pages", rotate: "-rotated" }[target];
        if (outTarget === "split") {
          const z = C.zipStore(r.files.map((f) => ({ name: base() + "-page-" + String(f.n).padStart(2, "0") + ".pdf", data: C.b64ToBytes(f.b64) })));
          o = { name: base() + "-pages.zip", mime: C.MIME.zip, b64: C.bytesToB64(z), size: z.length, count: r.files.length, countOf: "pdfs" };
        } else o = { name: (outTarget === "merge" ? (files.list[0].name || "file").replace(/\.[^.]+$/, "") : base()) + sfx + ".pdf", mime: C.MIME.pdf, b64: r.files[0].b64, size: Math.floor(r.files[0].b64.length * 0.75), pagesOut: r.files[0].pages };
      }
      else if (outTarget === "csv") { const t = C.csvStringify(rows || []); o = { name: base() + ".csv", mime: C.MIME.csv, text: t, size: new Blob([t]).size }; }
      else if (outTarget === "xlsx") { const b = C.xlsxFromRows(rows || [], base()); o = { name: base() + ".xlsx", mime: C.MIME.xlsx, b64: C.bytesToB64(b), size: b.length }; }
      else if (outTarget === "images") {
        const r = await nativeCall("pdfImages", { b64: await readB64(f0), width: 1600, max: 60 });
        const z = C.zipStore(r.images.map((im) => ({ name: base() + "-page-" + String(im.n).padStart(2, "0") + ".jpg", data: C.b64ToBytes(im.image.split(",")[1]) })));
        o = { name: base() + "-pages.zip", mime: C.MIME.zip, b64: C.bytesToB64(z), size: z.length, count: r.images.length };
      } else if (outTarget === "pdf") {
        let arg;
        if ((k === "image" || k === "images") && target !== "translate") arg = { images: await Promise.all(files.list.map(readUrl)) };
        else if (rows) arg = { blocks: [{ type: "h2", text: base() }, { type: "table", rows: rows.slice(0, 2000) }] };
        else arg = { blocks: blocks || [] };
        const r = await nativeCall("makePdf", arg);
        o = { name: base() + suffix + ".pdf", mime: C.MIME.pdf, b64: r.b64, size: r.bytes };
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
          <>
            <p className="text-[13px] font-medium text-slate-200">{tr("What do you want to do?")}</p>
            <div className="grid grid-cols-2 gap-2" data-testid="convert-tools">
              {QUICK.map((q) => (
                <button key={q.id} onClick={() => startTool(q)} data-testid={"convert-tool-" + q.id}
                  className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-start active:border-teal-600">
                  <span className="block text-[18px] leading-none mb-1.5">{q.icon}</span>
                  <span className="block text-[13px] font-semibold text-slate-100">{tr(q.label)}</span>
                  <span className="block text-[11px] text-slate-500 leading-snug mt-0.5">{tr(q.desc)}</span>
                </button>))}
            </div>
            <button onClick={() => { intentRef.current = null; setIntent(null); if (fileRef.current) { fileRef.current.accept = ACCEPT; fileRef.current.multiple = true; fileRef.current.click(); } }} className="w-full py-4 rounded-xl border-2 border-dashed border-slate-700 text-slate-300 flex flex-col items-center gap-1.5" data-testid="convert-pick">
              <ImagePlus size={20} className="text-teal-300" /><span className="text-[13.5px] font-medium">{tr("Or choose any file — see everything it can become")}</span>
              <span className="text-[11px] text-slate-500">{tr("PDF · Word · PowerPoint · Excel · CSV · photos · e-books · web pages · subtitles")}</span>
            </button>
          </>
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
              {target === "translate" ? (
                <div className="mt-2 space-y-2" data-testid="convert-translate">
                  <select value={tLang} onChange={(e) => setTLang(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-[13px] text-slate-100" data-testid="convert-tlang">
                    {Object.keys(T_LANGS).map((k) => <option key={k} value={k}>{langLabel(k)}</option>)}
                  </select>
                  {["srt", "vtt"].includes(files.kind) ? null : <div className="flex gap-1.5">{["pdf", "docx"].map((f) => <button key={f} onClick={() => setTFmt(f)} className={chip(tFmt === f)} data-testid={"convert-tfmt-" + f}>{tr(TARGET_LABEL[f])}</button>)}</div>}
                  <p className="text-[11.5px] text-slate-500">{tr("The AI on your phone translates it piece by piece; headings, lists, tables and numbers stay in place. Long files take a few minutes.")}</p>
                </div>
              ) : null}
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
