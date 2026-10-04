// Headless smoke test of the desktop app, no graphics chip needed.
//   node test/smoke.js [model.gguf] [path-to-app-binary]
// Env: ATTUNE_LLAMA_DIR = folder with llama-server (else the app's bundled engine/ is used).
// On Linux without a screen, run it under xvfb-run (CI) — or it falls back to the headless ozone platform.
"use strict";
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const model = path.resolve(process.argv[2] || process.env.SMOKE_MODEL || "/home/user/models/q08.gguf");
const appBin = process.argv[3] || process.env.SMOKE_APP || "";
if (!fs.existsSync(model)) { console.error("no model at " + model); process.exit(2); }
const home = fs.mkdtempSync(path.join(os.tmpdir(), "attune-smoke-"));
const env = Object.assign({}, process.env, { ATTUNE_SMOKE: model, ATTUNE_HOME: home, ELECTRON_ENABLE_LOGGING: "0" });
let cmd, args;
if (appBin) { cmd = appBin; args = []; }
else { cmd = require("electron"); args = [path.join(__dirname, "..")]; }
if (process.platform === "linux") {
  args.push("--no-sandbox");
  if (!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) args.push("--ozone-platform=headless");
}
const p = spawn(cmd, args, { env, stdio: ["ignore", "pipe", "pipe"] });
let out = "";
p.stdout.on("data", (d) => { out += d; });
p.stderr.on("data", (d) => { if (process.env.SMOKE_VERBOSE) process.stderr.write(d); });
p.on("exit", (code) => {
  const line = out.split("\n").find((l) => l.startsWith("SMOKE_RESULT "));
  const r = line ? JSON.parse(line.slice(13)) : { ok: false, error: "no result; exit " + code };
  console.log(JSON.stringify(r, null, 1));
  if (!r.ok) { try { console.log("--- engine log ---\n" + fs.readFileSync(path.join(home, "engine.log"), "utf8").slice(-3000)); } catch (e) {} }
  try { fs.rmSync(home, { recursive: true, force: true }); } catch (e) {}
  console.log(r.ok ? "SMOKE PASS" : "SMOKE FAIL");
  process.exit(r.ok ? 0 : 1);
});
