/* ---- v6.27 "Money tracks itself" — the review strip at the top of Money (phone) -------------------------------------------------
   Notification access off → one card that says what it does and opens Android's switch. On → "N payments read from
   your notifications": each with Add / Dismiss, and Add all. Added ones go to Money through the bridge (Yusr "add-txns");
   handled ids are remembered here and forgotten on the phone (payForget). Tests: tests/e2e_v727paylog.py.            */
import React, { useEffect, useState } from "react";
import { Bell, Check, X } from "lucide-react";
import { tr } from "./i18n.js";
import { inbox, toTxns } from "./paylog.js";

const DONE_KEY = "attune:paylog:done", OFF_KEY = "attune:paylog:not-now";
const readDone = () => { try { return JSON.parse(localStorage.getItem(DONE_KEY) || "[]"); } catch (e) { return []; } };

export function PayInbox({ N, onAdd }) {
  const can = !!(N && N.payAccess && N.payQueue);
  const [on, setOn] = useState(() => { try { return can && N.payAccess(); } catch (e) { return false; } });
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [notNow, setNotNow] = useState(() => { try { return localStorage.getItem(OFF_KEY) === "1"; } catch (e) { return false; } });
  const load = () => {
    if (!can) return;
    let a = false; try { a = N.payAccess(); } catch (e) {}
    setOn(a);
    let q = []; try { q = JSON.parse(N.payQueue() || "[]"); } catch (e) {}
    setItems(inbox(q, readDone()));
  };
  useEffect(() => { load(); const f = () => load(); window.addEventListener("focus", f); document.addEventListener("visibilitychange", f);
    return () => { window.removeEventListener("focus", f); document.removeEventListener("visibilitychange", f); }; }, []);
  if (!can) return null;
  const finish = (list) => {
    const ids = list.map((e) => e.id), done = [...readDone(), ...ids].slice(-500);
    try { localStorage.setItem(DONE_KEY, JSON.stringify(done)); } catch (e) {}
    try { N.payForget(JSON.stringify(ids)); } catch (e) {}
    setItems((x) => x.filter((e) => !ids.includes(e.id)));
  };
  const add = (list) => { onAdd(toTxns(list)); finish(list); };
  if (!on) {
    if (notNow) return null;
    return (
      <div className="shrink-0 mx-2 my-2 rounded-xl border border-teal-800/60 bg-teal-500/10 p-3" data-testid="paylog-setup">
        <p className="text-[13.5px] font-semibold text-slate-100 flex items-center gap-2"><Bell size={15} className="text-teal-300" />{tr("Log spending by itself")}</p>
        <p className="text-[12px] text-slate-400 mt-1 leading-relaxed">{tr("Turn on notification access and Attune reads your bank, InstaPay and wallet notifications on this phone, then asks you to add each payment. Never SMS; nothing leaves the phone.")}</p>
        <div className="flex gap-2 mt-2.5">
          <button onClick={() => { try { N.openPayAccess(); } catch (e) {} }} className="px-3 py-1.5 rounded-lg bg-teal-500 text-slate-950 text-[12.5px] font-semibold" data-testid="paylog-turn-on">{tr("Turn on")}</button>
          <button onClick={() => { setNotNow(true); try { localStorage.setItem(OFF_KEY, "1"); } catch (e) {} }} className="px-3 py-1.5 rounded-lg text-slate-400 text-[12.5px]">{tr("Not now")}</button>
        </div>
      </div>);
  }
  if (!items.length) return null;
  return (
    <div className="shrink-0 mx-2 my-2 rounded-xl border border-teal-800/60 bg-slate-900" data-testid="paylog">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-2 px-3 py-2.5 text-start" data-testid="paylog-open">
        <Bell size={15} className="text-teal-300" /><span className="flex-1 text-[13px] text-slate-100 font-semibold">{tr("{n} payments read from your notifications", { n: items.length })}</span>
        <span className="text-[12px] text-teal-300">{open ? tr("Hide") : tr("Review")}</span></button>
      {open ? (
        <div className="px-3 pb-3 space-y-2">
          {items.slice(0, 30).map((e) => (
            <div key={e.id} className="flex items-center gap-2 rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-2" data-testid="paylog-item">
              <span className="flex-1 min-w-0"><b className={"block text-[13.5px] tabular-nums " + (e.direction === "in" ? "text-emerald-300" : "text-slate-100")}>{e.direction === "in" ? "+" : "−"}{e.amount.toLocaleString("en-US", { maximumFractionDigits: 2 })} {e.currency}</b>
                <span className="block text-[11.5px] text-slate-400 truncate" dir="auto">{[e.party, e.app, new Date(e.ts).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })].filter(Boolean).join(" · ")}</span></span>
              <button onClick={() => add([e])} aria-label={tr("Add")} className="w-8 h-8 rounded-full bg-teal-500 text-slate-950 grid place-items-center" data-testid="paylog-add"><Check size={15} /></button>
              <button onClick={() => finish([e])} aria-label={tr("Dismiss")} className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 grid place-items-center" data-testid="paylog-dismiss"><X size={15} /></button>
            </div>))}
          {items.length > 1 ? <button onClick={() => add(items)} className="w-full py-2 rounded-lg bg-teal-500/15 text-teal-200 text-[13px] font-semibold" data-testid="paylog-add-all">{tr("Add all {n}", { n: items.length })}</button> : null}
        </div>) : null}
    </div>);
}
