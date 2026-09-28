"""v6.1 — Fit & Food: millions of foods (Open Food Facts + USDA, kept on the phone), barcodes read on the
phone, and on-device photo recognition: guesses to pick from, portion buttons, a second look for hidden
calories, nutrition labels read exactly, and corrections remembered for the next photo.

  python3 tests/e2e_v611.py
"""
import os, json, base64
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish

env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")
MOLTO = {"code": "6221033000018", "product_name": "Molto Magnum Chocolate", "product_name_ar": "مولتو ماجنوم شوكولاتة", "brands": "Edita", "serving_quantity": 60,
         "countries_tags": ["en:egypt"], "nutriments": {"energy-kcal_100g": 430, "proteins_100g": 7, "carbohydrates_100g": 52, "fat_100g": 21, "fiber_100g": 2}}
COKE = {"code": "5449000000996", "product_name": "Coca-Cola", "brands": "Coca-Cola", "serving_quantity": 330,
        "nutriments": {"energy-kcal_100g": 42, "proteins_100g": 0, "carbohydrates_100g": 10.6, "fat_100g": 0}}
MOCK = r"""(() => { const S = window.__mock = window.__mock || {}; S.urls = []; S.codes = [];
  const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0);
    N.fetchJson = (id, url) => { S.urls.push(url); const body = url.includes("/api/v2/product/5449000000996") ? { status: 1, product: %COKE% }
        : url.includes("/api/v2/product/") ? { status: 0 } : url.includes("usda") ? { foods: [] } : { products: [%MOLTO%] };
      setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ url, body: JSON.stringify(body) })), 20); };
    N.scanBarcode = (id, arg) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ codes: S.codes })), 10);
  }; go(); })();""".replace("%COKE%", json.dumps(COKE)).replace("%MOLTO%", json.dumps(MOLTO))
PROFILE = json.dumps({"profile": {"sex": "m", "age": 21, "cm": 178, "kg": 92, "activity": "light", "goal": "lose", "rate": 0.5, "goalKg": 80, "diet": "balanced"}, "days": {}, "weights": [], "fast": None, "myRecipes": [], "favs": []})

def shot(page, name):
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, name + ".png"))
def queue(page, answers):
    page.evaluate("(a) => { const M = window.__mock; M.bodies = []; M.fakeQueue = a; }", answers)
def items(page): return page.locator("[data-testid=fit-draft-item]")

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=MOCK + "\ntry { localStorage.setItem('attune:fit:v1', %s); } catch (e) {}" % json.dumps(PROFILE))
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(250)
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('Fit & Food')").first.click()
    page.wait_for_selector("[data-testid=fit-today]", timeout=6000)

    # ---- millions of foods: an Egyptian packaged product from Open Food Facts ----
    page.locator("[data-testid=fit-add-snacks]").click()
    page.fill("[data-testid=fit-search]", "molto")
    check(page.locator("[data-testid^=fit-food-off]").count() == 0, "not on the phone yet")
    page.locator("[data-testid=fit-search-online]").click()
    page.wait_for_selector("[data-testid=fit-food-off\\:6221033000018]", timeout=8000)
    row = page.locator("[data-testid=fit-food-off\\:6221033000018]").inner_text()
    check("Molto" in row and "🇪🇬" in row and "430" in row, "Open Food Facts finds the Egyptian Molto with its label values: " + row.replace("\n", " "))
    urls = page.evaluate("window.__mock.urls")
    check(any("openfoodfacts.org" in u and "egypt" in u for u in urls) and any("api.nal.usda.gov" in u for u in urls), "Egyptian products are asked first; USDA too")
    page.locator("[data-testid=fit-food-off\\:6221033000018]").click()
    check("60" in page.locator("[data-testid=fit-draft-grams]").first.input_value() and "258" in page.locator("[data-testid=fit-draft]").inner_text(), "one Molto = its 60 g serving = 258 kcal")
    page.locator("[data-testid=fit-confirm]").click(); page.wait_for_timeout(200)
    page.locator("[data-testid=fit-add-snacks]").click()
    page.fill("[data-testid=fit-search]", "molto")
    check(page.locator("[data-testid=fit-food-off\\:6221033000018]").count() == 1, "…and it is kept on the phone: found again offline")

    # ---- a barcode, read on the phone ----
    page.fill("[data-testid=fit-search]", "")
    page.evaluate("() => { window.__mock.codes = ['5449000000996']; }")
    page.set_input_files("[data-testid=fit-barcode-input]", {"name": "code.png", "mimeType": "image/png", "buffer": PNG})
    page.wait_for_selector("[data-testid=fit-draft]", timeout=8000)
    check("Coca-Cola" in page.locator("[data-testid=fit-draft]").inner_text() and page.locator("[data-testid=fit-draft-grams]").first.input_value() == "330", "a photo of a barcode → the exact product and its serving (330 ml)")
    page.locator("[data-testid=fit-confirm]").click(); page.wait_for_timeout(200)

    # ---- a plate: guesses, portions, hidden calories ----
    page.evaluate("() => { window.__mock.codes = []; }")
    queue(page, [json.dumps({"kind": "meal", "items": [{"food": "pasta", "alternatives": ["koshari", "rice with lentils"], "grams": 300, "confidence": 0.45}], "label": None}),
                 json.dumps({"items": [{"food": "olive oil", "grams": 10, "confidence": 0.6}, {"food": "pasta", "grams": 50}]})])
    page.locator("[data-testid=fit-add-lunch]").click()
    page.set_input_files("[data-testid=fit-photo-input]", {"name": "plate.png", "mimeType": "image/png", "buffer": PNG}); page.wait_for_timeout(300)
    page.locator("[data-testid=fit-read]").click()
    page.wait_for_selector("[data-testid=fit-hidden]", timeout=15000)
    check(items(page).count() == 2 and "Olive oil" in items(page).nth(1).inner_text(), "the second look adds the oil people forget (and never the pasta twice)")
    alts = page.locator("[data-testid=fit-alt]")
    check(alts.count() >= 2 and "Koshari" in page.locator("[data-testid=fit-alts]").first.inner_text(), "an unsure item offers its other guesses")
    shot(page, "fit-photo-guesses")
    page.locator("[data-testid=fit-alt]", has_text="Koshari").first.click()
    page.locator("[data-testid=fit-portion-1\\.5]").first.click()
    t0 = items(page).first.inner_text()
    check("Koshari" in t0 and page.locator("[data-testid=fit-draft-grams]").first.input_value() == "450", "tapped Koshari, ×1.5 → 450 g")
    page.locator("[data-testid=fit-confirm]").click(); page.wait_for_timeout(200)

    # ---- the next photo remembers the correction ----
    queue(page, [json.dumps({"kind": "meal", "items": [{"food": "pasta", "grams": 300, "confidence": 0.5}], "label": None}), json.dumps({"items": []})])
    page.locator("[data-testid=fit-add-dinner]").click()
    page.set_input_files("[data-testid=fit-photo-input]", {"name": "plate2.png", "mimeType": "image/png", "buffer": PNG}); page.wait_for_timeout(300)
    page.locator("[data-testid=fit-read]").click()
    page.wait_for_selector("[data-testid=fit-draft]", timeout=15000); page.wait_for_timeout(500)
    t1 = items(page).first.inner_text()
    check("Koshari" in t1 and "as you corrected it" in t1 and page.locator("[data-testid=fit-draft-grams]").first.input_value() == "450", "“pasta” is now read as your Koshari, at your usual portion (450 g)")
    page.locator("[data-testid=fit-confirm]").click(); page.wait_for_timeout(200)

    # ---- a nutrition label is read exactly ----
    queue(page, [json.dumps({"kind": "label", "items": [], "label": {"name": "Juhayna Greek Yogurt", "per": "100g", "serving_g": 150, "kcal": 97, "protein": 9, "carbs": 4, "fat": 5, "fiber": 0}})])
    page.locator("[data-testid=fit-add-breakfast]").click()
    page.set_input_files("[data-testid=fit-photo-input]", {"name": "label.png", "mimeType": "image/png", "buffer": PNG}); page.wait_for_timeout(300)
    page.locator("[data-testid=fit-read]").click()
    page.wait_for_selector("[data-testid=fit-draft]", timeout=15000)
    d = page.locator("[data-testid=fit-draft]").inner_text()
    check("Juhayna" in d and page.locator("[data-testid=fit-draft-grams]").first.input_value() == "150" and "146 kcal" in d, "a label photo → its own numbers, one 150 g serving = 146 kcal")
    shot(page, "fit-label")

    check(not real_errors(errors), "no errors (%s)" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
