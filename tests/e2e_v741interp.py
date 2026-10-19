"""v6.41 H4 the live interpreter (Translate → Conversation): a split screen, the top half turned for the person across;
each side speaks its own language, the other side reads it big and hears it, in turns.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v741interp.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
INIT = ("try{localStorage.setItem('attune:interp:v1',JSON.stringify({a:'ar',b:'en'}))}catch(e){}"
        "(function w(){ var N = window.AttuneNative; if (!N) return setTimeout(w, 0); window.__heardLang = []; window.__spoke = [];"
        "N.listen = function (id, lang) { window.__heardLang.push(lang); var t = lang.indexOf('ar') === 0 ? 'عايز أحجز أوضة لليلتين' : 'Sure, which dates?';"
        " setTimeout(function () { window.__attuneNative.progress(id, 0, 'partial', t.slice(0, 5)); }, 10); setTimeout(function () { window.__attuneNative.resolve(id, JSON.stringify({ text: t })); }, 40); };"
        "N.speakWait = function (id, arg) { window.__spoke.push(JSON.parse(arg)); setTimeout(function () { window.__attuneNative.resolve(id, '{}'); }, 20); }; })();")
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(250)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'translate'}}))")
    page.wait_for_selector("[data-testid=tr-tab-talk]", timeout=6000); page.click("[data-testid=tr-tab-talk]")
    page.wait_for_selector("[data-testid=interp]")
    check("rotate(180deg)" in (page.locator("[data-testid=interp-b]").get_attribute("style") or ""), "the top half is turned round for the person across")
    page.evaluate("() => { window.__mock.fakeQueue = ['I want to book a room for two nights']; }")
    page.click("[data-testid=interp-mic-a]")
    page.wait_for_function("document.querySelector('[data-testid=interp-heard-b]') && document.querySelector('[data-testid=interp-heard-b]').innerText.includes('two nights')", timeout=10000)
    check(page.evaluate("window.__heardLang[0]") == "ar-EG", "side A listens in Egyptian Arabic")
    page.wait_for_timeout(200)
    sp = page.evaluate("window.__spoke")
    check(sp and sp[-1]["lang"] == "en" and "two nights" in sp[-1]["text"], "the English side hears the translation aloud: %s" % sp)
    check("أحجز" in page.locator("[data-testid=interp-said-a]").inner_text(), "side A sees what it said")
    page.evaluate("() => { window.__mock.fakeQueue = ['أكيد، أنهي تواريخ؟']; }")
    page.click("[data-testid=interp-mic-b]")
    page.wait_for_function("document.querySelector('[data-testid=interp-heard-a]').innerText.includes('تواريخ')", timeout=10000)
    check(page.evaluate("window.__heardLang[1]") == "en-US" and page.locator("[data-testid=interp-heard-a]").get_attribute("dir") == "rtl", "side B speaks English → side A reads Arabic, right to left")
    page.click("[data-testid=interp-close]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=interp]").count() == 0 and page.locator("[data-testid=translate-page]").count() == 1, "Close goes back to Translate")
    ctx.close()
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
