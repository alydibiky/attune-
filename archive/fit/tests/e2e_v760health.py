"""v7.3 — Health in two levels, from Gemini's mock-up "Area 2: Health" (Ali sent it 24 Oct 2026): the calm view (the box first, Fit & Food
today, Family health with the next dose and Take, Cycle, "See all → Health Report") and the Health Report (calories vs the target, weight
trend, doses on time, water & workouts, the latest lab, the cycle). Phone + computer, dark + light, Arabic RTL, 360 px.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v760health.py     (SHOTS=dir for screenshots)
"""
import os, json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
T = datetime.date.today(); d = lambda n: (T - datetime.timedelta(days=n)).isoformat()
M = lambda n, g, k, p, c, f: {"name": n, "id": n.lower().replace(" ", "-"), "grams": g, "kcal": k, "p": p, "c": c, "f": f, "fib": 3, "t": 1}
FIT = {"profile": {"sex": "f", "age": 29, "cm": 165, "kg": 64, "activity": "light", "goal": "lose", "rate": 0.5, "goalKg": 60, "diet": "balanced"},
       "days": {d(0): {"meals": {"breakfast": [M("Greek yogurt", 170, 100, 17, 6, 1), M("Banana", 120, 105, 1, 27, 0)], "lunch": [M("Grilled chicken salad", 320, 410, 38, 18, 20)]}, "water": 1500},
                **{d(i): {"meals": {"breakfast": [M("Oats", 60, 230, 8, 40, 4)], "lunch": [M("Koshari", 350, 700 + 40 * i, 20, 120, 12)], "dinner": [M("Lentil soup", 300, 270, 16, 40, 4)]}, "water": 2000, "workouts": [{"kcal": 150}] if i % 3 == 0 else []} for i in range(1, 7)}},
       "weights": [{"d": d(28 - 4 * i), "kg": round(65.6 - 0.15 * i, 1)} for i in range(8)], "fast": None, "myRecipes": [], "favs": []}
CARE = {"members": [{"id": "me", "name": "Me"}, {"id": "mom", "name": "Mom"}],
        "meds": [{"id": "m1", "member": "mom", "name": "Metformin", "dose": "500 mg", "times": ["00:01", "23:59"], "start": d(40), "days": 0, "stock": 12, "stockAt": 1},
                 {"id": "m2", "member": "me", "name": "Vitamin D", "dose": "1 capsule", "times": ["00:02"], "start": d(10), "days": 0}],
        "labs": [{"member": "mom", "test": "HbA1c", "value": 6.8, "unit": "%", "low": 4, "high": 5.6, "date": "2025-11-01"}, {"member": "mom", "test": "HbA1c", "value": 5.9, "unit": "%", "low": 4, "high": 5.6, "date": "2026-10-01"}],
        "taken": {**{"m1|%s|00:01" % d(i): 1 for i in range(1, 7)}, **{"m1|%s|23:59" % d(i): 1 for i in range(1, 7)}}}
CYC = {"days": {d(30 + k): {"flow": "medium"} for k in range(5)}, "settings": {"cycleLen": 28, "periodLen": 5}, "log": []}
INIT = ("try{localStorage.setItem('attune:fit:v1',%s);localStorage.setItem('attune:care:v1',%s);localStorage.setItem('attune:cycle:v1',%s);localStorage.setItem('attune:cycle:on','1')}catch(e){}"
        % (json.dumps(json.dumps(FIT)), json.dumps(json.dumps(CARE)), json.dumps(json.dumps(CYC))))
LIGHT = ";try{localStorage.setItem('attune:theme:v1', JSON.stringify({accent:'teal',bg:'light'}))}catch(e){}"
AR = ";try{localStorage.setItem('attune:ui:lang','ar')}catch(e){}"
def shot(page, name, full=False):
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, name + ".png"), full_page=full)
def open_health(page):
    page.wait_for_timeout(1200)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'health'}}))")
    page.wait_for_selector("[data-testid=health-page][data-view=calm]", timeout=8000); page.wait_for_timeout(400)
with sync_playwright() as p:
    br = p.chromium.launch()
    for theme in ["dark", "light"]:
        ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + (LIGHT if theme == "light" else ""))
        page.set_viewport_size({"width": 390, "height": 844})
        page.goto(env.url); open_health(page)
        tag = "[phone %s] " % theme
        tabs = [t.get_attribute("data-testid")[8:] for t in page.locator("[data-testid=hub-tabs] [role=tab]").all()]
        check(tabs[:3] == ["health", "fit", "care"], tag + "tabs Health · Fit & Food · Family · Cycle: %s" % tabs)
        check(page.locator("[data-testid=health-box-input]").is_visible(), tag + "the box comes first")
        check("615" in page.locator("[data-testid=fit-today-kcal]").inner_text() and page.locator("[data-testid=fit-today-left]").count() == 1, tag + "Fit & Food today: 615 eaten, and what is left")
        check(page.locator("[data-testid=health-dose]").count() == 1 and "Metformin" in page.locator("[data-testid=health-care]").inner_text(), tag + "Family health: the next dose")
        check("days late" in page.locator("[data-testid=health-cycle]").inner_text() or "Next period" in page.locator("[data-testid=health-cycle]").inner_text(), tag + "Cycle in a few words")
        shot(page, "health-calm-phone-" + theme, True)
        if theme == "dark":
            n0 = page.locator("[data-testid=health-dose]").first.inner_text()
            page.click("[data-testid=health-dose-take]"); page.wait_for_timeout(300)
            taken = json.loads(page.evaluate("localStorage.getItem('attune:care:v1')"))["taken"]
            check(any(k.endswith("|" + T.isoformat() + "|00:01") or (T.isoformat() in k) for k in taken), tag + "Take marks today's dose in Family health")
            page.fill("[data-testid=health-box-input]", "had koshari 85"); page.click("[data-testid=health-box-go]")
            page.wait_for_selector("[data-testid=health-box-result]", timeout=5000)
            res = page.locator("[data-testid=health-box-result]").inner_text()
            fit = json.loads(page.evaluate("localStorage.getItem('attune:fit:v1')"))
            names = [x.get("name", "").lower() for m in fit["days"][T.isoformat()]["meals"].values() for x in m]
            check(any("koshar" in n for n in names), tag + "“had koshari 85” goes into Fit & Food by the Home box's own reader: %s" % res.replace("\n", " · ")[:100])
            check(page.locator("[data-testid=health-box-undo]").count() == 1, tag + "…with Undo")
            page.click("[data-testid=health-box-undo]"); page.wait_for_timeout(200)
            fit = json.loads(page.evaluate("localStorage.getItem('attune:fit:v1')"))
            names = [x.get("name", "").lower() for m in fit["days"][T.isoformat()]["meals"].values() for x in m]
            check(not any("koshar" in n for n in names), tag + "…and Undo takes it out")
            page.click("[data-testid=health-open-report]"); page.wait_for_selector("[data-testid=health-page][data-view=report]", timeout=4000); page.wait_for_timeout(300)
            check(page.locator("[data-testid=health-calories] rect").count() == 7, tag + "the Report: 7 days of calories")
            check(page.locator("[data-testid=health-weight] polyline").count() == 2, tag + "…the weight with its trend line")
            doses = page.locator("[data-testid=health-rep-doses]").inner_text()
            check("%" in doses, tag + "…doses on time: %s" % doses.replace("\n", " · "))
            check("HbA1c" in page.locator("[data-testid=health-lab-row]").inner_text(), tag + "…the latest lab (HbA1c 6.8 → 5.9)")
            check(page.locator("[data-testid=health-cycle-summary]").count() == 1, tag + "…and the cycle summary")
            shot(page, "health-report-phone-dark", True)
            page.click("[data-testid=health-report-back]"); page.wait_for_timeout(200)
            check(page.locator("[data-testid=health-page][data-view=calm]").count() == 1, tag + "Back returns to the calm view")
            page.click("[data-testid=health-care-open]"); page.wait_for_selector("[data-testid=care-page]", timeout=4000)
            check(True, tag + "the Family card opens Family health")
        ctx.close()
    # Arabic + 360 px
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + AR)
    page.set_viewport_size({"width": 360, "height": 800})
    page.goto(env.url); open_health(page)
    over = page.evaluate("() => [...document.querySelectorAll('[data-testid=health-page] *')].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1 || e.getBoundingClientRect().left < -1).map(e => (e.dataset.testid || e.tagName)).slice(0, 5)")
    check(not over, "[phone ar 360] right to left, nothing wider than a 360-px screen %s" % over)
    shot(page, "health-calm-phone-ar", True)
    page.click("[data-testid=health-open-report]"); page.wait_for_selector("[data-testid=health-report]"); page.wait_for_timeout(300)
    shot(page, "health-report-phone-ar", True)
    ctx.close()
    for theme in ["dark", "light"]:
        ctx, page = new_page(br, env, errors, legacy_nav=False, desktop=(1440, 900), extra_init=INIT + (LIGHT if theme == "light" else ""))
        page.goto(env.url); open_health(page)
        tag = "[computer %s] " % theme
        a, b = page.locator("[data-testid=fit-today-card]").bounding_box(), page.locator("[data-testid=health-care]").bounding_box()
        check(abs(a["y"] - b["y"]) < 4 and b["x"] != a["x"], tag + "three cards side by side")
        check(page.locator("[data-testid=health-period-today]").count() == 1, tag + "Cycle has “Period started today” on the computer")
        shot(page, "health-calm-desktop-" + theme)
        page.click("[data-testid=health-open-report]"); page.wait_for_selector("[data-testid=health-report]"); page.wait_for_timeout(300)
        k = page.locator("[data-testid=health-rep-kcal]").bounding_box(), page.locator("[data-testid=health-rep-water]").bounding_box()
        check(abs(k[0]["y"] - k[1]["y"]) < 4, tag + "the Report desk: 4 totals in a row")
        shot(page, "health-report-desktop-" + theme)
        ctx.close()
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
