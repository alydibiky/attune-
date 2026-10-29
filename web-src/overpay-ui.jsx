/* ---- v6.32: the Overpaying check — design A "One list", at the top of Money Guardian (see overpay.js) ---------------------------
   What you pay a month, then one list by problem: Act now · Free trials · Price rises · Doing the same job · Renews soon ·
   Unused perks · All subscriptions. Tap a row: where it was found (the email in Gmail, the notification, the payment) and what to
   do. Sources at the bottom: payments and notifications by themselves, a Gmail export (.mbox) or a pasted email by hand;
   "Check on the 1st of every month" rings a reminder. Free: the total and the first finding; Pro: everything.            */
import React, { useMemo, useRef, useState } from "react";
import { ChevronDown, ExternalLink, FileText as Mail, ClipboardPaste, Bell, Crown, Check, X } from "lucide-react";
import { tr } from "./i18n.js";
import * as O from "./overpay.js";
import { GmailCard } from "./gmail-ui.jsx";
import { cancelLink } from "./deadlines.js";
import { loadRadar } from "./deadlines.js";
import { loadLedger } from "./myledger.js";
import { homeCurrency } from "./locale.js";
import { fmt } from "./money-calm.js";
import { loadGuardian, saveGuardian, markSaved } from "./guardian.js";
import * as U from "./ui-kit.jsx";

const SIGN = { USD: "$", EUR: "€", GBP: "£" };
export const money = (n, c) => (SIGN[c] ? SIGN[c] + fmt(n) : fmt(n) + (c ? " " + c : ""));
const totals = (m) => Object.entries(m || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([c, v]) => money(Math.round(v), c)).join(" + ");
const CAD = { month: "a month", quarter: "every 3 months", year: "a year" };
const DONE = { trial: ["Cancelled it", "Keep it"], hike: ["I fixed it", "It's fine"], overlap: ["I cancelled one", "I use them all"], renewal: ["Cancelled it", "Let it renew"], perk: ["Claimed", "Not for me"] };
const SRC = { email: "From an email", notification: "From a notification", payment: "From a payment in Money", radar: "From Deadline Radar", paste: "From a pasted email" };
const openLink = (label, url) => { try { window.dispatchEvent(new CustomEvent("attune-agent", { detail: { link: { label, url }, plan: null, inApp: false } })); } catch (e) {} };
const day = (t) => { try { return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return ""; } };

function payQueue() { const N = typeof window !== "undefined" && window.AttuneNative; try { return JSON.parse((N && N.payQueue && N.payQueue()) || "[]"); } catch (e) { return []; } }

/** One finding → its line and its pill. */
function line(f) {
  if (f.kind === "trial") return { t: tr("{s} free trial ends", { s: f.name }), d: f.amount ? tr("Then {a} a month", { a: money(f.amount, f.currency) }) : tr("Then it turns paid"), pill: f.days === 0 ? tr("today") : f.days === 1 ? tr("1 day") : tr("{n} days", { n: f.days }), tone: f.days <= 3 ? "late" : "due" };
  if (f.kind === "hike") return { t: tr("{s} went up {p}%", { s: f.name, p: f.pct }), d: tr("{a} → {b}: {y} more a year", { a: money(f.from, f.currency), b: money(f.to, f.currency), y: money(f.perYear, f.currency) }), pill: "+" + f.pct + "%", tone: "due" };
  if (f.kind === "overlap") return { t: tr("{g}: {n} at once", { n: f.items.length, g: tr(f.label) }), d: f.items.map((i) => i.name + (i.trial ? " (" + tr("trial") + ")" : "")).join(" · "), pill: money(f.perYear, f.currency) + tr("/yr"), tone: "due" };
  if (f.kind === "renewal") return { t: tr("{s} renews", { s: f.name }), d: tr("On {d}", { d: f.date }) + (f.amount ? " · " + money(f.amount, f.currency) : ""), pill: f.days === 0 ? tr("today") : tr("{n} days", { n: f.days }), tone: f.days <= 7 ? "late" : "due" };
  if (f.kind === "perk") return { t: f.name + ": " + (f.value ? tr("{a} unused", { a: money(f.value, f.currency) }) : f.points ? tr("{n} points unused", { n: fmt(f.points) }) : tr("a perk unused")), d: f.expires ? tr("Use it before {d}", { d: f.expires }) : f.what, pill: tr("Claim"), tone: "pos" };
  return { t: f.name, d: "", pill: "", tone: "" };
}

function Row({ f, open, toggle, act }) {
  const L = line(f), src = f.src || {}, cancel = f.kind === "trial" || f.kind === "renewal" ? cancelLink({ kind: f.kind, title: f.name, note: src.text, app: src.app }) : null;
  return (
    <div className="py-1 border-t border-[var(--c-ln)]" data-testid="overpay-row" data-kind={f.kind}>
      <button className="w-full min-h-[48px] py-1.5 text-start flex items-center gap-3" onClick={toggle}>
        <div className="flex-1 min-w-0"><b className="block text-[14px] font-extrabold" dir="auto">{L.t}</b><div className={"truncate text-[12.5px] " + U.muted} dir="auto">{L.d}</div></div>
        <span className={U.tag(L.tone === "late" ? "red" : L.tone === "due" ? "amber" : L.tone === "pos" ? "green" : "gray")}><span className="tabular-nums">{L.pill}</span></span>
      </button>
      {open ? <div className="mt-2 space-y-2" data-testid="overpay-detail">
        <div className={"text-[12px] rounded-[12px] p-2.5 bg-[var(--c-bg)] border border-[var(--c-ln)] " + U.muted} dir="auto">
          <div className="flex items-center gap-2"><span>{tr(SRC[src.kind] || "Source")}{src.at ? " · " + day(src.at) : ""}</span>
            {src.link ? <button className="ms-auto min-h-[44px] px-1 font-bold text-[var(--c-acc)] flex items-center gap-1" onClick={() => openLink(src.title || "Gmail", src.link)} data-testid="overpay-source"><ExternalLink size={13} />{tr("Open the email")}</button> : null}</div>
          {src.title || src.text ? <div className="mt-1 line-clamp-3">{src.title && src.kind === "email" ? <b>{src.title}. </b> : null}{src.kind === "email" ? (src.text || "").slice(src.title ? src.title.length + 3 : 0, 220) : (src.text || "").slice(0, 220)}</div> : null}
        </div>
        {f.kind === "overlap" ? <div className={"text-[12.5px] " + U.muted}>{f.items.map((i) => <div key={i.name} className="flex justify-between py-0.5"><span dir="auto">{i.name}</span><span className="tabular-nums font-bold text-[var(--c-ink)]">{money(i.perMonth, i.currency)} {tr("a month")}</span></div>)}<div className="mt-1">{tr("Keep one, and the others cost {a} a year", { a: money(f.perYear, f.currency) })}</div></div> : null}
        <div className="flex flex-wrap gap-2">
          <button className={U.btnP} onClick={() => act(f, true)} data-testid="overpay-yes"><Check size={14} />{tr(DONE[f.kind][0])}</button>
          {cancel ? <button className={U.btnS} onClick={() => openLink(cancel.label, cancel.url)} data-testid="overpay-cancel">{tr("Where to cancel")}</button> : null}
          <button className={U.btnS + " " + U.muted} onClick={() => act(f, false)} data-testid="overpay-no"><X size={14} />{tr(DONE[f.kind][1])}</button>
        </div>
      </div> : null}
    </div>);
}

export function OverpayCheck({ pro, openPlan, flash, remind, unremind }) {
  const [o, setO] = useState(() => O.loadOverpay());
  const put = (x) => { setO(O.saveOverpay({ ...x, snaps: { ...(O.loadOverpay().snaps || {}), ...(x.snaps || {}) } })); };
  const [open, setOpen] = useState("");
  const [all, setAll] = useState(false);
  const [paste, setPaste] = useState(null);
  const [busy, setBusy] = useState("");
  const fileRef = useRef(null);
  const R = useMemo(() => O.overpayCheck({ ledger: loadLedger(), notes: payQueue(), emails: o.emails, radar: loadRadar(), done: o.done, home: homeCurrency() }), [o]);
  // this month's snapshot ("+7% since last month"), kept once a day at most
  const snap = useMemo(() => { const s = O.snapshot(o, R); try { if (JSON.stringify(s.o.snaps) !== JSON.stringify(o.snaps)) O.saveOverpay({ ...o, snaps: s.o.snaps }); } catch (e) {} return s; }, [R]);
  const act = (f, yes) => {
    put({ ...o, done: [...(o.done || []), f.id] });
    if (yes && f.kind !== "perk") { saveGuardian(markSaved(loadGuardian(), O.savedFinding(f))); flash && flash(tr("Counted as saved")); }
  };
  const nowIds = new Set(R.now.map((f) => f.id));
  let sections = [["Act now", R.now], ["Free trials", R.trials.filter((f) => !nowIds.has(f.id))], ["Price rises", R.hikes.filter((f) => !nowIds.has(f.id))],
    ["Doing the same job", R.overlaps], ["Renews soon", R.renewals.filter((f) => !nowIds.has(f.id))], ["Unused perks", R.perks]].filter(([, l]) => l.length);
  // Free: the first finding in full, the others as a count that opens the plan
  const first = sections.length ? sections[0][1][0].id : "", locked = pro ? 0 : Math.max(0, R.count - 1);
  if (!pro) sections = sections.map(([t, l]) => [t, l.filter((f) => f.id === first)]).filter(([, l]) => l.length);
  const onFile = async (file) => {
    if (!file) return;
    setBusy(tr("Reading your Gmail export…"));
    try {
      const since = Date.now() - 366 * 86400000, SZ = 4 << 20; let rest = "", found = [];
      for (let i = 0; i < file.size; i += SZ) {
        const r = O.readMbox(rest + (await file.slice(i, i + SZ).text()), { since, final: i + SZ >= file.size });
        rest = r.rest; found = found.concat(r.emails);
        setBusy(tr("Reading your Gmail export… {p}%", { p: Math.min(100, Math.round(((i + SZ) / file.size) * 100)) }));
      }
      const x = O.addEmails(o, found); put({ ...x, added: undefined });
      flash && flash(tr("{n} emails about money read — nothing left this phone", { n: x.added }));
    } catch (e) { flash && flash(tr("Could not read that file")); }
    setBusy("");
  };
  const addPaste = () => {
    const t = (paste || "").trim(); if (!t) return;
    const x = O.addEmails(o, [{ id: "paste:" + Date.now(), kind: "paste", title: t.split("\n")[0].slice(0, 120), text: t, at: Date.now() }]);
    put({ ...x, added: undefined }); setPaste(null);
  };
  const toggleMonthly = () => {
    const r = O.monthlyReminder();
    if (!o.monthly) { remind && remind({ ...r, title: tr(r.title), body: tr(r.body), created: Date.now(), source: "overpay" }); put({ ...o, monthly: true }); flash && flash(tr("Next check: {d}", { d: day(r.at) })); }
    else { unremind && unremind(r.id); put({ ...o, monthly: false }); }
  };
  const ch = Object.entries(snap.change || {}).filter(([, v]) => v);
  return (
    <div className={U.cardPad} data-testid="overpay">
      <span className={U.label}>{tr("You pay a month")}</span>
      <div className="mt-1 tabular-nums text-[28px] font-black tracking-tight" dir="ltr" data-testid="overpay-total">{R.subs.length ? totals(R.perMonth) : "—"}</div>
      <div className={"text-[12.5px] " + U.muted}>{R.subs.length === 1 ? tr("1 subscription") : tr("{n} subscriptions", { n: R.subs.length })}
        {Object.keys(R.atStake).length ? <> · <span className="font-bold text-[var(--c-warn)]">{tr("{a} a year to save", { a: totals(R.atStake) })}</span></> : null}
        {ch.length ? <> · {ch.map(([c, v]) => tr("{p}% since last month", { p: (v > 0 ? "+" : "") + v })).join(" · ")}</> : null}</div>
      {!R.count && R.subs.length ? <p className={"mt-2 text-[13px] " + U.muted} data-testid="overpay-clean">{tr("No trials, price rises or overlaps right now.")}</p> : null}
      {!R.subs.length && !R.count ? <p className={"mt-2 text-[13px] " + U.muted} data-testid="overpay-empty">{tr("Nothing yet. It reads your payments as they come in — add a Gmail export below to look back 12 months.")}</p> : null}
      {sections.map(([title, list]) => (
        <div key={title} className="mt-3" data-testid="overpay-section">
          <div className={U.label + " mb-1"}>{tr(title)}</div>
          {list.map((f) => <Row key={f.id} f={f} open={open === f.id} toggle={() => setOpen(open === f.id ? "" : f.id)} act={act} />)}
        </div>))}
      {locked ? <button className="w-full min-h-[48px] text-start mt-3 flex items-center gap-2 rounded-[20px] border border-[var(--c-ln)] bg-[var(--c-bg)] px-3.5 hover:border-[var(--c-acc)]" onClick={openPlan} data-testid="overpay-locked"><Crown size={15} className="text-[var(--c-acc-2)] shrink-0" /><b className="font-extrabold">{locked === 1 ? tr("1 more finding") : tr("{n} more findings", { n: locked })}</b><span className={U.tag("blue") + " ms-auto"}>Pro</span></button> : null}
      {R.subs.length ? <div className="mt-3">
        <button className={U.label + " min-h-[44px] flex items-center gap-1"} onClick={() => setAll(!all)} data-testid="overpay-all">{tr("All subscriptions")} ({R.subs.length})<ChevronDown size={13} style={{ transform: all ? "rotate(180deg)" : "" }} /></button>
        {all ? R.subs.map((s) => (
          <div key={s.id} className="flex items-center gap-3 py-2 border-t border-[var(--c-ln)]" data-testid="overpay-sub">
            <div className="flex-1 min-w-0"><b className="block text-[14px] font-extrabold" dir="auto">{s.name}</b><div className={"text-[12.5px] " + U.muted}>{tr("Since {d}", { d: s.since })} · {tr("next {d}", { d: s.next })}</div></div>
            <span className="tabular-nums font-bold text-[13px] text-end">{money(s.amount, s.currency)} <span className={"font-normal " + U.muted}>{tr(CAD[s.cadence])}</span></span>
            {s.src && s.src.link ? <button className="w-11 h-11 shrink-0 grid place-items-center rounded-[12px] text-[var(--c-acc)]" onClick={() => openLink(s.name, s.src.link)} aria-label={tr("Open the email")}><ExternalLink size={14} /></button> : null}
          </div>)) : null}
      </div> : null}
      {/* where it looks */}
      <div className="mt-4 pt-3 space-y-2 border-t border-[var(--c-ln)]">
        <div className={"text-[12px] " + U.muted} data-testid="overpay-sources">{tr("Reads: your payments and money notifications{e}. On this phone only.", { e: o.emails.length ? tr(", {n} emails", { n: o.emails.length }) : "" })}</div>
        <div className="flex flex-wrap gap-2">
          <button className={U.btnS} onClick={() => fileRef.current && fileRef.current.click()} data-testid="overpay-mbox"><Mail size={14} />{tr("Add a Gmail export")}</button>
          <button className={U.btnS} onClick={() => setPaste(paste == null ? "" : null)} data-testid="overpay-paste"><ClipboardPaste size={14} />{tr("Paste an email")}</button>
          <button className={U.chip(!!o.monthly)} onClick={toggleMonthly} data-testid="overpay-monthly"><Bell size={14} />{o.monthly ? tr("Checks on the 1st of every month") : tr("Check on the 1st of every month")}</button>
        </div>
        {busy ? <div className={U.muted} data-testid="overpay-busy">{busy}</div> : null}
        {paste != null ? <div className="space-y-2">
          <textarea className={U.area} rows={4} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={tr("Paste a receipt, a trial or a price-change email")} dir="auto" data-testid="overpay-paste-text" />
          <button className={U.btnP} onClick={addPaste} data-testid="overpay-paste-add">{tr("Add")}</button></div> : null}
        <details className={"text-[12px] " + U.muted}><summary className="min-h-[44px] py-3 cursor-pointer font-bold">{tr("How to export Gmail")}</summary>
          <div className="mt-1">{tr("Google Takeout → Deselect all → Mail → Export. Open the .mbox file here. Attune reads only emails about money from the last 12 months, and keeps a link to each one.")}</div>
          <button className="mt-1 min-h-[44px] font-bold text-[var(--c-acc)]" onClick={() => openLink("Google Takeout", "https://takeout.google.com/settings/takeout/custom/gmail")}>takeout.google.com</button>
</details>
        <GmailCard onRead={() => setO(O.loadOverpay())} />
        <input ref={fileRef} type="file" accept=".mbox,application/mbox,text/plain,*/*" className="hidden" onChange={(e) => { onFile(e.target.files && e.target.files[0]); e.target.value = ""; }} data-testid="overpay-file" />
      </div>
    </div>);
}
