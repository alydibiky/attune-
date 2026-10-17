"""v6.34 — Ali: "the maid comes every Saturday and takes 600 EGP: a checkbox when I log in on Saturday; I tick that she came and
it records the expense automatically". People & plans reads the sentence; on its day Home shows the checkbox; a tick writes the
expense into Money's ledger; People & plans shows it ticked.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v737maid.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
INIT = """try{localStorage.setItem('attune:start','home');localStorage.setItem('ledger.v3',JSON.stringify({accounts:[{id:'a1',name:'Cash',currency:'EGP'}],txns:[],cats:[]}))}catch(e){}"""
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    today = WD[page.evaluate("new Date().getDay()")]
    # say it once in People & plans (today's weekday, so the first box is today)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'life'}}))"); page.wait_for_selector("[data-testid=life-page]", timeout=5000)
    page.fill("[data-testid=life-input]", "The maid comes every %s and takes 600 EGP" % today); page.keyboard.press("Enter")
    page.wait_for_selector("[data-testid=life-draft]")
    d = page.locator("[data-testid=life-draft]").inner_text()
    check("Maid" in d and "600" in d and "every %s" % today in d and "by itself" in d, "read as: the maid, 600 each time, every %s (%s)" % (today, d.replace("\n", " | ")))
    page.click("[data-testid=life-save]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=life-item]:has-text('Maid')").count() == 1, "saved under Comes regularly")
    # Home: today's box
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'home'}}))"); page.wait_for_selector("[data-testid=phone-home]", timeout=5000)
    row = page.locator("[data-testid=home-regular]")
    check(row.count() == 1 and "Maid" in row.inner_text() and "600" in row.inner_text(), "Home: a checkbox for the maid today")
    page.click("[data-testid=home-regular-tick]"); page.wait_for_timeout(300)
    note = page.locator("[data-testid=home-regular-note]").inner_text()
    check("Recorded in Money" in note and "600" in note, "ticked → %s" % note)
    led = page.evaluate("JSON.parse(localStorage.getItem('ledger.v3'))")
    check(len(led["txns"]) == 1 and led["txns"][0]["amount"] == 600 and led["txns"][0]["type"] == "expense" and "Maid" in led["txns"][0]["note"], "…the expense is in Money's ledger: %s" % led["txns"])
    check(page.locator("[data-testid=home-regular]").count() == 0, "…and the box is gone for today")
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'life'}}))"); page.wait_for_selector("[data-testid=life-page]", timeout=5000)
    check(page.locator("[data-testid=life-item]:has-text('Maid') [data-testid=life-tick][aria-pressed=true]").count() == 1, "People & plans shows today ticked")
    # untick there → out of Money again
    page.locator("[data-testid=life-item]:has-text('Maid') [data-testid=life-tick][aria-pressed=true]").click(); page.wait_for_timeout(300)
    check(len(page.evaluate("JSON.parse(localStorage.getItem('ledger.v3'))")["txns"]) == 0, "unticked → taken out of Money")
    check(real_errors(errors) == [], "no page errors: %s" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
