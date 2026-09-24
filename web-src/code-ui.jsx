/* ---- Code: the workbench screen, and the ▶ Run button under code in Chat ------------
   See code.js for the loop and sandbox.js for where code runs.                        */
import React, { useState, useEffect, useRef } from "react";
import { Code2, Play, Wrench, Terminal, Loader2, Copy, Save, Share2, Square, CheckCircle2, AlertTriangle, Eye, Trash2, Plus } from "lucide-react";
import { tr } from "./i18n.js";
import { runCode, runHtml, htmlDoc, warmUp, pythonAvailable, stop as stopSandbox, LANGS, normLang } from "./sandbox.js";
import { workLoop, guessLang, countTests, judge, errorSummary, loadProjects, saveProjects, PASS_MARK } from "./code.js";

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const runAny = (lang, code) => (lang === "html" ? runHtml(code) : runCode({ lang, code }));

/** Output of one run, as the person sees it. */
function RunOutput({ res, lang, code }) {
  if (!res) return null;
  const v = judge(res, code, lang);
  const lines = [res.stdout, res.stderr].filter(Boolean).join("\n").trim();
  return (
    <div className="mt-2 rounded-xl border border-slate-800 bg-black/40 p-2.5" data-testid="code-output" dir="ltr">
      <div className={`text-[11px] mb-1 flex items-center gap-1.5 ${v.passed ? "text-emerald-300" : "text-rose-300"}`}>
        {v.passed ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
        {v.passed ? (v.tests ? tr("Passed its {n} tests", { n: v.tests }) : tr("Ran without errors (no tests)")) : res.timedOut ? tr("Stopped — took too long") : tr("Failed")}
        <span className="text-slate-500">· {res.ms != null ? (res.ms < 1000 ? res.ms + " ms" : (res.ms / 1000).toFixed(1) + " s") : ""}</span>
      </div>
      {lines ? <pre className="att-scroll text-[12px] font-mono text-slate-200 whitespace-pre-wrap max-h-48 overflow-auto">{lines}</pre> : null}
      {!v.passed && res.error ? <pre className="att-scroll text-[12px] font-mono text-rose-200 whitespace-pre-wrap max-h-40 overflow-auto mt-1">{errorSummary(res, 12)}</pre> : null}
    </div>
  );
}

/** A live, locked preview of a web page (scripts run; no internet; no access to the app). */
function HtmlPreview({ code, onReport }) {
  const [token] = useState(() => "p" + Math.random().toString(36).slice(2));
  const ref = useRef(null);
  useEffect(() => {
    const errs = [];
    const on = (e) => { const d = e.data; if (!d || d.attuneSandbox !== token) return; if (d.kind === "error") { errs.push(d.text); onReport && onReport(errs.slice()); } };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [token, code]);
  return <iframe ref={ref} title="preview" sandbox="allow-scripts" srcDoc={htmlDoc(code, token)} data-testid="code-preview"
    className="w-full h-[60vh] rounded-xl border border-slate-700 bg-white mt-2" />;
}

/** ▶ Run under a code block in Chat. */
export function RunBlock({ lang, code }) {
  const L = normLang(lang);
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  if (!L) return null;
  const go = async () => {
    if (L === "html") { setPreview((p) => !p); return; }
    setBusy(true); setRes(null);
    try { setRes(await runCode({ lang: L, code })); } finally { setBusy(false); }
  };
  const open = () => window.dispatchEvent(new CustomEvent("attune-code", { detail: { lang: L, code, result: res } }));
  return (
    <div className="mt-1" data-testid="run-block">
      <div className="flex gap-1.5">
        <button onClick={go} disabled={busy} data-testid="run-code" className="text-[11px] px-2.5 py-1 rounded-md bg-teal-500/15 border border-teal-800 text-teal-200 flex items-center gap-1">
          {busy ? <Loader2 size={11} className="animate-spin" /> : L === "html" ? <Eye size={11} /> : <Play size={11} />}
          {busy ? (L === "python" ? tr("Starting Python…") : tr("Running…")) : L === "html" ? (preview ? tr("Hide preview") : tr("Preview")) : tr("Run on this phone")}
        </button>
        <button onClick={open} data-testid="open-in-code" className="text-[11px] px-2.5 py-1 rounded-md border border-slate-700 text-slate-300 flex items-center gap-1"><Wrench size={11} />{tr("Test & fix in Code")}</button>
      </div>
      {L === "html" && preview ? <HtmlPreview code={code} /> : null}
      <RunOutput res={res} lang={L} code={code} />
    </div>
  );
}

const STEP_TEXT = {
  write: "Writing the program and its tests…", run: "Running it on this phone…", fix: "Sending the error back — fixing…",
};

/** The Code workbench (More → Code). */
export function CodeWorkbench({ llm, flash, native, share, saveFile, engineReady, openEngine, incoming, clearIncoming, abortModel }) {
  const [projects, setProjects] = useState(loadProjects);
  const [cur, setCur] = useState(() => loadProjects()[0] || null);
  const [task, setTask] = useState("");
  const [langPick, setLangPick] = useState("auto");
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState([]);
  const [live, setLive] = useState("");
  const [res, setRes] = useState(null);
  const [change, setChange] = useState("");
  const [py, setPy] = useState({ state: "checking" });
  const [pageErrors, setPageErrors] = useState([]);
  const stopRef = useRef(false);

  // Python takes a few seconds to start the first time: start it now.
  useEffect(() => {
    let on = true;
    pythonAvailable().then((ok) => {
      if (!on) return;
      if (!ok) { setPy({ state: "missing" }); return; }
      setPy({ state: "starting" });
      warmUp("python").then((r) => on && setPy(r.ok ? { state: "ready", version: r.version, ms: r.ms } : { state: "error", error: r.error }));
    });
    return () => { on = false; };
  }, []);

  // Code sent over from Chat (“Test & fix in Code”).
  useEffect(() => {
    if (!incoming) return;
    const p = { id: newId(), title: tr("From chat"), task: incoming.task || "", lang: incoming.lang, code: incoming.code, at: Date.now(), status: "draft" };
    keep(p); setRes(incoming.result || null); setSteps([]);
    clearIncoming && clearIncoming();
  }, [incoming]);

  const keep = (p) => {
    setCur(p);
    setProjects((list) => { const next = [p, ...list.filter((x) => x.id !== p.id)]; saveProjects(next); return next; });
  };

  const onEvent = (e) => {
    if (e.type === "writing" || e.type === "fixing") { setLive(e.text || ""); return; }
    setLive("");
    setSteps((s) => {
      const n = s.slice();
      const say = (text, kind = "info") => n.push({ text, kind, round: e.round });
      if (e.type === "write") say(tr(STEP_TEXT.write));
      else if (e.type === "wrote") say(e.tests ? tr("Wrote it, with {n} tests.", { n: e.tests }) : tr("Wrote it (no tests)."));
      else if (e.type === "run") say(tr(STEP_TEXT.run));
      else if (e.type === "result") say(e.verdict.passed ? (e.verdict.tests ? tr("✓ Passed all {n} tests.", { n: e.verdict.tests }) : tr("✓ Ran without errors.")) : "✗ " + (String(e.res.error || e.res.stderr || "").trim().split("\n").filter(Boolean).pop() || (e.verdict.reason === "no-pass-mark" ? tr("The tests did not all run.") : tr("Failed"))), e.verdict.passed ? "ok" : "bad");
      else if (e.type === "fix") say(e.change ? tr("Making the change…") : tr("Round {r}: {t}", { r: e.round, t: tr(STEP_TEXT.fix) }));
      else if (e.type === "fixed") say(e.how === "edits" ? tr("Changed {n} place(s) in the code.", { n: e.edits }) : tr("Rewrote the program."));
      else if (e.type === "fixfail") say(tr(e.error), "bad");
      return n;
    });
    if (e.code) setCur((c) => (c ? { ...c, code: e.code, lang: e.lang || c.lang } : c));
    if (e.type === "result") setRes(e.res);
  };

  const llmOr = async (messages, o) => {
    if (stopRef.current) throw new Error("Stopped");
    return llm(messages, o);
  };

  const run = async ({ fresh, changeText } = {}) => {
    if (!engineReady) { flash(tr("Load a model in Engine first — everything runs on this device")); openEngine && openEngine(); return; }
    const t = fresh ? task.trim() : (cur && cur.task) || "";
    if (fresh && !t) return;
    const lang = fresh ? (langPick === "auto" ? guessLang(t) : langPick) : cur.lang;
    const base = fresh ? { id: newId(), title: t.slice(0, 60), task: t, lang, code: "", at: Date.now() } : { ...cur };
    keep(base);
    setBusy(true); setSteps([]); setRes(null); setLive(""); stopRef.current = false; setPageErrors([]);
    try {
      const out = await workLoop({ task: t || tr("Make this program work correctly."), lang, code: fresh ? "" : cur.code, change: changeText || "",
        llm: llmOr, run: runAny, onEvent, isStopped: () => stopRef.current, maxRounds: 4 });
      const p = { ...base, code: out.code, lang: out.lang, status: out.ok ? "passed" : "failing", tests: out.tests, rounds: out.rounds, at: Date.now() };
      keep(p); setRes(out.last);
      if (changeText) setChange("");
      if (fresh) setTask("");
    } catch (e) {
      const m = String((e && e.message) || e);
      setSteps((s) => s.concat([{ text: m === "Stopped" ? tr("Stopped.") : tr(m), kind: "bad" }]));
    } finally { setBusy(false); setLive(""); }
  };

  const runOnly = async () => {
    if (!cur) return;
    setBusy(true); setRes(null);
    try {
      const r = await runAny(cur.lang, cur.code);
      setRes(r);
      const v = judge(r, cur.code, cur.lang);
      keep({ ...cur, status: v.passed ? "passed" : "failing", tests: v.tests });
    } finally { setBusy(false); }
  };
  const doStop = () => { stopRef.current = true; try { abortModel && abortModel(); } catch (e) {} stopSandbox(); };

  const verdict = res && cur ? judge(res, cur.code, cur.lang) : null;
  const ext = cur ? (LANGS[cur.lang] || LANGS.python).ext : "py";
  const save = async () => {
    if (!cur) return;
    const name = (cur.title || "program").replace(/[^\w؀-ۿ -]+/g, "").trim().replace(/\s+/g, "-").slice(0, 40) + "." + ext;
    if (saveFile) {
      try { await saveFile(name, cur.code, (LANGS[cur.lang] || LANGS.python).mime); flash(tr("Saved")); } catch (e) { if (String(e.message) !== "Cancelled") flash(tr(e.message)); }
    } else {
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([cur.code], { type: "text/plain" })); a.download = name; a.click();
    }
  };

  const chip = (on) => `px-2.5 py-1 rounded-lg text-[12px] border ${on ? "bg-teal-500 border-teal-500 text-slate-950 font-medium" : "border-slate-700 text-slate-300"}`;
  return (
    <div className="space-y-3 pb-24" data-testid="code-page">
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
        <p className="text-sm text-slate-100 font-medium flex items-center gap-1.5"><Code2 size={16} className="text-teal-300" />{tr("Code that is tested before you get it")}</p>
        <p className="text-[12px] text-slate-400 mt-1 leading-relaxed">{tr("The model writes the program and its tests, the phone runs them, and any error goes straight back to the model to fix — until the tests pass. Offline, in a locked sandbox.")}</p>
        <textarea value={task} onChange={(e) => setTask(e.target.value)} rows={3} data-testid="code-task" dir="auto"
          placeholder={tr("What should it do? e.g. “A function that finds a crane's capacity at any radius from a load chart table”")}
          className="w-full mt-2 bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-100 placeholder:text-slate-600" />
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          {[["auto", "Auto"], ["python", "Python"], ["javascript", "JavaScript"], ["html", "Web page"]].map(([k, l]) => (
            <button key={k} onClick={() => setLangPick(k)} className={chip(langPick === k)} data-testid={"code-lang-" + k}>{tr(l)}</button>
          ))}
          {busy ? (
            <button onClick={doStop} data-testid="code-stop" className="ms-auto px-3 py-1.5 rounded-lg bg-rose-500/20 border border-rose-800 text-rose-200 text-sm flex items-center gap-1.5"><Square size={13} />{tr("Stop")}</button>
          ) : (
            <button onClick={() => run({ fresh: true })} disabled={!task.trim()} data-testid="code-build"
              className="ms-auto px-3 py-1.5 rounded-lg bg-teal-500 text-slate-950 text-sm font-semibold disabled:opacity-40 flex items-center gap-1.5"><Wrench size={14} />{tr("Build & test")}</button>
          )}
        </div>
        <p className="text-[11px] mt-2 text-slate-500" data-testid="py-status">
          {py.state === "ready" ? tr("Python {v} ready · numpy, pandas, sympy · no internet", { v: "3.14" }) : py.state === "starting" || py.state === "checking" ? tr("Starting Python…")
            : py.state === "missing" ? tr("Python is not in this build — JavaScript and web pages still work.") : tr("Python could not start: {e}", { e: py.error || "" })}
        </p>
      </div>

      {steps.length || busy ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3" data-testid="code-steps">
          {steps.map((s, i) => (
            <p key={i} data-testid="code-step" className={`text-[12px] leading-relaxed ${s.kind === "ok" ? "text-emerald-300" : s.kind === "bad" ? "text-rose-300" : "text-slate-300"}`} dir="auto">{s.text}</p>
          ))}
          {busy ? <p className="text-[12px] text-teal-300 flex items-center gap-1.5 mt-1"><Loader2 size={12} className="animate-spin" />{tr("Working…")}</p> : null}
          {live ? <pre className="att-scroll mt-2 text-[11px] font-mono text-slate-400 whitespace-pre-wrap max-h-40 overflow-auto" dir="ltr">{live.split("\n").slice(-14).join("\n")}</pre> : null}
        </div>
      ) : null}

      {cur && cur.code ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[12px] text-slate-300 truncate" dir="auto">{cur.title} · {tr((LANGS[cur.lang] || LANGS.python).label)}</span>
            {cur.status === "passed" && verdict && verdict.passed ? (
              <span data-testid="code-badge" className="shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-800 text-emerald-300 flex items-center gap-1">
                <CheckCircle2 size={11} />{cur.tests ? tr("Tested on this phone: {n} passed", { n: cur.tests }) : tr("Ran on this phone")}</span>
            ) : cur.status === "failing" ? <span data-testid="code-badge" className="shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-900 text-rose-300">{tr("Not passing yet")}</span> : null}
          </div>
          <textarea value={cur.code} onChange={(e) => setCur({ ...cur, code: e.target.value, status: "edited" })} data-testid="code-editor" dir="ltr" spellCheck={false}
            rows={Math.min(22, Math.max(8, cur.code.split("\n").length + 1))}
            className="att-scroll w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-[12px] font-mono text-teal-50 whitespace-pre overflow-auto" style={{ tabSize: 4 }} />
          <div className="flex flex-wrap gap-1.5 mt-2">
            <button onClick={runOnly} disabled={busy} data-testid="code-run" className="px-3 py-1.5 rounded-lg bg-teal-500/15 border border-teal-800 text-teal-200 text-xs flex items-center gap-1 disabled:opacity-40">
              {cur.lang === "html" ? <Eye size={12} /> : <Play size={12} />}{cur.lang === "html" ? tr("Check the page") : tr("Run")}</button>
            {verdict && !verdict.passed ? (
              <button onClick={() => run({})} disabled={busy} data-testid="code-fix" className="px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-800 text-amber-200 text-xs flex items-center gap-1 disabled:opacity-40"><Wrench size={12} />{tr("Fix it automatically")}</button>
            ) : null}
            <button onClick={() => { try { navigator.clipboard.writeText(cur.code); } catch (e) {} flash(tr("Copied")); }} className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 text-xs flex items-center gap-1"><Copy size={12} />{tr("Copy")}</button>
            <button onClick={save} data-testid="code-save" className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 text-xs flex items-center gap-1"><Save size={12} />{tr("Save .{e}", { e: ext })}</button>
            {share ? <button onClick={() => share(cur.code)} className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 text-xs flex items-center gap-1"><Share2 size={12} />{tr("Share")}</button> : null}
          </div>
          {cur.lang === "html" ? <HtmlPreview code={cur.code} onReport={setPageErrors} /> : null}
          {cur.lang === "html" && pageErrors.length ? <p className="text-[11px] text-rose-300 mt-1" dir="ltr">{pageErrors.slice(-3).join(" · ")}</p> : null}
          <RunOutput res={res} lang={cur.lang} code={cur.code} />
          <div className="flex gap-1.5 mt-3">
            <input value={change} onChange={(e) => setChange(e.target.value)} data-testid="code-change" dir="auto"
              onKeyDown={(e) => { if (e.key === "Enter" && change.trim() && !busy) run({ changeText: change.trim() }); }}
              placeholder={tr("Change it… e.g. “also show the total in EGP”")} className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600" />
            <button onClick={() => run({ changeText: change.trim() })} disabled={busy || !change.trim()} data-testid="code-change-go"
              className="px-3 py-2 rounded-lg bg-slate-800 text-slate-100 text-sm disabled:opacity-40">{tr("Change")}</button>
          </div>
        </div>
      ) : null}

      {projects.length ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs uppercase tracking-wider text-slate-500">{tr("Your programs")}</p>
            <button onClick={() => { setCur(null); setRes(null); setSteps([]); }} className="text-[11px] text-teal-300 flex items-center gap-1"><Plus size={11} />{tr("New")}</button>
          </div>
          {projects.slice(0, 12).map((p) => (
            <div key={p.id} className="flex items-center gap-2 py-1.5 border-b border-slate-900 last:border-0">
              <button onClick={() => { setCur(p); setRes(null); setSteps([]); }} className="flex-1 min-w-0 text-start">
                <span className="block text-[13px] text-slate-200 truncate" dir="auto">{p.title || tr("Untitled")}</span>
                <span className="block text-[10px] text-slate-500">{tr((LANGS[p.lang] || LANGS.python).label)} · {p.status === "passed" ? tr("passing") : p.status === "failing" ? tr("not passing") : tr("draft")}</span>
              </button>
              <button onClick={() => { const next = projects.filter((x) => x.id !== p.id); setProjects(next); saveProjects(next); if (cur && cur.id === p.id) setCur(null); }}
                className="p-1.5 text-slate-600 hover:text-rose-400" aria-label={tr("Delete")}><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
