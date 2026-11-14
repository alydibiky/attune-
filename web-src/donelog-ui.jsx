/* ---- v9.9.18 AU8 "Done for you" (Ali OK'd A + his note: "make editing possible and then it remembers my change if applicable").
   The person's limits on top (money per action, actions per day); today's list — each line with Edit and Undo; after an edit,
   "Do it this way next time?" (Yes, remember / Just this once). The logic is donelog.js + b1wire.js (tested). */
import React, { useState, useEffect } from "react";
import { tr } from "./i18n.js";
import * as D from "./donelog.js";
import { undoDone, editDone } from "./b1wire.js";
import { loadLedger } from "./myledger.js";
import { card as kCard, btnP, btnS, inp, label } from "./ui-kit.jsx";
const card = kCard + " p-4";
const saveLedger = (l) => { try { localStorage.setItem("ledger.v3", JSON.stringify(l)); window.dispatchEvent(new Event("attune-ledger")); } catch (e) {} };
const CATS = ["food", "groceries", "transport", "bills", "rent", "shopping", "health", "fun", "coffee", "gifts", "other"];
const CAT_EN = { food: "Food", groceries: "Groceries", transport: "Transport", bills: "Bills", rent: "Rent", shopping: "Shopping", health: "Health", fun: "Fun", coffee: "Coffee/Tea", gifts: "Gifts", other: "Other" };

export function DoneForYouPage({ flash }) {
  const [st, setSt] = useState(D.load), [edit, setEdit] = useState(null), [ask, setAsk] = useState(null), [lim, setLim] = useState(null);
  useEffect(() => { const f = () => setSt(D.load()); window.addEventListener("attune-ledger", f); return () => window.removeEventListener("attune-ledger", f); }, []);
  const today = D.today(st), used = today.filter((x) => !x.undone).length;
  const accounts = ((loadLedger() || {}).accounts || []);
  const undo = (e) => { if (undoDone(e.id, { loadLedger, saveLedger })) { setSt(D.load()); flash && flash(tr("Undone")); } };
  const saveEdit = () => { const p = {}; if (edit.amount !== "" && +edit.amount > 0) p.amount = +edit.amount; if (edit.cat) p.cat = edit.cat; if (edit.account) p.account = edit.account;
    const r = editDone(edit.e.id, p, { loadLedger, saveLedger }); setSt(D.load()); setEdit(null); if (r.ask) setAsk(r); else flash && flash(tr("Saved")); };
  const remember = (yes) => { if (yes && ask) { D.save(D.remember(D.load(), ask.entry, ask.remember)); setSt(D.load()); flash && flash(tr("I'll do it this way next time")); } setAsk(null); };
  return (
    <div className="calm space-y-3 text-[var(--c-ink)]" data-testid="donefor-page">
      <div className={card + " space-y-2"} data-testid="donefor-limits">
        <p className={label + " m-0"}>{tr("What Attune may do alone")}</p>
        {lim ? <div className="space-y-2">
          <label className="block text-[13px] font-bold">{tr("Money up to … a time")}<input type="number" inputMode="decimal" value={lim.money} onChange={(e) => setLim({ ...lim, money: e.target.value })} className={inp + " mt-1"} data-testid="donefor-money" /></label>
          <label className="block text-[13px] font-bold">{tr("Actions a day")}<input type="number" inputMode="numeric" value={lim.perDay} onChange={(e) => setLim({ ...lim, perDay: e.target.value })} className={inp + " mt-1"} data-testid="donefor-perday" /></label>
          <div className="flex gap-2"><button className={btnP} onClick={() => { const n = D.setLimits(D.load(), lim); D.save(n); setSt(n); setLim(null); flash && flash(tr("Saved")); }} data-testid="donefor-limits-save">{tr("Save")}</button><button className={btnS} onClick={() => setLim(null)}>{tr("Cancel")}</button></div>
        </div> : <>
          <div className="flex items-center justify-between gap-2 text-[14px]"><span>{tr("Money up to {n} a time", { n: (+st.limits.money).toLocaleString() })}</span><button className="text-[13px] font-extrabold text-[var(--c-acc)] min-h-[40px] min-w-[44px]" onClick={() => setLim({ ...st.limits })} data-testid="donefor-change">{tr("Change")}</button></div>
          <div className="text-[14px]">{tr("Up to {n} actions a day · {u} used today", { n: st.limits.perDay, u: used })}</div></>}
      </div>
      <div className={card + " space-y-1"} data-testid="donefor-today">
        <p className={label + " m-0"}>{tr("Today")}</p>
        {!today.length ? <p className="m-0 text-[13.5px] text-[var(--c-mut)]" data-testid="donefor-empty">{tr("Nothing done by itself today.")}</p> : today.map((e) => (
          <div key={e.id} className={"flex items-center gap-2 py-2 border-t border-[var(--c-ln)] first:border-0 " + (e.undone ? "opacity-50" : "")} data-testid="donefor-row">
            <div className="flex-1 min-w-0"><p className="m-0 text-[14px] font-bold break-words" dir="auto">{e.what || e.source}</p>
              <p className="m-0 text-[12px] text-[var(--c-mut)]">{new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{e.amount != null ? " · " + (+e.amount).toLocaleString() : ""}{e.cat ? " · " + tr(CAT_EN[e.cat] || e.cat) : ""}{e.edited ? " · " + tr("edited") : ""}{e.undone ? " · " + tr("undone") : ""}</p></div>
            {!e.undone ? <><button className="min-h-[36px] px-2.5 rounded-full border border-[var(--c-ln)] text-[12.5px] font-bold" onClick={() => setEdit({ e, amount: e.amount != null ? String(e.amount) : "", cat: e.cat || "", account: e.account || "" })} data-testid="donefor-edit">{tr("Edit")}</button>
              <button className="min-h-[36px] px-2.5 rounded-full border border-[var(--c-ln)] text-[12.5px] font-bold" onClick={() => undo(e)} data-testid="donefor-undo">{tr("Undo")}</button></> : null}
          </div>))}
      </div>
      {edit ? <div className={card + " space-y-2"} data-testid="donefor-editbox">
        <p className={label + " m-0"}>{tr("Edit")}</p>
        {edit.e.amount != null ? <label className="block text-[13px] font-bold">{tr("Amount")}<input type="number" inputMode="decimal" value={edit.amount} onChange={(x) => setEdit({ ...edit, amount: x.target.value })} className={inp + " mt-1"} data-testid="donefor-edit-amount" /></label> : null}
        <div className="flex flex-wrap gap-1.5" data-testid="donefor-edit-cats">{CATS.map((c) => <button key={c} type="button" aria-pressed={edit.cat === c} onClick={() => setEdit({ ...edit, cat: c })} className={"min-h-[36px] px-3 rounded-full border text-[12.5px] font-bold " + (edit.cat === c ? "bg-[var(--c-soft)] text-[var(--c-acc)] border-[var(--c-acc)]" : "border-[var(--c-ln)]")} data-testid={"donefor-cat-" + c}>{tr(CAT_EN[c])}</button>)}</div>
        {accounts.length > 1 ? <div className="flex flex-wrap gap-1.5">{accounts.map((a) => <button key={a.id} type="button" aria-pressed={edit.account === a.id} onClick={() => setEdit({ ...edit, account: a.id })} className={"min-h-[36px] px-3 rounded-full border text-[12.5px] font-bold " + (edit.account === a.id ? "bg-[var(--c-soft)] text-[var(--c-acc)] border-[var(--c-acc)]" : "border-[var(--c-ln)]")}>{a.name}</button>)}</div> : null}
        <div className="flex gap-2"><button className={btnP} onClick={saveEdit} data-testid="donefor-edit-save">{tr("Save")}</button><button className={btnS} onClick={() => setEdit(null)}>{tr("Cancel")}</button></div>
      </div> : null}
      {ask ? <div className={card + " space-y-2 bg-[var(--c-soft)]"} data-testid="donefor-remember">
        <p className="m-0 text-[15px] font-extrabold">{tr("Do it this way next time?")}</p>
        <p className="m-0 text-[13px] text-[var(--c-mut)]">{tr("For {s} from now on", { s: ask.entry.source || ask.entry.what || "" })}</p>
        <div className="flex gap-2"><button className={btnP} onClick={() => remember(true)} data-testid="donefor-remember-yes">{tr("Yes, remember")}</button><button className={btnS} onClick={() => remember(false)} data-testid="donefor-remember-no">{tr("Just this once")}</button></div>
      </div> : null}
    </div>
  );
}
