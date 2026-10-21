"""v6.41 H2 a hands-free call with Chat: it listens, answers short, reads the answer a sentence at a time (no table / link read
out), listens again; "bye" ends the call; a tap while it speaks cuts in.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v741call.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
INIT = ("(function w(){ var N = window.AttuneNative; if (!N) return setTimeout(w, 0); window.__say = ['what is the capital of France', 'bye']; window.__spoke = []; window.__langs = [];"
        "N.listen = function (id, lang) { window.__langs.push(lang); var t = window.__say.shift() || ''; setTimeout(function () { window.__attuneNative.resolve(id, JSON.stringify({ text: t })); }, 60); };"
        "N.speakWait = function (id, arg) { window.__spoke.push(JSON.parse(arg).text); setTimeout(function () { window.__attuneNative.resolve(id, '{}'); }, 30); }; })();")
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(250)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'chat'}}))")
    page.wait_for_selector("[data-testid=chat-call]", timeout=6000)
    page.evaluate("() => { window.__mock.bodies = []; window.__mock.fakeQueue = ['**Paris** is the capital of France. It has about 2 million people.\\n\\nSee https://en.wikipedia.org/wiki/Paris for more.']; }")
    page.click("[data-testid=chat-call]")
    page.wait_for_selector("[data-testid=call-screen]", timeout=3000)
    b = page.locator("[data-testid=call-screen]").bounding_box(); vw = page.viewport_size
    check(page.evaluate("document.querySelector('[data-testid=call-screen]').parentElement === document.body") and b["y"] <= 1 and b["height"] >= vw["height"] - 2, "v6.46: the call covers the whole screen (it was a half circle inside the chat)")
    page.wait_for_function("window.__spoke.length >= 2", timeout=15000)
    page.wait_for_function("!document.querySelector('[data-testid=call-screen]')", timeout=8000)
    sp = page.evaluate("window.__spoke")
    check(sp[:2] == ["Paris is the capital of France.", "It has about 2 million people."], "the answer is read a sentence at a time, no ** : %s" % sp)
    check(not any("http" in x or "See " in x for x in sp) and sp[-1] == "The details are on the screen.", "the link is not read out; the screen is mentioned")
    sys = page.evaluate("window.__mock.bodies.filter(b => b.max_tokens > 2).map(b => b.messages[0].content).pop() || ''")
    check("talking by VOICE" in sys, "the model is told it's a voice call (short spoken answers)")
    check(len(page.evaluate("window.__langs")) == 2, "it listened again after speaking, and 'bye' ended the call")
    check(page.locator("text=Paris").count() >= 1, "the call is in the chat too")
    ctx.close()
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
