/* ---- v6.30 the tab row on top of a combined page (hubs.js): the tools that belong together are one page — a tab opens the
   sibling. Scrolls sideways on a phone; Back still walks the pages you opened. */
import React from "react";
import { tr } from "./i18n.js";

export function HubTabs({ mode, tabs, titleOf, navTo }) {
  return (
    <div className="att-hscroll flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-2 mb-3" role="tablist" data-testid="hub-tabs">
      {tabs.map((m) => (
        <button key={m} role="tab" aria-selected={m === mode} onClick={() => { if (m !== mode) navTo(m); }} data-testid={"hub-tab-" + m}
          className={"shrink-0 rounded-full px-3.5 py-1.5 text-[13px] border whitespace-nowrap transition-colors " +
            (m === mode ? "border-teal-600 bg-teal-500/15 text-teal-200 font-medium" : "border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700")}>
          {tr(titleOf(m))}</button>))}
    </div>);
}
