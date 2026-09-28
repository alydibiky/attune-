"""v6.4 — the real paths: the engine log is copied and sent with its header; a typed meal is corrected
once (another food, another portion) and read that way the next time by itself; a food is starred and
logged again from Favorites with one tap.

  python3 tests/e2e_v64.py
"""
import os, json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish

env = Env(); errors = []
STATE = {"profile": {"sex": "m", "age": 21, "cm": 178, "kg": 92, "activity": "light", "goal": "lose", "rate": 0.5, "goalKg": 80, "diet": "balanced"}, "days": {}, "weights": [], "fast": None, "myRecipes": [], "favs": [], "watchSkip": True}
INIT = "try { if (!localStorage.getItem('attune:fit:v1')) localStorage.setItem('attune:fit:v1', %s); } catch (e) {}" % json.dumps(json.dumps(STATE)) + r"""
(() => { const S = window.__mock = window.__mock || {};
  try { Object.defineProperty(navigator, "clipboard", { value: { writeText: (t) => { S.copied = t; return Promise.resolve(); } }, configurable: true }); } catch (e) {}
  const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0);
    N.log = () => "12:01:07 engine: loaded gemma in 14.2 s\n12:01:09 engine: 38 tok/s";
    N.share = (t) => { S.shared = t; };
  }; go(); })();"""

def items(page): return page.locator("[data-testid=fit-draft-item]")
def draft(page): return [(items(page).nth(i).inner_text(), page.locator("[data-testid=fit-draft-grams]").nth(i).input_value()) for i in range(items(page).count())]

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)

    # ---- 1. the engine log: shown with a header, copied, sent ----
    page.locator("button:has-text('Engine log')").first.click()
    page.wait_for_selector("[data-testid=engine-log]", timeout=4000)
    log = page.locator("[data-testid=engine-log]").inner_text()
    check(log.startswith("Attune 6.4") and "38 tok/s" in log, "the log shows the app version first, then the engine's lines")
    check(page.locator("[data-testid=engine-log]").evaluate("e => getComputedStyle(e).userSelect") in ("text", "auto"), "the log text can be selected by hand too")
    page.locator("[data-testid=engine-log-copy]").click(); page.wait_for_timeout(200)
    copied = page.evaluate("window.__mock.copied || ''")
    check(copied.startswith("Attune 6.4") and "loaded gemma" in copied, "Copy log puts the whole log, header included, on the clipboard")
    check(page.locator("text=Log copied").count() > 0, "…and says so")
    page.locator("[data-testid=engine-log-share]").click(); page.wait_for_timeout(100)
    check("38 tok/s" in page.evaluate("window.__mock.shared || ''"), "Send log hands the same text to the phone's share sheet")

    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(250)
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('Fit & Food')").first.click()
    page.wait_for_selector("[data-testid=fit-today]", timeout=6000)

    # ---- 2. correct a typed meal once ----
    page.locator("[data-testid=fit-add-lunch]").click()
    page.locator("[data-testid=fit-log-text]").fill("طبق رز وبيضتين")
    page.locator("[data-testid=fit-read]").click()
    page.wait_for_selector("[data-testid=fit-draft]", timeout=5000)
    d = draft(page)
    check(len(d) == 2 and "Rice" in d[0][0] and d[0][1] == "200" and d[1][1] == "100", "read by code: a plate of rice (200 g) and 2 eggs (100 g) — %s" % d)
    check(items(page).nth(0).locator("[data-testid=fit-alts]").count() == 1, "every typed food offers one-tap swaps and “something else…”")
    check(items(page).nth(0).locator("text=as written").count() == 1, "the portion buttons say “as written”, not “as seen”")
    alt = items(page).nth(0).locator("[data-testid=fit-alt]:has-text('Brown rice')")
    check(alt.count() == 1, "brown rice is one of the swaps")
    alt.click(); page.wait_for_timeout(150)
    page.locator("[data-testid=fit-draft-grams]").nth(0).fill("300"); page.wait_for_timeout(100)
    check("Brown rice" in items(page).nth(0).inner_text(), "swapped to brown rice")
    # ---- 3. star the eggs ----
    items(page).nth(1).locator("[data-testid=fit-fav-toggle]").click(); page.wait_for_timeout(150)
    check(page.locator("text=one tap next time").count() > 0, "starring says what it does")
    page.locator("[data-testid=fit-confirm]").click(); page.wait_for_timeout(300)

    # ---- the next time: the same words, the correction applied by itself ----
    page.locator("[data-testid=fit-add-dinner]").click()
    check(page.locator("[data-testid=fit-favs]").count() == 1 and "Egg" in page.locator("[data-testid=fit-favs]").inner_text(), "Favorites row at the top of the log sheet")
    page.locator("[data-testid=fit-log-text]").fill("طبق رز")
    page.locator("[data-testid=fit-read]").click()
    page.wait_for_selector("[data-testid=fit-draft]", timeout=5000)
    d = draft(page)
    check(len(d) == 1 and "Brown rice" in d[0][0] and d[0][1] == "300", "«طبق رز» next time: brown rice, 300 g — %s" % d)
    check(items(page).nth(0).locator("text=as you corrected it").count() == 1, "…marked “as you corrected it”")
    # the favorite in one tap
    page.locator("button:has-text('Back')").click(); page.wait_for_timeout(150)
    page.locator("[data-testid=fit-fav-item]").first.click(); page.wait_for_timeout(150)
    d = draft(page)
    check(any("Egg" in t and g == "100" for t, g in d), "one tap on the favorite adds 2 eggs (100 g), the portion it was starred at — %s" % d)
    # un-star
    k = [i for i, (t, _) in enumerate(d) if "Egg" in t][0]
    items(page).nth(k).locator("[data-testid=fit-fav-toggle]").click(); page.wait_for_timeout(150)
    page.locator("[data-testid=fit-confirm]").click(); page.wait_for_timeout(300)
    page.locator("[data-testid=fit-add-snacks]").click(); page.wait_for_timeout(150)
    check(page.locator("[data-testid=fit-favs]").count() == 0, "tapping the star again removes it from Favorites")
    saved = json.loads(page.evaluate("localStorage.getItem('attune:fit:v1')"))
    check(saved.get("favFoods") == [], "…and from what's saved")

    errs = real_errors(errors)
    check(not errs, "no JavaScript errors in the page (%d)%s" % (len(errs), (": " + errs[0]) if errs else ""))
    ctx.close(); br.close()
env.close()
finish()
