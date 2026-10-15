"""v6.27 — the phone's Home in design A "Calm" (Ali picked it): greeting, ask box, TODAY (what is due — People & plans and
Money's bills), spent this month / food today, the areas, and the bottom bar Home · Chat · Money · Health · Mind · All.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v727home.py     (SHOTS=dir for screenshots)
"""
import json, os, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
T = datetime.date.today()
first = T.replace(day=1).isoformat()
LIFE = {"v": 1, "items": [
  {"id": "a", "kind": "installment", "person": "Ahmed", "dir": "in", "amount": 1000, "count": 12, "total": 12000, "every": "month", "start": first, "currency": "EGP", "paid": [], "title": ""},
  {"id": "b", "kind": "bill", "person": "", "dir": "out", "amount": 640, "count": 1, "total": 640, "every": None, "start": (T + datetime.timedelta(days=2)).isoformat(), "currency": "EGP", "paid": [], "title": "Electricity bill"}]}
LEDGER = {"currency": "EGP", "accounts": [{"id": "c", "name": "Cash", "currency": "EGP", "start": 0}], "budgets": {"overall": 12000, "cats": {}},
  "txns": [{"id": "t", "type": "expense", "amount": 7420, "cat": "groceries", "account": "c", "date": T.isoformat(), "note": "Carrefour"}], "recurring": [], "debts": []}
FIT = {"profile": {"sex": "m", "age": 40, "cm": 178, "kg": 85, "activity": "light", "goal": "lose", "rate": 0.5, "diet": "balanced"},
  "days": {T.isoformat(): {"meals": {"breakfast": [{"name": "Eggs", "kcal": 640}], "lunch": [{"name": "Koshary", "kcal": 600}]}}}}
def init(theme):
    s = "try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:life:v1',%s);localStorage.setItem('ledger.v3',%s);localStorage.setItem('attune:fit:v1',%s)" % (json.dumps(json.dumps(LIFE)), json.dumps(json.dumps(LEDGER)), json.dumps(json.dumps(FIT)))
    if theme == "light": s += ";localStorage.setItem('attune:theme:v1', JSON.stringify({accent:'teal',bg:'light'}))"
    return s + "}catch(e){}"
with sync_playwright() as p:
    br = p.chromium.launch()
    for theme in ["light", "dark"]:
        ctx, page = new_page(br, env, errors, extra_init=init(theme))
        page.set_viewport_size({"width": 390, "height": 844})
        page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000); page.wait_for_timeout(400)
        check(True, "[%s] the phone opens on Home" % theme)
        labels = [b.strip() for b in page.locator("nav button").all_inner_texts()]
        check(labels == ["Home", "Chat", "Money", "Health", "Mind", "All"], "[%s] the bottom bar: %s" % (theme, labels))
        today = page.locator("[data-testid=home-today]").inner_text()
        check("Ahmed · installment 1 of 12" in today and "Electricity bill" in today, "[%s] TODAY lists what is due: %s" % (theme, today.replace("\n", " · ")[:140]))
        check("7,420" in page.locator("[data-testid=home-spent]").inner_text() and "12,000" in page.locator("[data-testid=home-spent]").inner_text(), "[%s] spent this month, of the budget" % theme)
        check("1,240" in page.locator("[data-testid=fit-today-kcal]").inner_text(), "[%s] food today, of the goal (the Fit & Food card, v6.28): %s" % (theme, page.locator("[data-testid=fit-today-kcal]").inner_text().replace("\n", " ")))
        fam = page.evaluate("() => getComputedStyle(document.querySelector('[data-testid=phone-home]')).fontFamily")
        check("Figtree" in fam, "[%s] the Calm font" % theme)
        if SHOTS: page.screenshot(path=os.path.join(SHOTS, "phone-home-%s.png" % theme))
        if theme == "light":
            page.locator("[data-testid=home-due]").first.click(); page.wait_for_selector("[data-testid=life-page]", timeout=5000)
            check(True, "a due line opens People & plans")
            page.locator("nav button:has-text('Home')").click(); page.wait_for_selector("[data-testid=phone-home]", timeout=5000)
            page.locator("[data-testid=home-area-all]").click(); page.wait_for_timeout(300)
            check(page.locator("[data-testid=more-group]").count() >= 4, "the All area opens every tool")
            page.keyboard.press("Escape"); page.mouse.click(200, 100); page.wait_for_timeout(200)
            page.locator("nav button:has-text('Home')").click(); page.wait_for_selector("[data-testid=phone-home]", timeout=5000)
            page.fill("[data-testid=home-ask]", "hello"); page.press("[data-testid=home-ask]", "Enter"); page.wait_for_timeout(500)
            check(page.locator("[data-testid=phone-home]").count() == 0, "the ask box goes to Chat")
        ctx.close()
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
