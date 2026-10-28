/* ---- v7.7 Mind & learning in two levels — Gemini's mock-up "Area 5" (Quiet Atelier, Option C), Ali sent it 24 Oct 2026. The calm
   pieces (Mind's numbers + "Do now", the streak) and the reports: Mind Report, Learning Report, Homework Report, Remember's
   library numbers and the Recall index. Every number from learning-report.js (code). Phone and computer, Arabic too. */
import React from "react";
import { ArrowLeft, Check, Hourglass, Sparkles, Flame, ShieldCheck, Brain, Search, ChevronRight } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import { Bars, SeeAll } from "./biz-dash-ui.jsx";
import * as U from "./ui-kit.jsx";

const ar = () => getLang() === "ar";
const I = (s) => "⁦" + s + "⁩";
const T = (k, v) => tr(k, v ? Object.fromEntries(Object.entries(v).map(([x, y]) => [x, /\d/.test(String(y)) ? I(y) : y])) : v);
const C = ["var(--c-chart-1)", "var(--c-chart-4)", "var(--c-chart-2)", "var(--c-chart-3)", "var(--c-acc)"];
const dueText = (p) => p.status === "late" ? (p.days === -1 ? tr("1 day late") : T("{n} days late", { n: -p.days })) : p.status === "today" ? tr("Due today")
  : p.status === "upcoming" ? (p.days === 1 ? tr("Due tomorrow") : T("Due in {n} days", { n: p.days })) : tr("No date");
const dueTone = (p) => (p.status === "late" ? "red" : p.status === "today" ? "amber" : "gray");

export function Tile({ label, value, sub, pill, tone, testid }) {
  return <div className={U.card + " p-3.5 min-w-0 space-y-1"} data-testid={testid}>
    <div className="flex items-start justify-between gap-2"><span className="text-[12px] font-bold text-[var(--c-mut)] leading-tight">{label}</span>{pill ? <span className={U.tag(tone || "green") + " shrink-0"}>{pill}</span> : null}</div>
    <b className={"block tabular-nums text-[clamp(18px,5vw,23px)] font-black tracking-tight leading-tight " + (tone === "amber" ? "text-[var(--c-warn)]" : tone === "pos" ? "text-[var(--c-pos)]" : "")} dir="auto">{value}</b>
    {sub ? <span className="block text-[11.5px] text-[var(--c-mut)] leading-snug">{sub}</span> : null}
  </div>;
}
const Card = ({ title, right, children, testid, className = "" }) => <div className={U.card + " p-4 min-w-0 " + className} data-testid={testid}>
  {title ? <div className="flex items-center justify-between gap-2 mb-2"><p className="text-[12px] font-extrabold tracking-[0.06em] uppercase text-[var(--c-mut)] m-0">{title}</p>{right}</div> : null}{children}</div>;
export const ReportHead = ({ title, sub, back, testid }) => <div className="flex items-center gap-2.5" data-testid={testid}>
  {back ? <button onClick={back} aria-label={tr("Back")} className="w-10 h-10 rounded-full grid place-items-center bg-[var(--c-surf)] border border-[var(--c-ln)] shrink-0" data-testid="report-back"><ArrowLeft size={17} className="rtl:-scale-x-100" /></button> : null}
  <div className="min-w-0"><h3 className="text-[19px] font-black tracking-tight m-0">{title}</h3>{sub ? <p className="m-0 text-[12.5px] c-sub">{sub}</p> : null}</div></div>;

// ---- Mind -----------------------------------------------------------------------------------------------------------------------------
/** Mind's calm top: three numbers (computer) and the one promise to do now. */
export function MindCalmTop({ rep, wide, onDone, openPromises, openRecall = null }) {
  const p = rep.promises.find((x) => x.status === "late" || x.status === "today");
  return <div className="space-y-3" data-testid="mind-calm">
    {wide ? <div className="grid grid-cols-3 gap-3">
      <Tile label={tr("Everything kept")} value={String(rep.total)} sub={tr("Private, on this device")} testid="mind-kpi-total" />
      <Tile label={tr("Promises due")} value={String(rep.due)} tone={rep.due ? "amber" : undefined} pill={rep.today ? T("{n} today", { n: rep.today }) : null} sub={rep.late ? T("{n} late", { n: rep.late }) : tr("Nothing late")} testid="mind-kpi-promises" />
      <Tile label={tr("Auto spaces")} value={String(rep.spaces)} sub={rep.tags.filter((t) => t.count >= 2).slice(0, 4).map((t) => "#" + t.tag).join(" · ") || tr("They appear as you keep things")} testid="mind-kpi-spaces" />
    </div> : null}
    {p ? <div className={U.card + " p-4 border-[var(--c-warn)]! space-y-1.5"} style={{ borderColor: "var(--c-warn)" }} data-testid="mind-do-now">
      <div className="flex items-center justify-between gap-2"><span className="text-[12.5px] font-extrabold flex items-center gap-1.5"><Hourglass size={14} className="text-[var(--c-warn)]" />{tr("Do now")}</span><span className={U.tag(dueTone(p))}>{dueText(p)}</span></div>
      <div className="flex items-center gap-3"><p className="flex-1 m-0 text-[15px] font-extrabold leading-snug" dir="auto">{p.action}</p>
        <button onClick={() => onDone(p.id)} className={U.btnP + " h-10! min-h-[40px]! rounded-full shrink-0"} data-testid="mind-do-now-done"><Check size={16} />{tr("Done")}</button></div>
      {p.whenText ? <p className="m-0 text-[12px] c-sub" dir="auto">{p.whenText}</p> : null}
    </div> : null}
    {/* v7.9 (Ali: "some features require extensive searching to find"): Recall lives in Mind — one row to it */}
    {openRecall ? <button onClick={openRecall} className={U.card + " w-full text-start p-3.5 min-h-[56px] flex items-center gap-3 hover:border-[var(--c-acc)]"} data-testid="mind-open-recall">
      <span className="w-10 h-10 rounded-[12px] grid place-items-center bg-[var(--c-soft)] text-[var(--c-acc)] shrink-0"><Search size={18} /></span>
      <span className="flex-1 min-w-0"><b className="block text-[14.5px] font-extrabold">{tr("Recall")}</b><span className="c-sub block text-[12.5px] truncate">{tr("Find anything you kept, by what it meant")}</span></span>
      <ChevronRight size={16} className="c-acc shrink-0 rtl:-scale-x-100" /></button> : null}
  </div>;
}
export function MindReport({ rep, back, open, onDone, compact = false }) {
  const max = Math.max(1, ...rep.kinds.map((k) => k.n));
  return <div className="space-y-3" data-testid="mind-report">
    <ReportHead title={tr("Mind Report")} sub={tr("What you kept this week, promises due or late, top tags and forgotten gems")} back={back} />
    <div className={"grid gap-2.5 " + (compact ? "grid-cols-2" : "grid-cols-3")}>
      <Tile label={tr("Kept this week")} value={String(rep.week)} tone="pos" testid="mind-rep-week" />
      <Tile label={tr("Promises due")} value={String(rep.due)} tone={rep.due ? "amber" : undefined} />
      {compact ? null : <Tile label={tr("Everything")} value={String(rep.total)} />}
    </div>
    <div className={compact ? "space-y-3" : "space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3"}>
      <Card title={T("What you kept this week by kind ({n} items)", { n: rep.week })} testid="mind-rep-kinds">
        {rep.kinds.length ? <div className="flex items-end gap-3 h-[120px] pt-4">{rep.kinds.map((k, i) => <div key={k.kind} className="flex-1 min-w-0 flex flex-col items-center justify-end gap-1 h-full">
          <span className="text-[12px] font-black tabular-nums">{k.n}</span>
          <span className="w-full max-w-[56px] rounded-[12px]" style={{ height: Math.max(8, (k.n / max) * 70), background: C[i % C.length] }} />
          <span className="text-[11px] font-bold c-sub truncate max-w-full">{ar() ? k.labelAr : tr(k.label)}</span></div>)}</div>
          : <p className="m-0 text-[13px] c-sub">{tr("Nothing kept this week yet.")}</p>}
      </Card>
      <Card title={tr("Promises due or late")} testid="mind-rep-promises">
        {rep.promises.slice(0, 4).map((p) => <div key={p.id} className="flex items-center gap-2 py-2 border-t border-[var(--c-ln)] first:border-t-0">
          <span className="flex-1 min-w-0 text-[13.5px] font-bold truncate" dir="auto">{p.action}</span><span className={U.tag(dueTone(p)) + " shrink-0"}>{dueText(p)}</span>
          {onDone ? <button onClick={() => onDone(p.id)} aria-label={tr("Done")} className="w-9 h-9 grid place-items-center rounded-full c-sub hover:text-[var(--c-pos)] shrink-0"><Check size={16} /></button> : null}</div>)}
        {!rep.promises.length ? <p className="m-0 text-[13px] c-sub">{tr("No open promises.")}</p> : null}
      </Card>
      <Card title={tr("Most-used tags")} testid="mind-rep-tags">
        <div className="flex flex-wrap gap-1.5">{rep.tags.map((t) => <span key={t.tag} className={U.tag("blue")} dir="auto">#{t.tag} · {t.count}</span>)}</div>
        {!rep.tags.length ? <p className="m-0 text-[13px] c-sub">{tr("Tags appear as you keep things.")}</p> : null}
      </Card>
      <Card title={tr("Things you forgot you have")} testid="mind-rep-forgotten" className="border-[var(--c-acc)]!">
        {rep.forgotten.map((r, i) => <button key={r.id} onClick={() => open(r.id)} className="w-full text-start flex gap-2 py-1.5 text-[13.5px] font-bold min-h-[40px]" dir="auto">
          <Sparkles size={14} className="text-[var(--c-acc)] mt-0.5 shrink-0" /><span className="min-w-0">{i + 1}. {r.title} <span className="c-sub font-semibold">({T("kept {d}", { d: new Date(r.ts).toLocaleDateString(ar() ? "ar-EG-u-nu-latn" : undefined, { day: "numeric", month: "short" }) })})</span></span></button>)}
        {!rep.forgotten.length ? <p className="m-0 text-[13px] c-sub">{tr("Nothing old yet — come back in a few weeks.")}</p> : null}
      </Card>
    </div>
  </div>;
}

// ---- Learn daily -------------------------------------------------------------------------------------------------------------------
export const StreakPill = ({ n }) => n ? <span className="inline-flex items-center gap-1 rounded-full px-3 h-8 text-[12.5px] font-extrabold bg-[var(--c-soft)] text-[var(--c-acc)]" data-testid="learn-streak"><Flame size={13} />{T("{n}-day streak", { n })}</span> : null;
export function LearningReport({ rep, back }) {
  return <div className="space-y-3" data-testid="learn-report">
    <ReportHead title={tr("Learning Report")} sub={tr("Days studied, quiz scores over time, what you learned and what to review")} back={back} />
    <div className="grid grid-cols-3 gap-2.5">
      <Tile label={tr("Days studied")} value={I(rep.daysThisMonth + " / " + rep.dayOfMonth)} tone="pos" sub={rep.streak ? T("{n}-day streak", { n: rep.streak }) : tr("Start a streak today")} testid="learn-rep-days" />
      <Tile label={tr("Quiz accuracy")} value={rep.accuracy != null ? I(rep.accuracy + "%") : "—"} tone="pos" sub={rep.firstAcc != null && rep.quizzes.length > 1 ? T("from {p}% at first", { p: rep.firstAcc }) : tr("After your first quiz")} testid="learn-rep-acc" />
      <Tile label={tr("Learned")} value={String(rep.learned)} sub={T("{n} cards in review", { n: rep.inDeck })} testid="learn-rep-learned" />
    </div>
    <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3">
      <Card title={tr("Quiz scores over time")} testid="learn-rep-quiz">
        {rep.quizzes.length ? <Bars rows={rep.quizzes.map((q, i) => ({ ...q, hi: i === rep.quizzes.length - 1 }))} bars={[{ key: "pct", color: "var(--c-chart-1)" }]} line={{ key: "pct", color: "var(--c-chart-2)" }} label={(r) => I(r.pct + "%")} height={140} />
          : <p className="m-0 text-[13px] c-sub">{tr("A quiz comes after every few lessons.")}</p>}</Card>
      <Card title={tr("Weak points to review")} right={rep.cardsDue ? <span className={U.tag("amber")}>{rep.cardsDue === 1 ? tr("1 card due") : T("{n} cards due", { n: rep.cardsDue })}</span> : null} testid="learn-rep-weak">
        {rep.weak.map((w, i) => <p key={i} className="m-0 py-2 border-t border-[var(--c-ln)] first:border-t-0 text-[13.5px] font-bold" dir="auto">{w.text} <span className="c-sub font-semibold">· {w.course}</span></p>)}
        {!rep.weak.length ? <p className="m-0 text-[13px] c-sub">{tr("Nothing to review — well done.")}</p> : null}</Card>
      <Card title={tr("Your courses")} testid="learn-rep-courses" className="lg:col-span-2">
        {rep.courses.map((c) => <div key={c.id} className="py-2 border-t border-[var(--c-ln)] first:border-t-0">
          <div className="flex justify-between gap-2 text-[13.5px] font-bold"><span className="truncate" dir="auto">{c.title}</span><span className="tabular-nums c-sub shrink-0">{I(c.done + " / " + c.of)}</span></div>
          <div className="c-bar mt-1.5" aria-hidden="true"><i style={{ width: Math.max(2, c.pct) + "%" }} /></div></div>)}</Card>
    </div>
  </div>;
}

// ---- Homework -------------------------------------------------------------------------------------------------------------------------
export function HomeworkReport({ rep, back, names }) {
  return <div className="space-y-3" data-testid="coach-report">
    <ReportHead title={tr("Homework Report")} sub={tr("Problems this week, right the first time, and what to practise")} back={back} />
    <div className="grid grid-cols-3 gap-2.5">
      <Tile label={tr("This week")} value={String(rep.week)} sub={tr("problems")} testid="coach-rep-week" />
      <Tile label={tr("First try")} value={rep.pct != null ? I(rep.pct + "%") : "—"} tone="pos" sub={T("{n} right", { n: rep.right })} testid="coach-rep-pct" />
      <Tile label={tr("All time")} value={String(rep.total)} sub={tr("problems")} />
    </div>
    <Card title={tr("By topic")} testid="coach-rep-topics">
      {rep.topics.map((t) => <div key={t.topic} className="py-2 border-t border-[var(--c-ln)] first:border-t-0">
        <div className="flex justify-between gap-2 text-[13.5px] font-bold"><span>{tr(names[t.topic] || t.topic)}</span><span className={"tabular-nums " + (t.pct < 70 ? "text-[var(--c-warn)]" : "text-[var(--c-pos)]")}>{I(t.pct + "%")} <span className="c-sub font-semibold">· {I(t.right + "/" + (t.right + t.wrong))}</span></span></div>
        <div className="c-bar mt-1.5" aria-hidden="true"><i style={{ width: Math.max(2, t.pct) + "%", background: t.pct < 70 ? "var(--c-warn)" : undefined }} /></div></div>)}
      {!rep.topics.length ? <p className="m-0 text-[13px] c-sub">{tr("Solve a problem with Teach me — your progress shows here.")}</p> : null}
    </Card>
  </div>;
}

// ---- Remember & Recall --------------------------------------------------------------------------------------------------------------
export function LibraryNumbers({ s }) {
  return <div className="grid grid-cols-3 gap-2.5" data-testid="lib-report">
    <Tile label={tr("Kept")} value={String(s.sources)} sub={T("{n} books", { n: s.books })} />
    <Tile label={tr("Chapters indexed")} value={String(s.chapters)} tone="pos" />
    <Tile label={tr("Storage used")} value={s.mb ? I(s.mb + " MB") : "—"} sub={tr("On this phone only")} />
  </div>;
}
export function RecallReport({ s, labels, notesOn }) {
  return <div className={U.card + " p-4 space-y-3"} data-testid="recall-report">
    <div className="flex items-center gap-2"><Brain size={16} className="text-[var(--c-acc)]" /><p className="m-0 text-[15px] font-extrabold flex-1">{tr("Recall index")}</p><span className={U.tag("green")}><ShieldCheck size={12} />{tr("On this phone")}</span></div>
    <div className="grid grid-cols-2 gap-2.5"><Tile label={tr("Things indexed")} value={String(s.total)} tone="pos" /><Tile label={tr("Sent anywhere")} value="0" sub={tr("Private forever")} /></div>
    {s.kinds.map((k) => <div key={k.kind}><div className="flex justify-between text-[13px] font-bold"><span>{labels[k.kind] || k.kind}</span><span className="tabular-nums c-sub">{I(k.count + " (" + k.pct + "%)")}</span></div>
      <div className="c-bar mt-1" aria-hidden="true"><i style={{ width: Math.max(2, k.pct) + "%" }} /></div></div>)}
    {notesOn != null ? <p className="m-0 text-[12.5px] c-sub">{notesOn ? tr("Keeping your notifications for 30 days (never SMS).") : tr("Notifications are not kept.")}</p> : null}
  </div>;
}
export { SeeAll };
