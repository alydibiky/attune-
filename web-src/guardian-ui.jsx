/* ---- v6.27: the Money Guardian page and its Home card (design A "Calm") — see guardian.js ----------------------------------------
   Pro: every finding with its action, and the counter "Attune saved you X this month". Free: the first finding in full and the
   others as a total ("3 more ways to save 2,280 EGP") with "Get Pro" — the counter is what Pro is sold on.            */
import React, { useMemo, useState } from "react";
import { ShieldCheck, Send, Check, X, Crown } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import { findings, loadGuardian, saveGuardian, markSaved, dismiss, savedTotals, noteReminded } from "./guardian.js";
import { loadLedger } from "./myledger.js";
import { loadLife } from "./life.js";
import { fmt } from "./money-calm.js";
import { disputeLetter } from "./owed.js";
import { openOwed } from "./owed-ui.jsx";

const DONE = { late: ["Send reminder", "Not now"], double: ["I got it back", "Not a mistake"], creep: ["I fixed it", "It's fine"], subs: ["I cancelled it", "I use it"], fees: ["Got it", null], due: ["Paid", null] };

function useGuardian() {
  const [g, setG] = useState(() => loadGuardian());
  const put = (x) => setG(saveGuardian(x));
  const F = useMemo(() => findings({ ledger: loadLedger(), life: loadLife(), dismissed: g.dismissed || [], lang: getLang() }), [g]);
  return { g, put, F, totals: savedTotals(g) };
}

/** Home's card: the counter and what is waiting. */
export function GuardianCard({ pro, open }) {
  const { F, totals } = useGuardian();
  const at = F.reduce((a, f) => a + (f.amount || 0), 0);
  if (!F.length && !totals.all) return null;
  return (
    <button onClick={open} className="c-card w-full text-start" data-testid="guardian-card">
      <div className="flex items-center gap-2"><ShieldCheck size={17} className="c-acc" /><span className="c-lbl">{tr("Money Guardian")}</span>{!pro ? <span className="c-pill ms-auto">Pro</span> : null}</div>
      {pro && totals.month ? <div className="mt-1"><span className="c-num text-[20px] font-bold">{fmt(totals.month)}</span> <span className="c-sub">{tr("saved for you this month")}</span></div> : null}
      {F.length ? <div className="c-sub mt-1">{F.length === 1 ? tr("1 way to save {a}", { a: fmt(at) }) : tr("{n} ways to save {a}", { n: F.length, a: fmt(at) })}</div> : null}
    </button>);
}

export function GuardianPage({ pro, openPlan, flash }) {
  const { g, put, F, totals } = useGuardian();
  const act = (f, yes) => {
    if (!yes) { put(dismiss(g, f.id)); return; }
    if (f.kind === "late") {
      put(noteReminded(dismiss(g, f.id), f.id));
      // the phone's own Share menu (WhatsApp, SMS, iMessage, Telegram, Signal… whatever the person uses), else WhatsApp
      const N = typeof window !== "undefined" && window.AttuneNative;
      try { if (N && N.share) N.share(f.message || ""); else if (navigator.share) navigator.share({ text: f.message || "" }).catch(() => {}); else window.open("https://wa.me/?text=" + encodeURIComponent(f.message || ""), "_blank"); } catch (e) {}
      flash && flash(tr("When it comes back, tick it in People & plans — it counts as saved"));
      return;
    }
    if (f.kind === "fees" || f.kind === "due") { put(dismiss(g, f.id)); return; }
    put(markSaved(g, f)); flash && flash(tr("Counted as saved"));
  };
  const shown = pro ? F : F.slice(0, 1), hidden = pro ? [] : F.slice(1);
  return (
    <div className="calm rounded-2xl p-4 md:p-6 space-y-4" style={{ minHeight: "70vh" }} data-testid="guardian-page">
      <div><h2 className="text-[22px] font-bold m-0 flex items-center gap-2"><ShieldCheck size={20} className="c-acc" />{tr("Money Guardian")}</h2>
        <p data-intro="" className="c-sub m-0 lg:max-w-[70ch]">{tr("Finds money in your own payments — on this phone, by code. It only counts what you did.")}</p></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="c-card" data-testid="guardian-month"><span className="c-lbl">{tr("Saved this month")}</span><div className="c-amt">{pro ? fmt(totals.month) : "—"}</div></div>
        <div className="c-card"><span className="c-lbl">{tr("Saved in all")}</span><div className="c-amt">{pro ? fmt(totals.all) : "—"}</div></div>
      </div>
      {!F.length ? <p className="c-sub" data-testid="guardian-empty">{tr("Nothing to fix right now. The Guardian looks again every time a payment comes in.")}</p> : null}
      {/* v6.27 computer layout A: the findings as cards in 2 columns (one under another on a phone) */}
      {shown.length || hidden.length ? <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-4 lg:items-start">
      {shown.map((f) => (
        <div key={f.id} className="c-card" data-testid="guardian-item">
          <div className="flex items-start gap-3"><div className="flex-1 min-w-0"><b className="block" dir="auto">{f.T ? tr(f.T[0], f.T[1]) : f.title}</b><div className="c-sub" dir="auto">{f.D ? tr(f.D[0], f.D[1]) : f.detail}</div></div>
            <span className={"c-pill " + (f.kind === "late" || f.kind === "double" ? "late" : "due")}><span className="c-num">{fmt(f.amount)}</span></span></div>
          {f.kind === "late" ? <p className="c-sub mt-2 text-[12.5px] rounded-lg p-2" style={{ background: "var(--c-bg)" }} dir="auto" data-testid="guardian-message">{f.message}</p> : null}
          <div className="flex gap-2 mt-3">
            <button className="c-btn flex items-center gap-1.5" onClick={() => act(f, true)} data-testid="guardian-yes">{f.kind === "late" ? <Send size={14} /> : <Check size={14} />}{tr(DONE[f.kind][0])}</button>
            {f.kind === "double" ? <button className="c-sub flex items-center gap-1" onClick={() => openOwed({ letter: { title: "Ask for it back", text: disputeLetter({ merchant: (f.T && f.T[1] && f.T[1].m) || "", amount: fmt(f.amount), currency: "", dates: f.D && f.D[1] && f.D[1].d ? [f.D[1].d] : [] }, { lang: getLang() === "ar" ? "ar" : "en" }) } })} data-testid="guardian-dispute"><Send size={14} />{tr("Ask for it back")}</button> : null}
            {DONE[f.kind][1] ? <button className="c-sub flex items-center gap-1" onClick={() => act(f, false)} data-testid="guardian-no"><X size={14} />{tr(DONE[f.kind][1])}</button> : null}
          </div>
        </div>))}
      {hidden.length ? (
        <button className="c-card w-full text-start" onClick={openPlan} data-testid="guardian-locked">
          <div className="flex items-center gap-2"><Crown size={16} className="c-warn" /><b>{hidden.length === 1 ? tr("1 more way to save {a}", { a: fmt(hidden.reduce((a, f) => a + f.amount, 0)) }) : tr("{n} more ways to save {a}", { n: hidden.length, a: fmt(hidden.reduce((a, f) => a + f.amount, 0)) })}</b></div>
          <div className="c-sub mt-1">{tr("Pro shows them all, and counts what Attune saved you — usually more than it costs.")}</div>
        </button>) : null}
      </div> : null}
    </div>);
}
