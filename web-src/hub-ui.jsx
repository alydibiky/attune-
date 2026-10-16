/* ---- v6.30 the tab row on top of a combined page (hubs.js): the tools that belong together are one page — a tab opens the
   sibling. Scrolls sideways on a phone; Back still walks the pages you opened. */
import React from "react";
import { tr } from "./i18n.js";
import { INSIDE } from "./hubs.js";

// parts = [main, inside] of a merged page (hubs.js INSIDE, e.g. Assistants · Skills): a small switch under the tabs
export function HubTabs({ mode, tabs, titleOf, navTo, parts = [] }) {
  const on = (m) => m === mode || INSIDE[mode] === m;
  return (
    <>
    <div className="att-hscroll flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-2 mb-3" role="tablist" data-testid="hub-tabs">
      {tabs.map((m) => (
        <button key={m} role="tab" aria-selected={on(m)} onClick={() => { if (m !== mode) navTo(m); }} data-testid={"hub-tab-" + m}
          className={"shrink-0 rounded-full px-3.5 py-1.5 text-[13px] border whitespace-nowrap transition-colors " +
            (on(m) ? "border-teal-600 bg-teal-500/15 text-teal-200 font-medium" : "border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700")}>
          {tr(titleOf(m))}</button>))}
    </div>
    {parts.length === 2 ? (
      <div className="inline-flex rounded-lg border border-slate-800 bg-slate-900 p-0.5 mb-3" data-testid="hub-parts">
        {parts.map((m) => (
          <button key={m} onClick={() => { if (m !== mode) navTo(m); }} aria-pressed={m === mode} data-testid={"hub-part-" + m}
            className={"rounded-md px-3 py-1 text-[12.5px] " + (m === mode ? "bg-slate-700 text-white font-medium" : "text-slate-400 hover:text-slate-200")}>
            {tr(titleOf(m))}</button>))}
      </div>) : null}
    </>);
}
