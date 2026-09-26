"""v5.26 — tips and tricks: each model family's own sampling, a short prompt with an example
for small models, honesty without the web, every part answered, re-reading on reasoning,
JSON mode for Business with a safe retry when the engine refuses it.

  python3 tests/e2e_v526.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish

env = Env(); errors = []

def send(page, text):
    page.locator("textarea[placeholder='Message Attune']").fill(text)
    page.locator("button[title='Send']").first.click()

def done(page, n=1):
    page.wait_for_function("(n) => document.querySelectorAll(\"button[title='Regenerate']\").length >= n", arg=n, timeout=30000)

def main_bodies(page):
    return page.evaluate("window.__mock.bodies.filter(x => x.max_tokens > 2)")

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    # a small phone → a small Qwen model (Echo, level 2)
    page.evaluate("localStorage.setItem('attune:ram', '4')"); page.reload(); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("button:has-text('Echo')").first.click(); page.wait_for_timeout(300)
    page.locator("button:has-text('Download Echo')").first.click()
    page.wait_for_selector("text=Running · Echo", timeout=15000)
    check(page.locator("header button:has-text('Echo')").count() == 1, "Echo (a small 2B Qwen model) is running")
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)

    # ---- 1. a small model: short prompt with an example, honesty, tight sampling ----
    page.evaluate("() => { const M = window.__mock; M.fakeQueue = ['**About 1,200 Nm.**']; M.bodies = []; }")
    send(page, "What is the torque of the Lynk & Co 900 Ultra?")
    done(page)
    b = main_bodies(page)[-1]
    sysmsg = str(b["messages"][0]["content"])
    small = "Example:" in sysmsg
    check(small and len(sysmsg) < 3200, "a small model gets the SHORT prompt with one example (%d chars)" % len(sysmsg))
    check("Never invent specifications, prices" in sysmsg, "…and the honesty rule: no invented specs or prices without the web")
    check(b.get("min_p", 0) >= 0.1 and b.get("top_k") == 20 and b.get("temperature", 1) <= 0.3, "…and tight settings for a fact question (temp %s, top_k %s, min_p %s)" % (b.get("temperature"), b.get("top_k"), b.get("min_p")))

    # ---- 2. several questions in one message: every part answered ----
    page.evaluate("() => { const M = window.__mock; M.fakeQueue = ['1) 100 t\\n2) about 1.2 M EUR\\n3) Germany']; M.bodies = []; }")
    send(page, "What is the capacity of an LTM 1100? How much does it cost? Where is it made?")
    done(page, 2)
    u = str(main_bodies(page)[-1]["messages"][-1]["content"])
    check("This message has 3 parts" in u and "Answer EVERY one" in u, "three questions → a checklist so none is skipped")

    # ---- 3. a creative request is sampled looser than a fact ----
    page.evaluate("() => { const M = window.__mock; M.fakeQueue = ['Steel arms reach for the sky.']; M.bodies = []; }")
    send(page, "Write a short poem about a crane at sunrise")
    done(page, 3)
    t_poem = main_bodies(page)[-1].get("temperature", 0)
    check(t_poem > b.get("temperature", 1), "a poem gets a warmer temperature than a fact (%s > %s)" % (t_poem, b.get("temperature")))

    # ---- 4. Business: JSON mode, and a safe retry when the engine refuses it ----
    page.locator("nav button:has-text('Business')").click()
    page.wait_for_selector("[data-testid=business-page]", timeout=5000)
    page.click("[data-testid=erp-new]")
    page.evaluate("() => { const M = window.__mock; M.fakeQueue = []; M.bodies = []; }")
    page.locator("[data-testid=erp-desc]").fill("A small car workshop: customers, cars and repairs")
    page.click("[data-testid=erp-design]")
    page.wait_for_function("() => (window.__mock.bodies || []).filter(x => x.max_tokens > 2).length >= 2", timeout=60000)
    bs = main_bodies(page)
    check((bs[0].get("response_format") or {}).get("type") == "json_object", "a Business design asks the engine for guaranteed-valid JSON")
    check("response_format" not in bs[1], "…and when this engine refuses JSON mode, the same design is sent again without it (no error)")

    errs = [e for e in real_errors(errors) if "400" not in e and "Bad Request" not in e]
    check(not errs, "no JavaScript errors (%d)%s" % (len(errs), (": " + errs[0]) if errs else ""))
    ctx.close(); br.close()
env.close()
finish()
