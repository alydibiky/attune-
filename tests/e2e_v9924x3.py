"""v9.9.24 B6 X3 My things (Ali picked A — every field editable; combined screen OK'd): Documents → My things → From a receipt: the
receipt photo (clarity-checked) fills the card — Samsung TV, 18,500 from the TOTAL line, 2 Oct 2026, B.TECH Maadi, warranty 24 months;
a receipt with no TOTAL line marks the price yellow ("check"); the box photo adds the serial; Save → the list and the warranty's end in
Dates; tapping the row opens it to edit.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v9924x3.py
"""
import json, os, tempfile
from playwright.sync_api import sync_playwright
from harness import doc_png, Env, new_page, check, real_errors, finish
env = Env(); errors = []
INIT = ("try{localStorage.setItem('attune:start','home')}catch(e){}\n"
        "window.__ocr = []; (() => { const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0);"
        " N.readText = (id, arg) => { const t = window.__ocr.shift() || ''; setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ text: t, lines: t.split('\\n').map(x => ({ text: x })) })), 30); }; }; go(); })();")
D = tempfile.mkdtemp()
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'booklib'}}))"); page.wait_for_selector("[data-testid=things]", timeout=8000)
    IMG = doc_png(page, os.path.join(D, "r.png"))
    page.evaluate("t => window.__ocr.push(t)", "B.TECH Maadi\nTax invoice 004512\nDate: 02/10/2026\nSamsung TV 55\" UA55 18,500.00\nVAT 14% 2,271.93\nTOTAL 18,500.00\nWarranty 2 years")
    page.set_input_files("[data-testid=things-receipt-input]", IMG); page.wait_for_selector("[data-testid=thing-form]", timeout=8000)
    v = lambda k: page.input_value("[data-testid=thing-f-%s]" % k)
    check("Samsung TV" in v("name") and v("price") == "18500" and v("date") == "2026-10-02" and v("store") == "B.TECH Maadi" and v("warrantyMonths") == "24", "the receipt fills the card: %s / %s / %s / %s / %s" % (v("name"), v("price"), v("date"), v("store"), v("warrantyMonths")))
    check(page.locator("[data-unsure='1']").count() == 0, "everything sure → nothing yellow")
    page.evaluate("t => window.__ocr.push(t)", "Model: UA55AU7000\nS/N: 0B7K3CAR600123X")
    page.set_input_files("[data-testid=things-box-input]", IMG); page.wait_for_timeout(1500)
    check(v("serial") == "0B7K3CAR600123X", "the box photo adds the serial")
    page.fill("[data-testid=thing-f-name]", "Samsung TV 55 (living room)")
    page.click("[data-testid=thing-save]"); page.wait_for_timeout(300)
    row = page.locator("[data-testid=thing-row]").first.inner_text()
    check("living room" in row and "18,500" in row and "Warranty until" in row and "0B7K3CAR600123X" in row, "saved with the edit: " + row.replace("\n", " | "))
    radar = page.evaluate("JSON.parse(localStorage.getItem('attune:radar:v1') || '{\"items\":[]}').items")
    check(any(x["kind"] == "warranty" and x["date"] == "2028-10-02" for x in radar), "the warranty's end (2 Oct 2028) is in Dates")
    # a receipt with no TOTAL line → the price is yellow
    page.evaluate("t => window.__ocr.push(t)", "Raya Shop\nDate 01/09/2026\nMixer 1,250")
    page.set_input_files("[data-testid=things-receipt-input]", IMG); page.wait_for_selector("[data-testid=thing-form]", timeout=8000)
    check(page.locator("[data-testid=thing-f-price]").get_attribute("data-unsure") == "1" and page.locator("[data-testid=thing-unsure]").count() == 1, "no TOTAL line → price marked yellow ('check')")
    page.fill("[data-testid=thing-f-price]", "1250"); page.wait_for_timeout(100)
    check(page.locator("[data-testid=thing-f-price]").get_attribute("data-unsure") == "", "…editing it clears the yellow")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
env.close(); finish()
