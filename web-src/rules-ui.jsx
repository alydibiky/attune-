/* ---- v9.9.18 AU1 screen (Ali OK'd the combined screen): "New rule — I understood" with When / If / Do, Save rule · Try it now ·
   Change; "One question first" with choices when a name or a part wasn't clear; "Your rules" with on / off. Logic: rules.js +
   rulestore.js (tested). */
import React, { useState, useEffect } from "react";
import { tr } from "./i18n.js";
import * as RS from "./rulestore.js";
import { card as kCard, btnP, btnS, inp, label } from "./ui-kit.jsx";
const card = kCard + " p-4";
const Row = ({ k, children }) => <div className="flex items-start gap-3 py-1.5 border-t border-[var(--c-ln)] first:border-0"><span className="w-7 h-7 shrink-0 rounded-[9px] bg-[var(--c-soft)] text-[var(--c-acc)] grid place-items-center text-[12px] font-black">{k}</span><div className="flex-1 min-w-0 text-[14px] font-bold break-words" dir="auto">{children}</div></div>;
export function RulesSection({ native, flash, schedule, unschedule, lang }) {
  const [draft, setDraft] = useState(RS.loadDraft), [rules, setRules] = useState(RS.loadRules), [edit, setEdit] = useState(false), [text, setText] = useState("");
  useEffect(() => { const f = () => { setDraft(RS.loadDraft()); setRules(RS.loadRules()); }; window.addEventListener("attune-rules", f); return () => window.removeEventListener("attune-rules", f); }, []);
  const ctx = RS.ruleCtx();
  const pick = (field, value) => { const n = RS.answer(draft, field, value); RS.saveDraft(n); setDraft(n); };
  const save = () => { const r = RS.saveRule(draft, { schedule, native, lang }); RS.saveDraft(null); setDraft(null); setRules(RS.loadRules()); flash && flash(r.live ? tr("Rule saved — it's on") : tr("Rule saved — it starts working when the phone part arrives")); };
  const tryNow = () => { const L = RS.ruleLines(draft, ctx); flash && flash(tr("Test: {x}", { x: L.dos.join(" · ") })); };
  const read = () => { const r = RS.ruleFor(text, ctx); if (!r) { flash && flash(tr("I couldn't read a rule in that — try “when …, …”")); return; } RS.saveDraft(r); setDraft(r); setEdit(false); setText(""); };
  const qs = draft ? RS.questions(draft, ctx) : [], L = draft ? RS.ruleLines(draft, ctx) : null;
  return (
    <div className="space-y-3" data-testid="rules-section">
      {draft && qs.length ? <div className={card + " space-y-2 bg-[var(--c-soft)]"} data-testid="rule-ask">
        <p className={label + " m-0"}>{tr("One question first")}</p>
        <p className="m-0 text-[15px] font-extrabold" dir="auto">{qs[0].q}</p>
        <div className="flex flex-wrap gap-1.5">{qs[0].choices.map(([v, l]) => <button key={String(v)} className="min-h-[40px] px-3 rounded-full border border-[var(--c-ln)] bg-[var(--c-surf)] text-[13px] font-bold" onClick={() => pick(qs[0].field, v)} data-testid="rule-ask-choice">{l}</button>)}</div>
        <p className="m-0 text-[12px] text-[var(--c-mut)]">{tr("I'll remember your answer.")}</p>
      </div> : null}
      {draft && !qs.length ? <div className={card + " space-y-1"} data-testid="rule-card">
        <p className={label + " m-0"}>{tr("New rule — I understood")}</p>
        <Row k="W"><span className="text-[var(--c-mut)] text-[12px] block">{tr("When")}</span>{L.when}</Row>
        {L.ifs.length ? <Row k="I"><span className="text-[var(--c-mut)] text-[12px] block">{tr("If")}</span>{L.ifs.join(" · ")}</Row> : null}
        <Row k="D"><span className="text-[var(--c-mut)] text-[12px] block">{tr("Do")}</span>{L.dos.join(" · ")}</Row>
        {!RS.isLive(draft) ? <p className="m-0 text-[12px] text-[var(--c-warn)] font-bold" data-testid="rule-needs-phone">{tr("Needs the phone part for this kind of trigger — it's saved and starts when that arrives")}</p> : null}
        <div className="flex flex-wrap gap-2 pt-1"><button className={btnP} onClick={save} data-testid="rule-save">{tr("Save rule")}</button><button className={btnS} onClick={tryNow} data-testid="rule-try">{tr("Try it now")}</button><button className={btnS} onClick={() => setEdit(true)} data-testid="rule-change">{tr("Change")}</button></div>
        {edit ? <form onSubmit={(e) => { e.preventDefault(); read(); }} className="flex gap-2 pt-1"><input dir="auto" value={text} onChange={(e) => setText(e.target.value)} placeholder={tr("Write it again your way")} className={inp} data-testid="rule-rewrite" /><button className={btnP} type="submit">{tr("Read")}</button></form> : null}
      </div> : null}
      {rules.length ? <div className={card + " space-y-1"} data-testid="rule-list">
        <p className={label + " m-0"}>{tr("Your rules · {n}", { n: rules.length })}</p>
        {rules.map((r) => { const l = RS.ruleLines(r, ctx); return <div key={r.id} className="flex items-center gap-2 py-2 border-t border-[var(--c-ln)] first:border-0" data-testid="rule-row">
          <div className="flex-1 min-w-0"><p className="m-0 text-[14px] font-bold break-words" dir="auto">{l.when} → {l.dos.join(" · ")}</p>{!r.live ? <p className="m-0 text-[11.5px] text-[var(--c-warn)]">{tr("Waiting for the phone part")}</p> : null}</div>
          <button className="min-h-[36px] px-3 rounded-full border border-[var(--c-ln)] text-[12.5px] font-bold" onClick={() => { RS.removeRule(r.id, { unschedule, native, lang }); setRules(RS.loadRules()); flash && flash(tr("Removed")); }} data-testid="rule-remove">{tr("Remove")}</button></div>; })}
      </div> : null}
    </div>);
}
