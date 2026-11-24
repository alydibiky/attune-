/* ---- v10.9.4 the Passwords page (Ali's OK-PW2, 23 Nov 2026 — docs/mockups/passwords.html): side menu → Passwords.
   Two views on one switch — Toggles like Notion (each account folded; ▸ opens it) and All together (everything open) — remembered; a search
   box; ＋ Add · Paste a page (pwpaste.js readPastedPage, every line as written) · Import file (a password app's .csv). Each account: its
   lines (docs-ui DocDetails: a password shows after the fingerprint, Copy, its own time) + screenshots (DocPhotos, kept on the phone).
   The store is pwstore.js: never in the backup file or sync. The same page on a computer (two columns of toggles). */
import React, { useMemo, useState } from "react";
import { KeyRound, Search, Plus, ClipboardPaste, Upload as FileUp, ChevronRight, Trash2, X } from "lucide-react";
import { tr } from "./i18n.js";
import * as U from "./ui-kit.jsx";
import * as S from "./pwstore.js";
import * as F from "./docfields.js";
import { readPastedPage, readPasswordFile } from "./pwpaste.js";
import { DocDetails, DocPhotos } from "./docs-ui.jsx";

const B = "inline-flex items-center gap-1.5 h-10 px-3.5 rounded-full text-[13px] font-extrabold";
const BP = B + " text-[var(--c-on-acc,#fff)]", BS = B + " border border-[var(--c-acc)] text-[var(--c-acc)]";
const view0 = () => { try { return localStorage.getItem(S.PW_VIEW) === "all" ? "all" : "toggles"; } catch (e) { return "toggles"; } };

function unlockFn(N) {
  return (a) => (N && N.vaultUnlock ? new Promise((ok, bad) => { const nc = typeof window !== "undefined" && window.__attuneNativeCall; if (!nc) return bad(new Error("no")); nc("vaultUnlock", a).then(ok, bad); }) : Promise.resolve(true));
}

/** The check list after Paste / Import: every account found, untick what you don't want, then Save. */
function Review({ found, onSave, onCancel }) {
  const [on, setOn] = useState(() => found.map(() => true));
  const n = on.filter(Boolean).length;
  return <div className={U.cardPad + " space-y-2"} data-testid="pw-review">
    <p className="m-0 text-[15px] font-black" dir="auto">{tr("Found {n} accounts — check them", { n: found.length })}</p>
    <ul className="m-0 p-0 list-none divide-y divide-[var(--c-ln)]">{found.map((a, i) => <li key={i} className="py-1.5"><label className="flex items-center gap-2.5 cursor-pointer min-h-[40px]">
      <input type="checkbox" checked={on[i]} onChange={() => setOn((o) => o.map((x, k) => (k === i ? !x : x)))} className="w-5 h-5 accent-[var(--c-acc)]" data-testid="pw-review-tick" />
      <span className="flex-1 min-w-0"><b className="block truncate" dir="auto">{a.title}</b>
        <span className="block text-[12px] c-sub truncate" dir="auto">{a.lines.map((l) => (l.name ? l.name + ": " : "") + (l.secret ? "••••" : l.value)).join(" · ") || tr("No lines")}</span></span></label></li>)}</ul>
    <div className="flex flex-wrap gap-2"><button onClick={() => onSave(found.filter((_, i) => on[i]))} disabled={!n} className={BP} style={{ background: "var(--c-acc)" }} data-testid="pw-review-save">{tr("Save {n} 🔒", { n })}</button>
      <button onClick={onCancel} className={BS} data-testid="pw-review-cancel">{tr("Cancel")}</button></div>
  </div>;
}

function Account({ x, open, toggle, onPatch, onDelete, unlock, toggles }) {
  const n = (x.fields || []).length;
  return <li className={U.cardPad + " !py-2.5"} data-testid="pw-account" data-open={open ? "1" : "0"}>
    <div className="flex items-center gap-2">
      {toggles ? <button onClick={toggle} aria-expanded={open} className="flex-1 min-w-0 flex items-center gap-2 text-start min-h-[40px]" data-testid="pw-toggle">
        <ChevronRight size={16} className={"shrink-0 transition-transform duration-150 rtl:-scale-x-100 " + (open ? "rotate-90 rtl:-rotate-90" : "")} />
        <b className="min-w-0 truncate text-[15px]" dir="auto" data-testid="pw-title">{x.title}</b>
        {!open ? <span className="text-[12px] c-sub shrink-0">{n ? tr("{n} lines", { n }) : ""}</span> : null}</button>
      : <b className="flex-1 min-w-0 truncate text-[15px] min-h-[40px] flex items-center" dir="auto" data-testid="pw-title">{x.title}</b>}
      {open ? <button onClick={() => onDelete(x)} aria-label={tr("Delete")} className="w-10 h-10 grid place-items-center c-sub shrink-0" data-testid="pw-delete"><Trash2 size={16} /></button> : null}
    </div>
    {open ? <div className="ps-6"><DocDetails x={x} onPatch={onPatch} unlock={unlock} skey={F.PW_SECRETS_KEY} /><DocPhotos x={x} onPatch={onPatch} /></div> : null}
  </li>;
}

export function PasswordsPage({ native, flash, wide }) {
  const [data, setData0] = useState(() => { const d = S.loadPw(); S.pruneSecrets(d); return d; }), [view, setView0] = useState(view0), [q, setQ] = useState("");
  const [opened, setOpened] = useState(() => new Set()), [mode, setMode] = useState(""), [text, setText] = useState(""), [found, setFound] = useState(null), [undo, setUndo] = useState(null);
  const put = (d) => { setData0(d); S.savePw(d); };
  const setView = (v) => { setView0(v); try { localStorage.setItem(S.PW_VIEW, v); } catch (e) {} };
  const unlock = useMemo(() => unlockFn(native), [native]);
  const list = useMemo(() => S.searchAccounts(data, q).slice().sort((a, b) => a.title.localeCompare(b.title)), [data, q]);
  const onPatch = (id, patch) => put(S.patchAccount(S.loadPw(), id, patch));
  const save = (accs) => { const r = S.addAccounts(S.loadPw(), accs); put(r.data); setFound(null); setMode(""); setText(""); setUndo(r.added.length ? r.added : null);
    flash && flash(r.added.length ? tr("Saved {n} accounts — each password locked", { n: r.added.length }) + (r.same ? " · " + tr("{n} were already here", { n: r.same }) : "") : tr("They were all already here")); };
  const readPaste = () => { const got = readPastedPage(text); if (!got.length) { flash && flash(tr("Nothing to read — paste the page's text")); return; } setFound(got); };
  const readFile = async (file) => { if (!file) return; let t = ""; try { t = await file.text(); } catch (e) {} const got = readPasswordFile(t);
    if (!got.length) { flash && flash(tr("That file has no passwords Attune can read — export a .csv from your password app")); return; } setFound(got); };
  const addOne = () => { const r = S.addAccounts(S.loadPw(), [{ title: tr("New account"), lines: [{ name: "Password", value: "", secret: true }] }]); put(r.data); setOpened(new Set([...opened, ...r.added])); setView("toggles"); };
  const del = (x) => { if (typeof window !== "undefined" && !window.confirm(tr("Delete {t}?", { t: x.title }))) return; put(S.removeAccounts(S.loadPw(), [x.id])); };
  const toggles = view === "toggles";
  return <div className={U.page + " rounded-[20px] p-4 md:p-6 space-y-3"} style={{ minHeight: "70vh" }} data-testid="pw-page">
    <div className="flex items-center gap-2"><h2 className={U.pageH1 + " flex items-center gap-2 flex-1 min-w-0"}><KeyRound size={20} className="text-[var(--c-acc)] shrink-0" /><span className="truncate">{tr("Passwords")}</span></h2>
      <span className="text-[13px] c-sub tabular-nums" data-testid="pw-count">{data.items.length}</span></div>
    <p className="m-0 text-[12.5px] c-sub" dir="auto">{tr("Synced to your other devices and kept in your backup — always locked, never sent to any AI. Each password opens with your fingerprint.")}</p>
    <div className="flex gap-1.5" role="tablist" data-testid="pw-views">{[["toggles", tr("▸ Toggles")], ["all", tr("All together")]].map(([v, l]) =>
      <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={"flex-1 h-10 rounded-full text-[13px] font-extrabold border " + (view === v ? "border-[var(--c-acc)] bg-[var(--c-soft)] text-[var(--c-acc)]" : "border-[var(--c-ln)]")} data-testid={"pw-view-" + v}>{l}</button>)}</div>
    {data.items.length > 3 ? <label className="flex items-center gap-2 h-11 px-3 rounded-full border border-[var(--c-ln)] bg-[var(--c-bg)]"><Search size={16} className="c-sub shrink-0" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search accounts")} className="flex-1 min-w-0 bg-transparent outline-none text-[14px]" data-testid="pw-search" />
      {q ? <button onClick={() => setQ("")} aria-label={tr("Clear")} className="c-sub"><X size={15} /></button> : null}</label> : null}
    <div className="flex flex-wrap gap-2">
      <button onClick={addOne} className={BP} style={{ background: "var(--c-acc)" }} data-testid="pw-add"><Plus size={15} />{tr("Add")}</button>
      <button onClick={() => { setMode(mode === "paste" ? "" : "paste"); setFound(null); }} className={BS} data-testid="pw-paste"><ClipboardPaste size={15} />{tr("Paste a page")}</button>
      <label className={BS + " cursor-pointer"} data-testid="pw-import"><FileUp size={15} />{tr("Import file")}<input type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={(e) => readFile(e.target.files && e.target.files[0])} data-testid="pw-import-file" /></label>
    </div>
    {undo ? <div className="flex items-center gap-2 text-[13px] font-bold"><span className="flex-1" dir="auto">{tr("Saved {n} accounts — each password locked", { n: undo.length })}</span>
      <button onClick={() => { put(S.removeAccounts(S.loadPw(), undo)); setUndo(null); }} className={BS + " !h-8"} data-testid="pw-undo">{tr("Undo")}</button></div> : null}
    {mode === "paste" && !found ? <div className={U.cardPad + " space-y-2"} data-testid="pw-paste-box">
      <p className="m-0 text-[13px] c-sub" dir="auto">{tr("Paste your whole page (Notion: select all → copy, or ⋯ → Export → Markdown). One account per toggle or heading; every line is kept as you wrote it.")}</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={7} className={U.inp + " w-full font-mono text-[12.5px]"} placeholder={"▸ Microsoft\n    email: …\n    pass: …"} data-testid="pw-paste-text" />
      <button onClick={readPaste} disabled={!text.trim()} className={BP} style={{ background: "var(--c-acc)" }} data-testid="pw-paste-read">{tr("Read it")}</button></div> : null}
    {found ? <Review found={found} onSave={save} onCancel={() => setFound(null)} /> : null}
    {!data.items.length && !found && mode !== "paste" ? <p className="m-0 py-8 text-center text-[14px] c-sub" dir="auto" data-testid="pw-empty">{tr("No passwords yet. Paste your notes page, import your password app's file, or add one.")}</p> : null}
    <ul className={"m-0 p-0 list-none grid gap-2 " + (wide && toggles ? "lg:grid-cols-2 lg:items-start" : "")} data-testid="pw-list">
      {list.map((x) => <Account key={x.id} x={x} toggles={toggles} open={!toggles || opened.has(x.id) || (!!q && list.length <= 3)} unlock={unlock} onPatch={onPatch} onDelete={del}
        toggle={() => setOpened((o) => { const n = new Set(o); n.has(x.id) ? n.delete(x.id) : n.add(x.id); return n; })} />)}
    </ul>
    {q && !list.length ? <p className="m-0 text-[13px] c-sub" dir="auto">{tr("No account matches “{q}”", { q })}</p> : null}
  </div>;
}

/** Home chat's answer card: "what's my discord password?" → the account (its password after the fingerprint), or the list. */
export function PwAnswer({ ans, native, navTo }) {
  const unlock = useMemo(() => unlockFn(native), [native]);
  const [data, setData] = useState(() => S.loadPw());
  if (!ans) return null;
  if (ans.kind === "none") return <p className="m-0 text-[14px]" dir="auto" data-testid="pw-answer-none">{data.items.length ? tr("I don't have that account in Passwords.") : tr("No passwords saved yet — open Passwords to paste your page or import a file.")} <button onClick={() => navTo && navTo("passwords")} className="font-extrabold text-[var(--c-acc)]">{tr("Open Passwords")}</button></p>;
  const items = ans.items.map((x) => data.items.find((y) => y.id === x.id) || x);
  if (ans.kind === "list") return <div className="space-y-1" data-testid="pw-answer-list"><p className="m-0 text-[14px] font-bold" dir="auto">{tr("{n} accounts:", { n: items.length })} {items.slice(0, 8).map((x) => x.title).join(", ")}{items.length > 8 ? "…" : ""}</p>
    <button onClick={() => navTo && navTo("passwords")} className="text-[13px] font-extrabold text-[var(--c-acc)]" data-testid="pw-answer-open">{tr("Open Passwords")} ›</button></div>;
  const x = items[0];
  return <div className="space-y-1" data-testid="pw-answer"><p className="m-0 text-[15px] font-black" dir="auto">🔑 {x.title}</p>
    <DocDetails x={x} edit={false} unlock={unlock} skey={F.PW_SECRETS_KEY} onPatch={(id, p) => { const d = S.patchAccount(S.loadPw(), id, p); S.savePw(d); setData(d); }} />
    <button onClick={() => navTo && navTo("passwords")} className="text-[13px] font-extrabold text-[var(--c-acc)]" data-testid="pw-answer-open">{tr("Open Passwords")} ›</button></div>;
}
