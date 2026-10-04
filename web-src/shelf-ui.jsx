/* ---- v6.11 Shelf («رف») — the notes as a shelf of books (Ali, item 25; Option A: a grid of covers,
   two per row). Data and rules: shelf.js. A note IS a Mind record (one source of truth), so the
   screen gets the records and a setter from the app, like Mind does.                             */
import React, { useState, useEffect, useMemo, useRef } from "react";
import { Menu, AlarmClock, Search, Plus, MoreVertical, X, Star, Bell, Trash2, Copy, Share2, Brain, ArrowUp, ArrowDown, Folder, Check, ImagePlus, Undo2, Camera, ChevronLeft, ChevronRight, Square, BookOpen, Download } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import * as S from "./shelf.js";
import { thumbPut, thumbGet, thumbDel } from "./mind-ui.jsx";
import { useSubBack } from "./backstack.js";
import { askConfirm } from "./confirm.jsx";

const bookName = (b) => (!b ? "" : b.id === S.MY_BOOK && !b.named && b.name === S.MY_BOOK_NAME ? tr("My Book") : b.name);
const fmtWhen = (t) => { try { return new Date(t).toLocaleString(getLang() === "ar" ? "ar-EG-u-nu-latn" : undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); } catch (e) { return ""; } };
const localInput = (t) => { const d = new Date(t - new Date(t).getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); };

/** A picture → a cover: cropped to 3:4 from the middle, at most 600 px tall, JPEG. */
function photoToCover(file) {
  return new Promise((ok, bad) => {
    const fr = new FileReader();
    fr.onerror = () => bad(new Error("read"));
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const want = 3 / 4; let sw = img.width, sh = img.height, sx = 0, sy = 0;
        if (sw / sh > want) { sw = sh * want; sx = (img.width - sw) / 2; } else { sh = sw / want; sy = (img.height - sh) / 2; }
        const H = Math.min(600, Math.round(sh)), W = Math.round(H * want);
        const c = document.createElement("canvas"); c.width = W; c.height = H;
        c.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
        ok(c.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => bad(new Error("image"));
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

function useThumb(key) {
  const [url, setUrl] = useState(null);
  useEffect(() => { let on = true; setUrl(null); if (key) thumbGet(key).then((u) => on && setUrl(u)); return () => { on = false; }; }, [key]);
  return url;
}

/** A cover: a built-in design, or the person's photo. */
export function Cover({ cover, title, className = "", testid }) {
  const photoKey = S.isPhotoCover(cover) ? cover.slice(6) : null;
  const url = useThumb(photoKey);
  const c = S.coverOf(cover);
  const style = photoKey ? { background: url ? `center/cover no-repeat url(${url})` : "#334155" } : { background: c.bg };
  return (
    <div data-testid={testid} className={`relative aspect-[3/4] rounded-e-xl rounded-s-md overflow-hidden shadow-lg shadow-black/40 ${className}`} style={style}>
      {/* the spine: a darker strip on the binding side */}
      <div className="absolute inset-y-0 start-0 w-2.5 bg-black/25" />
      <div className="absolute inset-y-0 start-2.5 w-px bg-white/20" />
      {title && !photoKey ? <div className="absolute inset-x-3 top-1/3 text-center text-sm font-semibold line-clamp-3" dir="auto" style={{ color: c.fg }}>{title}</div> : null}
    </div>
  );
}

function CoverPicker({ value, onPick, flash }) {
  const fileRef = useRef(null);
  const pickPhoto = async (f) => {
    if (!f) return;
    try { const url = await photoToCover(f); const key = "cover:" + Date.now().toString(36); await thumbPut(key, url); onPick("photo:" + key); }
    catch (e) { flash(tr("Couldn't read that picture")); }
  };
  return (
    <div>
      <div className="grid grid-cols-5 gap-2" data-testid="shelf-covers">
        <button onClick={() => fileRef.current && fileRef.current.click()} data-testid="shelf-cover-photo"
          className={`aspect-[3/4] rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 text-[10px] ${S.isPhotoCover(value) ? "border-teal-400 text-teal-300" : "border-slate-600 text-slate-400"}`}>
          <Camera size={16} />{tr("Your photo")}
        </button>
        {S.COVERS.map((c) => (
          <button key={c.id} onClick={() => onPick(c.id)} aria-label={tr(c.name)} data-testid={"shelf-cover-" + c.id}
            className={`rounded-lg p-0.5 ${value === c.id ? "ring-2 ring-teal-400" : ""}`}>
            <div className="aspect-[3/4] rounded-md" style={{ background: c.bg }} />
          </button>
        ))}
      </div>
      {S.isPhotoCover(value) ? <div className="w-16 mt-2"><Cover cover={value} /></div> : null}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" data-testid="shelf-cover-file" onChange={(e) => { pickPhoto(e.target.files && e.target.files[0]); e.target.value = ""; }} />
    </div>
  );
}

function Sheet({ title, close, children, testid }) {
  return (
    <div className="fixed inset-0 z-[70] bg-black/60 flex items-end" onClick={close}>
      <div data-testid={testid} className="w-full max-w-xl mx-auto bg-slate-900 border-t border-slate-800 rounded-t-2xl p-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center mb-3"><p className="flex-1 text-slate-100 font-semibold">{title}</p><button onClick={close} aria-label={tr("Close")} className="p-1 text-slate-400"><X size={18} /></button></div>
        {children}
      </div>
    </div>
  );
}

/* ---- the note editor: full screen; the bottom bar sits above the keyboard (visualViewport) ---- */
function useViewportHeight() {
  const [h, setH] = useState(() => (window.visualViewport ? window.visualViewport.height : window.innerHeight));
  useEffect(() => {
    const vv = window.visualViewport; if (!vv) return undefined;
    const on = () => setH(vv.height); vv.addEventListener("resize", on); return () => vv.removeEventListener("resize", on);
  }, []);
  return h;
}

function NotePhoto({ id, remove }) {
  const url = useThumb(id);
  return url ? (
    <div className="relative"><img src={url} alt="" className="h-24 rounded-lg object-cover" data-testid="shelf-note-photo" />
      <button onClick={remove} aria-label={tr("Remove")} className="absolute top-1 end-1 bg-black/60 rounded-full p-0.5 text-white"><X size={12} /></button></div>
  ) : null;
}

function NoteEditor({ rec, shelf, save, close, remove, togglePin, setReminder, moveTo, copyTo, openInMind, flash, patch, archive, duplicate, exportNote }) {
  const [title, setTitle] = useState(rec.title || "");
  const [text, setText] = useState(rec.text || "");
  const [sheet, setSheet] = useState(null);   // move | copy | remind
  const [when, setWhen] = useState(() => localInput(Date.now() + 3600e3));
  const vh = useViewportHeight();
  const dirty = useRef(false);
  const latest = useRef({ title, text }); latest.current = { title, text };
  useEffect(() => { if (!dirty.current) return undefined; const t = setTimeout(() => { save(latest.current); dirty.current = false; }, 500); return () => clearTimeout(t); }, [title, text]);
  useEffect(() => () => { if (dirty.current) save(latest.current); }, []);
  useSubBack(!!sheet, () => setSheet(null));
  const photoRef = useRef(null);
  const photos = (rec.meta && rec.meta.photos) || [];
  const addPhoto = async (f) => {
    if (!f) return;
    try { const url = await new Promise((ok, bad) => { const fr = new FileReader(); fr.onload = () => { const i = new Image(); i.onload = () => { const k = Math.min(1, 900 / Math.max(i.width, i.height)); const c = document.createElement("canvas"); c.width = Math.round(i.width * k); c.height = Math.round(i.height * k); c.getContext("2d").drawImage(i, 0, 0, c.width, c.height); ok(c.toDataURL("image/jpeg", 0.8)); }; i.onerror = bad; i.src = fr.result; }; fr.onerror = bad; fr.readAsDataURL(f); });
      const key = "shelfimg:" + rec.id + ":" + Date.now().toString(36); await thumbPut(key, url); save({ ...latest.current, photos: [...photos, key] });
    } catch (e) { flash(tr("Couldn't read that picture")); }
  };
  const checks = text.split("\n").filter((l) => /^\s*[-*]\s*\[( |x|X)\]/.test(l));
  // undo / redo: the text's history while the note is open
  const hist = useRef({ past: [], future: [], last: 0 });
  const remember = () => { const h = hist.current; if (Date.now() - h.last > 800) { h.past.push(latest.current.text); if (h.past.length > 100) h.past.shift(); h.future = []; } h.last = Date.now(); };
  const setBody = (t) => { remember(); dirty.current = true; setText(t); };
  const undoT = () => { const h = hist.current; if (!h.past.length) return; h.future.push(latest.current.text); dirty.current = true; setText(h.past.pop()); h.last = 0; };
  const redoT = () => { const h = hist.current; if (!h.future.length) return; h.past.push(latest.current.text); dirty.current = true; setText(h.future.pop()); h.last = 0; };
  const taRef = useRef(null);
  const fmt = (kind) => {
    const el = taRef.current; const s0 = el ? el.selectionStart : text.length, e0 = el ? el.selectionEnd : text.length;
    hist.current.last = 0; const r = S.format(text, s0, e0, kind); setBody(r.text);
    setTimeout(() => { try { el.focus(); el.setSelectionRange(r.s, r.e); } catch (x) {} }, 0);
  };
  const set = (fn) => (e) => { if (fn === setText) remember(); dirty.current = true; fn(e.target.value); };
  const info = S.noteInfo({ ...rec, text });
  const m = rec.meta || {};
  const btn = "flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300";
  return (
    <div className="fixed inset-x-0 top-0 z-[60] bg-slate-950 flex flex-col" style={{ height: vh, ...(m.color ? { background: `linear-gradient(${m.color}55, ${m.color}22), #020617` } : {}) }} data-testid="shelf-editor">
      <div className="flex items-center gap-1 px-2 py-2 border-b border-slate-800">
        <button onClick={close} aria-label={tr("Back")} className="p-2 text-slate-300" data-testid="shelf-editor-back">{getLang() === "ar" ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}</button>
        <input value={title} onChange={set(setTitle)} dir="auto" placeholder={tr("Title")} data-testid="shelf-note-title"
          className="flex-1 min-w-0 bg-transparent text-lg font-semibold text-slate-100 placeholder-slate-600 focus:outline-none" />
        <button onClick={() => togglePin()} aria-label={tr("Pin")} className="p-2"><Star size={18} className={rec.pinned ? "text-amber-400" : "text-slate-500"} fill={rec.pinned ? "currentColor" : "none"} /></button>
        <button onClick={() => setSheet("remind")} aria-label={tr("Remind me")} data-testid="shelf-note-remind" className="p-2"><Bell size={18} className={m.remindAt > Date.now() ? "text-teal-300" : "text-slate-500"} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <textarea ref={taRef} value={text} onChange={set(setText)} dir="auto" placeholder={tr("Write your note…")} data-testid="shelf-note-body"
          onFocus={(e) => { const el = e.target; setTimeout(() => { try { el.scrollIntoView({ block: "nearest" }); } catch (x) {} }, 300); }}
          className="w-full min-h-[40vh] bg-transparent text-slate-100 placeholder-slate-600 leading-relaxed focus:outline-none resize-none" />
        {checks.length ? (
          <div className="mt-2 space-y-1" data-testid="shelf-checklist">
            {checks.map((l, i) => { const done = /\[(x|X)\]/.test(l); return (
              <div key={i} className="flex items-center gap-1">
              <button data-testid="shelf-check" onClick={() => setBody(S.toggleCheck(text, i))} className="flex-1 flex items-center gap-2 text-sm text-start" dir="auto">
                {done ? <Check size={16} className="text-teal-400" /> : <Square size={16} className="text-slate-500" />}
                <span className={done ? "line-through text-slate-500" : "text-slate-200"}>{l.replace(/^\s*[-*]\s*\[( |x|X)\]\s*/, "")}</span>
              </button>
              <button disabled={!i} onClick={() => setBody(S.moveCheck(text, i, -1))} aria-label={tr("Move earlier")} className="p-1 text-slate-500 disabled:opacity-20"><ArrowUp size={13} /></button>
              <button disabled={i === checks.length - 1} onClick={() => setBody(S.moveCheck(text, i, 1))} aria-label={tr("Move later")} className="p-1 text-slate-500 disabled:opacity-20"><ArrowDown size={13} /></button>
              </div>); })}
          </div>) : null}
        {(text.match(/https?:\/\/[^\s<>"')\]]+/g) || []).slice(0, 5).map((u) => <a key={u} href={u} target="_blank" rel="noreferrer" className="block text-xs text-teal-400 truncate mt-1" dir="ltr">{u}</a>)}
        {photos.length ? <div className="flex flex-wrap gap-2 mt-3">{photos.map((p) => <NotePhoto key={p} id={p} remove={() => { thumbDel(p); save({ ...latest.current, photos: photos.filter((x) => x !== p) }); }} />)}</div> : null}
        {m.remindAt > Date.now() ? <p className="text-xs text-teal-300 mt-3"><AlarmClock size={12} className="inline me-1" />{tr("Reminder set")}: {fmtWhen(m.remindAt)}</p> : null}
        <p className="text-[11px] text-slate-500 mt-3"><Brain size={11} className="inline me-1" />{tr("Also in your Mind: Mind's search finds it.")}</p>
      </div>
      <div className="flex items-center gap-0.5 px-2 pt-1.5 border-t border-slate-800 overflow-x-auto" data-testid="shelf-format" dir="ltr">
        {[["bold", <b>B</b>], ["italic", <i>I</i>], ["strike", <s>S</s>], ["h1", "H1"], ["h2", "H2"], ["bullet", "•"], ["number", "1."], ["check", "☐"], ["quote", "❝"]].map(([k, l]) => (
          <button key={k} onMouseDown={(e) => e.preventDefault()} onClick={() => fmt(k)} data-testid={"shelf-fmt-" + k} className="min-w-[34px] px-2 py-1 rounded-md text-sm text-slate-200 active:bg-slate-800">{l}</button>))}
        <button onClick={undoT} aria-label={tr("Undo")} data-testid="shelf-undo-text" className="px-2 py-1 text-slate-300"><Undo2 size={16} /></button>
        <button onClick={redoT} aria-label={tr("Redo")} data-testid="shelf-redo-text" className="px-2 py-1 text-slate-300"><Undo2 size={16} className="-scale-x-100" /></button>
      </div>
      <div className="flex flex-wrap gap-1.5 px-3 py-2 bg-slate-950" data-testid="shelf-editor-bar">
        <button className={btn} onClick={() => setSheet("more")} data-testid="shelf-note-more"><MoreVertical size={13} />{tr("More")}</button>
        <button className={btn} onClick={() => photoRef.current && photoRef.current.click()}><ImagePlus size={13} />{tr("Photo")}</button>
        <button className={btn} onClick={() => setSheet("move")} data-testid="shelf-note-move"><Folder size={13} />{tr("Move")}</button>
        <button className={btn} onClick={() => setSheet("copy")}><Copy size={13} />{tr("Copy to…")}</button>
        <button className={btn} onClick={() => { save(latest.current); openInMind(); }} data-testid="shelf-note-mind"><Brain size={13} />{tr("Open in Mind")}</button>
        <button className={btn} onClick={() => { try { navigator.clipboard.writeText([title, text].filter(Boolean).join("\n\n")); } catch (e) {} flash(tr("Copied")); }}><Share2 size={13} />{tr("Copy text")}</button>
        <button className={btn + " text-red-300"} onClick={remove} data-testid="shelf-note-delete"><Trash2 size={13} />{tr("Delete")}</button>
        <input ref={photoRef} type="file" accept="image/*" className="hidden" data-testid="shelf-note-photo-file" onChange={(e) => { addPhoto(e.target.files && e.target.files[0]); e.target.value = ""; }} />
      </div>
      {sheet === "move" || sheet === "copy" ? (
        <Sheet title={sheet === "move" ? tr("Move to…") : tr("Copy to…")} close={() => setSheet(null)} testid="shelf-pick-book">
          <div className="grid grid-cols-3 gap-3">{shelf.books.map((b) => (
            <button key={b.id} onClick={() => { save(latest.current); (sheet === "move" ? moveTo : copyTo)(b.id); setSheet(null); }} className="text-center" data-testid="shelf-pick">
              <Cover cover={b.cover} /><span className="block text-xs text-slate-200 truncate mt-1" dir="auto">{bookName(b)}</span></button>))}</div>
        </Sheet>) : null}
      {sheet === "more" ? (
        <Sheet title={tr("Note")} close={() => setSheet(null)} testid="shelf-note-sheet">
          <p className="text-xs text-slate-400 mb-1.5">{tr("Colour")}</p>
          <div className="flex gap-2 mb-3">{S.NOTE_COLORS.map((c) => (
            <button key={c || "none"} onClick={() => patch({ color: c })} aria-label={tr("Colour")} data-testid="shelf-color"
              className={`w-8 h-8 rounded-full border-2 ${(m.color || "") === c ? "border-teal-400" : "border-slate-700"}`} style={{ background: c || "#0f172a" }} />))}</div>
          <div className="flex flex-wrap gap-1.5">
            <button className={btn} onClick={() => patch({ star: !m.star })} data-testid="shelf-star"><Star size={13} className={m.star ? "text-amber-400" : ""} />{m.star ? tr("Unstar") : tr("Star")}</button>
            <button className={btn} onClick={() => { save(latest.current); archive(); }} data-testid="shelf-archive"><Download size={13} />{m.archived ? tr("Unarchive") : tr("Archive")}</button>
            <button className={btn} onClick={() => { save(latest.current); duplicate(); setSheet(null); }} data-testid="shelf-duplicate"><Copy size={13} />{tr("Duplicate")}</button>
            <button className={btn} onClick={() => { save(latest.current); exportNote(latest.current); setSheet(null); }}><Share2 size={13} />{tr("Export as a text file")}</button>
          </div>
          <p className="text-[11px] text-slate-500 mt-3" data-testid="shelf-info">{tr("Created {a} · edited {b} · {n} words", { a: fmtWhen(info.created), b: fmtWhen(info.edited), n: info.words })}</p>
        </Sheet>) : null}
      {sheet === "remind" ? (
        <Sheet title={tr("Remind me")} close={() => setSheet(null)} testid="shelf-remind-sheet">
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} data-testid="shelf-remind-when" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100" />
          <button data-testid="shelf-remind-set" onClick={() => { save(latest.current); if (setReminder(new Date(when).getTime())) setSheet(null); }} className="mt-3 w-full py-2.5 rounded-xl bg-teal-500 text-slate-950 font-semibold">{tr("Set reminder")}</button>
        </Sheet>) : null}
    </div>
  );
}

/* ---- the book form (new / edit) ---- */
function BookForm({ init, done, shelf, flash }) {
    const [name, setName] = useState(init ? bookName(init) : "");
    const [cover, setCv] = useState(init ? init.cover : S.COVERS[(shelf.books.length) % S.COVERS.length].id);
    return (
      <div>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} dir="auto" placeholder={tr("Book name")} data-testid="shelf-book-name"
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 mb-3 focus:outline-none focus:border-teal-500" />
        <p className="text-xs text-slate-400 mb-2">{tr("Book cover")}</p>
        <CoverPicker value={cover} onPick={setCv} flash={flash} />
        <button data-testid="shelf-book-save" disabled={!name.trim()} onClick={() => done(name.trim(), cover)} className="mt-4 w-full py-2.5 rounded-xl bg-teal-500 text-slate-950 font-semibold disabled:opacity-40">{init ? tr("Save") : tr("Create book")}</button>
      </div>
    );
}


/* ---- the screen ---- */
export function ShelfPage({ records, setRecords, scheduleReminder, flash, openInMind, saveFile, share }) {
  const [shelf, setShelfRaw] = useState(() => S.loadShelf(localStorage));
  const setShelf = (s) => setShelfRaw((old) => S.saveShelf(localStorage, typeof s === "function" ? s(old) : s));
  // once: the notes already kept move into «My Book» (a copy of the old data is kept first)
  useEffect(() => {
    const res = S.migrate(shelf, records, { storage: localStorage });
    if (res.changed) { setRecords(() => res.records); setShelf(res.shelf); }
    setRecords((rs) => { const p = S.purgeTrash(rs); return p.length === rs.length ? rs : p; });   // the trash empties itself after 30 days
  }, []);
  const prefs = shelf.prefs || {};
  const setPref = (k, v) => setShelf((s) => ({ ...s, prefs: { ...(s.prefs || {}), [k]: v } }));
  const [tagF, setTagF] = useState(null);
  const importRef = useRef(null);
  const [bookId, setBookId] = useState(null);
  const [noteId, setNoteId] = useState(null);
  const [view, setView] = useState(null);       // search | reminders | menu | books
  const [sheet, setSheet] = useState(null);     // {kind: new|edit|more, id}
  const [reorderOn, setReorderOn] = useState(false);
  const [undo, setUndo] = useState(null);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);          // a Set of selected note ids
  const [selPick, setSelPick] = useState(null);  // move | copy
  useSubBack(!!bookId, () => { setBookId(null); setSel(null); });
  useSubBack(!!noteId, () => setNoteId(null));
  useSubBack(!!view, () => setView(null));
  useSubBack(!!sheet, () => setSheet(null));
  useSubBack(!!sel, () => setSel(null));
  useSubBack(reorderOn, () => setReorderOn(false));
  useEffect(() => { if (!undo) return undefined; const t = setTimeout(() => setUndo(null), 10000); return () => clearTimeout(t); }, [undo]);

  const counts = useMemo(() => S.counts(records, shelf), [records, shelf]);
  const book = shelf.books.find((b) => b.id === bookId) || null;
  const allNotes = useMemo(() => (book ? S.sortNotes(S.notesIn(records, shelf, book.id), prefs.noteSort || "edited") : []), [records, shelf, book, prefs.noteSort]);
  const tags = useMemo(() => S.tagsIn(allNotes), [allNotes]);
  const notes = tagF ? allNotes.filter((r) => S.noteTags(r).includes(tagF)) : allNotes;
  const books = useMemo(() => S.sortBooks(shelf.books, prefs.bookSort || "manual", counts), [shelf, prefs.bookSort, counts]);
  const rec = noteId ? records.find((r) => r.id === noteId) : null;
  const hits = useMemo(() => (view === "search" ? S.searchShelf(records, shelf, q) : []), [view, q, records, shelf]);
  const ups = useMemo(() => S.upcoming(records, shelf), [records, shelf]);

  const upd = (id, fn) => setRecords((rs) => rs.map((r) => (r.id === id ? fn(r) : r)));
  const newNote = (bid) => { const n = S.makeNote({ book: bid }); setRecords((rs) => [n, ...rs]); setNoteId(n.id); };
  // deleting a note puts it in the trash (restore any time for 30 days; Undo right away)
  const deleteNote = (id) => {
    setNoteId(null); setRecords((rs) => S.trashNotes(rs, [id]));
    setUndo({ text: tr("Moved to the trash"), run: () => setRecords((rs) => S.restoreNotes(rs, [id])) });
  };
  const saveText = (name, md) => {
    if (saveFile) saveFile(name, md, "text/markdown");
    else { try { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([md], { type: "text/markdown" })); a.download = name; a.click(); } catch (e) { share && share(md); } }
  };
  const fileName = (t) => (String(t || "").replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_|_$/g, "") || "note") + ".md";
  const importFile = async (f) => {
    if (!f || !book) return;
    try { const t = await f.text(); const ns = S.importText(t, f.name, book.id); setRecords((rs) => [...ns, ...rs]); flash(tr("{n} notes imported", { n: ns.length })); }
    catch (e) { flash(tr("Couldn't read that file")); }
  };
  const deleteBk = async (id) => {
    const b = shelf.books.find((x) => x.id === id);
    if (!(await askConfirm(tr("Delete the book «{name}» and its {n} notes?", { name: bookName(b), n: counts[id] || 0 })))) return;
    const res = S.deleteBook(shelf, records, id);
    setShelf(res.shelf); setRecords(() => res.records); setSheet(null); setBookId(null);
    setUndo({ text: tr("Book deleted"), run: () => { setShelfRaw((s) => { const u = S.undoDelete(s, [], res.undo); return S.saveShelf(localStorage, u.shelf); }); setRecords((rs) => S.undoDelete({ books: [] }, rs, res.undo).records); } });
  };
  const exportBook = (b) => {
    saveText(fileName(bookName(b)), S.bookMarkdown(b, S.notesIn(records, shelf, b.id), bookName(b)));
    flash(tr("Book exported"));
  };
  const setReminder = (r, at) => {
    const out = S.remindNote(r, at, scheduleReminder);
    if (!out) { flash(tr("Pick a time in the future")); return false; }
    upd(r.id, () => out); flash(tr("I'll remind you")); return true;
  };

  const ib = "p-2 text-slate-200 rounded-full active:bg-slate-800";
  const fab = (onClick, testid) => (
    <button onClick={onClick} data-testid={testid} aria-label={tr("Add")}
      className="fixed z-30 end-5 w-14 h-14 rounded-full bg-slate-700 border border-slate-600 text-white shadow-xl shadow-black/50 flex items-center justify-center active:bg-slate-600"
      style={{ bottom: "calc(76px + env(safe-area-inset-bottom))" }}><Plus size={26} /></button>);

  const header = (title, left, right) => (
    <div className="flex items-center gap-1 mb-4" data-testid="shelf-bar">
      {left}<h2 className="flex-1 min-w-0 truncate text-xl font-semibold text-slate-100" dir="auto">{title}</h2>{right}
    </div>);
  const backBtn = (fn) => <button onClick={fn} aria-label={tr("Back")} className={ib}>{getLang() === "ar" ? <ChevronRight size={22} /> : <ChevronLeft size={22} />}</button>;

  let body;
  if (view === "search") {
    body = (<div data-testid="shelf-search">
      {header(tr("Search all books"), backBtn(() => setView(null)))}
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} dir="auto" placeholder={tr("Search every book…")} data-testid="shelf-search-input"
        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 mb-3 focus:outline-none focus:border-teal-500" />
      {q.trim() && !hits.length ? <p className="text-sm text-slate-500">{tr("Nothing found")}</p> : null}
      <div className="space-y-2">{hits.map(({ rec: r, book: b }) => (
        <button key={r.id} onClick={() => { setBookId(b && b.id); setNoteId(r.id); }} data-testid="shelf-hit" className="w-full text-start bg-slate-900 border border-slate-800 rounded-xl p-3">
          <p className="text-[11px] text-teal-400" dir="auto"><BookOpen size={11} className="inline me-1" />{bookName(b)}</p>
          <p className="text-sm text-slate-100 truncate" dir="auto">{S.noteTitle(r) || tr("Untitled")}</p>
          <p className="text-xs text-slate-400 line-clamp-2" dir="auto">{r.text}</p></button>))}</div>
    </div>);
  } else if (view === "reminders") {
    body = (<div data-testid="shelf-reminders">
      {header(tr("Reminders"), backBtn(() => setView(null)))}
      {!ups.length ? <p className="text-sm text-slate-500">{tr("No reminders yet. Open a note and tap the bell.")}</p> : null}
      <div className="space-y-2">{ups.map(({ rec: r, at, book: b }) => (
        <button key={r.id} onClick={() => { setBookId(b && b.id); setNoteId(r.id); }} data-testid="shelf-reminder" className="w-full text-start bg-slate-900 border border-slate-800 rounded-xl p-3 flex gap-3 items-center">
          <AlarmClock size={18} className="text-teal-300 shrink-0" />
          <span className="flex-1 min-w-0"><span className="block text-sm text-slate-100 truncate" dir="auto">{S.noteTitle(r) || tr("Untitled")}</span>
            <span className="block text-[11px] text-slate-400" dir="auto">{fmtWhen(at)} · {bookName(b)}</span></span></button>))}</div>
    </div>);
  } else if (view === "trash" || view === "archive") {
    const list = view === "trash" ? S.trashOf(records) : S.archiveOf(records, shelf);
    body = (<div data-testid={"shelf-" + view}>
      {header(view === "trash" ? tr("Trash") : tr("Archive"), backBtn(() => setView(null)),
        view === "trash" && list.length ? <button data-testid="shelf-empty-trash" onClick={async () => { if (!(await askConfirm(tr("Delete these {n} notes for good?", { n: list.length })))) return; const ids = new Set(list.map((r) => r.id)); setRecords((rs) => rs.filter((r) => !ids.has(r.id))); }} className="text-xs text-red-300 px-2">{tr("Empty the trash")}</button> : null)}
      <p className="text-xs text-slate-500 mb-3">{view === "trash" ? tr("Notes stay here for 30 days, then are deleted for good.") : tr("Archived notes leave their book but are still found by search.")}</p>
      {!list.length ? <p className="text-sm text-slate-500 text-center mt-8">{tr("Nothing here")}</p> : null}
      <div className="space-y-2">{list.map((r) => (
        <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center gap-2" data-testid="shelf-bin-note">
          <span className="flex-1 min-w-0"><span className="block text-sm text-slate-100 truncate" dir="auto">{S.noteTitle(r) || tr("Untitled")}</span>
            <span className="block text-[11px] text-slate-500" dir="auto">{bookName(shelf.books.find((b) => b.id === S.bookOf(r, shelf)))}</span></span>
          <button data-testid="shelf-restore" onClick={() => setRecords((rs) => (view === "trash" ? S.restoreNotes(rs, [r.id]) : S.archiveNotes(rs, [r.id], false)))} className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 text-teal-300">{tr("Restore")}</button>
        </div>))}</div>
    </div>);
  } else if (book) {
    body = (<div data-testid="shelf-book">
      {header(bookName(book), backBtn(() => { setBookId(null); setSel(null); }),
        <>{sel ? <span className="text-xs text-slate-400 px-2">{tr("{n} selected", { n: sel.size })}</span> : null}
          <button onClick={() => setSel(sel ? null : new Set())} aria-label={tr("Select")} data-testid="shelf-select" className={ib}><Check size={20} /></button>
          <button onClick={() => setSheet({ kind: "more", id: book.id })} aria-label={tr("More")} className={ib} data-testid="shelf-book-more"><MoreVertical size={20} /></button></>)}
      <div className="flex items-center gap-1.5 mb-3 overflow-x-auto" data-testid="shelf-filters">
        <select value={prefs.noteSort || "edited"} onChange={(e) => setPref("noteSort", e.target.value)} data-testid="shelf-sort" className="bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 px-2 py-1">
          <option value="edited">{tr("Last edited")}</option><option value="created">{tr("Date created")}</option><option value="title">{tr("Title")}</option></select>
        {tags.map(({ tag }) => <button key={tag} onClick={() => setTagF(tagF === tag ? null : tag)} data-testid="shelf-tag" className={`shrink-0 text-xs px-2.5 py-1 rounded-full border ${tagF === tag ? "border-teal-400 text-teal-300" : "border-slate-700 text-slate-400"}`} dir="auto">#{tag}</button>)}
      </div>
      {!notes.length ? <p className="text-sm text-slate-500 mt-8 text-center">{tr("No notes in this book yet. Tap + to write one.")}</p> : null}
      <div className="space-y-2 pb-24">{notes.map((r) => {
        const on = sel && sel.has(r.id);
        return (
          <button key={r.id} data-testid="shelf-note" onClick={() => { if (sel) { const s = new Set(sel); on ? s.delete(r.id) : s.add(r.id); setSel(s); } else setNoteId(r.id); }}
            style={r.meta && r.meta.color && !on ? { background: r.meta.color + "66" } : undefined}
            className={`w-full text-start rounded-xl p-3 border flex gap-2 ${on ? "border-teal-500 bg-teal-500/10" : "border-slate-800 bg-slate-900"}`}>
            {sel ? (on ? <Check size={18} className="text-teal-400 shrink-0" /> : <Square size={18} className="text-slate-500 shrink-0" />) : null}
            <span className="flex-1 min-w-0">
              <span className="flex items-center gap-1">{r.pinned ? <Star size={12} className="text-amber-400 shrink-0" fill="currentColor" /> : null}
                <span className="text-sm font-medium text-slate-100 truncate" dir="auto">{S.noteTitle(r) || tr("Untitled")}</span>
                {r.meta && r.meta.remindAt > Date.now() ? <Bell size={12} className="text-teal-300 shrink-0" /> : null}
                {r.meta && r.meta.star ? <span className="text-amber-400 text-xs shrink-0">★</span> : null}</span>
              <span className="block text-xs text-slate-400 line-clamp-2 mt-0.5" dir="auto">{r.text}</span>
            </span>
          </button>); })}</div>
      {sel && sel.size ? (
        <div className="fixed inset-x-0 z-30 flex justify-center gap-2 px-3" style={{ bottom: "calc(76px + env(safe-area-inset-bottom))" }} data-testid="shelf-selbar">
          <button onClick={() => setSelPick("move")} data-testid="shelf-sel-move" className="px-4 py-2 rounded-xl bg-teal-500 text-slate-950 text-sm font-semibold"><Folder size={14} className="inline me-1" />{tr("Move")}</button>
          <button onClick={() => setSelPick("copy")} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-100 text-sm"><Copy size={14} className="inline me-1" />{tr("Copy to…")}</button>
          <button data-testid="shelf-sel-delete" onClick={() => { const ids = [...sel]; setRecords((rs) => S.trashNotes(rs, ids)); setSel(null); setUndo({ text: tr("Moved to the trash"), run: () => setRecords((rs) => S.restoreNotes(rs, ids)) }); }}
            className="px-4 py-2 rounded-xl bg-slate-800 text-red-300 text-sm"><Trash2 size={14} className="inline me-1" />{tr("Delete")}</button>
        </div>) : !sel ? fab(() => newNote(book.id), "shelf-new-note") : null}
      {selPick ? (
        <Sheet title={selPick === "move" ? tr("Move to…") : tr("Copy to…")} close={() => setSelPick(null)} testid="shelf-pick-book">
          <div className="grid grid-cols-3 gap-3">{shelf.books.map((b) => (
            <button key={b.id} data-testid="shelf-pick" onClick={() => {
              const ids = [...sel];
              if (selPick === "move") setRecords((rs) => S.moveNotes(rs, ids, b.id));
              else setRecords((rs) => [...rs.filter((r) => sel.has(r.id)).map((r, i) => S.copyNote(r, b.id, Date.now() + i)), ...rs]);
              flash(selPick === "move" ? tr("Moved to «{name}»", { name: bookName(b) }) : tr("Copied to «{name}»", { name: bookName(b) }));
              setSelPick(null); setSel(null); }} className="text-center">
              <Cover cover={b.cover} /><span className="block text-xs text-slate-200 truncate mt-1" dir="auto">{bookName(b)}</span></button>))}</div>
        </Sheet>) : null}
    </div>);
  } else {
    body = (<div data-testid="shelf-home">
      {header(tr("Shelf"),
        <button onClick={() => setView("books")} aria-label={tr("Menu")} className={ib} data-testid="shelf-menu"><Menu size={22} /></button>,
        <><button onClick={() => setView("reminders")} aria-label={tr("Reminders")} className={ib + " relative"} data-testid="shelf-alarm"><AlarmClock size={21} />{ups.length ? <span className="absolute top-1.5 end-1.5 w-2 h-2 rounded-full bg-red-500" /> : null}</button>
          <button onClick={() => { setQ(""); setView("search"); }} aria-label={tr("Search")} className={ib} data-testid="shelf-search-open"><Search size={21} /></button>
          <button onClick={() => setSheet({ kind: "new" })} aria-label={tr("New book")} className={ib} data-testid="shelf-add"><Plus size={22} /></button>
          <button onClick={() => setSheet({ kind: "shelfmore" })} aria-label={tr("More")} className={ib} data-testid="shelf-more"><MoreVertical size={21} /></button></>)}
      {reorderOn ? <div className="flex items-center gap-2 mb-3 text-xs text-teal-300"><span className="flex-1">{tr("Move books with the arrows")}</span><button onClick={() => setReorderOn(false)} data-testid="shelf-reorder-done" className="px-3 py-1 rounded-lg bg-teal-500 text-slate-950 font-semibold">{tr("Done")}</button></div> : null}
      <div className={prefs.view === "list" ? "grid grid-cols-4 gap-x-3 gap-y-4 pb-28" : "grid grid-cols-2 gap-x-8 gap-y-6 px-3 pb-28"} data-testid="shelf-grid">
        {books.map((b, i) => (
          <div key={b.id} className="min-w-0" data-testid="shelf-book-tile">
            <button className="block w-full" onClick={() => (reorderOn ? null : setBookId(b.id))}
              onContextMenu={(e) => { e.preventDefault(); setSheet({ kind: "more", id: b.id }); }}>
              <Cover cover={b.cover} testid="shelf-cover" />
            </button>
            {reorderOn ? (
              <div className="flex justify-center gap-3 mt-1">
                <button disabled={!i} onClick={() => setShelf((s) => S.moveBook(s, b.id, -1))} aria-label={tr("Move earlier")} data-testid="shelf-move-up" className="p-1 text-slate-200 disabled:opacity-30">{getLang() === "ar" ? <ArrowUp size={18} className="rotate-90" /> : <ArrowUp size={18} className="-rotate-90" />}</button>
                <button disabled={i === shelf.books.length - 1} onClick={() => setShelf((s) => S.moveBook(s, b.id, 1))} aria-label={tr("Move later")} data-testid="shelf-move-down" className="p-1 text-slate-200 disabled:opacity-30">{getLang() === "ar" ? <ArrowDown size={18} className="rotate-90" /> : <ArrowDown size={18} className="-rotate-90" />}</button>
              </div>) : null}
            <p className="text-center text-[15px] text-slate-100 mt-2 truncate" dir="auto" data-testid="shelf-book-title">{bookName(b)}</p>
            <p className="text-center text-[11px] text-slate-500" data-testid="shelf-book-count">{tr("{n} notes", { n: counts[b.id] || 0 })}</p>
          </div>))}
      </div>
      {!shelf.books.length ? <p className="text-sm text-slate-500 text-center mt-6">{tr("Your shelf is empty. Tap + to make your first book.")}</p> : null}
      {fab(() => setSheet({ kind: "new" }), "shelf-fab")}
    </div>);
  }

  const sb = sheet && sheet.id ? shelf.books.find((b) => b.id === sheet.id) : null;
  const row = "w-full flex items-center gap-3 px-2 py-3 text-start text-slate-100 border-b border-slate-800";
  return (
    <div className="max-w-3xl mx-auto px-3 pt-2 min-h-[70vh]" data-testid="shelf">
      {body}
      {view === "books" ? (
        <Sheet title={tr("Your books")} close={() => setView(null)} testid="shelf-books-menu">
          {shelf.books.map((b) => <button key={b.id} className={row} onClick={() => { setView(null); setBookId(b.id); }}><div className="w-8"><Cover cover={b.cover} /></div><span className="flex-1 truncate" dir="auto">{bookName(b)}</span><span className="text-xs text-slate-500">{counts[b.id] || 0}</span></button>)}
        </Sheet>) : null}
      {sheet && sheet.kind === "new" ? (
        <Sheet title={tr("New book")} close={() => setSheet(null)} testid="shelf-new-book">
          <BookForm shelf={shelf} flash={flash} done={(name, cover) => { const r = S.addBook(shelf, name, cover); setShelf(r.shelf); setSheet(null); flash(tr("Book created")); }} />
        </Sheet>) : null}
      {sheet && sheet.kind === "edit" && sb ? (
        <Sheet title={tr("Edit book")} close={() => setSheet(null)} testid="shelf-edit-book">
          <BookForm shelf={shelf} flash={flash} init={sb} done={(name, cover) => { let s = shelf; if (name !== bookName(sb)) s = S.renameBook(s, sb.id, name); s = S.setCover(s, sb.id, cover); setShelf(s); setSheet(null); }} />
        </Sheet>) : null}
      {sheet && sheet.kind === "more" && sb ? (
        <Sheet title={bookName(sb)} close={() => setSheet(null)} testid="shelf-book-menu">
          <button className={row} data-testid="shelf-edit" onClick={() => setSheet({ kind: "edit", id: sb.id })}><BookOpen size={18} />{tr("Rename or change cover")}</button>
          <button className={row} onClick={() => { setSheet(null); setReorderOn(true); setBookId(null); }}><ArrowUp size={18} />{tr("Reorder books")}</button>
          {S.TEMPLATES.map((t) => <button key={t.id} className={row} data-testid="shelf-template" onClick={() => { const n = S.makeNote({ book: sb.id, title: t.title ? tr(t.title) : "", text: tr(t.text) }); setRecords((rs) => [n, ...rs]); setSheet(null); setBookId(sb.id); setNoteId(n.id); }}><Plus size={18} />{tr("New: {name}", { name: tr(t.en) })}</button>)}
          <button className={row} data-testid="shelf-dup-book" onClick={() => { const r = S.duplicateBook(shelf, records, sb.id); setShelf(r.shelf); setRecords(() => r.records); setSheet(null); setBookId(null); flash(tr("Book duplicated")); }}><Copy size={18} />{tr("Duplicate book")}</button>
          <button className={row} data-testid="shelf-merge" onClick={() => setSheet({ kind: "merge", id: sb.id })}><Folder size={18} />{tr("Merge into another book")}</button>
          <button className={row} data-testid="shelf-import" onClick={() => { setSheet(null); setBookId(sb.id); setTimeout(() => importRef.current && importRef.current.click(), 50); }}><Download size={18} className="rotate-180" />{tr("Import a text file")}</button>
          <button className={row} onClick={() => { exportBook(sb); setSheet(null); }} data-testid="shelf-export"><Download size={18} />{tr("Export as a text file")}</button>
          <button className={row + " text-red-300"} data-testid="shelf-delete-book" onClick={() => deleteBk(sb.id)}><Trash2 size={18} />{tr("Delete book")}</button>
        </Sheet>) : null}
      {sheet && sheet.kind === "merge" && sb ? (
        <Sheet title={tr("Merge «{name}» into…", { name: bookName(sb) })} close={() => setSheet(null)} testid="shelf-merge-sheet">
          <div className="grid grid-cols-3 gap-3">{shelf.books.filter((b) => b.id !== sb.id).map((b) => (
            <button key={b.id} data-testid="shelf-pick" className="text-center" onClick={async () => {
              if (!(await askConfirm(tr("Move every note of «{a}» into «{b}» and remove «{a}»?", { a: bookName(sb), b: bookName(b) }), { yes: "Merge" }))) return;
              const r = S.mergeBooks(shelf, records, sb.id, b.id); setShelf(r.shelf); setRecords(() => r.records); setSheet(null); setBookId(null); flash(tr("Books merged")); }}>
              <Cover cover={b.cover} /><span className="block text-xs text-slate-200 truncate mt-1" dir="auto">{bookName(b)}</span></button>))}</div>
        </Sheet>) : null}
      <input ref={importRef} type="file" accept=".txt,.md,text/plain,text/markdown" className="hidden" data-testid="shelf-import-file" onChange={(e) => { importFile(e.target.files && e.target.files[0]); e.target.value = ""; }} />
      {sheet && sheet.kind === "shelfmore" ? (
        <Sheet title={tr("Shelf")} close={() => setSheet(null)} testid="shelf-shelf-menu">
          <button className={row} data-testid="shelf-reorder" onClick={() => { setSheet(null); setPref("bookSort", "manual"); setReorderOn(true); }}><ArrowUp size={18} />{tr("Reorder books")}</button>
          <div className={row}><span className="flex-1">{tr("Sort books")}</span>
            <select value={prefs.bookSort || "manual"} onChange={(e) => setPref("bookSort", e.target.value)} data-testid="shelf-book-sort" className="bg-slate-950 border border-slate-800 rounded-lg text-xs px-2 py-1">
              <option value="manual">{tr("My order")}</option><option value="name">{tr("Name")}</option><option value="notes">{tr("Most notes")}</option></select></div>
          <button className={row} data-testid="shelf-view-toggle" onClick={() => { setPref("view", prefs.view === "list" ? "grid" : "list"); setSheet(null); }}><BookOpen size={18} />{prefs.view === "list" ? tr("Big covers") : tr("Small covers")}</button>
          <button className={row} data-testid="shelf-open-archive" onClick={() => { setSheet(null); setView("archive"); }}><Download size={18} />{tr("Archive")}</button>
          <button className={row} data-testid="shelf-open-trash" onClick={() => { setSheet(null); setView("trash"); }}><Trash2 size={18} />{tr("Trash")}</button>
          {shelf.books.map((b) => <button key={b.id} className={row} onClick={() => setSheet({ kind: "more", id: b.id })} data-testid="shelf-manage"><div className="w-6"><Cover cover={b.cover} /></div><span className="flex-1 truncate" dir="auto">{tr("Manage «{name}»", { name: bookName(b) })}</span></button>)}
        </Sheet>) : null}
      {rec ? (
        <NoteEditor key={rec.id} rec={rec} shelf={shelf} flash={flash}
          save={({ title, text, photos }) => upd(rec.id, (r) => { const e = S.editNote(r, { title, text }); return photos ? { ...e, meta: { ...e.meta, photos } } : e; })}
          close={() => { setNoteId(null); if (!records.find((r) => r.id === rec.id)) return; }}
          remove={() => deleteNote(rec.id)}
          togglePin={() => upd(rec.id, (r) => ({ ...r, pinned: !r.pinned }))}
          setReminder={(at) => setReminder(records.find((r) => r.id === rec.id) || rec, at)}
          moveTo={(bid) => { setRecords((rs) => S.moveNotes(rs, [rec.id], bid)); setBookId(bid); flash(tr("Moved to «{name}»", { name: bookName(shelf.books.find((b) => b.id === bid)) })); }}
          copyTo={(bid) => { setRecords((rs) => [S.copyNote(rec, bid), ...rs]); flash(tr("Copied to «{name}»", { name: bookName(shelf.books.find((b) => b.id === bid)) })); }}
          patch={(mp) => upd(rec.id, (r) => ({ ...r, meta: { ...(r.meta || {}), ...mp } }))}
          archive={() => { const on = !(rec.meta && rec.meta.archived); setRecords((rs) => S.archiveNotes(rs, [rec.id], on)); if (on) { setNoteId(null); setUndo({ text: tr("Archived"), run: () => setRecords((rs) => S.archiveNotes(rs, [rec.id], false)) }); } }}
          duplicate={() => { const c = S.copyNote(records.find((r) => r.id === rec.id) || rec, S.bookOf(rec, shelf)); setRecords((rs) => [c, ...rs]); setNoteId(c.id); flash(tr("Duplicated")); }}
          exportNote={({ title, text }) => saveText(fileName(title), `# ${title || ""}\n\n${text}\n`)}
          openInMind={() => { setNoteId(null); openInMind(records.find((r) => r.id === rec.id) || rec); }} />
      ) : null}
      {undo ? (
        <div className="fixed inset-x-0 z-[65] flex justify-center px-4" style={{ bottom: "calc(140px + env(safe-area-inset-bottom))" }} data-testid="shelf-undo">
          <div className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 shadow-xl">
            <span className="text-sm text-slate-100">{undo.text}</span>
            <button onClick={() => { undo.run(); setUndo(null); }} data-testid="shelf-undo-btn" className="text-sm font-semibold text-teal-300"><Undo2 size={14} className="inline me-1" />{tr("Undo")}</button>
          </div>
        </div>) : null}
    </div>
  );
}
