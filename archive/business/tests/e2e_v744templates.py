"""v6.44 Business builder in depth: the ten new templates are offered, and a clinic built from one has the Overview's
Insights (the last 6 months, the top patients, statuses, the medicines' stock value) after sample records are added.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v744templates.py
"""
import os, json, subprocess
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
HERE = os.path.dirname(os.path.abspath(__file__))
SYS = json.loads(subprocess.check_output(["node", "--input-type=module", "-e", """
import * as E from '%s/../web-src/erp.js';
console.log(JSON.stringify(E.systemFromSpec({ ...E.TEMPLATES.find((t) => t.id === 'clinic').spec, name: 'Nile Clinic', currency: 'EGP' })));
""" % HERE], stderr=subprocess.DEVNULL))
SEED = "try{if(!localStorage.getItem('attune:erp:v1')){localStorage.setItem('attune:erp:v1:%s',%s);localStorage.setItem('attune:erp:v1',%s)}}catch(e){}" % (
    SYS["id"], json.dumps(json.dumps(SYS)), json.dumps(json.dumps([{"id": SYS["id"], "name": SYS["name"], "updated": SYS["updated"], "tables": len(SYS["tables"]), "active": True}])))
env = Env(); errors = []
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init="try{localStorage.setItem('attune:start','home')}catch(e){};" + SEED)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.locator("nav button").last.click(); page.wait_for_timeout(300)
    page.locator(".rounded-t-2xl button:has-text('Business')").first.click(); page.wait_for_selector("[data-testid=business-page]", timeout=8000)
    page.locator("[data-testid=erp-system]").first.click(); page.wait_for_selector("[data-testid=biz-system]")
    page.click("[data-testid=biz-tab-pro]"); page.wait_for_selector("[data-testid=biz-pro]")
    page.click("[data-testid=biz-pro-demo]"); page.wait_for_selector("[data-testid=biz-insights]", timeout=6000)
    check(page.locator("[data-testid=biz-insights-trend]").count() == 1 and "The last 6 months" in page.inner_text("[data-testid=biz-insights-trend]"), "Insights: the visits charged over the last 6 months")
    check(page.locator("[data-testid=biz-insights-top]").count() == 1, "the top patients of the year")
    check("Visits" in page.inner_text("[data-testid=biz-insights-status]"), "visits by status (booked, done, no-show…)")
    check(page.locator("[data-testid=biz-insights-stock]").count() == 1 and "Medicines" in page.inner_text("[data-testid=biz-insights-stock]"), "the medicines' stock value at cost")
    check(page.locator("[data-testid=biz-pro-balances]").count() >= 1 and page.locator("[data-testid=biz-pro-stock]").count() >= 1, "and the Pro parts the clinic needs: patients' balances, medicines stock")
    # the templates on the builder's first step
    page.click("[data-testid=biz-back]") if page.locator("[data-testid=biz-back]").count() else None
    page.wait_for_timeout(300)
    if page.locator("[data-testid=erp-new]").count() == 0:
        page.locator("nav button").last.click(); page.wait_for_timeout(300); page.locator(".rounded-t-2xl button:has-text('Business')").first.click(); page.wait_for_selector("[data-testid=business-page]", timeout=8000)
    page.click("[data-testid=erp-new]"); page.wait_for_selector("[data-testid=biz-interview]", timeout=5000)
    ids = page.evaluate("[...document.querySelectorAll('[data-testid^=erp-tpl-]')].map(b => b.dataset.testid.slice(8))")
    check(all(x in ids for x in ["clinic", "academy", "property", "workshop", "gym", "salon", "pharmacy", "transport", "contractor", "wholesale"]), "the builder offers the ten new templates: %s" % ids)
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
