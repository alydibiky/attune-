"""v9.9.18 AU3 (Ali picked A): the Recipes gallery on the Automations page shows only the life moments that fit the person's data
(a salary on the 25th, a son at school, a trip in 30+ days — no Ramadan while prayers are off). Opening "A trip" lists its rules;
"Switch on 2" makes two one-time reminders on the right days (papers 30 days before, packing 2 days before). Arabic titles too.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v9918recipes.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
t = datetime.date.today(); trip = t + datetime.timedelta(days=45)
sal = [{"id": "s%d" % k, "type": "income", "amount": 20000, "cat": "salary", "account": "cash", "date": (t.replace(day=25) - datetime.timedelta(days=31 * k)).replace(day=25).isoformat(), "note": "salary"} for k in range(1, 3)]
LEDGER = {"txns": sal, "accounts": [{"id": "cash", "name": "Cash", "currency": "EGP", "start": 5000}]}
DIR = {"items": [{"id": "p1", "kind": "person", "name": "Omar", "role": "son"}], "skip": []}
SEED = {"ledger.v3": LEDGER, "attune:people:v1": DIR, "attune:trip:v1": {"depart": trip.isoformat(), "from": "CAI"}}
INIT = "try{localStorage.setItem('attune:start','home');if(!localStorage.getItem('t:seeded')){localStorage.setItem('t:seeded','1');var S=%s;for(var k in S)localStorage.setItem(k,JSON.stringify(S[k]))}}catch(e){}" % json.dumps(SEED)
def autos(page):
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'automations'}}))"); page.wait_for_selector("[data-testid=recipes]", timeout=8000); page.wait_for_timeout(300)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_timeout(1500)
    autos(page)
    ids = page.evaluate("[...document.querySelectorAll('[data-testid^=recipe-]')].map(e=>e.dataset.testid).filter(x=>!/open|rule|switch/.test(x))")
    check("recipe-salary" in ids and "recipe-school" in ids and "recipe-trip" in ids, "the tiles that fit: salary, school, trip — " + str(ids))
    check("recipe-ramadan" not in ids and "recipe-car" not in ids and "recipe-baby" not in ids, "…and not Ramadan (prayers off), car or baby")
    check("day 25" in page.locator("[data-testid=recipe-salary]").inner_text(), "salary tile says day 25: " + page.locator("[data-testid=recipe-salary]").inner_text().replace("\n", " "))
    page.locator("[data-testid=recipe-trip]").click(); page.wait_for_timeout(300)
    rows = page.locator("[data-testid=recipe-rule]")
    check(rows.count() == 2 and "Check passport and visa" in rows.nth(0).inner_text() and "Pack for the trip" in rows.nth(1).inner_text(), "A trip → its two rules")
    check("Switch on 2" in page.locator("[data-testid=recipe-switch]").inner_text(), "…Switch on 2")
    page.locator("[data-testid=recipe-switch]").click(); page.wait_for_timeout(500)
    rem = page.evaluate("JSON.parse(localStorage.getItem('attune:reminders:v1') || '[]')")
    days = sorted(datetime.date.fromtimestamp(r["at"] / 1000).isoformat() for r in rem if str(r.get("id", "")).startswith("rule-"))
    want = sorted([(trip - datetime.timedelta(days=30)).isoformat(), (trip - datetime.timedelta(days=2)).isoformat()])
    check(days == want and all(r.get("repeat") == "none" for r in rem if str(r.get("id", "")).startswith("rule-")), "two one-time reminders on the right days: %s (want %s)" % (days, want))
    check("On" in page.locator("[data-testid=recipe-trip]").inner_text(), "the trip tile now says On")
    # school: untick one → Switch on 1
    page.locator("[data-testid=recipe-school]").click(); page.wait_for_timeout(300)
    page.locator("[data-testid=recipe-rule] input").nth(0).uncheck(); page.wait_for_timeout(200)
    check("Switch on 1" in page.locator("[data-testid=recipe-switch]").inner_text(), "unticking School fees → Switch on 1")
    page.locator("[data-testid=recipe-switch]").click(); page.wait_for_timeout(400)
    rem = page.evaluate("JSON.parse(localStorage.getItem('attune:reminders:v1') || '[]')")
    bag = [r for r in rem if r.get("title") == "Pack the school bag"]
    check(len(bag) == 1 and str(bag[0].get("repeat", "")).startswith("days:") and all(f not in bag[0]["repeat"] for f in ["4", "5"]), "the school bag: nights before school days only (not Thu / Fri): " + json.dumps(bag)[:160])
    # Arabic
    page.evaluate("localStorage.setItem('attune:ui:lang','ar')"); page.reload(); page.wait_for_timeout(1500); autos(page)
    check("يوم المرتب" in page.locator("[data-testid=recipe-salary]").inner_text() and "وصفات" in page.locator("[data-testid=recipes]").inner_text(), "Arabic: «وصفات جاهزة» · «يوم المرتب»")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
env.close(); finish()
