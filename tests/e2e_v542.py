"""v5.42 — Fit & Food: set up a plan, log a meal from a sentence (code, no model) and from a photo
(the model reads it, the person confirms the grams), recipes, water, fasting, a guided workout, weight,
and the Chat "I ate…" chip. Arabic screen too.

  python3 tests/e2e_v542.py
"""
import os, re, json, base64
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish

env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")

def shot(page, name):
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, name + ".png"))

def queue(page, answers):
    page.evaluate("(a) => { const M = window.__mock; M.bodies = []; M.fakeQueue = a; }", answers)

def sent(page):
    return page.evaluate("window.__mock.bodies.filter(b => b.max_tokens > 2)")

def open_fit(page):
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('Fit & Food')").first.click()
    page.wait_for_selector("[data-testid=fit-profile], [data-testid=fit-app]", timeout=6000)

def num(page, tid):
    return int(re.sub(r"[^\d]", "", page.locator(f"[data-testid={tid}]").inner_text()) or 0)

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(250)

    # ---- the plan ----
    open_fit(page)
    check(page.locator("[data-testid=fit-profile]").count() == 1, "first visit asks for the plan")
    page.locator("[data-testid=fit-pf-age]").fill("21")
    page.locator("[data-testid=fit-pf-cm]").fill("178")
    page.locator("[data-testid=fit-pf-kg]").fill("92")
    check(page.locator("[data-testid=fit-pf-kg]").evaluate("e => e === document.activeElement"), "typing keeps the keyboard on the field")
    page.locator("[data-testid=fit-pf-goalKg]").fill("80")
    res = page.locator("[data-testid=fit-pf-result]").inner_text()
    check("2110 kcal" in res, "the plan shows 2110 kcal (Mifflin-St Jeor, lose 0.5 kg a week) — " + res[:60])
    shot(page, "fit-profile")
    page.locator("[data-testid=fit-pf-save]").click()
    page.wait_for_selector("[data-testid=fit-today]", timeout=4000)
    check(num(page, "fit-left") == 2110, "Today starts with 2110 kcal left")

    # ---- a sentence read by code: no model call ----
    queue(page, [])
    page.locator("[data-testid=fit-add-breakfast]").click()
    page.locator("[data-testid=fit-log-text]").fill("2 eggs, 1 baladi bread and a plate of ful")
    page.locator("[data-testid=fit-read]").click()
    page.wait_for_selector("[data-testid=fit-draft]", timeout=4000)
    check(page.locator("[data-testid=fit-draft-item]").count() == 3, "3 foods read from the sentence")
    check(len(sent(page)) == 0, "…by code, without asking the model")
    page.locator("[data-testid=fit-draft-grams]").first.fill("50")    # one egg instead of two
    page.locator("[data-testid=fit-confirm]").click()
    page.wait_for_selector("[data-testid=fit-today]", timeout=4000)
    eaten = num(page, "fit-eaten")
    check(300 < eaten < 900, f"breakfast logged with the edited grams ({eaten} kcal)")
    check(num(page, "fit-left") == 2110 - eaten, "kcal left = goal − eaten")

    # ---- a photo read by the model, confirmed by the person ----
    queue(page, [json.dumps({"kind": "meal", "items": [{"food": "koshari", "alternatives": ["pasta with tomato sauce"], "grams": 350, "confidence": 0.8}, {"food": "cola", "grams": 330, "confidence": 0.9}], "label": None}),
                 json.dumps({"items": []})])
    page.locator("[data-testid=fit-add-lunch]").click()
    page.locator("[data-testid=fit-photo-input]").set_input_files({"name": "plate.png", "mimeType": "image/png", "buffer": PNG})
    page.wait_for_timeout(400)
    page.locator("[data-testid=fit-read]").click()
    page.wait_for_selector("[data-testid=fit-draft]", timeout=8000)
    bodies = sent(page)
    check(bodies and "image" in json.dumps(bodies[-1])[:200000], "the photo went to the model")
    check(page.locator("[data-testid=fit-draft-item]").count() == 2 and "Koshari" in page.locator("[data-testid=fit-draft]").inner_text(), "the plate is read into items to confirm")
    shot(page, "fit-photo-confirm")
    page.locator("[data-testid=fit-confirm]").click()
    page.wait_for_selector("[data-testid=fit-meal-lunch]", timeout=4000)
    check("Koshari" in page.locator("[data-testid=fit-meal-lunch]").inner_text(), "lunch shows the koshari")

    # ---- water and fasting ----
    page.locator("[data-testid=fit-water-add]").click(); page.locator("[data-testid=fit-water-add]").click()
    check("0.50" in page.locator("[data-testid=fit-water]").inner_text(), "two glasses = 0.50 L")
    page.locator("[data-testid=fit-fast-16]").click()
    check("/ 16h" in page.locator("[data-testid=fit-fast]").inner_text(), "a 16:8 fast is running")

    # ---- a suggested dinner from the day's plan ----
    sug = page.locator("[data-testid=fit-suggest-dinner]")
    check(sug.count() == 1, "an empty dinner has a suggested recipe sized to what's left")
    shot(page, "fit-today")

    # ---- recipes ----
    page.locator("[data-testid=fit-tab-recipes]").click()
    page.locator("[data-testid=fit-recipe-search]").fill("lentil")
    check(page.locator("[data-testid^=fit-rc-]").count() >= 1, "recipes found by an ingredient")
    page.locator("[data-testid^=fit-rc-]").first.click()
    page.wait_for_selector("[data-testid=fit-recipe]")
    check("kcal" in page.locator("[data-testid=fit-recipe]").inner_text(), "a recipe shows its calories per serving")
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(250)
    check(page.locator("[data-testid=fit-recipes]").count() == 1, "Back from a recipe returns to the list, not out of Fit")
    # the 25,000-dish recipe book: a typed dish is found, opens, and shows calories
    page.locator("[data-testid=fit-recipe-search]").fill("salmon broccoli")
    page.wait_for_timeout(300)
    check(page.locator("[data-testid^=fit-rc-g]").count() >= 5, "the generated recipe book finds salmon + broccoli dishes")
    check("25," in page.locator("[data-testid=fit-recipe-search]").get_attribute("placeholder") or "٢٥" in page.locator("[data-testid=fit-recipe-search]").get_attribute("placeholder"), "the search box says how many recipes it searches")
    page.locator("[data-testid^=fit-rc-g]").first.click(); page.wait_for_selector("[data-testid=fit-recipe]")
    check("kcal" in page.locator("[data-testid=fit-recipe]").inner_text(), "a generated recipe shows its calories")
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(250)

    # ---- move: an activity and a guided workout ----
    page.locator("[data-testid=fit-tab-move]").click()
    page.locator("[data-testid=fit-act]").fill("brisk walking")
    page.locator("[data-testid=fit-act-min]").fill("30")
    check(page.locator("[data-testid=fit-act-log]").count() == 1, "an activity is matched with its calories")
    page.locator("[data-testid=fit-act-log]").click()
    page.locator("[data-testid=fit-start-core-back]").click()
    page.wait_for_selector("[data-testid=fit-session]")
    for _ in range(40):
        if page.locator("[data-testid=fit-session]").count() == 0: break
        page.locator("[data-testid=fit-session-next]").click(); page.wait_for_timeout(30)
    check(page.locator("[data-testid=fit-session]").count() == 0, "the guided workout runs to the end")
    page.locator("[data-testid=fit-tab-today]").click()
    check("Burned" in page.locator("[data-testid=fit-today]").inner_text() and num(page, "fit-left") > 2110 - num(page, "fit-eaten"), "burned calories are added back")

    # ---- progress: weight ----
    page.locator("[data-testid=fit-tab-progress]").click()
    page.locator("[data-testid=fit-weight]").fill("91.2"); page.locator("[data-testid=fit-weight-save]").click()
    check(page.locator("[data-testid=fit-streak]").inner_text() == "1", "streak = 1 day")
    shot(page, "fit-progress")

    # ---- Chat: "I ate…" offers Fit and opens it with the text ----
    page.locator("nav button").first.click(); page.wait_for_timeout(200)
    queue(page, ["Sounds like a good dinner.", "ok", "ok"])
    page.locator("textarea[placeholder='Message Attune']").fill("I ate a plate of koshari and a can of cola")
    page.locator("button[title='Send']").first.click()
    page.wait_for_selector("[data-testid=fit-chip]", timeout=15000)
    page.locator("[data-testid=fit-chip]").click()
    page.wait_for_selector("[data-testid=fit-log-text]", timeout=4000)
    check("koshari" in page.locator("[data-testid=fit-log-text]").input_value(), "the chip opens Fit with the meal ready to read")
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=fit-log]").count() == 0 and page.locator("[data-testid=fit-app]").count() == 1, "Back closes the log sheet first")

    # ---- saved on the phone: reload keeps everything ----
    page.reload(); page.wait_for_selector("nav", timeout=15000)
    open_fit(page)
    check(page.locator("[data-testid=fit-app]").count() == 1 and num(page, "fit-eaten") > 0, "after a reload the plan and today's meals are still there")

    # ---- Arabic ----
    page.evaluate("localStorage.setItem('attune:ui:lang', 'ar')"); page.reload(); page.wait_for_selector("nav", timeout=15000)
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('الأكل والرياضة')").first.click()
    page.wait_for_selector("[data-testid=fit-app]", timeout=6000)
    t = page.locator("[data-testid=fit-app]").inner_text()
    check("النهارده" in t and "فطار" in t and "كشري" in t, "the Fit screen in Arabic, foods by their Arabic names")
    shot(page, "fit-ar")

    check(not real_errors(errors), "no errors (%s)" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
