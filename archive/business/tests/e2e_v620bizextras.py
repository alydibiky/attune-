"""v6.20 — Business extras through the real screens: ETA export (one invoice + the batch), currencies and a USD invoice,
a sales order delivered in parts with delivery notes, the automatic encrypted backup with a dry-run restore, and users
with roles (a cashier does not see profit).

  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v620bizextras.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish

env = Env()

def open_books(page):
    page.locator("nav button").last.click(); page.wait_for_timeout(200)
    page.locator(".rounded-t-2xl button:has-text('Business')").first.click()
    page.wait_for_selector("[data-testid=business-page]", timeout=5000)
    page.click("[data-testid=books-open]")

def tab(page, name): page.click(f"[data-testid=books-tab-{name}]"); page.wait_for_timeout(250)
def close_top(page, testid): page.locator(f"[data-testid={testid}] button[aria-label=Close]").first.click(); page.wait_for_timeout(250)
def settings(page): page.click("[data-testid=books-settings-open]"); page.wait_for_selector("[data-testid=books-settings]")

with sync_playwright() as p:
    br = p.chromium.launch()
    errors = []
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    open_books(page); page.wait_for_selector("[data-testid=books-home]", timeout=8000)
    page.click("[data-testid=books-sample]"); page.wait_for_timeout(1500)

    # ---- ETA settings, then one invoice
    settings(page)
    for k, v in [("eta-activity", "4690"), ("eta-gov", "Cairo"), ("eta-city", "Downtown"), ("eta-street", "Tahrir St"), ("eta-building", "12")]:
        page.fill(f"[data-testid={k}]", v)
    page.click("[data-testid=books-settings-save]"); page.wait_for_timeout(500)
    tab(page, "sales")
    page.locator("[data-testid=sales-row]:has-text('INV-')").first.click(); page.wait_for_selector("[data-testid=doc-view]")
    page.click("[data-testid=doc-eta]"); page.wait_for_selector("[data-testid=eta-result]")
    txt = page.locator("[data-testid=eta-result]").inner_text()
    check("Not ready" in txt and "itemCode" in txt, "Export for ETA refuses an invoice whose items have no ETA code, and says why")
    check("USB token" in txt or "certificate" in txt, "the screen says signing needs the company's own certificate")
    close_top(page, "eta-result"); close_top(page, "doc-view")

    # give every sample item an ETA code, then the invoice exports and validates
    tab(page, "stock")
    n = page.locator("[data-testid=item-row]").count()
    for i in range(n):
        page.locator("[data-testid=item-row]").nth(i).locator("button").first.click(); page.wait_for_selector("[data-testid=item-eta-code]")
        page.fill("[data-testid=item-eta-code]", "EG-123456789-I%d" % i); page.click("[data-testid=item-save]"); page.wait_for_timeout(350)
    tab(page, "sales")
    page.locator("[data-testid=sales-row]:has-text('Mona')").first.click(); page.wait_for_selector("[data-testid=doc-view]")   # Mona: no tax id → a person, under 50,000
    page.click("[data-testid=doc-eta]"); page.wait_for_selector("[data-testid=eta-result]")
    check("Valid" in page.locator("[data-testid=eta-status]").inner_text(), "with codes set, the invoice is valid and saved")
    saved = page.evaluate("window.__mock.lastSaved")
    doc = json.loads(saved["text"])
    check(saved["name"].startswith("ETA-INV-") and doc["documentType"] == "i" and doc["documentTypeVersion"] == "1.0", "the saved file is an ETA invoice v1.0: %s" % saved["name"])
    check(doc["totalAmount"] == 6498.0 and doc["taxTotals"] == [{"taxType": "T1", "amount": 798.0}], "6 × 950.00 + 14%% = 6,498.00 (VAT 798.00): %s" % doc["totalAmount"])
    close_top(page, "eta-result"); close_top(page, "doc-view")
    tab(page, "reports"); page.click("text=E-invoices (ETA)"); page.wait_for_selector("[data-testid=eta-report]")
    page.click("text=All time"); page.wait_for_timeout(300)
    check("Need fixing" in page.locator("[data-testid=eta-report]").inner_text(), "the batch report lists what still needs fixing (customers without a tax id)")

    # ---- currencies: a USD rate, then a USD invoice shows its EGP equivalent
    settings(page)
    page.select_option("[data-testid=fx-cur]", "USD"); page.fill("[data-testid=fx-rate]", "50"); page.click("[data-testid=fx-save]"); page.wait_for_timeout(400)
    check("50" in page.locator("[data-testid=fx-list]").inner_text(), "the USD rate is in the table")
    close_top(page, "books-settings")
    tab(page, "sales")
    page.click("[data-testid=sales-new]"); page.click("[data-testid=new-invoice]"); page.wait_for_selector("[data-testid=doc-editor]")
    page.select_option("[data-testid=doc-customer]", index=1)
    page.select_option("[data-testid=doc-currency]", "USD"); page.wait_for_timeout(200)
    page.fill("[data-testid=line-desc]", "Consulting"); page.fill("[data-testid=line-qty]", "1"); page.fill("[data-testid=line-price]", "100"); page.wait_for_timeout(200)
    check("5,700.00 EGP" in page.locator("[data-testid=fx-note]").inner_text(), "100 USD + 14%% at 50 = 5,700.00 EGP")
    page.click("[data-testid=doc-post]"); page.wait_for_timeout(700)
    check("5,700.00" in page.locator("[data-testid=doc-view]").inner_text(), "the posted USD invoice is booked as 5,700.00 EGP")
    close_top(page, "doc-view")

    # ---- a sales order delivered in two parts
    page.click("[data-testid=sales-new]"); page.click("[data-testid=new-order]"); page.wait_for_selector("[data-testid=doc-editor]")
    page.select_option("[data-testid=doc-customer]", index=1)
    page.select_option("[data-testid=line-item]", index=1); page.wait_for_timeout(200)
    page.fill("[data-testid=line-qty]", "5"); page.click("[data-testid=doc-post]"); page.wait_for_timeout(700)
    page.wait_for_selector("[data-testid=doc-view]")
    check("SO-" in page.locator("[data-testid=doc-view]").inner_text(), "the order is numbered SO-…")
    page.click("[data-testid=doc-delivery]"); page.wait_for_selector("[data-testid=delivery-sheet]")
    page.fill("[data-testid=delivery-qty]", "2"); page.click("[data-testid=delivery-post]"); page.wait_for_timeout(700)
    t = page.locator("[data-testid=delivery-sheet]").inner_text()
    check("DN-" in t and "left 3" in t, "a partial delivery of 2: DN numbered, 3 left")
    page.fill("[data-testid=delivery-qty]", "4"); page.click("[data-testid=delivery-post]"); page.wait_for_timeout(500)
    check(page.locator("[data-testid=delivery-list] >> text=DN-").count() == 1, "delivering more than is left is refused")
    page.fill("[data-testid=delivery-qty]", "3"); page.click("[data-testid=delivery-post]"); page.wait_for_timeout(700)
    check(page.locator("[data-testid=delivery-done]").count() == 1 and page.locator("[data-testid=delivery-list] >> text=DN-").count() == 2, "the rest delivered: two notes, nothing left")
    close_top(page, "delivery-sheet"); close_top(page, "doc-view")

    # ---- PIN → automatic encrypted backup on the next opening → dry-run restore
    settings(page)
    page.fill("[data-testid=books-pin-set]", "2468"); page.locator("[data-testid=books-settings] button:has-text('Save')").first.click(); page.wait_for_timeout(500)
    close_top(page, "books-settings")
    page.reload(); page.wait_for_selector("nav", timeout=15000); open_books(page)
    page.wait_for_selector("[data-testid=books-lock]"); page.fill("[data-testid=books-pin]", "2468"); page.wait_for_timeout(2500)
    settings(page)
    check(page.locator("[data-testid=vault-row]").count() == 1, "an encrypted snapshot was taken when the books were opened")
    stash = page.evaluate("Object.keys(sessionStorage).filter(k => k.startsWith('mockstash:books-'))")
    raw = page.evaluate("sessionStorage.getItem('mockstash:' + Object.keys(sessionStorage).find(k => k.endsWith('.vault')).slice(10))")
    check(len(stash) == 2 and "Nile" not in raw and "AES-GCM" not in raw and '"PBKDF2"' in raw, "it is stored in the app's private folder, encrypted (no company name in clear)")
    page.locator("[data-testid=vault-row]").first.click(); page.wait_for_selector("[data-testid=vault-restore]")
    page.fill("[data-testid=vault-secret]", "1357"); page.click("[data-testid=vault-check]"); page.wait_for_selector("[data-testid=vault-error]", timeout=20000)
    check(True, "a wrong PIN cannot open the snapshot")
    page.fill("[data-testid=vault-secret]", "2468"); page.click("[data-testid=vault-check]"); page.wait_for_selector("[data-testid=vault-diff]", timeout=20000)
    d = page.locator("[data-testid=vault-diff]").inner_text()
    check("Integrity checked" in d and "same as your books" in d, "dry run: integrity checked, the copy equals the books")
    check(page.locator("[data-testid=vault-restore-go]").is_disabled(), "nothing to restore → the replace button is off")
    close_top(page, "vault-restore")
    page.fill("[data-testid=vault-pass]", "long passphrase 1"); page.click("[data-testid=vault-export]"); page.wait_for_timeout(4000)
    last = page.evaluate("window.__mock.lastSaved")
    check(last["name"].endswith(".vault") and '"attune-books-vault"' in last["text"], "an encrypted copy can be saved elsewhere: %s" % last["name"])

    # ---- users: owner + cashier; the cashier opens with her PIN and sees no profit
    page.fill("[data-testid=user-name]", "Ali"); page.select_option("[data-testid=user-role]", "owner"); page.fill("[data-testid=user-pin]", "1234"); page.click("[data-testid=user-add]"); page.wait_for_timeout(400)
    page.fill("[data-testid=user-name]", "Sara"); page.select_option("[data-testid=user-role]", "cashier"); page.fill("[data-testid=user-pin]", "5555"); page.click("[data-testid=user-add]"); page.wait_for_timeout(400)
    check("Sara" in page.locator("[data-testid=users-list]").inner_text() and page.locator("[data-testid=perm-matrix]").count() == 1, "two users and the permission matrix")
    close_top(page, "books-settings")
    page.reload(); page.wait_for_selector("nav", timeout=15000); open_books(page)
    page.wait_for_selector("[data-testid=books-lock]"); page.fill("[data-testid=books-pin]", "5555"); page.wait_for_timeout(1500)
    check("Sara" in page.locator("[data-testid=books-app]").inner_text(), "the cashier's name shows in the header")
    check(page.locator("[data-testid=stat-profit]").count() == 0, "a cashier does not see profit")
    settings(page)
    check(page.locator("[data-testid=user-add]").count() == 0 and page.locator("[data-testid=books-erase]").count() == 0, "a cashier cannot add users or erase the books")
    check(real_errors(errors) == [], "no errors: %s" % real_errors(errors)[:3])
    ctx.close()
    br.close()
env.close()
finish()
