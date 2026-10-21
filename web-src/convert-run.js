/* ---- v6.48 the conversion itself, out of the Convert page (CHAT_RUNS_APP.md S2: "/convert" from the Home box runs the very same
   code as the Convert page, as a job with its progress on Home). Moved as it was from convert-ui.jsx (v5.39–v6.41 notes kept);
   the page and the job both call runConversion. Throws an Error (with .need = "engine" when a model is missing); returns null when
   cancelled (alive() false). Tests: the converter e2e suites + tests/e2e_v748commands.py.                                        */
import { tr, getLang } from "./i18n.js";
import * as C from "./convert.js";
import * as TR from "./translate.js";

export const TARGET_LABEL = { docx: "Word (.docx)", pdf: "PDF", txt: "Text (.txt)", images: "Pictures (.zip)", csv: "CSV", xlsx: "Excel (.xlsx)",
  html: "Web page (.html)", md: "Markdown (.md)", odt: "LibreOffice text (.odt)", ods: "LibreOffice sheet (.ods)", json: "JSON",
  jpg: "JPG photo", png: "PNG photo", webp: "WebP photo", srt: "Subtitles (.srt)", vtt: "Subtitles (.vtt)",
  translate: "Translate…", edit: "Edit the PDF", merge: "Merge into one PDF", split: "Split into pages", pick: "Keep some pages", rotate: "Rotate pages" };
export const KIND_LABEL = { pdf: "PDF", pdfs: "PDFs", docx: "Word document", pptx: "PowerPoint", odt: "LibreOffice text", ods: "LibreOffice sheet", epub: "E-book",
  html: "Web page", rtf: "Rich Text", image: "Photo", images: "Photos", text: "Text", xlsx: "Excel workbook", csv: "CSV sheet", json: "JSON data", srt: "Subtitles", vtt: "Subtitles" };
export const ROWS = ["xlsx", "ods", "csv", "json"], SUBS = ["srt", "vtt"], PDF_TOOLS = ["merge", "split", "pick", "rotate", "images"], PHOTO = ["jpg", "png", "webp"];
// v5.39: languages a document can be translated into (names shown in the app's language)
export const T_LANGS = { en: "English", ar: "Arabic", fr: "French", es: "Spanish", de: "German", tr: "Turkish", it: "Italian", pt: "Portuguese", ru: "Russian", zh: "Chinese (Simplified)", ja: "Japanese", ko: "Korean",
  hi: "Hindi", ur: "Urdu", fa: "Persian", id: "Indonesian", nl: "Dutch", pl: "Polish", bn: "Bengali", sw: "Swahili", el: "Greek", uk: "Ukrainian", ro: "Romanian", ms: "Malay", th: "Thai", vi: "Vietnamese" };
export const langLabel = (k) => { const l = getLang(); if (l !== "en") try { return new Intl.DisplayNames([l], { type: "language" }).of(k) || tr(T_LANGS[k]); } catch (e) {} return T_LANGS[k]; };

export const recode = (file, fmt) => new Promise((ok, bad) => {
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
export const readB64 = (f) => new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] || ""); r.onerror = () => bad(new Error("Couldn't read that file")); r.readAsDataURL(f); });
export const readUrl = (f) => new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => bad(new Error("Couldn't read that file")); r.readAsDataURL(f); });
export const kb = (n) => (n > 1e6 ? (n / 1e6).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1e3)) + " KB");

export const need = (msg, what = "") => Object.assign(new Error(msg), { need: what });
export const needsNative = (k, t, tFmt) => k === "pdf" || k === "pdfs" || t === "pdf" || (t === "translate" && tFmt === "pdf" && !["srt", "vtt"].includes(k));

/** files: { kind, list: File[] } (kind from convert.js kindOf / MULTI); target: a TARGET_LABEL key. → the output
    { name, mime, b64 | text, size, preview, note, … } or null when stopped. */
export async function runConversion({ files, target, tLang = "ar", tFmt = "pdf", pages = "", deg = 90 },
  { nativeCall = null, native = null, llm = null, modelReady = false, canReadPhotos = false, onBusy = () => {}, alive = () => true } = {}) {
  const base = () => (files.list[0].name || "file").replace(/\.[^.]+$/, "") + (files.list.length > 1 ? "-" + files.list.length : "");
  // the AI reads a picture of a page (scans, photos of paper)
  const readPicture = async (dataUrl, n, total) => {
    const img = { media: "image/jpeg", data: dataUrl.split(",")[1] };
    return String(await llm(C.readPageMessages(n, total), img, { maxTokens: 1800, temperature: 0 }) || "").trim();
  };
  const k = files.kind, f0 = files.list[0];
  let blocks = null, rows = null, note = "", docOpts = null;
  // 1. read the source into blocks (text) or rows (sheets)
  let cues = null;
  if (k === "pdf" && !PDF_TOOLS.includes(target)) {
    const r = await nativeCall("pdfText", { b64: await readB64(f0) });
    if (!alive()) return null;
    const scans = r.pages.filter((p) => p.scan).map((p) => p.n);
    const text = {};
    for (const p of r.pages) text[p.n] = p.text;
    if (scans.length) {
      if (!modelReady || !canReadPhotos) note = tr("{n} scanned page(s) have no text layer — install a model marked 📷 in Engine to read them.", { n: scans.length });
      else {
        const imgs = await nativeCall("pdfImages", { b64: await readB64(f0), pages: scans.slice(0, 40), width: 1400 });
        for (let i = 0; i < imgs.images.length; i++) {
          if (!alive()) return null;
          onBusy(tr("The AI is reading scanned page {n} of {t}…", { n: i + 1, t: imgs.images.length }));
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
  } else if (k === "docx") { const rd = await C.docxRead(new Uint8Array(await f0.arrayBuffer())); blocks = rd.blocks; docOpts = rd.opts; }   // v6.8: with its page, fonts and spacing
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
    // v6.41 (S2): a printed page in Latin script is read by the phone itself WITH its layout (headings, lists, tables);
    // an Arabic or handwritten page goes to the AI reader
    const got = [];
    if (nativeCall && native && native.readText) {
      for (let i = 0; i < files.list.length; i++) {
        if (!alive()) return null;
        onBusy(tr("Reading photo {n} of {t} on the phone…", { n: i + 1, t: files.list.length }));
        let r = null; try { r = await nativeCall("readText", { b64: (await readUrl(files.list[i])).split(",")[1] }); } catch (e) {}
        got.push(C.ocrUsable(r) ? C.pdfLinesToBlocks(C.ocrPages(r)) : null);
      }
    }
    if (got.length && got.every(Boolean)) { blocks = got.flatMap((b, i) => (i && b.length ? [{ ...b[0], pageBreak: true }, ...b.slice(1)] : b)); note = tr("Read on this phone with its layout and tables — check names and numbers."); }
    else {
      if (!modelReady || !canReadPhotos) throw need(tr("Reading a photo needs a model marked 📷 — open Engine."), "engine");
      const parts = [];
      for (let i = 0; i < files.list.length; i++) {
        if (!alive()) return null;
        if (got[i]) { parts.push(C.blocksToText(got[i])); continue; }
        onBusy(tr("The AI is reading photo {n} of {t}…", { n: i + 1, t: files.list.length }));
        parts.push(await readPicture(await readUrl(files.list[i]), i + 1, files.list.length));
      }
      blocks = C.textToBlocks(parts.join("\n\n"));
      note = tr("Read by the AI — check names and numbers.");
    }
  }
  if (!alive()) return null;
  if (blocks && !blocks.length && !note) throw new Error("No text was found in that file.");
  // v5.39: translate — numbered pieces go to the model in batches; code puts them back in place
  let outTarget = target, suffix = "";
  if (target === "translate") {
    try { localStorage.setItem("attune:convert:tlang", tLang); } catch (e) {}
    const cueBlocks = cues ? cues.map((c) => ({ type: "p", text: c.text })) : null;
    const src = cueBlocks || blocks || [];
    const units = C.translateUnits(src);
    // v6.27: the checked engine (translate.js) — numbers, names and codes locked; script, untranslated and the person's
    // glossary checked; a piece that fails is retried alone with the reason, then marked — never silently wrong
    let gloss = []; try { gloss = JSON.parse(localStorage.getItem("attune:translate:glossary") || "[]"); } catch (e) {}
    const out = await TR.translatePieces(units.map((u) => u.text), (m, o) => llm(m, null, { maxTokens: o.maxTokens, temperature: 0.2 }),
      { lang: tLang, language: T_LANGS[tLang], glossary: gloss, onProgress: (i, n) => alive() && onBusy(tr("Translating into {l} — part {n} of {t}…", { l: langLabel(tLang), n: i + 1, t: n })) });
    if (!alive()) return null;
    const texts = out.map((r) => r.text);
    const flagged = out.filter((r) => !r.ok);
    const missed = 0;
    const tb = C.applyTranslations(src, units, texts);
    if (cues) cues = cues.map((c, i) => ({ ...c, text: tb[i].text })); else blocks = tb;
    note = (note ? note + " " : "") + (flagged.length ? tr("{n} piece(s) to check: {list}", { n: flagged.length, list: flagged.slice(0, 3).map((f) => "«" + f.src.slice(0, 40) + "» (" + f.why + ")").join("; ") }) + " " : tr("Checked: numbers, names and codes kept exactly.") + " ") + tr("Translated by the AI on your phone — check important names and numbers.");
    outTarget = cues ? files.kind : tFmt; suffix = "-" + tLang;
  }
  // a PDF → Excel: its tables (read as "a | b" rows), else each line split at wide gaps
  if (target === "xlsx" && blocks) {
    // (one table after another, a blank row between them)
    const t = blocks.filter((b) => b.type === "table").flatMap((b, k) => (k ? [[], ...b.rows] : b.rows));
    rows = t.length ? t : blocks.flatMap((b) => (b.type === "table" ? b.rows : String(b.text || "").split("\n").map((l) => l.split(/\t|\s{2,}/).map((c) => c.trim()))));
    if (!t.length) note = (note ? note + " " : "") + tr("This PDF has no clear table, so each line became a row — check the columns.");
  }
  // sheets → Word / web page / PDF: one table
  if (rows && ["docx", "html", "md", "odt"].includes(target)) blocks = [{ type: "h2", text: base() }, { type: "table", rows: rows.slice(0, 5000) }];
  onBusy(tr("Making the {t} file…", { t: tr(TARGET_LABEL[outTarget]) }));
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
      if (!alive()) return null;
      onBusy(tr("Converting photo {n} of {t}…", { n: i + 1, t: files.list.length }));
      done.push({ name: files.list[i].name.replace(/\.[^.]+$/, "") + "." + outTarget, ...(await recode(files.list[i], outTarget)) });
    }
    if (done.length === 1) o = { name: done[0].name, mime: C.MIME[outTarget], b64: done[0].b64, size: Math.floor(done[0].b64.length * 0.75), dims: done[0].w + "×" + done[0].h };
    else { const z = C.zipStore(done.map((d) => ({ name: d.name, data: C.b64ToBytes(d.b64) }))); o = { name: base() + "-" + outTarget + ".zip", mime: C.MIME.zip, b64: C.bytesToB64(z), size: z.length, count: done.length }; }
  } else if (["merge", "split", "pick", "rotate"].includes(outTarget)) {
    const list = outTarget === "pick" || (outTarget === "rotate" && pages.trim()) ? C.pageList(pages) : [];
    if (outTarget === "pick" && !list.length) throw need(tr("Type the pages to keep, like 1-3, 5"));
    const r = await nativeCall("pdfEdit", outTarget === "merge" ? { op: "merge", files: await Promise.all(files.list.map(readB64)) } : { op: target, b64: await readB64(f0), pages: list, degrees: deg });
    if (!alive()) return null;
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
    else arg = { blocks: (blocks || []).filter((b) => b.type !== "header" && b.type !== "footer") };
    let r = null;
    // v6.8: a PowerPoint → one page per slide that looks like the slide (shapes, colours, pictures, tables)
    if (k === "pptx" && target !== "translate") {
      try { const sl = await C.pptxToSlidesHtml(new Uint8Array(await f0.arrayBuffer())); if (sl.slides) r = await nativeCall("htmlToPdf", { html: sl.html, w: sl.w, h: sl.h }); } catch (e) { r = null; }
    }
    // v6.8: laid out and printed by the phone's own Chrome engine (the look kept: fonts, sizes, spacing,
    // tables, pictures, header / footer, Arabic shaping); the older PDF maker if the phone refuses
    if (arg.blocks && !(r && r.b64)) {
      const wide = rows && Math.max(0, ...rows.slice(0, 50).map((x) => x.length)) > 6;
      const po = rows ? { sheet: true, body: 9, page: wide ? { w: 841.9, h: 595.3, top: 36, bottom: 36, left: 36, right: 36 } : { w: 595.3, h: 841.9, top: 42, bottom: 42, left: 42, right: 42 } } : docOpts || {};
      const pgs = po.page || { w: 595.3, h: 841.9 };
      try { r = await nativeCall("htmlToPdf", { html: C.blocksToPrintHtml(rows ? arg.blocks : blocks || [], base(), po), w: pgs.w, h: pgs.h }); } catch (e) { r = null; }
    }
    if (!r || !r.b64) r = await nativeCall("makePdf", arg);
    o = { name: base() + suffix + ".pdf", mime: C.MIME.pdf, b64: r.b64, size: r.bytes };
  }
  if (!alive()) return null;
  o.preview = o.show ? o.show.slice(0, 1500) : blocks ? C.blocksToText(blocks).slice(0, 1500) : rows ? rows.slice(0, 8).map((r) => r.join(" | ")).join("\n") : "";
  o.note = note;
  return o;
}

/** v6.48: the files a job was given → { kind, list } the way the Convert page reads a pick (one file; several photos → one PDF;
    several PDFs → merged), or an Error that says what to pick. */
export function filesFor(list) {
  const arr = [...(list || [])];
  if (!arr.length) throw need(tr("Attach a file first (the + in the box)."), "file");
  const kinds = arr.map((f) => C.kindOf(f.name, f.type));
  if (kinds.some((k) => !k)) throw need(tr("That kind of file can't be converted here yet. Try PDF, Word, PowerPoint, Excel, CSV, photos, text, e-books, web pages or subtitles."), "file");
  const multi = arr.length > 1 && kinds.every((k) => k === kinds[0]) && C.MULTI[kinds[0]];
  const kind = arr.length > 1 ? (multi ? multi.kind : null) : kinds[0];
  if (!kind) throw need(tr("Pick one file — or several photos (→ one PDF), or several PDFs (→ merged)."), "file");
  return { kind, list: arr };
}
export const targetsOf = (kind) => (kind === "images" ? C.MULTI.image.targets : kind === "pdfs" ? C.MULTI.pdf.targets : (C.KINDS[kind] || { targets: [] }).targets);
/** The target asked for, if this kind of file can become it ("Word → PDF" yes; "photo → Excel" no → an Error naming what it can). */
export function targetFor(kind, format) {
  const ts = targetsOf(kind);
  if (ts.includes(format)) return format;
  if (format === "jpg" && ts.includes("images")) return "images";
  throw need(tr("A {k} can become: {list}", { k: tr(KIND_LABEL[kind] || kind), list: ts.filter((t) => !["edit", "pick", "rotate", "split"].includes(t)).map((t) => tr(TARGET_LABEL[t] || t)).join(", ") }), "format");
}
/** A job's progress from the converter's own words ("part 3 of 8", "page 2 of 5") → a percentage, or null. */
export function pctOf(note) { const m = String(note || "").match(/(\d+)\s*(?:of|من)\s*(\d+)/); return m && +m[2] > 0 ? Math.min(99, Math.round((+m[1] / +m[2]) * 100)) : null; }
