/* ---- v7.3 Health in two levels — Gemini's mock-up "Area 2: Health" (Quiet Atelier, option C), sent by Ali on 24 Oct 2026, built
   into the app. Level 1 (health-ui.jsx HealthPage): the box first ("had koshari 85", "Mom took her Metformin", "period started
   today" — done by the same reader as the Home box), then today in one look: Fit & Food, Family health (the next dose with
   Take, a medicine running out), Cycle, and "See all → Health Report". Level 2 (HealthReport here): the week — calories against
   the target, weight trend, family doses on time, water and workouts, the latest lab, the cycle — every number by code
   (health-report.js). Kind on purpose: a day above the target is amber with a word, a late period is never red.            */
import React, { useState } from "react";
import { Heart, Camera, Mic, ArrowRight, ArrowLeft, Printer, Pill, Droplet, AlertTriangle, Check, Undo2, Sparkles, Loader2 } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import * as U from "./ui-kit.jsx";

// numbers inside a translated sentence stay left-to-right in Arabic
const T = (k, v) => tr(k, v ? Object.fromEntries(Object.entries(v).map(([x, y]) => [x, /\d/.test(String(y)) ? "⁦" + y + "⁩" : y])) : v);
const n0 = (n) => Math.round(Number(n) || 0).toLocaleString("en-US");
const loc = () => (getLang() === "ar" ? "ar-EG" : undefined);
const dayShort = (k, today) => { if (today) return tr("Today"); try { return new Date(k + "T12:00:00").toLocaleDateString(loc(), { weekday: "short" }); } catch (e) { return k.slice(5); } };
const dateLong = (k) => { try { return new Date(k + "T12:00:00").toLocaleDateString(loc(), { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return k; } };
export const Arrow = ({ back, size = 15 }) => back ? <ArrowLeft size={size} className="rtl:-scale-x-100" /> : <ArrowRight size={size} className="rtl:-scale-x-100" />;

/** The box: write it or ask it. `onSubmit(text)` returns a promise of { lines:[{text, open}], undo } | { answer } | null. */
export function HealthBox({ onSubmit, onPhoto, onVoice, listening, wide }) {
  const [text, setText] = useState(""), [busy, setBusy] = useState(false), [res, setRes] = useState(null);
  const go = async () => { const t = text.trim(); if (!t || busy) return; setBusy(true); setRes(null); let r = null; try { r = await onSubmit(t); } catch (e) { r = { answer: String((e && e.message) || e) }; } setBusy(false); setText(""); setRes(r); };
  const tools = (
    <>
      {onPhoto ? <button type="button" className={U.btnS + " h-10! min-h-[40px]! px-3!"} onClick={onPhoto} data-testid="health-box-photo" style={{ whiteSpace: "nowrap" }}><Camera size={15} />{tr("Meal photo")}</button> : null}
      {onVoice ? <button type="button" className={U.btnS + " h-10! min-h-[40px]! px-3! " + (listening ? "border-[var(--c-neg)]! text-[var(--c-neg)]!" : "")} onClick={async () => { const t = await onVoice(); if (t) setText(t); }} data-testid="health-box-voice"><Mic size={15} />{listening ? tr("Listening…") : tr("Say it")}</button> : null}
    </>);
  const send = <button type="button" onClick={go} disabled={busy || !text.trim()} data-testid="health-box-go"
    className="min-h-[44px] h-11 px-4 rounded-[14px] bg-[var(--c-acc)] text-[var(--c-on-acc)] font-extrabold text-[14px] inline-flex items-center gap-1.5 disabled:opacity-40">
    {busy ? <Loader2 size={15} className="animate-spin" /> : null}{tr("Log")}<Arrow /></button>;
  return (
    <div className="space-y-2.5">
      <div className={U.card + " p-3.5 focus-within:border-[var(--c-acc)] transition-colors duration-150"} data-testid="health-box">
        <div className="flex items-center gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") go(); }} dir="auto" data-testid="health-box-input"
            placeholder={wide ? tr("Write or ask… “had koshari 85”, “Mom took her Metformin”, “period started today”") : tr("Write or ask… “had koshari 85”, “Mom took her Metformin”")}
            aria-label={tr("Write what you ate, a dose or your period — or ask")}
            className="flex-1 min-w-0 min-h-[40px] bg-transparent border-0 outline-none text-[15px] font-semibold text-[var(--c-ink)] placeholder:text-[var(--c-mut)] placeholder:font-medium" />
          {wide ? <>{tools}{send}</> : null}
        </div>
        {!wide ? <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-[var(--c-ln)]"><div className="flex items-center gap-1.5">{tools}</div>{send}</div> : null}
      </div>
      {res ? (
        <div className={U.cardPad.replace("border-[var(--c-ln)]", "border-[var(--c-acc)]")} data-testid="health-box-result">
          <div className="flex items-start gap-2">
            <Sparkles size={15} className="shrink-0 mt-0.5 text-[var(--c-acc)]" />
            <div className="flex-1 min-w-0 space-y-1 text-[13.5px] font-semibold" dir="auto">
              {res.answer ? <div className="whitespace-pre-wrap">{res.answer}</div> : (res.lines || []).map((l, i) => (
                <div key={i} className="flex flex-wrap items-center gap-x-2">{l.low ? <AlertTriangle size={13} className="text-[var(--c-warn)]" /> : <Check size={13} className="text-[var(--c-pos)]" />}<span>{l.text}</span>
                  {l.open && res.open ? <button className="min-h-[32px] text-[12.5px] font-bold text-[var(--c-acc)]" onClick={() => res.open(l.open)}>{tr("Open")}</button> : null}</div>))}
            </div>
            {res.undo ? <button className={"shrink-0 min-h-[32px] px-2 inline-flex items-center gap-1 text-[12px] font-bold " + U.muted} onClick={() => { res.undo(); setRes(null); res.after && res.after(); }} data-testid="health-box-undo"><Undo2 size={13} />{tr("Undo")}</button>
              : <button className={"shrink-0 min-h-[32px] px-2 text-[12px] font-bold " + U.muted} onClick={() => setRes(null)} aria-label={tr("Close")}>✕</button>}
          </div>
        </div>) : null}
    </div>);
}

/** The entry to level 2. */
export function HealthReportCta({ onClick, wide }) {
  return (
    <button onClick={onClick} data-testid="health-open-report"
      className={U.card + " w-full min-h-[48px] px-4 py-3 flex items-center justify-between gap-3 text-start hover:border-[var(--c-acc)] hover:bg-[var(--c-surf-2)]"}>
      <span className="min-w-0"><span className="block font-extrabold text-[14px]">{wide ? tr("Open Health Report") : tr("See all · Week calories, weight & doses")}</span>
        {wide ? <span className={"block text-[12px] font-semibold " + U.muted}>{tr("Calories against your target, weight trend, doses on time, labs and the cycle")}</span> : null}</span>
      <span className="shrink-0 inline-flex items-center gap-1 text-[12.5px] font-bold text-[var(--c-acc)]">{tr("Health Report")}<Arrow size={14} /></span>
    </button>);
}

function Tile({ label, value, pill, tone, sub, testid }) {
  const col = tone === "pos" ? "text-[var(--c-pos)]" : tone === "warn" ? "text-[var(--c-warn)]" : tone === "acc" ? "text-[var(--c-acc)]" : "";
  return (
    <div className={U.card + " p-3.5 flex flex-col gap-1 min-w-0"} data-testid={testid}>
      <div className={"flex items-center justify-between gap-1.5 text-[11.5px] font-bold " + U.muted}><span className="truncate">{label}</span>{pill ? <span className={U.tag(pill[1]) + " tabular-nums"}>{pill[0]}</span> : null}</div>
      <b className={"block tabular-nums text-[19px] font-black tracking-tight truncate " + col} dir="auto">{value}</b>
      {sub ? <span className={"block text-[11.5px] font-semibold " + U.muted} dir="auto">{sub}</span> : null}
    </div>);
}

const wideNow = () => typeof window !== "undefined" && window.innerWidth >= 1024;
function Calories({ f }) {
  const W = wideNow() ? 560 : 340, step = (W - 20) / 7, bw = Math.min(38, step * 0.62);
  const tg = f.tg && f.tg.kcal ? f.tg.kcal : 0, max = Math.max(1, tg * 1.2, ...f.rows.map((r) => r.kcal)), H = 80, y0 = 104;
  const steady = f.pctOfTarget != null && f.pctOfTarget >= 90 && f.pctOfTarget <= 105;
  return (
    <div className={U.cardPad} data-testid="health-calories">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div><div className="font-extrabold text-[14.5px]">{tg ? T("Calories vs. {a} kcal target", { a: n0(tg) }) : tr("Calories this week")}</div>
          <div className={"text-[12px] " + U.muted}>{tr("Days a little above the target are amber — never alarming")}</div></div>
        {f.pctOfTarget != null ? <span className={U.tag(steady ? "green" : "amber") + " shrink-0"}>{steady ? tr("Steady week") : T("Avg {p}% of target", { p: f.pctOfTarget })}</span> : null}
      </div>
      <svg width="100%" viewBox={"0 0 " + W + " 122"} role="img" aria-label={tr("Calories this week")} dir="ltr">
        {tg ? <line x1="8" x2={W - 6} y1={y0 - (tg / max) * H} y2={y0 - (tg / max) * H} stroke="var(--c-acc)" strokeWidth="1.4" strokeDasharray="4 4" /> : null}
        {f.rows.map((r, i) => { const h = Math.max(r.kcal ? 3 : 1, (r.kcal / max) * H), x = 10 + i * step + (step - bw) / 2, fill = r.today ? "var(--c-acc-2)" : r.above ? "var(--c-chart-3)" : "var(--c-chart-1)"; return (
          <g key={r.day}><rect x={x} y={y0 - h} width={bw} height={h} rx="6" fill={fill} opacity={r.kcal ? 1 : 0.3} />
            {r.kcal ? <text x={x + bw / 2} y={y0 - h - 4} textAnchor="middle" fill={r.above ? "var(--c-warn)" : "var(--c-ink)"} fontSize="9.5" fontWeight="700">{n0(r.kcal)}</text> : null}
            <text x={x + bw / 2} y="118" textAnchor="middle" fill={r.today ? "var(--c-ink)" : "var(--c-mut)"} fontSize="10" fontWeight={r.today ? 800 : 600}>{dayShort(r.day, r.today)}</text></g>); })}
      </svg>
    </div>);
}

function Weight({ w }) {
  if (!w) return (
    <div className={U.cardPad} data-testid="health-weight"><div className="font-extrabold text-[14.5px]">{tr("Weight trend")}</div>
      <p className={"m-0 mt-1 text-[13px] " + U.muted}>{tr("Add your weight in Fit & Food → Progress to see the trend here.")}</p></div>);
  const pts = w.points, vals = [...pts.map((p) => p.kg), ...pts.map((p) => p.avg), ...(w.goal ? [w.goal] : [])];
  const W = wideNow() ? 560 : 340;
  const lo = Math.min(...vals) - 0.5, hi = Math.max(...vals) + 0.5, X = (i) => 16 + (pts.length > 1 ? (i / (pts.length - 1)) * (W - 40) : (W - 40) / 2), Y = (v) => 14 + (1 - (v - lo) / (hi - lo)) * 76;
  return (
    <div className={U.cardPad} data-testid="health-weight">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div><div className="font-extrabold text-[14.5px]">{tr("Weight · 7-entry trend")}</div>
          <div className={"text-[12px] " + U.muted}>{tr("Daily weight moves with water and salt; the jade line is the real trend")}</div></div>
        <span className={U.tag("green") + " tabular-nums shrink-0"} dir="ltr">{w.avg} kg</span>
      </div>
      <svg width="100%" viewBox={"0 0 " + W + " 112"} role="img" aria-label={tr("Weight trend")} dir="ltr">
        {w.goal ? <g><line x1="10" x2={W - 10} y1={Y(w.goal)} y2={Y(w.goal)} stroke="var(--c-mut)" strokeWidth="1" strokeDasharray="3 4" />
          <text x={W - 10} y={Y(w.goal) + 13} textAnchor="end" fill="var(--c-mut)" fontSize="9.5">{T("Goal {a} kg", { a: w.goal })}</text></g> : null}
        <polyline fill="none" stroke="var(--c-mut)" strokeOpacity="0.5" strokeWidth="1.2" points={pts.map((p, i) => X(i) + "," + Y(p.kg)).join(" ")} />
        <polyline fill="none" stroke="var(--c-chart-1)" strokeWidth="2.6" points={pts.map((p, i) => X(i) + "," + Y(p.avg)).join(" ")} />
        <circle cx={X(pts.length - 1)} cy={Y(pts[pts.length - 1].avg)} r="4.5" fill="var(--c-chart-1)" stroke="var(--c-surf)" strokeWidth="2" />
      </svg>
    </div>);
}

function Meds({ m, lab, openCare }) {
  return (
    <div className={U.cardPad} data-testid="health-meds">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="font-extrabold text-[14.5px]">{tr("Family medicines & labs")}</span>
        <button className={U.btnS + " h-9! min-h-[36px]! px-3! text-[12.5px]!"} onClick={openCare}>{tr("Open Family")}<Arrow size={13} /></button>
      </div>
      {!m.rows.length && !lab ? <p className={"m-0 text-[13px] " + U.muted}>{tr("Add a medicine or a lab report in Family health to see them here.")}</p> : null}
      <div className="flex flex-col gap-2">
        {m.rows.map((r) => (
          <div key={r.med.id} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-[14px] bg-[var(--c-surf-2)] min-h-[52px]" data-testid="health-med-row">
            <span className="min-w-0"><span className="block truncate font-bold text-[13.5px]" dir="auto">{r.member ? r.member.name + " · " : ""}{r.med.name}{r.med.dose ? " · " + r.med.dose : ""}</span>
              <span className={"block truncate text-[11.5px] font-semibold " + U.muted} dir="auto">{T("{a} / {b} doses on time this week", { a: r.taken, b: r.due })}{r.left != null ? " · " + T("{n} left", { n: r.left }) : ""}</span></span>
            {r.days != null && r.days <= 1 ? <span className={U.tag("amber")}>{tr("Refill today")}</span>
              : r.pct != null ? <span className={U.tag(r.pct >= 90 ? "green" : "amber") + " tabular-nums"}>{r.pct}%</span> : null}
          </div>))}
        {lab ? (
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-[14px] bg-[var(--c-surf-2)] min-h-[52px]" data-testid="health-lab-row">
            <span className="min-w-0"><span className="block truncate font-bold text-[13.5px]" dir="auto">{tr("Latest lab")} · {lab.member ? lab.member + "’s " : ""}{lab.test}</span>
              <span className={"block truncate text-[11.5px] font-semibold " + U.muted} dir="auto">{lab.history ? T("{a} → {b} over {n} reports", { a: lab.history.first.value + (lab.last.unit ? " " + lab.last.unit : ""), b: lab.last.value + (lab.last.unit ? " " + lab.last.unit : ""), n: lab.history.n }) : dateLong(lab.last.date)}</span></span>
            <span className={U.tag(lab.last.high != null && lab.last.value > lab.last.high || lab.last.low != null && lab.last.value < lab.last.low ? "amber" : "green") + " tabular-nums"} dir="ltr">{lab.last.value}{lab.last.unit ? " " + lab.last.unit : ""}</span>
          </div>) : null}
      </div>
    </div>);
}

function CycleSum({ c, openCycle }) {
  if (!c) return null;
  const status = c.inPeriod ? T("Period — day {n}", { n: c.cycleDay }) : c.late ? T("{n} days late", { n: c.late }) : c.daysTo != null ? T("Next period in {n} days", { n: c.daysTo }) : "—";
  return (
    <div className={U.cardPad} data-testid="health-cycle-summary">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="font-extrabold text-[14.5px]">{tr("Cycle summary (private on this phone)")}</span>
        <button className={U.btnS + " h-9! min-h-[36px]! px-3! text-[12.5px]!"} onClick={openCycle}>{tr("Open Cycle")}<Arrow size={13} /></button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[[tr("Now"), status], [tr("Cycle average"), T("{a} days ({b}d flow)", { a: c.cycleLen, b: c.periodLen })], [tr("Last period"), c.last ? dateLong(c.last) : "—"]].map(([l, v]) => (
          <div key={l} className="p-2.5 rounded-[12px] bg-[var(--c-surf-2)] min-w-0"><div className={"text-[11px] font-bold " + U.muted}>{l}</div><div className="font-extrabold text-[13.5px]" dir="auto">{v}</div></div>))}
      </div>
    </div>);
}

/** Level 2 — the Health Report. */
export function HealthReport({ r, back, openCare, openCycle, openFit, printPdf, rangeLabel }) {
  const f = r.fit, w = r.weight, m = r.meds;
  const steady = f.pctOfTarget != null && f.pctOfTarget >= 90 && f.pctOfTarget <= 105;
  return (
    <div className="flex flex-col gap-3.5 lg:gap-[18px]" data-testid="health-report">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button className="w-11 h-11 shrink-0 rounded-[14px] grid place-items-center bg-[var(--c-surf)] border border-[var(--c-ln)] hover:border-[var(--c-acc)]" onClick={back} aria-label={tr("Back")} data-testid="health-report-back"><Arrow back size={17} /></button>
          <div className="min-w-0"><h2 className="text-[18px] lg:text-[21px] font-black tracking-tight m-0 truncate">{tr("Health Report")}</h2>
            <div className={"text-[12px] font-semibold truncate " + U.muted}>{rangeLabel} · {tr("this week")}</div></div>
        </div>
        <button className={U.btnS + " h-10! min-h-[40px]! px-3!"} onClick={printPdf} data-testid="health-report-pdf"><Printer size={14} />{tr("Doctor PDF")}</button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 lg:gap-3">
        <Tile label={tr("Calories · 7-day average")} value={f.avg ? n0(f.avg) + " kcal" : "—"} tone={f.avg ? "pos" : ""} testid="health-rep-kcal"
          pill={f.pctOfTarget != null ? [steady ? tr("On pace") : T("{p}%", { p: f.pctOfTarget }), steady ? "green" : "amber"] : null}
          sub={f.tg ? T("Target: {a} kcal/day", { a: n0(f.tg.kcal) }) + (f.avgP ? " · " + T("protein {p} g", { p: f.avgP }) : "") : tr("Set up Fit & Food for a target")} />
        <Tile label={tr("Weight trend")} value={w ? w.avg + " kg" : "—"} tone={w ? "pos" : ""} testid="health-rep-weight"
          pill={w && w.change ? [(w.change > 0 ? "+" : "") + w.change + " kg", "green"] : null}
          sub={w ? (w.goal ? T("Goal {a} kg", { a: w.goal }) : tr("No goal set")) : tr("No weights yet")} />
        <Tile label={tr("Doses taken on time")} value={m.pct != null ? m.pct + "%" : "—"} tone={m.pct != null ? (m.pct >= 90 ? "pos" : "warn") : ""} testid="health-rep-doses"
          sub={m.due ? T("{a} of {b} doses this week", { a: m.taken, b: m.due }) : tr("No medicines with times")} />
        <Tile label={tr("Water & workouts")} value={T("{a} L · {b} workouts", { a: f.water, b: f.workouts })} testid="health-rep-water"
          sub={f.steps ? T("about {n} steps a day", { n: n0(f.steps) }) : tr("water a day this week")} />
      </div>
      <div className="flex flex-col gap-3.5 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-[18px] lg:items-start">
        <div className="flex flex-col gap-3.5 min-w-0"><Calories f={f} /><Weight w={w} /></div>
        <div className="flex flex-col gap-3.5 min-w-0"><Meds m={m} lab={r.lab} openCare={openCare} /><CycleSum c={r.cycle} openCycle={openCycle} />
          <button className={U.btnS + " w-full"} onClick={openFit}>{tr("Open Fit & Food")}<Arrow size={13} /></button></div>
      </div>
      <p className={"m-0 text-[11.5px] text-center " + U.muted}>{tr("Worked out on this phone from your own entries. Not medical advice.")}</p>
    </div>);
}

