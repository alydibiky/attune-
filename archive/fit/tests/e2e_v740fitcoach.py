"""v6.38 (upgrade F2) — Fit & Food: the coach that adapts every week. Four weeks of food and weigh-ins → Progress says what
you really burn and the plan's calories follow it (≤ 150 kcal a week); "Go back to the formula" undoes it.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v740fitcoach.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
T = datetime.date.today(); d = lambda n: (T - datetime.timedelta(days=n)).isoformat()
days = {d(i): {"meals": {"lunch": [{"name": "Koshari", "kcal": 2000, "p": 60, "c": 300, "f": 50}]}, "water": 0, "workouts": []} for i in range(28)}
weights = [{"d": d(i), "kg": round(90 - (27 - i) * 0.5 / 7, 2)} for i in range(27, -1, -3)]
ST = {"profile": {"sex": "m", "age": 30, "cm": 175, "kg": 88, "activity": "light", "goal": "lose", "rate": 0.5}, "days": days, "weights": weights, "fast": None, "myRecipes": [], "favs": [], "favFoods": []}
INIT = "try{localStorage.setItem('attune:fit:v1', %s);localStorage.setItem('attune:start','home')}catch(e){}" % json.dumps(json.dumps(ST))
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'fit'}}))")
    page.wait_for_selector("[data-testid=fit-tab-progress]", timeout=8000); page.click("[data-testid=fit-tab-progress]")
    page.wait_for_selector("[data-testid=fit-coach]", timeout=6000)
    t = page.locator("[data-testid=fit-coach]").inner_text()
    check("2,000" in t and "lost 0.5 kg a week" in t and "burn about" in t, "the coach reads the four weeks: %s" % t.replace("\n", " "))
    pf = page.evaluate("JSON.parse(localStorage.getItem('attune:fit:v1')).profile")
    check(pf.get("adapt") and 0 < pf["adapt"]["tdee"] - pf["adapt"]["prev"] <= 150 and abs(pf["adapt"]["tdee"] - 2550) <= 20, "the plan's energy moved toward what was measured, within the weekly cap: %s" % pf.get("adapt"))
    page.click("[data-testid=fit-coach-reset]"); page.wait_for_timeout(300)
    check(page.evaluate("JSON.parse(localStorage.getItem('attune:fit:v1')).profile.adapt") is None, "Go back to the formula undoes it")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
