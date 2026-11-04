"""v9.2 round 3 (Ali, 5 Nov 2026: "make the back option in the app more professional, like Claude or ChatGPT"): one control in the header, never
two — a place of the side menu shows ☰; a page opened from inside a place, or a sub-view (an open project), shows ‹; a chat shows ☰ and New
chat (no extra ←). ‹ goes back one step.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v922back.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
PROJ = [{"id": "p1", "emoji": "🏠", "name": "Flat renovation", "tasks": [{"id": "t1", "text": "Buy tiles", "col": "todo"}]}]
INIT = "try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:projects:v1', %s)}catch(e){}" % json.dumps(json.dumps(PROJ))
def go(page, m): page.evaluate("(m) => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", m); page.wait_for_timeout(600)
def head(page): return [page.locator("header [data-testid=header-menu]").count(), page.locator("header [data-testid=header-back]").count()]
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_timeout(1300)
    for m in ["money", "agents", "lists", "projects"]:
        go(page, m)
        check(head(page) == [1, 0], "%s (a place of the side menu): ☰ only, no ← beside it: %s" % (m, head(page)))
    go(page, "projects")
    page.click("[data-testid=project-item]"); page.wait_for_selector("[data-testid=project-page]")
    check(head(page) == [0, 1], "an open project (a sub-view): ‹ only: %s" % head(page))
    page.click("header [data-testid=header-back]"); page.wait_for_timeout(400)
    check(page.locator("[data-testid=projects-page]").count() == 1 and head(page) == [1, 0], "‹ → back to all projects, ☰ again")
    go(page, "money"); go(page, "write")
    check(head(page) == [0, 1], "Writing (opened from inside, not a side-menu place): ‹ only: %s" % head(page))
    page.click("header [data-testid=header-back]"); page.wait_for_timeout(500)
    check(page.locator("[data-testid=money-bar]").count() == 1, "‹ goes back one step (to Money)")
    go(page, "chat")
    check(page.locator("header [data-testid=chat-home]").count() == 0 and page.locator("header [data-testid=header-menu]").count() == 1, "a chat: ☰ and New chat, no extra ←")
    errs = real_errors(errors)
    check(not errs, "no page errors: %s" % errs[:3])
env.close()
finish()
