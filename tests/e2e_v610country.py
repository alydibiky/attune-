"""v6.10 — Fit & Food follows the chosen country: Settings → «Food from» switches to Turkey, then Japan; the day's
suggestions become that country's dishes, the Recipes list leads with them, and a typed meal of a local dish
(«menemen and 2 simit», «ラーメン») is read with the dish's default portion. SHOTS=dir saves screenshots.
Uses its own ports (the shared ones may be busy)."""
import json, os, subprocess
from playwright.sync_api import sync_playwright
import harness
harness.ENGINE_PORT, harness.PAGE_PORT = int(os.environ.get("FIT_ENGINE_PORT", 18893)), int(os.environ.get("FIT_PAGE_PORT", 8869))
from harness import Env, new_page, check, real_errors, finish
HERE = os.path.dirname(os.path.abspath(__file__))
# every dish name of the two countries, straight from the data (English names are what the English screens show)
NAMES = json.loads(subprocess.check_output(["node", "--input-type=module", "-e",
    "import * as C from '%s/../web-src/fit-cuisines.js'; console.log(JSON.stringify({tr: C.dishesOf('tr').map(d => d.en), jp: C.dishesOf('jp').map(d => d.en)}))" % HERE]))
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
def shot(page, name):
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, name + ".png"))
STATE = {"profile": {"sex": "m", "age": 30, "cm": 175, "kg": 80, "activity": "light", "goal": "keep", "rate": 0.5, "goalKg": 80, "diet": "balanced"},
         "days": {}, "weights": [], "fast": None, "myRecipes": [], "favs": [], "watchSkip": True, "country": "eg"}
INIT = "try { if (!localStorage.getItem('attune:fit:v1')) localStorage.setItem('attune:fit:v1', %s); } catch (e) {}" % json.dumps(json.dumps(STATE))

def suggestion(page, m):
    loc = page.locator("[data-testid=fit-suggest-%s]" % m)
    return loc.inner_text() if loc.count() else ""
def choose(page, cc):
    page.locator("[data-testid=fit-edit-profile]").click()
    page.wait_for_selector("[data-testid=fit-country]", timeout=4000)
    page.select_option("[data-testid=fit-country]", cc); page.wait_for_timeout(200)
    shot(page, "fit-country-" + cc)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(300)
    page.wait_for_selector("[data-testid=fit-today]", timeout=4000)
def typed(page, slot, text):
    page.locator("[data-testid=fit-add-%s]" % slot).click()
    page.fill("[data-testid=fit-log-text]", text)
    page.locator("[data-testid=fit-read]").click()
    page.wait_for_selector("[data-testid=fit-draft]", timeout=5000)
    its = page.locator("[data-testid=fit-draft-item]")
    return [(its.nth(i).inner_text(), page.locator("[data-testid=fit-draft-grams]").nth(i).input_value()) for i in range(its.count())]

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(250)
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('Fit & Food')").first.click()
    page.wait_for_selector("[data-testid=fit-today]", timeout=6000)

    eg = [suggestion(page, m) for m in ("breakfast", "lunch", "dinner")]
    check(all(eg), "Egypt: breakfast, lunch and dinner each have a suggestion")

    # ---- Turkey ----
    choose(page, "tr")
    check(json.loads(page.evaluate("localStorage.getItem('attune:fit:v1')")).get("country") == "tr", "the country is saved with the Fit settings")
    tr = [suggestion(page, m) for m in ("breakfast", "lunch", "dinner")]
    check(tr != eg and sum(any(n in s for n in NAMES["tr"]) for s in tr) >= 3, "Turkey: the day's suggestions are Turkish dishes: " + " | ".join(s[:50] for s in tr))
    shot(page, "fit-today-tr")
    d = typed(page, "breakfast", "menemen and 2 simit")
    check(len(d) == 2 and "Menemen" in d[0][0] and d[0][1] == "250" and "Simit" in d[1][0] and d[1][1] == "200", "Turkey: «menemen and 2 simit» → menemen 250 g + 2 simit 200 g: %s" % d)
    shot(page, "fit-typed-tr")
    page.locator("[data-testid=fit-confirm]").click(); page.wait_for_timeout(250)
    check("Menemen" in page.locator("[data-testid=fit-meal-breakfast]").inner_text(), "the Turkish breakfast is logged")
    page.locator("[data-testid=fit-tab-recipes]").click(); page.wait_for_timeout(250)
    first = page.locator("[data-testid^=fit-rc-]").first.get_attribute("data-testid")
    check(first.startswith("fit-rc-dish:tr."), "Recipes lead with Turkish dishes (%s)" % first)
    check(page.locator("[data-testid=fit-recipes] button:text-is('Turkey')").count() == 1, "the «Egyptian» tag becomes «Turkey»")
    page.fill("[data-testid=fit-recipe-search]", "lahmacun"); page.wait_for_timeout(300)
    check(page.locator("[data-testid='fit-rc-dish:tr.lahmacun']").count() == 1, "a Turkish dish is found in Recipes by name")
    page.fill("[data-testid=fit-recipe-search]", "")
    page.locator("[data-testid=fit-tab-today]").click(); page.wait_for_timeout(250)

    # ---- Japan ----
    choose(page, "jp")
    jp = [suggestion(page, m) for m in ("lunch", "dinner")]
    check(jp != tr[1:] and sum(any(n in s for n in NAMES["jp"]) for s in jp) >= 2, "Japan: the suggestions change to Japanese dishes: " + " | ".join(s[:50] for s in jp))
    d = typed(page, "lunch", "ラーメン")
    check(len(d) == 1 and "Ramen" in d[0][0] and d[0][1] == "600", "Japan: «ラーメン» → a 600 g bowl of ramen: %s" % d)
    page.locator("[data-testid=fit-confirm]").click(); page.wait_for_timeout(250)
    shot(page, "fit-today-jp")
    page.locator("[data-testid=fit-add-dinner]").click()
    page.fill("[data-testid=fit-search]", "gyoza"); page.wait_for_timeout(400)
    first = page.locator("[data-testid^=fit-food-]").first
    check(first.count() == 1 and first.get_attribute("data-testid") == "fit-food-jp.gyoza", "Japan: food search lists gyoza first")
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(250)

    # ---- back to Egypt: as before ----
    choose(page, "eg")
    check(suggestion(page, "dinner") == eg[2], "Egypt again: the dinner suggestion is the Egyptian one")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
