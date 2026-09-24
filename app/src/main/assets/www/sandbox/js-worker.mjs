// The JavaScript sandbox: plain JavaScript in a Web Worker, offline.
// console.log / console.error are captured; assert(cond, msg) and
// assertEqual(actual, expected, msg) are provided for tests.
const offline = () => { throw new Error("No internet in the sandbox — the code runs offline on the phone."); };
for (const k of ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "WebTransport", "importScripts"]) {
  try { Object.defineProperty(self, k, { value: function () { return offline(); }, configurable: false, writable: false }); } catch (e) {}
}
const LIMIT = 40000;
const show = (v) => {
  if (typeof v === "string") return v;
  try { const s = JSON.stringify(v, (k, x) => (typeof x === "bigint" ? x.toString() + "n" : x)); return s === undefined ? String(v) : s; } catch (e) { return String(v); }
};
self.onmessage = async (e) => {
  const { id, code } = e.data || {};
  const out = [], err = []; let size = 0;
  const w = (arr) => (...a) => { const s = a.map(show).join(" "); if (size > LIMIT) return; size += s.length; arr.push(s); };
  const cons = { log: w(out), info: w(out), debug: w(out), table: w(out), warn: w(err), error: w(err) };
  const same = (a, b) => { try { return JSON.stringify(a) === JSON.stringify(b); } catch (x) { return a === b; } };
  const assert = (c, m) => { if (!c) throw new Error("AssertionError" + (m ? ": " + m : "")); };
  const assertEqual = (a, b, m) => { if (!same(a, b)) throw new Error("AssertionError: expected " + show(b) + ", got " + show(a) + (m ? " — " + m : "")); };
  const t0 = performance.now();
  try {
    const fn = new Function("console", "assert", "assertEqual", '"use strict";\nreturn (async () => {\n' + code + "\n})();");
    await fn(cons, assert, assertEqual);
    self.postMessage({ id, ok: true, stdout: out.join("\n"), stderr: err.join("\n"), ms: Math.round(performance.now() - t0) });
  } catch (x) {
    const stack = String((x && x.stack) || "");
    // (new Function adds two lines of its own, this wrapper two more)
    const m = stack.match(/<anonymous>:(\d+):(\d+)/);
    const where = m ? " (line " + Math.max(1, Number(m[1]) - 4) + ")" : "";
    self.postMessage({ id, ok: false, stdout: out.join("\n"), stderr: err.join("\n"),
      error: ((x && x.name) || "Error") + ": " + ((x && x.message) || String(x)) + where, ms: Math.round(performance.now() - t0) });
  }
};
self.postMessage({ type: "ready", ms: 0 });
