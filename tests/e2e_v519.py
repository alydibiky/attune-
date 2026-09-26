"""v5.19 — web answers read whole pages (the spec table far down), ERP tables
connected for you, one broken screen no longer blanks the app, Studio stops
only from its own Stop button.

  python3 tests/e2e_v519.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish, HERE

env = Env(); errors = []

FILLER = "\\n".join("Our newsroom story number %d about the brand's heritage and design philosophy." % i for i in range(60))
PAGE = FILLER + "\\n## Trims and prices\\nTrim | Power | Torque | Price\\nLynk & Co 900 Pro | 598 hp | 1,000 Nm | CNY 309,900\\nLynk & Co 900 Ultra | 845 hp | 1,200 Nm | CNY 369,900"
SEARCH = """(() => { const N = window.AttuneNative, S = window.__mock;
  N.search = (id, arg) => { const a = JSON.parse(arg); S.lastSearch = a;
    setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ via: "duckduckgo", why: "", hits: [
      { title: "Lynk & Co 900 - specs", url: "https://example.com/900", text: "%s" },
      { title: "Unrelated", url: "https://example.com/x", text: "The weather in Cairo is sunny today and the Nile is calm." } ] })), 30); };
})();""" % PAGE

def install(page):
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)

def send(page, text):
    page.locator("textarea[placeholder='Message Attune']").fill(text)
    page.locator("button[title='Send']").first.click()

def open_more(page, name, testid):
    page.locator("nav button").last.click(); page.wait_for_timeout(200)
    page.locator(f".rounded-t-2xl button:has-text('{name}')").first.click()
    page.wait_for_selector(f"[data-testid={testid}]", timeout=5000)

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    install(page)

    # ---- 1. web: the spec table deep in the page reaches the model ----
    page.evaluate(SEARCH)
    page.locator("button:has-text('Web')").first.click()
    page.evaluate("() => { const M = window.__mock; M.fakeQueue = ['**Two trims** [1]: Pro 598 hp, Ultra 845 hp.']; M.bodies = []; }")
    send(page, "Lynk & Co 900 all trims with hp, torque and price")
    page.wait_for_selector("button[title='Regenerate']", timeout=30000)
    check(page.evaluate("window.__mock.lastSearch.pages") >= 5, "more pages are read (%s)" % page.evaluate("window.__mock.lastSearch.pages"))
    prompt = page.evaluate("window.__mock.bodies.filter(x => x.max_tokens > 2).pop().messages.slice(-1)[0].content")
    prompt = json.dumps(prompt) if not isinstance(prompt, str) else prompt
    check("845 hp" in prompt and "CNY 369,900" in prompt, "the spec table 5,000+ characters down the page reaches the model")
    check("newsroom story number 40" not in prompt, "…and the filler around it doesn't")
    check("EVERY one the passages name" in prompt, "the model is told to list every trim the sources name")
    page.locator("button:has-text('Web')").first.click()

    # ---- 2. ERP: tables connected for you ----
    open_more(page, "Business", "business-page")
    page.click("[data-testid=erp-new]")
    page.evaluate("() => { const M = window.__mock; M.fakeQueue = [JSON.stringify({ name: 'Workshop', tables: [ { name: 'Suppliers', fields: [ { name: 'SupplierID', type: 'auto' }, { name: 'SupplierName', type: 'text' }, { name: 'Phone', type: 'phone' } ] }, { name: 'Parts', fields: [ { name: 'PartID', type: 'auto' }, { name: 'PartName', type: 'text' }, { name: 'SupplierID', type: 'number' }, { name: 'Unit price', type: 'money' } ] }, { name: 'Customers', fields: [ { name: 'Name', type: 'text' }, { name: 'Phone', type: 'phone' } ] }, { name: 'Repairs', fields: [ { name: 'RepairNo', type: 'auto' }, { name: 'Customer name', type: 'text' }, { name: 'Part', type: 'text' }, { name: 'Cost', type: 'money' } ] } ] })]; }")
    page.locator("[data-testid=erp-desc]").fill("A car workshop: suppliers, spare parts, customers and repairs")
    page.click("[data-testid=erp-design]")
    page.wait_for_selector("[data-testid=erp-draft]", timeout=20000)
    draft = page.locator("[data-testid=erp-draft]").inner_text()
    check(draft.count("Link to another table") >= 3, "a new design is connected automatically (SupplierID, Customer name, Part → links)")
    page.click("[data-testid=erp-create]")
    page.wait_for_selector("[data-testid=erp-systemview]")
    page.click("[data-testid=erp-tab-design]")
    check(page.locator("[data-testid=erp-relationships]").inner_text().count("→") >= 3, "Design lists the connections")

    # ---- 3. a broken screen stays in its screen ----
    page.evaluate("localStorage.setItem('attune:artifacts:v1', JSON.stringify([{ id: 'x', title: 'Broken', kind: 'html' }]))")
    open_more(page, "Artifacts", "screen-error")
    check(page.locator("[data-testid=screen-error]").count() == 1, "a screen that crashes shows 'Something went wrong on this screen'")
    check(page.locator("nav button").count() == 6, "…and the rest of the app still works (the bottom bar is there)")
    page.locator("nav button:has-text('Chat')").click()
    page.wait_for_selector("textarea[placeholder='Message Attune']")
    check(True, "…Chat opens normally afterwards")
    page.evaluate("localStorage.removeItem('attune:artifacts:v1')")

    # ---- 4. Studio stops pictures only with its own Stop ----
    src = open(HERE + "/../web-src/studio-ui.jsx", encoding="utf-8").read()
    check("native.cancelImage(callId.current)" in src, "Studio's Stop uses cancelImage (a stray cancel can't end a picture)")

    errs = [e for e in real_errors(errors) if "reading 'length'" not in e and "Broken" not in e and "versions" not in e and "The above error" not in e and "React will try" not in e and "getDerivedStateFromError" not in e]
    check(not errs, "no other JavaScript errors (%d)%s" % (len(errs), (": " + errs[0]) if errs else ""))
    ctx.close(); br.close()
env.close()
finish()
