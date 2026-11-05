"""v9.3 Money for two (Ali picked D4: "make A and B and users choose"). Phone 1 shares its House account (A); phone 2 joins with the
family code and the file — the House account and its entries arrive, each with who added it; nothing else of phone 1's money does.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v930share.py
"""
import json, base64
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
def ledger(accounts, txns): return {"currency": "EGP", "accounts": accounts, "txns": txns, "budgets": {"overall": 0, "cats": {}}, "recurring": [], "debts": [], "customCats": [], "goals": [], "projects": [], "notes": [], "zakatHistory": [], "zakatPayments": []}
ALI = ledger([{"id": "house", "name": "House", "emoji": "🏠", "currency": "EGP", "start": 5000, "kind": "cash"}, {"id": "cib", "name": "My CIB", "emoji": "🏦", "currency": "EGP", "start": 40000, "kind": "bank"}],
             [{"id": "t1", "type": "expense", "amount": 1240, "account": "house", "cat": "food", "date": "2026-11-05", "note": "Carrefour", "created": 1},
              {"id": "t2", "type": "expense", "amount": 600, "account": "cib", "cat": "transport", "date": "2026-11-05", "note": "Fuel", "created": 2}])
MARIAM = ledger([{"id": "mcard", "name": "Mariam's card", "emoji": "💳", "currency": "EGP", "start": 3000, "kind": "bank"}], [])
CAP = """(() => { function w(){ const N = window.AttuneNative; if (!N) return setTimeout(w, 5);
  N.shareFile = (id, arg) => { window.__shared = JSON.parse(arg); setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ ok: true })), 10); }; } w(); })();"""
def init(L): return "try{localStorage.setItem('ledger.v3', %s);localStorage.setItem('attune:start','home')}catch(e){};" % json.dumps(json.dumps(L)) + CAP
def money_more_share(page):
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'money'}}))")
    page.wait_for_selector("[data-testid=money-bar]", timeout=10000); page.wait_for_timeout(1500)
    page.click("[data-testid=money-more]"); page.click("[data-testid=money-more-share]"); page.wait_for_selector("[data-testid=money-share]")
with sync_playwright() as p:
    br = p.chromium.launch()
    # phone 1 — Ali starts a share of the House account (A)
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=init(ALI))
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_timeout(1200)
    money_more_share(page)
    page.click("[data-testid=share-start]")
    check(page.locator("[data-testid=share-kind-a]").count() == 1 and page.locator("[data-testid=share-kind-b]").count() == 1, "Share with family: A (some accounts) or B (all of Money) — the person chooses")
    page.locator("label", has_text="House").locator("[data-testid=share-acc]").check()
    page.fill("[data-testid=share-me]", "Ali"); page.fill("[data-testid=share-code]", "OurFamily26"); page.click("[data-testid=share-go]")
    page.wait_for_selector("[data-testid=share-on]")
    check("House" in page.inner_text("[data-testid=share-on]") and "OurFamily26" not in page.inner_text("[data-testid=share-on]"), "sharing: House — the code is never shown")
    page.click("[data-testid=share-send]"); page.wait_for_timeout(4000)
    sh = page.evaluate("window.__shared") or {}
    text = base64.b64decode(sh.get("b64", "")).decode("utf-8") if sh.get("b64") else ""
    check(sh.get("name") == "attune-money.attune" and "Carrefour" not in text and len(text) > 100, "Send the update → one locked file to send through any app (nothing readable inside)")
    errs1 = real_errors(errors); ctx.close()
    # phone 2 — Mariam joins with the code and the file
    open("/tmp/attune-money.attune", "w").write(text)
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=init(MARIAM))
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_timeout(1200)
    money_more_share(page)
    page.click("[data-testid=share-join]"); page.fill("[data-testid=share-me]", "Mariam"); page.fill("[data-testid=share-code]", "wrong-code")
    page.set_input_files("[data-testid=share-file]", "/tmp/attune-money.attune"); page.wait_for_timeout(4000)
    L = json.loads(page.evaluate("localStorage.getItem('ledger.v3')"))
    check(len(L["accounts"]) == 1 and page.locator("[data-testid=share-on]").count() == 0, "a wrong family code → nothing is changed")
    page.fill("[data-testid=share-code]", "OurFamily26")
    page.set_input_files("[data-testid=share-file]", "/tmp/attune-money.attune"); page.wait_for_selector("[data-testid=share-on]", timeout=10000); page.wait_for_timeout(800)
    L = json.loads(page.evaluate("localStorage.getItem('ledger.v3')"))
    accs = sorted(a["id"] for a in L["accounts"]); t1 = [t for t in L["txns"] if t["id"] == "t1"]
    check(accs == ["house", "mcard"] and len(t1) == 1 and t1[0].get("by") == "Ali" and not any(t["id"] == "t2" for t in L["txns"]), "the right code → the House account and its entry arrive, “by Ali”; Ali's own card and fuel don't: %s" % accs)
    page.set_input_files("[data-testid=share-file]", "/tmp/attune-money.attune"); page.wait_for_timeout(3000)
    L2 = json.loads(page.evaluate("localStorage.getItem('ledger.v3')"))
    check(len(L2["txns"]) == len(L["txns"]), "opening the same update twice adds nothing twice")
    errs = errs1 + real_errors(errors)
    check(not errs, "no page errors: %s" % errs[:3])
env.close()
finish()
