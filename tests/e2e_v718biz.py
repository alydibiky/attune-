"""v6.18 — Business as its own app (Ali: "rework the whole business UI … an app in the app with introductions …
step by step"; "a mix of the 3 in a brilliant way"; "a form like Microsoft Access for data entry"; "an AI chat inside
business where I can ask the AI to change the design").

  python3 tests/e2e_v718biz.py          SHOTS=<dir> keeps screenshots
"""
import os, json
from playwright.sync_api import sync_playwright
from harness import new_page, check, real_errors, finish, Env

env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
def shot(page, name):
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, name + ".png"))
def queue(page, items):
    page.evaluate("(q) => { const M = window.__mock; M.fakeQueue = q; M.bodies = []; }", items)

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(250)
    page.locator("nav button").last.click(); page.wait_for_timeout(200)
    page.locator(".rounded-t-2xl button:has-text('Business')").first.click()
    page.wait_for_selector("[data-testid=business-page]", timeout=5000)

    # ---- an app of its own, with an introduction ----
    bars = page.evaluate("() => [...document.querySelectorAll('header.sticky, nav')].filter((e) => e.getClientRects().length && getComputedStyle(e).display !== 'none').length")
    check(bars == 0, "Business is its own app: Attune's header and bottom bar are hidden (%d visible)" % bars)
    check(page.locator("[data-testid=biz-intro]").count() == 1 and "Build your own business system" in page.locator("[data-testid=biz-intro]").inner_text(), "the first visit opens with an introduction (3 steps)")
    bg = page.evaluate("getComputedStyle(document.body).backgroundColor")
    check(bg == "rgb(244, 246, 250)", "a professional light look for the whole of Business (%s)" % bg)
    shot(page, "biz-intro")

    # ---- the builder: ① Name ----
    page.click("[data-testid=erp-new]")
    page.wait_for_selector("[data-testid=biz-interview]", timeout=5000)
    check("Step 1 of 5" in page.locator("[data-testid=erp-newpage]").inner_text() and page.locator("[data-testid=biz-step-data]").is_disabled(), "step 1 of 5 (Name); the later steps open once there is a design")
    shot(page, "biz-step1")
    page.click("[data-testid=erp-tpl-cranes]")
    # ---- ② Data ----
    page.wait_for_selector("[data-testid=erp-draft]", timeout=5000)
    check("Step 2 of 5" in page.locator("[data-testid=erp-newpage]").inner_text(), "a template → step 2 (Data): the tables")
    sug = page.locator("[data-testid=biz-suggestion]")
    check(sug.count() >= 1 and "Payments" in page.locator("[data-testid=biz-suggestions]").inner_text(), "the interview offers answers from the design itself: %s" % page.locator("[data-testid=biz-suggestions]").inner_text().replace("\n", " | ")[:120])
    sug.filter(has_text="Payments").first.click(); page.wait_for_timeout(200)
    check(page.locator("[data-testid=erp-draft-table]", has_text="Payments").count() == 1, "one tap adds the Payments table (linked to Invoices)")
    page.click("[data-testid=biz-undo]"); page.wait_for_timeout(150)
    check(page.locator("[data-testid=erp-draft-table]", has_text="Payments").count() == 0, "…and Undo takes it back")
    shot(page, "biz-step2")
    # ---- ③ Logic ----
    page.click("[data-testid=biz-next]"); page.wait_for_timeout(200)
    page.locator("[data-testid=biz-suggestion]", has_text="VAT").first.click(); page.wait_for_timeout(200)
    check("VAT" in page.locator("[data-testid=biz-logic-formulas]").inner_text(), "step 3 (Logic): the VAT answer adds the calculations")
    page.fill("[data-testid=biz-calc-name]", "Zcheck"); page.fill("[data-testid=biz-calc-formula]", "[Nope] * 2"); page.click("[data-testid=biz-calc-add]"); page.wait_for_timeout(200)
    check("Zcheck" not in page.locator("[data-testid=biz-logic-formulas]").inner_text(), "a calculation with an unknown field is refused, not saved")
    shot(page, "biz-step3")
    # ---- ④ Screens ----
    page.click("[data-testid=biz-next]"); page.wait_for_timeout(200)
    page.click("[data-testid=biz-color-green]"); page.wait_for_timeout(150)
    head = page.evaluate("() => getComputedStyle(document.querySelector('[data-testid=biz-preview-phone] > div')).backgroundColor")
    check(head == "rgb(21, 128, 61)", "step 4 (Screens): green — the phone preview turns green (%s)" % head)
    page.click("[data-testid=biz-home-chart]"); page.click("[data-testid=biz-menu-top]"); page.wait_for_timeout(150)
    check(page.locator("[data-testid=biz-preview-desktop]").evaluate("(e) => getComputedStyle(e).flexDirection") == "column", "…the computer preview follows the menu choice (top)")
    shot(page, "biz-step4")
    # ---- ⑤ Launch ----
    page.click("[data-testid=biz-next]"); page.wait_for_timeout(200)
    check("tables" in page.locator("[data-testid=biz-launch]").inner_text(), "step 5 (Launch): a summary of the system")
    shot(page, "biz-step5")
    page.click("[data-testid=erp-create]")
    page.wait_for_selector("[data-testid=biz-system]", timeout=5000)
    check(page.locator("[data-testid=biz-home]").count() == 1 and page.locator("[data-testid=biz-kpis]").count() == 1 and page.locator("[data-testid=biz-chart]").count() == 1, "the system opens on its Home: key numbers and the chart chosen in step 4")
    hdr = page.evaluate("() => getComputedStyle(document.querySelector('[data-testid=biz-system] > div')).backgroundColor")
    check(hdr == "rgb(21, 128, 61)", "…in its own colour (green: %s)" % hdr)
    shot(page, "biz-home")

    # ---- the Access-style form ----
    page.click("[data-testid=biz-tab-form]"); page.wait_for_selector("[data-testid=biz-form]")
    check("New record" in page.locator("[data-testid=biz-form-pos]").inner_text(), "the Form tab: a new record of the first table")
    page.click("[data-testid=biz-form-save]"); page.wait_for_timeout(200)
    check("required" in page.locator("[data-testid=biz-form-fields]").inner_text().lower(), "a required field left empty is flagged, nothing saved")
    for i, nm in enumerate(["Orascom", "Hassan Allam"]):
        if i: page.click("[data-testid=biz-form-new]"); page.wait_for_timeout(150)
        page.locator("[data-testid=biz-form-fields] input").first.fill(nm)
        page.click("[data-testid=biz-form-save]"); page.wait_for_timeout(250)
    check("Record 2 of 2" in page.locator("[data-testid=biz-form-pos]").inner_text(), "two customers saved — the record bar says Record 2 of 2")
    page.click("[data-testid=biz-form-prev]"); page.wait_for_timeout(200)
    check("Record 1 of 2" in page.locator("[data-testid=biz-form-pos]").inner_text() and page.locator("[data-testid=biz-form-fields] input").first.input_value() == "Orascom", "◀ goes back to record 1 (Orascom)")
    shot(page, "biz-form")

    # ---- the tables' own tools are all still there ----
    page.click("[data-testid=biz-tab-tables]"); page.wait_for_selector("[data-testid=erp-systemview]", timeout=5000)
    check(page.locator("[data-testid=erp-tab-design]").count() == 1 and page.locator("[data-testid=erp-tab-more]").count() == 1, "the Tables tab keeps the grid, Design, Queries, Forms, Summary and More")

    # ---- the AI design chat ----
    queue(page, [json.dumps({"ops": [{"op": "setColor", "color": "orange"}, {"op": "setFormOrder", "table": "Customers", "fields": ["Phone", "Name"]}]})])
    page.click("[data-testid=biz-ai-open]"); page.wait_for_selector("[data-testid=biz-chat]")
    page.fill("[data-testid=biz-chat-input]", "make it orange instead of green, and put the phone first on the customer form")
    page.click("[data-testid=biz-chat-send]")
    page.wait_for_selector("[data-testid=biz-chat-proposal]", timeout=15000)
    prop = page.locator("[data-testid=biz-chat-proposal]").inner_text()
    check("orange" in prop and "Phone, Name" in prop, "the AI's change is shown first: " + prop.replace("\n", " | ")[:140])
    body = page.evaluate("window.__mock.bodies.map((b) => JSON.stringify(b.messages || b)).join(' ')")
    check("The screens now" in body and "setColor" in body, "the AI is told the screens and how to change them")
    page.click("[data-testid=biz-chat-apply]"); page.wait_for_timeout(250)
    hdr = page.evaluate("() => getComputedStyle(document.querySelector('[data-testid=biz-system] > div')).backgroundColor")
    check(hdr == "rgb(194, 65, 12)", "applied: the system is orange now (%s)" % hdr)
    shot(page, "biz-chat")
    page.click("[data-testid=biz-chat-undo]"); page.wait_for_timeout(250)
    hdr = page.evaluate("() => getComputedStyle(document.querySelector('[data-testid=biz-system] > div')).backgroundColor")
    check(hdr == "rgb(21, 128, 61)", "Undo in the chat brings the green back (%s)" % hdr)
    page.locator("[data-testid=biz-chat] button[aria-label=Close]").click(); page.wait_for_timeout(150)

    # ---- the Design button reopens the steps on the live system ----
    page.click("[data-testid=biz-open-studio]"); page.wait_for_selector("[data-testid=biz-screens]", timeout=5000)
    page.click("[data-testid=biz-color-navy]"); page.wait_for_timeout(150); page.click("[data-testid=biz-done]")
    page.wait_for_selector("[data-testid=biz-system]")
    hdr = page.evaluate("() => getComputedStyle(document.querySelector('[data-testid=biz-system] > div')).backgroundColor")
    check(hdr == "rgb(30, 58, 138)", "Design → Screens on the live system: navy, saved (%s)" % hdr)

    # ---- back to Attune ----
    page.click("[data-testid=biz-back]"); page.wait_for_selector("[data-testid=business-page]")
    check(page.locator("[data-testid=biz-intro]").count() == 0 and page.locator("[data-testid=erp-system]").count() == 1, "the home lists the new system; the introduction is not shown again")
    page.click("[data-testid=biz-back]"); page.wait_for_timeout(300)
    check(page.locator("nav").first.is_visible(), "← leaves Business; Attune's bars return")

    # ---- Arabic ----
    page.evaluate("localStorage.setItem('attune:ui:lang', 'ar')"); page.reload(); page.wait_for_selector("nav", timeout=15000)
    page.locator("nav button").last.click(); page.wait_for_timeout(200)
    page.locator(".rounded-t-2xl button:has-text('الأعمال')").first.click()
    page.wait_for_selector("[data-testid=business-page]", timeout=5000)
    page.locator("[data-testid=erp-system]").first.click(); page.wait_for_selector("[data-testid=biz-system]")
    t = page.locator("[data-testid=biz-nav]").inner_text()
    check("الرئيسية" in t and "النموذج" in t, "Arabic: " + t.replace("\n", " · "))
    shot(page, "biz-ar")
    check(real_errors(errors) == [], "no errors: %s" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
