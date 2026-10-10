/* ---- «علّم نموذجك» · My packs (v6.16, Ali picked design B + C's chat button) ----------------------------------------------------------
   Each pack is a card (on/off, add to it, share, delete). "New pack" opens a sheet: a name, then chats (some or all), files / a folder
   / a .zip of notes, or pasted text. "Import a pack" reads a file someone shared. The logic is teach.js (tested in v727teach); this
   file is the screen. The model is not retrained: it reads the pack when it answers, like the public packs.                          */
import React, { useState, useEffect } from "react";
import { Plus, Share2, Trash2, Upload, MessageSquare, ClipboardPaste, Folder, Package } from "lucide-react";
import { tr } from "./i18n.js";
import * as T from "./teach.js";
import { loadChats } from "./chat.jsx";

const btn = "px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-40 inline-flex items-center justify-center gap-1.5 min-h-[40px]";
const primary = btn + " bg-teal-500 text-slate-950";
const ghost = btn + " border border-slate-700 text-slate-200";
const card = "rounded-xl border border-slate-800 bg-slate-900/60 p-3";
const OFF_KEY = "attune:knowledge:off";

/** The packs switched off (kept on the phone, not looked up). */
export function loadOffPacks() { try { return new Set(JSON.parse(localStorage.getItem(OFF_KEY) || "[]")); } catch (e) { return new Set(); } }
function saveOffPacks(set) { try { localStorage.setItem(OFF_KEY, JSON.stringify([...set])); } catch (e) {} }

/** Teaching one chat to a pack (the chat's «علّم هذا لنموذجي» button). */
export async function teachChat(knowledge, chat, packName) {
  return T.teach(knowledge, [T.chatToSource(chat, packName)]);
}

function Sheet({ knowledge, start, onClose, onDone, flash, readOther }) {
  const [name, setName] = useState(start || "");
  const [mode, setMode] = useState(null);           // "chats" | "paste"
  const [picked, setPicked] = useState(new Set());
  const [paste, setPaste] = useState({ title: "", text: "" });
  const [busy, setBusy] = useState("");
  const chats = mode === "chats" ? loadChats().filter((c) => (c.messages || []).some((m) => m.role === "assistant")) : [];
  const ready = name.trim().length > 0;
  const go = async (sources) => {
    if (!sources.length) { flash && flash(tr("Nothing to add")); return; }
    setBusy(tr("Teaching… {a}/{b}", { a: 0, b: sources.length }));
    const r = await T.teach(knowledge, sources, (a, b) => setBusy(tr("Teaching… {a}/{b}", { a, b })));
    setBusy("");
    flash && flash(tr("“{n}” learned {s} sources ({p} passages)", { n: name.trim(), s: r.added, p: r.passages }));
    onDone();
  };
  const fromFiles = async (files) => {
    if (!files || !files.length) return;
    setBusy(tr("Reading the files…"));
    const { sources, skipped } = await T.filesToSources([...files], name.trim(), readOther);
    if (skipped.length) flash && flash(tr("Skipped {n} files that aren't text", { n: skipped.length }));
    await go(sources);
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={onClose} data-testid="teach-sheet">
      <div className="w-full max-w-2xl mx-auto rounded-t-2xl bg-slate-900 border-t border-slate-700 p-4 space-y-3 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <p className="text-[15px] font-semibold text-slate-100">{start ? tr("Add to “{n}”", { n: start }) : tr("New pack")}</p>
        {!start ? (
          <label className="block text-[12px] text-slate-400">{tr("Pack name")}
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("For example: Crane workshop")} dir="auto" data-testid="teach-name"
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2.5 text-[14px] text-slate-100" /></label>) : null}
        <div className="grid grid-cols-3 gap-2">
          <button className={ghost + " flex-col h-16"} disabled={!ready || !!busy} onClick={() => setMode(mode === "chats" ? null : "chats")} data-testid="teach-chats"><MessageSquare size={16} />{tr("Chats")}</button>
          <label className={ghost + " flex-col h-16 cursor-pointer" + (!ready || busy ? " opacity-40 pointer-events-none" : "")}><Upload size={16} />{tr("Files / folder")}
            <input type="file" multiple className="hidden" data-testid="teach-files" accept=".md,.markdown,.txt,.csv,.json,.html,.htm,.pdf,.docx,.pptx,.odt,.epub,.rtf,.zip,text/*,application/pdf,application/zip"
              onChange={(e) => { const f = e.target.files; fromFiles(f).finally(() => { e.target.value = ""; }); }} /></label>
          <button className={ghost + " flex-col h-16"} disabled={!ready || !!busy} onClick={() => setMode(mode === "paste" ? null : "paste")} data-testid="teach-paste"><ClipboardPaste size={16} />{tr("Pasted text")}</button>
        </div>
        <label className={"text-[12px] text-teal-300 inline-flex items-center gap-1.5 cursor-pointer" + (!ready || busy ? " opacity-40 pointer-events-none" : "")}><Folder size={14} />{tr("Pick a whole folder")}
          <input type="file" className="hidden" webkitdirectory="" directory="" multiple data-testid="teach-folder" onChange={(e) => { const f = e.target.files; fromFiles(f).finally(() => { e.target.value = ""; }); }} /></label>
        {mode === "chats" ? (
          <div className="space-y-1 max-h-60 overflow-y-auto border border-slate-800 rounded-lg p-2" data-testid="teach-chat-list">
            <button className="text-[12px] text-teal-300 py-1" onClick={() => setPicked(picked.size === chats.length ? new Set() : new Set(chats.map((c) => c.id)))}>{picked.size === chats.length ? tr("Clear") : tr("All my chats ({n})", { n: chats.length })}</button>
            {chats.map((c) => (
              <label key={c.id} className="flex items-center gap-2 min-h-[40px] text-[13px] text-slate-200">
                <input type="checkbox" className="w-5 h-5 accent-teal-500" checked={picked.has(c.id)} onChange={() => { const n = new Set(picked); n.has(c.id) ? n.delete(c.id) : n.add(c.id); setPicked(n); }} />
                <span className="truncate" dir="auto">{c.title || tr("Chat")}</span></label>))}
            {!chats.length ? <p className="text-[12px] text-slate-500">{tr("No chats yet.")}</p> : null}
            <button className={primary + " w-full"} disabled={!picked.size || !!busy} data-testid="teach-chats-go"
              onClick={() => go(chats.filter((c) => picked.has(c.id)).map((c) => T.chatToSource(c, name.trim())))}>{tr("Teach {n} chats", { n: picked.size })}</button>
          </div>) : null}
        {mode === "paste" ? (
          <div className="space-y-2">
            <input value={paste.title} onChange={(e) => setPaste({ ...paste, title: e.target.value })} placeholder={tr("Title")} dir="auto"
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-[13px] text-slate-100" />
            <textarea value={paste.text} onChange={(e) => setPaste({ ...paste, text: e.target.value })} rows={6} placeholder={tr("Paste the text here…")} dir="auto" data-testid="teach-paste-text"
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-[13px] text-slate-100" />
            <button className={primary + " w-full"} disabled={!paste.text.trim() || !!busy} data-testid="teach-paste-go"
              onClick={() => go([{ id: "text:" + name.trim() + ":" + Date.now(), kind: "text", title: paste.title.trim() || paste.text.trim().split("\n")[0].slice(0, 60), text: paste.text, collection: name.trim() }])}>{tr("Teach it")}</button>
          </div>) : null}
        {busy ? <p className="text-[12px] text-teal-300" data-testid="teach-busy">{busy}</p> : null}
        <button className={ghost + " w-full"} onClick={onClose}>{tr("Close")}</button>
      </div>
    </div>);
}

export function MyPacks({ knowledge, flash, saveFile, readOther }) {
  const [packs, setPacks] = useState([]);
  const [off, setOff] = useState(loadOffPacks);
  const [sheet, setSheet] = useState(null);          // { start: name | "" }
  const refresh = async () => { try { setPacks(await T.myPacks(knowledge)); } catch (e) {} };
  useEffect(() => { refresh(); }, []);
  const toggle = (name) => {
    const n = new Set(off); n.has(name) ? n.delete(name) : n.add(name);
    setOff(n); saveOffPacks(n); knowledge.offPacks = n; knowledge.invalidate();
  };
  const share = async (name) => {
    const json = JSON.stringify(await T.exportPack(knowledge, name));
    const file = name.replace(/[\\/:*?"<>|]+/g, " ").trim() + ".attune-pack.json";
    try {
      if (saveFile) { await saveFile(file, json, "application/json"); flash && flash(tr("Saved “{f}” — send it to anyone with Attune", { f: file })); return; }
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([json], { type: "application/json" })); a.download = file;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (e) { flash && flash(String((e && e.message) || e).slice(0, 160)); }
  };
  const drop = async (name) => {
    if (!window.confirm(tr("Delete the pack “{n}”? Its chats and files stay in the app; only what the model learned from them is removed.", { n: name }))) return;
    await T.removePack(knowledge, name); refresh();
  };
  const importFile = async (f) => {
    if (!f) return;
    try {
      const { name, sources } = T.importPack(await f.text());
      const r = await T.teach(knowledge, sources);
      flash && flash(tr("Imported “{n}”: {s} sources", { n: name, s: r.added })); refresh();
    } catch (e) { flash && flash(tr(String((e && e.message) || e).slice(0, 160))); }
  };
  return (
    <div className={card + " space-y-3"} data-testid="my-packs">
      <div>
        <p className="text-[15px] font-semibold text-slate-100">{tr("My packs")}</p>
        <p className="text-[12px] text-slate-400">{tr("Knowledge packs you make from your chats and files — the model reads them when it answers, like the public packs.")}</p>
      </div>
      {packs.map((p) => (
        <div key={p.name} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 space-y-2" data-testid="my-pack">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0"><p className="text-[14px] font-semibold text-slate-100 truncate" dir="auto">{p.name}</p>
              <p className="text-[11.5px] text-slate-400">{tr("{c} chats · {f} files · {p} passages", { c: p.chats, f: p.files, p: p.chunks })}</p></div>
            <button role="switch" aria-checked={!off.has(p.name)} onClick={() => toggle(p.name)} data-testid="my-pack-switch"
              aria-label={off.has(p.name) ? tr("Off") : tr("On")}
              className={"shrink-0 w-11 h-6 rounded-full relative transition " + (!off.has(p.name) ? "bg-teal-500" : "bg-slate-700")}>
              <span className={"absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all " + (!off.has(p.name) ? "start-[1.375rem]" : "start-0.5")} /></button>
          </div>
          <div className="flex gap-2">
            <button className={ghost + " flex-1"} onClick={() => setSheet({ start: p.name })} data-testid="my-pack-add"><Plus size={14} />{tr("Add to it")}</button>
            <button className={ghost + " flex-1"} onClick={() => share(p.name)} data-testid="my-pack-share"><Share2 size={14} />{tr("Share")}</button>
            <button className={ghost} onClick={() => drop(p.name)} aria-label={tr("Delete the pack")} data-testid="my-pack-delete"><Trash2 size={14} className="text-rose-400" /></button>
          </div>
        </div>))}
      {!packs.length ? <p className="text-[12px] text-slate-500" data-testid="my-packs-empty">{tr("No packs yet. Make one from your chats, notes or Markdown files.")}</p> : null}
      <div className="flex gap-2">
        <button className={primary + " flex-1"} onClick={() => setSheet({ start: "" })} data-testid="my-pack-new"><Plus size={14} />{tr("New pack")}</button>
        <label className={ghost + " flex-1 cursor-pointer"}><Package size={14} />{tr("Import a pack")}
          <input type="file" className="hidden" accept=".json,application/json" data-testid="my-pack-import" onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; importFile(f); }} /></label>
      </div>
      {sheet ? <Sheet knowledge={knowledge} start={sheet.start} flash={flash} readOther={readOther} onClose={() => setSheet(null)} onDone={() => { setSheet(null); refresh(); }} /> : null}
    </div>);
}
