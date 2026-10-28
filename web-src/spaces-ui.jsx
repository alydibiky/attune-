/* ---- Spaces screens: Assistants, Projects, Artifacts, Themes (v5.14) ---------------------
   Logic and storage: spaces.js. Chat carries assistantId / projectId on each chat.      */
import { askConfirm } from "./confirm.jsx";
import { useSubBack, useSticky } from "./backstack.js";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { tr, dateLocale } from "./i18n.js";
import { Md, loadChats } from "./chat.jsx";
import { brainOf } from "./projectbrain.js";
import { htmlDoc } from "./sandbox.js";
import { fixMessages, applyFix } from "./code.js";
import {
  loadAssistants, upsertAssistant, deleteAssistant, isBuiltinAssistant,
  loadProjects, upsertProject, deleteProject,
  loadArtifacts, saveArtifact, deleteArtifact, latest, fileNameFor,
  ACCENTS, BACKGROUNDS, PALETTES, loadTheme, saveTheme, applyTheme, newSpaceId,
  rulesFor, setRules, exportAssistant, importAssistant,
} from "./spaces.js";
import { PANES, GRID3 } from "./desk.jsx";
import { card as kCard, inp, area, btnP, btnS, label as kLabel, chip } from "./ui-kit.jsx";
import { Plus, X, Trash2, PenLine, Copy, Share2, Download, Save, Loader2, Sparkles, MessageSquare, Maximize2, Wand2, FileText, Check, Brain, Upload, Pin, Eraser, ChevronRight } from "lucide-react";

const card = kCard;
const input = area;
const btnMain = btnP;
const btnGhost = btnS;
const iconBtn = "w-11 h-11 shrink-0 grid place-items-center rounded-[12px] text-[var(--c-mut)] hover:text-[var(--c-ink)] hover:bg-[var(--c-surf-2)]";
const well = "w-11 h-11 shrink-0 rounded-[12px] bg-[var(--c-soft)] flex items-center justify-center";

const wideNow = () => typeof window !== "undefined" && window.innerWidth >= 1024;
function share(native, flash, text) {
  if (native && native.share) { try { native.share(text); return; } catch (e) {} }
  try { navigator.clipboard.writeText(text); flash && flash(tr("Copied")); } catch (e) {}
}

/* ============================== Assistants ============================== */
export function AssistantsPage({ startChat, llm, modelReady, flash }) {
  const [list, setList] = useState(() => loadAssistants());
  const [edit, setEdit] = useState(null);           // assistant being edited/created
  const [drafting, setDrafting] = useState(false);
  const reload = () => setList(loadAssistants());
  useSubBack(!!edit, () => setEdit(null));   // v5.34: Back closes the edit form first
  const [sel, setSel] = useState(null);      // v7.4: the assistant open beside the list (computer)
  // v6.40 (C1): an assistant as one file (with what it learned), and opening one
  const [rulesV, setRulesV] = useState(0);
  const importRef = useRef(null);
  const exportOne = async (a) => {
    const name = String(tr(a.name)).replace(/[^\p{L}\p{N}]+/gu, "-") + ".attune-assistant.json", text = exportAssistant(a);
    try { if (window.__attuneNativeCall) { await window.__attuneNativeCall("saveFile", { name, mime: "application/json", text }); flash && flash(tr("Saved")); return; } } catch (e) { if (/cancel/i.test(String(e && e.message))) return; }
    try { const el = document.createElement("a"); el.href = URL.createObjectURL(new Blob([text], { type: "application/json" })); el.download = name; document.body.appendChild(el); el.click(); el.remove(); } catch (e) {}
  };
  const importOne = (f) => { if (!f) return; const r = new FileReader(); r.onload = () => { try { const a = importAssistant(r.result); reload(); flash && flash(tr("{n} added, with what it learned", { n: tr(a.name) })); } catch (e) { flash && flash(tr(e.message)); } }; r.readAsText(f); };

  const draft = async () => {
    if (!llm || !edit.name.trim()) return;
    setDrafting(true);
    try {
      const out = await llm([{ role: "system", content: "You write the standing instructions for a custom AI assistant. Write 4–8 short imperative sentences in English: its expertise, how it should answer (format, depth, language — mention English + Egyptian Arabic technical terms if it suits), what to always do, what never to do. Plain text only, no heading, no quotes." },
        { role: "user", content: `Assistant name: ${edit.name}\nWhat it is for: ${edit.desc || edit.name}` }], { maxTokens: 400, temperature: 0.4 });
      const text = String(out || "").trim();
      if (text) setEdit((e) => ({ ...e, instructions: text }));
    } catch (e) { flash && flash(String((e && e.message) || e)); }
    setDrafting(false);
  };
  const save = () => {
    const a = upsertAssistant({ ...edit, starters: String(edit.startersText || "").split("\n") });
    setEdit(null); reload(); flash && flash(tr("Saved")); return a;
  };

  if (edit) return (
    <div className="calm att-in space-y-4 lg:max-w-3xl" data-testid="assistant-edit">
      <button onClick={() => setEdit(null)} className="min-h-[44px] text-[13px] font-bold text-[var(--c-acc)]" data-testid="assistant-back">← {tr("All assistants")}</button>
      <div className={card + " p-4 space-y-3"}>
        <div className="flex gap-2">
          <input value={edit.emoji} onChange={(e) => setEdit({ ...edit, emoji: e.target.value })} className={input + " w-16 text-center text-lg"} aria-label={tr("Emoji")} />
          <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder={tr("Name, e.g. Exam study buddy")} dir="auto" className={input} data-testid="assistant-name" />
        </div>
        <input value={edit.desc} onChange={(e) => setEdit({ ...edit, desc: e.target.value })} placeholder={tr("What is it for? (one line)")} dir="auto" className={input} />
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[12px] font-bold text-[var(--c-mut)]">{tr("Instructions — how it should think and answer")}</span>
            {llm ? <button onClick={draft} disabled={drafting || !modelReady || !edit.name.trim()} className="min-h-[44px] text-[13px] font-bold text-[var(--c-acc)] flex items-center gap-1.5 disabled:opacity-40" data-testid="assistant-draft">
              {drafting ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}{tr("Write them for me")}</button> : null}
          </div>
          <textarea value={edit.instructions} onChange={(e) => setEdit({ ...edit, instructions: e.target.value })} rows={7} dir="auto" data-testid="assistant-instructions"
            placeholder={tr("e.g. You are a patient maths tutor. Explain step by step, give every technical term in English and Egyptian Arabic…")} className={input} />
        </div>
        <div>
          <span className="text-[12px] font-bold text-[var(--c-mut)]">{tr("Starter questions (one per line, optional)")}</span>
          <textarea value={edit.startersText || ""} onChange={(e) => setEdit({ ...edit, startersText: e.target.value })} rows={3} dir="auto" className={input + " mt-1"} />
        </div>
        {edit.id ? (() => { const rl = rulesFor(edit.id); void rulesV; return (
          <div data-testid="assistant-rules"><p className={kLabel + " mt-0 mb-1.5"}>{tr("Learned from your corrections")} ({rl.length})</p>
            {!rl.length ? <p className="text-[11.5px] text-[var(--c-mut)] m-0">{tr("Tap 👎 on an answer in a chat with this assistant and write the right one — it becomes a rule here.")}</p> : null}
            {rl.map((r, i) => <div key={i} className="flex items-start gap-2 py-1 border-t border-[var(--c-ln)]" data-testid="assistant-rule"><span className="flex-1 text-[12.5px] text-[var(--c-ink)]" dir="auto">{r.text}</span>
              <button onClick={() => { setRules(edit.id, rl.filter((_, j) => j !== i)); setRulesV((v) => v + 1); }} className={iconBtn} aria-label={tr("Delete")}><Trash2 size={13} /></button></div>)}
          </div>); })() : null}
        <div className="flex gap-2">
          <button onClick={save} disabled={!edit.name.trim() || !edit.instructions.trim()} className={btnMain} data-testid="assistant-save">{tr("Save")}</button>
          <button onClick={() => setEdit(null)} className={btnGhost}>{tr("Cancel")}</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="calm att-in space-y-4" data-testid="assistants-page">
      <p className="text-[13px] text-[var(--c-mut)] leading-relaxed lg:max-w-[70ch]">{tr("Assistants are experts you set up once — their instructions are used in every chat you start with them.")}</p>
      <button onClick={() => setEdit({ emoji: "✨", name: "", desc: "", instructions: "", startersText: "" })} className={btnMain + " w-full lg:w-auto lg:px-5 flex items-center justify-center gap-2"} data-testid="assistant-new">
        <Plus size={16} /> {tr("New assistant")}</button>
      <button onClick={() => importRef.current && importRef.current.click()} className={btnGhost + " w-full lg:w-auto lg:px-5 lg:ms-2 flex items-center justify-center gap-2"} data-testid="assistant-import"><Upload size={15} /> {tr("Open an assistant file")}</button>
      <input ref={importRef} type="file" accept=".json,application/json" className="hidden" data-testid="assistant-import-file" onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; importOne(f); }} />
      {/* v7.4 (Gemini's Area 3): a card per assistant (its name never cut); on a computer a tap opens it beside the list —
          its instructions, starters and what it learned — and "Start a chat"; on a phone a tap starts the chat, as before */}
      <div className={sel ? "lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-5 lg:items-start" : ""}>
      <div className={"grid gap-3 " + (sel ? "lg:grid-cols-2" : "lg:grid-cols-3")}>
        {list.map((a) => (
          <div key={a.id} className={card + " p-3.5 flex flex-col gap-2 " + (sel && sel.id === a.id ? "border-[var(--c-acc)]!" : "")} data-testid="assistant-item">
            {/* the icon and the actions on top, the name and what it does under them — so the name is never squeezed */}
            <div className="flex items-start gap-2">
              <button onClick={() => (wideNow() ? setSel(a) : startChat({ assistantId: a.id }))} className={well + " text-2xl"} aria-hidden="true" tabIndex={-1}>{a.emoji}</button>
              <span className="flex-1" />
              {sel && sel.id === a.id ? <span className="hidden lg:inline-flex self-center text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-[var(--c-soft)] text-[var(--c-acc)]">{tr("Open")}</span> : null}
              <button onClick={() => exportOne(a)} className={iconBtn} title={tr("Save as a file")} data-testid="assistant-export"><Share2 size={15} /></button>
              {isBuiltinAssistant(a.id) ? (
                <button onClick={() => setEdit({ ...a, id: undefined, name: tr(a.name) + " (" + tr("mine") + ")", startersText: (a.starters || []).join("\n") })} className={iconBtn} title={tr("Copy and edit")}><Copy size={15} /></button>
              ) : (<>
                <button onClick={() => setEdit({ ...a, startersText: (a.starters || []).join("\n") })} className={iconBtn} title={tr("Edit")}><PenLine size={15} /></button>
                <button onClick={() => { deleteAssistant(a.id); if (sel && sel.id === a.id) setSel(null); reload(); }} className={iconBtn} title={tr("Delete")}><Trash2 size={15} /></button>
              </>)}
            </div>
            <button onClick={() => (wideNow() ? setSel(a) : startChat({ assistantId: a.id }))} className="w-full text-start min-h-[44px]" data-testid="assistant-open">
              <span className="block text-[15px] text-[var(--c-ink)] font-extrabold leading-snug" dir="auto">{tr(a.name)}</span>
              <span className="block text-[12.5px] text-[var(--c-mut)] leading-snug mt-0.5" dir="auto">{tr(a.desc || "")}</span>
            </button>
          </div>
        ))}
      </div>
      {sel ? (() => { const a = list.find((x) => x.id === sel.id) || sel, rl = rulesFor(a.id); return (
        <div className={"hidden lg:block " + card + " p-5 space-y-3 border-[var(--c-acc)]!"} data-testid="assistant-detail">
          <div className="flex items-start gap-3">
            <span className={well + " text-2xl"}>{a.emoji}</span>
            <div className="flex-1 min-w-0"><p className="m-0 text-[18px] font-black text-[var(--c-ink)] leading-snug" dir="auto">{tr(a.name)}</p>
              <p className="m-0 text-[12.5px] text-[var(--c-mut)]" dir="auto">{tr(a.desc || "")}</p></div>
            <button onClick={() => startChat({ assistantId: a.id })} className={btnMain + " shrink-0"} data-testid="assistant-start">{tr("Start a chat")} →</button>
          </div>
          {a.instructions ? <div><p className={kLabel + " mt-1 mb-1.5"}>{tr("Standing instructions (used in every chat)")}</p>
            <p className="m-0 text-[13px] text-[var(--c-ink)] leading-relaxed whitespace-pre-wrap rounded-[12px] bg-[var(--c-surf-2)] p-3 max-h-56 overflow-y-auto att-scroll" dir="auto">{tr(a.instructions)}</p></div> : null}
          {(a.starters || []).length ? <div><p className={kLabel + " mb-1.5"}>{tr("Starters (one tap to ask)")}</p>
            <div className="grid grid-cols-2 gap-2">{a.starters.map((st) => <button key={st} onClick={() => { try { localStorage.setItem("attune:chat:prefill", tr(st)); } catch (e) {} startChat({ assistantId: a.id }); }}
              className="min-h-[48px] text-start rounded-[12px] border border-[var(--c-ln)] bg-[var(--c-surf)] px-3 py-2 text-[12.5px] font-bold text-[var(--c-ink)] hover:border-[var(--c-acc)]" dir="auto">{tr(st)}</button>)}</div></div> : null}
          {rl.length ? <div className="rounded-[12px] bg-[var(--c-surf-2)] p-3"><p className="m-0 mb-1 text-[12px] font-extrabold uppercase tracking-[0.08em] text-[var(--c-acc)]">{tr("Learned from your corrections")}</p>
            {rl.map((r, i) => <p key={i} className="m-0 text-[12.5px] text-[var(--c-ink)]" dir="auto">• {r.text}</p>)}</div> : null}
        </div>); })() : null}
      </div>
    </div>
  );
}

/* ============================== Projects ============================== */
export function ProjectsPage({ startChat, openChat, flash }) {
  const [list, setList] = useState(() => loadProjects());
  const [openId, setOpenId] = useSticky("projects:open", null);
  const [edit, setEdit] = useState(null);
  const [note, setNote] = useState(null);           // { name, text } being added
  useSubBack(!!openId, () => setOpenId(null));      // v5.34: Back — project → all projects
  useSubBack(!!edit, () => setEdit(null));          //         edit form → the project
  useSubBack(!!note, () => setNote(null));
  const fileRef = useRef(null);
  const reload = () => setList(loadProjects());
  const cur = list.find((p) => p.id === openId) || null;
  const allChats = useMemo(() => loadChats(), [list, openId]);
  const chats = useMemo(() => (cur ? loadChats().filter((c) => c.projectId === cur.id) : []), [openId, list]);

  const saveEdit = () => {
    const p = upsertProject(edit);
    if (!p) { flash && flash(tr("Storage is full — remove some files first")); return; }
    setEdit(null); reload(); setOpenId(p.id);
  };
  const addKnowledge = (k) => {
    const p = upsertProject({ ...cur, knowledge: [...(cur.knowledge || []), { id: newSpaceId("k"), ...k }] });
    if (!p) { flash && flash(tr("Storage is full — that file is too big")); return; }
    reload(); flash && flash(tr("Added to the project"));
  };
  const onFile = async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = "";
    if (!f) return;
    if (f.size > 1.5e6) { flash && flash(tr("That file is too big for a project (max 1.5 MB of text)")); return; }
    try { const text = await f.text(); if (!text.trim()) throw new Error("empty"); addKnowledge({ name: f.name, text }); }
    catch (x) { flash && flash(tr("Only text files work here (.txt, .md, .csv, .json)")); }
  };

  if (edit) return (
    <div className={"att-in " + card + " p-4 space-y-3 lg:max-w-3xl"} data-testid="project-edit">
      <div className="flex gap-2">
        <input value={edit.emoji} onChange={(e) => setEdit({ ...edit, emoji: e.target.value })} className={input + " w-16 text-center text-lg"} />
        <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder={tr("Project name, e.g. Port Said tender")} dir="auto" className={input} data-testid="project-name" />
      </div>
      <span className="block text-[12px] text-[var(--c-mut)]">{tr("Instructions for every chat in this project")}</span>
      <textarea value={edit.instructions} onChange={(e) => setEdit({ ...edit, instructions: e.target.value })} rows={6} dir="auto" className={input} data-testid="project-instructions"
        placeholder={tr("e.g. We are bidding for a 3-month catering contract. Prices in EGP, VAT 14%. Answer as our commercial manager.")} />
      <div className="flex gap-2">
        <button onClick={saveEdit} disabled={!edit.name.trim()} className={btnMain} data-testid="project-save">{tr("Save")}</button>
        <button onClick={() => setEdit(null)} className={btnGhost}>{tr("Cancel")}</button>
      </div>
    </div>
  );

  if (cur) return (
    <div className="calm att-in space-y-4" data-testid="project-page">
      <button onClick={() => setOpenId(null)} className="min-h-[44px] text-[13px] font-bold text-[var(--c-acc)]">← {tr("All projects")}</button>
      {/* v6.27 computer layout: the project and its files on the left, its chats on the right */}
      <div className={PANES}><div className="space-y-3 min-w-0">
      <div className={card + " p-4"}>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{cur.emoji}</span>
          <div className="flex-1 min-w-0"><p className="text-base text-[var(--c-ink)] font-extrabold truncate m-0" dir="auto">{cur.name}</p>
            <p className="text-[12px] text-[var(--c-mut)] tabular-nums m-0">{tr("{n} chats · {k} files", { n: chats.length, k: (cur.knowledge || []).length })}</p></div>
          <button onClick={() => setEdit({ ...cur })} className={iconBtn} title={tr("Edit")}><PenLine size={16} /></button>
        </div>
        {cur.instructions ? <p className="text-[12px] text-[var(--c-mut)] mt-2 whitespace-pre-wrap line-clamp-4" dir="auto">{cur.instructions}</p> : null}
        <button onClick={() => startChat({ projectId: cur.id })} className={btnMain + " w-full mt-3 flex items-center justify-center gap-2"} data-testid="project-new-chat"><MessageSquare size={16} /> {tr("New chat in this project")}</button>
      </div>

      {/* v6.38 (C4): the project brain — decisions, open points, dates, read from its chats */}
      {(() => { const b = brainOf(cur, loadChats()); const any = b.decisions.length || b.open.length || b.dates.length; return (
        <div className={card + " p-4 space-y-2"} data-testid="project-brain">
          <p className="text-[15px] text-[var(--c-ink)] font-extrabold flex items-center gap-2 m-0"><Brain size={16} className="text-[var(--c-acc)]" />{tr("Project brain")}</p>
          {!any ? <p className="text-[12px] text-[var(--c-mut)]">{tr("As you chat in this project, what you decide, what is still open and the dates coming up collect here — and the assistant keeps to them.")}</p> : null}
          {[["decisions", "Decided", "text-[var(--c-pos)]"], ["open", "Still open", "text-[var(--c-warn)]"]].map(([k, label, col]) => b[k].length ? (
            <div key={k} data-testid={"project-brain-" + k}><p className={"text-[12px] font-extrabold uppercase tracking-[0.08em] mb-1 " + col}>{tr(label)}</p>
              <ul className="m-0 p-0 list-none space-y-1">{b[k].map((x, i) => <li key={i}><button onClick={() => openChat(x.chat)} className="text-start min-h-[36px] text-[13.5px] text-[var(--c-ink)] hover:text-[var(--c-acc)]" dir="auto">• {x.text}</button></li>)}</ul></div>) : null)}
          {b.dates.length ? <div data-testid="project-brain-dates"><p className="text-[12px] font-extrabold uppercase tracking-[0.08em] mb-1 text-[var(--c-acc)]">{tr("Dates")}</p>
            <ul className="m-0 p-0 list-none space-y-1">{b.dates.map((x, i) => <li key={i} className="text-[13px] text-[var(--c-ink)]" dir="auto"><b className="tabular-nums" dir="ltr">{x.date}</b> · {x.text}</li>)}</ul></div> : null}
        </div>); })()}

      <div className={card + " p-4"}>
        <p className="text-[15px] text-[var(--c-ink)] font-extrabold m-0">{tr("Knowledge")}</p>
        <p className="text-[12px] text-[var(--c-mut)] mt-1 mb-2">{tr("Notes and text files the assistant reads before answering — only the parts that match the question.")}</p>
        {(cur.knowledge || []).map((k) => (
          <div key={k.id} className="flex items-center gap-2 py-1 border-t border-[var(--c-ln)]" data-testid="project-file">
            <FileText size={14} className="text-[var(--c-acc)] shrink-0" />
            <span className="flex-1 min-w-0 text-[13px] text-[var(--c-ink)] truncate" dir="auto">{k.name}</span>
            <span className="text-[11px] text-[var(--c-mut)] tabular-nums">{Math.round(k.text.length / 1000)}k</span>
            <button onClick={async () => { if (!(await askConfirm("Remove this from the project?"))) return; upsertProject({ ...cur, knowledge: cur.knowledge.filter((x) => x.id !== k.id) }); reload(); }} className={iconBtn}><Trash2 size={13} /></button>
          </div>
        ))}
        {note ? (
          <div className="space-y-2 mt-2">
            <input value={note.name} onChange={(e) => setNote({ ...note, name: e.target.value })} placeholder={tr("Title")} dir="auto" className={input} />
            <textarea value={note.text} onChange={(e) => setNote({ ...note, text: e.target.value })} rows={5} dir="auto" placeholder={tr("Paste the text…")} className={input} data-testid="project-note-text" />
            <div className="flex gap-2">
              <button onClick={() => { if (note.text.trim()) addKnowledge({ name: note.name.trim() || tr("Note"), text: note.text }); setNote(null); }} className={btnMain} data-testid="project-note-save">{tr("Add")}</button>
              <button onClick={() => setNote(null)} className={btnGhost}>{tr("Cancel")}</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 mt-3">
            <button onClick={() => setNote({ name: "", text: "" })} className={btnGhost + " flex items-center gap-1.5"} data-testid="project-add-note"><Plus size={14} /> {tr("Paste a note")}</button>
            <button onClick={() => fileRef.current && fileRef.current.click()} className={btnGhost + " flex items-center gap-1.5"}><FileText size={14} /> {tr("Add a text file")}</button>
            <input ref={fileRef} type="file" accept=".txt,.md,.csv,.tsv,.json,.html,.xml,text/*" className="hidden" onChange={onFile} />
          </div>
        )}
      </div>

      </div>
      <div className="space-y-3 mt-3 lg:mt-0 min-w-0">
      <div className={card + " p-2"}>
        <p className="text-[15px] text-[var(--c-ink)] font-extrabold px-2 pt-2 pb-1 m-0">{tr("Chats")}</p>
        {chats.length === 0 ? <p className="text-[12px] text-[var(--c-mut)] px-2 pb-2">{tr("No chats in this project yet.")}</p> : chats.map((c) => (
          <button key={c.id} onClick={() => openChat(c.id)} className="w-full min-h-[48px] text-start px-2.5 py-2.5 rounded-[12px] hover:bg-[var(--c-surf-2)] active:bg-[var(--c-surf-2)]" data-testid="project-chat">
            <span className="block text-[14px] font-bold text-[var(--c-ink)] truncate" dir="auto">{c.title}</span>
            <span className="block text-[11.5px] text-[var(--c-mut)] tabular-nums">{new Date(c.updated).toLocaleDateString(dateLocale(), { day: "numeric", month: "short" })} · {tr("{n} messages", { n: c.messages.length })}</span>
          </button>
        ))}
      </div>
      <button onClick={() => { deleteProject(cur.id); setOpenId(null); reload(); }} className="min-h-[44px] text-[13px] font-bold text-[var(--c-neg)] flex items-center gap-1.5 px-1"><Trash2 size={13} /> {tr("Delete project (its chats stay in Chat)")}</button>
      </div></div>
    </div>
  );

  return (
    <div className="calm att-in space-y-4" data-testid="projects-page">
      <p className="text-[13px] text-[var(--c-mut)] leading-relaxed lg:max-w-[70ch]">{tr("A project keeps related chats together with shared instructions and your own files — like a folder the assistant has read.")}</p>
      <button onClick={() => setEdit({ emoji: "📁", name: "", instructions: "", knowledge: [] })} className={btnMain + " w-full lg:w-auto lg:px-5 flex items-center justify-center gap-2"} data-testid="project-new"><Plus size={16} /> {tr("New project")}</button>
      {/* v7.4 (Gemini's Area 3): a calm empty state, and each project with its chats, files and when it last changed */}
      {list.length === 0 ? (
        <div className={card + " p-6 text-center space-y-2"} data-testid="projects-empty">
          <span className="mx-auto w-12 h-12 rounded-2xl grid place-items-center bg-[var(--c-soft)] text-2xl">📁</span>
          <p className="m-0 text-[15px] font-extrabold text-[var(--c-ink)]">{tr("No projects yet.")}</p>
          <p className="m-0 text-[12.5px] text-[var(--c-mut)]">{tr("A study plan, a home renovation, a small business — keep its chats and files together.")}</p>
        </div>) : <div className={GRID3}>{list.map((p) => { const cs = allChats.filter((c) => c.projectId === p.id), last = Math.max(p.updated || 0, ...cs.map((c) => c.updated || 0)); return (
        <button key={p.id} onClick={() => setOpenId(p.id)} className={card + " w-full p-3.5 min-h-[64px] flex items-center gap-3 text-start hover:border-[var(--c-acc)]"} data-testid="project-item">
          <span className={well + " text-2xl"}>{p.emoji}</span>
          <span className="flex-1 min-w-0"><span className="block text-[14.5px] text-[var(--c-ink)] font-extrabold leading-snug" dir="auto">{p.name}</span>
            <span className="block text-[12px] text-[var(--c-mut)] tabular-nums">{tr("{n} chats · {k} files", { n: cs.length, k: (p.knowledge || []).length })}{last > 0 ? " · " + tr("updated {d}", { d: new Date(last).toLocaleDateString(dateLocale(), { day: "numeric", month: "short" }) }) : ""}</span></span>
          <ChevronRight size={16} className="shrink-0 text-[var(--c-mut)] rtl:rotate-180" />
        </button>); })}</div>}
    </div>
  );
}

/* ============================== Artifacts ============================== */
// v6.40 (C5): what a saved page stored (its own storage + the boxes filled in), kept per page on the phone (and synced)
export const ARTDATA_KEY = (id) => "attune:artifact:data:v1:" + id;
const loadArtData = (id) => { try { return JSON.parse(localStorage.getItem(ARTDATA_KEY(id)) || "null") || {}; } catch (e) { return {}; } };
function ArtifactBody({ kind, lang, content, dataId, onData }) {
  const [token] = useState(() => "a" + Math.random().toString(36).slice(2));
  const [store] = useState(() => (dataId ? loadArtData(dataId) : null));
  useEffect(() => {
    if (!dataId) return;
    const on = (e) => { const d = e.data; if (!d || d.attuneSandbox !== token || d.kind !== "store") return; try { localStorage.setItem(ARTDATA_KEY(dataId), d.data); onData && onData(); } catch (x) {} };
    window.addEventListener("message", on); return () => window.removeEventListener("message", on);
  }, [dataId, token]);
  if (kind === "html") return <iframe title="artifact" sandbox="allow-scripts allow-forms" srcDoc={htmlDoc(content, token, dataId ? { store: store || {} } : {})} data-testid="artifact-frame" className="w-full h-full bg-white" />;
  if (kind === "doc") return <div className="att-scroll h-full overflow-y-auto p-4 text-[15px] text-[var(--c-ink)] leading-relaxed" dir="auto"><Md text={content} runnable={false} /></div>;
  return <pre className="att-scroll h-full overflow-auto p-4 text-[12.5px] font-mono text-[var(--c-ink)] whitespace-pre" dir="ltr">{content}</pre>;
}

/** Full-screen view of one artifact, with versions, "Change it…", save, copy, share and download. */
export function ArtifactViewer({ artifact, close, llm, modelReady, native, saveFile, flash }) {
  const [item, setItem] = useState(() => (artifact.versions ? artifact : null));
  const [draft] = useState(() => (artifact.versions ? null : artifact));   // opened from a chat answer, not saved yet
  const versions = item ? item.versions : [{ content: draft.content, ts: Date.now() }];
  const [vi, setVi] = useState(versions.length - 1);
  useSubBack(true, close);   // v5.34: Back closes the viewer
  const [view, setView] = useState(artifact.kind === "html" ? "preview" : "preview");
  const [ask, setAsk] = useState("");
  const [busy, setBusy] = useState(false);
  const meta = item || draft;
  const [dataV, setDataV] = useState(0);   // v6.40 (C5): bumps to reload the page after its data is cleared
  const [hasData, setHasData] = useState(() => { try { return !!(item && localStorage.getItem(ARTDATA_KEY(item.id))); } catch (e) { return false; } });
  const clearData = async () => { if (!item || !(await askConfirm("Clear everything typed into this page?"))) return; try { localStorage.removeItem(ARTDATA_KEY(item.id)); } catch (e) {} setHasData(false); setDataV((v) => v + 1); };
  const pin = () => {
    const it = item || persist(content); if (!it) return;
    let done = false; try { done = !!(native && native.pinPage && native.pinPage(it.id, meta.title || "Attune")); } catch (e) {}
    flash && flash(done ? tr("Android will ask to add it to your home screen") : tr("This phone's home screen can't add it — open it from Artifacts"));
  };
  const content = (versions[vi] || versions[versions.length - 1]).content;
  useEffect(() => { setVi(versions.length - 1); }, [versions.length]);

  const persist = (c) => {
    const saved = saveArtifact({ id: item && item.id, kind: meta.kind, lang: meta.lang, title: meta.title, content: c });
    if (!saved) { flash && flash(tr("Storage is full — delete some artifacts")); return null; }
    setItem(saved); return saved;
  };
  const change = async () => {
    const want = ask.trim(); if (!want || !llm) return;
    setBusy(true);
    try {
      let next = null;
      if (meta.kind === "html" || meta.kind === "code") {
        const lang = meta.kind === "html" ? "html" : (meta.lang || "python");
        const ans = await llm(fixMessages({ task: meta.title, lang, code: content, change: want }), { maxTokens: 4000, temperature: 0.2 });
        const r = applyFix(ans, content, lang);
        if (r.how !== "none") next = r.code; else throw new Error(r.error || tr("No change came back"));
      } else {
        const ans = await llm([{ role: "system", content: "You revise documents. Apply the requested change and reply with the COMPLETE revised document in Markdown, nothing else." },
          { role: "user", content: `DOCUMENT:\n${content}\n\nCHANGE: ${want}` }], { maxTokens: 3000, temperature: 0.3 });
        next = String(ans || "").trim();
        if (!next) throw new Error(tr("No change came back"));
      }
      if (!item) persist(content);            // keep the original as version 1
      const saved = persist(next);
      if (saved) { setAsk(""); flash && flash(tr("New version saved")); }
    } catch (e) { flash && flash(String((e && e.message) || e)); }
    setBusy(false);
  };
  const download = async () => {
    const name = fileNameFor(meta);
    const mime = meta.kind === "html" ? "text/html" : meta.kind === "doc" ? "text/markdown" : "text/plain";
    if (saveFile) { try { await saveFile(name, content, mime); flash && flash(tr("Saved to Downloads: {f}", { f: name })); return; } catch (e) { flash && flash(String((e && e.message) || e)); return; } }
    try { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([content], { type: mime })); a.download = name; a.click(); } catch (e) {}
  };

  return (
    <div className="calm att-shift fixed inset-0 z-[70] bg-[var(--c-bg)] text-[var(--c-ink)] flex flex-col" data-testid="artifact-viewer" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--c-ln)] bg-[var(--c-surf)]">
        <button onClick={close} className="w-11 h-11 grid place-items-center rounded-[12px] text-[var(--c-ink)] hover:bg-[var(--c-surf-2)]" title={tr("Close")} data-testid="artifact-close"><X size={20} /></button>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] text-[var(--c-ink)] font-extrabold truncate m-0" dir="auto">{meta.title}</p>
          <p className="text-[11.5px] text-[var(--c-mut)] m-0">{meta.kind === "html" ? tr("Web page") : meta.kind === "doc" ? tr("Document") : tr("Program")}{versions.length > 1 ? " · " + tr("version {v} of {n}", { v: vi + 1, n: versions.length }) : ""}</p>
        </div>
        {meta.kind === "html" ? (
          <div className="flex gap-1 p-1 rounded-full border border-[var(--c-ln)] bg-[var(--c-bg)] text-[12.5px] font-extrabold">
            <button onClick={() => setView("preview")} className={`min-h-[36px] px-3 rounded-full ${view === "preview" ? "bg-[var(--c-soft)] text-[var(--c-acc)]" : "text-[var(--c-mut)]"}`}>{tr("Preview")}</button>
            <button onClick={() => setView("code")} className={`min-h-[36px] px-3 rounded-full ${view === "code" ? "bg-[var(--c-soft)] text-[var(--c-acc)]" : "text-[var(--c-mut)]"}`} data-testid="artifact-code">{tr("Code")}</button>
          </div>
        ) : null}
      </div>
      {versions.length > 1 ? (
        <div className="att-chips flex gap-1.5 overflow-x-auto px-3 py-1.5 border-b border-[var(--c-ln)]">
          {versions.map((v, i) => <button key={i} onClick={() => setVi(i)} className={chip(i === vi) + " shrink-0 h-9 min-h-[36px] px-3 tabular-nums"}>v{i + 1}</button>)}
        </div>
      ) : null}
      <div className="flex-1 min-h-0">
        <ArtifactBody key={vi + ":" + view + ":" + dataV} kind={view === "code" ? "code" : meta.kind} lang={meta.lang} content={content} dataId={item && meta.kind === "html" ? item.id : null} onData={() => setHasData(true)} />
      </div>
      <div className="border-t border-[var(--c-ln)] p-2 space-y-2 bg-[var(--c-surf)]">
        {llm ? (
          <div className="flex gap-2">
            <input value={ask} onChange={(e) => setAsk(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") change(); }} dir="auto" data-testid="artifact-ask"
              placeholder={tr("Change it… e.g. make the header blue, add a contact form")} className={inp} disabled={busy} />
            <button onClick={change} disabled={busy || !ask.trim() || !modelReady} className={btnMain + " h-11 min-h-[44px] w-12 px-0 shrink-0"} data-testid="artifact-change">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}</button>
          </div>
        ) : null}
        <div className="flex gap-1.5 justify-around">
          <button onClick={() => { if (persist(content)) flash && flash(tr("Saved to Artifacts")); }} className="min-w-[56px] min-h-[52px] flex flex-col items-center justify-center gap-0.5 rounded-[12px] text-[11px] font-bold text-[var(--c-ink)] px-2 py-1 hover:bg-[var(--c-surf-2)]" data-testid="artifact-save"><Save size={17} />{item ? tr("Saved") : tr("Save")}</button>
          <button onClick={() => { try { navigator.clipboard.writeText(content); flash && flash(tr("Copied")); } catch (e) {} }} className="min-w-[56px] min-h-[52px] flex flex-col items-center justify-center gap-0.5 rounded-[12px] text-[11px] font-bold text-[var(--c-ink)] px-2 py-1 hover:bg-[var(--c-surf-2)]"><Copy size={17} />{tr("Copy")}</button>
          <button onClick={() => share(native, flash, content)} className="min-w-[56px] min-h-[52px] flex flex-col items-center justify-center gap-0.5 rounded-[12px] text-[11px] font-bold text-[var(--c-ink)] px-2 py-1 hover:bg-[var(--c-surf-2)]"><Share2 size={17} />{tr("Share")}</button>
          <button onClick={download} className="min-w-[56px] min-h-[52px] flex flex-col items-center justify-center gap-0.5 rounded-[12px] text-[11px] font-bold text-[var(--c-ink)] px-2 py-1 hover:bg-[var(--c-surf-2)]" data-testid="artifact-download"><Download size={17} />{tr("File")}</button>
          {meta.kind === "html" && native && native.pinPage ? <button onClick={pin} className="min-w-[56px] min-h-[52px] flex flex-col items-center justify-center gap-0.5 rounded-[12px] text-[11px] font-bold text-[var(--c-ink)] px-2 py-1 hover:bg-[var(--c-surf-2)]" data-testid="artifact-pin"><Pin size={17} />{tr("Home screen")}</button> : null}
          {hasData ? <button onClick={clearData} className="min-w-[56px] min-h-[52px] flex flex-col items-center justify-center gap-0.5 rounded-[12px] text-[11px] font-bold text-[var(--c-warn)] px-2 py-1 hover:bg-[var(--c-surf-2)]" data-testid="artifact-clear-data"><Eraser size={17} />{tr("Clear data")}</button> : null}
        </div>
      </div>
    </div>
  );
}

export function ArtifactsPage({ open }) {
  const [list, setList] = useState(() => loadArtifacts());
  useEffect(() => { const on = () => setList(loadArtifacts()); window.addEventListener("attune-artifacts-changed", on); return () => window.removeEventListener("attune-artifacts-changed", on); }, []);
  return (
    <div className="calm att-in space-y-4" data-testid="artifacts-page">
      <p className="text-[13px] text-[var(--c-mut)] leading-relaxed lg:max-w-[70ch]">{tr("Web pages, documents and programs from your chats. Open one to preview it full screen, change it by asking, or save it as a file.")}</p>
      {list.length === 0 ? (
        <div className={card + " p-5 text-center"}>
          <p className="text-3xl">🗂️</p>
          <p className="text-[14px] font-extrabold text-[var(--c-ink)] mt-2 mb-0">{tr("No artifacts yet.")}</p>
          <p className="text-[12px] text-[var(--c-mut)] mt-1">{tr("Ask Chat for a website, a report or a program, then tap its card and Save.")}</p>
        </div>
      ) : <div className={GRID3}>{list.map((a) => (
        <div key={a.id} className={card + " p-3.5 flex items-center gap-2"} data-testid="artifact-item">
          <button onClick={() => open(a)} className="flex-1 min-w-0 flex items-center gap-3 text-start">
            <span className={well + " text-xl"}>{a.kind === "html" ? "🌐" : a.kind === "doc" ? "📄" : "⌨️"}</span>
            <span className="min-w-0"><span className="block text-[14.5px] font-extrabold text-[var(--c-ink)] truncate" dir="auto">{a.title}</span>
              <span className="block text-[12px] text-[var(--c-mut)] tabular-nums">{new Date(a.updated).toLocaleDateString(dateLocale(), { day: "numeric", month: "short" })} · {tr("{n} versions", { n: a.versions.length })}</span></span>
          </button>
          <button onClick={() => { deleteArtifact(a.id); setList(loadArtifacts()); }} className={iconBtn} title={tr("Delete")}><Trash2 size={15} /></button>
        </div>
      ))}</div>}
    </div>
  );
}

/* ============================== Themes ============================== */
export function ThemePicker({ theme, setTheme }) {
  const pick = (t) => { const next = { ...theme, ...t }; saveTheme(next); applyTheme(next); setTheme(next); };
  return (
    <div className="calm bg-transparent!" data-testid="theme-picker">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12px] font-bold text-[var(--c-mut)]">{tr("Colour")}</span>
        <div className="flex gap-0.5">
          {ACCENTS.map(([id, label]) => (
            <button key={id} onClick={() => pick({ accent: id })} title={tr(label)} aria-label={tr(label)} data-testid={"accent-" + id}
              className={`w-11 h-11 rounded-full border-2 flex items-center justify-center p-1.5 ${theme.accent === id ? "border-[var(--c-ink)]" : "border-transparent"}`}
              style={{ background: PALETTES[id]["500"], backgroundClip: "content-box" }}>{theme.accent === id ? <Check size={13} className="text-white" /> : null}</button>
          ))}
        </div>
      </div>
      <div>
        <span className="block text-[12px] font-bold text-[var(--c-mut)] mb-2">{tr("Background")}</span>
        <div className="flex flex-wrap gap-1.5">
          {BACKGROUNDS.map(([id, label]) => (
            <button key={id} onClick={() => pick({ bg: id })} data-testid={"bg-" + id}
              className={chip(theme.bg === id) + " shrink-0"}>{tr(label)}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
export { loadTheme, applyTheme };
