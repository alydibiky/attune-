"""v6.32 Business builder v2 on a system you built: Team & tools → people with PINs and roles (the system then opens behind a PIN,
and an editor can't change the design), a second currency, a price list that fills the price in the form, an encrypted
backup and the export as a real project (.zip).
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v732bizv2.py     (SHOTS=dir for screenshots)
"""
import os, io, json, base64, subprocess, zipfile
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
HERE = os.path.dirname(os.path.abspath(__file__))
SYS = json.loads(subprocess.check_output(["node", "--input-type=module", "-e", """
import * as E from '%s/../web-src/erp.js';
let s = E.systemFromSpec({ name: 'Parts shop', currency: 'EGP', tables: [
  { name: 'Products', fields: [{ name: 'Product', type: 'text' }, { name: 'Price', type: 'money' }] },
  { name: 'Sales', fields: [{ name: 'Product', type: 'link', link: 'Products' }, { name: 'Qty', type: 'number' }, { name: 'Unit price', type: 'money' }] }] });
s = E.addRow(s, s.tables[0].id, { Product: 'Filter', Price: 100 }).sys;
s = E.addRow(s, s.tables[0].id, { Product: 'Hose', Price: 250 }).sys;
console.log(JSON.stringify(s));
""" % HERE], stderr=subprocess.DEVNULL))
SEED = "try{if(!localStorage.getItem('attune:erp:v1')){localStorage.setItem('attune:erp:v1:%s',%s);localStorage.setItem('attune:erp:v1',%s)}}catch(e){}" % (
    SYS["id"], json.dumps(json.dumps(SYS)), json.dumps(json.dumps([{"id": SYS["id"], "name": SYS["name"], "updated": SYS["updated"], "tables": 2, "active": True}])))
SHOTS = os.environ.get("SHOTS")
env = Env(); errors = []

def open_system(page):
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.locator("nav button").last.click(); page.wait_for_timeout(300)
    page.locator(".rounded-t-2xl button:has-text('Business')").first.click()
    page.wait_for_selector("[data-testid=erp-system]", timeout=8000); page.locator("[data-testid=erp-system]").first.click()

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init="try{localStorage.setItem('attune:start','home')}catch(e){};" + SEED)
    page.set_viewport_size({"width": 390, "height": 844})
    open_system(page); page.wait_for_selector("[data-testid=biz-system]")
    # ---- currencies
    page.click("[data-testid=biz-tools-open]"); page.wait_for_selector("[data-testid=biz-tools]")
    check(page.locator("[data-testid^=biz-tools-]").count() >= 5, "Team & tools: team, currencies, price lists, backup, project")
    page.click("[data-testid=biz-tools-money]"); page.fill("[data-testid=biz-rate]", "48.5"); page.click("[data-testid=biz-rate-save]"); page.wait_for_timeout(200)
    check("1 USD = 48.5 EGP" in page.locator("[data-testid=biz-money]").inner_text(), "a USD rate is saved")
    page.locator("[data-testid=biz-tools] button[aria-label=Back]").click()
    # ---- price list
    page.click("[data-testid=biz-tools-prices]"); page.click("[data-testid=biz-pricelist-new]")
    page.fill("[data-testid=biz-pl-name]", "Wholesale"); page.fill("[data-testid=biz-pl-adjust]", "-10"); page.click("[data-testid=biz-pl-save]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=biz-pricelist]").count() == 1, "a Wholesale price list (−10%) is saved")
    page.locator("[data-testid=biz-tools] button[aria-label=Close]").click()
    page.click("[data-testid=biz-tab-form]"); page.wait_for_selector("[data-testid=biz-form]")
    page.locator("[data-testid=biz-form-tables] button", has_text="Sales").click(); page.wait_for_timeout(200)
    page.click("[data-testid=biz-form-new]")
    page.select_option("[data-testid=biz-form-pricelist] select", label="Wholesale")
    page.locator("[data-testid=biz-form-fields] select").first.select_option(index=1); page.wait_for_timeout(200)
    vals = page.locator("[data-testid=biz-form-fields] input").evaluate_all("els => els.map(e => e.value)")
    check("90" in vals, "picking Filter fills its Wholesale price: 100 − 10%% = 90 (%s)" % vals)
    # ---- export as a project
    page.click("[data-testid=biz-tools-open]"); page.click("[data-testid=biz-tools-project]")
    page.click("[data-testid=biz-project-save]")
    page.wait_for_function("() => window.__mock.lastSaved && /\\.zip$/.test(window.__mock.lastSaved.name)", timeout=20000)
    z = zipfile.ZipFile(io.BytesIO(base64.b64decode(page.evaluate("window.__mock.lastSaved.b64")))); names = [n.split("/", 1)[1] for n in z.namelist()]
    check({"index.html", "manifest.webmanifest", "sw.js", "package.json", "main.js", "README.md", "data/system.json"} <= set(names), "the project .zip has the app, web-app files, Electron wrapper, data and README")
    page.locator("[data-testid=biz-tools] button[aria-label=Back]").click()
    # ---- encrypted backup
    page.click("[data-testid=biz-tools-backup]"); page.fill("[data-testid=biz-pass]", "parts-2026")
    page.click("[data-testid=biz-backup-make]")
    page.wait_for_function("() => window.__mock.lastSaved && /attune-biz$/.test(window.__mock.lastSaved.name)", timeout=30000)
    bk = page.evaluate("window.__mock.lastSaved.text")
    check('"attune-biz-vault"' in bk and "Hose" not in bk, "the backup is encrypted")
    page.locator("[data-testid=biz-tools] button[aria-label=Back]").click()
    # ---- team: owner + editor; then the PIN gate
    page.wait_for_selector("[data-testid=biz-tools-team]"); page.wait_for_timeout(300)
    page.click("[data-testid=biz-tools-team]"); page.wait_for_selector("[data-testid=biz-team]", timeout=5000)
    page.fill("[data-testid=biz-team-name]", "Ali"); page.fill("[data-testid=biz-team-pin]", "2468"); page.click("[data-testid=biz-team-add]"); page.wait_for_timeout(300)
    page.fill("[data-testid=biz-team-name]", "Sayed"); page.select_option("[data-testid=biz-team-role]", "editor"); page.fill("[data-testid=biz-team-pin]", "1357"); page.click("[data-testid=biz-team-add]"); page.wait_for_timeout(300)
    check(page.locator("[data-testid=biz-team-user]").count() == 2, "two people: an owner and an editor")
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, "biz-team.png"))
    page.locator("[data-testid=biz-tools] button[aria-label=Close]").click()
    page.reload(); open_system(page)
    page.wait_for_selector("[data-testid=biz-pin]", timeout=5000)
    check(True, "after reopening, the system asks for a PIN")
    page.fill("[data-testid=biz-pin-input]", "0000"); page.keyboard.press("Enter"); page.wait_for_timeout(300)
    check("Wrong PIN" in page.locator("[data-testid=biz-pin]").inner_text(), "a wrong PIN is refused")
    page.fill("[data-testid=biz-pin-input]", "1357"); page.keyboard.press("Enter"); page.wait_for_selector("[data-testid=biz-system]", timeout=5000)
    page.click("[data-testid=biz-tools-open]")
    check(page.locator("[data-testid=biz-tools-team]").is_disabled() and "Sayed" in page.locator("[data-testid=biz-tools]").inner_text(), "the editor is signed in and can't open Team")
    page.locator("[data-testid=biz-tools] button[aria-label=Close]").click()
    br.close()
check(not real_errors(errors), "no page errors: " + "; ".join(real_errors(errors)[:3]))
finish()
