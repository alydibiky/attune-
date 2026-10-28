/* ---- Converter → Edit a PDF (v6.32) -----------------------------------------------------------------------
   Ali: "add Edit a PDF directly … in the converters page for minimalism in a good way". One page at a time with
   five tools at the bottom: Text (tap a line to change it, an empty spot to add text), Highlight (drag over words),
   Draw, Sign (the signature is kept on this device) and Pages (order, turn, delete, add). Save writes a new PDF on
   the phone (DocTools.kt "edit") or the computer (desktop/lib/pdf.js); nothing is uploaded and the original file
   is never changed. The logic lives in pdfedit.js. */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Undo2, Loader2, ChevronLeft, ChevronRight, RefreshCw, X, Plus, Trash2 } from "lucide-react";
import { tr } from "./i18n.js";
import { useSubBack } from "./backstack.js";
import { askConfirm } from "./confirm.jsx";
import * as E from "./pdfedit.js";
import * as K from "./ui-kit.jsx";

const TOOLS = [["text", "Text"], ["highlight", "Highlight"], ["draw", "Draw"], ["sign", "Sign"], ["pages", "Pages"]];
const INK = ["#1e3a8a", "#111827", "#b91c1c"];
const MARK = ["#ffd54a", "#86efac", "#f9a8d4"];
const SIGN_KEY = "attune:pdfedit:sign";
const readB64 = (f) => new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] || ""); r.onerror = () => bad(new Error("Couldn't read that file")); r.readAsDataURL(f); });
const uid = () => Math.random().toString(36).slice(2, 9);

// the page's own colour around a line (so a changed line is covered with the same paper colour, not white on cream)
function paperColour(img, r) {
  try {
    if (!img || !img.naturalWidth) return "#ffffff";
    const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext("2d"); g.drawImage(img, 0, 0);
    const W = c.width, H = c.height, pts = [];
    for (let k = 0; k <= 6; k++) { const x = r.x + (r.w * k) / 6; pts.push([x, r.y - 0.004], [x, r.y + r.h + 0.004]); }
    pts.push([r.x - 0.01, r.y + r.h / 2], [r.x + r.w + 0.01, r.y + r.h / 2]);
    const seen = new Map();
    for (const [x, y] of pts) {
      const px = Math.round(Math.max(0, Math.min(1, x)) * (W - 1)), py = Math.round(Math.max(0, Math.min(1, y)) * (H - 1));
      const d = g.getImageData(px, py, 1, 1).data; const key = [d[0], d[1], d[2]].map((v) => Math.round(v / 8) * 8).join(",");
      seen.set(key, (seen.get(key) || 0) + 1);
    }
    const best = [...seen.entries()].sort((a, b) => b[1] - a[1])[0][0].split(",").map((v) => Math.min(255, +v));
    return "#" + best.map((v) => v.toString(16).padStart(2, "0")).join("");
  } catch (e) { return "#ffffff"; }
}

// a text the PDF's built-in font can't write (Arabic…) → a sharp picture of it, placed where the text goes
function textPicture(e, ar) {
  const PX = 3000, fs = Math.max(8, e.size * PX), font = `${e.bold ? "700 " : ""}${fs}px system-ui, "Noto Naskh Arabic", "Segoe UI", sans-serif`;
  const c = document.createElement("canvas"), g = c.getContext("2d");
  g.font = font; const tw = Math.ceil(g.measureText(e.text).width) + 4;
  c.width = tw; c.height = Math.ceil(fs * 1.35);
  g.font = font; g.fillStyle = e.color || "#000000"; g.textBaseline = "alphabetic"; g.direction = e.rtl ? "rtl" : "ltr"; g.textAlign = e.rtl ? "right" : "left";
  g.fillText(e.text, e.rtl ? tw - 2 : 2, Math.round(fs * 1.02));
  const w = tw / (PX * ar), h = c.height / PX;
  const right = e.kind === "retext" ? e.rect.x + e.rect.w : e.x;
  return { png: c.toDataURL("image/png").split(",")[1], x: e.rtl ? right - w : e.x, y: e.base - fs * 1.02 / PX, w, h };
}

export function PdfEditor({ file, nativeCall, onClose, onDone, flash }) {
  const [doc, setDoc] = useState(null);          // {b64, count}
  const [err, setErr] = useState("");
  const [order, setOrder] = useState([]);        // [{n (source page, 0 = blank), rot, key}]
  const [edits, setEdits] = useState([]);
  const [hist, setHist] = useState([]);
  const [at, setAt] = useState(0);               // index in order
  const [tool, setTool] = useState("text");
  const [pics, setPics] = useState({});          // n → data URL
  const [thumbs, setThumbs] = useState({});
  const [words, setWords] = useState({});        // n → {ws, ar}
  const [pop, setPop] = useState(null);          // the text being typed
  const [live, setLive] = useState(null);        // a highlight / drawing while the finger moves
  const [ink, setInk] = useState(INK[0]);
  const [mark, setMark] = useState(MARK[0]);
  const [sign, setSign] = useState(() => { try { return JSON.parse(localStorage.getItem(SIGN_KEY) || "null"); } catch (e) { return null; } });
  const [pad, setPad] = useState(false);
  const [picked, setPicked] = useState(null);    // the signature being moved
  const [drag, setDrag] = useState(null);        // Pages: {from, over}
  const [busy, setBusy] = useState("");
  const sheet = useRef(null), img = useRef(null), gest = useRef(null), addRef = useRef(null);

  const cur = order[at] || null, n = cur ? cur.n : 0, info = words[n] || null, ar = info ? info.ar : 0.707;
  const lines = useMemo(() => (info ? E.linesOf(info.ws) : []), [info]);
  const dirty = doc ? E.changed(edits, order, doc.count) : false;

  // open the file: how many pages, then the first page
  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const b64 = await readB64(file);
        const r = await nativeCall("pdfText", { b64, textOnly: true, max: 1 });
        const count = (r && r.count) || ((r && r.pages) || []).length || 1;
        if (!on) return;
        setDoc({ b64, count }); setOrder(Array.from({ length: count }, (_, i) => ({ n: i + 1, rot: 0, key: uid() })));
      } catch (e) { if (on) setErr(String((e && e.message) || e)); }
    })();
    return () => { on = false; };
  }, [file]);
  // the page's picture and its words
  useEffect(() => {
    if (!doc || !n || tool === "pages") return;
    let on = true;
    const w = Math.max(800, Math.min(1800, Math.round(((sheet.current && sheet.current.clientWidth) || 380) * Math.min(2.5, (typeof devicePixelRatio === "number" && devicePixelRatio) || 2) / 200) * 200));
    if (!pics[n]) nativeCall("pdfImages", { b64: doc.b64, pages: [n], width: w, max: 1 }).then((r) => { const im = r && r.images && r.images[0]; if (on && im) setPics((p) => ({ ...p, [n]: im.image })); }).catch(() => {});
    if (!words[n]) nativeCall("pdfWords", { b64: doc.b64, pages: [n] }).then((r) => { const pg = r && r.pages && r.pages[0]; if (on && pg) setWords((m) => ({ ...m, [n]: { ws: pg.words || [], ar: pg.ar || 0.707 } })); }).catch(() => { if (on) setWords((m) => ({ ...m, [n]: { ws: [], ar: 0.707 } })); });
    return () => { on = false; };
  }, [doc, n, tool]);
  // Pages: small pictures of every page
  useEffect(() => {
    if (!doc || tool !== "pages") return;
    const want = [...new Set(order.map((p) => p.n))].filter((k) => k && !thumbs[k]).slice(0, 60);
    if (!want.length) return;
    let on = true;
    nativeCall("pdfImages", { b64: doc.b64, pages: want, width: 400, max: want.length }).then((r) => { if (!on) return; const m = {}; for (const im of (r && r.images) || []) m[im.n] = im.image; setThumbs((t) => ({ ...t, ...m })); }).catch(() => {});
    return () => { on = false; };
  }, [doc, tool, order]);

  const remember = () => setHist((h) => [...h.slice(-60), { edits, order }]);
  const undo = () => { if (!hist.length) return; const s = hist[hist.length - 1]; setHist(hist.slice(0, -1)); setEdits(s.edits); setOrder(s.order); setAt((a) => Math.min(a, s.order.length - 1)); setPop(null); setPicked(null); };
  const leave = async () => { if (pop) { setPop(null); return; } if (dirty && !(await askConfirm("Leave without saving your changes?", { yes: "Leave", no: "Keep editing" }))) return; onClose(); };
  useSubBack(true, leave);

  const point = (ev) => { const r = sheet.current.getBoundingClientRect(); return [Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height))]; };

  // Text: tap a line → change it; tap an empty spot → new text; tap a text you added → change it again
  const tapText = (ev) => {
    const [x, y] = point(ev);
    const had = E.hitEdit(edits.filter((e) => e.kind === "text" || e.kind === "retext"), n, x, y, ar);
    if (had) { setPop({ draft: { ...had }, old: had.id }); return; }
    const l = E.hitLine(lines, x, y);
    if (l) {
      const p = l.h * 0.12, rect = { x: l.x - p, y: l.y - p, w: l.w + 2 * p, h: l.h + 2 * p };
      setPop({ draft: { id: uid(), page: n, kind: "retext", rect, bg: paperColour(img.current, rect), text: l.text, orig: l.text, x: l.x, base: l.base, size: l.size, rtl: l.rtl, bold: false, color: "#000000" } });
    } else {
      const sizes = lines.map((q) => q.size).sort((a, b) => a - b), size = sizes.length ? sizes[sizes.length >> 1] : 0.016;
      setPop({ draft: { id: uid(), page: n, kind: "text", text: "", x, base: y + size * 0.35, size, rtl: false, bold: false, color: "#000000" } });
    }
  };
  const setDraft = (o) => setPop((p) => ({ ...p, draft: { ...p.draft, ...o, rtl: o.text != null ? /[؀-ۿ]/.test(o.text) && !/^[\x20-\x7E]*$/.test(o.text) : p.draft.rtl } }));
  const donePop = () => {
    const d = pop.draft; setPop(null);
    const same = d.kind === "retext" && d.text === d.orig && !d.bold && d.color === "#000000" && !pop.old;
    if (same || (d.kind === "text" && !d.text.trim() && !pop.old)) return;
    remember();
    setEdits((es) => (pop.old ? es.map((e) => (e.id === pop.old ? d : e)) : [...es, d]));
  };
  const dropPop = () => { const old = pop.old; setPop(null); if (old) { remember(); setEdits((es) => es.filter((e) => e.id !== old)); } };

  // Highlight / Draw / Sign: the finger on the page
  const down = (ev) => {
    if (tool === "text" || pop) return;
    const [x, y] = point(ev);
    if (tool === "sign") {
      const hit = E.hitEdit(edits.filter((e) => e.kind === "image"), n, x, y, ar);
      if (hit) { setPicked(hit.id); gest.current = { move: hit.id, dx: x - hit.x, dy: y - hit.y, start: hit, moved: false }; try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch (e) {} return; }
      if (!sign) { setPad(true); return; }
      const w = 0.32, h = w * ar * sign.ratio;
      remember();
      const e = { id: uid(), page: n, kind: "image", png: sign.png, x: Math.max(0, Math.min(1 - w, x - w / 2)), y: Math.max(0, Math.min(1 - h, y - h / 2)), w, h };
      setEdits((es) => [...es, e]); setPicked(e.id); return;
    }
    gest.current = { x0: x, y0: y, pts: [[x, y]] };
    try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch (e) {}
    setLive(tool === "draw" ? { kind: "ink", pts: [[x, y]], color: ink } : { kind: "highlight", rects: [], color: mark });
  };
  const move = (ev) => {
    const g = gest.current; if (!g) return;
    const [x, y] = point(ev);
    if (g.move) {
      if (!g.moved) { remember(); g.moved = true; }
      setEdits((es) => es.map((e) => (e.id === g.move ? { ...e, x: Math.max(0, Math.min(1 - e.w, x - g.dx)), y: Math.max(0, Math.min(1 - e.h, y - g.dy)) } : e)));
      return;
    }
    if (g.resize) {
      if (!g.moved) { remember(); g.moved = true; }
      setEdits((es) => es.map((e) => { if (e.id !== g.resize) return e; const w = Math.max(0.06, Math.min(1 - e.x, x - e.x)); return { ...e, w, h: w * (e.h / e.w) }; }));
      return;
    }
    if (tool === "draw") { g.pts.push([x, y]); setLive({ kind: "ink", pts: [...g.pts], color: ink }); }
    else {
      let rects = info && info.ws.length ? E.selectRects(info.ws, g.x0, g.y0, x, y) : [];
      if (!rects.length && Math.abs(x - g.x0) > 0.01) rects = [[Math.min(g.x0, x), Math.min(g.y0, y), Math.abs(x - g.x0), Math.max(0.012, Math.abs(y - g.y0))]];  // a scanned page: a free box
      setLive({ kind: "highlight", rects, color: mark });
    }
  };
  const up = () => {
    const g = gest.current; gest.current = null;
    if (!g || g.move || g.resize) return;
    const l = live; setLive(null);
    if (!l) return;
    if (l.kind === "ink" && l.pts.length > 1) { remember(); setEdits((es) => [...es, { id: uid(), page: n, kind: "ink", pts: l.pts.map(([a, b]) => [Math.round(a * 1e4) / 1e4, Math.round(b * 1e4) / 1e4]), color: l.color, width: 0.004 }]); }
    if (l.kind === "highlight" && l.rects.length) { remember(); setEdits((es) => [...es, { id: uid(), page: n, kind: "highlight", rects: l.rects, color: l.color }]); }
  };

  // Pages
  const turn = (i) => { remember(); setOrder((o) => o.map((p, k) => (k === i ? { ...p, rot: ((p.rot || 0) + 90) % 360 } : p))); };
  const drop = (i) => { if (order.length < 2) { flash && flash(tr("A PDF needs at least one page.")); return; } remember(); setOrder((o) => o.filter((_, k) => k !== i)); setAt((a) => Math.max(0, Math.min(a, order.length - 2))); };
  const blank = () => { remember(); setOrder((o) => [...o, { n: 0, rot: 0, key: uid() }]); };
  const addPdf = async (f) => {
    if (!f) return;
    setBusy(tr("Adding the pages…"));
    try {
      const more = await readB64(f);
      const r = await nativeCall("pdfEdit", { op: "merge", files: [doc.b64, more] });
      const out = r && r.files && r.files[0]; if (!out) throw new Error("Couldn't add that PDF");
      const total = out.pages || doc.count;
      remember();
      setOrder((o) => [...o, ...Array.from({ length: Math.max(0, total - doc.count) }, (_, i) => ({ n: doc.count + i + 1, rot: 0, key: uid() }))]);
      setDoc({ b64: out.b64, count: total });
    } catch (e) { flash && flash(String((e && e.message) || e)); }
    setBusy("");
  };
  // Pages: press a page and move it to change the order (a tap opens it)
  const hold = useRef(null);
  const holdStart = (i, ev) => { hold.current = { i, x: ev.clientX, y: ev.clientY, moved: false }; try { ev.currentTarget.releasePointerCapture(ev.pointerId); } catch (e) {} };
  const holdMove = (ev) => {
    const h = hold.current; if (!h) return;
    if (!h.moved) { if (Math.hypot(ev.clientX - h.x, ev.clientY - h.y) < 8) return; h.moved = true; setDrag({ from: h.i, over: h.i }); }
    const el = document.elementFromPoint(ev.clientX, ev.clientY); const c = el && el.closest && el.closest("[data-idx]");
    if (c) { const k = +c.getAttribute("data-idx"); setDrag((d) => (d && d.over !== k ? { ...d, over: k } : d)); }
  };
  const holdEnd = () => {
    const h = hold.current; hold.current = null;
    if (!h || !h.moved) return;
    const d = drag; setDrag(null);
    if (d && d.from !== d.over) { remember(); setOrder((o) => E.movePage(o, d.from, d.over)); }
    hold.justMoved = Date.now();
  };

  const save = async () => {
    if (!doc || busy) return;
    setBusy(tr("Saving a new copy…")); setErr("");
    try {
      const ars = {}; for (const k of Object.keys(words)) ars[k] = words[k].ar;
      const ops = await E.buildOps(edits, order, async (e) => textPicture(e, ars[e.page] || 0.707));
      const r = await nativeCall("pdfEdit", { op: "edit", b64: doc.b64, ...ops });
      const f = r && r.files && r.files[0]; if (!f) throw new Error("Couldn't change that PDF");
      const name = (file.name || "file").replace(/\.pdf$/i, "") + "-edited.pdf";
      onDone({ name, mime: "application/pdf", b64: f.b64, size: Math.floor(f.b64.length * 0.75), pagesOut: f.pages, note: "" });
    } catch (e) { setErr(String((e && e.message) || e)); }
    setBusy("");
  };

  // what is drawn over the page picture
  const shown = edits.filter((e) => e.page === n).concat(pop && pop.draft.page === n && !pop.old ? [pop.draft] : []).map((e) => (pop && pop.old === e.id ? pop.draft : e));
  const H = sheet.current ? sheet.current.clientHeight : 500;
  const layer = (e, k) => {
    if (e.kind === "highlight") return e.rects.map((q, j) => <div key={k + "-" + j} className="absolute mix-blend-multiply" style={{ left: q[0] * 100 + "%", top: q[1] * 100 + "%", width: q[2] * 100 + "%", height: q[3] * 100 + "%", background: e.color, opacity: 0.45 }} />);
    if (e.kind === "ink") return <svg key={k} className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1 1" preserveAspectRatio="none"><polyline points={e.pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={e.color} strokeWidth="2.2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    if (e.kind === "image") return (
      <div key={k} className={"absolute " + (picked === e.id && tool === "sign" ? "outline outline-2 outline-[var(--c-acc)] outline-dashed" : "")} style={{ left: e.x * 100 + "%", top: e.y * 100 + "%", width: e.w * 100 + "%", height: e.h * 100 + "%" }} data-testid="pdfedit-sig">
        <img src={"data:image/png;base64," + e.png} alt="" className="w-full h-full pointer-events-none" />
        {picked === e.id && tool === "sign" ? <>
          <button onPointerDown={(ev) => { ev.stopPropagation(); remember(); setEdits((es) => es.filter((x) => x.id !== e.id)); setPicked(null); }} className="absolute -top-3 -end-3 w-6 h-6 rounded-full bg-[var(--c-neg)] text-[var(--c-on-acc)] flex items-center justify-center" aria-label={tr("Remove")} data-testid="pdfedit-sig-remove"><X size={13} /></button>
          <span onPointerDown={(ev) => { ev.stopPropagation(); gest.current = { resize: e.id, moved: false }; try { sheet.current.setPointerCapture(ev.pointerId); } catch (x) {} }} className="absolute -bottom-2 -right-2 w-5 h-5 rounded-full bg-[var(--c-acc)] border-2 border-[var(--c-ln)] cursor-nwse-resize" />
        </> : null}
      </div>);
    // a changed or added line: the paper colour over the old words, the new words on top
    const fs = e.size * H;
    return (
      <React.Fragment key={k}>
        {e.kind === "retext" ? <div className="absolute" style={{ left: e.rect.x * 100 + "%", top: e.rect.y * 100 + "%", width: e.rect.w * 100 + "%", height: e.rect.h * 100 + "%", background: e.bg }} /> : null}
        <div dir={e.rtl ? "rtl" : "ltr"} className={"absolute whitespace-pre leading-none " + (pop && pop.draft.id === e.id ? "outline outline-2 outline-[var(--c-acc)]" : "")} data-testid="pdfedit-text"
          style={{ [e.rtl ? "right" : "left"]: (e.rtl ? (1 - (e.kind === "retext" ? e.rect.x + e.rect.w : e.x)) : e.x) * 100 + "%", top: (e.base - e.size * 0.82) * 100 + "%", fontSize: fs + "px", color: e.color, fontWeight: e.bold ? 700 : 400, fontFamily: "Helvetica, Arial, sans-serif" }}>{e.text || " "}</div>
      </React.Fragment>);
  };

  if (err && !doc) return (
    <section className={"calm " + K.cardPad + " bg-[var(--c-surf)]! space-y-3"} data-testid="pdfedit">
      <p className="text-[13px] text-[var(--c-neg)]" data-testid="pdfedit-error">{err}</p>
      <button onClick={onClose} className={K.btnS + " w-full"}>{tr("Back")}</button>
    </section>);

  return (
    <div className="calm text-[var(--c-ink)] flex flex-col max-w-3xl mx-auto" data-testid="pdfedit">
      <div className="flex items-center gap-2 px-1 pb-2">
        <button onClick={leave} aria-label={tr("Back")} className="w-11 h-11 -ms-1 grid place-items-center rounded-[12px] text-[var(--c-ink)]" data-testid="pdfedit-back"><ChevronLeft size={20} className="rtl:-scale-x-100" /></button>
        <p className="flex-1 truncate text-[15px] font-extrabold text-[var(--c-ink)]">{file.name}</p>
        <button onClick={undo} disabled={!hist.length} aria-label={tr("Undo")} className={"w-11 h-11 grid place-items-center rounded-[12px] " + (hist.length ? "text-[var(--c-acc)]" : "text-[var(--c-mut)]")} data-testid="pdfedit-undo"><Undo2 size={17} /></button>
        <button onClick={save} disabled={!dirty || !!busy} className={"min-h-[44px] px-4 rounded-[12px] text-[13.5px] font-extrabold " + (dirty && !busy ? "bg-[var(--c-acc)] text-[var(--c-on-acc)]" : "bg-[var(--c-surf-2)] text-[var(--c-mut)]")} data-testid="pdfedit-save">{tr("Save")}</button>
      </div>
      {busy ? <p className="flex items-center gap-2 text-[12.5px] text-[var(--c-acc)] px-1 pb-2" data-testid="pdfedit-busy"><Loader2 size={14} className="animate-spin" />{busy}</p> : null}
      {err ? <p className="text-[12.5px] text-[var(--c-neg)] px-1 pb-2" data-testid="pdfedit-error">{err}</p> : null}

      {!doc ? <p className="flex items-center gap-2 text-[13px] text-[var(--c-mut)] p-4"><Loader2 size={14} className="animate-spin" />{tr("Opening the PDF…")}</p>
      : tool === "pages" ? (
        <div className="pb-4" onPointerMove={holdMove} onPointerUp={holdEnd} onPointerCancel={holdEnd} data-testid="pdfedit-pages">
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-4 select-none">
            {order.map((p, i) => (
              <div key={p.key} data-idx={i} data-testid="pdfedit-thumb" onPointerDown={(ev) => holdStart(i, ev)} onClick={() => { if (Date.now() - (hold.justMoved || 0) > 300) { setAt(i); setTool("text"); } }}
                className={"relative " + (drag && drag.from === i ? "opacity-40" : "") + (drag && drag.over === i && drag.from !== i ? " outline outline-2 outline-[var(--c-acc)] rounded" : "")}>
                <div className="aspect-[0.707] bg-white rounded overflow-hidden flex items-center justify-center cursor-grab" style={{ touchAction: "none" }}>
                  {p.n && thumbs[p.n] ? <img src={thumbs[p.n]} alt="" className="max-w-full max-h-full pointer-events-none" style={{ transform: `rotate(${p.rot || 0}deg)` }} /> : p.n ? <Loader2 size={14} className="animate-spin text-[var(--c-mut)]" /> : <span className="text-[11px] text-[var(--c-mut)]">{tr("Blank page")}</span>}
                </div>
                <button onPointerDown={(ev) => ev.stopPropagation()} onClick={(ev) => { ev.stopPropagation(); turn(i); }} aria-label={tr("Turn")} className="absolute -top-2 -start-2 w-6 h-6 rounded-full bg-[var(--c-ln)] text-[var(--c-ink)] flex items-center justify-center" data-testid="pdfedit-turn"><RefreshCw size={12} /></button>
                <button onPointerDown={(ev) => ev.stopPropagation()} onClick={(ev) => { ev.stopPropagation(); drop(i); }} aria-label={tr("Delete")} className="absolute -top-2 -end-2 w-6 h-6 rounded-full bg-[var(--c-neg)] text-[var(--c-on-acc)] flex items-center justify-center" data-testid="pdfedit-del"><Trash2 size={12} /></button>
                <p className="text-center text-[11px] text-[var(--c-mut)] mt-1">{i + 1}</p>
              </div>))}
          </div>
          <div className="flex flex-wrap gap-2 mt-5">
            <input ref={addRef} type="file" accept=".pdf,application/pdf" className="hidden" data-testid="pdfedit-add-file" onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; addPdf(f); }} />
            <button onClick={() => addRef.current && addRef.current.click()} className={K.btnS} data-testid="pdfedit-add"><Plus size={14} />{tr("Add pages from a PDF")}</button>
            <button onClick={blank} className={K.btnS} data-testid="pdfedit-blank"><Plus size={14} />{tr("Blank page")}</button>
          </div>
          <p className="text-[12px] text-[var(--c-mut)] mt-3">{tr("Drag a page to change the order. Tap a page to edit it.")}</p>
        </div>
      ) : (
        <div className="pb-2">
          <div className="relative mx-auto bg-white shadow-lg select-none" ref={sheet} style={{ aspectRatio: String(ar), maxWidth: "100%", width: ar >= 1 ? "100%" : `min(100%, calc(76vh * ${ar}))`, touchAction: tool === "text" ? "auto" : "none" }}
            onClick={tool === "text" && !pop ? tapText : undefined} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} data-testid="pdfedit-page">
            {n && pics[n] ? <img ref={img} src={pics[n]} alt="" className="absolute inset-0 w-full h-full pointer-events-none" data-testid="pdfedit-pic" />
              : n ? <div className="absolute inset-0 flex items-center justify-center"><Loader2 size={18} className="animate-spin text-[var(--c-mut)]" /></div> : null}
            <div className="absolute inset-0 overflow-hidden pointer-events-none [&_button]:pointer-events-auto [&_span]:pointer-events-auto">{shown.map(layer)}{live ? layer({ ...live, id: "live" }, "live") : null}</div>
          </div>
          <div className="flex items-center justify-center gap-4 mt-2 text-[12.5px] text-[var(--c-mut)]">
            <button onClick={() => { setAt((a) => Math.max(0, a - 1)); setPop(null); setPicked(null); }} disabled={at === 0} className="w-11 h-11 grid place-items-center rounded-[12px] disabled:opacity-30" aria-label={tr("Previous page")} data-testid="pdfedit-prev"><ChevronLeft size={18} className="rtl:-scale-x-100" /></button>
            <span data-testid="pdfedit-at">{tr("Page {n} of {m}", { n: at + 1, m: order.length })}</span>
            <button onClick={() => { setAt((a) => Math.min(order.length - 1, a + 1)); setPop(null); setPicked(null); }} disabled={at >= order.length - 1} className="w-11 h-11 grid place-items-center rounded-[12px] disabled:opacity-30" aria-label={tr("Next page")} data-testid="pdfedit-next"><ChevronRight size={18} className="rtl:-scale-x-100" /></button>
          </div>
          <p className="text-center text-[12px] text-[var(--c-mut)] mt-1" data-testid="pdfedit-hint">{tr(
            tool === "text" ? (lines.length ? "Tap a line to change it, or an empty spot to add text" : "Tap where the text should go")
            : tool === "highlight" ? "Drag over words to highlight them" : tool === "draw" ? "Draw with your finger"
            : sign ? "Tap where your signature goes; drag it to move it" : "Tap the page to make your signature")}</p>
          {tool === "draw" || tool === "highlight" || tool === "sign" ? (
            <div className="flex items-center justify-center gap-3 mt-2">
              {tool === "sign" ? (sign ? <button onClick={() => setPad(true)} className="min-h-[44px] text-[12.5px] font-bold text-[var(--c-acc)]" data-testid="pdfedit-new-sign">{tr("Change my signature")}</button> : null)
                : (tool === "draw" ? INK : MARK).map((c) => <button key={c} onClick={() => (tool === "draw" ? setInk(c) : setMark(c))} aria-label={c} className={"shrink-0 p-0 rounded-full border-2 " + ((tool === "draw" ? ink : mark) === c ? "border-[var(--c-acc)]" : "border-[var(--c-ln)]")} style={{ background: c, width: 26, height: 26, minWidth: 26, minHeight: 26 }} />)}
            </div>) : null}
        </div>
      )}

      {pop ? (
        <div className="fixed inset-x-0 bottom-0 z-[60] p-3 bg-[var(--c-surf)] border-t border-[var(--c-ln)] lg:static lg:mt-2 lg:rounded-[20px] lg:border rounded-t-[20px]" data-testid="pdfedit-pop">
          <input autoFocus dir="auto" value={pop.draft.text} onChange={(e) => setDraft({ text: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") donePop(); }}
            placeholder={tr("Type the text")} className={K.inp + " !border-[var(--c-acc)]"} data-testid="pdfedit-input" />
          <div className="flex items-center gap-2 mt-2 text-[12.5px] text-[var(--c-ink)]">
            <button onClick={() => setDraft({ size: Math.max(0.006, pop.draft.size * 0.9) })} className="min-w-[44px] min-h-[44px] rounded-[12px] border border-[var(--c-ln)] font-bold" aria-label={tr("Smaller")}>A−</button>
            <button onClick={() => setDraft({ size: Math.min(0.08, pop.draft.size * 1.1) })} className="min-w-[44px] min-h-[44px] rounded-[12px] border border-[var(--c-ln)] font-bold" aria-label={tr("Bigger")}>A+</button>
            <button onClick={() => setDraft({ bold: !pop.draft.bold })} className={"min-w-[44px] min-h-[44px] rounded-[12px] border font-bold " + (pop.draft.bold ? "bg-[var(--c-soft)] border-[var(--c-acc)] text-[var(--c-acc)]" : "border-[var(--c-ln)]")}>B</button>
            {["#000000", "#1e3a8a", "#b91c1c"].map((c) => <button key={c} onClick={() => setDraft({ color: c })} aria-label={c} className={"shrink-0 p-0 rounded-full border-2 " + (pop.draft.color === c ? "border-[var(--c-acc)]" : "border-[var(--c-ln)]")} style={{ background: c, width: 22, height: 22, minWidth: 22, minHeight: 22 }} />)}
            <span className="flex-1" />
            {pop.old || pop.draft.kind === "retext" ? <button onClick={dropPop} className="min-h-[44px] text-[var(--c-neg)] font-bold px-1" data-testid="pdfedit-pop-undo">{tr(pop.old ? "Remove" : "Cancel")}</button> : null}
            <button onClick={donePop} className={K.btnP} data-testid="pdfedit-done">{tr("Done")}</button>
          </div>
        </div>
      ) : (
        <div className="sticky bottom-0 z-10 bg-[var(--c-bg)] border-t border-[var(--c-ln)] flex justify-around py-2.5 mt-1" data-testid="pdfedit-tools">
          {TOOLS.map(([k, label]) => <button key={k} onClick={() => { setTool(k); setPicked(null); }} className={"min-h-[40px] px-3.5 rounded-full text-[13.5px] font-bold " + (tool === k ? "bg-[var(--c-soft)] text-[var(--c-acc)] font-extrabold" : "text-[var(--c-mut)]")} data-testid={"pdfedit-tool-" + k}>{tr(label)}</button>)}
        </div>
      )}

      {pad ? <SignPad onCancel={() => setPad(false)} onUse={(s) => { setSign(s); try { localStorage.setItem(SIGN_KEY, JSON.stringify(s)); } catch (e) {} setPad(false); flash && flash(tr("Signature kept on this device")); }} /> : null}
    </div>
  );
}

// make a signature once with a finger; it is kept on this device (trimmed to the ink, transparent background)
function SignPad({ onCancel, onUse }) {
  const cv = useRef(null), last = useRef(null), [any, setAny] = useState(false);
  useEffect(() => { const c = cv.current; const r = c.getBoundingClientRect(); c.width = Math.round(r.width * 2); c.height = Math.round(r.height * 2); }, []);
  const at = (ev) => { const r = cv.current.getBoundingClientRect(); return [(ev.clientX - r.left) * 2, (ev.clientY - r.top) * 2]; };
  const draw = (ev) => {
    if (!last.current) return;
    const g = cv.current.getContext("2d"), p = at(ev);
    g.strokeStyle = "#1e3a8a"; g.lineWidth = 5; g.lineCap = "round"; g.lineJoin = "round";
    g.beginPath(); g.moveTo(last.current[0], last.current[1]); g.lineTo(p[0], p[1]); g.stroke(); last.current = p; setAny(true);
  };
  const use = () => {
    const c = cv.current, g = c.getContext("2d"), d = g.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
    for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2) if (d[(y * c.width + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 <= x0 || y1 <= y0) return;
    const m = 8; x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(c.width, x1 + m); y1 = Math.min(c.height, y1 + m);
    const o = document.createElement("canvas"); o.width = x1 - x0; o.height = y1 - y0;
    o.getContext("2d").drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
    onUse({ png: o.toDataURL("image/png").split(",")[1], ratio: o.height / o.width });
  };
  return (
    <div className="calm fixed inset-0 z-[70] bg-black/60! flex items-end sm:items-center justify-center p-3" data-testid="pdfedit-signpad">
      <div className="w-full max-w-md rounded-[20px] bg-[var(--c-surf)] border border-[var(--c-ln)] p-4">
        <p className="text-[16px] font-extrabold text-[var(--c-ink)] mb-2">{tr("Sign with your finger")}</p>
        <canvas ref={cv} className="w-full h-44 rounded-[20px] bg-white" style={{ touchAction: "none" }} data-testid="pdfedit-signcanvas"
          onPointerDown={(ev) => { last.current = at(ev); try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch (e) {} }} onPointerMove={draw} onPointerUp={() => { last.current = null; }} />
        <p className="text-[11.5px] text-[var(--c-mut)] mt-1.5">{tr("Kept only on this device, for the next time you sign.")}</p>
        <div className="flex justify-end gap-2 mt-3">
          <button onClick={() => { const c = cv.current; c.getContext("2d").clearRect(0, 0, c.width, c.height); setAny(false); }} className="min-h-[44px] px-3 rounded-[12px] font-bold text-[var(--c-ink)] text-sm">{tr("Clear")}</button>
          <button onClick={onCancel} className={K.btnS}>{tr("Cancel")}</button>
          <button onClick={use} disabled={!any} className={"min-h-[44px] px-4 rounded-[12px] text-sm font-extrabold " + (any ? "bg-[var(--c-acc)] text-[var(--c-on-acc)]" : "bg-[var(--c-surf-2)] text-[var(--c-mut)]")} data-testid="pdfedit-sign-use">{tr("Use this signature")}</button>
        </div>
      </div>
    </div>
  );
}
