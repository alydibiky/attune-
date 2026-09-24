"""Shared set-up for the v5 browser tests.

Starts the real desktop llama-server (tiny model), serves the built page, and
provides the stand-in for window.AttuneNative. The stand-in is the v4 one
(read straight out of e2e_v4.py, so the two can never drift apart) plus the
v5 bridge calls: saveFile, stash*, notify/alarms/calendar/intents, bench.
"""
import os, re, sys, time, signal, subprocess, threading, functools, http.server, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(HERE, "..", "app", "src", "main", "assets", "www")
ENGINE_PORT = 18791
PAGE_PORT = 8766
fails = []

def check(ok, what):
    print(("PASS " if ok else "FAIL ") + what, flush=True)
    if not ok: fails.append(what)

def _v4_mock():
    src = open(os.path.join(HERE, "e2e_v4.py"), encoding="utf-8").read()
    m = re.search(r'MOCK = r"""(.*?)""" % ENGINE_PORT', src, re.S)
    return m.group(1) % ENGINE_PORT

V5_EXTRA = r"""
(() => {
  const N = window.AttuneNative, S = window.__mock;
  const R = (id, o) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify(o)), 0);
  const J = (id, m) => setTimeout(() => window.__attuneNative.reject(id, m), 0);
  S.files = {}; S.stash = {}; S.intents = []; S.notes = [];
  N.saveFile = (id, arg) => { const a = JSON.parse(arg); if (S.cancelSave) return J(id, "Cancelled"); S.files[a.name] = a.text; S.lastSaved = a; R(id, { ok: true, name: a.name }); };
  // The real stash is a file in the app's private folder, so it survives a reload.
  N.stashPut = (n, t) => { sessionStorage.setItem("mockstash:" + n, t); return true; };
  N.stashGet = (n) => sessionStorage.getItem("mockstash:" + n) || "";
  N.stashDel = (n) => { sessionStorage.removeItem("mockstash:" + n); return true; };
  // reminders & phone actions
  N.schedule = (json) => { const a = JSON.parse(json); S.notes.push(a); return JSON.stringify({ ok: true, id: a.id }); };
  N.unschedule = (id) => { S.notes = S.notes.filter((n) => n.id !== id); return true; };
  N.scheduled = () => JSON.stringify(S.notes);
  N.intent = (json) => { const a = JSON.parse(json); S.intents.push(a); return JSON.stringify({ ok: true }); };
  N.canExact = () => true;
  // engine speed
  S.accel = { gpu: "Adreno (TM) 830", opencl: true };
  N.accel = () => JSON.stringify(S.accel);
  N.bench = (id, arg) => { S.lastBench = JSON.parse(arg); setTimeout(() => R(id, { pp: 81.5, tg: 17.3, ms: 5200, backend: S.lastBench.backend || "cpu", draft: !!S.lastBench.draft }), 50); };
})();
"""

class Env:
    def __init__(self):
        env = dict(os.environ, LD_LIBRARY_PATH=HERE + "/build-dl/bin")
        self.srv = subprocess.Popen([HERE + "/build-dl/bin/llama-server", "-m", HERE + "/tiny-a.gguf",
            "--host", "127.0.0.1", "--port", str(ENGINE_PORT), "-c", "8192", "-t", "2", "-np", "1",
            "--jinja", "--no-ui", "--no-slots", "--api-key", "testkey",
            "--cors-headers", "Authorization,Content-Type", "--cors-origins", f"http://127.0.0.1:{PAGE_PORT}",
            "--log-file", HERE + "/e2e5-engine.log"], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        H = functools.partial(http.server.SimpleHTTPRequestHandler, directory=DIST)
        class Quiet(H.func):
            def log_message(self, *a): pass
        self.httpd = http.server.ThreadingHTTPServer(("127.0.0.1", PAGE_PORT), functools.partial(Quiet, directory=DIST))
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()
        for _ in range(150):
            try:
                if urllib.request.urlopen(f"http://127.0.0.1:{ENGINE_PORT}/health", timeout=1).status == 200: break
            except Exception: time.sleep(0.2)
        self.mock = _v4_mock().replace("18790", str(ENGINE_PORT)) + V5_EXTRA
        self.url = f"http://127.0.0.1:{PAGE_PORT}/index.html"

    def close(self):
        self.httpd.shutdown()
        self.srv.send_signal(signal.SIGINT)
        try: self.srv.wait(timeout=10)
        except Exception: self.srv.kill()

def new_page(br, env, errors, native=True, extra_init=None):
    ctx = br.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2, is_mobile=True, has_touch=True)
    if native: ctx.add_init_script(env.mock)
    ctx.add_init_script("try{localStorage.setItem('attune:onboarded','1')}catch(e){}")
    if extra_init: ctx.add_init_script(extra_init)
    page = ctx.new_page()
    page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
    page.on("console", lambda m: errors.append("console." + m.type + ": " + m.text) if m.type == "error" else None)
    return ctx, page

def real_errors(errors):
    return [e for e in errors if "favicon" not in e and "sw.js" not in e.lower() and "/v1/chat/completions" not in e and "gold" not in e]

def finish():
    print("ALL PASSED" if not fails else "%d FAILED" % len(fails))
    sys.exit(0 if not fails else 1)
