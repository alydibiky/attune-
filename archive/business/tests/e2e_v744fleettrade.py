"""v6.44 Fleet: a quotation for a client → printed → sent → "Make the job order"; a purchase order → received in part →
in the store with its own code → the rest; the supplier's balance and statement; Arabic on the new screens.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v744fleettrade.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
def open_fleet(page, biz="Business"):
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.locator("nav button").last.click(); page.wait_for_timeout(300)
    page.locator(".rounded-t-2xl button:has-text('%s')" % biz).first.click()
    page.wait_for_selector("[data-testid=fleet-open]", timeout=8000); page.click("[data-testid=fleet-open]")
    page.wait_for_selector("[data-testid=fleet-app]", timeout=5000)
    page.click("[data-testid=fleet-demo]"); page.wait_for_selector("[data-testid=fleet-today]")
close = lambda page: page.locator("[data-testid=fleet-sheet] button[aria-label]").first.click()
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init="try{localStorage.setItem('attune:start','home')}catch(e){}")
    page.set_viewport_size({"width": 390, "height": 844})
    open_fleet(page)
    # ---- a quotation → a job order
    page.click("[data-testid=fleet-tab-jobs]"); page.click("[data-testid=fleet-jobsf-quotes]"); page.wait_for_selector("[data-testid=fleet-quotes]")
    page.click("[data-testid=fleet-new-quote]"); page.wait_for_selector("[data-testid=fleet-quote-form]")
    page.select_option("[data-testid=fleet-f-qclient]", index=1); page.fill("[data-testid=fleet-f-qtons]", "200")
    page.select_option("[data-testid=fleet-f-qcrane]", index=1); page.fill("[data-testid=fleet-f-qqty]", "10")
    check("30,000" in page.input_value("[data-testid=fleet-f-qrate]").replace("30000", "30,000"), "the free 250 t crane is offered for 200 t and fills its day rate (30,000)")
    check("342,000" in page.inner_text("[data-testid=fleet-quote-total]"), "10 days × 30,000 + VAT 14 % = 342,000")
    page.click("[data-testid=fleet-save]"); page.wait_for_selector("[data-testid=fleet-quote-view]", timeout=4000)
    check("QT-0001" in page.inner_text("[data-testid=fleet-quote-view]"), "the quotation QT-0001 opens")
    page.click("[data-testid=fleet-quote-print]"); page.wait_for_timeout(300)
    page.click("[data-testid=fleet-quote-sent]"); page.wait_for_timeout(200)
    page.select_option("[data-testid=fleet-f-jsite]", index=1); page.click("[data-testid=fleet-quote-job]"); page.wait_for_timeout(400)
    check(page.locator("[data-testid=fleet-quote-view]").count() == 0, "the client said yes → the job order is made")
    check("Won" in page.inner_text("[data-testid=fleet-quotes]") and "100" in page.inner_text("[data-testid=fleet-quotes]"), "the quote shows as won; the win rate is 100 %")
    page.click("[data-testid=fleet-jobsf-active]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=fleet-job]").count() == 3 and "Grove" in page.inner_text("[data-testid=fleet-jobs]"), "the new job order is active, on the Grove")
    # ---- a purchase order → received in part → the rest
    page.click("[data-testid=fleet-tab-store]"); page.click("[data-testid=fleet-sseg-orders]"); page.wait_for_selector("[data-testid=fleet-pos]")
    page.click("[data-testid=fleet-new-po]"); page.wait_for_selector("[data-testid=fleet-po-form]")
    page.fill("[data-testid=fleet-f-povendor]", "Bolts & Co"); page.fill("[data-testid=fleet-f-poitem]", "Bolt M20"); page.fill("[data-testid=fleet-f-poqty]", "100"); page.fill("[data-testid=fleet-f-poprice]", "25")
    page.click("[data-testid=fleet-save]"); page.wait_for_selector("[data-testid=fleet-po-view]", timeout=4000)
    check("PO-0001" in page.inner_text("[data-testid=fleet-po-view]") and "2,500" in page.inner_text("[data-testid=fleet-po-view]"), "PO-0001: 100 bolts × 25 = 2,500")
    page.fill("[data-testid=fleet-po-got]", "60"); page.fill("[data-testid=fleet-f-porecv]", "Mahmoud"); page.click("[data-testid=fleet-po-receive-save]"); page.wait_for_timeout(300)
    check("60 / 100" in page.inner_text("[data-testid=fleet-po-line]") and "Partly received" in page.inner_text("[data-testid=fleet-po-view]"), "60 received → partly received")
    page.click("[data-testid=fleet-po-receive-save]"); page.wait_for_timeout(300)
    check("100 / 100" in page.inner_text("[data-testid=fleet-po-line]") and page.locator("[data-testid=fleet-po-receive]").count() == 0, "the rest (40) received → complete")
    close(page); page.click("[data-testid=fleet-sseg-stock]"); page.wait_for_timeout(200)
    check("Bolt M20" in page.inner_text("[data-testid=fleet-store]") and "100" in page.locator("[data-testid=fleet-item]", has_text="Bolt M20").inner_text(), "the bolts are in the store: 100")
    # ---- the supplier
    page.click("[data-testid=fleet-sseg-suppliers]"); page.wait_for_selector("[data-testid=fleet-vendors]")
    page.locator("[data-testid=fleet-vendor]", has_text="Bolts").click(); page.wait_for_selector("[data-testid=fleet-vendor-statement]")
    check("2,500" in page.inner_text("[data-testid=fleet-vendor-statement]"), "the supplier's statement: 2,500 owed for two receipts")
    page.click("[data-testid=fleet-vendor-pay]"); page.wait_for_selector("[data-testid=fleet-cheque-form]")
    check(page.locator("[data-testid=fleet-cheque-form] input[value='Bolts & Co']").count() == 1 or "Bolts & Co" in page.inner_html("[data-testid=fleet-cheque-form]"), "Pay this supplier opens Paid out with the supplier filled in")
    close(page); ctx.close()
    # ---- Arabic
    ctx, page = new_page(br, env, errors, extra_init="try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:ui:lang','ar')}catch(e){};window.__trMiss=new Set()")
    page.set_viewport_size({"width": 390, "height": 844})
    open_fleet(page, "الأعمال")
    page.click("[data-testid=fleet-tab-jobs]"); page.click("[data-testid=fleet-jobsf-quotes]"); page.click("[data-testid=fleet-new-quote]"); page.wait_for_timeout(200); close(page)
    page.click("[data-testid=fleet-tab-store]"); page.click("[data-testid=fleet-sseg-orders]"); page.click("[data-testid=fleet-new-po]"); page.wait_for_timeout(200); close(page)
    page.click("[data-testid=fleet-sseg-suppliers]"); page.wait_for_timeout(200)
    miss = [m for m in page.evaluate("[...window.__trMiss]") if not m.startswith("[DEMO]")]
    check(not miss, "Arabic: no English left on the new screens" + (": " + "; ".join(miss[:8]) if miss else ""))
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
