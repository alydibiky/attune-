"""Voice phase 3 (VOICE_PLAN.md): «يا أتيون» heard by the phone itself — a switch on the voice screen, off by default; when on it
asks the phone (setWake), shows When (always / screen on / charging), How easily it wakes, "Say it now" with the live score, and
"open over other apps" when that is not allowed; closing the voice screen gives the mic back (wakeResume); the web shows nothing.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v1200wake.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
INIT = """const N = window.AttuneNative; window.__w = {on: false, when: 'always', sensitivity: 'normal', mic: true, overlay: false, paused: false, score: 0, error: ''};
window.__calls = []; delete N.listen; N.listen = undefined;
N.wakeState = () => JSON.stringify(window.__w);
N.setWake = (on) => { window.__calls.push(['setWake', on]); window.__w.on = on; };
N.setWakeOpts = (j) => { window.__calls.push(['opts', JSON.parse(j)]); Object.assign(window.__w, JSON.parse(j)); };
N.wakeResume = () => { window.__calls.push(['resume']); };
N.wakeOverlay = () => { window.__calls.push(['overlay']); };
N.chatInbox = () => '[]';"""
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + "try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:country','eg')}catch(e){}")
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=home-voice]", timeout=15000)
    page.click("[data-testid=home-voice]"); page.wait_for_selector("[data-testid=voice-screen]")
    sw = page.locator("[data-testid=wake-switch-input]")
    check(sw.count() == 1 and not sw.is_checked() and page.locator("[data-testid=wake-opts]").count() == 0, "«يا أتيون»: a switch on the voice screen, off by default")
    sw.click(); page.wait_for_timeout(300)
    check(["setWake", True] in page.evaluate("window.__calls") and page.locator("[data-testid=wake-opts]").count() == 1, "…on: the phone is told (setWake) and the choices show")
    page.click("[data-testid=wake-when-charging]"); page.click("[data-testid=wake-sens-high]"); page.wait_for_timeout(200)
    calls = page.evaluate("window.__calls")
    check(["opts", {"when": "charging"}] in calls and ["opts", {"sensitivity": "high"}] in calls, "When = while charging, How easily = easily (noisy car): sent to the phone")
    check("bg-[var(--c-acc-2)]" in page.locator("[data-testid=wake-when-charging]").get_attribute("class"), "…and shown as picked")
    page.click("[data-testid=wake-overlay]")
    check(["overlay"] in page.evaluate("window.__calls"), "“open over other apps” opens Android's page for it")
    page.click("[data-testid=wake-test]"); page.evaluate("window.__w.score = 0.86"); page.wait_for_timeout(600)
    check("86%" in page.locator("[data-testid=wake-meter]").inner_text(), "Say it now: the live score (86%%): %s" % page.locator("[data-testid=wake-meter]").inner_text())
    page.evaluate("window.__w.mic = false"); page.click("[data-testid=wake-test]"); page.wait_for_timeout(2300)
    check(page.locator("[data-testid=wake-nomic]").count() == 1, "no microphone permission → it says so")
    page.click("[data-testid=voice-close]"); page.wait_for_timeout(300)
    check(["resume"] in page.evaluate("window.__calls"), "closing the voice screen gives the mic back to «يا أتيون» (wakeResume)")
    ctx.close()
    # web / desktop: no wake word switch
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init="delete window.AttuneNative.wakeState; try{localStorage.setItem('attune:start','home')}catch(e){}")
    page.goto(env.url); page.wait_for_selector("[data-testid=home-voice]", timeout=15000)
    page.click("[data-testid=home-voice]"); page.wait_for_selector("[data-testid=voice-screen]")
    check(page.locator("[data-testid=wake-switch]").count() == 0, "without the phone's wake service: no switch")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
finish()
