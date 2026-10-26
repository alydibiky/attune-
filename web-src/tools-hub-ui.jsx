/* ---- v7.8 Tools in two levels — Gemini's mock-up "Area 6: Tools" (Quiet Atelier, Option C), Ali sent it 24 Oct 2026. The Tools hub:
   two numbers (jobs this week, outputs today), the five tool families as cards with what they made this week, the latest outputs,
   and "See all → Tools Report" (jobs by family). Each family's own report: FamilyReport (Writing, Files, Instant, Studio, Video).
   Every number comes from the on-device tool log (toollog.js: titles and numbers only, never the text or the file). */
import React, { useEffect, useMemo, useState } from "react";
import { Sparkles, FileText, Zap, ImageIcon, Film, ArrowLeft, BookOpen } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import { loadLog, toolsReport, familyReport } from "./toollog.js";
import { Bars, SeeAll } from "./biz-dash-ui.jsx";
import { ToolsPage } from "./desk-ui.jsx";
import { useSubBack } from "./backstack.js";
import * as U from "./ui-kit.jsx";
import { studioPaused } from "./device.js";

const I = (s) => "⁦" + s + "⁩";
const T = (k, v) => tr(k, v ? Object.fromEntries(Object.entries(v).map(([x, y]) => [x, /\d/.test(String(y)) ? I(y) : y])) : v);
const C = { writing: "var(--c-chart-1)", files: "var(--c-chart-2)", instant: "var(--c-chart-3)", pdf: "var(--c-chart-3)", library: "var(--c-chart-4)", studio: "var(--c-chart-4)", video: "var(--c-acc)" };
export const FAMS = [
  ["writing", "improve", "Writing", "Improve a prompt · Shorten · Humanize · Copilot · Prompt lab", Sparkles],
  ["files", "convert", "Files & Converter", "Edit a PDF · PDF → Word · Photos → PDF · Merge", FileText],
  // v8.2 (Ali, 26 Oct): no Instant (Chat does it); "Ask a PDF" here too so it is easy to find (it also lives in Students)
  ["pdf", "pdfchat", "Ask a PDF", "Read a PDF or book and chat with it — every answer shows its page", BookOpen],
  ["library", "booklib", "Library", "Your own books — ask them all at once, compared, with the book and page", BookOpen],
  ["studio", "studio", "Studio", "Pictures drawn on the phone's own chip · Eraser · Expand", ImageIcon],
  ["video", "video", "Video Downloader", "Paste a link, pick the quality, save it to your phone", Film]];
const FAM_NAME = { instant: "Chat", ...Object.fromEntries(FAMS.map((f) => [f[0], f[2]])) };   // v8.2: old Instant jobs still show
const ago = (t, now = Date.now()) => { const m = Math.round((now - t) / 60000); return m < 60 ? T("{n} min ago", { n: Math.max(1, m) }) : m < 1440 ? T("{n} h ago", { n: Math.round(m / 60) }) : new Date(t).toLocaleDateString(getLang() === "ar" ? "ar-EG" : undefined, { day: "numeric", month: "short" }); };

export function useToolLog() {
  const [log, setLog] = useState(loadLog);
  useEffect(() => { const on = () => setLog(loadLog()); window.addEventListener("attune-toollog", on); window.addEventListener("storage", on); return () => { window.removeEventListener("attune-toollog", on); window.removeEventListener("storage", on); }; }, []);
  return log;
}
function Tile({ label, value, sub, pill, tone, testid }) {
  return <div className={U.card + " p-3.5 min-w-0 space-y-1"} data-testid={testid}>
    <div className="flex items-start justify-between gap-2"><span className="text-[12px] font-bold text-[var(--c-mut)] leading-tight">{label}</span>{pill ? <span className={U.tag(tone || "green") + " shrink-0"}>{pill}</span> : null}</div>
    <b className="block tabular-nums text-[clamp(18px,5vw,23px)] font-black tracking-tight leading-tight text-[var(--c-acc)]" dir="auto">{value}</b>
    {sub ? <span className="block text-[11.5px] text-[var(--c-mut)] leading-snug">{sub}</span> : null}
  </div>;
}
const Recent = ({ items, navTo, title }) => <div className={U.card + " p-4 min-w-0"} data-testid="tools-recent">
  <p className="text-[12px] font-extrabold tracking-[0.06em] uppercase text-[var(--c-mut)] m-0 mb-1.5">{title || tr("Recent outputs")}</p>
  {items.map((e, i) => <button key={i} onClick={() => navTo && navTo(e.mode)} className="w-full text-start flex items-center gap-2 py-2 border-t border-[var(--c-ln)] first:border-t-0 min-h-[48px]">
    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: C[e.fam] }} />
    <span className="min-w-0 flex-1"><span className="block text-[13.5px] font-bold truncate" dir="auto">{e.title || tr(FAM_NAME[e.fam])}</span>
      <span className="block text-[11.5px] text-[var(--c-mut)] truncate">{tr(FAM_NAME[e.fam])}{e.detail ? " · " + e.detail : ""} · {ago(e.t)}</span></span></button>)}
  {!items.length ? <p className="m-0 text-[13px] text-[var(--c-mut)]">{tr("What your tools make shows here.")}</p> : null}
</div>;

/** The Tools hub (Work → Tools, "/all"): the calm view, then the Tools Report. */
export function ToolsHub({ tools, navTo, pages, groups }) {
  const log = useToolLog();
  const r = useMemo(() => toolsReport(log), [log]);
  const [rep, setRep] = useState(false);
  useSubBack(rep, () => setRep(false));
  if (rep) return <div className="calm pt-2 pb-10 space-y-3" data-testid="tools-report">
    <ReportHead title={tr("Tools Report")} sub={tr("What your tools made this week — everything ran on this device")} back={() => setRep(false)} />
    <div className="grid grid-cols-2 gap-2.5"><Tile label={tr("Jobs this week")} value={String(r.week)} pill={r.change != null ? I((r.change >= 0 ? "+" : "") + r.change + "%") : null} /><Tile label={tr("Today")} value={String(r.today)} sub={tr("Private, on this device")} /></div>
    <div className={U.card + " p-4"} data-testid="tools-rep-bars"><p className="text-[12px] font-extrabold tracking-[0.06em] uppercase text-[var(--c-mut)] m-0 mb-2">{tr("Jobs this week by family")}</p>
      <Bars rows={FAMS.map(([f]) => ({ f, n: r.by[f] || 0 }))} bars={[{ key: "n", color: "var(--c-chart-1)" }]} label={(x) => tr(FAM_NAME[x.f]).split(" ")[0]} height={150} /></div>
    <Recent items={log.slice(0, 8)} navTo={navTo} />
  </div>;
  const top = <div className="space-y-3 mb-4" data-testid="tools-hub">
    <div className="grid grid-cols-2 gap-2.5">
      <Tile testid="tools-kpi-week" label={tr("Jobs this week")} value={String(r.week)} pill={r.change != null ? I((r.change >= 0 ? "+" : "") + r.change + "%") : null} sub={tr("100% private on this device")} />
      <Tile testid="tools-kpi-today" label={tr("Made today")} value={String(r.today)} sub={r.recent[0] ? r.recent[0].title : tr("Nothing yet today")} />
    </div>
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-4 space-y-3 lg:space-y-0 items-start">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="tools-families">
        {FAMS.filter(([f]) => f !== "studio" || !studioPaused(typeof window !== "undefined" && window.AttuneNative)).map(([f, mode, title, sub, Icon]) => <button key={f} onClick={() => navTo(mode)} data-testid={"tools-page-" + mode}
          className={U.card + " text-start p-4 min-h-[96px] flex items-start gap-3 hover:border-[var(--c-acc)] transition-colors duration-150"}>
          <span className="w-11 h-11 shrink-0 rounded-[14px] grid place-items-center" style={{ background: "var(--c-soft)", color: C[f] }}><Icon size={19} /></span>
          <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="text-[15.5px] font-extrabold leading-tight">{tr(title)}</span>
            {r.by[f] ? <span className={U.tag("green") + " shrink-0"}>{T("{n} this week", { n: r.by[f] })}</span> : null}</span>
            <span className="block text-[12.5px] text-[var(--c-mut)] leading-snug mt-1">{tr(sub)}</span></span></button>)}
      </div>
      <div className="space-y-3"><Recent items={r.recent} navTo={navTo} />
        <SeeAll testid="tools-open-report" onClick={() => setRep(true)} title={tr("See all → Tools Report")} sub={T("{n} jobs this week · by family", { n: r.week })} cta={tr("Report")} /></div>
    </div>
  </div>;
  return <ToolsPage tools={tools} groups={groups} showPins={false} pages={pages} subtitle="Pick a tool family — everything runs privately on your device first." navTo={navTo} top={top} />;
}

export const ReportHead = ({ title, sub, back }) => <div className="flex items-center gap-2.5">
  {back ? <button onClick={back} aria-label={tr("Back")} className="w-10 h-10 rounded-full grid place-items-center bg-[var(--c-surf)] border border-[var(--c-ln)] shrink-0" data-testid="report-back"><ArrowLeft size={17} className="rtl:-scale-x-100" /></button> : null}
  <div className="min-w-0"><h3 className="text-[19px] font-black tracking-tight m-0">{title}</h3>{sub ? <p className="m-0 text-[12.5px] text-[var(--c-mut)]">{sub}</p> : null}</div></div>;

const KIND_NAME = { structure: "Structure", ai: "AI rewrite", trim: "Trim" };
/** One family's report (Writing / Files / Instant / Studio / Video), with its latest outputs. */
export function FamilyReport({ fam, back, navTo, names = {} }) {
  const log = useToolLog();
  const r = useMemo(() => familyReport(log, fam), [log, fam]);
  const title = { writing: "Writing Report", files: "Converter Report", instant: "Instant Report", studio: "Studio Report", video: "Video Report" }[fam];
  const nm = (k) => tr(names[k] || KIND_NAME[k] || k);
  return <div className="space-y-3" data-testid={"report-" + fam}>
    <ReportHead title={tr(title)} sub={tr("This week, on this device")} back={back} />
    <div className="grid grid-cols-3 gap-2.5">
      <Tile testid="fam-rep-week" label={fam === "writing" ? tr("Prompts improved") : fam === "files" ? tr("Files converted") : fam === "studio" ? tr("Pictures made") : tr("Jobs")} value={String(r.week)}
        sub={r.change != null ? T("{p}% vs last week", { p: (r.change >= 0 ? "+" : "") + r.change }) : tr("This week")} />
      {fam === "writing" ? <Tile testid="fam-rep-saved" label={tr("Words saved")} value={String(r.wordsSaved)} sub={r.tighter != null ? T("{p}% tighter", { p: r.tighter }) : null} />
        : fam === "files" || fam === "video" ? <Tile testid="fam-rep-mb" label={tr("Processed")} value={I(r.mb + " MB")} sub={tr("never uploaded")} />
        : <Tile label={tr("All time")} value={String(r.total)} />}
      {fam === "writing" ? <Tile testid="fam-rep-target" label={tr("Favourite target")} value={r.targets[0] ? (names[r.targets[0].k] || r.targets[0].k) : "—"} sub={r.targets[0] ? I(r.targets[0].pct + "%") : null} />
        : <Tile testid="fam-rep-secs" label={tr("Average time")} value={r.avgSecs != null ? I(r.avgSecs + " s") : "—"} sub={tr("on this device")} />}
    </div>
    {(fam === "writing" ? r.targets : r.kinds).length ? <div className={U.card + " p-4"} data-testid="fam-rep-kinds">
      <p className="text-[12px] font-extrabold tracking-[0.06em] uppercase text-[var(--c-mut)] m-0 mb-2">{fam === "writing" ? tr("By target") : tr("By kind")}</p>
      {(fam === "writing" ? r.targets : r.kinds).map((k) => <div key={k.k} className="py-1.5"><div className="flex justify-between text-[13px] font-bold"><span>{nm(k.k)}</span><span className="tabular-nums text-[var(--c-mut)]">{I(k.c + " · " + k.pct + "%")}</span></div>
        <div className="c-bar mt-1" aria-hidden="true"><i style={{ width: Math.max(3, k.pct) + "%" }} /></div></div>)}</div> : null}
    <Recent items={r.recent} navTo={navTo} title={tr("Latest")} />
  </div>;
}
/** "See all → … Report" for a tool page, with this week's count. */
export function FamilySeeAll({ fam, onClick }) {
  const log = useToolLog();
  const r = useMemo(() => familyReport(log, fam), [log, fam]);
  const title = { writing: "See all → Writing Report", files: "See all → Converter Report", instant: "See all → Instant Report", studio: "See all → Studio Report", video: "See all → Video Report" }[fam];
  return <SeeAll testid={"open-report-" + fam} onClick={onClick} title={tr(title)} sub={r.week ? T("{n} this week", { n: r.week }) + (fam === "writing" && r.wordsSaved ? " · " + T("{n} words saved", { n: r.wordsSaved }) : "") : tr("What this tool made, on this device")} cta={tr("Report")} />;
}

/** Studio where the phone's image chip is not available (a browser): what it does, and its report. */
export function StudioOffDevice({ paused = false }) {
  const [rep, setRep] = useState(false);
  useSubBack(rep, () => setRep(false));
  if (rep) return <div className="calm text-[var(--c-ink)]" data-testid="studio-page"><FamilyReport fam="studio" back={() => setRep(false)} /></div>;
  return <div className="calm space-y-3 text-[var(--c-ink)]" data-testid="studio-page">
    {paused ? <p className={U.card + " p-4 m-0 text-[14px]"} data-testid="studio-paused">{tr("Studio is paused on phones for now — drawing pictures made some phones restart. It comes back in an update once that is fixed. The photo editor (Eraser, Expand) still works.")}</p>
      : <p className={U.card + " p-4 m-0 text-[14px]"}>{tr("Studio draws pictures with the phone's own chip — it works in the Android app.")}</p>}
    <FamilySeeAll fam="studio" onClick={() => setRep(true)} /></div>;
}
