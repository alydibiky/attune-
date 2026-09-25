// The Python sandbox: CPython (Pyodide) in a Web Worker.
//
// A worker has no page, no storage and no bridge to the phone. On top of
// that, the network is cut: only this app's own files (the Python runtime and
// its bundled packages) can be loaded. Code written by the model can compute,
// print and fail — nothing else. The page can stop it at any moment by
// terminating the worker.
const ORIGIN = self.location.origin;
const realFetch = self.fetch.bind(self);
const offline = () => { throw new Error("No internet in the sandbox — the code runs offline on the phone."); };
self.fetch = (u, o) => {
  const url = new URL(typeof u === "string" ? u : (u && u.url) || String(u), self.location.href);
  if (url.origin !== ORIGIN) return Promise.reject(new TypeError("No internet in the sandbox — the code runs offline on the phone."));
  return realFetch(u, o);
};
for (const k of ["XMLHttpRequest", "WebSocket", "EventSource", "WebTransport"]) {
  try { Object.defineProperty(self, k, { value: function () { offline(); }, configurable: false, writable: false }); } catch (e) {}
}

let py = null;
let out = [], err = [], size = 0;
const LIMIT = 40000;
// (the arrays are replaced for every run, so look them up at write time)
const push = (which) => (s) => { if (size > LIMIT) return; size += s.length + 1; (which === "out" ? out : err).push(s); };

const ready = (async () => {
  const { loadPyodide } = await import("../py/pyodide.mjs");
  const t0 = performance.now();
  py = await loadPyodide({ indexURL: new URL("../py/", import.meta.url).href, stdin: () => null });
  py.setStdout({ batched: push("out") });
  py.setStderr({ batched: push("err") });
  // Code runs from a clean namespace each time, in a scratch folder.
  py.runPython("import os, sys\nos.makedirs('/work', exist_ok=True)\nos.chdir('/work')\nsys.setrecursionlimit(3000)");
  return performance.now() - t0;
})();
ready.then((ms) => self.postMessage({ type: "ready", ms: Math.round(ms), version: py.version }),
           (e) => self.postMessage({ type: "ready", error: String((e && e.message) || e) }));

self.onmessage = async (e) => {
  const { id, code, stdin, files } = e.data || {};
  try { await ready; } catch (x) { self.postMessage({ id, ok: false, error: "Python could not start: " + String((x && x.message) || x) }); return; }
  out = []; err = []; size = 0;
  const lines = String(stdin || "").split("\n"); let li = 0;
  py.setStdin({ stdin: () => (li < lines.length && (stdin || "").length ? lines[li++] : null) });
  const t0 = performance.now();
  let ns;
  try {
    // Files the person attached (a spreadsheet, a CSV…) are put in the
    // program's folder, so it can simply open("sales.xlsx").
    for (const f of files || []) {
      const bin = Uint8Array.from(atob(f.b64), (c) => c.charCodeAt(0));
      py.FS.writeFile("/work/" + String(f.name).replace(/[\/]/g, "_"), bin);
    }
    // numpy / pandas / sympy load on first import, from the app's own files;
    // pandas needs openpyxl for .xlsx without importing it by name.
    await py.loadPackagesFromImports(code, { messageCallback: () => {}, errorCallback: (m) => err.push(m) });
    if (/read_excel|\.xlsx|openpyxl/.test(code)) await py.loadPackage(["openpyxl"], { messageCallback: () => {}, errorCallback: (m) => err.push(m) });
    ns = py.globals.get("dict")();
    await py.runPythonAsync(code, { globals: ns, filename: "main.py" });
    self.postMessage({ id, ok: true, stdout: out.join("\n"), stderr: err.join("\n"), ms: Math.round(performance.now() - t0) });
  } catch (x) {
    let msg = String((x && x.message) || x);
    // Keep the part of the traceback that is about the program, not Pyodide.
    const at = msg.indexOf('File "main.py"');
    if (/^Traceback/.test(msg) && at > 0) msg = "Traceback (most recent call last):\n  " + msg.slice(at);
    self.postMessage({ id, ok: false, stdout: out.join("\n"), stderr: err.join("\n"), error: msg, ms: Math.round(performance.now() - t0) });
  } finally {
    try { ns && ns.destroy(); } catch (x) {}
  }
};
