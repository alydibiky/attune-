/* ---- v6.43 (Ali: "I want the image part to be exactly like my Honor phone") — the photo editor, laid out like the Honor Gallery:
   the photo full screen, the AI tools in a row at the bottom, Undo · hold to compare · Save on top.
   - AI Eraser: tap a person or a thing (the phone outlines it) — or brush over anything — then Erase (MI-GAN, Eraser.kt).
   - Passers-by: everyone and everything except the main subject, shown in red; one tap removes them.
   - Cut out: the subject lifted off its background (a PNG with a clear background), saved to Studio.
   - Enhance: sharper and 4× bigger (Real-ESRGAN, the Studio pack).
   - Change (when a picture model is installed): brush a part, say what it should become.
   The shapes come from findSubjects (PhotoSmart.kt, ML Kit subject segmentation on the phone). Each step is a new picture in
   Studio; Undo steps back. v6.45: Expand — a bigger canvas, the new edges filled by the eraser model (expandBox).
   Pure helpers: photoedit.js (tests/unit/v743photoedit.test.mjs). */
import React, { useEffect, useRef, useState } from "react";
import { Eraser, Users, Scissors, Sparkles, Wand2, Undo2, X, Eye, Check, Loader2, PenLine, Maximize2 } from "lucide-react";
import { tr } from "./i18n.js";
import { isRemoval } from "./erase-ui.jsx";
import { mainSubject, maskRect, hitSubject, findShadow, expandBox, EXPAND_SHAPES } from "./photoedit.js";

const MASK_MAX = 2048, SHADOW_GRID = 384;

const load = (u) => new Promise((ok, bad) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => ok(i); i.onerror = () => bad(new Error("Couldn't open that picture")); i.src = u; });

export function PhotoEditor({ src, file, photo, nativeCall, flash, onDone, onClose, onEditArea, saveToGallery, hd, onGetHD }) {
  const [cur, setCur] = useState({ src, file, photo });
  const [hist, setHist] = useState([]);
  const orig = useRef(src);
  const [tool, setTool] = useState("erase");
  const [nat, setNat] = useState(null);                 // the mask's size (the picture's proportions)
  const [subj, setSubj] = useState(null);               // { w, h, list, main } | { error }
  const [finding, setFinding] = useState(false);
  const [sel, setSel] = useState([]);                   // chosen subjects
  const [brush, setBrush] = useState(false), [size, setSize] = useState(5);
  const strokes = useRef([]), cur0 = useRef(null), [nStrokes, setN] = useState(0);
  const [busy, setBusy] = useState(""), [err, setErr] = useState(""), [note, setNote] = useState("");
  const [compare, setCompare] = useState(false);
  const [cut, setCut] = useState(null);                 // a cut-out (PNG data URL) waiting to be saved
  const [what, setWhat] = useState("");
  const view = useRef(null);
  // v6.44: a subject's shadow is erased with it (like the Honor gallery) — found on a small grid of the photo, once per subject
  const [shade, setShade] = useState(true);
  const shadows = useRef({});                           // subject index → a canvas of its shadow (white), or null
  const grid = useRef(null);                            // { w, h, px } the photo's pixels at SHADOW_GRID

  // a new picture: its size, and what is in it
  useEffect(() => {
    let off = false;
    setSel([]); strokes.current = []; setN(0); setCut(null); setSubj(null); setErr("");
    load(cur.src).then((im) => { if (off) return; const k = Math.min(1, MASK_MAX / Math.max(im.naturalWidth, im.naturalHeight)); setNat({ w: Math.round(im.naturalWidth * k), h: Math.round(im.naturalHeight * k), W: im.naturalWidth, H: im.naturalHeight }); }).catch((e) => setErr(tr(e.message)));
    if (nativeCall) {
      setFinding(true);
      nativeCall("findSubjects", cur.file ? { file: cur.file } : { photo: cur.photo || cur.src })
        .then(async (r) => {
          const list = await Promise.all((r.subjects || []).map(async (s) => {
            const im = await load(s.mask);
            const c = Object.assign(document.createElement("canvas"), { width: s.w, height: s.h }); const g = c.getContext("2d"); g.drawImage(im, 0, 0);
            return { ...s, img: im, data: g.getImageData(0, 0, s.w, s.h).data };
          }));
          if (off) return;
          shadows.current = {}; grid.current = null;
          try { const im = await load(cur.src), k = Math.min(1, SHADOW_GRID / Math.max(r.w, r.h)), gw = Math.max(1, Math.round(r.w * k)), gh = Math.max(1, Math.round(r.h * k));
            const c = Object.assign(document.createElement("canvas"), { width: gw, height: gh }), g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(im, 0, 0, gw, gh);
            grid.current = { w: gw, h: gh, k, px: g.getImageData(0, 0, gw, gh).data }; } catch (e) {}
          if (!off) setSubj({ w: r.w, h: r.h, list, main: mainSubject(list, r.w, r.h) });
        })
        .catch((e) => { if (!off) setSubj({ error: String((e && e.message) || e), list: [] }); })
        .finally(() => { if (!off) setFinding(false); });
    }
    return () => { off = true; };
  }, [cur.src]);

  // the shadow of subject i (a canvas the size of the grid), found the first time it is asked for
  const shadowOf = (i) => {
    if (i in shadows.current) return shadows.current[i];
    let out = null;
    try {
      const G = grid.current, sb = subj && subj.list && subj.list[i];
      if (G && sb) {
        const m = Object.assign(document.createElement("canvas"), { width: G.w, height: G.h }), mg = m.getContext("2d", { willReadFrequently: true });
        mg.drawImage(sb.img, ...maskRect(sb, G.k));
        const a = mg.getImageData(0, 0, G.w, G.h).data, sj = new Uint8Array(G.w * G.h);
        for (let j = 0; j < sj.length; j++) sj[j] = a[j * 4 + 3] >= 128 ? 1 : 0;
        const r = findShadow({ px: G.px, W: G.w, H: G.h, subj: sj, box: maskRect(sb, G.k) });
        if (r) { const im = mg.createImageData(G.w, G.h); for (let j = 0; j < r.mask.length; j++) if (r.mask[j]) { im.data[j * 4] = im.data[j * 4 + 1] = im.data[j * 4 + 2] = im.data[j * 4 + 3] = 255; }
          mg.clearRect(0, 0, G.w, G.h); mg.putImageData(im, 0, 0); out = m; }
      }
    } catch (e) { out = null; }
    shadows.current[i] = out; return out;
  };
  const others = subj && subj.list ? subj.list.map((_, i) => i).filter((i) => i !== subj.main) : [];
  // what is drawn over the photo: the chosen shapes (blue), the passers-by (red), the brush (pink)
  const redraw = () => {
    const v = view.current; if (!v || !nat) return;
    const r = v.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    if (v.width !== Math.round(r.width * dpr)) { v.width = Math.round(r.width * dpr); v.height = Math.round(r.height * dpr); }
    const g = v.getContext("2d"); g.clearRect(0, 0, v.width, v.height);
    if (compare) return;
    const tint = (i, col) => {
      const s = subj.list[i], k = v.width / subj.w, [x, y, w, h] = maskRect(s, k);
      const t = Object.assign(document.createElement("canvas"), { width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)) }), tg = t.getContext("2d");
      tg.drawImage(s.img, 0, 0, t.width, t.height); tg.globalCompositeOperation = "source-in"; tg.fillStyle = col; tg.fillRect(0, 0, t.width, t.height);
      g.save(); g.shadowColor = "#fff"; g.shadowBlur = 6 * dpr; g.drawImage(t, x, y); g.restore();
    };
    const tintShadow = (i, col) => { const c = shadowOf(i); if (!c) return; const t = Object.assign(document.createElement("canvas"), { width: v.width, height: v.height }), tg = t.getContext("2d");
      tg.imageSmoothingEnabled = true; tg.drawImage(c, 0, 0, v.width, v.height); tg.globalCompositeOperation = "source-in"; tg.fillStyle = col; tg.fillRect(0, 0, v.width, v.height); g.drawImage(t, 0, 0); };
    if (subj && subj.list) {
      if (tool === "people") others.forEach((i) => { tint(i, "rgba(244,63,94,0.5)"); if (shade) tintShadow(i, "rgba(244,63,94,0.3)"); });
      else if (tool === "erase" || tool === "cutout") sel.forEach((i) => { tint(i, "rgba(59,130,246,0.5)"); if (tool === "erase" && shade) tintShadow(i, "rgba(56,189,248,0.32)"); });
    }
    const kk = v.width / nat.w;
    for (const s of strokes.current.concat(cur0.current ? [cur0.current] : [])) {
      g.strokeStyle = g.fillStyle = "rgba(244,63,94,0.55)"; g.lineCap = g.lineJoin = "round"; g.lineWidth = s.r * 2 * kk;
      g.beginPath(); s.pts.forEach(([x, y], i) => (i ? g.lineTo(x * kk, y * kk) : g.moveTo(x * kk, y * kk)));
      if (s.pts.length === 1) { g.arc(s.pts[0][0] * kk, s.pts[0][1] * kk, s.r * kk, 0, 7); g.fill(); } else g.stroke();
    }
  };
  useEffect(redraw, [subj, sel, tool, nat, compare, nStrokes, shade]);
  useEffect(() => { const f = () => redraw(); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); });

  const at = (e) => { const r = view.current.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
  const painting = brush || tool === "change";
  const down = (e) => {
    if (!nat || busy) return;
    const [fx, fy] = at(e);
    if (painting) { e.preventDefault(); try { view.current.setPointerCapture(e.pointerId); } catch (x) {} cur0.current = { r: (size / 100) * nat.w / 2, pts: [[fx * nat.w, fy * nat.h]] }; redraw(); return; }
    if (!subj || !subj.list || !(tool === "erase" || tool === "cutout")) return;
    const i = hitSubject(subj.list, fx * subj.w, fy * subj.h, (j, x, y) => subj.list[j].data[(y * subj.list[j].w + x) * 4 + 3]);
    if (i < 0) { setNote(tr("Nothing found there — use the brush to paint over it")); return; }
    setNote("");
    setSel((s) => (tool === "cutout" ? [i] : s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));
  };
  const move = (e) => { if (!cur0.current) return; e.preventDefault(); const [fx, fy] = at(e); cur0.current.pts.push([fx * nat.w, fy * nat.h]); redraw(); };
  const up = () => { if (!cur0.current) return; strokes.current.push(cur0.current); cur0.current = null; setN(strokes.current.length); };

  // the mask for the eraser: the chosen shapes + the brush, white on clear, at the picture's proportions
  const maskOf = (idx) => {
    const m = Object.assign(document.createElement("canvas"), { width: nat.w, height: nat.h }), g = m.getContext("2d");
    if (subj && subj.list) { const k = nat.w / subj.w; for (const i of idx) { const s = subj.list[i]; g.drawImage(s.img, ...maskRect(s, k)); const sh = shade && shadowOf(i); if (sh) g.drawImage(sh, 0, 0, nat.w, nat.h); } }
    g.strokeStyle = g.fillStyle = "#fff"; g.lineCap = g.lineJoin = "round";
    for (const s of strokes.current) { g.lineWidth = s.r * 2 * 1.15; g.beginPath(); s.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); if (s.pts.length === 1) { g.arc(s.pts[0][0], s.pts[0][1], s.r, 0, 7); g.fill(); } else g.stroke(); }
    return m.toDataURL("image/png");
  };
  const step = (r) => { setHist((h) => [...h, cur]); setCur({ src: r.url, file: r.file }); onDone && onDone(r); };
  const run = async (label, fn) => { setErr(""); setNote(""); setBusy(label); try { await fn(); } catch (e) { setErr(tr(String((e && e.message) || e))); } setBusy(""); };
  const [getting, setGetting] = useState(false);
  const getHD = async () => { setGetting(true); try { await onGetHD(); } finally { setGetting(false); } };
  const erase = (idx) => run(tr("Removing…"), async () => {
    if (!idx.length && !strokes.current.length) throw new Error(tr("Tap what to remove, or brush over it"));
    // v6.43: Eraser HD (LaMa) when it is on the phone — the phone gallery's quality of fill
    const r = await nativeCall("eraseImage", { ...(cur.file ? { file: cur.file } : { photo: cur.photo || cur.src }), mask: maskOf(idx), hd: !!hd });
    step(r); flash && flash(tr("Removed in {s} s", { s: Math.max(1, Math.round((r.ms || 0) / 1000)) }));
  });
  const doCut = () => run(tr("Cutting out…"), async () => {
    const i = sel.length ? sel[0] : subj && subj.main;
    if (i == null || i < 0 || !subj || !subj.list || !subj.list[i]) throw new Error(tr("Tap the subject to cut out"));
    const im = await load(cur.src), s = subj.list[i], K = im.naturalWidth / subj.w;
    const [x, y, w, h] = maskRect(s, K).map(Math.round);
    const c = Object.assign(document.createElement("canvas"), { width: Math.max(1, w), height: Math.max(1, h) }), g = c.getContext("2d");
    g.drawImage(im, x, y, w, h, 0, 0, w, h); g.globalCompositeOperation = "destination-in"; g.drawImage(s.img, 0, 0, w, h);
    setCut(c.toDataURL("image/png"));
  });
  const saveCut = () => run(tr("Saving…"), async () => { const r = await nativeCall("savePicture", { b64: cut }); onDone && onDone({ ...r, cutout: true }); setCut(null); flash && flash(tr("Cut-out saved to Studio")); });
  const enhance = () => run(tr("Sharpening… this takes a while"), async () => {
    let f = cur.file;
    if (!f) { const r0 = await nativeCall("savePicture", { b64: cur.photo || cur.src }); f = r0.file; }
    const r = await nativeCall("upscaleImage", { file: f });
    step(r);
  });
  const change = () => run(tr("Changing it…"), async () => {
    if (!strokes.current.length) throw new Error(tr("Paint over the part to change first."));
    if (!onEditArea || isRemoval(what)) return erase([]);
    await onEditArea({ mask: maskOf([]), prompt: what.trim(), src: cur.src });
  });
  // v6.45 Expand: the photo centred on a bigger canvas (its own edges stretched and blurred underneath as a start), the
  // new border is the "hole" — the eraser fills it the way it fills a removed person (a few pixels into the photo, to blend).
  const [shape, setShape] = useState("all");
  const expand = () => run(tr("Making it bigger…"), async () => {
    const im = await load(cur.src), w = im.naturalWidth, h = im.naturalHeight, b = expandBox(w, h, shape);
    if (b.same) throw new Error(tr("The photo already has that shape"));
    const c = Object.assign(document.createElement("canvas"), { width: b.W, height: b.H }), g = c.getContext("2d");
    g.filter = "blur(24px)"; g.drawImage(im, 0, 0, b.W, b.H); g.filter = "none"; g.drawImage(im, b.x, b.y, w, h);
    const m = Object.assign(document.createElement("canvas"), { width: b.W, height: b.H }), k = m.getContext("2d");
    const o = Math.max(3, Math.round(Math.max(w, h) * 0.006));
    k.fillStyle = "#fff"; k.fillRect(0, 0, b.W, b.H); k.clearRect(b.x + o, b.y + o, w - 2 * o, h - 2 * o);
    const r = await nativeCall("eraseImage", { photo: c.toDataURL("image/jpeg", 0.95), mask: m.toDataURL("image/png"), hd: !!hd });
    step(r); flash && flash(tr("Expanded to {w} × {h}", { w: b.W, h: b.H }));
  });
  const undo = () => { if (!hist.length) return; setCur(hist[hist.length - 1]); setHist((h) => h.slice(0, -1)); };
  const save = async () => {
    if (saveToGallery && cur.file) { try { const r = saveToGallery(cur.file); flash && flash(r ? tr("Saved to the phone's gallery") : tr("Saved in Studio")); } catch (e) { flash && flash(tr("Saved in Studio")); } }
    onClose();
  };

  const TOOLS = [["erase", Eraser, "AI Eraser"], ["people", Users, "Passers-by"], ["cutout", Scissors, "Cut out"], ["enhance", Sparkles, "Enhance"], ["expand", Maximize2, "Expand"], ...(onEditArea ? [["change", Wand2, "Change"]] : [])];
  const hint = finding ? tr("Finding the people and things in the photo…") : subj && subj.error ? tr("Brush over what to remove.") + " (" + tr(subj.error) + ")"
    : tool === "erase" ? (brush ? tr("Brush over what to remove") : tr("Tap a person or a thing — or use the brush")) : tool === "people" ? (others.length ? tr("{n} found besides the main subject", { n: others.length }) : tr("No passers-by found"))
    : tool === "cutout" ? tr("Tap the subject to lift it off the background") : tool === "enhance" ? tr("Sharper and 4× bigger") : tool === "expand" ? tr("A bigger picture — the AI draws the missing edges") : tr("Brush the part, then say what it should become");
  return (
    <div className="calm fixed inset-0 z-[70] bg-black! flex flex-col text-white!" data-testid="photo-editor">
      <div className="flex items-center gap-1 px-2 pt-[max(8px,env(safe-area-inset-top))] pb-1">
        <button onClick={onClose} className="w-11 h-11 grid place-items-center" aria-label={tr("Close")} data-testid="pe-close"><X size={22} /></button>
        <span className="flex-1" />
        <button onClick={undo} disabled={!hist.length || !!busy} className="w-11 h-11 grid place-items-center disabled:opacity-30" aria-label={tr("Undo")} data-testid="pe-undo"><Undo2 size={21} /></button>
        <button onPointerDown={() => setCompare(true)} onPointerUp={() => setCompare(false)} onPointerLeave={() => setCompare(false)} disabled={!hist.length} className="w-11 h-11 grid place-items-center disabled:opacity-30" aria-label={tr("Hold to compare")} data-testid="pe-compare"><Eye size={21} /></button>
        <button onClick={save} disabled={!!busy} className="h-10 px-4 rounded-full bg-white text-black text-[14px] font-bold flex items-center gap-1" data-testid="pe-save"><Check size={17} />{tr("Save")}</button>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center px-2">
        {cut ? (
          <div className="max-w-full max-h-full p-2 rounded-xl" style={{ background: "repeating-conic-gradient(#3a3a3a 0% 25%, #2a2a2a 0% 50%) 50% / 20px 20px" }} data-testid="pe-cut">
            <img src={cut} alt="" className="max-h-[60vh] max-w-full object-contain" /></div>
        ) : (
          <div className="relative w-full max-w-3xl" style={nat ? { aspectRatio: nat.w + " / " + nat.h, maxHeight: "100%" } : {}}>
            <img src={compare ? orig.current : cur.src} alt="" className="absolute inset-0 w-full h-full object-contain select-none" draggable={false} data-testid="pe-img" />
            <canvas ref={view} className="absolute inset-0 w-full h-full" style={{ touchAction: "none" }} data-testid="pe-canvas"
              onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} />
            {busy || finding ? <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/35 pointer-events-none"><Loader2 size={30} className="animate-spin" /><span className="text-[13px]">{busy || tr("Looking…")}</span></div> : null}
          </div>)}
      </div>
      <div className="px-4 pt-2 text-center text-[13px] text-white/80 min-h-[22px]" data-testid="pe-hint">{note || hint}</div>
      {err ? <p className="px-4 text-center text-[12.5px] text-rose-300" data-testid="pe-err">{err}</p> : null}
      {(tool === "erase" || tool === "people") && !hd && onGetHD ? (
        <div className="px-4 pt-1 flex justify-center">
          <button onClick={getHD} disabled={getting || !!busy} className="h-8 px-3 rounded-full bg-white/10 text-[12.5px] disabled:opacity-40" data-testid="pe-get-hd">{getting ? tr("Downloading Eraser HD…") : tr("Best-quality fill — download Eraser HD (208 MB, once)")}</button>
        </div>) : hd && (tool === "erase" || tool === "people") ? <div className="px-4 text-center text-[11.5px] text-emerald-300" data-testid="pe-hd-on">{tr("Eraser HD is on")}</div> : null}
      {subj && subj.list && ((tool === "erase" && sel.some((i) => shadowOf(i))) || (tool === "people" && others.some((i) => shadowOf(i)))) ? (
        <div className="px-4 pt-1 flex justify-center">
          <button onClick={() => setShade((v) => !v)} aria-pressed={shade} className={"h-8 px-3 rounded-full text-[12.5px] " + (shade ? "bg-[var(--c-acc)]/25 text-[var(--c-acc)]" : "bg-white/10 text-white/70")} data-testid="pe-shadow">{shade ? "✓ " : ""}{tr("Its shadow too")}</button>
        </div>) : null}
      <div className="px-4 py-3 flex items-center justify-center gap-2 min-h-[64px]">
        {tool === "erase" ? <>
          <button onClick={() => setBrush((b) => !b)} className={"h-11 px-4 rounded-full flex items-center gap-1.5 text-[14px] " + (brush ? "bg-white text-black font-bold" : "bg-white/10")} data-testid="pe-brush"><PenLine size={16} />{tr("Brush")}</button>
          <button onClick={() => erase(sel)} disabled={!!busy || (!sel.length && !nStrokes)} className="h-11 px-6 rounded-full bg-[var(--c-acc)] text-[var(--c-on-acc)] font-bold disabled:opacity-40" data-testid="pe-erase">{tr("Erase")}{sel.length ? " (" + sel.length + ")" : ""}</button></>
        : tool === "people" ? <button onClick={() => erase(others)} disabled={!!busy || !others.length} className="h-11 px-6 rounded-full bg-rose-500 text-white font-bold disabled:opacity-40" data-testid="pe-people">{tr("Remove {n}", { n: others.length })}</button>
        : tool === "cutout" ? (cut ? <><button onClick={() => setCut(null)} className="h-11 px-4 rounded-full bg-white/10">{tr("Back")}</button><button onClick={saveCut} disabled={!!busy} className="h-11 px-6 rounded-full bg-[var(--c-acc)] text-[var(--c-on-acc)] font-bold" data-testid="pe-cut-save">{tr("Save cut-out")}</button></>
          : <button onClick={doCut} disabled={!!busy || !subj || !subj.list || !subj.list.length} className="h-11 px-6 rounded-full bg-[var(--c-acc)] text-[var(--c-on-acc)] font-bold disabled:opacity-40" data-testid="pe-cut-go">{tr("Cut out")}</button>)
        : tool === "expand" ? <div className="w-full max-w-md space-y-2"><div className="flex gap-1.5 overflow-x-auto justify-center" data-testid="pe-shapes">{EXPAND_SHAPES.map((s) =>
            <button key={s} onClick={() => setShape(s)} aria-pressed={shape === s} className={"h-8 px-3 rounded-full text-[12.5px] shrink-0 " + (shape === s ? "bg-white text-black font-bold" : "bg-white/10")} data-testid={"pe-shape-" + s.replace(":", "x")}>{s === "all" ? tr("All round") : s === "wide" ? tr("Wider") : s === "tall" ? tr("Taller") : s}</button>)}</div>
            <div className="flex justify-center"><button onClick={expand} disabled={!!busy} className="h-11 px-6 rounded-full bg-[var(--c-acc)] text-[var(--c-on-acc)] font-bold disabled:opacity-40" data-testid="pe-expand">{tr("Expand")}</button></div></div>
        : tool === "enhance" ? <button onClick={enhance} disabled={!!busy} className="h-11 px-6 rounded-full bg-[var(--c-acc)] text-[var(--c-on-acc)] font-bold disabled:opacity-40" data-testid="pe-enhance">{tr("Enhance")}</button>
        : <div className="w-full max-w-md flex gap-2"><input value={what} onChange={(e) => setWhat(e.target.value)} dir="auto" placeholder={tr("e.g. a sunset sky")} className="flex-1 min-w-0 h-11 rounded-full bg-white/10 px-4 text-[14px]" data-testid="pe-what" />
            <button onClick={change} disabled={!!busy || !nStrokes} className="h-11 px-5 rounded-full bg-[var(--c-acc)] text-[var(--c-on-acc)] font-bold disabled:opacity-40" data-testid="pe-change">{tr("Change")}</button></div>}
      </div>
      {painting ? <label className="px-6 pb-1 flex items-center gap-2 text-[12px] text-white/70">{tr("Brush")}<input type="range" min="2" max="15" value={size} onChange={(e) => setSize(+e.target.value)} className="flex-1" /></label> : null}
      <div className="flex justify-around border-t border-white/10 pb-[max(10px,env(safe-area-inset-bottom))] pt-2" role="tablist" data-testid="pe-tools">
        {TOOLS.map(([k, I, label]) => (
          <button key={k} role="tab" aria-selected={tool === k} onClick={() => { setTool(k); setCut(null); setNote(""); if (k !== "erase") setBrush(false); if (k === "cutout" && subj && subj.main >= 0) setSel([subj.main]); else if (k !== "erase") setSel([]); }}
            className={"flex flex-col items-center gap-1 px-2 min-w-[64px] text-[11.5px] " + (tool === k ? "text-[var(--c-acc)] font-bold" : "text-white/75")} data-testid={"pe-tool-" + k}><I size={22} />{tr(label)}</button>))}
      </div>
    </div>);
}
