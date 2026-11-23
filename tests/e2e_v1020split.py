"""v10.2 D1 (Ali OK'd "OK-D1" — "is that what a computer app would look like in professional apps?" yes: list + details): on a computer,
Travel, Family health → Medicines and Projects show their list on the left and the picked item open on the right; the first item is
open on arrival; ↑ ↓ move through the list; a phone keeps its own layout.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v1020split.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
CARE = {"members": [{"id": "m1", "name": "Baba"}, {"id": "m2", "name": "Mama"}], "meds": [
    {"id": "a", "member": "m1", "name": "Concor", "strength": "5 mg", "dose": "1 tablet", "freq": "once a day", "times": ["08:00"], "days": 0, "start": "2026-11-01", "stock": 5},
    {"id": "b", "member": "m2", "name": "Glucophage", "strength": "500 mg", "dose": "1 tablet", "freq": "twice a day", "times": ["09:00", "21:00"], "days": 0, "start": "2026-11-01"}], "labs": [], "taken": {}}
PROJ = [{"id": "p1", "emoji": "🏠", "name": "Flat renovation", "instructions": "", "knowledge": [], "due": "2026-12-20", "tasks": [{"id": "t1", "text": "Tiles", "col": "todo"}], "updated": 2},
        {"id": "p2", "emoji": "💼", "name": "Job hunt", "instructions": "", "knowledge": [], "due": "", "tasks": [], "updated": 1}]
INIT = ("try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:coach:v1',JSON.stringify({seen:['*']}));"
        "localStorage.setItem('attune:care:v1',%s);localStorage.setItem('attune:projects:v1',%s);}catch(e){};" % (json.dumps(json.dumps(CARE)), json.dumps(json.dumps(PROJ))))
def go(page, m): page.evaluate("(m) => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", m); page.wait_for_timeout(900)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT, desktop=(1500, 900))
    page.goto(env.url); page.wait_for_timeout(1500)
    # Travel
    go(page, "travel"); page.wait_for_selector("[data-testid=travel-split]", timeout=8000)
    rows = page.locator("[data-testid=travel-split-row]")
    check(rows.count() > 20 and page.locator("[data-testid=travel-split-detail] [data-testid=travel-page]").count() == 1, "Travel: countries on the left (%d), a country's page on the right" % rows.count())
    page.locator("[data-testid=travel-split-row]", has_text="Japan").click(); page.wait_for_timeout(600)
    check("Japan" in page.inner_text("[data-testid=travel-split-detail] h2"), "picking Japan opens Japan on the right")
    page.fill("[data-testid=travel-split-find]", "mor"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=travel-split-row]").count() >= 1 and "Morocco" in page.inner_text("[data-testid=travel-split-list]"), "the search finds Morocco")
    # Family health → Medicines
    go(page, "care"); page.click("[data-testid=care-tab-meds]"); page.wait_for_selector("[data-testid=care-split]", timeout=8000); page.wait_for_timeout(400)
    check(page.locator("[data-testid=care-split-row]").count() == 2 and "Concor" in page.inner_text("[data-testid=care-split-pane]"), "Medicines: both on the left, the first (Concor) open on the right")
    page.locator("[data-testid=care-split-row]").first.focus(); page.keyboard.press("ArrowDown"); page.wait_for_timeout(300)
    check("Glucophage" in page.inner_text("[data-testid=care-split-pane]"), "↓ opens the next medicine")
    page.click("[data-testid=care-rx-hand]"); page.wait_for_timeout(300)
    check(page.locator("[data-testid=care-split-pane] [data-testid=care-medform]").count() == 1, "Add by hand opens its form in the right pane")
    # Projects
    go(page, "projects"); page.wait_for_selector("[data-testid=projects-split]", timeout=8000)
    check(page.locator("[data-testid=projects-split-row]").count() == 2 and page.locator("[data-testid=projects-split-detail] [data-testid=project-page]").count() == 1, "Projects: the list on the left, the first project open on the right")
    page.locator("[data-testid=projects-split-row]", has_text="Job hunt").click(); page.wait_for_timeout(500)
    check("Job hunt" in page.inner_text("[data-testid=projects-split-detail]"), "picking Job hunt opens it on the right")
    check(page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), "no sideways scroll")
    ctx.close()
    # a phone keeps its own layout
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_timeout(1500)
    go(page, "projects"); go(page, "travel")
    check(page.locator("[data-testid$=-split]").count() == 0, "a phone: no split layout")
    check(not real_errors(errors), "no JavaScript errors: %s" % real_errors(errors)[:2])
    ctx.close(); br.close()
env.close(); finish()
