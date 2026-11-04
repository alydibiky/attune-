"""v6.34 — the Add sheet of Fit & Food, minimal (Ali: "it is cluttered, make it minimal — take ideas from Yazio"; he picked A):
one box with camera / barcode / microphone inside it, Recent · Favourites · My meals as a list with + (one tap logs it), the rest
under More; typing a food also searches it.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v737fitadd.py [screenshot dir]
"""
import sys, json, time
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
shots = sys.argv[1] if len(sys.argv) > 1 else None
day = time.strftime("%Y-%m-%d")
FIT = {"profile": {"sex": "m", "age": 30, "cm": 175, "kg": 85, "activity": "light", "goal": "lose", "rate": 0.5, "diet": "balanced"}, "weights": [],
       "days": {"2026-10-10": {"meals": {"breakfast": [{"id": "tea", "name": "Tea (no sugar)", "grams": 250, "kcal": 2, "p": 0, "c": 0, "f": 0}]}},
                "2026-10-11": {"meals": {"breakfast": [{"id": "tea", "name": "Tea (no sugar)", "grams": 250, "kcal": 2, "p": 0, "c": 0, "f": 0}]}}}}
INIT = "try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:fit:v1',%s)}catch(e){}" % json.dumps(json.dumps(FIT))
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.click("[data-testid=home-menu]"); page.click("[data-testid=phone-side] [data-testid=side-go-health]")
    page.locator("[data-testid=fit-today-card] button").first.click(); page.wait_for_selector("[data-testid=fit-today]")
    page.click("[data-testid=fit-add-lunch]"); page.wait_for_selector("[data-testid=fit-add-min]")
    box = page.locator("[data-testid=fit-add-min]")
    check(box.locator("[data-testid=fit-lb-photo]").count() == 1 and box.locator("[data-testid=fit-lb-barcode]").count() == 1 and box.locator("[data-testid=fit-lb-voice]").count() == 1, "one box: camera, barcode and microphone inside it")
    check(box.locator("[data-testid=fit-search]").count() == 0 and box.locator("[data-testid=fit-logbar]").count() == 0, "…no second search box, no row of four big buttons")
    check(box.locator("[data-testid=fit-add-row]:has-text('Tea')").count() == 1, "Recent: what you logged before, with a +")
    if shots: page.screenshot(path=f"{shots}/fit-add-min.png")
    page.locator("[data-testid=fit-add-row]:has-text('Tea') [data-testid=fit-add-row-plus]").click(); page.wait_for_timeout(300)
    st = page.evaluate("JSON.parse(localStorage.getItem('attune:fit:v1'))")
    lunch = (((st.get("days") or {}).get(day) or {}).get("meals") or {}).get("lunch") or []
    check(len(lunch) == 1 and "Tea" in lunch[0]["name"], "one tap on + logs it to lunch: %s" % [x["name"] for x in lunch])
    page.click("[data-testid=fit-add-lunch]"); page.wait_for_selector("[data-testid=fit-add-min]")
    page.fill("[data-testid=fit-log-text]", "koshary"); page.wait_for_timeout(300)
    check(page.locator("[data-testid=fit-min-results] button").count() >= 1, "typing a food searches it (results under the box)")
    check(page.locator("[data-testid=fit-read]").count() == 1, "…and 'Add it' reads a whole sentence")
    page.fill("[data-testid=fit-log-text]", "")
    page.click("[data-testid=fit-add-more] summary"); page.wait_for_timeout(150)
    check(page.locator("[data-testid=fit-quick-open]").count() == 1 and page.locator("[data-testid=fit-own-open]").count() == 1, "More: quick add kcal and my own food")
    words = len(box.inner_text().split())
    print("words on the Add sheet (More open):", words)
    check(real_errors(errors) == [], "no page errors: %s" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
