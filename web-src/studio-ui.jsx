/* ---- Studio: create and edit pictures on the phone (More → Studio) -------------------
   The picture engine and its models are described in studio.js / ImageEngine.kt. */
import React, { useState, useEffect, useRef } from "react";
import { Palette, ImageIcon, Download, Share2, Maximize2, Wand2, RefreshCw, Trash2, Square, Loader2, AlertTriangle, ImagePlus, Sparkles, X } from "lucide-react";
import { tr } from "./i18n.js";
import { PACKS, SIZES, enhanceMessages, cleanPrompt, packReady, drawPack, loadStudio, saveStudio } from "./studio.js";

const STAGE = {
  gpu: "Waking the graphics chip (the first time can take a minute)…",
  start: "Starting the picture engine…", load: "Loading the picture model…", prompt: "Reading your description…",
  draw: "Drawing", develop: "Developing the picture…", save: "Saving…", upscale: "Sharpening ×4",
};

/** A picture (URL or data URL), shrunk to at most 1024 px in multiples of 16, as a PNG data URL. */
function shrink(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onerror = () => rej(new Error("That file is not a photo"));
    im.onload = () => {
      const k = Math.min(1, 1024 / Math.max(im.width, im.height));
      const c = document.createElement("canvas");
      c.width = Math.max(16, Math.round(im.width * k / 16) * 16); c.height = Math.max(16, Math.round(im.height * k / 16) * 16);
      c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      res({ dataUrl: c.toDataURL("image/png"), w: c.width, h: c.height });
    };
    im.src = src;
  });
}
/** A photo from the phone. */
function readPhoto(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onerror = () => rej(new Error("Could not read that photo"));
    r.onload = () => shrink(r.result).then(res, rej);
    r.readAsDataURL(file);
  });
}
const secs = (ms) => (ms < 60000 ? Math.round(ms / 1000) + " s" : Math.floor(ms / 60000) + " min " + Math.round((ms % 60000) / 1000) + " s");

export function StudioPage({ native, nativeCall, nativeLastId, llm, chatReady, flash, incoming, clearIncoming }) {
  const readInfo = () => { try { return JSON.parse(native.imageInfo()); } catch (e) { return null; } };
  const [info, setInfo] = useState(readInfo);
  const [mode, setMode] = useState("create");
  const [idea, setIdea] = useState("");
  const [enhance, setEnhance] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("square");
  const [ref, setRef] = useState(null);           // { dataUrl, w, h }
  const [busy, setBusy] = useState(null);         // { what, stage, step, total, t0 }
  const [now, setNow] = useState(Date.now());
  const [dl, setDl] = useState(null);             // { id, pct, stage, detail }
  const [gallery, setGallery] = useState(loadStudio);
  const [cur, setCur] = useState(() => loadStudio()[0] || null);
  const [err, setErr] = useState("");
  const callId = useRef("");
  const fileRef = useRef(null);

  useEffect(() => { if (!busy) return; const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, [busy]);
  useEffect(() => { if (incoming && incoming.prompt != null) { setIdea(incoming.prompt); setMode("create"); clearIncoming && clearIncoming(); } }, [incoming]);

  if (!info) return <div className="p-4 text-sm text-slate-400" data-testid="studio-page">{tr("Studio works in the Android app.")}</div>;
  const dp = drawPack(info);
  const drawReady = dp.ready;
  const P = PACKS[dp.id];
  const upReady = packReady(info, "esrgan-x4");
  const keep = (list) => { setGallery(list); saveStudio(list); };

  const install = async (packId) => {
    const p = PACKS[packId];
    setErr(""); setDl({ id: packId, pct: 0, stage: tr("Starting the download…"), detail: "" });
    try {
      const run = nativeCall("installImagePack", { id: p.id, label: p.label, kind: p.kind, defaults: p.defaults || {}, files: p.files },
        (pct, stage, detail) => setDl({ id: packId, pct, stage, detail }));
      callId.current = nativeLastId();
      await run;
      setInfo(readInfo()); flash(tr("{m} is ready", { m: p.label }));
      return true;
    } catch (e) { setErr(tr(e.message)); return false; }
    finally { setDl(null); }
  };

  const progress = (what) => (pct, stage, detail) => {
    const m = /^(\d+)\/(\d+)$/.exec(detail || "");
    setBusy((b) => ({ ...(b || { what, t0: Date.now() }), stage, step: m ? +m[1] : 0, total: m ? +m[2] : 0 }));
  };

  const draw = async (opts = {}) => {
    const text = (opts.idea != null ? opts.idea : idea).trim();
    if (!text) return;
    if (mode === "edit" && !ref && !opts.ref) { setErr(tr("Pick the photo to edit first.")); return; }
    setErr(""); setBusy({ what: "draw", t0: Date.now(), stage: "start" });
    try {
      // 1. A rich English description from the idea (any language), by the chat model.
      let finalPrompt = opts.prompt || (mode === "create" && enhance && chatReady ? "" : text);
      if (!finalPrompt) {
        setBusy((b) => ({ ...b, stage: "enhance" }));
        try { finalPrompt = cleanPrompt(await llm(enhanceMessages(text), { maxTokens: 220 }), text); } catch (e) { finalPrompt = text; }
      }
      setPrompt(finalPrompt);
      // 2. The picture.
      const sz = SIZES.find((s) => s.id === size) || SIZES[0];
      const r0 = opts.ref || ref;
      const arg = { pack: dp.id, prompt: finalPrompt, width: r0 ? r0.w : sz.w, height: r0 ? r0.h : sz.h, steps: 4 };
      if (opts.seed != null) arg.seed = opts.seed;
      if (mode === "edit" || opts.ref) arg.refImage = r0.dataUrl;
      const run = nativeCall("imagine", arg, progress("draw"));
      callId.current = nativeLastId();
      const r = await run;
      const item = { file: r.file, url: r.url, idea: text, prompt: finalPrompt, w: r.width, h: r.height, ms: r.ms, backend: r.backend, seed: r.seed, edit: !!arg.refImage, at: Date.now() };
      setCur(item); keep([item, ...gallery]);
      if (r.pausedChat) flash(tr("The chat model was paused to make room, and is loading again."));
      setInfo(readInfo());
    } catch (e) { if (e.message !== "Stopped") setErr(tr(e.message)); setInfo(readInfo()); }
    finally { setBusy(null); }
  };

  const sharpen = async () => {
    if (!cur) return;
    if (!upReady && !(await install("esrgan-x4"))) return;
    setErr(""); setBusy({ what: "upscale", t0: Date.now(), stage: "upscale" });
    try {
      const run = nativeCall("upscaleImage", { file: cur.file }, progress("upscale"));
      callId.current = nativeLastId();
      const r = await run;
      const item = { ...cur, file: r.file, url: r.url, w: r.width, h: r.height, ms: r.ms, backend: r.backend, upscaled: true, at: Date.now() };
      setCur(item); keep([item, ...gallery]);
    } catch (e) { if (e.message !== "Stopped") setErr(tr(e.message)); }
    finally { setBusy(null); }
  };

  const editThis = async () => {
    if (!cur) return;
    try { setRef(await shrink(cur.url)); setMode("edit"); setIdea(""); }
    catch (e) { setErr(tr("Could not open that picture")); }
  };
  const stop = () => { try { native.cancel(callId.current); } catch (e) {} };
  const remove = (it) => { try { native.deleteImage(it.file); } catch (e) {} const next = gallery.filter((x) => x.file !== it.file); keep(next); if (cur && cur.file === it.file) setCur(next[0] || null); };

  const stageText = busy ? (busy.stage === "enhance" ? tr("Writing a fuller description…")
    : busy.stage === "draw" && busy.total ? tr("Drawing — step {n} of {t}", { n: busy.step, t: busy.total })
    : busy.stage === "upscale" && busy.total ? tr("Sharpening ×4 — part {n} of {t}", { n: busy.step, t: busy.total })
    : busy.stage === "load" && busy.total ? tr("Loading the picture model… {p}%", { p: Math.round(busy.step * 100 / busy.total) })
    : tr(STAGE[busy.stage] || "Working…")) : "";
  const chip = (on) => `px-2.5 py-1 rounded-lg text-[12px] border ${on ? "bg-violet-500 border-violet-500 text-white font-medium" : "border-slate-700 text-slate-300"}`;
  const btn = "px-3 py-1.5 rounded-lg border border-slate-700 text-slate-200 text-xs flex items-center gap-1.5 disabled:opacity-40";

  return (
    <div className="space-y-3 pb-24" data-testid="studio-page">
      {!info.built ? (
        <div className="rounded-xl border border-amber-900/60 bg-amber-500/5 p-3 text-[12px] text-amber-200" data-testid="studio-no-engine">
          {tr("This APK has no picture engine yet — it comes with the next APK built on GitHub.")}</div>
      ) : null}

      {!drawReady ? (
        <div className="rounded-xl border border-violet-800/60 bg-violet-500/5 p-3" data-testid="studio-install">
          <p className="text-sm text-slate-100 font-medium flex items-center gap-1.5"><Palette size={16} className="text-violet-300" />{tr("Pictures made on your phone")}</p>
          <p className="text-[12px] text-slate-300 mt-1 leading-relaxed">{tr(P.quality)}</p>
          <p className="text-[11px] text-slate-500 mt-1">{P.label} · {P.sizeGB} {tr("GB, once")} · {tr("needs {n} GB RAM", { n: P.needRam })} · {P.license}</p>
          {info.ramGB && info.ramGB < P.needRam ? <p className="text-[11px] text-amber-300 mt-1">{tr("This phone has {n} GB — it may be too little for pictures.", { n: info.ramGB })}</p> : null}
          {dl && dl.id === dp.id ? (
            <div className="mt-2">
              <div className="flex justify-between text-[11px] text-slate-300"><span>{dl.stage}</span><span>{dl.pct}%</span></div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1"><div className="h-full bg-violet-500" style={{ width: dl.pct + "%" }} /></div>
              <div className="flex justify-between items-center mt-1"><span className="text-[11px] text-slate-500">{dl.detail}</span>
                <button onClick={stop} className="text-[11px] text-slate-400 underline">{tr("Cancel")}</button></div>
            </div>
          ) : (
            <button onClick={() => install(dp.id)} disabled={!!dl || !info.built} data-testid="studio-install-go"
              className="mt-2 px-3 py-2 rounded-lg bg-violet-500 text-white text-sm font-medium disabled:opacity-40 flex items-center gap-1.5"><Download size={14} />{tr("Install · {s} GB", { s: P.sizeGB })}</button>
          )}
          <p className="text-[11px] text-slate-500 mt-2">{tr("Download it on Wi-Fi. After that, pictures are made with no internet at all.")}</p>
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
        <div className="flex gap-1.5 mb-2">
          <button onClick={() => setMode("create")} className={chip(mode === "create")} data-testid="studio-mode-create"><Sparkles size={12} className="inline me-1" />{tr("Create")}</button>
          <button onClick={() => setMode("edit")} className={chip(mode === "edit")} data-testid="studio-mode-edit"><Wand2 size={12} className="inline me-1" />{tr("Edit a photo")}</button>
        </div>
        {mode === "edit" ? (
          <div className="mb-2">
            {ref ? (
              <div className="relative inline-block">
                <img src={ref.dataUrl} alt="" className="max-h-40 rounded-lg border border-slate-700" data-testid="studio-ref" />
                <button onClick={() => setRef(null)} className="absolute top-1 end-1 p-1 rounded-full bg-black/60 text-white"><X size={12} /></button>
              </div>
            ) : (
              <button onClick={() => fileRef.current && fileRef.current.click()} className={btn} data-testid="studio-pick"><ImagePlus size={13} />{tr("Pick a photo")}</button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" data-testid="studio-file"
              onChange={async (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return; try { setRef(await readPhoto(f)); } catch (x) { setErr(tr(x.message)); } }} />
          </div>
        ) : null}
        <textarea value={idea} onChange={(e) => setIdea(e.target.value)} rows={3} dir="auto" data-testid="studio-idea"
          placeholder={mode === "edit" ? tr("What should change? e.g. “make it night, with the site lights on”") : tr("Describe the picture, in Arabic or English — e.g. “a Liebherr crane lifting a bridge beam at sunset”")}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-100 placeholder:text-slate-600" />
        {mode === "create" ? (
          <>
            <label className="flex items-center gap-2 mt-2 text-[12px] text-slate-300">
              <input type="checkbox" checked={enhance} onChange={(e) => setEnhance(e.target.checked)} data-testid="studio-enhance" />
              {tr("Write a fuller description first (better pictures; uses the chat model)")}
            </label>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {SIZES.map((s) => <button key={s.id} onClick={() => setSize(s.id)} className={chip(size === s.id)} data-testid={"studio-size-" + s.id}>{tr(s.label)}</button>)}
            </div>
          </>
        ) : null}
        <div className="flex items-center gap-2 mt-3">
          {busy ? (
            <button onClick={stop} data-testid="studio-stop" className="px-3 py-2 rounded-lg bg-rose-500/20 border border-rose-800 text-rose-200 text-sm flex items-center gap-1.5 shrink-0 whitespace-nowrap"><Square size={13} />{tr("Stop")}</button>
          ) : (
            <button onClick={() => draw()} disabled={!drawReady || !idea.trim() || !info.built} data-testid="studio-go"
              className="px-4 py-2 rounded-lg bg-violet-500 text-white text-sm font-semibold disabled:opacity-40 flex items-center gap-1.5"><Palette size={14} />{mode === "edit" ? tr("Edit it") : tr("Draw it")}</button>
          )}
          {busy ? <span className="text-[12px] text-violet-200 flex items-center gap-1.5 min-w-0" data-testid="studio-progress"><Loader2 size={13} className="animate-spin shrink-0" /><span className="truncate">{stageText}</span><span className="text-slate-500 shrink-0">· {secs(now - busy.t0)}</span></span> : null}
        </div>
        {busy && busy.what === "draw" && now - busy.t0 > 90000 && busy.stage !== "draw" ? (
          <p className="text-[11px] text-slate-400 mt-2 leading-relaxed" data-testid="studio-slow-note">
            {tr("Still working — nothing is stuck. On the CPU a picture takes about 3–10 minutes (edits are slower than new pictures). Keep Attune open; Stop cancels it.")}</p>
        ) : null}
        {busy && busy.total ? <div className="h-1 bg-slate-800 rounded-full overflow-hidden mt-2"><div className="h-full bg-violet-500 transition-all" style={{ width: Math.round(busy.step * 100 / busy.total) + "%" }} /></div> : null}
        {err ? <p className="text-[12px] text-rose-300 mt-2 flex items-start gap-1.5" data-testid="studio-error"><AlertTriangle size={13} className="mt-0.5 shrink-0" />{err}</p> : null}
        {prompt && mode === "create" ? <p className="text-[11px] text-slate-500 mt-2 leading-relaxed" dir="ltr" data-testid="studio-prompt">{prompt}</p> : null}
      </div>

      {cur ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-2" data-testid="studio-result">
          <img src={cur.url} alt={cur.idea} className="w-full rounded-lg bg-slate-950" />
          <p className="text-[11px] text-slate-500 mt-1.5 px-1" dir="auto">
            {cur.w}×{cur.h} · {tr(cur.upscaled ? "sharpened on the {b} in {t}" : "drawn on the {b} in {t}", { b: cur.backend || "phone", t: secs(cur.ms || 0) })}{cur.seed != null ? " · seed " + cur.seed : ""}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2 px-1 pb-1">
            <button className={btn} data-testid="studio-save" onClick={() => { try { const r = JSON.parse(native.saveImageToGallery(cur.file)); flash(r.ok ? tr("Saved to {w}", { w: r.where }) : tr(r.error)); } catch (e) { flash(tr("Could not save")); } }}><Download size={13} />{tr("Save to gallery")}</button>
            <button className={btn} data-testid="studio-share" onClick={() => { try { native.shareImage(cur.file); } catch (e) {} }}><Share2 size={13} />{tr("Share")}</button>
            {!cur.upscaled && cur.w <= 1216 ? <button className={btn} disabled={!!busy} data-testid="studio-upscale" onClick={sharpen}><Maximize2 size={13} />{tr("×4 sharper")}{upReady ? "" : " · 67 MB"}</button> : null}
            <button className={btn} disabled={!!busy} data-testid="studio-edit-this" onClick={editThis}><Wand2 size={13} />{tr("Edit this")}</button>
            {!cur.edit ? <button className={btn} disabled={!!busy || !drawReady} data-testid="studio-again" onClick={() => { setMode("create"); draw({ idea: cur.idea, prompt: cur.prompt }); }}><RefreshCw size={13} />{tr("Another version")}</button> : null}
            <button className={btn + " ms-auto"} onClick={() => remove(cur)} aria-label={tr("Delete")}><Trash2 size={13} /></button>
          </div>
        </div>
      ) : null}

      {gallery.length > 1 ? (
        <div className="grid grid-cols-3 gap-1.5" data-testid="studio-gallery">
          {gallery.slice(0, 30).map((g) => (
            <button key={g.file + g.at} onClick={() => setCur(g)} className={`rounded-lg overflow-hidden border ${cur && cur.file === g.file ? "border-violet-500" : "border-slate-800"}`}>
              <img src={g.url} alt="" className="w-full aspect-square object-cover bg-slate-950" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}

      {info.built ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-[11px] text-slate-500 space-y-1">
          {info.note ? <p className="text-amber-200" data-testid="studio-note">{tr(info.note)}</p> : null}
          {info.gpuBuilt ? (
            <label className="flex items-center gap-2 text-slate-300"><input type="checkbox" checked={!info.cpuOnly} data-testid="studio-gpu"
              onChange={(e) => { native.setImageCpu(!e.target.checked); setInfo(readInfo()); }} />{tr("Draw on the graphics chip (faster; switches itself off if the driver fails)")}</label>
          ) : <p>{tr("This build draws on the CPU.")}</p>}
          <p>{tr("Each picture is made by a separate engine process: when it finishes, all its memory goes back to the phone. Nothing is uploaded.")}</p>
        </div>
      ) : null}
    </div>
  );
}
