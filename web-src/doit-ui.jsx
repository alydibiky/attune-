/* ---- v6.28 "Do it from Home" — the result card shared by the phone Home (home-ui.jsx) and the computer Home (desk-ui.jsx): what was
   done (each line opens its tool), one Undo for all of it, or the answer to a question about your own data. Logic: doit.js.      */
import React, { useState } from "react";
import { Check, Undo2, ChevronRight, AlertTriangle } from "lucide-react";
import { tr } from "./i18n.js";
import { cardPad, btnP, btnS, muted } from "./ui-kit.jsx";

const TOOL_NAME = { fit: "Fit & Food", money: "Money", care: "Family health", life: "People & plans", radar: "Deadline Radar", reminders: "Reminders", memory: "Mind", cycle: "Cycle", scout: "Scout" };
/** v6.28 "Do it from Home": what was done (each line opens its tool), Undo for all of it; or the answer to a question about your data. */
export function DoResult({ r, navTo, onClose, onUndo }) {
  const [undone, setUndone] = useState(false);
  if (!r) return null;
  if (r.answer) {
    const a = r.answer;
    return (
      <div className={cardPad + " space-y-2.5"} data-testid="do-answer">
        <p className="m-0 text-[15px] font-medium" dir="auto">{(r.ar ? a.ar : tr(a.en)).replace(/\*\*/g, "")}</p>
        {(a.rows || []).length ? <div className="space-y-0.5">{a.rows.slice(0, 6).map(([k, v], i) => <div key={i} className="flex gap-3 text-[13px]"><span className="c-sub shrink-0" dir="auto">{k}</span><span className="c-num tabular-nums font-semibold" dir="auto">{v}</span></div>)}</div> : null}
        <div className="flex items-center gap-2">{a.open && TOOL_NAME[a.open] ? <button className={btnP + " !h-11 !min-h-[44px] !text-[14px]"} onClick={() => navTo(a.open)} data-testid="do-open">{tr("Open {t}", { t: tr(TOOL_NAME[a.open]) })}<ChevronRight size={16} className="rtl:rotate-180" /></button> : null}
          <button className={"ms-auto min-h-[44px] px-3 rounded-[12px] text-[13.5px] font-bold " + muted} onClick={onClose}>{tr("Close")}</button></div>
      </div>);
  }
  return (
    <div className={cardPad + " space-y-2"} data-testid="do-result">
      {r.lines.map((l, i) => (
        <div key={i} className="flex items-start gap-2" data-testid="do-line">
          {l.low ? <AlertTriangle size={16} className="c-neg shrink-0 mt-0.5" /> : <Check size={16} className="c-acc shrink-0 mt-0.5" />}
          <span className={"flex-1 text-[14px] " + (undone ? "line-through c-sub" : "")} dir="auto">{l.text}</span>
          {l.open && TOOL_NAME[l.open] && !undone ? <button className="c-acc text-[13px] font-bold shrink-0 underline min-h-[44px] -my-3 px-1" onClick={() => navTo(l.open)} data-testid="do-open">{tr(TOOL_NAME[l.open])}</button> : null}
        </div>))}
      <div className="flex items-center gap-2 pt-1">
        {r.undo && !undone ? <button className={btnS} onClick={() => { r.undo(); setUndone(true); onUndo && onUndo(); }} data-testid="do-undo"><Undo2 size={14} />{tr("Undo")}</button> : null}
        {undone ? <span className="c-sub text-[13px]" data-testid="do-undone">{tr("Undone")}</span> : null}
        <button className={"ms-auto min-h-[44px] px-3 rounded-[12px] text-[13.5px] font-bold " + muted} onClick={onClose}>{tr("Close")}</button>
      </div>
    </div>);
}
export const DO_HINTS = [["had foul and 2 eggs for breakfast", "فطرت فول وبيضتين"], ["spent 150 on lunch", "صرفت ١٥٠ على الغدا"], ["remind me tomorrow at 9 to call Hassan", "فكرني بكرة الساعة ٩ اكلم حسن"], ["drank 2 glasses of water", "شربت ٢ كوباية مية"], ["Ahmed owes me 12,000, 1,000 a month", "أحمد عليه ١٢ ألف، ألف كل شهر"], ["took my insulin", "خدت الإنسولين"]];

