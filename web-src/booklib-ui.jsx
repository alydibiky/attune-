/* ---- v8.3 Library (Ali picked 3A): a shelf of your own books; ask anything — it reads all of them, compares them, cites [Book, p. N]
   and shows where they disagree; follow-up questions in the same chat. Books are read on the phone (PDF text by the Android app,
   Word / e-book / text here) and kept in Ask a PDF's on-phone library. Logic: booklib.js (tested). */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Send, Trash2, BookOpen, Loader2, X, AlertTriangle, Lock } from "lucide-react";
import { tr } from "./i18n.js";
import * as B from "./booklib.js";
import * as Q from "./docqa.js";
import * as C from "./convert.js";
import * as R from "./pdfreader.js";
import { textToPages } from "./pdfchat-ui.jsx";
import { Md } from "./chat.jsx";
import * as U from "./ui-kit.jsx";

let LIB = null;
const lib = () => LIB || (LIB = R.library(R.idbKV("attune-reader")));
const SPINES = ["#7A4B2F", "#2F5B7A", "#5B2F7A", "#2F7A55", "#7A2F3D", "#6B6B2F", "#2F6F7A", "#7A5F2F"];
const readB64 = (f) => new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] || ""); r.onerror = () => bad(new Error("Couldn't read that file")); r.readAsDataURL(f); });

/** One file → { id, name, kind, pages, scans } (text only; scanned PDF pages are counted, not read here). */
async function readBook(file, nativeCall, onStep) {
  const kind = C.kindOf(file.name, file.type);
  if (!["pdf", "docx", "pptx", "odt", "epub", "html", "rtf", "text"].includes(kind)) throw new Error(tr("Pick a PDF, Word, PowerPoint, e-book, web page or text file."));
  if (kind === "pdf") {
    if (!nativeCall) throw new Error(tr("PDF files are read by the Android app — open Attune on your phone."));
    const b64 = await readB64(file), id = R.docId(file.name, file.size, b64.slice(0, 4096));
    const kept = await lib().get(id).catch(() => null);
    if (kept && kept.pages && kept.pages.length) return { id, name: file.name, kind, pages: kept.pages, scans: 0, size: file.size, again: true };
    const text = {}; let count = 0, scans = 0, from = 1;
    for (let guard = 0; guard < 200; guard++) {
      const r = await nativeCall("pdfText", { b64, textOnly: true, from, max: 40 });
      count = r.count || count || (r.pages || []).length;
      let got = 0; for (const p of r.pages || []) if (text[p.n] == null) { text[p.n] = p.text || ""; got++; if (p.scan) scans++; }
      onStep && onStep(Object.keys(text).length, count);
      if (!got || Object.keys(text).length >= count) break;
      from = Object.keys(text).length + 1;
    }
    const pages = Object.keys(text).map(Number).sort((a, b) => a - b).map((n) => ({ n, text: text[n] }));
    return { id, name: file.name, kind, pages, scans, size: file.size };
  }
  const buf = async () => new Uint8Array(await file.arrayBuffer());
  const blocks = kind === "docx" ? (await C.docxRead(await buf())).blocks : kind === "pptx" ? await C.pptxToBlocks(await buf()) : kind === "odt" ? await C.odtToBlocks(await buf())
    : kind === "epub" ? await C.epubToBlocks(await buf()) : kind === "html" ? C.htmlToBlocks(await file.text()) : kind === "rtf" ? C.textToBlocks(C.rtfToText(await file.text())) : C.textToBlocks(await file.text());
  const pages = textToPages(C.blocksToText(blocks));
  return { id: R.docId(file.name, file.size, pages.slice(0, 2).map((p) => p.text).join(" ").slice(0, 4096)), name: file.name, kind, pages, scans: 0, size: file.size };
}

export function BookLibPage({ llm, modelReady, openEngine, nativeCall, flash, navTo }) {
  const [st, setSt] = useState(B.loadLib);
  const [docs, setDocs] = useState([]);              // the on-phone reader library (meta rows)
  const [books, setBooks] = useState([]);            // the library's books with their index: [{ id, name, index, count }]
  const [busy, setBusy] = useState("");
  const [q, setQ] = useState("");
  const [asking, setAsking] = useState(false);
  const [open, setOpen] = useState(null);            // { m, c } a citation opened under its answer
  const fileRef = useRef(null), endRef = useRef(null);
  const put = (v) => { setSt(v); B.saveLib(v); };
  const refresh = async () => { try { setDocs(await lib().list()); } catch (e) { setDocs([]); } };
  useEffect(() => { refresh(); }, []);
  // the library's books, indexed once (BM25 per book, on this phone)
  useEffect(() => { let alive = true; (async () => {
    const out = [];
    for (const id of st.ids) { const d = await lib().get(id).catch(() => null), m = docs.find((x) => x.id === id); if (d && d.pages) out.push({ id, name: (m && m.name) || id, count: (m && m.count) || d.pages.length, index: Q.buildIndex(d.pages) }); await new Promise((r) => setTimeout(r, 0)); }
    if (alive) setBooks(out);
  })(); return () => { alive = false; }; }, [st.ids.join(), docs.length]);
  useEffect(() => { try { endRef.current && endRef.current.scrollIntoView({ block: "end" }); } catch (e) {} }, [st.chat.length, asking]);

  const addFiles = async (files) => {
    const list = [...(files || [])]; if (!list.length) return;
    let ids = [...st.ids], scanned = 0;
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      setBusy(tr("Reading {i} of {n}: {name}", { i: i + 1, n: list.length, name: f.name }));
      try {
        const b = await readBook(f, nativeCall, (got, all) => setBusy(tr("Reading {i} of {n}: {name}", { i: i + 1, n: list.length, name: f.name }) + " · " + tr("page {a} of {b}", { a: got, b: all })));
        scanned += b.scans || 0;
        if (!Q.buildIndex(b.pages).N) { flash && flash(tr("{name}: no readable text (a scan) — open it in Ask a PDF to read it with the AI", { name: f.name })); continue; }
        if (!b.again) await lib().save({ id: b.id, name: b.name, kind: b.kind, count: b.pages.length, size: b.size, pages: b.pages, b64: null, scans: b.scans });   // text only: 10 books fit easily
        if (!ids.includes(b.id)) ids = [...ids, b.id];
      } catch (e) { flash && flash(f.name + ": " + String((e && e.message) || e).slice(0, 140)); }
    }
    setBusy(""); put({ ...st, ids }); await refresh();
    if (scanned) flash && flash(tr("{n} pages are pictures (scans) — Ask a PDF can read them with the AI", { n: scanned }));
  };
  const removeBook = (id) => put({ ...st, ids: st.ids.filter((x) => x !== id) });
  const ask = async (text0) => {
    const text = String(text0 || q).trim(); if (!text || asking) return;
    if (!books.length) { flash && flash(tr("Add a book first")); return; }
    if (!modelReady) { openEngine && openEngine(); return; }
    const found = B.passages(books, text, { history: st.chat });
    const chat = [...st.chat, { role: "user", text }];
    put({ ...st, chat }); setQ(""); setAsking(true);
    let out = "";
    try { out = String(await llm(B.libraryMessages(text, found, st.chat), { maxTokens: 1400, temperature: 0.2 }) || "").trim(); }
    catch (e) { out = String((e && e.message) || e); }
    setAsking(false);
    put({ ...st, chat: [...chat, { role: "ai", text: out || tr("No answer — try again"), found: found.map((p) => ({ title: p.title, page: p.page, text: p.text.slice(0, 900) })), books: [...new Set(found.map((p) => p.title))] }] });
  };
  const inLib = docs.filter((d) => st.ids.includes(d.id)), others = docs.filter((d) => !st.ids.includes(d.id));
  const pages = inLib.reduce((a, d) => a + (d.count || 0), 0);

  return (
    <div className="calm pt-1 pb-10 space-y-3 max-w-3xl" data-testid="booklib-page">
      <U.Head title={tr("Library")} sub={tr("Your own books — ask anything: it reads all of them, compares them and shows the book and page.")} />
      <p className="m-0 text-[12px] text-[var(--c-mut)] flex items-center gap-1.5" data-testid="booklib-private"><Lock size={12} />{tr("Read and kept on this phone only — your books never leave it.")}</p>
      <div className={U.cardPad + " space-y-3"} data-testid="booklib-shelf">
        <div className="flex items-center justify-between gap-2"><b className="text-[14px]">{inLib.length ? tr("{n} books · {p} pages", { n: inLib.length, p: pages }) : tr("No books yet")}</b>
          <button onClick={() => fileRef.current && fileRef.current.click()} disabled={!!busy} className="min-h-[40px] px-3.5 rounded-[12px] bg-[var(--c-acc)] text-[var(--c-on-acc)] font-extrabold text-[13px] inline-flex items-center gap-1 disabled:opacity-40" data-testid="booklib-add"><Plus size={15} />{tr("Books")}</button></div>
        <input ref={fileRef} type="file" multiple accept=".pdf,.docx,.pptx,.odt,.epub,.html,.htm,.rtf,.txt,application/pdf" className="hidden" data-testid="booklib-file" onChange={(e) => { const f = e.target.files; addFiles(f); e.target.value = ""; }} />
        {busy ? <p className="m-0 text-[12.5px] text-[var(--c-acc)] flex items-center gap-1.5" data-testid="booklib-busy"><Loader2 size={13} className="animate-spin" />{busy}</p> : null}
        {inLib.length ? <div className="flex flex-wrap gap-2">{inLib.map((d, i) => <span key={d.id} className="relative w-[64px] h-[88px] rounded-[6px] text-white text-[9.5px] font-extrabold leading-tight p-1.5 overflow-hidden" style={{ background: SPINES[i % SPINES.length] }} data-testid="booklib-book" title={d.name}>
          {B.titleOf(d.name)}<span className="absolute bottom-1 start-1.5 text-[8.5px] opacity-80">{d.count} {tr("p.")}</span>
          <button onClick={() => removeBook(d.id)} aria-label={tr("Remove")} className="absolute top-0.5 end-0.5 w-5 h-5 rounded-full bg-black/30 grid place-items-center" data-testid="booklib-remove"><X size={11} /></button></span>)}</div>
          : <p className="m-0 text-[13px] text-[var(--c-mut)]">{tr("Add the books you trust (PDF, Word, e-book) — 10 history books, your course, a law… Then ask anything.")}</p>}
        {others.length ? <div className="text-[12px]"><span className="text-[var(--c-mut)]">{tr("Also on this phone (from Ask a PDF):")} </span>
          {others.slice(0, 8).map((d) => <button key={d.id} onClick={() => put({ ...st, ids: [...st.ids, d.id] })} className="underline text-[var(--c-acc)] me-2" data-testid="booklib-add-doc">+ {B.titleOf(d.name)}</button>)}</div> : null}
      </div>
      <div className="space-y-2.5" data-testid="booklib-chat">
        {st.chat.map((m, i) => m.role === "user" ? <div key={i} className="ms-10 rounded-[18px] bg-[var(--c-acc)] text-[var(--c-on-acc)] px-3 py-2 text-[14px]" dir="auto" data-testid="booklib-q">{m.text}</div> : (() => {
          const parts = B.splitDisagree(m.text), cites = B.citesIn(m.text);
          return <div key={i} className={U.card + " me-4 px-3.5 py-3 space-y-2"} data-testid="booklib-a">
            <div className="text-[14px] leading-relaxed"><Md text={B.noCites(parts.main)} runnable={false} /></div>
            {parts.differ ? <div className="rounded-[12px] border border-dashed border-[var(--c-warn)] bg-[var(--c-warn)]/10 px-3 py-2 text-[13px]" data-testid="booklib-differ"><b className="flex items-center gap-1 text-[var(--c-warn)]"><AlertTriangle size={13} />{tr("Where the books disagree")}</b><Md text={B.noCites(parts.differ)} runnable={false} /></div> : null}
            {cites.length ? <div className="flex flex-wrap gap-1" data-testid="booklib-cites">{cites.map((c, k) => <button key={k} onClick={() => setOpen(open && open.m === i && open.k === k ? null : { m: i, k, c })} className="px-2 py-0.5 rounded-[8px] bg-[var(--c-soft)] text-[var(--c-acc)] text-[11.5px] font-extrabold" data-testid="booklib-cite">{c.title} · {tr("p.")} {c.page}</button>)}</div> : null}
            {open && open.m === i ? (() => { const p = B.passageFor(open.c, m.found); return <div className="rounded-[12px] bg-[var(--c-bg)] border border-[var(--c-ln)] px-3 py-2 text-[12.5px]" data-testid="booklib-quote"><b>{open.c.title} · {tr("p.")} {open.c.page}</b><p className="m-0 mt-1 whitespace-pre-wrap" dir="auto">{p ? p.text : tr("That page wasn't among the passages read for this answer.")}</p></div>; })() : null}
            {m.books && m.books.length ? <p className="m-0 text-[11.5px] text-[var(--c-mut)]">{tr("Read from: {b}", { b: m.books.join(" · ") })}</p> : null}
          </div>; })())}
        {asking ? <p className="m-0 text-[13px] text-[var(--c-acc)] flex items-center gap-1.5" data-testid="booklib-asking"><Loader2 size={13} className="animate-spin" />{tr("Reading your {n} books…", { n: books.length })}</p> : null}
        <div ref={endRef} />
      </div>
      {st.chat.length ? <button onClick={() => put({ ...st, chat: [] })} className="text-[12px] underline text-[var(--c-mut)]" data-testid="booklib-new">{tr("New question (clear the chat)")}</button> : null}
      <form onSubmit={(e) => { e.preventDefault(); ask(); }} className={U.card + " flex items-center gap-2 p-1.5 ps-3.5 sticky bottom-2"} data-testid="booklib-form">
        <BookOpen size={16} className="text-[var(--c-mut)] shrink-0" />
        <input value={q} onChange={(e) => setQ(e.target.value)} dir="auto" placeholder={st.chat.length ? tr("Ask a follow-up…") : tr("Ask your books…")} className="flex-1 min-w-0 bg-transparent outline-none text-[14px] min-h-[44px]" data-testid="booklib-input" />
        <button type="submit" disabled={!q.trim() || asking} aria-label={tr("Send")} className="w-11 h-11 rounded-full bg-[var(--c-acc)] text-[var(--c-on-acc)] grid place-items-center disabled:opacity-40" data-testid="booklib-send"><Send size={16} /></button>
      </form>
    </div>);
}
