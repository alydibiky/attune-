"""v5.12 — Business (an ERP you reshape like Access), daily lessons, daily news.

  python3 tests/e2e_v512.py [business] [aidesign] [lessons] [news] [layout]
"""
import os, sys, json, subprocess, tempfile
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish, HERE

SECTIONS = sys.argv[1:] or ["business", "aidesign", "lessons", "news", "layout"]
env = Env()
errors = []
ROOT = os.path.dirname(HERE)
SELLER_KEY = "/home/claude/out/attune-erp-private-key.json"

def install(page):
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)

def open_more(page, name, testid):
    page.locator("nav button").last.click(); page.wait_for_timeout(200)
    page.locator(f".rounded-t-2xl button:has-text('{name}')").first.click()
    page.wait_for_selector(f"[data-testid={testid}]", timeout=5000)

def queue(page, items):
    page.evaluate("(q) => { const M = window.__mock; M.fakeQueue = q; M.bodies = []; }", items)

def grid_text(page): return page.locator("[data-testid=erp-grid]").inner_text()

def sec_business(br):
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    install(page)
    open_more(page, "Business", "business-page")
    page.click("[data-testid=erp-new]")
    page.click("[data-testid=erp-tpl-cranes]")
    page.click("[data-testid=erp-create]")
    page.wait_for_selector("[data-testid=erp-systemview]")
    tabs = page.locator("[data-testid=erp-tables]").inner_text()
    check(all(t in tabs for t in ["Customers", "Equipment", "Jobs", "Invoices", "Maintenance", "Crew"]), "the crane-rental template makes 6 tables")

    def add(values):
        page.click("[data-testid=erp-add-row]")
        page.wait_for_selector("[data-testid=erp-record]")
        for label, v in values:
            box = page.locator("[data-testid=erp-record] label").filter(has_text=label).first
            if box.locator("select").count(): box.locator("select").select_option(label=v)
            else: box.locator("input, textarea").first.fill(v)
        page.click("[data-testid=erp-save]")
        page.wait_for_selector("[data-testid=erp-grid]")
    add([("Name", "Orascom"), ("Phone", "0100 123 4567"), ("City", "Cairo")])
    check("Orascom" in grid_text(page) and "01001234567" in grid_text(page), "a customer is added (phone cleaned up)")
    page.locator("[data-testid=erp-tables] button:has-text('Equipment')").click()
    add([("Model", "LTM 1100"), ("Brand", "Liebherr"), ("Capacity", "100"), ("Status", "Available"), ("Daily rate", "25,000")])
    check("EQ-0001" in grid_text(page), "equipment gets its automatic code EQ-0001")
    page.locator("[data-testid=erp-tables] button:has-text('Jobs')").click()
    add([("Customer", "Orascom"), ("Crane", "EQ-0001 · LTM 1100"), ("Site", "New Capital"), ("Start", "2026-10-01"), ("End", "2026-10-05"), ("Daily rate", "25000"), ("Status", "Confirmed")])
    g = grid_text(page)
    check("JOB-0001" in g and "125,000" in g, "a job computes Days × Daily rate = 125,000 by itself (Access-style formula)")

    # Design: add a column by hand, like Access Design view
    page.click("[data-testid=erp-tab-design]")
    page.click("[data-testid=erp-add-field]")
    page.fill("[data-testid=erp-new-field-name]", "Driver phone")
    page.select_option("[data-testid=erp-new-field-type]", "phone")
    page.click("[data-testid=erp-new-field-save]")
    check(page.locator("[data-testid=erp-field-name]").last.input_value() == "Driver phone", "a new column is added to Jobs in Design")
    # rename a column → data and formula keep working
    nm = page.locator("[data-testid=erp-field-name]").nth(7)
    check(nm.input_value() == "Daily rate", "(the Daily rate column)")
    nm.fill("Rate per day"); page.locator("[data-testid=erp-table-name]").click()
    page.click("[data-testid=erp-tab-data]")
    g = grid_text(page)
    check("Rate per day" in g and "125,000" in g, "renaming a column keeps its data, and the Total formula still works")
    page.click("[data-testid=erp-undo]")
    check("Daily rate" in grid_text(page), "undo puts the old name back")

    # say the change in words → see it → apply
    queue(page, ['{"ops":[{"op":"addField","table":"Invoices","name":"Paid on","type":"date"},{"op":"setOptions","table":"Equipment","field":"Status","add":["Sold"]}]}'])
    page.click("[data-testid=erp-tab-design]")
    page.fill("[data-testid=erp-ask]", "add the date it was paid to Invoices, and let equipment be marked Sold")
    page.click("[data-testid=erp-ask-go]")
    page.wait_for_selector("[data-testid=erp-proposal]", timeout=30000)
    prop = page.locator("[data-testid=erp-proposal]").inner_text()
    check("Added the field Paid on (Date) to Invoices" in prop and "Sold" in prop, "a change said in words is shown first: " + prop.replace("\n", " | ")[:120])
    b = page.evaluate("window.__mock.bodies.filter(x => x.max_tokens > 2).pop()")
    check("Jobs (1 records): Job no [auto]" in b["messages"][0]["content"], "the model is shown the real design to change")
    page.click("[data-testid=erp-apply]")
    page.locator("[data-testid=erp-tables] button:has-text('Invoices')").click()
    check(any(page.locator("[data-testid=erp-field-name]").nth(i).input_value() == "Paid on" for i in range(page.locator("[data-testid=erp-field-name]").count())), "…and applied")

    # fill a record from a sentence
    page.locator("[data-testid=erp-tables] button:has-text('Jobs')").click()
    page.click("[data-testid=erp-tab-data]")
    queue(page, ['{"Customer": "Orascom", "Crane": "LTM 1100", "Site": "Ain Sokhna port", "Start": "2026-10-10", "End": "2026-10-11", "Daily rate": 30000, "Status": "Quoted"}'])
    page.click("[data-testid=erp-add-row]")
    page.fill("[data-testid=erp-ai-fill-text]", "LTM 1100 for Orascom at Ain Sokhna port on 10 and 11 October, 30,000 a day, just quoted")
    page.click("[data-testid=erp-ai-fill]")
    page.wait_for_function("[...document.querySelectorAll('[data-testid=erp-record] input')].some(i => i.value === 'Ain Sokhna port')", timeout=30000)
    page.click("[data-testid=erp-save]")
    page.wait_for_selector("[data-testid=erp-totals]")
    check("185,000" in page.locator("[data-testid=erp-totals]").inner_text(), "a job said in a sentence is filled in; the column total is 185,000")

    page.click("[data-testid=erp-tab-summary]")
    s = page.locator("[data-testid=erp-summary]").inner_text()
    check("Confirmed" in s and "125,000" in s and "Quoted" in s and "60,000" in s, "Summary: totals by status")

    # import a sheet as a new table
    page.click("[data-testid=erp-tab-more]")
    p = os.path.join(tempfile.mkdtemp(), "Suppliers.csv")
    open(p, "w", encoding="utf-8").write("Supplier,Phone,Type,Balance\nMansour,0100 222 3333,Spare parts,\"12,500\"\nEl Sewedy,0122 444 5555,Cables,8000\nGB Auto,0111 666 7777,Spare parts,3000\nTotal,0100 999 8888,Fuel,0\n")
    page.set_input_files("[data-testid=erp-import-file]", p)
    page.wait_for_selector("[data-testid=erp-import]")
    page.click("[data-testid=erp-import-new]")
    page.wait_for_selector("[data-testid=erp-tab-data]")
    page.click("[data-testid=erp-tab-data]")
    check("Suppliers" in page.locator("[data-testid=erp-tables]").inner_text() and "12,500" in grid_text(page), "a CSV from Excel/Access becomes a new table (money column detected)")

    # licence: trial → activation with a code signed by the seller
    page.click("[data-testid=erp-tab-more]")
    req = page.locator("[data-testid=erp-request-code]").inner_text().strip()
    check(req.startswith("ERP-"), "the system shows its request code " + req)
    page.fill("[data-testid=erp-licence-code]", "ATT1.eyJzIjoiRVJQLVgifQ.AAAA")
    page.click("[data-testid=erp-activate]")
    page.wait_for_timeout(300)
    check("Trial" in page.locator("[data-testid=erp-licence]").inner_text(), "a fake code does not activate it")
    if os.path.exists(SELLER_KEY):
        code = subprocess.check_output(["node", os.path.join(ROOT, "tools/erp-licence.mjs"), "issue", SELLER_KEY, req]).decode().strip()
        page.fill("[data-testid=erp-licence-code]", code)
        page.click("[data-testid=erp-activate]")
        page.wait_for_function("document.querySelector('[data-testid=erp-licence]').innerText.includes('Activated')", timeout=5000)
        check(True, "the seller's code activates this system")
    page.screenshot(path=HERE + "/v512-business-more.png", full_page=True)
    # it is all still there after a restart
    page.reload(); page.wait_for_selector("nav", timeout=15000)
    open_more(page, "Business", "business-page")
    page.locator("[data-testid=erp-system]").first.click()
    page.locator("[data-testid=erp-tables] button:has-text('Jobs')").click()
    check("JOB-0002" in grid_text(page), "everything is kept after the app restarts")
    page.screenshot(path=HERE + "/v512-business.png", full_page=True)
    ctx.close()

DESIGN = json.dumps({"name": "Bakery", "currency": "EGP", "tables": [
    {"name": "Products", "fields": [{"name": "Product", "type": "text"}, {"name": "Price", "type": "money"}]},
    {"name": "Orders", "fields": [{"name": "Order no", "type": "auto", "prefix": "ORD-"}, {"name": "Product", "type": "link", "link": "Products"},
        {"name": "Qty", "type": "number"}, {"name": "Unit price", "type": "money"}, {"name": "Total", "type": "formula", "formula": "[Qty] * [Unit price]"},
        {"name": "Status", "type": "choice", "options": ["New", "Paid", "Delivered"]}]}]})

def sec_aidesign(br):
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    install(page)
    open_more(page, "Business", "business-page")
    page.click("[data-testid=erp-new]")
    queue(page, ["Here is the design:\n```json\n" + DESIGN + "\n```"])
    page.fill("[data-testid=erp-desc]", "A small bakery: we sell bread and cakes, take orders by phone and deliver them.")
    page.click("[data-testid=erp-design]")
    page.wait_for_selector("[data-testid=erp-draft]", timeout=30000)
    d = page.locator("[data-testid=erp-draft]").inner_text()
    check("Orders" in d and "Link to another table → Products" in d and "Formula" in d, "the AI designs the tables from a description, shown before creating")
    page.click("[data-testid=erp-create]")
    page.wait_for_selector("[data-testid=erp-systemview]")
    check("Products" in page.locator("[data-testid=erp-tables]").inner_text(), "…and it is created")
    ctx.close()

FN = {"business": sec_business, "aidesign": sec_aidesign}
try:
    import e2e_v512_more as more
    FN.update(more.sections(env, errors, install, open_more, queue))
except ImportError:
    pass

with sync_playwright() as pw:
    br = pw.chromium.launch()
    for s in SECTIONS:
        if s not in FN: continue
        print(f"--- {s}", flush=True)
        try: FN[s](br)
        except Exception as e: check(False, f"{s} section crashed: {str(e)[:300]}")
    br.close()
env.close()
re_ = real_errors(errors)
for e in re_[:20]: print("   ", e)
check(len(re_) == 0, "no JavaScript errors in the page (%d)" % len(re_))
finish()
