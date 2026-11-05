"""v9.3 (Ali picked D2 — "do all and make people choose"): the app keeps the two home-screen widgets up to date and applies the ticks made
on them (a stand-in for the phone's TodoWidget.kt).
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v930widgets.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
NOW = datetime.datetime(2026, 11, 5, 13, 0, 0)
ms = lambda d: int(d.timestamp() * 1000)
REM = [{"id": "a", "at": ms(datetime.datetime(2026, 11, 5, 11, 0)), "title": "Call the insurance company", "repeat": "none"},
       {"id": "b", "at": ms(datetime.datetime(2026, 11, 5, 17, 0)), "title": "Pay the maid", "repeat": "none"}]
LISTS = {"lists": [{"id": "l1", "name": "Travel checklist", "emoji": "🧳", "items": [{"id": "i1", "text": "Passport", "done": False}, {"id": "i2", "text": "Charger", "done": False}], "repeat": {"every": "once"}, "created": ms(NOW) - 864e5, "cycle": ""}]}
INIT = ("try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:reminders:v1', %s);localStorage.setItem('attune:lists:v1', %s);"
        "localStorage.setItem('attune:dayset:v1', JSON.stringify({prayers:true}))}catch(e){}") % (json.dumps(json.dumps(REM)), json.dumps(json.dumps(LISTS)))
MOCK = """(() => { window.__w = { todo: null, list: null, ticks: [] }; function w(){ const N = window.AttuneNative; if (!N) return setTimeout(w, 5);
  N.setTodoWidget = (j) => { window.__w.todo = JSON.parse(j); return true; }; N.setListWidget = (j) => { window.__w.list = JSON.parse(j); return true; };
  N.widgetTicks = () => JSON.stringify(window.__w.ticks); N.clearWidgetTicks = () => { window.__w.ticks = []; }; } w(); })();"""
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + ";" + MOCK)
    ctx.clock.set_fixed_time(NOW)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=your-day]", timeout=15000); page.wait_for_timeout(2500)
    t = page.evaluate("window.__w.todo") or {}
    check([r["text"] for r in t.get("rows", [])][:2] == ["Call the insurance company", "Pay the maid"] and t["rows"][0]["sub"] == "late", "the To-dos widget gets today's reminders, the late one first: %s" % t.get("rows"))
    check(t.get("side", "").startswith("Asr"), "…and the next prayer, because prayer times are on: %s" % t.get("side"))
    check(t.get("foot", "") == "", "…no money on it (Safe to spend on the widget is off)")
    lw = page.evaluate("window.__w.list") or {}
    check(lw.get("rows") == [], "no list pinned yet → the list widget says how to pin one")
    # pin the travel list
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'lists'}}))"); page.wait_for_selector("[data-testid=lists-page]")
    page.click("[data-testid=lists-row-head]"); page.click("[data-testid=lists-pin]"); page.wait_for_timeout(500)
    lw = page.evaluate("window.__w.list") or {}
    check("Travel checklist" in lw.get("title", "") and len(lw.get("rows", [])) == 2 and lw.get("side") == "0 of 2", "Pin to the widget → the list widget shows the travel list, 0 of 2")
    # ticks made on the home screen
    page.evaluate("window.__w.ticks = [{which:'todo', kind:'rem', id:'a', at: Date.now()}, {which:'list', kind:'list', id:'l1|i1', at: Date.now()}]")
    page.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); page.wait_for_timeout(800)
    rem = json.loads(page.evaluate("localStorage.getItem('attune:reminders:v1')"))
    lists = json.loads(page.evaluate("localStorage.getItem('attune:lists:v1')"))
    check([r for r in rem if r["id"] == "a"][0].get("done") is True and lists["lists"][0]["items"][0]["done"] is True, "ticks from the home screen are applied when Attune comes back: the call is done, Passport is ticked")
    check(page.evaluate("window.__w.ticks.length") == 0 and [r["text"] for r in page.evaluate("window.__w.todo.rows")] == ["Pay the maid"], "…the ticks are cleared and the widget updated")
    errs = real_errors(errors)
    check(not errs, "no page errors: %s" % errs[:3])
env.close()
finish()
