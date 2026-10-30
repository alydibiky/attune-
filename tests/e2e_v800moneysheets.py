"""v8.0 — Money is Attune's own everywhere (Ali, 25 Oct 2026: "Money redirects me to the old app — I don't want that at all"):
accounts, bills, goals, debts, Zakāt payments and entries are added / changed / deleted in Attune's own sheets, and each change
reaches the ledger (ledger.v3) through Yusr's own forms underneath — the old screen is never shown.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v800moneysheets.py
"""
import json, os, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
T = datetime.date.today(); m1 = T.replace(day=1)
d = lambda n: (T - datetime.timedelta(days=n)).isoformat()
inm = lambda n: max(m1, T - datetime.timedelta(days=n)).isoformat()
L = {"currency": "EGP", "accounts": [{"id": "c", "name": "Cash", "emoji": "💵", "currency": "EGP", "start": 4000}, {"id": "b", "name": "CIB", "emoji": "🏦", "currency": "EGP", "start": 6000},
                                     {"id": "g", "name": "Gold", "emoji": "🪙", "kind": "gold", "karat": 21, "start": 25}],
     "txns": [{"id": "t1", "type": "income", "amount": 18000, "cat": "salary", "account": "b", "date": inm(5), "note": "October salary"},
              {"id": "t2", "type": "expense", "amount": 520, "cat": "bills", "account": "b", "date": inm(3), "note": "WE Home Fiber"},
              {"id": "t3", "type": "expense", "amount": 640, "cat": "groceries", "account": "b", "date": inm(1), "note": "Seoudi Market"},
              {"id": "t4", "type": "expense", "amount": 85, "cat": "food", "account": "c", "date": inm(0), "note": "Koshari Abou Tarek"},
              {"id": "t6", "type": "expense", "amount": 980, "cat": "bills", "account": "b", "date": (m1 - datetime.timedelta(days=12)).isoformat(), "note": "Electricity ↻", "recurring": True},
              {"id": "t7", "type": "income", "amount": 16000, "cat": "salary", "account": "b", "date": (m1 - datetime.timedelta(days=10)).isoformat(), "note": ""}],
     "budgets": {"overall": 6450, "cats": {}},
     "recurring": [{"id": "r1", "type": "expense", "amount": 980, "cat": "bills", "account": "b", "freq": "monthly", "nextDate": (T + datetime.timedelta(days=3)).isoformat(), "note": "Electricity", "active": True},
                   {"id": "r2", "type": "expense", "amount": 520, "cat": "bills", "account": "b", "freq": "monthly", "nextDate": (T - datetime.timedelta(days=2)).isoformat(), "note": "WE Home Fiber", "active": True},
                   {"id": "r3", "type": "expense", "amount": 6000, "cat": "rent", "account": "b", "freq": "monthly", "nextDate": (m1 + datetime.timedelta(days=40)).replace(day=1).isoformat(), "note": "Rent", "active": True}],
     "debts": [], "customCats": [], "goals": [], "projects": [], "notes": [], "zakatHistory": [],
     "zakatPayments": [{"id": "z1", "amount": 2500, "date": d(200), "to": "Masr El Kheir", "cat": "poor", "account": "b"}, {"id": "z2", "amount": 1200, "date": d(30), "to": "Uncle Hassan", "cat": "poor", "account": "c"}]}
INIT = "try{localStorage.setItem('ledger.v3', %s);localStorage.setItem('attune:country','eg')}catch(e){}" % json.dumps(json.dumps(L))
LIGHT = ";try{localStorage.setItem('attune:theme:v1', JSON.stringify({accent:'teal',bg:'light'}))}catch(e){}"
AR = ";try{localStorage.setItem('attune:ui:lang','ar')}catch(e){}"
def shot(page, name, full=False):
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, name + ".png"), full_page=full)
def open_money(page):
    page.wait_for_timeout(1200)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'money'}}))")
    page.wait_for_selector("[data-testid=money-bar]", timeout=10000); page.wait_for_timeout(1500)
def ledger(page): return json.loads(page.evaluate("localStorage.getItem('ledger.v3')"))
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.on("dialog", lambda d: d.accept())
    page.goto(env.url); open_money(page)
    def wait_ledger(pred, ms=6000):
        for _ in range(ms // 200):
            try:
                if pred(ledger(page)): return True
            except Exception: pass
            page.wait_for_timeout(200)
        return False
    hidden = lambda: page.locator("[data-testid=money-yusr]").is_hidden()
    # accounts: add, edit, delete — Attune's sheet, Yusr's own save underneath
    page.click("[data-testid=money-bar-accounts]"); page.wait_for_selector("[data-testid=money-accounts]")
    page.click("[data-testid=money-accounts-add]"); page.wait_for_selector("[data-testid=money-account-sheet]")
    check(hidden(), "Add account: Attune's own sheet, the old ledger stays hidden")
    page.fill("[data-testid=acc-name]", "Vodafone Cash"); page.fill("[data-testid=acc-start]", "750"); page.click("[data-testid=sheet-save]")
    check(wait_ledger(lambda l: any(a["name"] == "Vodafone Cash" and float(a.get("start", 0)) == 750 for a in l["accounts"])), "…the new account is in the ledger")
    page.wait_for_timeout(500)
    check(page.locator("[data-testid=money-account-sheet]").count() == 0 and "Vodafone Cash" in page.locator("[data-testid=money-accounts]").inner_text(), "…the sheet closes and the account shows")
    page.locator("[data-testid=acc-row]", has_text="Vodafone Cash").click(); page.wait_for_selector("[data-testid=money-account-sheet]")
    page.fill("[data-testid=acc-name]", "Vodafone Wallet"); page.click("[data-testid=sheet-save]")
    check(wait_ledger(lambda l: any(a["name"] == "Vodafone Wallet" for a in l["accounts"]) and not any(a["name"] == "Vodafone Cash" for a in l["accounts"])), "Edit account: renamed in the ledger")
    page.wait_for_timeout(400)
    page.locator("[data-testid=acc-row]", has_text="Vodafone Wallet").click(); page.wait_for_selector("[data-testid=money-account-sheet]")
    page.click("[data-testid=sheet-delete]")
    check(wait_ledger(lambda l: not any(a["name"] == "Vodafone Wallet" for a in l["accounts"])), "Delete account: gone from the ledger")
    page.wait_for_timeout(400)
    # bills: edit the amount of one
    page.click("[data-testid=money-bar-bills]"); page.wait_for_selector("[data-testid=money-bills]")
    page.locator("[data-testid=bill-row]", has_text="Electricity").first.click(); page.wait_for_selector("[data-testid=money-bill-sheet]")
    page.fill("[data-testid=bill-amount]", "1100"); page.click("[data-testid=sheet-save]")
    check(wait_ledger(lambda l: any(r.get("note") == "Electricity" and float(r["amount"]) == 1100 for r in l["recurring"])), "Edit bill: the new amount is in the ledger")
    page.wait_for_timeout(400)
    # goals and debts
    page.click("[data-testid=money-bar-goals]"); page.wait_for_selector("[data-testid=money-goals]")
    page.click("[data-testid=money-goals-add]"); page.wait_for_selector("[data-testid=money-goal-sheet]")
    page.fill("[data-testid=goal-name]", "Umrah"); page.fill("[data-testid=goal-target]", "120000"); page.click("[data-testid=sheet-save]")
    check(wait_ledger(lambda l: any(g["name"] == "Umrah" and float(g["target"]) == 120000 for g in l["goals"])), "New goal: in the ledger")
    page.wait_for_timeout(400)
    page.click("[data-testid=goal-add-money]"); page.wait_for_selector("[data-testid=amount-input]")
    page.fill("[data-testid=amount-input]", "5000"); page.click("[data-testid=sheet-save]")
    check(wait_ledger(lambda l: any(g["name"] == "Umrah" and float(g.get("saved", 0)) == 5000 for g in l["goals"])), "Add to the goal: 5,000 saved")
    page.wait_for_timeout(400)
    page.click("[data-testid=money-debt-add]"); page.wait_for_selector("[data-testid=money-debt-sheet]")
    page.fill("[data-testid=debt-person]", "Karim"); page.fill("[data-testid=debt-amount]", "2000"); page.click("[data-testid=sheet-save]")
    check(wait_ledger(lambda l: any(x["person"] == "Karim" and float(x["amount"]) == 2000 for x in l["debts"])), "Lend / borrow: the debt is in the ledger")
    page.wait_for_timeout(400)
    page.click("[data-testid=debt-pay]"); page.wait_for_selector("[data-testid=money-debtpay-sheet]")
    page.fill("[data-testid=debtpay-amount]", "500"); page.click("[data-testid=sheet-save]")
    check(wait_ledger(lambda l: any(x["person"] == "Karim" and sum(float(p["amount"]) for p in x.get("payments", [])) == 500 for x in l["debts"])), "Got paid / I paid: 500 recorded on the debt")
    page.wait_for_timeout(400)
    # Zakāt: record a payment (what is due stays Yusr's)
    page.click("[data-testid=money-bar-zakat]"); page.wait_for_selector("[data-testid=money-zakat]")
    page.click("[data-testid=zakat-pay]"); page.wait_for_selector("[data-testid=money-zakatpay-sheet]")
    check(hidden(), "Record a Zakāt payment: Attune's own sheet")
    page.fill("[data-testid=zpay-amount]", "800"); page.fill("[data-testid=zpay-to]", "Neighbour"); page.click("[data-testid=sheet-save]")
    check(wait_ledger(lambda l: any(float(z["amount"]) == 800 for z in l["zakatPayments"])), "…the payment is in the ledger")
    page.wait_for_timeout(400)
    # v8.7 (Ali: "some zakat settings were removed, like worn jewelry — and the other calculators; restore them all")
    page.click("[data-testid=zakat-open]"); page.wait_for_selector("[data-testid=money-zakatset-sheet]")
    check(all(page.locator("[data-testid=%s]" % t).count() == 1 for t in ["zset-country", "zset-jew", "zset-goldg", "zset-silver", "zset-anniv", "zset-recv", "zset-debt", "zset-fetch"]), "the full Zakāt settings are back: country + live price, worn jewellery, gold & silver, the year's start, receivables, debts")
    page.fill("[data-testid=zset-gold]", "4000"); page.click("[data-testid=zset-jew]"); page.fill("[data-testid=zset-jewg]", "50"); page.fill("[data-testid=zset-anniv]", "2026-03-01")
    page.select_option("[data-testid=zset-debt]", "none"); page.click("[data-testid=sheet-save]")
    check(wait_ledger(lambda l: l["zakat"].get("jewelryZakat") is True and float(l["zakat"].get("jewelryGrams", 0)) == 50 and l["zakat"].get("anniversary") == "2026-03-01" and l["zakat"].get("debtPolicy") == "none" and float(l["zakat"]["goldPrice"]) == 4000),
          "…saved into the ledger's own Zakāt settings: worn jewellery 50 g, the year from 1 March, debts not deducted")
    page.wait_for_timeout(400)
    check(page.locator("[data-testid=zakat-gold]").count() == 1, "Zakāt shows today's gold price")
    page.wait_for_selector("[data-testid=zakat-part-2]", timeout=8000)
    jw = page.inner_text("[data-testid=zakat-part-2]")
    check("50 g" in jw and "Not counted" not in jw, "the Zakāt page shows the worn jewellery it counts (50 g): " + jw.replace("\n", " "))
    page.click("[data-testid=zakat-calc-sheep]"); page.wait_for_selector("[data-testid=money-zakatcalc-sheet]")
    page.fill("[data-testid=zcalc-head]", "130"); page.wait_for_timeout(150)
    check("2 ×" in page.inner_text("[data-testid=zcalc-result]"), "the calculators are back: 130 sheep → 2 sheep due: %s" % page.inner_text("[data-testid=zcalc-result]").replace("\n", " "))
    # v8.8 (Ali: "the Zakāt rulings for everything, like in the old app"): conditions + the ruling's evidence, no technical line
    check("free-grazing" in page.inner_text("[data-testid=zcalc-note]") and "«فِي أَرْبَعِينَ شَاةً شَاةٌ" in page.inner_text("[data-testid=zakat-evidence-sheep]") and "Bukhārī" in page.inner_text("[data-testid=zakat-evidence-sheep]"),
          "the sheep calculator: its conditions, the hadith and its source")
    check("engine" not in page.inner_text("[data-testid=money-zakatcalc-sheet]"), "no technical line about the engine")
    page.click("[data-testid=sheet-close]"); page.wait_for_timeout(300)
    page.click("[data-testid=zakat-calc-rikaz]"); page.wait_for_selector("[data-testid=money-zakatcalc-sheet]")
    check(page.locator("[data-testid=zcalc-empty]").count() == 1 and "niṣāb" not in page.inner_text("[data-testid=zcalc-result]"), "rikāz with an empty box: “type the numbers”, not “below the niṣāb” (it has none)")
    page.fill("[data-testid=zcalc-value]", "10000"); page.wait_for_timeout(150)
    check("2,000" in page.inner_text("[data-testid=zcalc-result]"), "rikāz 10,000 → 2,000 (a fifth)")
    page.click("[data-testid=sheet-close]"); page.wait_for_timeout(300)
    page.click("[data-testid=zakat-rulings-open]"); page.wait_for_selector("[data-testid=money-zakatrules-sheet]")
    check(page.locator("[data-testid^=zakat-evidence-]").count() == 14, "Rulings & sources: all 14 rulings with their evidence")
    page.click("[data-testid=sheet-close]"); page.wait_for_timeout(300)
    # a transaction: open it from the full ledger, change the amount, then delete it
    page.click("[data-testid=money-more]"); page.click("[data-testid=money-open-ledger]"); page.wait_for_selector("[data-testid=money-list]")
    page.fill("[data-testid=money-list-search]", "Koshari"); page.wait_for_timeout(300)
    page.locator("[data-testid=money-list-row]").first.click(); page.wait_for_selector("[data-testid=money-tx-sheet]")
    page.fill("[data-testid=tx-amount]", "95"); page.click("[data-testid=sheet-save]")
    check(wait_ledger(lambda l: any(t["id"] == "t4" and float(t["amount"]) == 95 for t in l["txns"])), "Edit an entry: 85 → 95 in the ledger")
    page.wait_for_timeout(400)
    page.locator("[data-testid=money-list-row]").first.click(); page.wait_for_selector("[data-testid=money-tx-sheet]")
    page.click("[data-testid=tx-delete]")
    check(wait_ledger(lambda l: not any(t["id"] == "t4" for t in l["txns"])), "Delete an entry: gone from the ledger")
    check(hidden(), "the old ledger was never shown")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
finish()
