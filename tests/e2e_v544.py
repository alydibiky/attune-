"""v5.44 — Business: combining databases. Two sheets come in; the phone sees that Orders › Client
names Clients records and links them; one combined view shows each order with its client's phone and
city; a second clients sheet MERGES (updates the same client, adds the new one) instead of duplicating;
phones keep their leading 0.

  python3 tests/e2e_v544.py
"""
import os, tempfile
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish

env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
def shot(page, name):
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, name + ".png"))

def csv(name, text):
    p = os.path.join(tempfile.mkdtemp(), name); open(p, "w", encoding="utf-8").write(text); return p

def grid_text(page): return page.locator("[data-testid=erp-grid]").inner_text()

def import_new(page, path):
    page.click("[data-testid=erp-tab-more]")
    page.set_input_files("[data-testid=erp-import-file]", path)
    page.wait_for_selector("[data-testid=erp-import]")
    page.click("[data-testid=erp-import-new]")
    page.wait_for_timeout(300)

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("nav button").last.click(); page.wait_for_timeout(200)
    page.locator(".rounded-t-2xl button:has-text('Business')").first.click()
    page.wait_for_selector("[data-testid=business-page]", timeout=5000)
    page.click("[data-testid=erp-new]"); page.click("[data-testid=erp-tpl-cranes]"); page.click("[data-testid=erp-create]")
    page.wait_for_selector("[data-testid=erp-systemview]")

    import_new(page, csv("Clients.csv", "Name,Phone,City\nHassan Co.,01001234567,Cairo\nNile Build,01112223334,Giza\nDelta Steel,01223334445,Tanta\n"))
    page.click("[data-testid=erp-tab-data]")
    check("01001234567" in grid_text(page), "a phone keeps its leading 0 (not turned into 1,001,234,567)")
    import_new(page, csv("Orders.csv", "Order,Client,Crane,Amount\nO1,Hassan Co.,LTM 1100,35000\nO2,nile build,AC 100,28000\nO3,Hassan Co,LTM 1100,40000\nO4,Orascom,GMK 5250,90000\n"))

    # ---- the phone finds the connection ----
    page.click("[data-testid=erp-tab-more]")
    sug = page.locator("[data-testid=erp-link-sug]").filter(has_text="Orders › Client")
    check(sug.count() == 1 and "Clients" in sug.inner_text() and "3 of 4" in sug.inner_text() and "Orascom" in sug.inner_text(), "Orders › Client is found to hold Clients names (3 of 4; Orascom is new)")
    shot(page, "erp-suggest")
    sug.locator("[data-testid=erp-link-go]").click(); page.wait_for_timeout(300)
    check(page.locator("[data-testid=erp-link-sug]").filter(has_text="Orders › Client").count() == 0, "…linked with one tap")

    # ---- one combined view ----
    page.click("[data-testid=erp-combined]")
    page.wait_for_selector("[data-testid=erp-combined-view]")
    v = page.locator("[data-testid=erp-combined-view]").inner_text()
    check("Client › Phone" in v and "Client › City" in v and "01112223334" in v and "Giza" in v, "each order shows its client's phone and city beside it")
    shot(page, "erp-combined")
    page.click("[data-testid=erp-combined-csv]"); page.wait_for_timeout(300)

    # ---- a second clients sheet merges, never duplicates ----
    page.locator("[data-testid=erp-tables] button:has-text('Clients')").click()
    page.click("[data-testid=erp-tab-more]")
    page.set_input_files("[data-testid=erp-import-file]", csv("Clients-2026.csv", "Name,City\nNile Build,6th of October\nPetrojet,Suez\n"))
    page.wait_for_selector("[data-testid=erp-import]")
    mg = page.locator("[data-testid=erp-import-merge]")
    check(mg.count() == 1 and "same Name" in mg.inner_text(), "a sheet about the same records offers to merge by Name")
    mg.click(); page.wait_for_timeout(300)
    page.click("[data-testid=erp-tab-data]")
    g = grid_text(page)
    check(g.count("Nile Build") == 1 and "6th of October" in g and "Petrojet" in g and "01112223334" in g, "Nile Build updated in place (phone kept), Petrojet added, no duplicate")

    check(not real_errors(errors), "no errors (%s)" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
