"""v9.9.23 B5 N1 the person page (Ali picked A — sections, "and let me open the original things"): Ahmed Kamal's card shows Money
(his payment + what he still owes, a paid debt gone), Promises, Dates, Notes in sections; "Ahmed — cables" (which Ahmed?) is marked
maybe; each line opens ITS original — the payment's own sheet in Money, the follow-up lit up in Follow-ups, the note open in Mind,
the date's own form in Dates. Arabic labels too.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v9923n1.py
"""
import json, time, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
t = datetime.date.today()
def d(k): return (t - datetime.timedelta(days=k)).isoformat()
TX = [{"id": "t1", "type": "expense", "amount": 300, "date": d(12), "note": "Paid Ahmed Kamal for the sink", "cat": "other", "account": "a"},
      {"id": "t2", "type": "expense", "amount": 50, "date": d(3), "note": "Ahmed - cables", "cat": "other", "account": "a"},
      {"id": "t3", "type": "expense", "amount": 999, "date": d(4), "note": "Ahmed Samir lunch", "cat": "other", "account": "a"}]
L = {"currency": "EGP", "accounts": [{"id": "a", "name": "Bank", "currency": "EGP"}], "txns": TX, "recurring": []}
DIR = {"v": 1, "skip": [], "items": [{"id": "pK", "kind": "person", "name": "Ahmed Kamal", "role": "", "aliases": [], "contact": {"name": "Ahmed K", "phone": "01012345678"}},
                                     {"id": "pS", "kind": "person", "name": "Ahmed Samir", "role": "", "aliases": []}]}
LIFE = {"items": [{"id": "l1", "kind": "debt", "person": "Ahmed Kamal", "dir": "in", "amount": 500, "total": 500, "count": 1, "start": d(40), "created": 1},
                  {"id": "l2", "kind": "debt", "person": "Ahmed Kamal", "dir": "in", "amount": 200, "total": 200, "count": 1, "start": d(90), "paid": [0], "created": 2}]}
REC = [{"id": "n1", "kind": "note", "title": "Ahmed Kamal works at the bank, Nasr City", "text": "", "ts": int(time.time() * 1000) - 86400000, "tags": [], "meta": {}}]
RADAR = {"items": [{"id": "dz1", "title": "Ahmed Kamal car licence", "date": (t + datetime.timedelta(days=60)).isoformat(), "status": "active", "kind": "renewal"}]}
SEED = {"ledger.v3": L, "attune:people:v1": DIR, "attune:memory:v1": REC}
def init(extra=""):
    return ("try { var S=%s; for (var k in S) localStorage.setItem(k, JSON.stringify(S[k])); localStorage.setItem('attune:start','home'); localStorage.setItem('attune:people:seeded','1');"
            " localStorage.setItem('attune:life:v1', %s); localStorage.setItem('attune:radar:v1', %s); %s } catch (e) {}" % (json.dumps(SEED), json.dumps(json.dumps(LIFE)), json.dumps(json.dumps(RADAR)), extra))
def card(page, name):
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'people'}}))"); page.wait_for_selector("[data-testid=people-page]", timeout=8000)
    page.locator("[data-testid=people-row]:has-text('%s')" % name).click(); page.wait_for_selector("[data-testid=people-card]", timeout=5000)
def line(page, did): return page.locator("[data-testid=person-line][data-id='%s']" % did)
with sync_playwright() as p:
    br = p.chromium.launch()
    def fresh(extra=""):
        ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=init(extra))
        page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000); return ctx, page
    ctx, page = fresh()
    card(page, "Ahmed Kamal")
    secs = page.evaluate("[...document.querySelectorAll('[data-testid=person-section]')].map(e => e.dataset.sec)")
    check(secs[:1] == ["money"] and "notes" in secs and "dates" in secs, "Ahmed Kamal's page in sections: %s" % secs)
    money = page.locator("[data-testid=person-section][data-sec=money]").inner_text()
    check(line(page, "tx:t1").count() == 1 and line(page, "life:l1").count() == 1 and "Owes you 500" in money, "Money: his payment (300) + he still owes you 500")
    check(line(page, "life:l2").count() == 0, "…the debt he already paid back isn't listed")
    check(line(page, "tx:t3").count() == 0, "Ahmed Samir's lunch is NOT on Ahmed Kamal's page")
    check(line(page, "tx:t2").get_attribute("data-maybe") == "1" and "Could be another Ahmed Kamal" in line(page, "tx:t2").inner_text(), "\"Ahmed - cables\" (which Ahmed?) → marked maybe")
    check(page.locator("[data-testid=person-whatsapp]").count() == 0, "no Messages kept → no WhatsApp button in an empty section")
    # 1 the payment → its own sheet in Money
    line(page, "tx:t1").click(); page.wait_for_selector("[data-testid=money-tx-sheet]", timeout=8000)
    vals = page.evaluate("[...document.querySelectorAll('[data-testid=money-tx-sheet] input')].map(i => i.value)")
    check("300" in vals and "Paid Ahmed Kamal for the sink" in vals, "tap the payment → Money opens THAT payment (300, its note): %s" % vals)
    ctx.close(); ctx, page = fresh(); card(page, "Ahmed Kamal")
    # 2 the debt → Follow-ups, that one lit up
    line(page, "life:l1").click(); page.wait_for_selector("[data-open-id='life:l1'][data-opened='1']", timeout=8000)
    check(True, "tap \"owes you 500\" → Follow-ups opens with THAT follow-up lit up")
    ctx.close(); ctx, page = fresh(); card(page, "Ahmed Kamal")
    # 3 the note → Mind, open on it
    line(page, "mem:n1").click(); page.wait_for_timeout(1500)
    check("works at the bank" in page.inner_text("body") and page.evaluate("localStorage.getItem('attune:mind:open')") is None, "tap the note → Mind opens THAT note")
    ctx.close(); ctx, page = fresh(); card(page, "Ahmed Kamal")
    # 4 the date → Dates, its own form
    line(page, "date:dz1").click(); page.wait_for_selector("[data-testid=radar-form]", timeout=8000)
    check(page.locator("[data-testid=radar-title]").first.input_value() == "Ahmed Kamal car licence", "tap the licence → Dates opens THAT date's form")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    # Arabic
    ctx.close(); ctx, page = fresh("localStorage.setItem('attune:ui:lang','ar');"); card(page, "Ahmed Kamal")
    t2 = line(page, "tx:t2").inner_text()
    check("ممكن يكون Ahmed Kamal تاني" in t2, "Arabic: «ممكن يكون … تاني» on the maybe line: " + t2.replace("\n", " ")[:80])
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
env.close(); finish()
