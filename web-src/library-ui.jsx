/* ---- v6.46 "Remember" — your own library (Ali, 21 Oct: users upload something for Attune to remember; Chat answers from it —
   "what happens in this chapter"). Add a book or document (PDF, Word, EPUB, text…), a web page (the news), or pasted text; it is
   kept on the phone in the store Chat looks facts up in (collection "mine"), with its chapters found by code (library.js).
   Knowledge packs stay Ali's (developer mode); this is the person's own. Tests: e2e_v746library.py.                        */
import React, { useEffect, useRef, useState } from "react";
import { BookOpen, Upload, ClipboardPaste, Link2, Trash2, MessageCircle, Loader2, ShieldCheck } from "lucide-react";
import { tr, getLang, dateLocale } from "./i18n.js";
import * as L from "./library.js";
import { readSourceFile } from "./knowledge-ui.jsx";
import { askConfirm } from "./confirm.jsx";

const joinPages = (src) => (src.pages ? src.pages.map((p) => p.text).join("\n\n") : String(src.text || ""));

export function LibraryPage({ knowledge, nativeCall, flash, askChat }) {
  const ar = getLang() === "ar";
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState("");
  const [paste, setPaste] = useState(null);     // { title, text }
  const [link, setLink] = useState(null);       // the address being typed
  const fileRef = useRef(null);
  const load = async () => { try { setRows((await knowledge.sources()).filter((s) => s.collection === L.MINE)); } catch (e) { setRows([]); } };
  useEffect(() => { load(); }, []);
  const keep = async (src) => {
    const text = joinPages(src), chapters = L.chaptersOf(text).length;
    const r = await knowledge.add({ ...src, collection: L.MINE, chapters });
    flash && flash(chapters ? tr("Remembered “{t}” — {n} chapters. Ask Chat about it any time.", { t: src.title, n: chapters }) : tr("Remembered “{t}”. Ask Chat about it any time.", { t: src.title }));
    await load(); return r;
  };
  const addFiles = async (files) => {
    for (const f of [...(files || [])].slice(0, 10)) {
      setBusy(tr("Reading {f}…", { f: f.name }));
      try { await keep(await readSourceFile(f, nativeCall)); } catch (e) { flash && flash(String((e && e.message) || e).slice(0, 160)); }
    }
    setBusy("");
  };
  const addLink = async () => {
    const u = String(link || "").trim(); if (!/^https?:\/\//i.test(u)) { flash && flash(tr("Paste a web address that starts with https://")); return; }
    if (!nativeCall) { flash && flash(tr("Reading a web page works in the Android app")); return; }
    setBusy(tr("Reading the page…"));
    try { const r = await nativeCall("fetchText", u); const title = (String(r.text || "").split("\n").find((l) => l.trim().length > 8) || u).trim().slice(0, 90);
      await keep({ kind: "doc", title, text: r.text, url: u }); setLink(null); } catch (e) { flash && flash(String((e && e.message) || e).slice(0, 160)); }
    setBusy("");
  };
  const addPaste = async () => {
    if (!paste || String(paste.text || "").trim().length < 20) { flash && flash(tr("Paste at least a few lines")); return; }
    setBusy(tr("Saving…"));
    try { await keep({ kind: "text", title: (paste.title || "").trim() || String(paste.text).trim().split("\n")[0].slice(0, 60), text: paste.text }); setPaste(null); } catch (e) { flash && flash(String((e && e.message) || e)); }
    setBusy("");
  };
  const remove = async (s) => { if (!(await askConfirm("Forget this? Chat won't answer from it any more.", { yes: "Forget" }))) return; await knowledge.remove(s.id); load(); };
  const ask = (s) => askChat && askChat(s.chapters ? tr("In “{t}”, what happens in chapter 1?", { t: s.title.replace(/\.[a-z0-9]{2,4}$/i, "") }) : tr("In “{t}”, ", { t: s.title.replace(/\.[a-z0-9]{2,4}$/i, "") }));
  const btn = "inline-flex items-center gap-1.5 rounded-full px-3.5 h-10 text-[13.5px] font-semibold";
  const surf = { background: "var(--c-surf)", border: "1px solid var(--c-ln)", color: "var(--c-ink)" };
  return (
    <div className="calm rounded-2xl p-4 space-y-4" data-testid="library-page">
      <div><h2 className="text-[22px] font-bold m-0 flex items-center gap-2"><BookOpen size={20} className="c-acc" />{tr("Remember")}</h2>
        <p className="c-sub m-0">{tr("Give Attune a book, an article or the news to remember. Then ask Chat about it any time — even “what happens in chapter 3?”.")}</p></div>
      <div className="flex flex-wrap gap-2">
        <button className={btn} style={{ background: "var(--c-acc)", color: "#fff" }} disabled={!!busy} onClick={() => fileRef.current && fileRef.current.click()} data-testid="lib-add-file"><Upload size={15} />{tr("A book or file")}</button>
        <button className={btn} style={surf} disabled={!!busy} onClick={() => setLink(link == null ? "" : null)} data-testid="lib-add-link"><Link2 size={15} />{tr("A web page")}</button>
        <button className={btn} style={surf} disabled={!!busy} onClick={() => setPaste(paste ? null : { title: "", text: "" })} data-testid="lib-add-paste"><ClipboardPaste size={15} />{tr("Paste text")}</button>
        <input ref={fileRef} type="file" multiple accept=".pdf,.docx,.doc,.epub,.txt,.md,.html,.htm,.odt,.rtf,.pptx" className="hidden" data-testid="lib-file" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      </div>
      {link != null ? <div className="c-card space-y-2" data-testid="lib-link-box">
        <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" dir="ltr" className="w-full rounded-xl px-3 py-2.5 text-[14px] border bg-transparent" style={{ borderColor: "var(--c-ln)", color: "var(--c-ink)" }} data-testid="lib-link" />
        <button className="c-btn" onClick={addLink} disabled={!!busy} data-testid="lib-link-save">{tr("Remember this page")}</button></div> : null}
      {paste ? <div className="c-card space-y-2" data-testid="lib-paste-box">
        <input value={paste.title} onChange={(e) => setPaste({ ...paste, title: e.target.value })} placeholder={tr("A name (optional)")} dir="auto" className="w-full rounded-xl px-3 py-2.5 text-[14px] border bg-transparent" style={{ borderColor: "var(--c-ln)", color: "var(--c-ink)" }} data-testid="lib-paste-title" />
        <textarea value={paste.text} onChange={(e) => setPaste({ ...paste, text: e.target.value })} rows={6} dir="auto" placeholder={tr("Paste the article, the notes or the chapter here")} className="w-full rounded-xl px-3 py-2.5 text-[14px] border bg-transparent" style={{ borderColor: "var(--c-ln)", color: "var(--c-ink)" }} data-testid="lib-paste-text" />
        <button className="c-btn" onClick={addPaste} disabled={!!busy} data-testid="lib-paste-save">{tr("Remember it")}</button></div> : null}
      {busy ? <p className="c-sub m-0 flex items-center gap-2" data-testid="lib-busy"><Loader2 size={15} className="animate-spin" />{busy}</p> : null}
      <section className="space-y-2" data-testid="lib-list">
        <span className="c-lbl">{tr("What Attune remembers")}</span>
        {rows.length ? rows.map((s) => (
          <div key={s.id} className="c-card flex items-center gap-3" data-testid="lib-item">
            <span className="flex-1 min-w-0"><b className="block truncate text-[14.5px]" dir="auto">{s.title}</b>
              <span className="c-sub block text-[12.5px]">{[s.chapters ? tr("{n} chapters", { n: s.chapters }) : s.pages ? tr("{n} pages", { n: s.pages }) : "", new Date(s.added).toLocaleDateString(dateLocale(), { day: "numeric", month: "short" })].filter(Boolean).join(" · ")}</span></span>
            <button onClick={() => ask(s)} className="h-10 px-3 rounded-full inline-flex items-center gap-1.5 text-[13px] font-semibold" style={surf} data-testid="lib-ask"><MessageCircle size={14} className="c-acc" />{tr("Ask")}</button>
            <button onClick={() => remove(s)} aria-label={tr("Forget")} className="w-10 h-10 rounded-full grid place-items-center c-sub" data-testid="lib-remove"><Trash2 size={15} /></button>
          </div>)) : <p className="c-sub m-0" data-testid="lib-empty">{tr("Nothing yet. Add a book, an article or a page above.")}</p>}
      </section>
      <p className="c-sub text-[12px] m-0 flex items-center gap-1.5"><ShieldCheck size={13} />{tr("Kept on this phone only. Chat answers from it and says where.")}</p>
    </div>);
}
