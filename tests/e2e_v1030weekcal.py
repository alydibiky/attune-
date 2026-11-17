"""v10.3 K1 + G1 G2 G3 (Ali, 17 Nov 2026: picked K1 — "I want the calendar to look very good" — and OK-G1 OK-G2 OK-G3):
the computer's Home has this week as a real calendar (things at their hour, a now line, an all-day lane, a trip as one bar), a tap opens
the thing on the right, Day / Week / Month and ‹ Today › work; under it safe to spend, agents, latest. The computer wears glass by default
(dark and light); the phone keeps its plain look and can pick Glass in Settings → Theme (no live blur there).
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v1030weekcal.py
"""
import json, os, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
today = datetime.date.today()
def d(n): return (today + datetime.timedelta(days=n)).isoformat()
def ms(day, h, m=0): return int(datetime.datetime.combine(today + datetime.timedelta(days=day), datetime.time(h, m)).timestamp() * 1000)
REM = [{"id": "r1", "title": "Call back Mama", "at": ms(0, 23, 50), "repeat": "none"}]
LIFE = {"items": [{"id": "s1", "kind": "installment", "dir": "in", "person": "Sheikh", "title": "car", "amount": 2500, "currency": "EGP", "start": d(0), "every": "month", "count": 8, "paid": []}]}
LEDGER = {"currency": "EGP", "accounts": [{"id": "a", "currency": "EGP", "name": "CIB", "start": 30000}], "recurring": [], "txns": [
    {"id": "t1", "date": d(0), "type": "expense", "amount": 1160, "note": "CIB transfer", "account": "a", "ts": ms(0, 0, 5)},
    {"id": "t2", "date": d(0), "type": "expense", "amount": 800, "note": "FACES", "account": "a"}]}
TRIP = {"depart": d(1), "ret": d(9), "to": "Umrah · Makkah"}
def init(theme=None):
    s = ("try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:coach:v1',JSON.stringify({seen:['*']}));"
         "localStorage.setItem('attune:reminders:v1',%s);localStorage.setItem('attune:life:v1',%s);localStorage.setItem('ledger.v3',%s);localStorage.setItem('attune:trip:v1',%s);"
         % tuple(json.dumps(json.dumps(x)) for x in (REM, LIFE, LEDGER, TRIP)))
    if theme: s += "localStorage.setItem('attune:theme:v1',%s);" % json.dumps(json.dumps(theme))
    return s + "}catch(e){};"
with sync_playwright() as p:
    br = p.chromium.launch()
    # ---- the computer: glass by default, the week in the middle of Home ----
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=init(), desktop=(1440, 900))
    page.goto(env.url); page.wait_for_selector("[data-testid=wk]", timeout=15000); page.wait_for_timeout(700)
    check(page.evaluate("document.documentElement.classList.contains('att-glass') && document.documentElement.classList.contains('att-glass-blur')"), "a computer wears the glass look, with real blur")
    bg = page.evaluate("getComputedStyle(document.body).backgroundImage")
    check("gradient" in bg, "the glass ground is drawn under everything: " + bg[:60])
    check(page.locator("[data-testid=wk-day]").count() == 7, "seven days side by side")
    ev = page.locator("[data-testid=wk-ev]")
    texts = " | ".join(ev.all_inner_texts())
    check("Call back Mama" in texts and "CIB transfer" in texts, "things at their hour: " + texts.replace("\n", " ")[:160])
    check(page.locator("[data-testid=wk-ev][data-kind=people]", has_text="Mama").count() == 1, "«Call back Mama» is a people thing (green)")
    lane = page.inner_text("[data-testid=wk-allday]")
    check("Sheikh" in lane and "2,500" in lane and "FACES" in lane, "the all-day lane: Sheikh's +2,500 and FACES (no time): " + lane.replace("\n", " ")[:160])
    check(page.locator("[data-testid=wk-allday-item][data-kind=trip]").count() == 1, "the trip is one bar")
    check(page.locator("[data-testid=wk-now]").count() == 1, "a line for now on today")
    page.locator("[data-testid=wk-ev]", has_text="Mama").click(); page.wait_for_timeout(300)
    det = page.inner_text("[data-testid=wk-detail]")
    check("Call back Mama" in det and "23:50" in det, "a tap opens it on the right: " + det.replace("\n", " ")[:120])
    check(page.locator("[data-testid=wk-open]").count() == 1, "with Open (its own page)")
    if SHOTS: page.locator("[data-testid=wk]").screenshot(path=os.path.join(SHOTS, "wk-dark-glass.png"))
    page.click("[data-testid=wk-detail-close]"); page.click("[data-testid=wk-next]"); page.wait_for_timeout(300)
    check(page.locator("[data-testid=wk-now]").count() == 0 and page.locator("[data-testid=wk-allday-item][data-kind=trip]").count() == 1, "› next week: no now line; the trip carries on")
    page.click("[data-testid=wk-today]"); page.click("[data-testid=wk-view-month]"); page.wait_for_timeout(500)
    check(page.locator("[data-testid=wk-mday]").count() >= 28, "Month: the whole month")
    page.click("[data-testid=wk-view-day]"); page.wait_for_timeout(300)
    check(page.locator("[data-testid=wk-day]").count() == 1, "Day: one day")
    page.click("[data-testid=wk-view-week]")
    und = page.inner_text("[data-testid=wk-under]")
    check("Safe to spend" in und and "Latest" in und and "CIB transfer" in und, "under the week: safe to spend, agents, latest: " + und.replace("\n", " ")[:140])
    check(page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), "no sideways scroll on the computer")
    ctx.close()
    # light glass in the phone's colours
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=init({"accent": "burgundy", "bg": "light", "look": "glass", "a43": 1, "v87": 1, "v95": 1}), desktop=(1440, 900))
    page.goto(env.url); page.wait_for_selector("[data-testid=wk]", timeout=15000); page.wait_for_timeout(600)
    acc = page.evaluate("getComputedStyle(document.querySelector('[data-testid=desk-home]')).getPropertyValue('--c-acc').trim()")
    check(page.evaluate("document.documentElement.classList.contains('att-light')") and acc.upper() == "#7A1F3D", "light glass: the phone's burgundy (%s)" % acc)
    if SHOTS: page.locator("[data-testid=wk]").screenshot(path=os.path.join(SHOTS, "wk-light-glass.png"))
    ctx.close()
    # ---- the phone: plain by default; Glass is a choice in Theme, without live blur ----
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=init())
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000); page.wait_for_timeout(500)
    check(not page.evaluate("document.documentElement.classList.contains('att-glass')"), "a phone stays plain until you pick Glass")
    page.click("[data-testid=home-menu]"); page.wait_for_selector("[data-testid=phone-side]")
    page.click("[data-testid=phone-side] [data-testid=side-settings]"); page.wait_for_selector("[data-testid=more-settings]"); page.wait_for_timeout(300)
    if page.locator("[data-testid=look-glass]").count():
        page.locator("[data-testid=look-glass]").first.click(); page.wait_for_timeout(300)
        check(page.evaluate("document.documentElement.classList.contains('att-glass') && !document.documentElement.classList.contains('att-glass-blur')"), "Glass picked on the phone: glass on, no live blur")
        check(json.loads(page.evaluate("localStorage.getItem('attune:theme:v1')")).get("look") == "glass", "the choice is kept")
    else:
        check(False, "Settings → Theme → Look (Glass) not found on the phone")
    check(page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), "no sideways scroll on the phone")
    check(not real_errors(errors), "no JavaScript errors: %s" % real_errors(errors)[:2])
    ctx.close(); br.close()
env.close(); finish()
