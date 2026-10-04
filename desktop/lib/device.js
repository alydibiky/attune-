// What this computer has: memory, cores, CPU features, graphics chips.
// The page reads it through AttuneNative.info() exactly as on the phone,
// with platform "desktop" so the desktop memory thresholds (needRam) apply.
"use strict";
const os = require("os");
const fs = require("fs");
const { execFileSync } = require("child_process");

function cpuFlags() {
  const out = { avx2: false, avx512: false, neon: false, dotprod: false, i8mm: false };
  try {
    if (process.platform === "linux") {
      const t = fs.readFileSync("/proc/cpuinfo", "utf8");
      const flags = (t.match(/^(flags|Features)\s*:(.*)$/m) || [])[2] || "";
      const has = (f) => new RegExp("\\b" + f + "\\b").test(flags);
      out.avx2 = has("avx2"); out.avx512 = has("avx512f");
      out.neon = has("asimd"); out.dotprod = has("asimddp"); out.i8mm = has("i8mm");
    } else if (process.platform === "darwin") {
      if (process.arch === "arm64") { out.neon = out.dotprod = true;
        try { out.i8mm = execFileSync("sysctl", ["-n", "hw.optional.arm.FEAT_I8MM"], { encoding: "utf8" }).trim() === "1"; } catch (e) {} }
      else { try { const f = execFileSync("sysctl", ["-n", "machdep.cpu.leaf7_features"], { encoding: "utf8" });
        out.avx2 = /AVX2/.test(f); out.avx512 = /AVX512F/.test(f); } catch (e) {} }
    } else if (process.platform === "win32") {
      // ggml's CPU backend picks the best variant itself at load time; this is only shown to the person.
      out.avx2 = process.arch === "x64"; out.neon = process.arch === "arm64";
    }
  } catch (e) {}
  return out;
}

// "  Vulkan0: NVIDIA GeForce RTX 4090 (24564 MiB, 23000 MiB free)"
function parseDevices(text) {
  const gpus = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z]+)(\d+):\s*(.+?)\s*\((\d+) MiB,\s*(\d+) MiB free\)/);
    if (!m) continue;
    const name = m[3];
    const vendor = /nvidia|geforce|rtx|quadro/i.test(name) ? "nvidia" : /amd|radeon/i.test(name) ? "amd"
      : /intel|arc|iris|uhd/i.test(name) ? "intel" : /apple|m\d/i.test(name) || m[1] === "MTL" || m[1] === "Metal" ? "apple" : "other";
    gpus.push({ backend: m[1], index: +m[2], name, vendor, totalMiB: +m[4], freeMiB: +m[5] });
  }
  return gpus;
}

let cachedGpus = null;
function listGpus(serverBin, env) {
  if (cachedGpus) return cachedGpus;
  cachedGpus = [];
  if (!serverBin) return cachedGpus;
  try {
    const t = execFileSync(serverBin, ["--list-devices"], { encoding: "utf8", env, timeout: 20000, stdio: ["ignore", "pipe", "pipe"] });
    cachedGpus = parseDevices(t);
  } catch (e) { cachedGpus = parseDevices((e.stdout || "") + (e.stderr || "")); }
  return cachedGpus;
}

function freeStorageBytes(dir) {
  try { const s = fs.statfsSync(dir); return s.bavail * s.bsize; } catch (e) { return 0; }
}

function info(dataDir, gpus, extra) {
  const total = os.totalmem();
  const unified = process.platform === "darwin" && process.arch === "arm64";
  const vramMiB = gpus.reduce((a, g) => Math.max(a, g.totalMiB), 0);
  const f = cpuFlags();
  const cores = os.cpus().length;
  return Object.assign({
    platform: "desktop",
    os: process.platform, arch: process.arch,
    ramGB: Math.round(total / 1073741824),
    totalRamBytes: total, availRamBytes: os.freemem(),
    cores, bigCores: cores,
    genThreads: Math.max(1, Math.min(16, Math.floor(cores / 2))),
    abi: process.arch, model: (os.cpus()[0] || {}).model || "", soc: "",
    dotprod: f.dotprod, i8mm: f.i8mm, avx2: f.avx2, avx512: f.avx512,
    unifiedMemory: unified,
    vramGB: unified ? 0 : Math.round(vramMiB / 1024),
    gpus,
    thermal: 0, thermalHeadroom: 0, powerSave: false, battery: -1, charging: true,
    freeStorageBytes: freeStorageBytes(dataDir),
  }, extra || {});
}

module.exports = { info, listGpus, parseDevices, cpuFlags };
