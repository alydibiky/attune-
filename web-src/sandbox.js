/* ---- the code sandbox (page side) ------------------------------------------------
   Runs Python or JavaScript written by the model (or pasted by the person) in a
   Web Worker: no page, no phone bridge, no internet (see sandbox/*.mjs).
   A run that takes too long is stopped by throwing the whole worker away.

   runCode({ lang, code, stdin?, timeoutMs? })
     → { ok, stdout, stderr, error, ms, timedOut, lang }
   Web pages (lang "html") are not run here; code-ui.jsx previews them in a
   locked iframe (htmlDoc below) and reports their errors the same way.       */

const BASE = (() => {
  try { return new URL("sandbox/", document.baseURI).href; } catch (e) { return "sandbox/"; }
})();

export const LANGS = {
  python: { label: "Python", ext: "py", mime: "text/x-python" },
  javascript: { label: "JavaScript", ext: "js", mime: "text/javascript" },
  html: { label: "Web page", ext: "html", mime: "text/html" },
};

export function normLang(l) {
  const s = String(l || "").trim().toLowerCase();
  if (/^(py|python|python3)$/.test(s)) return "python";
  if (/^(js|javascript|node|mjs)$/.test(s)) return "javascript";
  if (/^(html|htm)$/.test(s)) return "html";
  return "";
}

const workers = {};   // lang -> { w, ready: Promise, calls: Map }
let seq = 0;

function spawn(lang) {
  const file = lang === "python" ? "py-worker.mjs" : "js-worker.mjs";
  const w = new Worker(BASE + file, { type: "module" });
  const calls = new Map();
  let readyResolve, readyReject;
  const ready = new Promise((res, rej) => { readyResolve = res; readyReject = rej; });
  w.onmessage = (e) => {
    const d = e.data || {};
    if (d.type === "ready") { if (d.error) readyReject(new Error(d.error)); else readyResolve(d); return; }
    const c = calls.get(d.id); if (!c) return;
    calls.delete(d.id); c(d);
  };
  w.onerror = (e) => {
    const msg = (e && e.message) || "The sandbox stopped";
    readyReject(new Error(msg));
    for (const [, c] of calls) c({ ok: false, error: msg });
    calls.clear();
  };
  ready.catch(() => {});
  return (workers[lang] = { w, ready, calls });
}

function kill(lang) {
  const x = workers[lang]; if (!x) return;
  try { x.w.terminate(); } catch (e) {}
  for (const [, c] of x.calls) c({ ok: false, error: "Stopped" });
  delete workers[lang];
}

/** Start Python early (it takes a few seconds the first time). */
export function warmUp(lang = "python") {
  const x = workers[lang] || spawn(lang);
  return x.ready.then((d) => ({ ok: true, ms: d.ms, version: d.version }), (e) => ({ ok: false, error: e.message }));
}

/** Is Python in this build? (CI puts it there; a hand-built page may not have it.) */
export async function pythonAvailable() {
  try { const r = await fetch(new URL("py/VERSION", document.baseURI).href, { cache: "no-store" }); return r.ok; } catch (e) { return false; }
}

export function stop(lang) { if (lang) kill(lang); else Object.keys(workers).forEach(kill); }

export async function runCode({ lang, code, stdin = "", timeoutMs, files }) {
  lang = normLang(lang) || "python";
  if (lang === "html") return { ok: false, lang, error: "A web page is shown in the preview, not run here." };
  const limit = timeoutMs || (lang === "python" ? 20000 : 8000);
  const x = workers[lang] || spawn(lang);
  const t0 = Date.now();
  try {
    await Promise.race([x.ready, new Promise((_, rej) => setTimeout(() => rej(new Error("Python took too long to start")), 60000))]);
  } catch (e) {
    kill(lang);
    return { ok: false, lang, error: /module script|Failed to fetch|404|import/i.test(e.message) ? "Python is not in this build of the app." : e.message, ms: Date.now() - t0 };
  }
  const id = ++seq;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      x.calls.delete(id); kill(lang);
      resolve({ ok: false, lang, timedOut: true, error: `Stopped after ${Math.round(limit / 1000)} s — the program did not finish (an endless loop?).`, ms: limit });
    }, limit);
    x.calls.set(id, (d) => { clearTimeout(timer); resolve({ ...d, lang }); });
    x.w.postMessage({ id, code, stdin, files: files || [] });
  });
}

/**
 * A web page to preview in a sandboxed iframe (scripts on, no network, no
 * access to the app). Errors are sent to the parent as
 * {attuneSandbox: token, kind: "error"|"log", text}.
 */
export function htmlDoc(src, token) {
  const csp = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:";
  const hook = `<meta http-equiv="Content-Security-Policy" content="${csp}"><script>(function(){var T=${JSON.stringify(String(token))};` +
    `function send(k,t){try{parent.postMessage({attuneSandbox:T,kind:k,text:String(t).slice(0,2000)},"*")}catch(e){}}` +
    `window.addEventListener("error",function(e){send("error",(e.message||"Error")+(e.lineno?" (line "+e.lineno+")":""))});` +
    `window.addEventListener("unhandledrejection",function(e){send("error","Unhandled promise rejection: "+(e.reason&&e.reason.message||e.reason))});` +
    `var L=console.log;console.log=function(){send("log",[].slice.call(arguments).join(" "));try{L.apply(console,arguments)}catch(e){}};` +
    `var E=console.error;console.error=function(){send("error",[].slice.call(arguments).join(" "));try{E.apply(console,arguments)}catch(e){}};` +
    `window.alert=function(m){send("log","alert: "+m)};window.addEventListener("load",function(){setTimeout(function(){send("loaded","")},50)});})();</script>`;
  const s = String(src || "");
  if (/<head[^>]*>/i.test(s)) return s.replace(/<head[^>]*>/i, (m) => m + hook);
  if (/<html[^>]*>/i.test(s)) return s.replace(/<html[^>]*>/i, (m) => m + "<head>" + hook + "</head>");
  return "<!doctype html><html><head><meta name=viewport content='width=device-width,initial-scale=1'>" + hook + "</head><body>" + s + "</body></html>";
}

/** Load a web page in a hidden locked iframe for a moment and report its errors. */
export function runHtml(code, waitMs = 1500) {
  return new Promise((resolve) => {
    const token = "t" + Math.random().toString(36).slice(2);
    const errors = [], logs = [];
    const f = document.createElement("iframe");
    f.setAttribute("sandbox", "allow-scripts");
    f.style.cssText = "position:fixed;left:-9999px;top:0;width:390px;height:700px;border:0;visibility:hidden";
    const t0 = Date.now();
    let loaded = false;
    const onMsg = (e) => {
      const d = e.data; if (!d || d.attuneSandbox !== token) return;
      if (d.kind === "error") errors.push(d.text); else if (d.kind === "log") logs.push(d.text); else if (d.kind === "loaded") loaded = true;
    };
    window.addEventListener("message", onMsg);
    f.srcdoc = htmlDoc(code, token);
    document.body.appendChild(f);
    setTimeout(() => {
      window.removeEventListener("message", onMsg);
      try { f.remove(); } catch (e) {}
      if (!loaded && !errors.length) errors.push("The page did not finish loading.");
      resolve({ ok: !errors.length, lang: "html", errors, error: errors.join("\n"), stdout: logs.join("\n"), ms: Date.now() - t0 });
    }, waitMs);
  });
}
