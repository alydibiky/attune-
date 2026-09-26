/* ---- More → Business: an ERP the owner designs and reshapes, like Microsoft Access --------
   Systems list → a system: its tables as tabs; each table has
     Data     records in a grid (search, sort, totals); tap one to edit it
     Design   the columns: rename, change type, reorder, add, delete — or
              say the change in words and the AI proposes it (shown first)
     Summary  totals grouped by any column
   Plus import from Excel/CSV, export to CSV, undo, and a licence per system.
   The logic is in erp.js; this file is only the screens.                  */
import React, { useState, useEffect, useMemo, useRef } from "react";
import { Plus, Trash2, Search, Database, ArrowUp, ArrowDown, Undo2, Upload, Download, KeyRound, BarChart3, Wrench, Sparkles, ChevronLeft, Check, X, Copy, Share2, Lock, AlertTriangle, Loader2, PenLine, FileText } from "lucide-react";
import { tr } from "./i18n.js";
import * as E from "./erp.js";
import { buildApp, readApp } from "./erp-app.js";

const KEY = "attune:erp:v1";
const field = "w-full min-w-0 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-teal-500";
const btn = "px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-40";
const primary = btn + " bg-teal-500 text-slate-950";
const ghost = btn + " border border-slate-700 text-slate-200";

// ---- storage: one key per system, so one big system doesn't rewrite the rest ----
function loadIndex() { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; } }
function loadSys(id) { try { return JSON.parse(localStorage.getItem(KEY + ":" + id) || "null"); } catch (e) { return null; } }
function saveSys(sys) {
  try {
    localStorage.setItem(KEY + ":" + sys.id, JSON.stringify(sys));
    const idx = loadIndex().filter((x) => x.id !== sys.id);
    idx.unshift({ id: sys.id, name: sys.name, updated: sys.updated, tables: sys.tables.length, active: E.isActive(sys) });
    localStorage.setItem(KEY, JSON.stringify(idx));
    return true;
  } catch (e) { return false; }
}
function dropSys(id) { try { localStorage.removeItem(KEY + ":" + id); localStorage.setItem(KEY, JSON.stringify(loadIndex().filter((x) => x.id !== id))); } catch (e) {} }

const today = () => new Date().toISOString().slice(0, 10);

/** v5.17: tap a name → a small sheet → type the new name → Save. */
function RenameSheet({ title, value, onSave, onClose, extra }) {
  const [v, setV] = useState(value || "");
  return (
    <div className="fixed inset-0 z-[80] bg-black/60 flex items-end" onClick={onClose}>
      <div className="w-full bg-slate-900 border-t border-slate-700 rounded-t-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()} data-testid="erp-rename"
        style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}>
        <p className="text-sm text-slate-200 font-medium">{title}</p>
        <input autoFocus value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && v.trim()) onSave(v.trim()); }} className={field + " text-base"} dir="auto" data-testid="erp-rename-input" />
        <div className="flex gap-2">
          <button className={primary + " flex-1 py-2.5"} disabled={!v.trim()} onClick={() => onSave(v.trim())} data-testid="erp-rename-save">{tr("Save")}</button>
          <button className={ghost + " py-2.5"} onClick={onClose}>{tr("Cancel")}</button>
        </div>
        {extra || null}
      </div>
    </div>
  );
}
/** A long press (or right-click) on something that also has a normal tap. */
function useLongPress(fn, ms = 550) {
  const t = useRef(0), fired = useRef(false);
  const start = (...a) => { fired.current = false; clearTimeout(t.current); t.current = setTimeout(() => { fired.current = true; fn(...a); }, ms); };
  const stop = () => clearTimeout(t.current);
  return { start, stop, fired, bind: (...a) => ({ onTouchStart: () => start(...a), onTouchEnd: stop, onTouchMove: stop, onContextMenu: (e) => { e.preventDefault(); stop(); fired.current = true; fn(...a); } }) };
}

export function BusinessPage({ flash, llm, modelReady, openEngine, saveFile, share, runPy }) {
  const [index, setIndex] = useState(loadIndex);
  const [sys, setSysRaw] = useState(null);
  const [view, setView] = useState("list");            // list | new | system
  const setSys = (next, msg) => {
    if (!saveSys(next)) flash(tr("The phone's storage for Business is full — export a table to CSV and delete old records."));
    setSysRaw(next); setIndex(loadIndex());
    if (msg) flash(msg);
  };
  const open = (id) => { const s = loadSys(id); if (s) { setSysRaw(s); setView("system"); } };

  if (view === "new") return <NewSystem llm={llm} modelReady={modelReady} openEngine={openEngine} flash={flash}
    onBack={() => setView("list")} onCreate={(s) => { setSys(s, tr("Created — {n} tables", { n: s.tables.length })); setView("system"); }} />;
  if (view === "system" && sys) return <SystemView sys={sys} setSys={setSys} llm={llm} modelReady={modelReady} flash={flash} saveFile={saveFile} share={share} runPy={runPy}
    onBack={() => { setView("list"); setSysRaw(null); }} onDelete={() => { dropSys(sys.id); setIndex(loadIndex()); setSysRaw(null); setView("list"); flash(tr("Deleted")); }} />;

  return (
    <section className="p-4 space-y-3" data-testid="business-page">
      <div className="flex items-start gap-3">
        <Database size={22} className="text-teal-300 mt-1" />
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-slate-100">{tr("Business")}</h2>
          <p className="text-[13px] text-slate-400">{tr("Your own ERP: customers, stock, jobs, invoices — whatever your business tracks. Change any table or column later, like Microsoft Access.")}</p>
        </div>
      </div>
      <button className={primary + " w-full flex items-center justify-center gap-1.5 py-2.5"} onClick={() => setView("new")} data-testid="erp-new"><Plus size={16} />{tr("New system")}</button>
      <label className={ghost + " w-full flex items-center justify-center gap-1.5 py-2.5 cursor-pointer"} data-testid="erp-open-app">
        <Upload size={15} />{tr("Open an app file (made with Attune)")}
        <input type="file" accept=".html,.htm,.json,text/html" className="hidden" data-testid="erp-open-app-file" onChange={async (e) => {
          const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
          const s = readApp(await f.text());
          if (!s) { flash(tr("That file isn't an app made with Attune Business.")); return; }
          const had = loadSys(s.id);
          // the app comes back with its data: it replaces the copy here (same system), keeping this phone's activation
          const next = { ...s, licence: had ? had.licence : null, updated: Date.now() };
          setSys(next, had ? tr("Updated from the app file — {n} tables with their records", { n: next.tables.length }) : tr("Opened — {n} tables with their records", { n: next.tables.length }));
          setView("system");
        }} />
      </label>
      {index.length ? index.map((x) => (
        <button key={x.id} onClick={() => open(x.id)} className="w-full text-start rounded-xl border border-slate-800 bg-slate-900/60 p-3 flex items-center gap-3" data-testid="erp-system">
          <Database size={18} className="text-slate-400 shrink-0" />
          <span className="min-w-0 flex-1"><span className="block text-sm text-slate-100 truncate">{x.name}</span>
            <span className="block text-[11px] text-slate-500">{tr("{n} tables", { n: x.tables })} · {new Date(x.updated).toLocaleDateString()}</span></span>
          {x.active ? <span className="text-[10px] text-emerald-300 border border-emerald-800 rounded px-1.5 py-0.5">{tr("Active")}</span>
            : <span className="text-[10px] text-slate-400 border border-slate-700 rounded px-1.5 py-0.5">{tr("Trial")}</span>}
        </button>)) : <p className="text-[13px] text-slate-500 text-center py-6">{tr("No systems yet.")}</p>}
    </section>
  );
}

// ---- a new system: described to the AI, or from a template ----------------------------
function NewSystem({ llm, modelReady, openEngine, flash, onBack, onCreate }) {
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(null);       // a system not saved yet
  const [err, setErr] = useState("");
  const [step, setStep] = useState("");
  const design = async () => {
    setErr(""); setBusy(true); setStep("");
    try {
      // 1) the full design as JSON; 2) the same as simple lines (far easier
      // for a phone-sized model); 3) the closest template, never a dead end.
      let spec = null, how = "ai";
      setStep(tr("Designing the tables…"));
      const out = await llm(E.designMessages(desc), { maxTokens: 2500, temperature: 0.2, json: true });
      const j = E.jsonFrom(out);
      // v5.17: a design whose tables are only an ID ("Clientes: ClienteID") is not a design.
      if (j && E.designQuality(j).ok) spec = j;
      if (!spec) {
        setStep(tr("Trying a simpler way…"));
        const lines = await llm(E.designLinesMessages(desc), { maxTokens: 1500, temperature: 0.2 });
        const sp = E.specFromLines(lines, (j && j.name) || tr("My business"));
        if (sp && E.designQuality(sp).ok) spec = sp;
      }
      if (!spec) { const t = E.guessTemplate(desc); if (t) { spec = t.spec; how = "template"; } }
      if (!spec) setErr(tr("The model didn't produce a usable design. Try again, describe it differently, or start from a template."));
      else {
        setDraft(E.systemFromSpec({ ...spec, business: desc }));
        if (how === "template") flash(tr("Started from the closest template — change anything you like"));
      }
    } catch (e) { setErr(String(e.message || e)); }
    setBusy(false);
  };
  const [ren, setRen] = useState(null);           // { tid, fid?, value }
  // v5.17: fields added to the design before it is created — by hand or by the AI
  const [addFor, setAddFor] = useState(null);     // { tid, name, type }
  const [dAsk, setDAsk] = useState("");
  const [dProp, setDProp] = useState(null);       // { ops, done, errors }
  const [dBusy, setDBusy] = useState(false);
  const draftOps = (ops) => { const r = E.applyOps(draft, ops); if (r.errors.length) flash(r.errors[0]); if (r.done.length) setDraft({ ...r.sys, history: [] }); return r; };
  const proposeDraft = async () => {
    setDBusy(true); setDProp(null);
    try {
      const j = E.jsonFrom(await llm(E.changeMessages(draft, dAsk), { maxTokens: 1200, temperature: 0.1, json: true }));
      const ops = j && Array.isArray(j.ops) ? j.ops : j && j.op ? [j] : [];
      const dry = E.applyOps(draft, ops);
      setDProp({ ops, done: dry.done, errors: dry.errors });
    } catch (e) { flash(String(e.message || e)); }
    setDBusy(false);
  };
  const renameDraft = (name) => {
    setDraft((d) => ({ ...d, tables: d.tables.map((t) => t.id !== ren.tid ? t : ren.fid
      ? { ...t, fields: t.fields.map((f) => (f.id === ren.fid ? { ...f, name } : f)) } : { ...t, name }) }));
    setRen(null);
  };
  if (draft) return (
    <section className="p-4 space-y-3" data-testid="erp-draft">
      {ren ? <RenameSheet title={ren.fid ? tr("Rename field") : tr("Rename table")} value={ren.value} onSave={renameDraft} onClose={() => setRen(null)} /> : null}
      <button onClick={() => setDraft(null)} className="text-slate-400 text-sm flex items-center gap-1"><ChevronLeft size={16} />{tr("Back")}</button>
      <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={field + " text-base font-semibold"} dir="auto" />
      <p className="text-[12px] text-slate-400">{tr("This is the design. Tap any table or field name to rename it — you can change everything else after creating it.")}</p>
      {draft.tables.map((t) => (
        <div key={t.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <button onClick={() => setRen({ tid: t.id, value: t.name })} className="text-sm font-semibold text-slate-100 flex items-center gap-1.5" dir="auto" data-testid="erp-draft-table">{t.name}<PenLine size={12} className="text-slate-500" /></button>
          <div className="flex flex-wrap gap-1.5 mt-1.5">{t.fields.map((f) => <button key={f.id} onClick={() => setRen({ tid: t.id, fid: f.id, value: f.name })} className="text-[11px] rounded-md bg-slate-800 text-slate-300 px-1.5 py-0.5 active:bg-slate-700" dir="auto" data-testid="erp-draft-field">{f.name} <span className="text-slate-500">· {tr(E.FIELD_TYPES[f.type])}{f.type === "link" ? " → " + ((draft.tables.find((x) => x.id === f.link) || {}).name || "") : ""}</span></button>)}
            {addFor && addFor.tid === t.id ? null : <button onClick={() => setAddFor({ tid: t.id, name: "", type: "text" })} className="text-[11px] rounded-md border border-dashed border-slate-600 text-slate-400 px-1.5 py-0.5" data-testid="erp-draft-add-field">+ {tr("field")}</button>}</div>
          {addFor && addFor.tid === t.id ? (
            <div className="flex gap-1.5 mt-2" data-testid="erp-draft-new-field">
              <input autoFocus value={addFor.name} onChange={(e) => setAddFor({ ...addFor, name: e.target.value })} placeholder={tr("Field name")} className={field + " flex-1"} dir="auto" data-testid="erp-draft-new-field-name" />
              <select value={addFor.type} onChange={(e) => setAddFor({ ...addFor, type: e.target.value })} className={field.replace("w-full ", "") + " w-28"}>
                {Object.entries(E.FIELD_TYPES).filter(([k]) => k !== "link" && k !== "formula").map(([k, l]) => <option key={k} value={k}>{tr(l)}</option>)}</select>
              <button className={primary} disabled={!addFor.name.trim()} onClick={() => { const r = draftOps([{ op: "addField", table: t.id, name: addFor.name.trim(), type: addFor.type }]); if (r.done.length) setAddFor(null); }} data-testid="erp-draft-new-field-save">{tr("Add")}</button>
              <button className={ghost} onClick={() => setAddFor(null)}><X size={14} /></button>
            </div>) : null}
        </div>))}
      {llm && modelReady ? (
        <div className="rounded-xl border border-teal-900 bg-teal-500/5 p-2.5 space-y-2" data-testid="erp-draft-ai">
          <p className="text-[12px] text-teal-200 flex items-center gap-1"><Sparkles size={13} />{tr("Change the design in words — add fields to any table, new tables, links…")}</p>
          <textarea value={dAsk} onChange={(e) => setDAsk(e.target.value)} rows={2} dir="auto" className={field} data-testid="erp-draft-ask"
            placeholder={tr("e.g. add Email and Tax ID to Suppliers, and a Warranty months field to Parts")} />
          <button className={primary + " flex items-center gap-1"} disabled={dBusy || dAsk.trim().length < 4} onClick={proposeDraft} data-testid="erp-draft-ask-go">
            {dBusy ? <Loader2 size={14} className="animate-spin" /> : <Wrench size={14} />}{dBusy ? tr("Working it out…") : tr("Show me the change")}</button>
          {dProp ? (
            <div className="rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-[13px] space-y-1" data-testid="erp-draft-proposal">
              {dProp.done.length ? dProp.done.map((d, i) => <p key={i} className="text-slate-200 flex gap-1.5"><Check size={14} className="text-teal-300 shrink-0 mt-0.5" /><span dir="auto">{d}</span></p>)
                : <p className="text-slate-400">{tr("No design change found in that.")}</p>}
              {dProp.errors.map((d, i) => <p key={"e" + i} className="text-amber-300 flex gap-1.5"><AlertTriangle size={14} className="shrink-0 mt-0.5" /><span dir="auto">{d}</span></p>)}
              {dProp.done.length ? <div className="flex gap-2 pt-1">
                <button className={primary} onClick={() => { draftOps(dProp.ops); setDProp(null); setDAsk(""); }} data-testid="erp-draft-apply">{tr("Apply")}</button>
                <button className={ghost} onClick={() => setDProp(null)}>{tr("Cancel")}</button></div> : null}
            </div>) : null}
        </div>) : null}
      <button className={primary + " w-full py-2.5"} onClick={() => onCreate({ ...draft, name: draft.name.trim() || "My business" })} data-testid="erp-create">{tr("Create this system")}</button>
    </section>
  );
  return (
    <section className="p-4 space-y-3" data-testid="erp-newpage">
      <button onClick={onBack} className="text-slate-400 text-sm flex items-center gap-1"><ChevronLeft size={16} />{tr("Back")}</button>
      <h2 className="text-base font-semibold text-slate-100">{tr("Describe your business")}</h2>
      <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} dir="auto" className={field} data-testid="erp-desc"
        placeholder={tr("e.g. We rent mobile cranes (20–500 t) with operators in Egypt. We track customers, jobs per site, daily rates, invoices and payments, maintenance and crew licences.")} />
      {modelReady ? <button className={primary + " w-full flex items-center justify-center gap-1.5 py-2.5"} disabled={busy || desc.trim().length < 15} onClick={design} data-testid="erp-design">
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}{busy ? (step || tr("Designing your system…")) : tr("Design it with AI")}</button>
        : <button className={ghost + " w-full"} onClick={openEngine}>{tr("Load a model to design it with AI — or pick a template below")}</button>}
      {err ? <p className="text-[13px] text-amber-300">{err}</p> : null}
      <p className="text-[12px] text-slate-500 pt-2">{tr("Or start from a template")}</p>
      <div className="grid grid-cols-1 gap-2">
        {E.TEMPLATES.map((t) => (
          <button key={t.id} onClick={() => setDraft(E.systemFromSpec(t.spec))} className="text-start rounded-xl border border-slate-800 bg-slate-900/60 p-3" data-testid={"erp-tpl-" + t.id}>
            <span className="block text-sm text-slate-100">{tr(t.title)}</span><span className="block text-[11px] text-slate-500">{tr(t.blurb)}</span>
          </button>))}
      </div>
    </section>
  );
}

// ---- one system ---------------------------------------------------------------------------
function SystemView({ sys, setSys, llm, modelReady, flash, saveFile, share, runPy, onBack, onDelete }) {
  const [tid, setTid] = useState(sys.tables[0] && sys.tables[0].id);
  const [tab, setTab] = useState("data");         // data | design | queries | forms | summary | more
  const [ren, setRen] = useState(null);            // { kind: "system" | "table", tid?, value }
  const [delAsk, setDelAsk] = useState(false);
  const lp = useLongPress((t) => { setTid(t.id); setRen({ kind: "table", tid: t.id, value: t.name }); });
  const table = sys.tables.find((t) => t.id === tid) || sys.tables[0];
  useEffect(() => { if (!sys.tables.some((t) => t.id === tid) && sys.tables[0]) setTid(sys.tables[0].id); }, [sys]);
  const apply = (ops, label) => {
    const r = E.applyOps(sys, ops, { label });
    if (r.errors.length) flash(r.errors[0]);
    if (r.done.length) setSys(r.sys, r.errors.length ? null : r.done[r.done.length - 1]);
    return r;
  };
  return (
    <section className="p-3 space-y-3" data-testid="erp-systemview">
      {ren ? <RenameSheet title={ren.kind === "system" ? tr("Rename system") : tr("Table “{t}”", { t: (sys.tables.find((x) => x.id === ren.tid) || {}).name || "" })} value={ren.value}
        onClose={() => { setRen(null); setDelAsk(false); }}
        onSave={(name) => { if (ren.kind === "system") setSys({ ...sys, name, updated: Date.now() }, tr("Renamed")); else apply([{ op: "renameTable", table: ren.tid, to: name }]); setRen(null); }}
        extra={ren.kind === "table" ? (
          <div className="flex gap-2 border-t border-slate-800 pt-3">
            <button className={ghost + " flex-1 flex items-center justify-center gap-1"} onClick={() => { setTab("design"); setRen(null); }} data-testid="erp-table-design"><Wrench size={14} />{tr("Edit its columns")}</button>
            <button className={`${btn} border flex-1 ${delAsk ? "border-rose-600 bg-rose-500/15 text-rose-200" : "border-slate-700 text-slate-300"}`}
              onClick={() => { if (!delAsk) { setDelAsk(true); return; } apply([{ op: "deleteTable", table: ren.tid }]); setRen(null); setDelAsk(false); }}>{delAsk ? tr("Tap again to delete") : tr("Delete table")}</button>
          </div>) : null} /> : null}
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1.5 -ms-1.5 text-slate-400" title={tr("Back")}><ChevronLeft size={20} /></button>
        <button onClick={() => setRen({ kind: "system", value: sys.name })} className="text-base font-semibold text-slate-100 truncate flex-1 text-start flex items-center gap-1.5 min-w-0" dir="auto" data-testid="erp-system-name">
          <span className="truncate">{sys.name}</span><PenLine size={13} className="text-slate-500 shrink-0" /></button>
        {sys.history && sys.history.length ? <button onClick={() => { const u = E.undo(sys); if (u) setSys(u.sys, tr("Undone: {w}", { w: u.what })); }} className="p-1.5 text-slate-300" title={tr("Undo last design change")} data-testid="erp-undo"><Undo2 size={18} /></button> : null}
        {!E.isActive(sys) ? <button onClick={() => setTab("more")} className="text-[10px] text-amber-300 border border-amber-800 rounded px-1.5 py-0.5">{tr("Trial")}</button> : null}
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-3 px-3" data-testid="erp-tables">
        {sys.tables.map((t) => (
          <button key={t.id} {...lp.bind(t)} onClick={() => { if (lp.fired.current) return; if (t.id === (table && table.id)) { setRen({ kind: "table", tid: t.id, value: t.name }); return; } setTid(t.id); if (tab === "more") setTab("data"); }} data-testid="erp-table-chip" className={`shrink-0 px-3 py-1.5 rounded-full text-xs border ${t.id === (table && table.id) ? "bg-teal-500/15 border-teal-600 text-teal-200" : "border-slate-700 text-slate-300"}`} dir="auto">
            {t.name} <span className="text-slate-500">{(sys.rows[t.id] || []).length}</span></button>))}
        <button onClick={() => { const r = apply([{ op: "addTable", table: tr("New table"), fields: [{ name: tr("Name"), type: "text" }] }]); if (r.done.length) { setTid(r.sys.tables[r.sys.tables.length - 1].id); setTab("design"); } }}
          className="shrink-0 px-2.5 py-1.5 rounded-full text-xs border border-dashed border-slate-600 text-slate-400" title={tr("Add a table")} data-testid="erp-add-table"><Plus size={13} /></button>
      </div>
      <p className="text-[10px] text-slate-600 -mt-1">{tr("Tap the selected table again (or hold any table) to rename it.")}</p>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-900 p-1">
        {[["data", "Data", Database], ["design", "Design", Wrench], ["queries", "Queries", Search], ["forms", "Forms", FileText], ["summary", "Summary", BarChart3], ["more", "More", KeyRound]].map(([k, l, I]) => (
          <button key={k} onClick={() => setTab(k)} data-testid={"erp-tab-" + k} className={`py-1.5 rounded-lg text-[12px] flex items-center justify-center gap-1 ${tab === k ? "bg-slate-700 text-slate-100" : "text-slate-400"}`}><I size={13} />{tr(l)}</button>))}
      </div>
      {!table ? <p className="text-sm text-slate-500">{tr("No tables — add one with +.")}</p>
        : tab === "data" ? <DataTab sys={sys} table={table} setSys={setSys} llm={modelReady ? llm : null} flash={flash} goMore={() => setTab("more")} />
        : tab === "design" ? <DesignTab sys={sys} table={table} apply={apply} llm={modelReady ? llm : null} flash={flash} />
        : tab === "queries" ? <QueriesTab sys={sys} setSys={setSys} llm={modelReady ? llm : null} flash={flash} />
        : tab === "forms" ? <FormsTab sys={sys} setSys={setSys} llm={modelReady ? llm : null} flash={flash} goTable={(id) => { setTid(id); setTab("data"); }} />
        : tab === "summary" ? <SummaryTab sys={sys} table={table} />
        : <MoreTab sys={sys} table={table} setSys={setSys} flash={flash} saveFile={saveFile} share={share} runPy={runPy} onDelete={onDelete} setTid={setTid} />}
    </section>
  );
}

// ---- Data -----------------------------------------------------------------------------------
function DataTab({ sys, table, setSys, llm, flash, goMore }) {
  const [renF, setRenF] = useState(null);          // { fid, value }
  const lpF = useLongPress((f) => setRenF({ fid: f.id, value: f.name }));
  const forms = (sys.forms || []).filter((x) => x.table === table.id);
  const [formId, setFormId] = useState(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState(null);
  const [editing, setEditing] = useState(null);    // row id | "new"
  const rows = useMemo(() => E.viewRows(sys, table.id, { search, sort }), [sys, table.id, search, sort]);
  const tot = E.totals(table, rows);
  const shown = table.fields.slice(0, 12);
  const full = !E.canAddRow(sys, table.id);
  const toggleSort = (fid) => setSort((s) => (!s || s.field !== fid ? { field: fid, dir: "asc" } : s.dir === "asc" ? { field: fid, dir: "desc" } : null));
  if (editing) return <RecordForm sys={sys} table={table} rowId={editing === "new" ? null : editing} setSys={setSys} llm={llm} flash={flash} onDone={() => setEditing(null)}
    form={editing === "new" ? forms.find((x) => x.id === formId) || null : null} />;
  return (
    <div className="space-y-2">
      {renF ? <RenameSheet title={tr("Rename field")} value={renF.value} onClose={() => setRenF(null)}
        onSave={(name) => { const r = E.applyOps(sys, [{ op: "renameField", table: table.id, field: renF.fid, to: name }], { label: "rename" }); if (r.done.length) setSys(r.sys, tr("Renamed")); else if (r.errors.length) flash(r.errors[0]); setRenF(null); }} /> : null}
      {forms.length ? (
        <div className="flex gap-1.5 overflow-x-auto" data-testid="erp-form-pick">
          <span className="text-[11px] text-slate-500 self-center shrink-0">{tr("New record with:")}</span>
          {[{ id: null, title: tr("All fields") }, ...forms].map((x) => <button key={x.id || "all"} onClick={() => setFormId(x.id)} className={`shrink-0 text-[11px] px-2.5 py-1 rounded-full border ${formId === x.id ? "border-teal-600 text-teal-200 bg-teal-500/10" : "border-slate-700 text-slate-400"}`}>{x.title}</button>)}
        </div>) : null}
      <div className="flex gap-2">
        <label className="relative flex-1 min-w-0"><Search size={14} className="absolute start-2.5 top-2.5 text-slate-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr("Search {t}", { t: table.name })} className={field + " ps-8"} dir="auto" data-testid="erp-search" /></label>
        <button className={primary + " flex items-center gap-1 shrink-0"} onClick={() => (full ? goMore() : setEditing("new"))} data-testid="erp-add-row"><Plus size={14} />{tr("Record")}</button>
      </div>
      {full ? <p className="text-[12px] text-amber-300 flex items-center gap-1"><Lock size={12} />{tr("The trial keeps {n} records per table — activate this system to add more.", { n: E.FREE_ROWS })}</p> : null}
      <div className="overflow-x-auto rounded-xl border border-slate-800" data-testid="erp-grid">
        <table className="text-[12px] text-slate-200 min-w-full">
          <thead className="bg-slate-900 text-slate-400"><tr>
            {shown.map((f) => <th key={f.id} {...lpF.bind(f)} onClick={() => { if (lpF.fired.current) return; toggleSort(f.id); }} className="text-start font-medium px-2.5 py-2 whitespace-nowrap cursor-pointer select-none" dir="auto" data-testid="erp-col">
              {f.name}{sort && sort.field === f.id ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}</th>)}
          </tr></thead>
          <tbody>
            {rows.slice(0, 300).map((r) => (
              <tr key={r._id} onClick={() => setEditing(r._id)} className="border-t border-slate-800/80 active:bg-slate-800" data-testid="erp-row">
                {shown.map((f) => <td key={f.id} className={`px-2.5 py-2 whitespace-nowrap max-w-[14rem] truncate ${E.FIELD_TYPES[f.type] && (f.type === "number" || f.type === "money" || f.type === "formula") ? "text-end tabular-nums" : ""}`} dir="auto">
                  {f.type === "bool" ? (r[f.id] ? "✓" : "") : E.show(sys, f, r[f.id])}</td>)}
              </tr>))}
            {!rows.length ? <tr><td colSpan={shown.length} className="px-3 py-6 text-center text-slate-500">{search ? tr("Nothing matches") : tr("No records yet — tap + Record")}</td></tr> : null}
          </tbody>
          {Object.keys(tot).length && rows.length > 1 ? <tfoot className="bg-slate-900/70 text-slate-300"><tr data-testid="erp-totals">
            {shown.map((f, i) => <td key={f.id} className="px-2.5 py-2 whitespace-nowrap text-end tabular-nums font-semibold">{tot[f.id] != null ? E.show(sys, f.type === "formula" ? { type: "number" } : f, tot[f.id]) : i === 0 ? tr("Total") : ""}</td>)}
          </tr></tfoot> : null}
        </table>
      </div>
      {rows.length > 1 && Object.keys(tot).length ? <p className="text-[12px] text-slate-300 flex flex-wrap gap-x-3" data-testid="erp-total-line">
        {table.fields.filter((f) => tot[f.id] != null && (f.type === "money" || f.type === "formula")).slice(-3).map((f) =>
          <span key={f.id}><span className="text-slate-500">{f.name}:</span> <b className="tabular-nums">{E.show(sys, f.type === "formula" ? { type: "number" } : f, tot[f.id])}</b></span>)}</p> : null}
      <p className="text-[11px] text-slate-500">{tr("{n} records", { n: rows.length })}{table.fields.length > shown.length ? " · " + tr("tap a record to see all {n} fields", { n: table.fields.length }) : ""} · {tr("hold a column name to rename it")}</p>
    </div>
  );
}

function RecordForm({ sys, table, rowId, setSys, llm, flash, onDone, form }) {
  const row = rowId ? (sys.rows[table.id] || []).find((r) => r._id === rowId) : null;
  const computed = row ? E.computeRow(table, row) : null;
  const [vals, setVals] = useState(() => {
    const v = {};
    for (const f of table.fields) {
      const x = row ? row[f.id] : form && form.defaults && form.defaults[f.id] != null ? form.defaults[f.id] : null;
      v[f.id] = x == null ? (f.type === "bool" ? false : "") : f.type === "bool" ? !!x : String(x);
    }
    return v;
  });
  const [errs, setErrs] = useState({});
  const [aiText, setAiText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const set = (fid, v) => setVals((o) => ({ ...o, [fid]: v }));
  const save = () => {
    const input = {};
    for (const f of table.fields) if (f.type !== "formula" && f.type !== "auto") input[f.id] = vals[f.id];
    const r = row ? E.updateRow(sys, table.id, row._id, input) : E.addRow(sys, table.id, input);
    if (r.errors.length) { setErrs(Object.fromEntries(r.errors.map((e) => [e.field || "_", e.error]))); if (r.errors[0].limit) flash(r.errors[0].error); return; }
    setSys(r.sys, row ? tr("Saved") : tr("Added to {t}", { t: table.name })); onDone();
  };
  const fillAI = async () => {
    setAiBusy(true);
    try {
      const j = E.jsonFrom(await llm(E.recordMessages(sys, table.id, aiText, { today: today() }), { maxTokens: 600, temperature: 0.1 }));
      if (!j) flash(tr("Couldn't read that — fill it in by hand."));
      else {
        let n = 0; const next = { ...vals };
        for (const [k, v] of Object.entries(j)) {
          const f = E.findField(table, k); if (!f || v == null || v === "") continue;
          if (f.type === "link") { const c = E.coerce(f, String(v), sys); if (c.ok) { next[f.id] = c.value; n++; } continue; }
          if (f.type === "choice") { const c = E.coerce(f, String(v), sys); if (c.ok) { next[f.id] = c.value; n++; } continue; }
          next[f.id] = f.type === "bool" ? !!v && !/^(no|false|0|لا)$/i.test(String(v)) : String(v); n++;
        }
        setVals(next); flash(tr("Filled {n} fields — check them and save", { n }));
      }
    } catch (e) { flash(String(e.message || e)); }
    setAiBusy(false);
  };
  const used = row ? E.usedBy(sys, table.id, row._id) : 0;
  return (
    <div className="space-y-2.5" data-testid="erp-record">
      <div className="flex items-center gap-2"><button onClick={onDone} className="text-slate-400 text-sm flex items-center gap-1"><ChevronLeft size={16} />{table.name}</button>
        <span className="text-[12px] text-slate-500 ms-auto">{row ? tr("Edit record") : tr("New record")}</span></div>
      {llm && !row ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-2.5 space-y-2">
          <textarea value={aiText} onChange={(e) => setAiText(e.target.value)} rows={2} dir="auto" className={field} data-testid="erp-ai-fill-text"
            placeholder={tr("Say it in a sentence — e.g. “LTM 1100 for Orascom at New Capital from 1 to 5 October, 25,000 a day”")} />
          <button className={ghost + " flex items-center gap-1"} disabled={aiBusy || aiText.trim().length < 5} onClick={fillAI} data-testid="erp-ai-fill">
            {aiBusy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}{tr("Fill the form from this")}</button>
        </div>) : null}
      {form ? <p className="text-[12px] text-teal-200" data-testid="erp-form-title">{form.title}</p> : null}
      {(form ? form.fields.map((id) => table.fields.find((f) => f.id === id)).filter(Boolean) : table.fields).map((f) => (
        <label key={f.id} className="block">
          <span className="block text-[11px] text-slate-400 mb-1" dir="auto">{f.name}{f.required ? " *" : ""} <span className="text-slate-600">· {tr(E.FIELD_TYPES[f.type])}</span></span>
          <FieldInput sys={sys} f={f} value={vals[f.id]} set={(v) => set(f.id, v)} computed={computed ? computed[f.id] : null} />
          {errs[f.id] ? <span className="block text-[11px] text-amber-300 mt-0.5">{errs[f.id]}</span> : null}
        </label>))}
      {errs._ ? <p className="text-[12px] text-amber-300">{errs._}</p> : null}
      <div className="flex gap-2 pt-1">
        <button className={primary + " flex-1 py-2.5"} onClick={save} data-testid="erp-save">{row ? tr("Save") : tr("Add")}</button>
        {row ? <button className={`${btn} border ${confirmDel ? "border-rose-600 bg-rose-500/15 text-rose-200" : "border-slate-700 text-slate-300"} flex items-center gap-1`} data-testid="erp-delete-row"
          onClick={() => { if (!confirmDel) { setConfirmDel(true); return; } setSys(E.deleteRow(sys, table.id, row._id), tr("Deleted")); onDone(); }}>
          <Trash2 size={14} />{confirmDel ? tr("Tap again to delete") : tr("Delete")}</button> : null}
      </div>
      {row && confirmDel && used ? <p className="text-[12px] text-amber-300">{tr("{n} records in other tables link to this one; they will show “(deleted)”.", { n: used })}</p> : null}
      {row ? E.relatedRows(sys, table.id, row._id).map((g) => (
        <div key={g.table.id + g.field} className="rounded-xl border border-slate-800 bg-slate-900/60 p-2.5" data-testid="erp-related">
          <p className="text-[12px] text-slate-400 mb-1" dir="auto">{tr("Linked {t} ({n})", { t: g.table.name, n: g.rows.length })} <span className="text-slate-600">· {g.field}</span></p>
          {g.rows.slice(0, 20).map((r) => <p key={r._id} className="text-[13px] text-slate-200 truncate" dir="auto">• {E.displayOf(g.table, r)}</p>)}
        </div>)) : null}
    </div>
  );
}

function FieldInput({ sys, f, value, set, computed }) {
  if (f.type === "formula") return <div className="px-2.5 py-2 text-sm text-slate-300 bg-slate-900 rounded-lg" dir="ltr">{computed != null ? E.show(sys, { type: "number" }, computed) : "—"}</div>;
  if (f.type === "auto") return <div className="px-2.5 py-2 text-sm text-slate-300 bg-slate-900 rounded-lg">{value || tr("(given when saved)")}</div>;
  if (f.type === "bool") return <button type="button" onClick={() => set(!value)} className={`px-3 py-2 rounded-lg text-sm border ${value ? "border-teal-600 bg-teal-500/15 text-teal-200" : "border-slate-700 text-slate-400"}`}>{value ? tr("Yes") : tr("No")}</button>;
  if (f.type === "choice") return (
    <select value={value} onChange={(e) => set(e.target.value)} className={field} dir="auto">
      <option value="">—</option>{(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}</select>);
  if (f.type === "link") {
    const t = sys.tables.find((x) => x.id === f.link);
    const rows = t ? sys.rows[t.id] || [] : [];
    return (
      <select value={value} onChange={(e) => set(e.target.value)} className={field} dir="auto">
        <option value="">—</option>{rows.map((r) => <option key={r._id} value={r._id}>{E.displayOf(t, r)}</option>)}</select>);
  }
  if (f.type === "longtext") return <textarea value={value} onChange={(e) => set(e.target.value)} rows={3} className={field} dir="auto" />;
  if (f.type === "date") return <input type="date" value={value} onChange={(e) => set(e.target.value)} className={field} />;
  const im = f.type === "number" || f.type === "money" ? "decimal" : f.type === "phone" ? "tel" : f.type === "email" ? "email" : "text";
  return <input value={value} onChange={(e) => set(e.target.value)} inputMode={im} className={field} dir={im === "text" ? "auto" : "ltr"} />;
}

// ---- Design (Access "Design view") ----------------------------------------------------------
function DesignTab({ sys, table, apply, llm, flash }) {
  const [adding, setAdding] = useState(null);      // { name, type, options, link, formula }
  const [ask, setAsk] = useState("");
  const [proposal, setProposal] = useState(null);  // { ops, done, errors }
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState("");      // what is waiting for a second tap
  const T = table.name;
  const propose = async () => {
    setBusy(true); setProposal(null);
    try {
      const j = E.jsonFrom(await llm(E.changeMessages(sys, ask), { maxTokens: 1200, temperature: 0.1 }));
      const ops = j && Array.isArray(j.ops) ? j.ops : j && j.op ? [j] : [];
      const dry = E.applyOps(sys, ops);          // pure: nothing is saved yet
      setProposal({ ops, done: dry.done, errors: dry.errors });
    } catch (e) { flash(String(e.message || e)); }
    setBusy(false);
  };
  const twice = (k, fn) => { if (confirm !== k) { setConfirm(k); setTimeout(() => setConfirm((c) => (c === k ? "" : c)), 4000); return; } setConfirm(""); fn(); };
  const rels = E.relationships(sys);
  return (
    <div className="space-y-3" data-testid="erp-design">
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-2.5" data-testid="erp-relationships">
        <p className="text-[12px] text-slate-300 font-medium mb-1">{tr("Connections between tables")}</p>
        {rels.length ? rels.map((r, i) => <p key={i} className="text-[12px] text-slate-400" dir="auto">{r.fromName} · <span className="text-slate-300">{r.fieldName}</span> → <span className="text-teal-300">{r.toName}</span></p>)
          : <p className="text-[12px] text-slate-500">{tr("None yet — add a field of type “Link to another table”, or ask below: “connect Jobs to Customers”.")}</p>}
      </div>
      {llm ? (
        <div className="rounded-xl border border-teal-900 bg-teal-500/5 p-2.5 space-y-2">
          <p className="text-[12px] text-teal-200 flex items-center gap-1"><Sparkles size={13} />{tr("Say the change — you'll see it before anything changes")}</p>
          <textarea value={ask} onChange={(e) => setAsk(e.target.value)} rows={2} dir="auto" className={field} data-testid="erp-ask"
            placeholder={tr("e.g. add the driver's phone to Jobs, and a Paid date to Invoices")} />
          <button className={primary + " flex items-center gap-1"} disabled={busy || ask.trim().length < 4} onClick={propose} data-testid="erp-ask-go">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Wrench size={14} />}{busy ? tr("Working it out…") : tr("Show me the change")}</button>
          {proposal ? (
            <div className="rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-[13px] space-y-1" data-testid="erp-proposal">
              {proposal.done.length ? proposal.done.map((d, i) => <p key={i} className="text-slate-200 flex gap-1.5"><Check size={14} className="text-teal-300 shrink-0 mt-0.5" /><span dir="auto">{d}</span></p>)
                : <p className="text-slate-400">{tr("No design change found in that.")}</p>}
              {proposal.errors.map((d, i) => <p key={"e" + i} className="text-amber-300 flex gap-1.5"><AlertTriangle size={14} className="shrink-0 mt-0.5" /><span dir="auto">{d}</span></p>)}
              {proposal.done.length ? <div className="flex gap-2 pt-1">
                <button className={primary} onClick={() => { apply(proposal.ops, ask.trim()); setProposal(null); setAsk(""); }} data-testid="erp-apply">{tr("Apply")}</button>
                <button className={ghost} onClick={() => setProposal(null)}>{tr("Cancel")}</button></div> : null}
            </div>) : null}
        </div>) : null}

      <div className="flex gap-2 items-center">
        <input defaultValue={T} key={table.id + T} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== T && apply([{ op: "renameTable", table: table.id, to: e.target.value.trim() }])}
          className={field + " font-semibold"} dir="auto" data-testid="erp-table-name" />
        <button className={`${btn} border ${confirm === "table" ? "border-rose-600 bg-rose-500/15 text-rose-200" : "border-slate-700 text-slate-400"} shrink-0`} data-testid="erp-delete-table"
          onClick={() => twice("table", () => apply([{ op: "deleteTable", table: table.id }]))} title={tr("Delete this table")}>{confirm === "table" ? tr("Tap again") : <Trash2 size={14} />}</button>
      </div>

      <div className="space-y-2">
        {table.fields.map((f, i) => (
          <div key={f.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-2.5 space-y-2" data-testid="erp-field">
            <div className="flex gap-1.5 items-center">
              <input defaultValue={f.name} key={f.id + f.name} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== f.name && apply([{ op: "renameField", table: table.id, field: f.id, to: e.target.value.trim() }])}
                className={field + " flex-1"} dir="auto" data-testid="erp-field-name" />
              <button className="p-1.5 text-slate-400 disabled:opacity-30" disabled={i === 0} onClick={() => apply([{ op: "moveField", table: table.id, field: f.id, dir: "up" }])} title={tr("Move up")}><ArrowUp size={15} /></button>
              <button className="p-1.5 text-slate-400 disabled:opacity-30" disabled={i === table.fields.length - 1} onClick={() => apply([{ op: "moveField", table: table.id, field: f.id, dir: "down" }])} title={tr("Move down")}><ArrowDown size={15} /></button>
              <button className={`p-1.5 ${confirm === f.id ? "text-rose-300" : "text-slate-500"}`} onClick={() => twice(f.id, () => apply([{ op: "deleteField", table: table.id, field: f.id }]))} title={tr("Delete this field")} data-testid="erp-delete-field">
                {confirm === f.id ? <span className="text-[11px]">{tr("Tap again")}</span> : <Trash2 size={15} />}</button>
            </div>
            <div className="flex gap-1.5 flex-wrap items-center">
              <select value={f.type} onChange={(e) => {
                  const type = e.target.value;
                  if (type === "link") { const other = sys.tables.find((x) => x.id !== table.id); if (!other) { flash(tr("Add another table first")); return; } apply([{ op: "changeType", table: table.id, field: f.id, type, link: other.id }]); }
                  else if (type === "formula") setAdding({ name: f.name, type: "formula", formula: "", replace: f.id });
                  else apply([{ op: "changeType", table: table.id, field: f.id, type }]);
                }} className={field.replace("w-full ", "") + " w-auto flex-1"} data-testid="erp-field-type">
                {Object.entries(E.FIELD_TYPES).map(([k, l]) => <option key={k} value={k}>{tr(l)}</option>)}
              </select>
              <button onClick={() => apply([{ op: "setRequired", table: table.id, field: f.id, required: !f.required }])} className={`${btn} border ${f.required ? "border-teal-600 text-teal-200" : "border-slate-700 text-slate-500"}`}>{tr("Required")}</button>
            </div>
            {f.type === "choice" ? <input defaultValue={(f.options || []).join(", ")} key={f.id + (f.options || []).join()} dir="auto" className={field + " text-[13px]"}
              onBlur={(e) => { const o = e.target.value.split(/[,،]/).map((x) => x.trim()).filter(Boolean); if (o.join() !== (f.options || []).join()) apply([{ op: "setOptions", table: table.id, field: f.id, options: o }]); }}
              placeholder={tr("Choices, separated by commas")} data-testid="erp-field-options" /> : null}
            {f.type === "link" ? <select value={f.link} onChange={(e) => apply([{ op: "changeType", table: table.id, field: f.id, type: "text" }, { op: "changeType", table: table.id, field: f.id, type: "link", link: e.target.value }])} className={field + " text-[13px]"}>
              {sys.tables.filter((x) => x.id !== table.id).map((x) => <option key={x.id} value={x.id}>{tr("Links to {t}", { t: x.name })}</option>)}</select> : null}
            {f.type === "formula" ? <input defaultValue={E.formulaToNames(f.formula, table)} key={f.id + f.formula} dir="ltr" className={field + " text-[13px] font-mono"}
              onBlur={(e) => e.target.value !== E.formulaToNames(f.formula, table) && apply([{ op: "setFormula", table: table.id, field: f.id, formula: e.target.value }])} data-testid="erp-field-formula" /> : null}
          </div>))}
      </div>

      {adding ? (
        <div className="rounded-xl border border-teal-800 bg-slate-900 p-2.5 space-y-2" data-testid="erp-new-field">
          <input value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} placeholder={tr("Field name")} className={field} dir="auto" data-testid="erp-new-field-name" autoFocus />
          {adding.replace ? null : <select value={adding.type} onChange={(e) => setAdding({ ...adding, type: e.target.value })} className={field} data-testid="erp-new-field-type">
            {Object.entries(E.FIELD_TYPES).map(([k, l]) => <option key={k} value={k}>{tr(l)}</option>)}</select>}
          {adding.type === "choice" ? <input value={adding.options || ""} onChange={(e) => setAdding({ ...adding, options: e.target.value })} placeholder={tr("Choices, separated by commas")} className={field} dir="auto" /> : null}
          {adding.type === "link" ? <select value={adding.link || ""} onChange={(e) => setAdding({ ...adding, link: e.target.value })} className={field}>
            <option value="">{tr("Link to which table?")}</option>{sys.tables.filter((x) => x.id !== table.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select> : null}
          {adding.type === "formula" ? <>
            <input value={adding.formula || ""} onChange={(e) => setAdding({ ...adding, formula: e.target.value })} placeholder="[Qty] * [Unit price]" className={field + " font-mono"} dir="ltr" data-testid="erp-new-field-formula" />
            <div className="flex flex-wrap gap-1">{table.fields.filter((x) => x.id !== adding.replace).map((x) => <button key={x.id} onClick={() => setAdding({ ...adding, formula: (adding.formula || "") + `[${x.name}]` })} className="text-[11px] rounded bg-slate-800 text-slate-300 px-1.5 py-0.5">[{x.name}]</button>)}
              {["+", "-", "*", "/", "(", ")", "ROUND(", "DAYS("].map((o) => <button key={o} onClick={() => setAdding({ ...adding, formula: (adding.formula || "") + ` ${o} `.replace(/\( $/, "(") })} className="text-[11px] rounded bg-slate-800 text-teal-300 px-1.5 py-0.5 font-mono">{o}</button>)}</div>
          </> : null}
          <div className="flex gap-2">
            <button className={primary} disabled={!adding.name.trim()} data-testid="erp-new-field-save" onClick={() => {
              const ops = adding.replace
                ? [{ op: "changeType", table: table.id, field: adding.replace, type: "formula", formula: adding.formula }]
                : [{ op: "addField", table: table.id, name: adding.name.trim(), type: adding.type, options: String(adding.options || "").split(/[,،]/).map((x) => x.trim()).filter(Boolean), link: adding.link, formula: adding.formula }];
              const r = apply(ops); if (r.done.length) setAdding(null);
            }}>{adding.replace ? tr("Make it a formula") : tr("Add field")}</button>
            <button className={ghost} onClick={() => setAdding(null)}>{tr("Cancel")}</button>
          </div>
        </div>
      ) : <button className={ghost + " w-full flex items-center justify-center gap-1"} onClick={() => setAdding({ name: "", type: "text" })} data-testid="erp-add-field"><Plus size={14} />{tr("Add a field")}</button>}
    </div>
  );
}

// ---- Queries: ask the data in a sentence (v5.17) -------------------------------------------
function QueryResult({ sys, res }) {
  if (!res) return null;
  if (res.error) return <p className="text-[12px] text-amber-300">{res.error}</p>;
  if (res.groups) return (
    <div className="overflow-x-auto rounded-xl border border-slate-800" data-testid="erp-query-result">
      <table className="text-[12px] text-slate-200 min-w-full"><thead className="bg-slate-900 text-slate-400"><tr>
        <th className="text-start px-2.5 py-2" dir="auto">{res.groupBy.name}</th><th className="text-end px-2.5 py-2">{tr("Count")}</th>{res.sumField ? <th className="text-end px-2.5 py-2" dir="auto">{res.sumField.name}</th> : null}</tr></thead>
        <tbody>{res.groups.map((g) => <tr key={g.group} className="border-t border-slate-800/80"><td className="px-2.5 py-1.5" dir="auto">{g.group}</td><td className="px-2.5 py-1.5 text-end tabular-nums">{g.count}</td>
          {res.sumField ? <td className="px-2.5 py-1.5 text-end tabular-nums">{E.show(sys, res.sumField.type === "formula" ? { type: "number" } : res.sumField, g.sum)}</td> : null}</tr>)}</tbody>
      </table></div>);
  const shown = res.table.fields.slice(0, 8), tot = E.totals(res.table, res.rows);
  return (
    <div className="space-y-1">
      <div className="overflow-x-auto rounded-xl border border-slate-800" data-testid="erp-query-result">
        <table className="text-[12px] text-slate-200 min-w-full"><thead className="bg-slate-900 text-slate-400"><tr>{shown.map((f) => <th key={f.id} className="text-start px-2.5 py-2 whitespace-nowrap" dir="auto">{f.name}</th>)}</tr></thead>
          <tbody>{res.rows.slice(0, 200).map((r) => <tr key={r._id} className="border-t border-slate-800/80">{shown.map((f) => <td key={f.id} className="px-2.5 py-1.5 whitespace-nowrap" dir="auto">{f.type === "bool" ? (r[f.id] ? "✓" : "") : E.show(sys, f, r[f.id])}</td>)}</tr>)}
            {!res.rows.length ? <tr><td colSpan={shown.length} className="px-3 py-4 text-center text-slate-500">{tr("No records match")}</td></tr> : null}</tbody>
          {Object.keys(tot).length && res.rows.length > 1 ? <tfoot className="bg-slate-900/70"><tr>{shown.map((f, i) => <td key={f.id} className="px-2.5 py-1.5 text-end tabular-nums font-semibold">{tot[f.id] != null ? E.show(sys, f.type === "formula" ? { type: "number" } : f, tot[f.id]) : i === 0 ? tr("Total") : ""}</td>)}</tr></tfoot> : null}
        </table></div>
      <p className="text-[11px] text-slate-500">{tr("{n} records", { n: res.rows.length })}</p>
    </div>);
}

function QueriesTab({ sys, setSys, llm, flash }) {
  const [ask, setAsk] = useState("");
  const [busy, setBusy] = useState(false);
  const [cur, setCur] = useState(null);           // { query, res, saved? }
  const saved = sys.queries || [];
  const make = async () => {
    setBusy(true); setCur(null);
    try {
      const r = E.makeQuery(sys, E.jsonFrom(await llm(E.queryMessages(sys, ask, { today: today() }), { maxTokens: 500, temperature: 0.1, json: true })));
      if (r.error) flash(r.error); else setCur({ query: r.query, res: E.runQuery(sys, r.query) });
    } catch (e) { flash(String(e.message || e)); }
    setBusy(false);
  };
  return (
    <div className="space-y-3" data-testid="erp-queries">
      {llm ? (
        <div className="rounded-xl border border-teal-900 bg-teal-500/5 p-2.5 space-y-2">
          <p className="text-[12px] text-teal-200 flex items-center gap-1"><Sparkles size={13} />{tr("Ask your data — like an Access query, in words")}</p>
          <textarea value={ask} onChange={(e) => setAsk(e.target.value)} rows={2} dir="auto" className={field} data-testid="erp-query-ask"
            placeholder={tr("e.g. unpaid invoices over 50,000 · jobs this month by customer · top 5 cranes by revenue")} />
          <button className={primary + " flex items-center gap-1"} disabled={busy || ask.trim().length < 4} onClick={make} data-testid="erp-query-go">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}{busy ? tr("Working it out…") : tr("Run it")}</button>
        </div>) : <p className="text-[12px] text-slate-500">{tr("Load a model to ask your data in words.")}</p>}
      {cur ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2"><p className="text-sm text-slate-100 font-medium flex-1" dir="auto">{cur.query.title}</p>
            {!cur.saved ? <button className={ghost} onClick={() => { setSys(E.saveSaved(sys, "queries", cur.query), tr("Query saved")); setCur({ ...cur, saved: true }); }} data-testid="erp-query-save">{tr("Save query")}</button> : null}</div>
          <QueryResult sys={sys} res={cur.res} />
        </div>) : null}
      {saved.length ? (
        <div className="space-y-1.5">
          <p className="text-[12px] text-slate-400">{tr("Saved queries")}</p>
          {saved.map((q) => (
            <div key={q.id} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2" data-testid="erp-saved-query">
              <button className="flex-1 text-start text-[13px] text-slate-200 truncate" dir="auto" onClick={() => setCur({ query: q, res: E.runQuery(sys, q), saved: true })}>{q.title}</button>
              <button className="p-1 text-slate-500" onClick={() => setSys(E.removeSaved(sys, "queries", q.id))} title={tr("Delete")}><Trash2 size={14} /></button>
            </div>))}
        </div>) : null}
    </div>
  );
}

// ---- Forms: which fields to fill, in what order, with what defaults (v5.17) ----------------
function FormsTab({ sys, setSys, llm, flash, goTable }) {
  const [ask, setAsk] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(null);
  const forms = sys.forms || [];
  const make = async () => {
    setBusy(true); setDraft(null);
    try {
      const r = E.makeForm(sys, E.jsonFrom(await llm(E.formMessages(sys, ask), { maxTokens: 500, temperature: 0.1, json: true })));
      if (r.error) flash(r.error); else setDraft(r.form);
    } catch (e) { flash(String(e.message || e)); }
    setBusy(false);
  };
  const tname = (id) => (sys.tables.find((t) => t.id === id) || {}).name || "?";
  const fname = (f) => { const t = sys.tables.find((x) => x.id === f.table); return (fid) => ((t && t.fields.find((x) => x.id === fid)) || {}).name || "?"; };
  return (
    <div className="space-y-3" data-testid="erp-forms">
      {llm ? (
        <div className="rounded-xl border border-teal-900 bg-teal-500/5 p-2.5 space-y-2">
          <p className="text-[12px] text-teal-200 flex items-center gap-1"><Sparkles size={13} />{tr("Describe a form — the fields to fill, in order")}</p>
          <textarea value={ask} onChange={(e) => setAsk(e.target.value)} rows={2} dir="auto" className={field} data-testid="erp-form-ask"
            placeholder={tr("e.g. a quick job form for the site: customer, crane, start date, days — status New")} />
          <button className={primary + " flex items-center gap-1"} disabled={busy || ask.trim().length < 4} onClick={make} data-testid="erp-form-go">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}{busy ? tr("Working it out…") : tr("Make the form")}</button>
        </div>) : <p className="text-[12px] text-slate-500">{tr("Load a model to make forms in words.")}</p>}
      {draft ? (
        <div className="rounded-xl border border-slate-700 bg-slate-950 p-3 space-y-1.5" data-testid="erp-form-draft">
          <p className="text-sm text-slate-100 font-medium" dir="auto">{draft.title} <span className="text-slate-500 text-[12px]">· {tname(draft.table)}</span></p>
          {draft.fields.map((id, i) => <p key={id} className="text-[13px] text-slate-300" dir="auto">{i + 1}. {fname(draft)(id)}{draft.defaults[id] != null ? <span className="text-slate-500"> = {String(draft.defaults[id])}</span> : null}</p>)}
          <div className="flex gap-2 pt-1">
            <button className={primary} onClick={() => { setSys(E.saveSaved(sys, "forms", draft), tr("Form saved — pick it above the records when you add one")); setDraft(null); setAsk(""); }} data-testid="erp-form-save">{tr("Save form")}</button>
            <button className={ghost} onClick={() => setDraft(null)}>{tr("Cancel")}</button>
          </div>
        </div>) : null}
      {forms.map((f) => (
        <div key={f.id} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2" data-testid="erp-saved-form">
          <button className="flex-1 text-start min-w-0" onClick={() => goTable(f.table)}><span className="block text-[13px] text-slate-200 truncate" dir="auto">{f.title}</span>
            <span className="block text-[11px] text-slate-500 truncate" dir="auto">{tname(f.table)} · {f.fields.map(fname(f)).join(", ")}</span></button>
          <button className="p-1 text-slate-500" onClick={() => setSys(E.removeSaved(sys, "forms", f.id))} title={tr("Delete")}><Trash2 size={14} /></button>
        </div>))}
      {!forms.length && !draft ? <p className="text-[12px] text-slate-500">{tr("No forms yet. A form shows only the fields you need, in your order, with ready values — pick it when you add a record.")}</p> : null}
    </div>
  );
}

// ---- Summary ------------------------------------------------------------------------------
function SummaryTab({ sys, table }) {
  const groupable = table.fields.filter((f) => ["choice", "link", "text", "bool", "date"].includes(f.type));
  const summable = table.fields.filter((f) => ["number", "money", "formula"].includes(f.type));
  // sensible first view: by Status (or another choice, or a link), adding up the total
  const [g, setG] = useState((groupable.find((f) => f.type === "choice" && /status|state|حالة|الحالة/i.test(f.name)) || groupable.find((f) => f.type === "choice")
    || groupable.find((f) => f.type === "link") || groupable[0] || {}).id || "");
  const [s, setS] = useState((summable.find((f) => /total|amount|balance|value|اجمالي|إجمالي|مبلغ|قيمة/i.test(f.name))
    || summable.filter((f) => f.type === "formula").pop() || summable.find((f) => f.type === "money") || summable[0] || {}).id || "");
  const list = g ? E.summary(sys, table.id, g, s) : [];
  const max = Math.max(1, ...list.map((x) => (s ? Math.abs(x.sum) : x.count)));
  const sf = table.fields.find((f) => f.id === s);
  return (
    <div className="space-y-2" data-testid="erp-summary">
      <div className="grid grid-cols-2 gap-2">
        <label className="block"><span className="block text-[11px] text-slate-400 mb-1">{tr("Group by")}</span>
          <select value={g} onChange={(e) => setG(e.target.value)} className={field}>{groupable.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
        <label className="block"><span className="block text-[11px] text-slate-400 mb-1">{tr("Add up")}</span>
          <select value={s} onChange={(e) => setS(e.target.value)} className={field}><option value="">{tr("Count only")}</option>{summable.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
      </div>
      {list.map((x) => (
        <div key={x.group} className="rounded-lg bg-slate-900/60 p-2" data-testid="erp-summary-row">
          <div className="flex justify-between text-[13px] gap-2"><span className="text-slate-200 truncate" dir="auto">{x.group}</span>
            <span className="text-slate-300 tabular-nums shrink-0">{s ? E.show(sys, sf.type === "formula" ? { type: "number" } : sf, x.sum) : ""} <span className="text-slate-500">· {x.count}</span></span></div>
          <div className="h-1.5 rounded bg-slate-800 mt-1.5"><div className="h-1.5 rounded bg-teal-500" style={{ width: `${Math.round(((s ? Math.abs(x.sum) : x.count) / max) * 100)}%` }} /></div>
        </div>))}
      {!list.length ? <p className="text-[13px] text-slate-500">{tr("Nothing to add up yet.")}</p> : null}
    </div>
  );
}

// ---- More: import, export, licence, delete ---------------------------------------------
function MoreTab({ sys, table, setSys, flash, saveFile, share, runPy, onDelete, setTid }) {
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [imp, setImp] = useState(null);            // { name, header, rows }
  const fileRef = useRef(null);
  const active = E.isActive(sys);
  const req = E.requestCode(sys);
  const exportCSV = async () => {
    const text = E.toCSV(sys, table.id), name = `${sys.name} - ${table.name}.csv`.replace(/[\\/:*?"<>|]/g, "_");
    if (saveFile) { try { await saveFile(name, text, "text/csv"); flash(tr("Saved")); } catch (e) { if (String(e.message) !== "Cancelled") flash(String(e.message)); } }
    else { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" })); a.download = name; a.click(); }
  };
  const exportAll = async () => {
    const text = JSON.stringify({ attuneErp: 1, ...sys, history: [] });
    const name = `${sys.name}.attune-erp.json`.replace(/[\\/:*?"<>|]/g, "_");
    if (saveFile) { try { await saveFile(name, text, "application/json"); flash(tr("Saved")); } catch (e) { if (String(e.message) !== "Cancelled") flash(String(e.message)); } }
  };
  // v5.17: the whole system as an app people use in any browser, with the data inside
  const exportApp = async () => {
    const html = buildApp(sys, { freeRows: E.isActive(sys) ? null : E.FREE_ROWS }), name = `${sys.name}.html`.replace(/[\\/:*?"<>|]/g, "_");
    if (saveFile) { try { await saveFile(name, html, "text/html"); flash(tr("Saved — send this file; it opens in any browser, no Attune needed")); } catch (e) { if (String(e.message) !== "Cancelled") flash(String(e.message)); } }
    else { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([html], { type: "text/html" })); a.download = name; a.click(); }
  };
  // every table as one sheet of an Excel workbook (made by Python on the phone)
  const exportExcel = async () => {
    if (!runPy) { flash(tr("Excel files need Python, which isn't in this build — use CSV.")); return; }
    flash(tr("Making the Excel file…"));
    const sheets = sys.tables.map((t) => { const rows = E.viewRows(sys, t.id); return { name: t.name.slice(0, 31).replace(/[\\/*?:\[\]]/g, " "), header: t.fields.map((f) => f.name),
      rows: rows.map((r) => t.fields.map((f) => { const v = f.type === "formula" ? r[f.id] : r[f.id]; return (f.type === "number" || f.type === "money" || f.type === "formula") && typeof v === "number" ? v : E.show(sys, f, v); })) }; });
    const code = `import json, base64, io\nfrom openpyxl import Workbook\nfrom openpyxl.styles import Font\nS = json.loads(${JSON.stringify(JSON.stringify(sheets))})\nwb = Workbook(); wb.remove(wb.active)\nfor s in S:\n    ws = wb.create_sheet(s["name"] or "Sheet")\n    ws.append(s["header"])\n    for c in ws[1]: c.font = Font(bold=True)\n    for r in s["rows"]: ws.append(r)\n    for i, h in enumerate(s["header"], 1): ws.column_dimensions[ws.cell(1, i).column_letter].width = max(10, min(40, len(str(h)) + 4))\nb = io.BytesIO(); wb.save(b); print(base64.b64encode(b.getvalue()).decode())`;
    const r = await runPy(code, []);
    if (!r.ok) { flash(tr("Couldn't make the Excel file: {e}", { e: String(r.error || "").split("\n").pop() })); return; }
    const b64 = r.stdout.trim().split("\n").pop();
    const name = `${sys.name}.xlsx`.replace(/[\\/:*?"<>|]/g, "_");
    try { await saveFile(name, "", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", b64); flash(tr("Saved")); } catch (e) { if (String(e.message) !== "Cancelled") flash(String(e.message)); }
  };
  const pick = async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
    const base = f.name.replace(/\.[^.]+$/, "");
    if (/\.(xlsx|xlsm|xls)$/i.test(f.name)) {
      if (!runPy) { flash(tr("Excel files need Python, which isn't in this build — save the sheet as CSV.")); return; }
      flash(tr("Reading the spreadsheet…"));
      const b64 = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.readAsDataURL(f); });
      const code = `import pandas as pd, json\ndf = pd.read_excel(${JSON.stringify(f.name)}, sheet_name=0, dtype=object)\ndf = df.dropna(how="all")\nfor c in df.columns:\n    df[c] = df[c].map(lambda v: "" if pd.isna(v) else (v.strftime("%Y-%m-%d") if hasattr(v, "strftime") else (int(v) if isinstance(v, float) and v.is_integer() else v)))\nprint(json.dumps({"header": [str(c) for c in df.columns], "rows": df.astype(str).values.tolist()[:5000]}, ensure_ascii=False))`;
      const r = await runPy(code, [{ name: f.name, b64 }]);
      if (!r.ok) { flash(tr("Couldn't read that file: {e}", { e: String(r.error || "").split("\n").pop() })); return; }
      try { const d = JSON.parse(r.stdout.trim().split("\n").pop()); setImp({ name: base, header: d.header, rows: d.rows }); } catch (x) { flash(tr("Couldn't read that file.")); }
    } else if (/\.json$/i.test(f.name)) {
      try { const d = JSON.parse(await f.text()); if (!d.attuneErp || !Array.isArray(d.tables)) throw new Error("x");
        const copy = { ...d, id: E.uid("S"), licence: null, history: [], updated: Date.now() }; delete copy.attuneErp;
        setSys(copy, tr("Imported as a new system (not activated)")); } catch (x) { flash(tr("That is not an Attune Business file.")); }
    } else {
      const rows = E.parseCSV(await f.text());
      if (rows.length < 2) { flash(tr("That file has no rows.")); return; }
      setImp({ name: base, header: rows[0], rows: rows.slice(1) });
    }
  };
  const activate = async () => {
    setChecking(true);
    const r = await E.checkLicence(sys, code);
    setChecking(false);
    if (r.ok) { setSys({ ...sys, licence: r }, tr("Activated — thank you! No limits on this system now.")); setCode(""); }
    else flash(tr(r.error));
  };
  const requestText = tr("Attune Business — please activate my system “{name}”. Request code: {code}", { name: sys.name, code: req });
  return (
    <div className="space-y-3" data-testid="erp-more">
      <div className={`rounded-xl border p-3 space-y-2 ${active ? "border-emerald-800 bg-emerald-500/5" : "border-amber-800 bg-amber-500/5"}`} data-testid="erp-licence">
        <p className="text-sm font-semibold flex items-center gap-1.5 text-slate-100"><KeyRound size={15} />{active ? tr("Activated") : tr("Trial — {n} records per table", { n: E.FREE_ROWS })}</p>
        {active ? <p className="text-[12px] text-slate-400">{tr("This system is paid for: no limits. The design stays yours to change any time.")}</p> : <>
          <p className="text-[12px] text-slate-300">{tr("Each system is paid for once. Designing and trying it is free; activation removes the record limit for this system.")}{E.SELLER.price ? " " + tr("Price: {p}", { p: E.SELLER.price }) : ""}</p>
          <div className="flex gap-2 items-center"><code className="text-[13px] text-teal-200 bg-slate-950 rounded px-2 py-1 select-all" data-testid="erp-request-code">{req}</code>
            <button className="p-1.5 text-slate-400" onClick={() => { try { navigator.clipboard.writeText(req); } catch (e) {} flash(tr("Copied")); }} title={tr("Copy")}><Copy size={15} /></button>
            {share ? <button className="p-1.5 text-slate-400" onClick={() => share(requestText + (E.SELLER.contact ? "\n" + E.SELLER.contact : ""))} title={tr("Send the request")}><Share2 size={15} /></button> : null}</div>
          <textarea value={code} onChange={(e) => setCode(e.target.value)} rows={2} dir="ltr" className={field + " font-mono text-[12px]"} placeholder={tr("Paste the activation code")} data-testid="erp-licence-code" />
          <button className={primary} disabled={checking || code.trim().length < 20} onClick={activate} data-testid="erp-activate">{checking ? tr("Checking…") : tr("Activate")}</button>
        </>}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-2">
        <p className="text-sm font-semibold text-slate-100">{tr("Import & export")}</p>
        <p className="text-[12px] text-slate-400">{tr("Bring a sheet from Excel or Access (saved as .xlsx or .csv) in as a new table — the column types are worked out for you.")}</p>
        <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,.xlsx,.xlsm,.xls,.json" className="hidden" onChange={pick} data-testid="erp-import-file" />
        <div className="flex flex-wrap gap-2">
          <button className={ghost + " flex items-center gap-1"} onClick={() => fileRef.current && fileRef.current.click()}><Upload size={14} />{tr("Import a sheet")}</button>
          <button className={ghost + " flex items-center gap-1"} onClick={exportCSV} data-testid="erp-export-csv"><Download size={14} />{tr("{t} as CSV", { t: table.name })}</button>
          {saveFile ? <button className={ghost + " flex items-center gap-1"} onClick={exportAll}><Download size={14} />{tr("Whole system")}</button> : null}
        </div>
        <div className="rounded-lg border border-teal-900 bg-teal-500/5 p-2.5 space-y-2">
          <p className="text-[12px] text-teal-200">{tr("Give it to your team as an app: one file with all the data inside — it opens in any phone or computer browser, no Attune needed. When something needs changing, open the file here (Business → Open an app file), ask the AI, and send the new app back.")}</p>
          <div className="flex flex-wrap gap-2">
            <button className={primary + " flex items-center gap-1"} onClick={exportApp} data-testid="erp-export-app"><Download size={14} />{tr("Export as an app")}</button>
            {runPy ? <button className={ghost + " flex items-center gap-1"} onClick={exportExcel} data-testid="erp-export-xlsx"><Download size={14} />{tr("Excel workbook (all tables)")}</button> : null}
          </div>
        </div>
        {imp ? (
          <div className="rounded-lg border border-teal-800 bg-slate-950 p-2.5 space-y-2" data-testid="erp-import">
            <p className="text-[13px] text-slate-200">{tr("{n} rows, {c} columns: {cols}", { n: imp.rows.length, c: imp.header.length, cols: imp.header.slice(0, 8).join(", ") })}</p>
            <div className="flex flex-wrap gap-2">
              <button className={primary} data-testid="erp-import-new" onClick={() => { const r = E.tableFromData(sys, imp.name, imp.header, imp.rows);
                if (!r.table) { flash(r.errors[0]); return; } setSys(r.sys, tr("New table {t}: {n} records", { t: r.table.name, n: r.added }) + (r.errors.length ? " · " + r.errors[0] : "")); setTid(r.table.id); setImp(null); }}>{tr("As a new table")}</button>
              <button className={ghost} data-testid="erp-import-into" onClick={() => { const r = E.importRows(sys, table.id, imp.header, imp.rows);
                if (!r.matched) { flash(tr("None of the columns match {t}'s fields.", { t: table.name })); return; }
                setSys(r.sys, tr("{n} records added to {t}", { n: r.added, t: table.name }) + (r.errors.length ? " · " + r.errors[0] : "")); setImp(null); }}>{tr("Into {t}", { t: table.name })}</button>
              <button className={ghost} onClick={() => setImp(null)}>{tr("Cancel")}</button>
            </div>
          </div>) : null}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-2">
        <label className="block"><span className="block text-[11px] text-slate-400 mb-1">{tr("System name")}</span>
          <input defaultValue={sys.name} key={sys.name} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== sys.name && setSys({ ...sys, name: e.target.value.trim(), updated: Date.now() }, tr("Saved"))} className={field} dir="auto" /></label>
        <button className={`${btn} border ${confirmDel ? "border-rose-600 bg-rose-500/15 text-rose-200" : "border-slate-700 text-slate-400"} flex items-center gap-1`} data-testid="erp-delete-system"
          onClick={() => (confirmDel ? onDelete() : setConfirmDel(true))}><Trash2 size={14} />{confirmDel ? tr("Tap again — this deletes the system and all its records") : tr("Delete this system")}</button>
      </div>
    </div>
  );
}
