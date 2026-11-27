"""v10.9.9 A3 (Ali picked: "lag hunt on a full phone at phone speed"). A phone filled like a year of use — 4,000 Mind records (most of
them saved chat answers), 3,000 Money entries, 200 chats (the open one 60 messages long), 300 People & plans items, 200 dates — with
the CPU slowed 4× (a mid-range phone). What tests/e2e_v1091speed.py doesn't time already:
  type   one key in Chat's box → the next frame (each of 20 keys)
  send   Send → the question on the screen
  stream the longest freeze while the answer is written word by word
  end    the longest freeze in the 2 s after the answer ends (saving it, Mind's index, the "From:" line)
  scroll the longest freeze while the long chat is scrolled
  mind   one key in Mind's search box (4,000 records) → the next frame
  open   Mind / Money / Follow-ups / Dates opened the first time → the next frame
Prints a table; anything over 100 ms is a freeze to fix. PYTHONPATH=tests/pwshim:tests python3 tests/trials/lag.py [390|1366]
"""
import json, sys, time, statistics, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from playwright.sync_api import sync_playwright
from harness import Env, new_page
env = Env(); errors = []
now = int(time.time() * 1000); D = 86400000
W = int(sys.argv[1]) if len(sys.argv) > 1 else 390
words = "barber dentist gym money paid ahmed hany rabee3 meeting crane liebherr invoice the answer long text words life plans rent fuel".split()
def sent(i, n): return " ".join(words[(i * 7 + j * 13) % len(words)] for j in range(n))
mem = [{"id": "m%d" % i, "kind": "chat" if i % 5 else "note", "title": sent(i, 6), "text": sent(i, 40), "output": sent(i + 1, 120) if i % 5 else "",
        "tags": [], "ts": now - i * 3600000} for i in range(4000)]
txns = [{"id": "t%d" % i, "type": "expense", "amount": 20 + i % 900, "date": time.strftime("%Y-%m-%d", time.localtime((now - (i % 360) * D) / 1000)),
         "cat": ["food", "transport", "bills", "fun", "groceries"][i % 5], "note": sent(i, 3), "account": "a1"} for i in range(3000)]
ledger = {"currency": "EGP", "accounts": [{"id": "a1", "name": "Cash", "currency": "EGP"}], "txns": txns, "recurring": [], "customCats": [], "ui": {"v613": 1}}
def chat(c, n): return {"id": "c%d" % c, "title": sent(c, 4), "updated": now - c * 60000, "messages": [{"id": "c%dm%d" % (c, k), "role": "user" if k % 2 == 0 else "assistant", "text": sent(c + k, 12 if k % 2 == 0 else 160)} for k in range(n)]}
chats = [chat(0, 60)] + [chat(c, 6) for c in range(1, 200)]
life = {"items": [{"id": "l%d" % i, "kind": ["debt", "subscription", "promise"][i % 3], "person": "Person %d" % (i % 60), "title": sent(i, 3), "amount": 100 + i, "currency": "EGP", "start": "2026-%02d-01" % (1 + i % 11)} for i in range(300)]}
radar = {"items": [{"id": "r%d" % i, "title": sent(i, 3), "date": "2027-%02d-%02d" % (1 + i % 12, 1 + i % 27), "kind": "paper"} for i in range(200)]}
SEED = ("if(window===window.top&&!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');" +
        "".join("localStorage.setItem(%s,%s);" % (json.dumps(k), json.dumps(json.dumps(v))) for k, v in
                [("attune:memory:v1", mem), ("ledger.v3", ledger), ("attune:chats:v1", chats), ("attune:life:v1", life), ("attune:radar:v1", radar)]) + "}")
INIT = ("try{localStorage.setItem('attune:start','chat');localStorage.setItem('attune:onboarded','1');localStorage.setItem('attune:coach:v1',JSON.stringify({seen:['*']}));" + SEED + "}catch(e){}\n"
        "(() => { function w(){ const N = window.AttuneNative; if (!N || !window.__mock) return setTimeout(w, 5);"
        " window.__mock.engine = { ...window.__mock.engine, state: 'ready', modelId: 'test-model' };"
        " window.dispatchEvent(new CustomEvent('attune-engine', { detail: { ...window.__mock.engine } })); } w(); })();")
LT = "() => { window.__lt = []; if (!window.__ltOn) { window.__ltOn = 1; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)); }).observe({ entryTypes: ['longtask'] }); } }"
FRAME = "(sel) => new Promise((r) => { const t = performance.now(); requestAnimationFrame(() => requestAnimationFrame(() => r(performance.now() - t))); })"
rows = []
def row(what, vals):
    vals = [round(v) for v in vals] or [0]
    rows.append((what, statistics.median(vals), max(vals)))
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT, desktop=(W, 860) if W > 500 else None)
    if W <= 500: page.set_viewport_size({"width": W, "height": 860})
    t0 = time.time(); page.goto(env.url); page.wait_for_selector("textarea[placeholder='Message Attune']", timeout=60000)
    cdp = ctx.new_cdp_session(page); cdp.send("Emulation.setCPUThrottlingRate", {"rate": 4 if W < 1024 else 2})
    page.wait_for_timeout(6000)
    # open the long chat
    page.evaluate("() => { try { localStorage.setItem('attune:chat:active', 'c0'); } catch (e) {} }")
    box = page.locator("textarea[placeholder='Message Attune']")
    box.click(); page.wait_for_timeout(1500)
    page.evaluate(LT)
    ks = []
    for ch in "when did i last pay ":
        ks.append(page.evaluate("(c) => new Promise((r) => { const ta = document.querySelector(\"textarea[placeholder='Message Attune']\"); const t = performance.now();"
                                " const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(ta, ta.value + c); ta.dispatchEvent(new Event('input', { bubbles: true }));"
                                " requestAnimationFrame(() => requestAnimationFrame(() => r(performance.now() - t))); })", ch))
    row("type (one key, Chat)", ks)
    page.evaluate("() => { window.__mock.fakeQueue = [Array.from({length: 120}, (_, i) => 'word' + i).join(' ')]; }")
    page.evaluate(LT)
    send = page.evaluate("() => new Promise((r) => { const t = performance.now(); document.querySelector(\"button[title='Send']\").click(); const go = () => { if ([...document.querySelectorAll('div')].some((d) => d.textContent === 'when did i last pay')) r(performance.now() - t); else requestAnimationFrame(go); }; go(); })")
    row("send → question shown", [send])
    page.wait_for_timeout(6000)
    lt = page.evaluate("window.__lt"); row("stream + end (longest freezes)", lt or [0])
    page.evaluate(LT)
    for y in range(0, 6000, 600):
        page.mouse.wheel(0, -600); page.wait_for_timeout(120)
    row("scroll the long chat", page.evaluate("window.__lt") or [0])
    # pages, the first time
    for m in ("memory", "money", "timeline", "radar"):
        page.evaluate(LT)
        ms = page.evaluate("(m) => new Promise((r) => { const t = performance.now(); window.dispatchEvent(new CustomEvent('attune-open', { detail: { mode: m } })); requestAnimationFrame(() => requestAnimationFrame(() => r(performance.now() - t))); })", m)
        page.wait_for_timeout(2500)
        row("open %s (first time) + its freezes" % m, [ms] + (page.evaluate("window.__lt") or []))
    # Mind search
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'memory'}}))"); page.wait_for_timeout(1500)
    s = page.locator("input[type=search], input[placeholder*='Search'], input[placeholder*='search']").first
    if s.count():
        s.click(); page.evaluate(LT); ks = []
        for ch in "barber":
            ks.append(page.evaluate("(c) => new Promise((r) => { const el = document.activeElement; const t = performance.now(); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, el.value + c); el.dispatchEvent(new Event('input', { bubbles: true })); requestAnimationFrame(() => requestAnimationFrame(() => r(performance.now() - t))); })", ch))
        page.wait_for_timeout(800)
        row("Mind search (one key, 4,000 records)", ks + (page.evaluate("window.__lt") or []))
    br.close()
env.close()
print("\nA3 lag at %d px, CPU %d× slower (median / worst ms; > 100 = a freeze)" % (W, 4 if W < 1024 else 2))
for what, med, mx in rows: print("  %-42s %6d %6d %s" % (what, med, mx, "  ← FREEZE" if mx > 100 else ""))
