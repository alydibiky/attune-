"""v6.14 — Fit & Food has what Yazio has: quick add, fasting stages and longer plans, measurements over time,
progress photos, more calories on chosen days (week kept), averages, diary export.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v714fityazio.py
"""
import json, base64
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
STATE = {"profile": {"sex": "m", "age": 21, "cm": 178, "kg": 92, "activity": "light", "goal": "lose", "rate": 0.5, "goalKg": 80, "diet": "balanced"},
         "days": {}, "weights": [], "fast": None, "myRecipes": [], "favs": []}
INIT = "try { if (!localStorage.getItem('attune:fit:v1')) localStorage.setItem('attune:fit:v1', %s); } catch (e) {}" % json.dumps(json.dumps(STATE)) + r"""
(() => { const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0); N.setFitWidget = (j) => { (window.__mock = window.__mock || {}).fitWidget = JSON.parse(j); return true; }; }; go(); })();"""
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('Fit & Food')").first.click()
    page.wait_for_selector("[data-testid=fit-today]", timeout=6000)
    goal0 = page.locator("[data-testid=fit-left]").inner_text()
    # quick add
    page.locator("[data-testid=fit-add-lunch]").click()
    page.locator("[data-testid=fit-quick-open]").click()
    page.fill("[data-testid=fit-quick-kcal]", "450"); page.fill("[data-testid=fit-quick-p]", "30")
    page.locator("[data-testid=fit-quick-add]").click()
    page.locator("[data-testid=fit-confirm]").click(); page.wait_for_timeout(250)
    check("450" in page.locator("[data-testid=fit-meal-lunch]").inner_text(), "quick add: 450 kcal in lunch")
    w = page.evaluate("window.__mock && window.__mock.fitWidget") or {}
    check(w.get("leftLabel", "").startswith("kcal") and "Eaten 450" in w.get("line", ""), "the home-screen widget gets today's numbers: %s" % w)
    page.locator("[data-testid=fit-micros] button").first.click(); page.wait_for_timeout(150)
    check("Vitamin C" in page.locator("[data-testid=fit-micros-list]").inner_text(), "vitamins & minerals for the day")
    # fasting: a 36 h plan and the body's stage
    page.locator("[data-testid=fit-fast-36]").click(); page.wait_for_timeout(200)
    check("Digesting" in page.locator("[data-testid=fit-fast-stage]").inner_text(), "the fast shows the body's stage")
    # progress: averages, measurements, photos, calorie days, export
    page.locator("[data-testid=fit-tab-progress]").click(); page.wait_for_timeout(250)
    check("450" in page.locator("[data-testid=fit-averages]").inner_text(), "average of the logged days")
    page.fill("[data-testid=fit-m-waist]", "98"); page.locator("[data-testid=fit-m-save]").click(); page.wait_for_timeout(150)
    check("98 cm" in page.locator("[data-testid=fit-m-change]").inner_text(), "measurements are kept")
    page.locator("[data-testid=fit-photo-input]").set_input_files({"name": "me.png", "mimeType": "image/png", "buffer": PNG}); page.wait_for_timeout(600)
    check(page.locator("[data-testid=fit-photos] img").count() == 1, "a progress photo is kept")
    import datetime
    wd = (datetime.date.today().isoweekday()) % 7
    page.locator("[data-testid=fit-cyc-%d]" % wd).click(); page.wait_for_timeout(150)
    page.locator("[data-testid=fit-tab-today]").click(); page.wait_for_timeout(250)
    check(page.locator("[data-testid=fit-left]").inner_text() != goal0, "today has the higher goal now (%s → %s)" % (goal0, page.locator("[data-testid=fit-left]").inner_text()))
    page.locator("[data-testid=fit-tab-progress]").click(); page.wait_for_timeout(200)
    page.locator("[data-testid=fit-ch-start-water]").click(); page.wait_for_timeout(150)
    check("0/7" in page.locator("[data-testid=fit-ch-water]").inner_text(), "a challenge starts and is tracked from the diary")
    page.locator("[data-testid=fit-export]").click(); page.wait_for_timeout(200)
    shared = page.evaluate("window.__mock && window.__mock.shared") or ""
    check("date,meal,food" in shared and "Quick add" in shared, "the diary exports as CSV")
    check(real_errors(errors) == [], "no errors: %s" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
