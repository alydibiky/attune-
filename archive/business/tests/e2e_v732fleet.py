"""v6.32 Fleet & rentals (Business → Fleet): Ali's Crane Management + Crane Warehouse apps in one. Demo data, Today's warnings,
a work entry needs evidence and can't overlap, a client's balance, an issue from the store split by the reference-code rule,
the Recycle Bin, an encrypted backup, and the computer layout (side rail). Arabic: no English left on the screens.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v732fleet.py     (SHOTS=dir for screenshots)
"""
import os, base64, tempfile
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
PNG = os.path.join(tempfile.gettempdir(), "fleet-sheet.png")
open(PNG, "wb").write(base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="))

def open_fleet(page):
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.locator("nav button").last.click(); page.wait_for_timeout(300)
    page.locator(".rounded-t-2xl button:has-text('Business')").first.click()
    page.wait_for_selector("[data-testid=fleet-open]", timeout=8000); page.click("[data-testid=fleet-open]")
    page.wait_for_selector("[data-testid=fleet-app]", timeout=5000)

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init="try{localStorage.setItem('attune:start','home')}catch(e){}")
    page.set_viewport_size({"width": 390, "height": 844})
    open_fleet(page)
    check(page.locator("[data-testid=fleet-empty]").count() == 1, "a first visit shows the start screen")
    page.click("[data-testid=fleet-demo]"); page.wait_for_selector("[data-testid=fleet-today]")
    t = page.locator("[data-testid=fleet-today]").inner_text()
    check("2 / 3" in t, "Today: 2 of 3 cranes working")
    check(page.locator("[data-testid=fleet-warning]").count() >= 2 and "overdue" in page.locator("[data-testid=fleet-warning]").first.inner_text(), "the overdue cheque is the first warning")
    check(page.locator("[data-testid=fleet-tabs] button").count() == 5, "five tabs on a phone")
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, "fleet-today.png"))
    # ---- add work: evidence required, overlap blocked
    # v6.50 option C: Today opens calm (tiles, quick actions, what needs you); the Report holds cash and the cranes working now
    check(page.locator("[data-testid=fleet-active]").count() == 0 and page.locator("[data-testid=fleet-cash]").count() == 0
          and page.locator("[data-testid=fleet-see-report]").count() == 1, "Today opens calm — the Report is one tap away")
    page.click("[data-testid=fleet-see-report]"); page.wait_for_selector("[data-testid=fleet-cash]")
    check(page.locator("[data-testid=fleet-today]").get_attribute("data-view") == "report" and page.locator("[data-testid=fleet-active]").count() == 2, "the Report: cash and the cranes working now")
    page.locator("[data-testid=fleet-active]").first.click(); page.wait_for_selector("[data-testid=fleet-job-detail]")
    page.click("[data-testid=fleet-add-work]"); page.wait_for_selector("[data-testid=fleet-work-form]")
    page.fill("[data-testid=fleet-f-start]", "09:00"); page.fill("[data-testid=fleet-f-end]", "15:30")
    check("6.5 h" in page.locator("[data-testid=fleet-live]").inner_text(), "hours × rate worked out live: 6.5 h")
    check(page.locator("[data-testid=fleet-save]").is_disabled(), "it can't be saved without evidence")
    page.set_input_files("[data-testid=fleet-evidence-file]", PNG); page.wait_for_timeout(500)
    page.click("[data-testid=fleet-save]"); page.wait_for_timeout(400)
    check(page.locator("[data-testid=fleet-entry]").count() == 3, "the work is saved under its month")
    page.click("[data-testid=fleet-add-work]"); page.wait_for_selector("[data-testid=fleet-work-form]")
    page.fill("[data-testid=fleet-f-start]", "12:00"); page.fill("[data-testid=fleet-f-end]", "13:00")
    check(page.locator("[data-testid=fleet-clash]").count() == 1, "overlapping hours for the same crane are flagged and blocked")
    page.keyboard.press("Escape"); page.locator("[data-testid=fleet-sheet] button[aria-label=Close]").click()
    # ---- a client's balance
    page.click("[data-testid=fleet-tab-fleet]"); page.click("[data-testid=fleet-seg-clients]")
    page.locator("[data-testid=fleet-client]:has-text('Orascom')").click(); page.wait_for_selector("[data-testid=fleet-client-detail]")
    bal = page.locator("[data-testid=fleet-balance]").inner_text()
    check(bal.replace(",", "").startswith("54300"), "the client's balance = opening + work − payments (%s)" % bal)
    # v6.34: the client's statement of account (printed / saved as PDF)
    check(page.locator("[data-testid=fleet-statement]").count() == 1, "a client has a Statement button")
    page.click("[data-testid=fleet-statement]"); page.wait_for_timeout(400)
    # ---- store: an issue split by the reference-code rule
    page.click("[data-testid=fleet-tab-store]"); page.click("[data-testid=fleet-out]"); page.wait_for_selector("[data-testid=fleet-out-form]")
    # Ali's warehouse order: the reference code first, then tap the item on that invoice (the item box is locked)
    nref = page.locator("[data-testid=fleet-f-ref] option").count()
    for k in range(1, nref):
        page.select_option("[data-testid=fleet-f-ref]", index=k); page.wait_for_timeout(120)
        if page.locator("[data-testid=fleet-ref-item]:has-text('Oil filter')").count(): break
    check(page.locator("[data-testid=fleet-f-oitem]").is_disabled(), "with a reference code the item box is locked (pick from the invoice)")
    page.locator("[data-testid=fleet-ref-item]:has-text('Oil filter')").click(); page.wait_for_timeout(120)
    check(page.input_value("[data-testid=fleet-f-oitem]") == "Oil filter", "tapping the invoice's row fills the item")
    page.fill("[data-testid=fleet-f-oqty]", "9"); page.wait_for_timeout(200)
    plan = page.locator("[data-testid=fleet-plan]").inner_text()
    check("split" in plan and plan.count("×") == 2, "9 filters against an invoice with 8 left → split into 2 lines")
    page.fill("[data-testid=fleet-f-oprice]", "500"); page.select_option("[data-testid=fleet-f-ocrane]", index=1); page.fill("[data-testid=fleet-f-tech]", "Sayed")
    check("8" in plan, "the linked line takes the 8 left")
    page.fill("[data-testid=fleet-f-oqty]", "50"); page.wait_for_timeout(150)
    check(page.locator("[data-testid=fleet-plan-error]").count() == 1, "more than the total balance is refused with the reason")
    page.fill("[data-testid=fleet-f-oqty]", "9"); page.wait_for_timeout(150); page.fill("[data-testid=fleet-f-oprice]", "500")
    page.click("[data-testid=fleet-save]"); page.wait_for_timeout(400)
    page.click("[data-testid=fleet-sseg-log]")
    check(page.locator("[data-testid=fleet-tx]").count() == 6, "the movements log shows 6 lines with running balances")
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, "fleet-store.png"))
    page.click("[data-testid=fleet-sseg-stock]")
    check("Low" in page.locator("[data-testid=fleet-item]:has-text('Oil filter')").inner_text(), "the oil filter is now under its minimum")
    # ---- money: clear a cheque
    page.click("[data-testid=fleet-tab-money]"); n0 = page.locator("[data-testid=fleet-cheque]").count()
    page.locator("[data-testid=fleet-clear]").first.click(); page.wait_for_timeout(300)
    check(page.locator("[data-testid=fleet-cheque]").count() == n0 - 1, "a cleared cheque leaves the Pending list")
    # ---- recycle bin
    page.click("[data-testid=fleet-tab-jobs]"); page.locator("[data-testid=fleet-job]").first.click()
    page.click("[data-testid=fleet-del-job]"); page.click("[data-testid=confirm-yes]"); page.wait_for_timeout(300)
    page.click("[data-testid=fleet-menu]"); page.click("[data-testid=fleet-bin]"); page.wait_for_selector("[data-testid=fleet-bin-view]")
    page.locator("[data-testid=fleet-restore]").first.click(); page.wait_for_timeout(300)
    check(page.locator("[data-testid=fleet-bin-view]").inner_text().count("Restore") == 0, "a deleted job is restored from the Recycle Bin")
    page.locator("[data-testid=fleet-sheet] button[aria-label=Close]").click()
    # ---- v6.50 (Ali: "the app must be neutral"): the Crane toolkit opens from Fleet's More, inside Business
    page.click("[data-testid=fleet-menu]"); page.click("[data-testid=fleet-crane-toolkit]")
    page.wait_for_selector("[data-testid=crane-toolkit]", timeout=5000); check(True, "Fleet → More → Crane toolkit opens it")
    # ---- kept after a reload
    page.reload(); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    open_fleet(page); page.click("[data-testid=fleet-view-report]"); page.wait_for_selector("[data-testid=fleet-active]")
    check(page.locator("[data-testid=fleet-today]").count() == 1 and page.locator("[data-testid=fleet-active]").count() == 2, "everything is still there after reopening the app")
    # ---- an encrypted backup (download in the browser)
    page.click("[data-testid=fleet-menu]"); page.click("[data-testid=fleet-backup]"); page.fill("[data-testid=fleet-pass]", "crane-2026")
    page.click("[data-testid=fleet-make-backup]")
    page.wait_for_function("() => window.__mock.lastSaved && /attune-biz/.test(window.__mock.lastSaved.name)", timeout=30000)
    text = page.evaluate("window.__mock.lastSaved.text")
    check('"attune-biz-vault"' in text and "Orascom" not in text, "the backup is encrypted (no client names readable in it)")
    # ---- computer: side rail
    page.set_viewport_size({"width": 1280, "height": 860}); page.wait_for_timeout(300)
    check(page.locator("[data-testid=fleet-rail]").is_visible() and page.locator("[data-testid=fleet-tabs]").count() == 0, "on a computer the tabs become a side rail")
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, "fleet-desktop.png"))
    ctx.close()
    # ---- Arabic: no English left
    ctx, page = new_page(br, env, errors, extra_init="try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:ui:lang','ar')}catch(e){};window.__trMiss=new Set()")
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.locator("nav button").last.click(); page.wait_for_timeout(300)
    page.locator(".rounded-t-2xl button:has-text('الأعمال')").first.click()
    page.wait_for_selector("[data-testid=fleet-open]", timeout=8000); page.click("[data-testid=fleet-open]")
    page.click("[data-testid=fleet-demo]"); page.wait_for_selector("[data-testid=fleet-today]")
    for tab in ["jobs", "fleet", "money", "store", "today"]:
        page.click("[data-testid=fleet-tab-%s]" % tab); page.wait_for_timeout(150)
    for k in ["work", "job", "cheque", "expense", "out"]:
        page.click("[data-testid=fleet-quick-%s]" % k); page.wait_for_timeout(150); page.locator("[data-testid=fleet-sheet] button[aria-label]").first.click(); page.wait_for_timeout(100)
    miss = [m for m in page.evaluate("[...window.__trMiss]") if not m.startswith("[DEMO]")]
    check(not miss, "every Fleet string has Arabic" + (": " + "; ".join(miss[:8]) if miss else ""))
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, "fleet-ar.png"))
    br.close()
check(not real_errors(errors), "no page errors: " + "; ".join(real_errors(errors)[:3]))
finish()
