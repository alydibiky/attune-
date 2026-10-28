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
N.chatInbox = () => '[]';
window.__w.voice = 0; window.__w.enrol = {i: 0, state: ''};
N.wakeEnrol = (i) => { window.__calls.push(['enrol', i]); window.__w.enrol = {i: i, state: 'listening'}; setTimeout(() => { window.__w.enrol = {i: i, state: (window.__unclear && i === 1) ? 'unclear' : 'ok'}; if (!(window.__unclear && i === 1)) window.__w.voice = Math.max(window.__w.voice, i + 1); }, 900); };
N.wakeForget = () => { window.__calls.push(['forget']); window.__w.voice = 0; };"""
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
    check("bg-[var(--c-soft)]" in page.locator("[data-testid=wake-when-charging]").get_attribute("class"), "…and shown as picked")
    page.click("[data-testid=wake-overlay]")
    check(["overlay"] in page.evaluate("window.__calls"), "“open over other apps” opens Android's page for it")
    page.click("[data-testid=wake-test]"); page.evaluate("window.__w.score = 0.86"); page.wait_for_timeout(600)
    check("86%" in page.locator("[data-testid=wake-meter]").inner_text(), "Say it now: the live score (86%%): %s" % page.locator("[data-testid=wake-meter]").inner_text())
    page.evaluate("window.__w.mic = false"); page.click("[data-testid=wake-test]"); page.wait_for_timeout(2300)
    check(page.locator("[data-testid=wake-nomic]").count() == 1, "no microphone permission → it says so")
    # option C (Ali, 26 Oct): teach it your voice — 3 recordings, one after the other
    check(page.locator("[data-testid=wake-voice-n]").inner_text() == "0/3", "Your voice: 0/3 before teaching")
    page.click("[data-testid=wake-voice-teach]"); page.wait_for_timeout(300)
    check("1/3" in page.locator("[data-testid=wake-voice-say]").inner_text(), "Teach it my voice: “Say «يا أتيون» now (1/3)”")
    page.wait_for_selector("[data-testid=wake-voice-msg]", timeout=8000); page.wait_for_timeout(2300)
    calls = page.evaluate("window.__calls")
    check([c for c in calls if c[0] == "enrol"] == [["enrol", 0], ["enrol", 1], ["enrol", 2]] and "3/3" in page.locator("[data-testid=wake-voice-n]").inner_text(),
          "…three recordings in a row, then 3/3: %s" % page.locator("[data-testid=wake-voice-msg]").inner_text())
    page.click("[data-testid=wake-voice-forget]"); page.wait_for_timeout(2300)
    check(["forget"] in page.evaluate("window.__calls") and page.locator("[data-testid=wake-voice-n]").inner_text() == "0/3", "Forget my voice: back to any voice")
    page.evaluate("window.__unclear = true; window.__calls = []"); page.click("[data-testid=wake-voice-teach]")
    page.wait_for_selector("[data-testid=wake-voice-msg]", timeout=8000)
    check("try again" in page.locator("[data-testid=wake-voice-msg]").inner_text() and [c for c in page.evaluate("window.__calls") if c[0] == "enrol"] == [["enrol", 0], ["enrol", 1]],
          "a recording it didn't hear clearly → “try again”, it stops there")
    page.click("[data-testid=voice-close]"); page.wait_for_timeout(300)
    check(["resume"] in page.evaluate("window.__calls"), "closing the voice screen gives the mic back to «يا أتيون» (wakeResume)")
    # the quiet wake inside Attune: a small orb listens 4 s and goes away when nothing is said
    page.evaluate("window.__calls = []; window.dispatchEvent(new MessageEvent('attune-share', {data: {kind: 'wake'}}))"); page.wait_for_timeout(400)
    check(page.locator("[data-testid=quiet-wake-orb]").count() == 1 and page.locator("[data-testid=voice-screen]").count() == 0, "«يا أتيون» heard → only a small orb (nothing opens yet)")
    page.wait_for_timeout(4200)
    check(page.locator("[data-testid=quiet-wake]").count() == 0 and page.locator("[data-testid=voice-screen]").count() == 0 and ["resume"] in page.evaluate("window.__calls"),
          "…nothing said for 4 s → it goes away by itself and the mic goes back to «يا أتيون»")
    page.evaluate("window.dispatchEvent(new MessageEvent('attune-share', {data: {kind: 'wake'}}))"); page.wait_for_timeout(400)
    page.click("[data-testid=quiet-wake-orb]"); page.wait_for_selector("[data-testid=voice-screen]", timeout=3000)
    check(True, "…tapping the orb opens the voice screen")
    page.click("[data-testid=voice-close]"); page.wait_for_timeout(300)
    # the orb over other apps heard words → the voice screen starts with them
    page.evaluate("window.dispatchEvent(new MessageEvent('attune-share', {data: {kind: 'open', mode: 'voice', text: 'who messaged me'}}))")
    page.wait_for_selector("[data-testid=voice-screen]", timeout=3000); page.wait_for_timeout(800)
    check("who messaged me" in page.locator("[data-testid=voice-screen]").inner_text(), "words the orb heard open the voice screen and are acted on")
    ctx.close()
    # web / desktop: no wake word switch
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init="delete window.AttuneNative.wakeState; try{localStorage.setItem('attune:start','home')}catch(e){}")
    page.goto(env.url); page.wait_for_selector("[data-testid=home-voice]", timeout=15000)
    page.click("[data-testid=home-voice]"); page.wait_for_selector("[data-testid=voice-screen]")
    check(page.locator("[data-testid=wake-switch]").count() == 0, "without the phone's wake service: no switch")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
finish()
