"""v6.41 S1 Homework → Mark the worksheet: a photo of a child's worksheet (read on the phone) → each written answer marked by the
maths engine: right, wrong (with the right answer and the steps), or not answered.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v741worksheet.py
"""
import os, base64
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish, HERE
env = Env(); errors = []
SHEET = "Homework — page 12\\n1) 12 + 7 = 19\\n2) 8 × 7 = 54\\n3) 2x + 3 = 11\\nx = 4\\n4) 25% of 80 = 30\\n5) 15 − 9 ="
INIT = ("try{localStorage.setItem('attune:start','home')}catch(e){}"
        "(function w(){ var N = window.AttuneNative; if (!N) return setTimeout(w, 0);"
        "N.readText = function (id) { setTimeout(function () { window.__attuneNative.resolve(id, JSON.stringify({ text: '" + SHEET + "', lines: [] })); }, 30); }; })();")
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'coach'}}))")
    page.wait_for_selector("[data-testid=coach-page]", timeout=5000)
    png = page.evaluate("() => { const c = document.createElement('canvas'); c.width = 60; c.height = 60; return c.toDataURL('image/png').split(',')[1]; }")
    path = os.path.join(HERE, "_ws.png"); open(path, "wb").write(base64.b64decode(png))
    page.locator("[data-testid=coach-file]").set_input_files(path); os.remove(path)
    page.wait_for_selector("[data-testid=coach-mark]", timeout=5000)
    page.click("[data-testid=coach-mark]")
    rows = page.locator("[data-testid=coach-mark-row]")
    st = [rows.nth(i).get_attribute("data-status") for i in range(rows.count())]
    check(st == ["right", "wrong", "right", "wrong", "blank"], "marked: %s" % st)
    check("56" in rows.nth(1).inner_text() and "20" in rows.nth(3).inner_text(), "the right answers shown: 8 × 7 = 56, 25% of 80 = 20")
    check("2 of 4 right" in page.locator("[data-testid=coach-mark-score]").inner_text() and "1 not answered" in page.locator("[data-testid=coach-mark-score]").inner_text(), page.locator("[data-testid=coach-mark-score]").inner_text())
    rows.nth(1).locator("[data-testid=coach-mark-steps]").click(); page.wait_for_timeout(300)
    check(page.locator("[data-testid=coach-checked]").count() == 1, "The steps opens the lesson for that problem (checked by code)")
    ctx.close()
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
