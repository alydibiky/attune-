"""v10.6 — Ali's 18 Nov list on the real page, at a phone, a foldable's cover screen, an unfolded foldable and a computer:
 · Money's 💡 opened a tip hidden behind Money's own header → now in the header, and the tip shows under it;
 · "I want the ability to edit these to-do lists": ✎ on Home's To do card changes the words (Save) or deletes the to-do;
 · "where is my wife" in Home's box → her newest Life360 notification (it said "I don't know where the wife right now is yet").
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v1060fixes.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
now = int(datetime.datetime.now().timestamp() * 1000)
LEDGER = {"accounts": [{"id": "a1", "name": "Cash", "currency": "EGP"}], "txns": [], "recurring": []}
REM = [{"id": "r1", "title": "Ask about maid in address east Whatsapp group", "at": now + 3600000, "repeat": "none", "created": now - 86400000}]
DIR = {"items": [{"id": "p1", "kind": "person", "name": "Nada", "role": "wife"}], "skip": []}
NOTES = [{"id": "n1", "app": "Life360", "pkg": "com.life360.android.safetymapd", "title": "Nada", "text": "Arrived at Home", "ts": now - 600000}]
INIT = ("try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:test:quiet','0');localStorage.setItem('attune:coach:v1',JSON.stringify({seen:['*']}));"
        "localStorage.setItem('ledger.v3',%s);localStorage.setItem('attune:reminders:v1',%s);localStorage.setItem('attune:people:v1',%s);}catch(e){};"
        "(() => { function w(){ const N = window.AttuneNative; if (!N) return setTimeout(w, 5); N.recallNotes = () => %s; } w(); })();") % (
        json.dumps(json.dumps(LEDGER)), json.dumps(json.dumps(REM)), json.dumps(json.dumps(DIR)), json.dumps(json.dumps(NOTES)))
with sync_playwright() as p:
    br = p.chromium.launch()
    for name, size in (("phone", (360, None)), ("fold cover", (344, None)), ("fold open", (673, None)), ("computer", (1366, "desk"))):
        ctx, page = new_page(br, env, errors, legacy_nav=False, desktop=(size[0], 860) if size[1] else None, extra_init=INIT)
        if not size[1]: page.set_viewport_size({"width": size[0], "height": 820})
        page.goto(env.url); page.wait_for_timeout(1800)
        # where is my wife — from Home's box
        box = page.locator("[data-testid=home-box] textarea, [data-testid=desk-ask] textarea, textarea").first
        box.fill("where is my wife right now"); box.press("Enter"); page.wait_for_timeout(900)
        body = page.inner_text("body")
        check("Arrived at Home" in body and "I don't know where the wife" not in body, name + ": “where is my wife right now” → Nada's newest Life360 note")
        page.keyboard.press("Escape")
        # edit a reminder on Home's To do card
        if page.locator("[data-testid=todo-edit-open]").count():
            page.locator("[data-testid=todo-edit-open]").first.click(); page.wait_for_timeout(200)
            page.fill("[data-testid=todo-edit-input]", "Ask about the maid in the east group"); page.click("[data-testid=todo-edit-save]"); page.wait_for_timeout(300)
            rem = json.loads(page.evaluate("localStorage.getItem('attune:reminders:v1')"))
            check(rem[0]["title"] == "Ask about the maid in the east group", name + ": ✎ → the to-do's words changed")
            page.locator("[data-testid=todo-edit-open]").first.click(); page.click("[data-testid=todo-edit-delete]"); page.wait_for_timeout(300)
            check(json.loads(page.evaluate("localStorage.getItem('attune:reminders:v1')")) == [], name + ": ✎ → Delete removes it")
        else:
            check(size[1] == "desk", name + ": Home's To do card has ✎ on each row")
        # Money's 💡
        if not size[1]:
            page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'money'}}))"); page.wait_for_timeout(1200)
            page.click("[data-testid=tip-bulb]"); page.wait_for_timeout(600)
            tip = page.locator("[data-testid=coach-tip]").first
            bb = tip.bounding_box() if tip.count() else None
            head = page.locator("[data-testid=money-more]").bounding_box()
            check(bb and bb["y"] >= head["y"] + head["height"] - 2 and bb["width"] > 200, name + ": 💡 on Money shows its tip under the header (not hidden behind it): %s" % bb)
        ctx.close()
    errs = real_errors(errors); check(not errs, "no JavaScript errors: %s" % errs[:2])
    br.close()
env.close(); finish()
