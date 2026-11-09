/* ---- v9.9.3 T1 Timetable photo → weekly reminders (Ali: "a bit slower okay but don't compromise quality and accuracy").
   The photo is read twice when the phone can: the text reader (positions → grid) AND the small photo model (JSON) — rows both agree
   on are sure, rows only one read are marked "check this". Nothing is saved before the person checks the table and taps Save.
   Logic: timetable.js (tested). Reached from Reminders ("From a timetable photo"), the Home box ("my timetable") and Chat. */
import React, { useState } from "react";
import { ImagePlus, Loader2, Trash2, Check, AlertTriangle, CalendarDays as CalendarClock } from "lucide-react";
import { tr, getLang, dateLocale } from "./i18n.js";
import * as T from "./timetable.js";
import * as U from "./ui-kit.jsx";
import { loadReminders, saveReminders, syncToPhone } from "./actions.js";

const dayName = (d) => { const x = new Date(2026, 10, 8 + d); return x.toLocaleDateString(dateLocale(), { weekday: "long" }); };   // 8 Nov 2026 is a Sunday
const inp = "min-h-[36px] rounded-[10px] border border-[var(--c-ln)] bg-[var(--c-surf)] px-2 text-[13px]";

export function TimetablePage({ nativeCall, native, runVision, flash, navTo }) {
  const [img, setImg] = useState(null), [busy, setBusy] = useState(""), [rows, setRows] = useState(null), [err, setErr] = useState("");
  const [minutes, setMinutes] = useState(15), [until, setUntil] = useState(""), [saved, setSaved] = useState(0);
  const pick = (f) => { if (!f) return; const r = new FileReader(); r.onload = () => { const url = String(r.result), b64 = url.split(",")[1] || ""; setImg({ url, b64, media: f.type || "image/jpeg" }); read({ b64, media: f.type || "image/jpeg" }); }; r.readAsDataURL(f); };
  const read = async (im) => {
    setErr(""); setRows(null); let a = [], b = [];
    try { if (nativeCall) { setBusy(tr("Reading the text…")); const r = await nativeCall("readText", { b64: im.b64 }); a = T.fromLines((r && r.lines) || []); } } catch (e) {}
    try { if (runVision) { setBusy(tr("Checking it with the photo model…")); b = T.fromModel(await runVision(T.MODEL_PROMPT, { media: im.media, data: im.b64 })); } } catch (e) {}
    setBusy("");
    const out = a.length && b.length ? T.merge(a, b) : T.clean(a.length ? a : b);
    if (!out.length) { setErr(runVision ? tr("I couldn't read classes in this photo. Try a sharper photo or a screenshot of the timetable.") : tr("I couldn't read classes in this photo. An Arabic or handwritten timetable needs a model marked 📷 in Engine.")); return; }
    setRows(out.map((c, i) => ({ ...c, k: i + 1 })));
  };
  const set = (k, patch) => setRows((rs) => rs.map((r) => (r.k === k ? { ...r, ...patch, check: false } : r)));
  const del = (k) => setRows((rs) => rs.filter((r) => r.k !== k));
  const ok = (rows || []).filter(T.valid);
  const save = () => {
    const rem = T.toReminders(ok, { minutes, until, now: Date.now() });
    const keep = loadReminders().filter((r) => !rem.some((x) => x.id === r.id));
    const list = saveReminders([...keep, ...rem.map((r) => ({ ...r, created: Date.now() }))]);
    try { syncToPhone(native, list); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent("attune-lists")); } catch (e) {}
    setSaved(rem.length); flash && flash(tr("{n} classes saved — a reminder {m} min before each", { n: rem.length, m: minutes }));
  };
  return <div className="calm pt-1 pb-10 space-y-3 max-w-2xl" data-testid="timetable-page">
    <U.Head title={tr("Timetable → reminders")} sub={tr("A photo or screenshot of your timetable. Attune reads it, you check it once, and every class gets a weekly reminder until the term ends.")} />
    <label className={U.card + " p-4 flex items-center gap-3 cursor-pointer"} data-testid="timetable-pick">
      <ImagePlus size={20} className="text-[var(--c-acc)] shrink-0" />
      <span className="flex-1 text-[14px] font-bold">{img ? tr("Use another photo") : tr("Choose the timetable photo")}</span>
      <input type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files && e.target.files[0])} data-testid="timetable-file" />
    </label>
    {img ? <img src={img.url} alt="" className="max-h-48 rounded-[14px] border border-[var(--c-ln)]" /> : null}
    {busy ? <p className="m-0 text-[13px] flex items-center gap-2 text-[var(--c-acc)]" data-testid="timetable-busy"><Loader2 size={15} className="animate-spin" />{busy}</p> : null}
    {err ? <p className="m-0 text-[13px] text-[var(--c-warn)]" data-testid="timetable-err">{err}</p> : null}
    {rows ? <section className={U.card + " p-3 space-y-2"} data-testid="timetable-rows">
      <p className="m-0 text-[12px] font-extrabold tracking-[0.06em] uppercase c-sub">{tr("Check every class — fix anything wrong")}</p>
      {rows.map((r) => <div key={r.k} className={"rounded-[12px] border p-2 space-y-1.5 " + (r.check ? "border-[var(--c-warn)]" : "border-[var(--c-ln)]")} data-testid="timetable-row" data-check={r.check ? "1" : "0"}>
        {r.check ? <p className="m-0 text-[11.5px] font-bold text-[var(--c-warn)] flex items-center gap-1"><AlertTriangle size={12} />{tr("Check this one — only one reader saw it")}</p> : null}
        <div className="flex flex-wrap gap-1.5 items-center">
          <select value={r.day} onChange={(e) => set(r.k, { day: +e.target.value })} className={inp} aria-label={tr("Day")}>{[0, 1, 2, 3, 4, 5, 6].map((d) => <option key={d} value={d}>{dayName(d)}</option>)}</select>
          <input type="time" value={r.start} onChange={(e) => set(r.k, { start: e.target.value })} className={inp} aria-label={tr("Starts")} />
          <input type="time" value={r.end || ""} onChange={(e) => set(r.k, { end: e.target.value })} className={inp} aria-label={tr("Ends")} />
          <button onClick={() => del(r.k)} aria-label={tr("Delete")} className="w-9 h-9 grid place-items-center c-sub ms-auto"><Trash2 size={14} /></button>
        </div>
        <div className="flex gap-1.5"><input value={r.subject} onChange={(e) => set(r.k, { subject: e.target.value })} dir="auto" className={inp + " flex-1 min-w-0"} aria-label={tr("Subject")} data-testid="timetable-subject" />
          <input value={r.room || ""} onChange={(e) => set(r.k, { room: e.target.value })} dir="auto" placeholder={tr("Room")} className={inp + " w-24"} aria-label={tr("Room")} /></div>
      </div>)}
      <div className="flex flex-wrap gap-2 items-center pt-1">
        <label className="text-[13px] flex items-center gap-1.5">{tr("Remind me")}<input type="number" min="0" max="120" value={minutes} onChange={(e) => setMinutes(Math.max(0, Math.min(120, +e.target.value || 0)))} className={inp + " w-16"} data-testid="timetable-minutes" />{tr("min before")}</label>
        <label className="text-[13px] flex items-center gap-1.5">{tr("Term ends")}<input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className={inp} data-testid="timetable-until" /></label>
      </div>
      <button onClick={save} disabled={!ok.length || !until} className={U.btnP + " w-full"} data-testid="timetable-save"><Check size={15} />{until ? tr("Save {n} classes", { n: ok.length }) : tr("Pick the day the term ends first")}</button>
      {saved ? <p className="m-0 text-[13px] font-bold text-[var(--c-pos)] flex items-center gap-1.5" data-testid="timetable-saved"><CalendarClock size={14} />{tr("{n} classes saved — a reminder {m} min before each", { n: saved, m: minutes })}</p> : null}
    </section> : null}
  </div>;
}
