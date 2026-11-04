"""v9.2 Projects (Ali, 4 Nov 2026: "is that how projects should look? and where are skills and assistants?" — picked 6, "combine A and B
in a smart and organised way"): the list is never empty (starters, your assistants and skills one tap away); a project has a Tasks board
(To do · Doing · Done) and "add buy tiles to Flat renovation" in the Home box puts a card on it.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v922projects.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
def go(page, m): page.evaluate("(m) => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", m); page.wait_for_timeout(600)
def projects(page): return json.loads(page.evaluate("localStorage.getItem('attune:projects:v1') || '[]'"))
with sync_playwright() as p:
    br = p.chromium.launch()
    for size, tag in [((390, 844), "[phone] "), ((1366, 860), "[computer] ")]:
        ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init="try{localStorage.setItem('attune:start','home')}catch(e){}")
        page.set_viewport_size({"width": size[0], "height": size[1]})
        page.goto(env.url); page.wait_for_timeout(1300); go(page, "projects")
        check(page.locator("[data-testid=project-starters] [data-testid^=project-starter-]").count() == 4 and page.locator("[data-testid=project-new]").count() == 1, tag + "no projects yet → 4 starters + Empty project (never a bare page)")
        helpers = page.inner_text("[data-testid=project-helpers]")
        check("Your assistants" in helpers and "Your skills" in helpers, tag + "your assistants and your skills are one tap away: " + helpers.replace("\n", " · ")[:100])
        page.click("[data-testid=project-open-assistants]"); page.wait_for_timeout(500)
        check(page.locator("[data-testid=assistants-page], [data-testid=assistant-item]").count() >= 1, tag + "…Your assistants opens the assistants")
        go(page, "projects")
        page.click("[data-testid=project-starter-home]"); page.wait_for_selector("[data-testid=project-page]", timeout=5000)
        pr = projects(page)
        check(len(pr) == 1 and pr[0]["name"] == "Flat renovation" and len(pr[0]["tasks"]) == 4 and pr[0]["instructions"], tag + "a starter makes the project in one tap, with instructions and its first 4 tasks")
        check("0 of 4 done" in page.inner_text("[data-testid=project-row-tasks]"), tag + "…the Tasks row says 0 of 4 done")
        page.click("[data-testid=project-row-tasks]"); page.wait_for_selector("[data-testid=project-board]")
        cols = page.evaluate("[...document.querySelectorAll('[data-testid^=project-col-]')].map(e => e.dataset.testid.slice(12) + ':' + e.querySelectorAll('[data-testid=project-task]').length)")
        check(cols == ["todo:4", "doing:0", "done:0"], tag + "the board: To do · Doing · Done: %s" % cols)
        page.locator("[data-testid=project-col-todo] [data-testid=project-task-next]").first.click(); page.wait_for_timeout(200)
        page.locator("[data-testid=project-col-doing] [data-testid=project-task-next]").first.click(); page.wait_for_timeout(200)
        cols = page.evaluate("[...document.querySelectorAll('[data-testid^=project-col-]')].map(e => e.dataset.testid.slice(12) + ':' + e.querySelectorAll('[data-testid=project-task]').length)")
        check(cols == ["todo:3", "doing:0", "done:1"], tag + "Doing › then Done › moves a card along: %s" % cols)
        page.fill("[data-testid=project-task-input]", "Buy paint, Fix the door"); page.click("[data-testid=project-task-add]"); page.wait_for_timeout(200)
        check(page.locator("[data-testid=project-col-todo] [data-testid=project-task]").count() == 5, tag + "two tasks at once (commas) land in To do")
        check(page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), tag + "no sideways scroll of the page (the board scrolls inside itself on a phone)")
        # from the Home box
        go(page, "home")
        page.fill("[data-testid=home-ask]", "add buy tiles to Flat renovation"); page.keyboard.press("Enter"); page.wait_for_timeout(700)
        check("Flat renovation" in page.inner_text("body") and any(t["text"] == "buy tiles" for t in projects(page)[0]["tasks"]), tag + "“add buy tiles to Flat renovation” in the box → a card on its board")
        go(page, "projects")
        it = page.inner_text("[data-testid=project-item]")
        check("tasks left" in it, tag + "the list shows how many tasks are left: " + it.replace("\n", " · ")[:100])
        ctx.close()
    errs = real_errors(errors)
    check(not errs, "no page errors: %s" % errs[:3])
env.close()
finish()
