/* ---- Code: the workbench screen, and the ▶ Run button under code in Chat ------------
   See code.js for the loop and sandbox.js for where code runs.                        */
import { askConfirm } from "./confirm.jsx";
import React, { useState, useEffect, useRef } from "react";
import { Code2, Play, Wrench, Terminal, Loader2, Copy, Save, Share2, Square, CheckCircle2, AlertTriangle, Eye, Trash2, Plus, RefreshCw, Maximize2, X, Send } from "lucide-react";
import { tr } from "./i18n.js";
import { runCode, runHtml, htmlDoc, warmUp, pythonAvailable, stop as stopSandbox, LANGS, normLang } from "./sandbox.js";
import { workLoop, guessLang, countTests, judge, errorSummary, loadProjects, saveProjects, PASS_MARK } from "./code.js";
import { getPower } from "./power.js";

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

/** A live, locked preview of a web page (scripts run; no internet; no access to the app).
 *  v6.15 (Ali: "make sure the preview page is good"): phone / tablet / desktop widths (the page is laid out at
 *  that width and scaled to fit), reload, full screen, and a console with the page's console.log and errors. */
const DEVICES = [["phone", "Phone", 390], ["tablet", "Tablet", 820], ["desktop", "Desktop", 1280]];
function HtmlPreview({ code, onReport }) {
  const [token] = useState(() => "p" + Math.random().toString(36).slice(2));
  const [dev, setDev] = useState("phone");
  const [gen, setGen] = useState(0);                 // bump = reload
  const [full, setFull] = useState(false);
  const [logs, setLogs] = useState([]);              // { kind: "log" | "error", text }
  const [showLog, setShowLog] = useState(false);
  const [boxW, setBoxW] = useState(360);
  const boxRef = useRef(null);
  useEffect(() => {
    setLogs([]);
    const errs = [];
    const on = (e) => { const d = e.data; if (!d || d.attuneSandbox !== token) return;
      if (d.kind === "error") { errs.push(d.text); onReport && onReport(errs.slice()); }
      if (d.kind === "error" || d.kind === "log") setLogs((l) => l.concat([{ kind: d.kind, text: d.text }]).slice(-60)); };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [token, code, gen]);
  useEffect(() => {
    const el = boxRef.current; if (!el) return;
    const fit = () => setBoxW(el.clientWidth || 360);
    fit();
    let ro = null; try { ro = new ResizeObserver(fit); ro.observe(el); } catch (e) { window.addEventListener("resize", fit); }
    return () => { if (ro) ro.disconnect(); else window.removeEventListener("resize", fit); };
  }, [full]);
  const devW = (DEVICES.find((d) => d[0] === dev) || DEVICES[0])[2];
  const scale = Math.min(1, boxW / devW);
  const boxH = full ? (typeof window !== "undefined" ? window.innerHeight - 104 : 640) : Math.round(Math.min(560, (typeof window !== "undefined" ? window.innerHeight : 800) * 0.62));
  const errN = logs.filter((l) => l.kind === "error").length;
  const bar = (
    <div className="flex items-center gap-1.5">
      <div className="flex rounded-lg border border-slate-700 overflow-hidden" role="group" aria-label={tr("Preview width")}>
        {DEVICES.map(([k, l]) => <button key={k} onClick={() => setDev(k)} aria-pressed={dev === k} data-testid={"code-dev-" + k}
          className={`px-2 min-h-[36px] text-[12px] ${dev === k ? "bg-sky-500 text-slate-950 font-semibold" : "text-slate-300"}`}>{tr(l)}</button>)}
      </div>
      <button onClick={() => setGen((g) => g + 1)} aria-label={tr("Reload")} title={tr("Reload")} className="px-2.5 min-h-[36px] rounded-lg border border-slate-700 text-slate-300 flex items-center" data-testid="code-reload"><RefreshCw size={14} /></button>
      <button onClick={() => setShowLog((v) => !v)} className={`px-2.5 min-h-[36px] rounded-lg border text-[12px] ${errN ? "border-rose-800 text-rose-300" : "border-slate-700 text-slate-300"}`} data-testid="code-console-btn">
        {tr("Console")}{logs.length ? ` ${logs.length}` : ""}{errN ? " · " + errN + "✗" : ""}</button>
      <button onClick={() => setFull((v) => !v)} aria-label={full ? tr("Close") : tr("Full screen")} title={full ? tr("Close") : tr("Full screen")} className="ms-auto px-2.5 min-h-[36px] rounded-lg border border-slate-700 text-slate-300 flex items-center" data-testid="code-full">
        {full ? <X size={15} /> : <Maximize2 size={14} />}</button>
    </div>);
  const frame = (
    <div ref={boxRef} className="relative w-full overflow-hidden rounded-xl border border-slate-700 bg-white" style={{ height: boxH }}>
      <iframe key={gen} title="preview" sandbox="allow-scripts allow-forms" srcDoc={htmlDoc(code, token)} data-testid="code-preview"
        style={{ width: devW, maxWidth: "none", height: Math.round(boxH / scale), transform: `scale(${scale})`, transformOrigin: "top left", border: 0, position: "absolute", left: Math.max(0, (boxW - devW * scale) / 2), top: 0 }} />
    </div>);
  const consoleBox = showLog ? (
    <div className="att-scroll mt-2 max-h-40 overflow-auto rounded-xl bg-black/50 border border-slate-800 p-2 font-mono text-[11.5px]" dir="ltr" data-testid="code-console">
      {logs.length ? logs.map((l, i) => <div key={i} className={l.kind === "error" ? "text-rose-300" : "text-slate-300"}>{l.kind === "error" ? "✗ " : "› "}{l.text}</div>)
        : <div className="text-slate-500">{tr("Nothing printed yet")}</div>}
    </div>) : null;
  if (full) return (
    <div className="fixed inset-0 z-[80] bg-slate-950 p-3 flex flex-col gap-2" data-testid="code-preview-full">
      {bar}{frame}{consoleBox}
    </div>);
  return <div className="mt-2 space-y-2">{bar}{frame}{consoleBox}</div>;
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
  // v6.32 look B (Ali: "Coder B"): a conversation with the coder — your ask, each step, the code in a card, then "change it"
  const [codeOpen, setCodeOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [asks, setAsks] = useState([]);                  // earlier asks in this sitting: [{ text, steps }]
  const [curAsk, setCurAsk] = useState("");
  const setView = (v) => { setCodeOpen(v === "code"); setPreviewOpen(v === "preview"); };
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
    keep(p); setRes(incoming.result || null); setSteps([]); setAsks([]); setCurAsk(""); setView("none");
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
      else if (e.type === "continue") say(tr("The page was cut off — writing the rest…"));
      else if (e.type === "run") say(tr(STEP_TEXT.run));
      else if (e.type === "result") say(e.verdict.passed ? (e.verdict.tests ? tr("✓ Passed all {n} tests.", { n: e.verdict.tests }) : tr("✓ Ran without errors.")) : "✗ " + (String(e.res.error || e.res.stderr || "").trim().split("\n").filter(Boolean).pop() || (e.verdict.reason === "no-pass-mark" ? tr("The tests did not all run.") : tr("Failed"))), e.verdict.passed ? "ok" : "bad");
      else if (e.type === "fix") say(e.change ? tr("Making the change…") : tr("Round {r}: {t}", { r: e.round, t: tr(STEP_TEXT.fix) }));
      else if (e.type === "fixed") say(e.how === "edits" ? tr("Changed {n} place(s) in the code.", { n: e.edits }) : tr("Rewrote the program."));
      else if (e.type === "fixfail") say(tr(e.error), "bad");
      else if (e.type === "restart") say(tr("Stuck — starting again from scratch with a different approach"), "warn");
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
    if (fresh) { setAsks([]); setCurAsk(t); }
    else { if (steps.length || curAsk) setAsks((a) => a.concat([{ text: curAsk || (cur && cur.task) || "", steps }])); setCurAsk(changeText || tr("Fix it automatically")); }
    setBusy(true); setSteps([]); setRes(null); setLive(""); stopRef.current = false; setPageErrors([]); setCodeOpen(false);
    try {
      const out = await workLoop({ task: t || tr("Make this program work correctly."), lang, code: fresh ? "" : cur.code, change: changeText || "",
        llm: llmOr, run: runAny, onEvent, isStopped: () => stopRef.current, maxRounds: Math.max(4, getPower().codeRounds || 4),
        maxMs: 10 * 60e3 });   // v6.43 (Ali waited 30 min): no new fix round starts after 10 minutes — you get the best version and Fix it again
      const p = { ...base, code: out.code, lang: out.lang, status: out.ok ? "passed" : "failing", tests: out.tests, rounds: out.rounds, at: Date.now() };
      keep(p); setRes(out.last); if (out.lang === "html") setView("preview");
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

  const chip = (on) => `px-3 py-1.5 rounded-full text-[12px] border ${on ? "bg-teal-500 border-teal-500 text-slate-950 font-semibold" : "border-slate-700 text-slate-300"}`;
  const isHtml = cur && cur.lang === "html";
  const dot = (k) => k === "bad" ? "bg-rose-500/15 text-rose-300" : k === "warn" ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300";
  const stepIcon = (k) => <span className={"mt-0.5 shrink-0 w-[22px] h-[22px] rounded-full grid place-items-center " + dot(k)}>{k === "bad" ? <X size={12} /> : k === "warn" ? <AlertTriangle size={11} /> : <CheckCircle2 size={12} />}</span>;
  const Steps = ({ list, live: lv, working }) => (list.length || working ? (
    <div className="space-y-2" data-testid={working !== undefined ? "code-steps" : undefined}>
      {list.map((st, i) => (
        <p key={i} data-testid="code-step" className={`text-[13px] leading-relaxed flex gap-2.5 items-start ${st.kind === "bad" ? "text-rose-200" : st.kind === "warn" ? "text-amber-100" : "text-slate-200"}`} dir="auto">
          {stepIcon(st.kind)}<span>{String(st.text).replace(/^[✓✗]\s*/, "")}</span></p>
      ))}
      {working ? <p className="text-[13px] text-teal-300 flex items-center gap-2.5"><span className="w-[22px] h-[22px] grid place-items-center"><Loader2 size={14} className="animate-spin" /></span>{tr("Working…")}</p> : null}
      {lv ? <pre className="att-scroll ms-8 text-[11px] font-mono text-slate-500 whitespace-pre-wrap max-h-40 overflow-auto" dir="ltr">{lv.split("\n").slice(-14).join("\n")}</pre> : null}
    </div>) : null);
  const Bubble = ({ text }) => <div className="flex justify-end"><p className="max-w-[85%] rounded-2xl rounded-ee-md px-3.5 py-2.5 text-[14px] leading-snug text-slate-100" style={{ background: "rgba(79,194,175,.13)" }} dir="auto" data-testid="code-ask">{text}</p></div>;
  const STARTERS = [
    ["Crane capacity", "A function that finds a crane's capacity at any radius from its load chart; between two rows use the lower value", "python"],
    ["VAT invoice page", "A web page that makes an invoice: items, quantity, price, 14% VAT and the total in EGP, ready to print", "html"],
    ["Clean a CSV", "Read a CSV of fuel fill-ups (date, litres, km) and print litres per 100 km for each fill-up and the average", "python"],
    ["Unit converter", "A small converter between tonnes, kilograms and pounds, and metres and feet, with tests", "javascript"],
  ];
  const pyLine = (
    <p className="text-[11px] text-slate-500" data-testid="py-status">
      {py.state === "ready" ? tr("Python {v} ready · numpy, pandas, sympy · no internet", { v: "3.14" }) : py.state === "starting" || py.state === "checking" ? tr("Starting Python…")
        : py.state === "missing" ? tr("Python is not in this build — JavaScript and web pages still work.") : tr("Python could not start: {e}", { e: py.error || "" })}
    </p>);
  const openProject = (p) => { setCur(p); setRes(null); setSteps([]); setAsks([]); setCurAsk(""); setView(p.lang === "html" ? "preview" : "none"); };
  const lines = cur && cur.code ? cur.code.split("\n").length : 0;
  return (
    <div className="space-y-4 pb-32 max-w-3xl lg:mx-auto" data-testid="code-page">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-white flex-1 flex items-center gap-2"><span className="w-8 h-8 rounded-[10px] grid place-items-center" style={{ background: "rgba(79,194,175,.14)" }}><Code2 size={17} className="text-teal-300" /></span>{tr("Code")}</h2>
        {cur ? <button onClick={() => { setCur(null); setRes(null); setSteps([]); setAsks([]); setCurAsk(""); }} data-testid="code-new" className="px-3 min-h-[38px] rounded-full border border-slate-700 text-slate-200 text-[13px] flex items-center gap-1"><Plus size={13} />{tr("New")}</button> : null}
      </div>

      {!cur ? (
        <>
          <div className="pt-2">
            <p className="text-[19px] font-semibold text-white">{tr("What should I build?")}</p>
            <p className="text-[12.5px] text-slate-400 mt-1 leading-relaxed">{tr("I write the program and its tests, run them on this phone, and fix every error before you get it. Offline, in a locked sandbox.")}</p>
          </div>
          <div className="grid grid-cols-2 gap-2" data-testid="code-starters">
            {STARTERS.map(([title, ask, lang]) => (
              <button key={title} onClick={() => { setTask(tr(ask)); setLangPick(lang); }} className="text-start rounded-2xl border border-slate-800 bg-slate-900 p-3 hover:border-teal-600">
                <span className="block text-[13px] font-semibold text-slate-100">{tr(title)}</span>
                <span className="block text-[11.5px] text-slate-500 mt-0.5">{tr((LANGS[lang] || LANGS.python).label)}</span>
              </button>))}
          </div>
          {projects.length ? <>
            <p className="text-[11px] uppercase tracking-wider text-slate-500 -mb-2">{tr("Your programs")}</p>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none]" data-testid="code-projects">
              {projects.slice(0, 12).map((p) => (
                <div key={p.id} className="shrink-0 w-40 rounded-2xl border border-slate-800 bg-slate-900 p-2.5">
                  <button onClick={() => openProject(p)} className="w-full text-start">
                    <span className="block text-[13px] text-slate-100 font-medium truncate" dir="auto">{p.title || tr("Untitled")}</span>
                    <span className={`block text-[11px] mt-0.5 ${p.status === "passed" ? "text-emerald-300" : p.status === "failing" ? "text-rose-300" : "text-slate-500"}`}>{tr((LANGS[p.lang] || LANGS.python).label)} · {p.status === "passed" ? tr("passing") : p.status === "failing" ? tr("not passing") : tr("draft")}</span>
                  </button>
                  <button onClick={async () => { if (!(await askConfirm("Delete this project?"))) return; const next = projects.filter((x) => x.id !== p.id); setProjects(next); saveProjects(next); }}
                    className="mt-1 text-[11px] text-slate-500 hover:text-rose-400 flex items-center gap-1" aria-label={tr("Delete")}><Trash2 size={11} />{tr("Delete")}</button>
                </div>))}
            </div></> : null}
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-2.5 space-y-2 focus-within:border-teal-500">
            <textarea value={task} onChange={(e) => setTask(e.target.value)} rows={3} data-testid="code-task" dir="auto"
              placeholder={tr("What should it do? e.g. “A function that finds a crane's capacity at any radius from a load chart table”")}
              className="w-full bg-transparent p-1.5 text-sm text-slate-100 placeholder:text-slate-600 resize-none focus:outline-none" />
            <div className="flex flex-wrap items-center gap-1.5">
              {[["auto", "Auto"], ["python", "Python"], ["javascript", "JavaScript"], ["html", "Web page"]].map(([k, l]) => (
                <button key={k} onClick={() => setLangPick(k)} className={chip(langPick === k)} data-testid={"code-lang-" + k}>{tr(l)}</button>
              ))}
              <button onClick={() => run({ fresh: true })} disabled={!task.trim()} data-testid="code-build"
                className="ms-auto px-4 min-h-[42px] rounded-full bg-teal-500 text-slate-950 text-sm font-semibold disabled:opacity-40 flex items-center gap-1.5"><Wrench size={14} />{tr("Build & test")}</button>
            </div>
          </div>
          {pyLine}
        </>
      ) : (
        <>
          {asks.map((a, i) => <div key={i} className="space-y-3 opacity-80"><Bubble text={a.text} /><Steps list={a.steps} /></div>)}
          <Bubble text={curAsk || cur.task || cur.title} />
          <Steps list={steps} live={live} working={busy} />

          {/* the code, in a card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden">
            <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-slate-800/80">
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">{tr((LANGS[cur.lang] || LANGS.python).label)}</span>
              {lines ? <span className="text-[11px] text-slate-500">{tr("{n} lines", { n: lines })}</span> : null}
              {cur.status === "passed" && verdict && verdict.passed ? (
                <span data-testid="code-badge" className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 flex items-center gap-1">
                  <CheckCircle2 size={11} />{cur.tests ? tr("Tested on this phone: {n} passed", { n: cur.tests }) : tr("Ran on this phone")}</span>
              ) : cur.status === "failing" ? <span data-testid="code-badge" className="text-[11px] px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300">{tr("Not passing yet")}</span> : null}
              <span className="ms-auto flex gap-1">
                {isHtml ? <button onClick={() => setPreviewOpen(!previewOpen)} data-testid="code-view-preview" className={chip(previewOpen)}><Eye size={12} className="inline me-1" />{tr("Preview")}</button> : null}
                <button onClick={() => setCodeOpen(!codeOpen)} data-testid="code-view-code" className={chip(codeOpen)}><Code2 size={12} className="inline me-1" />{codeOpen ? tr("Hide code") : tr("Show code")}</button>
              </span>
            </div>
            {!codeOpen && cur.code ? (
              <button onClick={() => setCodeOpen(true)} className="w-full text-start px-3 py-2.5" dir="ltr">
                <pre className="text-[12px] font-mono text-sky-100/90 whitespace-pre overflow-hidden">{cur.code.split("\n").slice(0, 3).join("\n")}</pre>
                {lines > 3 ? <span className="text-[11.5px] text-slate-500 font-sans">… {tr("tap to see all {n} lines", { n: lines })}</span> : null}
              </button>) : null}
            <div className={codeOpen ? "" : "hidden"}>
              <textarea value={cur.code} onChange={(e) => setCur({ ...cur, code: e.target.value, status: "edited" })} data-testid="code-editor" dir="ltr" spellCheck={false}
                rows={Math.min(24, Math.max(10, (cur.code || "").split("\n").length + 1))}
                className="att-scroll w-full bg-transparent p-3 text-[12.5px] leading-relaxed font-mono text-sky-50 whitespace-pre overflow-auto focus:outline-none" style={{ tabSize: 4 }} />
            </div>
          </div>

          {isHtml && previewOpen ? <HtmlPreview code={cur.code} onReport={setPageErrors} /> : null}
          {isHtml && pageErrors.length ? <p className="text-[11px] text-rose-300" dir="ltr">{pageErrors.slice(-3).join(" · ")}</p> : null}
          <RunOutput res={res} lang={cur.lang} code={cur.code} />

          <div className="flex flex-wrap gap-1.5">
            <button onClick={runOnly} disabled={busy || !cur.code} data-testid="code-run" className="px-4 min-h-[40px] rounded-full bg-teal-500 text-slate-950 text-[13px] font-semibold flex items-center gap-1.5 disabled:opacity-40">
              {isHtml ? <Eye size={14} /> : <Play size={14} />}{isHtml ? tr("Check the page") : tr("Run")}</button>
            {verdict && !verdict.passed ? (
              <button onClick={() => run({})} disabled={busy} data-testid="code-fix" className="px-3 min-h-[40px] rounded-full bg-amber-500/15 border border-amber-800 text-amber-200 text-[13px] flex items-center gap-1 disabled:opacity-40"><Wrench size={13} />{tr("Fix it automatically")}</button>
            ) : null}
            <button onClick={() => { try { navigator.clipboard.writeText(cur.code); } catch (e) {} flash(tr("Copied")); }} className="px-3 min-h-[40px] rounded-full border border-slate-700 text-slate-300 text-[13px] flex items-center gap-1"><Copy size={13} />{tr("Copy")}</button>
            <button onClick={save} data-testid="code-save" className="px-3 min-h-[40px] rounded-full border border-slate-700 text-slate-300 text-[13px] flex items-center gap-1"><Save size={13} />{tr("Save .{e}", { e: ext })}</button>
            {share ? <button onClick={() => share(cur.code)} className="px-3 min-h-[40px] rounded-full border border-slate-700 text-slate-300 text-[13px] flex items-center gap-1"><Share2 size={13} />{tr("Share")}</button> : null}
            {busy ? <button onClick={doStop} data-testid="code-stop" className="ms-auto px-3 min-h-[40px] rounded-full bg-rose-500/20 border border-rose-800 text-rose-200 text-[13px] flex items-center gap-1.5"><Square size={12} />{tr("Stop")}</button> : null}
          </div>
          {pyLine}

          {/* ask for a change, like the next message to the coder */}
          <div className="sticky bottom-3 z-10 flex gap-1.5 items-center bg-slate-900 border border-slate-700 rounded-full ps-4 pe-1.5 py-1.5 shadow-xl shadow-black/40 focus-within:border-teal-500">
            <input value={change} onChange={(e) => setChange(e.target.value)} data-testid="code-change" dir="auto"
              onKeyDown={(e) => { if (e.key === "Enter" && change.trim() && !busy) run({ changeText: change.trim() }); }}
              placeholder={tr("Ask for a change… e.g. “also show the total in EGP”")} className="flex-1 min-w-0 bg-transparent py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none" />
            <button onClick={() => run({ changeText: change.trim() })} disabled={busy || !change.trim()} data-testid="code-change-go" aria-label={tr("Change")}
              className="w-10 h-10 rounded-full bg-teal-500 text-slate-950 grid place-items-center disabled:opacity-40"><Send size={15} /></button>
          </div>
        </>
      )}
    </div>
  );
}
