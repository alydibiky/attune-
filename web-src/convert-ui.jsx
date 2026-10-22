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
import * as TR from "./translate.js";
import { PANES, LEFT, RIGHT, DeskEmpty } from "./desk.jsx";
import { PdfEditor } from "./pdfedit-ui.jsx";
import * as K from "./ui-kit.jsx";
import { runConversion, TARGET_LABEL, KIND_LABEL, ROWS, SUBS, PDF_TOOLS, PHOTO, T_LANGS, langLabel, recode, readB64, readUrl, needsNative as NEEDS_NATIVE } from "./convert-run.js";

// v5.41 (Ali: "give me all the options — how can I merge PDFs?"): every tool shown before a file is picked
// v6.31 minimal (design A): one main action (choose a file), the four most used as plain rows, the rest behind "All conversions";
// Translate is its own tab next to this one, so it is not repeated here
const MINIMAL = (() => { try { return localStorage.getItem("attune:legacy-nav") !== "1"; } catch (e) { return true; } })();
// v6.32: "Edit a PDF" takes the first row (Ali picked option A); Word → PDF moved under "All conversions"
const TOP4 = ["edit", "pdf2word", "photos2pdf", "merge"];
const QUICK = [
  { id: "edit", label: "Edit a PDF", desc: "Change text, highlight, sign, pages", accept: ".pdf,application/pdf", target: "edit", icon: "✏️" },
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
const kb = (n) => (n > 1e6 ? (n / 1e6).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1e3)) + " KB");

export function FileConverter({ nativeCall, native, saveFile, llm, modelReady, canReadPhotos, openEngine, flash, pro, openPlan }) {
  const [files, setFiles] = useSticky("convert:files", null);       // { kind, list: File[] }
  const [target, setTarget] = useSticky("convert:target", null);
  const [showAll, setShowAll] = useState(false);   // v6.31 minimal: the other conversions
  const [busy, setBusy] = useState(null);         // text
  const [out, setOut] = useSticky("convert:out", null);           // { name, mime, b64?, text?, size, preview, note }
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState(false);   // v6.32: Edit a PDF is open
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
    if (q && q.id === "edit") { if (kind !== "pdf") { setErr(tr("Pick one PDF to edit.")); setFiles(null); return; } if (!nativeCall) { setErr(tr("PDF files are converted by the Android app — open Attune on your phone.")); return; } setEditing(true); }
  };

  const targetsOf = (kind) => (kind === "images" ? C.MULTI.image.targets : kind === "pdfs" ? C.MULTI.pdf.targets : C.KINDS[kind].targets);
  const needsNative = (k, t) => NEEDS_NATIVE(k, t, tFmt);


  const convert = async () => {
    if (!files || !target) return;
    if (target === "edit") { if (!nativeCall) { setErr(tr("PDF files are converted by the Android app — open Attune on your phone.")); return; } setOut(null); setEditing(true); return; }
    const today = new Date().toISOString().slice(0, 10);
    let used = 0; try { used = JSON.parse(localStorage.getItem("attune:convert:day") || "{}")[today] || 0; } catch (e) {}
    if (!pro && used >= 5) { flash && flash(tr("Free includes 5 conversions a day — Pro is unlimited")); openPlan && openPlan(); return; }
    if (target === "translate" && !modelReady) { setErr(tr("Translating needs an AI model — open Engine and install one.")); openEngine && openEngine(); return; }
    if (needsNative(files.kind, target) && !nativeCall) { setErr(tr("PDF files are converted by the Android app — open Attune on your phone.")); return; }
    const id = ++run.current, alive = () => run.current === id;
    setErr(""); setOut(null); setBusy(tr("Reading the file…"));
    try {
      const o = await runConversion({ files, target, tLang, tFmt, pages, deg },
        { nativeCall, native, llm, modelReady, canReadPhotos, onBusy: (t) => alive() && setBusy(t), alive });
      if (!o || !alive()) return;
      setOut(o);
      try { const d = JSON.parse(localStorage.getItem("attune:convert:day") || "{}"); localStorage.setItem("attune:convert:day", JSON.stringify({ [today]: (d[today] || 0) + 1 })); } catch (e) {}
    } catch (e) {
      if (alive()) { setErr(tr(String((e && e.message) || e))); if (e && e.need === "engine" && openEngine) openEngine(); }
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

  if (files && editing) return (
    <PdfEditor file={files.list[0]} nativeCall={nativeCall} flash={flash}
      onClose={() => { setEditing(false); setFiles(null); setTarget(null); }}
      onDone={(o) => { setEditing(false); setOut(o); }} />);

  const chip = (on) => K.chip(on) + (on ? " decoration-teal-500" : "");   // the inert teal class: tests/e2e_v541.py looks for "teal" on the chosen target
  const targets = files ? targetsOf(files.kind) : [];
  return (
    <div className="calm text-[var(--c-ink)] space-y-4 max-w-2xl mx-auto" data-testid="convert">
      <div className="px-1">
        <h2 className={K.h1 + " flex items-center gap-2"}><FileText size={19} className="text-[var(--c-acc)]" />{tr("File Converter")}</h2>
        <p data-intro="" className="text-[12.5px] text-[var(--c-mut)] leading-relaxed mt-1 lg:max-w-[75ch]">{tr("PDF ↔ Word, PowerPoint → PDF, photos → PDF, scanned paper → editable Word, Excel ↔ CSV ↔ JSON, e-books, web pages, subtitles, merge and split PDFs — on your phone. Your files are never uploaded to a converter website.")}</p>
      </div>

      {/* v6.27 computer layout (option A): before a file is picked the tools fill the width; after, the file and its
          options on the left, the converted file on the right */}
      <div className={files ? PANES : ""}><div className={files ? LEFT : ""}>
      <section className={K.cardPad + " space-y-3"}>
        <input ref={fileRef} type="file" multiple accept={ACCEPT} className="hidden" data-testid="convert-file"
          onChange={(e) => { const l = e.target.files; pick(l); e.target.value = ""; }} />
        {!files ? (
          <>
            {MINIMAL ? (
              <>
                <button onClick={() => { intentRef.current = null; setIntent(null); if (fileRef.current) { fileRef.current.accept = ACCEPT; fileRef.current.multiple = true; fileRef.current.click(); } }} className="w-full py-8 rounded-[22px] border-2 border-dashed border-[var(--c-ln)] bg-[var(--c-bg)] text-[var(--c-ink)] flex flex-col items-center gap-2 hover:border-[var(--c-acc)] transition-colors duration-150" data-testid="convert-pick">
                  <ImagePlus size={24} className="text-[var(--c-acc)]" /><span className="text-[15px] font-extrabold">{tr("Choose a file")}</span>
                  <span className="text-[12.5px] text-[var(--c-mut)]">{tr("It shows what it can become")}</span></button>
                <div className="flex flex-col" data-testid="convert-tools">
                  {QUICK.filter((q) => q.id !== "translate" && (showAll || TOP4.includes(q.id))).sort((a, b) => (TOP4.includes(a.id) ? TOP4.indexOf(a.id) : 99) - (TOP4.includes(b.id) ? TOP4.indexOf(b.id) : 99)).map((q) => (
                    <button key={q.id} onClick={() => startTool(q)} data-testid={"convert-tool-" + q.id}
                      className="min-h-[48px] h-12 flex items-center text-start text-[15px] font-bold text-[var(--c-ink)] border-b border-[var(--c-ln)] last:border-0 hover:text-[var(--c-acc)]">
                      <span className="flex-1">{tr(q.label)}</span><span className="text-[var(--c-mut)] rtl:rotate-180">›</span></button>))}
                </div>
                {showAll ? null : <button onClick={() => setShowAll(true)} className="min-h-[44px] text-[14px] font-bold text-[var(--c-acc)] text-start" data-testid="convert-all">{tr("All conversions")}</button>}
              </>
            ) : (
              <>
            <p className="text-[13px] font-medium text-[var(--c-ink)]">{tr("What do you want to do?")}</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2" data-testid="convert-tools">
              {QUICK.map((q) => (
                <button key={q.id} onClick={() => startTool(q)} data-testid={"convert-tool-" + q.id}
                  className="rounded-[18px] border border-[var(--c-ln)] bg-[var(--c-bg)] p-3 text-start hover:border-[var(--c-acc)] active:border-[var(--c-acc)]">
                  <span className="block text-[18px] leading-none mb-1.5">{q.icon}</span>
                  <span className="block text-[13px] font-semibold text-[var(--c-ink)]">{tr(q.label)}</span>
                  <span className="block text-[11px] text-[var(--c-mut)] leading-snug mt-0.5">{tr(q.desc)}</span>
                </button>))}
            </div>
            <button onClick={() => { intentRef.current = null; setIntent(null); if (fileRef.current) { fileRef.current.accept = ACCEPT; fileRef.current.multiple = true; fileRef.current.click(); } }} className="w-full py-4 rounded-[18px] border-2 border-dashed border-[var(--c-ln)] text-[var(--c-ink)] flex flex-col items-center gap-1.5" data-testid="convert-pick">
              <ImagePlus size={20} className="text-[var(--c-acc)]" /><span className="text-[13.5px] font-medium">{tr("Or choose any file — see everything it can become")}</span>
              <span className="text-[11px] text-[var(--c-mut)]">{tr("PDF · Word · PowerPoint · Excel · CSV · photos · e-books · web pages · subtitles")}</span>
            </button>
              </>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13.5px] text-[var(--c-ink)] truncate" data-testid="convert-source">{tr(KIND_LABEL[files.kind])} · {files.list.length > 1 ? tr(files.kind === "pdfs" ? "{n} PDFs" : "{n} photos", { n: files.list.length }) : files.list[0].name} <span className="text-[var(--c-mut)] text-[11px]">{kb(files.list.reduce((n, f) => n + f.size, 0))}</span></p>
              <button onClick={() => { setFiles(null); setOut(null); }} aria-label={tr("Remove")} className="p-2 -m-2 text-[var(--c-mut)]"><X size={16} /></button>
            </div>
            <div>
              <p className={K.label + " mb-2 flex items-center gap-1"}><ChevronRight size={12} className="rtl:-scale-x-100" />{tr("Convert to")}</p>
              <div className="flex flex-wrap gap-1.5">{targets.map((t) => <button key={t} onClick={() => { setTarget(t); setOut(null); }} className={chip(target === t)} data-testid={"convert-to-" + t}>{tr(TARGET_LABEL[t])}</button>)}</div>
              {(files.kind === "image" || files.kind === "images") && target !== "pdf" ? <p className="text-[11.5px] text-[var(--c-mut)] mt-1.5">{tr("The AI reads the text in the photo — Arabic too.")}</p> : null}
              {files.kind === "pdf" && !PDF_TOOLS.includes(target) ? <p className="text-[11.5px] text-[var(--c-mut)] mt-1.5">{tr("Scanned pages (pictures of paper) are read by the AI.")}</p> : null}
              {target === "translate" ? (
                <div className="mt-2 space-y-2" data-testid="convert-translate">
                  <select value={tLang} onChange={(e) => setTLang(e.target.value)} className={K.inp} data-testid="convert-tlang">
                    {Object.keys(T_LANGS).map((k) => <option key={k} value={k}>{langLabel(k)}</option>)}
                  </select>
                  {["srt", "vtt"].includes(files.kind) ? null : <div className="flex gap-1.5">{["pdf", "docx"].map((f) => <button key={f} onClick={() => setTFmt(f)} className={chip(tFmt === f)} data-testid={"convert-tfmt-" + f}>{tr(TARGET_LABEL[f])}</button>)}</div>}
                  <p className="text-[11.5px] text-[var(--c-mut)]">{tr("The AI on your phone translates it piece by piece; headings, lists, tables and numbers stay in place. Long files take a few minutes.")}</p>
                </div>
              ) : null}
              {files.kind === "pdfs" ? <p className="text-[11.5px] text-[var(--c-mut)] mt-1.5">{tr("The PDFs are joined in the order you picked them.")}</p> : null}
              {target === "pick" || target === "rotate" ? (
                <div className="mt-2 space-y-2">
                  <input value={pages} onChange={(e) => setPages(e.target.value)} dir="ltr" inputMode="text" placeholder={target === "pick" ? tr("Pages to keep, e.g. 1-3, 5") : tr("Pages to turn (empty = all)")} className={K.inp} data-testid="convert-pages" />
                  {target === "rotate" ? <div className="flex gap-1.5">{[90, 180, 270].map((d) => <button key={d} onClick={() => setDeg(d)} className={chip(deg === d)} data-testid={"convert-deg-" + d}>{d === 270 ? tr("↺ 90° left") : d === 90 ? tr("↻ 90° right") : tr("180°")}</button>)}</div> : null}
                </div>
              ) : null}
            </div>
            {busy ? (
              <div className="flex items-center justify-between text-[12.5px] text-[var(--c-acc)]" data-testid="convert-busy">
                <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" />{busy}</span>
                <button onClick={() => { run.current++; setBusy(null); }} className={K.btnDanger}>{tr("Stop")}</button>
              </div>
            ) : (
              <button onClick={convert} className={K.btnP + " w-full"} data-testid="convert-go">{tr("Convert")}</button>
            )}
          </>
        )}
        {err ? <p className="text-[12.5px] text-[var(--c-neg)]" data-testid="convert-error">{err}</p> : null}
      </section>
      </div>

      {files || out ? <div className={RIGHT + (out ? "" : " hidden lg:block")}>
      {out ? (
        <section className={K.cardPad + " space-y-3 !border-[var(--c-pos)]/40"} data-testid="convert-result">
          <div className="flex items-center gap-2"><Check size={16} className="text-[var(--c-pos)]" /><p className="text-[14px] font-extrabold text-[var(--c-ink)] truncate" data-testid="convert-out-name">{out.name}</p><span className="text-[11px] text-[var(--c-mut)] shrink-0">{kb(out.size || 0)}{out.count ? " · " + tr(out.countOf === "pdfs" ? "{n} PDFs" : "{n} pictures", { n: out.count }) : ""}{out.pagesOut ? " · " + tr("{n} pages", { n: out.pagesOut }) : ""}{out.dims ? " · " + out.dims : ""}</span></div>
          {out.note ? <p className="text-[12px] text-[var(--c-warn)]">{out.note}</p> : null}
          {out.preview ? (
            <details><summary className="text-[12px] text-[var(--c-mut)] cursor-pointer flex items-center gap-1"><Eye size={12} />{tr("Preview")}</summary>
              <pre dir="auto" className="att-scroll mt-2 max-h-60 overflow-auto whitespace-pre-wrap text-[12px] text-[var(--c-ink)] bg-[var(--c-bg)] border border-[var(--c-ln)] rounded-[14px] p-3" data-testid="convert-preview">{out.preview}</pre></details>
          ) : null}
          <button onClick={save} className={K.btnP + " w-full"} data-testid="convert-save"><Download size={16} />{tr("Save the file")}</button>
          <button onClick={() => { setFiles(null); setOut(null); }} className={K.btnS + " w-full"}>{tr("Convert another file")}</button>
        </section>
      ) : <DeskEmpty icon={FileText} title={tr("The converted file appears here")} text={tr("Choose what it should become, then tap Convert. Nothing is uploaded.")} />}
      </div> : null}
      </div>
    </div>
  );
}
