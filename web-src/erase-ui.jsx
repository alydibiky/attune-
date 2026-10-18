/* ---- v6.38 (batch 4) Studio eraser: paint over a person or a thing with your finger → "Remove" → it is gone. The painting is
   a mask (white = remove) at the picture's own proportions; the phone fills it with MI-GAN (Eraser.kt), offline, ~1 s.
   Works on a Studio picture (file) or any photo from the gallery (photo). Undo / clear / brush size; repeat as often as needed. */
import React, { useEffect, useRef, useState } from "react";
import { Eraser, Undo2, X, Loader2 } from "lucide-react";
import { tr } from "./i18n.js";

const MASK_MAX = 2048;   // the mask's longest side (the phone stretches it to the photo)

export function EraseSheet({ src, file, photo, nativeCall, onDone, onClose, flash }) {
  const view = useRef(null), mask = useRef(null), strokes = useRef([]), cur = useRef(null);
  const [nat, setNat] = useState(null);           // { w, h } of the mask
  const [size, setSize] = useState(5);            // brush, % of the picture's width
  const [n, setN] = useState(0), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  useEffect(() => { const im = new Image(); im.onload = () => { const k = Math.min(1, MASK_MAX / Math.max(im.naturalWidth, im.naturalHeight)); setNat({ w: Math.round(im.naturalWidth * k), h: Math.round(im.naturalHeight * k) }); }; im.onerror = () => setErr(tr("Could not open that picture")); im.src = src; }, [src]);
  const redraw = () => {
    const m = mask.current, v = view.current; if (!m || !v || !nat) return;
    const mc = m.getContext("2d"), vc = v.getContext("2d");
    mc.clearRect(0, 0, m.width, m.height); vc.clearRect(0, 0, v.width, v.height);
    for (const s of strokes.current.concat(cur.current ? [cur.current] : [])) {
      for (const [ctx, color, k] of [[mc, "#fff", 1], [vc, "rgba(244,63,94,0.55)", v.width / m.width]]) {
        ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = s.r * 2 * k;
        ctx.beginPath(); s.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * k, y * k) : ctx.moveTo(x * k, y * k)));
        if (s.pts.length === 1) { ctx.arc(s.pts[0][0] * k, s.pts[0][1] * k, s.r * k, 0, 7); ctx.fill(); } else ctx.stroke();
      }
    }
  };
  useEffect(() => {
    if (!nat || !view.current) return;
    const v = view.current, r = v.getBoundingClientRect();
    v.width = Math.round(r.width * (window.devicePixelRatio || 1)); v.height = Math.round(v.width * nat.h / nat.w);
    mask.current = Object.assign(document.createElement("canvas"), { width: nat.w, height: nat.h });
    redraw();
  }, [nat]);
  const at = (e) => { const r = view.current.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * nat.w, ((e.clientY - r.top) / r.height) * nat.h]; };
  const down = (e) => { if (!nat || busy) return; e.preventDefault(); try { view.current.setPointerCapture(e.pointerId); } catch (x) {} cur.current = { r: (size / 100) * nat.w / 2, pts: [at(e)] }; redraw(); };
  const move = (e) => { if (!cur.current) return; e.preventDefault(); cur.current.pts.push(at(e)); redraw(); };
  const up = () => { if (!cur.current) return; strokes.current.push(cur.current); cur.current = null; setN(strokes.current.length); redraw(); };
  const undo = () => { strokes.current.pop(); setN(strokes.current.length); redraw(); };
  const clear = () => { strokes.current = []; setN(0); redraw(); };
  const go = async () => {
    if (!strokes.current.length) return setErr(tr("Paint over what to remove first."));
    setErr(""); setBusy(true);
    try {
      // a little wider than painted, so the edge of a person goes too
      const m = mask.current, g = m.getContext("2d");
      const saved = strokes.current.map((s) => ({ ...s, r: s.r * 1.15 + Math.max(2, nat.w / 300) })), keep = strokes.current;
      strokes.current = saved; redraw(); const data = m.toDataURL("image/png"); strokes.current = keep; redraw();
      const r = await nativeCall("eraseImage", file ? { file, mask: data } : { photo, mask: data });
      onDone(r);
    } catch (e) { setErr(tr(String((e && e.message) || e))); }
    setBusy(false);
  };
  return (
    <div className="fixed inset-0 z-[70] bg-black/90 flex flex-col" data-testid="erase-sheet">
      <div className="flex items-center justify-between px-3 py-2 text-slate-200">
        <span className="text-[14px] font-semibold flex items-center gap-1.5"><Eraser size={16} />{tr("Erase")}</span>
        <button onClick={onClose} aria-label={tr("Close")} className="p-2" data-testid="erase-close"><X size={18} /></button>
      </div>
      <p className="px-3 text-[12px] text-slate-400">{tr("Paint over the person or thing to remove, then tap Remove.")}</p>
      <div className="flex-1 min-h-0 flex items-center justify-center p-3">
        <div className="relative w-full max-w-3xl" style={nat ? { aspectRatio: nat.w + " / " + nat.h, maxHeight: "100%" } : {}}>
          <img src={src} alt="" className="absolute inset-0 w-full h-full object-contain select-none" draggable={false} />
          <canvas ref={view} className="absolute inset-0 w-full h-full" style={{ touchAction: "none" }} data-testid="erase-canvas"
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} />
          {busy ? <div className="absolute inset-0 flex items-center justify-center bg-black/40"><Loader2 size={28} className="animate-spin text-white" /></div> : null}
        </div>
      </div>
      <div className="px-3 pb-4 space-y-2">
        <label className="flex items-center gap-2 text-[12px] text-slate-300">{tr("Brush")}
          <input type="range" min="2" max="15" value={size} onChange={(e) => setSize(+e.target.value)} className="flex-1" data-testid="erase-size" /></label>
        {err ? <p className="text-[12px] text-rose-300" data-testid="erase-err">{err}</p> : null}
        <div className="flex gap-2">
          <button onClick={undo} disabled={!n || busy} className="px-3 py-2.5 rounded-xl border border-slate-700 text-slate-200 disabled:opacity-40" aria-label={tr("Undo")} data-testid="erase-undo"><Undo2 size={16} /></button>
          <button onClick={clear} disabled={!n || busy} className="px-3 py-2.5 rounded-xl border border-slate-700 text-slate-200 text-[13px] disabled:opacity-40">{tr("Clear all")}</button>
          <button onClick={go} disabled={busy || !nat} className="flex-1 py-2.5 rounded-xl bg-violet-500 text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2" data-testid="erase-go">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Eraser size={15} />}{busy ? tr("Removing…") : tr("Remove")}</button>
        </div>
      </div>
    </div>);
}
