/* ---- v9.8 I1 Autopilot on Home (Ali: "I1 ok"): what the phone's notifications mean, one card each, waiting for one tap — Add / Not
   this; "do these by yourself from now on?" after 3 of a kind; what was done by itself, each with Undo; the week's count. The logic is
   autopilot.js (tested); this file is the card. Saving goes through the same path as the Home box (window.__attuneApplyActions). */
import React, { useEffect, useMemo, useState } from "react";
import { Check, X, Undo2, Zap } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import { loadLife, saveLife } from "./life.js";
import { undoSubPay } from "./subpay.js";
import * as AP from "./autopilot.js";

const T = (k, v) => tr(k, v);
const N = () => (typeof window !== "undefined" ? window.AttuneNative : null);
// the kept notifications (Recall) + (v9.9) the payment notifications Money keeps even when Recall is off — so a Gemini payment is seen
const readNotes = () => { try { const n = N(); if (!n) return [];
  const a = n.recallNotes ? JSON.parse(n.recallNotes() || "[]") : [], b = n.payQueue ? JSON.parse(n.payQueue() || "[]") : [];
  const seen = new Set(a.map((x) => String(x.title || "") + "|" + String(x.text || "").slice(0, 80)));
  return [...a, ...b.filter((x) => !seen.has(String(x.title || "") + "|" + String(x.text || "").slice(0, 80)))]; } catch (e) { return []; } };
const readLedger = () => { try { return JSON.parse(localStorage.getItem("ledger.v3") || "null"); } catch (e) { return null; } };
const fmt = (v) => Math.round(v || 0).toLocaleString("en-US");
const when = (t) => { try { return new Date(t).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }); } catch (e) { return ""; } };
const LINE = { expense: "Expense", income: "Income", followup: "Follow-up", todo: "To-do", callback: "Call back", bill: "Bill" };
const apply = (x) => { try { return window.__attuneApplyActions ? window.__attuneApplyActions(AP.actionsFor(x)) : null; } catch (e) { return null; } };

/* v9.8 (Ali: "I want to see the whole message so I can say what to add … and reply to it and tell it to add it like I want — a reminder,
   a subscription…"): a tap opens the whole notification, quick "save it as" buttons, and a box: anything you type there goes through
   the Home box (the same reader), so "reminder Monday 9", "subscription 200 every month", "expense 450 fuel" all work. */
const AR = () => { try { return getLang() === "ar" || getLang() === "arb"; } catch (e) { return false; } };
const tomorrow9 = () => { const d = new Date(Date.now() + 864e5); d.setHours(9, 0, 0, 0); return d.getTime(); };
function Item({ x, open, setOpen, add, no, done }) {
  const [say, setSay] = useState("");
  const full = x.full || { title: x.title || "", text: "" }, gist = [full.title, full.text].filter(Boolean).join(" — ").replace(/\s+/g, " ").trim().slice(0, 200);
  // "remind me Monday at 9" alone says when, not what — the notification is what (its words, without its numbers, so no amount is misread)
  const withWhat = (t) => (/remind|reminder|فكر|فكّر|تذكير|نبه|نبّه|ذكرني/i.test(t) && t.length < 45 ? t + (/[\u0600-\u06FF]/.test(t) ? " ب" : " to ") + gist.replace(/[\d٠-٩][\d٠-٩,.]*/g, "").replace(/\s+/g, " ").slice(0, 80) : t);
  const doIt = (t0) => { const t = withWhat(t0), r = window.__attuneDoIt ? window.__attuneDoIt(t) : null; const line = r && r.lines && r.lines.length ? r.lines.map((l) => l.text).join(" · ") : r && r.answer ? (typeof r.answer === "string" ? r.answer : tr(r.answer.en)) : "";
    if (line) done(line); else flash2(tr("I couldn't read that — try “reminder tomorrow at 9” or “expense 450”")); };
  const flash2 = (m) => { try { window.dispatchEvent(new CustomEvent("attune-flash", { detail: m })); } catch (e) {} };
  const as = {
    reminder: () => { const r = window.__attuneApplyActions && window.__attuneApplyActions([{ kind: "reminder", action: { kind: "reminder", at: x.at && x.at > Date.now() ? x.at : tomorrow9(), title: gist.slice(0, 120) } }]); done(tr("Reminder set")); return r; },
    todo: () => { window.__attuneAddTodo && window.__attuneAddTodo(gist); done(tr("Added to your to-do list")); },
    // (the words put in the box are read by Attune's own reader — Arabic or English, the two it reads best)
    expense: () => (x.amount ? (window.__attuneApplyActions([{ kind: "money", items: [{ type: "expense", amount: x.amount, cat: x.cat || "other", note: x.note || x.app, date: new Date().toISOString().slice(0, 10), source: "notification" }] }]), done(tr("Expense added"))) : setSay(AR() ? "صرفت " : "spent ")),
    subscription: () => setSay(AR() ? `اشتراك ${x.amount || ""} كل شهر: ${x.note || x.app}`.replace(/\s+/g, " ") : `subscription ${x.amount || ""} every month: ${x.note || x.app}`.replace(/\s+/g, " ")),
  };
  return <div className="py-1.5 border-t first:border-t-0 border-[var(--c-ln)]" data-testid="autopilot-item">
    <div className="flex items-center gap-2.5">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex-1 min-w-0 text-start" data-testid="autopilot-open">
        <b className={"block text-[13.5px] " + (open ? "" : "truncate")} dir="auto">{x.kind === "expense" || x.kind === "income" ? (x.note || x.app) : x.title}</b>
        <span className="block text-[11.5px] c-sub truncate">{tr(LINE[x.kind])}{x.amount ? " · " + fmt(x.amount) : ""}{x.kind !== "expense" && x.kind !== "income" && x.at ? " · " + when(x.at) : ""} · {T("from {app}", { app: x.app })}</span></button>
      {x.amount && (x.kind === "expense" || x.kind === "income") ? <b className={"text-[13.5px] tabular-nums " + (x.kind === "expense" ? "c-neg" : "c-pos")}>{x.kind === "expense" ? "−" : "+"}{fmt(x.amount)}</b> : null}
      <button onClick={() => add(x)} aria-label={tr("Add")} className="min-h-[36px] px-3 rounded-[10px] bg-[var(--c-btn,var(--c-acc))] text-[var(--c-on-btn,var(--c-on-acc))] text-[12px] font-extrabold inline-flex items-center gap-1" data-testid="autopilot-add"><Check size={13} />{tr("Add")}</button>
      <button onClick={() => no(x, false)} onContextMenu={(e) => { e.preventDefault(); no(x, true); }} aria-label={tr("Not this")} title={tr("Not this (hold: never from this app)")} className="w-9 h-9 grid place-items-center rounded-[10px] c-sub" data-testid="autopilot-no"><X size={15} /></button>
    </div>
    {open ? <div className="mt-2 space-y-2" data-testid="autopilot-full">
      <div className="rounded-[12px] bg-[var(--c-bg)] border border-[var(--c-ln)] p-2.5 text-[13px] leading-relaxed" dir="auto">
        {full.title ? <b className="block">{full.title}</b> : null}<span className="whitespace-pre-wrap break-words" data-testid="autopilot-text">{full.text}</span></div>
      <div className="flex flex-wrap gap-1.5" data-testid="autopilot-as">
        <span className="text-[11.5px] c-sub self-center">{tr("Save it as:")}</span>
        {[["reminder", "Reminder"], ["todo", "To-do"], ["expense", "Expense"], ["subscription", "Subscription"]].map(([k, l]) => <button key={k} onClick={() => as[k]()} className="min-h-[34px] px-3 rounded-full border border-[var(--c-ln)] bg-[var(--c-surf)] text-[12px] font-bold" data-testid={"autopilot-as-" + k}>{tr(l)}</button>)}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (say.trim()) doIt(say.trim()); }} className="flex gap-2" data-testid="autopilot-say">
        <input value={say} onChange={(e) => setSay(e.target.value)} dir="auto" placeholder={tr("Or say how — “remind me Monday at 9”, “subscription 200 every month”")} className="flex-1 min-w-0 min-h-[40px] rounded-[12px] border border-[var(--c-ln)] bg-[var(--c-surf)] px-3 text-[13.5px]" data-testid="autopilot-say-input" />
        <button type="submit" disabled={!say.trim()} className="min-h-[40px] px-3.5 rounded-[12px] bg-[var(--c-btn,var(--c-acc))] text-[var(--c-on-btn,var(--c-on-acc))] text-[12.5px] font-extrabold disabled:opacity-40" data-testid="autopilot-say-go">{tr("Save")}</button>
      </form>
    </div> : null}
  </div>;
}

export function AutopilotCard() {
  const [s, setS] = useState(AP.loadAP);
  const [slot, setSlot] = useState(() => Math.floor(Date.now() / 120000));
  useEffect(() => { const t = setInterval(() => setSlot(Math.floor(Date.now() / 120000)), 60000); return () => clearInterval(t); }, []);
  const put = (x) => setS(AP.saveAP(x));
  const [open, setOpen] = useState("");
  const [ready, setReady] = useState(0);
  const flash = (m) => { try { window.dispatchEvent(new CustomEvent("attune-flash", { detail: m })); } catch (e) {} };
  const notes = useMemo(readNotes, [slot]);
  const list = useMemo(() => AP.suggestions(notes, { now: Date.now(), s, ledger: readLedger(), life: loadLife() }), [notes, s]);
  // what you allowed is done by itself (listed below with Undo); a "Delivered" closes its follow-up
  useEffect(() => {
    // (v9.9: on the first open the app's save path is set up a moment after this card — wait for it, or "done for you" was shown and
    // nothing was saved)
    if (!window.__attuneApplyActions) { const t = setTimeout(() => setReady((r) => r + 1), 300); return () => clearTimeout(t); }
    let st = s, changed = false;
    for (const x of list) if (AP.isAuto(st, x)) { const r = apply(x); st = AP.accept(st, x, { auto: true, rid: (r && r.rid) || "" }); changed = true; }
    for (const rid of AP.deliveredDone(notes, st)) { try { window.__attuneRemoveReminder && window.__attuneRemoveReminder(rid); } catch (e) {} st = { ...st, done: st.done.map((d) => (d.rid === rid ? { ...d, closed: true } : d)) }; changed = true; }
    if (changed) put(st);
  }, [list.map((x) => x.key).join(), notes.length, ready]);
  const add = (x) => { const r = apply(x); put(AP.accept(s, x, { rid: (r && r.rid) || "" })); };
  const no = (x, all) => put(AP.refuse(s, x, { app: all }));
  const undo = (d) => { try { d.rid && window.__attuneRemoveReminder && window.__attuneRemoveReminder(d.rid); } catch (e) {}
    try { if (d.kind === "expense" || d.kind === "income") window.__attuneUndoMoney && window.__attuneUndoMoney(d.amount, d.kind); } catch (e) {}
    // v9.9 a subscription it added by itself: the plan (or this month's tick) and its expense are taken back
    try { if (d.kind === "subscription") { saveLife(undoSubPay(loadLife(), d.key)); if (!d.noMoney) window.__attuneUndoMoney && window.__attuneUndoMoney(d.amount, "expense"); } } catch (e) {}
    put(AP.undoDone(s, d.key)); };
  const waiting = list.filter((x) => !AP.isAuto(s, x)).slice(0, 4), recent = (s.done || []).filter((d) => d.at > Date.now() - 2 * 864e5).slice(0, 5)   /* v9.9.30: deliveries too — they are done by themselves now */, week = AP.weekCount(s);
  if (!waiting.length && !recent.length && !s.ask) return null;
  return (
    <section className="c-card p-3.5 space-y-2" style={{ borderColor: "color-mix(in srgb, var(--c-area-agents, var(--c-acc)) 35%, var(--c-ln))" }} data-testid="autopilot">
      <div className="flex items-center gap-2"><Zap size={15} style={{ color: "var(--c-area-agents, var(--c-acc))" }} />
        <span className="flex-1 text-[12px] font-extrabold tracking-wide uppercase" style={{ color: "var(--c-area-agents, var(--c-acc))" }}>{tr("Autopilot")}</span>
        {week ? <span className="text-[11.5px] c-sub" data-testid="autopilot-week">{T("{n} done this week", { n: week })}</span> : null}</div>
      {s.ask ? <div className="rounded-[12px] bg-[var(--c-soft)] p-2.5 space-y-2" data-testid="autopilot-ask">
        <p className="m-0 text-[13px] font-bold" dir="auto">{T("You added {k} from {app} 3 times. Do these by yourself from now on?", { k: tr(LINE[s.ask.split(":")[0]] || "these"), app: s.ask.split(":").slice(1).join(":") })}</p>
        <div className="flex gap-2"><button onClick={() => put(AP.allow(s, s.ask, true))} className="min-h-[38px] px-3.5 rounded-[10px] bg-[var(--c-btn,var(--c-acc))] text-[var(--c-on-btn,var(--c-on-acc))] text-[12.5px] font-extrabold" data-testid="autopilot-allow">{tr("Yes, by itself")}</button>
          <button onClick={() => put(AP.allow(s, s.ask, false))} className="min-h-[38px] px-3 rounded-[10px] border border-[var(--c-ln)] text-[12.5px] font-bold" data-testid="autopilot-keep-asking">{tr("Keep asking me")}</button></div></div> : null}
      {waiting.map((x) => <Item key={x.key} x={x} open={open === x.key} setOpen={(v) => setOpen(v ? x.key : "")} add={add} no={no} done={(how) => { put(AP.accept(s, { ...x, kind: x.kind }, {})); setOpen(""); flash(how); }} />)}
      {recent.length ? <div className="pt-1 space-y-1" data-testid="autopilot-done">
        <p className="m-0 text-[11px] font-extrabold tracking-[0.06em] uppercase c-sub">{tr("Done for you")}</p>
        {recent.map((d) => <div key={d.key} className="flex items-center gap-2 text-[12.5px]"><Check size={13} className="c-pos shrink-0" /><span className="flex-1 truncate" dir="auto">{d.title || d.app}{d.amount ? " · " + fmt(d.amount) : ""}{d.kind === "subscription" ? " · " + tr("added to Subscriptions") : ""}</span>
          <button onClick={() => undo(d)} className="min-h-[32px] px-2 text-[12px] font-bold c-acc inline-flex items-center gap-1" data-testid="autopilot-undo"><Undo2 size={12} />{tr("Undo")}</button></div>)}
      </div> : null}
    </section>);
}
