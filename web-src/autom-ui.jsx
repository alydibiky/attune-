/* ---- v6.41 (upgrade C3) — the Automations page: say what should happen, the rule is made once by code, the phone runs it
   (AutoRules.kt) with no AI. Pots (صناديق) hold what was set aside. autom.js is the logic. */
import React, { useState, useEffect } from "react";
import { tr, getLang } from "./i18n.js";
import { parseAutomation, ruleText, loadAuto, saveAuto, addRule, applyEvents, takeOut, READY, readyOn, parseMany } from "./autom.js";
import { readNotification } from "./paylog.js";
import { Zap, Trash2, Wallet, Bell } from "lucide-react";
import { card as kCard, btnP, btnS, inp, area, label } from "./ui-kit.jsx";

const card = kCard + " p-4";
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
  // v7.9 (Ali: "the option to make more than one automation"): one per line — every line that reads as a rule is turned on
  const many = parseMany(text), draft = many.rules[0] || null;
  const access = (() => { try { return !native || !native.payAccess || native.payAccess(); } catch (e) { return true; } })();
  const pots = Object.entries(s.pots || {});
  return (
    <div className="calm space-y-3 text-[var(--c-ink)]" data-testid="auto-page">
      {/* v7.9 (Ali picked design A): ready rules first — one tap turns one on (or off) */}
      <div className={card + " space-y-1"} data-testid="auto-ready">
        <p className={label}>{tr("Turn one on")}</p>
        {READY.map(([id, en, arT, icon]) => { const on = readyOn(s, ar ? arT : en) || readyOn(s, en); return (
          <div key={id} className="flex items-center gap-3 min-h-[56px] border-t border-[var(--c-ln)] first-of-type:border-t-0" data-testid="auto-ready-rule" data-id={id}>
            <span className="w-10 h-10 rounded-[13px] grid place-items-center bg-[var(--c-soft)] shrink-0 text-[18px]" aria-hidden="true">{icon}</span>
            <span className="flex-1 min-w-0 text-[13.5px] font-bold" dir="auto">{ar ? arT : en}</span>
            <button onClick={() => { if (on) put({ ...s, rules: s.rules.filter((x) => x.id !== on.id) }); else { put(addRule(s, parseAutomation(ar ? arT : en))); flash && flash(tr("Automation on — it runs on the phone, no AI needed")); } }}
              aria-pressed={!!on} data-testid="auto-ready-toggle"
              className={"min-h-[40px] px-3.5 rounded-full text-[13px] font-extrabold border shrink-0 " + (on ? "bg-[var(--c-acc)] border-[var(--c-acc)] text-[var(--c-on-acc)]" : "bg-[var(--c-surf)] border-[var(--c-ln)] text-[var(--c-ink)]")}>{on ? tr("On") : tr("Turn on")}</button>
          </div>); })}
      </div>
      <div className={card + " space-y-2"}>
        <p className="text-[15px] text-[var(--c-ink)] font-extrabold flex items-center gap-1.5"><Zap size={15} className="text-[var(--c-warn)]" />{s.rules.length ? tr("Add another — say what should happen") : tr("Say what should happen")}</p>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} dir="auto" data-testid="auto-text"
          placeholder={tr("e.g. When my salary arrives, put 20% in the car fund and tell me")} className={area} />
        <p className="m-0 text-[11.5px] text-[var(--c-mut)]">{tr("More than one? Write one per line.")}</p>
        {text.trim() ? (draft ? <div className="space-y-1.5">{many.rules.map((r, i) => <div key={i} className="text-[13px] font-semibold rounded-[14px] bg-[var(--c-soft)] text-[var(--c-acc)] px-3 py-2" data-testid="auto-draft" dir="auto">{ruleText(r, /[\u0600-\u06ff]/.test(r.text))}</div>)}
            {many.bad.length ? <p className="text-[12px] text-[var(--c-warn)] m-0" data-testid="auto-unknown" dir="auto">{tr("Not an automation: {l}", { l: many.bad.join(" · ") })}</p> : null}</div>
          : <p className="text-[12px] text-[var(--c-warn)]" data-testid="auto-unknown">{tr("I didn't get that as an automation. Try: When my salary arrives, put 20% in the car fund.")}</p>) : null}
        <button disabled={!draft} onClick={() => { let n = s; for (const r of many.rules) n = addRule(n, r); put(n); setText(""); flash && flash(many.rules.length > 1 ? tr("{n} automations on — they run on the phone, no AI needed", { n: many.rules.length }) : tr("Automation on — it runs on the phone, no AI needed")); }}
          className={btnP} data-testid="auto-add">{many.rules.length > 1 ? tr("Turn on {n}", { n: many.rules.length }) : tr("Turn it on")}</button>
        <p className="text-[11px] text-[var(--c-mut)]">{tr("It listens to your bank and wallet notifications (never SMS). When one matches, you get a notification at once and the money goes into the pot.")}</p>
        {!access ? <button className="min-h-[44px] text-[12.5px] font-bold text-[var(--c-warn)] underline flex items-center gap-1" onClick={() => { try { native.openPayAccess(); } catch (e) {} }} data-testid="auto-access"><Bell size={13} />{tr("Turn on Notification access for Attune first")}</button> : null}
      </div>

      {s.rules.length ? <div className={card + " space-y-2"} data-testid="auto-rules">
        <p className={label}>{tr("On now · {n}", { n: s.rules.filter((r) => r.on !== false).length })}</p>
        {s.rules.map((r) => (
          <div key={r.id} className="flex items-center gap-2 min-h-[48px]" data-testid="auto-rule">
            <span className="flex-1 text-[13px] text-[var(--c-ink)]" dir="auto">{ruleText(r, /[\u0600-\u06ff]/.test(r.text || "") || ar)}</span>
            <button onClick={() => put({ ...s, rules: s.rules.map((x) => (x.id === r.id ? { ...x, on: x.on === false } : x)) })} data-testid="auto-toggle"
              className={`w-9 h-5 rounded-full relative shrink-0 after:absolute after:-inset-3 after:content-[''] ${r.on !== false ? "bg-[var(--c-acc)]" : "bg-[var(--c-ln)]"}`}><span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm ${r.on !== false ? "end-0.5" : "start-0.5"}`} /></button>
            <button onClick={() => put({ ...s, rules: s.rules.filter((x) => x.id !== r.id) })} className="text-[var(--c-mut)] hover:text-[var(--c-neg)] w-11 h-11 grid place-items-center rounded-[14px]" aria-label={tr("Delete")}><Trash2 size={15} /></button>
          </div>))}
      </div> : null}

      {pots.length ? <div className={card + " space-y-2"} data-testid="auto-pots">
        <p className={label + " flex items-center gap-1.5"}><Wallet size={13} />{tr("Your pots")}</p>
        {pots.map(([p, v]) => (
          <div key={p} className="flex items-center gap-2 min-h-[44px]" data-testid="auto-pot">
            <span className="flex-1 text-[13px] text-[var(--c-ink)]" dir="auto">{p}</span><b className="text-[var(--c-ink)] text-[16px] font-black tabular-nums" dir="ltr">{fmt(v)}</b>
            <button className="min-h-[44px] px-1 text-[12px] font-bold text-[var(--c-mut)] underline" onClick={() => setTake({ pot: p, amount: "" })}>{tr("Take out")}</button>
          </div>))}
        {take ? <div className="flex gap-2"><input type="number" value={take.amount} onChange={(e) => setTake({ ...take, amount: e.target.value })} className={inp + " flex-1 tabular-nums"} placeholder={tr("Amount")} data-testid="auto-take-amount" />
          <button className={btnS + " shrink-0"} onClick={() => { if (+take.amount > 0) put(takeOut(s, take.pot, +take.amount)); setTake(null); }} data-testid="auto-take">{tr("Take out")}</button></div> : null}
        <p className="text-[11px] text-[var(--c-mut)]">{tr("A pot is money you set aside in your head — move it in your bank app too.")}</p>
      </div> : null}

      {(s.log || []).length ? <div className={card + " space-y-1"} data-testid="auto-log">
        <p className={label}>{tr("What ran")}</p>
        {s.log.slice(0, 12).map((x, i) => <p key={i} className="text-[12.5px] tabular-nums text-[var(--c-ink)]" dir="auto">
          {new Date(x.ts).toLocaleDateString()} · {x.amount == null ? tr("{p}: couldn't read the amount — add it by hand", { p: x.pot }) : (x.amount > 0 ? "+" : "") + fmt(x.amount) + " · " + x.pot}{x.of ? " (" + tr("of {v}", { v: fmt(x.of) }) + ")" : ""}</p>)}
      </div> : null}
    </div>);
}
