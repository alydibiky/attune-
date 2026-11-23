/* ---- v6.28 "Do it from Home" — the result card shared by the phone Home (home-ui.jsx) and the computer Home (desk-ui.jsx): what was
   done (each line opens its tool), one Undo for all of it, or the answer to a question about your own data. Logic: doit.js.      */
import { sayAnswer } from "./lifeask.js";   // v9.9.38: answers in every language
import React, { useState, useEffect } from "react";
import { Check, Undo2, ChevronRight, AlertTriangle, Sparkles } from "lucide-react";
import { tr } from "./i18n.js";
import { cardPad, btnP, btnS, muted } from "./ui-kit.jsx";
import { PwAnswer } from "./pw-ui.jsx";

const TOOL_NAME = { fit: "Fit & Food", money: "Money", care: "Family health", life: "People & plans", radar: "Deadline Radar", reminders: "Reminders", memory: "Mind", cycle: "Cycle", scout: "Scout" };
/** v6.28 "Do it from Home": what was done (each line opens its tool), Undo for all of it; or the answer to a question about your data. */
export function DoResult({ r, navTo, onClose, onUndo }) {
  const [undone, setUndone] = useState(false);
  // v10.8 (Ali: "what's the use of AI if it didn't do anything"): when the code wasn't sure of a money line, the model checks it in the
  // background (moneyai.js); its result shows here — "checking…", then what it changed with "Put back", or nothing when it agreed
  const [fix, setFix] = useState(null);
  useEffect(() => { const on = (e) => { const d = e.detail || {}; if (!r || d.key !== r.key) return; setFix(d.state === "same" ? null : d); };
    try { const last = window.__attuneMoneyFix; if (r && last && last.key === r.key && last.state !== "same") setFix(last); } catch (e) {}   // it may have started before this card
    window.addEventListener("attune-moneyfix", on); return () => window.removeEventListener("attune-moneyfix", on); }, [r && r.key]);
  if (!r) return null;
  // v10.9.4 OK-PW2: a password question → the account card (the password itself after the fingerprint)
  if (r.pw) return <div className={cardPad + " space-y-2"} data-testid="do-answer"><PwAnswer ans={r.pw} native={typeof window !== "undefined" ? window.AttuneNative : null} navTo={navTo} />
    <button className={"min-h-[44px] px-3 rounded-[12px] text-[13.5px] font-bold " + muted} onClick={onClose}>{tr("Close")}</button></div>;
  if (r.answer) {
    const a = r.answer;
    return (
      <div className={cardPad + " space-y-2.5"} data-testid="do-answer">
        <p className="m-0 text-[15px] font-medium" dir="auto">{sayAnswer(a, r.ar).replace(/\*\*/g, "")}</p>
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
      {fix && !undone ? <div className="flex items-start gap-2" data-testid="do-aifix">
          <Sparkles size={16} className="c-acc shrink-0 mt-0.5" />
          <span className={"flex-1 text-[14px] " + (fix.state === "checking" ? "c-sub" : "")} dir="auto">{fix.state === "checking" ? tr("The AI is checking the category…") : fix.state === "back" ? tr("Put back") : tr("Checked by the AI: «{c}» — {n}", { c: fix.cat, n: fix.note })}</span>
          {fix.state === "done" && fix.back ? <button className="c-acc text-[13px] font-bold shrink-0 underline min-h-[44px] -my-3 px-1" onClick={() => { fix.back(); setFix({ state: "back" }); }} data-testid="do-aifix-back">{tr("Put back")}</button> : null}
        </div> : null}
      <div className="flex items-center gap-2 pt-1">
        {r.undo && !undone ? <button className={btnS} onClick={() => { r.undo(); setUndone(true); onUndo && onUndo(); }} data-testid="do-undo"><Undo2 size={14} />{tr("Undo")}</button> : null}
        {undone ? <span className="c-sub text-[13px]" data-testid="do-undone">{tr("Undone")}</span> : null}
        <button className={"ms-auto min-h-[44px] px-3 rounded-[12px] text-[13.5px] font-bold " + muted} onClick={onClose}>{tr("Close")}</button>
      </div>
    </div>);
}
export const DO_HINTS = [   /* v9.2: no food example — Fit & Food is archived (→ Attune Fit) */ ["spent 150 on lunch", "صرفت ١٥٠ على الغدا"], ["remind me tomorrow at 9 to call Hassan", "فكرني بكرة الساعة ٩ اكلم حسن"], ["drank 2 glasses of water", "شربت ٢ كوباية مية"], ["Ahmed owes me 12,000, 1,000 a month", "أحمد عليه ١٢ ألف، ألف كل شهر"], ["took my insulin", "خدت الإنسولين"]];

