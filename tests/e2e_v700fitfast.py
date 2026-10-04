"""v6.12 — Fit & Food photo in seconds (Ali: "28 s is a lot, Yazio takes 5 s"): the fast look's answer shows at once and can be
saved; the AI double-checks in the background and replaces the list only if it was not changed — else it is offered.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v700fitfast.py
"""
import json, base64, time
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")
vec = base64.b64encode(bytes([100, 0, 0, 0, 100, 0, 0, 0, 100, 0, 0, 0])).decode()
BANK = {"dim": 4, "vec": vec, "items": [["id", "egg-fried", "Fried egg", ""], ["like", "egg-fried", "Eggs with tomatoes", ""], ["id", "ful", "Ful medames", ""]]}
CLIP = "window.__attuneClipTest = { bank: %s, embed: async () => [1, 0, 0, 0] };" % json.dumps(BANK)
PROFILE = json.dumps({"profile": {"sex": "m", "age": 21, "cm": 178, "kg": 92, "activity": "light", "goal": "lose", "rate": 0.5, "goalKg": 80, "diet": "balanced"}, "days": {}, "weights": [], "fast": None, "myRecipes": [], "favs": []})
AI = json.dumps({"kind": "meal", "plate": "dinner plate", "items": [{"food": "fried egg", "count": 4, "grams": 184, "confidence": 0.9}, {"food": "toast", "count": 4, "grams": 120, "confidence": 0.8}], "label": None})
def items(page): return page.locator("[data-testid=fit-draft-item]")

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=CLIP + "\ntry { localStorage.setItem('attune:fit:v1', %s); } catch (e) {}" % json.dumps(PROFILE))
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(250)
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('Fit & Food')").first.click()
    page.wait_for_selector("[data-testid=fit-today]", timeout=6000)
    for round_ in (1, 2):
        page.evaluate("(a) => { const M = window.__mock; M.bodies = []; M.fakeQueue = [a, JSON.stringify({items: []})]; M.slowQueue = 400; M.codes = []; }", AI)
        page.locator("[data-testid=fit-add-breakfast]").click()
        page.set_input_files("[data-testid=fit-photo-input]", {"name": "plate.png", "mimeType": "image/png", "buffer": PNG}); page.wait_for_timeout(300)
        t0 = time.time(); page.locator("[data-testid=fit-read]").click()
        page.wait_for_selector("[data-testid=fit-draft-item]", timeout=8000); dt = time.time() - t0
        if round_ == 1:
            check(dt < 5 and "egg" in items(page).first.inner_text().lower(), "the fast answer shows in %.1f s (under 5 s)" % dt)
            check(page.locator("[data-testid=fit-refining]").count() == 1, "…marked 'the AI is double-checking — you can save now'")
            page.wait_for_selector("[data-testid=fit-refining]", state="detached", timeout=30000)
            txt = page.locator("[data-testid=fit-draft]").inner_text()
            check(items(page).count() == 2 and "toast" in txt.lower(), "untouched → the AI's fuller list replaces it (eggs + toast)")
            page.locator("[data-testid=fit-confirm]").click(); page.wait_for_timeout(300)
        else:
            page.locator("[data-testid=fit-portion-1\\.5]").first.click()   # the person changes the quick answer
            page.wait_for_selector("[data-testid=fit-ai-alt]", timeout=30000)
            check(items(page).count() == 1 and "toast" in page.locator("[data-testid=fit-ai-alt]").inner_text().lower(), "changed by the person → the AI's list is offered, not forced")
            page.locator("[data-testid=fit-ai-alt] button").first.click(); page.wait_for_timeout(200)
            check(items(page).count() == 2, "'Use this' takes the AI's list")
    check(real_errors(errors) == [], "no errors: %s" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
