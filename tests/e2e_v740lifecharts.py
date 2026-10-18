"""v6.38 (upgrade H3) — Ask your life with charts: "How did my food spending change since Ramadan?" → one sentence (before vs
since, the %) and a month-by-month bar chart with Ramadan marked; a lab question gets a line chart. Arabic too.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v740lifecharts.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
T = datetime.date.today()
txns = []
y, m = 2025, 9
while (y, m) <= (T.year, T.month):
    d = "%d-%02d-10" % (y, m)
    txns.append({"id": "t" + d, "type": "expense", "cat": "food", "amount": 4500 if d >= "2026-02-18" else 3000, "date": d, "account": "a", "note": "food"})
    m += 1
    if m > 12: y, m = y + 1, 1
LEDGER = {"currency": "EGP", "accounts": [{"id": "a", "name": "Cash", "currency": "EGP", "start": 0}], "txns": txns, "recurring": [], "debts": [], "budgets": []}
INIT = "try{localStorage.setItem('ledger.v3', %s)}catch(e){}" % json.dumps(json.dumps(LEDGER))
with sync_playwright() as p:
    br = p.chromium.launch()
    for lang in ("en", "ar"):
        ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + ("localStorage.setItem('attune:ui:lang','ar');" if lang == "ar" else ""))
        page.goto(env.url); page.wait_for_timeout(1200)
        page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'lifeask'}}))")
        page.wait_for_selector("[data-testid=lifeask-q]", timeout=8000)
        page.fill("[data-testid=lifeask-q]", "How did my food spending change since Ramadan?" if lang == "en" else "مصاريف الأكل اتغيرت ازاي من رمضان؟")
        page.click("[data-testid=lifeask-go]")
        page.wait_for_selector("[data-testid=lifeask-chart]", timeout=6000)
        t = page.locator("[data-testid=lifeask-text]").inner_text()
        ok = ("3,000" in t and "4,500" in t and "+50%" in t) and (("before Ramadan" in t) if lang == "en" else ("قبل رمضان" in t))
        check(ok, "%s: before vs since, exact: %s" % (lang, t))
        c = page.locator("[data-testid=lifeask-chart]")
        check(c.get_attribute("data-type") == "bar" and int(c.get_attribute("data-points")) >= 12 and page.locator("[data-testid=lifeask-bar]").count() >= 12, "%s: a bar for every month" % lang)
        check(real_errors(errors) == [], "%s: no page errors: %s" % (lang, real_errors(errors)[:3]))
        ctx.close()
    br.close()
finish()
