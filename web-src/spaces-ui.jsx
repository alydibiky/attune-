/* ---- Spaces screens: Assistants, Projects, Artifacts, Themes (v5.14) ---------------------
   Logic and storage: spaces.js. Chat carries assistantId / projectId on each chat.      */
import React, { useState, useEffect, useMemo, useRef } from "react";
import { tr } from "./i18n.js";
import { Md, loadChats } from "./chat.jsx";
import { htmlDoc } from "./sandbox.js";
import { fixMessages, applyFix } from "./code.js";
import {
  loadAssistants, upsertAssistant, deleteAssistant, isBuiltinAssistant,
  loadProjects, upsertProject, deleteProject,
  loadArtifacts, saveArtifact, deleteArtifact, latest, fileNameFor,
  ACCENTS, BACKGROUNDS, PALETTES, loadTheme, saveTheme, applyTheme, newSpaceId,
} from "./spaces.js";
import { Plus, X, Trash2, PenLine, Copy, Share2, Download, Save, Loader2, Sparkles, MessageSquare, Maximize2, Wand2, FileText, Check } from "lucide-react";

const card = "rounded-2xl border border-slate-800 bg-slate-900";
const input = "w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-600";
const btnMain = "px-4 py-2.5 rounded-xl bg-teal-500 text-slate-950 text-sm font-semibold disabled:opacity-50";
const btnGhost = "px-3 py-2 rounded-xl border border-slate-700 text-slate-200 text-sm";

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
    <div className="att-in space-y-3" data-testid="assistant-edit">
      <div className={card + " p-4 space-y-3"}>
        <div className="flex gap-2">
          <input value={edit.emoji} onChange={(e) => setEdit({ ...edit, emoji: e.target.value })} className={input + " w-16 text-center text-lg"} aria-label={tr("Emoji")} />
          <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder={tr("Name, e.g. Crane lift planner")} dir="auto" className={input} data-testid="assistant-name" />
        </div>
        <input value={edit.desc} onChange={(e) => setEdit({ ...edit, desc: e.target.value })} placeholder={tr("What is it for? (one line)")} dir="auto" className={input} />
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[12px] text-slate-400">{tr("Instructions — how it should think and answer")}</span>
            {llm ? <button onClick={draft} disabled={drafting || !modelReady || !edit.name.trim()} className="text-[12px] text-teal-300 flex items-center gap-1 disabled:opacity-40" data-testid="assistant-draft">
              {drafting ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}{tr("Write them for me")}</button> : null}
          </div>
          <textarea value={edit.instructions} onChange={(e) => setEdit({ ...edit, instructions: e.target.value })} rows={7} dir="auto" data-testid="assistant-instructions"
            placeholder={tr("e.g. You are an expert in Liebherr mobile cranes. Explain step by step, give every technical term in English and Egyptian Arabic…")} className={input} />
        </div>
        <div>
          <span className="text-[12px] text-slate-400">{tr("Starter questions (one per line, optional)")}</span>
          <textarea value={edit.startersText || ""} onChange={(e) => setEdit({ ...edit, startersText: e.target.value })} rows={3} dir="auto" className={input + " mt-1"} />
        </div>
        <div className="flex gap-2">
          <button onClick={save} disabled={!edit.name.trim() || !edit.instructions.trim()} className={btnMain} data-testid="assistant-save">{tr("Save")}</button>
          <button onClick={() => setEdit(null)} className={btnGhost}>{tr("Cancel")}</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="att-in space-y-3" data-testid="assistants-page">
      <p className="text-[13px] text-slate-400 leading-relaxed">{tr("Assistants are experts you set up once — their instructions are used in every chat you start with them.")}</p>
      <button onClick={() => setEdit({ emoji: "✨", name: "", desc: "", instructions: "", startersText: "" })} className={btnMain + " w-full flex items-center justify-center gap-2"} data-testid="assistant-new">
        <Plus size={16} /> {tr("New assistant")}</button>
      <div className="grid gap-2">
        {list.map((a) => (
          <div key={a.id} className={card + " p-3 flex items-center gap-3"} data-testid="assistant-item">
            <button onClick={() => startChat({ assistantId: a.id })} className="flex-1 min-w-0 flex items-center gap-3 text-start">
              <span className="w-11 h-11 shrink-0 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-2xl">{a.emoji}</span>
              <span className="min-w-0">
                <span className="block text-sm text-slate-100 font-medium truncate" dir="auto">{tr(a.name)}</span>
                <span className="block text-[11px] text-slate-500 leading-snug line-clamp-2" dir="auto">{tr(a.desc || "")}</span>
              </span>
            </button>
            {isBuiltinAssistant(a.id) ? (
              <button onClick={() => setEdit({ ...a, id: undefined, name: tr(a.name) + " (" + tr("mine") + ")", startersText: (a.starters || []).join("\n") })} className="p-2 text-slate-500" title={tr("Copy and edit")}><Copy size={15} /></button>
            ) : (<>
              <button onClick={() => setEdit({ ...a, startersText: (a.starters || []).join("\n") })} className="p-2 text-slate-500" title={tr("Edit")}><PenLine size={15} /></button>
              <button onClick={() => { deleteAssistant(a.id); reload(); }} className="p-2 text-slate-500" title={tr("Delete")}><Trash2 size={15} /></button>
            </>)}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================== Projects ============================== */
export function ProjectsPage({ startChat, openChat, flash }) {
  const [list, setList] = useState(() => loadProjects());
  const [openId, setOpenId] = useState(null);
  const [edit, setEdit] = useState(null);
  const [note, setNote] = useState(null);           // { name, text } being added
  const fileRef = useRef(null);
  const reload = () => setList(loadProjects());
  const cur = list.find((p) => p.id === openId) || null;
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
    <div className={"att-in " + card + " p-4 space-y-3"} data-testid="project-edit">
      <div className="flex gap-2">
        <input value={edit.emoji} onChange={(e) => setEdit({ ...edit, emoji: e.target.value })} className={input + " w-16 text-center text-lg"} />
        <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder={tr("Project name, e.g. Port Said tender")} dir="auto" className={input} data-testid="project-name" />
      </div>
      <span className="block text-[12px] text-slate-400">{tr("Instructions for every chat in this project")}</span>
      <textarea value={edit.instructions} onChange={(e) => setEdit({ ...edit, instructions: e.target.value })} rows={6} dir="auto" className={input} data-testid="project-instructions"
        placeholder={tr("e.g. We are bidding for a 3-month crane contract. Prices in EGP, VAT 14%. Answer as our commercial manager.")} />
      <div className="flex gap-2">
        <button onClick={saveEdit} disabled={!edit.name.trim()} className={btnMain} data-testid="project-save">{tr("Save")}</button>
        <button onClick={() => setEdit(null)} className={btnGhost}>{tr("Cancel")}</button>
      </div>
    </div>
  );

  if (cur) return (
    <div className="att-in space-y-3" data-testid="project-page">
      <button onClick={() => setOpenId(null)} className="text-[12px] text-slate-400">← {tr("All projects")}</button>
      <div className={card + " p-4"}>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{cur.emoji}</span>
          <div className="flex-1 min-w-0"><p className="text-base text-white font-semibold truncate" dir="auto">{cur.name}</p>
            <p className="text-[11px] text-slate-500">{tr("{n} chats · {k} files", { n: chats.length, k: (cur.knowledge || []).length })}</p></div>
          <button onClick={() => setEdit({ ...cur })} className="p-2 text-slate-400" title={tr("Edit")}><PenLine size={16} /></button>
        </div>
        {cur.instructions ? <p className="text-[12px] text-slate-400 mt-2 whitespace-pre-wrap line-clamp-4" dir="auto">{cur.instructions}</p> : null}
        <button onClick={() => startChat({ projectId: cur.id })} className={btnMain + " w-full mt-3 flex items-center justify-center gap-2"} data-testid="project-new-chat"><MessageSquare size={16} /> {tr("New chat in this project")}</button>
      </div>

      <div className={card + " p-4"}>
        <p className="text-sm text-slate-100 font-medium">{tr("Knowledge")}</p>
        <p className="text-[11px] text-slate-500 mb-2">{tr("Notes and text files the assistant reads before answering — only the parts that match the question.")}</p>
        {(cur.knowledge || []).map((k) => (
          <div key={k.id} className="flex items-center gap-2 py-1.5 border-t border-slate-800" data-testid="project-file">
            <FileText size={14} className="text-teal-300 shrink-0" />
            <span className="flex-1 min-w-0 text-[13px] text-slate-200 truncate" dir="auto">{k.name}</span>
            <span className="text-[10px] text-slate-500">{Math.round(k.text.length / 1000)}k</span>
            <button onClick={() => { upsertProject({ ...cur, knowledge: cur.knowledge.filter((x) => x.id !== k.id) }); reload(); }} className="p-1.5 text-slate-500"><Trash2 size={13} /></button>
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
          <div className="flex gap-2 mt-2">
            <button onClick={() => setNote({ name: "", text: "" })} className={btnGhost + " flex items-center gap-1.5"} data-testid="project-add-note"><Plus size={14} /> {tr("Paste a note")}</button>
            <button onClick={() => fileRef.current && fileRef.current.click()} className={btnGhost + " flex items-center gap-1.5"}><FileText size={14} /> {tr("Add a text file")}</button>
            <input ref={fileRef} type="file" accept=".txt,.md,.csv,.tsv,.json,.html,.xml,text/*" className="hidden" onChange={onFile} />
          </div>
        )}
      </div>

      <div className={card + " p-2"}>
        <p className="text-sm text-slate-100 font-medium px-2 pt-2 pb-1">{tr("Chats")}</p>
        {chats.length === 0 ? <p className="text-[12px] text-slate-500 px-2 pb-2">{tr("No chats in this project yet.")}</p> : chats.map((c) => (
          <button key={c.id} onClick={() => openChat(c.id)} className="w-full text-start px-2 py-2.5 rounded-xl active:bg-slate-800" data-testid="project-chat">
            <span className="block text-sm text-slate-200 truncate" dir="auto">{c.title}</span>
            <span className="block text-[10px] text-slate-500">{new Date(c.updated).toLocaleDateString([], { day: "numeric", month: "short" })} · {tr("{n} messages", { n: c.messages.length })}</span>
          </button>
        ))}
      </div>
      <button onClick={() => { deleteProject(cur.id); setOpenId(null); reload(); }} className="text-[12px] text-rose-300/80 flex items-center gap-1.5 px-1"><Trash2 size={13} /> {tr("Delete project (its chats stay in Chat)")}</button>
    </div>
  );

  return (
    <div className="att-in space-y-3" data-testid="projects-page">
      <p className="text-[13px] text-slate-400 leading-relaxed">{tr("A project keeps related chats together with shared instructions and your own files — like a folder the assistant has read.")}</p>
      <button onClick={() => setEdit({ emoji: "📁", name: "", instructions: "", knowledge: [] })} className={btnMain + " w-full flex items-center justify-center gap-2"} data-testid="project-new"><Plus size={16} /> {tr("New project")}</button>
      {list.length === 0 ? <p className="text-[12px] text-slate-500 text-center py-4">{tr("No projects yet.")}</p> : list.map((p) => (
        <button key={p.id} onClick={() => setOpenId(p.id)} className={card + " w-full p-3 flex items-center gap-3 text-start"} data-testid="project-item">
          <span className="w-11 h-11 shrink-0 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-2xl">{p.emoji}</span>
          <span className="flex-1 min-w-0"><span className="block text-sm text-slate-100 font-medium truncate" dir="auto">{p.name}</span>
            <span className="block text-[11px] text-slate-500">{tr("{k} files", { k: (p.knowledge || []).length })}</span></span>
        </button>
      ))}
    </div>
  );
}

/* ============================== Artifacts ============================== */
function ArtifactBody({ kind, lang, content }) {
  const [token] = useState(() => "a" + Math.random().toString(36).slice(2));
  if (kind === "html") return <iframe title="artifact" sandbox="allow-scripts allow-forms" srcDoc={htmlDoc(content, token)} data-testid="artifact-frame" className="w-full h-full bg-white" />;
  if (kind === "doc") return <div className="att-scroll h-full overflow-y-auto p-4 text-[15px] text-slate-200 leading-relaxed" dir="auto"><Md text={content} runnable={false} /></div>;
  return <pre className="att-scroll h-full overflow-auto p-4 text-[12.5px] font-mono text-slate-200 whitespace-pre" dir="ltr">{content}</pre>;
}

/** Full-screen view of one artifact, with versions, "Change it…", save, copy, share and download. */
export function ArtifactViewer({ artifact, close, llm, modelReady, native, saveFile, flash }) {
  const [item, setItem] = useState(() => (artifact.versions ? artifact : null));
  const [draft] = useState(() => (artifact.versions ? null : artifact));   // opened from a chat answer, not saved yet
  const versions = item ? item.versions : [{ content: draft.content, ts: Date.now() }];
  const [vi, setVi] = useState(versions.length - 1);
  const [view, setView] = useState(artifact.kind === "html" ? "preview" : "preview");
  const [ask, setAsk] = useState("");
  const [busy, setBusy] = useState(false);
  const meta = item || draft;
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
    <div className="fixed inset-0 z-[70] bg-slate-950 flex flex-col" data-testid="artifact-viewer" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800">
        <button onClick={close} className="p-2 text-slate-300" title={tr("Close")} data-testid="artifact-close"><X size={20} /></button>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white font-medium truncate" dir="auto">{meta.title}</p>
          <p className="text-[10px] text-slate-500">{meta.kind === "html" ? tr("Web page") : meta.kind === "doc" ? tr("Document") : tr("Program")}{versions.length > 1 ? " · " + tr("version {v} of {n}", { v: vi + 1, n: versions.length }) : ""}</p>
        </div>
        {meta.kind === "html" ? (
          <div className="flex rounded-lg border border-slate-700 overflow-hidden text-[12px]">
            <button onClick={() => setView("preview")} className={`px-2.5 py-1.5 ${view === "preview" ? "bg-slate-800 text-white" : "text-slate-400"}`}>{tr("Preview")}</button>
            <button onClick={() => setView("code")} className={`px-2.5 py-1.5 ${view === "code" ? "bg-slate-800 text-white" : "text-slate-400"}`} data-testid="artifact-code">{tr("Code")}</button>
          </div>
        ) : null}
      </div>
      {versions.length > 1 ? (
        <div className="att-chips flex gap-1.5 overflow-x-auto px-3 py-1.5 border-b border-slate-800">
          {versions.map((v, i) => <button key={i} onClick={() => setVi(i)} className={`text-[11px] px-2.5 py-1 rounded-full border shrink-0 ${i === vi ? "border-teal-600 text-teal-200 bg-teal-500/10" : "border-slate-700 text-slate-400"}`}>v{i + 1}</button>)}
        </div>
      ) : null}
      <div className="flex-1 min-h-0">
        <ArtifactBody key={vi + ":" + view} kind={view === "code" ? "code" : meta.kind} lang={meta.lang} content={content} />
      </div>
      <div className="border-t border-slate-800 p-2 space-y-2 bg-slate-900">
        {llm ? (
          <div className="flex gap-2">
            <input value={ask} onChange={(e) => setAsk(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") change(); }} dir="auto" data-testid="artifact-ask"
              placeholder={tr("Change it… e.g. make the header blue, add a contact form")} className={input + " py-2"} disabled={busy} />
            <button onClick={change} disabled={busy || !ask.trim() || !modelReady} className="px-3 rounded-xl bg-teal-500 text-slate-950 disabled:opacity-40" data-testid="artifact-change">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}</button>
          </div>
        ) : null}
        <div className="flex gap-1.5 justify-around">
          <button onClick={() => { if (persist(content)) flash && flash(tr("Saved to Artifacts")); }} className="flex flex-col items-center text-[10px] text-slate-300 px-2 py-1" data-testid="artifact-save"><Save size={17} />{item ? tr("Saved") : tr("Save")}</button>
          <button onClick={() => { try { navigator.clipboard.writeText(content); flash && flash(tr("Copied")); } catch (e) {} }} className="flex flex-col items-center text-[10px] text-slate-300 px-2 py-1"><Copy size={17} />{tr("Copy")}</button>
          <button onClick={() => share(native, flash, content)} className="flex flex-col items-center text-[10px] text-slate-300 px-2 py-1"><Share2 size={17} />{tr("Share")}</button>
          <button onClick={download} className="flex flex-col items-center text-[10px] text-slate-300 px-2 py-1" data-testid="artifact-download"><Download size={17} />{tr("File")}</button>
        </div>
      </div>
    </div>
  );
}

export function ArtifactsPage({ open }) {
  const [list, setList] = useState(() => loadArtifacts());
  useEffect(() => { const on = () => setList(loadArtifacts()); window.addEventListener("attune-artifacts-changed", on); return () => window.removeEventListener("attune-artifacts-changed", on); }, []);
  return (
    <div className="att-in space-y-3" data-testid="artifacts-page">
      <p className="text-[13px] text-slate-400 leading-relaxed">{tr("Web pages, documents and programs from your chats. Open one to preview it full screen, change it by asking, or save it as a file.")}</p>
      {list.length === 0 ? (
        <div className={card + " p-5 text-center"}>
          <p className="text-3xl">🗂️</p>
          <p className="text-sm text-slate-300 mt-2">{tr("No artifacts yet.")}</p>
          <p className="text-[12px] text-slate-500 mt-1">{tr("Ask Chat for a website, a report or a program, then tap its card and Save.")}</p>
        </div>
      ) : list.map((a) => (
        <div key={a.id} className={card + " p-3 flex items-center gap-3"} data-testid="artifact-item">
          <button onClick={() => open(a)} className="flex-1 min-w-0 flex items-center gap-3 text-start">
            <span className="w-11 h-11 shrink-0 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-xl">{a.kind === "html" ? "🌐" : a.kind === "doc" ? "📄" : "⌨️"}</span>
            <span className="min-w-0"><span className="block text-sm text-slate-100 truncate" dir="auto">{a.title}</span>
              <span className="block text-[11px] text-slate-500">{new Date(a.updated).toLocaleDateString([], { day: "numeric", month: "short" })} · {tr("{n} versions", { n: a.versions.length })}</span></span>
          </button>
          <button onClick={() => { deleteArtifact(a.id); setList(loadArtifacts()); }} className="p-2 text-slate-500" title={tr("Delete")}><Trash2 size={15} /></button>
        </div>
      ))}
    </div>
  );
}

/* ============================== Themes ============================== */
export function ThemePicker({ theme, setTheme }) {
  const pick = (t) => { const next = { ...theme, ...t }; saveTheme(next); applyTheme(next); setTheme(next); };
  return (
    <div data-testid="theme-picker">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12px] text-slate-400">{tr("Colour")}</span>
        <div className="flex gap-1.5">
          {ACCENTS.map(([id, label]) => (
            <button key={id} onClick={() => pick({ accent: id })} title={tr(label)} aria-label={tr(label)} data-testid={"accent-" + id}
              className={`w-7 h-7 rounded-full border-2 flex items-center justify-center ${theme.accent === id ? "border-white" : "border-transparent"}`}
              style={{ background: PALETTES[id]["500"] }}>{theme.accent === id ? <Check size={13} className="text-white" /> : null}</button>
          ))}
        </div>
      </div>
      <div>
        <span className="block text-[12px] text-slate-400 mb-1.5">{tr("Background")}</span>
        <div className="flex flex-wrap gap-1.5">
          {BACKGROUNDS.map(([id, label]) => (
            <button key={id} onClick={() => pick({ bg: id })} data-testid={"bg-" + id}
              className={`text-[11px] px-2.5 py-1.5 rounded-lg border shrink-0 ${theme.bg === id ? "border-teal-500 text-teal-200 bg-teal-500/10" : "border-slate-700 text-slate-300"}`}>{tr(label)}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
export { loadTheme, applyTheme };
