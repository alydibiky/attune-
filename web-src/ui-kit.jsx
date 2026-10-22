/* ---- v7.0 The Attune UI kit — Gemini's Direction 2 "Quiet Atelier" (Ali picked it, 22 Oct 2026; "I want the interface of Gemini
   to be in everything"). The SAME building blocks on every screen, taken from Gemini's own fleet-ui.jsx: 22-px cards on the
   surface, jade primary buttons, terracotta pill for what is selected, KPI tiles with tabular numbers, quiet labels. Colours come
   only from the theme tokens in build/tw.css (.calm: --c-bg --c-surf --c-surf-2 --c-ink --c-mut --c-ln --c-acc --c-acc-2
   --c-on-acc --c-on-acc-2 --c-soft --c-pos --c-warn --c-neg), so light and dark both work. A page's root gets the class "calm".
   Rules (GEMINI_DESIGN_BRIEF.md): logical classes only (ps/pe/ms/me/start/end), touch targets ≥ 44 px, no blur on big areas. */
import React from "react";
import { ChevronRight } from "lucide-react";

export const page = "calm min-h-full bg-[var(--c-bg)] text-[var(--c-ink)]";
export const card = "rounded-[22px] bg-[var(--c-surf)] border border-[var(--c-ln)] text-[var(--c-ink)] shadow-[0_2px_10px_rgba(0,0,0,0.06)]";
export const cardPad = card + " p-4";
export const btnP = "min-h-[48px] h-12 px-5 rounded-[16px] bg-[var(--c-acc)] text-[var(--c-on-acc)] font-extrabold text-[15px] disabled:opacity-40 inline-flex items-center justify-center gap-2 transition-opacity duration-150 cursor-pointer";
export const btnS = "min-h-[44px] h-11 px-3.5 rounded-[14px] border border-[var(--c-ln)] bg-[var(--c-surf)] text-[var(--c-ink)] hover:border-[var(--c-acc)] text-[13.5px] font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-40 transition-colors duration-150 cursor-pointer";
export const btnDanger = "min-h-[44px] h-11 px-3.5 rounded-[14px] border border-[var(--c-neg)] text-[var(--c-neg)] bg-transparent text-[13.5px] font-bold inline-flex items-center justify-center gap-1.5";
export const inp = "w-full min-w-0 min-h-[44px] h-11 rounded-[14px] bg-[var(--c-bg)] border border-[var(--c-ln)] px-3.5 text-[15px] font-semibold text-[var(--c-ink)] placeholder:text-[var(--c-mut)] placeholder:font-normal focus:outline-none focus:border-[var(--c-acc)] focus:bg-[var(--c-surf)] transition-colors duration-150";
export const area = inp.replace("h-11 ", "") + " py-2.5 leading-relaxed";
export const muted = "text-[var(--c-mut)]";
export const label = "text-[11px] font-extrabold tracking-[0.08em] uppercase text-[var(--c-mut)]";
export const h1 = "text-[22px] font-black tracking-tight m-0";
export const h2 = "text-[16px] font-extrabold m-0";
/** A chip / pill that can be selected: terracotta when on (Gemini's active pill), quiet outline when off. */
export const chip = (on) => "min-h-[44px] h-11 px-4 rounded-full text-[13.5px] font-extrabold whitespace-nowrap border inline-flex items-center gap-1.5 transition-colors duration-150 "
  + (on ? "bg-[var(--c-acc-2)] text-[var(--c-on-acc-2)] border-transparent shadow-sm" : "bg-[var(--c-surf)] border-[var(--c-ln)] text-[var(--c-mut)] hover:text-[var(--c-ink)]");
/** Status words (always a word with the colour): good / due / late / info. */
export const tag = (tone = "gray") => "inline-flex items-center gap-1 text-[11px] font-extrabold rounded-full px-2.5 py-0.5 whitespace-nowrap " + ({
  gray: "bg-[var(--c-bg)] text-[var(--c-mut)] border border-[var(--c-ln)]",
  green: "bg-[var(--c-soft)] text-[var(--c-pos)] border border-[var(--c-pos)]/30",
  red: "bg-[var(--c-neg)]/15 text-[var(--c-neg)] border border-[var(--c-neg)]/30",
  amber: "bg-[var(--c-warn)]/15 text-[var(--c-warn)] border border-[var(--c-warn)]/30",
  blue: "bg-[var(--c-soft)] text-[var(--c-acc)] border border-[var(--c-acc)]/30" }[tone] || "");

/** Segmented choice: a row of chips, the chosen one terracotta. items = [[value, label], …] (labels already translated). */
export function Seg({ value, onChange, items, testid }) {
  return <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" data-testid={testid} role="tablist">{items.map(([v, l]) =>
    <button key={v} role="tab" aria-selected={value === v} onClick={() => onChange(v)} data-testid={testid ? testid + "-" + v : undefined} className={chip(value === v)}>{l}</button>)}</div>;
}
/** A KPI tile: a quiet label, a big number (tabular), an optional pill and bar. */
export function Kpi({ label: l, value, pill, pct, tone, testid, sub }) {
  return <div className={card + " p-3.5 space-y-1.5"} data-testid={testid}>
    <div className="flex items-center justify-between gap-2"><span className={"text-[12px] font-bold truncate " + muted}>{l}</span>{pill ? <span className={tag(tone === "red" ? "red" : tone === "amber" ? "amber" : "green")}>{pill}</span> : null}</div>
    <b className={"block tabular-nums text-[clamp(17px,4.6vw,21px)] font-black tracking-tight " + (tone === "red" ? "text-[var(--c-neg)]" : tone === "pos" ? "text-[var(--c-pos)]" : "")} dir="ltr">{value}</b>
    {pct != null ? <div className="c-bar"><i style={{ width: Math.max(2, Math.min(100, pct)) + "%" }} /></div> : null}
    {sub ? <span className={"block text-[11px] truncate " + muted}>{sub}</span> : null}
  </div>;
}
/** A list row that opens something: icon well · text · chevron. */
export function Row({ icon: I, title, sub, end, onClick, testid }) {
  return <button onClick={onClick} data-testid={testid} className={card + " w-full text-start p-3.5 min-h-[56px] flex items-center gap-3 hover:border-[var(--c-acc)]"}>
    {I ? <span className="w-10 h-10 rounded-[14px] grid place-items-center bg-[var(--c-soft)] text-[var(--c-acc)] shrink-0"><I size={18} /></span> : null}
    <span className="flex-1 min-w-0"><span className="block font-extrabold text-[14.5px] truncate" dir="auto">{title}</span>{sub ? <span className={"block text-[12.5px] truncate " + muted} dir="auto">{sub}</span> : null}</span>
    {end}<ChevronRight size={18} className={"shrink-0 rtl:rotate-180 " + muted} /></button>;
}
/** A page header: title, one quiet line under it, actions at the end. */
export function Head({ title, sub, actions, testid }) {
  return <div className="flex items-start gap-3" data-testid={testid}><div className="flex-1 min-w-0"><h1 className={h1}>{title}</h1>{sub ? <p className={"m-0 mt-0.5 text-[13px] " + muted}>{sub}</p> : null}</div>{actions}</div>;
}
/** The empty state: a soft icon, one sentence, one action. */
export function Empty({ icon: I, children, action }) {
  return <div className={card + " p-6 text-center space-y-3"}>{I ? <span className="mx-auto w-12 h-12 rounded-2xl grid place-items-center bg-[var(--c-soft)] text-[var(--c-acc)]"><I size={22} /></span> : null}
    <p className={"m-0 text-[14px] font-semibold " + muted}>{children}</p>{action}</div>;
}
