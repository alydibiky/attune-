// window.AttuneNative for the desktop: the same object the Android app gives the page
// (NativeBridge.kt). Quick calls answer at once (sync IPC); slow ones take an id and answer
// later through window.__attuneNative.resolve/reject/progress/delta, sent by main.js.
// Only methods that really work here are exposed: the page checks `NATIVE.listen` etc.
"use strict";
const { contextBridge, ipcRenderer } = require("electron");

const QUICK = ["info", "models", "engine", "log", "remove", "wake", "setAirGap", "setTextZoom", "keepAwake",
  "cancel", "logLine", "netLog", "clearNetLog", "stashPut", "stashGet", "stashDel", "share"];
const SLOW = ["chat", "install", "use", "restart", "fetchJson", "saveFile"];

const api = { desktop: true };
for (const m of QUICK) api[m] = (...a) => ipcRenderer.sendSync("native-quick", m, a);
for (const m of SLOW) api[m] = (id, arg) => { ipcRenderer.send("native-slow", m, id, arg); };

contextBridge.exposeInMainWorld("AttuneNative", api);
contextBridge.exposeInMainWorld("__attuneDesktop", { os: process.platform, arch: process.arch });
