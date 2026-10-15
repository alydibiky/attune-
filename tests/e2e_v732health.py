"""v6.28 — Ali: "Health opens Fit & Food, not a health page" and "Fit & Food should be on the Home page".
Home and the bottom bar open the Health page: Fit & Food today, Family health (next dose, a medicine running out), Cycle. Home shows
the Fit & Food card: a meal tapped opens Fit on adding to it; + glass adds water at once. Computer: three columns.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v732health.py     (SHOTS=dir for screenshots)
"""
import os, json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
today = str(datetime.date.today())
FIT = {"profile": {"sex": "m", "age": 30, "cm": 178, "kg": 80, "activity": "light", "goal": "keep", "rate": 0.5, "goalKg": 80, "diet": "balanced"},
       "days": {today: {"meals": {"breakfast": [{"name": "Foul", "id": "foul", "grams": 200, "kcal": 220, "p": 15, "c": 30, "f": 4, "fib": 8, "t": 1}]}, "water": 500}}, "weights": [], "fast": None, "myRecipes": [], "favs": []}
CARE = {"members": [{"id": "me", "name": "Me"}], "meds": [{"id": "m1", "member": "me", "name": "Lantus", "dose": "20 units", "times": ["09:00", "21:00"], "start": "2026-09-01", "days": 0, "stock": 40, "stockAt": 1}], "labs": [], "taken": {}}
INIT = "try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:fit:v1',%s);localStorage.setItem('attune:care:v1',%s)}catch(e){}" % (json.dumps(json.dumps(FIT)), json.dumps(json.dumps(CARE)))
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    card = page.locator("[data-testid=phone-home] [data-testid=fit-today-card]")
    check(card.count() == 1 and "220" in card.inner_text(), "Home shows Fit & Food today: " + card.inner_text().replace("\n", " ")[:80])
    page.locator("[data-testid=phone-home] [data-testid=fit-today-water]").click(); page.wait_for_timeout(150)
    w = json.loads(page.evaluate("localStorage.getItem('attune:fit:v1')"))["days"][today]["water"]
    check(w == 750 and "3/" in card.inner_text(), "+ glass on Home adds water at once (750 ml)")
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, "home-fit.png"))
    page.locator("[data-testid=phone-home] [data-testid=fit-today-lunch]").click()
    page.wait_for_selector("[data-testid=fit-log]", timeout=6000)
    check(page.locator("[data-testid=fit-log-meal]").input_value() == "lunch", "tapping Lunch opens Fit on adding to lunch")
    page.evaluate("window.__attuneBack && window.__attuneBack()"); page.wait_for_timeout(200)
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.locator("[data-testid=home-area-health]").click(); page.wait_for_timeout(400)
    check(page.locator("[data-testid=health-page]").count() == 1, "Home's Health opens the Health page (not Fit)")
    hc = page.locator("[data-testid=health-care]").inner_text()
    check("Lantus" in hc and ("day left" in hc or "days left" in hc or "runs out" in hc), "Family health on it: the next dose and the insulin running out: " + hc.replace("\n", " ")[:100])
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, "health-phone.png"), full_page=True)
    page.locator("[data-testid=health-care]").click(); page.wait_for_timeout(300)
    check(page.locator("[data-testid=care-page]").count() == 1, "it opens Family health")
    page.evaluate("window.__attuneBack && window.__attuneBack()"); page.wait_for_timeout(300)
    check(page.locator("[data-testid=health-page]").count() == 1, "Back returns to Health")
    page.locator("nav button").nth(3).click(); page.wait_for_timeout(300)
    check(page.locator("[data-testid=health-page]").count() == 1, "the bottom bar's Health opens it too")
    page.set_viewport_size({"width": 1366, "height": 860}); page.wait_for_timeout(300)
    a, b = page.locator("[data-testid=health-page] [data-testid=fit-today-card]").bounding_box(), page.locator("[data-testid=health-care]").bounding_box()
    check(abs(a["y"] - b["y"]) < 4 and b["x"] > a["x"], "computer: the cards side by side")
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, "health-desk.png"))
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
