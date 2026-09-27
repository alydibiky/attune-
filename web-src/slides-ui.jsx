/* ---- More → Slides & Reports (v5.40) ------------------------------------------------------------
   Ali: "make very good PowerPoint using Attune, using an AI prompt, and be able to make reports".
   One prompt → a planned deck (the model writes each slide, code designs and draws it) → preview
   every slide, edit it or have the AI rewrite it, switch the design in one tap → save a real
   PowerPoint (.pptx) or a PDF. Reports: a plan → each section → the executive summary written last →
   Word or PDF, with a chart and computed facts when an Excel / CSV file is given. Facts can come
   from the web or from your own file; figures not found there are never drawn and are flagged.
   Engine + drawing: slides.js. PDFs: Android makePdf. */
import React, { useState, useRef, useEffect, useMemo } from "react";
import { Presentation, FileText, Loader2, Download, Check, ChevronRight, ChevronLeft, ArrowUp, ArrowDown, Trash2, Wand2, Globe, Paperclip, X, Copy, Eye, BarChart3, Play } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import { useSubBack, useSticky } from "./backstack.js";
import { askConfirm } from "./confirm.jsx";
import { rankPassages } from "./webrank.js";
import { expandQueries } from "./research.js";
import * as S from "./slides.js";
import * as C from "./convert.js";

const MIME_PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const KIND_LABEL = { bullets: "Key points", two: "Comparison", steps: "Steps", table: "Table", quote: "Quote", stats: "Numbers", chart: "Chart" };
const REPORT_LABEL = { business: "Business report", research: "Research report", status: "Project status", incident: "Incident report", financial: "Financial analysis", market: "Market study", technical: "Technical report", proposal: "Proposal" };
const LENGTHS = { 3: "Short", 5: "Standard", 8: "Detailed" };
const FREE_PER_DAY = 2;
const STORE = "attune:slides:v1";
const today = () => new Date().toISOString().slice(0, 10);
const dateLine = (lang) => { try { return new Date().toLocaleDateString(lang === "ar" ? "ar-EG-u-nu-latn" : lang, { day: "numeric", month: "long", year: "numeric" }); } catch (e) { return today(); } };
const langName = (k) => { const l = getLang(); if (l !== "en") try { return new Intl.DisplayNames([l], { type: "language" }).of(k) || tr(S.S_LANGS[k]); } catch (e) {} return S.S_LANGS[k]; };
const loadList = () => { try { const v = JSON.parse(localStorage.getItem(STORE) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
const saveList = (l) => { for (let n = l.length; n >= 1; n = Math.floor(n / 2)) { try { localStorage.setItem(STORE, JSON.stringify(l.slice(0, n))); return; } catch (e) {} } };
const readB64 = (f) => new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] || ""); r.onerror = () => bad(new Error("Couldn't read that file")); r.readAsDataURL(f); });

// ---- drawing the shapes on a canvas (the preview, the PDF pages and the report charts) -----------
const FONT = 'system-ui, "Segoe UI", Roboto, "Noto Sans Arabic", "Noto Naskh Arabic", Arial, sans-serif';
function wrapRuns(g, runs, width, size, italic) {
  const lines = []; let line = [], w = 0;
  const font = (b) => `${italic ? "italic " : ""}${b ? "700" : "400"} ${size}px ${FONT}`;
  for (const r of runs) for (const word of String(r.text).split(/\s+/).filter(Boolean)) {
    g.font = font(r.bold); const ww = g.measureText(word).width, sp = g.measureText(" ").width;
    if (line.length && w + sp + ww > width) { lines.push(line); line = []; w = 0; }
    line.push({ word, bold: r.bold, color: r.color, ww, x: w + (line.length ? sp : 0) }); w += (line.length > 1 ? sp : 0) + ww;
  }
  if (line.length) lines.push(line);
  return { lines, font };
}
function drawText(g, s) {
  const lh = s.lh || 1.2, gap = s.gap ?? 0.45;
  let size = s.size, laid;
  for (let tries = 0; tries < 30; tries++) {
    laid = s.paras.map((p) => {
      const ind = p.bullet ? size * 1.3 : 0;
      const runs = [...(p.lead ? [{ text: p.lead, bold: true, color: s.leadColor || s.color }] : []), { text: p.text || "", bold: !!s.bold, color: s.color }];
      return { ind, bullet: p.bullet, ...wrapRuns(g, runs, s.w - ind, size, s.italic) };
    });
    const hh = laid.reduce((n, p) => n + p.lines.length * size * lh + size * gap, 0) - size * gap;
    if (hh <= s.h + 1 || size <= Math.max(9, s.size * 0.55)) break;
    size -= 1;
  }
  const total = laid.reduce((n, p) => n + p.lines.length * size * lh + size * gap, 0) - size * gap;
  let y = s.y + (s.valign === "m" ? (s.h - total) / 2 : s.valign === "b" ? s.h - total : 0);
  g.textBaseline = "alphabetic";
  const rtl = !!s.rtl;
  for (let pi = 0; pi < laid.length; pi++) {
    const p = laid[pi];
    // Play mode: a list shown point by point (showParas), the newest point coming in (enter 0 → 1)
    if (s.showParas != null && pi >= s.showParas) { y += p.lines.length * size * lh + size * gap; continue; }
    const fresh = s.showParas != null && pi === s.showParas - 1 && s.paraEnter != null;
    g.save();
    if (fresh) { g.globalAlpha *= s.paraEnter; g.translate(0, (1 - s.paraEnter) * (s.enterDy || 0)); }
    p.lines.forEach((line, li) => {
      const lw = line.length ? line[line.length - 1].x + line[line.length - 1].ww : 0, avail = s.w - p.ind;
      // the gap before the line, measured from where the line starts (the left, or the right in Arabic)
      const off = s.align === "c" ? (avail - lw) / 2 : (rtl ? s.align === "l" : s.align === "r") ? avail - lw : 0;
      const base = y + size * (lh - 1) / 2 + size * 0.86;
      if (p.bullet && li === 0) { g.fillStyle = "#" + (s.bulletColor || s.color); const b = size * 0.42; g.fillRect(rtl ? s.x + s.w - size * 0.3 - b : s.x + size * 0.3 - 0, base - size * 0.36 - b / 2, b, b); }
      const put = (wd, x) => {   // x = the word's left edge
        g.font = `${s.italic ? "italic " : ""}${wd.bold ? "700" : "400"} ${size}px ${FONT}`;
        g.fillStyle = "#" + wd.color;
        const ar = /[\u0600-\u06FF]/.test(wd.word);
        g.direction = ar ? "rtl" : "ltr"; g.textAlign = ar ? "right" : "left";
        g.fillText(wd.word, ar ? x + wd.ww : x, base);
      };
      if (!rtl) for (const wd of line) put(wd, s.x + p.ind + off + wd.x);
      else {
        // right to left: Arabic words from the right edge; a run of English words / numbers / links
        // keeps its own left-to-right order inside the line ("Crane market 2026", not "2026 market Crane")
        g.font = `400 ${size}px ${FONT}`; const sp = g.measureText(" ").width;
        let xr = s.x + s.w - p.ind - off, k = 0;
        while (k < line.length) {
          if (/[\u0600-\u06FF]/.test(line[k].word)) { put(line[k], xr - line[k].ww); xr -= line[k].ww + sp; k++; continue; }
          let j = k; while (j < line.length && !/[\u0600-\u06FF]/.test(line[j].word)) j++;
          const run = line.slice(k, j), rw = run.reduce((n, w) => n + w.ww, 0) + sp * (run.length - 1);
          let xl = xr - rw;
          for (const wd of run) { put(wd, xl); xl += wd.ww + sp; }
          xr -= rw + sp; k = j;
        }
      }
      y += size * lh;
    });
    g.restore();
    y += size * gap;
  }
}
function drawTable(g, s) {
  const cols = s.rows[0].length, cw = s.w / cols;
  s.rows.forEach((r, ri) => {
    const y = s.y + ri * s.rowH;
    g.globalAlpha = ri === 0 || ri % 2 ? 1 : 0.35; g.fillStyle = "#" + (ri === 0 ? s.head : s.band); g.fillRect(s.x, y, s.w, s.rowH); g.globalAlpha = 1;
    r.forEach((c, ci) => {
      const col = s.rtl ? cols - 1 - ci : ci;
      drawText(g, { x: s.x + col * cw + 12, y: y + 6, w: cw - 24, h: s.rowH - 12, paras: [{ text: c }], size: s.size, bold: ri === 0, color: ri === 0 ? s.onHead : s.text, valign: "m", rtl: s.rtl || /[؀-ۿ]/.test(c), align: s.rtl || /[؀-ۿ]/.test(c) ? "r" : "l", lh: 1.15, gap: 0 });
    });
  });
}
export function drawShapes(g, shapes, k) {
  g.save(); g.scale(k, k);
  for (const s of shapes) {
    g.save(); g.globalAlpha = s.alpha ?? 1;
    if (s.enter != null) {   // Play mode: this shape is coming in (fade / fly from below / zoom)
      g.globalAlpha *= s.enter;
      if (s.enterDy) g.translate(0, (1 - s.enter) * s.enterDy);
      if (s.enterZoom) { const cx = s.x + s.w / 2, cy = s.y + s.h / 2, k = 0.3 + 0.7 * s.enter; g.translate(cx, cy); g.scale(k, k); g.translate(-cx, -cy); }
    }
    if (s.t === "rect" || s.t === "ellipse") {
      g.fillStyle = "#" + s.fill; g.beginPath();
      if (s.t === "ellipse") g.ellipse(s.x + s.w / 2, s.y + s.h / 2, s.w / 2, s.h / 2, 0, 0, Math.PI * 2);
      else { const r = Math.min(s.r || 0, s.w / 2, s.h / 2); g.moveTo(s.x + r, s.y); g.arcTo(s.x + s.w, s.y, s.x + s.w, s.y + s.h, r); g.arcTo(s.x + s.w, s.y + s.h, s.x, s.y + s.h, r); g.arcTo(s.x, s.y + s.h, s.x, s.y, r); g.arcTo(s.x, s.y, s.x + s.w, s.y, r); g.closePath(); }
      g.fill();
    } else if (s.t === "text") drawText(g, s);
    else if (s.t === "table") drawTable(g, s);
    g.restore();
  }
  g.restore();
}
function SlideCanvas({ shapes, className = "", testid }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const w = Math.min(1280, Math.round((c.clientWidth || 360) * (window.devicePixelRatio || 1)));
    c.width = w; c.height = Math.round(w * S.SH / S.SW);
    const g = c.getContext("2d"); g.clearRect(0, 0, c.width, c.height);
    drawShapes(g, shapes, w / S.SW);
  }, [shapes]);
  return <canvas ref={ref} className={"w-full rounded-lg border border-slate-800 bg-slate-950 " + className} style={{ aspectRatio: "16 / 9" }} data-testid={testid} />;
}
const toImage = (shapes, w, type = "image/jpeg") => { const c = document.createElement("canvas"); c.width = w; c.height = Math.round(w * S.SH / S.SW); drawShapes(c.getContext("2d"), shapes, w / S.SW); return c.toDataURL(type, 0.9); };
// a report chart as a PNG (white background, blue bars)
function chartPng(chart) {
  const th = { ...S.THEMES.ocean, text: "1F2937", sub: "4B5563" };
  const c = document.createElement("canvas"); c.width = 1200; c.height = 600;
  const g = c.getContext("2d"); g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, 1200, 600);
  drawShapes(g, S.chartShapes(chart.bars, 30, 20, 1140, 560, th, chart.unit), 1);
  return { b64: c.toDataURL("image/png").split(",")[1], w: 1200, h: 600 };
}

// ---- Play: the deck full screen, with its transitions and animations (what PowerPoint will show) ----
const TRANS_CSS = "@keyframes attTfade{from{opacity:0}}@keyframes attTpush{from{transform:translateY(100%)}}@keyframes attTwipe{from{clip-path:inset(0 100% 0 0)}}@keyframes attTsplit{from{clip-path:inset(0 50% 0 50%)}}@keyframes attTcover{from{transform:translateX(100%)}}@keyframes attTzoom{from{transform:scale(.3);opacity:0}}";
function Presenter({ deck, close }) {
  const list = useMemo(() => S.deckShapes(deck), [deck]);
  const anim = deck.animation && deck.animation !== "none" ? deck.animation : null;
  const stepsOf = (k) => (anim ? S.animSteps(list[k].shapes) : []);
  const [pos, setPos] = useState({ i: 0, step: 0 });
  const [notes, setNotes] = useState(false);
  const [portrait, setPortrait] = useState(() => window.innerHeight > window.innerWidth);
  const ref = useRef(null);
  useSubBack(true, close);
  useEffect(() => { const f = () => setPortrait(window.innerHeight > window.innerWidth); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  const steps = stepsOf(pos.i);
  // automatic animations: the next item every half second
  useEffect(() => {
    if (!anim || deck.trigger !== "auto" || pos.step >= steps.length) return;
    const t = setTimeout(() => setPos((p) => (p.i === pos.i ? { ...p, step: p.step + 1 } : p)), pos.step === 0 ? 650 : 520);
    return () => clearTimeout(t);
  }, [pos]);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const w = Math.min(1600, Math.round((c.clientWidth || 360) * (window.devicePixelRatio || 1)));
    c.width = w; c.height = Math.round(w * S.SH / S.SW);
    const g = c.getContext("2d"), shapes = list[pos.i].shapes;
    const animated = new Set(steps.flat().map((t) => t.idx)), shown = new Map();
    steps.slice(0, pos.step).forEach((st, k) => st.forEach((t) => {
      const m = shown.get(t.idx) || { paras: 0, fresh: false, whole: false };
      if (t.para != null) m.paras = Math.max(m.paras, t.para + 1); else m.whole = true;
      if (k === pos.step - 1) m.fresh = true;
      shown.set(t.idx, m);
    }));
    const dy = anim === "fly" ? 90 : 0;
    let raf, t0 = null;
    const frame = (ts) => {
      if (t0 == null) t0 = ts;
      const e = Math.min(1, (ts - t0) / 450), ease = 1 - Math.pow(1 - e, 3), view = [];
      shapes.forEach((x, idx) => {
        if (!animated.has(idx)) { view.push(x); return; }
        const m = shown.get(idx); if (!m) return;
        if (!m.whole) view.push({ ...x, showParas: m.paras, paraEnter: m.fresh ? ease : null, enterDy: dy });
        else view.push(m.fresh ? { ...x, enter: ease, enterDy: dy, enterZoom: anim === "zoom" } : x);
      });
      g.clearRect(0, 0, c.width, c.height); drawShapes(g, view, w / S.SW);
      if (e < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [pos, list, portrait]);
  const next = () => setPos((p) => {
    const st = stepsOf(p.i);
    if (anim && deck.trigger !== "auto" && p.step < st.length) return { ...p, step: p.step + 1 };
    return p.i < list.length - 1 ? { i: p.i + 1, step: 0 } : p;
  });
  const prev = () => setPos((p) => (p.i > 0 ? { i: p.i - 1, step: stepsOf(p.i - 1).length } : { ...p, step: 0 }));
  const tr0 = TRANSITIONS_OK[deck.transition] ? deck.transition : null;
  const note = list[pos.i].slide.notes;
  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col" data-testid="presenter">
      <style>{TRANS_CSS}</style>
      <div className="flex items-center justify-between px-3 py-2 text-slate-300 text-[12.5px]">
        <span data-testid="presenter-count">{pos.i + 1} / {list.length}{steps.length && deck.trigger !== "auto" ? " · " + tr("tap for the next item") : ""}</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setNotes(!notes)} className={`px-2.5 py-1.5 rounded-lg border ${notes ? "border-teal-500 text-teal-200" : "border-slate-700"}`}>{tr("Notes")}</button>
          <button onClick={close} aria-label={tr("Close")} className="h-9 w-9 rounded-full grid place-items-center border border-slate-700" data-testid="presenter-close"><X size={16} /></button>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center overflow-hidden relative">
        <div key={pos.i} className="w-full" style={{ animation: tr0 ? `attT${tr0} .6s ease-out` : "none" }}>
          <canvas ref={ref} className="block mx-auto" style={{ width: "min(100%, calc((100vh - 130px) * 16 / 9))", aspectRatio: "16 / 9" }} data-testid="presenter-canvas" />
        </div>
        <button className="absolute inset-y-0 start-0 w-1/3" aria-label={tr("Back")} onClick={prev} data-testid="presenter-prev" />
        <button className="absolute inset-y-0 end-0 w-2/3" aria-label={tr("Next")} onClick={next} data-testid="presenter-next" />
      </div>
      {portrait && !notes ? <p className="text-center text-[11.5px] text-slate-500">{tr("Turn your phone sideways for a bigger slide")}</p> : null}
      {notes ? <p className="max-h-40 overflow-auto px-4 py-3 text-[13px] text-slate-200 bg-slate-900 border-t border-slate-800" dir="auto">{note || tr("No notes on this slide.")}</p> : null}
      <div className="flex items-center justify-center gap-6 py-3">
        <button onClick={prev} className="h-11 w-11 rounded-full grid place-items-center border border-slate-700 text-slate-200" aria-label={tr("Back")}><ChevronLeft size={20} className="rtl:-scale-x-100" /></button>
        <button onClick={next} className="h-11 w-11 rounded-full grid place-items-center bg-teal-500 text-slate-950" aria-label={tr("Next")}><ChevronRight size={20} className="rtl:-scale-x-100" /></button>
      </div>
    </div>
  );
}
const TRANSITIONS_OK = { fade: 1, push: 1, wipe: 1, split: 1, cover: 1, zoom: 1 };
const MOTION = "attune:slides:motion";
const loadMotion = () => { try { const m = JSON.parse(localStorage.getItem(MOTION) || "{}"); return { transition: m.transition || "none", animation: m.animation || "none", trigger: m.trigger || "click" }; } catch (e) { return { transition: "none", animation: "none", trigger: "click" }; } };

// ---- the page -------------------------------------------------------------------------------------
export function SlidesReports({ llm, webPages, nativeCall, saveFile, flash, modelReady, openEngine, pro, openPlan, initialPrompt, initialTab }) {
  const [tab, setTab] = useState(initialTab || "deck");                 // deck | report
  const [prompt, setPrompt] = useState(initialPrompt || "");
  const [audience, setAudience] = useState("");
  const [count, setCount] = useState(8);
  const [lang, setLangPick] = useState("auto");
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem("attune:slides:theme") || "midnight"; } catch (e) { return "midnight"; } });
  const [detail, setDetail] = useState(() => { try { return localStorage.getItem("attune:slides:detail") || "short"; } catch (e) { return "short"; } });
  const [motion, setMotion] = useState(loadMotion);       // { transition, animation, trigger }
  const [playing, setPlaying] = useState(false);
  const [styleNote, setStyleNote] = useState("");         // what was taken from the request's own words
  const [rKind, setRKind] = useState("business");
  const [rLen, setRLen] = useState(5);
  const [useWeb, setUseWeb] = useState(false);
  const [file, setFile] = useState(null);                // { name, text, data? }
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState("");
  const [deck, setDeck] = useSticky("slides:deck", null);                // { id, title, subtitle, lang, theme, date, slides, source, notes[] }
  const [report, setReport] = useSticky("slides:report", null);            // { id, title, subtitle, lang, date, kind, sections[{heading, blocks}], summary, conclusion, sources, data, notes[] }
  const [edit, setEdit] = useSticky("slides:edit", null);
  const [cmd, setCmd] = useState("");                     // v5.41: "delete slide 5", "slide 4: shorter"…
  const [cmdNote, setCmdNote] = useState("");                // index into deck.slides
  const [list, setList] = useState(loadList);
  const run = useRef(0);
  const hitsRef = useRef({ id: null, hits: [] });   // this session's web pages, for "Rewrite this slide"
  const fileRef = useRef(null);
  useSubBack(!playing && (edit != null || !!deck || !!report), () => { if (edit != null) setEdit(null); else { setDeck(null); setReport(null); } });
  const setMotionSaved = (m) => { setMotion(m); try { localStorage.setItem(MOTION, JSON.stringify(m)); } catch (e) {} };
  useEffect(() => { if (initialPrompt) setPrompt(initialPrompt); }, [initialPrompt]);

  const remember = (item) => { const l = [item, ...loadList().filter((x) => x.id !== item.id)].slice(0, 15); saveList(l); setList(l); };
  useEffect(() => { if (deck && !busy) remember({ id: deck.id, type: "deck", title: deck.title, ts: Date.now(), deck: { ...deck, source: String(deck.source || "").slice(0, 20000) } }); }, [deck, busy]);
  useEffect(() => { if (report && !busy) remember({ id: report.id, type: "report", title: report.title, ts: Date.now(), report: { ...report, data: report.data ? { ...report.data, table: report.data.table.slice(0, 12) } : null } }); }, [report, busy]);

  const dayUsed = () => { try { return JSON.parse(localStorage.getItem("attune:slides:day") || "{}")[today()] || 0; } catch (e) { return 0; } };
  const countDay = () => { try { localStorage.setItem("attune:slides:day", JSON.stringify({ [today()]: dayUsed() + 1 })); } catch (e) {} };

  // a file to base it on: Word / PDF / text → its text; Excel / CSV → computed facts + a chart
  const pickFile = async (f) => {
    if (!f) return;
    setErr("");
    try {
      const kind = C.kindOf(f.name, f.type);
      let text = "", data = null;
      if (kind === "docx") text = C.blocksToText(await C.docxToBlocks(new Uint8Array(await f.arrayBuffer())));
      else if (kind === "pptx") text = C.blocksToText(await C.pptxToBlocks(new Uint8Array(await f.arrayBuffer())));
      else if (kind === "text" || kind === "html") text = kind === "html" ? C.blocksToText(C.htmlToBlocks(await f.text())) : await f.text();
      else if (kind === "pdf") {
        if (!nativeCall) throw new Error("PDF files are read by the Android app — open Attune on your phone.");
        const r = await nativeCall("pdfText", { b64: await readB64(f) });
        text = r.pages.map((p) => p.text).join("\n\n");
      } else if (kind === "xlsx" || kind === "csv" || kind === "ods") {
        const rows = kind === "xlsx" ? await C.xlsxToRows(new Uint8Array(await f.arrayBuffer())) : kind === "ods" ? await C.odsToRows(new Uint8Array(await f.arrayBuffer())) : C.csvParse(await f.text());
        data = S.dataSummary(rows, f.name.replace(/\.[^.]+$/, ""));
        if (!data) throw new Error("That sheet has no rows to use.");
        text = data.text + "\n" + data.table.slice(0, 20).map((r) => r.join(" | ")).join("\n");
      } else throw new Error("Use a Word, PDF, PowerPoint, text, Excel or CSV file.");
      if (!String(text).trim()) throw new Error("No text was found in that file.");
      setFile({ name: f.name, text: String(text).slice(0, 60000), data });
    } catch (e) { setErr(tr(String((e && e.message) || e))); }
  };

  // web pages for the topic: 3 searches in parallel, each page once
  const gather = async (topic, alive) => {
    if (!useWeb || !webPages) return [];
    setBusy(tr("Searching the web for facts and figures…"));
    const qs = expandQueries(topic, 3);
    const got = await Promise.all(qs.map((q) => webPages(q, 4).catch(() => ({ hits: [] }))));
    if (!alive()) return [];
    const seen = new Set(), hits = [];
    for (const r of got) for (const h of (r && r.hits) || []) if (h && h.url && !seen.has(h.url)) { seen.add(h.url); hits.push(h); }
    return hits.slice(0, 8);
  };
  // the passages for one slide / section: the web pages and the file, ranked for its title
  const sourceFor = (hits, q, budget) => {
    const pool = [...hits, ...(file ? [{ title: file.name, url: "file:" + file.name, text: file.text }] : [])];
    if (!pool.length) return "";
    const ranked = rankPassages(q, pool, { budget, perSource: Math.round(budget * 0.6) });
    const lines = ranked.map((h) => `[${h.url.startsWith("file:") ? "F" : hits.indexOf(pool.find((p) => p.url === h.url)) + 1}] ${h.title}\n${h.text}`);
    return (file && file.data ? "COMPUTED FROM THE FILE (exact):\n" + file.data.text + "\n\n" : "") + lines.join("\n\n");
  };

  const start = () => {
    if (!prompt.trim()) { setErr(tr("Write what it should be about first.")); return false; }
    if (!modelReady) { setErr(tr("This needs an AI model — open Engine and install one.")); openEngine && openEngine(); return false; }
    if (!pro && dayUsed() >= FREE_PER_DAY) { flash && flash(tr("Free includes 2 presentations or reports a day — Pro is unlimited")); openPlan && openPlan(); return false; }
    return true;
  };

  const writeSlide = async (d, i, kind, hits, extra = "") => {
    const sl = d.slides[i], topic = d.topic;
    const src = sourceFor(hits, topic + " " + sl.title, 2400);
    const msgs = S.slideMessages({ deckTitle: d.title, topic, slide: { ...sl, kind }, i: i + 1, n: d.slides.length, others: d.slides.map((x) => x.title), lang: d.lang, source: src, audience: d.audience, detail: d.detail });
    if (extra) msgs[0].content += `\n\nALSO: ${extra}`;
    const reply = await llm(msgs, null, { maxTokens: kind === "table" || kind === "two" ? 520 : 420, temperature: 0.5 });
    let s = S.fixSlide(S.parseSlide(kind, reply), sl.title);
    const allSrc = d.source + "\n" + src;
    const ch = S.checkFigures(s, allSrc);
    s = S.fixSlide(ch.slide, sl.title);
    const unsure = S.unbacked(S.slideText(s), allSrc).length;
    return { slide: { ...s, kind: s.kind, title: sl.title }, dropped: ch.dropped, unsure };
  };

  const makeDeck = async () => {
    if (!start()) return;
    const id = ++run.current, alive = () => run.current === id;
    const L = S.langOf(lang, prompt), topic = prompt.trim();
    setErr(""); setEdit(null); setReport(null);
    // "a dark blue theme, fade transitions, points flying in one by one" — the request's own words win
    const st = S.styleFromPrompt(prompt + "\n" + audience);
    const useTheme = st.theme || theme, mo = { transition: st.transition || motion.transition, animation: st.animation || motion.animation, trigger: st.trigger || motion.trigger };
    setTheme(useTheme); setMotionSaved(mo);
    setStyleNote([st.theme ? tr("Design: {d}", { d: tr(S.THEMES[st.theme].name) }) : "", st.transition ? tr("Transitions: {t}", { t: tr(S.TRANSITIONS[st.transition]) }) : "", st.animation ? tr("Animations: {a}", { a: tr(S.ANIMATIONS[st.animation]) }) + (st.animation !== "none" ? " · " + tr(mo.trigger === "auto" ? "automatic" : "on tap") : "") : ""].filter(Boolean).join(" · "));
    try { localStorage.setItem("attune:slides:theme", useTheme); } catch (e) {}
    try {
      const hits = await gather(topic, alive);
      if (!alive()) return;
      const source = [topic, audience, ...hits.map((h) => h.text), file ? file.text : "", file && file.data ? file.data.text : ""].join("\n");
      setBusy(tr("Planning the slides…"));
      const planSrc = sourceFor(hits, topic, 3000);
      const outline = S.parseOutline(await llm(S.outlineMessages({ topic, n: count, lang: L, audience, source: planSrc }), null, { maxTokens: 520, temperature: 0.5 }), count, { topic, figures: S.hasFigures(planSrc) });
      if (!alive()) return;
      const did = "d" + Date.now().toString(36);
      hitsRef.current = { id: did, hits };
      let d = { id: did, topic, audience, detail: st.detail || detail, fileName: file ? file.name : "", title: outline.title, subtitle: outline.subtitle, lang: L, theme: useTheme, ...mo, date: dateLine(L), slides: outline.slides.map((s) => ({ ...s, bullets: [], pending: true })), source, hits: hits.map((h) => ({ title: h.title, url: h.url })), dropped: 0, unsure: 0 };
      setDeck(d);
      for (let i = 0; i < d.slides.length; i++) {
        if (!alive()) return;
        setBusy(tr("Writing slide {n} of {t} — {s}", { n: i + 1, t: d.slides.length, s: d.slides[i].title }));
        let r;
        try { r = await writeSlide(d, i, d.slides[i].kind, hits); }
        catch (e) { if (!alive()) return; r = { slide: { kind: "bullets", title: d.slides[i].title, bullets: [], notes: "" }, dropped: 0, unsure: 0 }; }
        // a figures slide that lost its figures, or an empty slide: once more as key points
        if (!r.slide.bullets?.length && r.slide.kind === "bullets") { try { r = await writeSlide(d, i, "bullets", hits); } catch (e) {} }
        if (!alive()) return;
        d = { ...d, slides: d.slides.map((x, k) => (k === i ? r.slide : x)), dropped: d.dropped + r.dropped, unsure: d.unsure + r.unsure };
        setDeck(d);
      }
      countDay();
    } catch (e) { if (alive()) setErr(tr(String((e && e.message) || e))); }
    finally { if (alive()) setBusy(null); }
  };

  const makeReport = async () => {
    if (!start()) return;
    const id = ++run.current, alive = () => run.current === id;
    const L = S.langOf(lang, prompt), topic = prompt.trim();
    setErr(""); setDeck(null);
    try {
      const hits = await gather(topic, alive);
      if (!alive()) return;
      const source = [topic, ...hits.map((h) => h.text), file ? file.text : "", file && file.data ? file.data.text : ""].join("\n");
      setBusy(tr("Planning the report…"));
      const o = S.parseReportOutline(await llm(S.reportOutlineMessages({ topic, kind: rKind, n: rLen, lang: L, source: sourceFor(hits, topic, 3000) }), null, { maxTokens: 420, temperature: 0.4 }), rLen, topic);
      if (!alive()) return;
      let rep = { id: "r" + Date.now().toString(36), topic, kind: rKind, title: o.title, subtitle: o.subtitle, lang: L, date: dateLine(L), sections: o.sections.map((h) => ({ heading: h, blocks: [], pending: true })), summary: null, conclusion: [], sources: [...hits.map((h, i) => ({ n: String(i + 1), title: String(h.title || h.url).slice(0, 100), url: h.url })), ...(file ? [{ n: "F", title: file.name, url: "" }] : [])], data: file && file.data ? file.data : null, unsure: 0 };
      setReport(rep);
      const wordsPer = rLen >= 8 ? 320 : rLen <= 3 ? 380 : 300;
      for (let i = 0; i < rep.sections.length; i++) {
        if (!alive()) return;
        const h = rep.sections[i].heading;
        setBusy(tr("Writing section {n} of {t} — {s}", { n: i + 1, t: rep.sections.length, s: h }));
        const src = sourceFor(hits, topic + " " + h, 2800);
        const md = await llm(S.sectionMessages({ title: rep.title, topic, kind: rKind, heading: h, i: i + 1, n: rep.sections.length, others: rep.sections.map((x) => x.heading), lang: L, source: src, words: wordsPer }), null, { maxTokens: Math.round(wordsPer * 2.6), temperature: 0.35 });
        if (!alive()) return;
        const blocks = S.sectionBlocks(md, h);
        rep = { ...rep, sections: rep.sections.map((x, k) => (k === i ? { heading: h, blocks } : x)), unsure: rep.unsure + S.unbacked(C.blocksToText(blocks), source + "\n" + src).length };
        setReport(rep);
      }
      setBusy(tr("Writing the conclusions and recommendations…"));
      const concl = await llm(S.sectionMessages({ title: rep.title, topic, kind: rKind, heading: "", others: rep.sections.map((x) => x.heading), lang: L, source: S.reportText(rep, 3500), words: 220, conclusion: true }), null, { maxTokens: 650, temperature: 0.35 });
      if (!alive()) return;
      rep = { ...rep, conclusion: S.sectionBlocks(concl, S.words(L).conclusion) };
      setReport(rep);
      setBusy(tr("Writing the executive summary…"));
      const sum = S.parseSummary(await llm(S.summaryMessages({ title: rep.title, lang: L, body: S.reportText(rep, 5000) + "\n\n" + C.blocksToText(rep.conclusion) }), null, { maxTokens: 520, temperature: 0.3 }));
      if (!alive()) return;
      rep = { ...rep, summary: sum };
      setReport(rep);
      countDay();
    } catch (e) { if (alive()) setErr(tr(String((e && e.message) || e))); }
    finally { if (alive()) setBusy(null); }
  };

  // ---- v5.41: change the deck by a sentence ----
  const runCommand = async () => {
    const text = cmd.trim();
    if (!text || !deck) return;
    const { ops, style } = S.parseDeckCommand(text);
    if (!ops.length && !Object.keys(style).length) { setCmdNote(tr("I didn't understand that — try “delete slide 5”, “slide 4: shorter”, “add a slide about prices after slide 3”, or “green theme with fade transitions”.")); return; }
    const id = ++run.current, alive = () => run.current === id;
    const hits = hitsRef.current.id === deck.id ? hitsRef.current.hits : [];
    let d = { ...deck, slides: [...deck.slides] };
    const done = [];
    const bodyAt = (n) => { const fd = S.fullDeck(d); return n >= 1 && n <= fd.length ? d.slides.indexOf(fd[n - 1]) : -1; };
    if (style.theme) { d.theme = style.theme; setTheme(style.theme); done.push(tr("Design: {d}", { d: tr(S.THEMES[style.theme].name) })); }
    if (style.transition) { d.transition = style.transition; done.push(tr("Transitions: {t}", { t: tr(S.TRANSITIONS[style.transition]) })); }
    if (style.animation) { d.animation = style.animation; d.trigger = style.trigger || d.trigger || "click"; done.push(tr("Animations: {a}", { a: tr(S.ANIMATIONS[style.animation]) })); }
    if (style.detail) d.detail = style.detail;
    if (style.transition || style.animation) setMotionSaved({ transition: d.transition || "none", animation: d.animation || "none", trigger: d.trigger || "click" });
    setErr(""); setCmdNote("");
    try {
      for (const o of ops) {
        if (!alive()) return;
        if (o.op === "title") { d.title = o.text; done.push(tr("New title")); continue; }
        if (o.op === "delete") {
          const i = bodyAt(o.at);
          if (i < 0) { done.push(tr("Slide {n} is made by the app (cover, contents, sources or closing) — it can't be deleted", { n: o.at })); continue; }
          d.slides.splice(i, 1); done.push(tr("Slide {n} deleted", { n: o.at })); continue;
        }
        if (o.op === "move") {
          const i = bodyAt(o.at); let j = bodyAt(o.to);
          if (i < 0) { done.push(tr("Slide {n} can't be moved", { n: o.at })); continue; }
          if (j < 0) j = o.to <= 2 ? 0 : d.slides.length - 1;
          if (o.swap) { const t = d.slides[i]; d.slides[i] = d.slides[j]; d.slides[j] = t; }
          else {
            // it ends up exactly at the number said (the cover — and the contents slide — come first)
            const [x] = d.slides.splice(i, 1);
            const lead = 1 + (d.agenda !== false && d.slides.length + 1 >= 4 ? 1 : 0);
            const k = Math.max(0, Math.min(d.slides.length, o.to - 1 - lead + (o.after ? 1 : 0)));
            d.slides.splice(k, 0, x);
          }
          done.push(tr("Slide {a} moved", { a: o.at })); continue;
        }
        if (o.op === "add") {
          const after = o.after ? bodyAt(o.after) : d.slides.length - 1;
          const at = after < 0 ? d.slides.length : after + 1;
          const title = o.topic.charAt(0).toUpperCase() + o.topic.slice(1);
          d.slides.splice(at, 0, { kind: o.kind || "bullets", title: title.slice(0, 80), bullets: [], pending: true });
          setDeck({ ...d, slides: [...d.slides] });
          setBusy(tr("Writing the new slide — {s}", { s: title }));
          const r = await writeSlide(d, at, o.kind || "bullets", hits, `This is a NEW slide about: ${o.topic}.`);
          if (!alive()) return;
          d.slides[at] = r.slide; done.push(tr("New slide: {s}", { s: title })); setDeck({ ...d, slides: [...d.slides] }); continue;
        }
        if (o.op === "rewrite") {
          const list = o.at === "all" ? d.slides.map((_, k) => k) : [bodyAt(o.at)];
          if (list[0] < 0) { done.push(tr("Slide {n} is made by the app — change the words of slides 3 onwards", { n: o.at })); continue; }
          for (let k = 0; k < list.length; k++) {
            if (!alive()) return;
            const i = list[k];
            setBusy(list.length > 1 ? tr("Changing slide {n} of {t}…", { n: k + 1, t: list.length }) : tr("Changing the slide…"));
            const r = await writeSlide(d, i, o.kind || d.slides[i].kind, hits, o.ask);
            if (!alive()) return;
            d.slides[i] = r.slide; setDeck({ ...d, slides: [...d.slides] });
          }
          done.push(o.at === "all" ? tr("Every slide changed") : tr("Slide {n} changed", { n: o.at }));
        }
      }
      if (alive()) { setDeck({ ...d, slides: [...d.slides] }); setCmdNote(done.join(" · ")); setCmd(""); }
    } catch (e) { if (alive()) setErr(tr(String((e && e.message) || e))); }
    finally { if (alive()) setBusy(null); }
  };

  // ---- saving ----
  const saveOut = async (name, mime, b64) => {
    try {
      if (saveFile) { await saveFile(name, "", mime, b64); flash && flash(tr("Saved")); return; }
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([C.b64ToBytes(b64)], { type: mime })); a.download = name; a.click();
    } catch (e) { if (String(e && e.message) !== "Cancelled") flash && flash(String((e && e.message) || e)); }
  };
  const fname = (t, ext) => (String(t || "Attune").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "Attune") + "." + ext;
  const savePptx = () => { const b = S.pptxFromDeck(deck); saveOut(fname(deck.title, "pptx"), MIME_PPTX, C.bytesToB64(b)); };
  const saveDeckPdf = async () => {
    if (!nativeCall) { setErr(tr("PDF files are made by the Android app — open Attune on your phone.")); return; }
    setBusy(tr("Making the PDF…"));
    try {
      const images = S.deckShapes(deck).map((x) => toImage(x.shapes, 1600));
      const r = await nativeCall("makePdf", { images, fullPage: true });
      await saveOut(fname(deck.title, "pdf"), C.MIME.pdf, r.b64);
    } catch (e) { setErr(tr(String((e && e.message) || e))); } finally { setBusy(null); }
  };
  const reportOut = () => {
    const chart = report.data && report.data.chart ? chartPng(report.data.chart) : null;
    return S.reportBlocks(report, { chartImage: chart });
  };
  const saveDocx = () => { const th = S.THEMES[theme] || S.THEMES.ocean; const b = C.docxFromBlocks(reportOut(), report.title, { accent: th.accent === "FFFFFF" ? null : (["midnight", "royal", "steel"].includes(theme) ? "1E3A8A" : th.accent) }); saveOut(fname(report.title, "docx"), C.MIME.docx, C.bytesToB64(b)); };
  const saveReportPdf = async () => {
    if (!nativeCall) { setErr(tr("PDF files are made by the Android app — open Attune on your phone.")); return; }
    setBusy(tr("Making the PDF…"));
    try { const r = await nativeCall("makePdf", { blocks: reportOut() }); await saveOut(fname(report.title, "pdf"), C.MIME.pdf, r.b64); }
    catch (e) { setErr(tr(String((e && e.message) || e))); } finally { setBusy(null); }
  };
  const copyText = async (t) => { try { await navigator.clipboard.writeText(t); flash && flash(tr("Copied")); } catch (e) {} };

  const chip = (on) => `px-3 py-2 rounded-xl text-[13px] border ${on ? "border-teal-600 bg-teal-500/10 text-teal-200" : "border-slate-700 text-slate-300"}`;
  const stopBtn = <button onClick={() => { run.current++; setBusy(null); }} className="px-3 py-1.5 rounded-lg border border-rose-800 text-rose-200 shrink-0">{tr("Stop")}</button>;
  const busyRow = busy ? <div className="flex items-center justify-between gap-2 text-[12.5px] text-teal-200" data-testid="slides-busy"><span className="flex items-center gap-2 min-w-0"><Loader2 size={14} className="animate-spin shrink-0" /><span className="truncate">{busy}</span></span>{stopBtn}</div> : null;

  // ---- one slide open for editing ----
  if (deck && edit != null && deck.slides[edit]) {
    return <SlideEditor deck={deck} index={edit} setDeck={setDeck} close={() => setEdit(null)} busy={busy} busyRow={busyRow}
      rewrite={async (kind, extra) => {
        const id = ++run.current, alive = () => run.current === id;
        setBusy(tr("Rewriting the slide…"));
        try {
          const r = await writeSlide(deck, edit, kind, hitsRef.current.id === deck.id ? hitsRef.current.hits : [], extra);
          if (alive()) setDeck((d) => ({ ...d, slides: d.slides.map((x, k) => (k === edit ? r.slide : x)) }));
        } catch (e) { if (alive()) setErr(tr(String((e && e.message) || e))); } finally { if (alive()) setBusy(null); }
      }} err={err} />;
  }

  const shapes = deck ? S.deckShapes(deck) : [];
  if (deck && playing) return <Presenter deck={deck} close={() => setPlaying(false)} />;
  return (
    <div className="space-y-4 max-w-2xl mx-auto" data-testid="slides">
      <div className="px-1">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Presentation size={19} className="text-teal-300" />{tr("Slides & Reports")}</h2>
        <p className="text-[12.5px] text-slate-400 leading-relaxed mt-1">{tr("Describe it in one sentence — the AI on your phone writes a designed PowerPoint or a full report, from the web or your own file. Edit any slide, then save it as PowerPoint, Word or PDF.")}</p>
      </div>

      {!deck && !report ? (
        <section className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-1.5">
            <button onClick={() => setTab("deck")} className={chip(tab === "deck") + " flex items-center justify-center gap-1.5"} data-testid="slides-tab-deck"><Presentation size={15} />{tr("Presentation")}</button>
            <button onClick={() => setTab("report")} className={chip(tab === "report") + " flex items-center justify-center gap-1.5"} data-testid="slides-tab-report"><FileText size={15} />{tr("Report")}</button>
          </div>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} dir="auto" data-testid="slides-prompt"
            placeholder={tab === "deck" ? tr("e.g. A pitch for our crane rental company to New Capital contractors: fleet, safety record, prices, why us") : tr("e.g. Monthly report on our crane fleet: utilisation, breakdowns, costs and what to fix next month")}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-[14px] text-slate-100 leading-relaxed" />
          {tab === "deck" ? (
            <>
              <input value={audience} onChange={(e) => setAudience(e.target.value)} dir="auto" placeholder={tr("Who is it for? (optional) — e.g. investors, clients, my team")} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-[13px] text-slate-100" data-testid="slides-audience" />
              <div><p className="text-[12px] text-slate-400 mb-1.5">{tr("Slides")}</p>
                <div className="flex flex-wrap gap-1.5">{[5, 8, 10, 12, 15].map((n) => <button key={n} onClick={() => setCount(n)} className={chip(count === n)} data-testid={"slides-n-" + n}>{n}</button>)}</div></div>
              <div><p className="text-[12px] text-slate-400 mb-1.5">{tr("Design")}</p>
                <div className="grid grid-cols-3 min-[380px]:grid-cols-4 gap-1.5">{Object.entries(S.THEMES).map(([k, t]) => (
                  <button key={k} onClick={() => setTheme(k)} data-testid={"slides-theme-" + k} className={`rounded-xl border p-1.5 text-[11px] ${theme === k ? "border-teal-500 text-teal-200" : "border-slate-700 text-slate-400"}`}>
                    <span className="block h-7 rounded-md mb-1 relative overflow-hidden" style={{ background: "#" + t.cover }}><span className="absolute left-1.5 top-2 h-1 w-5 rounded" style={{ background: "#" + t.accent }} /><span className="absolute right-1 bottom-1 h-3 w-3 rounded-full" style={{ background: "#" + t.accent2 }} /></span>{tr(t.name)}</button>))}</div></div>
              <div><p className="text-[12px] text-slate-400 mb-1.5">{tr("Words on each point")}</p>
                <div className="flex flex-wrap gap-1.5">{[["short", "Short points"], ["detailed", "Detailed — full sentences"]].map(([k, l]) => <button key={k} onClick={() => { setDetail(k); try { localStorage.setItem("attune:slides:detail", k); } catch (e) {} }} className={chip(detail === k)} data-testid={"slides-detail-" + k}>{tr(l)}</button>)}</div></div>
              <MotionPicker motion={motion} setMotion={setMotionSaved} chip={chip} />
              <p className="text-[11px] text-slate-500">{tr("Or just say it in your request — e.g. “dark blue theme, fade transitions, the points fly in one by one”.")}</p>
            </>
          ) : (
            <>
              <div><p className="text-[12px] text-slate-400 mb-1.5">{tr("Kind of report")}</p>
                <div className="flex flex-wrap gap-1.5">{Object.keys(S.REPORT_KINDS).map((k) => <button key={k} onClick={() => setRKind(k)} className={chip(rKind === k)} data-testid={"report-kind-" + k}>{tr(REPORT_LABEL[k])}</button>)}</div></div>
              <div><p className="text-[12px] text-slate-400 mb-1.5">{tr("Length")}</p>
                <div className="flex flex-wrap gap-1.5">{Object.entries(LENGTHS).map(([n, l]) => <button key={n} onClick={() => setRLen(+n)} className={chip(rLen === +n)} data-testid={"report-len-" + n}>{tr(l)} · {tr("{n} sections", { n })}</button>)}</div></div>
            </>
          )}
          <select value={lang} onChange={(e) => setLangPick(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-[13px] text-slate-100" data-testid="slides-lang">
            <option value="auto">{tr("Language: same as my request")}</option>
            {Object.keys(S.S_LANGS).map((k) => <option key={k} value={k}>{langName(k)}</option>)}
          </select>
          <div className="space-y-2">
            {webPages ? (
              <button onClick={() => setUseWeb(!useWeb)} className={chip(useWeb) + " w-full flex items-center gap-2 text-start"} data-testid="slides-web">
                <Globe size={15} className="shrink-0" /><span className="flex-1">{tr("Research the web for facts and figures")}<span className="block text-[11px] text-slate-500">{tr("Each slide names its sources, and a Sources slide lists every page")}</span></span>{useWeb ? <Check size={15} /> : null}</button>
            ) : null}
            <input ref={fileRef} type="file" className="hidden" accept=".docx,.pdf,.pptx,.txt,.md,.html,.htm,.xlsx,.csv,.tsv,.ods" data-testid="slides-file" onChange={(e) => { pickFile(e.target.files[0]); e.target.value = ""; }} />
            {file ? (
              <div className="flex items-center gap-2 rounded-xl border border-teal-800 bg-teal-500/5 px-3 py-2 text-[12.5px] text-teal-100" data-testid="slides-file-name">
                <Paperclip size={14} className="shrink-0" /><span className="flex-1 truncate">{file.name}{file.data ? " · " + tr("{n} rows — totals and a chart are computed", { n: file.data.rows }) : ""}</span>
                <button onClick={() => setFile(null)} aria-label={tr("Remove")} className="p-1.5 -m-1.5 text-slate-400"><X size={15} /></button></div>
            ) : (
              <button onClick={() => fileRef.current && fileRef.current.click()} className={chip(false) + " w-full flex items-center gap-2 text-start"} data-testid="slides-attach">
                <Paperclip size={15} className="shrink-0" /><span className="flex-1">{tr("Base it on my file (Word, PDF, Excel, CSV…)")}</span></button>
            )}
          </div>
          {busy ? busyRow : (
            <button onClick={tab === "deck" ? makeDeck : makeReport} className="w-full py-2.5 rounded-xl bg-teal-500 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2" data-testid="slides-go">
              <Wand2 size={16} />{tab === "deck" ? tr("Make the presentation") : tr("Write the report")}</button>
          )}
          {err ? <p className="text-[12.5px] text-rose-300" data-testid="slides-error">{err}</p> : null}
          {!pro ? <p className="text-[11px] text-slate-500">{tr("Free: 2 a day · Pro: unlimited")}</p> : null}
        </section>
      ) : null}

      {!deck && !report && list.length ? (
        <section className="space-y-1.5" data-testid="slides-recent">
          <p className="text-[12px] text-slate-400 px-1">{tr("Recent")}</p>
          {list.map((x) => (
            <div key={x.id} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5">
              <button className="flex-1 min-w-0 flex items-center gap-2 text-start" onClick={() => { if (x.deck) setDeck(x.deck); else setReport(x.report); }}>
                {x.type === "deck" ? <Presentation size={15} className="text-teal-300 shrink-0" /> : <FileText size={15} className="text-sky-300 shrink-0" />}
                <span className="truncate text-[13px] text-slate-100" dir="auto">{x.title}</span></button>
              <button aria-label={tr("Delete")} className="p-2 -m-1 text-slate-500" onClick={async () => { if (await askConfirm(tr("Delete this?"))) { const l = loadList().filter((y) => y.id !== x.id); saveList(l); setList(l); } }}><Trash2 size={14} /></button>
            </div>))}
        </section>
      ) : null}

      {deck ? (
        <section className="space-y-3" data-testid="slides-deck">
          <div className="flex items-center justify-between gap-2 px-1">
            <p className="text-[14px] font-semibold text-slate-100 truncate" dir="auto" data-testid="slides-deck-title">{deck.title}</p>
            <span className="text-[11px] text-slate-500 shrink-0">{tr("{n} slides", { n: shapes.length })}</span>
          </div>
          {busyRow}
          {err ? <p className="text-[12.5px] text-rose-300" data-testid="slides-error">{err}</p> : null}
          {!busy && (deck.dropped || deck.unsure) ? (
            <p className="text-[12px] text-amber-200" data-testid="slides-check-note">{[deck.dropped ? tr("{n} figure(s) weren't in the sources, so they were left out of the charts.", { n: deck.dropped }) : "", deck.unsure ? tr(deck.hits.length || file ? "{n} figure(s) on the slides weren't found in the sources — check them before presenting." : "{n} figure(s) came from the AI's memory — check them before presenting.", { n: deck.unsure }) : ""].filter(Boolean).join(" ")}</p>
          ) : null}
          <div className="flex gap-1.5 overflow-x-auto att-hscroll pb-1">{Object.entries(S.THEMES).map(([k, t]) => (
            <button key={k} onClick={() => { setDeck({ ...deck, theme: k }); setTheme(k); try { localStorage.setItem("attune:slides:theme", k); } catch (e) {} }} data-testid={"deck-theme-" + k}
              className={`shrink-0 rounded-lg border px-2 py-1 text-[11px] flex items-center gap-1.5 ${deck.theme === k ? "border-teal-500 text-teal-200" : "border-slate-700 text-slate-400"}`}>
              <span className="h-3 w-3 rounded-full" style={{ background: "#" + t.accent }} />{tr(t.name)}</button>))}</div>
          {styleNote ? <p className="text-[11.5px] text-teal-300 px-1" data-testid="slides-style-note">{tr("From your request:")} {styleNote}</p> : null}
          <div className="grid grid-cols-3 gap-1.5">
            <select value={deck.transition || "none"} onChange={(e) => { const m = { ...motion, transition: e.target.value }; setMotionSaved(m); setDeck({ ...deck, transition: m.transition }); }} className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-[12px] text-slate-100" data-testid="deck-transition">
              {Object.entries(S.TRANSITIONS).map(([k, l]) => <option key={k} value={k}>{tr("Transition")}: {tr(l)}</option>)}</select>
            <select value={deck.animation || "none"} onChange={(e) => { const m = { ...motion, animation: e.target.value }; setMotionSaved(m); setDeck({ ...deck, animation: m.animation, trigger: deck.trigger || m.trigger }); }} className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-[12px] text-slate-100" data-testid="deck-animation">
              {Object.entries(S.ANIMATIONS).map(([k, l]) => <option key={k} value={k}>{tr("Animation")}: {tr(l)}</option>)}</select>
            <select value={deck.trigger || "click"} disabled={!deck.animation || deck.animation === "none"} onChange={(e) => { const m = { ...motion, trigger: e.target.value }; setMotionSaved(m); setDeck({ ...deck, trigger: m.trigger }); }} className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-[12px] text-slate-100 disabled:opacity-40" data-testid="deck-trigger">
              <option value="click">{tr("On tap")}</option><option value="auto">{tr("Automatically")}</option></select>
          </div>
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-3 space-y-2" data-testid="deck-cmd-box">
            <p className="text-[12.5px] text-slate-300 flex items-center gap-1.5"><Wand2 size={14} className="text-teal-300" />{tr("Change the presentation")}</p>
            <div className="flex gap-2">
              <input value={cmd} onChange={(e) => setCmd(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") runCommand(); }} dir="auto" disabled={!!busy}
                placeholder={tr("e.g. slide 4: shorter, add prices · delete slide 6 · add a slide about safety after slide 5")} className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-[13px] text-slate-100" data-testid="deck-cmd" />
              <button onClick={runCommand} disabled={!!busy || !cmd.trim()} className="shrink-0 px-3 rounded-xl bg-teal-500 text-slate-950 font-semibold text-sm disabled:opacity-40" data-testid="deck-cmd-go">{tr("Apply")}</button>
            </div>
            {cmdNote ? <p className="text-[12px] text-teal-300" data-testid="deck-cmd-note">{cmdNote}</p> : null}
          </div>
          {!busy ? <button onClick={() => setPlaying(true)} className="w-full py-2.5 rounded-xl border border-teal-600 text-teal-200 text-sm font-semibold flex items-center justify-center gap-2" data-testid="slides-play"><Play size={16} />{tr("Play — see the transitions and animations")}</button> : null}
          {!busy ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={savePptx} className="py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2" data-testid="slides-save-pptx"><Download size={16} />{tr("PowerPoint")}</button>
                <button onClick={saveDeckPdf} className="py-2.5 rounded-xl bg-slate-100 text-slate-900 font-semibold text-sm flex items-center justify-center gap-2" data-testid="slides-save-pdf"><Download size={16} />PDF</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => copyText(S.deckToText(deck))} className="py-2 rounded-xl border border-slate-700 text-slate-200 text-[13px] flex items-center justify-center gap-1.5" data-testid="slides-copy"><Copy size={14} />{tr("Copy as text")}</button>
                <button onClick={() => { setDeck(null); setEdit(null); }} className="py-2 rounded-xl border border-slate-700 text-slate-200 text-[13px]" data-testid="slides-new">{tr("Make another")}</button>
              </div>
            </div>
          ) : null}
          <div className="space-y-2.5">
            {shapes.map((x, k) => {
              const bodyIndex = deck.slides.indexOf(x.slide);
              return (
                <div key={k} className="relative">
                  <button className="block w-full" disabled={bodyIndex < 0 || !!busy} onClick={() => setEdit(bodyIndex)} data-testid={"slide-thumb-" + (k + 1)}>
                    <SlideCanvas shapes={x.shapes} testid={"slide-canvas-" + (k + 1)} />
                  </button>
                  <span className={"absolute top-1.5 text-[10px] " + (S.isRtl(deck.lang) ? "left-2" : "right-2") + " rounded bg-black/50 text-white px-1.5 py-0.5"}>{k + 1}{x.slide.pending ? " · " + tr("writing…") : bodyIndex >= 0 ? " · " + tr(KIND_LABEL[x.slide.kind] || "") + " · " + tr("tap to edit") : ""}</span>
                </div>);
            })}
          </div>
        </section>
      ) : null}

      {report ? <ReportView report={report} busyRow={busyRow} busy={busy} err={err} saveDocx={saveDocx} saveReportPdf={saveReportPdf}
        toDeck={() => { const d = S.deckFromReport(report); setReport(null); setDeck({ ...d, id: "d" + Date.now().toString(36), topic: report.topic, theme, ...motion, source: S.reportText(report, 20000) + (report.data ? report.data.text : ""), hits: (report.sources || []).filter((x) => x.n !== "F"), fileName: ((report.sources || []).find((x) => x.n === "F") || {}).title || "", dropped: 0, unsure: 0 }); }}
        copy={() => copyText(C.blocksToText(S.reportBlocks(report).filter((b) => b.type !== "pagebreak" && b.type !== "image")))} again={() => setReport(null)} /> : null}
    </div>
  );
}

function ReportView({ report, busyRow, busy, err, saveDocx, saveReportPdf, toDeck, copy, again }) {
  const W0 = S.words(report.lang), rtl = S.isRtl(report.lang);
  const B = (b, k) => b.type === "table" ? (
    <div key={k} className="overflow-x-auto att-hscroll my-2"><table className="text-[12px] border-collapse min-w-full"><tbody>{b.rows.map((r, ri) => <tr key={ri} className={ri === 0 ? "bg-slate-800 font-semibold" : ri % 2 ? "" : "bg-slate-900"}>{r.map((c, ci) => <td key={ci} className="border border-slate-700 px-2 py-1 text-slate-200" dir="auto">{c}</td>)}</tr>)}</tbody></table></div>
  ) : b.type === "li" ? <li key={k} className="ms-5 list-disc text-[13px] text-slate-200" dir="auto">{b.text}</li>
    : /^h\d$/.test(b.type) ? <p key={k} className="text-[13.5px] font-semibold text-slate-100 mt-2" dir="auto">{b.text}</p>
    : <p key={k} className="text-[13px] text-slate-300 leading-relaxed" dir="auto">{b.text}</p>;
  return (
    <section className="space-y-3" data-testid="report-view" dir={rtl ? "rtl" : "ltr"}>
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-2">
        <p className="text-[18px] font-bold text-white" dir="auto" data-testid="report-title">{report.title}</p>
        {report.subtitle ? <p className="text-[13px] text-slate-400" dir="auto">{report.subtitle}</p> : null}
        <p className="text-[11.5px] text-slate-500">{report.date}</p>
      </div>
      {busyRow}
      {err ? <p className="text-[12.5px] text-rose-300" data-testid="slides-error">{err}</p> : null}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-1.5" data-testid="report-body">
        <p className="text-[15px] font-semibold text-teal-200">{W0.summary}</p>
        {report.summary ? <>{report.summary.text ? <p className="text-[13px] text-slate-200 leading-relaxed" dir="auto" data-testid="report-summary">{report.summary.text}</p> : null}
          {report.summary.findings.length ? <ul className="space-y-1">{report.summary.findings.map((f, i) => <li key={i} className="ms-5 list-disc text-[13px] text-slate-200" dir="auto">{f}</li>)}</ul> : null}</>
          : <p className="text-[12px] text-slate-500">{tr("Written last, from the finished report…")}</p>}
        {report.data && report.data.chart ? <p className="text-[12px] text-sky-300 flex items-center gap-1.5 pt-1"><BarChart3 size={14} />{tr("A chart of {t} goes into the Word and PDF files", { t: report.data.chart.title })}</p> : null}
        {report.sections.map((s, i) => (
          <div key={i} className="pt-2" data-testid={"report-section-" + (i + 1)}>
            <p className="text-[15px] font-semibold text-teal-200" dir="auto">{i + 2}. {s.heading}</p>
            {s.pending ? <p className="text-[12px] text-slate-500">{tr("writing…")}</p> : s.blocks.map(B)}
          </div>))}
        {report.conclusion.length ? <div className="pt-2"><p className="text-[15px] font-semibold text-teal-200">{report.sections.length + 2}. {W0.conclusion}</p>{report.conclusion.map(B)}</div> : null}
        {report.sources && report.sources.length ? <div className="pt-2"><p className="text-[13px] font-semibold text-slate-300">{W0.sources}</p>{report.sources.map((s, i) => <p key={i} className="text-[11.5px] text-slate-500 break-all">[{i + 1}] {s.title} — {s.url}</p>)}</div> : null}
      </div>
      {!busy && report.unsure ? <p className="text-[12px] text-amber-200" data-testid="report-check-note">{tr(report.sources.length || report.data ? "{n} figure(s) in the report weren't found in the sources — check them." : "{n} figure(s) came from the AI's memory — check them before sending.", { n: report.unsure })}</p> : null}
      {!busy ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={saveDocx} className="py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2" data-testid="report-save-docx"><Download size={16} />{tr("Word")}</button>
            <button onClick={saveReportPdf} className="py-2.5 rounded-xl bg-slate-100 text-slate-900 font-semibold text-sm flex items-center justify-center gap-2" data-testid="report-save-pdf"><Download size={16} />PDF</button>
          </div>
          <button onClick={toDeck} className="w-full py-2.5 rounded-xl border border-teal-700 text-teal-200 text-[13px] flex items-center justify-center gap-2" data-testid="report-to-deck"><Presentation size={15} />{tr("Make slides from this report")}</button>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={copy} className="py-2 rounded-xl border border-slate-700 text-slate-200 text-[13px] flex items-center justify-center gap-1.5"><Copy size={14} />{tr("Copy as text")}</button>
            <button onClick={again} className="py-2 rounded-xl border border-slate-700 text-slate-200 text-[13px]" data-testid="report-new">{tr("Make another")}</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SlideEditor({ deck, index, setDeck, close, busy, busyRow, rewrite, err }) {
  const s = deck.slides[index];
  const [title, setTitle] = useState(s.title);
  const [body, setBody] = useState(S.slideToText(s));
  const [notes, setNotes] = useState(s.notes || "");
  const [ask, setAsk] = useState("");
  useEffect(() => { setTitle(s.title); setBody(S.slideToText(s)); setNotes(s.notes || ""); }, [s]);
  const th = S.THEMES[deck.theme] || S.THEMES.midnight;
  const parsed = S.parseSlide(s.kind, body);
  const draft = S.fixSlide({ ...parsed, notes, cites: parsed.cites || s.cites }, title || s.title);   // hand edits keep the slide's sources
  const k = S.fullDeck(deck).indexOf(s) + 1;
  const shapes = S.layoutSlide(draft, th, { i: k, deckTitle: deck.title, rtl: S.isRtl(deck.lang), lang: deck.lang });
  const apply = () => { setDeck({ ...deck, slides: deck.slides.map((x, j) => (j === index ? draft : x)) }); close(); };
  const move = (d) => { const j = index + d; if (j < 0 || j >= deck.slides.length) return; const l = [...deck.slides]; [l[index], l[j]] = [l[j], l[index]]; setDeck({ ...deck, slides: l }); close(); };
  const kinds = [...S.KINDS_TEXT, ...(S.hasFigures(deck.source || "") ? S.KINDS_FIG : [])];
  const help = { bullets: "One point per line: - Lead: sentence", steps: "One step per line: - Step: sentence", two: "LEFT: heading, its points, then RIGHT: heading, its points", table: "One row per line, cells split by |", stats: "- number | what it means", chart: "UNIT: …, then - label | number, TAKEAWAY: …", quote: "QUOTE: … and BY: …" }[s.kind];
  return (
    <div className="space-y-3 max-w-2xl mx-auto" data-testid="slide-editor">
      <p className="text-[13px] text-slate-400 px-1">{tr("Slide {n}", { n: k })} · {tr(KIND_LABEL[s.kind] || "")}</p>
      <SlideCanvas shapes={shapes} testid="slide-editor-canvas" />
      {busyRow}
      {err ? <p className="text-[12.5px] text-rose-300">{err}</p> : null}
      <section className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-2.5">
        <input value={title} onChange={(e) => setTitle(e.target.value)} dir="auto" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-[14px] text-slate-100 font-semibold" data-testid="slide-edit-title" />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7} dir="auto" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-[13px] text-slate-100 leading-relaxed font-mono" data-testid="slide-edit-body" />
        <p className="text-[11px] text-slate-500">{tr(help || "")}</p>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} dir="auto" placeholder={tr("Speaker notes (what you say on this slide)")} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-[12.5px] text-slate-200" data-testid="slide-edit-notes" />
        <button onClick={apply} disabled={!!busy} className="w-full py-2.5 rounded-xl bg-teal-500 text-slate-950 font-semibold text-sm" data-testid="slide-edit-save">{tr("Done")}</button>
      </section>
      <section className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-2.5">
        <p className="text-[12.5px] text-slate-300 flex items-center gap-1.5"><Wand2 size={14} className="text-teal-300" />{tr("Ask the AI to redo it")}</p>
        <input value={ask} onChange={(e) => setAsk(e.target.value)} dir="auto" placeholder={tr("e.g. shorter, more about safety, add prices")} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-[13px] text-slate-100" data-testid="slide-ai-ask" />
        <button disabled={!!busy} onClick={() => rewrite(s.kind, ask.trim())} className="w-full py-2 rounded-xl border border-teal-700 text-teal-200 text-[13px]" data-testid="slide-ai-redo">{tr("Rewrite this slide")}</button>
        <p className="text-[11.5px] text-slate-400">{tr("Or turn it into:")}</p>
        <div className="flex flex-wrap gap-1.5">{kinds.filter((x) => x !== s.kind).map((x) => <button key={x} disabled={!!busy} onClick={() => rewrite(x, ask.trim())} className="px-2.5 py-1.5 rounded-lg border border-slate-700 text-slate-300 text-[12px]" data-testid={"slide-kind-" + x}>{tr(KIND_LABEL[x])}</button>)}</div>
      </section>
      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => move(-1)} disabled={index === 0 || !!busy} className="py-2 rounded-xl border border-slate-700 text-slate-200 text-[12.5px] flex items-center justify-center gap-1 disabled:opacity-40" data-testid="slide-up"><ArrowUp size={14} />{tr("Earlier")}</button>
        <button onClick={() => move(1)} disabled={index === deck.slides.length - 1 || !!busy} className="py-2 rounded-xl border border-slate-700 text-slate-200 text-[12.5px] flex items-center justify-center gap-1 disabled:opacity-40" data-testid="slide-down"><ArrowDown size={14} />{tr("Later")}</button>
        <button disabled={!!busy || deck.slides.length <= 1} onClick={async () => { if (await askConfirm(tr("Delete this slide?"))) { setDeck({ ...deck, slides: deck.slides.filter((_, j) => j !== index) }); close(); } }} className="py-2 rounded-xl border border-rose-900 text-rose-200 text-[12.5px] flex items-center justify-center gap-1 disabled:opacity-40" data-testid="slide-delete"><Trash2 size={14} />{tr("Delete")}</button>
      </div>
    </div>
  );
}

function MotionPicker({ motion, setMotion, chip }) {
  return (
    <div className="space-y-2" data-testid="slides-motion">
      <div><p className="text-[12px] text-slate-400 mb-1.5">{tr("Transitions between slides")}</p>
        <div className="flex flex-wrap gap-1.5">{Object.entries(S.TRANSITIONS).map(([k, l]) => <button key={k} onClick={() => setMotion({ ...motion, transition: k })} className={chip(motion.transition === k)} data-testid={"slides-trans-" + k}>{tr(l)}</button>)}</div></div>
      <div><p className="text-[12px] text-slate-400 mb-1.5">{tr("Animations (points, cards and charts appear)")}</p>
        <div className="flex flex-wrap gap-1.5">{Object.entries(S.ANIMATIONS).map(([k, l]) => <button key={k} onClick={() => setMotion({ ...motion, animation: k })} className={chip(motion.animation === k)} data-testid={"slides-anim-" + k}>{tr(l)}</button>)}</div>
        {motion.animation !== "none" ? <div className="flex gap-1.5 mt-1.5">{[["click", "On tap"], ["auto", "Automatically"]].map(([k, l]) => <button key={k} onClick={() => setMotion({ ...motion, trigger: k })} className={chip(motion.trigger === k)} data-testid={"slides-trigger-" + k}>{tr(l)}</button>)}</div> : null}</div>
    </div>
  );
}
