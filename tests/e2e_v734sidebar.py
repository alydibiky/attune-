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
PLACES = ["money", "business", "health", "shelf"]   # v6.50 (Ali picked A: chats + Money · Business · Health · Shelf; the rest from the Home box)
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
    check(tabs == ["money", "life", "guardian", "deal"], "Money is one page (v7.2, Gemini's Area 1): Money · Follow-ups · Guardian · Deal Check: %s" % tabs)
    check(page.locator("[data-testid=hub-tab-life]").inner_text() == "Follow-ups" and page.locator("[data-testid=hub-tab-guardian]").inner_text() == "Guardian", "…the tabs are called Follow-ups and Guardian")
    page.click("[data-testid=hub-tab-life]"); page.wait_for_timeout(300)
    check(page.locator("[data-testid=hub-tab-life][aria-selected=true]").count() == 1, "a tab opens the sibling, marked as chosen")
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(300)
    check(page.locator("[data-testid=hub-tab-money][aria-selected=true]").count() == 1, "Back returns to the tab before")
    shot(page, "money-tabs")
    page.click("[data-testid=hub-tab-life]"); page.wait_for_timeout(400)
    parts = page.evaluate("[...document.querySelectorAll('[data-testid=hub-parts] button')].map(b => b.innerText)")
    check(parts == ["People & plans", "Reminders", "Timeline", "Dates", "Chat X-Ray"], "Follow-ups opens on People & plans, with a switch: %s" % parts)
    page.click("[data-testid=hub-part-radar]"); page.wait_for_selector("text=Deadline Radar", timeout=5000)
    check(page.locator("[data-testid=hub-tab-life][aria-selected=true]").count() == 1 and page.locator("[data-testid=hub-part-radar][aria-pressed=true]").count() == 1,
          "Dates (the Radar) opens inside the Follow-ups tab")
    page.click("[data-testid=hub-tab-guardian]"); page.wait_for_selector("[data-testid=guardian-page]", timeout=5000)
    check(page.locator("[data-testid=hub-tab-guardian][aria-selected=true]").count() == 1 and page.locator("[data-testid=hub-parts]").count() == 0,
          "the Money Guardian is its own tab")
    shot(page, "radar-parts")
    # v6.34 (Ali: "I don't want this More page"): Settings in the sidebar is settings only — no grid of every tool
    page.locator("[data-testid=header-menu]:visible").first.click(); page.click("[data-testid=phone-side] [data-testid=side-settings]"); page.wait_for_selector("[data-testid=more-settings]")
    check(page.locator("[data-testid=more-group]").count() == 0 and page.locator("[data-testid=more-guide]").count() == 0, "Settings: no 'More' grid of tools, no How-to card")
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(300)
    # Work: Business · Fleet · Crane · Reports · Tools; Tools = choices, not tabs
    page.locator("[data-testid=header-menu]:visible").first.click(); page.click("[data-testid=phone-side] [data-testid=side-go-business]"); page.wait_for_timeout(700)
    tabs = page.evaluate("[...document.querySelectorAll('[data-testid=hub-tabs] [role=tab]')].map(b => b.dataset.testid.slice(8))")
    check(tabs == ["business", "fleet", "field", "tools"], "Work opens Business with tabs Business · Team records · Reports · Tools (v6.50: the Crane toolkit lives inside Business → Fleet): %s" % tabs)
    page.click("[data-testid=hub-tab-tools]"); page.wait_for_selector("[data-testid=tools-page]")
    cards = page.evaluate("[...document.querySelectorAll('[data-testid^=tools-page-]')].map(b => b.dataset.testid.slice(11))")
    check(cards[:5] == ["improve", "convert", "instant", "studio", "video"], "Tools (v7.8, Gemini's Area 6): the five families first — Writing, Files, Instant, Studio, Video: %s" % cards)
    page.fill("[data-testid=tools-find]", "humanize"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=tools-open-humanize]").count() == 1, "searching still finds a tool")
    page.fill("[data-testid=tools-find]", "")
    shot(page, "tools-phone")
    page.click("[data-testid=tools-page-improve]"); page.wait_for_timeout(500)
    tabs = page.evaluate("[...document.querySelectorAll('[data-testid=hub-tabs] [role=tab]')].map(b => b.dataset.testid.slice(8))")
    check(tabs == ["improve", "compress", "humanize", "copilot", "library"], "v6.43: Writing opens with its tabs Improve · Shorten · Humanize · Copilot · Prompt lab: %s" % tabs)
    # Create: Assistants · Skills · Artifacts · Studio · Code
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'assistants'}}))"); page.wait_for_timeout(600)   # v6.50: from the box, not the sidebar
    tabs = page.evaluate("[...document.querySelectorAll('[data-testid=hub-tabs] [role=tab]')].map(b => b.dataset.testid.slice(8))")
    check(tabs == ["assistants", "skills", "artifacts", "studio", "code"], "Create: %s" % tabs)
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
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'learn'}}))"); page.wait_for_timeout(400)
    check(page.locator("[data-testid=hub-tab-memory]").count() == 1 and page.locator("[data-testid=hub-tab-scout]").count() == 1, "Daily: Learn, Scout, Mind, News… are tabs; the place is lit")
    shot(page, "desk-learn")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
