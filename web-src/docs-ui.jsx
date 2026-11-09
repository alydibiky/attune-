/* ---- v9.9.5 D1 + D2 + S1 on a Deadline Radar item (Ali picked: photos — one or many; details — ID number, visa number, CVC,
   password…; "make the vault customizable: what I want hidden and protected and what is normal, the time for each one separately,
   and an option to do S2"). Logic: docfields.js (tested). Photos: Attune's private picture store (mind-ui keepPicture), never the
   gallery. A locked row: •••• → Show (tap, or the fingerprint / screen lock) → shown for its own time, then hidden again. */
import React, { useEffect, useRef, useState } from "react";
import { ImagePlus, X, ChevronLeft, ChevronRight, Trash2, Copy, Eye, Lock, SlidersHorizontal as Settings2, Plus } from "lucide-react";
import { tr } from "./i18n.js";
import * as F from "./docfields.js";
import { keepPicture, thumbGet, thumbDel } from "./mind-ui.jsx";

const B2 = "min-h-[34px] px-2.5 rounded-[10px] border border-[var(--c-ln)] bg-[var(--c-surf)] text-[12px] font-bold inline-flex items-center gap-1";
const secsLabel = (s) => (s === 0 ? tr("until I leave") : s < 60 ? tr("{n} s", { n: s }) : tr("{n} min", { n: Math.round(s / 60) }));

/** D1: the photos of a document — add one or many, tap to open full screen, swipe (‹ ›), delete. */
export function DocPhotos({ x, onPatch, edit = true, start = -1, onClose, hideStrip = false }) {
  const [thumbs, setThumbs] = useState({}), [open, setOpen0] = useState(start), [full, setFull] = useState(""), ids = x.photos || [];
  useEffect(() => { let alive = true; (async () => { const o = {}; for (const id of ids) o[id] = await thumbGet(id); if (alive) setThumbs(o); })(); return () => { alive = false; }; }, [ids.join()]);
  useEffect(() => { if (open < 0) return setFull(""); let alive = true; (async () => { const id = ids[open]; const f = (await thumbGet(id + ":full")) || (await thumbGet(id)); if (alive) setFull(f || ""); })(); return () => { alive = false; }; }, [open]);
  const add = async (files) => {
    const got = [];
    for (const f of [...(files || [])].slice(0, 10)) {
      const url = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => ok(""); r.readAsDataURL(f); });
      if (!url) continue; const id = "radar:" + x.id + ":" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      if (await keepPicture(id, { data: url.split(",")[1], media: f.type || "image/jpeg" })) got.push(id);
    }
    if (got.length) onPatch(x.id, { photos: [...ids, ...got] });
  };
  const setOpen = (i) => { setOpen0(i); if (i < 0 && onClose) onClose(); };
  useEffect(() => { setOpen0(start); }, [start]);
  const del = (i) => { const id = ids[i]; thumbDel(id); onPatch(x.id, { photos: ids.filter((y) => y !== id) }); setOpen(-1); };
  if (!edit && !ids.length) return null;
  return <div className={hideStrip ? "" : "mt-2 flex flex-wrap gap-1.5 items-center"} data-testid={hideStrip ? "doc-photos-viewer" : "doc-photos"}>
    {hideStrip ? null : ids.map((id, i) => <button key={id} onClick={() => setOpen(i)} className="w-16 h-12 rounded-[10px] overflow-hidden border border-[var(--c-ln)] bg-[var(--c-soft)]" data-testid="doc-photo">{thumbs[id] ? <img src={thumbs[id]} alt="" className="w-full h-full object-cover" /> : null}</button>)}
    {edit && !hideStrip ? <label className={B2 + " cursor-pointer"} data-testid="doc-photo-add"><ImagePlus size={13} />{ids.length ? tr("Photo") : tr("Add photos")}
      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => add(e.target.files)} data-testid="doc-photo-file" /></label> : null}
    {open >= 0 ? <div className="fixed inset-0 z-[85] bg-black/90 flex flex-col" data-testid="doc-photo-view">
      <div className="flex items-center gap-2 p-3 text-white"><button onClick={() => setOpen(-1)} aria-label={tr("Close")} className="w-11 h-11 grid place-items-center"><X size={20} /></button>
        <span className="flex-1 text-[13px] tabular-nums">{open + 1} / {ids.length}</span>
        {edit ? <button onClick={() => del(open)} aria-label={tr("Delete")} className="w-11 h-11 grid place-items-center" data-testid="doc-photo-del"><Trash2 size={18} /></button> : null}</div>
      <div className="flex-1 min-h-0 flex items-center justify-center relative">
        {full ? <img src={full} alt="" className="max-w-full max-h-full object-contain" /> : null}
        {open > 0 ? <button onClick={() => setOpen(open - 1)} aria-label={tr("Previous")} className="absolute start-2 w-11 h-11 rounded-full bg-black/50 text-white grid place-items-center"><ChevronLeft size={20} className="rtl:-scale-x-100" /></button> : null}
        {open < ids.length - 1 ? <button onClick={() => setOpen(open + 1)} aria-label={tr("Next")} className="absolute end-2 w-11 h-11 rounded-full bg-black/50 text-white grid place-items-center" data-testid="doc-photo-next"><ChevronRight size={20} className="rtl:-scale-x-100" /></button> : null}
      </div></div> : null}
  </div>;
}

/** D2 + S1: the details — each row shown, tap-to-show or fingerprint, with its own time; Copy; add by name or by a sentence. */
export function DocDetails({ x, onPatch, unlock, edit = true }) {
  const [secrets, setSecrets] = useState(F.loadSecrets);
  const rows = F.joined(x.id, x.fields || [], secrets);
  const [shown, setShown] = useState({}), [gear, setGear] = useState(""), [adding, setAdding] = useState(false), [name, setName] = useState(""), [val, setVal] = useState(""), [say, setSay] = useState(""), [msg, setMsg] = useState("");
  const timers = useRef({});
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);
  useEffect(() => { const h = () => { if (document.visibilityState !== "visible") setShown({}); }; document.addEventListener("visibilitychange", h); return () => document.removeEventListener("visibilitychange", h); }, []);
  const save = (fields) => { const s = F.split(x.id, fields, F.loadSecrets()); F.saveSecrets(s.secrets); setSecrets(s.secrets); onPatch(x.id, { fields: s.fields }); };
  const show = async (f) => {
    if (f.lock === "finger") { try { await unlock({ title: tr("Show {n}", { n: f.name }), subtitle: x.title || "", cancel: tr("Cancel") }); } catch (e) { setMsg(tr("Not unlocked")); return; } }
    setShown((s) => ({ ...s, [f.id]: true })); clearTimeout(timers.current[f.id]);
    if (f.secs > 0) timers.current[f.id] = setTimeout(() => setShown((s) => ({ ...s, [f.id]: false })), f.secs * 1000);
  };
  const copy = async (f) => { if (F.isLocked(f) && !shown[f.id]) return show(f); try { await navigator.clipboard.writeText(f.value); setMsg(tr("Copied")); } catch (e) {} };
  const set = (id, patch) => save(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const addRow = () => { if (!name.trim()) return; save([...rows, F.newField(name, val)]); setName(""); setVal(""); setAdding(false); };
  const addSaid = () => { const got = F.readDetails(say); if (!got.length) { setMsg(tr("I couldn't read a detail — try “passport number A12345678, issued Cairo”.")); return; } save(F.mergeFields(rows, got)); setSay(""); setMsg(tr("Added {n} details", { n: got.length })); };
  const sugg = (F.SUGGEST[x.doc] || (x.kind === "expiry" ? [] : [])).filter((n) => !rows.some((r) => r.name.toLowerCase() === n.toLowerCase()));
  if (!edit && !rows.length) return null;
  return <div className="mt-2 space-y-1.5" data-testid={edit ? "doc-details" : "doc-details-view"}>
    {rows.map((f) => <div key={f.id} className="rounded-[12px] border border-[var(--c-ln)] px-2.5 py-1.5" data-testid="doc-field" data-lock={f.lock}>
      <div className="flex items-center gap-2">
        <span className="flex-1 min-w-0 text-[13px]"><b dir="auto">{tr(f.name)}</b> <span className="c-sub">·</span> <span className="tabular-nums" dir="auto" data-testid="doc-field-value">{F.isLocked(f) && !shown[f.id] ? F.masked(f) : f.value}</span></span>
        {F.isLocked(f) && !shown[f.id] ? <button onClick={() => show(f)} className={B2} data-testid="doc-field-show">{f.lock === "finger" ? <Lock size={12} /> : <Eye size={12} />}{tr("Show")}</button> : null}
        <button onClick={() => copy(f)} aria-label={tr("Copy")} className={B2 + " w-9 justify-center px-0"} data-testid="doc-field-copy"><Copy size={12} /></button>
        {edit ? <button onClick={() => setGear(gear === f.id ? "" : f.id)} aria-label={tr("Settings")} aria-expanded={gear === f.id} className={B2 + " w-9 justify-center px-0"} data-testid="doc-field-gear"><Settings2 size={12} /></button> : null}
      </div>
      {gear === f.id ? <div className="mt-1.5 space-y-1.5" data-testid="doc-field-settings">
        <div className="flex flex-wrap gap-1">{[["none", "Normal — always shown"], ["tap", "Hidden — tap to show"], ["finger", "Locked — fingerprint"]].map(([k, l]) =>
          <button key={k} onClick={() => set(f.id, { lock: k })} aria-pressed={f.lock === k} className={"min-h-[32px] px-2.5 rounded-full text-[11.5px] font-bold border " + (f.lock === k ? "bg-[var(--c-btn,var(--c-acc))] text-[var(--c-on-btn,var(--c-on-acc))] border-transparent" : "border-[var(--c-ln)]")} data-testid={"doc-lock-" + k}>{tr(l)}</button>)}</div>
        {F.isLocked(f) ? <div className="flex flex-wrap gap-1 items-center"><span className="text-[11.5px] c-sub">{tr("Show for")}</span>{F.SECS.map((s) =>
          <button key={s} onClick={() => set(f.id, { secs: s })} aria-pressed={f.secs === s} className={"min-h-[30px] px-2 rounded-full text-[11.5px] font-bold border " + (f.secs === s ? "bg-[var(--c-soft)] text-[var(--c-acc)] border-[var(--c-acc)]" : "border-[var(--c-ln)]")} data-testid={"doc-secs-" + s}>{secsLabel(s)}</button>)}</div> : null}
        <div className="flex gap-1.5"><input defaultValue={f.value} onBlur={(e) => e.target.value !== f.value && set(f.id, { value: e.target.value })} dir="auto" className="flex-1 min-w-0 min-h-[34px] rounded-[10px] border border-[var(--c-ln)] bg-[var(--c-surf)] px-2 text-[13px]" aria-label={tr("Value")} />
          <button onClick={() => save(rows.filter((r) => r.id !== f.id))} aria-label={tr("Delete")} className={B2 + " w-9 justify-center px-0"} data-testid="doc-field-del"><Trash2 size={12} /></button></div>
      </div> : null}
    </div>)}
    {edit && sugg.length ? <div className="flex flex-wrap gap-1" data-testid="doc-suggest">{sugg.map((n) => <button key={n} onClick={() => { setName(n); setAdding(true); }} className="min-h-[30px] px-2.5 rounded-full text-[11.5px] font-bold border border-dashed border-[var(--c-ln)]">+ {tr(n)}</button>)}</div> : null}
    {!edit ? null : adding ? <div className="flex gap-1.5" data-testid="doc-add-row">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("Name (e.g. Visa number)")} dir="auto" className="w-[40%] min-h-[36px] rounded-[10px] border border-[var(--c-ln)] bg-[var(--c-surf)] px-2 text-[13px]" data-testid="doc-add-name" />
      <input value={val} onChange={(e) => setVal(e.target.value)} placeholder={tr("Value")} dir="auto" className="flex-1 min-w-0 min-h-[36px] rounded-[10px] border border-[var(--c-ln)] bg-[var(--c-surf)] px-2 text-[13px]" data-testid="doc-add-value" />
      <button onClick={addRow} disabled={!name.trim()} className="min-h-[36px] px-3 rounded-[10px] bg-[var(--c-btn,var(--c-acc))] text-[var(--c-on-btn,var(--c-on-acc))] text-[12.5px] font-extrabold disabled:opacity-40" data-testid="doc-add-go">{tr("Add")}</button></div>
    : <div className="flex gap-1.5">
      <button onClick={() => setAdding(true)} className={B2} data-testid="doc-add"><Plus size={12} />{tr("Add a detail")}</button>
      <form onSubmit={(e) => { e.preventDefault(); if (say.trim()) addSaid(); }} className="flex-1 min-w-0 flex gap-1.5"><input value={say} onChange={(e) => setSay(e.target.value)} dir="auto" placeholder={tr("or say it: “visa number H123, valid until 1 Dec 2027”")} className="flex-1 min-w-0 min-h-[34px] rounded-[10px] border border-[var(--c-ln)] bg-[var(--c-surf)] px-2 text-[12.5px]" data-testid="doc-say" /></form></div>}
    {msg ? <p className="m-0 text-[11.5px] c-sub" data-testid="doc-msg">{msg}</p> : null}
  </div>;
}

/** R3 (Ali picked, 10 Nov 2026: "looks like the real card"): a document drawn as a card — its first photo (or a colour for the
   kind of document) behind the name, the main number (masked when it is hidden or locked) and the date. A tap opens the photos. */
const COVER = { passport: "linear-gradient(135deg,#2f5d4a,#173327)", visa: "linear-gradient(135deg,#3c5a86,#1f3150)", id: "linear-gradient(135deg,#8a7650,#4f4128)",
  licence: "linear-gradient(135deg,#7a2338,#431221)", card: "linear-gradient(135deg,#3b3b48,#17171e)" };
export function DocCover({ x, title, sub, when, tone }) {
  const ids = x.photos || [], [bg, setBg] = useState(""), [view, setView] = useState(-1);
  useEffect(() => { let alive = true; (async () => { const b = ids[0] ? await thumbGet(ids[0]) : ""; if (alive) setBg(b || ""); })(); return () => { alive = false; }; }, [ids[0]]);
  const rows = F.joined(x.id, x.fields || [], F.loadSecrets()), main = rows[0];
  const shown = main ? (F.isLocked(main) ? F.masked(main) : main.value) : "";
  const grad = COVER[x.doc] || (/card/i.test(x.doc || "") ? COVER.card : "linear-gradient(135deg,var(--c-acc),#2a1c20)");
  return <>
    <button type="button" onClick={() => ids.length && setView(0)} className="relative block w-full text-start rounded-[18px] overflow-hidden min-h-[132px] p-4 text-white shadow-sm" style={{ background: grad }} aria-label={ids.length ? tr("Open the photos") : title} data-testid="doc-cover">
      {bg ? <img src={bg} alt="" className="absolute inset-0 w-full h-full object-cover" /> : null}
      <span className="absolute inset-0" style={{ background: bg ? "linear-gradient(180deg,rgba(0,0,0,.25),rgba(0,0,0,.72))" : "linear-gradient(180deg,rgba(255,255,255,.06),rgba(0,0,0,.25))" }} />
      <span className="relative flex items-start gap-2">
        <b className="flex-1 min-w-0 text-[17px] font-extrabold leading-tight" dir="auto">{title}</b>
        <span className={"shrink-0 rounded-full px-2.5 py-0.5 text-[11.5px] font-extrabold " + (tone === "red" ? "bg-[#b3263b]" : tone === "amber" ? "bg-[#a86a12]" : "bg-black/35")} data-testid="radar-when">{when}</span></span>
      {main ? <span className="relative block mt-2 text-[13px] opacity-90" dir="auto"><span className="font-bold">{tr(main.name)}</span> · <span className="tabular-nums tracking-wide" data-testid="doc-cover-main">{shown}</span></span> : null}
      <span className="relative block mt-auto pt-6 text-[12.5px] font-bold opacity-90 tabular-nums" dir="auto">{sub}{ids.length > 1 ? " · " + tr("{n} photos", { n: ids.length }) : ""}</span>
    </button>
    {view >= 0 ? <DocPhotos x={x} onPatch={() => {}} edit={false} start={view} onClose={() => setView(-1)} hideStrip /> : null}
  </>;
}
