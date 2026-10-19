/* ---- v6.41 (upgrade C3) — the Automations page: say what should happen, the rule is made once by code, the phone runs it
   (AutoRules.kt) with no AI. Pots (صناديق) hold what was set aside. autom.js is the logic. */
import React, { useState, useEffect } from "react";
import { tr, getLang } from "./i18n.js";
import { parseAutomation, ruleText, loadAuto, saveAuto, addRule, applyEvents, takeOut } from "./autom.js";
import { readNotification } from "./paylog.js";
import { Zap, Trash2, Wallet, Bell } from "lucide-react";

const card = "rounded-2xl border border-slate-800 bg-slate-900 p-3";
const fmt = (v) => (Math.round(v) || 0).toLocaleString("en-US");

/** The phone's fired events → the pots (called when Attune opens and when this page opens). → the money added. */
export function drainAutomations(native) {
  if (!native || !native.autoTake) return [];
  let ev = []; try { ev = JSON.parse(native.autoTake() || "[]"); } catch (e) { ev = []; }
  if (!ev.length) return [];
  const s = loadAuto();
  const { state, added } = applyEvents(s, ev, (x) => readNotification(x));
  saveAuto(state, null);
  return added;
}

export function AutomationsPage({ native, flash }) {
  const ar = getLang() === "ar";
  const [s, setS] = useState(loadAuto);
  const [text, setText] = useState("");
  const [take, setTake] = useState(null);   // { pot, amount }
  const put = (n) => setS(saveAuto(n, native, ar ? "ar" : "en"));
  useEffect(() => { const added = drainAutomations(native); if (added.length) setS(loadAuto()); saveAuto(loadAuto(), native, ar ? "ar" : "en"); }, []);
  const draft = text.trim() ? parseAutomation(text) : null;
  const access = (() => { try { return !native || !native.payAccess || native.payAccess(); } catch (e) { return true; } })();
  const pots = Object.entries(s.pots || {});
  return (
    <div className="space-y-3" data-testid="auto-page">
      <div className={card + " space-y-2"}>
        <p className="text-sm text-white font-medium flex items-center gap-1.5"><Zap size={15} className="text-amber-300" />{tr("Say what should happen")}</p>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} dir="auto" data-testid="auto-text"
          placeholder={tr("e.g. When my salary arrives, put 20% in the car fund and tell me")} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100" />
        {text.trim() ? (draft ? <div className="text-[13px] text-teal-200" data-testid="auto-draft" dir="auto">{ruleText(draft, /[\u0600-\u06ff]/.test(draft.text))}</div>
          : <p className="text-[12px] text-amber-300" data-testid="auto-unknown">{tr("I didn't get that as an automation. Try: When my salary arrives, put 20% in the car fund.")}</p>) : null}
        <button disabled={!draft} onClick={() => { put(addRule(s, draft)); setText(""); flash && flash(tr("Automation on — it runs on the phone, no AI needed")); }}
          className="px-4 py-2 rounded-xl bg-teal-500 text-slate-950 text-sm font-semibold disabled:opacity-40" data-testid="auto-add">{tr("Turn it on")}</button>
        <p className="text-[11px] text-slate-500">{tr("It listens to your bank and wallet notifications (never SMS). When one matches, you get a notification at once and the money goes into the pot.")}</p>
        {!access ? <button className="text-[12px] text-amber-300 underline flex items-center gap-1" onClick={() => { try { native.openPayAccess(); } catch (e) {} }} data-testid="auto-access"><Bell size={13} />{tr("Turn on Notification access for Attune first")}</button> : null}
      </div>

      {s.rules.length ? <div className={card + " space-y-2"} data-testid="auto-rules">
        <p className="text-[12px] text-slate-400">{tr("Your automations")}</p>
        {s.rules.map((r) => (
          <div key={r.id} className="flex items-center gap-2" data-testid="auto-rule">
            <span className="flex-1 text-[13px] text-slate-200" dir="auto">{ruleText(r, /[\u0600-\u06ff]/.test(r.text || "") || ar)}</span>
            <button onClick={() => put({ ...s, rules: s.rules.map((x) => (x.id === r.id ? { ...x, on: x.on === false } : x)) })} data-testid="auto-toggle"
              className={`w-9 h-5 rounded-full relative shrink-0 ${r.on !== false ? "bg-teal-500" : "bg-slate-700"}`}><span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white ${r.on !== false ? "end-0.5" : "start-0.5"}`} /></button>
            <button onClick={() => put({ ...s, rules: s.rules.filter((x) => x.id !== r.id) })} className="text-slate-500 p-1" aria-label={tr("Delete")}><Trash2 size={14} /></button>
          </div>))}
      </div> : null}

      {pots.length ? <div className={card + " space-y-2"} data-testid="auto-pots">
        <p className="text-[12px] text-slate-400 flex items-center gap-1.5"><Wallet size={13} />{tr("Your pots")}</p>
        {pots.map(([p, v]) => (
          <div key={p} className="flex items-center gap-2" data-testid="auto-pot">
            <span className="flex-1 text-[13px] text-slate-200" dir="auto">{p}</span><b className="text-white text-sm" dir="ltr">{fmt(v)}</b>
            <button className="text-[11px] text-slate-400 underline" onClick={() => setTake({ pot: p, amount: "" })}>{tr("Take out")}</button>
          </div>))}
        {take ? <div className="flex gap-2"><input type="number" value={take.amount} onChange={(e) => setTake({ ...take, amount: e.target.value })} className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-sm text-slate-100" placeholder={tr("Amount")} data-testid="auto-take-amount" />
          <button className="px-3 rounded-lg bg-slate-700 text-white text-sm" onClick={() => { if (+take.amount > 0) put(takeOut(s, take.pot, +take.amount)); setTake(null); }} data-testid="auto-take">{tr("Take out")}</button></div> : null}
        <p className="text-[11px] text-slate-500">{tr("A pot is money you set aside in your head — move it in your bank app too.")}</p>
      </div> : null}

      {(s.log || []).length ? <div className={card + " space-y-1"} data-testid="auto-log">
        <p className="text-[12px] text-slate-400">{tr("What ran")}</p>
        {s.log.slice(0, 12).map((x, i) => <p key={i} className="text-[12px] text-slate-300" dir="auto">
          {new Date(x.ts).toLocaleDateString()} · {x.amount == null ? tr("{p}: couldn't read the amount — add it by hand", { p: x.pot }) : (x.amount > 0 ? "+" : "") + fmt(x.amount) + " · " + x.pot}{x.of ? " (" + tr("of {v}", { v: fmt(x.of) }) + ")" : ""}</p>)}
      </div> : null}
    </div>);
}
