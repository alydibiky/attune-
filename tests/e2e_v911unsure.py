"""v9.1 (Ali, 3 Nov, picked A: "strong code, the small model chooses the meaning, and if it's unsure it asks me the 2 or 3 options"):
in Chat, a recording the code is NOT sure of ("ahmed 500") goes to the phone's model; when it says "unsure" (or there is no model)
the person picks on a card, and the pick is remembered for sentences of the same shape. Sure ones ("lunch 150") stay instant.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v911unsure.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
def send(page, t):
    page.locator("textarea[placeholder='Message Attune']").fill(t); page.locator("button[title='Send']").first.click(); page.wait_for_timeout(700)
def queue(page, a):
    page.evaluate("(a) => { const M = window.__mock; M.bodies = []; M.fakeQueue = a; }", a)
last = lambda page: page.locator("[data-testid=card-emerald]").last.inner_text()
with sync_playwright() as p:
    br = p.chromium.launch()
    # ---- no model: the person picks, and it is remembered ----
    ctx, page = new_page(br, env, errors, extra_init="try{localStorage.setItem('attune:start','chat')}catch(e){}")
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    send(page, "lunch 150")
    check("Done" in last(page), "sure ('lunch 150'): recorded at once, no question")
    send(page, "ahmed 500")
    t = last(page)
    check("Which did you mean?" in t and "Record it in Money" in t and "Answer it" in t, "unsure + no model: it asks — " + t.replace("\n", " · ")[:120])
    check(page.locator("text=Load a model in Engine first").count() == 0, "…and does not open Engine")
    page.locator("[data-testid=card-emerald]").last.locator("button:has-text('Record it in Money')").click(); page.wait_for_timeout(900)
    check("Done" in last(page) and "500" in last(page), "Record it in Money → recorded: " + last(page).replace("\n", " · ")[:100])
    send(page, "ahmed 700")
    check("Done" in last(page) and "700" in last(page), "the same shape again ('ahmed 700') → recorded at once, no question (remembered)")
    ctx.close()
    # ---- with the phone's model: it decides; "unsure" → the person ----
    ctx, page = new_page(br, env, errors, legacy_nav=False)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_timeout(1500)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(250)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'chat'}}))"); page.wait_for_timeout(400)
    queue(page, ["money-log"])
    send(page, "karim 300"); page.wait_for_timeout(800)
    check("Done" in last(page) and "300" in last(page), "the model says money-log → recorded, no question: " + last(page).replace("\n", " · ")[:90])
    queue(page, ["unsure"])
    send(page, "zizo 250"); page.wait_for_timeout(800)
    check("Which did you mean?" in last(page), "the model says unsure → the person picks")
    queue(page, ["Zizo is a nickname for Abdelaziz."])
    page.locator("[data-testid=card-emerald]").last.locator("button:has-text('Answer it')").click()
    page.wait_for_selector("text=Zizo is a nickname", timeout=15000)
    check(True, "Answer it → the question is answered")
    check(not real_errors(errors), "no errors (%s)" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
