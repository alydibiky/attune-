"""v9.9.18 — the hard-run fixes in the real Chat (Ali, 11 Nov 2026: "lets do first 3 things now").
  "open Settings" / "go to Follow-ups" / "open Documents" typed in Chat open that page (they went to the AI);
  "spent 85 on parking, also remind me in an hour and a half to water the plants" does BOTH (it kept only the reminder).
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v9918chat.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
LEDGER = {"txns": [], "accounts": [{"id": "cash", "name": "Cash", "currency": "EGP", "start": 5000}]}
INIT = "try{localStorage.setItem('attune:start','home');if(!localStorage.getItem('t:seeded')){localStorage.setItem('t:seeded','1');localStorage.setItem('ledger.v3',%s)}}catch(e){}" % json.dumps(json.dumps(LEDGER))
BOX = "textarea[placeholder='Message Attune']"
def chat(page):
    page.evaluate("() => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'chat'}}))"); page.wait_for_selector(BOX, timeout=8000); page.wait_for_timeout(300)
def say(page, t):
    page.locator(BOX).fill(t); page.locator("button[title='Send']").first.click(); page.wait_for_timeout(900)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_timeout(1200)
    chat(page); say(page, "go to Follow-ups")
    check(page.locator("header p").first.inner_text().strip() == "Follow-ups", "“go to Follow-ups” opens Follow-ups: " + page.locator("header p").first.inner_text())
    chat(page); say(page, "open Documents")
    check(page.locator("header p").first.inner_text().strip() == "Documents", "“open Documents” opens Documents: " + page.locator("header p").first.inner_text())
    chat(page); say(page, "open Settings")
    check(page.locator("[data-testid=more-settings]").count() > 0 and page.locator("[data-testid=more-settings]").first.is_visible(), "“open Settings” opens Settings")
    page.keyboard.press("Escape"); page.wait_for_timeout(300)
    page.reload(); page.wait_for_timeout(1000)
    chat(page); say(page, "spent 85 on parking, also remind me in an hour and a half to water the plants"); page.wait_for_timeout(600)
    body = page.locator("body").inner_text()
    # Chat shows a card for the two orders; accept it if it asks
    for sel in ["[data-testid=do-yes]", "[data-testid=both-yes]", "button:has-text('Do both')", "button:has-text('Save')"]:
        if page.locator(sel).count() and page.locator(sel).first.is_visible(): page.locator(sel).first.click(); page.wait_for_timeout(600); break
    tx = page.evaluate("JSON.parse(localStorage.getItem('ledger.v3')).txns")
    rem = page.evaluate("Object.keys(localStorage).filter(k => /remind/i.test(k)).map(k => localStorage.getItem(k)).join(' ')")
    check(any(t.get("amount") == 85 for t in tx), "the 85 for parking is in Money: " + json.dumps(tx)[:160] + " | " + body[-200:].replace("\n", " "))
    check("water the plants" in rem, "…and the reminder to water the plants is set: " + rem[:160])
    # OK1 (Ali's OK, 11 Nov) for the pages that had their own heading: on a phone the top bar says the name, the page doesn't repeat it
    for m, name in [("privacy", "Privacy"), ("guide", "How to use Attune"), ("slides", "Slides & Reports"), ("convert", "File Converter"), ("pdfchat", "Ask a PDF"), ("cv", "CV / Resume"), ("memory", "Mind"), ("care", "Family health"), ("translate", "Translate"), ("travel", "Travel")]:
        page.evaluate("m => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", m); page.wait_for_timeout(700)
        bar = page.locator("header p").first.inner_text().strip()
        big = page.locator(".att-h1").filter(has_text=name)
        shown = any(big.nth(i).is_visible() for i in range(big.count()))
        check(bar == name and not shown, "OK1 " + m + ": the top bar says “" + name + "” (" + bar + ") and no second big heading (" + str(shown) + ")")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
env.close(); finish()
