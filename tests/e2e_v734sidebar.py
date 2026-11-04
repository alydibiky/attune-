"""v6.30 — Ali: "I don't want a bottom bar in any page — a sidebar like ChatGPT; combine every feature that can be combined;
no more than 6 options on the left" and "combine all of this (Code, Improve a prompt, Compress, Humanize, Copilot, Library, Ask)
except Studio under 1 page". Runs WITHOUT the old bar (legacy_nav=False) — what people see.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v734sidebar.py     (SHOTS=dir for screenshots)
"""
import os
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
PLACES = ["home", "lists", "money", "timeline", "care", "agents", "shelf", "travel", "projects", "tools"]   # v9.1: Health = Family health; Learn / Students / Business archived; Work = Projects
OLD_PLACES = ["home", "money", "timeline", "health", "agents", "coach", "learn", "shelf", "travel", "business", "tools"]   # v8.7 (Ali picked P2-E option 1): every place, in 3 groups
def shot(page, name):
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, name + ".png"))
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init="try{localStorage.setItem('attune:start','home')}catch(e){}")
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    check(page.locator("nav:visible").count() == 0, "phone: no bottom bar")
    page.click("[data-testid=home-menu]"); page.wait_for_selector("[data-testid=phone-side]")
    ids = page.evaluate("[...document.querySelectorAll('[data-testid=phone-side] [data-testid^=side-go-]')].map(b => b.dataset.testid.slice(8))")
    check(ids == PLACES, "the sidebar is Ali's arrangement: %s" % ids)
    check(page.locator("[data-testid=phone-side] [data-testid=side-pins] button").count() == 0, "…and no extra pinned list")
    shot(page, "side-phone")
    page.click("[data-testid=phone-side] [data-testid=side-go-money]"); page.wait_for_timeout(400)
    tabs = page.evaluate("[...document.querySelectorAll('[data-testid=hub-tabs] [role=tab]')].map(b => b.dataset.testid.slice(8))")
    check(tabs == ["money", "planner"], "Money: Money · Month plan (v9.1: Deal Check archived): %s" % tabs)
    page.click("[data-testid=hub-tab-planner]"); page.wait_for_timeout(300)
    check(page.locator("[data-testid=hub-tab-planner][aria-selected=true]").count() == 1, "a tab opens the sibling, marked as chosen")
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(300)
    check(page.locator("[data-testid=hub-tab-money][aria-selected=true]").count() == 1, "Back returns to the tab before")
    shot(page, "money-tabs")
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'timeline'}}))"); page.wait_for_selector("[data-testid=timeline-page]", timeout=5000)   # (its sidebar row is checked above)
    check(page.locator("[data-testid=hub-parts]").count() == 0 and page.locator("[data-testid=fu-chips]").count() == 1, "Follow-ups (v8.5, E2): its own place, chips and no switch")
    page.click("[data-testid=fu-open-radar]"); page.wait_for_selector("text=Deadline Radar", timeout=5000)
    check(page.locator("[data-testid=part-back]").count() == 1, "Dates opens from Follow-ups, with a way back to the list")
    page.click("[data-testid=part-back]"); page.wait_for_selector("[data-testid=timeline-page]", timeout=5000)
    page.click("[data-testid=fu-open-guardian]"); page.wait_for_selector("[data-testid=guardian-page]", timeout=5000)
    check(True, "the Money Guardian opens from Follow-ups")
    shot(page, "radar-parts")
    # v6.34 (Ali: "I don't want this More page"): Settings in the sidebar is settings only — no grid of every tool
    # v9.2 round 3 (back like ChatGPT): a page opened from inside shows ‹ only — step back to the place, then ☰
    page.click("header [data-testid=header-back]"); page.wait_for_selector("[data-testid=timeline-page]", timeout=5000)
    page.locator("[data-testid=header-menu]:visible").first.click(); page.click("[data-testid=phone-side] [data-testid=side-settings]"); page.wait_for_selector("[data-testid=more-settings]")
    check(page.locator("[data-testid=more-group]").count() == 0 and page.locator("[data-testid=more-guide]").count() == 0, "Settings: no 'More' grid of tools, no How-to card")
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(300)
    # (v9.1: the Work → Business tabs check is archived with Business)
    # Create: Assistants · Skills · Artifacts · Studio · Code
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'assistants'}}))"); page.wait_for_timeout(600)   # v6.50: from the box, not the sidebar
    tabs = page.evaluate("[...document.querySelectorAll('[data-testid=hub-tabs] [role=tab]')].map(b => b.dataset.testid.slice(8))")
    check(tabs == [], "Create has no tabs: %s (v9.1: Studio and Code archived; Assistants, Skills, Artifacts live inside Projects — design D)" % tabs)
    shot(page, "create-tabs")
    # Chat's menu opens the same sidebar (the chat history)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'chat'}}))"); page.wait_for_timeout(400)
    page.locator("[data-testid=header-menu]:visible").first.click(); page.wait_for_selector("[data-testid=phone-side]")
    check(page.locator("[data-testid=phone-side] [data-testid=side-chats]").count() == 1, "in Chat, ☰ opens the sidebar with the chat history")
    ctx.close()
    # computer: the same 6 places
    ctx, page = new_page(br, env, errors, legacy_nav=False, desktop=(1366, 860))
    page.goto(env.url); page.wait_for_selector("[data-testid=side]", timeout=15000)
    ids = page.evaluate("[...document.querySelectorAll('[data-testid=side] [data-testid^=side-go-]')].map(b => b.dataset.testid.slice(8))")
    check(ids == PLACES, "computer: the same places: %s" % ids)
    # (v9.1: the Daily hub check opened the archived Learn page — removed)
    # (v9.1: the Daily hub check opened the archived Learn page — removed)
    # (v9.1: the Daily hub check opened the archived Learn page — removed)
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
