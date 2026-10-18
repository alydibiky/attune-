"""v6.38 (upgrade D3) — Mind brings things back by itself: a message from Ahmed pasted into Instant (or his name typed on
Home) shows what he promised and what he owes, from Chat X-Ray and People & plans; a tap opens that page.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v740recall.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
T = datetime.date.today(); iso = lambda n: (T + datetime.timedelta(days=n)).isoformat()
XR = [{"id": "x1", "name": "Ahmed", "me": "Ali", "at": 1, "ledger": [], "unanswered": [], "stats": {}, "items": [{"type": "promise", "from": "Ahmed", "t": 1, "amount": 2000, "due": iso(-2), "what": "الباقي بكرة"}]}]
LIFE = {"v": 1, "items": [{"id": "l1", "kind": "installment", "dir": "in", "person": "Ahmed", "amount": 1000, "currency": "EGP", "count": 5, "every": "month", "start": iso(-40), "paid": [0]}]}
INIT = "try{localStorage.setItem('attune:xray:v1', %s);localStorage.setItem('attune:life:v1', %s);localStorage.setItem('attune:start','home')}catch(e){}" % (json.dumps(json.dumps(XR)), json.dumps(json.dumps(LIFE)))
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.fill("[data-testid=home-ask]", "remind me to call Ahmed")
    page.wait_for_selector("[data-testid=recall-card]", timeout=4000)
    items = page.locator("[data-testid=recall-item]").all_inner_texts()
    check(any("Promised, not kept" in x and "الباقي بكرة" in x for x in items) and any("Owes you 4,000 EGP" in x for x in items), "Home: what Ahmed promised and still owes: %s" % items)
    page.fill("[data-testid=home-ask]", "remind me to call mum")
    page.wait_for_timeout(600)
    check(page.locator("[data-testid=recall-card]").count() == 0, "…and nothing for someone with no records")
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'instant'}}))")
    page.wait_for_selector("textarea", timeout=6000)
    page.locator("textarea").first.fill("Ahmed: ya Ali I'll send it next week inshallah")
    page.wait_for_selector("[data-testid=recall-card]", timeout=4000)
    check("Remembered about Ahmed" in page.locator("[data-testid=recall-card]").inner_text(), "Instant: a message from Ahmed brings it back")
    page.locator("[data-testid=recall-item]", has_text="Promised").first.click()
    page.wait_for_selector("[data-testid=hub-part-xray][aria-pressed=true]", timeout=6000)
    check(True, "a tap opens Chat X-Ray")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
