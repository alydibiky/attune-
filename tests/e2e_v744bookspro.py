"""v6.44 Books in depth: on the sample shop — the balance sheet balances, cash flow, month by month, a budget, a fixed asset
and its depreciation, payroll, a recurring invoice, a bank statement matched, an instalment plan; and in Arabic.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v744bookspro.py
"""
import os, tempfile, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
def open_books(page, biz="Business"):
    page.locator("nav button").last.click(); page.wait_for_timeout(200)
    page.locator(".rounded-t-2xl button:has-text('%s')" % biz).first.click()
    page.wait_for_selector("[data-testid=business-page]", timeout=5000)
    page.click("[data-testid=books-open]"); page.wait_for_selector("[data-testid=books-home]", timeout=8000)
def tab(page, name): page.click(f"[data-testid=books-tab-{name}]"); page.wait_for_timeout(250)
def chip(page, text): page.locator("button.rounded-full", has_text=text).first.click(); page.wait_for_timeout(250)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    open_books(page); page.click("[data-testid=books-sample]"); page.wait_for_timeout(600)
    # ---- reports
    tab(page, "reports"); chip(page, "Balance sheet"); page.wait_for_selector("[data-testid=books-bs]")
    check("the books balance" in page.inner_text("[data-testid=books-bs]"), "Reports → Balance sheet: assets = liabilities + equity")
    chip(page, "Cash flow"); page.wait_for_selector("[data-testid=books-cf]")
    check("Customers" in page.inner_text("[data-testid=books-cf]"), "Cash flow: money in from customers, out to suppliers…")
    chip(page, "Month by month"); page.wait_for_selector("[data-testid=books-months]")
    check("Year" in page.inner_text("[data-testid=books-months]"), "Month by month: 12 months and the year")
    chip(page, "Budget vs actual"); page.click("[data-testid=budget-new]"); page.wait_for_selector("[data-testid=budget-form]")
    page.fill("[data-testid=budget-m0]", "5000"); page.locator("[data-testid=budget-form] button", has_text="Same every month").click()
    page.click("[data-testid=budget-save]"); page.wait_for_timeout(400)
    check("Budget" in page.inner_text("[data-testid=books-budget]") and "better by" in page.inner_text("[data-testid=books-budget]") or "worse by" in page.inner_text("[data-testid=books-budget]"), "a budget of 5,000 a month vs the actual")
    # ---- money: fixed asset, payroll, recurring, bank, instalments
    tab(page, "money"); chip(page, "Fixed assets"); page.click("[data-testid=asset-new]"); page.wait_for_selector("[data-testid=asset-form]")
    page.fill("[data-testid=asset-name]", "Delivery van"); page.fill("[data-testid=asset-cost]", "360000"); page.fill("[data-testid=asset-life]", "60")
    page.click("[data-testid=asset-save]"); page.wait_for_timeout(400)
    check("Delivery van" in page.inner_text("[data-testid=books-assets]"), "a fixed asset: the van, 6,000 a month")
    chip(page, "Payroll"); page.click("[data-testid=emp-new]"); page.wait_for_selector("[data-testid=emp-form]")
    page.fill("[data-testid=emp-name]", "Mona"); page.fill("[data-testid=emp-gross]", "10000"); page.click("[data-testid=emp-save]"); page.wait_for_timeout(400)
    check(page.inner_text("[data-testid=payroll-net]").strip() == "8,900.00", "payroll: 10,000 − 11 % insurance = 8,900 net (" + page.inner_text("[data-testid=payroll-net]") + ")")
    page.click("[data-testid=payroll-run]"); page.wait_for_timeout(400)
    check("payroll is done" in page.inner_text("[data-testid=books-payroll]"), "the month's payroll is posted once")
    chip(page, "Recurring"); page.click("[data-testid=rec-new]"); page.wait_for_selector("[data-testid=rec-form]")
    page.select_option("[data-testid=rec-customer]", index=1); page.fill("[data-testid=rec-price]", "2500"); page.click("[data-testid=rec-save]"); page.wait_for_timeout(400)
    page.click("[data-testid=rec-run]"); page.wait_for_timeout(400)
    check("1 made" in page.inner_text("[data-testid=books-recurring]"), "a monthly invoice from today: the first one made")
    chip(page, "Bank reconciliation")
    csv = os.path.join(tempfile.gettempdir(), "bank-v744.csv"); d = datetime.date.today().strftime("%d/%m/%Y")
    open(csv, "w").write("Date,Description,Amount\n%s,Bank charges,-35.00\n" % d)
    page.set_input_files("[data-testid=bank-file]", csv); page.wait_for_selector("[data-testid=bank-only]", timeout=4000)
    check("Bank charges" in page.inner_text("[data-testid=bank-only]"), "the bank's charge is found only at the bank — to record")
    chip(page, "Instalments"); page.click("[data-testid=instal-new]"); page.wait_for_selector("[data-testid=instal-form]")
    page.fill("[data-testid=instal-count]", "3"); page.click("[data-testid=instal-save]"); page.wait_for_selector("[data-testid=instal-plan]", timeout=4000)
    check(page.locator("[data-testid=instal-plan]").count() == 1, "an invoice split into 3 instalments")
    tab(page, "reports"); chip(page, "Balance sheet")
    check("the books balance" in page.inner_text("[data-testid=books-bs]"), "after the asset, the payroll and the recurring invoice, the books still balance")
    ctx.close()
    # ---- Arabic
    ctx, page = new_page(br, env, errors, extra_init="try{localStorage.setItem('attune:ui:lang','ar')}catch(e){}")
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    open_books(page, "الأعمال"); page.click("[data-testid=books-sample]"); page.wait_for_timeout(600)
    tab(page, "reports"); chip(page, "الميزانية")
    check("الدفاتر متوازنة" in page.inner_text("[data-testid=books-bs]"), "الميزانية in Arabic")
    tab(page, "money"); chip(page, "المرتبات")
    check("مفيش موظفين لسه" in page.inner_text("[data-testid=books-payroll]"), "المرتبات in Arabic")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
