"""v6.18 — Fit on the real screens: the offline food pack card (download, progress, count), offline search of pack products
by name and by barcode with no internet, and the 25,000-dish recipe book. SHOTS=dir saves screenshots."""
import json, os
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
def shot(page, name):
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, name + ".png"))
L = lambda code, en, ar, brand, kcal, eg: "\t".join([code, en, ar, brand, str(kcal), "0", "10.6", "0", "0", "10.6", "", "0.01", "330", str(eg), "E", "4"])
S1 = "\n".join([L("6221000000001", "Cola Zero", "كولا زيرو", "Pepsi", 1, 1), L("5449000000002", "Coca-Cola Zero Sugar", "", "Coca-Cola", 0, 0)]) + "\n"
S2 = "\n".join(L(str(7000000000000 + i), "Biscuit %d" % i, "", "Brand%d" % (i % 9), 400, 0) for i in range(300)) + "\n"
MAN = {"version": 1, "built": "2026-10-03", "count": 302, "shards": [{"name": "foodpack-000.tsv.gz", "rows": 2, "bytes": 1000}, {"name": "foodpack-001.tsv.gz", "rows": 300, "bytes": 9000}]}
MOCK = r"""(() => { const S = window.__mock = window.__mock || {}; S.urls = []; S.packAsked = [];
  const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0);
    N.foodPackText = (id, name) => { S.packAsked.push(name);
      const text = name === 'manifest.json' ? %MAN% : name.endsWith('000.tsv.gz') ? %S1% : %S2%;
      setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ name, text })), 30); };
    N.fetchJson = (id, url) => { S.urls.push(url); setTimeout(() => window.__attuneNative.reject(id, 'offline'), 10); };
  }; go(); })();""".replace("%MAN%", json.dumps(json.dumps(MAN))).replace("%S1%", json.dumps(S1)).replace("%S2%", json.dumps(S2))
PROFILE = json.dumps({"profile": {"sex": "m", "age": 21, "cm": 178, "kg": 92, "activity": "light", "goal": "lose", "rate": 0.5, "goalKg": 80, "diet": "balanced"}, "days": {}, "weights": [], "fast": None, "myRecipes": [], "favs": []})
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
    page.evaluate("window.__attuneFoodPack.store.clear()")

    # ---- before the pack: the product is not on the phone
    page.locator("[data-testid=fit-add-snacks]").click()
    page.fill("[data-testid=fit-search]", "cola zero"); page.wait_for_timeout(400)
    check(page.locator("[data-testid^=fit-food-off]").count() == 0, "before the pack, the packaged product is not found offline")
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(250)

    # ---- the card: My plan → Offline food pack → download the starter
    page.locator("[data-testid=fit-edit-profile]").click()
    page.wait_for_selector("[data-testid=fit-foodpack]", timeout=4000)
    shot(page, "foodpack-card")
    page.locator("[data-testid=fit-foodpack-starter]").click()
    page.wait_for_function("() => document.querySelector('[data-testid=fit-foodpack]').innerText.includes('302')", timeout=10000)
    txt = page.locator("[data-testid=fit-foodpack]").inner_text()
    check("302" in txt and "Delete" in txt, "the card shows how many foods are on the phone: " + txt.replace("\n", " ")[:90])
    check(page.evaluate("window.__mock.packAsked") == ["manifest.json", "foodpack-000.tsv.gz", "foodpack-001.tsv.gz"], "it asked for the manifest, then each part once")
    shot(page, "foodpack-done")
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(300)
    if page.locator("[data-testid=fit-today]").count() == 0:
        page.locator("[data-testid=fit-edit-profile]").count()

    # ---- offline search by name, Arabic and barcode while the databases are unreachable
    page.locator("[data-testid=fit-add-snacks]").click()
    page.fill("[data-testid=fit-search]", "cola zero"); page.wait_for_timeout(500)
    check(page.locator("[data-testid^=fit-food-off]").count() >= 1, "typing finds the pack product with no internet")
    shot(page, "foodpack-search")
    page.fill("[data-testid=fit-search]", "كولا"); page.wait_for_timeout(500)
    check(page.locator("[data-testid=fit-food-off\\:6221000000001]").count() == 1, "an Arabic name finds it")
    page.fill("[data-testid=fit-search]", "7000000000123"); page.wait_for_timeout(300)
    page.locator("[data-testid=fit-search-online]").click(); page.wait_for_timeout(800)
    check("Biscuit 123" in page.locator("[data-testid=fit-draft]").inner_text() if page.locator("[data-testid=fit-draft]").count() else False, "a barcode is found offline and goes into the meal")
    page.screenshot(path=os.path.join(SHOTS, "foodpack-barcode.png")) if SHOTS else None
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(300)

    # ---- recipes
    page.locator("[data-testid=fit-tab-recipes]").click(); page.wait_for_selector("[data-testid=fit-recipes]")
    GEN = "() => [...document.querySelectorAll('[data-testid^=fit-rc-g]')].filter((e) => /^fit-rc-g\\d-\\d+$/.test(e.dataset.testid)).length"
    n_ideas = page.evaluate(GEN)
    check(n_ideas == 12, "with nothing typed the recipe book shows a dozen ideas (%d)" % n_ideas)
    shot(page, "recipes-ideas")
    page.fill("[data-testid=fit-recipe-search]", "فراخ"); page.wait_for_timeout(300)
    check(page.evaluate(GEN) >= 10, "an Arabic search finds generated dishes")
    shot(page, "recipes-arabic")
    page.locator("[data-testid^=fit-rc-g1-],[data-testid^=fit-rc-g2-],[data-testid^=fit-rc-g3-],[data-testid^=fit-rc-g4-],[data-testid^=fit-rc-g5-],[data-testid^=fit-rc-g6-]").first.click(); page.wait_for_selector("[data-testid=fit-recipe]")
    shot(page, "recipe-open")
    page.locator("[data-testid=fit-recipe-log]").click(); page.wait_for_timeout(300)
    check(real_errors(errors) == [], "no errors: %s" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
