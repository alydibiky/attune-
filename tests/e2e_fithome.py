"""v6.10 (item 14) — the Fit & Food home, "Log bar": the 3-question first visit, then logging a meal by search,
by a one-tap chip, by photo (the fast path, mocked), by barcode and by voice; Added · Undo; swipe-menu delete
and edit; the home in English and Arabic (screenshots tests/fithome-en.png, tests/fithome-ar.png).

  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_fithome.py
"""
import os, json, base64, re, time
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish

env = Env(); errors = []
HERE = os.path.dirname(os.path.abspath(__file__))
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")
COKE = {"code": "5449000000996", "product_name": "Coca-Cola", "brands": "Coca-Cola", "serving_quantity": 330,
        "nutriments": {"energy-kcal_100g": 42, "proteins_100g": 0, "carbohydrates_100g": 10.6, "fat_100g": 0}}
# the photo fast path: a 2-name bank (koshari, "not food") and an encoder that always "sees" koshari
BANK = {"dim": 2, "vec": base64.b64encode(bytes([127, 0, 0, 127])).decode(), "items": [["id", "koshari", "Koshari", "كشري"], ["not", "", "not food", ""]]}
MOCK = r"""(() => { const S = window.__mock = window.__mock || {}; S.codes = []; S.said = [];
  window.__attuneClipTest = { bank: %BANK%, embed: async () => [1, 0] };
  const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0);
    N.fetchJson = (id, url) => { const body = url.includes("/api/v2/product/5449000000996") ? { status: 1, product: %COKE% } : url.includes("/api/v2/product/") ? { status: 0 } : { products: [] };
      setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ url, body: JSON.stringify(body) })), 20); };
    N.scanBarcode = (id, arg) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ codes: S.codes })), 10);
    N.listen = (id, lang) => { const t = S.said.shift() || ""; setTimeout(() => { window.__attuneNative.progress(id, 0, "partial", t.slice(0, 6)); window.__attuneNative.resolve(id, JSON.stringify({ text: t })); }, 30); };
  }; go(); })();""".replace("%BANK%", json.dumps(BANK)).replace("%COKE%", json.dumps(COKE))

def eaten(page): return int(re.sub(r"[^\d]", "", page.locator("[data-testid=fit-eaten]").inner_text()) or 0)
def rows(page): return page.locator("[data-testid^=fit-item-]").count()
def open_fit(page, name="Fit & Food"):
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('%s')" % name).first.click()
    page.wait_for_selector("[data-testid=fit-qs], [data-testid=fit-today]", timeout=6000)
def undo_text(page):
    page.wait_for_selector("[data-testid=fit-undo-bar]", timeout=4000)
    return page.locator("[data-testid=fit-undo-text]").inner_text()

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=MOCK)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)

    # ---- first visit: 3 questions
    open_fit(page)
    check(page.locator("[data-testid=fit-qs]").count() == 1 and page.locator("[data-testid=fit-profile]").count() == 0, "first visit: 3 questions, not the long plan form")
    check(page.locator("[data-testid=fit-qs-next]").is_disabled(), "Next waits for an answer")
    page.locator("[data-testid=fit-qs-goal-lose]").click(); page.locator("[data-testid=fit-qs-next]").click()
    page.locator("[data-testid=fit-qs-age]").fill("30"); page.locator("[data-testid=fit-qs-cm]").fill("175"); page.locator("[data-testid=fit-qs-kg]").fill("85")
    page.locator("[data-testid=fit-qs-next]").click()
    page.locator("[data-testid=fit-qs-country]").select_option("eg")
    page.locator("[data-testid=fit-qs-next]").click()
    page.wait_for_selector("[data-testid=fit-today]", timeout=4000)
    check(page.locator("[data-testid=fit-logbar] button").count() == 4, "the home has the log bar: Photo, Barcode, Say it, Search")
    st = page.evaluate("JSON.parse(localStorage.getItem('attune:fit:v1'))")
    check(st["profile"]["goal"] == "lose" and st["profile"]["kg"] == 85 and st["country"] == "eg", "the 3 answers are saved as the plan")
    small = page.evaluate("""() => [...document.querySelectorAll('[data-testid=fit-logbar] button, [data-testid^=fit-add-]')].filter(b => { const r = b.getBoundingClientRect(); return r.height < 48 || r.width < 48; }).map(b => b.dataset.testid + ":" + Math.round(b.getBoundingClientRect().width) + "x" + Math.round(b.getBoundingClientRect().height))""")
    check(not small, "log bar and add buttons are at least 48 px " + str(small))
    check(page.locator("[data-testid=fit-country-sugg] button").count() >= 2, "suggestions from Egypt's dishes")

    # ---- log by search: Search → type → pick → Save
    page.locator("[data-testid=fit-lb-search]").click()
    check(page.evaluate("document.activeElement && document.activeElement.dataset.testid") == "fit-search", "Search opens with the cursor in the search box")
    page.fill("[data-testid=fit-search]", "koshari"); page.wait_for_timeout(300)
    page.locator("[data-testid=fit-food-koshari]").first.click()
    page.locator("[data-testid=fit-confirm]").click()
    t = undo_text(page)
    check("Added" in t, "saving says Added · Undo: " + t)
    k1 = eaten(page); check(k1 > 0, "the meal is on the ring (%d kcal)" % k1)

    # ---- undo
    page.locator("[data-testid=fit-undo]").click(); page.wait_for_timeout(200)
    check(eaten(page) == 0 and rows(page) == 0, "Undo takes the meal back off")

    # ---- log by frequent chip: one tap, no confirm screen
    page.locator("[data-testid=fit-lb-search]").click()
    page.fill("[data-testid=fit-search]", "koshari"); page.wait_for_timeout(300)
    page.locator("[data-testid=fit-food-koshari]").first.click(); page.locator("[data-testid=fit-confirm]").click(); page.wait_for_timeout(200)
    chip = page.locator("[data-testid=fit-chip-koshari]")
    check(chip.count() == 1, "a meal eaten before becomes a one-tap chip")
    chip.click(); page.wait_for_timeout(200)
    check(page.locator("[data-testid=fit-log]").count() == 0 and eaten(page) == 2 * k1 and rows(page) == 2, "one tap on the chip logs it again (%d kcal)" % eaten(page))

    # ---- delete (swipe menu) + undo, edit grams
    page.locator("[data-testid=fit-row-more]").first.click(); page.wait_for_timeout(250)
    page.locator("[data-testid=fit-row-delete]").first.click(); page.wait_for_timeout(200)
    check(rows(page) == 1 and "Deleted" in undo_text(page), "delete removes the food and offers Undo")
    page.locator("[data-testid=fit-undo]").click(); page.wait_for_timeout(200)
    check(rows(page) == 2, "Undo brings a deleted food back")
    page.locator("[data-testid=fit-row-more]").first.click(); page.wait_for_timeout(250)
    page.locator("[data-testid=fit-row-edit]").first.click()
    page.fill("[data-testid=fit-row-grams]", "175"); page.locator("[data-testid=fit-row-save]").click(); page.wait_for_timeout(200)
    check(eaten(page) < 2 * k1, "editing the grams changes the calories (%d)" % eaten(page))
    # a real swipe gesture opens the same menu
    box = page.locator("[data-testid^=fit-item-]").first.bounding_box()
    y = box["y"] + box["height"] / 2
    cx = box["x"] + box["width"] / 2; page.mouse.move(cx, y); page.mouse.down(); page.mouse.move(cx - 60, y, steps=5); page.mouse.move(cx - 130, y, steps=5); page.mouse.up(); page.wait_for_timeout(300)
    check(page.locator("[data-testid=fit-row-more][aria-expanded=true]").count() == 1, "swiping a food sideways shows Edit / Delete")
    page.locator("[data-testid=fit-row-more][aria-expanded=true]").click()
    before = eaten(page)

    # ---- log by photo: the fast path names it in a moment → Save
    with page.expect_file_chooser() as fc: page.locator("[data-testid=fit-lb-photo]").click()
    fc.value.set_files(files=[{"name": "plate.png", "mimeType": "image/png", "buffer": PNG}])
    page.wait_for_selector("[data-testid=fit-draft-item]", timeout=8000)
    check("Koshari" in page.locator("[data-testid=fit-draft]").inner_text(), "a photo is recognised by the fast path (no chat model)")
    page.locator("[data-testid=fit-confirm]").click(); page.wait_for_timeout(200)
    check(eaten(page) > before, "the photo meal is logged in 2 taps"); before = eaten(page)

    # ---- log by barcode
    page.evaluate("window.__mock.codes = ['5449000000996']")
    with page.expect_file_chooser() as fc: page.locator("[data-testid=fit-lb-barcode]").click()
    fc.value.set_files(files=[{"name": "code.png", "mimeType": "image/png", "buffer": PNG}])
    page.wait_for_selector("[data-testid=fit-draft-item]", timeout=6000)
    check("Coca" in page.locator("[data-testid=fit-draft]").inner_text(), "the barcode finds the product")
    page.locator("[data-testid=fit-confirm]").click(); page.wait_for_timeout(200)
    check(eaten(page) > before, "the product is logged"); before = eaten(page)

    # ---- log by voice: say it → read offline → Save
    page.evaluate("window.__mock.said = ['2 eggs']")
    page.locator("[data-testid=fit-lb-voice]").click()
    page.wait_for_selector("[data-testid=fit-draft-item]", timeout=6000)
    check("egg" in page.locator("[data-testid=fit-draft]").inner_text().lower(), "what was said is read into the meal")
    page.locator("[data-testid=fit-confirm]").click(); page.wait_for_timeout(200)
    check(eaten(page) > before, "the spoken meal is logged")

    # ---- water + week
    w0 = page.locator("[data-testid=fit-glass].bg-sky-400").count()
    page.locator("[data-testid=fit-water-add]").click(); page.wait_for_timeout(100)
    check(page.locator("[data-testid=fit-glass].bg-sky-400").count() == w0 + 1, "a glass of water in one tap")
    check(page.locator("[data-testid=fit-week] [style]").count() == 7, "the week chart has 7 days")
    # every other part is still reachable
    for tid in ["fit-tab-recipes", "fit-tab-move", "fit-tab-progress", "fit-edit-profile", "fit-fast", "fit-quality"]:
        check(page.locator("[data-testid=%s]" % tid).count() >= 1, "still there: " + tid)
    page.evaluate("window.scrollTo(0, 0)"); page.wait_for_timeout(5500)
    page.screenshot(path=os.path.join(HERE, "fithome-en.png"))
    saved = page.evaluate("localStorage.getItem('attune:fit:v1')")

    # ---- speed: the home renders fast even with a long log
    big = json.loads(saved)
    import datetime
    for i in range(1, 365):
        d = (datetime.date.today() - datetime.timedelta(days=i)).isoformat()
        big["days"][d] = {"meals": {"breakfast": [{"name": "Food %d" % (i % 40), "grams": 100, "kcal": 200, "p": 5, "c": 20, "f": 8, "t": i}] * 4}, "water": 1000, "workouts": []}
    page.evaluate("(s) => localStorage.setItem('attune:fit:v1', s)", json.dumps(big))
    page.reload(); page.wait_for_selector("nav", timeout=15000)
    t0 = page.evaluate("performance.now()")
    open_fit(page)
    ms = page.evaluate("performance.now()") - t0
    check(page.locator("[data-testid=fit-chips] button").count() >= 3, "a year of meals gives chips")
    print("home with a year of log opened in %.0f ms (includes the More sheet)" % ms)
    page.evaluate("(s) => localStorage.setItem('attune:fit:v1', s)", saved)
    ctx.close()

    # ---- Arabic
    ctx, page = new_page(br, env, errors, extra_init=MOCK + "\ntry { localStorage.setItem('attune:ui:lang', 'ar'); localStorage.setItem('attune:fit:v1', %s); } catch (e) {}" % json.dumps(saved))
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    open_fit(page, "الغذاء واللياقة")
    check(page.evaluate("document.documentElement.dir") == "rtl", "Arabic is right-to-left")
    lb = page.locator("[data-testid=fit-logbar]").inner_text()
    check("صورة" in lb and "باركود" in lb and not re.search(r"[A-Za-z]", lb), "the log bar is in Arabic, no Latin letters: " + lb.replace("\n", " "))
    hdr = page.locator("#fit-chips-h").inner_text()
    check(not re.search(r"[A-Za-z]", hdr), "the chips heading is Arabic: " + hdr)
    x_photo = page.locator("[data-testid=fit-lb-photo]").bounding_box()["x"]; x_search = page.locator("[data-testid=fit-lb-search]").bounding_box()["x"]
    check(x_photo > x_search, "in Arabic the bar runs right to left (Photo first, on the right)")
    page.locator("[data-testid^=fit-chip-]").first.click(); page.wait_for_timeout(200)
    u = undo_text(page); check("أُضيف" in u, "the Arabic undo bar: " + u)
    page.screenshot(path=os.path.join(HERE, "fithome-ar.png"))
    ctx.close()
    br.close()

env.close()
finish()
