/* ---- v6.40 Recall (agent C): the page. One search box over everything on the phone (lookback.js does the finding).
   Add screenshots → their text is read on the phone (ML Kit) and they are kept in Mind as photos; "Keep my notifications"
   → the phone keeps them 30 days (RecallLog.kt, never SMS). Nothing leaves the phone. */
import React, { useState, useEffect, useMemo } from "react";
import { tr, getLang, dateLocale } from "./i18n.js";
import { recallDocs, recallSearch, shotTitle, KINDS } from "./lookback.js";
import { loadChats } from "./chat.jsx";
import { loadArtifacts } from "./spaces.js";
import { keepPicture, thumbGet } from "./mind-ui.jsx";
import { Search, ImagePlus, Bell, Loader2, X, Copy, Trash2, ShieldCheck } from "lucide-react";

const card = "rounded-2xl border border-slate-800 bg-slate-900";
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
  return u ? <img src={u} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" /> : <div className="w-14 h-14 rounded-lg bg-slate-800 shrink-0" />;
}

export function RecallPage({ memory = [], remember, native, readText, openRec, openChat, openArtifact, flash }) {
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
  const res = useMemo(() => recallSearch(only ? docs.filter((d) => d.kind === only) : docs, q), [docs, q, only]);
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
      className={`text-[11px] px-2.5 py-1 rounded-full border shrink-0 ${only === k ? "border-teal-600 text-teal-200 bg-teal-500/10" : "border-slate-700 text-slate-400"}`}>{label}</button>
  );

  return (
    <div className="space-y-3" data-testid="recall-page">
      <div className={card + " p-3 space-y-2"}>
        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3">
          <Search size={16} className="text-slate-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} dir="auto" data-testid="recall-q" className="flex-1 bg-transparent py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none"
            placeholder={tr("Find anything… e.g. the wifi password from a screenshot, the address Ahmed sent")} />
          {q ? <button onClick={() => setQ("")} className="text-slate-500"><X size={15} /></button> : null}
        </div>
        <div className="att-chips flex gap-1.5 overflow-x-auto">
          {chip(null, tr("All"))}
          {Object.keys(KINDS).filter((k) => counts[k]).map((k) => chip(k, (ar ? KINDS[k].ar : tr(KINDS[k].en)) + " " + counts[k]))}
        </div>
        {q && (res.ask.from != null || res.ask.kind || res.ask.app) ? (
          <p className="text-[11px] text-slate-500" data-testid="recall-understood">{tr("Looking in")}: {[res.ask.kind ? (ar ? KINDS[res.ask.kind].ar : tr(KINDS[res.ask.kind].en)) : null, res.ask.from != null ? new Date(res.ask.from).toLocaleDateString(dateLocale(), { day: "numeric", month: "short" }) + " – " + new Date(res.ask.to - 1).toLocaleDateString(dateLocale(), { day: "numeric", month: "short" }) : null].filter(Boolean).join(" · ")}</p>
        ) : null}
      </div>

      <div className="space-y-2" data-testid="recall-results">
        {res.hits.length ? res.hits.slice(0, 40).map(({ doc: d, snip }) => (
          <button key={d.id} onClick={() => tap(d)} data-testid="recall-hit" className={card + " w-full p-2.5 flex gap-2.5 text-start"}>
            {d.kind === "photo" && d.thumb ? <Thumb id={d.thumb} /> : null}
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-slate-500">{ar ? KINDS[d.kind].ar : tr(KINDS[d.kind].en)}{d.app ? " · " + d.app : ""}{d.ts ? " · " + when(d.ts) : ""}</p>
              <p className="text-sm text-white truncate" dir="auto">{d.title || snip}</p>
              {snip && snip !== d.title ? <p className="text-[12px] text-slate-400 line-clamp-2" dir="auto">{snip}</p> : null}
            </div>
          </button>
        )) : <p className="text-sm text-slate-500 text-center py-6" data-testid="recall-none">{docs.length ? tr("Nothing found — try other words, or fewer") : tr("Nothing to search yet — add screenshots or keep your notifications below")}</p>}
      </div>

      <div className={card + " p-3 space-y-2.5"}>
        <label className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer" data-testid="recall-add">
          {busy ? <Loader2 size={17} className="animate-spin text-teal-300" /> : <ImagePlus size={17} className="text-teal-300" />}
          <span className="flex-1">{busy || tr("Add screenshots and photos")}</span>
          <input type="file" accept="image/*" multiple className="hidden" disabled={!!busy} data-testid="recall-add-file" onChange={(e) => { addShots(e.target.files); e.target.value = ""; }} />
        </label>
        <p className="text-[11px] text-slate-500">{tr("Their text is read on the phone, so “the receipt from Carrefour” finds them. They are kept in Mind.")}</p>
        {native && native.recallNotesOn ? (
          <>
            <button onClick={toggleNotes} className="w-full flex items-center gap-2 text-sm text-slate-200" data-testid="recall-notes-toggle">
              <Bell size={17} className="text-teal-300" /><span className="flex-1 text-start">{tr("Keep my notifications for 30 days")}</span>
              <span className={`w-9 h-5 rounded-full relative ${notesOn ? "bg-teal-500" : "bg-slate-700"}`}><span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white ${notesOn ? "end-0.5" : "start-0.5"}`} /></span>
            </button>
            <p className="text-[11px] text-slate-500">{tr("WhatsApp, email, deliveries, banks — so you can find what someone sent. Never SMS. Turning it off forgets them.")}{notesOn && !access ? " " + tr("Needs Notification access (the same switch as Money).") : ""}</p>
          </>
        ) : null}
        <p className="text-[11px] text-emerald-300/80 flex items-center gap-1.5"><ShieldCheck size={13} />{tr("Everything stays on this phone.")}</p>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[70] bg-black/60 flex items-end" onClick={() => setOpen(null)}>
          <div className="w-full bg-slate-900 rounded-t-2xl p-4 space-y-3 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="recall-open">
            <p className="text-[11px] text-slate-500">{d0(open, ar)}{open.app ? " · " + open.app : ""} · {when(open.ts)}</p>
            <p className="text-white font-medium" dir="auto">{open.title}</p>
            <p className="text-sm text-slate-200 whitespace-pre-wrap" dir="auto" style={{ userSelect: "text" }}>{open.text}</p>
            <div className="flex gap-2">
              <button onClick={() => { try { navigator.clipboard.writeText(open.text); flash && flash(tr("Copied")); } catch (e) {} }} className="flex-1 px-3 py-2 rounded-xl border border-slate-700 text-slate-200 text-sm flex items-center justify-center gap-1.5"><Copy size={15} />{tr("Copy")}</button>
              {open.kind === "note" ? <button onClick={() => forget(open)} data-testid="recall-forget" className="px-3 py-2 rounded-xl border border-slate-700 text-rose-300 text-sm flex items-center gap-1.5"><Trash2 size={15} />{tr("Forget")}</button> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
const d0 = (d, ar) => (ar ? KINDS[d.kind].ar : tr(KINDS[d.kind].en));
