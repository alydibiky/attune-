/* ---- v9.8 N1 The Haggler's screen (Ali: "do N1 … best way possible … without any mistakes"): your limits, the best price so far,
   every seller as one row (what they asked, their lowest, where it stands, what was said), Send for a message waiting, Book the viewing
   when one is inside your limit, Add a seller by pasting the ad. The logic is haggle.js (tested); sending is Messages' own path.
   Opened from Agents (an agent of kind "haggle"). */
import React, { useState } from "react";
import { ArrowLeft, Send, Plus, Check, X, AlertTriangle } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import * as H from "./haggle.js";
import * as U from "./ui-kit.jsx";

const T = (k, v) => tr(k, v);
const f = (v) => (v ? Math.round(v).toLocaleString("en-US") : "—");
const MUST = { "no-accident": "No accidents", service: "Agency service", papers: "Papers in order", "low-km": "Low km", warranty: "Warranty" };
const STATE = { new: "Not contacted yet", ask: "Asked", offer: "Offer sent", final: "Our last number sent", good: "Inside your limit — your turn", walk: "Stopped", scam: "Scam signs — stopped", dealer: "A dealer (many ads) — skipped", wait: "Waiting for a reply" };
const tone = (st) => (st === "good" ? "c-pos" : st === "scam" || st === "walk" || st === "dealer" ? "c-neg" : "c-sub");

export function HaggleView({ a, back, upd, send, flash }) {
  const [paste, setPaste] = useState(""), [adding, setAdding] = useState(!(a.sellers || []).length), [err, setErr] = useState("");
  const b = H.bestOf(a), target = H.targetOf(a), market = H.marketOf(a);
  const addAd = () => { const s = H.sellerFromAd(paste); if (!s.phone) { setErr(tr("I couldn't find a phone number in it — paste the ad with the seller's number")); return; }
    upd(a.id, (h) => H.addSeller(h, s)); setPaste(""); setErr(""); setAdding(false); };
  const sendOne = (s) => { if (!s.pending || !H.safeText(s.pending)) return; send(a, s); };
  const viewing = (s) => { const t = getLang() === "ar" || a.lang === "ar" ? "تمام، ممكن نحدد معاد معاينة؟ إمتى يناسبك؟" : a.lang === "franco" ? "tamam, momken n7aded ma3ad mo3ayna? emta yenaseb?" : "Great — can we set a time to see it? When suits you?";
    send(a, { ...s, pending: t }); upd(a.id, (h) => ({ ...h, sellers: h.sellers.map((x) => (x.id === s.id ? { ...x, viewing: true } : x)) })); flash && flash(tr("Asked for a viewing — you decide after you see it")); };
  const stop = (s) => upd(a.id, (h) => ({ ...h, sellers: h.sellers.map((x) => (x.id === s.id ? { ...x, stopped: true, state: "walk", pending: "" } : x)) }));
  return (
    <div className="calm pt-1 pb-10 space-y-3 max-w-2xl" data-testid="haggle-view">
      <div className="flex items-center gap-2"><button onClick={back} aria-label={tr("Back")} className="w-11 h-11 grid place-items-center rounded-full border border-[var(--c-ln)] bg-[var(--c-surf)]"><ArrowLeft size={18} className="rtl:rotate-180" /></button>
        <div className="min-w-0"><h2 className="m-0 text-[18px] font-black truncate" dir="auto">{T("Negotiating · {w}", { w: a.what })}</h2>
          <p className="m-0 text-[12px] c-sub">{tr("Attune asks, offers and stops for you — it never agrees to buy or pays.")}</p></div></div>
      <section className={U.card + " p-3.5 space-y-1.5"} data-testid="haggle-limits">
        <p className="m-0 text-[11.5px] font-extrabold tracking-[0.06em] uppercase c-sub">{tr("Your limits")}</p>
        <p className="m-0 text-[13.5px]" dir="auto">{[a.max ? T("max {a}", { a: f(a.max) }) : "", ...(a.musts || []).map((m) => tr(MUST[m] || m)), a.area].filter(Boolean).join(" · ")}</p>
        <p className="m-0 text-[12px] c-sub">{market ? T("Market {m} · aiming for {t}", { m: f(market), t: f(target) }) : tr("Add sellers — Attune works out the market price from them")}</p>
      </section>
      {b.best ? <section className={U.card + " p-3.5"} style={{ borderColor: "var(--c-pos)" }} data-testid="haggle-best">
        <p className="m-0 text-[11.5px] font-extrabold tracking-[0.06em] uppercase c-pos">{tr("Best so far")}</p>
        <b className="block text-[16px]" dir="auto">{T("Seller {n} · {p}", { n: b.best.s.n, p: f(b.best.p) })}</b>
        <span className="block text-[12px] c-sub">{b.best.s.ask && b.best.s.ask > b.best.p ? T("was {p}", { p: f(b.best.s.ask) }) + " · " : ""}{T("talking to {n}", { n: b.talking })}</span>
      </section> : null}
      <section className={U.card + " p-3.5 space-y-0.5"} data-testid="haggle-sellers">
        <div className="flex items-center gap-2"><p className="flex-1 m-0 text-[11.5px] font-extrabold tracking-[0.06em] uppercase c-sub">{T("Sellers · {n}", { n: (a.sellers || []).length })}</p>
          <button onClick={() => setAdding(!adding)} className="min-h-[36px] px-3 rounded-full border border-[var(--c-ln)] text-[12.5px] font-extrabold inline-flex items-center gap-1" data-testid="haggle-add-open"><Plus size={14} />{tr("Add a seller")}</button></div>
        {adding ? <div className="space-y-2 py-2" data-testid="haggle-add">
          <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={3} dir="auto" placeholder={tr("Paste the ad (with the seller's phone) — from Hatla2ee, Dubizzle, Facebook…")} className="w-full rounded-[12px] border border-[var(--c-ln)] bg-[var(--c-bg)] p-2.5 text-[14px]" data-testid="haggle-paste" />
          {err ? <p className="m-0 text-[12px] text-[var(--c-warn)]">{err}</p> : null}
          <button onClick={addAd} disabled={!paste.trim()} className="min-h-[40px] px-4 rounded-[12px] bg-[var(--c-btn,var(--c-acc))] text-[var(--c-on-btn,var(--c-on-acc))] font-extrabold text-[13px] disabled:opacity-40" data-testid="haggle-add-go">{tr("Add")}</button></div> : null}
        {(a.sellers || []).map((s) => { const low = s.theirs && s.theirs.length ? Math.min(...s.theirs) : s.ask;
          return <div key={s.id} className="py-2.5 border-t first:border-t-0 border-[var(--c-ln)] space-y-1.5" data-testid="haggle-seller">
            <div className="flex items-start gap-2"><span className="flex-1 min-w-0"><b className="block text-[14px]" dir="auto">{T("Seller {n}", { n: s.n })}{s.name ? " · " + s.name : ""}{s.site ? " · " + s.site : ""}</b>
              <span className={"block text-[12px] " + tone(s.state)} data-testid="haggle-state">{tr(STATE[s.state] || s.state)}</span></span>
              <span className="text-end shrink-0"><b className="block text-[14px] tabular-nums">{f(low)}</b>{s.ask && low < s.ask ? <span className="block text-[11px] c-sub line-through tabular-nums">{f(s.ask)}</span> : null}</span></div>
            {(s.flags || []).includes("scam") || (s.flags || []).includes("no-viewing") ? <p className="m-0 text-[12px] c-neg flex items-center gap-1"><AlertTriangle size={12} />{tr("Asked for money before a viewing — never pay before you see it")}</p> : null}
            {s.heard && s.heard.length ? <p className="m-0 text-[12px] c-sub truncate" dir="auto">«{s.heard[s.heard.length - 1].text}»</p> : null}
            {s.pending ? <div className="rounded-[12px] bg-[var(--c-soft)] p-2.5 space-y-1.5" data-testid="haggle-pending"><p className="m-0 text-[13px]" dir="auto">{s.pending}</p>
              <div className="flex gap-2"><button onClick={() => sendOne(s)} className="min-h-[38px] px-3.5 rounded-[10px] bg-[var(--c-btn,var(--c-acc))] text-[var(--c-on-btn,var(--c-on-acc))] text-[12.5px] font-extrabold inline-flex items-center gap-1" data-testid="haggle-send"><Send size={13} />{tr("Send")}</button>
                <button onClick={() => stop(s)} className="min-h-[38px] px-3 rounded-[10px] border border-[var(--c-ln)] text-[12.5px] font-bold" data-testid="haggle-stop">{tr("Stop with this one")}</button></div></div> : null}
            {s.state === "good" && !s.viewing ? <div className="flex gap-2"><button onClick={() => viewing(s)} className="min-h-[38px] px-3.5 rounded-[10px] bg-[var(--c-btn,var(--c-acc))] text-[var(--c-on-btn,var(--c-on-acc))] text-[12.5px] font-extrabold inline-flex items-center gap-1" data-testid="haggle-viewing"><Check size={13} />{tr("Book a viewing")}</button>
              <button onClick={() => stop(s)} className="min-h-[38px] px-3 rounded-[10px] border border-[var(--c-ln)] text-[12.5px] font-bold inline-flex items-center gap-1"><X size={13} />{tr("Not this one")}</button></div> : null}
          </div>; })}
      </section>
    </div>);
}
