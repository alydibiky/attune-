"""v9.2 — Ali's 4 Nov list (phone screenshots), the objective fixes:
  · Zakāt is complete, like the old ledger's tab: the one question about debts, livestock with its own ḥawl (never counted as
    money), paid vs due, "Close this Zakāt year" → Closed years → the certificate, the disclaimer; each pool on its own.
  · Home has no Fit & Food card (Fit is archived → Attune Fit).
  · Writing has no Copilot / Prompt lab tabs (archived pages — tapping them landed on Home).
  · Notes is called Shelf again; the Library is not a second card in Tools.
  · An agent whose offers were read before hotel names / photos says so (tap Check now).
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v922fixes.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
T = datetime.date.today()
d = lambda n: (T - datetime.timedelta(days=n)).isoformat()
L = {"currency": "EGP", "lang": "en",
     "accounts": [{"id": "b", "name": "CIB", "emoji": "🏦", "currency": "EGP", "start": 500000},
                  {"id": "s", "name": "Farm sheep", "kind": "sheep", "start": 45}],
     "txns": [{"id": "t1", "type": "income", "amount": 2, "cat": "other", "account": "s", "date": d(400)}],
     "budgets": {"overall": 0, "cats": {}}, "recurring": [], "customCats": [], "goals": [], "projects": [], "notes": [],
     "debts": [{"id": "d1", "type": "i_owe", "person": "Uncle Hassan", "amount": 20000, "payments": [], "date": d(50)}],
     "zakat": {"goldPrice": 4000, "madhhab": "jumhur", "nisabBasis": "gold", "mode": "combined", "anniversary": d(400)},
     "zakatHistory": [], "zakatPayments": [{"id": "z1", "amount": 2500, "date": d(20), "to": "Masr El Kheir", "cat": "fuqara", "account": "b"}]}
INIT = "try{localStorage.setItem('ledger.v3', %s);localStorage.setItem('attune:country','eg')}catch(e){}" % json.dumps(json.dumps(L))
AG = [{"id": "h1", "kind": "watch", "on": True, "title": "Hotels · Masjid al-Haram · 4 nights", "site": "Booking.com", "url": "https://www.booking.com/searchresults.html",
       "below": 50000, "currency": "EGP", "checks": [], "best3": [{"key": "a", "name": "Booking.com", "price": 41495, "currency": "EGP", "checkin": "2027-01-08", "checkout": "2027-01-12"},
                                                                 {"key": "b", "name": "Booking.com", "price": 42124, "currency": "EGP", "checkin": "2027-01-04", "checkout": "2027-01-08"}]}]
INIT_AG = "try{localStorage.setItem('attune:agents:v1', %s)}catch(e){}" % json.dumps(json.dumps({"agents": AG, "usual": {}}))
def go(page, m): page.evaluate("(m) => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", m); page.wait_for_timeout(700)
def txt(page, sel): return page.inner_text(sel).replace('\u2066', '').replace('\u2069', '')
def ledger(page): return json.loads(page.evaluate("localStorage.getItem('ledger.v3')"))
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + ";" + INIT_AG)
    page.on("dialog", lambda dl: dl.accept())
    page.goto(env.url); page.wait_for_timeout(1200)
    def wait_ledger(pred, ms=6000):
        for _ in range(ms // 200):
            try:
                if pred(ledger(page)): return True
            except Exception: pass
            page.wait_for_timeout(200)
        return False
    # ---- Zakāt
    go(page, "money"); page.wait_for_selector("[data-testid=money-bar]", timeout=10000); page.wait_for_timeout(1500)
    page.click("[data-testid=money-bar-zakat]"); page.wait_for_selector("[data-testid=money-zakat]")
    page.wait_for_selector("[data-testid=zakat-debt-q]", timeout=8000)
    q = page.inner_text("[data-testid=zakat-debt-q]")
    check("20,000" in q and page.locator("[data-testid^=zakat-debt-]").count() >= 4, "the one question about debts, with the amount and the 3 choices: " + q[:120].replace("\n", " · "))
    page.click("[data-testid=zakat-debt-none]")
    check(wait_ledger(lambda l: l["zakat"].get("debtPolicy") == "none"), "…the choice reaches the ledger")
    page.wait_for_timeout(800)
    check(page.locator("[data-testid=zakat-debt-q]").count() == 0, "…and the question is gone")
    live = txt(page, "[data-testid=zakat-livestock]")
    check("Farm sheep" in live and "47 head" in live and ("Due now" in live or "due" in live), "Livestock Zakāt: the herd, its head and its own ḥawl: " + live.replace("\n", " · "))
    check("1 × a sheep or goat" in live, "…40–120 sheep → one sheep is due (the ledger's own table)")
    base = txt(page, "[data-testid=zakat-status]")
    check("Most scholars" in base and "jumhur" not in base, "the school is named, not its code word (jumhur)")
    check("500,000" in base and "500,047" not in base, "the sheep are not counted as money in the zakatable wealth: " + base.replace("\n", " · ")[:160])
    dist = txt(page, "[data-testid=zakat-distribution]")
    check("2,500" in dist and "Still to pay" in dist, "Paid vs due: paid so far and what is still to pay: " + dist.replace("\n", " · ")[:160])
    check("trusted scholar" in page.inner_text("[data-testid=zakat-disclaimer]"), "the disclaimer under the page")
    check("No closed year yet" in page.inner_text("[data-testid=zakat-history]"), "Closed years: none yet")
    page.click("[data-testid=zakat-close-year]")
    check(wait_ledger(lambda l: len(l.get("zakatHistory") or []) == 1 and not l.get("zakatPayments")), "Close this Zakāt year → one closed year in the ledger, its payments moved into it")
    page.wait_for_selector("[data-testid=zakat-history-row]", timeout=6000)
    check("2,500" in page.inner_text("[data-testid=zakat-history-row]"), "…shown under Closed years with what was paid")
    with page.expect_popup(timeout=8000) as pop:
        page.click("[data-testid=zakat-cert]")
    cert = pop.value; cert.wait_for_timeout(500)
    ct = cert.content()
    check("2,500" in ct and "Masr El Kheir" in ct and "bism" in ct, "the certificate (as the old app printed it): the amount, the recipient")
    cert.close()
    # each pool on its own (the Shafiʿi way)
    L2 = json.loads(json.dumps(L)); L2["zakat"]["mode"] = "separate"
    ctx2, p2 = new_page(br, env, errors, legacy_nav=False, extra_init="try{localStorage.setItem('ledger.v3', %s)}catch(e){}" % json.dumps(json.dumps(L2)))
    p2.goto(env.url); p2.wait_for_timeout(1200); go(p2, "money"); p2.wait_for_selector("[data-testid=money-bar]", timeout=10000); p2.wait_for_timeout(1500)
    p2.click("[data-testid=money-bar-zakat]"); p2.wait_for_selector("[data-testid=zakat-pools]", timeout=8000)
    pc = txt(p2, "[data-testid=zakat-pool-cash]")
    check("Due now" in pc and "12,500" in pc, "Each on its own (the Shafiʿi way): the cash pool with its own status: " + pc.replace("\n", " · "))
    ctx2.close()
    # ---- Home: no Fit & Food
    go(page, "home"); page.wait_for_timeout(600)
    check(page.locator("[data-testid=home-hero-fit]").count() == 0 and "Snap your lunch" not in page.inner_text("body"), "Home has no Fit & Food card")
    # ---- Writing: no archived tabs; nothing on it lands on Home
    go(page, "write")
    tabs = page.evaluate("[...document.querySelectorAll('button')].filter(b => b.offsetParent).map(b => b.innerText.trim())")
    check("Copilot" not in tabs and "Prompt lab" not in tabs, "Writing: no Copilot / Prompt lab tabs (they opened nothing and landed on Home)")
    # ---- Shelf, Tools
    go(page, "shelf")
    check(page.locator("[role=tab]:has-text('Shelf'), button:has-text('Shelf')").count() >= 1 and page.locator("button:text-is('Notes')").count() == 0, "Notes is called Shelf again")
    go(page, "tools")
    check(page.locator("[data-testid=tools-page-booklib]").count() == 0 and page.locator("[data-testid=tools-page-pdfchat]").count() == 1, "Tools: no second Library card (it has its own place); Ask a PDF stays")
    check("Prompt lab" not in page.inner_text("[data-testid=tools-families]"), "…and the Writing card no longer offers the archived Copilot / Prompt lab")
    # ---- Agents: offers read before hotel names / photos
    go(page, "agents"); page.wait_for_timeout(500)
    check(page.locator("[data-testid=agent-stale]").count() == 1, "an agent with offers read before the hotel names / photos says: tap Check now")
    errs = real_errors(errors)
    check(not errs, "no page errors: %s" % errs[:3])
env.close()
finish()
