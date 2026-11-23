/* ---- v10.9.3 "Read from your messages" + the live line on Money (Ali's OK-BK, 23 Nov 2026; logic in readlog.js).
   The page: every bank SMS / notification Attune read, newest first, by day — the FULL message, and under it where it went
   ("→ Money · Food · Talabat 312 EGP") with Undo · Change · Open; a payment still waiting has Add to Money · Not mine; what was left
   alone is listed greyed with why. A bottom sheet on a phone, a window on a computer; it opens on top of any page (a portal, solid
   background — v10.9.1's lesson). Opened by: the line on Money, "Check" on Set up's bank row, the BK3 notification
   (attune-open {mode: "readlog"}), or window event "attune-readlog". */
import React, { useEffect, useMemo, useState } from "react";
import { X, ChevronRight } from "lucide-react";
import { tr, dateLocale } from "./i18n.js";
import { readLog, liveLine, WHY, ALERT } from "./readlog.js";
import { catName } from "./money-report.js";
import { removeTxn } from "./guardian.js";
import { loadLedger } from "./myledger.js";
import { payReader, addPaidNow, dismissPaid } from "./paylog-ui.jsx";
import { payOpts } from "./locale.js";
import { bankAct } from "./setup-ui.jsx";

const createPortal = (el, target) => window.ReactDOM.createPortal(el, target);
const N0 = () => (typeof window !== "undefined" ? window.AttuneNative : null);
const rj = (f, d) => { try { const v = JSON.parse(f() || "null"); return v == null ? d : v; } catch (e) { return d; } };
/** Everything the page and the line look at, from the phone and the stores. */
export function readNow() {
  const N = N0();
  let access = false; try { access = !!(N && N.payAccess && N.payAccess()); } catch (e) {}
  const diag = N && N.smsDiag ? rj(() => N.smsDiag(), {}) : N && N.listenerHealth ? rj(() => N.listenerHealth(), {}) : {};
  const queue = N && N.payQueue ? rj(() => N.payQueue(), []) : [];
  return { N, reader: payReader(N), access, diag, queue, ledger: loadLedger() || {} };
}
export const openReadLog = () => { try { window.dispatchEvent(new CustomEvent("attune-readlog")); } catch (e) {} };
const hm = (ts) => { try { return new Date(ts).toLocaleTimeString(dateLocale(), { hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } };
const dayOf = (ts) => { const d = new Date(ts), t = new Date(); t.setHours(0, 0, 0, 0); const k = new Date(d); k.setHours(0, 0, 0, 0);
  const diff = Math.round((+t - +k) / 864e5); if (diff === 0) return tr("Today"); if (diff === 1) return tr("Yesterday");
  try { return d.toLocaleDateString(dateLocale(), { weekday: "short", day: "numeric", month: "short" }); } catch (e) { return d.toDateString(); } };
const money = (a, cur) => Number(a || 0).toLocaleString("en-US", { maximumFractionDigits: 2 }) + (cur ? " " + cur : "");
/** Opens one payment in Money (its edit sheet). */
export function openMoneyTx(id) {
  try { window.__attuneMoneyTx = id; window.dispatchEvent(new CustomEvent("attune-open", { detail: { mode: "money" } })); setTimeout(() => window.dispatchEvent(new CustomEvent("attune-money-tx", { detail: { id } })), 60); } catch (e) {}
}

function Row({ it, L, act }) {
  const left = it.kind === "left" || it.kind === "twice" || it.kind === "already";
  const t = it.txn, cur = (L && L.currency) || "";
  return <li className={"rounded-[14px] p-3 space-y-1.5 border border-[var(--c-ln)] " + (left ? "opacity-70" : "")} style={{ background: "var(--g-solid-2, var(--c-surf-2, var(--c-surf)))" }} data-testid="readlog-row" data-kind={it.kind}>
    <p className="m-0 text-[11.5px] font-extrabold c-sub flex gap-2" dir="auto"><span className="min-w-0 truncate">{[it.from, it.app && it.app !== it.from ? it.app : ""].filter(Boolean).join(" · ") || tr("A message")}</span><span className="shrink-0 tabular-nums ms-auto">{hm(it.ts)}</span></p>
    {it.text ? <p className="m-0 text-[13px] whitespace-pre-wrap break-words rounded-[10px] px-2.5 py-1.5 bg-[var(--c-bg)]" dir="auto" data-testid="readlog-text">{it.text}</p>
      : it.kind === "saved" ? <p className="m-0 text-[12px] c-sub" dir="auto">{tr("Read before Attune kept the full message.")}</p> : null}
    {it.kind === "saved" ? <>
      <p className="m-0 text-[12.5px] font-extrabold text-[var(--c-pos,#1e7a43)]" dir="auto" data-testid="readlog-went">{"→ " + [tr("Money"), catName(L, t.cat), t.note, (t.type === "income" ? "+" : "") + money(t.amount, t.currency || cur)].filter(Boolean).join(" · ")}</p>
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => act("undo", it)} className="h-8 px-3 rounded-full text-[12px] font-extrabold border border-[var(--c-acc)] text-[var(--c-acc)]" data-testid="readlog-undo">{tr("Undo")}</button>
        <button onClick={() => act("change", it)} className="h-8 px-3 rounded-full text-[12px] font-extrabold border border-[var(--c-acc)] text-[var(--c-acc)]" data-testid="readlog-change">{tr("✎ Change")}</button>
        <button onClick={() => act("open", it)} className="h-8 px-3 rounded-full text-[12px] font-extrabold border border-[var(--c-acc)] text-[var(--c-acc)]" data-testid="readlog-open">{tr("Open")}</button></div></>
    : it.kind === "waiting" ? <>
      <p className="m-0 text-[12.5px] font-extrabold text-[var(--c-warn,#9a5b05)]" dir="auto">{tr(WHY.waiting) + " · " + (it.entry.direction === "in" ? "+" : "−") + money(it.entry.amount, it.entry.currency) + (it.entry.party ? " · " + it.entry.party : "")}</p>
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => act("add", it)} className="h-8 px-3 rounded-full text-[12px] font-extrabold" style={{ background: "var(--c-acc)", color: "var(--c-on-acc, #fff)" }} data-testid="readlog-add">{tr("Add to Money")}</button>
        <button onClick={() => act("notmine", it)} className="h-8 px-3 rounded-full text-[12px] font-extrabold border border-[var(--c-acc)] text-[var(--c-acc)]" data-testid="readlog-notmine">{tr("Not mine")}</button></div></>
    : <p className="m-0 text-[12px] c-sub" dir="auto" data-testid="readlog-why">{"● " + tr(WHY[it.why] || WHY.unsure)}</p>}
  </li>;
}

/** The sheet itself. */
export function ReadLogSheet({ onClose }) {
  const [gen, setGen] = useState(0), [say, setSay] = useState("");
  const now = readNow();
  const items = useMemo(() => { let opts; try { opts = payOpts(); } catch (e) {} return readLog({ ledger: now.ledger, queue: now.queue, diag: now.diag, opts }); }, [gen]);   // eslint-disable-line
  const line = liveLine({ reader: now.reader, access: now.access, diag: now.diag, ledger: now.ledger });
  useEffect(() => { const k = (e) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  const act = (a, it) => {
    if (a === "undo") { const L = removeTxn(loadLedger(), it.txn.id); if (L) { try { localStorage.setItem("ledger.v3", JSON.stringify(L)); setSay(tr("Removed from Money")); } catch (e) {} } }
    else if (a === "change") { onClose(); openMoneyTx(it.txn.id); return; }
    else if (a === "open") { onClose(); try { window.dispatchEvent(new CustomEvent("attune-open", { detail: { mode: "money" } })); } catch (e) {} return; }
    else if (a === "add") { setSay(addPaidNow(it.entry, now.N) ? tr("Added to Money") : tr("Already in Money")); }
    else if (a === "notmine") { dismissPaid(it.entry, now.N); setSay(tr("OK — left out of Money")); }
    setGen((g) => g + 1);
  };
  const groups = []; for (const it of items) { const d = dayOf(it.ts); const g = groups[groups.length - 1]; if (g && g.d === d) g.items.push(it); else groups.push({ d, items: [it] }); }
  const el = <div className="fixed inset-0 z-[86] bg-black/55 flex flex-col justify-end lg:items-center lg:justify-center" onClick={onClose} data-testid="readlog">
    <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={tr("Read from your messages")}
      className="bg-[var(--g-solid,var(--c-surf))] text-[var(--c-ink)] rounded-t-[22px] lg:rounded-[22px] w-full lg:max-w-[620px] max-h-[90vh] flex flex-col shadow-2xl">
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <p className="flex-1 m-0 text-[18px] font-black min-w-0" dir="auto">{tr("Read from your messages")}</p>
        <button onClick={onClose} aria-label={tr("Close")} className="w-10 h-10 rounded-full grid place-items-center c-sub shrink-0" data-testid="readlog-close"><X size={18} /></button></div>
      <div className="px-4 pb-2"><LiveLine line={line} inSheet /></div>
      {say ? <p className="m-0 px-4 pb-1 text-[12.5px] font-bold text-[var(--c-acc)]" dir="auto" data-testid="readlog-say">{say}</p> : null}
      <div className="overflow-y-auto px-4 pb-6 space-y-3 min-h-0" style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
        {!items.length ? <p className="m-0 text-[13.5px] c-sub py-6 text-center" dir="auto" data-testid="readlog-empty">{now.reader ? tr("Nothing read in the last 30 days. The next bank SMS or wallet notification shows up here, with where it went.") : tr("Bank messages are read on your phone. What it read shows up here once Money is synced.")}</p>
          : groups.map((g) => <section key={g.d} className="space-y-2"><p className="m-0 text-[11px] font-extrabold tracking-[0.06em] uppercase c-sub" dir="auto">{g.d}</p>
            <ul className="m-0 p-0 list-none space-y-2">{g.items.map((it) => <Row key={it.key} it={it} L={now.ledger} act={act} />)}</ul></section>)}
      </div></div></div>;
  try { return document.body ? createPortal(<div className="calm">{el}</div>, document.body) : el; } catch (e) { return el; }
}

/** Listens for "attune-readlog" and shows the sheet (rendered once, in App). */
export function ReadLogHost() {
  const [open, setOpen] = useState(false);
  useEffect(() => { const on = () => setOpen(true); window.addEventListener("attune-readlog", on); return () => window.removeEventListener("attune-readlog", on); }, []);
  // BK3: the phone's hourly check gets its words in the person's language (ReadWatch.kt) — once per start, a little after it
  useEffect(() => { const t = setTimeout(() => { try { const N = N0(); if (!N || !N.readWatchSet || !payReader(N)) return;
    const W = (o) => ({ t: tr(o.t), d: tr(o.d) });
    N.readWatchSet(JSON.stringify({ channel: tr("Bank messages"), off: W(ALERT.off), smsoff: W(ALERT.smsoff), silent: W(ALERT.silent), again: W(ALERT.again), fix: tr(ALERT.fix), later: tr(ALERT.later) })); } catch (e) {} }, 4000);
    return () => clearTimeout(t); }, []);
  return open ? <ReadLogSheet onClose={() => setOpen(false)} /> : null;
}

const LINE = {
  ok: "Reading bank messages · {n} today · last {t}", okNone: "Reading bank messages · none today yet",
  phone: "Read on your phone · {n} today · last {t}",
  asleep: "Not reading since {t} — Android paused it", off: "Not reading — notification access is off", smsoff: "Not reading SMS — the SMS switch is off",
};
const FIX = { asleep: "fix", off: "allow", smsoff: "smson" };
/** BK2 — the line (on Money, and at the top of the sheet). */
export function LiveLine({ line, inSheet = false, onFixed }) {
  const [msg, setMsg] = useState("");
  if (!line) return null;
  const ok = line.tone === "ok";
  const words = line.state === "ok" ? (line.n || line.last ? tr(LINE.ok, { n: line.n, t: line.last ? hm(line.last) : "—" }) : tr(LINE.okNone))
    : line.state === "phone" ? tr(LINE.phone, { n: line.n, t: hm(line.last) })
    : tr(LINE[line.state], { t: line.seen ? hm(line.seen) : "—" });
  const fix = () => { setMsg(bankAct(FIX[line.state] || "check")); setTimeout(() => onFixed && onFixed(), 1500); };
  return <div className={"rounded-[14px] px-3 py-2 flex items-center gap-2 border " + (ok ? "border-[var(--c-ln)]" : "border-[var(--c-warn,#9a5b05)]")} style={{ background: "var(--c-soft)" }} data-testid={inSheet ? "readlog-line" : "money-live"} data-tone={line.tone} data-state={line.state}>
    <span aria-hidden className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: ok ? "var(--c-pos, #1e7a43)" : "var(--c-warn, #c27c0e)" }} />
    {inSheet || !ok ? <span className={"flex-1 min-w-0 text-[12.5px] font-bold " + (ok ? "" : "text-[var(--c-warn,#9a5b05)]")} dir="auto">{msg || words}</span>
      : <button onClick={openReadLog} className="flex-1 min-w-0 text-start text-[12.5px] font-bold flex items-center gap-1" dir="auto" data-testid="money-live-open"><span className="min-w-0">{words}</span><ChevronRight size={14} className="shrink-0 c-sub ms-auto rtl:rotate-180" /></button>}
    {!ok ? <button onClick={fix} className="h-8 px-3 rounded-full text-[12px] font-extrabold shrink-0" style={{ background: "var(--c-acc)", color: "var(--c-on-acc, #fff)" }} data-testid="money-live-fix">{tr("Fix it now")}</button> : null}
    {!ok && !inSheet ? <button onClick={openReadLog} aria-label={tr("Read from your messages")} className="w-8 h-8 grid place-items-center shrink-0 c-sub" data-testid="money-live-open"><ChevronRight size={15} className="rtl:rotate-180" /></button> : null}
  </div>;
}
/** The line on Money: reads the phone once per showing, again a moment after a fix. */
export function MoneyLiveLine() {
  const [gen, setGen] = useState(0);
  const line = useMemo(() => { const n = readNow(); return liveLine({ reader: n.reader, access: n.access, diag: n.diag, ledger: n.ledger }); }, [gen]);   // eslint-disable-line
  return <LiveLine line={line} onFixed={() => setGen((g) => g + 1)} />;
}
