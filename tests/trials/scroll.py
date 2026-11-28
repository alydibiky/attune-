"""(scroll.py, v10.9.10 — Ali, 28 Nov: "scrolling down is still too glitchy". Same full phone as lag.py below.)
v10.9.9 A3 (Ali picked: "lag hunt on a full phone at phone speed"). A phone filled like a year of use — 4,000 Mind records (most of
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
FRAMES = """(px) => new Promise((r) => {
  const vis = (e) => { const b = e.getBoundingClientRect(); return b.height > 300 && b.width > 200 && b.top < innerHeight && b.bottom > 0 && getComputedStyle(e).visibility !== 'hidden'; };
  const all = [...document.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 100 && /auto|scroll/.test(getComputedStyle(e).overflowY) && vis(e));
  const sc = all.sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight))[0] || document.scrollingElement;
  sc.scrollTop = 0; const gaps = []; let last = performance.now(), y = 0; const t0 = last;
  function f(now) { gaps.push(now - last); last = now; y += px; sc.scrollTop = y; if (now - t0 < 3000 && y < sc.scrollHeight) requestAnimationFrame(f); else r({ gaps, h: sc.scrollHeight, tag: sc.tagName + '.' + String(sc.className).slice(0, 40) }); }
  requestAnimationFrame(f); })"""
rows = []
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT, desktop=(W, 860) if W > 500 else None)
    if W <= 500: page.set_viewport_size({"width": W, "height": 860})
    page.goto(env.url); page.wait_for_selector("textarea", timeout=60000)
    cdp = ctx.new_cdp_session(page); cdp.send("Emulation.setCPUThrottlingRate", {"rate": 4 if W < 1024 else 2})
    page.wait_for_timeout(int(os.environ.get("SETTLE", "6000")))
    for m in (sys.argv[2].split(",") if len(sys.argv) > 2 else ["home", "money", "followups", "memory", "chat"]):
        page.evaluate("(m) => window.dispatchEvent(new CustomEvent('attune-open', { detail: { mode: m } }))", m); page.wait_for_timeout(2500)
        page.evaluate(LT)
        r = page.evaluate(FRAMES, 40)
        g = [x for x in r["gaps"][1:]]
        bad = [round(x) for x in g if x > 50]
        lt = page.evaluate("window.__lt") or []
        print("%-10s frames %4d · median %5.1f ms · over 50 ms: %3d (worst %s) · long tasks %s · %s h=%d" % (m, len(g), statistics.median(g) if g else 0, len(bad), max(bad) if bad else 0, sorted(lt)[-5:], r["tag"], r["h"]))
    br.close()
