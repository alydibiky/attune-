// Attune desktop: one window showing the same web app the phone shows, with the
// phone's bridge (AttuneNative) implemented here on top of llama-server.
//   page  --sync/async IPC-->  main.js  --HTTP 127.0.0.1-->  llama-server (child process)
// Data lives in the per-user app-data folder (ATTUNE_HOME overrides it):
//   Windows %APPDATA%\Attune  ·  macOS ~/Library/Application Support/Attune  ·  Linux ~/.config/Attune
"use strict";
const { app, BrowserWindow, ipcMain, protocol, net, dialog, clipboard, shell, powerSaveBlocker, nativeImage, Notification, safeStorage } = require("electron");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const models = require("./lib/models");
const device = require("./lib/device");
const { Engine } = require("./lib/engine");
const { makeWeb } = require("./lib/web");
const { makePacks, Cancelled } = require("./lib/packs");
const { makePdf } = require("./lib/pdf");
const { makeReminders } = require("./lib/reminders");

if (process.env.ATTUNE_HOME) app.setPath("userData", process.env.ATTUNE_HOME);
const DATA = app.getPath("userData");
fs.mkdirSync(DATA, { recursive: true });
const SMOKE = process.env.ATTUNE_SMOKE || "";

// The built web app: next to the app when packaged, the repo's Android assets when run from source.
const WWW = [path.join(process.resourcesPath || "", "www"), path.join(__dirname, "..", "app", "src", "main", "assets", "www")]
  .find((d) => fs.existsSync(path.join(d, "index.html")));
const ENGINE_ROOTS = [path.join(process.resourcesPath || "", "engine"), path.join(__dirname, "engine"), path.join(DATA, "engine")];

const STATE_FILE = path.join(DATA, "state.json");
const state = (() => { try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); } catch (e) { return {}; } })();
const saveState = () => { try { fs.writeFileSync(STATE_FILE, JSON.stringify(state)); } catch (e) {} };

let win = null;
const js = (code) => { if (win && !win.isDestroyed()) win.webContents.executeJavaScript(code, true).catch(() => {}); };
const q = (s) => JSON.stringify(String(s));
const resolve = (id, obj) => js("window.__attuneNative&&window.__attuneNative.resolve(" + q(id) + "," + q(JSON.stringify(obj)) + ")");
const reject = (id, msg) => js("window.__attuneNative&&window.__attuneNative.reject(" + q(id) + "," + q(msg) + ")");
const progress = (id, pct, stage, detail) => js("window.__attuneNative&&window.__attuneNative.progress(" + q(id) + "," + pct + "," + q(stage) + "," + q(detail) + ")");
const delta = (id, c, r) => js("window.__attuneNative&&window.__attuneNative.delta(" + q(id) + "," + q(c) + "," + q(r) + ")");

const engine = new Engine({ engineRoots: ENGINE_ROOTS, logFile: path.join(DATA, "engine.log"),
  onChange: (e) => js("window.dispatchEvent(new CustomEvent('attune-engine',{detail:" + JSON.stringify(e) + "}))") });

const netLog = [];
const logNet = (host, ok, why) => { netLog.push({ t: Date.now(), host, ok, why }); if (netLog.length > 200) netLog.shift(); };

// Every request to the internet passes here: the offline lock stops it, and the Connections log records it.
function online(url, why) {
  let host = ""; try { host = new URL(url).hostname; } catch (e) {}
  if (state.airGap) { logNet(host, false, why + " (offline lock)"); throw new Error("Offline lock is on — " + why + " needs the internet. Turn the lock off in Engine first."); }
  logNet(host, true, why);
}
// a picture from a search result → a small JPEG data: URL (320 px wide); the page never loads anything from the web
async function thumb(src) {
  try {
    online(src, "a picture from a search result");
    const r = await net.fetch(src); if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer()); if (buf.length > 3_000_000) return null;
    const img = nativeImage.createFromBuffer(buf); const sz = img.getSize();
    if (img.isEmpty() || sz.width < 200 || sz.height < 120) return null;
    const out = img.resize({ width: 320, quality: "good" });
    return "data:image/jpeg;base64," + out.toJPEG(72).toString("base64");
  } catch (e) { return null; }
}
const web = makeWeb({ online, thumb, fetch: (u, o) => net.fetch(u, o) });
const packs = makePacks({ data: DATA, online, fetch: (u, o) => net.fetch(u, o) });

// Reminders: a system notification at the time; clicking it opens Attune at that reminder (as on the phone)
const reminders = makeReminders({ data: DATA, notify: (r) => {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title: r.title || "Attune", body: r.body || "" });
  n.on("click", () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
    js("window.dispatchEvent(new CustomEvent('attune-share',{detail:" + JSON.stringify({ kind: "reminder", id: r.id }) + "}))"); });
  n.show();
} });

let gpus = null;
function info() {
  if (!gpus) { const b = engine.binary(); gpus = b ? device.listGpus(b.bin, b.env) : []; }
  return device.info(DATA, gpus, { airGap: !!state.airGap, desktopShell: "electron", appVersion: app.getVersion(), packSearch: packs.canSearch });
}
const activeModel = () => (state.active && models.get(DATA, state.active)) || models.list(DATA).slice(-1)[0] || null;

const cancels = new Map();
let awake = null;

// ---- quick calls: answer at once ------------------------------------------------
const localsync = require("./lib/localsync.js");
const { makeDrive } = require("./lib/gdrive.js");   // v6.45 Google sync on the computer (the phone's one file in the hidden app folder)
const drive = makeDrive({ dataDir: DATA, openExternal: (u) => shell.openExternal(u), safe: safeStorage });   // v6.37 Wi-Fi sync with a phone (the same protocol as LocalSync.kt)
const QUICK = {
  driveReady: () => drive.ready(),
  localNetAllowed: () => true,
  syncHostTake: () => localsync.take(),
  syncHostAnswer: (t) => { localsync.answer(t); return "ok"; },
  syncHostStop: () => { localsync.stop(); return "ok"; },
  info: () => JSON.stringify(info()),
  models: () => JSON.stringify({ models: models.list(DATA).map((m) => models.toJson(m, m.id === state.active)), active: state.active || null }),
  engine: () => JSON.stringify(engine.json()),
  log: () => engine.logTail(8000),
  remove: (id) => { if (engine.modelId === id) engine.stop(); if (state.active === id) { state.active = null; saveState(); } return models.remove(DATA, id); },
  wake: () => {
    if (engine.state === "ready") return "ready";
    if (engine.state === "starting") return "starting";
    const m = activeModel(); if (!m) return "none";
    state.active = m.id; saveState(); engine.start(m, info()); return "starting";
  },
  setAirGap: (on) => { state.airGap = !!on; saveState(); },
  setTextZoom: (pct) => { if (win) win.webContents.setZoomFactor(Math.max(0.5, Math.min(3, (+pct || 100) / 100))); },
  keepAwake: (on) => {
    if (on && awake === null) awake = powerSaveBlocker.start("prevent-app-suspension");
    if (!on && awake !== null) { powerSaveBlocker.stop(awake); awake = null; }
  },
  cancel: (id) => { const c = cancels.get(id); if (c) c.cancelled = true; if (c && c.ctl) c.ctl.abort(); },
  logLine: (t) => { try { fs.appendFileSync(path.join(DATA, "app.log"), new Date().toISOString() + " " + t + "\n"); } catch (e) {} },
  netLog: () => JSON.stringify(netLog),
  clearNetLog: () => { netLog.length = 0; },
  stashPut: (name, text) => { if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(name)) return false; fs.mkdirSync(path.join(DATA, "stash"), { recursive: true }); fs.writeFileSync(path.join(DATA, "stash", name), text); return true; },
  stashGet: (name) => { try { return /^[a-z0-9][a-z0-9._-]{0,63}$/.test(name) ? fs.readFileSync(path.join(DATA, "stash", name), "utf8") : ""; } catch (e) { return ""; } },
  stashDel: (name) => { try { fs.unlinkSync(path.join(DATA, "stash", name)); return true; } catch (e) { return false; } },
  share: (text) => { clipboard.writeText(String(text || "")); },   // a computer has no share sheet: copy it
  unmetered: () => true,
  schedule: (json) => { try { return JSON.stringify({ ok: reminders.schedule(JSON.parse(json)), exact: true, notify: Notification.isSupported() }); } catch (e) { return JSON.stringify({ ok: false, error: e.message }); } },
  unschedule: (id) => reminders.unschedule(id),
  scheduled: () => JSON.stringify(reminders.all()),
  canExact: () => true,
  notifyAllowed: () => Notification.isSupported(),
  askNotifications: () => {},
  askExact: () => {},                                            // a computer's connection: big downloads don't wait
  knowPacks: () => JSON.stringify({ packs: packs.knowList() }),
  knowRemove: (id) => packs.knowRemove(id),
  mapPacks: () => JSON.stringify({ packs: packs.mapList(), assets: packs.assetsInstalled() }),
  mapRemove: (code) => packs.mapRemove(code),
  mapRead: (arg) => { try { return packs.mapRead(JSON.parse(arg)); } catch (e) { return ""; } },
};

// ---- slow calls: answer later by id ---------------------------------------------
async function chat(id, body) {
  const c = { cancelled: false, ctl: new AbortController() }; cancels.set(id, c);
  try {
    if (engine.state === "starting") throw new Error("Still loading");
    if (engine.state !== "ready") throw new Error(engine.error || "The model is not running yet — open Engine");
    const req = JSON.parse(body);
    const r = await fetch(engine.baseUrl + "/v1/chat/completions", { method: "POST", signal: c.ctl.signal,
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + engine.apiKey }, body });
    if (!r.ok) {
      const t = await r.text(); let msg = ""; try { msg = JSON.parse(t).error.message; } catch (e) {}
      throw new Error(msg || "The model returned HTTP " + r.status);
    }
    if (!req.stream) return resolve(id, await r.json());
    let content = "", reasoning = "", pc = "", pr = "", stats = null, last = 0, buf = "";
    const dec = new TextDecoder();
    outer: for await (const chunk of r.body) {
      buf += dec.decode(chunk, { stream: true });
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") break outer;
        let j; try { j = JSON.parse(data); } catch (e) { continue; }
        if (j.timings || j.usage) stats = j;
        const d = j.choices && j.choices[0] && j.choices[0].delta; if (!d) continue;
        const cc = d.content || "", rr = d.reasoning_content || "";
        if (!cc && !rr) continue;
        content += cc; reasoning += rr; pc += cc; pr += rr;
        if (Date.now() - last > 60) { delta(id, pc, pr); pc = pr = ""; last = Date.now(); }
      }
    }
    if (pc || pr) delta(id, pc, pr);
    const out = { content, reasoning };
    if (stats && stats.timings) out.timings = stats.timings;
    if (stats && stats.usage) out.usage = stats.usage;
    resolve(id, out);
  } catch (e) {
    reject(id, c.cancelled ? "Stopped" : (e.message || "The model failed"));
  } finally { cancels.delete(id); }
}

async function useModel(id, modelId) {
  const m = models.get(DATA, modelId);
  if (!m) return reject(id, "That model is not installed");
  state.active = m.id; saveState();
  const ok = await engine.start(m, info());
  if (ok) resolve(id, { ok: true, model: models.toJson(m, true), engine: engine.json() });
  else reject(id, engine.error || "The model could not be loaded");
}

// one download per pack: a second call for the same pack joins the one running (as on the phone)
const packJobs = new Map();
function joined(key, id, run) {
  const job = packJobs.get(key);
  if (job) { job.ids.push(id); cancels.set(id, job.flag); progress(id, 0, "", ""); return; }
  const flag = { cancelled: false }; const j = { ids: [id], flag }; packJobs.set(key, j); cancels.set(id, flag);
  const mb = (n) => (n / 1e6).toFixed(1);
  run((done, total, name) => { const pct = total > 0 ? Math.max(0, Math.min(99, Math.floor(done * 100 / total))) : 0; for (const c of j.ids) progress(c, pct, name, mb(done) + " / " + mb(total) + " MB"); }, () => flag.cancelled)
    .then((v) => { for (const c of j.ids) resolve(c, v); })
    .catch((e) => { for (const c of j.ids) reject(c, e instanceof Cancelled ? "Download paused — it continues where it stopped next time." : (e.message || "Download failed")); })
    .finally(() => { packJobs.delete(key); for (const c of j.ids) cancels.delete(c); });
}
let pdfTools = null;
const pdf = () => (pdfTools = pdfTools || makePdf({ BrowserWindow, nativeImage }));
const viaJson = (f) => async (id, arg) => { try { resolve(id, await f(JSON.parse(arg || "{}"))); } catch (e) { reject(id, e.message || String(e)); } };
const SLOW = {
  chat,
  syncHostBegin: viaJson(() => localsync.start()),
  syncExchange: viaJson(async (a) => ({ text: await localsync.exchange(a.host, +a.port, a.body) })),
  driveSync: viaJson(async (a) => {
    if (state.airGap) throw new Error("Offline lock is on — Google sync needs the internet. Turn the lock off in Engine first.");
    logNet("www.googleapis.com", true, a.op === "put" ? "Google sync: upload your encrypted file" : "Google sync: read your encrypted file");
    return drive.sync(a);
  }),
  search: viaJson((a) => web.search(a)),
  async clipboardText(id) { resolve(id, { text: clipboard.readText() || "" }); },
  async hash(id, modelId) {
    try { const m = models.get(DATA, modelId); if (!m) return reject(id, "That model is not installed"); resolve(id, { id: modelId, sha256: await packs.sha256(m.modelFile) }); }
    catch (e) { reject(id, e.message || "Could not read the model"); }
  },
  // PDFs (lib/pdf.js): reading in a hidden pdf.js window, printing with Chromium, editing with pdf-lib
  pdfText: viaJson((a) => pdf().read("pdfText", a)),
  pdfWords: viaJson((a) => pdf().read("pdfWords", a)),
  pdfOutline: viaJson((a) => pdf().read("pdfOutline", a)),
  pdfImages: viaJson((a) => pdf().read("pdfImages", a)),
  htmlToPdf: viaJson((a) => pdf().htmlToPdf(a)),
  makePdf: viaJson((a) => pdf().makeFile(a)),
  pdfEdit: viaJson((a) => pdf().pdfEdit(a)),
  news: viaJson((a) => web.news(a)),
  async fetchText(id, url) {
    try { const t = await web.pageText(url, 12000); if (!t) reject(id, "Could not read that page"); else resolve(id, { url, text: t }); } catch (e) { reject(id, e.message); }
  },
  async fetchShare(id, url) {
    // the raw page of a conversation shared from another AI — only these hosts (as on the phone)
    if (!/^https:\/\/(share\.gemini\.google|gemini\.google\.com|g\.co|chatgpt\.com|chat\.openai\.com|claude\.ai|(www\.)?perplexity\.ai|grok\.com|x\.com|copilot\.microsoft\.com|chat\.deepseek\.com|poe\.com|(www\.)?meta\.ai)\//.test(url)) return reject(id, "Only links shared from an AI chat can be read here");
    try {
      online(url, "a shared AI conversation");
      const r = await net.fetch(url, { headers: { "Accept-Language": "en,ar;q=0.8" } });
      if (!r.ok) return reject(id, "The page answered HTTP " + r.status);
      resolve(id, { url: r.url || url, html: (await r.text()).slice(0, 4_000_000) });
    } catch (e) { reject(id, e.message || "Couldn't open the link"); }
  },
  async dorarSearch(id, q) {
    try {
      const url = "https://dorar.net/dorar_api.json?skey=" + encodeURIComponent(String(q).slice(0, 200));
      online(url, "Dorar (الدرر السنية)");
      const r = await net.fetch(url, { headers: { Accept: "application/json" } });
      if (!r.ok) return reject(id, "Dorar answered HTTP " + r.status);
      resolve(id, { body: (await r.text()).slice(0, 2_000_000) });
    } catch (e) { reject(id, e.message || "Couldn't reach Dorar"); }
  },
  async fxRates(id) {
    try {
      const url = "https://open.er-api.com/v6/latest/USD"; online(url, "exchange rates");
      const r = await net.fetch(url); if (!r.ok) return reject(id, "Exchange rates answered HTTP " + r.status);
      resolve(id, { body: (await r.text()).slice(0, 200_000) });
    } catch (e) { reject(id, e.message || "Couldn't get exchange rates"); }
  },
  knowRemote: viaJson((a) => packs.knowRemote(a.id)),
  knowSearch: viaJson(async (a) => packs.knowSearch(a)),
  knowInstall(id, arg) { let a; try { a = JSON.parse(arg); } catch (e) { return reject(id, "Unknown pack"); } joined("know:" + a.id, id, (p, c) => packs.knowInstall(a.id, p, c)); },
  knowPackText: viaJson(async (a) => ({ name: a.name, text: await packs.knowPackText(a.tag, a.name) })),
  async foodPackText(id, name) { try { resolve(id, { name, text: await packs.foodPackText(name) }); } catch (e) { reject(id, e.message || "Couldn't download the food pack"); } },
  mapRemote: viaJson((a) => packs.mapRemote(a.code)),
  mapRange: viaJson((a) => packs.mapRange(a)),
  mapAssets: viaJson(() => packs.mapAssets()),
  mapSearch: viaJson(async (a) => ({ places: packs.mapSearch(a) })),
  mapInstall(id, arg) {
    let a; try { a = JSON.parse(arg); } catch (e) { return reject(id, "Unknown map"); }
    joined("map:" + a.code, id, (p, c) => (a.routesOnly ? packs.mapInstallRoutes(a.code, p, c) : packs.mapInstall(a.code, p, c, !!a.routes)));
  },
  async install(id, arg) {
    const a = JSON.parse(arg || "{}");
    if (state.airGap && !a.path) return reject(id, "Offline lock is on — downloading a model needs the internet. Turn the lock off in Engine first.");
    const c = { cancelled: false }; cancels.set(id, c);
    try {
      if (!a.path) logNet("huggingface.co", true, "model download");
      const m = await models.install(DATA, a, (pct, stage, detail) => progress(id, pct, stage, detail), () => c.cancelled);
      if (a.draft) { state.draft = m.id; saveState(); return resolve(id, { ok: true, draft: models.toJson(m, false) }); }
      progress(id, 99, "Loading the model", "");
      await useModel(id, m.id);
    } catch (e) {
      reject(id, e instanceof models.Cancelled ? "Download cancelled — it will resume where it stopped if you start it again." : (e.message || "Install failed"));
    } finally { cancels.delete(id); }
  },
  use: (id, modelId) => useModel(id, modelId),
  restart: (id) => { const m = activeModel(); return m ? useModel(id, m.id) : reject(id, "No model installed yet"); },
  async fetchJson(id, url) {
    if (state.airGap) return reject(id, "Offline lock is on — the food database needs the internet. Turn the lock off in Engine first.");
    try {
      const host = new URL(url).hostname;
      if (!/(^|\.)openfoodfacts\.org$|(^|\.)nal\.usda\.gov$|^api\.nal\.usda\.gov$/.test(host)) { logNet(host, false, "not allowed"); throw new Error("Only the food databases can be asked"); }
      logNet(host, true, "food database");
      const r = await fetch(url, { headers: { "User-Agent": "Attune/1.0 (desktop)" } });
      resolve(id, { url, body: await r.text() });
    } catch (e) { reject(id, e.message || "Couldn't reach the food database"); }
  },
  async saveFile(id, arg) {
    const a = JSON.parse(arg || "{}");
    const name = String(a.name || "Attune-backup.attune").replace(/[\\/:*?"<>|]/g, "_");
    const r = await dialog.showSaveDialog(win, { defaultPath: name });
    if (r.canceled || !r.filePath) return reject(id, "Cancelled");
    try { fs.writeFileSync(r.filePath, a.b64 ? Buffer.from(a.b64, "base64") : String(a.text || "")); resolve(id, { ok: true, name: path.basename(r.filePath) }); }
    catch (e) { reject(id, "Could not write the file: " + e.message); }
  },
};

ipcMain.on("native-quick", (ev, method, args) => {
  try { const f = QUICK[method]; const v = f ? f(...(args || [])) : null; ev.returnValue = v === undefined ? null : v; }
  catch (e) { ev.returnValue = null; }
});
ipcMain.on("native-slow", (ev, method, id, arg) => {
  const f = SLOW[method];
  if (!f) return reject(id, "Not available on the desktop yet");
  Promise.resolve().then(() => f(id, arg)).catch((e) => reject(id, e.message || String(e)));
});

protocol.registerSchemesAsPrivileged([{ scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }]);
if (SMOKE) app.commandLine.appendSwitch("no-sandbox");

// One Attune at a time: opening it again (shortcut, Start menu, a file) brings the open window to the front instead of
// starting a second window with a second model engine (Ali: "it keeps building up tabs in the desktop").
const PRIMARY = !!SMOKE || app.requestSingleInstanceLock();
if (!PRIMARY) app.quit();
app.on("second-instance", () => { if (win && !win.isDestroyed()) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });

app.whenReady().then(() => {
  if (!PRIMARY) return;
  protocol.handle("app", (req) => {
    const u = new URL(req.url);
    // the PDF reader's hidden window and pdf.js itself
    // (read with fs: these live inside the app's archive once packaged)
    if (u.pathname === "/__pdf/worker.html") return new Response(fs.readFileSync(path.join(__dirname, "pdfworker.html")), { headers: { "Content-Type": "text/html; charset=utf-8" } });
    if (u.pathname.startsWith("/__pdf/build/")) {
      const name = path.basename(u.pathname);
      if (!/^pdf(\.worker)?\.mjs$/.test(name)) return new Response("Not found", { status: 404 });
      const file = path.join(path.dirname(require.resolve("pdfjs-dist/package.json")), "legacy", "build", name);
      return new Response(fs.readFileSync(file), { headers: { "Content-Type": "text/javascript; charset=utf-8" } });
    }
    const rel = decodeURIComponent(u.pathname).replace(/^\/+/, "") || "index.html";
    const file = path.normalize(path.join(WWW, rel));
    if (!file.startsWith(path.normalize(WWW))) return new Response("Not found", { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  win = new BrowserWindow({ width: 1280, height: 860, show: !SMOKE, title: "Attune", backgroundColor: "#0b1020",
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: false } });
  // Links open in the person's browser, never inside the app window.
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: "deny" }; });
  win.webContents.on("will-navigate", (e, url) => { if (!url.startsWith("app://attune/")) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
  // Back on a computer: the mouse's back button and the keyboard's Back key arrive as app commands (Windows)
  win.on("app-command", (e, cmd) => { if (cmd === "browser-backward") js("window.dispatchEvent(new Event('attune-back'))"); });
  win.loadURL("app://attune/index.html");
  reminders.rearmAll();
  if (!SMOKE) { const m = activeModel(); if (m) { state.active = m.id; engine.start(m, info()); } }
  if (SMOKE) require("./test/smoke-run")(win, SMOKE, app, DATA);
});
app.on("window-all-closed", () => { engine.stop().finally(() => app.quit()); });
app.on("before-quit", () => { if (engine.proc) try { engine.proc.kill(); } catch (e) {} });
