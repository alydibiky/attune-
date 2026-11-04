"""v6.13 — copy food from day to day, like Yazio: a meal to another day and meal, or the whole day.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v713copyfood.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
today = datetime.date.today(); yday = today - datetime.timedelta(days=1)
EGG = {"name": "Egg", "ar": "بيض", "id": "egg", "src": "table", "qty": 2, "unit": "piece", "grams": 100, "kcal": 143, "p": 12.6, "c": 0.7, "f": 9.5, "fib": 0, "t": 1}
FUL = {"name": "Foul", "ar": "فول", "id": "foul", "src": "table", "grams": 200, "kcal": 220, "p": 15, "c": 30, "f": 4, "fib": 8, "t": 2}
STATE = {"profile": {"sex": "m", "age": 21, "cm": 178, "kg": 92, "activity": "light", "goal": "lose", "rate": 0.5, "goalKg": 80, "diet": "balanced"},
         "days": {str(yday): {"meals": {"breakfast": [EGG, FUL], "dinner": [FUL]}, "water": 2000}}, "weights": [], "fast": None, "myRecipes": [], "favs": []}
INIT = "try { if (!localStorage.getItem('attune:fit:v1')) localStorage.setItem('attune:fit:v1', %s); } catch (e) {}" % json.dumps(json.dumps(STATE))
def names(page, m):
    return page.locator("[data-testid=fit-meal-%s]" % m).inner_text()
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('Fit & Food')").first.click()
    try: page.wait_for_selector("[data-testid=fit-today]", timeout=6000)
    except Exception: print("ERRORS", errors[:5], page.locator("body").inner_text()[:400]); raise
    check(page.locator("[data-testid=fit-copy-breakfast]").count() == 0, "an empty meal has no copy button")
    page.locator("[data-testid=fit-day]").locator("xpath=preceding-sibling::button").first.click(); page.wait_for_timeout(200)
    check(page.locator("[data-testid=fit-day]").inner_text() == str(yday), "went back to yesterday")
    page.locator("[data-testid=fit-copy-breakfast]").click()
    check(page.locator("[data-testid=fit-copy-sheet]").is_visible(), "the copy sheet opens")
    page.locator("[data-testid=fit-copy-to-lunch]").click()
    page.locator("[data-testid=fit-copy-go]").click(); page.wait_for_timeout(200)
    page.locator("[data-testid=fit-day]").locator("xpath=following-sibling::button").first.click(); page.wait_for_timeout(200)
    t = names(page, "lunch")
    check("Egg" in t and "Foul" in t, "yesterday's breakfast is today's lunch: %s" % t.replace("\n", " "))
    # the whole day, to tomorrow
    page.locator("[data-testid=fit-copy-day]").click()
    page.fill("[data-testid=fit-copy-date]", str(today + datetime.timedelta(days=1)))
    page.locator("[data-testid=fit-copy-go]").click(); page.wait_for_timeout(200)
    st = json.loads(page.evaluate("localStorage.getItem('attune:fit:v1')"))
    tm = st["days"].get(str(today + datetime.timedelta(days=1)), {}).get("meals", {})
    check([x["name"] for x in tm.get("lunch", [])] == ["Egg", "Foul"], "the whole day copied to tomorrow: %s" % {k: [x["name"] for x in v] for k, v in tm.items()})
    check(real_errors(errors) == [], "no errors: %s" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
