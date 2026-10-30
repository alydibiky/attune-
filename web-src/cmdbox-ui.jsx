/* ---- v6.48 The pieces of Home option A (Ali picked it, 21 Oct 2026 — mock-ups https://claude.ai/artifact/Ngv9DmEQpCfq2CwPKZa47d):
   the "/" list under the box, what is attached, the "what did you mean?" question, the to-do list, the map card, what Mind found,
   the "Working on it" job cards and the pinned trip. Logic lives in commands.js / cmdrun.js / jobs.js / whereis.js; these only show
   it. Tests: tests/e2e_v748commands.py.                                                                                         */
import React, { useEffect, useState } from "react";
import { X, Paperclip, Check, Copy, Download, RefreshCw as RotateCw, MapPin, TrainFront, Plane, Loader2, Globe, Languages, CheckCircle2, AlertTriangle, ChevronRight, FileText, ImageIcon, Film, Mic } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import * as K from "./commands.js";
import { shown as jobsShown } from "./jobs.js";

const ar = () => getLang() === "ar";
const pick2 = (pair) => (ar() ? pair[1] : tr(pair[0]));
export const say = (l) => (l ? (ar() ? l.ar || l.en : l.en) : "");
const chip = "inline-flex items-center gap-1.5 rounded-full px-3 h-9 text-[13px] font-semibold";
const surf = { background: "var(--c-surf)", border: "1px solid var(--c-ln)", color: "var(--c-ink)" };

/** The live list of jobs from the app's runner. */
export function useJobs(jobs) {
  const [list, setList] = useState(() => (jobs ? jobs.list() : []));
  useEffect(() => (jobs ? jobs.subscribe((l) => setList(l)) : undefined), [jobs]);
  return list;
}

/** Under the box while a "/" word is being typed: the commands that fit, tap one to fill it in. */
export function SlashMenu({ text, onPick }) {
  const m = String(text || "").match(/^\/(\S*)$/);
  if (!m) return null;
  const list = K.commandsMatching(m[1]);
  if (!list.length) return null;
  const groups = [["do", "DO", "اعمل"], ["mind", "REMEMBER", "افتكر"], ["open", "OPEN", "افتح"]];   // v6.50: every app too
  return (
    <div className="rounded-[20px] p-1.5" style={surf} data-testid="slash-menu" role="listbox">
      {groups.map(([g, en, a]) => {
        const xs = list.filter((c) => c.group === g); if (!xs.length) return null;
        return <div key={g}><p className="m-0 px-2.5 pt-2 pb-1 text-[11px] font-extrabold tracking-wide c-sub">{ar() ? a : en}</p>
          {xs.map((c) => (
            <button key={c.id} onClick={() => onPick(c)} role="option" className="w-full text-start rounded-[12px] px-2.5 py-2 min-h-[48px] flex flex-col justify-center" data-testid={"slash-" + c.id}>
              {c.group === "open" ? <b className="text-[14.5px]"><span className="c-acc">{ar() ? c.hint[1] : tr(c.hint[0])}</span></b>
                : <><b className="text-[14.5px]"><span className="c-acc">/{ar() ? c.ar[0] : c.id}</span> <span className="font-semibold">{tr(c.hint[0])}</span></b>
              <span className="c-sub text-[12px]" dir="rtl">{c.hint[1]}</span></>}
            </button>))}</div>;
      })}
    </div>);
}

const iconOf = (f) => (/^image\//.test(f.type || "") || /\.(jpe?g|png|webp|heic|gif)$/i.test(f.name) ? ImageIcon : /^video\//.test(f.type || "") || /\.(mp4|mov|mkv|webm|3gp)$/i.test(f.name) ? Film : /^audio\//.test(f.type || "") || /\.(m4a|mp3|wav|ogg|aac|opus|amr)$/i.test(f.name) ? Mic : FileText);
/** What is attached to the next message (a file, photos, a video, a recording). */
export function Attached({ files, onRemove }) {
  if (!files || !files.length) return null;
  return <div className="flex gap-1.5 flex-wrap" data-testid="box-files">
    {files.map((f, i) => { const I = iconOf(f); return (
      <span key={i} className="inline-flex items-center gap-1.5 rounded-full ps-2.5 pe-1 h-8 text-[12.5px] max-w-full" style={surf} data-testid="box-file">
        <I size={13} className="c-acc shrink-0" /><span className="truncate max-w-[160px]" dir="auto">{f.name}</span>
        <button onClick={() => onRemove(i)} aria-label={tr("Remove")} className="w-7 h-7 grid place-items-center rounded-full c-sub"><X size={13} /></button></span>); })}
  </div>;
}

/** The two quick options in the box (Ali: "make the web search and translate as an option in the chat"). */
export function BoxOptions({ web, setWeb, tr2, setTr2, onAttach }) {
  const on = { background: "var(--c-soft)", border: "1px solid var(--c-acc)", color: "var(--c-ink)" };
  return <div className="flex items-center gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5" data-testid="box-options">
    <button onClick={onAttach} aria-label={tr("Attach a file, photo, video or recording")} className="shrink-0 w-9 h-9 rounded-full grid place-items-center c-sub" style={{ background: "var(--c-bg)" }} data-testid="box-attach"><Paperclip size={16} /></button>
    <button onClick={() => setWeb(!web)} aria-pressed={web} className={chip + " shrink-0"} style={web ? on : surf} data-testid="box-web"><Globe size={14} className="c-acc" />{tr("Web")}</button>
    <button onClick={() => setTr2(!tr2)} aria-pressed={tr2} className={chip + " shrink-0"} style={tr2 ? on : surf} data-testid="box-translate"><Languages size={14} className="c-acc" />{tr("Translate")}</button>
    {/* Ali (22 Oct): the commands show only when "/" is typed — no command chips under the box */}
  </div>;
}

/** v7.6 (Ali, 24 Oct: "your life and translate integrated in Home in a minimal way"): what the box does with a sentence —
    Chat (ask / do anything), Your life (answered by code from your own records), Translate. One small row of pills in the box. */
export const BOX_MODES = [["chat", "Chat", "شات"], ["life", "Your life", "حياتك"], ["translate", "Translate", "ترجمة"]];
export function takeBoxMode() { try { const v = localStorage.getItem("attune:box:mode"); localStorage.removeItem("attune:box:mode"); return BOX_MODES.some((m) => m[0] === v) ? v : "chat"; } catch (e) { return "chat"; } }
export function BoxModes({ mode, setMode }) {
  return <div className="flex items-center gap-1 p-1 rounded-full w-fit max-w-full" style={{ background: "var(--c-bg)", border: "1px solid var(--c-ln)" }} role="radiogroup" aria-label={tr("What the box does")} data-testid="box-modes">
    {BOX_MODES.map(([id, en, a]) => <button key={id} role="radio" aria-checked={mode === id} onClick={() => setMode(id)} data-testid={"box-mode-" + id}
      className={"min-h-[34px] px-3.5 rounded-full text-[13px] whitespace-nowrap transition-colors duration-150 " + (mode === id ? "font-extrabold" : "font-semibold c-sub")}
      style={mode === id ? { background: "var(--c-soft)", color: "var(--c-acc)", borderColor: "var(--c-acc)" } : null}>{ar() ? a : tr(en)}</button>)}
  </div>;
}
export const BOX_HINT = { chat: null, life: "Ask about your money, health, people, meals or deadlines…", translate: "Type or paste — Arabic ↔ English, or say «to French …»" };

/** Ali: "if the prompt can mean 2 things it asks him with the 2 options and he ticks what he means". */
export function AskCard({ ask, onPick, onClose }) {
  const [sel, setSel] = useState(null);
  return <div className="c-card space-y-2" data-testid="ask-card" role="radiogroup" aria-label={tr("What did you mean?")}>
    <div className="flex items-start gap-2"><b className="flex-1 text-[14.5px]">{tr("What did you mean?")}</b>
      <button onClick={onClose} aria-label={tr("Close")} className="w-8 h-8 -mt-1 -me-1 grid place-items-center c-sub"><X size={15} /></button></div>
    <p className="c-sub m-0 text-[12.5px]" dir="auto">«{ask.text}»</p>
    {ask.options.map((k) => (
      <button key={k} role="radio" aria-checked={sel === k} onClick={() => { setSel(k); onPick(k); }} className="w-full min-h-[46px] rounded-[12px] px-3 flex items-center gap-2.5 text-start" style={sel === k ? { background: "var(--c-soft)", border: "1px solid var(--c-acc)" } : surf} data-testid={"ask-" + k}>
        <span className="w-5 h-5 rounded-full grid place-items-center shrink-0" style={{ border: "2px solid var(--c-acc)", background: sel === k ? "var(--c-acc)" : "transparent" }}>{sel === k ? <Check size={12} color="#fff" /> : null}</span>
        <span className="text-[14px] font-semibold">{pick2(K.KIND_LABEL[k] || [k, k])}</span></button>))}
    <div className="flex items-center gap-2"><span className="c-sub text-[11.5px] flex-1">{tr("Tap what you meant — Attune learns what you usually mean.")}</span></div>
  </div>;
}

export function ConfirmCard({ q, onYes, onNo }) {
  return <div className="c-card space-y-2.5" data-testid="confirm-card">
    <b className="block text-[14.5px]" dir="auto">{say(q)}</b>
    <div className="flex gap-2">
      <button onClick={onYes} className="h-10 px-5 rounded-full text-[13.5px] font-extrabold" style={{ background: "var(--c-acc)", color: "#fff" }} data-testid="confirm-yes">{tr("Yes")}</button>
      <button onClick={onNo} className="h-10 px-5 rounded-full text-[13.5px] font-bold" style={surf} data-testid="confirm-no">{tr("No")}</button></div>
  </div>;
}

export function LinesCard({ lines, onOpen, onClose }) {
  const [done, setDone] = React.useState({});   // a follow-up tapped: its answer replaces the button
  return <div className="c-card space-y-1.5" data-testid="lines-card">
    {lines.map((l, i) => <div key={i} className="space-y-1"><div className="flex items-start gap-2">
      <CheckCircle2 size={16} className="c-acc shrink-0 mt-0.5" />
      <p className="m-0 flex-1 text-[14px]" dir="auto" data-testid="lines-text">{say(l)}</p>
      {l.open ? <button onClick={() => onOpen(l.open)} className="text-[12.5px] font-extrabold c-acc shrink-0" data-testid="lines-open">{tr("Open")}</button> : null}</div>
      {l.act ? (done[i] ? <p className="m-0 ps-6 text-[13px] c-sub" dir="auto" data-testid="lines-act-done">{done[i]}</p>
        : <button onClick={() => { let out = ""; try { out = l.act.run() || ""; } catch (e) {} setDone((d) => ({ ...d, [i]: out || "✓" })); }} className="ms-6 h-9 px-4 rounded-full text-[13px] font-extrabold" style={{ background: "var(--c-soft)", color: "var(--c-acc)" }} data-testid="lines-act">{l.act.label}</button>) : null}</div>)}
    <button onClick={onClose} className="c-sub text-[12px]" data-testid="lines-close">{tr("Close")}</button>
  </div>;
}

/** "what's in my to-do list" — tick to finish (it stays in Mind as done). */
export function TodoCard({ items, onTick, onOpen, onClose }) {
  const [gone, setGone] = useState([]);
  const left = items.filter((x) => !gone.includes(x.id));
  return <div className="c-card space-y-1" data-testid="todo-card">
    <div className="flex items-center gap-2"><b className="flex-1 text-[14.5px]">{tr("Your to-do list")} · {left.length}</b>
      <button onClick={onOpen} className="text-[12.5px] font-extrabold c-acc">{tr("Open in Mind")}</button>
      <button onClick={onClose} aria-label={tr("Close")} className="w-8 h-8 grid place-items-center c-sub"><X size={15} /></button></div>
    {left.length ? left.map((x) => (
      <button key={x.id} onClick={() => { setGone((g) => [...g, x.id]); onTick(x); }} className="w-full min-h-[44px] flex items-center gap-2.5 text-start" data-testid="todo-item">
        <span className="w-5 h-5 rounded-md shrink-0" style={{ border: "2px solid var(--c-acc)" }} /><span className="text-[14px]" dir="auto">{x.title || x.text}</span></button>))
      : <p className="c-sub m-0 text-[13px]" data-testid="todo-empty">{tr("Nothing left — say “add … to my to-do list” to add one.")}</p>}
  </div>;
}

/** "I want to go to …" / "where is …" → the map (and the Metro route when the place is a station). */
export function MapCard({ place, metro, onMap, onMetro, onClose }) {
  return <div className="c-card space-y-2" data-testid="map-card">
    <div className="flex items-start gap-2"><MapPin size={18} className="c-acc shrink-0 mt-0.5" /><b className="flex-1 text-[14.5px]" dir="auto">{place}</b>
      <button onClick={onClose} aria-label={tr("Close")} className="w-8 h-8 -mt-1 grid place-items-center c-sub"><X size={15} /></button></div>
    <div className="flex gap-2 flex-wrap">
      <button onClick={onMap} className="h-10 px-4 rounded-full text-[13.5px] font-extrabold inline-flex items-center gap-1.5" style={{ background: "var(--c-acc)", color: "#fff" }} data-testid="map-open"><MapPin size={15} />{tr("Show it on the map")}</button>
      {metro ? <button onClick={onMetro} className="h-10 px-4 rounded-full text-[13.5px] font-bold inline-flex items-center gap-1.5" style={surf} data-testid="map-metro"><TrainFront size={15} className="c-acc" />{tr("Metro route")}</button> : null}
    </div>
  </div>;
}

/** What Mind kept that fits a "find". */
export function FoundCard({ q, items, onOpen, onClose }) {
  return <div className="c-card space-y-1.5" data-testid="found-card">
    <div className="flex items-center gap-2"><b className="flex-1 text-[14.5px]">{items.length ? tr("Found in your Mind") : tr("Nothing kept fits that yet")}</b>
      <button onClick={onClose} aria-label={tr("Close")} className="w-8 h-8 grid place-items-center c-sub"><X size={15} /></button></div>
    {items.map((r) => (
      <button key={r.id} onClick={() => onOpen(r)} className="w-full min-h-[48px] flex items-center gap-2.5 text-start" data-testid="found-item">
        {r.meta && r.meta.thumb ? <img src={r.meta.thumb} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" /> : <span className="w-12 h-12 rounded-lg grid place-items-center shrink-0" style={{ background: "var(--c-bg)" }}>{(() => { const I = r.kind === "video" ? Film : r.kind === "audio" ? Mic : r.kind === "photo" ? ImageIcon : FileText; return <I size={18} className="c-acc" />; })()}</span>}
        <span className="flex-1 min-w-0"><b className="block text-[14px] truncate" dir="auto">{r.title}</b>
          {r.meta && r.meta.at != null ? <span className="c-sub block text-[12px]" dir="auto">{tr("at {t}", { t: r.meta.atText || r.meta.at })} — {String(r.meta.atSaid || "").slice(0, 60)}</span> : <span className="c-sub block text-[12px]">{new Date(r.ts).toLocaleDateString()}</span>}</span>
        <ChevronRight size={16} className="c-sub shrink-0 rtl:rotate-180" /></button>))}
    {!items.length ? <p className="c-sub m-0 text-[13px]">{tr("Keep things with /remember — a photo, a video, a recording or a note — and find them here.")}</p> : null}
  </div>;
}

/** "Working on it" — the jobs, with their progress and their results (Home option A). */
export function JobCards({ list, jobs, onSave, onCopy, onOpen }) {
  const xs = jobsShown(list);
  if (!xs.length) return null;
  const busy = xs.filter((j) => j.status === "run" || j.status === "wait").length;
  return <section className="space-y-1.5" data-testid="jobs">
    <p className="c-lbl m-0">{busy ? tr("Working on it · {n}", { n: busy }) : tr("Done")}</p>
    <div className="c-card !py-1" data-testid="jobs-card">
      {xs.map((j, i) => (
        <div key={j.id} className={"py-2.5 space-y-1.5 " + (i ? "border-t" : "")} style={{ borderColor: "var(--c-ln)" }} data-testid="job" data-status={j.status} data-kind={j.kind}>
          <div className="flex items-center gap-2">
            {j.status === "done" ? <CheckCircle2 size={16} className="c-acc shrink-0" /> : j.status === "fail" ? <AlertTriangle size={16} className="shrink-0" style={{ color: "#B42318" }} /> : <Loader2 size={16} className="animate-spin c-sub shrink-0" />}
            <b className="flex-1 min-w-0 text-[14px] truncate" dir="auto">{j.title}</b>
            {j.status === "run" || j.status === "wait" ? <span className="c-sub text-[12px] shrink-0">{j.status === "wait" ? tr("Waiting") : j.pct ? j.pct + "%" : ""}</span> : null}
            {j.status === "done" || j.status === "fail" ? <button onClick={() => jobs.dismiss(j.id)} aria-label={tr("Dismiss")} className="w-8 h-8 grid place-items-center c-sub shrink-0" data-testid="job-dismiss"><X size={14} /></button> : null}
            {j.status === "run" || j.status === "wait" ? <button onClick={() => jobs.cancel(j.id)} aria-label={tr("Stop")} className="w-8 h-8 grid place-items-center c-sub shrink-0" data-testid="job-stop"><X size={14} /></button> : null}
          </div>
          {j.status === "run" ? <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--c-ln)" }}><div className={"h-1.5 rounded-full " + (j.pct ? "" : "animate-pulse")} style={{ width: (j.pct || 30) + "%", background: "var(--c-acc)" }} /></div> : null}
          {j.note && j.status === "run" ? <p className="c-sub m-0 text-[12px] truncate" dir="auto">{j.note}</p> : null}
          {j.status === "fail" ? <div className="flex items-center gap-2"><p className="m-0 flex-1 text-[12.5px]" style={{ color: "#B42318" }} dir="auto" data-testid="job-error">{tr(j.error)}</p>
            {j.input && !(j.input.files && !j.input.files.length) ? <button onClick={() => jobs.retry(j.id)} className="text-[12.5px] font-extrabold c-acc inline-flex items-center gap-1" data-testid="job-retry"><RotateCw size={13} />{tr("Retry")}</button> : null}</div> : null}
          {j.status === "done" && j.result ? <div className="space-y-1.5">
            {j.result.text ? <p className="m-0 text-[13px] line-clamp-3 whitespace-pre-line" dir="auto" data-testid="job-text">{j.result.text}</p> : null}
            {j.result.note ? <p className="c-sub m-0 text-[12px]" dir="auto">{j.result.note}</p> : null}
            <div className="flex gap-2 flex-wrap">
              {j.result.text ? <button onClick={() => onCopy(j.result.text)} className="h-9 px-3.5 rounded-full text-[13px] font-extrabold inline-flex items-center gap-1.5" style={surf} data-testid="job-copy"><Copy size={13} className="c-acc" />{tr("Copy")}</button> : null}
              {j.result.file && !j.result.file.gone ? <button onClick={() => onSave(j.result.file)} className="h-9 px-3.5 rounded-full text-[13px] font-extrabold inline-flex items-center gap-1.5" style={{ background: "var(--c-acc)", color: "#fff" }} data-testid="job-save"><Download size={13} />{tr("Save {n}", { n: j.result.file.name })}</button> : null}
              {j.result.file && j.result.file.gone ? <span className="c-sub text-[12px]">{tr("The file was not kept after the app closed — Retry makes it again.")}</span> : null}
              {j.result.open ? <button onClick={() => onOpen(j.result.open)} className="h-9 px-3.5 rounded-full text-[13px] font-extrabold" style={surf} data-testid="job-open">{tr("Open")}</button> : null}
            </div></div> : null}
        </div>))}
    </div>
  </section>;
}

/** The pinned trip (/travel): days left, pinned until it ends or he ends it. */
export function TripPin({ trip, name, onOpen, onEnd }) {
  if (!trip || !trip.pinned || !trip.country) return null;
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const d = (iso) => Math.round((Date.parse(iso + "T12:00:00") - today.getTime()) / 864e5);
  const line = trip.depart && d(trip.depart) > 0 ? tr("Starts in {n} days", { n: d(trip.depart) }) : trip.ret && d(trip.ret) >= 0 ? tr("{n} days left", { n: d(trip.ret) }) : trip.depart ? tr("On the trip") : tr("Add the dates");
  return <div className="rounded-[20px] p-3.5 flex items-center gap-3" style={{ background: "#FFF6E8", border: "1px solid #F3E2C4", color: "#2C2416" }} data-testid="trip-pin">
    <Plane size={20} style={{ color: "#8A5A00" }} className="shrink-0" />
    <button onClick={onOpen} className="flex-1 min-w-0 text-start" data-testid="trip-pin-open"><b className="block text-[14.5px]">{tr("Trip to {c}", { c: name })}</b><span className="text-[12.5px]" style={{ color: "#6A5524" }}>{line}</span></button>
    <button onClick={onEnd} className="text-[12px] font-extrabold shrink-0 px-2 h-9" style={{ color: "#8A5A00" }} data-testid="trip-pin-end">{tr("End trip")}</button>
  </div>;
}
/** A trip is shown while it is pinned and not over (the day after it ends it unpins by itself). */
export const tripLive = (trip, now = Date.now()) => {
  if (!trip || !trip.pinned || !trip.country) return false;
  if (!trip.ret) return true;
  const end = Date.parse(trip.ret + "T23:59:59");
  return !(end < now);
};
