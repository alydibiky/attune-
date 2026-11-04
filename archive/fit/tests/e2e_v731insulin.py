"""v6.28 — Ali: insulin and Food should work together (tips and notifications when insulin is low).
Family health: insulin with the units left → each dose taken counts down → a refill reminder near the end; a blood sugar
reading under 70 shows the 15 g steps and a 15-minute "check again" reminder. Fit & Food: the same warnings on today, and each
meal shows its carbohydrates for an insulin user. No dose is ever suggested.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v731insulin.py
"""
import json, datetime, time
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
today = str(datetime.date.today())
FUL = {"name": "Foul", "id": "foul", "src": "table", "grams": 200, "kcal": 220, "p": 15, "c": 30, "f": 4, "fib": 8, "t": 1}
FIT = {"profile": {"sex": "m", "age": 30, "cm": 178, "kg": 80, "activity": "light", "goal": "keep", "rate": 0.5, "goalKg": 80, "diet": "balanced"},
       "days": {today: {"meals": {"breakfast": [FUL]}, "water": 0}}, "weights": [], "fast": None, "myRecipes": [], "favs": []}
INIT = "try{localStorage.setItem('attune:start','home'); if (!localStorage.getItem('attune:fit:v1')) localStorage.setItem('attune:fit:v1', %s)}catch(e){}" % json.dumps(json.dumps(FIT))
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.locator("nav button").last.click(); page.wait_for_timeout(300)
    page.locator(".rounded-t-2xl button:has-text('Family health')").first.click()
    page.wait_for_selector("[data-testid=care-page]", timeout=5000)
    page.click("[data-testid=care-rx-hand]")
    page.fill("[data-testid=care-name]", "Lantus"); page.fill("[data-testid=care-dose]", "20 units")
    page.select_option("[data-testid=care-freq]", "twice a day")
    check("units left" in page.locator("[data-testid=care-medform]").inner_text().lower(), "insulin asks for the units left in the pens (optional)")
    page.fill("[data-testid=care-stock]", "120")
    page.click("[data-testid=care-save]"); page.wait_for_timeout(300)
    check("supply for 3 days" in page.locator("[data-testid=care-med]").inner_text(), "120 units at 2 × 20 a day = 3 days of supply: %s" % page.locator("[data-testid=care-med]").inner_text().replace("\n", " "))
    page.click("[data-testid=care-tab-today]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=care-lowsupply]").count() == 1, "3 days left → the refill warning shows on Today")
    page.locator("[data-testid=care-dose-row]").first.click(); page.wait_for_timeout(300)
    notes = page.evaluate("window.__mock.notes.filter(n => n.id.startsWith('supply-')).map(n => n.title)")
    check(len(notes) == 1 and "Lantus" in notes[0], "a dose taken near the end sets one refill notification: %s" % notes)
    check("(100)" in page.locator("[data-testid=care-lowsupply]").inner_text(), "the dose counted down: 100 units left")
    page.fill("[data-testid=care-sugar]", "62"); page.click("[data-testid=care-sugar-save]"); page.wait_for_timeout(300)
    h = page.locator("[data-testid=care-hypo]")
    check(h.count() == 1 and "15 g" in h.inner_text(), "62 mg/dL → the low blood sugar steps (15 g fast sugar)")
    re = page.evaluate("window.__mock.notes.filter(n => n.id === 'sugar-recheck').map(n => Math.round((n.at - Date.now()) / 60000))")
    check(len(re) == 1 and 13 <= re[0] <= 15, "a 'check again' notification in 15 minutes: %s" % re)
    # Fit & Food sees it
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('Fit & Food')").first.click()
    page.wait_for_selector("[data-testid=fit-today]", timeout=6000)
    check(page.locator("[data-testid=fit-insulin-hypo]").count() == 1, "Fit & Food shows the low blood sugar warning")
    check(page.locator("[data-testid=fit-insulin-supply]").count() == 1, "… and the refill tip")
    check(page.locator("[data-testid=fit-insulin-carbs]").count() == 1 and "30 g" in page.locator("[data-testid=fit-insulin-carbs]").inner_text(), "… and the carbohydrates eaten today")
    check("30 g carbs" in page.locator("[data-testid=fit-meal-carbs]").first.inner_text(), "each meal shows its carbohydrates")
    txt = page.locator("[data-testid=fit-insulin]").inner_text()
    check("doctor" in txt and "take 20 units" not in txt.lower(), "says the doctor sets the insulin; never a dose")
    page.set_viewport_size({"width": 1366, "height": 860}); page.wait_for_timeout(300)
    check(page.locator("[data-testid=fit-insulin]").is_visible(), "the tips show on a computer too")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
