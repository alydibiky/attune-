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
  N.search = (id, arg) => { const a = JSON.parse(arg); S.lastSearch = a; (S.searchLog = S.searchLog || []).push(a);
    setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ via: "duckduckgo", why: "", hits: [
      { title: "Lynk & Co 900 - specs", url: "https://example.com/900", text: "%s" },
      { title: "Unrelated", url: "https://example.com/x", text: "The weather in Cairo is sunny today and the Nile is calm. Tomorrow will be warmer, with light winds from the north in the afternoon." } ] })), 30); };
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
    # v5.30 FAST research (the default): searches at the same time, code picks the passages,
    # ONE model pass — like Gemini
    page.evaluate("() => { const M = window.__mock; M.fakeQueue = ['**Two trims** [1]: Pro 598 hp, Ultra 845 hp.']; M.bodies = []; M.searchLog = []; }")
    send(page, "Lynk & Co 900 all trims with hp, torque and price")
    page.wait_for_selector("button[title='Regenerate']", timeout=30000)
    sl = page.evaluate("window.__mock.searchLog.map(a => a.q || a.query || '')")
    check(len(sl) >= 3 and any(q.endswith("price " + str(__import__("datetime").date.today().year)) for q in sl), "several searches from the question, one per angle, no model needed (%s)" % sl)
    bs = page.evaluate("window.__mock.bodies.filter(x => x.max_tokens > 2).map(x => String(x.messages[0].content).slice(0, 60))")
    check(len(bs) == 1, "ONE model pass reads everything and writes the answer (%d model calls)" % len(bs))
    check(not any(b.startswith("You read ONE web page") or b.startswith("You plan web research") for b in bs), "…no page-by-page notes, no planning call (that's what made it take minutes)")
    prompt = page.evaluate("window.__mock.bodies.filter(x => x.max_tokens > 2).pop().messages.slice(-1)[0].content")
    prompt = json.dumps(prompt) if not isinstance(prompt, str) else prompt
    check("845 hp" in prompt and "CNY 369,900" in prompt, "the spec table 5,000+ characters down the page reaches the model")
    check("newsroom story number 40" not in prompt, "…and the filler around it doesn't")
    check("EVERY one the passages name" in prompt and "table of the exact figures" in prompt, "the model is told to cover every trim, and that the exact figures come in a table under its answer (v5.34)")
    md = page.locator(".att-md").last.inner_text()
    check("845 hp" in md and "CNY 369,900" in md and ("Key figures" in md or "Table from" in md), "the facts sheet under the answer carries the exact figures and the trims table, copied by code")
    foot = page.locator(".att-md").last.locator("xpath=../..").inner_text()
    check("read 2 pages" in foot and "searches" in foot, "the answer says how many pages and searches it used")
    # v5.31 — like Gemini: [1] is a tappable chip, sources show their site, and a research panel
    cite = page.locator("[data-testid=cite]").first
    check(page.locator("[data-testid=cite]").count() >= 1 and cite.get_attribute("href") == "https://example.com/900", "the [1] in the answer is a chip that opens source 1")
    check("example.com" in page.locator("[data-testid=source]").first.inner_text(), "each source shows its site")
    page.locator("[data-testid=research-log] button").last.click(); page.wait_for_timeout(200)
    rl = page.locator("[data-testid=research-log]").last.inner_text()
    check("Searched" in rl and "Lynk & Co 900 specifications" in rl and "Read 2 pages" in rl, "'How I researched' shows the searches and the pages read")

    # v5.20 DEEP research, when asked for: every page into checked notes, then the report
    NOTES = "- Lynk & Co 900 Pro: Power 598 hp; Torque 1,000 Nm; Price CNY 309,900\n- Lynk & Co 900 Ultra: Power 845 hp; Torque 1,200 Nm; Price CNY 369,900\n- Lynk & Co 900 Max: Price CNY 999,999"
    page.evaluate("(n) => { const M = window.__mock; M.fakeQueue = ['Lynk & Co 900 specifications\\nLynk & Co 900 price China 2025', n, 'NONE', 'NONE', '**Two trims** [1]: Pro 598 hp, Ultra 845 hp.']; M.bodies = []; M.searchLog = []; }", NOTES)
    send(page, "Deep research: Lynk & Co 900 all trims with hp, torque and price")
    page.wait_for_function("() => document.querySelectorAll(\"button[title='Regenerate']\").length >= 2", timeout=60000)
    bs = page.evaluate("window.__mock.bodies.filter(x => x.max_tokens > 2).map(x => String(x.messages[0].content).slice(0, 60))")
    check(any(b.startswith("You plan web research") for b in bs), "deep research is planned by the model first")
    check(sum(1 for b in bs if b.startswith("You read ONE web page")) == 2, "each page is read on its own, into notes (%d pages)" % sum(1 for b in bs if b.startswith("You read ONE web page")))
    check(any(b.startswith("You check research notes") for b in bs), "…then it checks what is still missing")
    prompt = page.evaluate("window.__mock.bodies.filter(x => x.max_tokens > 2).pop().messages.slice(-1)[0].content")
    prompt = json.dumps(prompt) if not isinstance(prompt, str) else prompt
    check("CNY 999,999" not in prompt, "a note with a number that isn't on the page is dropped")
    check("complete, expert research report" in prompt and "Where sources differ" in prompt, "the deep report: direct answer, sections, disagreements, gaps")
    check(page.locator("text=read 2 pages one by one").count() >= 1, "the answer says it read the pages one by one")
    page.locator("button:has-text('Web')").first.click()

    # v5.31 — Web off, a question about prices: the answer offers a web search, one tap does it
    page.evaluate("() => { const M = window.__mock; M.fakeQueue = ['About 300,000 CNY.', '**CNY 309,900** [1]', '**CNY 309,900** [1]', '**CNY 309,900** [1]']; M.bodies = []; M.searchLog = []; }")
    send(page, "What is the price of the Lynk & Co 900 today?")
    page.wait_for_function("() => document.querySelectorAll(\"button[title='Regenerate']\").length >= 3", timeout=60000)
    chip = page.locator("[data-testid=search-web-chip]")
    check(chip.count() == 1, "Web is off and the question is about a price: the answer offers '🌐 Search the web for this'")
    chip.click()
    page.wait_for_function("() => document.querySelectorAll(\"button[title='Regenerate']\").length >= 4", timeout=60000)
    check(len(page.evaluate("window.__mock.searchLog")) >= 1 and page.locator("[data-testid=cite]").count() >= 1, "…one tap searches the web for that question (Web stays off afterwards)")
    check(page.locator("button:has-text('Web')").first.get_attribute("class").find("border-teal-600") < 0, "…and the Web switch itself stays off")

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
