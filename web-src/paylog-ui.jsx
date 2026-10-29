/* ---- v6.27 "Money tracks itself" — the review strip at the top of Money (phone) -------------------------------------------------
   Notification access off → one card that says what it does and opens Android's switch. On → "N payments read from
   your notifications": each with Add / Dismiss, and Add all. Added ones go to Money through the bridge (Yusr "add-txns");
   handled ids are remembered here and forgotten on the phone (payForget). Tests: tests/e2e_v727paylog.py.            */
import React, { useEffect, useState } from "react";
import { Bell, Check, X } from "lucide-react";
import { tr } from "./i18n.js";
import { inbox, toTxns, autoPick, appendToLedger, alreadyIn } from "./paylog.js";
import { loadLedger } from "./myledger.js";
import { payOpts } from "./locale.js";
import * as U from "./ui-kit.jsx";

const DONE_KEY = "attune:paylog:done", OFF_KEY = "attune:paylog:not-now", AUTO_KEY = "attune:paylog:auto", LOG_KEY = "attune:paylog:auto-log";
const readDone = () => { try { return JSON.parse(localStorage.getItem(DONE_KEY) || "[]"); } catch (e) { return []; } };
export const autoOn = () => { try { return localStorage.getItem(AUTO_KEY) !== "0"; } catch (e) { return true; } };   // on unless turned off
const markDone = (N, ids) => {
  try { localStorage.setItem(DONE_KEY, JSON.stringify([...readDone(), ...ids].slice(-500))); } catch (e) {}
  try { N && N.payForget && N.payForget(JSON.stringify(ids)); } catch (e) {}
};
const logAuto = (entries) => {
  let log = []; try { log = JSON.parse(localStorage.getItem(LOG_KEY) || "[]"); } catch (e) {}
  log = [...entries.map((e) => ({ amount: e.amount, currency: e.currency, direction: e.direction, party: e.party, app: e.app, ts: e.ts, at: Date.now(), text: e.full || e.text || "", from: e.from || "" })), ...log].slice(0, 50);
  try { localStorage.setItem(LOG_KEY, JSON.stringify(log)); } catch (e) {}
};
/** v6.27 "by itself" while Money is NOT open: the sure payments go straight into Money's ledger (the same way Money adds
 *  them). → how many were added. Money open → PayInbox adds them through Money instead. */
/** The phone build has the payment-notification reader (the Play Store build; the direct APK leaves it out). */
export const payReader = (N) => { try { return !!(N && N.payAccess && N.payQueue && (!N.payAvailable || N.payAvailable())); } catch (e) { return false; } };
/** v6.34 (Ali: Attune greyed out — "Controlled by restricted setting"): Android 13+ blocks notification access for an app
 *  installed from an APK file, not from Google Play. Opening the access screen once marks it; while access is still off the
 *  steps show, with a button straight to Attune's App info (⋮ → Allow restricted settings). */
const ASKED_KEY = "attune:pay:asked";
export const openAccess = (N) => { try { localStorage.setItem(ASKED_KEY, "1"); } catch (e) {} try { N.openPayAccess(); } catch (e) {} };
export function RestrictedHelp({ N }) {
  let asked = false; try { asked = localStorage.getItem(ASKED_KEY) === "1"; } catch (e) {}
  if (!asked || !N || !N.openAppInfo) return null;
  return (
    <div className="mt-2 text-[12.5px] leading-relaxed text-[var(--c-mut)]" data-testid="pay-restricted-help">
      <b className="text-[var(--c-ink)]">{tr("Attune is greyed out (\"restricted setting\")?")}</b>{" "}
      {tr("Android does this for apps installed from a file instead of Google Play. In App info tap ⋮ (top right) → Allow restricted settings, then turn Attune on here again.")}
      <button onClick={() => { try { N.openAppInfo(); } catch (e) {} }} className="ms-1 min-h-[44px] underline font-bold text-[var(--c-acc)]" data-testid="pay-open-appinfo">{tr("Open App info")}</button>
    </div>);
}
export function runAutoPay(N) {
  if (!payReader(N) || !autoOn()) return 0;
  let on = false; try { on = N.payAccess(); } catch (e) {}
  if (!on) return 0;
  let q = []; try { q = JSON.parse(N.payQueue() || "[]"); } catch (e) {}
  const led = loadLedger(); if (!led) return 0;
  // v7.9: one already in Money (typed by hand, or read before) is never added by itself — it waits as "Already in Money?"
  const sure = autoPick(inbox(q, readDone(), payOpts())).filter((e) => !alreadyIn(e, led));
  if (!sure.length) return 0;
  const r = appendToLedger(led, toTxns(sure));
  if (!r.ids.length) return 0;
  try { localStorage.setItem("ledger.v3", JSON.stringify(r.ledger)); } catch (e) { return 0; }
  markDone(N, sure.map((e) => e.id)); logAuto(sure);
  return r.ids.length;
}

/** The complete message a payment was read from — exactly as it arrived (Ali: "the evidence of the complete real message"). */
export function Evidence({ e, testid = "paylog-evidence" }) {
  const text = (e && (e.full || e.text)) || ""; if (!text) return null;
  return <div className="mt-1.5 rounded-[12px] border border-[var(--c-ln)] bg-[var(--c-surf)] px-3 py-2" data-testid={testid}>
    <p className={"m-0 text-[11px] font-extrabold " + U.muted}>{tr("The message as it arrived")}{e.from ? " · " + e.from : ""}{e.app ? " · " + e.app : ""}</p>
    <p className="m-0 mt-1 text-[13px] leading-snug whitespace-pre-wrap select-text" dir="auto">{text}</p></div>;
}

/* v8.7 (Ali, 29 Oct: "we agreed that it reads SMS, but not one-time codes"): the bank SMS already on the phone, once, in the APK
   Ali installs (the full build declares READ_SMS; SmsInbox.kt). They wait in the same review list — never added by themselves. */
const OLD_KEY = "attune:sms-old:v1", OLD_DONE = "attune:sms-old:done";
const readOld = () => { try { return JSON.parse(localStorage.getItem(OLD_KEY) || "[]"); } catch (e) { return []; } };
const dropOld = (ids) => { try { localStorage.setItem(OLD_KEY, JSON.stringify(readOld().filter((x) => !ids.includes(x.id)))); } catch (e) {} };
export function smsInboxState(N) { try { return (N && N.smsInboxState && JSON.parse(N.smsInboxState() || "{}")) || {}; } catch (e) { return {}; } }
/** Read the money SMS of the last year into the review list. → how many (null = the person said no). */
export function importOldSms(N, days = 365) {
  return new Promise((ok) => {
    const read = () => { let a = []; try { a = JSON.parse(N.smsInboxMoney(days) || "[]"); } catch (e) {}
      const have = new Set(readOld().map((x) => x.id)), done = new Set(readDone());
      const add = a.filter((x) => x && x.id && !have.has(x.id) && !done.has(x.id));
      try { localStorage.setItem(OLD_KEY, JSON.stringify([...readOld(), ...add].slice(-600))); localStorage.setItem(OLD_DONE, String(Date.now())); } catch (e) {}
      ok(add.length); };
    if (smsInboxState(N).granted) return read();
    const on = (e) => { window.removeEventListener("attune-sms-perm", on); if (e.detail) read(); else ok(null); };
    window.addEventListener("attune-sms-perm", on);
    try { N.smsInboxAsk(); } catch (e) { window.removeEventListener("attune-sms-perm", on); ok(null); }
  });
}
function OldSmsCard({ N, onRead }) {
  const st = smsInboxState(N);
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState("");
  let did = false; try { did = !!localStorage.getItem(OLD_DONE); } catch (e) {}
  if (!st.declared || (did && !msg)) return null;
  const go = async () => { setBusy(true); const n = await importOldSms(N); setBusy(false);
    setMsg(n == null ? tr("Android said no — you can allow SMS for Attune in App info.") : tr("{n} bank messages from the last year are waiting below for you to check.", { n })); onRead && onRead(); };
  return <div className="calm shrink-0 px-2 pt-2" data-testid="sms-old"><div className={U.card + " px-3.5 py-2.5"}>
    <p className="m-0 text-[13.5px] font-extrabold">{tr("Bring in your old bank SMS")}</p>
    <p className={"m-0 mt-0.5 text-[12.5px] leading-relaxed " + U.muted}>{msg || tr("Money starts with the last 12 months instead of today. Only bank and wallet messages; never one-time codes; nothing leaves the phone.")}</p>
    {msg ? null : <button onClick={go} disabled={busy} className={U.btnP + " mt-2"} data-testid="sms-old-go">{busy ? tr("Reading…") : tr("Read my bank SMS")}</button>}
  </div></div>;
}

export function PayInbox({ N, onAdd, ready = true }) {
  const can = payReader(N);
  const [on, setOn] = useState(() => { try { return can && N.payAccess(); } catch (e) { return false; } });
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [notNow, setNotNow] = useState(() => { try { return localStorage.getItem(OFF_KEY) === "1"; } catch (e) { return false; } });
  const load = () => {
    if (!can) return;
    let a = false; try { a = N.payAccess(); } catch (e) {}
    setOn(a);
    let q = []; try { q = JSON.parse(N.payQueue() || "[]"); } catch (e) {}
    setItems(inbox([...q, ...readOld()], readDone(), payOpts()));
  };
  useEffect(() => { load(); const f = () => load(); window.addEventListener("focus", f); document.addEventListener("visibilitychange", f);
    return () => { window.removeEventListener("focus", f); document.removeEventListener("visibilitychange", f); }; }, []);
  const finish = (list) => {
    const ids = list.map((e) => e.id);
    markDone(N, ids); dropOld(ids);
    setItems((x) => x.filter((e) => !ids.includes(e.id)));
  };
  const add = (list) => { onAdd(toTxns(list)); finish(list); };
  const [auto, setAuto] = useState(autoOn);
  const [autoN, setAutoN] = useState(0);
  const [showAuto, setShowAuto] = useState(false);
  // by itself, with Money open: the sure ones go in through Money; the rest wait here for a tap
  useEffect(() => {
    if (!on || !auto || !ready) return;   // only once Money is loaded, so nothing is marked done before Money has it
    const led = loadLedger(), sure = autoPick(items.filter((e) => !String(e.id).startsWith("sms:"))).filter((e) => !alreadyIn(e, led));   // v7.9: never a second copy by itself; v8.7: old SMS wait for a tap
    if (sure.length) { const t = setTimeout(() => { add(sure); logAuto(sure); setAutoN((n) => n + sure.length); }, 1500); return () => clearTimeout(t); }
  }, [on, auto, ready, items.length]);
  const toggleAuto = () => { const v = !auto; setAuto(v); try { localStorage.setItem(AUTO_KEY, v ? "1" : "0"); } catch (e) {} };
  if (!can) return null;   // v7.9: after every hook (React needs the same hooks on every render)
  if (!on) {
    if (notNow) return null;
    return (
      <div className="calm shrink-0 px-2 py-2" data-testid="paylog-setup"><div className={U.cardPad}>
        <p className="text-[14px] font-extrabold flex items-center gap-2 m-0"><Bell size={15} className="text-[var(--c-acc)]" />{tr("Log spending by itself")}</p>
        <p className={"text-[12.5px] mt-1 leading-relaxed m-0 " + U.muted}>{tr("Turn on notification access and Attune reads your bank, InstaPay and wallet notifications and bank SMS on this phone, then adds each payment. Never one-time codes; nothing leaves the phone.")}</p>
        <div className="flex gap-2 mt-2.5">
          <button onClick={() => openAccess(N)} className={U.btnP} data-testid="paylog-turn-on">{tr("Turn on")}</button>
          <button onClick={() => { setNotNow(true); try { localStorage.setItem(OFF_KEY, "1"); } catch (e) {} }} className={U.btnS + " " + U.muted}>{tr("Not now")}</button>
        </div>
        <RestrictedHelp N={N} />
      </div></div>);
  }
  const oldCard = <OldSmsCard N={N} onRead={load} />;
  if (!items.length && autoN && showAuto) return <AutoList n={autoN} close={() => setShowAuto(false)} />;
  if (!items.length && !autoN) return oldCard;
  if (!items.length) return autoN ? (
    <div className="calm shrink-0 px-2 py-2" data-testid="paylog-auto-done"><div className={U.card + " px-3.5 py-1 flex items-center gap-2"}>
      <Check size={15} className="text-[var(--c-pos)] shrink-0" /><span className="flex-1 text-[13.5px] font-semibold">{tr("{n} payments added by themselves", { n: autoN })}</span>
      <button onClick={() => setShowAuto(true)} className="min-h-[44px] px-1 text-[12.5px] font-bold underline text-[var(--c-acc)]" data-testid="paylog-auto-see">{tr("See the messages")}</button>
      <button onClick={toggleAuto} className={"min-h-[44px] px-1 text-[12.5px] font-bold underline " + U.muted} data-testid="paylog-auto-toggle">{auto ? tr("Ask me first") : tr("Add by themselves")}</button></div></div>) : null;
  const ledgerNow = open ? loadLedger() : null;
  return (<>{oldCard}
    <div className="calm shrink-0 px-2 py-2" data-testid="paylog"><div className={U.card}>
      <button onClick={() => setOpen((v) => !v)} className="w-full min-h-[52px] flex items-center gap-2 px-3.5 py-2.5 text-start" data-testid="paylog-open">
        <Bell size={15} className="text-[var(--c-acc)] shrink-0" /><span className="flex-1 text-[13.5px] font-extrabold">{tr("{n} payments read from your notifications", { n: items.length })}</span>
        <span className="text-[12.5px] font-bold text-[var(--c-acc)]">{open ? tr("Hide") : tr("Review")}</span></button>
      {open ? (
        <div className="px-3.5 pb-3.5 space-y-2">
          {items.slice(0, 30).map((e) => (
            <div key={e.id} className="rounded-[20px] bg-[var(--c-bg)] border border-[var(--c-ln)] px-3 py-2" data-testid="paylog-item"><div className="flex items-center gap-2">
              <span className="flex-1 min-w-0"><b className={"block text-[14px] font-extrabold tabular-nums " + (e.direction === "in" ? "text-[var(--c-pos)]" : "text-[var(--c-ink)]")} dir="ltr">{e.direction === "in" ? "+" : "−"}{e.amount.toLocaleString("en-US", { maximumFractionDigits: 2 })} {e.currency}</b>
                <span className={"block text-[12px] truncate " + U.muted} dir="auto">{[e.party, e.app, new Date(e.ts).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })].filter(Boolean).join(" · ")}</span>
                {alreadyIn(e, ledgerNow) ? <span className={U.tag("amber") + " mt-1 inline-block"} data-testid="paylog-already">{tr("Already in Money?")}</span> : null}</span>
              <button onClick={() => add([e])} aria-label={tr("Add")} className="w-11 h-11 shrink-0 rounded-full bg-[var(--c-acc)] text-[var(--c-on-acc)] grid place-items-center" data-testid="paylog-add"><Check size={15} /></button>
              <button onClick={() => finish([e])} aria-label={tr("Dismiss")} className="w-11 h-11 shrink-0 rounded-full bg-[var(--c-surf)] border border-[var(--c-ln)] text-[var(--c-mut)] grid place-items-center" data-testid="paylog-dismiss"><X size={15} /></button>
            </div><Evidence e={e} />
            </div>))}
          <label className={"flex items-center gap-2 text-[12.5px] min-h-[44px] pt-1 " + U.muted}><input type="checkbox" checked={auto} onChange={toggleAuto} className="w-5 h-5 shrink-0 accent-[var(--c-acc)]" data-testid="paylog-auto" />{tr("Add the sure ones by themselves (bank and InstaPay messages with a name)")}</label>
          {items.length > 1 ? <button onClick={() => add(items)} className={U.btnP + " w-full"} data-testid="paylog-add-all">{tr("Add all {n}", { n: items.length })}</button> : null}
        </div>) : null}
    </div></div></>);
}

/** The payments added by themselves, newest first, each with the complete message it came from. */
function AutoList({ n, close }) {
  let log = []; try { log = JSON.parse(localStorage.getItem(LOG_KEY) || "[]"); } catch (e) {}
  return <div className="calm shrink-0 px-2 py-2" data-testid="paylog-auto-list"><div className={U.card + " p-3.5 space-y-2"}>
    <div className="flex items-center gap-2"><b className="flex-1 text-[14px] font-extrabold">{tr("{n} payments added by themselves", { n })}</b>
      <button onClick={close} className={"min-h-[44px] px-1 text-[12.5px] font-bold underline " + U.muted}>{tr("Hide")}</button></div>
    {log.slice(0, n).map((e, i) => <div key={i} className="rounded-[20px] bg-[var(--c-bg)] border border-[var(--c-ln)] px-3 py-2">
      <b className={"block text-[14px] font-extrabold tabular-nums " + (e.direction === "in" ? "text-[var(--c-pos)]" : "")} dir="ltr">{e.direction === "in" ? "+" : "−"}{Number(e.amount).toLocaleString("en-US")} {e.currency}</b>
      <span className={"block text-[12px] " + U.muted} dir="auto">{[e.party, new Date(e.ts).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })].filter(Boolean).join(" · ")}</span>
      <Evidence e={{ full: e.text, from: e.from, app: e.app }} testid="paylog-auto-evidence" /></div>)}
  </div></div>;
}
