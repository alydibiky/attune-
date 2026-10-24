/* ---- v6.30 the tab row on top of a combined page (hubs.js): the tools that belong together are one page — a tab opens the
   sibling. Scrolls sideways on a phone; Back still walks the pages you opened. */
import React from "react";
import { Briefcase, Truck, Building2, HardHat, Wrench } from "lucide-react";
import { tr } from "./i18n.js";
import { INSIDE } from "./hubs.js";

// parts = [main, ...inside] of a merged page (hubs.js INSIDE, e.g. Assistants · Skills; Watch = Payments · Dates · Reminders):
// a small switch under the tabs. A part can have its own short name (the tab "Watch" is "Payments" in its switch).
const PART_TITLE = { guardian: "Payments", radar: "Dates", reminders: "Reminders", life: "People & plans", xray: "Chat X-Ray", timeline: "Timeline" };   // (v6.36 Follow-ups)
// v6.43 (Ali: "the business apps on their own"): on a phone, Business is its own app — its parts are a bottom bar with icons
const BAR_ICON = { business: Briefcase, fleet: Truck, crane: Building2, field: HardHat, tools: Wrench };
export function HubTabs({ mode, tabs, titleOf, navTo, parts = [], asBar = false }) {
  const on = (m) => m === mode || INSIDE[mode] === m;
  if (asBar) return (
    <>
    <div style={{ height: 80 }} aria-hidden="true" />
    <nav className="calm fixed bottom-0 inset-x-0 z-[55] bg-[var(--c-surf)]! border-t border-[var(--c-ln)]" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} role="tablist" data-testid="hub-tabs">
      <div className="max-w-3xl mx-auto flex h-[66px]">
        {tabs.map((m) => { const I = BAR_ICON[m] || Briefcase; return (
          <button key={m} role="tab" aria-selected={on(m)} onClick={() => { if (m !== mode) navTo(m); }} data-testid={"hub-tab-" + m}
            className={"flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 text-[11.5px] " + (on(m) ? "text-[var(--c-acc)] font-bold" : "text-[var(--c-mut)] font-medium")}>
            <I size={22} strokeWidth={on(m) ? 2.4 : 2} /><span className="truncate max-w-full px-0.5">{tr(titleOf(m))}</span></button>); })}
      </div>
    </nav>
    </>);
  return (
    <>
    <div className="calm bg-transparent! att-hscroll flex gap-5 overflow-x-auto -mx-3 px-3 mb-4 border-b border-[var(--c-ln)]" role="tablist" data-testid="hub-tabs">
      {tabs.map((m) => (
        <button key={m} role="tab" aria-selected={on(m)} onClick={() => { if (m !== mode) navTo(m); }} data-testid={"hub-tab-" + m}
          className={"shrink-0 h-11 -mb-px text-[14px] whitespace-nowrap border-b-2 transition-colors duration-150 " +
            (on(m) ? "border-[var(--c-acc-2)] text-[var(--c-ink)] font-extrabold" : "border-transparent text-[var(--c-mut)] font-bold hover:text-[var(--c-ink)]")}>
          {tr(titleOf(m))}</button>))}
    </div>
    {parts.length >= 2 ? (
      <div className="calm inline-flex gap-0.5 max-w-full overflow-x-auto no-scrollbar rounded-full border border-[var(--c-ln)] bg-[var(--c-surf)]! p-1 mb-3" data-testid="hub-parts">
        {parts.map((m) => (
          <button key={m} onClick={() => { if (m !== mode) navTo(m); }} aria-pressed={m === mode} data-testid={"hub-part-" + m}
            className={"shrink-0 whitespace-nowrap min-h-[36px] rounded-full px-3.5 text-[13px] font-bold transition-colors duration-150 " + (m === mode ? "bg-[var(--c-acc-2)] text-[var(--c-on-acc-2)] font-extrabold" : "text-[var(--c-mut)] hover:text-[var(--c-ink)]")}>
            {tr(PART_TITLE[m] || titleOf(m))}</button>))}
      </div>) : null}
    </>);
}
