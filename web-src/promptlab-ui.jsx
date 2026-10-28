/* ---- v6.40 (upgrade W5) — Prompt lab, on top of Tools → Library: prompt A and prompt B on the same test text, run one after the
   other on the phone's model, side by side; "Keep A" / "Keep B" saves the winner to My prompts (promptlab.js). */
import React, { useState } from "react";
import { FlaskConical, Loader2, Check } from "lucide-react";
import { tr } from "./i18n.js";
import * as PL from "./promptlab.js";
import { cardPad, btnP, area, label } from "./ui-kit.jsx";

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
  const box = area + " !text-[14px] !font-medium";
  return (
    <div className={"calm " + cardPad + " mb-4 space-y-3"} data-testid="promptlab">
      <button onClick={() => setOpen((x) => !x)} className="w-full text-start min-h-[44px]" data-testid="promptlab-open">
        <b className="text-[15px] font-extrabold text-[var(--c-ink)] flex items-center gap-2"><FlaskConical size={16} className="text-[var(--c-acc)]" />{tr("Prompt lab")}</b>
        <span className="text-[12px] text-[var(--c-mut)]">{tr("Try two versions of a prompt on the same text and keep the better one.")}</span></button>
      {open ? <>
        <div className="grid sm:grid-cols-2 gap-2">
          <textarea value={a} onChange={(e) => setA(e.target.value)} rows={4} dir="auto" placeholder={tr("Prompt A — use {input} where the text goes")} className={box} data-testid="promptlab-a" />
          <textarea value={b} onChange={(e) => setB(e.target.value)} rows={4} dir="auto" placeholder={tr("Prompt B")} className={box} data-testid="promptlab-b" />
        </div>
        <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={2} dir="auto" placeholder={tr("Test text (optional)")} className={box} data-testid="promptlab-input" />
        <button onClick={go} disabled={!!busy} className={btnP + " w-full"} data-testid="promptlab-run">
          {busy ? <Loader2 size={15} className="animate-spin" /> : null}{busy || tr("Run both")}</button>
        {res ? <div className="grid sm:grid-cols-2 gap-2">{["a", "b"].map((k) => res[k] ? (
          <div key={k} className="rounded-[20px] border border-[var(--c-ln)] bg-[var(--c-bg)] p-3 space-y-1.5" data-testid={"promptlab-res-" + k}>
            <p className="text-[11px] font-bold tabular-nums text-[var(--c-mut)] m-0">{k.toUpperCase()} · {(res[k].ms / 1000).toFixed(1)} s · {tr("{n} words", { n: c ? c[k].words : "…" })}{c && c.faster === k ? " · " + tr("faster") : ""}</p>
            <p className="text-[13px] text-[var(--c-ink)] whitespace-pre-wrap m-0 max-h-60 overflow-auto" dir="auto">{res[k].text}</p>
            <button onClick={() => { setMine(PL.keep(k === "a" ? a : b, "")); flash && flash(tr("Kept in My prompts")); }} className="min-h-[44px] text-[13px] font-bold px-3 rounded-[12px] border border-[var(--c-acc)]/40 text-[var(--c-acc)] flex items-center gap-1" data-testid={"promptlab-keep-" + k}><Check size={12} />{tr("Keep {k}", { k: k.toUpperCase() })}</button>
          </div>) : null)}</div> : null}
      </> : null}
      {mine.length ? <div className="space-y-1" data-testid="promptlab-mine"><p className={label + " m-0"}>{tr("My prompts")}</p>
        {mine.slice(0, 8).map((m) => <button key={m.id} onClick={() => onUse && onUse(m)} className="block w-full text-start min-h-[44px] text-[13.5px] font-semibold text-[var(--c-ink)] truncate hover:underline" dir="auto" data-testid="promptlab-mine-item">• {m.title}</button>)}</div> : null}
    </div>);
}
