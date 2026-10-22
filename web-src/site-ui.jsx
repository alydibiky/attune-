/* ---- v6.37 (upgrade W3): Site reports — a real microphone (the phone's speech recognition, Arabic or English) and
   photos stamped with time + GPS; "Report with photos" makes one PDF (sitereport.js). */
import React, { useRef, useState } from "react";
import { Mic, Camera, X, FileText, Loader2 } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import { stampLine, reportHtml } from "./sitereport.js";
import { sharePdf } from "./books-docs.jsx";

/** The microphone: what you say is added to the text box (partial words show while you speak). */
export function MicButton({ listen, value, setValue, flash }) {
  const [on, setOn] = useState(false);
  const go = async () => {
    if (!listen) { flash && flash(tr("Voice capture runs in the installed app")); return; }
    if (on) return;
    setOn(true); const base = value ? value.replace(/\s*$/, " ") : "";
    try { const t = await listen(getLang() === "ar" ? "ar-EG" : "", (p) => setValue(base + p)); if (t) setValue(base + t); }
    catch (e) { flash && flash(tr(String((e && e.message) || e))); } finally { setOn(false); }
  };
  return <button onClick={go} data-testid="site-mic" className={"shrink-0 whitespace-nowrap min-h-[44px] flex items-center gap-1.5 text-[13px] font-extrabold px-3.5 rounded-full border transition-colors duration-150 " + (on ? "bg-[var(--c-neg)]/15 border-[var(--c-neg)]/50 text-[var(--c-neg)]" : "bg-[var(--c-soft)] border-[var(--c-acc)]/40 text-[var(--c-acc)]")}>
    {on ? <Loader2 size={15} className="animate-spin" /> : <Mic size={15} />}{on ? tr("Listening…") : tr("Speak")}</button>;
}

const shrink = (file) => new Promise((ok, no) => { const r = new FileReader(); r.onerror = no; r.onload = () => { const im = new Image(); im.onerror = no; im.onload = () => {
  const k = Math.min(1, 1280 / Math.max(im.width, im.height)), c = document.createElement("canvas"); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
  c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL("image/jpeg", 0.8)); }; im.src = r.result; }; r.readAsDataURL(file); });
// the place, or none: a hard 7 s cap too, because the timeout option only starts once the permission is answered
const where = () => new Promise((ok) => { setTimeout(() => ok({}), 7000); try { navigator.geolocation.getCurrentPosition((p) => ok({ lat: p.coords.latitude, lon: p.coords.longitude }), () => ok({}), { timeout: 6000, maximumAge: 60000 }); } catch (e) { ok({}); } });

/** The photos of this report, each with its stamp and a note; and the PDF of the whole report. */
export function SitePhotos({ photos, setPhotos, title, text, by, flash }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const add = async (files) => {
    const pos = await where(), at = Date.now(), out = [];
    for (const f of [...(files || [])].slice(0, 12)) { try { out.push({ url: await shrink(f), at, ...pos, note: "" }); } catch (e) {} }
    setPhotos([...photos, ...out]);
  };
  const ar = getLang() === "ar";
  return (
    <div className="mt-3 space-y-2" data-testid="site-photos">
      <div className="flex items-center gap-2">
        <button onClick={() => ref.current && ref.current.click()} className="shrink-0 min-h-[44px] flex items-center gap-1.5 text-[13px] font-bold px-3.5 rounded-[14px] border border-[var(--c-ln)] bg-[var(--c-surf)] text-[var(--c-ink)] hover:border-[var(--c-acc)]" data-testid="site-photo-add"><Camera size={15} className="text-[var(--c-acc)]" />{tr("Add photos")}</button>
        <span className="text-[12px] text-[var(--c-mut)]">{tr("Each photo gets the time and the place")}</span>
        <input ref={ref} type="file" accept="image/*" capture="environment" multiple className="hidden" data-testid="site-photo-file" onChange={(e) => { add([...(e.target.files || [])]); e.target.value = ""; }} />
      </div>
      {photos.length ? <div className="grid grid-cols-2 gap-2">{photos.map((p, i) => (
        <div key={i} className="rounded-[18px] border border-[var(--c-ln)] bg-[var(--c-surf)] p-2 space-y-1.5" data-testid="site-photo">
          <div className="relative"><img src={p.url} alt="" className="w-full h-24 object-cover rounded-[12px]" />
            <button onClick={() => setPhotos(photos.filter((_, j) => j !== i))} aria-label={tr("Remove")} className="absolute top-0.5 end-0.5 w-11 h-11 grid place-items-center"><span className="w-7 h-7 rounded-full grid place-items-center bg-black/60 text-white"><X size={13} /></span></button></div>
          <p className="text-[11px] text-[var(--c-mut)] tabular-nums m-0" dir="auto" data-testid="site-photo-stamp">{stampLine(p, i, ar ? "ar" : "en")}</p>
          <input value={p.note} onChange={(e) => setPhotos(photos.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} placeholder={tr("What it shows (optional)")} dir="auto"
            className="w-full min-h-[40px] bg-[var(--c-bg)] border border-[var(--c-ln)] rounded-[12px] px-2.5 py-1.5 text-[13px] text-[var(--c-ink)] placeholder:text-[var(--c-mut)] focus:outline-none focus:border-[var(--c-acc)]" />
        </div>))}</div> : null}
      {text ? <button disabled={busy} onClick={async () => { setBusy(true); await sharePdf({ html: reportHtml({ title, text, by, photos, lang: ar ? "ar" : "en" }), name: String(title || "report").replace(/[^\w؀-ۿ-]+/g, "_"), flash }); setBusy(false); }}
        className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-[16px] bg-[var(--c-acc)] text-[var(--c-on-acc)] font-extrabold text-[14px] disabled:opacity-40" data-testid="site-pdf">
        {busy ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}{photos.length ? tr("Report with {n} photos (PDF)", { n: photos.length }) : tr("Report as PDF")}</button> : null}
    </div>);
}
