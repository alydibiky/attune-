"""v8.7 (persona 4, idea 13 + 15): the Family page — start it, the shared list, who owes whom, the family file — and the watch's
vitals on Health (mocked Health Connect).
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v870family.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
today = datetime.date.today()
DAYS = [{"day": (today - datetime.timedelta(days=i)).isoformat(), "restHr": 60, "hrv": 50, "sleepMin": 330, "spo2": 96, "spo2Min": 95} for i in range(10)]
DAYS[0]["bp"] = [{"sys": 150, "dia": 95, "at": 1}]
VITALS = """
const N = window.AttuneNative; N.healthVitals = (id, arg) => { setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ available: 'ready', granted: 5, of: 7, days: %s })), 20); };
N.healthVitalsConnect = () => { window.__vitalsAsked = true; };
""" % json.dumps(DAYS)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init="if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('attune:resume:v1', JSON.stringify({ mode: 'family', at: Date.now(), hist: [] })); }")
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.wait_for_selector("[data-testid=family-page][data-view=setup]", timeout=5000)
    page.fill("[data-testid=family-me]", "Ali"); page.click("[data-testid=family-start]")
    page.wait_for_selector("[data-testid=family-page][data-view=main]")
    page.fill("[data-testid=family-item]", "milk, bread and eggs"); page.click("[data-testid=family-item-add]")
    check(page.locator("[data-testid=family-item-row]").count() == 3, "the shared list splits 'milk, bread and eggs' into 3 items")
    page.locator("[data-testid=family-item-row]").first.click(); page.wait_for_timeout(100)
    page.click("[data-testid=family-clear]"); page.wait_for_timeout(100)
    check(page.locator("[data-testid=family-item-row]").count() == 2, "a ticked item is cleared")
    # a reminder for Dad adds Dad to the family
    page.fill("[data-testid=family-rem-who]", "Dad"); page.fill("[data-testid=family-rem-what]", "Take the pills"); page.click("[data-testid=family-rem-add]"); page.wait_for_timeout(150)
    check("Dad: Take the pills" in page.locator("[data-testid=family-reminders]").inner_text(), "a reminder for Dad is listed")
    page.fill("[data-testid=family-amount]", "900"); page.fill("[data-testid=family-what]", "groceries"); page.click("[data-testid=family-exp-add]"); page.wait_for_timeout(150)
    mv = page.locator("[data-testid=family-move]")
    check(mv.count() == 1 and "Dad owes Ali" in mv.first.inner_text() and "450" in mv.first.inner_text(), "900 paid by Ali for two → Dad owes Ali 450 (%s)" % (mv.first.inner_text() if mv.count() else ""))
    page.click("[data-testid=family-settle]"); page.wait_for_timeout(150)
    check("All square" in page.locator("[data-testid=family-money]").inner_text(), "Paid → all square")
    fam = json.loads(page.evaluate("localStorage.getItem('attune:family:v1')"))
    check(fam["me"] == "m:ali" and len(fam["members"]) == 2, "the family store keeps Ali (this phone) and Dad")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    ctx.close()

    # the watch's vitals on Health
    errors.clear()
    ctx, page = new_page(br, env, errors, extra_init=VITALS + "\nlocalStorage.setItem('attune:resume:v1', JSON.stringify({ mode: 'health', at: Date.now(), hist: [] }));")
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.wait_for_selector("[data-testid=watch-vitals] [data-testid=vital-line]", timeout=8000)
    t = page.locator("[data-testid=watch-vitals]").inner_text()
    check("Blood pressure: 150/95" in t and "show a doctor" in t, "From your watch: the high blood pressure reading comes first (%s)" % t[:120])
    check("Sleep: 5 h 30 min a night — under 6 hours" in t, "…and short sleep is flagged")
    care = json.loads(page.evaluate("localStorage.getItem('attune:care:v1') || '{}'"))
    check(any(l.get("source") == "watch" and l.get("value") == 150 for l in care.get("labs", [])), "the watch's blood pressure is in Family health")
    page.click("[data-testid=watch-vitals-connect]")
    check(page.evaluate("window.__vitalsAsked === true"), "'Share more from the watch' asks Health Connect for the rest")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
finish()
