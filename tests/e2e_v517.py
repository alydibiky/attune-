"""v5.17 — Ali's phone test of v5.16: website links reloading Attune, a
wrong total after "And with 5 cranes", Memory items opening off-screen,
Business (rename by tap, connections, queries and forms from a sentence),
Copilot (bring a chat), Memory in the bottom bar, the version shown.

  python3 tests/e2e_v517.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish, HERE

env = Env(); errors = []

def install(page):
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)

def send(page, text):
    page.locator("textarea[placeholder='Message Attune']").fill(text)
    page.locator("button[title='Send']").first.click()

def done(page, n=1):
    page.wait_for_function("(n) => document.querySelectorAll(\"button[title='Regenerate']\").length >= n", arg=n, timeout=30000)

def queue(page, items):
    page.evaluate("(q) => { const M = window.__mock; M.fakeQueue = q; M.bodies = []; }", items)

def bodies(page):
    return page.evaluate("window.__mock.bodies.filter(x => x.max_tokens > 2)")

def open_more(page, name, testid):
    page.locator("nav button").last.click(); page.wait_for_timeout(200)
    page.locator(f".rounded-t-2xl button:has-text('{name}')").first.click()
    page.wait_for_selector(f"[data-testid={testid}]", timeout=5000)

SITE = """```html
<!doctype html><html><head><title>Oriental Delights</title></head><body style="margin:0">
<nav><a href="#menu" id="go">Menu</a> <a href="about.html" id="away">About</a></nav>
<div style="height:1500px">Welcome to Our Table</div>
<section id="menu"><h2>Our Menu</h2></section>
<form id="f"><input name="n"><button id="send">Send</button></form>
</body></html>
```"""

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    install(page)

    # ---- 1. links and forms inside a generated website stay inside it ----
    queue(page, [SITE])
    send(page, "Tell me about an oriental restaurant page")
    done(page)
    page.locator("[data-testid=artifact-card]").click()
    page.wait_for_selector("[data-testid=artifact-viewer]")
    fr = page.frame_locator("[data-testid=artifact-frame]")
    fr.locator("#go").click(); page.wait_for_timeout(600)
    check(fr.locator("text=Welcome to Our Table").count() == 1 and fr.locator("nav").count() == 1 and fr.locator("text=Message Attune").count() == 0,
          "tapping a #menu link keeps the page (Attune does not open inside it)")
    y = page.frame_locator("[data-testid=artifact-frame]").locator("body").evaluate("e => e.ownerDocument.defaultView.scrollY")
    check(y > 300, "…and scrolls down to that section (%d px)" % y)
    fr.locator("#away").click(); page.wait_for_timeout(400)
    check(fr.locator("text=Welcome to Our Table").count() == 1, "a link to another file doesn't load Attune either")
    fr.locator("#send").click(); page.wait_for_timeout(400)
    check(fr.locator("text=Welcome to Our Table").count() == 1, "a form's Send button doesn't either")
    page.locator("[data-testid=artifact-close]").click()

    # ---- 2. "And with 5 cranes" after an instant sum: worked out with the first question ----
    page.click("header button[aria-label='New chat']"); page.wait_for_timeout(200)
    send(page, "3 cranes × 4 days × 25,000 EGP + 14% VAT")
    page.wait_for_selector("text=342,000", timeout=15000)
    queue(page, ["```python\nprint('ANSWER: 570000')\n```", "**570,000 EGP**\n\n1. 5 × 4 × 25,000 = 500,000\n2. 14% of 500,000 = 70,000\n3. 500,000 + 70,000 = 570,000"])
    send(page, "And with 5 cranes")
    done(page, 2)
    firsts = [str(b["messages"][-1]["content"]) for b in bodies(page)]
    check(any("25,000" in f and "And with 5 cranes" in f for f in firsts), "the follow-up is worked out WITH the first question (by running code)")
    check(page.locator("text=453,000").count() == 0 and page.locator(".att-md").last.inner_text().count("570,000") >= 1, "the total is 570,000")

    # ---- 3. Memory: in the bottom bar, and an item opens ON the screen ----
    nav = page.locator("nav").inner_text()
    check("Memory" in nav, "Memory is in the bottom bar")
    page.locator("nav button:has-text('Memory')").click()
    page.wait_for_timeout(400)
    item = page.locator("button:has-text('And with 5 cranes')").first
    item.scroll_into_view_if_needed(); item.click(); page.wait_for_timeout(400)
    card = page.locator("div.fixed.inset-0.z-50 > div").first
    bb = card.bounding_box(); vh = page.viewport_size["height"]
    check(bb is not None and bb["y"] >= 0 and bb["y"] < vh * 0.8, "a Memory item opens where you can see it (top at %s of %d)" % (bb and int(bb["y"]), vh))
    page.mouse.click(5, 5); page.wait_for_timeout(200)

    # ---- 4. Business: rename by tapping, connections, related records, queries, forms ----
    open_more(page, "Business", "business-page")
    page.click("[data-testid=erp-new]")
    page.click("[data-testid=erp-tpl-cranes]")
    page.locator("[data-testid=erp-draft-table]").first.click()
    page.locator("[data-testid=erp-rename-input]").fill("Clients")
    page.click("[data-testid=erp-rename-save]")
    check(page.locator("[data-testid=erp-draft-table]:has-text('Clients')").count() == 1, "in the new design, tapping a table name renames it")
    page.click("[data-testid=erp-create]")
    page.wait_for_selector("[data-testid=erp-systemview]")
    page.click("[data-testid=erp-system-name]")
    page.locator("[data-testid=erp-rename-input]").fill("Adrighem ERP")
    page.click("[data-testid=erp-rename-save]")
    check("Adrighem ERP" in page.locator("[data-testid=erp-system-name]").inner_text(), "tapping the system name renames it")
    page.locator("[data-testid=erp-table-chip]").first.click()      # already selected → the table's sheet
    page.wait_for_selector("[data-testid=erp-rename]")
    page.locator("[data-testid=erp-rename-input]").fill("Customers")
    page.click("[data-testid=erp-rename-save]")
    check("Customers" in page.locator("[data-testid=erp-tables]").inner_text(), "tapping the selected table again renames it")
    page.locator("[data-testid=erp-col]").first.dispatch_event("contextmenu")
    page.wait_for_selector("[data-testid=erp-rename]")
    page.locator("[data-testid=erp-rename-input]").fill("Client name")
    page.click("[data-testid=erp-rename-save]")
    check("Client name" in page.locator("[data-testid=erp-grid]").inner_text(), "holding a column name renames the field")
    page.click("[data-testid=erp-tab-design]")
    rel = page.locator("[data-testid=erp-relationships]").inner_text()
    check("→" in rel and "Customers" in rel, "Design shows the connections between tables, like Access (%s)" % rel.replace("\n", " | ")[:90])

    # data for related records + queries
    page.click("[data-testid=erp-tab-data]")
    def add(values):
        page.click("[data-testid=erp-add-row]")
        page.wait_for_selector("[data-testid=erp-record]")
        for label, v in values:
            box = page.locator("[data-testid=erp-record] label").filter(has_text=label).first
            if box.locator("select").count(): box.locator("select").select_option(label=v)
            else: box.locator("input, textarea").first.fill(v)
        page.click("[data-testid=erp-save]")
        page.wait_for_selector("[data-testid=erp-grid]")
    add([("Client name", "Orascom")])
    page.locator("[data-testid=erp-tables] button:has-text('Jobs')").click()
    add([("Customer", "Orascom"), ("Site", "New Capital"), ("Daily rate", "25000")])
    add([("Customer", "Orascom"), ("Site", "Port Said"), ("Daily rate", "18000")])
    page.locator("[data-testid=erp-tables] button:has-text('Customers')").click()
    page.locator("[data-testid=erp-row]").first.click()
    page.wait_for_selector("[data-testid=erp-related]")
    check("(2)" in page.locator("[data-testid=erp-related]").first.inner_text(), "a customer shows its 2 linked jobs")
    page.locator("[data-testid=erp-record] button").first.click()

    page.click("[data-testid=erp-tab-queries]")
    queue(page, [json.dumps({"title": "Port Said jobs", "table": "Jobs", "where": [{"field": "Site", "op": "contains", "value": "port"}]})])
    page.locator("[data-testid=erp-query-ask]").fill("jobs in port said")
    page.click("[data-testid=erp-query-go]")
    page.wait_for_selector("[data-testid=erp-query-result]", timeout=15000)
    res = page.locator("[data-testid=erp-query-result]").inner_text()
    check("Port Said" in res and "New Capital" not in res, "a query in words finds the right records")
    page.click("[data-testid=erp-query-save]")
    check(page.locator("[data-testid=erp-saved-query]").count() == 1, "…and can be saved")

    page.click("[data-testid=erp-tab-forms]")
    queue(page, [json.dumps({"title": "Site job", "table": "Jobs", "fields": ["Customer", "Site", "Daily rate"], "defaults": {"Status": "Confirmed"}})])
    page.locator("[data-testid=erp-form-ask]").fill("a quick job form: customer, site, rate — status confirmed")
    page.click("[data-testid=erp-form-go]")
    page.wait_for_selector("[data-testid=erp-form-draft]", timeout=15000)
    page.click("[data-testid=erp-form-save]")
    page.locator("[data-testid=erp-saved-form]").first.locator("button").first.click()
    page.wait_for_selector("[data-testid=erp-form-pick]")
    page.locator("[data-testid=erp-form-pick] button:has-text('Site job')").click()
    page.click("[data-testid=erp-add-row]")
    page.wait_for_selector("[data-testid=erp-form-title]")
    labels = page.locator("[data-testid=erp-record] label").count()
    check(labels == 3, "a form made in words shows only its 3 fields (%d)" % labels)

    # ---- 5. Copilot: bring a chat from ChatGPT in one paste ----
    open_more(page, "Copilot", "cp-import")
    queue(page, ["Ask it to compare the LTM 1100 and GMK5150 for a 60 t lift at 14 m, as a table."] * 3)
    page.locator("[data-testid=cp-import-text]").fill("ChatGPT: The LTM 1100 is a 100 t crane with a 60 m boom.")
    page.click("[data-testid=cp-import-go]")
    try: page.wait_for_function("() => document.body.innerText.includes('Pasted from')", timeout=20000)
    except Exception: page.screenshot(path=HERE + "/v517-copilot.png", full_page=True)
    check(page.locator("text=Pasted from").count() >= 1, "a pasted chat is read into the conversation")
    check(len(bodies(page)) >= 1, "…and Attune suggests the next message straight away")

    # ---- 6. the version is shown ----
    page.locator("nav button").last.click(); page.wait_for_timeout(200)
    import re as _re
    check(bool(_re.search(r"Attune 5\.\d+", page.locator("[data-testid=app-version]").inner_text())), "More shows the version (so an old page can be spotted)")

    errs = real_errors(errors)
    check(not errs, "no JavaScript errors in the page (%d)%s" % (len(errs), (": " + errs[0]) if errs else ""))
    ctx.close(); br.close()
env.close()
finish()
