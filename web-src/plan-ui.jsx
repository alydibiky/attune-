/* ---- v9.9.34 FP-4: the small "Part of Pro" card a Pro-only screen shows in Free, and the one way every screen opens the Plan page.
   Nothing the person made is hidden or deleted: the card says so. */
import React from "react";
import { tr } from "./i18n.js";
import { allowed } from "./plan.js";

/** Opens the Plan page from anywhere (attune.jsx listens). */
export function openPlan() { try { window.dispatchEvent(new CustomEvent("attune-show-plan")); } catch (e) {} }

/** children when `feature` may be used now; else one short card with "See Pro". */
export function ProLock({ feature, what, children, compact = false }) {
  if (allowed(feature)) return children || null;
  return (
    <div className="c-card space-y-2" data-testid="pro-lock" data-feature={feature} style={{ borderColor: "var(--c-acc)" }}>
      <div className="flex items-center gap-2"><span className="text-[10.5px] font-black tracking-[0.06em] rounded-md px-1.5 py-0.5 bg-[var(--c-acc)] text-[var(--c-on-acc,#fff)]">PRO</span>
        {what ? <b className="text-[14.5px]" dir="auto">{tr(what)}</b> : null}</div>
      {compact ? null : <p className="text-[13.5px] text-[var(--c-mut)] m-0" dir="auto">{tr("This is part of Pro. Everything you made stays yours in Free.")}</p>}
      <button type="button" onClick={openPlan} className="min-h-[44px] h-11 rounded-[12px] px-4 font-extrabold text-[14px] bg-[var(--c-btn,var(--c-acc))] text-[var(--c-on-btn,var(--c-on-acc,#fff))]" data-testid="pro-lock-see">{tr("See Pro")}</button>
    </div>);
}

/** A whole screen that is Pro only: Free sees the card (with Close / Back when the screen has one), Pro sees the screen. */
export function proGate(feature, what, Comp, { overlay = false } = {}) {
  return function Gated(props) {
    if (allowed(feature)) return <Comp {...props} />;
    const done = props.onClose || props.back || null;
    const card = (<div className="space-y-2"><ProLock feature={feature} what={what} />
      {done ? <button type="button" onClick={done} className="min-h-[44px] h-11 rounded-[12px] px-4 font-extrabold text-[14px] border border-[var(--c-ln)] bg-[var(--c-surf)]" data-testid="pro-lock-close">{tr("Close")}</button> : null}</div>);
    return overlay ? <div className="fixed inset-0 z-[70] bg-black/35 flex items-end sm:items-center justify-center" onClick={done || undefined}>
      <div className="w-full max-w-[520px] rounded-t-[24px] sm:rounded-[24px] bg-[var(--c-bg)] p-4" onClick={(e) => e.stopPropagation()}>{card}</div></div> : <div className="p-4">{card}</div>;
  };
}
