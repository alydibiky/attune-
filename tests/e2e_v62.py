"""v6.2 — Fit & Food level 2 ("better than Yazio by levels"): recent foods, same-as-yesterday, my meals,
my own food, Nutri-Score/NOVA and sugar/salt, the day score, Ramadan mode with real times, reminders,
the week plan + shopping list, the weekly report and body fat.

  python3 tests/e2e_v62.py
"""
import os, json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish

env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
def shot(page, name):
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, name + ".png"))

today = datetime.date.today(); yday = today - datetime.timedelta(days=1)
EGG = {"name": "Egg", "ar": "بيض", "id": "egg", "src": "table", "qty": 2, "unit": "piece", "grams": 100, "kcal": 143, "p": 12.6, "c": 0.7, "f": 9.5, "fib": 0, "t": 1}
COLA = {"name": "Coca-Cola", "id": "off:5449000000996", "src": "off", "qty": 1, "unit": "can", "grams": 330, "kcal": 139, "p": 0, "c": 35, "f": 0, "fib": 0, "sug": 35, "sat": 0, "salt": 0, "grade": "E", "nova": 4, "t": 2}
STATE = {"profile": {"sex": "m", "age": 21, "cm": 178, "kg": 92, "activity": "light", "goal": "lose", "rate": 0.5, "goalKg": 80, "diet": "balanced"},
         "days": {str(yday): {"meals": {"breakfast": [EGG, COLA]}, "water": 2000}}, "weights": [{"d": str(yday), "kg": 92}], "fast": None, "myRecipes": [], "favs": []}
INIT = "try { if (!localStorage.getItem('attune:fit:v1')) localStorage.setItem('attune:fit:v1', %s); } catch (e) {}" % json.dumps(json.dumps(STATE)) + r"""
(() => { const S = window.__mock = window.__mock || {}; S.sched = [];
  const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0);
    N.schedule = (j) => { S.sched.push(JSON.parse(j)); return JSON.stringify({ ok: true, exact: true, notify: true }); };
    N.unschedule = (id) => { S.sched = S.sched.filter((x) => x.id !== id); return true; };
    N.scheduled = () => JSON.stringify(S.sched); N.share = (t) => { S.shared = t; };
  }; go(); })();"""

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('Fit & Food')").first.click()
    page.wait_for_selector("[data-testid=fit-today]", timeout=6000)

    # ---- faster logging ----
    page.locator("[data-testid=fit-add-breakfast]").click()
    check(page.locator("[data-testid=fit-recent-item]").count() == 2, "recent foods offered at once")
    page.locator("[data-testid=fit-copy-yesterday]").click()
    check(page.locator("[data-testid=fit-draft-item]").count() == 2, "“Same as yesterday” brings yesterday's breakfast")
    check(page.locator("[data-testid=fit-grade]").first.inner_text() == "E" and "Ultra-processed" in page.locator("[data-testid=fit-nova]").first.inner_text(), "a product shows its Nutri-Score (E) and NOVA (ultra-processed)")
    page.locator("[data-testid=fit-save-mymeal]").click()
    page.fill("[data-testid=fit-mymeal-name]", "Egg & cola")
    page.locator("[data-testid=fit-mymeal-ok]").click()
    page.locator("[data-testid=fit-confirm]").click(); page.wait_for_timeout(200)
    page.locator("[data-testid=fit-add-snacks]").click()
    check(page.locator("[data-testid=fit-mymeal]").filter(has_text="Egg & cola").count() == 1, "the saved “my meal” is one tap away")
    page.locator("[data-testid=fit-own-open]").click()
    page.fill("[data-testid=fit-own-name]", "Juhayna Greek yogurt")
    page.locator("[data-testid=fit-own]").locator("button:has-text('per serving')").click()
    page.fill("[data-testid=fit-own-serving]", "150")
    for k, v in (("kcal", "145"), ("p", "13.5"), ("c", "6"), ("f", "7.5"), ("sug", "6")): page.fill("[data-testid=fit-own-%s]" % k, v)
    page.locator("[data-testid=fit-own-save]").click()
    d = page.locator("[data-testid=fit-draft]").inner_text()
    check("Juhayna" in d and page.locator("[data-testid=fit-draft-grams]").first.input_value() == "150" and "146 kcal" in d, "my own food from its label: one 150 g serving")
    page.locator("[data-testid=fit-confirm]").click(); page.wait_for_timeout(200)

    # ---- quality + score ----
    qtext = page.locator("[data-testid=fit-quality]").inner_text()
    check("41/53" in qtext.replace(" ", ""), "today's sugar: 41 g of a 53 g limit (the cola's 35 + the yogurt's 6) — " + qtext.replace("\n", " ")[:80])
    check(page.locator("[data-testid=fit-score]").count() == 1, "the day has a score out of 100")
    shot(page, "fit-quality")

    # ---- Ramadan mode + reminders (My plan) ----
    page.locator("[data-testid=fit-edit-profile]").click()
    page.locator("[data-testid=fit-ramadan-on]").check()
    page.locator("[data-testid=fit-reminders]").check(); page.wait_for_timeout(200)
    ids = [x["id"] for x in page.evaluate("window.__mock.sched")]
    check("daily-fit-breakfast" in ids and any(i.startswith("daily-fit-water") for i in ids), "reminders: meals and water, daily (%d)" % len(ids))
    page.locator("[data-testid=fit-pf-save]").click(); page.wait_for_selector("[data-testid=fit-today]")
    r = page.locator("[data-testid=fit-ramadan]")
    check(r.count() == 1 and "Fajr" in r.inner_text() and "Maghrib" in r.inner_text() and ("Iftar in" in r.inner_text() or "Suhoor ends in" in r.inner_text()), "Ramadan: today's Fajr and Maghrib, and the countdown")
    check("Suhoor" in page.locator("[data-testid=fit-meal-breakfast]").inner_text() and "Iftar" in page.locator("[data-testid=fit-meal-lunch]").inner_text(), "meals renamed Suhoor / Iftar")
    shot(page, "fit-ramadan")

    # ---- week plan + shopping list ----
    page.locator("[data-testid=fit-tab-recipes]").click()
    page.locator("[data-testid=fit-week-open]").click()
    check(page.locator("[data-testid=fit-week-day]").count() == 7 and page.locator("[data-testid=fit-shopping]").count() == 1, "7 days of meals and one shopping list")
    page.locator("[data-testid=fit-shopping-share]").click()
    check("Shopping list" in (page.evaluate("window.__mock.shared") or ""), "the list goes to WhatsApp / any app")
    shot(page, "fit-week")
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=fit-recipes]").count() == 1, "Back from the week returns to Recipes")

    # ---- report + body ----
    page.locator("[data-testid=fit-tab-progress]").click()
    check(page.locator("[data-testid=fit-week-report]").count() == 1 and "You logged 2 of 7 days" in page.locator("[data-testid=fit-week-report]").inner_text(), "the weekly report")
    page.fill("[data-testid=fit-body-waist]", "100"); page.fill("[data-testid=fit-body-neck]", "40")
    check("25.5%" in page.locator("[data-testid=fit-bodyfat]").inner_text(), "body fat from a tape measure: 25.5 %")
    page.locator("[data-testid=fit-body-save]").click()

    # ---- Arabic ----
    page.evaluate("localStorage.setItem('attune:ui:lang', 'ar')"); page.reload(); page.wait_for_selector("nav", timeout=15000)
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('الأكل والرياضة')").first.click()
    page.wait_for_selector("[data-testid=fit-today]", timeout=6000)
    t = page.locator("[data-testid=fit-today]").inner_text()
    check("الفجر" in t and "سحور" in t and "درجة النهارده" in t, "Ramadan card, meal names and the score in Arabic — " + t.replace("\n", " ")[:300])
    shot(page, "fit-ramadan-ar")

    check(not real_errors(errors), "no errors (%s)" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
