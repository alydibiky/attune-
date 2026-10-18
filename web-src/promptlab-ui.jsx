/* ---- v6.40 (upgrade W5) — Prompt lab, on top of Tools → Library: prompt A and prompt B on the same test text, run one after the
   other on the phone's model, side by side; "Keep A" / "Keep B" saves the winner to My prompts (promptlab.js). */
import React, { useState } from "react";
import { FlaskConical, Loader2, Check } from "lucide-react";
import { tr } from "./i18n.js";
import * as PL from "./promptlab.js";

export function PromptLab({ run, ready, openEngine, onUse, flash }) {
  const [open, setOpen] = useState(false);
  const [a, setA] = useState(""), [b, setB] = useState(""), [input, setInput] = useState("");
  const [res, setRes] = useState(null), [busy, setBusy] = useState("");
  const [mine, setMine] = useState(() => PL.loadMine());
  const go = async () => {
    if (!ready) { openEngine && openEngine(); return; }
    if (!a.trim() || !b.trim()) return flash && flash(tr("Write both versions first"));
    const out = {};
    for (const [k, p] of [["a", a], ["b", b]]) {
      setBusy(k === "a" ? tr("Running A…") : tr("Running B…"));
      const t0 = Date.now();
      try { out[k] = { text: String((await run(PL.fill(p, input))) || ""), ms: Date.now() - t0 }; } catch (e) { out[k] = { text: tr("Failed: {e}", { e: String((e && e.message) || e) }), ms: Date.now() - t0 }; }
      setRes({ ...out });
    }
    setBusy("");
  };
  const c = res && res.a && res.b ? PL.compare(res.a, res.b) : null;
  const box = "w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-[13px] text-slate-100 focus:outline-none focus:border-teal-500";
  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 mb-4 space-y-3" data-testid="promptlab">
      <button onClick={() => setOpen((x) => !x)} className="w-full text-start" data-testid="promptlab-open">
        <b className="text-sm text-slate-100 flex items-center gap-2"><FlaskConical size={16} className="text-teal-300" />{tr("Prompt lab")}</b>
        <span className="text-[12px] text-slate-500">{tr("Try two versions of a prompt on the same text and keep the better one.")}</span></button>
      {open ? <>
        <div className="grid sm:grid-cols-2 gap-2">
          <textarea value={a} onChange={(e) => setA(e.target.value)} rows={4} dir="auto" placeholder={tr("Prompt A — use {input} where the text goes")} className={box} data-testid="promptlab-a" />
          <textarea value={b} onChange={(e) => setB(e.target.value)} rows={4} dir="auto" placeholder={tr("Prompt B")} className={box} data-testid="promptlab-b" />
        </div>
        <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={2} dir="auto" placeholder={tr("Test text (optional)")} className={box} data-testid="promptlab-input" />
        <button onClick={go} disabled={!!busy} className="w-full py-2 rounded-lg bg-teal-500 text-slate-950 text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2" data-testid="promptlab-run">
          {busy ? <Loader2 size={15} className="animate-spin" /> : null}{busy || tr("Run both")}</button>
        {res ? <div className="grid sm:grid-cols-2 gap-2">{["a", "b"].map((k) => res[k] ? (
          <div key={k} className="rounded-xl border border-slate-800 p-2.5 space-y-1.5" data-testid={"promptlab-res-" + k}>
            <p className="text-[11px] text-slate-500 m-0">{k.toUpperCase()} · {(res[k].ms / 1000).toFixed(1)} s · {tr("{n} words", { n: c ? c[k].words : "…" })}{c && c.faster === k ? " · " + tr("faster") : ""}</p>
            <p className="text-[13px] text-slate-200 whitespace-pre-wrap m-0 max-h-60 overflow-auto" dir="auto">{res[k].text}</p>
            <button onClick={() => { setMine(PL.keep(k === "a" ? a : b, "")); flash && flash(tr("Kept in My prompts")); }} className="text-[12px] px-2.5 py-1 rounded-lg border border-teal-700 text-teal-200 flex items-center gap-1" data-testid={"promptlab-keep-" + k}><Check size={12} />{tr("Keep {k}", { k: k.toUpperCase() })}</button>
          </div>) : null)}</div> : null}
      </> : null}
      {mine.length ? <div className="space-y-1" data-testid="promptlab-mine"><p className="text-[11px] uppercase tracking-wider text-slate-500 m-0">{tr("My prompts")}</p>
        {mine.slice(0, 8).map((m) => <button key={m.id} onClick={() => onUse && onUse(m)} className="block w-full text-start text-[13px] text-slate-200 truncate hover:underline" dir="auto" data-testid="promptlab-mine-item">• {m.title}</button>)}</div> : null}
    </div>);
}
