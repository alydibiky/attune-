// The model engine: llama-server on 127.0.0.1, started and stopped here (Engine.kt's job on the phone).
// Variants shipped next to the app: engine/<variant>/llama-server[.exe]
//   Windows/Linux: "vulkan" (any graphics chip; CPU code for every x64 generation is loaded at run time);
//   macOS: "metal". Optional later: "cuda" (NVIDIA download), "cpu".
// Each is tried with the graphics chip first, then CPU only (like Engine.kt's forceCpu).
"use strict";
const fs = require("fs");
const path = require("path");
const net = require("net");
const crypto = require("crypto");
const os = require("os");
const { spawn } = require("child_process");

const EXE = process.platform === "win32" ? "llama-server.exe" : "llama-server";

function variants(engineRoots) {
  const out = [];
  if (process.env.ATTUNE_LLAMA_DIR) out.push({ name: "env", dir: process.env.ATTUNE_LLAMA_DIR });
  for (const r of engineRoots) for (const v of ["cuda", "metal", "vulkan", "cpu"]) {
    const d = path.join(r, v);
    if (fs.existsSync(path.join(d, EXE))) out.push({ name: v, dir: d });
  }
  return out;
}

function envFor(dir) {
  const env = Object.assign({}, process.env);
  if (process.platform === "linux") env.LD_LIBRARY_PATH = dir + (env.LD_LIBRARY_PATH ? ":" + env.LD_LIBRARY_PATH : "");
  if (process.platform === "darwin") env.DYLD_LIBRARY_PATH = dir + (env.DYLD_LIBRARY_PATH ? ":" + env.DYLD_LIBRARY_PATH : "");
  if (process.platform === "win32") env.PATH = dir + ";" + env.PATH;
  return env;
}

/** An engine's exit code → what happened, in plain words (Windows codes are NTSTATUS values). */
function exitReason(code, sig) {
  const W = { 3221225781: "a Windows file it needs is missing (DLL not found) — install the latest Attune, or the Microsoft Visual C++ Redistributable",
    3221225501: "this processor lacks an instruction the engine uses (AVX2) — the CPU-only engine is tried next",
    3221225477: "it crashed while loading (memory access) — often the graphics driver; the CPU-only engine is tried next",
    3221226505: "it stopped itself (an internal check failed) — see the lines above",
    3221225725: "it ran out of stack while loading", 3221225495: "the computer ran out of memory for this model — pick a smaller model" };
  if (code != null && W[code >>> 0]) return "Engine stopped: " + W[code >>> 0] + " (code 0x" + (code >>> 0).toString(16).toUpperCase() + ")";
  if (sig) return "Engine stopped by signal " + sig + (sig === "SIGKILL" ? " — often too little memory for this model" : "");
  return "Engine stopped (exit code " + code + ")" + (code === 1 ? " — see the lines above" : "");
}

function freePort() {
  return new Promise((ok, bad) => {
    const s = net.createServer(); s.unref();
    s.on("error", bad);
    s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => ok(p)); });
  });
}

const team = require("./team");
function setPrio(p, level) {
  if (process.platform !== "win32" || !p || !p.pid) return false;
  try { os.setPriority(p.pid, level === "low" ? os.constants.priority.PRIORITY_BELOW_NORMAL : os.constants.priority.PRIORITY_NORMAL); return true; } catch (e) { return false; }
}

/** v10.2 (Ali: "it's taking a lot of time to load", 66 s on his laptop): what llama-server is doing now, read from the end of its
 *  log — so the Engine sheet says the real step instead of "Reading the model file" for a whole minute. */
function phaseOf(tail) {
  const t = String(tail || "").split("=== ").pop();
  if (/warming up|warmup/i.test(t)) return "Warming up";
  if (/llama_context|kv[_ ]cache|graph_reserve|compute buffer/i.test(t)) return "Preparing the memory";
  if (/load_tensors|offload(?:ing|ed) \d+|CPU_Mapped|Vulkan\d? model buffer|model buffer size/i.test(t)) return "Loading the model onto the chip";
  if (/llama_model_loader|loaded meta data|gguf/i.test(t)) return "Reading the model file";
  return "Starting the engine";
}
/** v10.2: the way that started THIS model last time (engine folder + graphics chip or not + helper) is tried first, so a way that
 *  fails slowly (a graphics driver that crashes after loading, a helper that does not fit) is not paid again at every start. */
function orderAttempts(attempts, good) {
  if (!good) return attempts;
  const i = attempts.findIndex((a) => a.v.name === good.variant && a.gpu === good.gpu && !!a.draft === !!good.draft);
  return i > 0 ? [attempts[i], ...attempts.slice(0, i), ...attempts.slice(i + 1)] : attempts;
}

class Engine {
  constructor(opts) {
    this.engineRoots = opts.engineRoots; this.logFile = opts.logFile; this.onChange = opts.onChange || (() => {});
    this.goodFile = opts.goodFile || path.join(path.dirname(this.logFile || "."), "engine-good.json");
    this.state = "idle"; this.error = null; this.modelId = null; this.proc = null; this.port = 0;
    this.apiKey = crypto.randomBytes(16).toString("hex"); this.started = 0; this.variant = null; this.gen = 0;
  }
  get baseUrl() { return "http://127.0.0.1:" + this.port; }
  binary() { const v = variants(this.engineRoots)[0]; return v ? { bin: path.join(v.dir, EXE), env: envFor(v.dir) } : null; }
  json() {
    return { state: this.state, error: this.error, modelId: this.modelId, port: this.port,
      loadingFor: this.started && this.state === "starting" ? Math.round((Date.now() - this.started) / 1000) : 0,
      phase: this.state === "starting" ? phaseOf(this.logTail(3000)) : "", heavy: false, thermal: 0, lastLoadSecs: this.lastLoadSecs || 0,
      engine: "llama", backend: this.variant || "", team: this.team || "" };
  }
  goods() { try { return JSON.parse(fs.readFileSync(this.goodFile, "utf8")) || {}; } catch (e) { return {}; } }
  remember(modelId, a, secs) { const g = this.goods(); g[modelId] = { variant: a.v.name, gpu: a.gpu, draft: !!a.draft, secs }; try { fs.writeFileSync(this.goodFile, JSON.stringify(g)); } catch (e) {} }
  note(line) { try { fs.appendFileSync(this.logFile, line + "\n"); } catch (e) {} }
  logTail(n) { try { const t = fs.readFileSync(this.logFile, "utf8"); return t.slice(-(n || 8000)); } catch (e) { return ""; } }

  args(model, info, gpu, draft) {
    const a = ["-m", model.modelFile, "--host", "127.0.0.1", "--port", String(this.port), "--api-key", this.apiKey,
      "-c", String(model.ctx || 8192), "-t", String(info.genThreads || 4), "-np", "1",
      "--cache-reuse", "256", "--cache-ram", "0", "--jinja", "--no-slots", "--threads-http", "2",
      "--cors-headers", "Authorization,Content-Type", "--cors-origins", "app://attune"];
    if (gpu) a.push("-fa", "auto", "--fit", "on");   // llama.cpp puts as many layers on the graphics chip as fit, the rest in RAM
    else a.push("--device", "none", "-ngl", "0", "-fa", "on", "-ctk", "q8_0", "-ctv", "q8_0");
    if (model.mmproj) a.push("--mmproj", model.mmproj);
    if (draft) a.push(...team.draftArgs(draft, gpu));   // v9.9.8 M4: the small helper writes ahead, this model checks
    return a;
  }

  async stop() {
    this.gen++;
    const p = this.proc; this.proc = null;
    if (p && p.exitCode === null) {
      await new Promise((ok) => { const t = setTimeout(() => { try { p.kill("SIGKILL"); } catch (e) {} ok(); }, 5000); p.once("exit", () => { clearTimeout(t); ok(); }); try { p.kill(); } catch (e) { ok(); } });
    }
    this.state = "idle"; this.modelId = null; this.onChange(this.json());
  }

  async start(model, info, draft) {
    await this.stop();
    const gen = this.gen;
    this.state = "starting"; this.error = null; this.modelId = model.id; this.started = Date.now(); this.onChange(this.json());
    const vs = variants(this.engineRoots);
    if (!vs.length) { this.state = "error"; this.error = "The model engine is missing from this install"; this.onChange(this.json()); return false; }
    let lastErr = "";
    // Each engine folder: first with the graphics chip, then (if that will not start) CPU only.
    const attempts = [];
    // v9.9.8 M4: with a helper, each way is tried as a team first, then the big model alone (a pair that won't start never blocks it)
    for (const v of vs) for (const gpu of (v.name !== "cpu" && !process.env.ATTUNE_CPU_ONLY ? [true, false] : [false])) {
      if (draft) attempts.push({ v, gpu, draft }); attempts.push({ v, gpu, draft: null }); }
    for (const a of orderAttempts(attempts, this.goods()[model.id])) {
      const { v, gpu, draft: d } = a;
      if (gen !== this.gen) return false;
      this.port = await freePort();
      const log = fs.openSync(this.logFile, "a");
      fs.writeSync(log, "\n=== " + new Date().toISOString() + " start " + model.id + " with " + v.name + (d ? " + helper " + d.id : "") + "\n");
      const p = spawn(path.join(v.dir, EXE), this.args(model, info, gpu, d), { env: envFor(v.dir), stdio: ["ignore", log, log], windowsHide: true });
      fs.closeSync(log);
      // v6.25 (Ali's log: six starts, not one word): when the engine stops, the log says why in plain words
      p.on("error", (e) => this.note("The engine could not be started: " + (e.code === "EACCES" || e.code === "EPERM" ? "Windows or an antivirus blocked it — allow Attune in the antivirus" : e.message)));
      p.on("exit", (code, sig) => { if (gen === this.gen && this.proc === p && this.state !== "ready") this.note(exitReason(code, sig)); });
      this.proc = p; this.variant = v.name + (gpu ? "" : " (CPU)"); this.team = d ? (d.label || d.id) : "";
      // v10.2 (Ali: "the app is not smooth … glitchy" while the model loads): on Windows the engine reads the model at "below normal"
      // priority, so the window stays smooth; it goes back to normal once ready (Windows allows raising it back; Linux/macOS do not,
      // so there it is left alone)
      setPrio(p, "low");
      const ok = await this.waitHealthy(p, gen);
      if (ok) {
        const secs = Math.round((Date.now() - this.started) / 1000); this.lastLoadSecs = secs; this.remember(model.id, a, secs);
        setPrio(p, "normal");
        this.note("=== ready in " + secs + " s with " + this.variant + (d ? " + helper" : ""));
        this.state = "ready"; this.onChange(this.json()); return true; }
      lastErr = (this.logTail(600).split("\n").filter(Boolean).pop() || "The model could not be loaded");
      try { p.kill("SIGKILL"); } catch (e) {}
    }
    if (gen !== this.gen) return false;
    this.state = "error"; this.error = lastErr; this.onChange(this.json());
    return false;
  }

  async waitHealthy(p, gen) {
    const t0 = Date.now();
    while (Date.now() - t0 < 10 * 60000) {
      if (gen !== this.gen || p.exitCode !== null) return false;
      try { const r = await fetch(this.baseUrl + "/health"); if (r.ok) return true; } catch (e) {}
      await new Promise((ok) => setTimeout(ok, 300));
    }
    return false;
  }
}

module.exports = { Engine, variants, envFor, EXE, exitReason, phaseOf, orderAttempts };
