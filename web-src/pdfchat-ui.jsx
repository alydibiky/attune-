/* ---- Ask a PDF: a reader and a chat in one screen (v6.18, reader v6.20) -------------------------------------------------------------
   Open a PDF (or Word, PowerPoint, e-book, web page, text). It is read on the phone — scanned pages by the AI that can see — and cut
   into passages that remember their page. Then:
     · Chat: ask anything; the answer comes from the right pages only and shows them as [p. 12] chips you can tap.
     · Read: the real pages (pictures of them) with the evidence for an answer and the search hits highlighted ON the page,
       zoom (buttons, pinch, fit width / fit page), night mode, contents, page pictures strip, jump to page; select words on the
       page → highlight in a colour, a note, Ask / Explain / Translate in the chat, copy; bookmarks; share a page as a picture.
     · Kept between sessions (IndexedDB): the text, the file itself when ≤ 25 MB, last page and zoom, the chat, the annotations.
   A long file shows its first pages at once; the rest is read in parts in the background.
   The logic is docqa.js and pdfreader.js (tested); this file is the screen.                                                             */
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Upload, Send, ChevronLeft, ChevronRight, Search, FileText, X, AlertTriangle, Copy, Trash2, Sparkles, Star, PenLine, Languages, Menu, LayoutGrid, Eye, Share2, Download, Maximize2, Plus, Brain, History, Check } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import { useSubBack } from "./backstack.js";
import * as Q from "./docqa.js";
import * as C from "./convert.js";
import * as R from "./pdfreader.js";
import { PANES, DeskEmpty } from "./desk.jsx";
import { useDesktopWide } from "./side-ui.jsx";
import { Md } from "./chat.jsx";
import { mathToText } from "./quality.js";
import { checkMath, dedupeAnswer } from "./mathcheck.js";
import * as PT from "./pdftables.js";
import * as K from "./ui-kit.jsx";

const btn = "min-h-[44px] px-3.5 rounded-[14px] text-[13px] font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-40 transition-colors duration-150";
const primary = btn + " bg-[var(--c-acc)] text-[var(--c-on-acc)] !font-extrabold";
const ghost = btn + " border border-[var(--c-ln)] bg-[var(--c-surf)] text-[var(--c-ink)] hover:border-[var(--c-acc)]";
const tool = "min-h-[44px] min-w-[44px] px-2 rounded-[14px] border border-[var(--c-ln)] bg-[var(--c-surf)] text-[var(--c-ink)] disabled:opacity-40 text-[12px] font-bold flex items-center justify-center gap-1 transition-colors duration-150";
const OLD_RECENT = "attune:pdfchat:recent:v1";      // v6.18 list (names only) — shown until the library has entries
const loadOld = () => { try { const a = JSON.parse(localStorage.getItem(OLD_RECENT) || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
const HL_FILL = { yellow: "rgba(253,224,71,.45)", green: "rgba(134,239,172,.45)", blue: "rgba(147,197,253,.45)", pink: "rgba(249,168,212,.45)" };

const readB64 = (f) => new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] || ""); r.onerror = () => bad(new Error("Couldn't read that file")); r.readAsDataURL(f); });
const SECTION = 2400;
/** Text with no pages (Word, e-book, web page…) → "pages" of about 2,400 characters, cut at paragraph ends. */
export function textToPages(text) {
  const paras = String(text || "").replace(/\r/g, "").split(/\n\s*\n/); const pages = []; let cur = "";
  for (const p of paras) { if (cur && (cur + "\n\n" + p).length > SECTION) { pages.push(cur); cur = p; } else cur = cur ? cur + "\n\n" + p : p; }
  if (cur.trim()) pages.push(cur);
  return pages.map((t, i) => ({ n: i + 1, text: t.trim() })).filter((p) => p.text);
}
const idle = () => new Promise((ok) => setTimeout(ok, 0));
const fmtSize = (b) => b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB";

/* v6.38 (Ali: "add a copy button; the formulas are written in a wrong way; I'm not sure the answers are correct"):
   answers are drawn as real text — headings, bold, lists and formulas (LaTeX → "μ = ln(X₂/X₁)/(t₂ − t₁)", Md) — with their
   pages as chips; a "Solve" answer is one card per question, each with Copy and the calculations re-done by code. */
const plain = (t) => mathToText(String(t || "")).replace(/\[\s*(?:p{1,2}\.?|pages?|ص|صفحه|صفحة)\s*[\d٠-٩][\d٠-٩,\s\-–و]*\]/gi, "").replace(/\*\*/g, "").replace(/^#{1,6}\s*/gm, "").replace(/[ \t]+\n/g, "\n").trim();
const pagesOf = (t) => [...new Set(Q.splitCitations(t).filter((x) => x.p).map((x) => x.p))];
const noCites = (t) => String(t || "").replace(/\s*\[\s*(?:p{1,2}\.?|pages?|ص|صفحه|صفحة)\s*[\d٠-٩][\d٠-٩,\s\-–و]*\]/gi, "");
function CopyBtn({ text, testid = "pdf-copy", label }) {
  const [done, setDone] = useState(false);
  const go = () => { const t = plain(text); try { if (window.AttuneNative && window.AttuneNative.copy) window.AttuneNative.copy(t); else navigator.clipboard.writeText(t); } catch (e) { try { navigator.clipboard.writeText(t); } catch (x) {} } setDone(true); setTimeout(() => setDone(false), 1400); };
  return <button onClick={go} className="text-[11.5px] px-2 py-1 rounded-md border border-[var(--c-ln)] text-[var(--c-ink)] flex items-center gap-1 shrink-0" data-testid={testid}>{done ? <Check size={12} className="text-[var(--c-pos)]" /> : <Copy size={12} />}{done ? tr("Copied") : label || tr("Copy")}</button>;
}
function Chips({ pages, onPage, q, claims }) {
  return pages.length ? <span className="inline-flex flex-wrap gap-1">{pages.map((p) => <button key={p} onClick={() => onPage(p, q, claims && claims[p])} className="px-1.5 rounded bg-[var(--c-soft)] text-[var(--c-acc)] text-[12px]" data-testid="pdf-cite">p. {p}</button>)}</span> : null;
}
/** The calculations of one answer, re-done by code (mathcheck.js). */
function MathNote({ text }) {
  const r = useMemo(() => checkMath(text), [text]);
  if (!r.checked) return null;
  if (!r.wrong.length) return <p className="text-[11.5px] text-[var(--c-pos)] m-0 flex items-center gap-1" data-testid="pdf-math-ok"><Check size={12} />{tr("{n} calculations checked by code — all correct", { n: r.checked })}</p>;
  return (<div className="rounded-[16px] border border-[var(--c-warn)]/40 bg-[var(--c-warn)]/10 p-2 text-[12px] text-[var(--c-warn)] space-y-0.5" data-testid="pdf-math-wrong">
    <p className="m-0 font-semibold flex items-center gap-1"><AlertTriangle size={12} />{tr("Checked by code: {n} calculation(s) don't add up", { n: r.wrong.length })}</p>
    {r.wrong.slice(0, 4).map((w, i) => <p key={i} className="m-0" dir="ltr">{w.expr} = <b>{w.value}</b>, {tr("not")} {w.written}</p>)}</div>);
}
/** A "Solve" answer → its questions: [{ head, page, body }] (the "### Question N [p. 2]" lines the screen writes). */
export function solveBlocks(text) {
  const t = String(text || ""); const re = /^###\s+(.+)$/gm; const out = []; let m, last = null;
  while ((m = re.exec(t))) { if (last) last.body = t.slice(last.end, m.index).trim(); last = { head: m[1], end: re.lastIndex }; out.push(last); }
  if (last) last.body = t.slice(last.end).trim();
  const pre = out.length ? t.slice(0, t.search(/^###\s+/m)).trim() : "";
  return out.length >= 1 && /\bQ|سؤال|Question/i.test(out[0].head) ? { pre, items: out.map((b) => ({ title: noCites(b.head).trim(), pages: pagesOf(b.head), body: dedupeAnswer(b.body) })) } : null;
}
function Msg({ m, onPage }) {
  if (m.role === "user") return <div className="ms-10 rounded-[22px] rounded-ee-md bg-[var(--c-soft)] border border-[var(--c-acc)] px-3 py-2 text-[14px] text-[var(--c-ink)] whitespace-pre-wrap" data-testid="pdf-msg-user">{m.text}</div>;
  const claims = R.claimsByPage(m.text);
  const blocks = m.key || /^###\s+/m.test(m.text) ? solveBlocks(m.text) : null;
  return (
    <div className="me-6 rounded-[22px] rounded-es-md bg-[var(--c-surf)] border border-[var(--c-ln)] px-3 py-2 text-[14px] text-[var(--c-ink)] leading-relaxed space-y-2" data-testid="pdf-msg-ai">
      {blocks ? <>
        {blocks.pre ? <Md text={noCites(blocks.pre)} runnable={false} /> : null}
        {blocks.items.map((b, i) => (
          <section key={i} className="rounded-[16px] border border-[var(--c-ln)] bg-[var(--c-bg)] p-3 space-y-1.5" data-testid="pdf-solve-card">
            <div className="flex items-center gap-2"><b className="text-[14.5px] text-[var(--c-ink)] flex-1 min-w-0" dir="auto">{b.title}</b><Chips pages={b.pages} onPage={onPage} q={m.q} claims={claims} /><CopyBtn text={b.title + "\n" + b.body} testid="pdf-copy-one" /></div>
            <Md text={noCites(b.body)} runnable={false} />
            {m.done !== false ? <MathNote text={b.body} /> : null}
          </section>))}
      </> : <>
        <Md text={noCites(m.text)} runnable={false} />
        <Chips pages={pagesOf(m.text)} onPage={onPage} q={m.q} claims={claims} />
      </>}
      {m.note ? <p className="mt-2 text-[12px] text-[var(--c-warn)] flex items-start gap-1.5"><AlertTriangle size={13} className="mt-0.5 shrink-0" />{m.note}</p> : null}
      {m.sources && m.sources.length ? <p className="mt-2 text-[11.5px] text-[var(--c-mut)]">{tr("Read pages")}: {m.sources.map((p) => <button key={p} onClick={() => onPage(p, m.q)} className="mx-0.5 underline text-[var(--c-mut)]">{p}</button>)}</p> : null}
      {m.text && m.text.length > 40 ? <div className="flex justify-end"><CopyBtn text={blocks ? blocks.items.map((b) => b.title + "\n" + b.body).join("\n\n") : m.text} label={blocks ? tr("Copy all") : tr("Copy")} /></div> : null}
    </div>
  );
}

/** Rectangles over the page picture (fractions of the page). */
const Boxes = ({ rects, fill, testid, ring }) => (rects || []).map((r, i) => <div key={i} data-testid={testid} className={"absolute pointer-events-none rounded-[2px] " + (ring || "")} style={{ left: r.x * 100 + "%", top: r.y * 100 + "%", width: r.w * 100 + "%", height: r.h * 100 + "%", background: fill, mixBlendMode: "multiply" }} />);

let LIB = null;
const lib = () => LIB || (LIB = R.library(R.idbKV("attune-reader")));

export function PdfChatPage({ flash, llm, modelReady, openEngine, canReadPhotos, nativeCall, initialFile, clearInitial, addToKnowledge }) {
  const [doc, setDoc] = useState(null);                 // { id, name, kind, pages, index, count, b64?, scans, loaded }
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("chat");
  const [msgs, setMsgs] = useState([]);
  const [q, setQ] = useState("");
  const [asking, setAsking] = useState("");
  const [page, setPage] = useState(1);
  const [find, setFind] = useState(""); const [hits, setHits] = useState([]);
  const [recent, setRecent] = useState([]);
  const [old] = useState(loadOld);
  const run = useRef(0), endRef = useRef(null);
  const pics = useRef(R.lru(12)), thumbs = useRef(R.lru(40)), wordCache = useRef(R.lru(60));
  const [pic, setPic] = useState(null);
  const [zoom, setZoom] = useState(1); const [night, setNight] = useState(false);
  const [words, setWords] = useState(null);             // ordered word boxes of the current page (PDF only)
  const [aspect, setAspect] = useState(0.707);
  const [evid, setEvid] = useState(null);                // { page, claim, q } waiting for the page's words → { page, rects }
  const [anns, setAnns] = useState([]);
  const [sel, setSel] = useState(null);                  // { quote, rects?, from?, to? }
  const [panel, setPanel] = useState(null);              // "outline" | "notes" | "thumbs" | "library"
  const [outline, setOutline] = useState(null);
  const [noteFor, setNoteFor] = useState(null);          // { quote?, x, y, text }
  const [tick, setTick] = useState(0);                   // thumbnails arrived
  const scroller = useRef(null), sheet = useRef(null), pinch = useRef(null);
  // v6.27 computer layout: the pages on the left and the chat on the right, both at once (a phone shows one tab at a time)
  const wide = useDesktopWide();
  const showRead = wide || tab === "read", showChat = wide || tab === "chat";
  useSubBack(!!doc, () => { close(); });
  useSubBack(!!panel, () => setPanel(null));
  useSubBack(!!sel || !!noteFor, () => { setSel(null); setNoteFor(null); });

  const refreshRecent = useCallback(() => { lib().list().then(setRecent).catch(() => {}); }, []);
  useEffect(() => { refreshRecent(); }, []);
  const close = () => { run.current++; setDoc(null); setMsgs([]); setTab("chat"); setPanel(null); setSel(null); setEvid(null); setWords(null); setOutline(null); refreshRecent(); };

  // ---- open a file ---------------------------------------------------------------------------------------------------------------------
  const readScans = async (b64, scanned, count, text, alive) => {
    if (!scanned.length) return;
    if (!modelReady || !canReadPhotos) { setErr(tr("{n} scanned page(s) have no text layer — install a model marked 📷 in Engine to read them.", { n: scanned.length })); return; }
    for (let i = 0; i < Math.min(scanned.length, 40); i += 4) {
      const batch = scanned.slice(i, i + 4);
      const imgs = await nativeCall("pdfImages", { b64, pages: batch, width: 1400 });
      for (const im of imgs.images) {
        if (!alive()) return;
        setBusy(tr("The AI is reading scanned page {n}…", { n: im.n }));
        text[im.n] = String(await llm(C.readPageMessages(im.n, count), { media: "image/jpeg", data: im.image.split(",")[1] }, { maxTokens: 1800, temperature: 0 }) || "").trim();
      }
    }
  };
  const restoreState = async (id, info) => {
    try {
      const L = lib(); const [ch, an] = await Promise.all([L.chat(id), L.anns(id)]);
      setMsgs(ch || []); setAnns(an || []);
      if (info) { setPage(info.lastPage || 1); setZoom(info.zoom || 1); }
    } catch (e) { setMsgs([]); setAnns([]); }
  };
  const open = async (file) => {
    if (!file) return;
    const kind = C.kindOf(file.name, file.type);
    if (!["pdf", "docx", "pptx", "odt", "epub", "html", "rtf", "text"].includes(kind)) { setErr(tr("Pick a PDF, Word, PowerPoint, e-book, web page or text file.")); return; }
    if (file.size > 60 * 1024 * 1024) { setErr(tr("That file is too big (60 MB at most).")); return; }
    const id = ++run.current, alive = () => run.current === id;
    setErr(""); setBusy(tr("Reading the file…")); pics.current.clear(); thumbs.current.clear(); wordCache.current.clear();
    setMsgs([]); setAnns([]); setPage(1); setZoom(1); setTab("chat"); setFind(""); setHits([]); setOutline(null); setEvid(null); setSel(null);
    try {
      let pages = [], b64 = null, scans = 0, count = 0, did = null;
      if (kind === "pdf") {
        if (!nativeCall) throw new Error(tr("PDF files are read by the Android app — open Attune on your phone."));
        b64 = await readB64(file);
        did = R.docId(file.name, file.size, b64.slice(0, 4096));
        // the same file again: its text is already kept — open at once where it was left
        const info = await lib().info(did).catch(() => null);
        const kept = info ? await lib().get(did).catch(() => null) : null;
        if (kept && kept.pages && kept.pages.length && info.count) {
          if (!alive()) return;
          const index = Q.buildIndex(kept.pages);
          setDoc({ id: did, name: file.name, kind, pages: kept.pages, index, count: info.count, b64, scans: info.scans || 0, loaded: info.count, size: file.size });
          await restoreState(did, info); lib().touch(did, {}).then(refreshRecent).catch(() => {});
          return;
        }
        // the first pages first (seen at once), then the rest in parts
        const plan = R.readPlan(0);
        const r = await nativeCall("pdfText", { b64, textOnly: true, from: plan[0].from, max: plan[0].max });
        if (!alive()) return;
        count = r.count || r.pages.length;
        const text = {}; const scanned = [];
        const take = (ps) => { for (const p of ps) { if (text[p.n] == null) { text[p.n] = p.text; if (p.scan) scanned.push(p.n); } } };
        take(r.pages);
        const asPages = () => Object.keys(text).map(Number).sort((a, b) => a - b).map((n) => ({ n, text: text[n] || "" }));
        const loadedTo = () => { let n = 0; while (text[n + 1] != null) n++; return n; };
        pages = asPages();
        setDoc({ id: did, name: file.name, kind, pages, index: Q.buildIndex(pages), count, b64, scans: scanned.length, loaded: loadedTo(), size: file.size });
        setBusy("");
        // the rest, part by part, without freezing the screen
        while (loadedTo() < count) {
          const from = loadedTo() + 1;
          const part = await nativeCall("pdfText", { b64, textOnly: true, from, max: 40 });
          if (!alive()) return;
          const before = loadedTo(); take(part.pages || []);
          if (loadedTo() === before) break;                    // nothing new (an old app without parts): stop
          await idle();
          pages = asPages(); const index = Q.buildIndex(pages); await idle();
          if (!alive()) return;
          setDoc((d) => d && d.id === did ? { ...d, pages, index, loaded: loadedTo(), scans: scanned.length } : d);
        }
        scans = scanned.length;
        if (scanned.length) {
          await readScans(b64, scanned, count, text, alive); if (!alive()) return;
          pages = asPages(); const index = Q.buildIndex(pages);
          setDoc((d) => d && d.id === did ? { ...d, pages, index } : d); setBusy("");
        }
        pages = asPages();
        if (!Q.buildIndex(pages).N && !scanned.length) throw new Error(tr("There is no readable text in this file."));
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
        if (!alive()) return;
        const index = Q.buildIndex(pages);
        if (!index.N) throw new Error(tr("There is no readable text in this file."));
        did = R.docId(file.name, file.size, pages.slice(0, 2).map((p) => p.text).join(" ").slice(0, 4096));
        const info = await lib().info(did).catch(() => null);
        setDoc({ id: did, name: file.name, kind, pages, index, count, b64: null, scans: 0, loaded: count, size: file.size });
        if (info) await restoreState(did, info);
      }
      if (!alive()) return;
      const res = await lib().save({ id: did, name: file.name, kind, count, size: file.size, pages, b64, scans }).catch(() => null);
      if (res && res.evicted && res.evicted.length) flash && flash(tr("{n} older document(s) were removed to make room.", { n: res.evicted.length }));
      refreshRecent();
    } catch (e) { if (alive()) { setDoc(null); setErr(String((e && e.message) || e).slice(0, 220)); } }
    finally { if (run.current === id) setBusy(""); }
  };
  /** Open a kept document from the list (no need to pick the file again). */
  const openKept = async (row) => {
    const id = ++run.current, alive = () => run.current === id;
    setErr(""); setBusy(tr("Opening…")); pics.current.clear(); thumbs.current.clear(); wordCache.current.clear(); setOutline(null); setEvid(null); setSel(null); setFind("");
    try {
      const kept = await lib().get(row.id);
      if (!alive()) return;
      if (!kept || !kept.pages) { setErr(tr("That document is no longer kept — open the file again.")); await lib().remove(row.id); refreshRecent(); return; }
      setDoc({ id: row.id, name: row.name, kind: row.kind, pages: kept.pages, index: Q.buildIndex(kept.pages), count: row.count, b64: kept.b64 || null, scans: row.scans || 0, loaded: row.count, size: row.size });
      setTab("read"); await restoreState(row.id, row); lib().touch(row.id, {}).catch(() => {});
    } catch (e) { setErr(String((e && e.message) || e).slice(0, 220)); }
    finally { if (run.current === id) setBusy(""); }
  };
  useEffect(() => { if (initialFile) { open(initialFile); clearInitial && clearInitial(); } }, [initialFile]);
  useEffect(() => { if (endRef.current) try { endRef.current.scrollIntoView({ block: "end" }); } catch (e) {} }, [msgs, asking]);

  // ---- kept between sessions: chat, annotations, last page and zoom --------------------------------------------------------------------
  const docKey = doc && doc.id;
  useEffect(() => { if (docKey) lib().saveChat(docKey, msgs).catch(() => {}); }, [msgs, docKey]);
  useEffect(() => { if (docKey) lib().saveAnns(docKey, anns).catch(() => {}); }, [anns, docKey]);
  useEffect(() => { if (!docKey) return; const t = setTimeout(() => lib().touch(docKey, { lastPage: page, zoom }).catch(() => {}), 400); return () => clearTimeout(t); }, [page, zoom, docKey]);

  // ---- ask ------------------------------------------------------------------------------------------------------------------------------
  // v6.40 (S3): the PDF's tables, rebuilt by code from where the words sit (pdftables.js) — read once per document
  const tablesRef = useRef(null);
  const getTables = async () => {
    if (!doc || !doc.b64 || !nativeCall) return [];
    if (tablesRef.current && tablesRef.current.id === doc.id) return tablesRef.current.t;
    const pages = [];
    for (let s = 1; s <= Math.min(doc.count || 1, 200); s += 40) {
      const r = await nativeCall("pdfWords", { b64: doc.b64, pages: Array.from({ length: Math.min(40, (doc.count || 1) - s + 1) }, (_, i) => s + i) });
      pages.push(...((r && r.pages) || []));
    }
    const t = PT.tablesOf(pages); tablesRef.current = { id: doc.id, t }; return t;
  };
  const exportTables = async () => {
    setBusy(tr("Finding the tables…"));
    try {
      const t = await getTables();
      if (!t.length) { flash && flash(tr("No tables found in this PDF.")); return; }
      const z = C.xlsxFromSheets(t.map((x, i) => ({ name: tr("Table {n}", { n: i + 1 }) + " p" + x.pages[0], rows: [x.head, ...x.rows.map((r) => r.map((c) => { const v = PT.numOf(c); return v != null && /^[\s(\-+]*[\d.,٠-٩]+[\s)%]*$/.test(c) ? v : c; }))] })));
      await save(base + " - tables.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", null, C.bytesToB64(z));
      flash && flash(tr("{n} tables saved to Excel", { n: t.length }));
    } catch (e) { setErr(String((e && e.message) || e).slice(0, 200)); }
    finally { setBusy(""); }
  };
  const ask = async (question) => {
    const text = String(question || q).trim();
    if (!text || !doc || asking) return;
    if (!modelReady) { openEngine && openEngine(); return; }
    setQ(""); const id = ++run.current; const alive = () => run.current === id;
    const history = msgs.slice(-4); setMsgs((m) => [...m, { role: "user", text }]);
    try {
      const kind = Q.intent(text); let answer = "", allowed = [], note = "", sources = [];
      // v6.40 (S3): "total of the amount column", «إجمالي المبلغ» — answered by code over every row of the PDF's tables
      if (kind !== "solve" && doc.b64 && nativeCall && /\b(total|sum|average|mean|highest|lowest|largest|smallest|maximum|minimum|how many rows|count)\b|اجمالي|إجمالي|مجموع|متوسط|أعلى|اعلى|أقل|اقل|عدد/i.test(text)) {
        setAsking(tr("Reading the tables…"));
        const ta = PT.tableAnswer(text, await getTables().catch(() => []));
        if (ta && alive()) { setMsgs((m) => [...m, { role: "ai", q: text, text: PT.answerText(ta, Q.hasArabic(text) || getLang() === "ar"), sources: [] }]); return; }
      }
      if (kind === "find") {
        setAsking(tr("Looking through the pages…"));
        const refs = Q.pageRefs(text).filter((n) => n >= 1 && n <= doc.count);
        const r = refs.length ? Q.pageExcerpts(doc.index, refs) : Q.retrieve(doc.index, text, { budget: 4500 });
        if (!r.excerpts.length) { setMsgs((m) => [...m, { role: "ai", q: text, text: tr("I could not find anything about that in this document."), sources: [] }]); return; }
        sources = r.pages; allowed = r.pages;
        setAsking(tr("Reading pages {p}…", { p: r.pages.slice(0, 6).join(", ") }));
        answer = String(await llm(Q.answerMessages(text, r.excerpts, history), { maxTokens: 700, temperature: 0.1 }) || "");
      } else if (kind === "solve" && Q.questionsOf(doc.index).length) {
        // v6.35: the questions found by code, solved one at a time; the answer grows on the page as each one is done
        const qs = Q.questionsOf(doc.index); allowed = doc.index.pages.map((p) => p.n);
        const pageText = (n) => ((doc.index.pages.find((p) => p.n === n) || {}).text || "");
        const done = []; const key = "solve-" + id;
        const show = (extra) => setMsgs((m) => { const t = done.join("\n\n") + (extra ? (done.length ? "\n\n" : "") + extra : ""); const i = m.findIndex((x) => x.key === key);
          const row = { role: "ai", key, q: text, text: t, sources: [], done: false }; return i >= 0 ? m.map((x, j) => (j === i ? row : x)) : [...m, row]; });
        for (let i = 0; i < qs.length; i++) {
          if (!alive()) return;
          setAsking(tr("Solving question {i} of {n}…", { i: i + 1, n: qs.length }));
          const headLine = `### ${tr("Question {n}", { n: qs[i].n })} [p. ${qs[i].page}]`;
          let acc = "";
          const out = String(await llm(Q.solveOneMessages(text, qs[i], pageText(qs[i].page)), { maxTokens: 750, temperature: 0.1, onToken: (t) => { acc = t; if (alive()) show(headLine + "\n" + acc); } }) || acc || "").trim();   // (onToken gives the whole answer so far, not a piece)
          done.push(headLine + "\n" + (dedupeAnswer(out) || tr("(no answer came for this one — ask about it on its own)")));
          show("");
        }
        if (!alive()) return;
        const chk = Q.checkCitations(done.join("\n\n"), allowed);
        setMsgs((m) => m.map((x) => (x.key === key ? { role: "ai", q: text, text: chk.text || done.join("\n\n"), note: qs.length >= 20 ? tr("The first 20 questions were solved.") : "", sources: [] } : x)));
        return;
      } else if (kind === "solve") {
        // the whole document (a short one in one go; a long one part by part), solved question by question
        const secs = Q.sections(doc.index, 7000).slice(0, 8); allowed = doc.index.pages.map((p) => p.n);
        const parts = [];
        for (let i = 0; i < secs.length; i++) {
          if (!alive()) return;
          setAsking(secs.length > 1 ? tr("Solving part {i} of {n} (pages {a}–{b})…", { i: i + 1, n: secs.length, a: secs[i].from, b: secs[i].to }) : tr("Solving the questions…"));
          parts.push(String(await llm(Q.solveMessages(text, secs[i].text, secs.length > 1 ? tr("pages {a}–{b}", { a: secs[i].from, b: secs[i].to }) : ""), { maxTokens: 2200, temperature: 0.1 }) || "").trim());
        }
        answer = parts.filter(Boolean).join("\n\n");
        if (doc.index.pages.length > secs.reduce((a, s) => a + (s.to - s.from + 1), 0)) note = tr("Only the first parts of this long document were solved.");
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
      if (!chk.supported && !chk.saysNotFound && kind !== "solve") note = (note ? note + " " : "") + tr("This answer could not be tied to a page — check the pages listed below before relying on it.");
      if (chk.removed) note = (note ? note + " " : "") + tr("{n} page reference(s) the AI made up were removed.", { n: chk.removed });
      setMsgs((m) => [...m, { role: "ai", q: text, text: chk.text || (kind === "solve" ? tr("The model gave no answer this time — try again, or ask about one question at a time.") : tr("I could not find anything about that in this document.")), note, sources: chk.supported ? [] : sources }]);
    } catch (e) { setMsgs((m) => [...m, { role: "ai", q: text, text: tr("Something went wrong: {e}", { e: String((e && e.message) || e).slice(0, 120) }), sources: [] }]); }
    finally { setAsking(""); }
  };
  /** A piece selected on the page → Ask / Explain / Translate, answered in the chat of this screen. */
  const askSel = async (kind, quote, pg, question) => {
    if (!quote || asking) return;
    if (!modelReady) { openEngine && openEngine(); return; }
    const to = Q.hasArabic(quote) ? "en" : "ar";
    const label = kind === "translate" ? tr("Translate") : kind === "explain" ? tr("Explain") : (question || tr("Ask"));
    setSel(null); setTab("chat"); try { window.getSelection && window.getSelection().removeAllRanges(); } catch (e) {}
    if (kind === "ask" && !question) { setQ(tr("About this on page {n}: «{t}» — ", { n: pg, t: quote.slice(0, 200) })); return; }
    const id = ++run.current; const alive = () => run.current === id;
    setMsgs((m) => [...m, { role: "user", text: label + " — «" + quote.slice(0, 400) + (quote.length > 400 ? "…" : "") + "» (p. " + pg + ")" }]);
    setAsking(kind === "translate" ? tr("Translating…") : tr("Reading pages {p}…", { p: pg }));
    try {
      const out = String(await llm(R.selectionMessages(kind, quote, pg, { to, question }), { maxTokens: kind === "translate" ? 900 : 600, temperature: 0.2 }) || "").trim();
      if (!alive()) return;
      const text = kind === "translate" ? out + ` [p. ${pg}]` : Q.checkCitations(out, [pg]).text || out;
      setMsgs((m) => [...m, { role: "ai", q: quote.slice(0, 80), text }]);
    } catch (e) { setMsgs((m) => [...m, { role: "ai", q: quote, text: tr("Something went wrong: {e}", { e: String((e && e.message) || e).slice(0, 120) }) }]); }
    finally { setAsking(""); }
  };

  // ---- the reader --------------------------------------------------------------------------------------------------------------------------
  const isPdf = !!(doc && doc.kind === "pdf" && doc.b64 && nativeCall);
  const goPage = (p, query, claim) => {
    const n = Math.max(1, Math.min(doc ? doc.count : 1, +p || 1));
    setPage(n); setSel(null);
    if (query) setFind(Q.words(query).slice(0, 2).join(" "));
    setEvid(query || claim ? { page: n, claim: claim || "", q: query || "" } : null);
    setTab("read");
  };
  useEffect(() => { if (doc && find.trim().length >= 2) setHits(Q.searchPages(doc.index, find)); else setHits([]); }, [find, doc && doc.index]);
  const box = () => (scroller.current ? { w: scroller.current.clientWidth - 24, h: scroller.current.clientHeight - 24 } : { w: 360, h: 600 });
  // the page picture: sharp for the zoom; the old one stays on screen until the new one arrives (no blank flash)
  useEffect(() => {
    if (!isPdf || !showRead) { setPic(null); return; }
    const width = R.renderWidth(box().w, Math.max(1, zoom), typeof devicePixelRatio === "number" ? devicePixelRatio : 2);
    const key = page + "@" + width;
    const anyKey = pics.current.keys().reverse().find((k) => k.startsWith(page + "@"));
    if (pics.current.has(key)) { setPic(pics.current.get(key)); return; }
    if (anyKey) setPic(pics.current.get(anyKey)); else setPic(null);
    let on = true;
    const t = setTimeout(() => nativeCall("pdfImages", { b64: doc.b64, pages: [page], width, max: 1 }).then((r) => { const im = r && r.images && r.images[0]; if (im) { pics.current.set(key, im.image); if (on) setPic(im.image); } }).catch(() => {}), anyKey ? 180 : 0);
    return () => { on = false; clearTimeout(t); };
  }, [doc && doc.id, isPdf, showRead, page, zoom]);
  // the page's word boxes (highlights, selection)
  useEffect(() => {
    setWords(null);
    if (!isPdf || !showRead) return;
    if (wordCache.current.has(page)) { const c = wordCache.current.get(page); setWords(c.ws); setAspect(c.ar); return; }
    let on = true;
    nativeCall("pdfWords", { b64: doc.b64, pages: [page] }).then((r) => { const pg = r && r.pages && r.pages[0]; if (!pg) return; const c = { ws: R.orderWords(pg.words), ar: pg.ar || 0.707 }; wordCache.current.set(page, c); if (on) { setWords(c.ws); setAspect(c.ar); } }).catch(() => {});
    return () => { on = false; };
  }, [doc && doc.id, isPdf, showRead, page]);
  const searchRects = useMemo(() => (words && find.trim().length >= 2 ? R.findRects(words, find).flatMap((h) => h.rects) : []), [words, find]);
  const evidRects = useMemo(() => {
    if (!words || !evid || evid.page !== page) return [];
    const e = R.evidenceRects(words, evid.claim || evid.q, evid.q);
    return e ? e.rects : [];
  }, [words, evid, page]);
  // scroll the evidence into view
  useEffect(() => { if (evidRects.length && sheet.current && scroller.current) { const r = evidRects[0]; const sc = scroller.current; try { const b = sheet.current.getBoundingClientRect(), o = sc.getBoundingClientRect(); sc.scrollTop = Math.max(0, sc.scrollTop + b.top + r.y * b.height - o.top - sc.clientHeight * 0.45); } catch (e) {} } }, [evidRects]);
  // the small pictures strip
  useEffect(() => {
    if (!isPdf || panel !== "thumbs") return;
    const want = R.thumbWindow(page, doc.count, 6).filter((n) => !thumbs.current.has(n));
    if (!want.length) return;
    let on = true;
    nativeCall("pdfImages", { b64: doc.b64, pages: want, width: 400, max: want.length }).then((r) => { for (const im of (r && r.images) || []) thumbs.current.set(im.n, im.image); if (on) setTick((t) => t + 1); }).catch(() => {});
    return () => { on = false; };
  }, [isPdf, panel, page]);
  // the PDF's contents (once, when asked)
  useEffect(() => {
    if (panel !== "outline" || outline || !isPdf) return;
    nativeCall("pdfOutline", { b64: doc.b64 }).then((r) => setOutline((r && r.items) || [])).catch(() => setOutline([]));
  }, [panel, isPdf]);

  // zoom: buttons, fit, pinch (CSS scale while the fingers move, a sharp picture after)
  const setZ = (z) => setZoom(R.clampZoom(z));
  const fit = (mode) => { const b = box(); setZ(R.fitZoom(mode, b.w, b.h, aspect)); };
  const onTouchStart = (e) => { if (e.touches.length === 2) { const [a, b] = e.touches; pinch.current = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z: zoom, s: 1 }; } };
  const onTouchMove = (e) => { const p = pinch.current; if (!p || e.touches.length !== 2) return; const [a, b] = e.touches; p.s = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / (p.d || 1); if (sheet.current) sheet.current.style.transform = `scale(${R.clampZoom(p.z * p.s) / p.z})`; e.preventDefault && e.cancelable && e.preventDefault(); };
  const onTouchEnd = () => { const p = pinch.current; if (!p) return; pinch.current = null; if (sheet.current) sheet.current.style.transform = ""; setZ(p.z * p.s); };
  const onWheel = (e) => { if (e.ctrlKey) { e.preventDefault && e.preventDefault(); setZ(zoom * (e.deltaY < 0 ? 1.1 : 0.9)); } };

  // selecting words on the page (the invisible text layer over the picture) or in the page's text
  const readSelection = () => {
    try {
      const s = window.getSelection(); if (!s || s.isCollapsed) return;
      const txt = String(s.toString() || "").replace(/\s+/g, " ").trim(); if (txt.length < 2) return;
      const idx = (n) => { let el = n && (n.nodeType === 1 ? n : n.parentElement); while (el && !(el.dataset && el.dataset.w != null)) el = el.parentElement; return el ? +el.dataset.w : null; };
      const a = idx(s.anchorNode), b = idx(s.focusNode);
      if (words && a != null && b != null) setSel({ ...R.selectionFrom(words, a, b), page });
      else setSel({ quote: txt.slice(0, 3000), page });
    } catch (e) {}
  };
  useEffect(() => {
    if (!showRead) return;
    const h = () => setTimeout(readSelection, 30);
    document.addEventListener("mouseup", h); document.addEventListener("touchend", h);
    return () => { document.removeEventListener("mouseup", h); document.removeEventListener("touchend", h); };
  }, [showRead, words, page]);

  const pageAnns = useMemo(() => R.annsOn(anns, page), [anns, page]);
  const bookmarked = pageAnns.some((a) => a.kind === "bookmark");
  const highlight = (color) => { if (!sel) return; setAnns((A) => R.addAnn(A, { kind: "highlight", page: sel.page || page, quote: sel.quote, rects: sel.rects || [], color })); setSel(null); try { window.getSelection().removeAllRanges(); } catch (e) {} flash && flash(tr("Highlighted")); };
  const saveNote = () => { if (!noteFor || !noteFor.text.trim()) { setNoteFor(null); return; } setAnns((A) => R.addAnn(A, { kind: "note", page, text: noteFor.text.trim(), quote: noteFor.quote || "", x: noteFor.x, y: noteFor.y })); setNoteFor(null); flash && flash(tr("Note added")); };
  const copy = (t) => { try { navigator.clipboard.writeText(t); flash && flash(tr("Copied")); } catch (e) {} };
  const save = async (name, mime, text, b64) => {
    if (nativeCall) { try { await nativeCall("saveFile", b64 ? { name, mime, b64 } : { name, mime, text }); flash && flash(tr("Saved")); return; } catch (e) { if (!/cancel/i.test(String(e && e.message))) setErr(String((e && e.message) || e).slice(0, 200)); return; } }
    try { const a = document.createElement("a"); a.href = b64 ? "data:" + mime + ";base64," + b64 : URL.createObjectURL(new Blob([text], { type: mime })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); } catch (e) {}
  };
  const base = doc ? doc.name.replace(/\.[^.]+$/, "") : "document";
  const exportMd = () => save(base + " - notes.md", "text/markdown", R.annsToMarkdown(doc.name, anns, getLang() === "ar"));
  const flatten = async () => {
    if (!isPdf) return;
    const list = R.flattenPayload(anns); if (!list.length) { flash && flash(tr("No highlights or notes to put in the file yet.")); return; }
    setBusy(tr("Writing the highlights into the PDF…"));
    try { const r = await nativeCall("pdfEdit", { op: "annotate", b64: doc.b64, anns: list }); const f = r && r.files && r.files[0]; if (f) await save(base + " (highlighted).pdf", "application/pdf", null, f.b64); }
    catch (e) { setErr(String((e && e.message) || e).slice(0, 200)); }
    finally { setBusy(""); }
  };
  /** The page as a picture, with its highlights drawn on it, to WhatsApp, Gmail… */
  const sharePage = async () => {
    if (!pic) return;
    try {
      const img = new Image(); img.src = pic; await new Promise((ok, bad) => { img.onload = ok; img.onerror = bad; });
      const cv = document.createElement("canvas"); cv.width = img.naturalWidth; cv.height = img.naturalHeight; const g = cv.getContext("2d");
      g.drawImage(img, 0, 0); g.globalCompositeOperation = "multiply";
      for (const a of pageAnns) if (a.kind === "highlight") { g.fillStyle = HL_FILL[a.color] || HL_FILL.yellow; for (const r of a.rects || []) g.fillRect(r.x * cv.width, r.y * cv.height, r.w * cv.width, r.h * cv.height); }
      const b64 = cv.toDataURL("image/jpeg", 0.9).split(",")[1];
      if (nativeCall) await nativeCall("shareFile", { name: base.replace(/[^\w؀-ۿ-]+/g, "_") + "-p" + page + ".jpg", mime: "image/jpeg", b64 });
      else await save(base + "-p" + page + ".jpg", "image/jpeg", null, b64);
    } catch (e) { flash && flash(tr("Could not share the page")); }
  };

  const pageText = useMemo(() => (doc ? (doc.pages.find((p) => p.n === page) || { text: "" }).text : ""), [doc, page]);
  const hl = (text) => {
    const w = find.trim(); if (w.length < 2) return text;
    const parts = []; const lower = text.toLowerCase(), lw = w.toLowerCase(); let i = 0, at;
    while ((at = lower.indexOf(lw, i)) >= 0 && parts.length < 200) { if (at > i) parts.push(text.slice(i, at)); parts.push(<mark key={at} className="bg-[var(--c-warn)] text-[var(--c-on-acc)] rounded px-0.5">{text.slice(at, at + w.length)}</mark>); i = at + w.length; }
    parts.push(text.slice(i)); return parts;
  };
  const removeKept = async (id) => { await lib().remove(id).catch(() => {}); refreshRecent(); };
  const clearKept = async () => { if (typeof confirm === "function" && !confirm(tr("Remove all kept documents, their chats and notes?"))) return; await lib().clear().catch(() => {}); refreshRecent(); };

  // ---- screens -----------------------------------------------------------------------------------------------------------------------------
  if (!doc) return (
    <section className="calm bg-[var(--c-bg)] text-[var(--c-ink)] p-4 space-y-3" data-testid="pdfchat-home">
      <div className={PANES}><div className="space-y-3 min-w-0 lg:sticky lg:top-4">
      <div className="flex items-start gap-3"><FileText size={22} className="text-[var(--c-acc)] mt-1" /><div><h2 className={K.h1}>{tr("Ask a PDF")}</h2><p data-intro="" className="text-[13px] text-[var(--c-mut)]">{tr("Open a PDF, Word file, book or web page. Read it here and chat with it — every answer shows the page it came from. Everything stays on your phone.")}</p></div></div>
      <label className={K.btnP + " w-full cursor-pointer"}><Upload size={15} />{busy || tr("Open a file")}
        <input type="file" accept=".pdf,.docx,.pptx,.odt,.epub,.html,.htm,.rtf,.txt,.md" className="hidden" data-testid="pdfchat-file" disabled={!!busy} onChange={(e) => { open(e.target.files && e.target.files[0]); e.target.value = ""; }} /></label>
      {err ? <p className="text-[12.5px] text-[var(--c-warn)]" data-testid="pdfchat-err">{err}</p> : null}
      {!modelReady ? <p className="text-[12px] text-[var(--c-mut)]">{tr("Reading and searching work now. To chat with the file, install a model in Engine.")}</p> : null}
      </div>
      <div className={(recent.length || old.length ? "mt-3 " : "") + "lg:mt-0 min-w-0"}>
      {recent.length ? (
        <div className="space-y-1.5" data-testid="pdf-recent">
          <div className="flex items-center"><p className={K.label + " flex-1 flex items-center gap-1"}><History size={12} />{tr("Recent documents")}</p>
            <button onClick={clearKept} className="min-h-[44px] px-1 text-[12px] font-bold text-[var(--c-mut)] underline" data-testid="pdf-recent-clear">{tr("Clear all")}</button></div>
          {recent.map((r) => (
            <div key={r.id} className={K.card + " flex items-center gap-2 px-3.5 py-2 min-h-[56px]"} data-testid="pdf-recent-item">
              <button onClick={() => openKept(r)} className="flex-1 min-w-0 text-start" disabled={!!busy}>
                <p className="text-[14px] font-extrabold text-[var(--c-ink)] truncate">{r.name}</p>
                <p className="text-[11.5px] text-[var(--c-mut)]">{r.count} {tr("pages")} · {tr("page {n}", { n: r.lastPage || 1 })}{r.hasFile ? "" : " · " + tr("text only")}</p>
              </button>
              <button onClick={() => removeKept(r.id)} className="w-11 h-11 grid place-items-center rounded-[14px] text-[var(--c-mut)] hover:text-[var(--c-neg)]" aria-label={tr("Delete")} data-testid="pdf-recent-del"><Trash2 size={14} /></button>
            </div>))}
          <p className="text-[11px] text-[var(--c-mut)]">{tr("Kept on this phone only. Files over 25 MB keep their text, not their pages.")}</p>
        </div>
      ) : old.length ? <div className="space-y-1"><p className={K.label}>{tr("Opened before")}</p>{old.map((r) => <p key={r.name} className="text-[12.5px] text-[var(--c-mut)]">{r.name} · {r.pages} {tr("pages")}</p>)}<p className="text-[11.5px] text-[var(--c-mut)]">{tr("Pick the file again to continue — files are not copied into the app.")}</p></div>
        : <DeskEmpty icon={FileText} title={tr("Your documents appear here")} text={tr("Open a file: it is kept on this device, with its chat and notes, so you can come back to it.")} testid="pdf-desk-empty" />}
      </div></div>
    </section>
  );

  const sug = Q.suggestions(doc.index, getLang() === "ar");
  const partial = doc.loaded < doc.count;
  const panelBtn = (k, Icon, label) => <button onClick={() => setPanel(panel === k ? null : k)} className={tool + (panel === k ? " !bg-[var(--c-acc-2)] !border-transparent !text-[var(--c-on-acc-2)]" : "")} aria-label={label} title={label} data-testid={"pdf-panel-" + k}><Icon size={14} /></button>;
  return (
    <div className="calm att-shift fixed inset-0 z-[60] bg-[var(--c-bg)] flex flex-col pt-[env(safe-area-inset-top)]" data-testid="pdfchat">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--c-ln)]">
        <button onClick={close} className="w-11 h-11 -ms-1 grid place-items-center rounded-[14px] text-[var(--c-ink)]" aria-label={tr("Back")}><ChevronLeft size={20} className="rtl:rotate-180" /></button>
        <div className="min-w-0 flex-1"><p className="text-[15px] font-extrabold text-[var(--c-ink)] truncate" data-testid="pdf-name">{doc.name}</p><p className="text-[11.5px] text-[var(--c-mut)] truncate">{doc.count} {tr("pages")}{doc.scans ? " · " + tr("{n} scanned", { n: doc.scans }) : ""}{partial ? <span data-testid="pdf-loading"> · {tr("reading {a} of {n}…", { a: doc.loaded, n: doc.count })}</span> : null}</p></div>
        <div className="flex shrink-0 gap-1 lg:hidden">{[["chat", tr("Chat")], ["read", tr("Read")]].map(([k, l]) => <button key={k} onClick={() => setTab(k)} data-testid={"pdf-tab-" + k} className={K.chip(tab === k)}>{l}</button>)}</div>
      </div>
      {/* v6.43 (Ali: "words do not fit" — «2 pages» one letter per line, «Ch at», «Rea d»): the actions get their own row */}
      {addToKnowledge || isPdf ? <div className="flex gap-2 px-3 py-1.5 border-b border-[var(--c-ln)] overflow-x-auto" data-testid="pdf-actions">
          {addToKnowledge ? <button onClick={async () => { if (doc.inKnowledge) return; try { const r = await addToKnowledge({ kind: "doc", title: doc.name, pages: doc.index.pages }); setDoc((d) => ({ ...d, inKnowledge: true })); flash && flash(tr("Added to Knowledge: {n} passages", { n: r.chunks })); } catch (e) { flash && flash(String((e && e.message) || e).slice(0, 160)); } }}
            data-testid="pdf-add-knowledge" className="shrink-0 whitespace-nowrap min-h-[40px] px-3.5 rounded-full border border-[var(--c-ln)] bg-[var(--c-surf)] text-[12.5px] font-bold text-[var(--c-ink)] disabled:opacity-50" disabled={!!doc.inKnowledge}>{doc.inKnowledge ? tr("In Knowledge") : tr("Add to Knowledge")}</button> : null}
          {isPdf ? <button onClick={exportTables} data-testid="pdf-export-tables" className="shrink-0 whitespace-nowrap min-h-[40px] px-3.5 rounded-full border border-[var(--c-ln)] bg-[var(--c-surf)] text-[12.5px] font-bold text-[var(--c-ink)]">{tr("Tables → Excel")}</button> : null}
      </div> : null}
      {err ? <p className="px-3 py-1.5 text-[12px] text-[var(--c-warn)] border-b border-[var(--c-ln)]" data-testid="pdfchat-err">{err}</p> : null}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row-reverse">
      {showChat ? (
        <div className="flex-1 min-h-0 flex flex-col lg:flex-none lg:w-[400px] xl:w-[440px] lg:border-s lg:border-[var(--c-ln)]">
          <div className="flex-1 overflow-auto p-3 space-y-3" data-testid="pdf-chat">
            {!msgs.length ? <div className="space-y-2"><p className="text-[13px] text-[var(--c-mut)]">{tr("Ask anything about this file. For example:")}</p>
              <div className="flex flex-wrap gap-2">{sug.map((s) => <button key={s} onClick={() => ask(s)} className={K.chip(false) + " !h-auto min-h-[40px] py-2 !whitespace-normal text-start"} data-testid="pdf-suggest">{s}</button>)}</div></div> : null}
            {msgs.map((m, i) => <Msg key={i} m={m} onPage={goPage} />)}
            {asking ? <p className="text-[12.5px] text-[var(--c-acc)] animate-pulse" data-testid="pdf-asking">{asking}</p> : null}
            {msgs.length ? <button onClick={() => setMsgs([])} className="min-h-[44px] text-[12px] font-bold text-[var(--c-mut)] underline" data-testid="pdf-chat-clear">{tr("Clear this chat")}</button> : null}
            <div ref={endRef} />
          </div>
          <div className="border-t border-[var(--c-ln)] p-2 flex gap-2 items-end bg-[var(--c-bg)] pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
            <textarea rows={1} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }} placeholder={tr("Ask about this file…")} data-testid="pdf-input"
              className={K.area + " flex-1 resize-none max-h-28"} />
            <button onClick={() => ask()} disabled={!q.trim() || !!asking} className="w-11 h-11 grid place-items-center shrink-0 rounded-full bg-[var(--c-acc)] text-[var(--c-on-acc)] disabled:opacity-40" aria-label={tr("Send")} data-testid="pdf-send"><Send size={17} className="rtl:-scale-x-100" /></button>
          </div>
          <p className="text-center text-[10.5px] leading-tight text-[var(--c-mut)] bg-[var(--c-bg)] -mt-1 pb-1 px-2" data-testid="ai-note">{tr("Attune is AI and can make mistakes. Check important info.")}</p>
        </div>
      ) : null}
      {showRead ? (
        <div className="flex-1 overflow-auto lg:min-w-0" data-testid="pdf-reader" ref={scroller} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onWheel={onWheel}>
          <div className="sticky top-0 z-20 bg-[var(--c-bg)] border-b border-[var(--c-ln)] p-2 space-y-2">
            <div className="flex items-center gap-2">
              <button onClick={() => goPage(page - 1)} disabled={page <= 1} className={ghost} aria-label={tr("Previous page")} data-testid="pdf-prev"><ChevronLeft size={15} className="rtl:rotate-180" /></button>
              <div className="flex-1 text-center text-[13px] text-[var(--c-ink)]"><input type="number" min={1} max={doc.count} value={page} onChange={(e) => goPage(e.target.value)} className="w-14 rounded bg-[var(--c-surf)] border border-[var(--c-ln)] text-center py-1 focus:outline-none focus:border-[var(--c-acc)] placeholder:text-[var(--c-mut)]" data-testid="pdf-page-input" /> <span className="text-[var(--c-mut)]">/ {doc.count}</span></div>
              <button onClick={() => goPage(page + 1)} disabled={page >= doc.count} className={ghost} aria-label={tr("Next page")} data-testid="pdf-next"><ChevronRight size={15} className="rtl:rotate-180" /></button>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap" data-testid="pdf-tools">
              {isPdf ? <>
                <button onClick={() => setZ(zoom / 1.25)} className={tool} aria-label={tr("Zoom out")} data-testid="pdf-zoom-out">−</button>
                <span className="text-[11.5px] text-[var(--c-mut)] w-10 text-center" data-testid="pdf-zoom">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZ(zoom * 1.25)} className={tool} aria-label={tr("Zoom in")} data-testid="pdf-zoom-in"><Plus size={13} /></button>
                <button onClick={() => fit("width")} className={tool} data-testid="pdf-fit-width" title={tr("Fit width")}>↔</button>
                <button onClick={() => fit("page")} className={tool} data-testid="pdf-fit-page" title={tr("Fit page")}><Maximize2 size={13} /></button>
                <button onClick={() => setNight((n) => !n)} className={tool + (night ? " !bg-[var(--c-acc-2)] !border-transparent !text-[var(--c-on-acc-2)]" : "")} aria-label={tr("Night mode")} title={tr("Night mode")} data-testid="pdf-night"><Eye size={14} /></button>
                {panelBtn("outline", Menu, tr("Contents"))}
                {panelBtn("thumbs", LayoutGrid, tr("Pages"))}
              </> : null}
              <button onClick={() => setAnns((A) => R.toggleBookmark(A, page, (pageText.split("\n")[0] || "").slice(0, 60)))} className={tool + (bookmarked ? " bg-[var(--c-warn)]/15 border-[var(--c-warn)]/50 text-[var(--c-warn)]" : "")} aria-label={tr("Bookmark this page")} title={tr("Bookmark this page")} data-testid="pdf-bookmark"><Star size={14} /></button>
              <button onClick={() => setNoteFor({ text: "", x: 0.03, y: 0.03 })} className={tool} aria-label={tr("Add a note")} title={tr("Add a note")} data-testid="pdf-note-add"><PenLine size={14} /></button>
              {panelBtn("notes", FileText, tr("Notes and highlights"))}
              {isPdf && pic ? <button onClick={sharePage} className={tool} aria-label={tr("Share this page as a picture")} title={tr("Share this page as a picture")} data-testid="pdf-share-page"><Share2 size={14} /></button> : null}
            </div>
            <div className="relative"><Search size={14} className="absolute top-2.5 start-2.5 text-[var(--c-mut)]" /><input value={find} onChange={(e) => setFind(e.target.value)} placeholder={tr("Search in this file…")} data-testid="pdf-find" className="w-full rounded-[14px] bg-[var(--c-surf)] border border-[var(--c-ln)] ps-8 pe-8 py-1.5 text-[13px] text-[var(--c-ink)] focus:outline-none focus:border-[var(--c-acc)] placeholder:text-[var(--c-mut)]" />
              {find ? <button onClick={() => setFind("")} className="absolute top-2 end-2 text-[var(--c-mut)]" aria-label={tr("Clear")}><X size={14} /></button> : null}</div>
          </div>
          {panel === "thumbs" && isPdf ? (
            <div className="flex gap-2 overflow-x-auto p-2 border-b border-[var(--c-ln)]" data-testid="pdf-thumbs" data-tick={tick}>
              {R.thumbWindow(page, doc.count, 6).map((n) => <button key={n} onClick={() => goPage(n)} className={"shrink-0 w-14 rounded-[10px] overflow-hidden border-2 " + (n === page ? "border-[var(--c-acc-2)]" : "border-[var(--c-ln)]")} data-testid="pdf-thumb">
                {thumbs.current.has(n) ? <img src={thumbs.current.get(n)} alt="" className="w-full rounded-t bg-white" /> : <div className="w-full aspect-[3/4] bg-[var(--c-surf-2)] rounded-t" />}<span className="block text-[10.5px] text-[var(--c-mut)]">{n}</span></button>)}
            </div>) : null}
          {panel === "outline" ? (
            <div className="p-2 border-b border-[var(--c-ln)] space-y-0.5 max-h-72 overflow-auto" data-testid="pdf-outline">
              {outline == null ? <p className="text-[12px] text-[var(--c-mut)]">{tr("Reading the contents…")}</p> : outline.length ? outline.map((o, i) => <button key={i} disabled={!o.page} onClick={() => { goPage(o.page); setPanel(null); }} className="w-full text-start rounded px-2 py-1 text-[12.5px] text-[var(--c-ink)] hover:bg-[var(--c-surf)] flex" style={{ paddingInlineStart: 8 + o.level * 14 }} data-testid="pdf-outline-item"><span className="flex-1 truncate" dir="auto">{o.title}</span><span className="text-[var(--c-mut)] ms-2">{o.page || ""}</span></button>) : <p className="text-[12px] text-[var(--c-mut)]">{tr("This PDF has no table of contents.")}</p>}
            </div>) : null}
          {panel === "notes" ? (
            <div className="p-2 border-b border-[var(--c-ln)] space-y-1.5 max-h-80 overflow-auto" data-testid="pdf-notes">
              {anns.length ? anns.map((a) => (
                <div key={a.id} className="flex items-start gap-2 rounded-[14px] bg-[var(--c-surf)] border border-[var(--c-ln)] px-2.5 py-1.5" data-testid="pdf-ann">
                  <button onClick={() => { goPage(a.page); setPanel(null); }} className="flex-1 min-w-0 text-start text-[12.5px] text-[var(--c-ink)]">
                    <b className="text-[var(--c-mut)]">{a.kind === "bookmark" ? "★ " : a.kind === "note" ? "✎ " : <span className="inline-block w-2.5 h-2.5 rounded-sm me-1" style={{ background: R.COLOURS[a.color] || R.COLOURS.yellow }} />}{tr("p. {n}", { n: a.page })}</b>{" "}
                    <span dir="auto">{a.kind === "note" ? a.text : a.kind === "highlight" ? "«" + String(a.quote || "").slice(0, 140) + "»" : a.title || ""}</span></button>
                  <button onClick={() => setAnns((A) => R.removeAnn(A, a.id))} className="w-10 h-10 grid place-items-center rounded-[12px] text-[var(--c-mut)] hover:text-[var(--c-neg)]" aria-label={tr("Delete")} data-testid="pdf-ann-del"><Trash2 size={13} /></button>
                </div>)) : <p className="text-[12px] text-[var(--c-mut)]">{tr("Select words on the page to highlight them, or add a note or a bookmark.")}</p>}
              {anns.length ? <div className="flex gap-2 pt-1">
                <button onClick={exportMd} className={ghost + " flex items-center gap-1"} data-testid="pdf-export-md"><Download size={13} />{tr("Export (Markdown)")}</button>
                {isPdf ? <button onClick={flatten} className={ghost + " flex items-center gap-1"} data-testid="pdf-flatten"><FileText size={13} />{tr("Save a PDF with them")}</button> : null}
              </div> : null}
            </div>) : null}
          {hits.length ? <div className="p-2 space-y-1 border-b border-[var(--c-ln)]" data-testid="pdf-hits"><p className="text-[11.5px] text-[var(--c-mut)]">{tr("{n} page(s) match", { n: hits.length })}</p>
            {hits.slice(0, 12).map((h) => <button key={h.page} onClick={() => goPage(h.page)} className={"w-full min-h-[40px] text-start rounded-[14px] px-3 py-2 text-[12.5px] " + (h.page === page ? "bg-[var(--c-soft)] text-[var(--c-acc)]" : "bg-[var(--c-surf)] text-[var(--c-ink)]")}><b>p. {h.page}</b> <span className="text-[var(--c-mut)]">×{h.count}</span> {h.snippet}</button>)}</div> : (find.trim().length >= 2 ? <p className="p-3 text-[12.5px] text-[var(--c-mut)]">{tr("No page contains that.")}</p> : null)}
          <div className="p-3 space-y-3">
            {isPdf ? (
              <div className="overflow-x-auto" dir="ltr">
                <div ref={sheet} className="relative mx-auto origin-top select-text selection:bg-[var(--c-acc)]/40" style={{ containerType: "inline-size", width: zoom * 100 + "%", aspectRatio: String(aspect), transition: "width .12s ease-out" }} data-testid="pdf-sheet">
                  {pic ? <img src={pic} alt={tr("Page {n}", { n: page })} className="absolute inset-0 w-full h-full rounded-lg bg-white select-none" draggable={false} style={night ? { filter: "invert(0.92) hue-rotate(180deg)" } : null} data-testid="pdf-page-img" /> : <div className="absolute inset-0 rounded-lg bg-[var(--c-surf-2)] animate-pulse" />}
                  {pageAnns.filter((a) => a.kind === "highlight").map((a) => <Boxes key={a.id} rects={a.rects} fill={HL_FILL[a.color] || HL_FILL.yellow} testid="pdf-user-hl" />)}
                  <Boxes rects={searchRects} fill="rgba(251,191,36,.5)" testid="pdf-hit-rect" />
                  <Boxes rects={evidRects} fill="rgba(45,212,191,.38)" ring="outline outline-2 outline-[var(--c-acc)]" testid="pdf-evidence" />
                  {sel && sel.rects ? <Boxes rects={sel.rects} fill="rgba(56,189,248,.3)" testid="pdf-sel-rect" /> : null}
                  {pageAnns.filter((a) => a.kind === "note").map((a) => <button key={a.id} onClick={() => setPanel("notes")} className="absolute w-5 h-5 rounded bg-amber-400 text-slate-900 text-[11px] leading-5 shadow" style={{ left: (a.x || 0.03) * 100 + "%", top: (a.y || 0.03) * 100 + "%" }} title={a.text} data-testid="pdf-note-pin">✎</button>)}
                  {words ? <div className="absolute inset-0" data-testid="pdf-textlayer" style={{ color: "transparent" }}>{words.map((w) => <span key={w.i} data-w={w.i} className="absolute whitespace-pre leading-none overflow-hidden" style={{ left: w.x * 100 + "%", top: w.y * 100 + "%", width: w.w * 100 + "%", height: w.h * 100 + "%", fontSize: "clamp(4px, " + (w.h * 0.85 * 100 / aspect).toFixed(2) + "cqw, 80px)" }}>{w.t + " "}</span>)}</div> : null}
                </div>
              </div>) : null}
            {sel ? (
              <div className="sticky bottom-2 z-30 rounded-[22px] border border-[var(--c-ln)] bg-[var(--c-surf)] p-2.5 space-y-2 shadow-[0_4px_18px_rgba(0,0,0,0.18)]" data-testid="pdf-sel-bar">
                <p className="text-[12px] text-[var(--c-ink)] line-clamp-2" dir="auto">«{sel.quote}»</p>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {Object.keys(R.COLOURS).map((c) => <button key={c} onClick={() => highlight(c)} className="w-9 h-9 rounded-full border-2 border-[var(--c-surf)] ring-1 ring-[var(--c-ln)]" style={{ background: R.COLOURS[c] }} aria-label={tr("Highlight")} data-testid={"pdf-hl-" + c} />)}
                  <button onClick={() => { setNoteFor({ text: "", quote: sel.quote, x: sel.rects && sel.rects[0] ? Math.min(0.95, sel.rects[0].x + sel.rects[0].w) : 0.03, y: sel.rects && sel.rects[0] ? sel.rects[0].y : 0.03 }); setSel(null); }} className={tool} data-testid="pdf-sel-note"><PenLine size={13} />{tr("Note")}</button>
                  <button onClick={() => askSel("ask", sel.quote, sel.page || page)} className={tool} data-testid="pdf-sel-ask"><Send size={13} />{tr("Ask")}</button>
                  <button onClick={() => askSel("explain", sel.quote, sel.page || page)} className={tool} data-testid="pdf-sel-explain"><Sparkles size={13} />{tr("Explain")}</button>
                  <button onClick={() => askSel("translate", sel.quote, sel.page || page)} className={tool} data-testid="pdf-sel-translate"><Languages size={13} />{tr("Translate")}</button>
                  <button onClick={() => { copy(sel.quote); setSel(null); }} className={tool} data-testid="pdf-sel-copy"><Copy size={13} /></button>
                  <button onClick={() => { setSel(null); try { window.getSelection().removeAllRanges(); } catch (e) {} }} className={tool} aria-label={tr("Close")}><X size={13} /></button>
                </div>
              </div>) : null}
            {noteFor ? (
              <div className="rounded-[22px] border border-[var(--c-warn)]/50 bg-[var(--c-surf)] p-3 space-y-2" data-testid="pdf-note-box">
                {noteFor.quote ? <p className="text-[12px] text-[var(--c-mut)] line-clamp-2" dir="auto">«{noteFor.quote}»</p> : null}
                <textarea autoFocus rows={2} value={noteFor.text} onChange={(e) => setNoteFor({ ...noteFor, text: e.target.value })} placeholder={tr("Your note on page {n}…", { n: page })} className="w-full rounded-[14px] bg-[var(--c-bg)] border border-[var(--c-ln)] px-2 py-1.5 text-[13px] text-[var(--c-ink)] focus:outline-none focus:border-[var(--c-acc)] placeholder:text-[var(--c-mut)]" data-testid="pdf-note-text" />
                <div className="flex gap-2"><button onClick={saveNote} className={primary} data-testid="pdf-note-save">{tr("Save")}</button><button onClick={() => setNoteFor(null)} className={ghost}>{tr("Cancel")}</button></div>
              </div>) : null}
            {pageAnns.filter((a) => a.kind === "note").map((a) => <p key={a.id} className="rounded-[14px] bg-[var(--c-warn)]/10 border border-[var(--c-warn)]/50 px-3 py-2 text-[12.5px] text-[var(--c-warn)]" dir="auto" data-testid="pdf-note">✎ {a.text}</p>)}
            <div className={K.cardPad}><p className={K.label + " mb-1"}>{tr("Text of page {n}", { n: page })}</p>
              <p className="text-[13.5px] text-[var(--c-ink)] whitespace-pre-wrap leading-relaxed" data-testid="pdf-page-text" dir="auto">{pageText ? hl(pageText) : (partial && page > doc.loaded ? tr("Reading this page…") : tr("(no text on this page)"))}</p>
              {pageText ? <button onClick={() => copy(pageText)} className="mt-2 min-h-[44px] text-[12.5px] font-bold text-[var(--c-mut)] flex items-center gap-1"><Copy size={12} />{tr("Copy this page")}</button> : null}</div>
            <button onClick={() => { setTab("chat"); setQ(tr("Explain page {n}", { n: page })); }} className={ghost + " w-full flex items-center justify-center gap-1.5"}><Sparkles size={13} />{tr("Ask about this page")}</button>
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
}
