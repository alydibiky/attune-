/* ---- v6.30 the tab row on top of a combined page (hubs.js): the tools that belong together are one page — a tab opens the
   sibling. Scrolls sideways on a phone; Back still walks the pages you opened. */
import React from "react";
import { tr } from "./i18n.js";
import { INSIDE } from "./hubs.js";

// parts = [main, ...inside] of a merged page (hubs.js INSIDE, e.g. Assistants · Skills; Watch = Payments · Dates · Reminders):
// a small switch under the tabs. A part can have its own short name (the tab "Watch" is "Payments" in its switch).
const PART_TITLE = { guardian: "Payments", radar: "Dates", reminders: "Reminders", life: "People & plans", xray: "Chat X-Ray" };   // (v6.36 Follow-ups)
export function HubTabs({ mode, tabs, titleOf, navTo, parts = [] }) {
  const on = (m) => m === mode || INSIDE[mode] === m;
  return (
    <>
    <div className="att-hscroll flex gap-5 overflow-x-auto -mx-3 px-3 mb-4 border-b border-slate-800/80" role="tablist" data-testid="hub-tabs">
      {tabs.map((m) => (
        <button key={m} role="tab" aria-selected={on(m)} onClick={() => { if (m !== mode) navTo(m); }} data-testid={"hub-tab-" + m}
          className={"shrink-0 h-10 -mb-px text-[14px] whitespace-nowrap border-b-2 transition-colors " +
            (on(m) ? "border-teal-400 text-white font-semibold" : "border-transparent text-slate-400 hover:text-slate-200")}>
          {tr(titleOf(m))}</button>))}
    </div>
    {parts.length >= 2 ? (
      <div className="inline-flex max-w-full overflow-x-auto no-scrollbar rounded-lg border border-slate-800 bg-slate-900 p-0.5 mb-3" data-testid="hub-parts">
        {parts.map((m) => (
          <button key={m} onClick={() => { if (m !== mode) navTo(m); }} aria-pressed={m === mode} data-testid={"hub-part-" + m}
            className={"shrink-0 whitespace-nowrap rounded-md px-3 py-1 text-[12.5px] " + (m === mode ? "bg-slate-700 text-white font-medium" : "text-slate-400 hover:text-slate-200")}>
            {tr(PART_TITLE[m] || titleOf(m))}</button>))}
      </div>) : null}
    </>);
}
