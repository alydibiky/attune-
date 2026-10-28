/* ---- v6.40 Message alerts — the card at the top of Follow-ups → Reminders: say who (and optionally which app or which word),
   Attune tells you the moment they message you. Needs Notification access (the same switch Money uses); the phone checks
   (MessageWatch.kt). Rules and the short log of alerts stay on the phone. */
import React, { useEffect, useState } from "react";
import { MessageSquare, Trash2, AlertTriangle, BellRing } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import * as W from "./watch.js";
import { cardPad, btnP, inp, label, chip } from "./ui-kit.jsx";
import { SmsSwitch } from "./sms-ui.jsx";

const EX = [["Tell me when Ahmed messages me", "لو أحمد بعتلي قولي"], ["Alert me when I get an email from the bank", "نبهني لو جالي إيميل من البنك"], ["Any WhatsApp with the word urgent — tell me", "أي رسالة على الواتس فيها كلمة ضروري نبهني"]];

export function WatchPanel({ native: N, flash }) {
  const ar = getLang() === "ar";
  const [rules, setRules] = useState(() => W.loadWatch());
  const shown = rules.filter((r) => !String(r.id).startsWith("agent-"));   // v8.0: delivery agents live on the Agents page
  const [text, setText] = useState("");
  const [hits, setHits] = useState([]);
  const access = (() => { try { return !N || !N.payAccess || N.payAccess(); } catch (e) { return true; } })();
  useEffect(() => { try { setHits(N && N.watchHits ? JSON.parse(N.watchHits()).slice(-5).reverse() : []); } catch (e) {} }, [rules]);
  // rules turned off by the phone ("once" ones that fired) come back from it
  useEffect(() => { try { if (N && N.watchRules) { const ph = JSON.parse(N.watchRules()); if (ph.length) setRules((r) => r.map((x) => { const p = ph.find((y) => y.id === x.id); return p ? { ...x, on: p.on } : x; })); } } catch (e) {} }, []);
  const put = (l) => setRules(W.saveWatch(l, ar ? "ar" : "en"));
  const add = (t) => {
    const p = W.parseWatch(t || text);
    if (!p) return flash && flash(tr("Say who, like: tell me when Ahmed messages me"));
    put([W.newRule(p), ...rules]); setText("");
    flash && flash(tr("I'll tell you: {r}", { r: W.ruleText(p, ar) }));
  };
  return (
    <div className={"calm " + cardPad + " space-y-3"} data-testid="watch-panel">
      <div><p className="text-[15px] text-[var(--c-ink)] font-extrabold flex items-center gap-2 m-0"><BellRing size={16} className="text-[var(--c-acc)]" />{tr("Message alerts")}</p>
        <p className="text-[12px] text-[var(--c-mut)] mt-1 mb-0">{tr("Tell Attune whose message you are waiting for — on WhatsApp, Gmail or any email app — and it tells you the moment it arrives. Checked on this phone; SMS only if you switch it on below.")}</p></div>
      {N && !access ? <button onClick={() => { try { N.openPayAccess && N.openPayAccess(); } catch (e) {} }} className="w-full text-start min-h-[44px] rounded-[20px] border border-[var(--c-warn)]/40 bg-[var(--c-warn)]/10 p-3 text-[12.5px] font-semibold text-[var(--c-warn)] flex gap-2" data-testid="watch-access">
        <AlertTriangle size={14} className="shrink-0 mt-0.5" />{tr("Turn on Notification access for Attune so it can see new messages (Settings opens). If it is grey, see “restricted setting” in Money → Payments.")}</button> : null}
      <SmsSwitch native={N} compact />
      <form onSubmit={(e) => { e.preventDefault(); add(); }} className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} dir="auto" placeholder={tr("e.g. tell me when Ahmed messages me")} data-testid="watch-input"
          className={inp + " flex-1"} />
        <button className={btnP + " !h-11 !min-h-[44px] shrink-0"} data-testid="watch-add">{tr("Add")}</button>
      </form>
      {!shown.length ? <div className="flex flex-wrap gap-1.5">{EX.map(([en, a]) => <button key={en} onClick={() => add(ar ? a : en)} className={chip(false) + " !h-auto min-h-[40px] py-2 !whitespace-normal text-start"} dir="auto" data-testid="watch-example">{ar ? a : en}</button>)}</div> : null}
      {shown.length ? <ul className="m-0 p-0 list-none space-y-1.5" data-testid="watch-rules">{shown.map((r) => (
        <li key={r.id} className="flex items-center gap-2 rounded-[20px] border border-[var(--c-ln)] bg-[var(--c-bg)] ps-3 pe-1 min-h-[52px]" data-testid="watch-rule">
          <MessageSquare size={14} className={r.on ? "text-[var(--c-acc)]" : "text-[var(--c-mut)]"} />
          <span className={"flex-1 min-w-0 text-[13px] " + (r.on ? "text-[var(--c-ink)]" : "text-[var(--c-mut)] line-through")} dir="auto">{W.ruleText(r, ar)}</span>
          <label className="min-h-[44px] px-1 text-[11px] font-bold text-[var(--c-mut)] flex items-center gap-1.5"><input type="checkbox" className="w-4 h-4 accent-[var(--c-acc)]" checked={!!r.on} onChange={(e) => put(rules.map((x) => (x.id === r.id ? { ...x, on: e.target.checked } : x)))} data-testid="watch-on" />{tr("On")}</label>
          <button onClick={() => put(rules.filter((x) => x.id !== r.id))} aria-label={tr("Delete")} className="w-11 h-11 grid place-items-center rounded-[12px] text-[var(--c-mut)] hover:text-[var(--c-neg)]"><Trash2 size={15} /></button>
        </li>))}</ul> : null}
      {hits.length ? <div className="space-y-1" data-testid="watch-hits"><p className={label + " m-0"}>{tr("Last alerts")}</p>
        {hits.map((h, i) => <p key={i} className="text-[12.5px] tabular-nums text-[var(--c-ink)] m-0 truncate" dir="auto"><b>{h.who}</b> · {h.app} · {new Date(h.ts).toLocaleString(ar ? "ar-EG-u-nu-latn" : undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} — {h.text}</p>)}</div> : null}
    </div>);
}
