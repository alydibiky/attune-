"""v6.28 — Ali: "a How to Use page with detailed visuals, explanations and step-by-step walkthroughs of everything".
Phone: All → How to use Attune; getting started + every tool by area; a tool opens in place with its drawing, 3 steps (tap one: its
mark on the drawing lights), Next, a tip, and Open it (goes to the tool); search in English and Arabic. Computer: Settings → How to
use; the chapters on the left, the guide on the right (layout A). Arabic: the steps are in Arabic.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v731guide.py     (SHOTS=dir for screenshots)
"""
import os
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
INIT = "try{localStorage.setItem('attune:start','home')}catch(e){}"
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.locator("nav button").last.click(); page.wait_for_timeout(300)
    page.click("[data-testid=more-guide]")
    page.wait_for_selector("[data-testid=guide-page]", timeout=5000)
    n_rows = page.locator("[data-testid^=guide-row-]").count()
    check(n_rows >= 45, "the guide lists getting started + every tool: %d rows" % n_rows)
    ids = page.evaluate("[...document.querySelectorAll('[data-testid^=guide-row-]')].map(e => e.dataset.testid.slice(10))")
    for t in ["care", "fit", "convert", "radar", "travel", "map", "studio", "coach", "money", "start:model"]: check(t in ids, "has " + t)
    check(page.locator("[data-testid=guide-chapter]").count() >= 8, "in chapters by area")
    # a tool, opened in place
    page.click("[data-testid=guide-row-care]"); page.wait_for_timeout(200)
    w = page.locator("[data-testid=guide-walk]")
    check(w.count() == 1 and w.get_attribute("data-id") == "care", "Family health opens in place")
    check(w.locator("[data-testid=guide-step]").count() == 3 and w.locator("[data-testid=guide-sketch]").count() == 1, "3 steps and a drawing of the screen")
    check(page.locator("[data-testid=guide-mark-1]").get_attribute("opacity") == "1" and page.locator("[data-testid=guide-mark-3]").get_attribute("opacity") == "0.8", "step 1 lit on the drawing")
    w.locator("[data-testid=guide-step]").nth(2).click(); page.wait_for_timeout(100)
    check(page.locator("[data-testid=guide-mark-3]").get_attribute("opacity") == "1" and page.locator("[data-testid=guide-mark-1]").get_attribute("opacity") == "0.8", "tapping step 3 lights mark 3")
    page.click("[data-testid=guide-next]"); page.wait_for_timeout(100)
    check(page.locator("[data-testid=guide-mark-1]").get_attribute("opacity") == "1", "Next goes round to step 1")
    check("insulin" in page.locator("[data-testid=guide-tip]").inner_text().lower(), "the tip (insulin users)")
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, "guide-phone.png"), full_page=False)
    page.click("[data-testid=guide-open]"); page.wait_for_timeout(300)
    check(page.locator("[data-testid=care-page]").count() == 1, "Open it goes to Family health")
    # search
    page.locator("nav button").last.click(); page.wait_for_timeout(300); page.click("[data-testid=more-guide]"); page.wait_for_timeout(200)
    page.fill("[data-testid=guide-search]", "passport"); page.wait_for_timeout(150)
    got = page.evaluate("[...document.querySelectorAll('[data-testid^=guide-row-]')].map(e => e.dataset.testid.slice(10))")
    check("radar" in got and "travel" in got and "fit" not in got, "search 'passport' → Radar and Travel: %s" % got)
    page.fill("[data-testid=guide-search]", "zzqx"); page.wait_for_timeout(100)
    check(page.locator("[data-testid=guide-none]").count() == 1, "no match → says so")
    # computer: Settings → guide; two panels
    page.set_viewport_size({"width": 1366, "height": 860}); page.goto(env.url); page.wait_for_selector("[data-testid=side]", timeout=15000)
    page.evaluate("[...document.querySelectorAll('[data-testid=side] button')].find(b => /Settings/.test(b.innerText)).click()"); page.wait_for_timeout(300)
    page.click("[data-testid=desk-guide]"); page.wait_for_selector("[data-testid=guide-page]", timeout=5000)
    lb, rb = page.locator("[data-testid=guide-list]").bounding_box(), page.locator("[data-testid=guide-walk]").bounding_box()
    check(lb and rb and rb["x"] > lb["x"] + lb["width"] - 2, "computer: the list on the left, the guide on the right")
    check(page.locator("[data-testid=guide-walk]").get_attribute("data-id") == "start:model", "it opens on 'Get the AI on your phone'")
    page.click("[data-testid=guide-row-convert]"); page.wait_for_timeout(150)
    check(page.locator("[data-testid=guide-walk]").get_attribute("data-id") == "convert" and page.locator("[data-testid=guide-walk]").count() == 1, "a tool picked on the left shows on the right")
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, "guide-desk.png"))
    # Arabic
    page.evaluate("localStorage.setItem('attune:ui:lang','ar')"); page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.locator("nav button").last.click(); page.wait_for_timeout(300); page.click("[data-testid=more-guide]"); page.wait_for_timeout(200)
    check("إزاي تستخدم" in page.locator("[data-testid=guide-page] h2").inner_text(), "the title in Arabic")
    page.click("[data-testid=guide-row-fit]"); page.wait_for_timeout(150)
    st = page.locator("[data-testid=guide-step]").first.inner_text()
    check("وجبة" in st, "the steps in Arabic: " + st[:60])
    page.fill("[data-testid=guide-search]", "الجواز"); page.wait_for_timeout(150)
    got = page.evaluate("[...document.querySelectorAll('[data-testid^=guide-row-]')].map(e => e.dataset.testid.slice(10))")
    check("travel" in got, "Arabic search works: %s" % got)
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, "guide-phone-ar.png"))
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
