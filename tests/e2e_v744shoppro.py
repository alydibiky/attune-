"""v6.44 Shop in depth: an offer applied at the counter (and the receipt says what was saved), a held cart picked up again,
the cashier on the sale, loyalty points, a return with a refund, and the day's reports (by hour, by cashier, returns).
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v744shoppro.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init="try{localStorage.setItem('attune:start','home')}catch(e){}")
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.locator("nav button").last.click(); page.wait_for_timeout(300)
    page.locator(".rounded-t-2xl button:has-text('Business')").first.click()
    page.wait_for_selector("[data-testid=shop-open]", timeout=8000); page.click("[data-testid=shop-open]")
    page.fill("[data-testid=shop-sentence]", "A cafe called Bean — we sell muffins, 2 staff"); page.click("[data-testid=shop-read]")
    page.fill("[data-testid=shop-tax]", "14"); page.check("[data-testid=shop-tax-ok]")
    page.locator("[data-testid=shop-confirm] label:has-text('include the tax') input").check()
    prices = page.locator("[data-testid=shop-price]"); names = page.locator("[data-testid=shop-confirm] input[dir=auto]").all()
    for i in range(prices.count()):
        n = names[i + 1].input_value() if i + 1 < len(names) else ""
        if n in ("Muffins", "Cappuccino"): prices.nth(i).fill("50" if n == "Muffins" else "60")
    page.click("[data-testid=shop-create]"); page.wait_for_selector("[data-testid=shop-sell]", timeout=5000)
    # staff, an offer, loyalty
    page.click("[data-testid=shop-tab-staff]"); page.fill("[data-testid=shop-staff-name]", "Sayed"); page.click("[data-testid=shop-staff-add]")
    page.click("[data-testid=shop-tab-customers]"); page.fill("[data-testid=shop-new-customer]", "Mona"); page.click("[data-testid=shop-add-customer]")
    page.click("[data-testid=shop-tab-stock]"); page.wait_for_selector("[data-testid=shop-offers]")
    page.click("[data-testid=shop-offer-new]"); page.wait_for_selector("[data-testid=shop-offer-form]")
    page.fill("[data-testid=shop-offer-name]", "Muffin day"); page.fill("[data-testid=shop-offer-pct]", "20")
    page.select_option("[data-testid=shop-offer-item]", label="Muffins"); page.click("[data-testid=shop-offer-save]")
    check(page.locator("[data-testid=shop-offer]").count() == 1 and "on now" in page.inner_text("[data-testid=shop-offer]"), "an offer: 20 % off muffins, on now")
    page.check("[data-testid=shop-loyalty-on]")
    # the counter: the offer, the cashier, hold and resume
    page.click("[data-testid=shop-tab-sell]"); page.select_option("[data-testid=shop-cashier]", "Sayed")
    page.locator("[data-testid=shop-item]:has-text('Muffins')").click(); page.locator("[data-testid=shop-item]:has-text('Muffins')").click()
    check("Muffin day" in page.inner_text("[data-testid=shop-offer-line]") and page.inner_text("[data-testid=shop-total]").startswith("80"), "2 muffins at 50 with 20 % off = 80.00 (" + page.inner_text("[data-testid=shop-total]") + ")")
    page.click("[data-testid=shop-hold]"); page.wait_for_selector("[data-testid=shop-held]")
    check(page.locator("[data-testid=shop-cart]").count() == 0, "the cart is held; the counter is free for the next customer")
    page.click("[data-testid=shop-held-take]"); page.wait_for_selector("[data-testid=shop-cart]")
    page.select_option("[data-testid=shop-loyal-customer]", label="Mona")
    page.click("[data-testid=shop-complete]"); page.wait_for_selector("[data-testid=shop-receipt]")
    check("You saved 20" in page.inner_text("[data-testid=shop-saved]"), "the receipt says what was saved: 20.00")
    # a return with a cash refund
    page.click("[data-testid=shop-return-open]"); page.wait_for_selector("[data-testid=shop-return]")
    page.locator("[data-testid=shop-return-qty]").first.fill("1"); page.click("[data-testid=shop-return-save]"); page.wait_for_timeout(400)
    check(page.locator("[data-testid=shop-return]").count() == 0, "one muffin returned and refunded")
    # the day's reports
    page.click("[data-testid=shop-tab-close]"); page.wait_for_selector("[data-testid=shop-reports]")
    r = page.inner_text("[data-testid=shop-reports]")
    check("Sales by hour" in r and "Sayed" in page.inner_text("[data-testid=shop-by-cashier]") and "Returns" in page.inner_text("[data-testid=shop-returns]"), "Close: sales by hour, by cashier (Sayed), the return")
    check(page.inner_text("[data-testid=shop-close-total]").startswith("80"), "the day's sales: 80.00")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
