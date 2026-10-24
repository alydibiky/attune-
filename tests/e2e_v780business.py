"""v7.5 — Business, Books and Shop from Gemini's mock-up "Area 4: Business Hub, Books & Shop" (Ali sent it 24 Oct 2026): the hub's calm
view (today's counter sales, who owes you, what needs attention; the three systems with a status pill), Books → "See all → Books Report"
(the overview: this month, 6 months of sales vs purchases with the profit line, ageing 0–30 / 31–60 / 60+, top customers & items, CSV)
and the Shop Report (today and this week, payment methods, best sellers, staff and closes). Phone + computer, dark + light, Arabic, 360 px.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v780business.py     (SHOTS=dir for screenshots)
"""
import os
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
INIT = "try{localStorage.setItem('attune:biz:intro','1')}catch(e){}"
LIGHT = ";try{localStorage.setItem('attune:theme:v1', JSON.stringify({accent:'teal',bg:'light'}))}catch(e){}"
AR = ";try{localStorage.setItem('attune:ui:lang','ar')}catch(e){}"
def shot(page, name, full=False):
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, name + ".png"), full_page=full)
def ev(page, name, detail):
    page.evaluate("([n, d]) => window.dispatchEvent(new CustomEvent(n, {detail: d}))", [name, detail]); page.wait_for_timeout(500)
def to_hub(page):
    for _ in range(4):
        if page.locator("[data-testid=business-page]").count(): break
        page.evaluate("window.__attuneBack()"); page.wait_for_timeout(350)
    page.wait_for_selector("[data-testid=business-page]", timeout=5000); page.wait_for_timeout(500)
def seed(page):
    """The sample books, then a shop on top of them (set up from a sentence), Salma clocked in, two counter sales (cash, card)."""
    page.wait_for_timeout(1000)
    ev(page, "attune-open", {"mode": "business"}); page.wait_for_selector("[data-testid=business-page]", timeout=8000)
    ev(page, "attune-biz-view", "books"); page.wait_for_selector("[data-testid=books-sample]", timeout=8000)
    page.click("[data-testid=books-sample]"); page.wait_for_selector("[data-testid=books-open-report]", timeout=8000)
    to_hub(page)
    ev(page, "attune-biz-view", "shop"); page.wait_for_selector("[data-testid=shop-sentence]", timeout=8000)
    page.fill("[data-testid=shop-sentence]", "A hardware shop called Nile Trading — we sell bolts, 2 staff"); page.click("[data-testid=shop-read]")
    page.fill("[data-testid=shop-tax]", "14"); page.check("[data-testid=shop-tax-ok]")
    page.click("[data-testid=shop-create]"); page.wait_for_selector("[data-testid=shop-sell]", timeout=6000)
    page.click("[data-testid=shop-tab-staff]"); page.fill("[data-testid=shop-staff-name]", "Salma"); page.click("[data-testid=shop-staff-add]")
    page.locator("[data-testid=shop-clock]").first.click(); page.wait_for_timeout(150)
    page.click("[data-testid=shop-tab-sell]"); page.select_option("[data-testid=shop-cashier]", "Salma")
    for m in ["cash", "card"]:
        page.locator("[data-testid=shop-item]:has-text('Bolts')").first.click(); page.wait_for_timeout(100)
        page.click("[data-testid=shop-pay-%s]" % m); page.click("[data-testid=shop-complete]"); page.wait_for_selector("[data-testid=shop-receipt]", timeout=4000)
        page.wait_for_timeout(200)
with sync_playwright() as p:
    br = p.chromium.launch()
    for theme in ["dark", "light"]:
        ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + (LIGHT if theme == "light" else ""))
        page.set_viewport_size({"width": 390, "height": 844})
        page.goto(env.url)
        tag = "[phone %s] " % theme
        seed(page)
        page.click("[data-testid=shop-open-report]"); page.wait_for_selector("[data-testid=shop-report]", timeout=4000); page.wait_for_timeout(300)
        today = page.locator("[data-testid=sr-today]").inner_text()
        check("sales" in today and "Avg" in today, tag + "the Shop Report: today's sales and receipts: %s" % today.replace("\n", " · "))
        check(page.locator("[data-testid=sr-method-cash]").count() == 1 and page.locator("[data-testid=sr-method-card]").count() == 1, tag + "…how it was paid: cash and card")
        check(page.locator("[data-testid=sr-week-chart] rect").count() == 7, tag + "…this week, 7 bars")
        check("Bolts" in page.locator("[data-testid=sr-best]").inner_text() and "×" in page.locator("[data-testid=sr-best]").inner_text(), tag + "…best sellers with how many were sold")
        check("Salma" in page.locator("[data-testid=sr-staff-row]").first.inner_text() and "On shift" in page.locator("[data-testid=sr-staff-row]").first.inner_text(), tag + "…Salma on shift with her sales")
        check(page.locator("[data-testid=shop-reports]").count() == 1, tag + "…and the hourly / by-cashier reports below")
        shot(page, "shop-report-phone-" + theme, True)
        page.click("[data-testid=shop-report-back]"); page.wait_for_timeout(200)
        check(page.locator("[data-testid=shop-sell]").count() == 1, tag + "Back returns to the counter")
        page.click("[data-testid=shop-tab-close]")
        check(page.locator("[data-testid=shop-close-report]").count() == 1, tag + "the day close links to the Shop Report too")
        shot(page, "shop-sell-phone-" + theme)
        to_hub(page)
        sales, owed = page.locator("[data-testid=biz-kpi-sales]").inner_text(), page.locator("[data-testid=biz-kpi-owed]").inner_text()
        check("receipts" in sales and "Nile" in sales, tag + "the hub: today's counter sales: %s" % sales.replace("\n", " · "))
        check("22,930.60" in owed and "overdue" in owed, tag + "…customers owe you, with what is overdue: %s" % owed.replace("\n", " · "))
        check("sales" in page.locator("[data-testid=shop-open]").inner_text() and "low stock" in page.locator("[data-testid=books-open]").inner_text(), tag + "…each system with its status pill")
        shot(page, "biz-hub-phone-" + theme, True)
        ev(page, "attune-biz-view", "books"); page.wait_for_selector("[data-testid=books-open-report]", timeout=6000)
        shot(page, "books-calm-phone-" + theme, True)
        page.click("[data-testid=books-open-report]"); page.wait_for_selector("[data-testid=books-overview]", timeout=4000); page.wait_for_timeout(300)
        check(page.locator("[data-testid=ov-chart] rect").count() == 12 and page.locator("[data-testid=ov-chart] polyline").count() == 1, tag + "the Books Report: 6 months of sales vs purchases, with the profit line")
        ages = [page.locator("[data-testid=ov-age-%s]" % k).inner_text() for k in ["notDue", "late1_30", "late31"]]
        check(all(ages) and any("Al-Amal" in a or "Hassan" in a or "Mona" in a for a in ages), tag + "…ageing: not due · 1–30 days late · 31+ late, with who owes most: %s" % " | ".join(a.replace("\n", " ") for a in ages))
        check("Al-Amal" in page.locator("[data-testid=ov-top]").inner_text(), tag + "…top customers and items")
        check("%" in page.locator("[data-testid=ov-profit]").inner_text(), tag + "…net profit with its margin: %s" % page.locator("[data-testid=ov-profit]").inner_text().replace("\n", " · "))
        shot(page, "books-report-phone-" + theme, True)
        page.click("text=Profit & loss"); page.wait_for_timeout(200)
        check(page.locator("[data-testid=report-body]").count() == 1, tag + "the other reports are still one tap away")
        ctx.close()
    # Arabic + 360 px
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + AR)
    page.set_viewport_size({"width": 360, "height": 800})
    page.goto(env.url); seed(page)
    page.click("[data-testid=shop-open-report]"); page.wait_for_selector("[data-testid=shop-report]"); page.wait_for_timeout(300)
    over = page.evaluate("() => [...document.querySelectorAll('[data-testid=shop-report] *')].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1 || e.getBoundingClientRect().left < -1).map(e => (e.dataset.testid || e.tagName)).slice(0, 5)")
    check(not over, "[phone ar 360] the Shop Report fits a 360-px screen, right to left %s" % over)
    shot(page, "shop-report-phone-ar", True)
    to_hub(page)
    over = page.evaluate("() => [...document.querySelectorAll('[data-testid=business-page] *')].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1 || e.getBoundingClientRect().left < -1).map(e => (e.dataset.testid || e.tagName)).slice(0, 5)")
    check(not over, "[phone ar 360] the hub fits %s" % over)
    shot(page, "biz-hub-phone-ar", True)
    ev(page, "attune-biz-view", "books"); page.wait_for_selector("[data-testid=books-open-report]"); page.click("[data-testid=books-open-report]"); page.wait_for_selector("[data-testid=books-overview]"); page.wait_for_timeout(300)
    over = page.evaluate("() => [...document.querySelectorAll('[data-testid=books-overview] *')].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1 || e.getBoundingClientRect().left < -1).map(e => (e.dataset.testid || e.tagName)).slice(0, 5)")
    check(not over, "[phone ar 360] the Books Report fits %s" % over)
    shot(page, "books-report-phone-ar", True)
    ctx.close()
    for theme in ["dark", "light"]:
        ctx, page = new_page(br, env, errors, legacy_nav=False, desktop=(1440, 900), extra_init=INIT + (LIGHT if theme == "light" else ""))
        page.goto(env.url); page.wait_for_selector("[data-testid=side]", timeout=15000); seed(page)
        tag = "[computer %s] " % theme
        page.click("[data-testid=shop-open-report]"); page.wait_for_selector("[data-testid=shop-report]"); page.wait_for_timeout(300)
        a, b = page.locator("[data-testid=sr-today]").bounding_box(), page.locator("[data-testid=sr-staff]").bounding_box()
        check(abs(a["y"] - b["y"]) < 4, tag + "the Shop Report desk: 4 totals in a row")
        shot(page, "shop-report-desktop-" + theme)
        to_hub(page)
        k = [page.locator("[data-testid=biz-kpi-%s]" % x).bounding_box() for x in ["sales", "owed", "attention"]]
        check(all(k) and abs(k[0]["y"] - k[2]["y"]) < 4, tag + "the hub: three numbers side by side, “Needs attention” included")
        c = [page.locator("[data-testid=%s-open]" % x).bounding_box() for x in ["shop", "books", "fleet"]]
        check(abs(c[0]["y"] - c[2]["y"]) < 4, tag + "…the three systems in a row")
        shot(page, "biz-hub-desktop-" + theme)
        ev(page, "attune-biz-view", "books"); page.wait_for_selector("[data-testid=books-open-report]")
        shot(page, "books-calm-desktop-" + theme)
        page.click("[data-testid=books-open-report]"); page.wait_for_selector("[data-testid=books-overview]"); page.wait_for_timeout(300)
        k = page.locator("[data-testid=ov-sales]").bounding_box(), page.locator("[data-testid=ov-vat]").bounding_box()
        check(abs(k[0]["y"] - k[1]["y"]) < 4, tag + "the Books Report desk: 4 totals in a row")
        shot(page, "books-report-desktop-" + theme)
        ctx.close()
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
