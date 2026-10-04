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

function freePort() {
  return new Promise((ok, bad) => {
    const s = net.createServer(); s.unref();
    s.on("error", bad);
    s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => ok(p)); });
  });
}

class Engine {
  constructor(opts) {
    this.engineRoots = opts.engineRoots; this.logFile = opts.logFile; this.onChange = opts.onChange || (() => {});
    this.state = "idle"; this.error = null; this.modelId = null; this.proc = null; this.port = 0;
    this.apiKey = crypto.randomBytes(16).toString("hex"); this.started = 0; this.variant = null; this.gen = 0;
  }
  get baseUrl() { return "http://127.0.0.1:" + this.port; }
  binary() { const v = variants(this.engineRoots)[0]; return v ? { bin: path.join(v.dir, EXE), env: envFor(v.dir) } : null; }
  json() {
    return { state: this.state, error: this.error, modelId: this.modelId, port: this.port,
      loadingFor: this.started && this.state === "starting" ? Math.round((Date.now() - this.started) / 1000) : 0,
      phase: this.state === "starting" ? "Reading the model file" : "", heavy: false, thermal: 0,
      engine: "llama", backend: this.variant || "" };
  }
  logTail(n) { try { const t = fs.readFileSync(this.logFile, "utf8"); return t.slice(-(n || 8000)); } catch (e) { return ""; } }

  args(model, info, gpu) {
    const a = ["-m", model.modelFile, "--host", "127.0.0.1", "--port", String(this.port), "--api-key", this.apiKey,
      "-c", String(model.ctx || 8192), "-t", String(info.genThreads || 4), "-np", "1",
      "--cache-reuse", "256", "--cache-ram", "0", "--jinja", "--no-slots", "--threads-http", "2",
      "--cors-headers", "Authorization,Content-Type", "--cors-origins", "app://attune"];
    if (gpu) a.push("-fa", "auto", "--fit", "on");   // llama.cpp puts as many layers on the graphics chip as fit, the rest in RAM
    else a.push("--device", "none", "-ngl", "0", "-fa", "on", "-ctk", "q8_0", "-ctv", "q8_0");
    if (model.mmproj) a.push("--mmproj", model.mmproj);
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

  async start(model, info) {
    await this.stop();
    const gen = this.gen;
    this.state = "starting"; this.error = null; this.modelId = model.id; this.started = Date.now(); this.onChange(this.json());
    const vs = variants(this.engineRoots);
    if (!vs.length) { this.state = "error"; this.error = "The model engine is missing from this install"; this.onChange(this.json()); return false; }
    let lastErr = "";
    // Each engine folder: first with the graphics chip, then (if that will not start) CPU only.
    const attempts = [];
    for (const v of vs) { if (v.name !== "cpu" && !process.env.ATTUNE_CPU_ONLY) attempts.push({ v, gpu: true }); attempts.push({ v, gpu: false }); }
    for (const { v, gpu } of attempts) {
      if (gen !== this.gen) return false;
      this.port = await freePort();
      const log = fs.openSync(this.logFile, "a");
      fs.writeSync(log, "\n=== " + new Date().toISOString() + " start " + model.id + " with " + v.name + "\n");
      const p = spawn(path.join(v.dir, EXE), this.args(model, info, gpu), { env: envFor(v.dir), stdio: ["ignore", log, log], windowsHide: true });
      fs.closeSync(log);
      this.proc = p; this.variant = v.name + (gpu ? "" : " (CPU)");
      const ok = await this.waitHealthy(p, gen);
      if (ok) { this.state = "ready"; this.onChange(this.json()); return true; }
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

module.exports = { Engine, variants, envFor, EXE };
