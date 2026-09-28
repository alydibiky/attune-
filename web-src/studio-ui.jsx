/* ---- Studio: create and edit pictures on the phone (More → Studio) -------------------
   The picture engine and its models are described in studio.js / ImageEngine.kt. */
import { askConfirm } from "./confirm.jsx";
import React, { useState, useEffect, useRef } from "react";
import { Palette, ImageIcon, Download, Share2, Maximize2, Wand2, RefreshCw, Trash2, Square, Loader2, AlertTriangle, ImagePlus, Sparkles, X, Zap } from "lucide-react";
import { tr } from "./i18n.js";
import { useSubBack, useSticky } from "./backstack.js";
import { PACKS, SIZES, enhanceMessages, cleanPrompt, packReady, drawPack, drawSize, gpuWorks, loadStudio, saveStudio } from "./studio.js";

const STAGE = {
  gpu: "Waking the graphics chip (the first time can take a minute)…",
  check: "Checking the picture engine and model files…", retry: "Short of memory — drawing it smaller (512 px)…",
  start: "Starting the picture engine…", load: "Loading the picture model…", prompt: "Reading your description…",
  draw: "Drawing", develop: "Developing the picture…", save: "Saving…", upscale: "Sharpening ×4",
  resume: "Still working — it carried on while you were away…",
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

// ---- v5.41: a job outlives the screen (Ali: "I sharpen, tap out and in — it starts from the beginning") ----
// Drawing and ×4 sharpening run natively and carry on when you leave Studio; their progress and result
// used to live only in the open screen, so coming back showed nothing and the finished picture was never
// added. The job now lives here (module level): a returning Studio shows it still running, and the
// result is saved to the gallery even if no Studio screen is open. After a page reload, the job noted in
// storage is picked up from the phone's Studio folder when its file appears.
const LIVE = { busy: null, cur: null, hub: null, callId: "" };
const PENDING = "attune:studio:pending";
const notePending = (v) => { try { if (v) localStorage.setItem(PENDING, JSON.stringify(v)); else localStorage.removeItem(PENDING); } catch (e) {} };
const readPending = () => { try { return JSON.parse(localStorage.getItem(PENDING) || "null"); } catch (e) { return null; } };
function commitPic(item) {
  const list = [item, ...loadStudio().filter((x) => x.file !== item.file)];
  saveStudio(list); LIVE.cur = item;
  if (LIVE.hub) { LIVE.hub.setGallery(list); LIVE.hub.setCur(item); }
}

export function StudioPage({ native, nativeCall, nativeLastId, llm, chatReady, flash, incoming, clearIncoming }) {
  const readInfo = () => { try { return JSON.parse(native.imageInfo()); } catch (e) { return null; } };
  const [info, setInfo] = useState(readInfo);
  const [mode, setMode] = useSticky("studio:mode", "create");
  useSubBack(mode === "edit", () => setMode("create"));   // v5.34: Back leaves photo editing
  const [idea, setIdea] = useState("");
  const [enhance, setEnhance] = useState(true);
  // v5.34 — Ali: "needs to be highest resolution". Turbo draws at 512 px (what it was trained
  // for — bigger gives doubled buildings), so every picture is sharpened ×4 → 2048 px after it
  // is drawn. On by default; remembered.
  const [hd, setHd] = useState(() => { try { return localStorage.getItem("attune:studio:hd") !== "0"; } catch (e) { return true; } });
  const setHdKeep = (v) => { setHd(v); try { localStorage.setItem("attune:studio:hd", v ? "1" : "0"); } catch (e) {} };
  const [prompt, setPrompt] = useSticky("studio:prompt", "");
  const [size, setSize] = useState("square");
  // v5.28: Turbo (fast, any phone) or Pro (best quality, needs the graphics chip) — remembered
  const [choice, setChoiceS] = useState(() => { try { return localStorage.getItem("attune:studio:choice") || null; } catch (e) { return null; } });
  const setChoice = (c) => { setChoiceS(c); try { localStorage.setItem("attune:studio:choice", c); } catch (e) {} };
  const [ref, setRef] = useState(null);           // { dataUrl, w, h }
  const [busy, setBusyL] = useState(() => LIVE.busy);         // { what, stage, step, total, t0 } — mirrored in LIVE
  // the job's state is LIVE.busy; the screen shows it while it is open
  const setBusy = (x) => { const nb = typeof x === "function" ? x(LIVE.busy) : x; LIVE.busy = nb; if (LIVE.hub) LIVE.hub.setBusy(nb); };
  const [now, setNow] = useState(Date.now());
  const [dl, setDl] = useState(null);             // { id, pct, stage, detail }
  const [gallery, setGallery] = useState(loadStudio);
  const [cur, setCurL] = useState(() => LIVE.cur || loadStudio()[0] || null);
  const setCur = (c) => { LIVE.cur = c; if (LIVE.hub) LIVE.hub.setCur(c); };
  const [err, setErrL] = useState("");
  const setErr = (e) => { if (LIVE.hub) LIVE.hub.setErr(e); };
  const callId = useRef(LIVE.callId);
  useEffect(() => {
    LIVE.hub = { setBusy: setBusyL, setCur: setCurL, setErr: setErrL, setGallery: (l) => setGallery(l) };
    return () => { LIVE.hub = null; };
  }, []);
  // after a reload: a job that was running is picked up when its picture appears in the Studio folder
  useEffect(() => {
    const pend = readPending();
    if (!pend || LIVE.busy || !native || !native.imageList) return undefined;
    if (Date.now() - (pend.t0 || 0) > 25 * 60000) { notePending(null); return undefined; }
    setBusy({ what: pend.what, t0: pend.t0, stage: "resume" });
    const look = () => {
      try {
        const files = JSON.parse(native.imageList() || "[]");
        const hit = pend.what === "upscale" ? files.find((f) => f.file === String(pend.file || "").replace(/\.png$/i, "") + "-x4.png")
          : files.filter((f) => f.file && (f.at || 0) >= (pend.t0 || 0) - 2000 && !/-x[24]\.png$/.test(f.file)).sort((a, b) => (b.at || 0) - (a.at || 0))[0];
        if (hit) {
          const base = pend.what === "upscale" ? (loadStudio().find((x) => x.file === pend.file) || {}) : {};
          commitPic({ ...base, file: hit.file, url: hit.url, w: hit.width, h: hit.height, idea: base.idea || pend.idea || "", prompt: base.prompt || pend.prompt || "", upscaled: pend.what === "upscale", at: Date.now(), resumed: true });
          notePending(null); setBusy(null); return true;
        }
      } catch (e) {}
      if (Date.now() - (pend.t0 || 0) > 25 * 60000) { notePending(null); setBusy(null); setErr(tr("The last picture didn't finish while you were away — try again.")); return true; }
      return false;
    };
    if (look()) return undefined;
    const t = setInterval(() => { if (look()) clearInterval(t); }, 3000);
    return () => clearInterval(t);
  }, []);
  const fileRef = useRef(null);

  useEffect(() => { if (!busy) return; const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, [busy]);
  // v5.20: a picture finished while the page was away (reloaded, closed by
  // Android) is still in the Studio folder — bring it into the gallery.
  useEffect(() => {
    if (!native || !native.imageList) return;
    try {
      const files = JSON.parse(native.imageList() || "[]");
      const have = new Set(loadStudio().map((x) => x.file));
      // v5.41: a sharpened (-x4) picture finished while away is recovered too, with its original's idea
      const missed = files.filter((f) => f && f.file && !have.has(f.file)).map((f) => { const src = /-x[24]\.png$/.test(f.file) ? loadStudio().find((x) => x.file === f.file.replace(/-x[24]\.png$/, ".png")) : null;
        return { ...(src || {}), file: f.file, url: f.url, w: f.width, h: f.height, idea: (src && src.idea) || "", prompt: (src && src.prompt) || "", at: f.at, recovered: true, upscaled: /-x2\.png$/.test(f.file) ? "x2" : !!src || /-x4\.png$/.test(f.file) }; });
      if (missed.length) { const next = [...missed, ...loadStudio()].sort((a, b) => (b.at || 0) - (a.at || 0)); keep(next); setCur(next[0]); }
    } catch (e) {}
  }, []);
  useEffect(() => { if (incoming && incoming.prompt != null) { setIdea(incoming.prompt); setMode("create"); clearIncoming && clearIncoming(); } }, [incoming]);

  if (!info) return <div className="p-4 text-sm text-slate-400" data-testid="studio-page">{tr("Studio works in the Android app.")}</div>;
  const dp = drawPack(info, choice, mode);
  const gpuOk = gpuWorks(info);
  const drawReady = dp.ready;
  const P = PACKS[dp.id];
  const upReady = packReady(info, "esrgan-x4");
  const keep = (list) => { setGallery(list); saveStudio(list); };
  // adds one picture to the newest gallery (safe from a delayed call — v5.34 auto-sharpen)
  const keepRef = useRef(null);
  keepRef.current = (item) => setGallery((g) => { const l = [item, ...g]; saveStudio(l); return l; });

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
    // "3/4" or "3/4 · <engine line>" or just the engine's latest line (v5.32)
    const d = String(detail || "");
    const m = /^(\d+)\/(\d+)(?:\s·\s(.*))?$/.exec(d);
    const line = m ? m[3] || "" : d;
    setBusy((b) => ({ ...(b || { what, t0: Date.now() }), stage, step: m ? +m[1] : 0, total: m ? +m[2] : 0, line: line || (b && b.stage === stage ? b.line : "") }));
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
        // v5.20: never wait on the chat model for long — after 45 s the picture is drawn from the idea as typed
        try { finalPrompt = cleanPrompt(await Promise.race([llm(enhanceMessages(text), { maxTokens: 220 }), new Promise((_, rej) => setTimeout(() => rej(new Error("slow")), 45000))]), text); } catch (e) { finalPrompt = text; }
      }
      setPrompt(finalPrompt);
      // v5.17: the description is written — say what happens now, instead of
      // "Writing a fuller description…" for the whole drawing.
      setBusy((b) => (b && b.stage === "enhance" ? { ...b, stage: "start" } : b));
      // 2. The picture.
      const sz = SIZES.find((s) => s.id === size) || SIZES[0];
      const r0 = opts.ref || ref;
      const ds = drawSize(dp.id, sz);
      const arg = { pack: dp.id, prompt: finalPrompt, width: r0 ? r0.w : ds.w, height: r0 ? r0.h : ds.h, steps: (P.defaults && P.defaults.steps) || 4, cfg: (P.defaults && P.defaults.cfg) || 1 };
      if (opts.seed != null) arg.seed = opts.seed;
      if (mode === "edit" || opts.ref) arg.refImage = r0.dataUrl;
      const run = nativeCall("imagine", arg, progress("draw"));
      callId.current = LIVE.callId = nativeLastId();
      notePending({ what: "draw", t0: Date.now(), idea: text, prompt: finalPrompt });
      const r = await run;
      notePending(null);
      const item = { file: r.file, url: r.url, idea: text, prompt: finalPrompt, w: r.width, h: r.height, ms: r.ms, backend: r.backend, seed: r.seed, edit: !!arg.refImage, at: Date.now() };
      commitPic(item);
      if (r.pausedChat) flash(tr("The chat model was paused to make room, and is loading again."));
      setInfo(readInfo());
      if (hd && item.w <= 1216 && !item.edit) autoSharpen.current = item;
      // v5.42: without the graphics chip the ×4 AI sharpen takes ~25 s per 128-px part (10+ min
      // for a 640-px picture — Ali saw 6 of 25 parts in 10 min), so HD is the instant ×2 there
      autoFast.current = !onGpu(r.backend) || !upReady;
    } catch (e) {
      // v5.17: never silent. "Stopped" is only quiet when the person pressed Stop.
      const msg = String((e && e.message) || "");
      if (msg === "Stopped" && userStop.current) { /* they asked for it */ }
      else if (msg === "Stopped") setErr(tr("The picture engine stopped before the picture was finished — Android may have closed it to free memory. Try “Quick draft”, or close other apps and try again."));
      else setErr(msg ? tr(msg) : tr("The picture could not be made. Open Engine → Engine log and send me what it says."));
      const inf = readInfo(); setInfo(inf);
      if (msg === "Stopped" && !userStop.current && inf && inf.lastError) setErr(tr(inf.lastError));
    }
    finally {
      setBusy(null); userStop.current = false;
      // v5.34: highest resolution — sharpen ×4 straight away (after the drawing's busy state is cleared)
      const next = autoSharpen.current; autoSharpen.current = null;
      if (next) setTimeout(() => (autoFast.current && native.sharpenFast ? sharpenFast(next, true) : sharpen(next, true)), 50);
    }
  };
  const autoSharpen = useRef(null);
  const autoFast = useRef(false);
  const onGpu = (b) => !!b && !/cpu/i.test(String(b));
  /** Minutes the ×4 AI sharpen needs on the processor: ~25 s for each 128-px part. */
  const cpuMinutes = (p) => Math.max(1, Math.round(Math.ceil((p.w || 512) / 128) * Math.ceil((p.h || 512) / 128) * 25 / 60));

  // v5.42: ×2 and crisper in under a second — no model, no download
  const sharpenFast = async (target, auto) => {
    const pic = target && target.file ? target : cur;
    if (!pic || !native.sharpenFast) return;
    setErr(""); setBusy({ what: "upscale", t0: Date.now(), stage: "fast" });
    try {
      const r = await nativeCall("sharpenFast", { file: pic.file });
      commitPic({ ...pic, file: r.file, url: r.url, w: r.width, h: r.height, ms: (pic.ms || 0) + (r.ms || 0), backend: pic.backend, upscaled: "x2", orig: pic.file, at: Date.now() });
    } catch (e) { setErr(auto ? tr("The picture is ready at {w} px; sharpening it failed: {e}", { w: pic.w, e: tr(e.message) }) : tr(e.message)); }
    finally { setBusy(null); }
  };

  const sharpen = async (target, auto) => {
    let pic = target && target.file ? target : cur;
    if (!pic) return;
    if (pic.upscaled === "x2" && pic.orig) pic = { ...pic, file: pic.orig, w: Math.round(pic.w / 2), h: Math.round(pic.h / 2), upscaled: false };   // ×4 from the original, not from the ×2
    // on the processor: say how long it really takes, before starting
    if (!auto && !onGpu(pic.backend) && !(await askConfirm(tr("Without the graphics chip, the ×4 AI sharpen takes about {m} minutes on this phone. “×2 sharper” takes a second. Start the ×4?", { m: cpuMinutes(pic) }), { yes: "Start ×4", no: "Cancel" }))) return;
    if (!upReady && !(await install("esrgan-x4"))) return;
    setErr(""); setBusy({ what: "upscale", t0: Date.now(), stage: "upscale" });
    try {
      const run = nativeCall("upscaleImage", { file: pic.file }, progress("upscale"));
      callId.current = LIVE.callId = nativeLastId();
      notePending({ what: "upscale", t0: Date.now(), file: pic.file });
      const r = await run;
      notePending(null);
      const item = { ...pic, file: r.file, url: r.url, w: r.width, h: r.height, ms: (pic.ms || 0) + (r.ms || 0), backend: r.backend, upscaled: true, at: Date.now() };
      commitPic(item);
    } catch (e) { if (e.message !== "Stopped") setErr(auto ? tr("The picture is ready at {w} px; sharpening it failed: {e}", { w: pic.w, e: tr(e.message) }) : tr(e.message)); }
    finally { setBusy(null); }
  };

  const editThis = async () => {
    if (!cur) return;
    try { setRef(await shrink(cur.url)); setMode("edit"); setIdea(""); }
    catch (e) { setErr(tr("Could not open that picture")); }
  };
  const userStop = useRef(false);
  // v5.19: pictures are stopped only by this button (cancelImage), never by
  // a cancel meant for something else.
  const stop = () => { userStop.current = true; notePending(null); const id = callId.current || LIVE.callId; if (!LIVE.busy || LIVE.busy.stage === "resume") setBusy(null); try { if (native.cancelImage) native.cancelImage(id); else native.cancel(id); } catch (e) {} };
  const remove = (it) => { try { native.deleteImage(it.file); } catch (e) {} const next = gallery.filter((x) => x.file !== it.file); keep(next); if (cur && cur.file === it.file) setCur(next[0] || null); };

  const stageText = busy ? (busy.stage === "enhance" ? tr("Writing a fuller description…")
    : busy.stage === "draw" && busy.total ? tr("Drawing — step {n} of {t}", { n: busy.step, t: busy.total })
    : busy.stage === "fast" ? tr("Sharpening ×2…")
    : busy.stage === "upscale" && busy.total ? tr("Sharpening ×4 — part {n} of {t}", { n: busy.step, t: busy.total }) + (busy.step > 0 && busy.step < busy.total ? " · " + tr("about {m} min left", { m: Math.max(1, Math.round((Date.now() - busy.t0) / busy.step * (busy.total - busy.step) / 60000)) }) : "")
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
          {dp.why === "cpu" ? <p className="text-[12px] text-amber-200 mt-1 leading-relaxed" data-testid="studio-why-turbo">{tr("This phone's graphics chip isn't working with Studio, so the Pro model would take 10–20 minutes a picture on the CPU. Studio Turbo makes a picture in about a minute.")}</p> : null}
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
        {mode === "create" ? (
          <div className="flex flex-wrap items-center gap-1.5 mb-2" data-testid="studio-model">
            <button onClick={() => setChoice("turbo")} className={chip(dp.id === "turbo")} data-testid="studio-use-turbo">⚡ {tr("Turbo · about 1 min")}</button>
            <button onClick={() => setChoice("pro")} className={chip(dp.id !== "turbo")} data-testid="studio-use-pro">{tr("Pro · best quality")}</button>
            {dp.id !== "turbo" && gpuOk === false ? <span className="text-[11px] text-amber-300" data-testid="studio-pro-slow">{tr("Pro on this phone's CPU: 10–20 min a picture")}</span> : null}
          </div>
        ) : null}
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
            <label className="flex items-center gap-2 mt-1.5 text-[12px] text-slate-300">
              <input type="checkbox" checked={hd} onChange={(e) => setHdKeep(e.target.checked)} data-testid="studio-hd" />
              {tr("Highest resolution — sharpen every picture (×4 with the graphics chip; an instant ×2 without it)")}
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
        {busy && busy.line ? <p className="text-[10.5px] text-slate-500 mt-1.5 font-mono truncate" dir="ltr" data-i18n-skip data-testid="studio-engine-line">{busy.line}</p> : null}
        {busy && busy.what === "draw" && now - busy.t0 > 90000 && busy.stage !== "draw" ? (
          <p className="text-[11px] text-slate-400 mt-2 leading-relaxed" data-testid="studio-slow-note">
            {dp.id === "turbo" ? tr("Still working — nothing is stuck. Turbo takes about 1–2 minutes on the CPU. Keep Attune open; Stop cancels it.")
              : tr("Still working — nothing is stuck. Without the graphics chip a Pro picture takes 10–20 minutes (edits take longer). For speed, pick Turbo. Keep Attune open; Stop cancels it.")}</p>
        ) : null}
        {busy && busy.total ? <div className="h-1 bg-slate-800 rounded-full overflow-hidden mt-2"><div className="h-full bg-violet-500 transition-all" style={{ width: Math.round(busy.step * 100 / busy.total) + "%" }} /></div> : null}
        {!err && !busy && info.lastError ? <p className="text-[11px] text-amber-300/90 mt-2" data-testid="studio-last-error">{tr("The last picture didn't finish:")} {tr(info.lastError)}</p> : null}
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
            {!cur.upscaled && cur.w <= 1216 && native.sharpenFast ? <button className={btn} disabled={!!busy} data-testid="studio-sharpen-fast" onClick={() => sharpenFast()}><Zap size={13} />{tr("×2 sharper · instant")}</button> : null}
            {(!cur.upscaled || cur.upscaled === "x2") && cur.w <= 2432 ? <button className={btn} disabled={!!busy} data-testid="studio-upscale" onClick={() => sharpen()}><Maximize2 size={13} />{tr("×4 AI sharpen")}{upReady ? "" : " · 67 MB"}{!onGpu(cur.backend) ? " · ~" + cpuMinutes(cur.upscaled === "x2" ? { w: cur.w / 2, h: cur.h / 2 } : cur) + " min" : ""}</button> : null}
            <button className={btn} disabled={!!busy} data-testid="studio-edit-this" onClick={editThis}><Wand2 size={13} />{tr("Edit this")}</button>
            {!cur.edit ? <button className={btn} disabled={!!busy || !drawReady} data-testid="studio-again" onClick={() => { setMode("create"); draw({ idea: cur.idea, prompt: cur.prompt }); }}><RefreshCw size={13} />{tr("Another version")}</button> : null}
            <button className={btn + " ms-auto"} onClick={async () => { if (await askConfirm("Delete this picture?")) remove(cur); }} aria-label={tr("Delete")}><Trash2 size={13} /></button>
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

      {info.built && info.gpuBuilt && info.cpuOnly ? (
        <div className="rounded-xl border border-amber-800 bg-amber-500/10 p-3 space-y-2" data-testid="studio-gpu-card">
          <p className="text-[13px] text-amber-100">{tr("Studio is drawing on the processor (slow). This phone has a graphics chip — try it: pictures and ×4 sharpening are many times faster there.")}</p>
          <button className="px-3 py-2 rounded-lg bg-amber-500 text-slate-950 text-[13px] font-semibold" data-testid="studio-gpu-on"
            onClick={() => { native.setImageCpu(false); setInfo(readInfo()); flash(tr("The next picture uses the graphics chip")); }}>{tr("Use the graphics chip")}</button>
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
