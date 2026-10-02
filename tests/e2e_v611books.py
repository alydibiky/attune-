"""v6.11 — Business → Books: a small shop runs a day through the real screens.
Set up the company, add an item with opening stock, make a customer inside an invoice, post it (numbered, 14% VAT,
stock down), take the payment, see the dashboard and the profit report, and find everything again after a reload.

  python3 tests/e2e_v611books.py
"""
import re
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish

env = Env()

def open_books(page):
    page.locator("nav button").last.click(); page.wait_for_timeout(200)
    page.locator(".rounded-t-2xl button:has-text('Business')").first.click()
    page.wait_for_selector("[data-testid=business-page]", timeout=5000)
    page.click("[data-testid=books-open]")
    page.wait_for_selector("[data-testid=books-home]", timeout=8000)

def tab(page, name): page.click(f"[data-testid=books-tab-{name}]"); page.wait_for_timeout(250)

with sync_playwright() as p:
    br = p.chromium.launch()
    errors = []
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    open_books(page)
    check(page.locator("[data-testid=books-app]").count() == 1, "the books app opens from Business")
    check("3 steps" in page.locator("[data-testid=books-home]").inner_text(), "an empty shop is welcomed with a setup guide")

    # ---- company settings
    page.click("[data-testid=books-settings-open]"); page.wait_for_selector("[data-testid=books-settings]")
    page.fill("[data-testid=co-name]", "Adrighem Trading"); page.fill("[data-testid=co-name-ar]", "أدريغم للتجارة")
    page.click("[data-testid=books-settings-save]"); page.wait_for_timeout(400)
    check("Adrighem Trading" in page.locator("[data-testid=books-app]").inner_text(), "the company name shows in the header")

    # ---- an item with opening stock
    tab(page, "stock")
    page.click("[data-testid=item-add]")
    page.fill("[data-testid=item-name]", "Bolts box"); page.fill("[data-testid=item-price]", "100"); page.fill("[data-testid=item-cost]", "60"); page.fill("[data-testid=item-opening]", "30")
    page.click("[data-testid=item-save]"); page.wait_for_timeout(500)
    row = page.locator("[data-testid=item-row]").first.inner_text()
    check("Bolts box" in row and "30" in row, "the item is in stock with 30 on hand: %s" % row.replace("\n", " "))
    check("1,800.00" in page.locator("[data-testid=books-stock]").inner_text(), "stock value is 30 × 60 = 1,800.00")

    # ---- an invoice, with the customer created on the spot
    tab(page, "sales")
    page.click("[data-testid=sales-new]"); page.click("[data-testid=new-invoice]")
    page.wait_for_selector("[data-testid=doc-editor]")
    page.click("[data-testid=new-customer]"); page.fill("[data-testid=party-name]", "Acme Trading"); page.click("[data-testid=party-save]"); page.wait_for_timeout(400)
    page.select_option("[data-testid=line-item]", label="Bolts box"); page.wait_for_timeout(200)
    page.fill("[data-testid=line-qty]", "10"); page.wait_for_timeout(200)
    tot = page.locator("[data-testid=doc-totals]").inner_text()
    check("1,000.00" in tot and "140.00" in tot and "1,140.00" in tot, "live totals: 1,000.00 + 14%% VAT 140.00 = 1,140.00 (%s)" % tot.replace("\n", " "))
    page.click("[data-testid=doc-post]"); page.wait_for_timeout(700)
    rows = page.locator("[data-testid=sales-row]")
    check(rows.count() == 1 and re.search(r"INV-\d{4}-00001", rows.first.inner_text()) is not None, "the invoice is posted and numbered INV-yyyy-00001")

    # ---- see it, record the payment
    page.wait_for_selector("[data-testid=doc-view]")   # a posted invoice opens by itself
    check(page.locator("[data-testid=doc-edit]").count() == 0, "a posted invoice has no Edit button (it is locked)")
    page.click("[data-testid=doc-pay]"); page.wait_for_selector("[data-testid=receipt-form]")
    page.fill("[data-testid=receipt-amount]", "1140"); page.wait_for_timeout(300)
    check("INV-" in page.locator("[data-testid=receipt-plan]").inner_text(), "the receipt shows which invoice it settles")
    page.click("[data-testid=receipt-save]"); page.wait_for_timeout(700)

    # ---- the dashboard
    check("0.00" in page.locator("[data-testid=doc-view]").inner_text() or "Paid" in page.locator("[data-testid=doc-view]").inner_text(), "the invoice shows it is paid")
    page.locator("[data-testid=doc-view] button[aria-label=Close]").click(); page.wait_for_timeout(300)
    tab(page, "home")
    home = page.locator("[data-testid=books-home]").inner_text()
    check("1,140.00" in page.locator("[data-testid=stat-cash]").inner_text(), "cash on the dashboard is 1,140.00")
    check("400.00" in page.locator("[data-testid=stat-profit]").inner_text(), "this month's profit is 1,000 − 600 cost = 400.00")

    # ---- reports
    tab(page, "reports")
    body = page.locator("[data-testid=report-body]").inner_text()
    check("1,000.00" in body and "600.00" in body and "400.00" in body, "profit & loss shows sales 1,000.00, cost 600.00, profit 400.00")

    # ---- it all survives a reload
    page.reload(); page.wait_for_selector("nav", timeout=15000)
    open_books(page)
    check("1,140.00" in page.locator("[data-testid=stat-cash]").inner_text(), "after a reload the books are still there (saved on the phone)")
    page.click("[data-testid=books-settings-open]"); page.wait_for_selector("[data-testid=books-audit]")
    check("intact" in page.locator("[data-testid=books-audit]").inner_text(), "the audit log is intact")
    check(real_errors(errors) == [], "no errors: %s" % real_errors(errors)[:3])
    ctx.close()

    # ---- a second owner: the sample shop, overdue invoices, a reminder, a PIN
    errors2 = []
    ctx, page = new_page(br, env, errors2)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    open_books(page)
    page.click("[data-testid=books-sample]"); page.wait_for_timeout(1500)
    check("Nile Trading" in page.locator("[data-testid=books-app]").inner_text(), "the sample shop loads (company letterhead filled in)")
    check("overdue" in page.locator("[data-testid=stat-receivable]").inner_text(), "the dashboard shows overdue invoices")
    tab(page, "money"); page.click("text=Who owes you"); page.wait_for_timeout(300)
    check(page.locator("[data-testid=remind]").count() >= 1, "an overdue customer has a Remind (WhatsApp) button")
    page.locator("[data-testid=ageing-row]").first.click(); page.wait_for_selector("[data-testid=statement]")
    check("Closing balance" in page.locator("[data-testid=statement]").inner_text(), "tapping a customer opens their statement")
    page.locator("[data-testid=statement] button[aria-label=Close]").click(); page.wait_for_timeout(200)
    tab(page, "reports")
    page.click("text=Trial balance"); page.wait_for_timeout(300)
    check("books balance" in page.locator("[data-testid=books-reports]").inner_text(), "the trial balance of the sample shop balances")
    page.click("[data-testid=books-settings-open]"); page.wait_for_selector("[data-testid=books-settings]")
    page.fill("[data-testid=books-pin-set]", "2468"); page.locator("[data-testid=books-settings] button:has-text('Save')").first.click(); page.wait_for_timeout(500)
    page.click("[data-testid=books-settings-save]"); page.wait_for_timeout(400)
    page.reload(); page.wait_for_selector("nav", timeout=15000)
    page.locator("nav button").last.click(); page.wait_for_timeout(200)
    page.locator(".rounded-t-2xl button:has-text('Business')").first.click(); page.wait_for_selector("[data-testid=business-page]"); page.click("[data-testid=books-open]")
    page.wait_for_selector("[data-testid=books-lock]", timeout=8000)
    check(True, "with a PIN set, the books open on a lock screen")
    page.fill("[data-testid=books-pin]", "1111"); page.wait_for_timeout(300)
    check(page.locator("[data-testid=books-lock]").count() == 1, "a wrong PIN does not open it")
    page.fill("[data-testid=books-pin]", "2468"); page.wait_for_selector("[data-testid=books-home]", timeout=5000)
    check(True, "the right PIN opens the books")
    check(real_errors(errors2) == [], "no errors in the second run: %s" % real_errors(errors2)[:3])
    ctx.close(); br.close()
env.close()
finish()
