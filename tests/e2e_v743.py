"""v6.43 — Ali's 19 Oct notes: Fit's "Automatic tracking" row (like Yazio's Profile); Attune reopens on the screen that was
open after Android closed it in the background (and an answer cut by that comes back with Continue); the Ask-a-PDF actions
get their own row (words fitted letter by letter before).
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v743.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
CUT = {"id": "c1", "title": "Cars", "updated": 0, "messages": [{"id": "u1", "role": "user", "text": "Tell me about the Lynk & Co 900"},
       {"id": "a1", "role": "assistant", "text": "The Lynk & Co 900 is a large plug-in hybrid SUV", "stats": {"cut": True}}]}
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    def open_mode(m, sel):
        page.evaluate("(m) => window.dispatchEvent(new CustomEvent('attune-open', { detail: { mode: m } }))", m)
        page.wait_for_selector(sel, timeout=8000)
    # ---- Fit: the first visit's 3 questions, then Me → Automatic tracking
    open_mode("fit", "[data-testid=fit-qs-welcome], [data-testid=fit-today]")
    if page.locator("[data-testid=fit-qs-welcome]").count():
        page.click("[data-testid=fit-qs-start]")
        page.click("[data-testid=fit-qs-goal-lose]"); page.click("[data-testid=fit-qs-next]")
        page.fill("[data-testid=fit-qs-age]", "21"); page.fill("[data-testid=fit-qs-cm]", "180"); page.fill("[data-testid=fit-qs-kg]", "85")
        page.click("[data-testid=fit-qs-next]"); page.select_option("[data-testid=fit-qs-country]", "eg"); page.click("[data-testid=fit-qs-next]")
        page.wait_for_selector("[data-testid=fit-qs-plan]", timeout=4000); page.click("[data-testid=fit-qs-next]")
    page.wait_for_selector("[data-testid=fit-today]", timeout=5000)
    page.click("[data-testid=fit-tab-me]")
    page.wait_for_selector("[data-testid=fit-autotrack]", timeout=4000)
    tiles = page.locator("[data-testid^=fit-autotrack-]:not([data-testid=fit-autotrack-sheet])").count()
    check(tiles >= 7, "Automatic tracking: Health Connect, Huawei, Samsung, Garmin, Fitbit, Polar, Xiaomi (%d)" % tiles)
    page.click("[data-testid=fit-autotrack-garmin]")
    sheet = page.locator("[data-testid=fit-autotrack-sheet]").inner_text()
    check("Garmin Connect" in sheet and "Health Connect" in sheet, "Garmin: the one setting to switch on in Garmin Connect, then Connect: " + sheet[:90].replace("\n", " "))
    # ---- Android closes Attune in the background → it reopens on Fit, not on the start screen
    page.evaluate("window.dispatchEvent(new Event('attune-pause'))")
    page.reload(); page.wait_for_selector("nav", timeout=15000)
    page.wait_for_selector("[data-testid=fit-today], [data-testid=fit-me]", timeout=6000)
    check(True, "after the app was closed in the background, it reopens on the screen that was open (Fit)")
    page.reload(); page.wait_for_selector("nav", timeout=15000); page.wait_for_timeout(600)
    check(page.locator("[data-testid=fit-today], [data-testid=fit-me]").count() == 0, "a reload in front of you starts as usual (the note is used once)")
    # ---- an answer cut when the app was closed: Continue
    page.evaluate("(c) => { localStorage.setItem('attune:chats:v1', JSON.stringify([{ ...c, updated: Date.now() }])); }", CUT)
    page.reload(); page.wait_for_selector("nav", timeout=15000)
    open_mode("chat", "textarea")
    page.wait_for_selector("[data-testid=continue]", timeout=5000)
    check(True, "the answer that was being written comes back with Continue")
    # ---- design A is the default look: light, green, Home with "Your apps" and Business as its own tile
    ctx2, p2 = new_page(br, env, errors, legacy_nav=False, extra_init="try{localStorage.removeItem('attune:theme:v1');localStorage.setItem('attune:start','home');if(!localStorage.getItem('ledger.v3'))localStorage.setItem('ledger.v3',JSON.stringify({currency:'EGP',accounts:[{id:'c',name:'Cash',currency:'EGP',start:0}],txns:[],budgets:{overall:0,cats:{}},recurring:[],debts:[]}))}catch(e){}")
    p2.set_viewport_size({"width": 390, "height": 844})
    p2.goto(env.url); p2.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    check(p2.evaluate("document.documentElement.classList.contains('att-light')"), "a new install opens in design A's light look")
    check(p2.locator("[data-testid=home-app-business]").count() == 1 and p2.locator("[data-testid=home-area-health]").count() == 1, "Home: Your apps, with Business as its own tile")
    # option 1 (Ali): one sentence → Food AND Money, and both on the Today line
    check(p2.locator("[data-testid=home-line-empty]").count() == 1, "an empty day says what to tell the box")
    p2.fill("[data-testid=home-ask]", "I had koshari for lunch and paid 85 pounds"); p2.click("[data-testid=home-send]")
    p2.wait_for_selector("[data-testid=home-line-money]", timeout=5000)
    check(p2.locator("[data-testid=do-line]").count() == 2 and "Koshari" in p2.inner_text("[data-testid=home-line-fit]") and "85" in p2.inner_text("[data-testid=home-line-money]"), "one sentence: logged in Food and in Money, both on Today's line")
    p2.click("[data-testid=home-app-business]"); p2.wait_for_timeout(600)
    check(p2.locator("[data-testid=phone-home]").count() == 0, "the Business tile opens Business")
    ctx2.close()
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
