"""v9.9.21 T1 brain dump (Ali OK'd "typed OR spoken" — Organise this): a paragraph in the Home box → "Organise this" → the things with
their type, day, time and amount, all ticked → untick one, fix one → Save → each where it belongs (a to-do in Mind, reminders on the
phone, a shopping list, money spent in Money); nothing saved before Save.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v9921braindump.py
"""
import json, time, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
LEDGER = {"txns": [], "accounts": [{"id": "cash", "name": "Cash", "currency": "EGP", "start": 5000}]}
INIT = "try{localStorage.setItem('attune:start','home');if(!localStorage.getItem('t:seeded')){localStorage.setItem('t:seeded','1');localStorage.setItem('ledger.v3',%s)}}catch(e){}" % json.dumps(json.dumps(LEDGER))
TEXT = "Tomorrow: buy milk and bread, call the bank at 10, pay the rent 6000 on the 1st. Paid 85 for a taxi. Finish the tender file by Thursday"
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_timeout(1500)
    check(page.locator("[data-testid=home-organise]").count() == 0, "no Organise button on an empty box")
    page.fill("[data-testid=home-ask]", TEXT); page.wait_for_timeout(300)
    check(page.locator("[data-testid=home-organise]").count() == 1, "several things written → Organise this appears under the box")
    page.click("[data-testid=home-organise]"); page.wait_for_selector("[data-testid=braindump]", timeout=4000)
    types = page.locator("[data-testid=braindump-item]").evaluate_all("els => els.map(e => e.dataset.type)")
    check(types == ["list", "reminder", "payment", "spent", "todo"], "5 things, in order: shopping, reminder, payment, spent, to-do: " + str(types))
    tags = page.locator("[data-testid=braindump-tag]").all_inner_texts()
    check(tags[0] == "Shopping list" and tags[3] == "Spent", "each with its type written: " + str(tags))
    t1 = page.locator("[data-testid=braindump-item]").nth(1).inner_text()
    check("10:00" in t1 and "call the bank" in t1, "the reminder shows its day and 10:00: " + t1.replace("\n", " "))
    check(page.evaluate("JSON.parse(localStorage.getItem('attune:reminders:v1')||'[]').length") == 0, "nothing saved before Save")
    # fix one: the to-do becomes a reminder at 15:00
    page.locator("[data-testid=braindump-open]").nth(4).click(); page.wait_for_selector("[data-testid=braindump-fix]")
    page.click("[data-testid=braindump-type-reminder]"); page.fill("[data-testid=braindump-fix-time]", "15:00"); page.click("[data-testid=braindump-fix-save]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=braindump-item]").nth(4).get_attribute("data-type") == "reminder", "tap a line → fix its type and time")
    # untick the payment
    page.locator("[data-testid=braindump-tick]").nth(2).click()
    check("Save 4" in page.locator("[data-testid=braindump-save]").inner_text(), "unticked → Save 4")
    page.click("[data-testid=braindump-save]"); page.wait_for_timeout(600)
    rem = page.evaluate("JSON.parse(localStorage.getItem('attune:reminders:v1')||'[]')")
    titles = [r["title"] for r in rem]
    check(len(rem) == 2 and any("call the bank" in t for t in titles) and any("tender" in t.lower() for t in titles) and not any("rent" in t for t in titles), "2 reminders saved (the call + the fixed one), the unticked payment not: " + str(titles))
    tom = (datetime.date.today() + datetime.timedelta(days=1)).isoformat()
    call = [r for r in rem if "call the bank" in r["title"]][0]
    check(time.strftime("%Y-%m-%d %H:%M", time.localtime(call["at"] / 1000)) == tom + " 10:00", "the call is tomorrow 10:00")
    lists = page.evaluate("JSON.parse(localStorage.getItem('attune:lists:v1')||'{\"lists\":[]}').lists")
    items = [x["text"] for l in lists for x in l["items"]]
    check("milk" in items and "bread" in items, "milk and bread are on the Shopping list: " + str(items))
    led = page.evaluate("JSON.parse(localStorage.getItem('ledger.v3')).txns")
    check(len(led) == 1 and led[0]["amount"] == 85 and led[0]["type"] == "expense", "the taxi 85 is in Money: " + json.dumps(led)[:160])
    check(page.locator("[data-testid=braindump]").count() == 0, "the screen closes after Save")
    # from Tools / Chat: "open brain dump"
    page.evaluate("m => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", "braindump"); page.wait_for_selector("[data-testid=braindump]", timeout=4000)
    page.fill("[data-testid=braindump-text]", "بكرة: اشتري لبن وعيش، كلم الدكتور الساعة 5"); page.click("[data-testid=braindump-again]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=braindump-item]").evaluate_all("els => els.map(e => e.dataset.type)") == ["list", "reminder"] and "17:00" in page.locator("[data-testid=braindump-item]").nth(1).inner_text(), "Arabic in the same screen: shopping + reminder at 5 pm")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
env.close(); finish()
