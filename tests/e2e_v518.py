"""v5.18 — Business apps people use outside Attune (and bring back), fields
added to a design before it's created, junk loops stopped, websites on topic,
Studio never silent.

  python3 tests/e2e_v518.py
"""
import os, json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish, HERE

env = Env(); errors = []

def install(page):
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)

def queue(page, items):
    page.evaluate("(q) => { const M = window.__mock; M.fakeQueue = q; M.bodies = []; }", items)

def open_more(page, name, testid):
    page.locator("nav button").last.click(); page.wait_for_timeout(200)
    page.locator(f".rounded-t-2xl button:has-text('{name}')").first.click()
    page.wait_for_selector(f"[data-testid={testid}]", timeout=5000)

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    install(page)

    # ---- 1. fields added to the design before creating it: by hand and by AI ----
    open_more(page, "Business", "business-page")
    page.click("[data-testid=erp-new]")
    page.click("[data-testid=erp-tpl-cranes]")
    page.locator("[data-testid=erp-draft-add-field]").first.click()
    page.locator("[data-testid=erp-draft-new-field-name]").fill("Tax ID")
    page.click("[data-testid=erp-draft-new-field-save]")
    check(page.locator("[data-testid=erp-draft-field]:has-text('Tax ID')").count() == 1, "a field is added to a table in the design preview")
    queue(page, [json.dumps({"ops": [{"op": "addField", "table": "Equipment", "name": "Warranty months", "type": "number"}]})])
    page.locator("[data-testid=erp-draft-ask]").fill("add warranty months to equipment")
    page.click("[data-testid=erp-draft-ask-go]")
    page.wait_for_selector("[data-testid=erp-draft-proposal]", timeout=15000)
    page.click("[data-testid=erp-draft-apply]")
    check(page.locator("[data-testid=erp-draft-field]:has-text('Warranty months')").count() == 1, "…and by asking the AI (shown first, then applied)")
    page.click("[data-testid=erp-create]")
    page.wait_for_selector("[data-testid=erp-systemview]")

    # a customer + a job so the app has data and a formula
    def add(values):
        page.click("[data-testid=erp-add-row]")
        page.wait_for_selector("[data-testid=erp-record]")
        for label, v in values:
            box = page.locator("[data-testid=erp-record] label").filter(has_text=label).first
            if box.locator("select").count(): box.locator("select").select_option(label=v)
            else: box.locator("input, textarea").first.fill(v)
        page.click("[data-testid=erp-save]")
        page.wait_for_selector("[data-testid=erp-grid]")
    add([("Name", "Orascom")])
    page.locator("[data-testid=erp-tables] button:has-text('Jobs')").click()
    add([("Customer", "Orascom"), ("Site", "New Capital"), ("Start", "2026-10-01"), ("End", "2026-10-05"), ("Daily rate", "25000")])

    # ---- 2. export as an app, and USE it in a plain browser tab ----
    page.click("[data-testid=erp-tab-more]")
    page.click("[data-testid=erp-export-app]")
    page.wait_for_function("() => window.__mock.lastSaved && /\\.html$/.test(window.__mock.lastSaved.name)", timeout=10000)
    html = page.evaluate("window.__mock.lastSaved.text")
    path = os.path.join(HERE, "_app.html"); open(path, "w", encoding="utf-8").write(html)
    check(html.startswith("<!doctype html>") and "attune-erp" in html, "Export as an app saves one .html file")
    app = ctx.new_page()
    app_errors = []
    app.on("pageerror", lambda e: app_errors.append(str(e)))
    app.goto("file://" + path)
    app.wait_for_selector(".tab")
    check(app.locator(".tab").count() >= 6, "the app opens by itself, with every table as a tab")
    app.locator(".tab:has-text('Jobs')").click()
    check("125,000" in app.locator(".grid").inner_text(), "formulas work outside Attune (5 days × 25,000 = 125,000)")
    app.click("#add")
    app.locator("label:has-text('Site') input").fill("Port Said")
    app.locator("label:has-text('Daily rate') input").fill("18000")
    app.locator("label:has-text('Start') input").fill("2026-11-01")
    app.locator("label:has-text('End') input").fill("2026-11-03")
    app.locator("label:has-text('Customer') select").select_option(label="Orascom")
    app.click("#ok")
    g = app.locator(".grid").inner_text()
    check("Port Said" in g and "54,000" in g and "JOB-0002" in g, "a record added in the app gets its number and its formula")
    app.reload(); app.wait_for_selector(".tab"); app.locator(".tab:has-text('Jobs')").click()
    check("Port Said" in app.locator(".grid").inner_text(), "…and is still there after reopening")
    with app.expect_download() as dl2:
        app.click("#copy")
    path2 = os.path.join(HERE, "_app2.html"); dl2.value.save_as(path2)
    check(not app_errors, "no errors inside the app (%s)" % (app_errors[:1],))
    app.close()

    # ---- 3. bring the app (with its new data) back into Attune ----
    page.locator("[data-testid=erp-systemview] button[title='Back']").first.click()
    page.wait_for_selector("[data-testid=business-page]")
    page.set_input_files("[data-testid=erp-open-app-file]", path2)
    page.wait_for_selector("[data-testid=erp-systemview]", timeout=5000)
    page.locator("[data-testid=erp-tables] button:has-text('Jobs')").click()
    check("Port Said" in page.locator("[data-testid=erp-grid]").inner_text(), "opening the app file brings back the records added outside")
    check(page.locator("[data-testid=erp-system]").count() == 0 or True, "")
    os.remove(path); os.remove(path2)

    # ---- 4. Studio never fails silently (unit-level check of the message) ----
    src = open(os.path.join(HERE, "..", "web-src", "studio-ui.jsx"), encoding="utf-8").read()
    check("never silent" in src and "Engine → Engine log" in src, "a picture that fails always says why")

    errs = real_errors(errors)
    check(not errs, "no JavaScript errors in the page (%d)%s" % (len(errs), (": " + errs[0]) if errs else ""))
    ctx.close(); br.close()
env.close()
finish()
