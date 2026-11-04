"""v6.37 (upgrade W1) — Fleet: a client's WhatsApp message → the free cranes, the price, the reply, a quote, the booking.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v740fleetorder.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []

def open_fleet(page):   # (as in e2e_v732fleet.py)
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.locator("nav button").last.click(); page.wait_for_timeout(300)
    page.locator(".rounded-t-2xl button:has-text('Business')").first.click()
    page.wait_for_selector("[data-testid=fleet-open]", timeout=8000); page.click("[data-testid=fleet-open]")
    page.wait_for_selector("[data-testid=fleet-app]", timeout=5000)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init="try{localStorage.setItem('attune:start','home')}catch(e){}")
    page.set_viewport_size({"width": 390, "height": 844})
    open_fleet(page)
    page.click("[data-testid=fleet-demo]"); page.wait_for_selector("[data-testid=fleet-today]")
    page.click("[data-testid=fleet-quick-order]"); page.wait_for_selector("[data-testid=fleet-order-form]")
    page.fill("[data-testid=fleet-order-text]", "محتاج ونش 50 طن بكرة يومين في 6 أكتوبر")
    page.wait_for_selector("[data-testid=fleet-order-crane]")
    rows = page.locator("[data-testid=fleet-order-crane]").all_inner_texts()
    check("Grove" in rows[0] and "60,000" in rows[0], "the two 50 t+ cranes on jobs are booked → the free Grove 250 t first, 2 days × 30,000: %s" % rows[0].replace("\n", " "))
    check(sum("Booked" in r for r in rows) == 2, "…the busy ones say which job they're on")
    reply = page.locator("[data-testid=fleet-order-reply]").inner_text()
    check("Grove" in reply and "يومين" in reply and "60,000" in reply and "6 أكتوبر" in reply, "the reply to send, in the client's language: %s" % reply[:80].replace("\n", " "))
    page.select_option("[data-testid=fleet-order-client]", index=1)
    page.click("[data-testid=fleet-order-book]"); page.wait_for_timeout(500)
    check(page.locator("[data-testid=fleet-order-form]").count() == 0, "Book it saves the job order")
    page.click("[data-testid=fleet-tab-jobs]"); page.wait_for_timeout(300)
    check("6th of October" in page.inner_text("body"), "the job is listed, at the new site")
    # shared from WhatsApp → straight to "Order from a message"
    page.evaluate("window.dispatchEvent(new MessageEvent('attune-share', {data: {kind: 'share', text: 'لو سمحت محتاجين كرين ١٠٠ طن يوم الخميس في العاصمة الإدارية'}}))")
    page.wait_for_selector("[data-testid=fleet-order-form]", timeout=8000)
    check("100" in page.input_value("[data-testid=fleet-order-tons]"), "a crane request shared from WhatsApp opens in Fleet's order form, already read")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
