"""End-to-end test of the built Attune page against the real llama.cpp engine.

The Android bridge (window.AttuneNative) is replaced by a stand-in with the
same method names and callback protocol as NativeBridge.kt; its chat() talks
to a real llama-server (tiny random model), so streaming, stop and stats are
exercised for real. Runs in a phone-sized headless Chromium.
"""
import json, subprocess, sys, time, os, signal, http.server, threading, functools
from playwright.sync_api import sync_playwright

ENGINE_PORT = 18790
PAGE_PORT = 8765
HERE = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "app", "src", "main", "assets", "www")
fails = []

def check(ok, what):
    print(("PASS " if ok else "FAIL ") + what, flush=True)
    if not ok: fails.append(what)

# ---- real engine ---------------------------------------------------------
env = dict(os.environ, LD_LIBRARY_PATH=HERE + "/build-dl/bin")
srv = subprocess.Popen([HERE + "/build-dl/bin/llama-server", "-m", HERE + "/tiny-a.gguf",
    "--host", "127.0.0.1", "--port", str(ENGINE_PORT), "-c", "8192", "-t", "2", "-np", "1",
    "-fa", "on", "-ctk", "q8_0", "-ctv", "q8_0", "--jinja", "--no-ui", "--no-slots",
    "--api-key", "testkey", "--cors-headers", "Authorization,Content-Type",
    "--cors-origins", f"http://127.0.0.1:{PAGE_PORT}", "--log-file", HERE + "/e2e-engine.log"],
    env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
# Stop the engine however this script ends (a crashed run used to leave it
# running, eating the CPU and making the next runs time out).
import atexit
atexit.register(lambda: (srv.poll() is None) and srv.kill())

# ---- serve the built page -----------------------------------------------
Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=DIST)
class Quiet(Handler.func):
    def log_message(self, *a): pass
httpd = http.server.ThreadingHTTPServer(("127.0.0.1", PAGE_PORT), functools.partial(Quiet, directory=DIST))
threading.Thread(target=httpd.serve_forever, daemon=True).start()

import urllib.request
for _ in range(100):
    try:
        if urllib.request.urlopen(f"http://127.0.0.1:{ENGINE_PORT}/health", timeout=1).status == 200: break
    except Exception: time.sleep(0.2)

MOCK = r"""
(() => {
  const ENGINE = "http://127.0.0.1:%d";
  const state = { engine: { state: "idle", modelId: null, error: null, settings: "", cpu: "NEON · dotprod · int8 matmul · KleidiAI" },
                  models: [], airGap: false, net: [], log: "engine log line\n", ctl: {}, calls: [] };
  const later = (fn) => setTimeout(fn, 0);
  const R = (id, o) => later(() => window.__attuneNative.resolve(id, JSON.stringify(o)));
  const J = (id, m) => later(() => window.__attuneNative.reject(id, m));
  const P = (id, p, s, d) => later(() => window.__attuneNative.progress(id, p, s, d));
  const announce = () => window.dispatchEvent(new CustomEvent("attune-engine", { detail: { ...state.engine } }));
  const cancels = {};
  window.__mock = state;
  window.AttuneNative = {
    listen: (id, lang) => { state.lastListen = lang; P(id, 0, "partial", "hello"); later(() => R(id, { text: "hello from voice" })); },
    stopListening: () => {},
    info: () => JSON.stringify({ platform: "android", ramGB: 12, totalRamBytes: 12e9, cores: 8, bigCores: 4,
      model: "Test Phone", soc: "SM8650", thermal: 0, powerSave: false, airGap: state.airGap, engine: state.engine }),
    engine: () => JSON.stringify(state.engine),
    models: () => JSON.stringify({ models: state.models, active: state.engine.modelId }),
    setAirGap: (on) => { state.airGap = on; state.calls.push("setAirGap:" + on); },
    remove: (id) => { state.models = state.models.filter((m) => m.id !== id); return true; },
    log: () => state.log,
    netLog: () => JSON.stringify({ entries: state.net, sent: state.net.length, blocked: 0 }),
    clearNetLog: () => { state.net = []; },
    keepAwake: (on) => { state.calls.push("keepAwake:" + on); },
    cancel: (id) => { cancels[id] = true; if (state.ctl[id]) state.ctl[id].abort(); },
    install: (id, arg) => { const a = JSON.parse(arg); state.lastInstall = a; (async () => {
        for (let p = 0; p <= 90; p += 30) {
          if (cancels[id]) return J(id, "Download cancelled");
          P(id, p, "Downloading the model", (p / 100 * 2.7).toFixed(2) + " / 2.70 GB");
          await new Promise((r) => setTimeout(r, 150));
        }
        const m = { id: a.id || "custom-1", label: a.label || a.spec || a.url, quant: a.quant || "",
          source: a.repo ? a.repo + ":" + a.quant : (a.spec || a.url), sizeBytes: 2.7e9, vision: true, active: true };
        state.models = state.models.filter((x) => x.id !== m.id).map((x) => ({ ...x, active: false })).concat([m]);
        state.engine = { ...state.engine, state: "starting", modelId: m.id }; announce();
        await new Promise((r) => setTimeout(r, 200));
        state.engine = { ...state.engine, state: "ready", settings: "context 16384 · 4 threads (prompt 8) · flash attention · 8-bit KV cache · CPU: NEON · dotprod · int8 matmul · KleidiAI" };
        announce();
        R(id, { ok: true, model: m, engine: state.engine });
      })(); },
    use: (id, modelId) => { state.models = state.models.map((x) => ({ ...x, active: x.id === modelId }));
      state.engine = { ...state.engine, state: "ready", modelId }; announce(); R(id, { ok: true }); },
    restart: (id) => R(id, { ok: true }),
    hash: (id, modelId) => R(id, { id: modelId, sha256: "ab".repeat(32) }),
    search: (id, arg) => { const a = JSON.parse(arg); state.lastSearch = a;
      state.net.push({ t: Date.now(), host: "html.duckduckgo.com", what: "web search (DuckDuckGo)", blocked: false });
      R(id, { via: a.provider, why: "", hits: [
        { title: "Liebherr LTM 1100", url: "https://example.com/ltm1100", source: "web",
          text: "The Liebherr LTM 1100-4.2 is a 100 tonne mobile crane with a 60 m telescopic boom. It weighs 48 tonnes and has 4 axles." },
        { title: "Crane guide", url: "https://example.com/guide", source: "web",
          text: "Mobile cranes are rated by maximum lifting capacity at minimum radius. A 100 t crane lifts far less at long radius." } ] }); },
    chat: (id, body) => { (async () => {
        const b = JSON.parse(body); state.lastBody = b; (state.bodies = state.bodies || []).push(b); state.chats = (state.chats || 0) + 1;
        const ctl = new AbortController(); state.ctl[id] = ctl;
        try {
          const r = await fetch(ENGINE + "/v1/chat/completions", { method: "POST", signal: ctl.signal,
            headers: { "Content-Type": "application/json", Authorization: "Bearer testkey" }, body });
          if (!r.ok) return J(id, "HTTP " + r.status + " " + (await r.text()).slice(0, 200));
          if (!b.stream) return R(id, await r.json());
          if (b.chat_template_kwargs && b.chat_template_kwargs.enable_thinking) {
            for (const w of ["Let me ", "work this ", "out step ", "by step. "]) { if (cancels[id]) throw new Error("x"); window.__attuneNative.delta(id, "", w); await new Promise((q) => setTimeout(q, 60)); }
          }
          const rd = r.body.getReader(); const dec = new TextDecoder();
          let buf = "", content = "", reasoning = "", stats = null, pieces = 0;
          for (;;) {
            const { value, done } = await rd.read(); if (done) break;
            buf += dec.decode(value, { stream: true }); let i;
            while ((i = buf.indexOf("\n")) >= 0) {
              const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
              if (!line.startsWith("data:")) continue;
              const d = line.slice(5).trim(); if (d === "[DONE]") continue;
              const j = JSON.parse(d); if (j.timings || j.usage) stats = j;
              const dl = ((j.choices || [])[0] || {}).delta || {};
              const c = dl.content || "", rr = dl.reasoning_content || "";
              if (c || rr) { content += c; reasoning += rr; pieces++; window.__attuneNative.delta(id, c, rr);
                if (state.slow) await new Promise((q) => setTimeout(q, 15)); }
            }
          }
          state.lastPieces = pieces;
          R(id, { content, reasoning, timings: stats && stats.timings, usage: stats && stats.usage });
        } catch (e) { J(id, cancels[id] ? "Stopped" : String(e.message || e)); }
      })(); },
    fetchText: (id, url) => R(id, { url, text: "x" }),
  };
  window.ATTUNE_BACKEND = { localUrl: ENGINE, apiKey: "testkey", native: true };
})();
""" % ENGINE_PORT

errors = []
import re as _re
with sync_playwright() as pw:
    br = pw.chromium.launch()
    ctx = br.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2, is_mobile=True, has_touch=True)
    ctx.add_init_script(MOCK); ctx.add_init_script("try{localStorage.setItem('attune:legacy-nav','1')}catch(e){}")   # v6.30: these old tests use the bottom bar
    ctx.add_init_script("try{if(localStorage.getItem('attune:start')===null)localStorage.setItem('attune:start','chat')}catch(e){}")   # v6.27: the phone opens on Home; these tests start in Chat
    ctx.add_init_script("try{if(!localStorage.getItem('attune:testing-pro'))localStorage.setItem('attune:testing-pro','off')}catch(e){}")
    page = ctx.new_page()
    page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
    page.on("requestfailed", lambda r: print("REQFAIL", r.url[:120]))
    page.on("console", lambda m: errors.append("console." + m.type + ": " + m.text + " @ " + str(m.location)) if m.type == "error" else None)
    def go(name):
        b = page.locator("nav button:has-text('%s')" % name)
        if b.count(): b.click()
        else:
            page.locator("nav button:has-text('All')").click(); page.wait_for_timeout(150)
            page.locator("button:has-text('%s')" % name).first.click()
        page.wait_for_timeout(200)
    page.goto(f"http://127.0.0.1:{PAGE_PORT}/index.html")
    page.wait_for_selector("text=Attune", timeout=15000)

    # 1. multi-select onboarding
    check(page.locator("text=Make Attune yours").count() == 1, "onboarding shown on first launch")
    check(page.locator("text=Pick as many as you like.").count() == 1, "onboarding says several answers are allowed")
    page.get_by_role("button", name="Summarise & translate").click()
    page.get_by_role("button", name="Period & cycle tracking").click()
    page.get_by_role("button", name="Money, budget & zakat").click()
    check(page.locator("button:has-text('✓ ')").count() == 3, "three uses selected at once")
    page.get_by_role("button", name="Next").click()
    page.get_by_role("button", name="Arabic (Egyptian)").click(); page.get_by_role("button", name="English", exact=True).click()
    check(page.locator("button:has-text('✓ ')").count() == 2, "two languages selected at once")
    page.get_by_role("button", name="Next").click()
    page.get_by_role("button", name="Heavy equipment / construction").click(); page.get_by_role("button", name="Business / trading").click()
    page.get_by_role("button", name="Next").click()
    page.get_by_role("button", name="Owner / founder").click(); page.get_by_role("button", name="Next").click()
    page.get_by_role("button", name="Comfortable").click(); page.wait_for_timeout(300)
    page.get_by_role("button", name="Start using Attune").click(); page.wait_for_timeout(300)
    prof = page.evaluate("JSON.parse(localStorage.getItem('attune:profile')||'{}')")
    check(prof.get("field") == "Heavy equipment / construction, Business / trading", "two fields saved: %s" % prof.get("field"))
    check(set(prof.get("uses", [])) >= {"cycle", "money"}, "uses saved")
    # v5.13 (Ali): the period tracker is not on the home screen — it stays in More.
    check(page.locator("nav button:has-text('Cycle')").count() == 0, "Cycle is kept off the bottom bar (it lives in More)")

    # 2. engine: speed-first recommendation
    page.locator("header button:has-text('No model')").click()
    page.wait_for_selector("text=Engine on this phone", timeout=5000)
    rec = page.locator("text=Recommended for this device").locator("xpath=..")
    rec_name = rec.locator("p.text-base").inner_text()
    # v5.7: in the Android app the fast engine (LiteRT-LM, GPU) comes first.
    check(rec_name.startswith("Blaze") and "fast engine" in rec_name, "12 GB phone is recommended the fast engine: " + rec_name)
    # v6.35 (Ali: "remove Core Max and higher from the mobile version"): Zenith is computer-only; the step up is Blaze+
    check(rec.locator("button:has-text('Zenith')").count() == 0 and rec.locator("button:has-text('Blaze+')").count() == 1, "a 12 GB phone is offered Blaze+ as the stronger option, never Zenith")
    check(page.locator("[data-testid=tiers-desktop-note]").count() == 1, "the Engine says the big models are in the desktop app")
    rec.get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)

    # 3–8 (v8.2, Ali: "Instant should be removed overall — the normal chat should do its job"): the Instant screen is retired;
    # Chat's own tests cover loading, streaming, stop, thinking and voice

    # 9. payment shared from another app -> Money
    page.evaluate("""window.dispatchEvent(new MessageEvent('attune-share', {data: {text: 'تم تحويل مبلغ 1,500.00 جنيه إلى AHMED MOHAMED. رقم العملية 987654321', kind: 'share'}}))""")
    page.wait_for_timeout(2500)
    check(page.locator("text=Money & Zakāt").count() >= 1, "a shared bank SMS opens Money")
    # v8.1: Money is Attune's own — a shared payment opens "Add to Money" filled in, with the message as evidence
    vals = page.evaluate("[...document.querySelectorAll('input')].map((i) => i.value)")
    check(page.locator("text=Read from the message").count() >= 1 and "1500" in vals and any(v.startswith("AHMED MOHAMED") for v in vals),
          "the payment is read (1,500 to AHMED MOHAMED) and shown with the message it came from")
    page.screenshot(path=HERE + "/v3-money.png")
    page.locator("button[aria-label='Close']:visible").last.click(); page.wait_for_timeout(250)
    page.evaluate("window.__attuneBack && window.__attuneBack()"); page.wait_for_timeout(300)   # (Money is a full page: back to the bar)

    # 10. shared image -> a new chat with the photo attached (v8.2: Instant is gone)
    img = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    page.evaluate("(u) => window.dispatchEvent(new MessageEvent('attune-share', {data: {kind: 'image', image: u, text: ''}}))", img)
    page.wait_for_timeout(600)
    check(page.locator("img[src^='data:image/png']").count() >= 1, "a shared photo opens a chat with the photo attached")
    page.evaluate("window.__attuneBack && window.__attuneBack()"); page.wait_for_timeout(300)

    # 11. Improve: domain packs have names
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'improve'}}))"); page.wait_for_timeout(400)
    check(page.locator("button:has-text('Heavy Equipment')").count() >= 1 and page.locator("button:has-text('Islamic Studies')").count() >= 1, "domain pack buttons show their names")

    br.close()

httpd.shutdown()
srv.send_signal(signal.SIGINT); srv.wait(timeout=10)
real_errors = [e for e in errors if "gold" not in e and "favicon" not in e and "sw.js" not in e.lower() and "service worker" not in e.lower()]
for e in real_errors[:20]: print("   ", e)
check(len(real_errors) == 0, "no JavaScript errors in the page (%d)" % len(real_errors))
print("ALL PASSED" if not fails else "%d FAILED" % len(fails))
sys.exit(0 if not fails else 1)
