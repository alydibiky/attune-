"""v9.9.12 (Ali, 10 Nov: "Follow-ups is not logical — how does it not understand these notifications?"): his five notifications.
The Uber and talabat offers and the YouTube video are understood by code and never asked; the Google Play receipt is asked as
"Looks like you paid — add it to Money?" (Add puts 939.99 EGP into Money); the wages group opens on Attune's guess (work talk).
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v9912understand.py
"""
import json, time
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
now = int(time.time() * 1000)
NOTES = [{"id": "u", "pkg": "com.ubercab", "app": "Uber", "title": "Uber", "text": "Invite a friend to Uber and get ج.م.‏ 30 off when they take their first trip. Terms apply.", "ts": now - 60000},
         {"id": "t", "pkg": "com.talabat", "app": "talabat", "title": "talabat", "text": "For 206 EGP only instead of 295 EGP order 4 gateaux pieces from La Poire. Treat yourself on talabat.", "ts": now - 120000},
         {"id": "g", "pkg": "com.google.android.gm", "app": "Gmail", "title": "Google Play", "text": "Your Google Play Order Receipt from 7 Nov 2026\nThank you\nYour subscription from Google Commerce Limited on Google Play continues and you've been charged. Manage your subscriptions\nItem\nPrice\nGoogle AI Pro (5 TB) (Google One) (by Google LLC)\nج.م.‏ ٩٣٩٫٩٩/month\nAuto-renewing subscription", "ts": now - 180000},
         {"id": "a", "pkg": "com.google.android.gm", "app": "Gmail", "title": "Amazon.eg", "text": "Thank you for your order. Your payment was successful — you were charged EGP 1,250.00 for Philips kettle. Order number: 402-118", "ts": now - 200000},
         {"id": "y", "pkg": "com.google.android.youtube", "app": "YouTube", "title": "MrBeast", "text": "I Hustled Streamers for $250,000", "ts": now - 240000},
         {"id": "w", "pkg": "com.whatsapp", "app": "WhatsApp", "title": "ما يخص المرتبات: Mahmoud 3ashour (Alex Accountant)", "text": "ابراهيم حسن ايام الجراح ٣٠٠\nغفره بليل ٤٥٠ جنيه+١٠٠جنيه اعاشه", "ts": now - 300000}]
LEDGER = {"txns": [], "accounts": [{"id": "a1", "name": "Cash", "currency": "EGP"}]}
INIT = "try{localStorage.setItem('attune:start','home'); if(!localStorage.getItem('ledger.v3')) localStorage.setItem('ledger.v3', %s)}catch(e){}" % json.dumps(json.dumps(LEDGER))
MOCK = "(() => { function w(){ const N = window.AttuneNative; if (!N) return setTimeout(w, 5); N.recallNotes = () => JSON.stringify(%s); N.payQueue = () => '[]'; } w(); })();" % json.dumps(NOTES)
def open_mode(page, m, sel):
    page.evaluate("m => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", m); page.wait_for_selector(sel, timeout=8000); page.wait_for_timeout(300)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + ";" + MOCK)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_timeout(1200)
    open_mode(page, "timeline", "[data-testid=fu-thread]")
    txt = page.locator("[data-testid=fu-thread]").inner_text()
    check("Invite a friend" not in txt and "Treat yourself" not in txt and "Hustled" not in txt, "the Uber + talabat offers and the YouTube video are understood by code — not asked")
    check("Google AI Pro" not in txt, "the Google Play subscription receipt is not asked — Autopilot adds a known subscription by itself")
    check(page.locator("[data-testid=note-ask], [data-testid=note-paid]").count() == 2, "two cards: the Amazon receipt and the wages group (it showed five “What is this?”)")
    paid = page.locator("[data-testid=note-paid]")
    check(paid.count() == 1 and "Looks like you paid" in paid.inner_text() and "1,250" in paid.inner_text(), "the Amazon receipt → “Looks like you paid — 1,250 EGP”")
    page.click("[data-testid=note-paid-add]"); page.wait_for_timeout(300)
    tx = [t for t in page.evaluate("JSON.parse(localStorage.getItem('ledger.v3')).txns") if t["amount"] == 1250]
    check(len(tx) == 1 and tx[0]["type"] == "expense", "Add to Money → 1,250 EGP spent is in Money: %s" % [(t["amount"], t["type"], t["note"]) for t in tx])
    check(page.locator("[data-testid=note-paid]").count() == 0, "…and the card goes")
    g = page.locator("[data-testid=note-ask]").first
    check("I think I know what this is" in g.inner_text() and "Work talk" in g.inner_text(), "the wages group opens on the guess: “I think … work talk” — Save / Change")
    open_mode(page, "home", "body"); open_mode(page, "timeline", "[data-testid=fu-thread]")
    check(page.locator("[data-testid=note-paid]").count() == 0, "the receipt is not asked again after it was added")
    check(not real_errors(errors), "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
