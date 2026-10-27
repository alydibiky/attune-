"""v8.6 (Ali, 27 Oct: "fix the voice part for good or remove it" — «hello» got "I didn't get that"): words that are not a
command are answered — small talk by code, any question by the AI model on the phone (spoken, short) — never a dead end.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v860voice.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
INIT = """const N = window.AttuneNative; N.chatInbox = () => '[]';
N.speakWait = (id, a) => { window.__said = (window.__said || []).concat(JSON.parse(a).text); setTimeout(() => window.__attuneNative.resolve(id, '{}'), 10); };
delete N.listen; N.listen = undefined;"""
def say(page, text, wait=400):
    page.fill("[data-testid=voice-input]", text); page.click("[data-testid=voice-type-go]"); page.wait_for_timeout(wait)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + "try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:country','eg')}catch(e){}")
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=home-voice]", timeout=15000)
    page.click("[data-testid=home-voice]"); page.wait_for_selector("[data-testid=voice-screen]")
    say(page, "hello")
    d = page.inner_text("[data-testid=voice-done]")
    check("How can I help" in d and "didn't get that" not in d, "«hello» is answered at once: " + d[:90])
    check(any("How can I help" in s for s in page.evaluate("window.__said || []")), "…out loud")
    say(page, "السلام عليكم")
    check("وعليكم السلام" in page.inner_text("[data-testid=voice-done]"), "«السلام عليكم» → «وعليكم السلام»")
    say(page, "what is the capital of France", 4000)
    d = page.inner_text("[data-testid=voice-done]")
    check("didn't get that" not in d and len(d) > 10, "a real question goes to the AI (or says how to get one), never 'I didn't get that': " + d[:120])
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
finish()
