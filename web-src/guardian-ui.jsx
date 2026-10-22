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
import { OverpayCheck } from "./overpay-ui.jsx";
import * as U from "./ui-kit.jsx";
import { parsePrice, loadPrices, savePrices, addPrice, allRecords, overview } from "./pricememory.js";

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
    <button onClick={open} className={U.cardPad + " w-full text-start min-h-[56px] hover:border-[var(--c-acc)]"} data-testid="guardian-card">
      <div className="flex items-center gap-2"><ShieldCheck size={17} className="text-[var(--c-acc)]" /><span className={U.label}>{tr("Money Guardian")}</span>{!pro ? <span className={U.tag("blue") + " ms-auto"}>Pro</span> : null}</div>
      {pro && totals.month ? <div className="mt-1"><span className="tabular-nums text-[21px] font-black tracking-tight" dir="ltr">{fmt(totals.month)}</span> <span className={"text-[12.5px] " + U.muted}>{tr("saved for you this month")}</span></div> : null}
      {F.length ? <div className={"mt-1 text-[13px] " + U.muted}>{F.length === 1 ? tr("1 way to save {a}", { a: fmt(at) }) : tr("{n} ways to save {a}", { n: F.length, a: fmt(at) })}</div> : null}
    </button>);
}

/** v6.32 Price memory: what you paid for the same thing over time — typed here or read from Money's own entries (pricememory.js). */
function PriceMemory({ flash }) {
  const [d, setD] = useState(() => loadPrices());
  const [text, setText] = useState("");
  const [all, setAll] = useState(false);
  const list = useMemo(() => overview(allRecords(d, loadLedger())), [d]);
  const add = () => {
    const p = parsePrice(text); if (!p) { flash && flash(tr("Write the thing and its price — “milk 1L 45 at Carrefour”")); return; }
    setD(savePrices(addPrice(d, { ...p, source: "typed" }))); setText(""); flash && flash(tr("Remembered"));
  };
  return (
    <div className={U.cardPad} data-testid="price-memory">
      <span className={U.label}>{tr("Price memory")}</span>
      <div className="flex items-center gap-2 mt-2">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} dir="auto" data-testid="price-input"
          placeholder={tr("“milk 1L 45 at Carrefour” or «كيلو طماطم ١٥»")} className={U.inp + " flex-1"} />
        <button className={U.btnP} onClick={add} disabled={!text.trim()} data-testid="price-add">{tr("Add")}</button>
      </div>
      {list.length ? <div className="mt-3 space-y-1.5">{(all ? list : list.slice(0, 6)).map((x) => (
        <div key={x.last.key} className="flex items-center gap-2 text-[13.5px] py-1" data-testid="price-row">
          <span className="flex-1 min-w-0 font-semibold" dir="auto">{tr(x.T[0], { ...x.T[1], i: tr(x.T[1].i) })}{x.cheapest ? <span className={"font-normal " + U.muted}> · {tr("cheapest at {s}", { s: x.cheapest.store })}</span> : null}</span>
          {x.pct ? <span className={U.tag(x.pct > 0 ? "red" : "amber") + " tabular-nums"}>{(x.pct > 0 ? "+" : "") + x.pct + "%"}</span> : null}</div>))}
        {list.length > 6 ? <button className="min-h-[44px] px-1 text-[13px] font-bold text-[var(--c-acc)]" onClick={() => setAll(!all)}>{all ? tr("Show less") : tr("Show all {n}", { n: list.length })}</button> : null}</div>
        : <p className={"mt-2 text-[12.5px] m-0 " + U.muted}>{tr("Each time you note a price, it says how it compares with last time — per kilo or litre when you give the size.")}</p>}
    </div>);
}

export function GuardianPage({ pro, openPlan, flash, remind, unremind }) {
  const { g, put, F: all, totals } = useGuardian();
  const F = all.filter((f) => f.kind !== "subs" && f.kind !== "creep");   // v6.32: subscriptions and price rises live in the Overpaying check above
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
    <div className={U.page + " rounded-[22px] p-4 md:p-6 space-y-4"} style={{ minHeight: "70vh" }} data-testid="guardian-page">
      <div><h2 className={U.h1 + " flex items-center gap-2"}><ShieldCheck size={20} className="text-[var(--c-acc)]" />{tr("Money Guardian")}</h2>
        <p data-intro="" className={"m-0 mt-0.5 text-[13px] lg:max-w-[70ch] " + U.muted}>{tr("Finds money in your own payments — on this phone, by code. It only counts what you did.")}</p></div>
      <div className="grid grid-cols-2 gap-3">
        <U.Kpi label={tr("Saved this month")} value={pro ? fmt(totals.month) : "—"} tone="pos" testid="guardian-month" />
        <U.Kpi label={tr("Saved in all")} value={pro ? fmt(totals.all) : "—"} />
      </div>
      <OverpayCheck pro={pro} openPlan={openPlan} flash={flash} remind={remind} unremind={unremind} />
      {!F.length ? <p className={"text-[13.5px] " + U.muted} data-testid="guardian-empty">{tr("Nothing to fix right now. The Guardian looks again every time a payment comes in.")}</p> : null}
      {/* v6.27 computer layout A: the findings as cards in 2 columns (one under another on a phone) */}
      {shown.length || hidden.length ? <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-4 lg:items-start">
      {shown.map((f) => (
        <div key={f.id} className={U.cardPad} data-testid="guardian-item">
          <div className="flex items-start gap-3"><div className="flex-1 min-w-0"><b className="block font-extrabold text-[14.5px]" dir="auto">{f.T ? tr(f.T[0], f.T[1]) : f.title}</b><div className={"text-[12.5px] " + U.muted} dir="auto">{f.D ? tr(f.D[0], f.D[1]) : f.detail}</div></div>
            <span className={U.tag(f.kind === "late" || f.kind === "double" ? "red" : "amber")}><span className="tabular-nums">{fmt(f.amount)}</span></span></div>
          {f.kind === "late" ? <p className={"mt-2 text-[12.5px] rounded-[14px] p-2.5 bg-[var(--c-bg)] border border-[var(--c-ln)] " + U.muted} dir="auto" data-testid="guardian-message">{f.message}</p> : null}
          <div className="flex flex-wrap gap-2 mt-3">
            <button className={U.btnP} onClick={() => act(f, true)} data-testid="guardian-yes">{f.kind === "late" ? <Send size={14} /> : <Check size={14} />}{tr(DONE[f.kind][0])}</button>
            {f.kind === "double" ? <button className={U.btnS} onClick={() => openOwed({ letter: { title: "Ask for it back", text: disputeLetter({ merchant: (f.T && f.T[1] && f.T[1].m) || "", amount: fmt(f.amount), currency: "", dates: f.D && f.D[1] && f.D[1].d ? [f.D[1].d] : [] }, { lang: getLang() === "ar" ? "ar" : "en" }) } })} data-testid="guardian-dispute"><Send size={14} />{tr("Ask for it back")}</button> : null}
            {DONE[f.kind][1] ? <button className={U.btnS + " " + U.muted} onClick={() => act(f, false)} data-testid="guardian-no"><X size={14} />{tr(DONE[f.kind][1])}</button> : null}
          </div>
        </div>))}
      {hidden.length ? (
        <button className={U.cardPad + " w-full text-start hover:border-[var(--c-acc)]"} onClick={openPlan} data-testid="guardian-locked">
          <div className="flex items-center gap-2"><Crown size={16} className="text-[var(--c-acc-2)] shrink-0" /><b className="font-extrabold">{hidden.length === 1 ? tr("1 more way to save {a}", { a: fmt(hidden.reduce((a, f) => a + f.amount, 0)) }) : tr("{n} more ways to save {a}", { n: hidden.length, a: fmt(hidden.reduce((a, f) => a + f.amount, 0)) })}</b></div>
          <div className={"mt-1 text-[12.5px] " + U.muted}>{tr("Pro shows them all, and counts what Attune saved you — usually more than it costs.")}</div>
        </button>) : null}
      </div> : null}
      <PriceMemory flash={flash} />
    </div>);
}
