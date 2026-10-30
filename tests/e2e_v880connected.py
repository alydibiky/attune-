"""v8.8 the connected memory (Ali, 30 Oct: "chat should be very smart and connect everything together"; "add his contact and
refer to him as X"; "when I say Ahmed it asks me which Ahmed"): People cards, the contact picker, «Who is X?», «Which Ahmed?»
on Home, and Chat answering from everything linked — by code, at once.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v880connected.py
"""
import json, time, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
t = datetime.date.today()
def d(k): return (t - datetime.timedelta(days=k)).isoformat()
TX = [{"id": "1", "type": "expense", "amount": 250, "date": d(30), "note": "Osama haircut", "cat": "other", "account": "a"},
      {"id": "2", "type": "expense", "amount": 250, "date": d(9), "note": "الحلاق", "cat": "other", "account": "a"},
      {"id": "3", "type": "expense", "amount": 300, "date": d(12), "note": "Ahmed the plumber - sink", "cat": "other", "account": "a"},
      {"id": "4", "type": "income", "amount": 9000, "date": d(5), "note": "Ahmed - project invoice", "cat": "salary", "account": "a"},
      {"id": "5", "type": "expense", "amount": 400, "date": d(3), "note": "paid Karim for the tiles", "cat": "other", "account": "a"}]
L = {"currency": "EGP", "accounts": [{"id": "a", "name": "Bank", "currency": "EGP"}], "txns": TX, "recurring": []}
DIR = {"v": 1, "skip": [], "items": [
  {"id": "pA", "kind": "person", "name": "Ahmed the plumber", "role": "plumber", "aliases": [], "picks": {}, "used": 0},
  {"id": "pB", "kind": "person", "name": "Ahmed", "role": "work", "aliases": [], "picks": {}, "used": 0}]}
REC = [{"id": "n1", "kind": "note", "title": "House", "text": "paid the electrician 650 for the wiring", "ts": int(time.time() * 1000) - 86400000, "tags": [], "meta": {"book": "mybook"}}]
SEED = ("try { localStorage.setItem('ledger.v3', %s); localStorage.setItem('attune:people:v1', %s); localStorage.setItem('attune:memory:v1', %s); localStorage.setItem('attune:start','home'); localStorage.setItem('attune:people:seeded','1'); } catch (e) {}"
        % (json.dumps(json.dumps(L)), json.dumps(json.dumps(DIR)), json.dumps(json.dumps(REC))))
PICK = "(() => { const N = window.AttuneNative; N.contactPick = (id) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ name: 'Osama Barber 2', phone: '+20 111 222 3344' })), 20); })();"
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=SEED)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.evaluate(PICK)
    # ---- People: «Who is X?» from Money's notes; add Osama with your own name AND his contact
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'people'}}))"); page.wait_for_selector("[data-testid=people-page]", timeout=8000)
    check(page.locator("[data-testid=people-row]").count() == 2, "Saved → People: the two Ahmed cards")
    ask = page.locator("[data-testid=people-ask-row]").all_inner_texts()
    check(any("Karim" in a for a in ask) and any("Osama" in a for a in ask), "«Who is this?» lists the names Money met with no card: %s" % [a.split("\n")[0] for a in ask])
    page.locator("[data-testid=people-ask-row]:has-text('Osama') [data-testid=people-ask-new]").click(); page.wait_for_selector("[data-testid=people-editor]")
    check(page.input_value("[data-testid=people-name]") == "Osama", "New person starts with the name it met")
    page.fill("[data-testid=people-role]", "barber"); page.fill("[data-testid=people-aliases]", "الحلاق")
    page.click("[data-testid=people-pick-contact]"); page.wait_for_selector("[data-testid=people-contact]", timeout=4000)
    check("Osama Barber 2" in page.inner_text("[data-testid=people-contact]") and page.input_value("[data-testid=people-name]") == "Osama", "his phone contact linked — your own name for him stays “Osama”")
    page.click("[data-testid=people-save]"); page.wait_for_selector("[data-testid=people-card]", timeout=4000)
    sums = page.inner_text("[data-testid=people-sums]")
    check("500" in sums and page.locator("[data-testid=people-item]").count() == 2, "his card: both haircuts (one written «الحلاق») = 500 paid, linked from Money")
    page.click("[data-testid=people-back]"); page.wait_for_timeout(200)
    page.locator("[data-testid=people-ask-row]:has-text('Karim') [data-testid=people-ask-skip]").click(); page.wait_for_timeout(200)
    check(page.locator("[data-testid=people-ask-row]:has-text('Karim')").count() == 0, "Not a person → never asked again")
    # ---- Home: «Which Ahmed?» → pick → Chat answers for him, by code
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'home'}}))"); page.wait_for_selector("[data-testid=home-ask]", timeout=8000)
    page.fill("[data-testid=home-ask]", "How much did Ahmed pay me?"); page.click("[data-testid=home-send]")
    page.wait_for_selector("[data-testid=home-who]", timeout=5000)
    picks = page.locator("[data-testid=home-who-pick]").all_inner_texts()
    check(len(picks) == 2 and any("plumber" in x for x in picks) and any("work" in x for x in picks), "two Ahmeds → «Which Ahmed?» with what tells them apart: %s" % picks)
    t0 = time.time()
    page.locator("[data-testid=home-who-pick]:has-text('work')").click()
    page.wait_for_function("() => document.body.innerText.includes('you got 9,000')", timeout=8000)
    check(time.time() - t0 < 4, "picked work-Ahmed → his 9,000 invoice, worked out by code at once (%.1f s)" % (time.time() - t0))
    dir2 = json.loads(page.evaluate("localStorage.getItem('attune:people:v1')"))
    check(any(x["id"] == "pB" and x.get("picks", {}).get("much", 0) >= 0 and x.get("used", 0) >= 1 for x in dir2["items"]), "the pick is remembered on his card")
    # ---- a person's sum straight away (one Osama → no question)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'home'}}))"); page.wait_for_selector("[data-testid=home-ask]", timeout=8000)
    page.fill("[data-testid=home-ask]", "how much did I pay my barber?"); page.click("[data-testid=home-send]")
    page.wait_for_function("() => document.body.innerText.includes('you paid 500')", timeout=8000)
    check(True, "“my barber” → Osama's card → 500 in 2 payments, from Money")
    # ---- a note that says money moved → Money asks once (Ali: "read the notes I write")
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'money'}}))"); page.wait_for_selector("[data-testid=notes-money-row]", timeout=12000)
    check("650" in page.inner_text("[data-testid=notes-money]"), "Money → From your notes: “paid the electrician 650” waits for a tap")
    page.wait_for_timeout(1500)
    page.click("[data-testid=notes-money-add]")
    page.wait_for_function("() => (JSON.parse(localStorage.getItem('ledger.v3') || '{}').txns || []).some((t) => +t.amount === 650)", timeout=10000)
    check(page.locator("[data-testid=notes-money-row]").count() == 0, "Add → it is in Money, and not offered again")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
