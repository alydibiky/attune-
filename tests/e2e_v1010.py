"""v10.1 — Ali's picks of 16 Nov 2026, on the real pages:
T1  Follow-ups → Things I own; the TV's price opens ITS payment in Money; a new receipt not in Money is added (Undo takes it out).
P1  a project's date is on Follow-ups ("Project · Umrah"); a tap opens THAT project.
P2  the project's money: budget, spent from Money, its payments; P3 its people, and the person's page lists the project.
W2  on the phone: no "Ask about this work", no Files row, "Files and questions about them: on your computer"; on a computer: the ask box.
P4  a shared message → "Add to a project" → it is in the project, and its date reaches Follow-ups.
F1  side menu: "warranty" → Things I own (Follow-ups → Things I own) → opens it.   F3  Home box: "where is the split thing?" → the place + Open.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v1010.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
NOW = datetime.datetime.now().replace(hour=14, minute=0, second=0, microsecond=0)
now = int(NOW.timestamp() * 1000)
d = lambda days: (NOW + datetime.timedelta(days=days)).strftime("%Y-%m-%d")
dmy = lambda days: (NOW + datetime.timedelta(days=days)).strftime("%d/%m/%Y")
LEDGER = {"currency": "EGP", "accounts": [{"id": "a", "currency": "EGP", "name": "Cash"}], "txns": [
  {"id": "tv1", "date": d(-200), "type": "expense", "amount": 24999, "note": "B.TECH", "cat": "shopping", "account": "a"},
  {"id": "um1", "date": d(-3), "type": "expense", "amount": 6000, "note": "hotel deposit for the Umrah", "cat": "other", "account": "a"},
  {"id": "um2", "date": d(-2), "type": "expense", "amount": 12400, "note": "Umrah flights x2", "cat": "other", "account": "a"}]}
THINGS = {"v": 1, "items": [{"id": "t1", "name": "Samsung TV 55", "store": "B.TECH", "price": 24999, "date": d(-200), "warrantyMonths": 24, "until": d(530)}]}
PROJ = [{"id": "pu", "emoji": "✈", "name": "Umrah · December", "instructions": "", "knowledge": [{"id": "k1", "name": "visa", "text": "Visa appointment on " + dmy(3) + " at 10:30."}], "due": "", "assistantId": "",
         "repeats": [], "tasks": [{"id": "x1", "text": "Book the hotel", "col": "todo", "ts": now}], "budget": 60000, "moneyWords": [], "created": now - 10 * 864e5, "updated": now}]
CHATS = [{"id": "c1", "title": "Umrah plan", "projectId": "pu", "updated": now - 3600e3, "messages": [{"id": "m1", "role": "user", "text": "Hany will book the hotel for us."}]}]
PEOPLE = {"items": [{"id": "h1", "name": "Hany", "role": "travel agent", "aliases": [], "created": now}], "skip": []}
SEED = {"ledger.v3": LEDGER, "attune:things:v1": THINGS, "attune:projects:v1": PROJ, "attune:chats:v1": CHATS, "attune:people:v1": PEOPLE}
INIT = ("try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:coach:v1',JSON.stringify({seen:['*']}));localStorage.setItem('attune:people:seeded','1');"
        "if(!localStorage.getItem('t:seed')){localStorage.setItem('t:seed','1');" + "".join("localStorage.setItem(%s,%s);" % (json.dumps(k), json.dumps(json.dumps(v))) for k, v in SEED.items()) + "}}catch(e){}")
def open_mode(page, m, sel):
    page.evaluate("(m) => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", m); page.wait_for_selector(sel, timeout=8000)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    ctx.clock.set_fixed_time(NOW)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_timeout(1500)
    # ---- T1
    open_mode(page, "timeline", "[data-testid=fu-things]")
    check("Things I own · 1" in page.inner_text("[data-testid=fu-things-toggle] >> visible=true"), "Follow-ups has “Things I own · 1”")
    page.click("[data-testid=fu-things-toggle] >> visible=true"); page.wait_for_selector("[data-testid=thing-row] >> visible=true", timeout=3000)
    check("24,999 · in Money" in page.inner_text("[data-testid=thing-money] >> visible=true"), "the TV's price is its payment in Money: " + page.inner_text("[data-testid=thing-money] >> visible=true"))
    page.click("[data-testid=thing-money] >> visible=true"); page.wait_for_selector("[data-testid=money-tx-sheet] >> visible=true", timeout=5000)
    check(page.locator("[data-testid=tx-amount]").input_value().replace(",", "") in ("24999", "24999.00"), "…a tap opens THAT payment in Money")
    page.keyboard.press("Escape"); page.wait_for_timeout(200)
    # ---- P1: the project's date on Follow-ups → the project
    open_mode(page, "timeline", "[data-testid=timeline-page]")
    page.click("[data-testid=fu-coming-toggle] >> visible=true"); page.wait_for_timeout(200)
    row = page.locator("[data-testid=timeline-item][data-kind=project]")
    check(row.count() >= 1 and "Visa appointment" in row.first.inner_text() and "Project · Umrah" in row.first.inner_text(), "P1: the visa date is on Follow-ups as “Project · Umrah · December”")
    row.first.locator("button").click(); page.wait_for_selector("[data-testid=project-page] >> visible=true", timeout=5000)
    check("Umrah" in page.inner_text("[data-testid=project-page] >> visible=true"), "…a tap opens THAT project")
    # ---- P2 P3 W2 on the phone
    pg = page.inner_text("[data-testid=project-page] >> visible=true")
    check(page.locator("[data-testid=project-dates]").count() == 1 and "Visa appointment" in page.inner_text("[data-testid=project-dates] >> visible=true"), "P1 on the project: Coming up")
    check("Spent 18,400 of 60,000" in page.inner_text("[data-testid=project-spent] >> visible=true") and page.locator("[data-testid=project-pay]").count() == 2, "P2: Spent 18,400 of 60,000 — the two Umrah payments from Money")
    check(page.locator("[data-testid=project-person]").count() == 1 and "Hany" in page.inner_text("[data-testid=project-people] >> visible=true"), "P3: Hany (named in the project's chat) is linked")
    check(page.locator("[data-testid=project-ask]").count() == 0 and page.locator("[data-testid=project-row-files]").count() == 0 and page.locator("[data-testid=project-on-computer]").count() == 1, "W2: on the phone no ask box, no Files — “Files and questions about them: on your computer.”")
    page.click("[data-testid=project-budget-edit] >> visible=true"); page.fill("[data-testid=project-budget-input] >> visible=true", "70000"); page.click("[data-testid=project-budget-save] >> visible=true"); page.wait_for_timeout(300)
    check("Spent 18,400 of 70,000" in page.inner_text("[data-testid=project-spent] >> visible=true"), "P2: the budget can be changed")
    page.click("[data-testid=project-person] >> visible=true"); page.wait_for_selector("[data-testid=person-projects] >> visible=true", timeout=5000)
    check("Umrah" in page.inner_text("[data-testid=person-projects] >> visible=true"), "P3: Hany's page says “In projects: Umrah · December”")
    # ---- P4: a shared message → the project
    page.evaluate("window.dispatchEvent(new MessageEvent('attune-share', {data: {kind: 'share', text: 'Hany: the hotel check-in is on %s, room 1204'}}))" % dmy(5)); page.wait_for_selector("[data-testid=share-to-project] >> visible=true", timeout=5000)
    page.click("[data-testid=share-project] >> visible=true"); page.wait_for_timeout(400)
    pr = page.evaluate("JSON.parse(localStorage.getItem('attune:projects:v1'))[0]")
    check(any("room 1204" in k["text"] for k in pr["knowledge"]), "P4: the shared message is in the project")
    open_mode(page, "timeline", "[data-testid=timeline-page]")
    if page.locator("[data-testid=fu-coming-all]").count() == 0: page.click("[data-testid=fu-coming-toggle] >> visible=true"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=timeline-item][data-kind=project]", has_text="check-in").count() == 1, "…and its date reaches Follow-ups")
    # ---- F1: the side menu
    page.click("[data-testid=fu-things-toggle] >> visible=true") if page.locator("[data-testid=thing-row]").count() else None
    page.evaluate("localStorage.setItem('attune:fu:things','0')")
    open_mode(page, "home", "[data-testid=home-menu]"); page.click("[data-testid=home-menu] >> visible=true"); page.wait_for_selector("[data-testid=side-search] >> visible=true", timeout=4000)
    page.fill("[data-testid=side-search] >> visible=true", "warranty"); page.wait_for_timeout(200)
    hits = page.locator("[data-testid=side-feature]")
    check(hits.count() >= 1 and hits.first.get_attribute("data-id") == "things" and "Follow-ups → Things I own" in hits.first.inner_text(), "F1: “warranty” → Things I own · Follow-ups → Things I own")
    hits.first.click(); page.wait_for_selector("[data-testid=thing-row] >> visible=true", timeout=5000)
    check(page.locator("[data-testid=thing-row]").count() == 1, "…a tap opens Follow-ups with Things I own open")
    # ---- F3: the Home box
    open_mode(page, "home", "[data-testid=home-ask]")
    page.fill("[data-testid=home-ask] >> visible=true", "where is the split thing?"); page.click("[data-testid=home-send] >> visible=true"); page.wait_for_timeout(900)
    body = page.inner_text("body >> visible=true")
    check("Split with anyone is in Money → More" in body, "F3: “where is the split thing?” → “Split with anyone is in Money → More”")
    page.locator("button", has_text="Open Split with anyone").last.click(); page.wait_for_timeout(600)
    check(page.locator("[data-testid=groups-page]").count() == 1, "…Open goes to the Split page")
    check(page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), "nothing wider than the phone")
    ctx.close()
    # ---- W2 on a computer: the ask box is there
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + "try{localStorage.setItem('attune:projects:open','pu')}catch(e){}")
    page.set_viewport_size({"width": 1280, "height": 900}); page.goto(env.url); page.wait_for_timeout(1500)
    open_mode(page, "projects", "[data-testid=project-page]")
    check(page.locator("[data-testid=project-ask]").count() == 1 and page.locator("[data-testid=project-row-files]").count() == 1, "W2: on a computer the project keeps “Ask about this work” and Files")
    errs = real_errors(errors); check(not errs, "no JavaScript errors: %s" % errs[:2])
    br.close()
env.close(); finish()
