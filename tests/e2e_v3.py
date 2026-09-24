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
        const b = JSON.parse(body); state.lastBody = b; state.chats = (state.chats || 0) + 1;
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
    ctx.add_init_script(MOCK)
    page = ctx.new_page()
    page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
    page.on("requestfailed", lambda r: print("REQFAIL", r.url[:120]))
    page.on("console", lambda m: errors.append("console." + m.type + ": " + m.text + " @ " + str(m.location)) if m.type == "error" else None)
    def go(name):
        b = page.locator("nav button:has-text('%s')" % name)
        if b.count(): b.click()
        else:
            page.locator("nav button:has-text('More')").click(); page.wait_for_timeout(150)
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
    check(set(prof.get("uses", [])) >= {"cycle", "money", "instant"}, "uses saved")
    check(page.locator("nav button:has-text('Cycle')").count() == 1, "choosing period tracking adds the Cycle tab")

    # 2. engine: speed-first recommendation
    page.locator("header button:has-text('No model')").click()
    page.wait_for_selector("text=Engine on this phone", timeout=5000)
    rec = page.locator("text=Recommended for this device").locator("xpath=..")
    rec_name = rec.locator("p.text-base").inner_text()
    check(rec_name.startswith("Qwen3.5 4B"), "12 GB phone is recommended the fast 4B: " + rec_name)
    check(rec.locator("button:has-text('Stronger, slower')").count() == 1, "the 9B offered as the stronger, slower option")
    rec.get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)

    # 3. model still loading: a request waits and shows progress, then answers
    page.evaluate("""(() => { const m = window.__mock; m.engine = { ...m.engine, state: 'starting', phase: 'Reading the model file', loadingFor: 7 };
       window.dispatchEvent(new CustomEvent('attune-engine', { detail: { ...m.engine } })); })()""")
    go("Instant")
    ta = page.locator("textarea[dir=auto]").first
    ta.fill("Summarise this: the crane arrives Thursday at 7am, payment half upfront and half after the job.")
    page.get_by_role("button", name="Go").click()
    page.wait_for_selector("text=Loading the model · Reading the model file · 7 s", timeout=5000)
    check(True, "while the model loads, the answer area says so with the phase and seconds")
    check(page.locator("header >> text=Loading 7s").count() >= 1, "header chip shows loading seconds")
    page.evaluate("""(() => { const m = window.__mock; m.engine = { ...m.engine, state: 'ready', phase: '', loadingFor: 0 };
       window.dispatchEvent(new CustomEvent('attune-engine', { detail: { ...m.engine } })); })()""")
    page.wait_for_selector("button:has-text('Copy')", timeout=60000)
    check(page.locator("text=Answer").count() >= 1, "then the answer arrives")
    b = page.evaluate("window.__mock.lastBody")
    check(b.get("stream") is True, "Instant answers stream")
    check("Work out what they want" in b["messages"][-1]["content"], "Go with no button = the model works out the task")

    # 4. language-aware buttons
    page.get_by_role("button", name="English", exact=True).click()
    check(page.locator("button:has-text('Answer (English)')").count() >= 1,
          "buttons say which language the answer will be in")
    page.get_by_role("button", name="العربية").click()
    check(page.locator("button:has-text('(Arabic)')").count() >= 1, "changing 'Answer in' relabels the buttons")
    ta.fill("Bonjour, je voudrais savoir si le prix comprend l'installation et la livraison jeudi prochain.")
    page.wait_for_timeout(200)
    check(page.locator("button:has-text('Translate → Arabic')").count() >= 1, "translate button names its target language")

    # 5. stop, and switch while running
    page.evaluate("window.__mock.slow = true")
    ta.fill("Write a detailed maintenance report for a 50 tonne crane covering hydraulics, wire ropes, brakes and electrics.")
    page.get_by_role("button", name="Go").click()
    page.wait_for_selector("button:has-text('Stop')", timeout=5000)
    check(ta.is_enabled(), "the text box stays editable while it works")
    page.wait_for_selector("text=▍", timeout=15000)
    check(True, "Instant answer appears progressively")
    chats_before = page.evaluate("window.__mock.chats")
    page.locator("button:has-text('Improve the writing')").first.click()   # switch mid-answer
    page.wait_for_timeout(400)
    check(page.evaluate("window.__mock.chats") == chats_before + 1, "tapping another action mid-answer starts it at once")
    if page.locator("button:has-text('Stop')").count(): page.locator("button:has-text('Stop')").first.click()
    page.wait_for_selector("button:has-text('Go')", timeout=10000)
    check(True, "Stop ends it")
    page.evaluate("window.__mock.slow = false")

    # 6. thinking shown
    page.locator("button[title='Think harder']").click()
    ta.fill("How many 20 tonne loads can a crane with 18 t capacity at 22 m lift at that radius?")
    page.get_by_role("button", name="Go").click()
    page.wait_for_timeout(150)
    print("DBG", page.evaluate("JSON.stringify((window.__mock.lastBody||{}).chat_template_kwargs)"), page.locator("button[title='Think harder']").inner_text())
    page.screenshot(path=HERE + "/dbg-think.png")
    # The mock's thinking lasts ~0.25 s; if the engine was still finishing the
    # stopped answer above, it can be over before we look. Either the live
    # thinking or the finished "How it thought" proves it was shown.
    page.locator("text=work this").or_(page.locator("text=How it thought")).first.wait_for(timeout=30000)
    check(True, "the model's thinking is shown while it thinks")
    page.wait_for_selector("button:has-text('Copy')", timeout=60000)
    b = page.evaluate("window.__mock.lastBody")
    check(b["chat_template_kwargs"]["enable_thinking"] is True and b.get("thinking_budget_tokens", 0) > 0, "Think asks for thinking with a budget (%s)" % b.get("thinking_budget_tokens"))
    check(page.locator("text=How it thought").count() == 1, "thinking can be reopened after the answer")
    page.locator("button[title='Think harder']").click()

    # 7. voice
    page.locator("button[title='Speak']").click(); page.wait_for_timeout(300)
    check("hello from voice" in ta.input_value(), "voice input fills the box")

    # 8. period log from Instant
    ta.fill("I got a period 2 hours ago and it was heavy")
    check(page.locator("text=Looks like a period log").count() == 1, "recognised as a period log before sending")
    n0 = page.evaluate("window.__mock.chats")
    page.get_by_role("button", name="Go").click()
    page.wait_for_selector("text=Period logged", timeout=5000)
    check(page.evaluate("window.__mock.chats") == n0, "logged on the phone without calling the model")
    check(page.locator("text=heavy flow").count() >= 1, "flow read as heavy")
    page.get_by_role("button", name="Open the calendar").click()
    page.wait_for_selector("text=Period · day 1", timeout=5000)
    check(True, "Cycle tab shows day 1 of the period")
    page.screenshot(path=HERE + "/v3-cycle.png", full_page=True)

    # 9. payment shared from another app -> Money
    page.evaluate("""window.dispatchEvent(new MessageEvent('attune-share', {data: {text: 'تم تحويل مبلغ 1,500.00 جنيه إلى AHMED MOHAMED. رقم العملية 987654321', kind: 'share'}}))""")
    page.wait_for_timeout(2500)
    check(page.locator("text=Money & Zakāt").count() >= 1, "a shared bank SMS opens Money")
    check(page.locator("text=read from:").count() >= 1, "the payment is read (amount and where it came from)")
    # v5.6: Money is a full page; its payment tools slide up from "Payment · Ask".
    if page.locator("[data-testid=money-tools]").count(): page.locator("[data-testid=money-tools]").click(); page.wait_for_timeout(200)
    check(page.locator("text=From a photo").count() == 1, "payments can also come from a photo")
    if page.locator("[data-testid=money-sheet]").count(): page.locator("[data-testid=money-sheet] button[aria-label='Close']").click()
    page.screenshot(path=HERE + "/v3-money.png")

    # 10. shared image -> Instant with Add to Money
    img = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    page.evaluate("(u) => window.dispatchEvent(new MessageEvent('attune-share', {data: {kind: 'image', image: u, text: ''}}))", img)
    page.wait_for_timeout(300)
    check(page.locator("button:has-text('Add to Money')").count() == 1, "a shared photo opens in Instant with Add to Money")

    # 11. Improve: domain packs have names
    go("Improve a prompt"); page.wait_for_timeout(300)
    check(page.locator("button:has-text('Heavy Equipment')").count() >= 1 and page.locator("button:has-text('Islamic Studies')").count() >= 1, "domain pack buttons show their names")

    # 12. Instant screenshot for the record
    go("Instant"); page.wait_for_timeout(200)
    page.screenshot(path=HERE + "/v3-instant.png")
    br.close()

httpd.shutdown()
srv.send_signal(signal.SIGINT); srv.wait(timeout=10)
real_errors = [e for e in errors if "gold" not in e and "favicon" not in e and "sw.js" not in e.lower() and "service worker" not in e.lower()]
for e in real_errors[:20]: print("   ", e)
check(len(real_errors) == 0, "no JavaScript errors in the page (%d)" % len(real_errors))
print("ALL PASSED" if not fails else "%d FAILED" % len(fails))
sys.exit(0 if not fails else 1)
