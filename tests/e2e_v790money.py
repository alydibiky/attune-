"""v7.6 → v7.9 — Money's bottom bar (Ali, 24 Oct 2026, picked A): Yusr's own tabs Home · Trends · Accounts · Goals · Bills · Zakāt,
drawn in Quiet Atelier; Home is the calm view, every other tab is Yusr's own screen with the bar under it; the + floats; More =
Automations, Invoices (in Business now), the full ledger. The + adds an expense / income / transfer to the ledger with the account the person picked; Lend / borrow
opens the ledger's own form; each page is calm first with "See all → … report". Phone + computer, dark + light, Arabic 360 px.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v790money.py     (SHOTS=dir for screenshots)
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
    for theme in ["dark", "light"]:
        ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + (LIGHT if theme == "light" else ""))
        page.set_viewport_size({"width": 390, "height": 844})
        page.goto(env.url); open_money(page)
        tag = "[phone %s] " % theme
        bar = page.locator("[data-testid=money-bar]").bounding_box()
        check(bar and bar["y"] < 300, tag + "v8.7 (Ali picked P5-A option 2): the parts are tabs at the top, no bottom bar (y %s)" % (bar and round(bar["y"])))
        ids = [page.locator("[data-testid=money-bar] button").nth(i).get_attribute("data-testid") for i in range(page.locator("[data-testid=money-bar] button").count())]
        check(ids == ["money-bar-home", "money-bar-trends", "money-bar-accounts", "money-bar-goals", "money-bar-bills", "money-bar-zakat"], tag + "Yusr's tabs, in its order: %s" % ids)
        check(page.locator("[data-testid=money-add]").is_visible(), tag + "the + floats over the page")
        shot(page, "money-home-phone-" + theme)
        if theme == "dark":
            n0 = len(ledger(page)["txns"])
            page.click("[data-testid=money-add]"); page.wait_for_selector("[data-testid=money-add-sheet]")
            page.click("[data-testid=add-save]")
            check(page.locator("[data-testid=add-err]").count() == 1, tag + "the + sheet asks for the amount first")
            page.fill("[data-testid=add-amount]", "150"); page.click("[data-testid=add-cat-food]")
            page.locator("[data-testid=add-account]").nth(0).click(); page.fill("[data-testid=add-note]", "Lunch with Omar")
            shot(page, "money-add-phone-dark")
            page.click("[data-testid=add-save]"); page.wait_for_timeout(900)
            L2 = ledger(page); t = L2["txns"][-1]
            check(len(L2["txns"]) == n0 + 1 and t["type"] == "expense" and t["amount"] == 150 and t["cat"] == "food" and t["account"] == "c" and t["note"] == "Lunch with Omar", tag + "+ → an expense in the ledger, in the account picked: %s" % {k: t.get(k) for k in ("type", "amount", "cat", "account")})
            page.click("[data-testid=money-add]"); page.click("[data-testid=add-type-transfer]")
            page.fill("[data-testid=add-amount]", "1000"); page.locator("[data-testid=add-account]").nth(1).click(); page.locator("[data-testid=add-to-account]").first.click()
            page.click("[data-testid=add-save]"); page.wait_for_timeout(900)
            t = ledger(page)["txns"][-1]
            check(t["type"] == "transfer" and t["account"] == "b" and t["toAccount"] == "c" and t["amount"] == 1000, tag + "a transfer CIB → Cash")
            page.click("[data-testid=money-add]"); page.click("[data-testid=add-type-income]"); page.fill("[data-testid=add-amount]", "500"); page.locator("[data-testid=add-account]").nth(0).click(); page.click("[data-testid=add-save]"); page.wait_for_timeout(900)
            t = ledger(page)["txns"][-1]
            check(t["type"] == "income" and t["cat"] == "salary" and t["amount"] == 500, tag + "an income")
        # v8.0 (Ali: "no old app at all"): every tab is Attune's own page, the bar under it; Yusr stays hidden
        for pn, tid in [("trends", "money-report"), ("accounts", "money-accounts"), ("goals", "money-goals"), ("bills", "money-bills"), ("zakat", "money-zakat")]:
            page.click("[data-testid=money-bar-%s]" % pn); page.wait_for_timeout(500)
            check(page.locator("[data-testid=%s]" % tid).count() >= 1 and page.locator("[data-testid=money-yusr]").is_hidden() and page.locator("[data-testid=money-bar]").is_visible(),
                  tag + "%s: Attune's own page (never the old ledger), the bar under it" % pn)
            check(page.locator("[data-testid=money-bar-%s]" % pn).get_attribute("aria-current") == "page", tag + "…and its tab is marked")
            if pn in ("accounts", "bills"): shot(page, "money-%s-phone-%s" % (pn, theme))
        page.click("[data-testid=money-bar-home]"); page.wait_for_timeout(300)
        check(page.locator("[data-testid=money-box]").count() == 1 and page.locator("[data-testid=money-yusr]").is_hidden(), tag + "Home is the calm Money view")
        page.click("[data-testid=money-more]"); page.wait_for_selector("[data-testid=money-more-sheet]")
        check(page.locator("[data-testid=money-more-automations]").count() == 1 and page.locator("[data-testid=money-open-ledger]").count() == 1 and page.locator("[data-testid=money-more-goals]").count() == 0, tag + "More: Automations, Invoices, the full ledger, settings")
        page.click("[data-testid=money-open-ledger]"); page.wait_for_timeout(500)
        check(page.locator("[data-testid=money-list]").count() == 1 and page.locator("[data-testid=money-yusr]").is_hidden() and page.locator("[data-testid=money-bar]").is_visible(), tag + "…the full ledger is Attune's own list (search, by month), the bar under it")
        ctx.close()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + AR)
    page.set_viewport_size({"width": 360, "height": 800})
    page.goto(env.url); open_money(page)
    for pn in ["home", "trends", "bills", "zakat"]:
        page.click("[data-testid=money-bar-%s]" % pn); page.wait_for_timeout(500)
        over = page.evaluate("() => [...document.querySelectorAll('[data-testid=money-page] > *')].filter(e => e.offsetParent && (e.getBoundingClientRect().right > window.innerWidth + 1 || e.getBoundingClientRect().left < -1)).map(e => e.textContent.slice(0, 20))")
        check(not over, "[phone ar 360] %s fits, right to left %s" % (pn, over))
        shot(page, "money-%s-phone-ar" % pn)
    page.click("[data-testid=money-add]"); page.wait_for_selector("[data-testid=money-add-sheet]"); shot(page, "money-add-phone-ar")
    ctx.close()
    for theme in ["dark", "light"]:
        ctx, page = new_page(br, env, errors, legacy_nav=False, desktop=(1440, 900), extra_init=INIT + (LIGHT if theme == "light" else ""))
        page.goto(env.url); page.wait_for_selector("[data-testid=side]", timeout=15000); open_money(page)
        tag = "[computer %s] " % theme
        check(page.locator("[data-testid=money-add]").is_visible(), tag + "the bar is a row of pills with + Add")
        shot(page, "money-home-desktop-" + theme)
        page.click("[data-testid=money-bar-bills]"); page.wait_for_timeout(700)
        check(page.locator("[data-testid=money-bills]").count() == 1 and page.locator("[data-testid=money-yusr]").is_hidden() and page.locator("[data-testid=money-bar-bills]").is_visible(), tag + "Bills: Attune's own page, the tabs above it")
        shot(page, "money-bills-desktop-" + theme)
        page.click("[data-testid=money-bar-home]"); page.wait_for_timeout(300)
        page.click("[data-testid=money-add]"); page.wait_for_selector("[data-testid=money-add-sheet]"); shot(page, "money-add-desktop-" + theme)
        ctx.close()
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
