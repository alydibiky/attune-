/* ---- More → CV / Resume: build, tailor and export a CV on the phone ---------------------------------------------------------
   Many CVs, a copy per job; an ATS-safe single column or a modern two-column look from the same content; English or Arabic
   (right-to-left); a live preview that fits 1–2 pages; PDF, Word and plain text; the phone's own model helps with wording only
   (cv-ai.js, every number checked by code). Logic: cv.js, cv-ai.js.                                                         */
import React, { useState, useEffect, useRef, useMemo } from "react";
import { Plus, Trash2, Copy, Share2, Download, Upload, ChevronLeft, ChevronDown, ArrowUp, ArrowDown, Check, X, Sparkles, FileText, Camera, AlertTriangle, Info } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import { useSubBack } from "./backstack.js";
import * as V from "./cv.js";
import * as A from "./cv-ai.js";
import * as C from "./convert.js";
import { sharePdf } from "./books-docs.jsx";

const field = "w-full min-w-0 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500";
const btn = "px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-40";
const primary = btn + " bg-teal-500 text-slate-950";
const ghost = btn + " border border-slate-700 text-slate-200";
const L2 = (en, ar) => (getLang() === "ar" ? ar : en);

function Sheet({ title, onClose, right, children, testid }) {
  useSubBack(true, onClose);
  return (
    <div className="fixed inset-0 z-[70] bg-slate-950 flex flex-col" data-testid={testid}>
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-800">
        <button onClick={onClose} className="p-1.5 -ms-1 rounded-lg text-slate-300" aria-label={tr("Back")}><ChevronLeft size={20} className="rtl:rotate-180" /></button>
        <h2 className="text-[15px] font-semibold text-white flex-1 truncate">{title}</h2>{right}
      </div>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
const Lbl = ({ t, children }) => <div className="block"><span className="block text-[11.5px] text-slate-400 mb-1">{t}</span>{children}</div>;
const In = ({ value, onChange, ...p }) => <input className={field} value={value ?? ""} onChange={(e) => onChange(e.target.value)} {...p} />;
const Tx = ({ value, onChange, rows = 3, ...p }) => <textarea className={field + " resize-none"} rows={rows} value={value ?? ""} onChange={(e) => onChange(e.target.value)} {...p} />;

/** Measure the CV's content height in a hidden page and return the text scale that fits `cv.fit` pages. */
function measureScale(cv) {
  return new Promise((ok) => {
    if (!cv.fit) return ok(1);
    const f = document.createElement("iframe");
    f.style.cssText = "position:fixed;left:-9999px;top:0;width:900px;height:1200px;border:0;visibility:hidden";
    f.onload = () => {
      try {
        const px = f.contentDocument.querySelector(".page").scrollHeight, mm = px * 25.4 / 96, P = V.PAGES[cv.page] || V.PAGES.A4;
        ok(V.fitScale(mm, P.h, cv.fit));
      } catch (e) { ok(1); } finally { setTimeout(() => f.remove(), 0); }
    };
    f.srcdoc = V.cvHtml(cv, { scale: 1 });
    document.body.appendChild(f);
    setTimeout(() => ok(1), 4000);
  });
}

function Preview({ cv }) {
  const wrap = useRef(null);
  const [w, setW] = useState(340);
  const [scale, setScale] = useState(1);
  useEffect(() => { let on = true; const t = setTimeout(() => measureScale(cv).then((s) => on && setScale(s)), 250); return () => { on = false; clearTimeout(t); }; }, [cv]);
  useEffect(() => { const el = wrap.current; if (!el) return; const ro = new ResizeObserver(() => setW(el.clientWidth)); ro.observe(el); setW(el.clientWidth); return () => ro.disconnect(); }, []);
  const P = V.PAGES[cv.page] || V.PAGES.A4, pxW = P.w * 96 / 25.4, pxH = P.h * 96 / 25.4, k = Math.min(1, (w - 2) / pxW);
  return (
    <div ref={wrap} className="p-3" data-testid="cv-preview">
      <div style={{ width: pxW * k, height: pxH * k * Math.max(1, cv.fit || 1), margin: "0 auto", background: "#fff", boxShadow: "0 2px 14px rgba(0,0,0,.45)", overflow: "hidden", position: "relative" }}>
        <iframe title="CV" srcDoc={V.cvHtml(cv, { scale })} style={{ width: pxW, height: pxH * Math.max(1, cv.fit || 1), border: 0, transform: `scale(${k})`, transformOrigin: "top left", position: "absolute", left: 0, top: 0 }} sandbox="allow-same-origin" />
      </div>
      {scale < 1 ? <p className="text-center text-[11px] text-amber-300 mt-2">{tr("Text shrunk to {p}% to fit {n} page(s)", { p: Math.round(scale * 100), n: cv.fit })}</p> : null}
    </div>
  );
}

// ---- the content editor ------------------------------------------------------------------------------------------------------
function Bullets({ list, onChange, onImprove }) {
  const arr = list && list.length ? list : [""];
  return (
    <div className="space-y-1.5">
      {arr.map((b, i) => (
        <div key={i} className="flex gap-1.5 items-start">
          <span className="text-slate-500 pt-2">•</span>
          <textarea className={field + " resize-none"} rows={2} value={b} onChange={(e) => onChange(arr.map((x, j) => (j === i ? e.target.value : x)))} placeholder={tr("What you did and the result (use a number)")} data-testid="cv-bullet" />
          <button className="p-1.5 text-slate-500" onClick={() => onChange(arr.filter((_, j) => j !== i))} aria-label={tr("Remove")}><X size={14} /></button>
        </div>
      ))}
      <div className="flex gap-2"><button className={ghost} onClick={() => onChange([...arr, ""])}>+ {tr("Bullet")}</button>{onImprove ? <button className={ghost + " flex items-center gap-1"} onClick={onImprove} data-testid="cv-improve"><Sparkles size={12} />{tr("Improve")}</button> : null}</div>
    </div>
  );
}
function ItemCard({ children, onDelete }) { return <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5 space-y-2 relative"><button className="absolute top-1.5 end-1.5 p-1 text-slate-500" onClick={onDelete} aria-label={tr("Remove")}><Trash2 size={13} /></button>{children}</div>; }

function SectionEditor({ s, update, improveJob }) {
  const set = (items) => update({ ...s, items });
  const upd = (i, patch) => set(s.items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const del = (i) => set(s.items.filter((_, j) => j !== i));
  const add = () => set([...s.items, V.newItem(s.type)]);
  if (s.type === "summary" || s.type === "custom") return <Tx rows={4} value={(s.items[0] || {}).text} onChange={(v) => set([{ text: v }])} placeholder={tr("Two or three lines: who you are and what you do best")} data-testid="cv-summary" />;
  return (
    <div className="space-y-2">
      {s.items.map((it, i) => (
        <ItemCard key={i} onDelete={() => del(i)}>
          {s.type === "experience" ? <>
            <div className="grid grid-cols-2 gap-2 pe-6"><Lbl t={tr("Job title")}><In value={it.role} onChange={(v) => upd(i, { role: v })} data-testid="cv-role" /></Lbl><Lbl t={tr("Company")}><In value={it.company} onChange={(v) => upd(i, { company: v })} data-testid="cv-company" /></Lbl></div>
            <div className="grid grid-cols-3 gap-2"><Lbl t={tr("City")}><In value={it.location} onChange={(v) => upd(i, { location: v })} /></Lbl><Lbl t={tr("Start (2021-03)")}><In value={it.start} onChange={(v) => upd(i, { start: v })} dir="ltr" data-testid="cv-start" /></Lbl><Lbl t={tr("End")}><In value={it.current ? "" : it.end} onChange={(v) => upd(i, { end: v })} dir="ltr" disabled={it.current} /></Lbl></div>
            <label className="flex items-center gap-2 text-[12px] text-slate-300"><input type="checkbox" checked={!!it.current} onChange={(e) => upd(i, { current: e.target.checked })} />{tr("I still work here")}</label>
            <Bullets list={it.bullets} onChange={(b) => upd(i, { bullets: b })} onImprove={() => improveJob(it, i)} />
          </> : s.type === "education" ? <>
            <div className="grid grid-cols-2 gap-2 pe-6"><Lbl t={tr("Degree / course")}><In value={it.degree} onChange={(v) => upd(i, { degree: v })} /></Lbl><Lbl t={tr("School")}><In value={it.school} onChange={(v) => upd(i, { school: v })} /></Lbl></div>
            <div className="grid grid-cols-2 gap-2"><Lbl t={tr("Start")}><In value={it.start} onChange={(v) => upd(i, { start: v })} dir="ltr" /></Lbl><Lbl t={tr("End")}><In value={it.end} onChange={(v) => upd(i, { end: v })} dir="ltr" /></Lbl></div>
            <Lbl t={tr("Note (optional)")}><In value={it.note} onChange={(v) => upd(i, { note: v })} /></Lbl>
          </> : s.type === "skills" ? <>
            <Lbl t={tr("Group name (optional)")}><In value={it.name} onChange={(v) => upd(i, { name: v })} /></Lbl>
            <Lbl t={tr("Skills, separated by commas")}><Tx rows={2} value={(it.items || []).join(", ")} onChange={(v) => upd(i, { items: v.split(/[,،\n]/).map((x) => x.trim()).filter(Boolean) })} data-testid="cv-skills" /></Lbl>
          </> : s.type === "languages" ? <div className="grid grid-cols-2 gap-2 pe-6"><Lbl t={tr("Language")}><In value={it.name} onChange={(v) => upd(i, { name: v })} /></Lbl><Lbl t={tr("Level")}><In value={it.level} onChange={(v) => upd(i, { level: v })} /></Lbl></div>
          : s.type === "certs" ? <div className="grid grid-cols-3 gap-2 pe-6"><Lbl t={tr("Certificate")}><In value={it.name} onChange={(v) => upd(i, { name: v })} /></Lbl><Lbl t={tr("Issuer")}><In value={it.issuer} onChange={(v) => upd(i, { issuer: v })} /></Lbl><Lbl t={tr("Year")}><In value={it.year} onChange={(v) => upd(i, { year: v })} dir="ltr" /></Lbl></div>
          : <>
            <div className="grid grid-cols-2 gap-2 pe-6"><Lbl t={tr("Project")}><In value={it.name} onChange={(v) => upd(i, { name: v })} /></Lbl><Lbl t={tr("Link (optional)")}><In value={it.link} onChange={(v) => upd(i, { link: v })} dir="ltr" /></Lbl></div>
            <Bullets list={it.bullets} onChange={(b) => upd(i, { bullets: b })} />
          </>}
        </ItemCard>
      ))}
      <button className={ghost + " w-full flex items-center justify-center gap-1"} onClick={add} data-testid="cv-add-item"><Plus size={13} />{tr("Add")}</button>
    </div>
  );
}

function ContentTab({ cv, setCV, improveJob }) {
  const [open, setOpen] = useState({ basics: true });
  const b = cv.basics;
  const setB = (k) => (v) => setCV({ ...cv, basics: { ...b, [k]: v } });
  const upSec = (s) => setCV({ ...cv, sections: cv.sections.map((x) => (x.id === s.id ? s : x)) });
  const [adding, setAdding] = useState(false);
  return (
    <div className="p-3 space-y-3">
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-2">
        <p className="text-[13px] font-semibold text-slate-100">{tr("About you")}</p>
        <Lbl t={tr("Full name")}><In value={b.name} onChange={setB("name")} data-testid="cv-name" /></Lbl>
        <Lbl t={tr("Job title")}><In value={b.title} onChange={setB("title")} data-testid="cv-title" /></Lbl>
        <div className="grid grid-cols-2 gap-2"><Lbl t={tr("Email")}><In value={b.email} onChange={setB("email")} dir="ltr" inputMode="email" data-testid="cv-email" /></Lbl><Lbl t={tr("Phone")}><In value={b.phone} onChange={setB("phone")} dir="ltr" inputMode="tel" data-testid="cv-phone" /></Lbl></div>
        <Lbl t={tr("City")}><In value={b.city} onChange={setB("city")} /></Lbl>
        <Lbl t={tr("Links (LinkedIn, portfolio) — one per line")}><Tx rows={2} dir="ltr" value={(b.links || []).map((l) => l.url).join("\n")} onChange={(v) => setB("links")(v.split("\n").map((x) => x.trim()).filter(Boolean).map((u) => ({ label: u, url: u })))} /></Lbl>
      </div>
      {cv.sections.map((s, i) => (
        <div key={s.id} className="rounded-xl border border-slate-800 bg-slate-900/60" data-testid="cv-section">
          <div className="flex items-center gap-1 p-2">
            <button className="flex-1 flex items-center gap-2 text-start px-1" onClick={() => setOpen({ ...open, [s.id]: !open[s.id] })}>
              <ChevronDown size={14} className={`text-slate-400 transition-transform ${open[s.id] ? "" : "-rotate-90 rtl:rotate-90"}`} />
              <input className="bg-transparent text-[13px] font-semibold text-slate-100 w-full focus:outline-none" value={s.title} onChange={(e) => upSec({ ...s, title: e.target.value })} onClick={(e) => e.stopPropagation()} aria-label={tr("Section title")} />
            </button>
            <button className="p-1.5 text-slate-400 disabled:opacity-30" disabled={i === 0} onClick={() => setCV(V.moveSection(cv, s.id, -1))} aria-label={tr("Move up")} data-testid="cv-up"><ArrowUp size={14} /></button>
            <button className="p-1.5 text-slate-400 disabled:opacity-30" disabled={i === cv.sections.length - 1} onClick={() => setCV(V.moveSection(cv, s.id, 1))} aria-label={tr("Move down")}><ArrowDown size={14} /></button>
            <label className="flex items-center gap-1 text-[11px] text-slate-400 px-1"><input type="checkbox" checked={s.visible !== false} onChange={(e) => upSec({ ...s, visible: e.target.checked })} />{tr("Show")}</label>
            <button className="p-1.5 text-slate-500" onClick={() => { if (window.confirm(tr("Delete the section “{n}”?", { n: s.title }))) setCV({ ...cv, sections: cv.sections.filter((x) => x.id !== s.id) }); }} aria-label={tr("Delete")}><Trash2 size={14} /></button>
          </div>
          {open[s.id] ? <div className="p-2 pt-0"><SectionEditor s={s} update={upSec} improveJob={(it, idx) => improveJob(s, it, idx)} /></div> : null}
        </div>
      ))}
      {adding ? (
        <div className="grid grid-cols-2 gap-2">{Object.keys(V.SECTION_TYPES).map((t) => <button key={t} className={ghost} onClick={() => { setCV(V.addSection(cv, t)); setAdding(false); }}>{V.SECTION_TYPES[t][getLang() === "ar" ? "ar" : "en"]}</button>)}</div>
      ) : <button className={ghost + " w-full"} onClick={() => setAdding(true)} data-testid="cv-add-section">+ {tr("Add a section")}</button>}
    </div>
  );
}

// ---- design -----------------------------------------------------------------------------------------------------------------------
function DesignTab({ cv, setCV, flash }) {
  const set = (k) => (v) => setCV({ ...cv, [k]: v });
  const Seg = ({ k, opts }) => <div className="flex gap-1.5 flex-wrap">{opts.map(([v, label]) => <button key={String(v)} onClick={() => set(k)(v)} className={`${btn} ${cv[k] === v ? "bg-teal-500 text-slate-950" : "border border-slate-700 text-slate-200"}`} data-testid={`cv-${k}-${v}`}>{label}</button>)}</div>;
  const photoRef = useRef(null);
  const pickPhoto = (file) => {
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => { const img = new Image(); img.onload = () => { const s = 360, k = Math.min(1, s / Math.min(img.width, img.height)), c = document.createElement("canvas"); const w = Math.round(img.width * k), h = Math.round(img.height * k); c.width = s; c.height = s; const ctx = c.getContext("2d"); const side = Math.min(img.width, img.height); ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, s, s); setCV({ ...cv, photo: c.toDataURL("image/jpeg", 0.85), showPhoto: true }); }; img.src = String(fr.result); };
    fr.readAsDataURL(file);
  };
  return (
    <div className="p-3 space-y-4">
      <Lbl t={tr("Look")}><Seg k="layout" opts={[["ats", tr("ATS-safe (one column)")], ["modern", tr("Modern (sidebar)")]]} /></Lbl>
      <p className="text-[11px] text-slate-500 -mt-2">{tr("The content is the same — switch any time. ATS-safe is read best by company filters; Modern looks more designed.")}</p>
      <Lbl t={tr("Colour")}><div className="flex gap-2 flex-wrap">{Object.entries(V.THEMES).map(([k, t]) => <button key={k} onClick={() => set("theme")(k)} aria-label={t.name} data-testid={"cv-theme-" + k} className={`w-9 h-9 rounded-full border-2 ${cv.theme === k ? "border-white" : "border-transparent"}`} style={{ background: t.accent }} />)}</div></Lbl>
      <Lbl t={tr("Font")}><Seg k="font" opts={Object.entries(V.FONTS).map(([k, f]) => [k, f.name])} /></Lbl>
      <Lbl t={tr("Text size: {n} pt", { n: cv.fontSize })}><input type="range" min="9" max="12" step="0.5" value={cv.fontSize} onChange={(e) => set("fontSize")(+e.target.value)} className="w-full" data-testid="cv-fontsize" /></Lbl>
      <Lbl t={tr("Spacing")}><Seg k="spacing" opts={[["compact", tr("Compact")], ["normal", tr("Normal")], ["airy", tr("Airy")]]} /></Lbl>
      <Lbl t={tr("Margins: {n} mm", { n: cv.margin })}><input type="range" min="8" max="22" step="1" value={cv.margin} onChange={(e) => set("margin")(+e.target.value)} className="w-full" /></Lbl>
      <Lbl t={tr("Page")}><Seg k="page" opts={[["A4", "A4"], ["Letter", "Letter"]]} /></Lbl>
      <Lbl t={tr("Fit to")}><Seg k="fit" opts={[[1, tr("1 page")], [2, tr("2 pages")], [0, tr("Don't shrink")]]} /></Lbl>
      <Lbl t={tr("Language & direction")}><Seg k="lang" opts={[["en", "English · LTR"], ["ar", "العربية · RTL"]]} /></Lbl>
      <div>
        <p className="text-[11.5px] text-slate-400 mb-1">{tr("Photo (many employers in Egypt and the Gulf expect one; many elsewhere don't)")}</p>
        <div className="flex items-center gap-3">
          {cv.photo ? <img src={cv.photo} alt="" className="w-14 h-14 rounded-full object-cover border border-slate-700" /> : null}
          <button className={ghost + " flex items-center gap-1"} onClick={() => photoRef.current && photoRef.current.click()}><Camera size={13} />{cv.photo ? tr("Change") : tr("Add photo")}</button>
          {cv.photo ? <label className="flex items-center gap-1.5 text-[12px] text-slate-300"><input type="checkbox" checked={!!cv.showPhoto} onChange={(e) => set("showPhoto")(e.target.checked)} />{tr("Show it")}</label> : null}
          <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickPhoto(e.target.files && e.target.files[0])} />
        </div>
      </div>
    </div>
  );
}

// ---- check ----------------------------------------------------------------------------------------------------------------------------
function CheckTab({ cv }) {
  const items = useMemo(() => V.checkCV(cv), [cv]);
  return (
    <div className="p-3 space-y-2" data-testid="cv-check">
      {!items.length ? <div className="rounded-xl border border-emerald-800 bg-emerald-500/5 p-4 text-sm text-emerald-300 flex items-center gap-2"><Check size={16} />{tr("Nothing to fix — this CV looks complete.")}</div>
        : items.map((x, i) => (
          <div key={i} className={`rounded-lg border p-2.5 text-[13px] flex gap-2 ${x.level === "warn" ? "border-amber-800 bg-amber-500/5 text-amber-100" : "border-slate-800 bg-slate-900/60 text-slate-200"}`}>
            {x.level === "warn" ? <AlertTriangle size={14} className="mt-0.5 shrink-0" /> : <Info size={14} className="mt-0.5 shrink-0 text-slate-400" />}<span>{getLang() === "ar" ? x.ar : x.en}</span>
          </div>))}
    </div>
  );
}

// ---- AI tools -----------------------------------------------------------------------------------------------------------------------------
function AITab({ cv, setCV, llm, modelReady, openEngine, flash, onCopyFor, onNewCV, share, shareWord }) {
  const [busy, setBusy] = useState("");
  const [ad, setAd] = useState(""); const [company, setCompany] = useState("");
  const [tailor, setTailor] = useState(null); const [letter, setLetter] = useState("");
  const [sum, setSum] = useState("");
  const run = async (key, fn) => {
    if (!modelReady) { openEngine && openEngine(); return; }
    setBusy(key);
    try { await fn(); } catch (e) { flash(String((e && e.message) || e).slice(0, 140)); } finally { setBusy(""); }
  };
  const ask = (messages, max = 700) => llm(messages, { json: true, maxTokens: max, temperature: 0.3 });
  const setSummaryText = (t) => { const i = cv.sections.findIndex((s) => s.type === "summary"); if (i < 0) setCV(V.addSection(cv, "summary")); const c = i < 0 ? V.addSection(cv, "summary") : cv; setCV({ ...c, sections: c.sections.map((s) => (s.type === "summary" ? { ...s, items: [{ text: t }], visible: true } : s)) }); };
  const Btn = ({ k, onClick, children, testid }) => <button className={primary + " w-full flex items-center justify-center gap-1.5 py-2.5"} disabled={!!busy} onClick={onClick} data-testid={testid}><Sparkles size={13} />{busy === k ? tr("Working…") : children}</button>;
  return (
    <div className="p-3 space-y-4" data-testid="cv-ai">
      <p className="text-[12px] text-slate-400">{tr("The AI on your phone rewords — it never adds a number, date or skill you didn't write. Anything it suggests is shown first.")}</p>
      <div className="space-y-2 rounded-xl border border-slate-800 p-3">
        <p className="text-[13px] font-semibold text-slate-100">{tr("Professional summary")}</p>
        <Btn k="sum" testid="cv-ai-summary" onClick={() => run("sum", async () => setSum(A.parseSummary(await ask(A.summaryMessages(cv), 300), cv)))}>{tr("Write my summary")}</Btn>
        {sum ? <div className="rounded-lg bg-slate-900 p-2.5 text-[13px] text-slate-200" data-testid="cv-ai-summary-result"><p>{sum}</p><div className="flex gap-2 mt-2"><button className={primary} onClick={() => { setSummaryText(sum); setSum(""); flash(tr("Summary added")); }}>{tr("Use it")}</button><button className={ghost} onClick={() => setSum("")}>{tr("Discard")}</button></div></div> : null}
      </div>
      <div className="space-y-2 rounded-xl border border-slate-800 p-3">
        <p className="text-[13px] font-semibold text-slate-100">{tr("Translate")}</p>
        <p className="text-[12px] text-slate-400">{tr("Makes a new CV in the other language. Names, companies and numbers stay.")}</p>
        <Btn k="tr" testid="cv-ai-translate" onClick={() => run("tr", async () => { const to = cv.lang === "ar" ? "en" : "ar"; const texts = A.collectTexts(JSON.parse(JSON.stringify(cv))).map((x) => x.text); const c = A.applyTranslation(cv, to, await ask(A.translateMessages(texts, to), 1800)); onNewCV({ ...V.copyFor(c, to === "ar" ? "عربي" : "English") }); })}>{cv.lang === "ar" ? tr("Make an English copy") : tr("Make an Arabic copy")}</Btn>
      </div>
      <div className="space-y-2 rounded-xl border border-slate-800 p-3">
        <p className="text-[13px] font-semibold text-slate-100">{tr("For a specific job")}</p>
        <Tx rows={5} value={ad} onChange={setAd} placeholder={tr("Paste the job advert here")} data-testid="cv-ad" />
        <In value={company} onChange={setCompany} placeholder={tr("Company (optional)")} />
        <Btn k="tailor" testid="cv-ai-tailor" onClick={() => run("tailor", async () => setTailor(A.parseTailor(await ask(A.tailorMessages(cv, ad), 900), cv)))}>{tr("Compare my CV with this job")}</Btn>
        {tailor ? (
          <div className="space-y-2" data-testid="cv-ai-tailor-result">
            {tailor.covered.length ? <div><p className="text-[11px] uppercase text-emerald-400">{tr("Your CV already shows")}</p><div className="flex flex-wrap gap-1 mt-1">{tailor.covered.map((k) => <span key={k} className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-200">{k}</span>)}</div></div> : null}
            {tailor.missing.length ? <div><p className="text-[11px] uppercase text-amber-400">{tr("The advert asks for — not in your CV")}</p><div className="flex flex-wrap gap-1 mt-1">{tailor.missing.map((k) => <span key={k} className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-200">{k}</span>)}</div><p className="text-[11px] text-slate-500 mt-1">{tr("Add one only if it is true for you.")}</p></div> : null}
            {tailor.rewrites.map((r, i) => (
              <div key={i} className="rounded-lg bg-slate-900 p-2.5 text-[12.5px]"><p className="text-slate-500 line-through">{r.old}</p><p className="text-slate-100 mt-1">{r.new}</p><button className={primary + " mt-2"} onClick={() => { setCV(A.applyRewrite(cv, r)); setTailor({ ...tailor, rewrites: tailor.rewrites.filter((_, j) => j !== i) }); }}>{tr("Use this wording")}</button></div>))}
            <button className={ghost + " w-full"} onClick={() => onCopyFor(company)} data-testid="cv-copy-for">{tr("Save a copy of this CV for this job")}</button>
          </div>) : null}
        <Btn k="letter" testid="cv-ai-letter" onClick={() => run("letter", async () => setLetter(A.parseLetter(await ask(A.coverLetterMessages(cv, ad, { company }), 700), cv)))}>{tr("Write a cover letter")}</Btn>
        {letter ? <div className="rounded-lg bg-slate-900 p-2.5" data-testid="cv-ai-letter-result"><p className="text-[13px] text-slate-200 whitespace-pre-wrap">{letter}</p><div className="flex gap-2 mt-2"><button className={ghost} onClick={() => { try { navigator.clipboard.writeText(letter); flash(tr("Copied")); } catch (e) {} }}>{tr("Copy")}</button><button className={ghost} onClick={() => shareWord(letter)}>{tr("Word")}</button><button className={ghost} onClick={() => share(letter)}>{tr("Share")}</button></div></div> : null}
      </div>
    </div>
  );
}

// ---- the editor ---------------------------------------------------------------------------------------------------------------------------------
function Editor({ cv: cv0, onChange, onClose, onNewCV, onCopyFor, llm, modelReady, openEngine, flash, share, saveFile }) {
  const [cv, setCVRaw] = useState(cv0);
  const [tab, setTab] = useState("content");
  const setCV = (c) => { const n = { ...c, updated: Date.now() }; setCVRaw(n); onChange(n); };
  const exportName = (cv.basics.name || cv.name || "CV").replace(/[^\w؀-ۿ]+/g, "_");
  const doPdf = async () => { const s = await measureScale(cv); await sharePdf({ html: V.cvHtml(cv, { scale: s }), name: exportName, text: "", flash }); };
  const shareBytes = async (name, bytes, text) => {
    const call = typeof window !== "undefined" ? window.__attuneNativeCall : null;
    if (call) { await call("shareFile", { name, mime: C.MIME.docx, b64: C.bytesToB64(bytes), text: text || "" }); return; }
    if (saveFile) { await saveFile(name, null, C.MIME.docx, C.bytesToB64(bytes)); return; }
    flash(tr("Saving files works in the Android app"));
  };
  const doWord = () => shareBytes(exportName + ".docx", C.docxFromBlocks(V.cvBlocks(cv), cv.name));
  const doText = () => { const t = V.cvText(cv); if (share) share(t); else { try { navigator.clipboard.writeText(t); flash(tr("Copied")); } catch (e) {} } };
  const letterWord = (txt) => shareBytes("cover-letter.docx", C.docxFromBlocks(txt.split(/\n{2,}/).map((p) => ({ type: "p", text: p.trim() })), "Cover letter"));
  // improve one job's bullets
  const improveJob = async (sec, it, idx) => {
    if (!modelReady) { openEngine && openEngine(); return; }
    const bl = (it.bullets || []).filter((x) => String(x).trim());
    if (!bl.length) { flash(tr("Write a bullet first, then improve it")); return; }
    try {
      flash(tr("Improving…"));
      const raw = await llm(A.improveBulletsMessages(it, cv.lang), { json: true, maxTokens: 500, temperature: 0.3 });
      const r = A.parseBullets(raw, it.bullets);
      let k = 0; const nb = it.bullets.map((x) => (String(x).trim() ? r.bullets[k++] : x));
      setCV({ ...cv, sections: cv.sections.map((s) => (s.id === sec.id ? { ...s, items: s.items.map((x, j) => (j === idx ? { ...x, bullets: nb } : x)) } : s)) });
      flash(r.refused.length ? tr("Improved — {n} line(s) kept as you wrote them (the AI tried to add a number)", { n: r.refused.length }) : tr("Improved — check the wording"));
    } catch (e) { flash(String((e && e.message) || e).slice(0, 140)); }
  };
  const TABS = [["content", tr("Content")], ["design", tr("Design")], ["preview", tr("Preview")], ["check", tr("Check")], ["ai", tr("AI")]];
  return (
    <Sheet title={cv.name} onClose={onClose} testid="cv-editor"
      right={<div className="flex gap-1"><button className={primary + " flex items-center gap-1"} onClick={doPdf} data-testid="cv-export-pdf"><Share2 size={12} />PDF</button><button className={ghost} onClick={doWord} data-testid="cv-export-word">Word</button><button className={ghost} onClick={doText}>TXT</button></div>}>
      <div className="sticky top-0 z-10 bg-slate-950 border-b border-slate-800 px-2 py-1.5 flex gap-1 overflow-x-auto">{TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k)} data-testid={"cv-tab-" + k} className={`${btn} shrink-0 ${tab === k ? "bg-teal-500 text-slate-950" : "text-slate-300"}`}>{l}</button>)}</div>
      {tab === "content" ? <ContentTab cv={cv} setCV={setCV} improveJob={improveJob} />
        : tab === "design" ? <DesignTab cv={cv} setCV={setCV} flash={flash} />
        : tab === "preview" ? <Preview cv={cv} />
        : tab === "check" ? <CheckTab cv={cv} />
        : <AITab cv={cv} setCV={setCV} llm={llm} modelReady={modelReady} openEngine={openEngine} flash={flash} share={(t) => (share ? share(t) : null)} shareWord={letterWord}
            onNewCV={(c) => { onNewCV(c); flash(tr("Saved as a new CV: {n}", { n: c.name })); }} onCopyFor={(co) => { const c = V.copyFor(cv, co); onNewCV(c); flash(tr("Saved a copy: {n}", { n: c.name })); }} />}
    </Sheet>
  );
}

// ---- the page: your CVs ----------------------------------------------------------------------------------------------------------------------------
export function CVPage({ flash, llm, modelReady, openEngine, share, saveFile, nativeCall }) {
  const [list, setListRaw] = useState(V.loadAll);
  const [openId, setOpenId] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [text, setText] = useState(""); const [busy, setBusy] = useState(false);
  const setList = (n) => { setListRaw(n); if (!V.saveAll(n)) flash(tr("The phone's storage is full")); };
  const upsert = (c) => setList([c, ...list.filter((x) => x.id !== c.id)]);
  const create = (lang) => { const c = V.newCV(lang); setList([c, ...list]); setOpenId(c.id); setSheet(null); };
  const cur = list.find((c) => c.id === openId);
  const fileText = async (f) => {
    const n = f.name.toLowerCase();
    if (/\.(txt|md|json)$/.test(n)) return f.text();
    if (/\.docx$/.test(n)) { const rd = await C.docxRead(new Uint8Array(await f.arrayBuffer())); return C.blocksToText(rd.blocks); }
    if (/\.pdf$/.test(n) && nativeCall) { const b64 = await new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] || ""); r.onerror = bad; r.readAsDataURL(f); }); const r = await nativeCall("pdfText", { b64 }); return r.pages.map((p) => p.text).join("\n\n"); }
    throw new Error(tr("Pick a PDF, Word or text file, or paste the text"));
  };
  const doImport = async () => {
    if (text.trim().length < 40) return flash(tr("Paste your CV text first"));
    setBusy(true);
    try {
      const lang = /[؀-ۿ]/.test(text.slice(0, 400)) ? "ar" : "en";
      let c = V.newCV(lang, tr("Imported CV"));
      if (modelReady) c = A.applyImport(c, await llm(A.importMessages(text), { json: true, maxTokens: 1800, temperature: 0.1 }), text);
      else { const ex = A.extractContact(text); c.basics = { ...c.basics, ...ex }; c.sections[0].items = [{ text: text.slice(0, 600) }]; flash(tr("No model is loaded: only your contact details were read. Load a model to structure the rest.")); }
      setList([c, ...list]); setSheet(null); setText(""); setOpenId(c.id);
    } catch (e) { flash(String((e && e.message) || e).slice(0, 140)); } finally { setBusy(false); }
  };
  return (
    <section className="p-4 space-y-3" data-testid="cv-page">
      <div className="flex items-start gap-3"><FileText size={22} className="text-teal-300 mt-1" /><div><h2 className="text-lg font-semibold text-slate-100">{tr("CV / Resume")}</h2><p className="text-[13px] text-slate-400">{tr("Build a CV in English or Arabic, keep a copy for every job, and export a clean PDF or Word file. The AI on your phone helps with wording.")}</p></div></div>
      <div className="grid grid-cols-2 gap-2">
        <button className={primary + " py-2.5 flex items-center justify-center gap-1.5"} onClick={() => setSheet("new")} data-testid="cv-new"><Plus size={14} />{tr("New CV")}</button>
        <button className={ghost + " py-2.5 flex items-center justify-center gap-1.5"} onClick={() => setSheet("import")} data-testid="cv-import"><Upload size={14} />{tr("Import my CV")}</button>
      </div>
      {!list.length ? <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center"><p className="text-sm text-slate-300">{tr("No CVs yet")}</p><p className="text-[12px] text-slate-500 mt-1">{tr("Start a new one, or import the one you already have.")}</p></div>
        : list.map((c) => (
          <div key={c.id} className="rounded-xl border border-slate-700 bg-slate-900/70 p-3" data-testid="cv-row">
            <button className="w-full text-start" onClick={() => setOpenId(c.id)}>
              <p className="text-sm font-medium text-slate-100">{c.name}</p>
              <p className="text-[12px] text-slate-400">{c.basics.name || tr("(no name yet)")} · {c.layout === "modern" ? tr("Modern") : tr("ATS-safe")} · {c.lang === "ar" ? "العربية" : "English"} · {c.page}</p>
            </button>
            <div className="flex gap-2 mt-2.5">
              <button className={ghost + " flex items-center gap-1"} onClick={() => { const n = V.copyFor(c); setList([n, ...list]); flash(tr("Copied as “{n}”", { n: n.name })); }}><Copy size={12} />{tr("Duplicate")}</button>
              <button className={ghost + " flex items-center gap-1 text-red-300 ms-auto"} onClick={() => { if (window.confirm(tr("Delete the CV “{n}”?", { n: c.name }))) setList(list.filter((x) => x.id !== c.id)); }}><Trash2 size={12} />{tr("Delete")}</button>
            </div>
          </div>))}
      {sheet === "new" ? <Sheet title={tr("New CV")} onClose={() => setSheet(null)} testid="cv-new-sheet"><div className="p-4 space-y-2"><p className="text-sm text-slate-300">{tr("Which language is this CV in?")}</p>
        <button className={primary + " w-full py-3"} onClick={() => create("en")} data-testid="cv-new-en">English · left to right</button>
        <button className={primary + " w-full py-3"} onClick={() => create("ar")} data-testid="cv-new-ar">العربية · من اليمين لليسار</button></div></Sheet> : null}
      {sheet === "import" ? <Sheet title={tr("Import my CV")} onClose={() => setSheet(null)} testid="cv-import-sheet"><div className="p-4 space-y-3">
        <p className="text-[12.5px] text-slate-400">{tr("Pick your old CV (PDF, Word or text) or paste its text. The AI puts it into sections, keeping your own words. You can fix anything after.")}</p>
        <label className={ghost + " inline-flex items-center gap-1.5 cursor-pointer"}><Upload size={14} />{tr("Pick a file")}<input type="file" accept=".pdf,.docx,.txt,.md" className="hidden" onChange={async (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return; try { setText(await fileText(f)); } catch (x) { flash(String(x.message || x)); } }} /></label>
        <Tx rows={10} value={text} onChange={setText} placeholder={tr("…or paste your CV text here")} data-testid="cv-import-text" />
        <button className={primary + " w-full py-2.5"} disabled={busy} onClick={doImport} data-testid="cv-import-go">{busy ? tr("Reading your CV…") : tr("Import")}</button></div></Sheet> : null}
      {cur ? <Editor key={cur.id} cv={cur} onChange={upsert} onClose={() => setOpenId(null)} onNewCV={(c) => setList([c, ...list])} llm={llm} modelReady={modelReady} openEngine={openEngine} flash={flash} share={share} saveFile={saveFile} /> : null}
    </section>
  );
}
