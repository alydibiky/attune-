"""v9.0 (Ali: "open each person's history by pressing on him"): in People & plans a tap on a person opens their whole history —
the sums, every plan with them, each loan and payment and their Money entries, newest first — and Back returns. Arabic too.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v906history.py     (SHOTS=dir for screenshots)
"""
import json, os
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, finish
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
def shot(page, name):
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, name + ".png"), full_page=True)
LIFE = {"items": [
  {"id": "a", "kind": "debt", "person": "Sara", "dir": "in", "amount": 5000, "currency": "EGP", "start": "2026-08-01", "count": 1, "paid": [0], "got": {"0": 2000}},
  {"id": "b", "kind": "debt", "person": "Sara", "dir": "in", "amount": 3000, "currency": "EGP", "start": "2026-09-15", "count": 1, "paid": []},
  {"id": "d", "kind": "debt", "person": "Ahmed", "dir": "in", "amount": 9000, "currency": "EGP", "start": "2026-07-01", "count": 1, "paid": []}]}
LEDGER = {"currency": "EGP", "accounts": [{"id": "a1", "name": "Cash", "currency": "EGP"}], "txns": [{"id": "t1", "type": "expense", "amount": 450, "note": "Dinner with Sara", "date": "2026-10-20", "account": "a1", "cat": "food"}], "customCats": []}
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_timeout(1200)
    page.evaluate("([l, g]) => { localStorage.setItem('attune:life:v1', l); localStorage.setItem('ledger.v3', g); }", [json.dumps(LIFE), json.dumps(LEDGER)]); page.reload(); page.wait_for_timeout(1200)
    page.evaluate("m => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", "life"); page.wait_for_selector("[data-testid=life-page]", timeout=8000); page.wait_for_timeout(300)
    page.click("[data-testid=life-person-open]"); page.wait_for_timeout(300)
    h = page.locator("[data-testid=life-history]")
    check(h.count() == 1 and "Sara" in h.inner_text(), "tapping Sara opens her history")
    sums = page.locator("[data-testid=life-history-sums]").inner_text()
    check("6,000" in sums and "2,000" in sums, "sums: she still owes 6,000, got back 2,000: " + sums.replace("\n", " · "))
    rows = page.locator("[data-testid=life-history-row]")
    check(rows.count() == 4 and "Dinner with Sara" in h.inner_text() and "Ahmed" not in page.locator("[data-testid=life-history-events]").inner_text(), "4 lines: two loans, a payment, a Money entry — none of Ahmed's")
    check("Money out" in rows.nth(0).inner_text(), "newest first (the dinner on 20 Oct)")
    shot(page, "v906-history-en")
    page.click("[data-testid=life-history-back]"); page.wait_for_timeout(300)
    check(page.locator("[data-testid=life-history]").count() == 0 and page.locator("[data-testid=life-person]").count() == 1, "back to People & plans")
    page.click("[data-testid=life-who]"); page.wait_for_timeout(300)
    check("Ahmed" in page.locator("[data-testid=life-history]").inner_text(), "a single loan's name opens that person too (Ahmed)")
    page.evaluate("() => localStorage.setItem('attune:ui:lang', 'ar')"); page.reload(); page.wait_for_timeout(1200)
    page.evaluate("m => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", "life"); page.wait_for_selector("[data-testid=life-page]", timeout=8000); page.wait_for_timeout(300)
    page.click("[data-testid=life-person-open]"); page.wait_for_timeout(300)
    check("سلّفت" in page.locator("[data-testid=life-history-events]").inner_text(), "Egyptian Arabic: «سلّفت Sara …»")
    shot(page, "v906-history-ar")
    br.close()
finish()
