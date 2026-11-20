/* ---- v10.7 the Writing page (Ali OK'd OK-WR: WR2 + WR3 — "for which AI like ChatGPT or Gemini … not which model should write on this
   phone, because it should be done for users in the best way possible no matter what"; docs/mockups/motion-writing-fold-combined.html).
   Every old prompt tool, back on one page with today's look: a tab per tool — Improve (a prompt for any AI) · Shorten (10–90 %, Trim
   offline or AI, the chat history so what is known is dropped) · Humanize (a tone, and a sample of your own writing) · Copilot (the other
   AI's last answer → your best next prompt) · Recipes (the Prompt lab: ready prompts that work offline) — and "For": which AI the text is
   for. Attune's own engine writes it (the best one there is — nothing to choose). Each run adds a VERSION under the last (v2, v3 …): its
   tool, its AI, its word count; copy it, keep going from it, or send it on to another tool. The engine functions are attune.jsx's own
   (aiRewrite, aiCompressTarget, compressPrompt, aiHumanize, copilotOptimize — the same tuned instructions the old pages used).
   Tests: tests/unit/v1070writing.test.mjs, tests/e2e_v1070.py. */
import React, { useEffect, useMemo, useState } from "react";
import { Wand2, Scissors, PenLine, MessageSquare, BookOpen, Copy, Check, Undo2, Trash2 } from "lucide-react";
import { tr } from "./i18n.js";
import * as U from "./ui-kit.jsx";

export const WRITING_KEY = "attune:writing:v1";
export const TABS = [["improve", "Improve", Wand2], ["shorten", "Shorten", Scissors], ["humanize", "Humanize", PenLine], ["copilot", "Copilot", MessageSquare], ["recipes", "Recipes", BookOpen]];
/** The AIs shown first (the rest are under "More…"). */
export const MAIN_AIS = ["claude", "chatgpt", "gemini", "grok", "deepseek", "qwen", "mistral", "kimi", "copilot", "perplexity"];
export const TONES = [["natural", "Natural"], ["warmer", "Warmer"], ["firmer", "Firmer"], ["formal", "More formal"], ["casual", "Casual"]];
export const words = (t) => (String(t || "").trim().match(/\S+/g) || []).length;
const load = () => { try { const v = JSON.parse(localStorage.getItem(WRITING_KEY) || "null"); return v && Array.isArray(v.versions) ? v : { text: "", versions: [], tab: "improve", target: "chatgpt" }; } catch (e) { return { text: "", versions: [], tab: "improve", target: "chatgpt" }; } };
const save = (v) => { try { localStorage.setItem(WRITING_KEY, JSON.stringify({ ...v, versions: v.versions.slice(-20) })); } catch (e) {} };
/** A new version after the last one. */
export function addVersion(st, { text, tool, target = "", pct = 0, from = 0, now = Date.now() }) {
  const n = (st.versions.length ? Math.max(...st.versions.map((v) => v.n)) : 1) + 1;
  return { ...st, versions: [...st.versions, { n, text: String(text || "").trim(), tool, target, pct, from, words: words(text), at: now }] };
}

export function WritingStudio({ engine = {}, targets = [], flash }) {
  const [st, setSt] = useState(load);
  const [busy, setBusy] = useState(""), [err, setErr] = useState(""), [copied, setCopied] = useState(0);
  const [pct, setPct] = useState(50), [history, setHistory] = useState(""), [tone, setTone] = useState("natural"), [sample, setSample] = useState(""), [other, setOther] = useState(""), [cat, setCat] = useState("writing");
  const put = (v) => { setSt(v); save(v); };
  const { tab, target, text } = st;
  const label = (k) => (targets.find(([x]) => x === k) || [k, k])[1];
  const more = targets.filter(([k]) => !MAIN_AIS.includes(k));
  const recipes = engine.recipes || [], cats = useMemo(() => [...new Set(recipes.map((r) => r.cat))], [recipes]);
  const toolName = { improve: "Improved", shorten: "Shortened", trim: "Trimmed", humanize: "Humanized", copilot: "Next prompt" };
  const run = async (kind, from = 0, input = text) => {
    const t = String(input || "").trim(); if (!t && kind !== "copilot") return;
    setErr(""); setBusy(kind);
    try {
      let out = "";
      if (kind === "improve") out = await engine.improve(t, target);
      else if (kind === "shorten") out = await engine.shorten(t, pct, history);
      else if (kind === "trim") { const r = engine.trim(t, history); out = r && r.text ? r.text : ""; }
      else if (kind === "humanize") out = await engine.humanize(t, sample, tone);
      else if (kind === "copilot") out = await engine.copilot(other, t, target);
      if (!String(out || "").trim()) throw new Error("empty");
      put(addVersion({ ...st, text: from ? st.text : t }, { text: out, tool: kind, target: kind === "improve" || kind === "copilot" ? target : "", pct: kind === "shorten" ? pct : 0, from }));
    } catch (e) { setErr(String((e && e.message) || "") === "empty" ? tr("Nothing came back — try again.") : tr("Couldn't write it now: {e}", { e: String((e && e.message) || e).slice(0, 120) })); }
    setBusy("");
  };
  const copy = async (v) => { try { await navigator.clipboard.writeText(v.text); } catch (e) { try { const a = document.createElement("textarea"); a.value = v.text; document.body.appendChild(a); a.select(); document.execCommand("copy"); a.remove(); } catch (x) {} } setCopied(v.n); setTimeout(() => setCopied(0), 1400); flash && flash(tr("Copied")); };
  const chip = (on) => "min-h-[36px] px-3 rounded-full text-[12.5px] font-extrabold border " + (on ? "border-[var(--c-acc)] bg-[var(--c-soft)] text-[var(--c-acc)]" : "border-[var(--c-ln)] bg-[var(--c-surf)] text-[var(--c-ink)]");
  const goBtn = "min-h-[44px] px-5 rounded-full text-[14px] font-extrabold disabled:opacity-45";
  const goStyle = { background: "var(--c-acc)", color: "var(--c-on-acc, #fff)" };
  const forRow = <div className="flex flex-wrap items-center gap-1.5" data-testid="writing-for"><span className={"text-[12px] font-extrabold uppercase tracking-[0.06em] me-1 " + U.muted}>{tr("For")}</span>
    {MAIN_AIS.filter((k) => targets.some(([x]) => x === k)).map((k) => <button key={k} onClick={() => put({ ...st, target: k })} className={chip(target === k)} data-testid={"writing-for-" + k}>{label(k)}</button>)}
    {more.length ? <select value={more.some(([k]) => k === target) ? target : ""} onChange={(e) => e.target.value && put({ ...st, target: e.target.value })} className={chip(more.some(([k]) => k === target)) + " pe-2"} aria-label={tr("More…")} data-testid="writing-for-more">
      <option value="">{tr("More…")}</option>{more.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select> : null}</div>;
  const box = <textarea value={text} onChange={(e) => put({ ...st, text: e.target.value })} dir="auto" rows={7} placeholder={tab === "copilot" ? tr("What do you want to do next with that AI?") : tr("Your text — a prompt, an email, a message, a paragraph…")}
    className={U.area + " min-h-[150px]"} data-testid="writing-text" />;
  const versions = [...st.versions].reverse();
  return (
    <div className="calm space-y-4" data-testid="writing-page">
      <div className="flex items-end gap-3 flex-wrap"><div className="flex-1 min-w-0"><h2 className={U.pageH1}>{tr("Writing")}</h2>
        <p className={"m-0 mt-0.5 text-[13px] " + U.muted}>{tr("Improve a prompt for any AI, shorten it, make it sound like you — each run keeps a version.")}</p></div>
        {st.versions.length ? <button onClick={() => put({ ...st, versions: [] })} className={"min-h-[40px] text-[12.5px] font-bold underline " + U.muted} data-testid="writing-clear">{tr("Clear the versions")}</button> : null}</div>
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-[var(--c-ln)] -mx-1 px-1" data-testid="writing-tabs">
        {TABS.map(([k, l, I]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => put({ ...st, tab: k })} data-testid={"writing-tab-" + k}
          className={"shrink-0 min-h-[44px] px-3 flex items-center gap-1.5 text-[13.5px] font-extrabold border-b-2 " + (tab === k ? "border-[var(--c-acc)] text-[var(--c-acc)]" : "border-transparent " + U.muted)}><I size={15} />{tr(l)}</button>)}
      </div>
      <div className="grid gap-4 items-start writing-cols">
        <div className="space-y-3 min-w-0">
          {tab === "recipes" ? <div className="space-y-3" data-testid="writing-recipes">
            <p className={"m-0 text-[13px] " + U.muted}>{tr("Ready prompts — pick one, fill the [blanks], then Improve it for your AI. They work offline.")}</p>
            <div className="flex flex-wrap gap-1.5">{cats.map((c) => <button key={c} onClick={() => setCat(c)} className={chip(cat === c)} data-testid={"writing-cat-" + c}>{tr(c.charAt(0).toUpperCase() + c.slice(1))}</button>)}</div>
            <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 240px), 1fr))" }}>
              {recipes.filter((r) => r.cat === cat).map((r) => <div key={r.id} className={U.card + " p-3.5 space-y-1.5 flex flex-col"} data-testid="writing-recipe">
                <b className="text-[14px]" dir="auto">{tr(r.title)}</b><span className={"text-[12.5px] " + U.muted} dir="auto">{tr(r.tip)}</span>
                <pre className="m-0 text-[12px] whitespace-pre-wrap line-clamp-3 flex-1 font-sans" dir="auto">{r.template}</pre>
                <button onClick={() => put({ ...st, text: r.template, tab: "improve", target: targets.some(([k]) => k === r.tool) ? r.tool : st.target })} className={goBtn + " self-start min-h-[40px]!"} style={goStyle} data-testid="writing-recipe-use">{tr("Use recipe")}</button></div>)}
            </div></div>
          : <>
            {tab === "copilot" ? <><textarea value={other} onChange={(e) => setOther(e.target.value)} dir="auto" rows={5} placeholder={tr("Paste that AI's last answer (or the whole chat)…")} className={U.area + " min-h-[110px]"} data-testid="writing-copilot-answer" /></> : null}
            {box}
            {tab === "improve" || tab === "copilot" ? forRow : null}
            {tab === "shorten" ? <div className="space-y-2" data-testid="writing-shorten">
              <div className="flex items-center gap-3"><span className={"text-[12px] font-extrabold uppercase tracking-[0.06em] " + U.muted}>{tr("Shorten to")}</span><b className="text-[var(--c-acc)] tabular-nums" data-testid="writing-pct">{tr("{n}% of it", { n: pct })}</b></div>
              <input type="range" min="10" max="90" step="5" value={pct} onChange={(e) => setPct(+e.target.value)} className="w-full accent-[var(--c-acc)]" aria-label={tr("Shorten to")} data-testid="writing-slider" />
              <div className={"flex justify-between text-[11.5px] " + U.muted}><span>{tr("10% · brutal")}</span><span>{tr("50% · half")}</span><span>{tr("90% · light")}</span></div>
              <textarea value={history} onChange={(e) => setHistory(e.target.value)} dir="auto" rows={3} placeholder={tr("The chat so far (optional) — what's already known gets dropped.")} className={U.area + " min-h-[70px] text-[13px]"} data-testid="writing-history" /></div> : null}
            {tab === "humanize" ? <div className="space-y-2" data-testid="writing-humanize">
              <div className="flex flex-wrap gap-1.5">{TONES.map(([k, l]) => <button key={k} onClick={() => setTone(k)} className={chip(tone === k)} data-testid={"writing-tone-" + k}>{tr(l)}</button>)}</div>
              <textarea value={sample} onChange={(e) => setSample(e.target.value)} dir="auto" rows={3} placeholder={tr("A sample of your own writing (optional) — it will sound like you.")} className={U.area + " min-h-[70px] text-[13px]"} data-testid="writing-sample" /></div> : null}
            <div className="flex flex-wrap gap-2">
              {tab === "improve" ? <button disabled={!!busy || !text.trim()} onClick={() => run("improve")} className={goBtn} style={goStyle} data-testid="writing-go">{busy ? tr("Writing…") : tr("Improve for {a}", { a: label(target) })}</button> : null}
              {tab === "shorten" ? <><button disabled={!!busy || !text.trim()} onClick={() => run("shorten")} className={goBtn} style={goStyle} data-testid="writing-go">{busy === "shorten" ? tr("Writing…") : tr("Shorten to {n}%", { n: pct })}</button>
                <button disabled={!!busy || !text.trim()} onClick={() => run("trim")} className={goBtn + " border border-[var(--c-acc)] text-[var(--c-acc)]"} data-testid="writing-trim">{tr("Trim (offline)")}</button></> : null}
              {tab === "humanize" ? <button disabled={!!busy || !text.trim()} onClick={() => run("humanize")} className={goBtn} style={goStyle} data-testid="writing-go">{busy ? tr("Writing…") : tr("Humanize")}</button> : null}
              {tab === "copilot" ? <button disabled={!!busy || !(text.trim() || other.trim())} onClick={() => run("copilot")} className={goBtn} style={goStyle} data-testid="writing-go">{busy ? tr("Writing…") : tr("Write my next prompt for {a}", { a: label(target) })}</button> : null}
            </div>
            {err ? <p className="m-0 text-[13px] font-bold text-[var(--c-neg)]" data-testid="writing-error" dir="auto">{err}</p> : null}
          </>}
        </div>
        {/* the versions: newest on top; beside the text on a wide screen */}
        {versions.length ? <div className="space-y-2 min-w-0" data-testid="writing-versions">
          <div className={"text-[12px] font-extrabold uppercase tracking-[0.06em] " + U.muted}>{tr("Versions")}</div>
          {versions.map((v) => <div key={v.n} className={U.card + " p-3.5 space-y-2"} data-testid="writing-version" data-n={v.n} data-anim-card="">
            <div className="flex items-center gap-2 flex-wrap"><b className="text-[var(--c-acc)] text-[13.5px]">v{v.n}</b>
              <span className="text-[12.5px] font-bold" dir="auto">{tr(toolName[v.tool] || v.tool)}{v.target ? " · " + tr("for {a}", { a: label(v.target) }) : ""}{v.pct ? " · " + v.pct + "%" : ""}</span>
              <span className={"text-[12px] tabular-nums ms-auto " + U.muted}>{tr("{n} words", { n: v.words })}</span></div>
            <p className="m-0 text-[13.5px] whitespace-pre-wrap leading-relaxed select-text max-h-[240px] overflow-y-auto" dir="auto" data-testid="writing-version-text">{v.text}</p>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => copy(v)} className={chip(true) + " flex items-center gap-1"} data-testid="writing-copy">{copied === v.n ? <Check size={14} /> : <Copy size={14} />}{copied === v.n ? tr("Copied") : tr("Copy")}</button>
              <button onClick={() => put({ ...st, text: v.text })} className={chip(false) + " flex items-center gap-1"} data-testid="writing-keep"><Undo2 size={14} />{tr("Keep going from v{n}", { n: v.n })}</button>
              {["shorten", "humanize", "improve"].filter((k) => k !== v.tool).map((k) => <button key={k} disabled={!!busy} onClick={() => run(k, v.n, v.text)} className={chip(false)} data-testid={"writing-then-" + k}>→ {tr(TABS.find((x) => x[0] === k)[1])}</button>)}
              <button onClick={() => put({ ...st, versions: st.versions.filter((x) => x.n !== v.n) })} aria-label={tr("Delete")} className={chip(false) + " grid place-items-center w-9 px-0!"} data-testid="writing-delete"><Trash2 size={14} /></button>
            </div></div>)}
        </div> : null}
      </div>
    </div>);
}
