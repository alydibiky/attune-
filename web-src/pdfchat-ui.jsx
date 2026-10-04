/* ---- Ask a PDF: a reader and a chat in one screen (v6.18) -----------------------------------------------------------------------------
   Open a PDF (or Word, PowerPoint, e-book, web page, text). It is read on the phone — scanned pages by the AI that can see — and cut
   into passages that remember their page. Then:
     · Chat: ask anything; the answer comes from the right pages only and shows them as [p. 12] chips you can tap.
     · Read: the real pages (pictures of them), page by page, with word search and jump-to-page.
   The logic is docqa.js (tested); this file is the screen.                                                                              */
import React, { useState, useEffect, useRef, useMemo } from "react";
import { Upload, Send, ChevronLeft, ChevronRight, Search, FileText, X, AlertTriangle, Copy, Trash2, Sparkles } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import { useSubBack } from "./backstack.js";
import * as Q from "./docqa.js";
import * as C from "./convert.js";

const btn = "px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-40";
const primary = btn + " bg-teal-500 text-slate-950";
const ghost = btn + " border border-slate-700 text-slate-200";
const RECENT = "attune:pdfchat:recent:v1";
const loadRecent = () => { try { const a = JSON.parse(localStorage.getItem(RECENT) || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
const saveRecent = (a) => { try { localStorage.setItem(RECENT, JSON.stringify(a.slice(0, 8))); } catch (e) {} };
// v6.12: documents are kept between sessions — their text, the conversation, and the PDF itself when under 8 MB (for the
// page pictures). Only on this phone (IndexedDB), forgotten with one tap, and only the last 8.
const idb = () => new Promise((ok, bad) => { try { const r = indexedDB.open("attune-pdfchat", 1); r.onupgradeneeded = () => r.result.createObjectStore("docs"); r.onsuccess = () => ok(r.result); r.onerror = () => bad(r.error); } catch (e) { bad(e); } });
const idbDo = async (mode, fn) => { try { const d = await idb(); return await new Promise((ok) => { const t = d.transaction("docs", mode); const st = t.objectStore("docs"); const q = fn(st); t.oncomplete = () => ok(q && q.result); t.onerror = () => ok(null); }); } catch (e) { return null; } };
export const keepDoc = (key, v) => idbDo("readwrite", (st) => st.put(v, key));
export const getDoc = (key) => idbDo("readonly", (st) => st.get(key));
export const dropDoc = (key) => idbDo("readwrite", (st) => st.delete(key));

const readB64 = (f) => new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] || ""); r.onerror = () => bad(new Error("Couldn't read that file")); r.readAsDataURL(f); });
const SECTION = 2400;
/** Text with no pages (Word, e-book, web page…) → "pages" of about 2,400 characters, cut at paragraph ends. */
export function textToPages(text) {
  const paras = String(text || "").replace(/\r/g, "").split(/\n\s*\n/); const pages = []; let cur = "";
  for (const p of paras) { if (cur && (cur + "\n\n" + p).length > SECTION) { pages.push(cur); cur = p; } else cur = cur ? cur + "\n\n" + p : p; }
  if (cur.trim()) pages.push(cur);
  return pages.map((t, i) => ({ n: i + 1, text: t.trim() })).filter((p) => p.text);
}

function Msg({ m, onPage }) {
  if (m.role === "user") return <div className="ms-10 rounded-2xl rounded-ee-md bg-teal-500/15 border border-teal-800 px-3 py-2 text-[14px] text-slate-100 whitespace-pre-wrap" data-testid="pdf-msg-user">{m.text}</div>;
  const parts = Q.splitCitations(m.text);
  return (
    <div className="me-6 rounded-2xl rounded-es-md bg-slate-900 border border-slate-800 px-3 py-2 text-[14px] text-slate-100 leading-relaxed" data-testid="pdf-msg-ai">
      <div className="whitespace-pre-wrap">{parts.map((x, i) => x.p ? <button key={i} onClick={() => onPage(x.p, m.q)} className="mx-0.5 px-1.5 rounded bg-teal-500/20 text-teal-200 text-[12px] align-baseline" data-testid="pdf-cite">p. {x.p}</button> : <span key={i}>{x.t}</span>)}</div>
      {m.note ? <p className="mt-2 text-[12px] text-amber-300 flex items-start gap-1.5"><AlertTriangle size={13} className="mt-0.5 shrink-0" />{m.note}</p> : null}
      {m.sources && m.sources.length ? <p className="mt-2 text-[11.5px] text-slate-500">{tr("Read pages")}: {m.sources.map((p) => <button key={p} onClick={() => onPage(p, m.q)} className="mx-0.5 underline text-slate-400">{p}</button>)}</p> : null}
    </div>
  );
}

export function PdfChatPage({ flash, llm, modelReady, openEngine, canReadPhotos, nativeCall, initialFile, clearInitial }) {
  const [doc, setDoc] = useState(null);                 // { name, kind, pages, index, count, b64?, scans }
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("chat");
  const [msgs, setMsgs] = useState([]);
  const [q, setQ] = useState("");
  const [asking, setAsking] = useState("");
  const [page, setPage] = useState(1);
  const [find, setFind] = useState(""); const [hits, setHits] = useState([]);
  const [recent, setRecent] = useState(loadRecent);
  const run = useRef(0), endRef = useRef(null), imgCache = useRef(new Map());
  const [pic, setPic] = useState(null);
  useSubBack(!!doc, () => { run.current++; setDoc(null); setMsgs([]); setTab("chat"); });
  // the conversation is kept with the document (v6.12)
  useEffect(() => { if (doc && doc.name) { const n = doc.name; getDoc(n).then((v) => { if (v) keepDoc(n, { ...v, msgs: msgs.slice(-60), t: Date.now() }); }); } }, [msgs]);
  const reopen = async (r) => {
    setErr(""); const v = await getDoc(r.name);
    if (!v || !Array.isArray(v.pages)) { setErr(tr("“{n}” isn't kept on this phone any more — pick the file again.", { n: r.name })); return; }
    const index = Q.buildIndex(v.pages);
    setDoc({ name: v.name, kind: v.kind, pages: v.pages, index, count: v.count, b64: v.b64 || null, scans: v.scans || null });
    setMsgs(Array.isArray(v.msgs) ? v.msgs : []); setPage(1); setTab("chat"); setFind(""); setHits([]);
    const rc = [{ ...r, t: Date.now() }, ...recent.filter((x) => x.name !== r.name)]; setRecent(rc); saveRecent(rc);
  };
  const forget = (r) => { dropDoc(r.name); const rc = recent.filter((x) => x.name !== r.name); setRecent(rc); saveRecent(rc); };

  // ---- open a file ---------------------------------------------------------------------------------------------------------------------
  const open = async (file) => {
    if (!file) return;
    const kind = C.kindOf(file.name, file.type);
    if (!["pdf", "docx", "pptx", "odt", "epub", "html", "rtf", "text"].includes(kind)) { setErr(tr("Pick a PDF, Word, PowerPoint, e-book, web page or text file.")); return; }
    if (file.size > 60 * 1024 * 1024) { setErr(tr("That file is too big (60 MB at most).")); return; }
    const id = ++run.current, alive = () => run.current === id;
    setErr(""); setBusy(tr("Reading the file…")); imgCache.current = new Map();
    try {
      let pages = [], b64 = null, scans = 0, count = 0;
      if (kind === "pdf") {
        if (!nativeCall) throw new Error(tr("PDF files are read by the Android app — open Attune on your phone."));
        b64 = await readB64(file);
        const r = await nativeCall("pdfText", { b64, textOnly: true });
        if (!alive()) return;
        count = r.count || r.pages.length;
        const text = {}; for (const p of r.pages) text[p.n] = p.text;
        const scanned = r.pages.filter((p) => p.scan).map((p) => p.n); scans = scanned.length;
        if (scanned.length) {
          if (!modelReady || !canReadPhotos) setErr(tr("{n} scanned page(s) have no text layer — install a model marked 📷 in Engine to read them.", { n: scanned.length }));
          else {
            for (let i = 0; i < Math.min(scanned.length, 40); i += 4) {
              const batch = scanned.slice(i, i + 4);
              const imgs = await nativeCall("pdfImages", { b64, pages: batch, width: 1400 });
              for (const im of imgs.images) {
                if (!alive()) return;
                setBusy(tr("The AI is reading scanned page {n}…", { n: im.n }));
                text[im.n] = String(await llm(C.readPageMessages(im.n, count), { media: "image/jpeg", data: im.image.split(",")[1] }, { maxTokens: 1800, temperature: 0 }) || "").trim();
              }
            }
          }
        }
        pages = r.pages.map((p) => ({ n: p.n, text: text[p.n] || "" }));
      } else {
        let blocks = null; const buf = async () => new Uint8Array(await file.arrayBuffer());
        if (kind === "docx") blocks = (await C.docxRead(await buf())).blocks;
        else if (kind === "pptx") blocks = await C.pptxToBlocks(await buf());
        else if (kind === "odt") blocks = await C.odtToBlocks(await buf());
        else if (kind === "epub") blocks = await C.epubToBlocks(await buf());
        else if (kind === "html") blocks = C.htmlToBlocks(await file.text());
        else if (kind === "rtf") blocks = C.textToBlocks(C.rtfToText(await file.text()));
        else blocks = C.textToBlocks(await file.text());
        if (kind === "pptx" && blocks.some((b) => b.slide)) {   // v6.12: one page per slide (a 10-slide deck is 10 pages, not 2)
          const by = new Map(); for (const b of blocks) { const k = b.slide || 1; if (!by.has(k)) by.set(k, []); by.get(k).push(b); }
          pages = [...by.keys()].sort((a, b) => a - b).map((k) => ({ n: k, text: C.blocksToText(by.get(k)).trim() || `Slide ${k}` }));
        } else pages = textToPages(C.blocksToText(blocks));
        count = pages.length;
      }
      if (!alive()) return;
      const index = Q.buildIndex(pages);
      if (!index.N) throw new Error(tr("There is no readable text in this file."));
      setDoc({ name: file.name, kind, pages, index, count, b64, scans });
      const old = await getDoc(file.name);   // the same file opened before: its conversation comes back
      setMsgs(old && old.count === count && Array.isArray(old.msgs) ? old.msgs : []); setPage(1); setTab("chat"); setFind(""); setHits([]);
      const rc = [{ name: file.name, pages: count, t: Date.now(), kept: true }, ...recent.filter((x) => x.name !== file.name)]; setRecent(rc); saveRecent(rc);
      for (const x of rc.slice(8)) dropDoc(x.name);
      keepDoc(file.name, { name: file.name, kind, pages, count, scans: scans || null, b64: b64 && b64.length < 11e6 ? b64 : null, msgs: old && old.count === count && Array.isArray(old.msgs) ? old.msgs : [], t: Date.now() });
    } catch (e) { setErr(String((e && e.message) || e).slice(0, 220)); }
    finally { if (run.current === id) setBusy(""); }
  };
  useEffect(() => { if (initialFile) { open(initialFile); clearInitial && clearInitial(); } }, [initialFile]);
  useEffect(() => { if (endRef.current) try { endRef.current.scrollIntoView({ block: "end" }); } catch (e) {} }, [msgs, asking]);

  // ---- ask ------------------------------------------------------------------------------------------------------------------------------
  const ask = async (question) => {
    const text = String(question || q).trim();
    if (!text || !doc || asking) return;
    if (!modelReady) { openEngine && openEngine(); return; }
    setQ(""); const id = ++run.current; const alive = () => run.current === id;
    const history = msgs.slice(-4); setMsgs((m) => [...m, { role: "user", text }]);
    try {
      const kind = Q.intent(text); let answer = "", allowed = [], note = "", sources = [];
      if (kind === "find") {
        setAsking(tr("Looking through the pages…"));
        const refs = Q.pageRefs(text).filter((n) => n >= 1 && n <= doc.count);
        const r = refs.length ? Q.pageExcerpts(doc.index, refs) : Q.retrieve(doc.index, text, { budget: 4500 });
        if (!r.excerpts.length) { setMsgs((m) => [...m, { role: "ai", q: text, text: tr("I could not find anything about that in this document."), sources: [] }]); return; }
        sources = r.pages; allowed = r.pages;
        setAsking(tr("Reading pages {p}…", { p: r.pages.slice(0, 6).join(", ") }));
        answer = String(await llm(Q.answerMessages(text, r.excerpts, history), { maxTokens: 700, temperature: 0.1 }) || "");
      } else {
        const secs = Q.sections(doc.index, 3200).slice(0, 14); allowed = doc.index.pages.map((p) => p.n);
        const notes = [];
        for (let i = 0; i < secs.length; i++) {
          if (!alive()) return;
          setAsking(tr("Reading part {i} of {n} (pages {a}–{b})…", { i: i + 1, n: secs.length, a: secs[i].from, b: secs[i].to }));
          const nt = String(await llm(Q.notesMessages(text, secs[i], i + 1, secs.length), { maxTokens: 450, temperature: 0.1 }) || "").trim();
          if (nt && !/^none\.?$/i.test(nt)) notes.push(nt);
        }
        if (!alive()) return;
        if (doc.index.pages.length > secs.reduce((a, s) => a + (s.to - s.from + 1), 0)) note = tr("Only the first parts of this long document were summarised.");
        setAsking(tr("Writing the answer…"));
        answer = String(await llm(Q.fromNotesMessages(text, notes.join("\n") || "(nothing found)", kind === "outline"), { maxTokens: 800, temperature: 0.2 }) || "");
      }
      if (!alive()) return;
      const chk = Q.checkCitations(answer, allowed);
      if (!chk.supported && !chk.saysNotFound) note = (note ? note + " " : "") + tr("This answer could not be tied to a page — check the pages listed below before relying on it.");
      if (chk.removed) note = (note ? note + " " : "") + tr("{n} page reference(s) the AI made up were removed.", { n: chk.removed });
      setMsgs((m) => [...m, { role: "ai", q: text, text: chk.text || tr("I could not find anything about that in this document."), note, sources: chk.supported ? [] : sources }]);
    } catch (e) { setMsgs((m) => [...m, { role: "ai", q: text, text: tr("Something went wrong: {e}", { e: String((e && e.message) || e).slice(0, 120) }), sources: [] }]); }
    finally { setAsking(""); }
  };

  // ---- the reader --------------------------------------------------------------------------------------------------------------------------
  const goPage = (p, query) => { setPage(Math.max(1, Math.min(doc ? doc.count : 1, +p || 1))); if (query) setFind(Q.words(query).slice(0, 2).join(" ")); setTab("read"); };
  useEffect(() => { if (doc && find.trim().length >= 2) setHits(Q.searchPages(doc.index, find)); else setHits([]); }, [find, doc]);
  useEffect(() => {
    setPic(null);
    if (!doc || tab !== "read" || doc.kind !== "pdf" || !doc.b64 || !nativeCall) return;
    const key = page; if (imgCache.current.has(key)) { setPic(imgCache.current.get(key)); return; }
    let on = true;
    nativeCall("pdfImages", { b64: doc.b64, pages: [page], width: 900, max: 1 }).then((r) => { const im = r && r.images && r.images[0]; if (im && on) { imgCache.current.set(key, im.image); if (imgCache.current.size > 12) imgCache.current.delete(imgCache.current.keys().next().value); setPic(im.image); } }).catch(() => {});
    return () => { on = false; };
  }, [doc, tab, page]);
  const pageText = useMemo(() => (doc ? (doc.pages.find((p) => p.n === page) || { text: "" }).text : ""), [doc, page]);
  const hl = (text) => {
    const w = find.trim(); if (w.length < 2) return text;
    const parts = []; const lower = text.toLowerCase(), lw = w.toLowerCase(); let i = 0, at;
    while ((at = lower.indexOf(lw, i)) >= 0 && parts.length < 200) { if (at > i) parts.push(text.slice(i, at)); parts.push(<mark key={at} className="bg-amber-300/80 text-slate-950 rounded px-0.5">{text.slice(at, at + w.length)}</mark>); i = at + w.length; }
    parts.push(text.slice(i)); return parts;
  };

  // ---- screens -----------------------------------------------------------------------------------------------------------------------------
  if (!doc) return (
    <section className="p-4 space-y-3" data-testid="pdfchat-home">
      <div className="flex items-start gap-3"><FileText size={22} className="text-teal-300 mt-1" /><div><h2 className="text-lg font-semibold text-slate-100">{tr("Ask a PDF")}</h2><p className="text-[13px] text-slate-400">{tr("Open a PDF, Word file, book or web page. Read it here and chat with it — every answer shows the page it came from. Everything stays on your phone.")}</p></div></div>
      <label className={primary + " w-full py-3 flex items-center justify-center gap-1.5 cursor-pointer text-sm"}><Upload size={15} />{busy || tr("Open a file")}
        <input type="file" accept=".pdf,.docx,.pptx,.odt,.epub,.html,.htm,.rtf,.txt,.md" className="hidden" data-testid="pdfchat-file" disabled={!!busy} onChange={(e) => { open(e.target.files && e.target.files[0]); e.target.value = ""; }} /></label>
      {err ? <p className="text-[12.5px] text-amber-300" data-testid="pdfchat-err">{err}</p> : null}
      {!modelReady ? <p className="text-[12px] text-slate-500">{tr("Reading and searching work now. To chat with the file, install a model in Engine.")}</p> : null}
      {recent.length ? <div className="space-y-1.5"><p className="text-[11px] uppercase tracking-wide text-slate-500">{tr("Opened before")}</p>
        {recent.map((r) => (
          <div key={r.name} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
            <button className="flex-1 min-w-0 text-start" onClick={() => reopen(r)} data-testid="pdfchat-recent"><span className="block text-[13px] text-slate-200 truncate" dir="auto">{r.name}</span><span className="block text-[11px] text-slate-500">{r.pages} {tr("pages")}{r.kept ? " · " + tr("tap to continue") : ""}</span></button>
            <button onClick={() => forget(r)} className="text-[11px] text-slate-500 px-2 py-1" data-testid="pdfchat-forget">{tr("Forget")}</button>
          </div>))}
        <p className="text-[11.5px] text-slate-600">{tr("The text and your questions are kept on this phone only. Forget removes them.")}</p></div> : null}
    </section>
  );

  const sug = Q.suggestions(doc.index, getLang() === "ar");
  return (
    <div className="fixed inset-0 z-[60] bg-slate-950 flex flex-col pt-[env(safe-area-inset-top)]" data-testid="pdfchat">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800">
        <button onClick={() => { run.current++; setDoc(null); setMsgs([]); setTab("chat"); }} className="p-1.5 -ms-1 text-slate-300" aria-label={tr("Back")}><ChevronLeft size={20} className="rtl:rotate-180" /></button>
        <div className="min-w-0 flex-1"><p className="text-[14px] font-semibold text-white truncate" data-testid="pdf-name">{doc.name}</p><p className="text-[11.5px] text-slate-500">{doc.count} {tr("pages")}{doc.scans ? " · " + tr("{n} scanned", { n: doc.scans }) : ""}</p></div>
        <div className="flex rounded-lg border border-slate-700 overflow-hidden">{[["chat", tr("Chat")], ["read", tr("Read")]].map(([k, l]) => <button key={k} onClick={() => setTab(k)} data-testid={"pdf-tab-" + k} className={"px-3 py-1.5 text-[12.5px] " + (tab === k ? "bg-teal-500 text-slate-950 font-semibold" : "text-slate-300")}>{l}</button>)}</div>
      </div>
      {tab === "chat" ? (
        <>
          <div className="flex-1 overflow-auto p-3 space-y-3" data-testid="pdf-chat">
            {!msgs.length ? <div className="space-y-2"><p className="text-[13px] text-slate-400">{tr("Ask anything about this file. For example:")}</p>
              <div className="flex flex-wrap gap-2">{sug.map((s) => <button key={s} onClick={() => ask(s)} className="rounded-full border border-slate-700 px-3 py-1.5 text-[12.5px] text-slate-200" data-testid="pdf-suggest">{s}</button>)}</div></div> : null}
            {msgs.map((m, i) => <Msg key={i} m={m} onPage={goPage} />)}
            {asking ? <p className="text-[12.5px] text-teal-300 animate-pulse" data-testid="pdf-asking">{asking}</p> : null}
            <div ref={endRef} />
          </div>
          <div className="border-t border-slate-800 p-2 flex gap-2 items-end bg-slate-950 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
            <textarea rows={1} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }} placeholder={tr("Ask about this file…")} data-testid="pdf-input"
              className="flex-1 rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-[14px] text-slate-100 resize-none max-h-28" />
            <button onClick={() => ask()} disabled={!q.trim() || !!asking} className="rounded-xl bg-teal-500 p-2.5 text-slate-950 disabled:opacity-40" aria-label={tr("Send")} data-testid="pdf-send"><Send size={17} className="rtl:-scale-x-100" /></button>
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-auto" data-testid="pdf-reader">
          <div className="sticky top-0 z-10 bg-slate-950 border-b border-slate-800 p-2 space-y-2">
            <div className="flex items-center gap-2">
              <button onClick={() => goPage(page - 1)} disabled={page <= 1} className={ghost} aria-label={tr("Previous page")} data-testid="pdf-prev"><ChevronLeft size={15} className="rtl:rotate-180" /></button>
              <div className="flex-1 text-center text-[13px] text-slate-200"><input type="number" min={1} max={doc.count} value={page} onChange={(e) => goPage(e.target.value)} className="w-14 rounded bg-slate-900 border border-slate-700 text-center py-1" data-testid="pdf-page-input" /> <span className="text-slate-500">/ {doc.count}</span></div>
              <button onClick={() => goPage(page + 1)} disabled={page >= doc.count} className={ghost} aria-label={tr("Next page")} data-testid="pdf-next"><ChevronRight size={15} className="rtl:rotate-180" /></button>
            </div>
            <div className="relative"><Search size={14} className="absolute top-2.5 start-2.5 text-slate-500" /><input value={find} onChange={(e) => setFind(e.target.value)} placeholder={tr("Search in this file…")} data-testid="pdf-find" className="w-full rounded-lg bg-slate-900 border border-slate-700 ps-8 pe-8 py-1.5 text-[13px] text-slate-100" />
              {find ? <button onClick={() => setFind("")} className="absolute top-2 end-2 text-slate-500" aria-label={tr("Clear")}><X size={14} /></button> : null}</div>
          </div>
          {hits.length ? <div className="p-2 space-y-1 border-b border-slate-800" data-testid="pdf-hits"><p className="text-[11.5px] text-slate-500">{tr("{n} page(s) match", { n: hits.length })}</p>
            {hits.slice(0, 12).map((h) => <button key={h.page} onClick={() => setPage(h.page)} className={"w-full text-start rounded-lg px-2 py-1.5 text-[12px] " + (h.page === page ? "bg-teal-500/15 text-teal-100" : "bg-slate-900 text-slate-300")}><b>p. {h.page}</b> <span className="text-slate-500">×{h.count}</span> {h.snippet}</button>)}</div> : (find.trim().length >= 2 ? <p className="p-3 text-[12.5px] text-slate-500">{tr("No page contains that.")}</p> : null)}
          <div className="p-3 space-y-3">
            {pic ? <img src={pic} alt={tr("Page {n}", { n: page })} className="w-full rounded-lg bg-white" data-testid="pdf-page-img" /> : null}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"><p className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">{tr("Text of page {n}", { n: page })}</p>
              <p className="text-[13.5px] text-slate-200 whitespace-pre-wrap leading-relaxed" data-testid="pdf-page-text" dir="auto">{pageText ? hl(pageText) : tr("(no text on this page)")}</p>
              {pageText ? <button onClick={() => { try { navigator.clipboard.writeText(pageText); flash && flash(tr("Copied")); } catch (e) {} }} className="mt-2 text-[12px] text-slate-400 flex items-center gap-1"><Copy size={12} />{tr("Copy this page")}</button> : null}</div>
            <button onClick={() => { setTab("chat"); setQ(tr("Explain page {n}", { n: page })); }} className={ghost + " w-full flex items-center justify-center gap-1.5"}><Sparkles size={13} />{tr("Ask about this page")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
