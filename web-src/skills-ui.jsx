/* ---- More → Skills: your own recipes for the AI ---------------------------------------------------------------------
   Create, import, share, switch on or off. A skill adds its instructions, the facts that fit and a checklist under your question; an optional small program runs offline in the locked sandbox.
   The logic is in userskills.js; this file is the screens.                                                          */
import React, { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Share2, Download, Upload, Wand2, Check, X, ChevronLeft, Sparkles, Package } from "lucide-react";
import { tr } from "./i18n.js";
import { useSubBack } from "./backstack.js";
import * as S from "./userskills.js";

const field = "w-full min-w-0 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500";
const btn = "px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-40";
const primary = btn + " bg-teal-500 text-slate-950";
const ghost = btn + " border border-slate-700 text-slate-200";

function Sheet({ title, onClose, children, footer, testid }) {
  useSubBack(true, onClose);
  return (
    <div className="fixed inset-0 z-[70] bg-slate-950 flex flex-col" data-testid={testid}>
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-800">
        <button onClick={onClose} className="p-1.5 -ms-1 rounded-lg text-slate-300" aria-label={tr("Back")}><ChevronLeft size={20} className="rtl:rotate-180" /></button>
        <h2 className="text-[15px] font-semibold text-white flex-1 truncate">{title}</h2>
        <button onClick={onClose} className="p-1.5 text-slate-400" aria-label={tr("Close")}><X size={18} /></button>
      </div>
      <div className="flex-1 overflow-auto p-4">{children}</div>
      {footer ? <div className="border-t border-slate-800 p-3" style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}>{footer}</div> : null}
    </div>
  );
}

function Toggle({ on, onChange, label }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} data-testid="skill-toggle"
      className={`shrink-0 w-11 h-6 rounded-full relative transition-colors ${on ? "bg-teal-500" : "bg-slate-700"}`}>
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${on ? "start-[22px]" : "start-0.5"}`} />
    </button>
  );
}

function Editor({ skill, onSave, onClose, llm, modelReady, openEngine, flash }) {
  const [s, setS] = useState(skill || { name: "", command: "", when: "", instructions: "", example: "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setS((x) => ({ ...x, [k]: e.target.value }));
  const draft = async () => {
    const desc = (s.when || s.name || "").trim();
    if (desc.length < 4) { flash(tr("Say in a few words what the skill is for (the “When to use it” box)")); return; }
    if (!modelReady) { openEngine && openEngine(); return; }
    setBusy(true);
    try {
      const raw = await llm(S.draftMessages(desc), { json: true, maxTokens: 500, temperature: 0.3 });
      const d = S.parseDraft(raw);
      setS((x) => ({ ...x, name: x.name || d.name, when: d.when || x.when, instructions: d.instructions, example: d.example || x.example }));
      flash(tr("Drafted — read it, change what you like, then save"));
    } catch (e) { flash(String((e && e.message) || e).slice(0, 120)); }
    finally { setBusy(false); }
  };
  const save = () => { try { onSave(S.makeSkill({ ...s })); } catch (e) { flash(e.message); } };
  return (
    <Sheet title={skill ? tr("Edit skill") : tr("New skill")} onClose={onClose} testid="skill-editor"
      footer={<div className="flex gap-2"><button className={primary + " flex-1 py-2.5"} onClick={save} data-testid="skill-save">{tr("Save")}</button></div>}>
      <div className="space-y-3">
        <label className="block"><span className="block text-[12px] text-slate-400 mb-1">{tr("Name")}</span><input className={field} value={s.name} onChange={set("name")} data-testid="skill-name" placeholder={tr("e.g. Crane quote writer")} /></label>
        <label className="block"><span className="block text-[12px] text-slate-400 mb-1">{tr("Command (optional)")}</span><input className={field} value={s.command} onChange={set("command")} dir="ltr" data-testid="skill-command" placeholder="/quote" />
          <span className="block text-[11px] text-slate-500 mt-1">{tr("Start a message with it to use this skill, e.g. “/quote 50 t crane for 3 days”.")}</span></label>
        <label className="block"><span className="block text-[12px] text-slate-400 mb-1">{tr("When to use it")}</span><textarea className={field + " resize-none"} rows={2} value={s.when} onChange={set("when")} data-testid="skill-when" placeholder={tr("Words that tell the app this skill fits: crane quote, price offer, rental…")} />
          <span className="block text-[11px] text-slate-500 mt-1">{tr("The app uses these words to pick the skill by itself when your question fits.")}</span></label>
        <label className="block"><span className="block text-[12px] text-slate-400 mb-1">{tr("Instructions")}</span><textarea className={field + " resize-none"} rows={7} value={s.instructions} onChange={set("instructions")} data-testid="skill-instructions" placeholder={tr("What the AI should do: the structure of the answer, the tone, what to ask if something is missing…")} />
          <span className="block text-[11px] text-slate-500 mt-1" dir="ltr">{s.instructions.length} / {S.LIMITS.instructions}</span></label>
        <button onClick={draft} disabled={busy} className={ghost + " w-full flex items-center justify-center gap-1.5 py-2.5"} data-testid="skill-draft"><Wand2 size={14} />{busy ? tr("Writing…") : tr("Write it for me (from “When to use it”)")}</button>
        <label className="block"><span className="block text-[12px] text-slate-400 mb-1">{tr("Example of a good answer (optional)")}</span><textarea className={field + " resize-none"} rows={3} value={s.example} onChange={set("example")} /></label>
        <label className="block"><span className="block text-[12px] text-slate-400 mb-1">{tr("Checklist: what every answer must satisfy (one per line, optional)")}</span><textarea className={field + " resize-none"} rows={3} value={s.checklist || ""} onChange={set("checklist")} data-testid="skill-checklist" /></label>
        <label className="block"><span className="block text-[12px] text-slate-400 mb-1">{tr("Facts the AI should know (prices, rules, terms — optional)")}</span><textarea className={field + " resize-none"} rows={4} value={s.reference || ""} onChange={set("reference")} data-testid="skill-reference" />
          <span className="block text-[11px] text-slate-500 mt-1">{tr("Separate topics with an empty line. Only the paragraphs that fit the question are used, so this can be long.")}</span></label>
      </div>
    </Sheet>
  );
}

function Catalogue({ have, onAdd, onClose }) {
  return (
    <Sheet title={tr("Skill catalogue")} onClose={onClose} testid="skill-catalogue">
      <p className="text-[12.5px] text-slate-400 mb-3">{tr("Ready-made skills. Add one, then change it to fit your work.")}</p>
      <div className="space-y-2">
        {S.CATALOGUE.map((c) => {
          const added = have.some((x) => x.name === c.name);
          return (
            <div key={c.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3" data-testid="catalogue-item">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1"><p className="text-sm font-medium text-slate-100">{c.name} <span className="text-[11px] text-teal-300" dir="ltr">{c.command}</span></p>
                  <p className="text-[12px] text-slate-400 mt-0.5 line-clamp-3">{c.instructions}</p></div>
                <button disabled={added} onClick={() => onAdd(c)} className={(added ? ghost : primary) + " shrink-0"} data-testid="catalogue-add">{added ? tr("Added") : tr("Add")}</button>
              </div>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

function Import({ onSave, onClose, flash }) {
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  let sk = null; if (text.trim()) { try { sk = S.fromFile(text); } catch (e) { sk = null; } }
  useEffect(() => { if (!text.trim()) return setErr(""); try { S.fromFile(text); setErr(""); } catch (e) { setErr(e.message); } }, [text]);
  const pick = async (f) => { if (!f) return; try { setText(await f.text()); } catch (e) { flash(tr("Could not read that file")); } };
  return (
    <Sheet title={tr("Import a skill")} onClose={onClose} testid="skill-import"
      footer={<button className={primary + " w-full py-2.5"} disabled={!sk} onClick={() => onSave(sk)} data-testid="skill-import-save">{tr("Add this skill")}</button>}>
      <p className="text-[12.5px] text-slate-400 mb-2">{tr("Paste a skill someone shared, or pick its file. You will see exactly what it adds before you save it. It is only text: it cannot run anything.")}</p>
      <textarea className={field + " resize-none font-mono text-[12px]"} rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder={"---\nname: My skill\ncommand: /my\nwhen: …\n---\nInstructions…"} dir="ltr" data-testid="skill-import-text" />
      <label className={ghost + " mt-2 inline-flex items-center gap-1.5 cursor-pointer"}><Upload size={14} />{tr("Pick a file")}<input type="file" accept=".md,.txt,.json,text/plain" className="hidden" onChange={(e) => { pick(e.target.files && e.target.files[0]); e.target.value = ""; }} /></label>
      {err ? <p className="text-[12px] text-amber-300 mt-3">{tr(err)}</p> : null}
      {sk ? (
        <div className="mt-3 rounded-xl border border-teal-800 bg-teal-500/5 p-3" data-testid="skill-import-preview">
          <p className="text-[13px] font-semibold text-white">{sk.name} <span className="text-[11px] text-teal-300" dir="ltr">{sk.command}</span></p>
          {sk.when ? <p className="text-[12px] text-slate-400 mt-1">{tr("Used when")}: {sk.when}</p> : null}
          <p className="text-[11px] uppercase tracking-wide text-slate-500 mt-2">{tr("It will add this to your questions")}</p>
          <p className="text-[12.5px] text-slate-200 mt-1 whitespace-pre-wrap">{sk.instructions}</p>
          {sk.checklist ? <><p className="text-[11px] uppercase tracking-wide text-slate-500 mt-2">{tr("Checklist")}</p><p className="text-[12.5px] text-slate-200 mt-1 whitespace-pre-wrap">{sk.checklist}</p></> : null}
          {sk.reference ? <><p className="text-[11px] uppercase tracking-wide text-slate-500 mt-2">{tr("Facts")}</p><p className="text-[12.5px] text-slate-300 mt-1 whitespace-pre-wrap max-h-40 overflow-auto">{sk.reference}</p></> : null}
          {sk.script ? <div className="mt-2 rounded-lg border border-amber-700 bg-amber-500/10 p-2" data-testid="skill-import-script"><p className="text-[11px] uppercase tracking-wide text-amber-300">{tr("It also runs this small program on your phone (offline, in a locked box — no internet, no files, no access to the app)")}</p><pre className="text-[11.5px] text-slate-200 mt-1 whitespace-pre-wrap max-h-48 overflow-auto" dir="ltr">{sk.script.code}</pre></div> : null}
        </div>
      ) : null}
    </Sheet>
  );
}

export function SkillsPage({ flash, llm, modelReady, openEngine, share, saveFile }) {
  const [list, setListRaw] = useState(S.load);
  const [sheet, setSheet] = useState(null);       // { kind: "edit", skill? } | "catalogue" | "import"
  const setList = (next) => { setListRaw(next); if (!S.save(next)) flash(tr("The phone's storage is full")); };
  const add = (sk) => {
    if (list.length >= S.LIMITS.max) return flash(tr("You have the maximum number of skills"));
    if (sk.command && list.some((x) => x.command === sk.command)) sk = { ...sk, command: "" };   // a command belongs to one skill
    setList([S.makeSkill({ ...sk, id: undefined }, { source: sk.source || "catalogue" }), ...list]);
  };
  const upd = (id, patch) => setList(list.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const del = (s) => { if (window.confirm(tr("Delete the skill “{n}”?", { n: s.name }))) setList(list.filter((x) => x.id !== s.id)); };
  const shareOne = (s) => { const t = S.toFile(s); if (share) share(t); else { try { navigator.clipboard.writeText(t); flash(tr("Copied")); } catch (e) {} } };
  const saveOne = (s) => { const t = S.toFile(s); if (saveFile) saveFile(`skill-${(s.command || s.name).replace(/[^\w-]+/g, "_")}.md`, t, "text/markdown"); else shareOne(s); };
  return (
    <section className="p-4 space-y-3" data-testid="skills-page">
      <div className="flex items-start gap-3">
        <Sparkles size={22} className="text-teal-300 mt-1" />
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-slate-100">{tr("Skills")}</h2>
          <p className="text-[13px] text-slate-400">{tr("Your own recipes for the AI: how to write your quotes, replies, lessons. Start a message with a skill's command, or let the app pick it when your question fits. A skill adds instructions, facts and a checklist to your question; a small program inside it (only if you keep one) runs offline in a locked box.")}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button className={primary + " flex items-center justify-center gap-1.5 py-2.5"} onClick={() => setSheet({ kind: "edit" })} data-testid="skill-new"><Plus size={14} />{tr("New")}</button>
        <button className={ghost + " flex items-center justify-center gap-1.5 py-2.5"} onClick={() => setSheet("catalogue")} data-testid="skill-open-catalogue"><Package size={14} />{tr("Catalogue")}</button>
        <button className={ghost + " flex items-center justify-center gap-1.5 py-2.5"} onClick={() => setSheet("import")} data-testid="skill-open-import"><Download size={14} />{tr("Import")}</button>
      </div>
      {!list.length ? (
        <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center">
          <p className="text-sm text-slate-300">{tr("No skills yet")}</p>
          <p className="text-[12px] text-slate-500 mt-1">{tr("Add one from the catalogue, or write your own.")}</p>
        </div>
      ) : list.map((s) => (
        <div key={s.id} className={`rounded-xl border p-3 ${s.on ? "border-slate-700 bg-slate-900/70" : "border-slate-800 bg-slate-900/30 opacity-70"}`} data-testid="skill-row">
          <div className="flex items-start gap-3">
            <button className="min-w-0 flex-1 text-start" onClick={() => setSheet({ kind: "edit", skill: s })}>
              <p className="text-sm font-medium text-slate-100">{s.name} {s.command ? <span className="text-[11px] text-teal-300 ms-1" dir="ltr">{s.command}</span> : null}
                {s.source === "imported" ? <span className="text-[10px] ms-1 px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-200">{tr("imported")}</span> : null}</p>
              <p className="text-[12px] text-slate-400 mt-0.5 line-clamp-2">{s.when || s.instructions}</p>
            </button>
            <Toggle on={s.on !== false} onChange={(v) => upd(s.id, { on: v })} label={tr("Use this skill")} />
          </div>
          <div className="flex gap-2 mt-2.5">
            <button className={ghost + " flex items-center gap-1"} onClick={() => shareOne(s)} data-testid="skill-share"><Share2 size={12} />{tr("Share")}</button>
            <button className={ghost + " flex items-center gap-1"} onClick={() => saveOne(s)}><Download size={12} />{tr("Save file")}</button>
            <button className={ghost + " flex items-center gap-1 text-red-300 ms-auto"} onClick={() => del(s)} data-testid="skill-delete"><Trash2 size={12} />{tr("Delete")}</button>
          </div>
        </div>
      ))}
      {sheet && sheet.kind === "edit" ? <Editor skill={sheet.skill} llm={llm} modelReady={modelReady} openEngine={openEngine} flash={flash} onClose={() => setSheet(null)}
        onSave={(sk) => { if (sheet.skill) { const clash = sk.command && list.some((x) => x.id !== sheet.skill.id && x.command === sk.command); if (clash) return flash(tr("Another skill already uses that command")); upd(sheet.skill.id, { ...sk, id: sheet.skill.id, ts: sheet.skill.ts }); } else { const clash = sk.command && list.some((x) => x.command === sk.command); if (clash) return flash(tr("Another skill already uses that command")); add({ ...sk, source: "mine" }); } setSheet(null); flash(tr("Saved")); }} /> : null}
      {sheet === "catalogue" ? <Catalogue have={list} onClose={() => setSheet(null)} onAdd={(c) => { add(c); flash(tr("Added — open it to change it")); }} /> : null}
      {sheet === "import" ? <Import flash={flash} onClose={() => setSheet(null)} onSave={(sk) => { add({ ...sk, source: "imported" }); setSheet(null); flash(tr("Skill added")); }} /> : null}
    </section>
  );
}
