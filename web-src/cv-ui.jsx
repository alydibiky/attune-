/* ---- More → CV / Resume: build, tailor and export a CV on the phone ---------------------------------------------------------
   Many CVs, a copy per job; an ATS-safe single column or a modern two-column look from the same content; English or Arabic
   (right-to-left); a live preview that fits 1–2 pages; PDF, Word and plain text; the phone's own model helps with wording only
   (cv-ai.js, every number checked by code). Logic: cv.js, cv-ai.js.                                                         */
import React, { useState, useEffect, useRef, useMemo } from "react";
import { Plus, Trash2, Copy, Share2, Download, Upload, ChevronLeft, ChevronDown, ArrowUp, ArrowDown, Check, X, Sparkles, FileText, Camera, AlertTriangle, Info, Volume2, Mic } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import { useSubBack } from "./backstack.js";
import * as V from "./cv.js";
import * as A from "./cv-ai.js";
import * as C from "./convert.js";
import { sharePdf } from "./books-docs.jsx";
import * as J from "./jobready.js";
import { speakNow } from "./lesson-ui.jsx";
import { myCountry } from "./agent-ui.jsx";
import { GRID3 } from "./desk.jsx";
import { useDesktopWide } from "./side-ui.jsx";
import * as K from "./ui-kit.jsx";

const field = K.area;
const btn = "min-h-[44px] px-3.5 rounded-[12px] text-[13px] font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-40 transition-colors duration-150";
const primary = btn + " bg-[var(--c-acc)] text-[var(--c-on-acc)] !font-extrabold";
const ghost = btn + " border border-[var(--c-ln)] bg-[var(--c-surf)] text-[var(--c-ink)] hover:border-[var(--c-acc)]";
const L2 = (en, ar) => (getLang() === "ar" ? ar : en);

function Sheet({ title, onClose, right, children, testid }) {
  useSubBack(true, onClose);
  return (
    <div className="calm att-shift fixed inset-0 z-[70] bg-[var(--c-bg)] flex flex-col" data-testid={testid}>
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--c-ln)]">
        <button onClick={onClose} className="w-11 h-11 -ms-1 grid place-items-center rounded-[12px] text-[var(--c-ink)]" aria-label={tr("Back")}><ChevronLeft size={20} className="rtl:rotate-180" /></button>
        <h2 className="text-[16px] font-extrabold text-[var(--c-ink)] flex-1 truncate">{title}</h2>{right}
      </div>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
const Lbl = ({ t, children }) => <div className="block"><span className="block text-[11.5px] font-bold text-[var(--c-mut)] mb-1">{t}</span>{children}</div>;
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

function Preview({ cv, desk }) {
  const wrap = useRef(null);
  const [w, setW] = useState(340);
  const [scale, setScale] = useState(1);
  useEffect(() => { let on = true; const t = setTimeout(() => measureScale(cv).then((s) => on && setScale(s)), 250); return () => { on = false; clearTimeout(t); }; }, [cv]);
  useEffect(() => { const el = wrap.current; if (!el) return; const ro = new ResizeObserver(() => setW(el.clientWidth)); ro.observe(el); setW(el.clientWidth); return () => ro.disconnect(); }, []);
  const P = V.PAGES[cv.page] || V.PAGES.A4, pxW = P.w * 96 / 25.4, pxH = P.h * 96 / 25.4, k = Math.min(1, (w - (desk ? 26 : 2)) / pxW);
  // desk: the computer's side panel — the page fits inside the padding, and the frame keeps its full page width under the scale
  return (
    <div ref={wrap} className="p-3" data-testid="cv-preview">
      <div style={{ width: pxW * k, height: pxH * k * Math.max(1, cv.fit || 1), margin: "0 auto", background: "#fff", boxShadow: "0 2px 14px rgba(0,0,0,.45)", overflow: "hidden", position: "relative" }}>
        <iframe title="CV" srcDoc={V.cvHtml(cv, { scale })} style={{ width: pxW, maxWidth: "none", height: pxH * Math.max(1, cv.fit || 1), border: 0, transform: `scale(${k})`, transformOrigin: "top left", position: "absolute", left: 0, top: 0 }} sandbox="allow-same-origin" />
      </div>
      {scale < 1 ? <p className="text-center text-[11px] text-[var(--c-warn)] mt-2">{tr("Text shrunk to {p}% to fit {n} page(s)", { p: Math.round(scale * 100), n: cv.fit })}</p> : null}
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
          <span className="text-[var(--c-mut)] pt-2">•</span>
          <textarea className={field + " resize-none"} rows={2} value={b} onChange={(e) => onChange(arr.map((x, j) => (j === i ? e.target.value : x)))} placeholder={tr("What you did and the result (use a number)")} data-testid="cv-bullet" />
          <button className="min-w-[44px] min-h-[44px] grid place-items-center rounded-[12px] text-[var(--c-mut)] hover:text-[var(--c-ink)]" onClick={() => onChange(arr.filter((_, j) => j !== i))} aria-label={tr("Remove")}><X size={14} /></button>
        </div>
      ))}
      <div className="flex gap-2"><button className={ghost} onClick={() => onChange([...arr, ""])}>+ {tr("Bullet")}</button>{onImprove ? <button className={ghost + " flex items-center gap-1"} onClick={onImprove} data-testid="cv-improve"><Sparkles size={12} />{tr("Improve")}</button> : null}</div>
    </div>
  );
}
function ItemCard({ children, onDelete }) { return <div className="rounded-[20px] border border-[var(--c-ln)] bg-[var(--c-surf)] p-2.5 space-y-2 relative"><button className="absolute top-1 end-1 w-10 h-10 grid place-items-center rounded-[12px] text-[var(--c-mut)] hover:text-[var(--c-neg)]" onClick={onDelete} aria-label={tr("Remove")}><Trash2 size={13} /></button>{children}</div>; }

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
            <label className="flex items-center gap-2 text-[12px] text-[var(--c-ink)]"><input type="checkbox" checked={!!it.current} onChange={(e) => upd(i, { current: e.target.checked })} />{tr("I still work here")}</label>
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
      <div className="rounded-[20px] border border-[var(--c-ln)] bg-[var(--c-surf)] p-3 space-y-2">
        <p className="text-[14px] font-extrabold text-[var(--c-ink)]">{tr("About you")}</p>
        <Lbl t={tr("Full name")}><In value={b.name} onChange={setB("name")} data-testid="cv-name" /></Lbl>
        <Lbl t={tr("Job title")}><In value={b.title} onChange={setB("title")} data-testid="cv-title" /></Lbl>
        <div className="grid grid-cols-2 gap-2"><Lbl t={tr("Email")}><In value={b.email} onChange={setB("email")} dir="ltr" inputMode="email" data-testid="cv-email" /></Lbl><Lbl t={tr("Phone")}><In value={b.phone} onChange={setB("phone")} dir="ltr" inputMode="tel" data-testid="cv-phone" /></Lbl></div>
        <Lbl t={tr("City")}><In value={b.city} onChange={setB("city")} /></Lbl>
        <Lbl t={tr("Links (LinkedIn, portfolio) — one per line")}><Tx rows={2} dir="ltr" value={(b.links || []).map((l) => l.url).join("\n")} onChange={(v) => setB("links")(v.split("\n").map((x) => x.trim()).filter(Boolean).map((u) => ({ label: u, url: u })))} /></Lbl>
      </div>
      {cv.sections.map((s, i) => (
        <div key={s.id} className="rounded-[20px] border border-[var(--c-ln)] bg-[var(--c-surf)]" data-testid="cv-section">
          <div className="flex items-center gap-1 p-2">
            <button className="flex-1 flex items-center gap-2 text-start px-1" onClick={() => setOpen({ ...open, [s.id]: !open[s.id] })}>
              <ChevronDown size={14} className={`text-[var(--c-mut)] transition-transform ${open[s.id] ? "" : "-rotate-90 rtl:rotate-90"}`} />
              <input className="bg-transparent text-[13px] font-semibold text-[var(--c-ink)] w-full focus:outline-none" value={s.title} onChange={(e) => upSec({ ...s, title: e.target.value })} onClick={(e) => e.stopPropagation()} aria-label={tr("Section title")} />
            </button>
            <button className="min-w-[44px] min-h-[44px] grid place-items-center rounded-[12px] text-[var(--c-mut)] hover:text-[var(--c-ink)] disabled:opacity-30" disabled={i === 0} onClick={() => setCV(V.moveSection(cv, s.id, -1))} aria-label={tr("Move up")} data-testid="cv-up"><ArrowUp size={14} /></button>
            <button className="min-w-[44px] min-h-[44px] grid place-items-center rounded-[12px] text-[var(--c-mut)] hover:text-[var(--c-ink)] disabled:opacity-30" disabled={i === cv.sections.length - 1} onClick={() => setCV(V.moveSection(cv, s.id, 1))} aria-label={tr("Move down")}><ArrowDown size={14} /></button>
            <label className="flex items-center gap-1 text-[11px] text-[var(--c-mut)] px-1"><input type="checkbox" checked={s.visible !== false} onChange={(e) => upSec({ ...s, visible: e.target.checked })} />{tr("Show")}</label>
            <button className="min-w-[44px] min-h-[44px] grid place-items-center rounded-[12px] text-[var(--c-mut)] hover:text-[var(--c-ink)]" onClick={() => { if (window.confirm(tr("Delete the section “{n}”?", { n: s.title }))) setCV({ ...cv, sections: cv.sections.filter((x) => x.id !== s.id) }); }} aria-label={tr("Delete")}><Trash2 size={14} /></button>
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
  const Seg = ({ k, opts }) => <div className="flex gap-1.5 flex-wrap">{opts.map(([v, label]) => <button key={String(v)} onClick={() => set(k)(v)} className={`${btn} ${cv[k] === v ? "bg-[var(--c-soft)] text-[var(--c-acc)]" : "border border-[var(--c-ln)] bg-[var(--c-surf)] text-[var(--c-ink)]"}`} data-testid={`cv-${k}-${v}`}>{label}</button>)}</div>;
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
      <p className="text-[11px] text-[var(--c-mut)] -mt-2">{tr("The content is the same — switch any time. ATS-safe is read best by company filters; Modern looks more designed.")}</p>
      <Lbl t={tr("Colour")}><div className="flex gap-2 flex-wrap">{Object.entries(V.THEMES).map(([k, t]) => <button key={k} onClick={() => set("theme")(k)} aria-label={t.name} data-testid={"cv-theme-" + k} className={`w-9 h-9 rounded-full border-2 ${cv.theme === k ? "border-[var(--c-ln)]" : "border-transparent"}`} style={{ background: t.accent }} />)}</div></Lbl>
      <Lbl t={tr("Font")}><Seg k="font" opts={Object.entries(V.FONTS).map(([k, f]) => [k, f.name])} /></Lbl>
      <Lbl t={tr("Text size: {n} pt", { n: cv.fontSize })}><input type="range" min="9" max="12" step="0.5" value={cv.fontSize} onChange={(e) => set("fontSize")(+e.target.value)} className="w-full" data-testid="cv-fontsize" /></Lbl>
      <Lbl t={tr("Spacing")}><Seg k="spacing" opts={[["compact", tr("Compact")], ["normal", tr("Normal")], ["airy", tr("Airy")]]} /></Lbl>
      <Lbl t={tr("Margins: {n} mm", { n: cv.margin })}><input type="range" min="8" max="22" step="1" value={cv.margin} onChange={(e) => set("margin")(+e.target.value)} className="w-full" /></Lbl>
      <Lbl t={tr("Page")}><Seg k="page" opts={[["A4", "A4"], ["Letter", "Letter"]]} /></Lbl>
      <Lbl t={tr("Fit to")}><Seg k="fit" opts={[[1, tr("1 page")], [2, tr("2 pages")], [0, tr("Don't shrink")]]} /></Lbl>
      <Lbl t={tr("Language & direction")}><Seg k="lang" opts={[["en", "English · LTR"], ["ar", "العربية · RTL"]]} /></Lbl>
      <div>
        <p className="text-[11.5px] text-[var(--c-mut)] mb-1">{tr("Photo (many employers in Egypt and the Gulf expect one; many elsewhere don't)")}</p>
        <div className="flex items-center gap-3">
          {cv.photo ? <img src={cv.photo} alt="" className="w-14 h-14 rounded-full object-cover border border-[var(--c-ln)]" /> : null}
          <button className={ghost + " flex items-center gap-1"} onClick={() => photoRef.current && photoRef.current.click()}><Camera size={13} />{cv.photo ? tr("Change") : tr("Add photo")}</button>
          {cv.photo ? <label className="flex items-center gap-1.5 text-[12px] text-[var(--c-ink)]"><input type="checkbox" checked={!!cv.showPhoto} onChange={(e) => set("showPhoto")(e.target.checked)} />{tr("Show it")}</label> : null}
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
      {!items.length ? <div className="rounded-[20px] border border-[var(--c-pos)]/50 bg-[var(--c-pos)]/10 p-4 text-sm text-[var(--c-pos)] flex items-center gap-2"><Check size={16} />{tr("Nothing to fix — this CV looks complete.")}</div>
        : items.map((x, i) => (
          <div key={i} className={`rounded-[20px] border p-3 text-[13px] flex gap-2 ${x.level === "warn" ? "border-[var(--c-warn)]/50 bg-[var(--c-warn)]/10 text-[var(--c-warn)]" : "border-[var(--c-ln)] bg-[var(--c-surf)] text-[var(--c-ink)]"}`}>
            {x.level === "warn" ? <AlertTriangle size={14} className="mt-0.5 shrink-0" /> : <Info size={14} className="mt-0.5 shrink-0 text-[var(--c-mut)]" />}<span>{getLang() === "ar" ? x.ar : x.en}</span>
          </div>))}
    </div>
  );
}

// ---- AI tools -----------------------------------------------------------------------------------------------------------------------------
// v6.27 Job ready (jobready.js — all code): the job you want → the skills your CV shows and lacks (a missing one can start a
// Learn daily course), interview practice by voice with feedback, and the job sites people use in your country.
function JobTab({ cv, setCV, llm, modelReady, listen, native, flash, goAI }) {
  const ar = getLang() === "ar";
  const target = cv.target || {}, setT = (k, v) => setCV({ ...cv, target: { ...target, [k]: v } });
  const text = useMemo(() => V.cvText(cv), [cv]);
  const sk = J.skillsCheck(text, target.role || "");
  const qs = J.questions(target.role || "", ar ? "ar" : "en");
  const [qi, setQi] = useState(0), [ans, setAns] = useState(""), [fb, setFb] = useState(null), [ai, setAi] = useState(""), [rec, setRec] = useState(false);
  const ask = () => speakNow(qs[qi % qs.length], { lang: ar ? "ar" : "en", native });
  const speak = async () => {
    if (rec) return;
    if (listen) { setRec(true); try { const t = await listen(ar ? "ar-EG" : "en-US", (p) => setAns(p)); if (t) setAns(t); } catch (e) {} setRec(false); return; }
    const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) { flash(tr("Voice input works in the Android app and in Chrome — or type your answer")); return; }
    const r = new SR(); r.lang = ar ? "ar-EG" : "en-US"; r.interimResults = true; r.continuous = true; let base = ans ? ans + " " : "";
    r.onresult = (e) => { let s = ""; for (const x of e.results) s += x[0].transcript; setAns(base + s); };
    r.onend = () => setRec(false); setRec(r); r.start();
  };
  const stopRec = () => { try { rec && rec.stop && rec.stop(); } catch (e) {} setRec(false); };
  const check = () => { stopRec(); setFb(J.feedback(ans, { cvText: text, lang: ar ? "ar" : "en" })); setAi(""); };
  const coach = async () => { if (!modelReady) return; setAi("…"); try { setAi(String(await llm(J.coachPrompt(qs[qi % qs.length], ans, ar ? "ar" : "en"), { maxTokens: 300, temperature: 0.3 }) || "").trim()); } catch (e) { setAi(""); } };
  const country = myCountry();
  const links = J.jobLinks(target.role || "", target.city || "", country);
  return (
    <div className="p-3 space-y-3 md:max-w-3xl md:mx-auto" data-testid="cv-job">
      <div className="rounded-[20px] border border-[var(--c-ln)] bg-[var(--c-surf)] p-3 space-y-2">
        <p className="text-[14px] font-extrabold text-[var(--c-ink)]">{tr("The job you want")}</p>
        <div className="grid grid-cols-2 gap-2">
          <input value={target.role || ""} onChange={(e) => setT("role", e.target.value)} placeholder={tr("e.g. Data analyst")} className={field} dir="auto" data-testid="cv-job-role" />
          <input value={target.city || ""} onChange={(e) => setT("city", e.target.value)} placeholder={tr("City")} className={field} dir="auto" data-testid="cv-job-city" />
        </div>
      </div>
      {target.role ? (sk.role ? (
        <div className="rounded-[20px] border border-[var(--c-ln)] bg-[var(--c-surf)] p-3 space-y-2" data-testid="cv-job-skills">
          <div className="flex items-center justify-between"><p className="text-[14px] font-extrabold text-[var(--c-ink)]">{tr("Skills employers ask for")}</p><span className="text-[12px] text-[var(--c-acc)] tabular-nums">{sk.have.length}/{sk.have.length + sk.missing.length}</span></div>
          <div className="h-2 rounded-full bg-[var(--c-surf-2)] overflow-hidden"><div className="h-full bg-[var(--c-acc)]" style={{ width: sk.score + "%" }} /></div>
          <div className="flex flex-wrap gap-1.5">{sk.have.map((x) => <span key={x} className="rounded-full px-2.5 py-1 text-[12px] bg-[var(--c-soft)] text-[var(--c-acc)]"><Check size={11} className="inline me-1" />{x}</span>)}</div>
          {sk.missing.length ? <><p className="text-[12px] text-[var(--c-mut)] m-0">{tr("Not on your CV yet — add it if you have it, or learn it:")}</p>
            <div className="flex flex-wrap gap-1.5">{sk.missing.map((x) => <button key={x} onClick={() => window.dispatchEvent(new CustomEvent("attune-learn", { detail: { topic: x } }))} className="rounded-full px-2.5 py-1 text-[12px] border border-[var(--c-warn)]/50 text-[var(--c-warn)]" data-testid="cv-job-learn">{x} · {tr("learn it")}</button>)}</div></> : null}
          <button className={ghost} onClick={goAI}>{tr("Tailor this CV to a job ad")}</button>
        </div>) : <p className="text-[12.5px] text-[var(--c-mut)]">{tr("I don't have a skills list for this job yet — the interview practice and job search still work.")}</p>) : null}
      <div className="rounded-[20px] border border-[var(--c-ln)] bg-[var(--c-surf)] p-3 space-y-2" data-testid="cv-job-practice">
        <div className="flex items-center justify-between"><p className="text-[14px] font-extrabold text-[var(--c-ink)]">{tr("Interview practice")}</p><span className="text-[12px] text-[var(--c-mut)]">{(qi % qs.length) + 1}/{qs.length}</span></div>
        <p className="text-[16px] text-[var(--c-ink)] m-0" dir="auto" data-testid="cv-job-q">{qs[qi % qs.length]}</p>
        <div className="flex gap-2 flex-wrap">
          <button className={ghost + " flex items-center gap-1"} onClick={ask} data-testid="cv-job-hear"><Volume2 size={13} />{tr("Hear it")}</button>
          <button className={(rec ? btn + " bg-[var(--c-neg)] text-[var(--c-on-acc)]" : primary) + " flex items-center gap-1"} onClick={rec ? stopRec : speak} data-testid="cv-job-mic"><Mic size={13} />{rec ? tr("Stop") : tr("Answer out loud")}</button>
          <button className={ghost} onClick={() => { stopRec(); setQi(qi + 1); setAns(""); setFb(null); setAi(""); }} data-testid="cv-job-next">{tr("Next question")}</button>
        </div>
        <Tx rows={4} value={ans} onChange={setAns} placeholder={tr("…or type your answer")} data-testid="cv-job-answer" />
        <button className={primary + " w-full py-2.5"} disabled={!ans.trim()} onClick={check} data-testid="cv-job-check">{tr("How did I do?")}</button>
        {fb ? <div className="space-y-1" data-testid="cv-job-feedback">
          {fb.good.map((x, i) => <p key={"g" + i} className="m-0 text-[13px] text-[var(--c-acc)] flex gap-1.5"><Check size={14} className="shrink-0 mt-0.5" />{x}</p>)}
          {fb.fix.map((x, i) => <p key={"f" + i} className="m-0 text-[13px] text-[var(--c-warn)] flex gap-1.5"><AlertTriangle size={14} className="shrink-0 mt-0.5" />{x}</p>)}
          {modelReady ? <button className={ghost + " flex items-center gap-1 mt-1"} onClick={coach} data-testid="cv-job-coach"><Sparkles size={13} />{tr("Ask the AI coach")}</button> : null}
          {ai ? <p className="m-0 text-[13px] text-[var(--c-ink)] whitespace-pre-wrap" dir="auto"><Sparkles size={12} className="inline me-1 text-[var(--c-acc)]" />{ai}</p> : null}
        </div> : null}
      </div>
      <MockInterview qs={qs} ar={ar} listen={listen} native={native} llm={llm} modelReady={modelReady} cvText={text} flash={flash} />
      {links.length ? <div className="rounded-[20px] border border-[var(--c-ln)] bg-[var(--c-surf)] p-3 space-y-1.5" data-testid="cv-job-links">
        <p className="text-[14px] font-extrabold text-[var(--c-ink)]">{tr("Find jobs")} · {target.role}{target.city ? " · " + target.city : ""}</p>
        <div className="flex flex-wrap gap-1.5">{links.map((l) => <button key={l.label} className={ghost} onClick={() => window.dispatchEvent(new CustomEvent("attune-agent", { detail: { link: l, plan: null, inApp: false } }))} data-testid="cv-job-link">{l.label}</button>)}</div>
        <p className="text-[11.5px] text-[var(--c-mut)] m-0">{tr("Apply with the PDF from this CV (the button at the top).")}</p>
      </div> : null}
    </div>);
}

// v6.41 (S5): a scored mock interview — 5 questions read aloud, each answer timed and scored by code, a scorecard at the end,
// and a better version of each answer from the person's own facts (the model, only when asked)
function MockInterview({ qs, ar, listen, native, llm, modelReady, cvText, flash }) {
  const [on, setOn] = useState(false), [i, setI] = useState(0), [rows, setRows] = useState([]), [ans, setAns] = useState(""), [rec, setRec] = useState(false), [t0, setT0] = useState(0);
  const [better, setBetter] = useState({});
  const list = qs.slice(0, 5), lang = ar ? "ar" : "en";
  const hear = (k) => speakNow(list[k], { lang, native });
  const start = () => { setOn(true); setI(0); setRows([]); setAns(""); setBetter({}); hear(0); };
  const record = async () => {
    if (!listen) { flash(tr("Voice input works in the Android app and in Chrome — or type your answer")); return; }
    setRec(true); const st = Date.now(); setT0(st);
    try { const t = await listen(ar ? "ar-EG" : "en-US", (p) => setAns(p)); if (t) setAns(t); } catch (e) {}
    setRec(false); setT0((x) => (x ? -(Date.now() - st) : x));
  };
  const next = () => {
    const secs = t0 < 0 ? -t0 / 1000 : 0;
    const row = { q: list[i], a: ans, secs, score: ans.trim() ? J.scoreAnswer(ans, secs, { cvText, lang }) : null };
    const r2 = [...rows, row]; setRows(r2); setAns(""); setT0(0);
    if (i + 1 < list.length) { setI(i + 1); hear(i + 1); } else setI(list.length);
  };
  const improve = async (k) => { setBetter((b) => ({ ...b, [k]: "…" })); try { const t = await llm(J.betterAnswerPrompt(rows[k].q, rows[k].a, lang), { maxTokens: 350, temperature: 0.3 }); setBetter((b) => ({ ...b, [k]: String(t || "").trim() })); } catch (e) { setBetter((b) => ({ ...b, [k]: "" })); } };
  const card = J.scorecard(rows, lang);
  const Bar = ({ label, v }) => v == null ? null : <div className="flex items-center gap-2 text-[12px]"><span className="w-24 text-[var(--c-mut)]">{label}</span><div className="flex-1 h-1.5 rounded-full bg-[var(--c-surf-2)] overflow-hidden"><div className={"h-full " + (v >= 70 ? "bg-[var(--c-acc)]" : v >= 45 ? "bg-[var(--c-warn)]" : "bg-[var(--c-neg)]")} style={{ width: v + "%" }} /></div><span className="w-8 text-end tabular-nums text-[var(--c-ink)]">{v}</span></div>;
  if (!on) return <button className={ghost + " w-full py-2.5 flex items-center justify-center gap-1.5"} onClick={start} data-testid="mock-start"><Mic size={14} />{tr("Mock interview — 5 questions, scored")}</button>;
  return (
    <div className="rounded-[20px] border border-[var(--c-acc)]/50 bg-[var(--c-surf)] p-3.5 space-y-2" data-testid="mock">
      {i < list.length ? <>
        <div className="flex items-center justify-between"><p className="text-[14px] font-extrabold text-[var(--c-ink)]">{tr("Mock interview")}</p><span className="text-[12px] text-[var(--c-mut)]">{i + 1}/{list.length}</span></div>
        <p className="text-[16px] text-[var(--c-ink)] m-0" dir="auto" data-testid="mock-q">{list[i]}</p>
        <div className="flex gap-2 flex-wrap">
          <button className={ghost + " flex items-center gap-1"} onClick={() => hear(i)}><Volume2 size={13} />{tr("Hear it again")}</button>
          <button className={(rec ? btn + " bg-[var(--c-neg)] text-[var(--c-on-acc)]" : primary) + " flex items-center gap-1"} onClick={rec ? () => { try { native && native.stopListening && native.stopListening(); } catch (e) {} } : record} data-testid="mock-mic"><Mic size={13} />{rec ? tr("Stop") : tr("Answer out loud")}</button>
        </div>
        <Tx rows={3} value={ans} onChange={setAns} placeholder={tr("…or type your answer")} data-testid="mock-answer" />
        <button className={primary + " w-full py-2.5"} onClick={next} disabled={rec} data-testid="mock-next">{i + 1 < list.length ? tr("Next question") : tr("Finish and score")}</button>
      </> : <>
        <p className="text-[14px] font-extrabold text-[var(--c-ink)]">{tr("Your score")}: <span className="text-[var(--c-acc)] text-lg" data-testid="mock-total">{card ? card.total : 0}</span>/100</p>
        {card ? <div className="space-y-1" data-testid="mock-card">
          <Bar label={tr("Story")} v={card.structure} /><Bar label={tr("No fillers")} v={card.fillers} /><Bar label={tr("Confidence")} v={card.confidence} /><Bar label={tr("Pace")} v={card.pace} />
          <p className="text-[12.5px] text-[var(--c-warn)] m-0 pt-1" dir="auto" data-testid="mock-tip">{card.tip}</p></div> : <p className="text-[12.5px] text-[var(--c-mut)]">{tr("No answers to score.")}</p>}
        {rows.map((r, k) => r.score ? <div key={k} className="border-t border-[var(--c-ln)] pt-2 space-y-1" data-testid="mock-row">
          <p className="text-[12.5px] text-[var(--c-ink)] m-0" dir="auto">{k + 1}. {r.q} — <b className="text-[var(--c-ink)]">{r.score.total}</b>{r.score.pace.wpm ? " · " + tr("{w} words/min", { w: r.score.pace.wpm }) : ""}{r.score.fillers ? " · " + tr("{n} fillers", { n: r.score.fillers }) : ""}</p>
          {better[k] ? <p className="text-[13px] text-[var(--c-acc)] m-0 whitespace-pre-wrap" dir="auto" data-testid="mock-better">{better[k]}</p>
            : modelReady ? <button className={ghost + " text-[12px]"} onClick={() => improve(k)} data-testid="mock-improve"><Sparkles size={12} className="inline me-1" />{tr("Show a better answer")}</button> : null}
        </div> : null)}
        <button className={ghost} onClick={start}>{tr("Try again")}</button>
      </>}
    </div>);
}

function AITab({ cv, setCV, llm, modelReady, openEngine, flash, onCopyFor, onNewCV, share, shareWord }) {
  const [busy, setBusy] = useState("");
  const [ad, setAd] = useState(""); const [company, setCompany] = useState("");
  const [tailor, setTailor] = useState(null); const [letter, setLetter] = useState("");
  const [sum, setSum] = useState("");
  const [req, setReq] = useState(""); const [rev, setRev] = useState(null); const [undo, setUndo] = useState(null);
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
      <p className="text-[12px] text-[var(--c-mut)]">{tr("The AI on your phone rewords — it never adds a number, date or skill you didn't write. Anything it suggests is shown first.")}</p>
      <div className="space-y-2 rounded-[20px] border border-[var(--c-acc)]/50 bg-[var(--c-soft)] p-3.5" data-testid="cv-ai-revise">
        <p className="text-[14px] font-extrabold text-[var(--c-ink)]">{tr("Edit or improve my CV")}</p>
        <p className="text-[12px] text-[var(--c-mut)]">{tr("Say what to add or change («add my job at Dar Al Fouad Hospital as a nurse, 2019–2022», «change my phone to …»), or leave it empty and just make it more professional. You see the result before it is kept.")}</p>
        <Tx rows={3} value={req} onChange={setReq} placeholder={tr("What should be added or changed? (optional)")} data-testid="cv-revise-text" />
        <div className="grid grid-cols-2 gap-2">
          <Btn k="rev" testid="cv-revise-go" onClick={() => run("rev", async () => setRev({ ...A.parseRevise(await ask(A.reviseMessages(cv, req, false), 1800), cv, req), polish: false }))}>{tr("Apply my change")}</Btn>
          <Btn k="revp" testid="cv-revise-polish" onClick={() => run("revp", async () => setRev({ ...A.parseRevise(await ask(A.reviseMessages(cv, req, true), 1800), cv, req), polish: true }))}>{tr("Change + make it professional")}</Btn>
        </div>
        {rev ? <div className="rounded-[12px] bg-[var(--c-surf)] border border-[var(--c-ln)] p-3" data-testid="cv-revise-result"><p className={K.label + " mb-1"}>{tr("New version")}</p><p className="text-[12.5px] text-[var(--c-ink)] whitespace-pre-wrap max-h-64 overflow-auto">{V.cvText(rev.cv)}</p><div className="flex gap-2 mt-2"><button className={primary} onClick={() => { setUndo(cv); setCV(rev.cv); setRev(null); setReq(""); flash(tr("Done — you can undo it")); }} data-testid="cv-revise-apply">{tr("Use this version")}</button><button className={ghost} onClick={() => setRev(null)}>{tr("Cancel")}</button></div></div> : null}
        {undo ? <button className={ghost + " w-full"} onClick={() => { setCV(undo); setUndo(null); }} data-testid="cv-revise-undo">{tr("Undo the last change")}</button> : null}
      </div>
      <div className="space-y-2 rounded-[20px] border border-[var(--c-ln)] bg-[var(--c-surf)] p-3.5">
        <p className="text-[14px] font-extrabold text-[var(--c-ink)]">{tr("Professional summary")}</p>
        <Btn k="sum" testid="cv-ai-summary" onClick={() => run("sum", async () => setSum(A.parseSummary(await ask(A.summaryMessages(cv), 300), cv)))}>{tr("Write my summary")}</Btn>
        {sum ? <div className="rounded-[12px] bg-[var(--c-surf)] border border-[var(--c-ln)] p-3 text-[13px] text-[var(--c-ink)]" data-testid="cv-ai-summary-result"><p>{sum}</p><div className="flex gap-2 mt-2"><button className={primary} onClick={() => { setSummaryText(sum); setSum(""); flash(tr("Summary added")); }}>{tr("Use it")}</button><button className={ghost} onClick={() => setSum("")}>{tr("Discard")}</button></div></div> : null}
      </div>
      <div className="space-y-2 rounded-[20px] border border-[var(--c-ln)] bg-[var(--c-surf)] p-3.5">
        <p className="text-[14px] font-extrabold text-[var(--c-ink)]">{tr("Translate")}</p>
        <p className="text-[12px] text-[var(--c-mut)]">{tr("Makes a new CV in the other language. Names, companies and numbers stay.")}</p>
        <Btn k="tr" testid="cv-ai-translate" onClick={() => run("tr", async () => { const to = cv.lang === "ar" ? "en" : "ar"; const texts = A.collectTexts(JSON.parse(JSON.stringify(cv))).map((x) => x.text); const c = A.applyTranslation(cv, to, await ask(A.translateMessages(texts, to), 1800)); onNewCV({ ...V.copyFor(c, to === "ar" ? "عربي" : "English") }); })}>{cv.lang === "ar" ? tr("Make an English copy") : tr("Make an Arabic copy")}</Btn>
      </div>
      <div className="space-y-2 rounded-[20px] border border-[var(--c-ln)] bg-[var(--c-surf)] p-3.5">
        <p className="text-[14px] font-extrabold text-[var(--c-ink)]">{tr("For a specific job")}</p>
        <Tx rows={5} value={ad} onChange={setAd} placeholder={tr("Paste the job advert here")} data-testid="cv-ad" />
        <In value={company} onChange={setCompany} placeholder={tr("Company (optional)")} />
        <Btn k="tailor" testid="cv-ai-tailor" onClick={() => run("tailor", async () => setTailor(A.parseTailor(await ask(A.tailorMessages(cv, ad), 900), cv)))}>{tr("Compare my CV with this job")}</Btn>
        {tailor ? (
          <div className="space-y-2" data-testid="cv-ai-tailor-result">
            {tailor.covered.length ? <div><p className="text-[12px] uppercase text-[var(--c-pos)]">{tr("Your CV already shows")}</p><div className="flex flex-wrap gap-1 mt-1">{tailor.covered.map((k) => <span key={k} className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--c-pos)]/15 text-[var(--c-pos)]">{k}</span>)}</div></div> : null}
            {tailor.missing.length ? <div><p className="text-[12px] uppercase text-[var(--c-warn)]">{tr("The advert asks for — not in your CV")}</p><div className="flex flex-wrap gap-1 mt-1">{tailor.missing.map((k) => <span key={k} className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--c-warn)]/15 text-[var(--c-warn)]">{k}</span>)}</div><p className="text-[11px] text-[var(--c-mut)] mt-1">{tr("Add one only if it is true for you.")}</p></div> : null}
            {tailor.rewrites.map((r, i) => (
              <div key={i} className="rounded-[12px] bg-[var(--c-surf)] border border-[var(--c-ln)] p-3 text-[12.5px]"><p className="text-[var(--c-mut)] line-through">{r.old}</p><p className="text-[var(--c-ink)] mt-1">{r.new}</p><button className={primary + " mt-2"} onClick={() => { setCV(A.applyRewrite(cv, r)); setTailor({ ...tailor, rewrites: tailor.rewrites.filter((_, j) => j !== i) }); }}>{tr("Use this wording")}</button></div>))}
            <button className={ghost + " w-full"} onClick={() => onCopyFor(company)} data-testid="cv-copy-for">{tr("Save a copy of this CV for this job")}</button>
          </div>) : null}
        <Btn k="letter" testid="cv-ai-letter" onClick={() => run("letter", async () => setLetter(A.parseLetter(await ask(A.coverLetterMessages(cv, ad, { company }), 700), cv)))}>{tr("Write a cover letter")}</Btn>
        {letter ? <div className="rounded-[12px] bg-[var(--c-surf)] border border-[var(--c-ln)] p-3" data-testid="cv-ai-letter-result"><p className="text-[13px] text-[var(--c-ink)] whitespace-pre-wrap">{letter}</p><div className="flex gap-2 mt-2"><button className={ghost} onClick={() => { try { navigator.clipboard.writeText(letter); flash(tr("Copied")); } catch (e) {} }}>{tr("Copy")}</button><button className={ghost} onClick={() => shareWord(letter)}>{tr("Word")}</button><button className={ghost} onClick={() => share(letter)}>{tr("Share")}</button></div></div> : null}
      </div>
    </div>
  );
}

// ---- the editor ---------------------------------------------------------------------------------------------------------------------------------
function Editor({ cv: cv0, onChange, onClose, onNewCV, onCopyFor, llm, modelReady, openEngine, flash, share, saveFile, listen, native }) {
  const [cv, setCVRaw] = useState(cv0);
  const [tab, setTab] = useState("content");
  // v6.27 computer layout: what you edit on the left, the live preview always on the right (so the Preview tab is not needed there)
  const wide = useDesktopWide();
  const shown = wide && tab === "preview" ? "content" : tab;
  const setCV = (c) => { const n = { ...c, updated: Date.now() }; setCVRaw(n); onChange(n); };
  const exportName = (cv.basics.name || cv.name || "CV").replace(/[^\w؀-ۿ]+/g, "_");
  const doPdf = async () => { const s = await measureScale(cv); await sharePdf({ html: V.cvHtml(cv, { scale: s }), name: exportName, text: "", flash }); };
  const shareBytes = async (name, bytes, text) => {
    // (v6.28: share where the app can, else save the file; a failure says so — it used to throw, and Word did nothing)
    const call = typeof window !== "undefined" ? window.__attuneNativeCall : null, N = typeof window !== "undefined" ? window.AttuneNative : null;
    try {
      if (call && N && typeof N.shareFile === "function") { await call("shareFile", { name, mime: C.MIME.docx, b64: C.bytesToB64(bytes), text: text || "" }); return; }
      if (saveFile) { await saveFile(name, null, C.MIME.docx, C.bytesToB64(bytes)); return; }
    } catch (e) { flash(tr("Couldn't share the file") + " — " + String((e && e.message) || e).slice(0, 80)); return; }
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
  const TABS = [["content", tr("Content")], ["design", tr("Design")], ["preview", tr("Preview")], ["check", tr("Check")], ["job", tr("Job ready")], ["ai", tr("AI")]];
  return (
    <Sheet title={cv.name} onClose={onClose} testid="cv-editor"
      right={<div className="flex gap-1"><button className={primary + " flex items-center gap-1"} onClick={doPdf} data-testid="cv-export-pdf"><Share2 size={12} />PDF</button><button className={ghost} onClick={doWord} data-testid="cv-export-word">Word</button><button className={ghost} onClick={doText}>TXT</button></div>}>
      <div className="lg:flex lg:h-full">
      <div className="lg:flex-1 lg:min-w-0 lg:overflow-auto">
      <div className="sticky top-0 z-10 bg-[var(--c-bg)] border-b border-[var(--c-ln)] px-2 py-1.5 flex gap-1 overflow-x-auto">{TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k)} data-testid={"cv-tab-" + k} className={`${btn} shrink-0 !rounded-full ${shown === k ? "bg-[var(--c-soft)] text-[var(--c-acc)]" : "text-[var(--c-mut)]"}${k === "preview" ? " lg:hidden" : ""}`}>{l}</button>)}</div>
      {shown === "content" ? <ContentTab cv={cv} setCV={setCV} improveJob={improveJob} />
        : shown === "design" ? <DesignTab cv={cv} setCV={setCV} flash={flash} />
        : shown === "preview" ? <Preview cv={cv} />
        : shown === "check" ? <CheckTab cv={cv} />
        : shown === "job" ? <JobTab cv={cv} setCV={setCV} llm={llm} modelReady={modelReady} listen={listen} native={native} flash={flash} goAI={() => setTab("ai")} />
        : <AITab cv={cv} setCV={setCV} llm={llm} modelReady={modelReady} openEngine={openEngine} flash={flash} share={(t) => (share ? share(t) : null)} shareWord={letterWord}
            onNewCV={(c) => { onNewCV(c); flash(tr("Saved as a new CV: {n}", { n: c.name })); }} onCopyFor={(co) => { const c = V.copyFor(cv, co); onNewCV(c); flash(tr("Saved a copy: {n}", { n: c.name })); }} />}
      </div>
      {wide ? <div className="hidden lg:block lg:w-[46%] lg:shrink-0 lg:overflow-auto lg:border-s lg:border-[var(--c-ln)] lg:bg-[var(--c-surf)]" data-testid="cv-live-preview"><Preview cv={cv} desk /></div> : null}
      </div>
    </Sheet>
  );
}

// ---- the page: your CVs ----------------------------------------------------------------------------------------------------------------------------
export function CVPage({ flash, llm, modelReady, openEngine, share, saveFile, nativeCall, listen, native }) {
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
  const [note, setNote] = useState("");
  const doImport = async () => {
    if (text.trim().length < 40) { setNote(tr("Paste your CV text first")); return; }
    setBusy(true); setNote("");
    try {
      const lang = /[؀-ۿ]/.test(text.slice(0, 400)) ? "ar" : "en";
      const codeJ = A.parseCVText(text);   // always works, keeps every line
      let j = codeJ;
      if (modelReady) {
        setNote(tr("Reading your CV… the AI is sorting it into sections"));
        try {
          const raw = await Promise.race([llm(A.importMessages(text), { json: true, maxTokens: 4000, temperature: 0.1 }), new Promise((_, bad) => setTimeout(() => bad(new Error("timeout")), 120000))]);
          j = A.mergeImport(codeJ, A.jsonLoose(raw), text);
        } catch (e) { /* the code's reading is kept */ }
      }
      const c = A.applyImport(V.newCV(lang, tr("Imported CV")), j, text);
      setList([c, ...list]); setSheet(null); setText(""); setNote(""); setOpenId(c.id);
      flash(tr("Imported — check each section and fix anything"));
    } catch (e) { setNote(String((e && e.message) || e).slice(0, 160)); } finally { setBusy(false); }
  };
  return (
    <section className="calm bg-[var(--c-bg)] text-[var(--c-ink)] p-4 space-y-3" data-testid="cv-page">
      <div className="flex items-start gap-3"><FileText size={22} className="text-[var(--c-acc)] mt-1" /><div><h2 className={K.h1}>{tr("CV / Resume")}</h2><p data-intro="" className="text-[13px] text-[var(--c-mut)] lg:max-w-[70ch]">{tr("Build a CV in English or Arabic, keep a copy for every job, and export a clean PDF or Word file. The AI on your phone helps with wording.")}</p></div></div>
      <div className="grid grid-cols-2 gap-2 lg:max-w-md">
        <button className={primary + " py-2.5 flex items-center justify-center gap-1.5"} onClick={() => setSheet("new")} data-testid="cv-new"><Plus size={14} />{tr("New CV")}</button>
        <button className={ghost + " py-2.5 flex items-center justify-center gap-1.5"} onClick={() => setSheet("import")} data-testid="cv-import"><Upload size={14} />{tr("Import my CV")}</button>
      </div>
      {!list.length ? <div className="rounded-[20px] border border-dashed border-[var(--c-ln)] p-6 text-center"><p className="text-sm text-[var(--c-ink)]">{tr("No CVs yet")}</p><p className="text-[12px] text-[var(--c-mut)] mt-1">{tr("Start a new one, or import the one you already have.")}</p></div>
        : <div className={GRID3}>{list.map((c) => (
          <div key={c.id} className="rounded-[20px] border border-[var(--c-ln)] bg-[var(--c-surf)] p-3" data-testid="cv-row">
            <button className="w-full text-start" onClick={() => setOpenId(c.id)}>
              <p className="text-[14.5px] font-extrabold text-[var(--c-ink)]">{c.name}</p>
              <p className="text-[12px] text-[var(--c-mut)]">{c.basics.name || tr("(no name yet)")} · {c.layout === "modern" ? tr("Modern") : tr("ATS-safe")} · {c.lang === "ar" ? "العربية" : "English"} · {c.page}</p>
            </button>
            <div className="flex gap-2 mt-2.5">
              <button className={ghost + " flex items-center gap-1"} onClick={() => { const n = V.copyFor(c); setList([n, ...list]); flash(tr("Copied as “{n}”", { n: n.name })); }}><Copy size={12} />{tr("Duplicate")}</button>
              <button className={ghost + " flex items-center gap-1 text-[var(--c-neg)] ms-auto"} onClick={() => { if (window.confirm(tr("Delete the CV “{n}”?", { n: c.name }))) setList(list.filter((x) => x.id !== c.id)); }}><Trash2 size={12} />{tr("Delete")}</button>
            </div>
          </div>))}</div>}
      {sheet === "new" ? <Sheet title={tr("New CV")} onClose={() => setSheet(null)} testid="cv-new-sheet"><div className="p-4 space-y-2"><p className="text-sm text-[var(--c-ink)]">{tr("Which language is this CV in?")}</p>
        <button className={primary + " w-full py-3"} onClick={() => create("en")} data-testid="cv-new-en">English · left to right</button>
        <button className={primary + " w-full py-3"} onClick={() => create("ar")} data-testid="cv-new-ar">العربية · من اليمين لليسار</button></div></Sheet> : null}
      {sheet === "import" ? <Sheet title={tr("Import my CV")} onClose={() => setSheet(null)} testid="cv-import-sheet"><div className="p-4 space-y-3">
        <p className="text-[12.5px] text-[var(--c-mut)]">{tr("Pick your old CV (PDF, Word or text) or paste its text. The AI puts it into sections, keeping your own words. You can fix anything after.")}</p>
        <label className={ghost + " inline-flex items-center gap-1.5 cursor-pointer"}><Upload size={14} />{tr("Pick a file")}<input type="file" accept=".pdf,.docx,.txt,.md" className="hidden" onChange={async (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return; try { setText(await fileText(f)); } catch (x) { flash(String(x.message || x)); } }} /></label>
        <Tx rows={10} value={text} onChange={setText} placeholder={tr("…or paste your CV text here")} data-testid="cv-import-text" />
        <button className={primary + " w-full py-2.5"} disabled={busy} onClick={doImport} data-testid="cv-import-go">{busy ? tr("Reading your CV…") : tr("Import")}</button>
        {note ? <p className="text-[12.5px] text-[var(--c-warn)]" data-testid="cv-import-note">{note}</p> : null}</div></Sheet> : null}
      {cur ? <Editor key={cur.id} cv={cur} onChange={upsert} onClose={() => setOpenId(null)} onNewCV={(c) => setList([c, ...list])} llm={llm} modelReady={modelReady} openEngine={openEngine} flash={flash} share={share} saveFile={saveFile} listen={listen} native={native} /> : null}
    </section>
  );
}
