/* ---- Engine → Speed ----------------------------------------------------------------
   Three things, each measured rather than promised:
   1. GPU (Adreno, through OpenCL) — off by default. If the GPU start fails or
      crashes, the engine switches itself back to the CPU and says why.
   2. Draft model — speculative decoding with Qwen 3.5 0.8B: it guesses a few
      words ahead and the big model checks them in one pass. Same answer as
      without it; faster only when the guesses are good (plain prose, lists,
      Arabic that repeats the question). Only for Qwen 3.5 models.
   3. A speed test — the same fixed task each time, so the numbers for CPU,
      GPU and draft on/off can be compared on THIS phone.                        */
import React, { useState } from "react";
import { Gauge, Loader2, AlertTriangle, Download, Zap } from "lucide-react";
import { tr, fmtNum } from "./i18n.js";

export const BENCH_KEY = "attune:bench:v1";
export const DRAFT_SPEC = { id: "draft-qwen35-08b", label: "Qwen3.5 0.8B (draft)", repo: "unsloth/Qwen3.5-0.8B-GGUF", quant: "Q4_K_M", vision: false, ctx: 4096, draft: true };

export function loadBench() { try { const v = JSON.parse(localStorage.getItem(BENCH_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
function saveBench(list) { try { localStorage.setItem(BENCH_KEY, JSON.stringify(list.slice(0, 12))); } catch (e) {} }

// The same task every time: read ~300 tokens, write 128. A random first line
// stops the engine from reusing a cached prompt, which would flatter "reading".
export function benchMessages() {
  const text = "Site report, North Gate yard. The Liebherr LTM 1100-4.2 arrived at 07:10 on a low-bed trailer and was rigged by 08:30. " +
    "Outriggers were fully extended on 1.2 m timber mats over compacted gravel; the ground was checked and found firm. " +
    "The first lift was a 14.5 t precast beam at 18 m radius with 40.4 m of boom; the load chart allows 22.3 t, so utilisation was 68%. " +
    "Wind at the boom head was 6 m/s, gusting 8. The second lift, a 9 t HVAC unit at 26 m radius, had to wait 40 minutes for the " +
    "banksman to clear the swing path. A hydraulic hose on the slewing ring was weeping and was replaced at 13:00; downtime 1.5 hours. " +
    "Fuel used: 210 litres. Next visit: Sunday 07:00 for three roof trusses of 6.2 t each at 30 m radius.";
  return [{ role: "user", content: `[${Math.random().toString(36).slice(2, 8)}]\n${text}\n\nList the five most important facts in this report as short bullet points.` }];
}

/** Plain-language reasons, from what the phone and the engine log report. */
export function diagnose(d, lastTps) {
  const out = [];
  if (!d) return out;
  if (d.thermal >= 2) out.push(["bad", "The phone is hot — it slows the processor down on purpose. Let it cool, take it out of its case, don't charge while asking."]);
  if (d.powerSave) out.push(["bad", "Battery saver is on — it caps the processor. Turn it off while using Attune."]);
  if (d.modelGB && d.availRamGB && d.availRamGB < d.modelGB * 0.6) out.push(["bad", "Free memory is low for this model — close other apps (games, camera, many browser tabs)."]);
  if (/CPU_Mapped/.test(d.buffers || "") && !/in RAM/.test(d.settings || "")) out.push(["bad", "The model is read from storage instead of RAM — update to the latest Attune APK (it loads the model into RAM)."]);
  if (d.cpu && !/dotprod/i.test(d.cpu)) out.push(["bad", "The engine is using its slowest processor path (no dotprod). Send this report."]);
  if (d.genThreads && d.genThreads < 3 && !d.powerSave && d.thermal < 2) out.push(["warn", "Only {n} threads are used for writing.", { n: d.genThreads }]);
  if (d.modelGB > 4) out.push(["warn", "This is a big model for a phone — Qwen 3.5 4B is about 2–3× faster."]);
  if (lastTps != null && lastTps < 3 && !out.some((x) => x[0] === "bad")) out.push(["warn", "Nothing obvious — the phone may have slowed Attune while it was in the background. The new APK keeps it at full speed while writing."]);
  if (!out.length) out.push(["ok", "Nothing is holding it back."]);
  return out;
}

function Bar({ v, max }) { return <span className="block h-1.5 rounded-full bg-teal-500/70" style={{ width: Math.max(4, Math.round((v / (max || 1)) * 100)) + "%" }} />; }

export function SpeedPanel({ native, nativeCall, runBench, flash, box, head, row, engineReady }) {
  const read = () => { try { return JSON.parse(native.speed()); } catch (e) { return null; } };
  const [sp, setSp] = useState(read);
  const [busy, setBusy] = useState("");
  const [pct, setPct] = useState(0);
  const [bench, setBench] = useState(loadBench);
  const [doc, setDoc] = useState(null);
  if (!sp) return null;

  const apply = async (patch, msg) => {
    setBusy(msg);
    try { const r = await nativeCall("setSpeed", patch); setSp(r.speed || read()); }
    catch (e) { flash(tr(e.message)); setSp(read()); }
    finally { setBusy(""); }
  };
  const installDraft = async () => {
    setBusy(tr("Downloading the draft model…")); setPct(0);
    try { await nativeCall("install", DRAFT_SPEC, (p) => setPct(p)); setSp(read()); flash(tr("Draft model ready")); }
    catch (e) { flash(tr(e.message)); }
    finally { setBusy(""); }
  };
  const test = async () => {
    setBusy(tr("Running the speed test…"));
    try {
      const st = await runBench();
      const cur = read() || sp;
      const entry = { at: Date.now(), model: cur.activeLabel || "", mode: cur.gpuName ? "GPU" : "CPU", gpu: cur.gpuName || "",
        draft: !!cur.draftActive, promptTps: st.promptTps || 0, tps: st.tps || 0 };
      const list = [entry, ...bench];
      setBench(list); saveBench(list);
    } catch (e) { flash(tr(e.message)); }
    finally { setBusy(""); }
  };
  const maxTps = Math.max(1, ...bench.map((b) => b.tps || 0));
  const best = bench.filter((b) => b.model === sp.activeLabel).sort((a, b) => b.tps - a.tps)[0];

  return (
    <div className={box} data-testid="speed-panel">
      <p className={head}>{tr("Speed")}</p>
      {sp.gpuNote ? (
        <p className="text-[12px] text-amber-200 flex items-start gap-1.5 mb-2" data-testid="gpu-note"><AlertTriangle size={13} className="mt-0.5 shrink-0" />{tr(sp.gpuNote)}</p>
      ) : null}
      <div className="space-y-1.5">
        {sp.gpuBuilt ? row(sp.gpu, () => !busy && apply({ gpu: !sp.gpu }, tr("Restarting the engine…")), "Use the GPU",
          sp.gpuName ? tr("Running on {g}.", { g: sp.gpuName }) : "Runs the model on the phone's graphics chip (Adreno). Often faster at reading long prompts; test it below. Switches itself back to the CPU if anything goes wrong.")
          : <p className="text-[11px] text-slate-500 px-1">{tr("This build has no GPU engine — it will come with the next APK built on GitHub.")}</p>}
        {sp.draftInstalled ? row(sp.draft, () => !busy && apply({ draft: !sp.draft }, tr("Restarting the engine…")), "Faster answers with a draft model",
          sp.draftFits ? (sp.draftActive ? tr("On: {d} guesses ahead, the main model checks.", { d: sp.draftLabel }) : "Qwen 3.5 0.8B guesses a few words ahead and the main model checks them in one go. Same answers, often faster writing.")
            : "Only works with a Qwen 3.5 model — the one in use is not.") : (
          <button onClick={installDraft} disabled={!!busy} data-testid="draft-install"
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg border border-slate-800 text-start disabled:opacity-50">
            <Download size={16} className="text-teal-300 shrink-0" />
            <span className="min-w-0"><span className="block text-sm text-slate-200">{tr("Faster answers with a draft model")}</span>
              <span className="block text-[11px] text-slate-500">{tr("Download Qwen 3.5 0.8B as a helper (about 0.5 GB, once). Works with Qwen 3.5 models.")}</span></span>
          </button>
        )}
      </div>
      {busy ? <p className="text-[12px] text-teal-300 mt-2 flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" />{busy}{pct ? " " + pct + "%" : ""}</p> : null}

      <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950 p-3" data-testid="doctor">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-slate-200 flex items-center gap-1.5"><AlertTriangle size={15} className="text-amber-300" />{tr("Why is it slow?")}</span>
          <button onClick={() => { try { setDoc(JSON.parse(native.doctor())); } catch (e) { flash(tr("Not available in this build")); } }} data-testid="doctor-run"
            className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-200">{tr("Check now")}</button>
        </div>
        {doc ? (
          <div className="mt-2 space-y-1.5 text-[12px]">
            {diagnose(doc, bench[0] ? bench[0].tps : null).map(([lvl, msg, v], i) => (
              <p key={i} className={lvl === "bad" ? "text-rose-300" : lvl === "warn" ? "text-amber-200" : "text-emerald-300"} data-testid="doctor-finding">• {tr(msg, v)}</p>
            ))}
            <p className="text-[11px] text-slate-500" dir="ltr">{[doc.model, doc.modelGB ? doc.modelGB.toFixed(1) + " GB" : "", "RAM " + (doc.availRamGB || 0).toFixed(1) + "/" + doc.ramGB + " GB free",
              doc.genThreads + " threads", doc.cpu, doc.gpu ? "GPU " + doc.gpu : "", "thermal " + doc.thermal].filter(Boolean).join(" · ")}</p>
            <button onClick={() => { const t = JSON.stringify(doc, null, 1); try { navigator.clipboard.writeText(t); } catch (e) {} if (native.share) native.share("Attune speed report\n" + t); }}
              className="text-[11px] text-teal-300 underline underline-offset-2">{tr("Send this report")}</button>
          </div>
        ) : <p className="text-[11px] text-slate-500 mt-1">{tr("Reads the phone's heat, battery saver, free memory and the engine's own log, and says in plain words what is slowing answers down.")}</p>}
      </div>

      <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-slate-200 flex items-center gap-1.5"><Gauge size={15} className="text-teal-300" />{tr("Speed test")}</span>
          <button onClick={test} disabled={!!busy || !engineReady} data-testid="bench-run"
            className="px-3 py-1.5 rounded-lg bg-teal-500 disabled:opacity-40 text-slate-950 text-xs font-semibold">{tr("Run it")}</button>
        </div>
        <p className="text-[11px] text-slate-500 mt-1">{tr("The same short task every time (read a site report, write five bullets), so CPU, GPU and draft can be compared on this phone. Takes 10–40 s.")}</p>
        {bench.length ? (
          <div className="mt-2 space-y-1.5" data-testid="bench-results">
            {bench.slice(0, 6).map((b) => (
              <div key={b.at} className="text-[11px]">
                <div className="flex justify-between gap-2 text-slate-300">
                  <span className="truncate">{b.mode}{b.draft ? " + " + tr("draft") : ""} · {b.model}</span>
                  <span dir="ltr" className="shrink-0">{tr("writes {w}/s · reads {r}/s", { w: fmtNum(b.tps), r: fmtNum(b.promptTps) })}</span>
                </div>
                <Bar v={b.tps} max={maxTps} />
              </div>
            ))}
            {best ? <p className="text-[11px] text-teal-300 flex items-center gap-1 pt-1"><Zap size={12} />{tr("Fastest here so far: {m}", { m: best.mode + (best.draft ? " + " + tr("draft") : "") })}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
