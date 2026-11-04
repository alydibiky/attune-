"""v6.28 — Ali: "when I'm lazy I just type on Home 'I ate that for breakfast' and it happens in the food app — for the whole app".
Phone Home: food → Fit's breakfast (Undo takes it out), money → the Money ledger, a reminder → scheduled, a dose → ticked in
Family health, water → Fit, a question about your data → answered on Home, a general question → Chat. Computer Home: the same.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v731doit.py     (SHOTS=dir for screenshots)
"""
import os, json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
today = str(datetime.date.today())
LEDGER = {"currency": "EGP", "accounts": [{"id": "c", "name": "Cash", "currency": "EGP", "start": 0}], "txns": [], "budgets": {"overall": 0, "cats": {}}, "recurring": [], "debts": []}
CARE = {"members": [{"id": "me", "name": "Me"}], "meds": [{"id": "m1", "member": "me", "name": "Lantus", "dose": "20 units", "freq": "twice a day", "times": ["09:00", "21:00"], "start": "2026-09-01", "days": 0}], "labs": [], "taken": {}}
LIFE = {"v": 1, "items": [{"id": "a", "kind": "debt", "person": "Ahmed", "dir": "in", "amount": 1000, "total": 12000, "count": 12, "every": "month", "start": "2026-06-01", "currency": "EGP", "paid": [0, 1, 2]}]}
FIT = {"profile": {"sex": "m", "age": 30, "cm": 178, "kg": 80, "activity": "light", "goal": "keep", "rate": 0.5, "goalKg": 80, "diet": "balanced"}, "days": {}, "weights": [], "fast": None, "myRecipes": [], "favs": []}
INIT = "try{localStorage.setItem('attune:start','%s');if(!localStorage.getItem('attune:fit:v1'))localStorage.setItem('attune:fit:v1',%s);if(!localStorage.getItem('ledger.v3'))localStorage.setItem('ledger.v3',%s);if(!localStorage.getItem('attune:care:v1'))localStorage.setItem('attune:care:v1',%s);if(!localStorage.getItem('attune:life:v1'))localStorage.setItem('attune:life:v1',%s)}catch(e){}"
J = lambda v: json.dumps(json.dumps(v))
def say(page, t):
    page.fill("[data-testid=home-ask]", t); page.click("[data-testid=home-send]"); page.wait_for_timeout(300)
def store(page, k): return json.loads(page.evaluate("localStorage.getItem('%s')" % k) or "null")
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT % ("home", J(FIT), J(LEDGER), J(CARE), J(LIFE)))
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    check(page.locator("[data-testid=home-hint]").count() == 1, "Home shows an example of what to just say")
    say(page, "I ate 2 eggs and foul for breakfast")
    r = page.locator("[data-testid=do-result]")
    check(r.count() == 1 and "breakfast" in r.inner_text() and "kcal" in r.inner_text(), "food: done on Home — " + r.inner_text().replace("\n", " ")[:90])
    fit = store(page, "attune:fit:v1")
    bf = ((fit or {}).get("days", {}).get(today, {}).get("meals", {}).get("breakfast") or [])
    check(len(bf) == 2, "…and it is in Fit & Food's breakfast (%d foods)" % len(bf))
    check(page.locator("[data-testid=fit-today-kcal]").inner_text().split("/")[0].strip() not in ("0", ""), "Home's Fit & Food card updates at once: " + page.locator("[data-testid=fit-today-kcal]").inner_text())
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, "doit-phone.png"))
    page.click("[data-testid=do-undo]"); page.wait_for_timeout(150)
    fit = store(page, "attune:fit:v1")
    check(not ((fit or {}).get("days", {}).get(today, {}).get("meals", {}).get("breakfast")), "Undo takes it out again")
    say(page, "I ate 2 eggs and foul for breakfast")
    page.locator("[data-testid=do-open]").first.click(); page.wait_for_selector("[data-testid=fit-today]", timeout=6000)
    check("Ful" in page.locator("[data-testid=fit-meal-breakfast]").inner_text() or "فول" in page.locator("[data-testid=fit-meal-breakfast]").inner_text(), "Open → Fit shows it in breakfast")
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    say(page, "صرفت ١٥٠ على الغدا")
    tx = store(page, "ledger.v3")["txns"]
    check(len(tx) == 1 and tx[0]["amount"] == 150 and tx[0]["cat"] == "food", "money (Arabic): 150 on food in the Money ledger")
    say(page, "remind me tomorrow at 9 to call Hassan")
    notes = page.evaluate("window.__mock.notes.filter(n => /Hassan/i.test(n.title)).length")
    check(notes >= 1 and page.locator("[data-testid=do-result]").count() == 1, "a reminder: scheduled on the phone")
    say(page, "took my Lantus")
    taken = store(page, "attune:care:v1")["taken"]
    check(any(k.startswith("m1|" + today) for k in taken), "a dose: ticked in Family health")
    say(page, "drank 2 glasses of water")
    check(store(page, "attune:fit:v1")["days"][today]["water"] == 500, "water: +500 ml in Fit")
    say(page, "who owes me money?")
    check(page.locator("[data-testid=do-answer]").count() == 1 and "9,000" in page.locator("[data-testid=do-answer]").inner_text(), "a question about my data: answered on Home (9,000 EGP)")
    say(page, "What is the capital of France?")
    check(page.locator("[data-testid=phone-home]").count() == 0, "a general question goes to Chat, as before")
    ctx.close()
    # computer
    ctx, page = new_page(br, env, errors, extra_init=INIT % ("home", J(FIT), J(LEDGER), J(CARE), J(LIFE)))
    page.set_viewport_size({"width": 1366, "height": 860})
    page.goto(env.url); page.wait_for_selector("[data-testid=desk-home]", timeout=15000)
    page.fill("[data-testid=home-ask]", "spent 80 on a taxi"); page.keyboard.press("Enter"); page.wait_for_timeout(300)
    check(page.locator("[data-testid=do-result]").count() == 1 and store(page, "ledger.v3")["txns"][0]["cat"] == "transport", "computer: «spent 80 on a taxi» → Money (transport)")
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, "doit-desk.png"))
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
