/* ---- v8.8 Money → "From your notes": money a note of yours says moved, waiting for one tap (notesmoney.js). */
import React, { useEffect, useState } from "react";
import { PenLine as NotebookPen, Check, X } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import { moneyFromNotes, NOTES_DONE_KEY } from "./notesmoney.js";
import { loadStores } from "./lifeask.js";
import * as U from "./ui-kit.jsx";

const readDone = () => { try { const v = JSON.parse(localStorage.getItem(NOTES_DONE_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
const addDone = (ids) => { try { localStorage.setItem(NOTES_DONE_KEY, JSON.stringify([...new Set([...readDone(), ...ids])].slice(-500))); } catch (e) {} };
export function notesMoneyNow() { try { const s = loadStores(); return moneyFromNotes(s.memory, s.ledger, { done: readDone() }); } catch (e) { return []; } }

export function NotesMoney({ onAdd }) {
  const ar = getLang() === "ar";
  const [list, setList] = useState(() => notesMoneyNow());
  useEffect(() => { const f = () => setList(notesMoneyNow()); window.addEventListener("focus", f); return () => window.removeEventListener("focus", f); }, []);
  if (!list.length) return null;
  const take = (x, add) => { if (add && onAdd) onAdd([{ ...x.item, currency: "", source: "note" }]); addDone([x.id]); setList((l) => l.filter((y) => y.id !== x.id)); };
  return <div className="calm shrink-0 px-2 py-2" data-testid="notes-money"><div className={U.cardPad + " space-y-2"}>
    <p className="m-0 text-[14px] font-extrabold flex items-center gap-2"><NotebookPen size={15} className="text-[var(--c-acc)]" />{tr("From your notes")}</p>
    <p className={"m-0 text-[12.5px] " + U.muted}>{tr("You wrote these in your notes — add them to Money?")}</p>
    {list.slice(0, 5).map((x) => <div key={x.id} className="flex items-center gap-2 border-t border-[var(--c-ln)] pt-2" data-testid="notes-money-row">
      <div className="min-w-0 flex-1"><p className="m-0 text-[13.5px] font-bold truncate" dir="auto">{x.text}</p>
        <p className={"m-0 text-[11.5px] " + U.muted}>{new Date(x.when).toLocaleDateString(ar ? "ar-EG-u-nu-latn" : "en-GB", { day: "numeric", month: "short" })} · {x.item.type === "income" ? tr("Income") : tr("Expense")}</p></div>
      <b className={"tabular-nums text-[14px] shrink-0 " + (x.item.type === "income" ? "text-[var(--c-pos)]" : "")} dir="ltr">{x.item.type === "income" ? "+" : "−"}{Math.round(x.item.amount).toLocaleString("en-US")}</b>
      <button onClick={() => take(x, true)} className="min-h-[40px] px-3 rounded-[12px] bg-[var(--c-acc)] text-[var(--c-on-acc)] text-[12.5px] font-extrabold inline-flex items-center gap-1" data-testid="notes-money-add"><Check size={13} />{tr("Add")}</button>
      <button onClick={() => take(x, false)} className={"w-10 h-10 grid place-items-center " + U.muted} aria-label={tr("Not money")} title={tr("Not money")} data-testid="notes-money-skip"><X size={15} /></button>
    </div>)}
  </div></div>;
}
