/* ---- v6.40 Recall (agent C): the page. One search box over everything on the phone (lookback.js does the finding).
   Add screenshots → their text is read on the phone (ML Kit) and they are kept in Mind as photos; "Keep my notifications"
   → the phone keeps them 30 days (RecallLog.kt, never SMS). Nothing leaves the phone. */
import React, { useState, useEffect, useMemo } from "react";
import { recallStats } from "./learning-report.js";   // v7.7 the Recall index
import { RecallReport } from "./learning-report-ui.jsx";
import { tr, getLang, dateLocale } from "./i18n.js";
import { recallDocs, recallSearch, shotTitle, KINDS } from "./lookback.js";
import { loadChats } from "./chat.jsx";
import { loadArtifacts } from "./spaces.js";
import { keepPicture, thumbGet } from "./mind-ui.jsx";
import { Search, ImagePlus, Bell, Loader2, X, Copy, Trash2, ShieldCheck, Sparkles, Download } from "lucide-react";
import * as M from "./meaning.js";
import { card as kCard, btnP, btnS, btnDanger, chip as kChip } from "./ui-kit.jsx";

const card = kCard;
const readJson = (f) => { try { const v = JSON.parse(f() || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } };

// a picture file → { data (base64 JPEG, at most 1600 px), media }
function shrinkFile(file, px = 1600) {
  return new Promise((ok, bad) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => { const k = Math.min(1, px / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); ok({ data: c.toDataURL("image/jpeg", 0.88).split(",")[1], media: "image/jpeg" }); };
    img.onerror = () => { URL.revokeObjectURL(url); bad(new Error("bad image")); };
    img.src = url;
  });
}

function Thumb({ id }) {
  const [u, setU] = useState(null);
  useEffect(() => { let on = true; thumbGet(id).then((x) => { if (on) setU(x); }); return () => { on = false; }; }, [id]);
  return u ? <img src={u} alt="" className="w-14 h-14 rounded-[14px] object-cover shrink-0" /> : <div className="w-14 h-14 rounded-[14px] bg-[var(--c-surf-2)] shrink-0" />;
}

/** v6.45 Recall phase 2: the meaning model's state and its download (Embedder.kt). */
function useMeaning(native, call) {
  const read = () => { try { return native && native.embedStatus ? JSON.parse(native.embedStatus()) : null; } catch (e) { return null; } };
  const [st, setSt] = useState(read);
  const [dl, setDl] = useState(null);          // { pct, detail } while downloading
  const install = async (flash) => {
    if (!call) return; setDl({ pct: 0, detail: "" });
    try { await call("embedInstall", {}, (pct, stage, detail) => setDl({ pct, detail })); flash && flash(tr("Search by meaning is ready")); }
    catch (e) { flash && flash(tr(e.message || "Couldn't download")); }
    setDl(null); setSt(read());
  };
  const stop = () => { try { native.cancel(window.__attuneNativeLastId && window.__attuneNativeLastId()); } catch (e) {} };
  const remove = async () => { try { native.embedRemove(); } catch (e) {} await M.clearVectors(); setSt(read()); };
  return { st, dl, install, stop, remove, on: !!(st && st.installed) };
}

/** v7.7 (Gemini's Area 5): the words that matched, highlighted in the snippet. */
function marked(text, q) {
  const words = String(q || "").toLowerCase().split(/\s+/).filter((w) => w.length >= 3).slice(0, 6);
  if (!words.length) return text;
  const rx = new RegExp("(" + words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "ig");
  return String(text).split(rx).map((part, i) => (i % 2 ? <mark key={i} className="rounded px-0.5 font-bold" style={{ background: "var(--c-soft)", color: "var(--c-acc)", boxShadow: "inset 0 -1px 0 var(--c-acc)" }}>{part}</mark> : part));
}
export function RecallPage({ memory = [], remember, native, call, readText, openRec, openChat, openArtifact, flash }) {
  const ar = getLang() === "ar";
  const [q, setQ] = useState("");
  const [only, setOnly] = useState(null);
  const [busy, setBusy] = useState(null);       // "Reading 3 of 12…"
  const [notesOn, setNotesOn] = useState(() => { try { return !!(native && native.recallNotesIsOn && native.recallNotesIsOn()); } catch (e) { return false; } });
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(null);       // a notification / payment opened in full
  const access = (() => { try { return !native || !native.payAccess || native.payAccess(); } catch (e) { return true; } })();
  const docs = useMemo(() => recallDocs({
    memory, chats: loadChats(), pages: loadArtifacts(),
    notes: native && native.recallNotes ? readJson(() => native.recallNotes()) : [],
    pays: native && native.payQueue ? readJson(() => native.payQueue()) : [],
  }), [memory, tick]);
  const words = useMemo(() => recallSearch(only ? docs.filter((d) => d.kind === only) : docs, q), [docs, q, only]);
  // v6.45: by meaning too, when the model is on the phone — the things get their numbers once (in the background, newest
  // first), the question gets its own, and the nearest are merged with the word hits.
  const mean = useMeaning(native, call);
  const [vecs, setVecs] = useState(null), [indexing, setIndexing] = useState(null), [qv, setQv] = useState(null);
  useEffect(() => { if (!mean.on || !call) return; let live = true;
    (async () => { const have = await M.loadVectors(); if (!live) return; setVecs(have);
      const todo = M.missing(docs.slice().sort((a, b) => b.ts - a.ts).slice(0, 1500), have);
      for (let i = 0; i < todo.length && live; i += 8) {
        setIndexing(tr("Understanding {a} of {b}…", { a: Math.min(i + 8, todo.length), b: todo.length }));
        try { const part = todo.slice(i, i + 8), r = await call("embed", { texts: part.map(M.textOf) }), got = (r && r.vecs) || [];
          const pairs = part.map((d, j) => [M.keyOf(d), got[j] ? Float32Array.from(got[j]) : null]).filter((x) => x[1]);
          pairs.forEach(([k, v]) => have.set(k, v)); await M.saveVectors(pairs); if (live) setVecs(new Map(have));
        } catch (e) { break; }
      }
      if (live) setIndexing(null);
      M.saveVectors([], new Set(docs.map(M.keyOf)));   // forget the numbers of things that are gone
    })();
    return () => { live = false; }; }, [mean.on, docs]);
  useEffect(() => { setQv(null); const s = res0Terms(q); if (!mean.on || !call || s.length < 3) return; let live = true;
    const t = setTimeout(async () => { try { const r = await call("embed", { texts: [s] }); if (live && r && r.vecs && r.vecs[0]) setQv(Float32Array.from(r.vecs[0])); } catch (e) {} }, 450);
    return () => { live = false; clearTimeout(t); }; }, [q, mean.on]);
  const res = useMemo(() => {
    if (!qv || !vecs) return words;
    const pool = only ? docs.filter((d) => d.kind === only) : docs;
    const a = words.ask, inAsk = (d) => (a.from == null || (d.ts >= a.from && d.ts < a.to)) && (!a.kind || d.kind === a.kind);
    const near = M.nearest(pool.filter(inAsk), (d) => vecs.get(M.keyOf(d)), qv);
    return { ask: a, hits: M.fuseHits(words.hits, near, { snip: (d) => String(d.text || d.title || "").replace(/\s+/g, " ").slice(0, 160) }) };
  }, [words, qv, vecs]);
  const counts = useMemo(() => { const n = {}; for (const d of docs) n[d.kind] = (n[d.kind] || 0) + 1; return n; }, [docs]);

  const addShots = async (files) => {
    const list = [...(files || [])].filter((f) => /^image\//.test(f.type)).slice(0, 60);
    let n = 0, found = 0;
    for (const f of list) {
      n++; setBusy(tr("Reading {a} of {b}…", { a: n, b: list.length }));
      try {
        const img = await shrinkFile(f);
        const r = readText ? await readText(img.data) : null;
        const text = String((r && r.text) || "").trim();
        if (text) found++;
        const rec = remember({ kind: "photo", title: shotTitle(text, f.name ? f.name.replace(/\.\w+$/, "") : tr("Screenshot")), text: text || f.name || "", tags: ["screenshot"],
          meta: { thumb: true, mindKind: "photo", recall: true }, ts: f.lastModified || Date.now() });
        if (rec && rec.id) await keepPicture(rec.id, img);
      } catch (e) {}
    }
    setBusy(null); setTick((t) => t + 1);
    flash && flash(tr("{n} added — text read in {k}", { n: list.length, k: found }));
  };
  const toggleNotes = () => {
    const on = !notesOn;
    if (on && !access) { try { native.openPayAccess(); } catch (e) {} flash && flash(tr("Turn on Notification access for Attune, then come back")); }
    try { native.recallNotesOn(on); } catch (e) {}
    setNotesOn(on); setTick((t) => t + 1);
    if (!on) flash && flash(tr("Kept notifications forgotten"));
  };
  const tap = (d) => {
    if (d.open && d.open.mode === "memory") { const r = memory.find((x) => x.id === d.open.id); if (r && openRec) openRec(r); return; }
    if (d.open && d.open.mode === "chat") { openChat && openChat(d.open.id); return; }
    if (d.open && d.open.artifact) { openArtifact && openArtifact(d.open.artifact); return; }
    setOpen(d);
  };
  const forget = (d) => { try { native.recallForget(JSON.stringify([d.raw])); } catch (e) {} setOpen(null); setTick((t) => t + 1); };
  const when = (ts) => { try { return new Date(ts).toLocaleDateString(dateLocale(), { day: "numeric", month: "short" }) + " " + new Date(ts).toLocaleTimeString(dateLocale(), { hour: "numeric", minute: "2-digit" }); } catch (e) { return ""; } };
  const chip = (k, label) => (
    <button key={k || "all"} onClick={() => setOnly(k)} data-testid={"recall-kind-" + (k || "all")}
      className={kChip(only === k) + " shrink-0"}>{label}</button>
  );

  return (
    <div className="calm space-y-3 text-[var(--c-ink)]" data-testid="recall-page">
      <div className={card + " p-4 space-y-2.5"}>
        <div className="flex items-center gap-2 min-h-[48px] bg-[var(--c-bg)] border border-[var(--c-ln)] rounded-[16px] ps-3.5 pe-1 focus-within:border-[var(--c-acc)] transition-colors duration-150">
          <Search size={16} className="text-[var(--c-mut)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} dir="auto" data-testid="recall-q" className="flex-1 min-w-0 bg-transparent py-2.5 text-[15px] font-semibold text-[var(--c-ink)] placeholder:text-[var(--c-mut)] placeholder:font-normal focus:outline-none"
            placeholder={tr("Find anything… e.g. the wifi password from a screenshot, the address Ahmed sent")} />
          {q ? <button onClick={() => setQ("")} className="w-11 h-11 grid place-items-center rounded-[14px] text-[var(--c-mut)]"><X size={16} /></button> : null}
        </div>
        <div className="att-chips flex gap-1.5 overflow-x-auto pb-1">
          {chip(null, tr("All"))}
          {Object.keys(KINDS).filter((k) => counts[k]).map((k) => chip(k, (ar ? KINDS[k].ar : tr(KINDS[k].en)) + " " + counts[k]))}
        </div>
        {q && (res.ask.from != null || res.ask.kind || res.ask.app) ? (
          <p className="text-[11.5px] font-semibold text-[var(--c-mut)]" data-testid="recall-understood">{tr("Looking in")}: {[res.ask.kind ? (ar ? KINDS[res.ask.kind].ar : tr(KINDS[res.ask.kind].en)) : null, res.ask.from != null ? new Date(res.ask.from).toLocaleDateString(dateLocale(), { day: "numeric", month: "short" }) + " – " + new Date(res.ask.to - 1).toLocaleDateString(dateLocale(), { day: "numeric", month: "short" }) : null].filter(Boolean).join(" · ")}</p>
        ) : null}
      </div>

      <div className="space-y-2" data-testid="recall-results">
        {res.hits.length ? res.hits.slice(0, 40).map(({ doc: d, snip, by }) => (
          <button key={d.id} onClick={() => tap(d)} data-testid="recall-hit" className={card + " w-full p-3 flex gap-3 text-start hover:border-[var(--c-acc)]"}>
            {d.kind === "photo" && d.thumb ? <Thumb id={d.thumb} /> : null}
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold tabular-nums text-[var(--c-mut)]">{ar ? KINDS[d.kind].ar : tr(KINDS[d.kind].en)}{d.app ? " · " + d.app : ""}{d.ts ? " · " + when(d.ts) : ""}{by === "meaning" ? <span className="text-[var(--c-acc)]" data-testid="recall-by-meaning"> · {tr("by meaning")}</span> : null}</p>
              <p className="text-[14.5px] font-extrabold text-[var(--c-ink)] truncate" dir="auto">{d.title || snip}</p>
              {snip && snip !== d.title ? <p className="text-[12px] text-[var(--c-mut)] line-clamp-2" dir="auto">{marked(snip, q)}</p> : null}
            </div>
          </button>
        )) : <p className={card + " text-sm text-[var(--c-mut)] text-center p-6 m-0"} data-testid="recall-none">{docs.length ? tr("Nothing found — try other words, or fewer") : tr("Nothing to search yet — add screenshots or keep your notifications below")}</p>}
      </div>

      {!q && docs.length ? <RecallReport s={recallStats(docs)} labels={Object.fromEntries(Object.keys(KINDS).map((k) => [k, ar ? KINDS[k].ar : tr(KINDS[k].en)]))} notesOn={native && native.recallNotesOn ? notesOn : null} /> : null}
      <div className={card + " p-4 space-y-3"}>
        <label className="flex items-center gap-2.5 min-h-[44px] text-[14px] font-bold text-[var(--c-ink)] cursor-pointer" data-testid="recall-add">
          {busy ? <Loader2 size={17} className="animate-spin text-[var(--c-acc)]" /> : <ImagePlus size={17} className="text-[var(--c-acc)]" />}
          <span className="flex-1">{busy || tr("Add screenshots and photos")}</span>
          <input type="file" accept="image/*" multiple className="hidden" disabled={!!busy} data-testid="recall-add-file" onChange={(e) => { addShots(e.target.files); e.target.value = ""; }} />
        </label>
        <p className="text-[11px] text-[var(--c-mut)]">{tr("Their text is read on the phone, so “the receipt from Carrefour” finds them. They are kept in Mind.")}</p>
        {native && native.recallNotesOn ? (
          <>
            <button onClick={toggleNotes} className="w-full min-h-[44px] flex items-center gap-2.5 text-[14px] font-bold text-[var(--c-ink)]" data-testid="recall-notes-toggle">
              <Bell size={17} className="text-[var(--c-acc)]" /><span className="flex-1 text-start">{tr("Keep my notifications for 30 days")}</span>
              <span className={`w-9 h-5 rounded-full relative shrink-0 ${notesOn ? "bg-[var(--c-acc)]" : "bg-[var(--c-ln)]"}`}><span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm ${notesOn ? "end-0.5" : "start-0.5"}`} /></span>
            </button>
            <p className="text-[11px] text-[var(--c-mut)]">{tr("WhatsApp, email, deliveries, banks — so you can find what someone sent. Never SMS. Turning it off forgets them.")}{notesOn && !access ? " " + tr("Needs Notification access (the same switch as Money).") : ""}</p>
          </>
        ) : null}
        {native && native.embedStatus ? <div className="border-t border-[var(--c-ln)] pt-2.5 space-y-1.5" data-testid="recall-meaning">
          <div className="flex items-center gap-2.5 min-h-[44px] text-[14px] font-bold text-[var(--c-ink)]"><Sparkles size={17} className="text-[var(--c-acc)]" /><span className="flex-1">{tr("Search by meaning (Arabic ↔ English)")}</span>
            {mean.on ? <span className="inline-flex items-center text-[11px] font-extrabold rounded-full px-2.5 py-0.5 bg-[var(--c-soft)] text-[var(--c-acc)] border border-[var(--c-acc)]/30 tabular-nums" data-testid="recall-meaning-on">{indexing || tr("On")}</span> : null}</div>
          <p className="text-[11px] text-[var(--c-mut)]">{tr("«فاتورة الكهربا» finds “electricity bill”, “where did I park” finds «ركنت العربية». A {mb} MB model, downloaded once (Wi-Fi), runs on the phone.", { mb: Math.round(M.MODEL.bytes / 1e6) })}</p>
          {mean.dl ? <div className="space-y-1"><div className="h-1.5 rounded-full bg-[var(--c-ln)]"><div className="h-1.5 rounded-full bg-[var(--c-acc)]" style={{ width: (mean.dl.pct || 0) + "%" }} /></div>
            <div className="flex items-center gap-2 text-[11px] tabular-nums text-[var(--c-mut)]"><span className="flex-1">{mean.dl.detail}</span><button onClick={mean.stop} className="min-h-[44px] px-2 font-bold text-[var(--c-ink)] underline" data-testid="recall-meaning-stop">{tr("Stop")}</button></div></div>
            : mean.on ? <button onClick={mean.remove} className={btnDanger} data-testid="recall-meaning-remove"><Trash2 size={13} />{tr("Remove the model")}</button>
            : <button onClick={() => mean.install(flash)} className={btnP} data-testid="recall-meaning-get"><Download size={15} />{tr("Download ({mb} MB)", { mb: Math.round(M.MODEL.bytes / 1e6) })}</button>}
        </div> : null}
        <p className="text-[11px] text-[var(--c-pos)] flex items-center gap-1.5"><ShieldCheck size={13} />{tr("Everything stays on this phone.")}</p>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[70] bg-black/60 flex items-end" onClick={() => setOpen(null)}>
          <div className="calm w-full bg-[var(--c-surf)] text-[var(--c-ink)] border-t border-[var(--c-ln)] rounded-t-[22px] p-4 space-y-3 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="recall-open">
            <p className="text-[11.5px] font-bold tabular-nums text-[var(--c-mut)]">{d0(open, ar)}{open.app ? " · " + open.app : ""} · {when(open.ts)}</p>
            <p className="text-[16px] text-[var(--c-ink)] font-extrabold" dir="auto">{open.title}</p>
            <p className="text-sm text-[var(--c-ink)] whitespace-pre-wrap" dir="auto" style={{ userSelect: "text" }}>{open.text}</p>
            <div className="flex gap-2">
              <button onClick={() => { try { navigator.clipboard.writeText(open.text); flash && flash(tr("Copied")); } catch (e) {} }} className={btnS + " flex-1"}><Copy size={15} />{tr("Copy")}</button>
              {open.kind === "note" ? <button onClick={() => forget(open)} data-testid="recall-forget" className={btnDanger}><Trash2 size={15} />{tr("Forget")}</button> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
const d0 = (d, ar) => (ar ? KINDS[d.kind].ar : tr(KINDS[d.kind].en));
// the words of a question without its filters ("last week", "screenshot") — what the meaning model should read
const res0Terms = (q) => String(q || "").trim();
