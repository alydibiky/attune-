/* ---- v6.27 The computer layout, option A (Ali picked it 14 Oct): "two panels" — what you type or choose on the left,
   the answer on the right; lists become grids of cards. Below 1024 px (phones, small tablets) nothing changes: the
   panels stack in their phone order. Use:
     <div className={PANES}><div className={LEFT}>…inputs…</div><div className={RIGHT}>{result || <DeskEmpty … />}</div></div>
   GRID2 / GRID3: a list of cards in 2 / 3 columns on a computer.                                                           */
import React from "react";

export const PANES = "lg:grid lg:grid-cols-[minmax(340px,440px)_minmax(0,1fr)] lg:gap-6 lg:items-start";
export const PANES_WIDE_LEFT = "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] lg:gap-6 lg:items-start";
export const LEFT = "space-y-4 lg:sticky lg:top-4";
export const RIGHT = "space-y-4 mt-4 lg:mt-0 min-w-0";
export const GRID2 = "lg:grid lg:grid-cols-2 lg:gap-4 space-y-3 lg:space-y-0";
export const GRID3 = "lg:grid lg:grid-cols-3 lg:gap-4 space-y-3 lg:space-y-0";
/** The right panel before there is an answer — only on a computer (a phone shows nothing there). */
export function DeskEmpty({ icon: Icon, title, text, testid }) {
  return (
    <div className="hidden lg:flex flex-col items-center justify-center text-center rounded-[22px] border border-dashed border-slate-800 min-h-[360px] p-10 text-slate-500" data-testid={testid || "desk-empty"}>
      {Icon ? <span className="mb-3 w-14 h-14 rounded-[18px] grid place-items-center bg-teal-500/10 text-teal-300"><Icon size={26} /></span> : null}
      {title ? <p className="text-[15px] text-slate-200 font-extrabold m-0">{title}</p> : null}
      {text ? <p className="text-[13px] mt-1.5 max-w-sm m-0 leading-relaxed">{text}</p> : null}
    </div>);
}
