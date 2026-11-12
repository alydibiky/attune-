"""v9.9.23 photo quality (Ali: "if the photo isn't clear make Attune tell take another clearer photo"): a blurred or dark photo on the
Dates page → Attune says why and offers "Take another photo" / "Use this one anyway"; nothing is read until then; a sharp photo goes
straight through; a sharp photo with no text at all → "I couldn't read this clearly"; Arabic shows the Arabic line.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v9923photoq.py
"""
import json, os, tempfile
from playwright.sync_api import sync_playwright
from harness import doc_png, Env, new_page, check, real_errors, finish
env = Env(); errors = []
INIT = ("try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:testing-pro','on')}catch(e){}\n"
        "window.__reads = 0; (() => { const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0); N.payAccess = () => true; N.payQueue = () => '[]';"
        " N.readText = (id, arg) => { window.__reads++; setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ text: window.__text || '', lines: [] })), 50); }; }; go(); })();")
D = tempfile.mkdtemp()
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_timeout(1500)
    page.evaluate("m => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", "radar"); page.wait_for_selector("[data-testid=radar-page]", timeout=6000)
    page.set_input_files("[data-testid=radar-file]", doc_png(page, os.path.join(D, "blur.png"), blur=4))
    page.wait_for_selector("[data-testid=radar-retake]", timeout=8000)
    rt = page.locator("[data-testid=radar-retake]")
    check(rt.get_attribute("data-why") == "blur" and "blurry" in rt.inner_text(), "a blurred photo → 'This photo is blurry … take another one': " + rt.inner_text()[:90].replace("\n", " "))
    check(page.evaluate("window.__reads") == 0 and page.locator("[data-testid=radar-form]").count() == 0, "nothing is read from a blurred photo")
    check(page.locator("[data-testid=radar-retake-again]").count() == 1, "'Take another photo' is offered")
    page.evaluate("window.__text = 'Warranty until 12 March 2028'")
    page.click("[data-testid=radar-retake-anyway]"); page.wait_for_selector("[data-testid=radar-form]", timeout=8000)
    check(page.evaluate("window.__reads") == 1 and page.locator("[data-testid=radar-retake]").count() == 0, "'Use this one anyway' reads it and the banner goes")
    page.evaluate("m => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", "radar"); page.wait_for_timeout(500)
    if page.locator("[data-testid=radar-file]").count() == 0: page.reload(); page.wait_for_timeout(1500); page.evaluate("m => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", "radar"); page.wait_for_selector("[data-testid=radar-page]", timeout=6000)
    page.set_input_files("[data-testid=radar-file]", doc_png(page, os.path.join(D, "dark.png"), dark=True))
    page.wait_for_selector("[data-testid=radar-retake]", timeout=8000)
    check(page.locator("[data-testid=radar-retake]").get_attribute("data-why") == "dark", "a dark photo → 'too dark — take it again in more light'")
    n0 = page.evaluate("window.__reads"); page.evaluate("window.__text = ''")
    page.set_input_files("[data-testid=radar-file]", doc_png(page, os.path.join(D, "sharp.png")))
    page.wait_for_selector("[data-testid=radar-retake][data-why=unread]", timeout=8000)
    check(page.evaluate("window.__reads") == n0 + 1, "a sharp photo is read straight away; with nothing readable on it → 'I couldn't read this clearly — take a closer, sharper photo'")
    page.evaluate("window.__text = 'Netflix trial ends on 3 January 2027'")
    page.set_input_files("[data-testid=radar-file]", doc_png(page, os.path.join(D, "sharp2.png")))
    page.wait_for_selector("[data-testid=radar-form]", timeout=8000)
    check(page.locator("[data-testid=radar-retake]").count() == 0, "a sharp photo with a date → straight to the form, no warning")
    # Arabic
    ctx.close(); ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init="localStorage.setItem('attune:ui:lang','ar');" + INIT)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_timeout(2000)
    page.evaluate("m => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", "radar"); page.wait_for_selector("[data-testid=radar-page]", timeout=6000)
    page.set_input_files("[data-testid=radar-file]", doc_png(page, os.path.join(D, "blur2.png"), blur=5))
    page.wait_for_selector("[data-testid=radar-retake]", timeout=8000)
    t = page.locator("[data-testid=radar-retake]").inner_text()
    check("مهزوزة" in t and "صوّر تاني" in t, "in Arabic: " + t[:80].replace("\n", " "))
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
env.close(); finish()
