"""v8.7 (Ali, 29 Oct: "tell me about my barber" took 15 s via a knowledge pack; the voice said it had no access): a question
about your own people is answered at once, by code, from what you told Attune — from the Home box (Chat) — no model needed.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v870personal.py
"""
import json, time
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
now = int(time.time() * 1000)
REC = [{"id": "m1", "kind": "note", "title": "Barber", "text": "that in the barber I go to hany rabee3 I like 1.ahmed me8awry 2.ahmed Sheraton", "ts": now - 20 * 86400000, "tags": []}]
SEED = "try { localStorage.setItem('attune:memory:v1', %s); localStorage.setItem('attune:start','home'); } catch (e) {}" % json.dumps(json.dumps(REC))
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=SEED)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    t0 = time.time()
    page.fill("[data-testid=home-ask]", "Tell me about my barber"); page.click("[data-testid=home-send]")
    page.wait_for_function("() => document.body.innerText.includes('hany rabee3')", timeout=8000)
    secs = time.time() - t0
    body = page.inner_text("body")
    check("From your Mind" in body or "From your own data" in body, "answered from your own note, by code")
    check(secs < 4, "at once (%.1f s, not 15)" % secs)
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
