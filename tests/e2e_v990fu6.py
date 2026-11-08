"""v9.9 Ali's pick FU6 (8 Nov 2026: "Okay fu6") — Follow-ups = Attune asks, you answer — and "edit anything by talking to Chat, for
example telling it the maid is now taking 700 and it gets done" (lifeedit.js), from the Follow-ups box and from Chat.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v990fu6.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
NOW = datetime.datetime(2026, 11, 8, 13, 0, 0)   # a Sunday
TX = [{"id": "i1", "type": "income", "amount": 40000, "account": "b", "cat": "salary", "date": "2026-11-01", "note": "Salary"}]
L = {"currency": "EGP", "accounts": [{"id": "b", "name": "Cash", "currency": "EGP", "start": 5000}], "txns": TX, "budgets": {"overall": 0, "cats": {}}, "recurring": [], "debts": [], "customCats": [], "goals": [], "projects": []}
LIFE = {"v": 1, "items": [{"id": "sh", "kind": "installment", "person": "Sheikh", "dir": "in", "amount": 2500, "total": 19500, "count": 8, "every": "month", "start": "2026-10-05", "currency": "EGP", "paid": [0], "created": 1},
  {"id": "md", "kind": "regular", "title": "Maid", "dir": "out", "amount": 600, "every": "week", "start": "2026-11-07", "currency": "EGP", "paid": [], "created": 2},
  {"id": "cw", "kind": "regular", "title": "Car wash", "dir": "out", "amount": 700, "every": "month", "start": "2026-12-01", "currency": "EGP", "paid": [], "created": 3}]}
INIT = ("try{localStorage.setItem('attune:start','home');localStorage.setItem('ledger.v3', %s);localStorage.setItem('attune:life:v1', %s)}catch(e){}") % tuple(json.dumps(json.dumps(x)) for x in (L, LIFE))
def open_mode(page, m, sel):
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'%s'}}))" % m); page.wait_for_selector(sel, timeout=10000); page.wait_for_timeout(300)
life = lambda page, i: page.evaluate("JSON.parse(localStorage.getItem('attune:life:v1')).items.find(x => x.id == '%s')" % i)
ntx = lambda page: page.evaluate("JSON.parse(localStorage.getItem('ledger.v3')).txns.length")
def say(page, t):
    page.fill("[data-testid=fu-add]", t); page.click("[data-testid=fu-add-go]"); page.wait_for_timeout(400)
    return page.locator("[data-testid=fu-result]").last.inner_text() if page.locator("[data-testid=fu-result]").count() else ""
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    ctx.clock.set_fixed_time(NOW)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_timeout(1200)
    open_mode(page, "timeline", "[data-testid=fu-thread]")
    qs = page.locator("[data-testid=fu-q]")
    acts = sorted(q.get_attribute("data-act") for q in qs.all())
    check(acts == ["ask", "pay"], "FU6: two questions today — Sheikh (late) and yesterday's maid (%s)" % acts)
    check("2 to answer" in page.locator("[data-testid=fu-count]").inner_text(), "the header says: Today · 2 to answer")
    check(page.locator("[data-testid=fu-week]").count() == 0 and page.locator("[data-testid=fu-sec-today]").count() == 0, "no week strip, no FU1 sections")
    maid = page.locator("[data-testid=fu-q][data-act=pay]")
    check("Did Maid come on" in maid.inner_text() and "Saturday" in maid.inner_text(), "the question: Did Maid come on Saturday, 7 Nov?")
    n0 = ntx(page)
    maid.locator("[data-testid=fu-yes]").click(); page.wait_for_timeout(300)
    check(ntx(page) == n0 + 1 and page.evaluate("JSON.parse(localStorage.getItem('ledger.v3')).txns.slice(-1)[0].amount") == 600, "Came ✓ = 600 out of Money at once")
    check(page.locator("[data-testid=fu-me]").last.inner_text().startswith("Came") and "600 out of Money" in page.locator("[data-testid=fu-result]").last.inner_text(), "the answer shows in the thread: Came ✓ · 600 out of Money · Undo")
    page.locator("[data-testid=fu-undo]").last.click(); page.wait_for_timeout(300)
    check(ntx(page) == n0 and page.locator("[data-testid=fu-q][data-act=pay]").count() == 1 and 0 not in life(page, "md")["paid"], "Undo: the 600 is gone and the question is back")
    page.locator("[data-testid=fu-q][data-act=pay] [data-testid=fu-no]").click(); page.wait_for_timeout(300)
    check(0 in (life(page, "md").get("skip") or []) and ntx(page) == n0, "Didn't come: nothing paid, the day is answered")
    open_mode(page, "life", "[data-testid=life-item]"); open_mode(page, "timeline", "[data-testid=fu-thread]")
    check(page.locator("[data-testid=fu-q][data-act=pay]").count() == 0, "…and it isn't asked again")
    ask = page.locator("[data-testid=fu-q][data-act=ask]")
    check(ask.locator("[data-testid=home-person-ask]").count() == 1 and "Sheikh" in ask.inner_text(), "Sheikh: Did Sheikh pay 2,500? Paid · Other amount · Not yet — inside the question")
    ask.locator("[data-testid=home-ask-later]").click(); page.wait_for_timeout(300)
    check(page.locator("[data-testid=fu-q]").count() == 0 and page.locator("[data-testid=fu-clear]").count() == 1, "Not yet → no questions left: All clear")
    check("All clear until" in page.locator("[data-testid=fu-clear]").inner_text(), "All clear until the next thing")
    check("Car wash" in page.locator("[data-testid=fu-coming]").inner_text(), "Coming: one line (the car wash on 1 Dec…)")
    page.click("[data-testid=fu-coming-toggle]"); page.wait_for_timeout(150)
    check(page.locator("[data-testid=fu-coming-all] [data-testid=timeline-item]").count() >= 2, "See all opens the whole list")
    # ---- edit by talking (Follow-ups box)
    r = say(page, "the maid is now taking 700")
    m = life(page, "md")
    check("Maid is now 700 a week from today (was 600)" in r and m["amount"] == 700 and m["changes"][0]["was"] == 600, "“the maid is now taking 700” → done: Maid is now 700 a week from today (was 600) — %r" % r)
    page.locator("[data-testid=fu-undo]").last.click(); page.wait_for_timeout(300)
    check(life(page, "md")["amount"] == 600, "Undo puts 600 back")
    r = say(page, "الخدامة بقت بـ٧٠٠")
    check(life(page, "md")["amount"] == 700 and ("700" in r or "٧٠٠" in r), "«الخدامة بقت بـ٧٠٠» works too — %r" % r)
    r = say(page, "Sheikh will pay 3000 a month now")
    check("19,500" in r and life(page, "sh")["amount"] == 2500, "Sheikh's plan (19,500) isn't broken by a sentence: change it in People & plans — %r" % r)
    # ---- edit by talking (Chat)
    open_mode(page, "chat", "textarea[placeholder='Message Attune']")
    page.locator("textarea[placeholder='Message Attune']").fill("car wash is 800 now"); page.locator("button[title='Send']").first.click(); page.wait_for_timeout(900)
    body = page.inner_text("body")
    check(life(page, "cw")["amount"] == 800 and "Car wash is now 800" in body, "Chat: “car wash is 800 now” → done: Car wash is now 800 a month from today")
    page.locator("textarea[placeholder='Message Attune']").fill("the maid comes on Friday now"); page.locator("button[title='Send']").first.click(); page.wait_for_timeout(900)
    m = life(page, "md")
    check(any(c.get("start") == "2026-11-13" for c in m.get("changes", [])) and "Friday" in page.inner_text("body"), "Chat: “the maid comes on Friday now” → Fridays from 13 Nov")
    page.locator("textarea[placeholder='Message Attune']").fill("stop the car wash"); page.locator("button[title='Send']").first.click(); page.wait_for_timeout(900)
    check(life(page, "cw").get("ended") == "2026-11-08" and "stopped from today" in page.inner_text("body"), "Chat: “stop the car wash” → stopped from today")
    open_mode(page, "timeline", "[data-testid=fu-thread]")
    check("Car wash" not in page.inner_text("[data-testid=timeline-page]"), "…and Follow-ups no longer shows the car wash")
    check(not real_errors(errors), "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
