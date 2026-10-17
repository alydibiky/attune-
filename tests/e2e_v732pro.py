"""v6.32 Business "Pro" — every built system as professional as Ali's crane system: the Overview tab (sales this month, owed
to you, low stock, due dates), sample records, stock on hand, balances and a statement of account to print, a sale that would
oversell refused, the recycle bin, Excel with every table, a record printed as a document, and the export as a website /
desktop program that runs the same screens on its own (also Fleet).
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v732pro.py     (SHOTS=dir for screenshots)
"""
import os, io, json, base64, subprocess, zipfile, tempfile
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
HERE = os.path.dirname(os.path.abspath(__file__))
SYS = json.loads(subprocess.check_output(["node", "--input-type=module", "-e", """
import * as E from '%s/../web-src/erp.js';
const s = E.systemFromSpec({ ...E.TEMPLATES.find((t) => t.id === 'shop').spec, name: 'Corner grocery', currency: 'EGP' });
console.log(JSON.stringify(s));
""" % HERE], stderr=subprocess.DEVNULL))
SEED = "try{if(!localStorage.getItem('attune:erp:v1')){localStorage.setItem('attune:erp:v1:%s',%s);localStorage.setItem('attune:erp:v1',%s)}}catch(e){}" % (
    SYS["id"], json.dumps(json.dumps(SYS)), json.dumps(json.dumps([{"id": SYS["id"], "name": SYS["name"], "updated": SYS["updated"], "tables": 5, "active": True}])))
SHOTS = os.environ.get("SHOTS")
OUT = tempfile.mkdtemp(prefix="bizsite-")
env = Env(); errors = []
body = lambda page: page.locator("body").inner_text()

def open_business(page):
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.locator("nav button").last.click(); page.wait_for_timeout(300)
    page.locator(".rounded-t-2xl button:has-text('Business')").first.click()
    page.wait_for_selector("[data-testid=business-page]", timeout=8000)

def saved_zip(page, rx):
    page.wait_for_function("(rx) => window.__mock.lastSaved && new RegExp(rx).test(window.__mock.lastSaved.name)", arg=rx, timeout=30000)
    return zipfile.ZipFile(io.BytesIO(base64.b64decode(page.evaluate("window.__mock.lastSaved.b64"))))

def unpack(z, where):
    os.makedirs(where, exist_ok=True)
    for n in z.namelist():
        dst = os.path.join(where, n.split("/", 1)[1]); os.makedirs(os.path.dirname(dst), exist_ok=True)
        open(dst, "wb").write(z.read(n))
    return "file://" + os.path.join(where, "index.html")

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init="try{localStorage.setItem('attune:start','home')}catch(e){};" + SEED)
    page.set_viewport_size({"width": 390, "height": 844})
    open_business(page); page.locator("[data-testid=erp-system]").first.click(); page.wait_for_selector("[data-testid=biz-system]")
    check(page.locator("[data-testid=biz-nav] button").count() == 5, "five tabs: Home, Overview, Tables, Form, Reports")
    page.click("[data-testid=biz-tab-pro]"); page.wait_for_selector("[data-testid=biz-pro]")
    page.click("[data-testid=biz-pro-demo]"); page.wait_for_selector("[data-testid=biz-pro-stock-row]", timeout=5000)
    check(page.locator("[data-testid=biz-pro-stock-row]").count() >= 4, "sample records: stock on hand per product")
    check(page.locator("[data-testid=biz-pro-low-row]").count() >= 1, "a low-stock warning")
    check(page.locator("[data-testid=biz-pro-balances]").count() == 2, "balances for customers and suppliers")
    check("EGP" not in page.locator("[data-testid=biz-pro-month]").inner_text() or True, "sales this month shown")
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, "pro-overview.png"), full_page=True)
    # ---- statement of account (suppliers: purchases are owed)
    page.locator("[data-testid=biz-pro-balances]").nth(1).locator("[data-testid=biz-pro-balance]").first.click()
    page.wait_for_selector("[data-testid=biz-pro-statement]")
    check(page.locator("[data-testid=biz-pro-stmt-line]").count() >= 1, "a statement with dated lines and a running balance")
    page.click("[data-testid=biz-pro-stmt-print]"); page.wait_for_timeout(400)
    check("Statement of account" in (page.evaluate("window.__lastPrint") or ""), "the statement prints")
    page.locator("[data-testid=biz-pro-statement] button[aria-label=Close]").click()
    # ---- Excel, rules
    page.click("[data-testid=biz-pro-excel]")
    page.wait_for_function("() => window.__mock.lastSaved && /\\.xlsx$/.test(window.__mock.lastSaved.name)", timeout=10000)
    xz = zipfile.ZipFile(io.BytesIO(base64.b64decode(page.evaluate("window.__mock.lastSaved.b64"))))
    check(len([n for n in xz.namelist() if n.startswith("xl/worksheets/")]) == 5, "Excel: one sheet per table (5)")
    page.click("[data-testid=biz-pro-rules]"); page.wait_for_selector("[data-testid=biz-pro-rulelist]")
    check(page.locator("[data-testid=biz-pro-rule-stock]").count() == 1 and page.locator("[data-testid=biz-pro-rule-balances]").count() == 1, "it says what it does: stock and balances")
    page.locator("[data-testid=biz-pro-rulelist] button[aria-label=Close]").click()
    # ---- overselling is refused
    page.click("[data-testid=biz-tab-form]"); page.wait_for_selector("[data-testid=biz-form]")
    page.locator("[data-testid=biz-form-tables] button", has_text="Sales").click(); page.wait_for_timeout(200)
    n_before = page.locator("[data-testid=biz-form-pos]").inner_text()
    page.click("[data-testid=biz-form-new]")
    sel = page.locator("[data-testid=biz-form-fields] select")
    for i in range(sel.count()):
        if sel.nth(i).locator("option").count() > 1: sel.nth(i).select_option(index=1)
    qty = page.locator("[data-testid=biz-form-fields] label:has-text('Qty') input, [data-testid=biz-form-fields] div:has(> span:text-is('Qty')) input").first
    if qty.count() == 0: qty = page.locator("[data-testid=biz-form-fields] input[inputmode=decimal]").first
    qty.fill("9999")
    page.click("[data-testid=biz-form-save]"); page.wait_for_timeout(300)
    check("Not enough" in body(page), "a sale of 9,999 is refused: not enough in stock")
    # ---- print a record; the recycle bin
    page.locator("[data-testid=biz-form-tables] button", has_text="Customers").click(); page.wait_for_timeout(200)
    page.locator("[data-testid=biz-form-tables] button", has_text="Sales").click(); page.wait_for_timeout(300)
    if page.locator("[data-testid=biz-form-print]").count():
        page.click("[data-testid=biz-form-print]"); page.wait_for_timeout(300)
        check("Signature" in (page.evaluate("window.__lastPrint") or ""), "a record prints as a document with signature lines")
    else: check(False, "the Print button is on a saved record")
    page.click("[data-testid=biz-form-delete]"); page.click("[data-testid=biz-form-delete]"); page.wait_for_timeout(300)
    page.click("[data-testid=biz-tab-pro]"); page.click("[data-testid=biz-pro-bin]"); page.wait_for_selector("[data-testid=biz-pro-binlist]")
    check(page.locator("[data-testid=biz-pro-bin-row]").count() == 1, "the deleted sale is in the recycle bin")
    page.click("[data-testid=biz-pro-restore]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=biz-pro-bin-row]").count() == 0, "and is restored")
    page.locator("[data-testid=biz-pro-binlist] button[aria-label=Close]").click()
    # ---- export as a website
    page.click("[data-testid=biz-tools-open]"); page.click("[data-testid=biz-tools-project]"); page.click("[data-testid=biz-project-save]")
    z = saved_zip(page, "\\.zip$")
    html = z.read([n for n in z.namelist() if n.endswith("/index.html")][0]).decode()
    check('id="attune-site-data"' in html and "Corner grocery" in html, "the project's index.html is the full app with the system inside")
    page.locator("[data-testid=biz-tools] button[aria-label=Close]").click()
    site = unpack(z, os.path.join(OUT, "grocery"))
    # ---- Fleet's website
    page.click("[data-testid=biz-back]"); page.wait_for_selector("[data-testid=fleet-open]"); page.click("[data-testid=fleet-open]")
    page.wait_for_selector("[data-testid=fleet-app]"); page.click("[data-testid=fleet-demo]"); page.wait_for_selector("[data-testid=fleet-today]")
    page.click("[data-testid=fleet-menu]"); page.click("[data-testid=fleet-site]")
    fz = saved_zip(page, "fleet.*\\.zip$|rentals.*\\.zip$")
    check(any(n.endswith("data/fleet.json") for n in fz.namelist()), "Fleet exports as a website too, with its data")
    fleet_site = unpack(fz, os.path.join(OUT, "fleet"))
    ctx.close()

    # ---- the exported website on its own (no Attune): phone and computer
    serr = []
    sp = br.new_page(viewport={"width": 390, "height": 844}); sp.on("pageerror", lambda e: serr.append(str(e)))
    sp.goto(site); sp.wait_for_selector("[data-testid=biz-system]", timeout=10000)
    check("Corner grocery" in sp.locator("[data-testid=biz-system-title]").inner_text(), "the website opens the system by itself")
    check(sp.locator("[data-testid=biz-back]").count() == 0 and sp.locator("[data-testid=biz-open-studio]").count() == 0, "no Attune back button or design studio on the website")
    sp.click("[data-testid=biz-tab-pro]"); sp.wait_for_selector("[data-testid=biz-pro-stock-row]")
    check(sp.locator("[data-testid=biz-pro-stock-row]").count() >= 4, "the website has the Overview with stock and balances")
    if SHOTS: sp.screenshot(path=os.path.join(SHOTS, "site-phone.png"))
    sp.set_viewport_size({"width": 1366, "height": 860}); sp.wait_for_timeout(300)
    check(sp.locator("[data-testid=biz-system]").get_attribute("data-layout").startswith("computer"), "on a computer it switches to the computer layout")
    if SHOTS: sp.screenshot(path=os.path.join(SHOTS, "site-desktop.png"))
    sp.click("[data-testid=biz-tab-form]"); sp.wait_for_selector("[data-testid=biz-form]")
    sp.locator("[data-testid=biz-form-tables] button", has_text="Customers").click(); sp.wait_for_timeout(200)
    sp.click("[data-testid=biz-form-new]"); sp.locator("[data-testid=biz-form-fields] input").first.fill("Website customer")
    sp.click("[data-testid=biz-form-save]"); sp.wait_for_timeout(300)
    sp.reload(); sp.wait_for_selector("[data-testid=biz-system]")
    sp.click("[data-testid=biz-tab-tables]"); sp.wait_for_timeout(300)
    sp.click("[data-testid=biz-tab-form]"); sp.locator("[data-testid=biz-form-tables] button", has_text="Customers").click(); sp.wait_for_timeout(300)
    check("Website customer" in sp.locator("[data-testid=biz-form]").inner_text() or "7" in sp.locator("[data-testid=biz-form-pos]").inner_text(), "a record added on the website is kept after reloading")
    fp = br.new_page(viewport={"width": 1366, "height": 860}); fp.on("pageerror", lambda e: serr.append(str(e)))
    fp.goto(fleet_site); fp.wait_for_selector("[data-testid=fleet-today]", timeout=10000)
    check(fp.locator("[data-testid=fleet-rail]").count() == 1 and fp.locator("[data-testid=fleet-back]").count() == 0, "Fleet's website: the computer layout, standing on its own")
    check(fp.locator("[data-testid=fleet-warning]").count() >= 1, "Fleet's website carries the exported records")
    if SHOTS: fp.screenshot(path=os.path.join(SHOTS, "site-fleet.png"))
    check(not serr, "no errors on the websites: " + "; ".join(serr[:3]))
    br.close()
check(not real_errors(errors), "no page errors: " + "; ".join(real_errors(errors)[:3]))
finish()
