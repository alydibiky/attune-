/* ---- Knowledge («معرفة») screen (v6.20): the sources Chat looks facts up in --------------------------------------------------------
   On/off switch, what is stored and how big it is, add pasted text or a file (text, Markdown, PDF, Word…), Mind notes (live), public
   packs to download (Egypt basics), remove, rebuild. The logic is knowledge.js (tested); this file is the screen.                   */
import React, { useState, useEffect, useRef } from "react";
import { Upload, ClipboardPaste, Trash2, RefreshCw, Download, Brain, FileText, Globe } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import * as K from "./knowledge.js";
import * as C from "./convert.js";

const btn = "px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-40 inline-flex items-center gap-1.5";
const primary = btn + " bg-teal-500 text-slate-950";
const ghost = btn + " border border-slate-700 text-slate-200";
const card = "rounded-xl border border-slate-800 bg-slate-900/60 p-3";
const mb = (b) => (b >= 1e6 ? (Math.round(b / 1e5) / 10) + " " + tr("MB") : Math.max(1, Math.round(b / 1e3)) + " " + tr("KB"));
const readB64 = (f) => new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] || ""); r.onerror = () => bad(new Error(tr("Couldn't read that file"))); r.readAsDataURL(f); });

/** A file → { title, text | pages } (the same readers Ask a PDF uses; scanned PDF pages without text are skipped). */
export async function readSourceFile(file, nativeCall) {
  const kind = C.kindOf(file.name, file.type);
  if (kind === "pdf") {
    if (!nativeCall) throw new Error(tr("PDF files are read by the Android app — open Attune on your phone."));
    const r = await nativeCall("pdfText", { b64: await readB64(file), textOnly: true });
    return { title: file.name, kind: "file", pages: r.pages.filter((p) => p.text && p.text.trim()).map((p) => ({ n: p.n, text: p.text })) };
  }
  const buf = async () => new Uint8Array(await file.arrayBuffer());
  let blocks;
  if (kind === "docx") blocks = (await C.docxRead(await buf())).blocks;
  else if (kind === "pptx") blocks = await C.pptxToBlocks(await buf());
  else if (kind === "odt") blocks = await C.odtToBlocks(await buf());
  else if (kind === "epub") blocks = await C.epubToBlocks(await buf());
  else if (kind === "html") blocks = C.htmlToBlocks(await file.text());
  else if (kind === "rtf") blocks = C.textToBlocks(C.rtfToText(await file.text()));
  else if (kind === "text" || /\.(md|markdown|txt|csv)$/i.test(file.name)) return { title: file.name, kind: "file", text: await file.text() };
  else throw new Error(tr("Pick a text, Markdown, PDF or Word file."));
  return { title: file.name, kind: "file", text: C.blocksToText(blocks) };
}

const KIND = { text: "Pasted text", file: "File", doc: "Document", pack: "Public pack", mind: "Mind notes", shelf: "Shelf notes" };

export function KnowledgePage({ knowledge, on, setOn, adapterOn, setAdapterOn, flash, nativeCall, packText }) {
  const ar = getLang() === "ar";
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({ sources: 0, chunks: 0, bytes: 0 });
  const [paste, setPaste] = useState(null);        // { title, text } while the paste box is open
  const [busy, setBusy] = useState("");
  const [packBusy, setPackBusy] = useState(null);
  const stop = useRef(false);
  const refresh = async () => {
    try { setRows(await knowledge.sources()); setStats(await knowledge.stats()); } catch (e) { flash && flash(String((e && e.message) || e).slice(0, 160)); }
  };
  useEffect(() => { refresh(); }, [adapterOn]);

  const add = async (src) => {
    setBusy(tr("Adding…"));
    try { const r = await knowledge.add(src); flash && flash(tr("Added to Knowledge: {n} passages", { n: r.chunks })); }
    catch (e) { flash && flash(tr(String((e && e.message) || e).slice(0, 160))); }
    finally { setBusy(""); refresh(); }
  };
  const addFile = async (f) => { if (!f) return; setBusy(tr("Reading the file…")); try { await add(await readSourceFile(f, nativeCall)); } catch (e) { setBusy(""); flash && flash(String((e && e.message) || e).slice(0, 160)); } };
  const remove = async (s) => {
    if (!window.confirm(tr("Remove “{t}” from Knowledge?", { t: s.title }))) return;
    if (s.pack) await K.removeKnowPack(knowledge, s.pack); else await knowledge.remove(s.id);
    refresh();
  };
  const rebuild = async () => { setBusy(tr("Rebuilding the index…")); const t = Date.now(); knowledge.invalidate(); await knowledge.ensure(); setBusy(""); flash && flash(tr("Index rebuilt in {s} ms", { s: Date.now() - t })); refresh(); };
  const getPack = async (p) => {
    if (!packText) return;
    stop.current = false; setPackBusy({ id: p.id, shard: 0, of: 1 });
    try {
      const man = JSON.parse(await packText(p.tag, "manifest.json"));
      await K.installKnowPack(knowledge, { manifest: man, getText: (name) => packText(p.tag, name), isStopped: () => stop.current, onProgress: (x) => setPackBusy({ id: p.id, ...x }) });
      try { localStorage.setItem("attune:knowledge:pack:" + p.id, JSON.stringify({ license: man.license, attribution: man.attribution, sources: man.sources, built: man.built })); } catch (e) {}
      flash && flash(tr("“{n}” is ready", { n: ar ? p.name_ar : p.name }));
    } catch (e) { flash && flash(String((e && e.message) || e).slice(0, 160)); }
    finally { setPackBusy(null); refresh(); }
  };

  // packs are shown once (not one row per shard)
  const packIds = new Set(rows.filter((r) => r.pack).map((r) => r.pack));
  const own = rows.filter((r) => !r.pack);
  const live = knowledge.adapterRows();
  const packInfo = (id) => { try { return JSON.parse(localStorage.getItem("attune:knowledge:pack:" + id) || "null"); } catch (e) { return null; } };

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-3" data-testid="knowledge">
      <div className={card + " space-y-2"}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[14px] font-semibold text-slate-100">{tr("Use Knowledge in Chat")}</p>
            <p className="text-[12px] text-slate-400">{tr("When you ask for a fact, Chat first looks it up in your sources and shows which one it used.")}</p>
          </div>
          <button role="switch" aria-checked={on} onClick={() => setOn(!on)} data-testid="kn-switch"
            className={"shrink-0 w-11 h-6 rounded-full relative transition " + (on ? "bg-teal-500" : "bg-slate-700")}>
            <span className={"absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all " + (on ? "start-[1.375rem]" : "start-0.5")} /></button>
        </div>
        <p className="text-[12.5px] text-slate-300" data-testid="kn-stats">{tr("{mb} — {c} passages from {s} sources", { mb: mb(stats.bytes), c: stats.chunks, s: stats.sources })}</p>
        <p className="text-[11.5px] text-slate-500">{tr("What you get: small models answer facts from your sources correctly (in our test, 31 → 99 of 104 for the smallest model). Looking up takes under a tenth of a second and nothing leaves the phone.")}</p>
      </div>

      <div className={card + " space-y-2"}>
        <p className="text-[13px] font-semibold text-slate-100">{tr("Add a source")}</p>
        <div className="flex flex-wrap gap-2">
          <button className={ghost} onClick={() => setPaste({ title: "", text: "" })} data-testid="kn-paste"><ClipboardPaste size={14} />{tr("Paste text")}</button>
          <label className={ghost + " cursor-pointer"}><Upload size={14} />{tr("Add a file")}
            <input type="file" className="hidden" data-testid="kn-file" accept=".txt,.md,.markdown,.csv,.pdf,.docx,.pptx,.odt,.epub,.html,.htm,.rtf,text/*,application/pdf"
              onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; addFile(f); }} /></label>
        </div>
        <p className="text-[11.5px] text-slate-500">{tr("Text, Markdown, PDF or Word. In Ask a PDF, “Add to Knowledge” keeps the document you opened.")}</p>
        {paste ? (
          <div className="space-y-2">
            <input value={paste.title} onChange={(e) => setPaste({ ...paste, title: e.target.value })} placeholder={tr("Title (for example: Villa rules)")} data-testid="kn-paste-title" dir="auto"
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-[13px] text-slate-100" />
            <textarea value={paste.text} onChange={(e) => setPaste({ ...paste, text: e.target.value })} rows={6} placeholder={tr("Paste the text here…")} data-testid="kn-paste-text" dir="auto"
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-[13px] text-slate-100" />
            <div className="flex gap-2">
              <button className={primary} disabled={!paste.text.trim() || !!busy} data-testid="kn-paste-save"
                onClick={async () => { const p = paste; setPaste(null); await add({ kind: "text", title: p.title.trim() || p.text.trim().split("\n")[0].slice(0, 60), text: p.text }); }}>{tr("Save")}</button>
              <button className={ghost} onClick={() => setPaste(null)}>{tr("Cancel")}</button>
            </div>
          </div>) : null}
        {busy ? <p className="text-[12px] text-teal-300" data-testid="kn-busy">{busy}</p> : null}
      </div>

      <div className={card + " space-y-1"}>
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold text-slate-100">{tr("Your sources")}</p>
          <button className={ghost} onClick={rebuild} data-testid="kn-rebuild"><RefreshCw size={13} />{tr("Rebuild index")}</button>
        </div>
        {live.map((r) => (
          <div key={r.id} className="flex items-center gap-2 py-2 border-b border-slate-800/70" data-testid="kn-live">
            <Brain size={15} className="text-violet-300" />
            <div className="flex-1 min-w-0"><p className="text-[13px] text-slate-100 truncate">{tr(r.title)}</p>
              <p className="text-[11px] text-slate-500">{adapterOn[r.kind] === false ? tr("Not used") : tr("{c} notes · {mb} · read live", { c: r.chunks, mb: mb(r.bytes) })}</p></div>
            <button className={ghost} onClick={() => setAdapterOn(r.kind, adapterOn[r.kind] === false)} data-testid={"kn-live-" + r.kind}>{adapterOn[r.kind] === false ? tr("Use") : tr("Don't use")}</button>
          </div>))}
        {own.map((s) => (
          <div key={s.id} className="flex items-center gap-2 py-2 border-b border-slate-800/70" data-testid="kn-source">
            <FileText size={15} className="text-teal-300" />
            <div className="flex-1 min-w-0"><p className="text-[13px] text-slate-100 truncate" dir="auto">{s.title}</p>
              <p className="text-[11px] text-slate-500">{tr(KIND[s.kind] || "Note")} · {mb(s.bytes)} · {tr("{c} passages", { c: s.chunks })}{s.pages ? " · " + tr("{p} pages", { p: s.pages }) : ""}</p></div>
            <button onClick={() => remove(s)} className="p-2 text-slate-400" aria-label={tr("Remove")} data-testid="kn-remove"><Trash2 size={15} /></button>
          </div>))}
        {!own.length && !live.some((r) => r.chunks) ? <p className="text-[12px] text-slate-500 py-2" data-testid="kn-empty">{tr("Nothing here yet — paste a text or add a file.")}</p> : null}
      </div>

      <div className={card + " space-y-2"}>
        <p className="text-[13px] font-semibold text-slate-100">{tr("Public packs")}</p>
        {K.CATALOG.map((p) => {
          const has = packIds.has(p.id), info = packInfo(p.id), mine = rows.filter((r) => r.pack === p.id), b = packBusy && packBusy.id === p.id ? packBusy : null;
          return (
            <div key={p.id} className="space-y-1.5" data-testid={"kn-pack-" + p.id}>
              <div className="flex items-center gap-2"><Globe size={15} className="text-sky-300" />
                <p className="flex-1 text-[13px] text-slate-100">{ar ? p.name_ar : p.name}{has ? " · " + mb(mine.reduce((a, x) => a + x.bytes, 0)) : ""}</p></div>
              <p className="text-[12px] text-slate-400">{ar ? p.about_ar : p.about}</p>
              {has && info ? <p className="text-[11px] text-slate-500" data-testid="kn-attrib">{tr("Licence")}: {info.license}{info.attribution ? " — " + info.attribution : ""}</p> : null}
              {b ? (
                <div className="space-y-1"><div className="h-2 rounded bg-slate-800 overflow-hidden"><div className="h-full bg-teal-500" style={{ width: Math.round((b.shard / Math.max(1, b.of)) * 100) + "%" }} /></div>
                  <button className={ghost} onClick={() => { stop.current = true; }}>{tr("Stop")}</button></div>
              ) : (
                <div className="flex gap-2">
                  {!has ? <button className={primary} disabled={!packText} onClick={() => getPack(p)} data-testid={"kn-pack-get-" + p.id}><Download size={13} />{tr("Download")}</button> : null}
                  {has ? <button className={ghost} onClick={() => remove({ pack: p.id, title: ar ? p.name_ar : p.name })}><Trash2 size={13} />{tr("Remove")}</button> : null}
                </div>)}
              {!packText && !has ? <p className="text-[11px] text-slate-500">{tr("Downloads work in the Android app.")}</p> : null}
            </div>);
        })}
      </div>
    </div>
  );
}
