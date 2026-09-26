"""v5.24 — the stronger models are really stronger: a Harmony (Expert) model re-reads its
draft as a senior reviewer and writes the improved answer; small models don't.

  python3 tests/e2e_v524.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish

env = Env(); errors = []

def send(page, text):
    page.locator("textarea[placeholder='Message Attune']").fill(text)
    page.locator("button[title='Send']").first.click()

def done(page, n=1):
    page.wait_for_function("(n) => document.querySelectorAll(\"button[title='Regenerate']\").length >= n", arg=n, timeout=30000)

Q = "Explain how to check the stability of a 100 t mobile crane before a heavy lift on soft ground"
DRAFT = " ".join("Step %d: check %s before the lift." % (i + 1, w) for i, w in enumerate(["the ground", "the outrigger mats", "the load chart", "the wind speed", "the slings and shackles", "the counterweight", "the boom length", "the radius", "the crane level", "the lift plan", "the signaller", "the exclusion zone", "the rigging angles", "the hook block weight", "the ground drainage", "the underground services", "the crane certificate", "the operator licence"])) + " Outrigger load is 60 t so a 1 m2 mat gives 60 t/m2."
FINAL = "## Stability check before the lift\n" + DRAFT.replace("1 m2 mat gives 60 t/m2.", "") + " Survey the ground bearing capacity first and compare it with the outrigger pressure." + "\n\nOutrigger load 60 t on a 2 m × 2 m mat = **15 t/m²**."
REVIEW = "PROBLEMS:\n- the mat area was too small for 60 t\n- ground bearing survey missing\nFINAL ANSWER:\n" + FINAL

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.evaluate("localStorage.setItem('attune:ram', '16')"); page.reload(); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("button:has-text('Harmony')").first.click(); page.wait_for_timeout(300)
    page.locator("button:has-text('Download Harmony')").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    check(page.locator("header button:has-text('Harmony')").count() == 1, "the header shows the Attune name of the model (Harmony)")
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)

    # ---- 1. an Expert model reviews its own draft ----
    page.evaluate("([a, b]) => { const M = window.__mock; M.fakeQueue = [a, b]; M.bodies = []; }", [DRAFT, REVIEW])
    send(page, Q)
    done(page)
    page.wait_for_timeout(300)
    bodies = page.evaluate("window.__mock.bodies.filter(x => x.max_tokens > 2)")
    sys0 = str(bodies[0]["messages"][0]["content"])
    check("EXPERT MODE" in sys0, "an Expert model is told to work like a senior professional")
    check(bodies[0]["max_tokens"] >= 4000, "…and may write a long answer (%d tokens)" % bodies[0]["max_tokens"])
    check(len(bodies) >= 2 and "senior expert reviewer" in str(bodies[1]["messages"][0]["content"]), "the draft is re-read by a senior-expert review pass")
    check(DRAFT[:40] in str(bodies[1]["messages"][-1]["content"]), "…which sees the draft")
    txt = page.locator(".att-md").last.inner_text()
    check("15 t/m²" in txt and "PROBLEMS" not in txt and "FINAL ANSWER" not in txt, "the improved answer is shown — only the answer, not the review notes")
    rv = page.locator("[data-testid=reviewed]").last
    check("2 improvements" in rv.inner_text(), "the answer says it was reviewed and how many things were improved")
    rv.locator("button").click(); page.wait_for_timeout(200)
    check("mat area was too small" in rv.inner_text(), "…tapping it lists what was fixed")

    # ---- 2. a review that comes back broken keeps the draft ----
    page.evaluate("([a, b]) => { const M = window.__mock; M.fakeQueue = [a, b]; M.bodies = []; }", [DRAFT.replace("check the ground", "test the ground"), "I think it is fine."])
    send(page, "And what should the lift supervisor check on the load chart before lifting it?")
    done(page, 2); page.wait_for_timeout(300)
    check("test the ground" in page.locator(".att-md").last.inner_text(), "a review without a proper final answer → the draft stays")
    check(page.locator("[data-testid=reviewed]").count() == 1, "…and it isn't marked as reviewed")

    # ---- 3. short chat isn't reviewed ----
    page.evaluate("() => { const M = window.__mock; M.fakeQueue = ['Hello! How can I help?']; M.bodies = []; }")
    send(page, "hi")
    done(page, 3); page.wait_for_timeout(300)
    check(len(page.evaluate("window.__mock.bodies.filter(x => x.max_tokens > 2)")) == 1, "a short hello gets no review pass (fast)")

    errs = real_errors(errors)
    check(not errs, "no JavaScript errors (%d)%s" % (len(errs), (": " + errs[0]) if errs else ""))
    ctx.close(); br.close()
env.close()
finish()
