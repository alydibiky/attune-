"""v6.10 — the CV page: make a CV, see it live in both looks, check it, and make an Arabic (right-to-left) one.
(The AI helpers are tested in unit tests v616cvai: they never add a number.)

  python3 tests/e2e_v615cv.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish

env = Env()

def open_cv(page):
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('CV / Resume')").first.click()
    page.wait_for_selector("[data-testid=cv-page]", timeout=5000)

def preview_text(page):
    return page.frame_locator("[data-testid=cv-preview] iframe").locator("body").inner_text()

with sync_playwright() as p:
    br = p.chromium.launch()
    errors = []
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    open_cv(page)
    check("No CVs yet" in page.locator("[data-testid=cv-page]").inner_text(), "the CV page opens from More, empty at first")

    # ---- a new English CV
    page.click("[data-testid=cv-new]"); page.click("[data-testid=cv-new-en]"); page.wait_for_selector("[data-testid=cv-editor]")
    page.fill("[data-testid=cv-name]", "Ahmed Ali"); page.fill("[data-testid=cv-title]", "Site Supervisor"); page.fill("[data-testid=cv-email]", "a@mail.com")
    # open the Experience section and add a job
    page.locator("[data-testid=cv-section]:has(input[value='Experience']) button").first.click(position={"x": 10, "y": 10}); page.wait_for_timeout(200)
    page.locator("[data-testid=cv-section]:has(input[value='Experience']) [data-testid=cv-add-item]").click()
    page.fill("[data-testid=cv-role]", "Site Supervisor"); page.fill("[data-testid=cv-company]", "Orascom"); page.fill("[data-testid=cv-start]", "2021-03")
    page.fill("[data-testid=cv-bullet]", "Led 12 lifts a week for 8 years")
    page.click("[data-testid=cv-tab-preview]"); page.wait_for_timeout(1200)
    pt = preview_text(page)
    check("Ahmed Ali" in pt and "Orascom" in pt and "Led 12 lifts a week" in pt, "the live preview shows what you typed")
    check("Mar 2021" in pt, "dates read well in the preview («Mar 2021»)")

    # ---- the modern look from the same content
    page.click("[data-testid=cv-tab-design]"); page.click("[data-testid=cv-layout-modern]"); page.click("[data-testid=cv-theme-burgundy]")
    page.click("[data-testid=cv-tab-preview]"); page.wait_for_timeout(1200)
    html = page.frame_locator("[data-testid=cv-preview] iframe").locator("html").evaluate("e => e.outerHTML")
    check('class="cols"' in html and "#9f1239" in html and "Ahmed Ali" in html, "the Modern look and the burgundy colour apply to the same content")

    # ---- the checker
    page.click("[data-testid=cv-tab-check]"); page.wait_for_timeout(200)
    ck = page.locator("[data-testid=cv-check]").inner_text()
    check("education" in ck.lower() or "skills" in ck.lower(), "the checker tells what is missing: %s" % ck[:80].replace("\n", " "))

    # ---- the list keeps it
    page.locator("[data-testid=cv-editor] button[aria-label=Back]").first.click(); page.wait_for_timeout(300)
    check(page.locator("[data-testid=cv-row]").count() == 1 and "Ahmed Ali" in page.locator("[data-testid=cv-row]").inner_text(), "the CV is saved in your list")
    page.locator("[data-testid=cv-row] button").first.click(); page.wait_for_selector("[data-testid=cv-editor]")

    # ---- an Arabic CV is right-to-left
    page.locator("[data-testid=cv-editor] button[aria-label=Back]").first.click(); page.wait_for_timeout(300)
    page.click("[data-testid=cv-new]"); page.click("[data-testid=cv-new-ar]"); page.wait_for_selector("[data-testid=cv-editor]")
    page.fill("[data-testid=cv-name]", "أحمد علي")
    page.click("[data-testid=cv-tab-preview]"); page.wait_for_timeout(1200)
    ah = page.frame_locator("[data-testid=cv-preview] iframe").locator("html").evaluate("e => e.outerHTML")
    check('dir="rtl"' in ah and "أحمد علي" in ah, "an Arabic CV is right-to-left")
    page.click("[data-testid=cv-tab-ai]"); page.wait_for_selector("[data-testid=cv-ai-revise]", timeout=4000)
    check(page.locator("[data-testid=cv-revise-polish]").count() == 1, "the AI tab offers Edit or improve my CV")
    check(real_errors(errors) == [], "no errors: %s" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
