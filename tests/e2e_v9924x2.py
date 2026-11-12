"""v9.9.24 B6 X2 Upkeep (Ali picked A + a plain Done; combined screen OK'd): Errands → Upkeep lists the car's oil change (9,800 of
10,000 km — due by km before its date) and the home's gas cylinder (learned: about every 35 days, due) first, then the water filter
(every 6 months); Done just marks it (nothing in Money); Done + cost marks it AND puts the cost in Money; adding a home item works.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v9924x2.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
t = datetime.date.today()
def d(k): return (t - datetime.timedelta(days=k)).isoformat()
CAR = {"km": 10000, "log": [{"id": "k1", "kind": "service", "service": "oil", "km": 200, "amount": 1500, "date": d(160)}]}
HOME = {"v": 1, "items": [{"id": "g", "name": "Gas cylinder", "log": [{"date": d(105)}, {"date": d(70)}, {"date": d(35)}]},
                          {"id": "w", "name": "Water filter", "everyMonths": 6, "log": [{"date": d(40)}]}]}
L = {"currency": "EGP", "accounts": [{"id": "a", "name": "Cash", "currency": "EGP", "start": 5000}], "txns": [], "recurring": []}
INIT = "try { localStorage.setItem('attune:car:v1', %s); localStorage.setItem('attune:upkeep:v1', %s); localStorage.setItem('ledger.v3', %s); localStorage.setItem('attune:start','home'); } catch (e) {}" % (
    json.dumps(json.dumps(CAR)), json.dumps(json.dumps(HOME)), json.dumps(json.dumps(L)))
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'errands'}}))"); page.wait_for_selector("[data-testid=upkeep]", timeout=8000)
    ids = page.evaluate("[...document.querySelectorAll('[data-testid=upkeep-line]')].map(e => e.dataset.id + (e.dataset.due ? '!' : ''))")
    check(ids[:2] == ["car:oil!", "g!"] or ids[:2] == ["g!", "car:oil!"], "the due ones first — oil change and gas cylinder: %s" % ids)
    oil = page.locator("[data-testid=upkeep-line][data-id='car:oil'] [data-testid=upkeep-sub]").inner_text()
    check("10,000 of 10,200 km" in oil and "200 km left" in oil, "oil: by km, whichever comes first — " + oil)
    gas = page.locator("[data-testid=upkeep-line][data-id='g'] [data-testid=upkeep-sub]").inner_text()
    check("about every 35 days" in gas, "gas cylinder: learned — " + gas)
    wf = page.locator("[data-testid=upkeep-line][data-id='w'] [data-testid=upkeep-sub]").inner_text()
    check("every 6 months" in wf, "water filter: every 6 months — " + wf)
    # Done (no cost) on the gas cylinder
    page.locator("[data-testid=upkeep-line][data-id='g'] [data-testid=upkeep-done]").click(); page.wait_for_timeout(300)
    h = page.evaluate("JSON.parse(localStorage.getItem('attune:upkeep:v1')).items.find(x => x.id === 'g').log")
    led = page.evaluate("JSON.parse(localStorage.getItem('ledger.v3')).txns")
    check(len(h) == 4 and h[-1]["date"] == t.isoformat() and "cost" not in h[-1] and len(led) == 0, "Done → marked today, nothing in Money")
    check(page.locator("[data-testid=upkeep-line][data-id='g']").get_attribute("data-due") == "", "…and it isn't due any more")
    # Done + cost on the oil change
    page.locator("[data-testid=upkeep-line][data-id='car:oil'] [data-testid=upkeep-cost]").fill("1700")
    page.locator("[data-testid=upkeep-line][data-id='car:oil'] [data-testid=upkeep-done-cost]").click(); page.wait_for_timeout(300)
    led = page.evaluate("JSON.parse(localStorage.getItem('ledger.v3')).txns")
    car = page.evaluate("JSON.parse(localStorage.getItem('attune:car:v1')).log")
    check(len(led) == 1 and led[0]["amount"] == 1700 and led[0]["type"] == "expense", "Done + cost → 1,700 expense in Money: %s" % json.dumps(led)[:120])
    check(car[-1]["service"] == "oil" and car[-1]["km"] == 10000 and car[-1]["date"] == t.isoformat(), "…and the oil change logged at 10,000 km today")
    oil = page.locator("[data-testid=upkeep-line][data-id='car:oil'] [data-testid=upkeep-sub]").inner_text()
    check("20,000" in oil, "the next oil change is now at 20,000 km: " + oil)
    # add a home item
    page.click("[data-testid=upkeep-add]"); page.fill("[data-testid=upkeep-name]", "AC service"); page.fill("[data-testid=upkeep-every]", "12"); page.click("[data-testid=upkeep-save]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=upkeep-line]:has-text('AC service')").count() == 1 and "every 12 months" in page.locator("[data-testid=upkeep-line]:has-text('AC service')").inner_text(), "added: AC service, every 12 months")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
env.close(); finish()
