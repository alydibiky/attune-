"""v6.23 — Ali: "I can't edit anything after I press save except the grams, and I can't copy the meal by itself".
Edit a logged food fully (name, grams → numbers follow, numbers typed in, move to another meal) and copy one food.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v723editfood.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
today = str(datetime.date.today())
EGG = {"name": "Fried egg on toast", "id": "egg-toast", "src": "table", "grams": 380, "kcal": 851, "p": 44, "c": 72, "f": 39, "fib": 4, "t": 1}
FUL = {"name": "Foul", "ar": "فول", "id": "foul", "src": "table", "grams": 200, "kcal": 220, "p": 15, "c": 30, "f": 4, "fib": 8, "t": 2}
STATE = {"profile": {"sex": "m", "age": 21, "cm": 178, "kg": 92, "activity": "light", "goal": "lose", "rate": 0.5, "goalKg": 80, "diet": "balanced"},
         "days": {today: {"meals": {"breakfast": [EGG, FUL]}, "water": 0}}, "weights": [], "fast": None, "myRecipes": [], "favs": []}
INIT = "try { if (!localStorage.getItem('attune:fit:v1')) localStorage.setItem('attune:fit:v1', %s); } catch (e) {}" % json.dumps(json.dumps(STATE))
def day(page):
    return json.loads(page.evaluate("localStorage.getItem('attune:fit:v1')"))["days"][today]["meals"]
def menu(page, n):
    page.locator("[data-testid=fit-row-more]").nth(n).click(); page.wait_for_timeout(300)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('Fit & Food')").first.click()
    page.wait_for_selector("[data-testid=fit-today]", timeout=6000)

    # ---- the edit sheet: everything, not only grams
    menu(page, 0); page.locator("[data-testid=fit-row-edit]").first.click()
    check(page.locator("[data-testid=fit-edit-sheet]").is_visible(), "Edit opens a sheet")
    check(page.locator("[data-testid=fit-edit-name]").input_value() == "Fried egg on toast", "the sheet shows the name")
    page.fill("[data-testid=fit-row-grams]", "190")
    check(page.locator("[data-testid=fit-edit-kcal]").input_value() == "426", "half the grams → about half the calories (%s)" % page.locator("[data-testid=fit-edit-kcal]").input_value())
    page.fill("[data-testid=fit-edit-name]", "4 fried eggs on toast")
    page.fill("[data-testid=fit-edit-kcal]", "600")
    page.fill("[data-testid=fit-edit-p]", "30")
    page.locator("[data-testid=fit-row-save]").click(); page.wait_for_timeout(250)
    b = day(page)["breakfast"][0]
    check(b["name"] == "4 fried eggs on toast" and b["grams"] == 190 and b["kcal"] == 600 and b["p"] == 30, "name, grams and typed numbers are saved: %s" % {k: b[k] for k in ("name", "grams", "kcal", "p")})
    check("4 fried eggs on toast" in page.locator("[data-testid=fit-meal-breakfast]").inner_text(), "the new name shows in the diary")

    # typed numbers then grams: the grams scale the typed numbers
    menu(page, 0); page.locator("[data-testid=fit-row-edit]").first.click()
    page.fill("[data-testid=fit-row-grams]", "380")
    check(page.locator("[data-testid=fit-edit-kcal]").input_value() == "1200", "grams scale the typed calories (%s)" % page.locator("[data-testid=fit-edit-kcal]").input_value())
    page.locator("[data-testid=fit-edit-sheet] button[aria-label=Close]").click(); page.wait_for_timeout(200)
    check(day(page)["breakfast"][0]["kcal"] == 600, "closing without Save changes nothing")

    # move a food to another meal
    menu(page, 1); page.locator("[data-testid=fit-row-edit]").nth(1).click()
    page.locator("[data-testid=fit-edit-meal-dinner]").click(); page.locator("[data-testid=fit-row-save]").click(); page.wait_for_timeout(250)
    m = day(page)
    check([x["name"] for x in m["breakfast"]] == ["4 fried eggs on toast"] and [x["name"] for x in m.get("dinner", [])] == ["Foul"], "Foul moved to dinner: %s" % {k: [x["name"] for x in v] for k, v in m.items()})

    # ---- copy ONE food, not the whole meal
    menu(page, 0); page.locator("[data-testid=fit-row-copy]").first.click()
    check("4 fried eggs on toast" in page.locator("[data-testid=fit-copy-sheet]").inner_text(), "the copy sheet names the one food")
    page.locator("[data-testid=fit-copy-to-lunch]").click(); page.locator("[data-testid=fit-copy-go]").click(); page.wait_for_timeout(250)
    m = day(page)
    check([x["name"] for x in m.get("lunch", [])] == ["4 fried eggs on toast"] and len(m["breakfast"]) == 1 and len(m["dinner"]) == 1, "only that food is copied to lunch today: %s" % {k: [x["name"] for x in v] for k, v in m.items()})
    menu(page, 0); page.locator("[data-testid=fit-row-copy]").first.click()
    check(not page.locator("[data-testid=fit-copy-go]").is_disabled(), "one food can go into the same meal again (eaten twice)")
    page.keyboard.press("Escape"); page.mouse.click(5, 5); page.wait_for_timeout(200)
    check(real_errors(errors) == [], "no errors: %s" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
