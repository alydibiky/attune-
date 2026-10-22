/* ---- Knowledge («معرفة») screen (v6.20): the sources Chat looks facts up in --------------------------------------------------------
   On/off switch, what is stored and how big it is, add pasted text or a file (text, Markdown, PDF, Word…), Mind notes (live), public
   packs to download (Egypt basics), remove, rebuild. The logic is knowledge.js (tested); this file is the screen.                   */
import React, { useState, useEffect, useRef } from "react";
import { Upload, ClipboardPaste, Trash2, RefreshCw, Download, Brain, FileText, Globe } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import * as K from "./knowledge.js";
import * as C from "./convert.js";
import { MyPacks } from "./teach-ui.jsx";
import { PANES } from "./desk.jsx";

const btn = "px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-40 inline-flex items-center gap-1.5";
const primary = btn + " bg-[var(--c-acc)] text-[var(--c-on-acc)]";
const ghost = btn + " border border-[var(--c-ln)] text-[var(--c-ink)]";
const card = "rounded-xl border border-[var(--c-ln)] bg-[var(--c-surf)] p-3";
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

const STALL_MS = () => (typeof window !== "undefined" && window.__attuneStallMs) || 120000;   // no progress for this long = the download is stuck (tests shorten it)

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
  // v6.16: the public packs live on the phone as search databases (KnowPacks.kt)
  const N = typeof window !== "undefined" ? window.AttuneNative : null;
  const readPacks = () => { try { return (JSON.parse(N.knowPacks()).packs) || []; } catch (e) { return []; } };
  const [phonePacks, setPhonePacks] = useState(() => (N && N.knowPacks ? readPacks() : []));
  const [packErr, setPackErr] = useState(null);       // {id, msg}: shown on the pack's card, not only in a passing note
  // packs the app downloads by itself appear as «ready» while this page is open
  useEffect(() => { if (!N || !N.knowPacks) return; const t = setInterval(() => setPhonePacks(readPacks()), 5000); return () => clearInterval(t); }, []);
  const getPack = async (p) => {
    if (!nativeCall || !N || !N.knowInstall) return;
    setPackBusy({ id: p.id, pct: 0, detail: "" }); setPackErr(null);
    // Ali: "it keeps loading only" — a download that stops moving for 2 minutes is stopped and says so (it resumes on the next tap)
    let last = Date.now(), timer = null;
    try {
      const call = nativeCall("knowInstall", { id: p.id }, (pct, stage, detail) => { last = Date.now(); setPackBusy({ id: p.id, pct, detail: detail || "" }); });
      const callId = typeof window !== "undefined" && window.__attuneNativeLastId ? window.__attuneNativeLastId() : null;
      const stalled = new Promise((_, rej) => { timer = setInterval(() => { if (Date.now() - last > STALL_MS()) { try { callId && N.cancel && N.cancel(callId); } catch (e) {} rej(new Error(tr("The download stopped moving. Check the connection and tap Download — it continues where it stopped."))); } }, 2000); });
      await Promise.race([call, stalled]);
      if (p.legacy) await K.removeKnowPack(knowledge, p.id);            // the old in-page copy, if any
      setPhonePacks(readPacks());
      flash && flash(tr("“{n}” is ready", { n: ar ? p.name_ar : p.name }));
    } catch (e) { const msg = String((e && e.message) || e).slice(0, 160); setPackErr({ id: p.id, msg }); }
    finally { clearInterval(timer); setPackBusy(null); refresh(); }
  };
  const dropPack = (p) => {
    if (!window.confirm(tr("Remove “{t}” from Knowledge?", { t: ar ? p.name_ar : p.name }))) return;
    try { N.knowRemove(p.id); } catch (e) {}
    setPhonePacks(readPacks());
  };

  // packs are shown once (not one row per shard)
  const packIds = new Set(rows.filter((r) => r.pack).map((r) => r.pack));
  const own = rows.filter((r) => !r.pack && !r.collection);   // sources in one of "My packs" are shown there
  const live = knowledge.adapterRows();
  const packInfo = (id) => { try { return JSON.parse(localStorage.getItem("attune:knowledge:pack:" + id) || "null"); } catch (e) { return null; } };

  return (
    <div className="max-w-2xl lg:max-w-none mx-auto px-4 py-4 space-y-3" data-testid="knowledge">
      {/* v6.27 computer layout: the switch and adding on the left, what is stored and the packs on the right */}
      <div className={PANES}><div className="space-y-3 min-w-0 lg:sticky lg:top-4">
      <div className={card + " space-y-2"}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[14px] font-semibold text-[var(--c-ink)]">{tr("Use Knowledge in Chat")}</p>
            <p data-intro="" className="text-[12px] text-[var(--c-mut)]">{tr("When you ask for a fact, Chat first looks it up in your sources and shows which one it used.")}</p>
          </div>
          <button role="switch" aria-checked={on} onClick={() => setOn(!on)} data-testid="kn-switch"
            className={"shrink-0 w-11 h-6 rounded-full relative transition " + (on ? "bg-[var(--c-acc)]" : "bg-[var(--c-surf-2)]")}>
            <span className={"absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all " + (on ? "start-[1.375rem]" : "start-0.5")} /></button>
        </div>
        <p className="text-[12.5px] text-[var(--c-ink)]" data-testid="kn-stats">{tr("{mb} — {c} passages from {s} sources", { mb: mb(stats.bytes), c: stats.chunks, s: stats.sources })}</p>
        <p data-intro="" className="text-[11.5px] text-[var(--c-mut)]">{tr("What you get: small models answer facts from your sources correctly (in our test, 31 → 99 of 104 for the smallest model). Looking up takes under a tenth of a second and nothing leaves the phone.")}</p>
      </div>

      <MyPacks knowledge={knowledge} flash={flash} readOther={(f) => readSourceFile(f, nativeCall)}
        saveFile={nativeCall && typeof window !== "undefined" && window.AttuneNative ? (name, text, mime) => nativeCall("saveFile", { name, mime, text }) : null} />

      <div className={card + " space-y-2"}>
        <p className="text-[13px] font-semibold text-[var(--c-ink)]">{tr("Add a source")}</p>
        <div className="flex flex-wrap gap-2">
          <button className={ghost} onClick={() => setPaste({ title: "", text: "" })} data-testid="kn-paste"><ClipboardPaste size={14} />{tr("Paste text")}</button>
          <label className={ghost + " cursor-pointer"}><Upload size={14} />{tr("Add a file")}
            <input type="file" className="hidden" data-testid="kn-file" accept=".txt,.md,.markdown,.csv,.pdf,.docx,.pptx,.odt,.epub,.html,.htm,.rtf,text/*,application/pdf"
              onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; addFile(f); }} /></label>
        </div>
        <p data-intro="" className="text-[11.5px] text-[var(--c-mut)]">{tr("Text, Markdown, PDF or Word. In Ask a PDF, “Add to Knowledge” keeps the document you opened.")}</p>
        {paste ? (
          <div className="space-y-2">
            <input value={paste.title} onChange={(e) => setPaste({ ...paste, title: e.target.value })} placeholder={tr("Title (for example: Villa rules)")} data-testid="kn-paste-title" dir="auto"
              className="w-full rounded-lg bg-[var(--c-bg)] border border-[var(--c-ln)] px-3 py-2 text-[13px] text-[var(--c-ink)]" />
            <textarea value={paste.text} onChange={(e) => setPaste({ ...paste, text: e.target.value })} rows={6} placeholder={tr("Paste the text here…")} data-testid="kn-paste-text" dir="auto"
              className="w-full rounded-lg bg-[var(--c-bg)] border border-[var(--c-ln)] px-3 py-2 text-[13px] text-[var(--c-ink)]" />
            <div className="flex gap-2">
              <button className={primary} disabled={!paste.text.trim() || !!busy} data-testid="kn-paste-save"
                onClick={async () => { const p = paste; setPaste(null); await add({ kind: "text", title: p.title.trim() || p.text.trim().split("\n")[0].slice(0, 60), text: p.text }); }}>{tr("Save")}</button>
              <button className={ghost} onClick={() => setPaste(null)}>{tr("Cancel")}</button>
            </div>
          </div>) : null}
        {busy ? <p className="text-[12px] text-[var(--c-acc)]" data-testid="kn-busy">{busy}</p> : null}
      </div>
      </div>
      <div className="space-y-3 mt-3 lg:mt-0 min-w-0">

      <div className={card + " space-y-1"}>
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold text-[var(--c-ink)]">{tr("Your sources")}</p>
          <button className={ghost} onClick={rebuild} data-testid="kn-rebuild"><RefreshCw size={13} />{tr("Rebuild index")}</button>
        </div>
        {live.map((r) => (
          <div key={r.id} className="flex items-center gap-2 py-2 border-b border-[var(--c-ln)]" data-testid="kn-live">
            <Brain size={15} className="text-[var(--c-acc)]" />
            <div className="flex-1 min-w-0"><p className="text-[13px] text-[var(--c-ink)] truncate">{tr(r.title)}</p>
              <p className="text-[11px] text-[var(--c-mut)]">{adapterOn[r.kind] === false ? tr("Not used") : tr("{c} notes · {mb} · read live", { c: r.chunks, mb: mb(r.bytes) })}</p></div>
            <button className={ghost} onClick={() => setAdapterOn(r.kind, adapterOn[r.kind] === false)} data-testid={"kn-live-" + r.kind}>{adapterOn[r.kind] === false ? tr("Use") : tr("Don't use")}</button>
          </div>))}
        {own.map((s) => (
          <div key={s.id} className="flex items-center gap-2 py-2 border-b border-[var(--c-ln)]" data-testid="kn-source">
            <FileText size={15} className="text-[var(--c-acc)]" />
            <div className="flex-1 min-w-0"><p className="text-[13px] text-[var(--c-ink)] truncate" dir="auto">{s.title}</p>
              <p className="text-[11px] text-[var(--c-mut)]">{tr(KIND[s.kind] || "Note")} · {mb(s.bytes)} · {tr("{c} passages", { c: s.chunks })}{s.pages ? " · " + tr("{p} pages", { p: s.pages }) : ""}</p></div>
            <button onClick={() => remove(s)} className="p-2 text-[var(--c-mut)]" aria-label={tr("Remove")} data-testid="kn-remove"><Trash2 size={15} /></button>
          </div>))}
        {!own.length && !live.some((r) => r.chunks) ? <p className="text-[12px] text-[var(--c-mut)] py-2" data-testid="kn-empty">{tr("Nothing here yet — paste a text or add a file.")}</p> : null}
      </div>

      <div className={card + " space-y-2"}>
        <p className="text-[13px] font-semibold text-[var(--c-ink)]">{tr("Public packs")}</p>
        <p data-intro="" className="text-[12px] text-[var(--c-mut)]">{tr("Chat looks these up before it answers, and shows the source. They download by themselves when you are online and stay up to date.")}</p>
        {K.CATALOG.map((p) => {
          const got = phonePacks.find((x) => x.id === p.id), b = packBusy && packBusy.id === p.id ? packBusy : null;
          return (
            <div key={p.id} className="space-y-1.5 border-t border-[var(--c-ln)] pt-2" data-testid={"kn-pack-" + p.id}>
              <div className="flex items-center gap-2"><Globe size={15} className="text-[var(--c-acc)]" />
                <p className="flex-1 text-[13px] text-[var(--c-ink)]">{ar ? p.name_ar : p.name}{got ? " · " + mb(got.size || 0) : ""}</p>
                {got ? <span className="text-[11px] text-[var(--c-pos)]">{tr("ready")}</span> : null}</div>
              <p data-intro="" className="text-[12px] text-[var(--c-mut)]">{ar ? p.about_ar : p.about}</p>
              <p className="text-[11px] text-[var(--c-mut)]" data-testid={"kn-pack-lic-" + p.id}>{ar ? p.size_ar : p.size}{got && got.built ? " · " + tr("updated {d}", { d: got.built }) : ""}</p>
              {p.notice ? <p className="text-[11px] text-[var(--c-warn)]">{ar ? p.notice_ar : p.notice}</p> : null}
              {b ? (
                <div data-testid={"kn-pack-progress-" + p.id}><div className="h-2 rounded bg-[var(--c-surf-2)] overflow-hidden"><div className="h-full bg-[var(--c-acc)] transition-[width]" style={{ width: Math.max(3, b.pct || 0) + "%" }} /></div>
                  <p className="text-[11px] text-[var(--c-mut)] mt-1 tabular-nums">{b.detail ? (b.pct || 0) + "% · " + b.detail : tr("Connecting…")}</p></div>
              ) : (
                <div className="flex gap-2">
                  {!got ? <button className={primary} disabled={!N || !N.knowInstall} onClick={() => getPack(p)} data-testid={"kn-pack-get-" + p.id}><Download size={13} />{tr("Download")}</button> : null}
                  {got ? <button className={ghost} onClick={() => dropPack(p)} data-testid={"kn-pack-rm-" + p.id}><Trash2 size={13} />{tr("Remove")}</button> : null}
                </div>)}
              {packErr && packErr.id === p.id && !b ? <p className="text-[11.5px] text-[var(--c-warn)]" data-testid={"kn-pack-err-" + p.id}>{packErr.msg}</p> : null}
              {(!N || !N.knowInstall) && !got ? <p className="text-[11px] text-[var(--c-mut)]">{tr("Downloads work in the Android app.")}</p> : null}
            </div>);
        })}
        {/* Ali: naming every source on the cards looks less professional — the credits the licences ask for live here, once */}
        <details className="pt-2 border-t border-[var(--c-ln)]" data-testid="kn-credits">
          <summary className="text-[11.5px] text-[var(--c-mut)] cursor-pointer select-none">{tr("Sources & licences")}</summary>
          <ul className="mt-2 space-y-1">
            {K.CATALOG.map((p) => <li key={p.id} className="text-[11px] text-[var(--c-mut)] leading-relaxed"><span className="text-[var(--c-mut)]">{ar ? p.name_ar : p.name}</span> — {ar ? p.license_ar : p.license}</li>)}
          </ul>
        </details>
      </div>
      </div></div>
    </div>
  );
}
