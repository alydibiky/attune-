"""v9.6 Ali's picks (5 Nov 2026, MOCKUPS.md): Agents = board + conversation with offers on several dates (A3 + A4);
Month plan = Month · Calendar · Table with goals that fill themselves (P2 + P4 + P5 + P6); Follow-ups = week strip + list by day (F4 + F1).
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v960picks.py
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
  {"id": "md", "kind": "regular", "title": "Maid", "dir": "out", "amount": 600, "every": "week", "start": "2026-11-07", "currency": "EGP", "paid": [], "created": 2},
  {"id": "gd", "kind": "regular", "title": "Gardener", "dir": "out", "amount": 400, "every": "week", "start": "2026-11-02", "currency": "EGP", "paid": [], "created": 3},
  {"id": "cl", "kind": "regular", "title": "Cleaner", "dir": "out", "amount": 900, "every": "month", "start": "2026-10-20", "currency": "EGP", "paid": [], "created": 4}]}
POTS = {"v": 1, "pots": [{"id": "pot1", "name": "House", "kind": "other", "target": 120000, "by": "2027-12", "saved": 22000, "per": 0, "log": []}]}
INIT = ("try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:agents:view2','board');localStorage.setItem('ledger.v3', %s);localStorage.setItem('attune:agents:v1', %s);"
        "localStorage.setItem('attune:life:v1', %s);localStorage.setItem('attune:pots:v1', %s)}catch(e){}") % tuple(json.dumps(json.dumps(x)) for x in (L, AGENTS, LIFE, POTS))
MOCK = """(() => { window.__w = { opened: [] }; function w(){ const N = window.AttuneNative; if (!N) return setTimeout(w, 5);
  N.openInBrowser = (u) => { window.__w.opened.push(u); return true; }; } w(); })();"""
def open_mode(page, m, sel):
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'%s'}}))" % m); page.wait_for_selector(sel, timeout=10000); page.wait_for_timeout(300)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + ";" + MOCK)
    ctx.clock.set_fixed_time(NOW)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_timeout(1200)
    # ---- A3 + A4 ----
    open_mode(page, "agents", "[data-testid=agents-board]")
    cols = [page.locator("[data-testid=agents-col-%s]" % k).count() for k in ("working", "found", "done")]
    check(cols == [1, 1, 1], "the Agents page opens on the board: Watching · Found · Done")
    found = page.locator("[data-testid=agents-col-found] [data-testid=agents-board-card]")
    check(found.count() == 1 and "dates" in found.first.inner_text(), "the hotels agent sits in Found and says how many offers on how many dates: " + found.first.inner_text().replace("\n", " "))
    found.first.click(); page.wait_for_selector("[data-testid=agent-chat]")
    check("Haram" in page.locator("[data-testid=agent-chat]").inner_text(), "a tap opens the agent's conversation, starting with what you asked")
    dates = page.locator("[data-testid=agent-grid-date]")
    check(dates.count() == 3, "more than 1 option on more than 1 date: 3 dates in the grid (%d)" % dates.count())
    check(page.locator("[data-testid=agent-grid-offer]").count() + page.locator("[data-testid=agent-grid-best]").count() == 6 and page.locator("[data-testid=agent-grid-best]").count() == 1, "6 offers, the cheapest marked")
    page.locator("[data-testid=agent-grid-offer]").first.click(); page.wait_for_timeout(200)
    op = page.evaluate("window.__w.opened")
    check(len(op) == 1 and "booking.com/hotel/sa/" in op[0] and "checkin=" in op[0], "an offer opens that exact hotel on its dates, in the phone's browser: " + str(op))
    page.fill("[data-testid=agent-chat-input]", "only 5 stars"); page.click("[data-testid=agent-chat-send]"); page.wait_for_timeout(300)
    rules = json.loads(page.evaluate("localStorage.getItem('attune:agents:v1')"))["agents"][0].get("rules", {})
    check(rules.get("stars") == 5 or rules.get("minStars") == 5 or "5" in json.dumps(rules), "typing a rule in the conversation changes the agent: " + json.dumps(rules))
    check("only 5 stars" in page.locator("[data-testid=agent-chat]").inner_text(), "…and it stays in the conversation")
    page.click("[data-testid=agent-chat-back]"); page.wait_for_selector("[data-testid=agents-board]")
    check(True, "Back returns to the board")
    # ---- P2 + P4 + P5 + P6 ----
    open_mode(page, "planner", "[data-testid=planner-split]")
    t = page.locator("[data-testid=planner-split]").inner_text()
    check("40,000" in t and "5,100" in t and "34,900" in t, "Month: income − expenses = net (40,000 − 5,100 = 34,900)")
    check("goals" in page.locator("[data-testid=planner-net-goes]").inner_text().lower(), "…and where the net goes: the goals, the rest free")
    check(page.locator("[data-testid=planner-slider]").count() == 1, "each goal has a slider (P5)")
    pots = json.loads(page.evaluate("localStorage.getItem('attune:pots:v1')"))
    check(pots.get("since") == "2026-11", "the goals start filling from the November plan (nothing settled backwards)")
    page.click("[data-testid=planner-view-calendar]"); page.wait_for_selector("[data-testid=planner-calendar]")
    days = page.locator("[data-testid=planner-cal-day]")
    check(days.count() == 30, "Calendar: November's 30 days (P4)")
    check(page.locator("[data-testid=planner-cal-day][data-kind=in]").count() >= 1 and page.locator("[data-testid=planner-cal-day][data-kind=out]").count() >= 1, "green on days money came in, red on days it went out")
    page.click("[data-testid=planner-view-table]"); page.wait_for_selector("[data-testid=planner-table]")
    check(page.locator("[data-testid=planner-row]").count() >= 2 and "Seoudi" in page.locator("[data-testid=planner-table]").inner_text(), "Table: plan · spent · left per line (P6), names with notes")
    # ---- v9.9 FU6 replaced FU1 (tests in e2e_v990fu6.py); here: Sheikh's late payment is a question with its answer box
    open_mode(page, "timeline", "[data-testid=fu-thread]")
    asks = page.locator("[data-testid=fu-q][data-act=ask]")
    check(asks.count() == 1 and asks.first.locator("[data-testid=home-person-ask]").count() == 1, "FU6: Did Sheikh pay? — Paid · Other amount · Not yet")
    g = page.locator("[data-testid=fu-q][data-act=pay]")
    check(g.count() == 1 and "Gardener" in g.first.inner_text() and "Cleaner" not in page.inner_text("[data-testid=fu-thread]"), "Monday's gardener is asked; the cleaner 16 days ago is past the 7 days")
    check(not real_errors(errors), "no page errors: " + str(real_errors(errors))[:300])
    br.close()
finish()
