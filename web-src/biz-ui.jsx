/* ---- v6.18 Business as its own app (Ali: "rework the whole business UI … an app in the app with introductions and make
   it professional … step by step"; "a mix of the 3 in a brilliant way"; "a form like Microsoft Access for data entry";
   "an AI chat inside business where I can ask the AI to change the design … and it transforms the app").
   Mock-ups: artifact "Business new look" (A guided steps · B AI interview · C studio). The mix:
     A  a professional light look, one step per screen, a progress bar, Back / Next
     B  an interview card in every step: one question, tappable answers (biz-steps.js — no model needed), or your words
     C  step tabs you can jump between, a live phone + computer preview, the finished system with its own tabs
   plus the design chat (every screen, proposals shown first, Apply / Undo) and an Access-style form (record ◀ ▶,
   sections, New / Save / Delete, linked records underneath).
   The tables' own tools (grid, design view, queries, forms, summary, licence, app file) stay in erp-ui.jsx and live in
   the "Tables" tab, so nothing that worked is lost. Logic: erp.js (tables), erp-screens.js (screens), biz-steps.js. */
import React, { useState, useEffect, useMemo } from "react";
import { ShoppingCart, ChevronLeft, ChevronRight, Plus, Save, Trash2, Sparkles, Undo2, LayoutGrid, FileText, BarChart3, Database, Palette, Send, Check, X, Loader2, Upload, Wrench, Smartphone, Monitor } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import { ShopApp } from "./shop-ui.jsx";
import { useSubBack, useSticky } from "./backstack.js";
import * as E from "./erp.js";
import * as SC from "./erp-screens.js";
import * as BS from "./biz-steps.js";
import { readApp } from "./erp-app.js";
import { getPower } from "./power.js";
import { LIGHT_BASE, ON_FILL } from "./fitlook.js";
import { SystemView, FieldInput, RenameSheet } from "./erp-ui.jsx";
import { BooksApp } from "./books-ui.jsx";

const KEY = "attune:erp:v1", INTRO = "attune:biz:intro";
// a computer-sized screen (a tablet, a Chromebook, a phone on a monitor): the system switches to its computer layout
const WIDE = "(min-width: 900px)";
function useWide() {
  const mq = typeof window !== "undefined" && window.matchMedia ? window.matchMedia(WIDE) : null;
  const [w, setW] = useState(() => !!(mq && mq.matches));
  useEffect(() => { if (!mq) return; const f = () => setW(mq.matches); f(); mq.addEventListener ? mq.addEventListener("change", f) : mq.addListener(f); return () => (mq.removeEventListener ? mq.removeEventListener("change", f) : mq.removeListener(f)); }, []);
  return w;
}
const L2 = (en, ar) => (getLang() === "ar" ? ar : en);
// one professional light palette for all of Business (the tables' tools inside it too); the system's colour is the accent
const BIZ_CSS = `body:has(.biz-app),.biz-app{${LIGHT_BASE("#0F172A", "#F4F6FA", "#FFFFFF", "#EEF2F7", "#DCE3EC", "#C3CDDA", "#56657A", "#3E4D62")}color-scheme:light}
${ON_FILL(".biz-app")}.biz-app .bg-teal-500,.biz-app .bg-teal-600{color:#FFFFFF}`;
const accentVars = (c) => ({ "--color-teal-100": c, "--color-teal-200": c, "--color-teal-300": c, "--color-teal-400": c, "--color-teal-500": c, "--color-teal-600": c,
  "--color-teal-700": `color-mix(in srgb, ${c} 45%, white)`, "--color-teal-800": `color-mix(in srgb, ${c} 30%, white)`, "--color-teal-900": `color-mix(in srgb, ${c} 22%, white)`, "--color-teal-950": `color-mix(in srgb, ${c} 8%, white)`, "--biz": c });
const card = "rounded-2xl bg-[#FFFFFF] border border-[#DCE3EC] shadow-[0_1px_3px_rgba(15,23,42,.06)]";
const btnP = "h-12 px-5 rounded-2xl text-[#FFFFFF] font-bold text-[15px] disabled:opacity-40 flex items-center justify-center gap-2";
const btnG = "h-12 px-4 rounded-2xl border-[1.5px] border-[#C3CDDA] bg-[#FFFFFF] text-[#0F172A] font-semibold text-[14px] disabled:opacity-40 flex items-center justify-center gap-2";
const inp = "w-full min-w-0 h-12 rounded-xl bg-[#EEF2F7] border border-transparent px-3.5 text-[15px] text-[#0F172A] placeholder:text-[#64748B] focus:outline-none focus:border-[var(--biz)] focus:bg-[#FFFFFF]";

function loadIndex() { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; } }
function loadSys(id) { try { return JSON.parse(localStorage.getItem(KEY + ":" + id) || "null"); } catch (e) { return null; } }
function saveSys(sys) {
  try {
    localStorage.setItem(KEY + ":" + sys.id, JSON.stringify(sys));
    const idx = loadIndex().filter((x) => x.id !== sys.id);
    idx.unshift({ id: sys.id, name: sys.name, updated: sys.updated, tables: sys.tables.length, active: E.isActive(sys), color: SC.colorOf(sys) });
    localStorage.setItem(KEY, JSON.stringify(idx));
    return true;
  } catch (e) { return false; }
}
function dropSys(id) { try { localStorage.removeItem(KEY + ":" + id); localStorage.setItem(KEY, JSON.stringify(loadIndex().filter((x) => x.id !== id))); } catch (e) {} }
const seenIntro = () => { try { return !!localStorage.getItem(INTRO); } catch (e) { return true; } };

/** Business — the app inside Attune. */
export function BusinessApp({ flash, llm, modelReady, openEngine, saveFile, share, runPy, onExit, scanBarcode }) {
  const [index, setIndex] = useState(loadIndex);
  const [sys, setSysRaw] = useSticky("erp:sys", null);
  const [view, setView] = useSticky("erp:view", "list");          // list | new | system | books
  const [intro, setIntro] = useState(() => !seenIntro() && !loadIndex().length);   // the introduction tops the home until used
  useSubBack(view !== "list", () => { setView("list"); setSysRaw(null); });
  const setSys = (next, msg) => {
    if (!saveSys(next)) flash(tr("The phone's storage for Business is full — export a table to CSV and delete old records."));
    setSysRaw(next); setIndex(loadIndex());
    if (msg) flash(msg);
  };
  const open = (id) => { const s = loadSys(id); if (s) { setSysRaw(s); setView("system"); } };
  const done = () => { try { localStorage.setItem(INTRO, "1"); } catch (e) {} setIntro(false); };
  const color = sys && (view === "system" || view === "new") ? SC.colorOf(sys) : SC.COLORS.blue;
  const full = useWide() && view === "system" && !!sys;     // a system on a computer-sized screen uses the whole width
  let body;
  if (view === "shop") body = <ShopApp onBack={() => setView("list")} flash={flash} scanBarcode={scanBarcode} share={share} />;
  else if (view === "books") body = <div className="p-3"><BooksApp flash={flash} saveFile={saveFile} share={share} onBack={() => setView("list")} goCustom={() => setView("list")} /></div>;
  else if (view === "new") body = <Builder llm={llm} modelReady={modelReady} openEngine={openEngine} flash={flash} onBack={() => setView("list")}
    onCreate={(s) => { setSys(s, tr("Created — {n} tables", { n: s.tables.length })); setView("system"); }} />;
  else if (view === "system" && sys) body = <SystemShell sys={sys} setSys={setSys} llm={llm} modelReady={modelReady} openEngine={openEngine} flash={flash} saveFile={saveFile} share={share} runPy={runPy}
    onBack={() => { setView("list"); setSysRaw(null); }} onDelete={() => { dropSys(sys.id); setIndex(loadIndex()); setSysRaw(null); setView("list"); flash(tr("Deleted")); }} />;
  else body = <Hub index={index} open={open} onNew={() => { done(); setView("new"); }} onBooks={() => { done(); setView("books"); }} onShop={() => { done(); setView("shop"); }} onExit={onExit} intro={intro} onIntro={() => setIntro(true)} onIntroDone={done}
    onOpenFile={async (f) => {
      const s = readApp(await f.text());
      if (!s) { flash(tr("That file isn't an app made with Attune Business.")); return; }
      const had = loadSys(s.id);
      const next = { ...s, licence: had ? had.licence : null, updated: Date.now() };
      setSys(next, had ? tr("Updated from the app file — {n} tables with their records", { n: next.tables.length }) : tr("Opened — {n} tables with their records", { n: next.tables.length }));
      setView("system");
    }} />;
  return (
    <div className="biz-app min-h-[100dvh] bg-[#F4F6FA] text-[#0F172A]" style={accentVars(color)} data-testid="business-app">
      <style>{BIZ_CSS}</style>
      <div className={full ? "" : "max-w-3xl mx-auto px-3"} style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "calc(24px + env(safe-area-inset-bottom))" }}>{body}</div>
    </div>
  );
}

function TopBar({ title, sub, onBack, right, label }) {
  return (
    <div className="sticky top-0 z-30 bg-[#F4F6FAF2] backdrop-blur px-3 pt-2 pb-2 flex items-center gap-2">
      {onBack ? <button onClick={onBack} aria-label={label || tr("Back")} className="w-11 h-11 rounded-full bg-[#FFFFFF] border border-[#DCE3EC] flex items-center justify-center shrink-0" data-testid="biz-back"><ChevronLeft size={20} className="rtl:-scale-x-100" /></button> : null}
      <div className="flex-1 min-w-0"><p className="text-[17px] font-extrabold truncate" dir="auto">{title}</p>{sub ? <p className="text-[12px] text-[#5B6B80] truncate">{sub}</p> : null}</div>
      {right}
    </div>
  );
}

// ---- the introduction: the top of the Business home on the first visit (and from "How it works") --------------------------
function IntroHero({ onDone }) {
  const pts = [[tr("Say what you track"), tr("Customers, stock, jobs, invoices — the AI builds the tables.")],
    [tr("Set the rules"), tr("Totals, VAT, links between tables, required fields.")],
    [tr("Pick how it looks"), tr("On a phone and on a computer — then share it with your team as one app file.")]];
  return (
    <div className="space-y-4" data-testid="biz-intro">
      <div className="rounded-3xl bg-[#0F172A] text-[#FFFFFF] p-6 space-y-3">
        <div className="flex gap-1.5" aria-hidden="true"><span className="w-12 h-8 rounded-lg" style={{ background: "var(--biz)" }} /><span className="w-16 h-8 rounded-lg bg-[#475569]" /><span className="w-8 h-8 rounded-lg bg-amber-400" /></div>
        <p className="text-[26px] font-extrabold leading-tight">{tr("Build your own business system")}</p>
        <p className="text-[14px] text-[#CBD5E1]">{tr("For your company, on your phone — no code, and it works without internet.")}</p>
      </div>
      <ol className="space-y-3.5">
        {pts.map(([h, d], i) => <li key={i} className="flex gap-3"><span className="w-9 h-9 rounded-xl font-extrabold flex items-center justify-center shrink-0 text-[#FFFFFF]" style={{ background: "var(--biz)" }}>{i + 1}</span>
          <span><span className="block font-bold text-[15px]">{h}</span><span className="block text-[13.5px] text-[#5B6B80]">{d}</span></span></li>)}
      </ol>
      <button onClick={onDone} className="text-[13px] font-semibold text-[#5B6B80]" data-testid="biz-intro-done">{tr("Got it")}</button>
    </div>
  );
}

// ---- the hub: your systems --------------------------------------------------------------------------------------------
function Hub({ index, open, onNew, onBooks, onShop, onExit, onOpenFile, intro, onIntro, onIntroDone }) {
  return (
    <section className="px-4 pb-6 space-y-4" data-testid="business-page">
      <TopBar title={tr("Business")} sub={tr("Your own systems — like Microsoft Access, on your phone")} onBack={onExit} label={tr("Back to Attune")}
        right={intro ? null : <button onClick={onIntro} className="h-10 px-3 text-[13px] font-semibold text-[#475569]" data-testid="biz-how">{tr("How it works")}</button>} />
      {intro ? <IntroHero onDone={onIntroDone} /> : null}
      {/* v6.27: a shop's whole day on the phone — the counter, stock, customers, staff, the day's close (shop-ui.jsx) */}
      <button onClick={onShop} data-testid="shop-open" className={card + " w-full text-start p-4 flex items-center gap-3"}>
        <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-[#FFFFFF]" style={{ background: "var(--biz)" }}><ShoppingCart size={20} /></span>
        <span className="min-w-0"><span className="block font-bold text-[15px]">{tr("Shop in your pocket")}</span>
          <span className="block text-[12.5px] text-[#5B6B80] leading-snug">{tr("Say what your shop is — the counter with barcodes, stock, customers who owe, staff and the end-of-day close, ready in a minute. Every sale goes into your books.")}</span></span>
      </button>
      <button onClick={onNew} className={btnP + " w-full"} style={{ background: "var(--biz)" }} data-testid="erp-new"><Plus size={18} />{intro ? tr("Start a new system") : tr("New system")}</button>
      <button onClick={onBooks} data-testid="books-open" className={card + " w-full text-start p-4 flex items-center gap-3"}>
        <span className="w-11 h-11 rounded-xl bg-[#FEF3C7] text-[#B45309] flex items-center justify-center shrink-0"><FileText size={20} /></span>
        <span className="min-w-0"><span className="block font-bold text-[15px]">{tr("Shop & trading books")}</span>
          <span className="block text-[12.5px] text-[#5B6B80] leading-snug">{tr("Invoices with VAT, payments and overdue tracking, stock and purchasing, reports — your own accounting, on your phone, in English and Arabic.")}</span></span>
      </button>
      <div className="flex items-center justify-between pt-1"><p className="text-[15px] font-bold">{tr("Your systems")}</p>
        <label className="text-[13px] font-semibold flex items-center gap-1.5 cursor-pointer" style={{ color: "var(--biz)" }} data-testid="erp-open-app"><Upload size={15} />{tr("Open an app file")}
          <input type="file" accept=".html,.htm,.json,text/html" className="hidden" data-testid="erp-open-app-file" onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) onOpenFile(f); }} /></label></div>
      {index.length ? <div className="space-y-2.5">{index.map((x) => (
        <button key={x.id} onClick={() => open(x.id)} className={card + " w-full text-start p-3.5 flex items-center gap-3"} data-testid="erp-system">
          <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-[#FFFFFF]" style={{ background: x.color || "var(--biz)" }}><Database size={19} /></span>
          <span className="min-w-0 flex-1"><span className="block font-bold text-[15px] truncate" dir="auto">{x.name}</span>
            <span className="block text-[12px] text-[#5B6B80]">{tr("{n} tables", { n: x.tables })} · {new Date(x.updated).toLocaleDateString()}</span></span>
          {x.active ? <span className="text-[11px] font-semibold text-[#15803D] bg-[#DCFCE7] rounded-full px-2 py-0.5">{tr("Active")}</span>
            : <span className="text-[11px] font-semibold text-[#475569] bg-[#E2E8F0] rounded-full px-2 py-0.5">{tr("Trial")}</span>}
          <ChevronRight size={18} className="text-[#94A3B8] rtl:-scale-x-100" />
        </button>))}</div>
        : <p className={card + " p-5 text-center text-[14px] text-[#5B6B80]"}>{tr("No systems yet.")}</p>}
    </section>
  );
}

// ---- the builder: Name → Data → Logic → Screens → Launch ------------------------------------------------------------------
// The same five steps edit a new system (a draft, nothing saved until Create) or an existing one (mode "edit": each change saved).
export function Builder({ llm, modelReady, openEngine, flash, onBack, onCreate, existing = null, startAt = 0, onSave }) {
  const [step, setStep] = useState(existing ? Math.max(1, startAt) : 0);
  const [draft, setDraftRaw] = useState(existing);
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [err, setErr] = useState("");
  const edit = !!existing;
  useSubBack(!edit && step > 0, () => setStep((s) => Math.max(0, s - 1)));
  const setDraft = (d) => { setDraftRaw(d); if (edit && onSave) onSave(d); };
  const run = (ops, quiet) => {
    const r = E.applyOps(draft, ops);
    if (r.errors.length && !quiet) flash(r.errors[0]);
    if (r.done.length) setDraft(edit ? r.sys : { ...r.sys, history: r.sys.history });
    return r;
  };
  const undo = () => { const u = E.undo(draft); if (u) { setDraft(u.sys); flash(tr("Undone: {w}", { w: u.what })); } };
  const design = async () => {
    setErr(""); setBusy(true); setStage("");
    try {
      let spec = null, how = "ai";
      setStage(tr("Designing the tables…"));
      const out = await llm(E.designMessages(desc), { maxTokens: getPower().designTokens, temperature: 0.2, json: true });
      const j = E.jsonFrom(out);
      if (j && E.designQuality(j).ok) spec = j;
      if (!spec) {
        setStage(tr("Trying a simpler way…"));
        const lines = await llm(E.designLinesMessages(desc), { maxTokens: 1500, temperature: 0.2 });
        const sp = E.specFromLines(lines, (j && j.name) || tr("My business"));
        if (sp && E.designQuality(sp).ok) spec = sp;
      }
      if (!spec) { const t = E.guessTemplate(desc); if (t) { spec = t.spec; how = "template"; } }
      if (!spec) setErr(tr("The model didn't produce a usable design. Try again, describe it differently, or start from a template."));
      else {
        const ac = E.autoConnect(spec);
        const s = E.systemFromSpec({ ...ac.spec, business: desc });
        setDraftRaw(draft && draft.name && draft._named ? { ...s, name: draft.name, _named: true } : s); setStep(1);
        if (ac.added.length) flash(tr("Connected {n} fields to their tables", { n: ac.added.length }));
        if (how === "template") flash(tr("Started from the closest template — change anything you like"));
      }
    } catch (e) { setErr(String(e.message || e)); }
    setBusy(false);
  };
  const pick = (spec) => { setDraftRaw(E.systemFromSpec(spec)); setStep(1); };
  const S = BS.STEPS[step];
  const ar = getLang() === "ar";
  const create = () => onCreate({ ...draft, name: (draft.name || "").trim() || tr("My business"), _named: undefined });
  return (
    <section className="pb-28" data-testid="erp-newpage">
      <TopBar title={edit ? draft.name : step === 0 ? tr("New system") : draft ? draft.name : tr("New system")} sub={(edit ? tr("Design") + " · " : "") + tr("Step {n} of 5", { n: step + 1 })} onBack={onBack}
        right={draft && draft.history && draft.history.length ? <button onClick={undo} aria-label={tr("Undo")} className="w-11 h-11 rounded-full bg-[#FFFFFF] border border-[#DCE3EC] flex items-center justify-center" data-testid="biz-undo"><Undo2 size={18} /></button> : null} />
      {/* C: the steps, jump to any once there is a design;  A: the progress bar */}
      <div className="px-4 space-y-2">
        <div className="grid grid-cols-5 gap-1.5" aria-hidden="true">{BS.STEPS.map((s, i) => <span key={s.id} className="h-1.5 rounded-full" style={{ background: i <= step ? "var(--biz)" : "#DCE3EC", opacity: i < step ? 0.55 : 1 }} />)}</div>
        <div className="grid grid-cols-5 gap-1.5" role="tablist">
          {BS.STEPS.map((s, i) => <button key={s.id} role="tab" aria-selected={step === i} disabled={!draft && i > 0} onClick={() => setStep(i)} data-testid={"biz-step-" + s.id}
            className={"h-9 rounded-lg text-[11.5px] font-semibold disabled:opacity-40 " + (step === i ? "text-[#FFFFFF]" : "text-[#475569] bg-[#FFFFFF] border border-[#DCE3EC]")} style={step === i ? { background: "var(--biz)" } : null}>{ar ? s.ar : s.en}</button>)}
        </div>
      </div>
      <div className="px-4 pt-4 space-y-4">
        {/* B: the interview — one question, tappable answers */}
        <Interview q={ar ? S.q.ar : S.q.en} sys={draft} step={S.id} run={run} llm={modelReady ? llm : null} flash={flash} />
        {S.id === "name" ? (
          <div className="space-y-3">
            {draft ? <label className="block"><span className="block text-[13px] font-semibold mb-1.5">{tr("System name")}</span>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value, _named: true })} className={inp} dir="auto" data-testid="biz-name" /></label> : null}
            <label className="block"><span className="block text-[13px] font-semibold mb-1.5">{tr("Describe your business")}</span>
              <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} dir="auto" className={inp + " h-auto py-3"} data-testid="erp-desc"
                placeholder={tr("e.g. We rent mobile cranes (20–500 t) with operators in Egypt. We track customers, jobs per site, daily rates, invoices and payments, maintenance and crew licences.")} /></label>
            <div className="flex flex-wrap gap-2">{[tr("I rent out cranes with operators"), tr("I run a clinic with appointments"), tr("I sell spare parts to workshops"), tr("I run a small shop with stock")].map((x) => (
              <button key={x} onClick={() => setDesc(x)} className="px-3 py-2 rounded-xl bg-[#FFFFFF] border border-[#DCE3EC] text-[13px]">{x}</button>))}</div>
            {modelReady ? <button className={btnP + " w-full"} style={{ background: "var(--biz)" }} disabled={busy || desc.trim().length < 15} onClick={design} data-testid="erp-design">
              {busy ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}{busy ? (stage || tr("Designing your system…")) : tr("Design it with AI")}</button>
              : <button className={btnG + " w-full"} onClick={openEngine}>{tr("Load a model to design it with AI — or pick a template below")}</button>}
            {err ? <p className="text-[13px] text-amber-700">{err}</p> : null}
            <p className="text-[13px] font-semibold text-[#475569] pt-2">{tr("Or start from a template")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">{E.TEMPLATES.map((t) => (
              <button key={t.id} onClick={() => pick(t.spec)} className={card + " text-start p-3.5"} data-testid={"erp-tpl-" + t.id}>
                <span className="block font-bold text-[14.5px]">{tr(t.title)}</span><span className="block text-[12px] text-[#5B6B80]">{tr(t.blurb)}</span></button>))}</div>
          </div>
        ) : !draft ? null : S.id === "data" ? <DataStep draft={draft} setDraft={setDraft} run={run} />
          : S.id === "logic" ? <LogicStep draft={draft} run={run} />
          : S.id === "screens" ? <ScreensEditor sys={draft} run={run} />
          : <LaunchStep draft={draft} edit={edit} />}
      </div>
      {/* A: Back / Next — and, from the second step, finish now (everything can be changed later) */}
      {step > 0 && draft ? (
        <div className="att-shift fixed inset-x-0 bottom-0 z-40 bg-[#FFFFFFF2] backdrop-blur border-t border-[#DCE3EC] px-4 pt-3" style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}>
          <div className="max-w-3xl mx-auto flex gap-2.5">
            <button onClick={() => setStep(step - 1)} className={btnG}>{tr("Back")}</button>
            {step < 4 ? <button onClick={() => setStep(step + 1)} className={(edit ? btnG : btnP) + " flex-1"} style={edit ? null : { background: "var(--biz)" }} data-testid="biz-next">{tr("Next")}: {ar ? BS.STEPS[step + 1].ar : BS.STEPS[step + 1].en}</button> : null}
            {/* editing a live system: every change is already saved — Done from any step */}
            {edit ? <button onClick={onBack} className={btnP + " flex-1"} style={{ background: "var(--biz)" }} data-testid="biz-done"><Check size={18} />{tr("Done")}</button>
              : step < 4 ? <button onClick={create} className={btnG + " px-3 text-[13px]"} data-testid="erp-create">{tr("Finish now")}</button>
              : <button onClick={create} className={btnP + " flex-1"} style={{ background: "var(--biz)" }} data-testid="erp-create"><Check size={18} />{tr("Create this system")}</button>}
          </div>
        </div>) : null}
    </section>
  );
}

// the interview card: the step's question, tappable answers (no model needed), and "or say it in your words" (the model)
function Interview({ q, sys, step, run, llm, flash }) {
  const sugg = useMemo(() => BS.suggestions(sys, step), [sys, step]);
  const [ask, setAsk] = useState("");
  const [busy, setBusy] = useState(false);
  const [prop, setProp] = useState(null);
  const propose = async () => {
    setBusy(true); setProp(null);
    try {
      const j = E.jsonFrom(await llm(E.changeMessages(sys, ask), { maxTokens: 1200, temperature: 0.1, json: true }));
      const ops = j && Array.isArray(j.ops) ? j.ops : j && j.op ? [j] : [];
      const dry = E.applyOps(sys, ops);
      setProp({ ops, done: dry.done, errors: dry.errors });
    } catch (e) { flash(String(e.message || e)); }
    setBusy(false);
  };
  return (
    <div className={card + " p-4 space-y-3"} data-testid="biz-interview">
      <div className="flex gap-2.5"><span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[#FFFFFF]" style={{ background: "var(--biz)" }}><Sparkles size={15} /></span>
        <p className="text-[15.5px] font-semibold leading-snug pt-1" dir="auto">{q}</p></div>
      {sys && sugg.length ? <div className="flex flex-wrap gap-2" data-testid="biz-suggestions">
        {sugg.map((x) => <button key={x.id} onClick={() => { const r = run(x.ops); if (r.done.length) flash(r.done[r.done.length - 1]); }} className="px-3 py-2 rounded-xl text-[13px] font-semibold border-[1.5px] bg-[#FFFFFF] text-start"
          style={{ borderColor: "var(--color-teal-800)", color: "var(--biz)" }} data-testid="biz-suggestion">+ {L2(x.en, x.ar)}</button>)}</div> : null}
      {sys && step !== "launch" && llm ? (
        <div className="space-y-2">
          <div className="flex gap-2"><input value={ask} onChange={(e) => setAsk(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && ask.trim().length > 3) propose(); }} dir="auto" className={inp} data-testid="erp-draft-ask"
            placeholder={step === "screens" ? tr("e.g. make it green and show unpaid invoices on the home screen") : step === "logic" ? tr("e.g. Total = Days × Day rate, and VAT 14%") : tr("e.g. add a fuel log table linked to each crane")} />
            <button onClick={propose} disabled={busy || ask.trim().length < 4} aria-label={tr("Show me the change")} className="w-12 h-12 rounded-xl text-[#FFFFFF] flex items-center justify-center shrink-0 disabled:opacity-40" style={{ background: "var(--biz)" }} data-testid="erp-draft-ask-go">
              {busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}</button></div>
          {prop ? <Proposal prop={prop} onApply={() => { run(prop.ops); setProp(null); setAsk(""); }} onCancel={() => setProp(null)} testid="erp-draft-proposal" applyId="erp-draft-apply" /> : null}
        </div>) : null}
    </div>
  );
}

function Proposal({ prop, onApply, onCancel, testid, applyId }) {
  return (
    <div className="rounded-xl bg-[#EEF2F7] p-3 text-[13.5px] space-y-1.5" data-testid={testid}>
      {prop.done.length ? prop.done.map((d, i) => <p key={i} className="flex gap-1.5"><Check size={15} className="shrink-0 mt-0.5" style={{ color: "var(--biz)" }} /><span dir="auto">{d}</span></p>)
        : <p className="text-[#5B6B80]">{tr("No design change found in that.")}</p>}
      {prop.errors.map((d, i) => <p key={"e" + i} className="text-amber-700" dir="auto">⚠ {d}</p>)}
      {prop.done.length ? <div className="flex gap-2 pt-1.5"><button className="h-10 px-4 rounded-xl text-[#FFFFFF] font-bold" style={{ background: "var(--biz)" }} onClick={onApply} data-testid={applyId}>{tr("Apply")}</button>
        <button className="h-10 px-4 rounded-xl border border-[#C3CDDA] bg-[#FFFFFF] font-semibold" onClick={onCancel}>{tr("Cancel")}</button></div> : null}
    </div>
  );
}

// ② Data: the tables and their fields — rename (tap), add a field
function DataStep({ draft, setDraft, run }) {
  const [ren, setRen] = useState(null);
  const [addFor, setAddFor] = useState(null);
  useSubBack(!!ren, () => setRen(null));
  const rename = (name) => {
    setDraft({ ...draft, tables: draft.tables.map((t) => t.id !== ren.tid ? t : ren.fid ? { ...t, fields: t.fields.map((f) => (f.id === ren.fid ? { ...f, name } : f)) } : { ...t, name }) });
    setRen(null);
  };
  return (
    <div className="space-y-3" data-testid="erp-draft">
      {ren ? <RenameSheet title={ren.fid ? tr("Rename field") : tr("Rename table")} value={ren.value} onSave={rename} onClose={() => setRen(null)} /> : null}
      <p className="text-[12.5px] text-[#5B6B80]">{tr("This is the design. Tap any table or field name to rename it — you can change everything else after creating it.")}</p>
      {draft.tables.map((t) => (
        <div key={t.id} className={card + " p-3.5"}>
          <div className="flex items-center justify-between gap-2"><button onClick={() => setRen({ tid: t.id, value: t.name })} className="text-[15.5px] font-extrabold flex items-center gap-1.5 text-start" dir="auto" data-testid="erp-draft-table">{t.name}<Wrench size={12} className="text-[#94A3B8]" /></button>
            <span className="text-[12px] text-[#5B6B80]">{tr("{n} fields", { n: t.fields.length })}</span></div>
          <div className="flex flex-wrap gap-1.5 mt-2">{t.fields.map((f) => <button key={f.id} onClick={() => setRen({ tid: t.id, fid: f.id, value: f.name })} className={"text-[12px] rounded-lg px-2 py-1 " + (f.type === "link" ? "font-semibold" : "bg-[#EEF2F7] text-[#334155]")}
            style={f.type === "link" ? { background: "var(--color-teal-950)", color: "var(--biz)" } : null} dir="auto" data-testid="erp-draft-field">{f.name} <span className="opacity-60">· {tr(E.FIELD_TYPES[f.type])}{f.type === "link" ? " → " + ((draft.tables.find((x) => x.id === f.link) || {}).name || "") : ""}</span></button>)}
            {addFor && addFor.tid === t.id ? null : <button onClick={() => setAddFor({ tid: t.id, name: "", type: "text" })} className="text-[12px] rounded-lg border border-dashed border-[#94A3B8] text-[#475569] px-2 py-1" data-testid="erp-draft-add-field">+ {tr("field")}</button>}</div>
          {addFor && addFor.tid === t.id ? (
            <div className="flex gap-1.5 mt-2.5" data-testid="erp-draft-new-field">
              <input autoFocus value={addFor.name} onChange={(e) => setAddFor({ ...addFor, name: e.target.value })} placeholder={tr("Field name")} className={inp + " h-11 flex-1"} dir="auto" data-testid="erp-draft-new-field-name" />
              <select value={addFor.type} onChange={(e) => setAddFor({ ...addFor, type: e.target.value })} className={inp + " h-11 w-28"}>
                {Object.entries(E.FIELD_TYPES).filter(([k]) => k !== "link" && k !== "formula").map(([k, l]) => <option key={k} value={k}>{tr(l)}</option>)}</select>
              <button className="h-11 px-3 rounded-xl text-[#FFFFFF] font-bold disabled:opacity-40" style={{ background: "var(--biz)" }} disabled={!addFor.name.trim()} onClick={() => { const r = run([{ op: "addField", table: t.id, name: addFor.name.trim(), type: addFor.type }]); if (r.done.length) setAddFor(null); }} data-testid="erp-draft-new-field-save">{tr("Add")}</button>
              <button className="h-11 w-11 rounded-xl border border-[#C3CDDA] bg-[#FFFFFF] flex items-center justify-center" onClick={() => setAddFor(null)} aria-label={tr("Cancel")}><X size={15} /></button>
            </div>) : null}
        </div>))}
    </div>
  );
}

// ③ Logic: what the system works out and checks by itself
function LogicStep({ draft, run }) {
  const links = [], formulas = [], required = [], autos = [];
  for (const t of draft.tables) for (const f of t.fields) {
    if (f.type === "link") links.push(`${t.name} › ${f.name} → ${(draft.tables.find((x) => x.id === f.link) || {}).name || "?"}`);
    if (f.type === "formula") formulas.push(`${t.name} › ${f.name} = ${E.formulaToNames(f.formula, t)}`);
    if (f.required) required.push(`${t.name} › ${f.name}`);
    if (f.type === "auto") autos.push(`${t.name} › ${f.name} (${f.prefix || ""}0001…)`);
  }
  const [add, setAdd] = useState({ table: draft.tables[0] ? draft.tables[0].id : "", name: "", formula: "" });
  const Box = ({ title, items, empty, testid }) => (
    <div className={card + " p-3.5 space-y-1.5"} data-testid={testid}><p className="text-[13px] font-bold">{title}</p>
      {items.length ? items.map((x, i) => <p key={i} className="text-[13.5px] text-[#334155]" dir="auto">{x}</p>) : <p className="text-[13px] text-[#5B6B80]">{empty}</p>}</div>);
  return (
    <div className="space-y-3">
      <Box title={tr("Calculations")} items={formulas} empty={tr("None yet — add one below or tap a suggestion.")} testid="biz-logic-formulas" />
      <div className={card + " p-3.5 space-y-2"}>
        <p className="text-[13px] font-bold">{tr("Add a calculation")}</p>
        <div className="grid grid-cols-2 gap-2"><select value={add.table} onChange={(e) => setAdd({ ...add, table: e.target.value })} className={inp + " h-11"}>{draft.tables.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          <input value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} placeholder={tr("Name, e.g. Total")} className={inp + " h-11"} dir="auto" data-testid="biz-calc-name" /></div>
        <input value={add.formula} onChange={(e) => setAdd({ ...add, formula: e.target.value })} placeholder={tr("e.g. [Days] * [Day rate]")} className={inp + " h-11"} dir="ltr" data-testid="biz-calc-formula" />
        {(() => { const t = draft.tables.find((x) => x.id === add.table); return t ? <p className="text-[11.5px] text-[#5B6B80]" dir="auto">{tr("Fields:")} {t.fields.filter((f) => f.type === "number" || f.type === "money" || f.type === "formula").map((f) => `[${f.name}]`).join(" ") || "—"}</p> : null; })()}
        <button className="h-11 px-4 rounded-xl text-[#FFFFFF] font-bold disabled:opacity-40" style={{ background: "var(--biz)" }} disabled={!add.name.trim() || !add.formula.trim()} data-testid="biz-calc-add"
          onClick={() => { const r = run([{ op: "addField", table: add.table, name: add.name.trim(), type: "formula", formula: add.formula.trim() }]); if (r.done.length) setAdd({ ...add, name: "", formula: "" }); }}>{tr("Add")}</button>
      </div>
      <Box title={tr("Links between tables")} items={links} empty={tr("No links — a linked field picks a record from another table.")} testid="biz-logic-links" />
      <Box title={tr("Must be filled in")} items={required} empty={tr("Nothing is required yet.")} testid="biz-logic-required" />
      {autos.length ? <Box title={tr("Automatic numbers")} items={autos} empty="" testid="biz-logic-auto" /> : null}
    </div>
  );
}

// ④ Screens: colour, home screen, computer menu, spacing — with a live phone + computer preview
export function ScreensEditor({ sys, run }) {
  const u = SC.uiOf(sys), ar = getLang() === "ar";
  // one system, two layouts: the tables, rules, colour and records are shared; the home screen, menu and form columns can differ
  const [dev, setDev] = useSticky("biz:device", "phone");
  const home = SC.homeFor(sys, dev), own = dev === "computer" && !!u.homeComputer;
  const setHome = (next) => run([{ op: "setHome", parts: next, device: dev === "computer" ? "computer" : u.homeComputer ? "phone" : "both" }], true);
  const seg = (on) => "flex-1 h-10 rounded-lg text-[13px] font-semibold " + (on ? "text-[#FFFFFF]" : "bg-[#EEF2F7]");
  return (
    <div className="space-y-3" data-testid="biz-screens">
      <div className={card + " p-1.5 grid grid-cols-2 gap-1.5"} role="tablist" aria-label={tr("Design for")}>
        {[["phone", tr("Phone"), Smartphone], ["computer", tr("Computer"), Monitor]].map(([k, l, I]) => (
          <button key={k} role="tab" aria-selected={dev === k} onClick={() => setDev(k)} data-testid={"biz-device-" + k}
            className={"h-11 rounded-xl text-[14px] font-bold flex items-center justify-center gap-2 " + (dev === k ? "text-[#FFFFFF]" : "text-[#334155]")} style={dev === k ? { background: "var(--biz)" } : null}><I size={17} />{l}</button>))}
      </div>
      <p className="text-[12.5px] text-[#5B6B80] px-1" data-testid="biz-device-note">{tr("One system on both: the same tables, rules and records. The phone and the computer can each have their own layout.")}</p>
      <Previews sys={sys} focus={dev} />
      <div className={card + " p-3.5 space-y-2.5"}>
        <p className="text-[13px] font-bold flex items-center gap-1.5"><Palette size={15} />{tr("Colour")} <span className="font-normal text-[#5B6B80]">· {tr("both")}</span></p>
        <div className="flex flex-wrap gap-2.5">{Object.entries(SC.COLORS).map(([k, c]) => (
          <button key={k} onClick={() => run([{ op: "setColor", color: k }], true)} aria-label={ar ? SC.COLORS_AR[k] : k} aria-pressed={u.color === k} data-testid={"biz-color-" + k}
            className="w-11 h-11 rounded-full" style={{ background: c, boxShadow: u.color === k ? `0 0 0 3px #fff, 0 0 0 5px ${c}` : "none" }} />))}</div>
      </div>
      <div className={card + " p-3.5 space-y-2.5"}>
        <p className="text-[13px] font-bold">{dev === "computer" ? tr("Computer home screen shows") : tr("Phone home screen shows")}{dev === "computer" && !own ? <span className="font-normal text-[#5B6B80]"> · {tr("same as the phone")}</span> : null}</p>
        <div className="flex flex-wrap gap-2">{Object.keys(SC.HOME_PARTS).map((p) => { const on = home.includes(p);
          return <button key={p} onClick={() => { const next = on ? home.filter((x) => x !== p) : [...home, p]; if (next.length) setHome(next); }} aria-pressed={on} data-testid={"biz-home-" + p}
            className={"px-3 py-2 rounded-xl text-[13px] font-semibold " + (on ? "text-[#FFFFFF]" : "bg-[#EEF2F7] text-[#334155]")} style={on ? { background: "var(--biz)" } : null}>{on ? "✓ " : ""}{ar ? SC.HOME_PARTS_AR[p] : SC.HOME_PARTS[p]}</button>; })}</div>
        {own ? <button onClick={() => run([{ op: "setHome", parts: u.home }], true)} className="text-[13px] font-semibold underline" style={{ color: "var(--biz)" }} data-testid="biz-home-same">{tr("Use the phone's home screen here too")}</button> : null}
      </div>
      {dev === "computer" ? <div className="grid grid-cols-2 gap-3">
        <div className={card + " p-3.5 space-y-2"}><p className="text-[13px] font-bold">{tr("Menu")}</p>
          <div className="flex gap-1.5">{[["left", tr("Left")], ["top", tr("Top")]].map(([k, l]) => <button key={k} onClick={() => run([{ op: "setMenu", position: k }], true)} className={seg(u.menu === k)} style={u.menu === k ? { background: "var(--biz)" } : null} data-testid={"biz-menu-" + k}>{l}</button>)}</div></div>
        <div className={card + " p-3.5 space-y-2"}><p className="text-[13px] font-bold">{tr("Form columns")}</p>
          <div className="flex gap-1.5">{[1, 2, 3].map((n) => <button key={n} onClick={() => run([{ op: "setFormColumns", columns: n }], true)} className={seg(u.formCols === n)} style={u.formCols === n ? { background: "var(--biz)" } : null} data-testid={"biz-formcols-" + n}>{n}</button>)}</div></div>
      </div> : null}
      <div className={card + " p-3.5 space-y-2"}><p className="text-[13px] font-bold">{tr("Spacing")} <span className="font-normal text-[#5B6B80]">· {tr("both")}</span></p>
        <div className="flex gap-1.5">{[["comfortable", tr("Roomy")], ["compact", tr("Compact")]].map(([k, l]) => <button key={k} onClick={() => run([{ op: "setDensity", density: k }], true)} className={seg(u.density === k)} style={u.density === k ? { background: "var(--biz)" } : null}>{l}</button>)}</div></div>
    </div>
  );
}

// the live previews, drawn from the real design (tables, key numbers, colour, menu)
function Previews({ sys, focus = null }) {
  const u = SC.uiOf(sys), c = SC.colorOf(sys), kp = u.kpis.slice(0, 3), hp = SC.homeFor(sys, "phone"), hc = SC.homeFor(sys, "computer");
  const ring = (d) => (focus === d ? { boxShadow: `0 0 0 3px ${c}55`, borderColor: c } : focus ? { opacity: 0.55 } : null);
  const bars = (n) => Array.from({ length: n }, (_, i) => <span key={i} className="block h-1.5 rounded-full bg-[#DCE3EC]" style={{ width: 60 + ((i * 23) % 40) + "%" }} />);
  return (
    <div className="flex gap-3 items-end" data-testid="biz-previews" aria-label={tr("Preview")}>
      <div className="w-[34%] max-w-[150px] shrink-0">
        <div className="rounded-[18px] border-[3px] border-[#0F172A] bg-[#FFFFFF] overflow-hidden aspect-[9/17] flex flex-col transition-all" style={ring("phone")} data-testid="biz-preview-phone">
          <div className="px-2 py-2 text-[#FFFFFF] text-[8.5px] font-bold truncate" style={{ background: c }}>{sys.name}</div>
          <div className="p-1.5 space-y-1.5 flex-1">
            {hp.includes("alerts") ? <span className="block rounded bg-[#FEF3C7] px-1 py-0.5 text-[7px] text-[#92400E] truncate">⚠ {tr("Alerts")}</span> : null}
            {hp.includes("kpis") ? <div className="grid grid-cols-3 gap-1">{kp.map((k, i) => <span key={i} className="rounded bg-[#EEF2F7] p-1 text-[7px] leading-tight"><b className="block text-[9px]">{SC.kpiValue(sys, k)}</b><span className="block truncate">{k.label}</span></span>)}</div> : null}
            {hp.includes("chart") ? <div className="flex items-end gap-0.5 h-6">{[5, 9, 6, 12, 8].map((h, i) => <span key={i} className="flex-1 rounded-sm" style={{ height: h * 2, background: c, opacity: 0.75 }} />)}</div> : null}
            {sys.tables.slice(0, u.density === "compact" ? 6 : 4).map((t) => <span key={t.id} className="block rounded bg-[#EEF2F7] px-1 py-1 text-[7.5px] truncate">{t.name}</span>)}
          </div>
        </div>
        <p className="text-[11px] text-[#5B6B80] text-center mt-1">{tr("Phone")}</p>
      </div>
      <div className="flex-1 min-w-0">
        <div className={"rounded-lg border-[3px] border-[#0F172A] bg-[#FFFFFF] overflow-hidden aspect-[16/10] flex transition-all " + (u.menu === "top" ? "flex-col" : "")} style={ring("computer")} data-testid="biz-preview-desktop">
          <div className={(u.menu === "top" ? "h-5 px-2 flex items-center gap-2" : "w-[22%] p-1.5 space-y-1") + " shrink-0"} style={{ background: u.menu === "top" ? c : "#0F172A" }}>
            {sys.tables.slice(0, 5).map((t) => <span key={t.id} className={(u.menu === "top" ? "text-[#FFFFFFE6]" : "block text-[#CBD5E1]") + " text-[7px] truncate"}>{t.name}</span>)}</div>
          <div className="flex-1 p-1.5 space-y-1">
            {hc.includes("kpis") ? <div className="grid grid-cols-3 gap-1">{kp.map((k, i) => <span key={i} className="rounded p-1 text-[7px]" style={{ background: i === 0 ? "var(--color-teal-950)" : "#F1F5F9" }}><b className="block text-[8.5px]">{SC.kpiValue(sys, k)}</b><span className="block truncate">{k.label}</span></span>)}</div> : null}
            <div className="grid grid-cols-2 gap-1" data-testid="biz-preview-desktop-parts">
              {hc.includes("chart") ? <div className="flex items-end gap-0.5 h-7 rounded bg-[#F8FAFC] p-0.5" data-part="chart">{[5, 9, 6, 12, 8, 10].map((h, i) => <span key={i} className="flex-1 rounded-sm" style={{ height: h * 2, background: c, opacity: 0.75 }} />)}</div> : null}
              {hc.includes("alerts") ? <span className="block rounded bg-[#FEF3C7] px-1 py-0.5 text-[7px] text-[#92400E] h-fit" data-part="alerts">⚠ {tr("Alerts")}</span> : null}
              {hc.includes("latest") || hc.includes("tables") ? <div className="space-y-1 col-span-2">{bars(u.density === "compact" ? 5 : 3)}</div> : null}
            </div>
          </div>
        </div>
        <p className="text-[11px] text-[#5B6B80] text-center mt-1">{tr("Computer")}</p>
      </div>
    </div>
  );
}

// ⑤ Launch: a summary and what to check
function LaunchStep({ draft, edit }) {
  const n = draft.tables.reduce((a, t) => a + t.fields.length, 0), rules = draft.tables.reduce((a, t) => a + t.fields.filter((f) => f.type === "formula" || f.type === "link" || f.required).length, 0);
  const chk = BS.checks(draft);
  return (
    <div className="space-y-3" data-testid="biz-launch">
      <div className="rounded-2xl p-5 text-[#FFFFFF] space-y-1" style={{ background: "var(--biz)" }}>
        <p className="text-[22px] font-extrabold" dir="auto">{draft.name}</p>
        <p className="text-[13.5px] opacity-90">{tr("{t} tables · {f} fields · {r} rules", { t: draft.tables.length, f: n, r: rules })}</p>
      </div>
      <Previews sys={draft} />
      {chk.length ? <div className={card + " p-3.5 space-y-1"}><p className="text-[13px] font-bold">{tr("Worth a look")}</p>{chk.map((x, i) => <p key={i} className="text-[13px] text-amber-700">⚠ {L2(x.en, x.ar)}</p>)}</div> : null}
      {!edit ? <p className="text-[12.5px] text-[#5B6B80]">{tr("After creating it: add records, ask questions about them, and send it to your team as one app file (Tables → More). Everything here can be changed later — with the steps or by asking the AI.")}</p> : null}
    </div>
  );
}

// ---- a system: Home · Tables · Form · Reports, the AI design chat on every tab, the steps one tap away --------------------
function SystemShell({ sys, setSys, llm, modelReady, openEngine, flash, saveFile, share, runPy, onBack, onDelete }) {
  const [tab, setTab] = useSticky("biz:tab", "home");
  const [chat, setChat] = useState(false);
  const [studio, setStudio] = useState(false);
  const [formT, setFormT] = useState(null);
  const wide = useWide();
  useSubBack(chat, () => setChat(false));
  useSubBack(studio, () => setStudio(false));
  const c = SC.colorOf(sys), u = SC.uiOf(sys);
  if (studio) return <div style={accentVars(c)}><Builder existing={sys} startAt={3} llm={llm} modelReady={modelReady} openEngine={openEngine} flash={flash} onBack={() => setStudio(false)} onSave={(d) => setSys(d)} onCreate={() => setStudio(false)} /></div>;
  const tabs = [["home", tr("Home"), LayoutGrid], ["tables", tr("Tables"), Database], ["form", tr("Form"), FileText], ["reports", tr("Reports"), BarChart3]];
  const undo = sys.history && sys.history.length ? () => { const x = E.undo(sys); if (x) setSys(x.sys, tr("Undone: {w}", { w: x.what })); } : null;
  const go = (t, tid) => { if (tid) setFormT(tid); setTab(t); };
  const body = tab === "home" ? <HomeDash sys={sys} go={go} askAI={() => setChat(true)} wide={wide} />
    : tab === "tables" ? <SystemView sys={sys} setSys={setSys} llm={llm} modelReady={modelReady} flash={flash} saveFile={saveFile} share={share} runPy={runPy} onBack={onBack} onDelete={onDelete} embedded />
    : tab === "form" ? <AccessForm sys={sys} setSys={setSys} flash={flash} tid={formT} setTid={setFormT} cols={wide ? u.formCols : 1} />
    : <Reports sys={sys} />;
  const fab = modelReady ? <button onClick={() => setChat(true)} className="fixed end-4 z-40 h-14 ps-4 pe-5 rounded-full text-[#FFFFFF] font-bold shadow-lg flex items-center gap-2" style={{ background: c, bottom: wide ? "24px" : "calc(84px + env(safe-area-inset-bottom))" }} data-testid="biz-ai-open">
    <Sparkles size={18} />{tr("Change with AI")}</button> : null;
  const chatSheet = chat ? <DesignChat sys={sys} setSys={setSys} llm={llm} flash={flash} onClose={() => setChat(false)} /> : null;
  const round = "w-11 h-11 rounded-full bg-[#FFFFFF33] flex items-center justify-center";
  const backBtn = <button onClick={onBack} aria-label={tr("Back")} className={round + " shrink-0"} data-testid="biz-back"><ChevronLeft size={20} className="rtl:-scale-x-100" /></button>;
  const undoBtn = undo ? <button onClick={undo} aria-label={tr("Undo")} className={round + " shrink-0"} data-testid="biz-sys-undo"><Undo2 size={18} /></button> : null;
  const designBtn = <button onClick={() => setStudio(true)} className="h-10 px-3.5 rounded-full bg-[#FFFFFF33] text-[13px] font-bold flex items-center gap-1.5 shrink-0" data-testid="biz-open-studio"><Palette size={15} />{tr("Design")}</button>;
  const sub = tr("{n} tables", { n: sys.tables.length }) + (E.isActive(sys) ? "" : " · " + tr("Trial"));

  // ---- the computer layout: the same system, a menu on the left or on top, wider pages ----
  if (wide && u.menu === "left") return (
    <section className="flex min-h-screen" style={accentVars(c)} data-testid="biz-system" data-layout="computer-left">
      <div className="w-64 shrink-0 sticky top-0 h-screen overflow-y-auto text-[#FFFFFF] flex flex-col p-3 gap-1" style={{ background: c }}>
        <div className="flex items-center gap-2 mb-2">{backBtn}<span className="flex-1" />{undoBtn}</div>
        <p className="text-[20px] font-extrabold px-2 leading-tight" dir="auto" data-testid="biz-system-title">{sys.name}</p>
        <p className="text-[12.5px] opacity-85 px-2 mb-3">{sub}</p>
        <nav className="flex flex-col gap-1" data-testid="biz-nav">{tabs.map(([k, l, I]) => (
          <button key={k} onClick={() => setTab(k)} aria-current={tab === k ? "page" : undefined} data-testid={"biz-tab-" + k} className={"h-11 px-3 rounded-xl flex items-center gap-3 text-[14px] font-semibold text-start " + (tab === k ? "bg-[#FFFFFF] " : "hover:bg-[#FFFFFF22]")} style={tab === k ? { color: c } : null}><I size={19} />{l}</button>))}</nav>
        <p className="text-[11px] font-bold uppercase tracking-wide opacity-75 px-3 mt-4 mb-1">{tr("Tables")}</p>
        {sys.tables.map((t) => <button key={t.id} onClick={() => go("form", t.id)} className="h-9 px-3 rounded-lg text-[13.5px] text-start truncate hover:bg-[#FFFFFF22] flex justify-between gap-2" dir="auto"><span className="truncate">{t.name}</span><span className="opacity-75 tabular-nums">{(sys.rows[t.id] || []).length}</span></button>)}
        <div className="mt-auto pt-3">{designBtn}</div>
      </div>
      <div className="flex-1 min-w-0 px-6 py-5 pb-24"><div className="max-w-6xl mx-auto">{body}</div></div>
      {fab}{chatSheet}
    </section>
  );
  if (wide) return (
    <section className="pb-24" style={accentVars(c)} data-testid="biz-system" data-layout="computer-top">
      <div className="text-[#FFFFFF] sticky top-0 z-30" style={{ background: c }}>
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center gap-3">
          {backBtn}
          <p className="text-[18px] font-extrabold truncate max-w-[30%]" dir="auto" data-testid="biz-system-title">{sys.name}</p>
          <nav className="flex gap-1 ms-3" data-testid="biz-nav">{tabs.map(([k, l, I]) => (
            <button key={k} onClick={() => setTab(k)} aria-current={tab === k ? "page" : undefined} data-testid={"biz-tab-" + k} className={"h-10 px-3.5 rounded-full flex items-center gap-2 text-[13.5px] font-semibold " + (tab === k ? "bg-[#FFFFFF]" : "hover:bg-[#FFFFFF22]")} style={tab === k ? { color: c } : null}><I size={17} />{l}</button>))}</nav>
          <span className="flex-1" />{undoBtn}{designBtn}
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-5 pt-5">{body}</div>
      {fab}{chatSheet}
    </section>
  );
  // ---- the phone layout ----
  return (
    <section className="pb-28" style={accentVars(c)} data-testid="biz-system" data-layout="phone">
      <div className="text-[#FFFFFF] px-3 pt-2 pb-4 rounded-b-3xl" style={{ background: c }}>
        <div className="flex items-center gap-2">{backBtn}<span className="flex-1" />{undoBtn}{designBtn}</div>
        <p className="text-[24px] font-extrabold mt-2 px-1" dir="auto" data-testid="biz-system-title">{sys.name}</p>
        <p className="text-[12.5px] opacity-85 px-1">{sub}</p>
      </div>
      <div className="px-3 pt-3">{body}</div>
      {fab}
      <nav className="att-shift fixed bottom-0 inset-x-0 z-40 bg-[#FFFFFF] border-t border-[#DCE3EC]" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} data-testid="biz-nav">
        <div className="max-w-3xl mx-auto grid grid-cols-4 h-[64px]">{tabs.map(([k, l, I]) => (
          <button key={k} onClick={() => setTab(k)} aria-current={tab === k ? "page" : undefined} data-testid={"biz-tab-" + k} className="flex flex-col items-center justify-center gap-0.5 text-[11.5px] font-semibold" style={{ color: tab === k ? c : "#64748B" }}><I size={21} />{l}</button>))}</div>
      </nav>
      {chatSheet}
    </section>
  );
}

function HomeDash({ sys, go, askAI, wide = false }) {
  const u = SC.uiOf(sys), parts = SC.homeFor(sys, wide ? "computer" : "phone"), al = BS.alerts(sys), ch = BS.chartData(sys);
  const latest = sys.tables.map((t) => ({ t, r: (sys.rows[t.id] || []).slice(-1)[0] })).filter((x) => x.r).sort((a, b) => (b.r._u || b.r._c || 0) - (a.r._u || a.r._c || 0)).slice(0, 4);
  const part = {
    kpis: <div key="kpis" className={"grid gap-2.5 " + (wide ? "col-span-2" : "grid-cols-3")} style={wide ? { gridTemplateColumns: `repeat(${Math.max(1, Math.min(6, u.kpis.length))}, minmax(0, 1fr))` } : null} data-testid="biz-kpis">{u.kpis.slice(0, 6).map((k, i) => (
      <div key={i} className={card + " p-3"}><p className="text-[22px] font-extrabold tabular-nums leading-tight" style={i === 0 ? { color: "var(--biz)" } : null}>{SC.kpiValue(sys, k).toLocaleString()}</p><p className="text-[11.5px] text-[#5B6B80] leading-snug" dir="auto">{k.label}</p></div>))}</div>,
    latest: <div key="latest" className={card + " p-3.5 space-y-2"} data-testid="biz-latest"><p className="text-[13px] font-bold">{tr("Latest records")}</p>
      {latest.length ? latest.map(({ t, r }) => <button key={t.id} onClick={() => go("form", t.id)} className="w-full flex justify-between gap-2 text-start text-[13.5px]"><span className="truncate" dir="auto">{E.displayOf(t, r)}</span><span className="text-[#5B6B80] shrink-0">{t.name}</span></button>)
        : <p className="text-[13px] text-[#5B6B80]">{tr("No records yet — open the Form tab to add the first one.")}</p>}</div>,
    chart: <div key="chart" className={card + " p-3.5 space-y-2"} data-testid="biz-chart"><p className="text-[13px] font-bold" dir="auto">{ch ? ch.title : tr("Chart")}</p>
      {ch ? (() => { const mx = Math.max(1, ...ch.rows.map((r) => r.value)); return ch.rows.map((r, i) => <div key={i} className="flex items-center gap-2 text-[12.5px]"><span className="w-24 truncate text-[#475569]" dir="auto">{r.label}</span><span className="flex-1 h-3 rounded-full bg-[#EEF2F7]"><span className="block h-3 rounded-full" style={{ width: (r.value / mx) * 100 + "%", background: "var(--biz)" }} /></span><span className="tabular-nums w-16 text-end">{r.value.toLocaleString()}</span></div>); })()
        : <p className="text-[13px] text-[#5B6B80]">{tr("No records yet — open the Form tab to add the first one.")}</p>}</div>,
    alerts: <div key="alerts" className={card + " p-3.5 space-y-1.5"} data-testid="biz-alerts"><p className="text-[13px] font-bold">{tr("Alerts")}</p>
      {al.length ? al.map((a, i) => <button key={i} onClick={() => go("form", a.table.id)} className="w-full text-start text-[13px] text-amber-700" dir="auto">⚠ {a.table.name}: {E.displayOf(a.table, a.row)} — {tr("missing")} {a.missing.join(", ")}</button>) : <p className="text-[13px] text-emerald-700">✓ {tr("Nothing missing")}</p>}</div>,
    tables: <div key="tables" className={wide ? "grid grid-cols-2 gap-2.5 col-span-2" : "space-y-2"} data-testid="biz-home-tables">{sys.tables.map((t) => (
      <button key={t.id} onClick={() => go("form", t.id)} className={card + " w-full p-3.5 flex items-center justify-between text-start"}><span className="font-bold text-[14.5px]" dir="auto">{t.name}</span><span className="text-[13px] text-[#5B6B80]">{tr("{n} records", { n: (sys.rows[t.id] || []).length })}</span></button>))}</div>,
    ask: <button key="ask" onClick={askAI} className={card + " w-full p-4 text-start flex items-center gap-3"}><Sparkles size={18} style={{ color: "var(--biz)" }} /><span className="text-[14px] text-[#475569]">{tr("Ask the AI to change anything in this system")}</span></button>,
  };
  // a computer has room for two columns: the key numbers (top) and the tables (bottom) span both, the rest sit side by side
  return <div className={wide ? "grid grid-cols-2 gap-4 items-start" : "space-y-3"} data-testid="biz-home" data-device={wide ? "computer" : "phone"}>{(wide ? [...parts.filter((p) => p === "kpis"), ...parts.filter((p) => p !== "kpis" && p !== "tables"), ...parts.filter((p) => p === "tables")] : parts).map((p) => part[p]).filter(Boolean)}</div>;
}

// ---- the Access-style form: one record at a time ----------------------------------------------------------------------
export function AccessForm({ sys, setSys, flash, tid, setTid, cols = 1 }) {
  const table = sys.tables.find((t) => t.id === tid) || sys.tables[0];
  const rows = table ? sys.rows[table.id] || [] : [];
  const [at, setAt] = useState(rows.length ? rows.length - 1 : -1);        // -1 = a new record
  const row = at >= 0 ? rows[at] : null;
  const blank = () => Object.fromEntries((table ? table.fields : []).map((f) => [f.id, f.type === "bool" ? false : ""]));
  const fromRow = (r) => Object.fromEntries(table.fields.map((f) => [f.id, r[f.id] == null ? (f.type === "bool" ? false : "") : f.type === "bool" ? !!r[f.id] : String(r[f.id])]));
  const [vals, setVals] = useState(() => (row ? fromRow(row) : blank()));
  const [errs, setErrs] = useState({});
  const [del, setDel] = useState(false);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setAt(table && (sys.rows[table.id] || []).length ? (sys.rows[table.id] || []).length - 1 : -1); }, [table && table.id]);
  useEffect(() => { if (!table) return; setVals(row ? fromRow(row) : blank()); setErrs({}); setDel(false); setDirty(false); }, [at, table && table.id, row && row._id]);
  if (!table) return <p className={card + " p-5 text-[14px] text-[#5B6B80]"}>{tr("No tables — add one with +.")}</p>;
  const computed = row ? E.computeRow(table, row) : null;
  const go = (i) => { if (dirty && !window.confirm(tr("Leave without saving the changes?"))) return; setAt(i); };
  const save = () => {
    const input = {};
    for (const f of table.fields) if (f.type !== "formula" && f.type !== "auto") input[f.id] = vals[f.id];
    const r = row ? E.updateRow(sys, table.id, row._id, input) : E.addRow(sys, table.id, input);
    if (r.errors.length) { setErrs(Object.fromEntries(r.errors.map((e) => [e.field || "_", e.error]))); if (r.errors[0].limit) flash(r.errors[0].error); return; }
    setSys(r.sys, row ? tr("Saved") : tr("Added to {t}", { t: table.name }));
    setDirty(false);
    if (!row) setAt((r.sys.rows[table.id] || []).length - 1);
  };
  const ff = SC.formFields(sys, table), compact = SC.uiOf(sys).density === "compact";
  return (
    <div className="space-y-3" data-testid="biz-form">
      <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]" data-testid="biz-form-tables">{sys.tables.map((t) => (
        <button key={t.id} onClick={() => setTid(t.id)} className={"shrink-0 h-10 px-3.5 rounded-full text-[13.5px] font-semibold " + (t.id === table.id ? "text-[#FFFFFF]" : "bg-[#FFFFFF] border border-[#DCE3EC] text-[#334155]")} style={t.id === table.id ? { background: "var(--biz)" } : null} dir="auto">{t.name}</button>))}</div>
      <div className={card + " overflow-hidden"}>
        {/* the record bar, as in Access: ◀ record 3 of 27 ▶  + new */}
        <div className="flex items-center gap-1 px-2 py-2 border-b border-[#DCE3EC] bg-[#EEF2F7]" data-testid="biz-form-nav">
          <button onClick={() => go(0)} disabled={!rows.length || at === 0} aria-label={tr("First record")} className="w-10 h-10 rounded-lg disabled:opacity-30 flex items-center justify-center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true" className="rtl:-scale-x-100"><path d="M6 5v14M18 6l-7 6 7 6" /></svg></button>
          <button onClick={() => go(at < 0 ? rows.length - 1 : at - 1)} disabled={!rows.length || at === 0} aria-label={tr("Previous record")} className="w-10 h-10 rounded-lg disabled:opacity-30 flex items-center justify-center" data-testid="biz-form-prev"><ChevronLeft size={20} className="rtl:-scale-x-100" /></button>
          <span className="flex-1 text-center text-[13px] font-semibold tabular-nums" data-testid="biz-form-pos">{row ? tr("Record {i} of {n}", { i: at + 1, n: rows.length }) : tr("New record") + (rows.length ? " · " + tr("{n} saved", { n: rows.length }) : "")}</span>
          <button onClick={() => go(at + 1)} disabled={at < 0 || at >= rows.length - 1} aria-label={tr("Next record")} className="w-10 h-10 rounded-lg disabled:opacity-30 flex items-center justify-center" data-testid="biz-form-next"><ChevronRight size={20} className="rtl:-scale-x-100" /></button>
          <button onClick={() => go(-1)} aria-label={tr("New record")} className="h-10 px-3 rounded-lg text-[#FFFFFF] font-bold flex items-center gap-1" style={{ background: "var(--biz)" }} data-testid="biz-form-new"><Plus size={16} />{tr("New")}</button>
        </div>
        <div className={cols > 1 ? "grid gap-x-5 " + (compact ? "p-3 gap-y-2" : "p-4 gap-y-3") : compact ? "p-3 space-y-2" : "p-4 space-y-3"} style={cols > 1 ? { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` } : null} data-testid="biz-form-fields" data-cols={cols}>
          {ff.map(({ field: f, section }) => (
            <React.Fragment key={f.id}>
              {section ? <p className="text-[12px] font-bold tracking-wide uppercase pt-2 border-t border-[#DCE3EC]" style={{ color: "var(--biz)", gridColumn: "1 / -1" }} dir="auto">{section}</p> : null}
              <label style={f.type === "longtext" && cols > 1 ? { gridColumn: "1 / -1" } : null} className={compact ? "grid grid-cols-[38%_1fr] items-center gap-2" : "block"}>
                <span className={"block text-[12.5px] font-semibold text-[#475569] " + (compact ? "" : "mb-1")} dir="auto">{f.name}{f.required ? " *" : ""}</span>
                <span className="block" onInput={() => setDirty(true)} onChange={() => setDirty(true)}><FieldInput sys={sys} f={f} value={vals[f.id]} set={(v) => { setVals((o) => ({ ...o, [f.id]: v })); setDirty(true); }} computed={computed ? computed[f.id] : null} /></span>
                {errs[f.id] ? <span className="block text-[12px] text-amber-700 mt-0.5">{errs[f.id]}</span> : null}
              </label>
            </React.Fragment>))}
          {errs._ ? <p className="text-[12.5px] text-amber-700" style={{ gridColumn: "1 / -1" }}>{errs._}</p> : null}
        </div>
        <div className="flex gap-2 px-4 pb-4">
          <button onClick={save} className={btnP + " flex-1"} style={{ background: "var(--biz)" }} data-testid="biz-form-save"><Save size={17} />{row ? tr("Save") : tr("Add")}</button>
          {row ? <button onClick={() => { if (!del) { setDel(true); return; } setSys(E.deleteRow(sys, table.id, row._id), tr("Deleted")); setAt(Math.min(at, rows.length - 2)); }} className={btnG + (del ? " border-rose-400 text-rose-700" : "")} data-testid="biz-form-delete"><Trash2 size={16} />{del ? tr("Tap again to delete") : tr("Delete")}</button> : null}
        </div>
      </div>
      {/* the subform, as in Access: records in other tables that point at this one */}
      {row ? E.relatedRows(sys, table.id, row._id).map((g) => (
        <div key={g.table.id + g.field} className={card + " p-3.5"} data-testid="biz-form-related">
          <p className="text-[13px] font-bold mb-1.5" dir="auto">{tr("Linked {t} ({n})", { t: g.table.name, n: g.rows.length })} <span className="text-[#5B6B80] font-normal">· {g.field}</span></p>
          {g.rows.slice(0, 20).map((r) => <button key={r._id} onClick={() => { setTid(g.table.id); }} className="block w-full text-start text-[13.5px] py-1 truncate" dir="auto">• {E.displayOf(g.table, r)}</button>)}
        </div>)) : null}
    </div>
  );
}

function Reports({ sys }) {
  const [tid, setTid] = useState(sys.tables[0] && sys.tables[0].id);
  const t = sys.tables.find((x) => x.id === tid) || sys.tables[0];
  const groups = t ? t.fields.filter((f) => f.type === "choice" || f.type === "link" || f.type === "text") : [];
  const nums = t ? t.fields.filter((f) => f.type === "number" || f.type === "money") : [];
  const [g, setG] = useState(""), [v, setV] = useState("");
  const gf = groups.find((f) => f.id === g) || groups[0], vf = nums.find((f) => f.id === v) || nums[0];
  const rows = t && gf ? E.summary(sys, t.id, gf.id, vf ? vf.id : null) : [];
  const mx = Math.max(1, ...rows.map((r) => (vf ? r.sum : r.count)));
  if (!t) return null;
  return (
    <div className="space-y-3" data-testid="biz-reports">
      <div className={card + " p-3.5 grid grid-cols-3 gap-2"}>
        <select value={t.id} onChange={(e) => { setTid(e.target.value); setG(""); setV(""); }} className={inp + " h-11"} aria-label={tr("Table")}>{sys.tables.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <select value={gf ? gf.id : ""} onChange={(e) => setG(e.target.value)} className={inp + " h-11"} aria-label={tr("Group by")}>{groups.map((f) => <option key={f.id} value={f.id}>{tr("by")} {f.name}</option>)}</select>
        <select value={vf ? vf.id : ""} onChange={(e) => setV(e.target.value)} className={inp + " h-11"} aria-label={tr("Total of")}><option value="">{tr("count")}</option>{nums.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
      </div>
      <div className={card + " p-3.5 space-y-2"}>
        {rows.length ? rows.slice(0, 12).map((r, i) => <div key={i} className="flex items-center gap-2 text-[13px]"><span className="w-28 truncate" dir="auto">{r.group}</span>
          <span className="flex-1 h-3.5 rounded-full bg-[#EEF2F7]"><span className="block h-3.5 rounded-full" style={{ width: ((vf ? r.sum : r.count) / mx) * 100 + "%", background: "var(--biz)" }} /></span>
          <span className="tabular-nums w-20 text-end font-semibold">{(vf ? r.sum : r.count).toLocaleString()}</span></div>)
          : <p className="text-[13px] text-[#5B6B80]">{tr("No records yet")}</p>}
      </div>
    </div>
  );
}

// ---- the design chat: say it in your words, see the change, apply or undo -------------------------------------------------
function DesignChat({ sys, setSys, llm, flash, onClose }) {
  const [log, setLog] = useState([]);       // { who: "me" | "ai", text, prop? }
  const [ask, setAsk] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    const q = ask.trim(); if (q.length < 3) return;
    setLog((l) => [...l, { who: "me", text: q }]); setAsk(""); setBusy(true);
    try {
      const j = E.jsonFrom(await llm(E.changeMessages(sys, q), { maxTokens: 1400, temperature: 0.1, json: true }));
      const ops = j && Array.isArray(j.ops) ? j.ops : j && j.op ? [j] : [];
      const dry = E.applyOps(sys, ops);
      setLog((l) => [...l, { who: "ai", prop: { ops, done: dry.done, errors: dry.errors } }]);
    } catch (e) { setLog((l) => [...l, { who: "ai", text: String(e.message || e) }]); }
    setBusy(false);
  };
  return (
    <div className="fixed inset-0 z-[70] bg-[#00000066] flex items-end" onClick={onClose} data-testid="biz-chat">
      <div className="w-full max-w-3xl mx-auto bg-[#FFFFFF] rounded-t-3xl max-h-[88dvh] flex flex-col" onClick={(e) => e.stopPropagation()} style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-[#DCE3EC]"><Sparkles size={18} style={{ color: "var(--biz)" }} /><p className="flex-1 font-extrabold text-[16px]">{tr("Change with AI")}</p>
          {sys.history && sys.history.length ? <button onClick={() => { const u = E.undo(sys); if (u) { setSys(u.sys, tr("Undone: {w}", { w: u.what })); setLog((l) => [...l, { who: "ai", text: tr("Undone: {w}", { w: u.what }) }]); } }} className="h-10 px-3 rounded-full bg-[#EEF2F7] text-[13px] font-semibold flex items-center gap-1" data-testid="biz-chat-undo"><Undo2 size={15} />{tr("Undo")}</button> : null}
          <button onClick={onClose} aria-label={tr("Close")} className="w-10 h-10 rounded-full bg-[#EEF2F7] flex items-center justify-center"><X size={17} /></button></div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3" data-testid="biz-chat-log">
          {!log.length ? <div className="space-y-2"><p className="text-[14px] text-[#475569]">{tr("Tell me what to change — the tables, the calculations or how it looks. I show the change first; nothing happens until you tap Apply.")}</p>
            {[tr("Make it green instead of blue"), tr("Show alerts first on the home screen"), tr("Put the phone number at the top of the customer form"), tr("On a computer, put the menu on top")].map((x) => (
              <button key={x} onClick={() => setAsk(x)} className="block w-full text-start px-3.5 py-2.5 rounded-xl bg-[#EEF2F7] text-[13.5px]">{x}</button>))}</div> : null}
          {log.map((m, i) => m.who === "me" ? <p key={i} className="ms-auto max-w-[85%] w-fit rounded-2xl rounded-ee-md px-3.5 py-2.5 text-[#FFFFFF] text-[14px]" style={{ background: "var(--biz)" }} dir="auto">{m.text}</p>
            : m.prop ? <div key={i} className="max-w-[92%]"><Proposal prop={m.prop} testid="biz-chat-proposal" applyId="biz-chat-apply" onCancel={() => setLog((l) => l.map((x, j) => (j === i ? { who: "ai", text: tr("Cancelled") } : x)))}
              onApply={() => { const r = E.applyOps(sys, m.prop.ops); if (r.done.length) setSys(r.sys, r.done[r.done.length - 1]); if (r.errors.length) flash(r.errors[0]); setLog((l) => l.map((x, j) => (j === i ? { who: "ai", text: "✓ " + r.done.join(" · ") } : x))); }} /></div>
            : <p key={i} className="max-w-[92%] rounded-2xl rounded-es-md bg-[#EEF2F7] px-3.5 py-2.5 text-[13.5px]" dir="auto">{m.text}</p>)}
          {busy ? <p className="text-[13px] text-[#5B6B80] flex items-center gap-2"><Loader2 size={15} className="animate-spin" />{tr("Working it out…")}</p> : null}
        </div>
        <div className="p-3 border-t border-[#DCE3EC] flex gap-2">
          <input value={ask} onChange={(e) => setAsk(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} dir="auto" placeholder={tr("e.g. make the colour green and show unpaid invoices on the home screen")} className={inp} data-testid="biz-chat-input" />
          <button onClick={send} disabled={busy || ask.trim().length < 3} aria-label={tr("Send")} className="w-12 h-12 rounded-xl text-[#FFFFFF] flex items-center justify-center shrink-0 disabled:opacity-40" style={{ background: "var(--biz)" }} data-testid="biz-chat-send"><Send size={18} /></button>
        </div>
      </div>
    </div>
  );
}
