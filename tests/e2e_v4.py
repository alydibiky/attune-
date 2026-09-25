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
    speak: (t, l) => { state.spoke = t; state.calls.push("speak:" + l); },
    stopSpeaking: () => { state.calls.push("stopSpeaking"); },
    share: (t) => { state.shared = t; },
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
          if (!r.ok) { const t = (await r.text()).slice(0, 300); state.bad = (state.bad || []).concat([{ t, roles: b.messages.map((m) => m.role), think: b.chat_template_kwargs }]); console.log("BADREQ " + JSON.stringify(state.bad)); return J(id, "HTTP " + r.status + " " + t); }
          if (!b.stream) return R(id, await r.json());
          if (state.fake) {
            // A canned answer: cancel the real engine's reply, or it keeps
            // generating unseen and the next real request waits behind it.
            try { ctl.abort(); } catch (e) {}
            const parts = state.fake.match(/[\s\S]{1,12}/g);
            for (const p of parts) { if (cancels[id]) throw new Error("x"); window.__attuneNative.delta(id, p, ""); await new Promise((q) => setTimeout(q, 25)); }
            return R(id, { content: state.fake, reasoning: "", timings: { predicted_per_second: 14.2 }, usage: {} });
          }
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
MD = "**Total: 171,000 EGP**\n\n| Item | Amount |\n|---|---|\n| Rental | 150,000 |\n| VAT 14% | 21,000 |\n\n- 3 cranes\n- 4 days\n\n1. Multiply\n2. Add VAT"
with sync_playwright() as pw:
    br = pw.chromium.launch()
    ctx = br.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2, is_mobile=True, has_touch=True)
    ctx.add_init_script(MOCK)
    ctx.add_init_script("try{localStorage.setItem('attune:onboarded','1')}catch(e){}")
    page = ctx.new_page()
    page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
    page.on("console", lambda m: print(m.text[:600]) if "BADREQ" in m.text else None)
    page.on("console", lambda m: errors.append("console." + m.type + ": " + m.text + " @ " + str(m.location)) if m.type == "error" else None)
    page.goto(f"http://127.0.0.1:{PAGE_PORT}/index.html")
    page.wait_for_selector("text=What can I help with?", timeout=15000)
    check(True, "the app opens on the chat home screen")
    nav = page.locator("nav")
    check(nav.locator("button").count() == 5, "bottom bar has 5 places")

    # install a model via Engine chip
    page.locator("header button:has-text('No model')").click()
    rec = page.locator("text=Recommended for this device").locator("xpath=..")
    rec.get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)

    comp = page.locator("textarea[placeholder='Message Attune']")
    # 1. formatted, streamed answer
    page.evaluate("(t) => { window.__mock.fake = t; }", MD)
    # (Pure arithmetic is now answered instantly on the phone — e2e_v5 "fast" —
    #  so this formatting check asks something the model has to write.)
    comp.fill("Price 3 cranes for 4 days at 12,500 EGP a day, with VAT, as a table")
    page.locator("button[title='Send']").click()
    page.wait_for_selector("text=▍", timeout=10000)
    check(page.locator("button[title='Stop']").count() == 1, "Send turns into Stop while answering")
    page.wait_for_selector("button[title='Regenerate']", timeout=20000)
    check(page.locator(".att-md table").count() == 1, "tables are drawn as real tables")
    check(page.locator(".att-md strong:has-text('Total: 171,000 EGP')").count() == 1, "bold is bold, not **stars**")
    check(page.locator(".att-md >> text=**").count() == 0, "no raw markdown symbols on screen")
    check(page.locator("text=14.2 tokens/s").count() == 1, "speed shown under the answer")
    for t in ("Copy", "Regenerate", "Read aloud", "Share", "Save to Memory"):
        check(page.locator(f"button[title='{t}']").count() >= 1, "answer has a " + t + " button")
    check(page.locator("button:has-text('Check the maths')").count() == 1, "follow-up suggestions offered (incl. Check the maths)")
    page.screenshot(path=HERE + "/v4-chat.png")

    # 2. conversation memory
    page.evaluate("window.__mock.fake = 'Yes — with 2 cranes it would be **114,000 EGP**.'")
    comp.fill("and with 2 cranes?")
    page.locator("button[title='Send']").click()
    page.wait_for_selector("text=114,000 EGP", timeout=20000); page.wait_for_timeout(300)
    b = page.evaluate("window.__mock.lastBody")
    roles = [m["role"] for m in b["messages"]]
    check(roles[0] == "system" and roles.count("user") == 2 and roles.count("assistant") == 1, "the model sees the whole conversation: %s" % roles)
    check(b.get("stream") is True, "chat streams")

    # 3. regenerate, read aloud, share
    n0 = page.evaluate("window.__mock.chats")
    page.locator("button[title='Regenerate']").last.click()
    # Wait for the regenerated answer to finish (a fixed 1.5 s wait was a race).
    page.wait_for_function("!document.body.innerText.includes('▍') && document.body.innerText.includes('114,000')", timeout=20000)
    page.wait_for_timeout(300)
    check(page.evaluate("window.__mock.chats") == n0 + 1, "Regenerate asks again")
    page.locator("button[title='Read aloud']").last.click()
    check(any(c.startswith("speak:") for c in page.evaluate("window.__mock.calls")), "Read aloud uses the phone's voice")
    page.locator("button[title='Share']").last.click()
    check("114,000" in (page.evaluate("window.__mock.shared") or ""), "Share opens the phone's share sheet with the answer")

    # 4. edit
    page.locator("button:has-text('Edit')").last.click(); page.wait_for_timeout(200)
    check(comp.input_value() == "and with 2 cranes?", "Edit puts the message back in the box")
    check(page.locator("text=114,000 EGP").count() == 0, "and removes it and its answer from the chat")
    comp.fill("")

    # 5. thinking
    page.evaluate("window.__mock.fake = null")
    page.locator("button[title='Think first']").click()
    comp.fill("Is 18 t at 22 m enough for a 16 t load with rigging 0.8 t?")
    page.locator("button[title='Send']").click()
    page.wait_for_selector("text=Thinking…", timeout=10000)
    check(True, "shows Thinking… while it thinks")
    page.wait_for_selector("button[title='Regenerate'] >> nth=1", timeout=60000)
    page.wait_for_timeout(300)
    check(page.locator("button:has-text('Thought')").count() >= 1, "then 'Thought for N s', reopenable")
    page.locator("button[title='Think first']").click()

    # 6. stop
    page.evaluate("window.__mock.slow = true")
    comp.fill("Write a long maintenance plan for a 100 t crane.")
    page.locator("button[title='Send']").click()
    page.wait_for_selector("button[title='Stop']", timeout=5000)
    page.wait_for_timeout(150)
    if page.locator("button[title='Stop']").count(): page.locator("button[title='Stop']").click()
    page.wait_for_timeout(500)
    check(page.locator("button[title='Stop']").count() == 0, "Stop ends the answer")
    page.evaluate("window.__mock.slow = false")

    # 7. period log in chat, no model
    n0 = page.evaluate("window.__mock.chats")
    comp.fill("My period started 2 hours ago, heavy with cramps")
    page.locator("button[title='Send']").click()
    page.wait_for_selector("text=Period logged", timeout=5000)
    check(page.evaluate("window.__mock.chats") == n0, "period log handled on the phone, no model call")
    check(nav.locator("button:has-text('Cycle')").count() == 0, "Cycle stays off the bottom bar (v5.13: in More)")
    page.get_by_role("button", name="Open the calendar").click()
    page.wait_for_selector("text=/Period · day [12]/", timeout=5000)   # (day 2 when "2 hours ago" crosses midnight)
    check(True, "and it's in the calendar")
    nav.locator("button:has-text('Chat')").click(); page.wait_for_timeout(200)

    # 8. payment in chat
    comp.fill("تم تحويل مبلغ 2,500.00 جنيه إلى MAHMOUD ALI. رقم العملية 123456")
    page.locator("button[title='Send']").click()
    page.wait_for_selector("text=Payment found", timeout=5000)
    page.get_by_role("button", name="Add to Money").click()
    page.wait_for_timeout(2500)
    check(page.locator("text=read from:").count() >= 1, "Add to Money reads it into the ledger sheet")
    nav.locator("button:has-text('Chat')").click(); page.wait_for_timeout(200)

    # 9. history drawer, new chat, persistence
    page.locator("header button[aria-label='New chat']").click(); page.wait_for_timeout(200)
    check(page.locator("text=What can I help with?").count() == 1, "New chat starts fresh")
    page.reload(); page.wait_for_selector("nav", timeout=15000); page.wait_for_timeout(500)
    page.locator("header button[aria-label='Chats']").click()
    page.wait_for_selector("text=Search chats", timeout=3000) if False else page.wait_for_selector("input[placeholder='Search chats']", timeout=3000)
    n = page.locator("text=messages").count()
    check(n >= 1, "chats are kept after reopening the app (%d)" % n)
    page.locator("input[placeholder='Search chats']").fill("cranes")
    check(page.locator("text=3 cranes").count() >= 1, "chat search finds by content")
    page.locator("text=3 cranes").first.click(); page.wait_for_timeout(300)
    check(page.locator(".att-md table").count() == 1, "an old chat reopens with its answers")
    page.screenshot(path=HERE + "/v4-history.png")

    # 10. More sheet and back
    nav.locator("button:has-text('More')").click(); page.wait_for_timeout(200)
    check(page.locator("text=Site reports").count() >= 1 and page.locator("text=Improve a prompt").count() >= 1, "More lists every other tool")
    page.screenshot(path=HERE + "/v4-more.png")
    page.locator("button:has-text('Improve a prompt')").click(); page.wait_for_timeout(300)
    check(page.locator("button:has-text('Heavy Equipment')").count() >= 1, "tools open from More (Improve, packs named)")
    check(page.evaluate("window.__attuneBack()") is True, "Back from a tool…")
    page.wait_for_timeout(200)
    check(page.locator("textarea[placeholder='Message Attune']").count() == 1, "…returns to Chat")
    check(page.evaluate("window.__attuneBack()") is False, "Back on Chat leaves the app")

    # 11. Instant still works from the bar
    nav.locator("button:has-text('Instant')").click(); page.wait_for_timeout(200)
    ta = page.locator("textarea[dir=auto]").first
    ta.fill("Bonjour, le prix comprend-il l'installation?")
    page.wait_for_timeout(200)
    check(page.locator("button:has-text('Translate →')").count() >= 1, "Instant works from the bottom bar")
    print("BAD", page.evaluate("JSON.stringify(window.__mock.bad||null)"))
    br.close()

httpd.shutdown()
srv.send_signal(signal.SIGINT); srv.wait(timeout=10)
real_errors = [e for e in errors if "gold" not in e and "favicon" not in e and "sw.js" not in e.lower() and "18790/v1/chat/completions" not in e]
for e in real_errors[:20]: print("   ", e)
check(len(real_errors) == 0, "no JavaScript errors in the page (%d)" % len(real_errors))
print("ALL PASSED" if not fails else "%d FAILED" % len(fails))
sys.exit(0 if not fails else 1)
