// Installed models on this computer: <data>/models/<id>/{model.gguf, mmproj.gguf?, meta.json}.
// Downloads resume (.part + HTTP Range), like ModelStore.kt on the phone.
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

class Cancelled extends Error { constructor() { super("cancelled"); } }

const safe = (id) => String(id).replace(/[^A-Za-z0-9._-]/g, "_");
const hex = (s) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 8);

function root(dataDir) { const d = path.join(dataDir, "models"); fs.mkdirSync(d, { recursive: true }); return d; }
function dirFor(dataDir, id) { return path.join(root(dataDir), safe(id)); }

function readMeta(dir) {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(dir, "meta.json"), "utf8"));
    m.modelFile = path.join(dir, "model.gguf");
    const mm = path.join(dir, "mmproj.gguf");
    m.mmproj = fs.existsSync(mm) ? mm : null;
    if (!fs.existsSync(m.modelFile)) return null;
    return m;
  } catch (e) { return null; }
}

function list(dataDir) {
  return fs.readdirSync(root(dataDir)).map((n) => readMeta(path.join(root(dataDir), n))).filter(Boolean)
    .sort((a, b) => a.installedAt - b.installedAt);
}
function get(dataDir, id) { return readMeta(dirFor(dataDir, id)); }
function remove(dataDir, id) {
  const d = dirFor(dataDir, id);
  if (!fs.existsSync(d)) return false;
  fs.rmSync(d, { recursive: true, force: true }); return true;
}
function toJson(m, active) {
  return { id: m.id, label: m.label, quant: m.quant || "", source: m.source || "", sizeBytes: m.sizeBytes || 0,
    mmprojBytes: m.mmprojBytes || 0, vision: !!m.mmproj, engine: "llama", ctx: m.ctx || 8192,
    sha256: m.sha256 || null, installedAt: m.installedAt, active: !!active };
}

// Which files to fetch for "owner/repo:QUANT" (the main GGUF; the photo reader if wanted).
async function resolveHf(repo, quant, vision, fetchImpl) {
  const f = fetchImpl || fetch;
  const r = await f("https://huggingface.co/api/models/" + repo + "/tree/main?recursive=true");
  if (!r.ok) throw new Error("Could not list " + repo + " (HTTP " + r.status + ")");
  const files = (await r.json()).filter((x) => x.type === "file" && /\.gguf$/i.test(x.path));
  const q = quant.toLowerCase();
  const main = files.filter((x) => !/mmproj/i.test(x.path) && x.path.toLowerCase().includes(q))
    .sort((a, b) => a.path.length - b.path.length);
  if (!main.length) throw new Error("No " + quant + " file in " + repo);
  const parts = main[0].path.match(/-0000\d-of-0000\d\.gguf$/i)
    ? main.filter((x) => x.path.replace(/-0000\d-of-/i, "-") === main[0].path.replace(/-0000\d-of-/i, "-")) : [main[0]];
  if (parts.length > 1) throw new Error("Split GGUF files are not supported yet");
  const mm = vision ? files.filter((x) => /mmproj/i.test(x.path)).sort((a, b) => (/f16/i.test(b.path) - /f16/i.test(a.path)))[0] : null;
  const url = (p) => "https://huggingface.co/" + repo + "/resolve/main/" + p;
  return { model: { url: url(main[0].path), size: main[0].size || 0 }, mmproj: mm ? { url: url(mm.path), size: mm.size || 0 } : null };
}

async function download(url, dest, onBytes, cancelled, fetchImpl) {
  const f = fetchImpl || fetch;
  const part = dest + ".part";
  let have = fs.existsSync(part) ? fs.statSync(part).size : 0;
  const ctl = new AbortController();
  const timer = setInterval(() => { if (cancelled()) ctl.abort(); }, 250);
  try {
    const r = await f(url, { headers: have ? { Range: "bytes=" + have + "-" } : {}, signal: ctl.signal, redirect: "follow" });
    if (r.status === 200) have = 0; else if (r.status !== 206) throw new Error("Download failed: HTTP " + r.status);
    const out = fs.createWriteStream(part, { flags: have ? "a" : "w" });
    let done = have;
    try {
      for await (const chunk of r.body) {
        if (cancelled()) throw new Cancelled();
        if (!out.write(chunk)) await new Promise((ok) => out.once("drain", ok));
        done += chunk.length; onBytes(done);
      }
    } finally { await new Promise((ok) => out.end(ok)); }
    fs.renameSync(part, dest);
    return done;
  } catch (e) {
    if (cancelled() || e.name === "AbortError") throw new Cancelled();
    throw e;
  } finally { clearInterval(timer); }
}

/** a: {repo,quant,vision?,id?,label?,ctx?} | {spec:"owner/repo:QUANT"} | {url,mmprojUrl?} | {path} (a GGUF already on this computer). */
async function install(dataDir, a, onProgress, cancelled, fetchImpl) {
  let repo = a.repo || "", quant = a.quant || "";
  if (a.spec && a.spec.includes(":") && !/^https?:/.test(a.spec)) { [repo, quant] = a.spec.split(":").map((s) => s.trim()); }
  let id, label, source, plan = null;
  if (a.path) {
    if (!fs.existsSync(a.path)) throw new Error("File not found: " + a.path);
    id = a.id || "local-" + hex(a.path); label = a.label || path.basename(a.path, ".gguf"); source = a.path;
  } else if (/^https:\/\//.test(a.url || "")) {
    plan = { model: { url: a.url, size: 0 }, mmproj: a.mmprojUrl ? { url: a.mmprojUrl, size: 0 } : null };
    id = a.id || "custom-" + hex(a.url); label = a.label || a.url.split("/").pop().split("?")[0]; source = a.url;
  } else {
    if (!repo.includes("/") || !quant) throw new Error("Give a Hugging Face repo and a quantization, like unsloth/Qwen3.5-4B-GGUF:Q4_K_M");
    onProgress(0, "Finding the files", "");
    try { plan = await resolveHf(repo, quant, a.vision !== false, fetchImpl); }
    catch (e) { if (/-MTP-GGUF/.test(repo)) plan = await resolveHf(repo.replace("-MTP-GGUF", "-GGUF"), quant, a.vision !== false, fetchImpl); else throw e; }
    id = a.id || "hf-" + hex(repo + ":" + quant); label = a.label || repo.split("/")[1] + " " + quant; source = repo + ":" + quant;
  }
  const dir = dirFor(dataDir, id);
  fs.mkdirSync(dir, { recursive: true });
  const modelFile = path.join(dir, "model.gguf");
  let sizeBytes = 0, mmprojBytes = 0;
  if (a.path) {
    onProgress(10, "Copying the model", "");
    fs.copyFileSync(a.path, modelFile);
    sizeBytes = fs.statSync(modelFile).size;
    if (a.mmprojPath) { fs.copyFileSync(a.mmprojPath, path.join(dir, "mmproj.gguf")); mmprojBytes = fs.statSync(path.join(dir, "mmproj.gguf")).size; }
  } else {
    const total = (plan.model.size || 0) + (plan.mmproj ? plan.mmproj.size || 0 : 0);
    const report = (done) => {
      const pct = total > 0 ? Math.min(99, Math.floor(done * 100 / total)) : 0;
      onProgress(pct, "Downloading", (done / 1e9).toFixed(2) + " / " + (total / 1e9).toFixed(2) + " GB");
    };
    if (!fs.existsSync(modelFile)) sizeBytes = await download(plan.model.url, modelFile, report, cancelled, fetchImpl);
    else sizeBytes = fs.statSync(modelFile).size;
    if (plan.mmproj) {
      const mmFile = path.join(dir, "mmproj.gguf");
      if (!fs.existsSync(mmFile)) mmprojBytes = await download(plan.mmproj.url, mmFile, (d) => report(sizeBytes + d), cancelled, fetchImpl);
    }
  }
  const meta = { id, label, quant, source, sizeBytes, mmprojBytes, ctx: a.ctx || 8192, installedAt: Date.now() };
  fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify(meta, null, 1));
  return readMeta(dir);
}

module.exports = { list, get, remove, install, toJson, resolveHf, Cancelled, root };
