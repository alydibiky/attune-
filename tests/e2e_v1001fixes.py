"""v10.0.1 — Ali's 8 phone screenshots of 16 Nov 2026, on the real pages:
ONE Autopilot card with ONE "Done for you" (the old chat to-dos are not listed again); "What are the talabat" in Chat shows the
list's items; a list item can be reworded and deleted; Pin to the widget asks the phone to add the widget; Follow-ups says
"Baba pays" for a subscription Baba pays; "Who is this?" shows the payment the name came from.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v1001fixes.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
NOW = datetime.datetime.now().replace(hour=14, minute=0, second=0, microsecond=0)
now = int(NOW.timestamp() * 1000)
def wa(i, title, text, ago, who):
    return {"id": "n" + str(i), "app": "WhatsApp", "pkg": "com.whatsapp", "title": title, "text": text, "ts": now - ago * 60000, "group": True, "convo": title, "who": who}
NOTES = [wa(1, "Talabat", "tortilla", 30, "Noudy"), wa(2, "Talabat", "chicken strips", 25, "Noudy"), wa(3, "Talabat", "Fitness for", 20, "Noudy")]
ROLES = {"whatsapp|g:talabat": {"role": "shopping", "ok": True, "by": "attune", "care": [], "whenMe": False, "people": []}}
# what the OLD Autopilot had done before v10.0: a chat to-do (must not be listed again) and a real expense (stays)
AP = {"done": [{"key": "td:noudy:1", "kind": "todo", "title": "Talabat: Noudy requested chicken strips.", "app": "WhatsApp", "at": now - 3600000},
               {"key": "x:65000:" + NOW.strftime("%Y-%m-%d"), "kind": "expense", "title": "", "app": "CIB", "amount": 650, "at": now - 1800000}], "ok": {}}
nxt = (NOW + datetime.timedelta(days=5)).strftime("%Y-%m-%d")
LIFE = {"v": 1, "items": [{"id": "c1", "created": 1, "person": "", "currency": "USD", "start": nxt, "every": "month", "paid": [], "title": "Claude", "kind": "subscription", "dir": "out", "amount": 22.8, "count": 0, "total": 0, "payer": "Baba"},
                          {"id": "c2", "created": 1, "person": "", "currency": "EGP", "start": nxt, "every": "month", "paid": [], "title": "Gym", "kind": "subscription", "dir": "out", "amount": 500, "count": 0, "total": 0, "payer": "me"}]}
LEDGER = {"currency": "EGP", "accounts": [{"id": "a", "currency": "EGP", "name": "Cash"}], "txns": [{"id": "t1", "date": NOW.strftime("%Y-%m-%d"), "type": "expense", "amount": 650, "note": "paid Hany for the haircut", "cat": "other", "account": "a"}]}
MOCK = "(() => { const notes = %s; window.__pins = 0; function w(){ const N = window.AttuneNative; if (!N) return setTimeout(w, 5); N.recallNotes = () => JSON.stringify(notes); N.setTodoWidget = () => true; N.setListWidget = () => true; N.widgetTicks = () => '[]'; N.pinListWidget = () => { window.__pins++; return 'asked'; }; } w(); })();" % json.dumps(NOTES)
INIT = ("try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:test:quiet','0');localStorage.setItem('attune:coach:v1',JSON.stringify({seen:['*']}));"
        "if(!localStorage.getItem('t:seeded')){localStorage.setItem('t:seeded','1');localStorage.setItem('attune:chatroles:v1',%s);localStorage.setItem('attune:autopilot:v1',%s);localStorage.setItem('attune:life:v1',%s);localStorage.setItem('ledger.v3',%s);}}catch(e){};"
        % tuple(json.dumps(json.dumps(x)) for x in (ROLES, AP, LIFE, LEDGER))) + MOCK
def open_mode(page, m, sel):
    page.evaluate("(m) => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", m); page.wait_for_selector(sel, timeout=8000)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    ctx.clock.set_fixed_time(NOW)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_selector("[data-testid=cp-line]", timeout=15000); page.wait_for_timeout(600)
    # 1. one Autopilot card, one "Done for you"
    check(page.locator("[data-testid=autopilot]").count() == 1 and page.locator("[data-testid=chatpilot]").count() == 1, "ONE Autopilot card on Home")
    check(page.locator("text=Done for you").count() == 1, "ONE “Done for you” (was two): %d" % page.locator("text=Done for you").count())
    card = page.locator("[data-testid=autopilot]").inner_text()
    check("requested chicken strips" not in card, "the old Autopilot's chat to-do is not listed again")
    check("650" in card and page.locator("[data-testid=autopilot-undo]").count() == 1, "the expense it added by itself stays under the same heading, with Undo")
    check("Added chicken strips to Talabat" in card, "the chat lines are there (Added chicken strips to Talabat)")
    # 2. Chat: "What are the talabat" → the items themselves
    open_mode(page, "chat", "[data-testid=chat-input]")
    page.fill("[data-testid=chat-input]", "What are the talabat"); page.keyboard.press("Enter"); page.wait_for_timeout(900)
    body = page.inner_text("body")
    check("items still to buy" in body and "tortilla" in body and "chicken strips" in body and "messages kept" not in body, "“What are the talabat” → the 3 items still to buy (not “11 messages kept”)")
    # 3. To-dos & lists: reword one item, delete one, pin
    open_mode(page, "lists", "[data-testid=lists-page]")
    page.locator("[data-testid=lists-row-head]").first.click(); page.wait_for_selector("[data-testid=lists-item-row]", timeout=3000)
    check(page.locator("[data-testid=lists-item-rename]").count() == 3 and page.locator("[data-testid=lists-item-delete]").count() == 3, "every item has Edit and Delete")
    row = page.locator("[data-testid=lists-item-row]", has_text="Fitness for")
    row.locator("[data-testid=lists-item-rename]").click(); page.fill("[data-testid=lists-item-edit-input]", "Fitness toast"); page.click("[data-testid=lists-item-edit-save]"); page.wait_for_timeout(200)
    page.locator("[data-testid=lists-item-row]", has_text="tortilla").locator("[data-testid=lists-item-delete]").click(); page.wait_for_timeout(200)
    items = [i["text"] for i in page.evaluate("JSON.parse(localStorage.getItem('attune:lists:v1')).lists[0].items")]
    check(items == ["chicken strips", "Fitness toast"], "“Fitness for” → “Fitness toast”, tortilla deleted: %s" % items)
    page.click("[data-testid=lists-pin]"); page.wait_for_timeout(300)
    check(page.evaluate("window.__pins") == 1 and page.locator("text=tap “Add” on the phone's question").count() > 0, "Pin to the widget asks the phone to add the widget, and says so")
    check(page.locator("[data-testid=lists-pin]").inner_text() == "Take it off the widget", "…and the list is the pinned one")
    # 4. Follow-ups: who pays
    open_mode(page, "timeline", "[data-testid=timeline-page]")
    if page.locator("[data-testid=fu-coming-all]").count() == 0 and page.locator("[data-testid=fu-coming-toggle]").count(): page.click("[data-testid=fu-coming-toggle]"); page.wait_for_timeout(200)
    rows = {r.inner_text().split("\n")[0]: r.locator("[data-testid=fu-kind]").inner_text() for r in page.locator("[data-testid=timeline-item]").all()}
    cl = next((v for k, v in rows.items() if "Claude" in k), ""); gy = next((v for k, v in rows.items() if "Gym" in k), "")
    check("Baba pays" in cl and "You pay" not in cl, "Claude (Baba pays it) says “Baba pays”, not “You pay”: %s" % cl)
    check("You pay" in gy, "Gym (you pay it) still says “You pay”: %s" % gy)
    # 5. People: "Who is this?" shows where the name came from
    open_mode(page, "people", "[data-testid=people-page]")
    row = page.locator("[data-testid=people-ask-row]", has_text="Hany")
    check(row.count() == 1 and "paid Hany for the haircut" in row.locator("[data-testid=people-ask-seen]").first.inner_text() and "650" in row.inner_text() and "Money" in row.inner_text(),
          "“Who is this? Hany” shows the payment it came from (the note, 650, Money): %s" % (row.inner_text().replace("\n", " | ") if row.count() else "no row"))
    # no sideways scroll on the phone
    check(page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), "nothing wider than the phone")
    errs = real_errors(errors); check(not errs, "no JavaScript errors: %s" % errs[:2])
    br.close()
env.close(); finish()
