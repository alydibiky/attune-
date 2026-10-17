/* ---- v6.32: Deal Check's contract "second opinion" — the review shown (contract.js does the reading, by code) --------------- */
import React from "react";
import { AlertTriangle, Copy, Send, ShieldCheck } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import { changeRequest } from "./contract.js";

const KIND = { rent: "Rent contract", job: "Job contract", sale: "Sale contract", loan: "Loan", service: "Service contract", other: "Contract" };
const LV = { 3: ["Serious", "border-rose-700 bg-rose-500/10 text-rose-200"], 2: ["Check", "border-amber-700 bg-amber-500/10 text-amber-200"], 1: ["Note", "border-slate-700 bg-slate-800/40 text-slate-300"] };

export function ContractReview({ r, flash, share }) {
  const ar = getLang() === "ar";
  const msg = changeRequest(r, ar ? "ar" : "en");
  const head = r.level === "serious" ? ["Don't sign it as it is", "border-rose-700 bg-rose-500/10 text-rose-200"] : r.level === "check" ? ["Ask for changes first", "border-amber-700 bg-amber-500/10 text-amber-200"] : ["No risky terms found", "border-emerald-700 bg-emerald-500/10 text-emerald-200"];
  return (
    <section className="space-y-3" data-testid="contract-review" data-level={r.level}>
      <div className={"rounded-2xl border p-4 " + head[1]}>
        <p className="text-[11px] uppercase tracking-wider opacity-80">{tr(KIND[r.kind])} · {tr("second opinion")}</p>
        <p className="text-xl font-bold mt-1 flex items-center gap-2">{r.level === "ok" ? <ShieldCheck size={18} /> : <AlertTriangle size={18} />}{tr(head[0])}</p>
        <p className="text-[12px] mt-1.5 opacity-80">{tr("Read by code on this phone. A first look, not legal advice — for a big contract, show it to a lawyer.")}</p>
      </div>
      {r.flags.map((f, i) => (
        <div key={i} className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-2" data-testid="contract-flag" data-id={f.id}>
          <span className={"text-[11px] px-2 py-0.5 rounded-md border " + LV[f.level][1]}>{tr(LV[f.level][0])}</span>
          {f.quote ? <p className="text-[13px] text-slate-300 border-s-2 border-slate-600 ps-2" dir="auto">{f.quote}</p> : null}
          <p className="text-[14px] text-slate-100" dir="auto">{ar ? f.means.ar : f.means.en}</p>
          <p className="text-[13px] text-emerald-300" dir="auto">{tr("Ask for")}: {ar ? f.ask.ar : f.ask.en}</p>
        </div>))}
      {r.missing.length ? (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4" data-testid="contract-missing">
          <p className="text-[11px] uppercase tracking-wider text-slate-500">{tr("It doesn't say")}</p>
          <ul className="mt-2 space-y-1">{r.missing.map((m, i) => <li key={i} className="text-[13.5px] text-slate-200" dir="auto">• {ar ? m.ar : m.en}</li>)}</ul>
        </div>) : null}
      {r.flags.length || r.missing.length ? (
        <div className="bg-slate-900 rounded-2xl border border-emerald-900/60 p-4" data-testid="contract-message">
          <p className="text-[11px] uppercase tracking-wider text-slate-500">{tr("Your reply")}</p>
          <p className="text-[13.5px] text-slate-100 whitespace-pre-wrap mt-2" dir="auto">{msg}</p>
          <div className="flex gap-2 mt-3">
            <button onClick={() => { try { navigator.clipboard.writeText(msg); } catch (e) {} flash && flash(tr("Copied")); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 text-slate-200 text-[13px]"><Copy size={14} />{tr("Copy")}</button>
            <button onClick={() => share && share(msg)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500 text-slate-950 text-[13px] font-semibold"><Send size={14} />{tr("Send on WhatsApp")}</button>
          </div>
        </div>) : null}
    </section>);
}
