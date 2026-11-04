"""v6.27 Shop in your pocket (Business → Shop): set up from a sentence (the tax rate must be confirmed), sell at the counter
(cash with change, card, on credit), stock goes down, low stock gives a re-order message, the day's close adds up by method.
Every sale is a real Books invoice + receipt.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v727shop.py     (SHOTS=dir for screenshots)
"""
import os
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init="try{localStorage.setItem('attune:start','home')}catch(e){}")
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.locator("nav button").last.click(); page.wait_for_timeout(300)
    page.locator(".rounded-t-2xl button:has-text('Business')").first.click()
    page.wait_for_selector("[data-testid=shop-open]", timeout=8000); page.click("[data-testid=shop-open]")
    page.fill("[data-testid=shop-sentence]", "A cafe called Bean — we sell muffins, 2 staff"); page.click("[data-testid=shop-read]")
    check(page.locator("[data-testid=shop-name]").input_value() == "Bean", "the shop's name is read")
    check(page.locator("[data-testid=shop-create]").is_disabled(), "the shop can't open before the tax rate is confirmed")
    page.fill("[data-testid=shop-tax]", "10"); page.check("[data-testid=shop-tax-ok]")
    inc = page.locator("[data-testid=shop-confirm] label:has-text('include the tax') input")
    check(not inc.is_checked(), "this browser is in the US: shelf prices start as before-tax")
    inc.check()   # this café's prices include the tax
    prices = page.locator("[data-testid=shop-price]")
    names = page.locator("[data-testid=shop-confirm] input[dir=auto]").all()
    want = {"Muffins": "2.50", "Cappuccino": "3.20", "Croissant": "2.45"}
    for i in range(prices.count()):
        n = names[i + 1].input_value() if i + 1 < len(names) else ""
        if n in want: prices.nth(i).fill(want[n])
    page.click("[data-testid=shop-create]"); page.wait_for_selector("[data-testid=shop-sell]", timeout=5000)
    check(True, "the shop opens on the counter")
    # stock in for the croissant, and a re-order level
    page.click("[data-testid=shop-tab-stock]")
    page.locator("[data-testid=shop-stock-item]:has-text('Croissant') button").first.click()
    page.fill("[data-testid=shop-receive]", "6"); page.locator("[data-testid=shop-stock-item]:has-text('Croissant') input").nth(1).fill("5")
    page.click("[data-testid=shop-edit-save]"); page.wait_for_timeout(300)
    check("6 on hand" in page.locator("[data-testid=shop-stock-item]:has-text('Croissant')").inner_text(), "6 croissants received")
    # a cash sale with change
    page.click("[data-testid=shop-tab-sell]")
    page.locator("[data-testid=shop-item]:has-text('Cappuccino')").click(); page.locator("[data-testid=shop-item]:has-text('Cappuccino')").click()
    page.locator("[data-testid=shop-item]:has-text('Croissant')").click()
    check(page.locator("[data-testid=shop-total]").inner_text().startswith("8.85"), "the total is the shelf prices: 2 × 3.20 + 2.45 = 8.85 (%s)" % page.locator("[data-testid=shop-total]").inner_text())
    page.fill("[data-testid=shop-given]", "10")
    check("1.15" in page.locator("[data-testid=shop-change-preview]").inner_text(), "the change is shown before completing: 1.15")
    page.click("[data-testid=shop-complete]"); page.wait_for_selector("[data-testid=shop-receipt]")
    check("INV-" in page.locator("[data-testid=shop-receipt]").inner_text() and "1.15" in page.locator("[data-testid=shop-change]").inner_text(), "sold: a numbered invoice, change 1.15")
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, "shop-sell.png"))
    # an item without a price can't be sold
    page.locator("[data-testid=shop-item]:has-text('Latte')").click(); page.wait_for_timeout(200)
    check(page.locator("[data-testid=shop-cart]").count() == 0, "an item without a price is not added to the cart")
    # on credit: needs a customer
    page.click("[data-testid=shop-tab-customers]"); page.fill("[data-testid=shop-new-customer]", "Mr Okafor"); page.click("[data-testid=shop-add-customer]")
    page.click("[data-testid=shop-tab-sell]"); page.locator("[data-testid=shop-item]:has-text('Muffins')").click()
    page.click("[data-testid=shop-pay-credit]")
    check(page.locator("[data-testid=shop-complete]").is_disabled(), "on credit: the sale waits for a customer")
    page.select_option("[data-testid=shop-customer]", label="Mr Okafor"); page.click("[data-testid=shop-complete]"); page.wait_for_selector("[data-testid=shop-receipt]")
    page.click("[data-testid=shop-tab-customers]")
    check("owes 2.50" in page.locator("[data-testid=shop-customer-row]:has-text('Okafor')").inner_text(), "Mr Okafor owes 2.50")
    # the day's close
    page.click("[data-testid=shop-tab-close]")
    t = page.locator("[data-testid=shop-close]").inner_text()
    check("11.35" in page.locator("[data-testid=shop-close-total]").inner_text() and "8.85" in t and "2.50" in t, "the day: 11.35 in sales, 8.85 cash, 2.50 on credit")
    page.fill("[data-testid=shop-counted]", "8.85")
    check("right" in page.locator("[data-testid=shop-diff]").inner_text(), "counted 8.85 → the drawer is right")
    # low stock → re-order (6 − 1 = 5 at the level 5)
    page.click("[data-testid=shop-tab-stock]")
    check(page.locator("[data-testid=shop-low]").count() == 1 and "Croissant" in page.locator("[data-testid=shop-low]").inner_text(), "the croissants are at their level → a re-order message")
    ctx.close()
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
