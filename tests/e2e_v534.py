"""v5.34 — Ali: "some pages don't have a back option". The header ← and the phone's Back now close
the newest inner page first (a project, an edit form, a result), then the tool, then go home.

  python3 tests/e2e_v534.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish

env = Env(); errors = []

def open_more(page, name):
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(f".rounded-t-2xl button:has-text('{name}')").first.click(); page.wait_for_timeout(400)

def back(page):
    page.locator("header button[aria-label='Back']").click(); page.wait_for_timeout(300)

def title(page):
    return page.locator("header p").first.inner_text()

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)

    # ---- Projects: new project → saved and opened → Back → all projects → Back → Chat ----
    open_more(page, "Projects")
    page.locator("text=New project").first.click(); page.wait_for_timeout(200)
    page.locator("[data-testid=project-name]").fill("Port Said tender")
    page.locator("[data-testid=project-save]").click(); page.wait_for_timeout(400)
    check(page.locator("text=All projects").count() == 1, "the new project is open")
    back(page)
    check(page.locator("[data-testid=project-item]").count() == 1 and title(page) == "Projects", "header ← goes back ONE step: to the list of projects, still in Projects")
    back(page)
    check(page.locator("textarea[placeholder='Message Attune']").count() == 1, "…and ← again goes home to Chat")

    # ---- Assistants: the edit form has its own back, and ← closes it first ----
    open_more(page, "Assistants")
    page.locator("[data-testid=assistant-new]").click(); page.wait_for_timeout(200)
    check(page.locator("[data-testid=assistant-back]").count() == 1, "the assistant form shows '← All assistants'")
    back(page)
    check(page.locator("[data-testid=assistants-page]").count() == 1, "header ← closes the form, back to the assistants")

    # ---- the phone's Back button does the same ----
    page.locator("[data-testid=assistant-new]").click(); page.wait_for_timeout(200)
    handled = page.evaluate("window.__attuneBack()"); page.wait_for_timeout(300)
    check(handled is True and page.locator("[data-testid=assistants-page]").count() == 1, "the phone's Back closes the form first (and the app stays open)")
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(300)
    check(page.locator("textarea[placeholder='Message Attune']").count() == 1, "…then goes home")
    check(page.evaluate("window.__attuneBack()") is False, "…and on the home screen Back is left to the phone (it closes the app)")

    check(not real_errors(errors), "no errors (%s)" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
