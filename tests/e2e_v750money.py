"""v7.2 — Money in two levels, from Gemini's mock-up "Area 1: Money" (Ali sent it 24 Oct 2026): the calm view opens first (the box,
Safe to spend today, the balance with the accounts as pills, two totals, 3 latest, "See all → Money Report"), the Money Report one
tap away (donut, weeks, six months, Zakāt from Yusr, the month's ledger, Excel / PDF), the ledger (Yusr) one more. Phone + computer,
dark + light, and Arabic (RTL) on the phone. The tabs: Money · Follow-ups · Guardian · Deal Check.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v750money.py     (SHOTS=dir for screenshots)
"""
import json, os, datetime, re
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
T = datetime.date.today(); d = lambda n: (T - datetime.timedelta(days=n)).isoformat()
m1 = T.replace(day=1)
inm = lambda n: max(m1, T - datetime.timedelta(days=n)).isoformat()      # n days ago, but still this month
L = {"currency": "EGP", "accounts": [{"id": "c", "name": "Cash", "emoji": "💵", "currency": "EGP", "start": 4000}, {"id": "b", "name": "CIB", "emoji": "🏦", "currency": "EGP", "start": 6000}],
     "txns": [{"id": "t1", "type": "income", "amount": 18000, "cat": "salary", "account": "b", "date": inm(5), "note": "October salary"},
              {"id": "t2", "type": "expense", "amount": 520, "cat": "bills", "account": "b", "date": inm(3), "note": "WE Home Fiber"},
              {"id": "t3", "type": "expense", "amount": 640, "cat": "groceries", "account": "b", "date": inm(1), "note": "Seoudi Market"},
              {"id": "t4", "type": "expense", "amount": 85, "cat": "food", "account": "c", "date": inm(0), "note": "Koshari Abou Tarek"},
              {"id": "t5", "type": "expense", "amount": 300, "cat": "transport", "account": "c", "date": inm(8), "note": "Uber"},
              {"id": "t6", "type": "expense", "amount": 1200, "cat": "rent", "account": "b", "date": (m1 - datetime.timedelta(days=12)).isoformat(), "note": "Last month"},
              {"id": "t7", "type": "income", "amount": 16000, "cat": "salary", "account": "b", "date": (m1 - datetime.timedelta(days=10)).isoformat(), "note": ""}],
     "budgets": {"overall": 6450, "cats": {}},
     "recurring": [{"id": "r1", "type": "expense", "amount": 400, "cat": "bills", "account": "b", "freq": "monthly", "nextDate": (T + datetime.timedelta(days=3)).isoformat(), "note": "Electricity", "active": True}],
     "debts": [], "customCats": [], "goals": [], "projects": [], "notes": [], "zakatPayments": [], "zakatHistory": []}
LIFE = {"v": 1, "items": [{"id": "a1", "kind": "installment", "person": "Ahmed", "dir": "in", "amount": 1000, "count": 12, "total": 12000, "every": "month",
          "start": (m1 - datetime.timedelta(days=120)).replace(day=25).isoformat(), "currency": "EGP", "paid": [0, 1, 2, 3], "title": ""},
         {"id": "c1", "kind": "circle", "dir": "out", "amount": 2000, "count": 10, "every": "month", "start": (m1 - datetime.timedelta(days=150)).replace(day=1).isoformat(), "currency": "EGP", "paid": [0, 1, 2, 3, 4], "myTurn": 7, "title": "Family savings circle"}]}
BAL = 4000 + 6000 + 18000 + 16000 - 520 - 640 - 85 - 300 - 1200
INIT = "try{localStorage.setItem('ledger.v3', %s);localStorage.setItem('attune:life:v1', %s);localStorage.setItem('attune:country','eg')}catch(e){}" % (json.dumps(json.dumps(L)), json.dumps(json.dumps(LIFE)))
LIGHT = ";try{localStorage.setItem('attune:theme:v1', JSON.stringify({accent:'teal',bg:'light'}))}catch(e){}"
AR = ";try{localStorage.setItem('attune:ui:lang','ar')}catch(e){}"
num = lambda s: int(re.sub(r"[^\d]", "", s.split("EGP")[0].split("ج")[0]) or 0)

def shot(page, name):
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, name + ".png"), full_page=False)

def open_money(page, desktop=False):
    if desktop:
        page.wait_for_selector("[data-testid=side]", timeout=15000); page.wait_for_timeout(300)
        page.locator("[data-testid=side-go-money]").first.click()
        page.wait_for_selector("[data-testid=money-desk] [data-testid=money-calm]", timeout=8000)
    else:
        page.wait_for_timeout(1200)
        page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'money'}}))")
        page.wait_for_selector("[data-testid=money-page] [data-testid=money-calm]", timeout=8000)
    page.wait_for_timeout(1500)   # Yusr connects behind the calm view

with sync_playwright() as p:
    br = p.chromium.launch()
    # ---------------- phone ----------------
    for theme in ["dark", "light"]:
        ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + (LIGHT if theme == "light" else ""))
        page.goto(env.url); open_money(page)
        tag = "[phone %s] " % theme
        check(page.locator("[data-testid=money-page]").get_attribute("data-view") == "calm", tag + "Money opens on the calm view (level 1)")
        check(page.locator("[data-testid=money-yusr]").is_hidden(), tag + "…with the ledger (Yusr) loaded behind it, hidden")
        tabs = [t.get_attribute("data-testid")[8:] for t in page.locator("[data-testid=hub-tabs] [role=tab]").all()]
        check(tabs == ["money", "life", "guardian", "deal"], tag + "tabs Money · Follow-ups · Guardian · Deal Check: %s" % tabs)
        check(page.locator("[data-testid=money-box-input]").is_visible(), tag + "the box comes first")
        b = page.locator("[data-testid=money-balance]").inner_text()
        check(num(b) == BAL, tag + "the balance, by code from the ledger: %s (want %d)" % (b, BAL))
        check(page.locator("[data-testid=money-acc]").count() == 2, tag + "the accounts as pills (Cash · CIB)")
        check(page.locator("[data-testid=money-tx]").count() == 3 and "Koshari" in page.locator("[data-testid=money-recent]").inner_text(), tag + "3 latest, newest first")
        check(page.locator("[data-testid=safe-spend]").count() == 1, tag + "Safe to spend today, as a card")
        out = page.locator("[data-testid=money-kpi-out]").inner_text()
        check("1,545" in out, tag + "spent this month = 520 + 640 + 85 + 300: %s" % out.replace("\n", " · "))
        # the text gate: ink on the card (a light card must not keep dark text, the v7.1 bug)
        bg = page.evaluate("() => getComputedStyle(document.querySelector('[data-testid=money-balance-hero]')).backgroundColor")
        fg = page.evaluate("() => getComputedStyle(document.querySelector('[data-testid=money-balance]')).color")
        check(bg != fg and (("255, 255, 255" in bg) == (theme == "light")), tag + "the balance card follows the theme: %s on %s" % (fg, bg))
        shot(page, "money-calm-phone-" + theme)
        if theme == "dark":
            # write it in the box → into Money
            page.fill("[data-testid=money-box-input]", "lunch 150, taxi 60"); page.click("[data-testid=money-box-go]")
            page.wait_for_selector("[data-testid=money-box-result]", timeout=5000); page.wait_for_timeout(1500)
            res = page.locator("[data-testid=money-box-result]").inner_text().replace("\u2066", "").replace("\u2069", "")
            check("Added 2" in res, tag + "“lunch 150, taxi 60” → 2 entries: %s" % res.replace("\n", " · ")[:90])
            b2 = num(page.locator("[data-testid=money-balance]").inner_text())
            check(b2 == BAL - 210, tag + "…and the balance drops by 210: %d" % b2)
            # ask in the box → answered from the ledger by code
            page.fill("[data-testid=money-box-input]", "how much did I spend on food this month?"); page.click("[data-testid=money-box-go]")
            page.wait_for_timeout(800)
            ans = page.locator("[data-testid=money-box-result]").inner_text()
            check("235" in ans, tag + "a question is answered from the ledger (85 + 150 on food): %s" % ans.replace("\n", " ")[:120])
            # an account pill filters the view
            page.locator("[data-testid=money-acc]").first.click(); page.wait_for_timeout(200)
            cash = num(page.locator("[data-testid=money-balance]").inner_text())
            check(cash == 4000 - 85 - 300 - 210, tag + "the Cash pill shows Cash only: %d" % cash)
            page.click("[data-testid=money-acc-all]"); page.wait_for_timeout(150)
            # level 2
            page.click("[data-testid=money-open-report]"); page.wait_for_selector("[data-testid=money-report]", timeout=4000); page.wait_for_timeout(300)
            check(page.locator("[data-testid=money-donut] circle").count() >= 4, tag + "the Report: where the money went (donut)")
            check(page.locator("[data-testid=money-cashflow] rect").count() == 12, tag + "…six months of money in and out")
            check(page.locator("[data-testid=money-ledger-row]").count() == 7, tag + "…the month's ledger (5 + the 2 just written)")
            check(page.locator("[data-testid=money-export-csv]").count() == 1 and page.locator("[data-testid=money-export-pdf]").count() == 1, tag + "…Excel and PDF")
            shot(page, "money-report-phone-dark")
            page.mouse.wheel(0, 900); page.wait_for_timeout(200); shot(page, "money-report-phone-dark-2")
            page.click("[data-testid=money-report-back]"); page.wait_for_timeout(200)
            check(page.locator("[data-testid=money-page]").get_attribute("data-view") == "calm", tag + "Back returns to the calm view")
            page.click("[data-testid=money-more]"); page.click("[data-testid=money-open-ledger]"); page.wait_for_timeout(600)
            check(page.locator("[data-testid=money-yusr]").is_visible(), tag + "Ledger opens Money itself (Yusr)")
            fr = [f for f in page.frames if f != page.main_frame and "Yusr" in (f.title() or "")]
            n = fr[0].evaluate("db.txns.length") if fr else 0
            check(n == 9, tag + "…which has the 2 entries the box wrote: %s" % n)
            page.click("[data-testid=money-ledger-back]"); page.wait_for_timeout(200)
            check(page.locator("[data-testid=money-page]").get_attribute("data-view") == "calm", tag + "…and back")
            page.click("[data-testid=hub-tab-life]"); page.wait_for_selector("[data-testid=life-page]", timeout=4000)
            check(page.locator("[data-testid=hub-part-life]").count() == 1 and page.locator("[data-testid=hub-part-reminders]").count() == 1, tag + "Follow-ups opens on People & plans, Reminders in its switch")
            check(page.locator("[data-testid=life-progress]").count() == 2 and "4 / 12 paid" in page.locator("[data-testid=life-item]").first.inner_text(), tag + "each plan shows how much is paid (4 / 12)")
            shot(page, "followups-phone-dark")
            page.click("[data-testid=hub-tab-guardian]"); page.wait_for_selector("[data-testid=guardian-page]", timeout=4000)
            check(True, tag + "Guardian is its own tab")
        else:
            page.click("[data-testid=money-open-report]"); page.wait_for_selector("[data-testid=money-report]"); page.wait_for_timeout(300)
            shot(page, "money-report-phone-light")
        ctx.close()
    # ---------------- phone, Arabic (RTL) ----------------
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + AR)
    page.goto(env.url); open_money(page)
    check(page.evaluate("document.documentElement.dir") == "rtl", "[phone ar] right to left")
    w = page.evaluate("() => document.querySelector('[data-testid=money-calm]').scrollWidth <= document.querySelector('[data-testid=money-calm]').clientWidth + 1")
    check(w, "[phone ar] nothing wider than the screen")
    shot(page, "money-calm-phone-ar")
    page.click("[data-testid=money-open-report]"); page.wait_for_selector("[data-testid=money-report]"); page.wait_for_timeout(300)
    shot(page, "money-report-phone-ar")
    ctx.close()
    # ---------------- 360 px ----------------
    ctx = br.new_context(viewport={"width": 360, "height": 800}, device_scale_factor=2, is_mobile=True, has_touch=True)
    ctx.add_init_script(env.mock); ctx.add_init_script("try{localStorage.setItem('attune:onboarded','1');localStorage.setItem('attune:start','chat')}catch(e){}"); ctx.add_init_script(INIT)
    page = ctx.new_page(); page.goto(env.url); open_money(page)
    wide360 = page.evaluate("() => [...document.querySelectorAll('[data-testid=money-calm] *')].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1 && !e.closest('[aria-hidden=true]')).map(e => (e.dataset.testid || e.tagName) + ':' + Math.round(e.getBoundingClientRect().right)).slice(0, 5)")
    check(not wide360, "[phone 360] everything fits a 360-px phone %s" % wide360)
    shot(page, "money-calm-phone-360")
    ctx.close()
    # ---------------- computer ----------------
    for theme in ["dark", "light"]:
        ctx, page = new_page(br, env, errors, desktop=(1440, 900), legacy_nav=False, extra_init=INIT + (LIGHT if theme == "light" else ""))
        page.goto(env.url); open_money(page, desktop=True)
        tag = "[computer %s] " % theme
        wd = page.evaluate("() => document.querySelector('[data-testid=money-calm]').getBoundingClientRect().width")
        check(wd > 900, tag + "a real two-pane desk: %d px" % wd)
        check(page.locator("[data-testid=money-kpi-bills]").count() == 1 and "400" in page.locator("[data-testid=money-kpi-bills]").inner_text(), tag + "4 totals incl. bills in the next 7 days (Electricity 400)")
        check(page.locator("[data-testid=money-kpi-zakat]").count() == 1, tag + "…and Zakāt status (from Yusr's engine)")
        check(num(page.locator("[data-testid=money-balance]").inner_text()) == BAL, tag + "the same balance")
        check(page.locator("[data-testid=money-balance-hero] [data-testid=safe-spend]").count() == 1, tag + "safe to spend sits in the balance card")
        shot(page, "money-calm-desktop-" + theme)
        page.click("[data-testid=money-open-report]"); page.wait_for_selector("[data-testid=money-report]"); page.wait_for_timeout(300)
        check(page.locator("[data-testid=money-rep-bills]").count() == 1 and page.locator("[data-testid=money-cashflow]").count() == 1, tag + "the Report desk: 4 totals, cashflow, donut, Zakāt, ledger")
        shot(page, "money-report-desktop-" + theme)
        page.click("[data-testid=money-report-back]"); page.wait_for_timeout(200)
        page.click("[data-testid=money-more]"); page.click("[data-testid=money-open-ledger]"); page.wait_for_timeout(1200)
        check(page.locator("[data-testid=money-yusr]").is_visible(), tag + "the ledger opens inside Money")
        fr = [f for f in page.frames if f != page.main_frame and "Yusr" in (f.title() or "")]
        check(bool(fr), tag + "…Yusr itself")
        for t in ["life", "guardian", "deal"]:
            page.click("[data-testid=hub-tab-" + t + "]"); page.wait_for_timeout(700); shot(page, t + "-desktop-" + theme)
        ctx.close()
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
