/* ---- v6.32: Deal Check's contract "second opinion" — the review shown (contract.js does the reading, by code) --------------- */
import React from "react";
import { AlertTriangle, Copy, Send, ShieldCheck } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import { changeRequest } from "./contract.js";
import * as U from "./ui-kit.jsx";

const KIND = { rent: "Rent contract", job: "Job contract", sale: "Sale contract", loan: "Loan", service: "Service contract", other: "Contract" };
const LV = { 3: ["Serious", "border-[var(--c-neg)] bg-[var(--c-neg)]/10 text-[var(--c-neg)]"], 2: ["Check", "border-[var(--c-warn)] bg-[var(--c-warn)]/10 text-[var(--c-warn)]"], 1: ["Note", "border-[var(--c-ln)] bg-[var(--c-bg)] text-[var(--c-mut)]"] };

export function ContractReview({ r, flash, share }) {
  const ar = getLang() === "ar";
  const msg = changeRequest(r, ar ? "ar" : "en");
  const head = r.level === "serious" ? ["Don't sign it as it is", "border-[var(--c-neg)] bg-[var(--c-neg)]/10 text-[var(--c-neg)]"] : r.level === "check" ? ["Ask for changes first", "border-[var(--c-warn)] bg-[var(--c-warn)]/10 text-[var(--c-warn)]"] : ["No risky terms found", "border-[var(--c-pos)] bg-[var(--c-pos)]/10 text-[var(--c-pos)]"];
  return (
    <section className="space-y-3" data-testid="contract-review" data-level={r.level}>
      <div className={"rounded-[22px] border p-4 " + head[1]}>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] opacity-80 m-0">{tr(KIND[r.kind])} · {tr("second opinion")}</p>
        <p className="text-[22px] font-black tracking-tight mt-1 m-0 flex items-center gap-2">{r.level === "ok" ? <ShieldCheck size={18} /> : <AlertTriangle size={18} />}{tr(head[0])}</p>
        <p className="text-[12.5px] mt-1.5 m-0 text-[var(--c-ink)] opacity-80">{tr("Read by code on this phone. A first look, not legal advice — for a big contract, show it to a lawyer.")}</p>
      </div>
      {r.flags.map((f, i) => (
        <div key={i} className={U.cardPad + " space-y-2"} data-testid="contract-flag" data-id={f.id}>
          <span className={"inline-flex text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border " + LV[f.level][1]}>{tr(LV[f.level][0])}</span>
          {f.quote ? <p className={"text-[13px] border-s-2 border-[var(--c-ln)] ps-2.5 m-0 " + U.muted} dir="auto">{f.quote}</p> : null}
          <p className="text-[14px] font-semibold m-0" dir="auto">{ar ? f.means.ar : f.means.en}</p>
          <p className="text-[13px] font-bold text-[var(--c-acc)] m-0" dir="auto">{tr("Ask for")}: {ar ? f.ask.ar : f.ask.en}</p>
        </div>))}
      {r.missing.length ? (
        <div className={U.cardPad} data-testid="contract-missing">
          <p className={U.label + " m-0"}>{tr("It doesn't say")}</p>
          <ul className="mt-2 space-y-1">{r.missing.map((m, i) => <li key={i} className="text-[13.5px]" dir="auto">• {ar ? m.ar : m.en}</li>)}</ul>
        </div>) : null}
      {r.flags.length || r.missing.length ? (
        <div className={U.cardPad.replace("border-[var(--c-ln)]", "border-[var(--c-acc)]/50")} data-testid="contract-message">
          <p className={U.label + " m-0"}>{tr("Your reply")}</p>
          <p className="text-[13.5px] whitespace-pre-wrap mt-2 m-0" dir="auto">{msg}</p>
          <div className="flex gap-2 mt-3">
            <button onClick={() => { try { navigator.clipboard.writeText(msg); } catch (e) {} flash && flash(tr("Copied")); }} className={U.btnS}><Copy size={14} />{tr("Copy")}</button>
            <button onClick={() => share && share(msg)} className={U.btnP}><Send size={14} />{tr("Send on WhatsApp")}</button>
          </div>
        </div>) : null}
    </section>);
}
