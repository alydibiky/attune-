"""v9.8 Ali's picks (7 Nov 2026, MOCKUPS.md https://claude.ai/artifact/2QaqFEiB5AyWHcmugbaZfC): C6 each area its own colour ·
A3 Agents = what changed on top + one quiet list · F1 Reminders = one box + list by day, the rest behind chips · D1 Documents =
library with kinds + one ask-all box on top.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v980picks.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
NOW = datetime.datetime(2026, 11, 5, 13, 0, 0)
ms = lambda d: int(d.timestamp() * 1000)
H = 3600000
def day(n): return (NOW + datetime.timedelta(days=n)).strftime("%Y-%m-%d")
OFF = [{"checkin": d, "checkout": "2026-12-%02d" % (int(d[-2:]) + 4), "name": n, "price": p, "currency": "EGP", "href": "https://www.booking.com/hotel/sa/%s.html" % n.lower()} for d, n, p in [
  ("2026-12-10", "Swissotel", 41800), ("2026-12-10", "Pullman", 43200), ("2026-12-10", "Hilton", 44900),
  ("2026-12-12", "Swissotel", 42500), ("2026-12-12", "Movenpick", 44100), ("2026-12-14", "Hilton", 43000)]]
AGENTS = {"usual": {}, "agents": [
  {"id": "h1", "kind": "watch", "on": True, "created": ms(NOW) - 5 * H, "title": "Hotels · Makkah", "said": "Tell me when hotels near the Haram are under 45k", "site": "Booking.com", "url": "https://www.booking.com/searchresults.html?ss=Makkah",
   "below": 45000, "currency": "EGP", "every": 360, "checks": [{"at": ms(NOW) - H, "price": 41800, "checkin": "2026-12-10", "checkout": "2026-12-14"}], "found": {"at": ms(NOW) - H, "price": 41800}, "best3": OFF, "byDay": None},
  {"id": "w2", "kind": "watch", "on": True, "created": ms(NOW) - 2 * H, "title": "AirPods Pro 2", "said": "AirPods Pro 2 under 9,000", "site": "Amazon", "url": "https://www.amazon.eg/s?k=airpods", "below": 9000, "currency": "EGP", "checks": []}]}
for a in AGENTS["agents"]:
    if a.get("byDay", 0) is None: del a["byDay"]
TX = [{"id": "i1", "type": "income", "amount": 40000, "account": "b", "cat": "salary", "date": "2026-11-01", "note": "Salary"},
      {"id": "e1", "type": "expense", "amount": 5100, "account": "b", "cat": "groceries", "date": "2026-11-03", "note": "Seoudi"}]
L = {"currency": "EGP", "accounts": [{"id": "b", "name": "Cash", "currency": "EGP", "start": 5000}], "txns": TX, "budgets": {"overall": 0, "cats": {}}, "recurring": [], "debts": [], "customCats": [], "goals": [], "projects": []}
LIFE = {"v": 1, "items": [{"id": "sh", "kind": "installment", "person": "Sheikh", "dir": "in", "amount": 2500, "total": 19500, "count": 8, "every": "month", "start": "2026-10-05", "currency": "EGP", "paid": [0], "created": 1},
  {"id": "md", "kind": "regular", "title": "Maid", "dir": "out", "amount": 600, "every": "week", "start": "2026-11-07", "currency": "EGP", "paid": [], "created": 2}]}
POTS = {"v": 1, "pots": [{"id": "pot1", "name": "House", "kind": "other", "target": 120000, "by": "2027-12", "saved": 22000, "per": 0, "log": []}]}
INIT = ("try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:agents:view2','new');localStorage.setItem('attune:rem:open','[]');localStorage.setItem('attune:reminders:v1', JSON.stringify([{id:'r1',title:'Call Ahmed',at:0,repeat:'none'},{id:'r2',title:'Pay the car wash',at:0,repeat:'none'}]));localStorage.setItem('ledger.v3', %s);localStorage.setItem('attune:agents:v1', %s);"
        "localStorage.setItem('attune:life:v1', %s);localStorage.setItem('attune:pots:v1', %s)}catch(e){}") % tuple(json.dumps(json.dumps(x)) for x in (L, AGENTS, LIFE, POTS))
MOCK = """(() => { window.__w = { opened: [] }; function w(){ const N = window.AttuneNative; if (!N) return setTimeout(w, 5);
  N.openInBrowser = (u) => { window.__w.opened.push(u); return true; }; N.agentOpen = (id, arg) => { window.__agentOpen = JSON.parse(arg); }; } w(); })();"""
def open_mode(page, m, sel):
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'%s'}}))" % m); page.wait_for_selector(sel, timeout=10000); page.wait_for_timeout(300)
with sync_playwright() as p:
    br = p.chromium.launch()
    init = INIT.replace("at:0,", "at:%d," % (ms(NOW) + 2 * H), 1).replace("at:0,", "at:%d," % (ms(NOW) + 26 * H), 1)
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=init + ";" + MOCK)
    ctx.clock.set_fixed_time(NOW)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_timeout(1200)
    # ---- A3: what changed on top, then one quiet list ----
    open_mode(page, "agents", "[data-testid=agents-new]")
    ch = page.locator("[data-testid=agents-change]")
    check(ch.count() == 1 and "41,800" in ch.first.inner_text() and "Found under your price" in ch.first.inner_text(), "A3: the hotel found under 45k is on top as new: " + (ch.first.inner_text().replace("\n", " · ") if ch.count() else ""))
    check(page.locator("[data-testid=agents-quiet] [data-testid=agents-row]").count() == 1 and "AirPods" in page.locator("[data-testid=agents-quiet]").inner_text(), "A3: the quiet one is one row in Watching")
    check(page.locator("[data-testid=agents-chips]").count() == 0 and page.locator("[data-testid=agents-board]").count() == 0, "A3: no starter tiles and no board on the page (one tap away)")
    page.click("[data-testid=agents-change-open]"); page.wait_for_timeout(200)
    ao = page.evaluate("window.__agentOpen") or {}
    check((ao.get("goto") or {}).get("price") == 41800 and (ao.get("goto") or {}).get("name") == "" and not page.evaluate("window.__w.opened"), "A3: Open the listing goes to THAT hotel (found on the results by name / price): %s" % (ao.get("goto") or page.evaluate("window.__w.opened")))
    # ---- C6: each area its own colour ----
    check(page.evaluate("document.documentElement.dataset.area") == "agents", "C6: the Agents page is the Agents area")
    acc = page.evaluate("getComputedStyle(document.querySelector('[data-testid=agents-page]')).getPropertyValue('--c-acc').trim()")
    check(acc.lower() in ("#2f5fa8", "#86aeea"), "C6: its accent is the Agents blue: %s" % acc)
    open_mode(page, "money", "[data-testid=money-page]")
    acc = page.evaluate("getComputedStyle(document.querySelector('[data-testid=money-page]').closest('.calm') || document.querySelector('[data-testid=money-page]')).getPropertyValue('--c-acc').trim()")
    check(page.evaluate("document.documentElement.dataset.area") == "money" and acc.lower() in ("#1e7a43", "#5bc48a"), "C6: Money is green: %s" % acc)
    open_mode(page, "home", "[data-testid=home-hero-money]")
    check(page.evaluate("document.documentElement.dataset.area") is None, "C6: Home has no area (its cards wear their own colours)")
    # ---- F1: one box + list by day ----
    open_mode(page, "reminders", "[data-testid=reminders-panel]")
    check(page.locator("[data-testid=rem-say]").count() == 1 and page.locator("[data-testid=rem-title]").count() == 0 and page.locator("[data-testid=watch-panel]").count() == 0, "F1: the box is the page; the fill-in form and message alerts wait behind chips")
    days = page.locator("[data-testid=rem-day]").all_inner_texts()
    check(len(days) == 2 and days[0].lower() == "today" and days[1].lower() == "tomorrow", "F1: the list by day: %s" % days)
    page.click("[data-testid=rem-chip-fill]"); page.wait_for_timeout(100)
    check(page.locator("[data-testid=rem-title]").count() == 1, "F1: Fill it in opens the form")
    page.click("[data-testid=rem-chip-alerts]"); page.wait_for_timeout(100)
    check(page.locator("[data-testid=watch-panel]").count() == 1, "F1: Message alerts open from their chip")
    # ---- D1: documents library + ask-all on top ----
    open_mode(page, "booklib", "[data-testid=booklib-page]")
    order = page.evaluate("[...document.querySelectorAll('[data-testid=booklib-form],[data-testid=booklib-shelf]')].map(e => e.dataset.testid)")
    check(order[:2] == ["booklib-form", "booklib-shelf"], "D1: the ask-all box is on top, then the library: %s" % order)
    check(page.evaluate("document.documentElement.dataset.area") == "docs", "D1 + C6: Documents is its own (violet) area")
    check(not real_errors(errors), "no JavaScript errors: %s" % real_errors(errors)[:3])
    br.close()
finish()
