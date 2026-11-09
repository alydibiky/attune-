"""v9.2 The flight agent (Ali, 4 Nov 2026: "the cheapest flight tickets with the modifications I want" — 3A: organised when there is more than
one option, and the tickets from many places). One sentence → an agent; Check now reads 6 sites in one window; the same flight on several
sites is one row; Cheapest · Fastest · Direct · Best time; the cheapest price per day; rules change the answer.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v922flights.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
AGENT = """(() => { function w(){ const N = window.AttuneNative; if (!N) return setTimeout(w, 5); N.agentWatchPlan = () => 'ok'; N.agentWatchTake = () => '{}'; N.appsList = () => '[]';
  N.agentOpen = (id, arg) => { const a = JSON.parse(arg); window.__opens = (window.__opens || []).concat([a]);
    const cards = { Kayak: [[9790, 'Thu, Jan 8 7:40 am – 9:50 am EgyptAir nonstop 2h 10m'], [8900, 'Thu, Jan 8 11:15 pm – 4:05 am flynas 1 stop 4h 50m'], [9950, 'Wed, Jan 7 6:45 pm – 9:00 pm Nile Air nonstop 2h 15m']],
      'Google Flights': [[9840, '7:40 AM – 9:50 AM EgyptAir 2 hr 10 min CAI–JED Nonstop'], [10120, 'Fri, Jan 9 10:15 AM – 12:30 PM Saudia 2 hr 15 min Nonstop']],
      Skyscanner: [[9810, 'Thu, Jan 8 07:40 – 09:50 EgyptAir Direct 2h 10']] };
    const rs = a.rounds || [];
    const top = rs.flatMap((r) => (cards[r.checkin] || []).map(([p, t]) => ({ price: p, currency: 'EGP', name: '', text: t, href: 'https://book.example/' + r.checkin.replace(/ /g, '') + '/' + p, checkin: r.checkin, checkout: '', url: r.url })));
    setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ reason: 'done', offers: top.length, price: 8900, currency: 'EGP', checkin: 'Kayak', top })), 30); };
  N.openInApp = (u) => { window.__booked = u; return JSON.stringify({ ok: true, how: 'app' }); };
} w(); })();"""
def go(page, m): page.evaluate("(m) => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", m); page.wait_for_timeout(700)
def txt(loc): return loc.inner_text().replace('\u2066', '').replace('\u2069', '')
def agents(page): return json.loads(page.evaluate("localStorage.getItem('attune:agents:v1')"))["agents"]
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=AGENT)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_timeout(1200); go(page, "agents")
    check(page.locator("[data-testid=agents-chip-flight]").count() == 1, "a “Cheapest flight” example chip")
    page.fill("[data-testid=agents-input]", "cheapest flight from Cairo to Jeddah on 8 January 2027, ± 3 days, return 13 January 2027")
    page.click("[data-testid=agents-go]"); page.wait_for_timeout(200); (page.locator("[data-testid=agent-plan-start]").count() and page.click("[data-testid=agent-plan-start]"))  # v9.9.13 AH1: the plan first, then Start; page.wait_for_timeout(800)
    a = [x for x in agents(page) if x.get("fields") and x["fields"].get("flight")]
    check(len(a) == 1 and len(a[0]["tries"]) == 6 and a[0]["fields"]["flight"]["from"] == "CAI" and a[0]["fields"]["flight"]["to"] == "JED", "one sentence → a flight agent over 6 sites (CAI → JED)")
    card = page.locator("[data-testid=agent-watch]").first
    check("6 sites" in txt(card) and "under" not in txt(card), "its card: 6 sites, no limit said → no “under 0”")
    card.locator("[data-testid=agent-check]").click(); page.wait_for_selector("[data-testid=flight-board]", timeout=8000)
    opens = page.evaluate("window.__opens")
    check(len(opens) == 1 and [r["checkin"] for r in opens[0]["rounds"]] == ["Kayak", "momondo", "Google Flights", "Skyscanner", "Expedia", "Wego"], "Check now: ONE window goes from site to site")
    check("4 flights" in txt(page.locator("[data-testid=flight-count]")), "6 offers from 3 sites → 4 flights (the same EgyptAir flight on 3 sites is one row)")
    best = page.inner_text("[data-testid=flight-best]")
    check("flynas" in best and "8,900" in best, "the answer first: the cheapest flight, flynas 8,900: " + best.replace("\n", " · ")[:120])
    tabs = page.evaluate("[...document.querySelectorAll('[data-testid^=flight-tab-]')].map(e => e.dataset.testid.slice(11))")
    check(tabs == ["cheapest", "fastest", "direct", "bestTime"], "Cheapest · Fastest · Direct · Best time: %s" % tabs)
    page.click("[data-testid=flight-tab-direct]"); page.wait_for_timeout(200)
    best = page.inner_text("[data-testid=flight-best]")
    check("EgyptAir" in best and "9,790" in best and "3 sites" in txt(page.locator("[data-testid=flight-best-sites]")), "Direct: EgyptAir 9,790 — on 3 sites, cheapest on Kayak: " + txt(page.locator("[data-testid=flight-best-sites]")))
    check(page.locator("[data-testid=flight-day]").count() == 3, "the cheapest price of each day (7, 8, 9 Jan)")
    check(page.locator("[data-testid=flight-row]").count() == 3, "the other flights by price, one row each")
    page.click("[data-testid=flight-book]"); page.wait_for_timeout(200)
    check("Kayak" in (page.evaluate("window.__booked") or ""), "Book opens that flight on the site where it was cheapest")
    # a rule changes the answer
    card.locator("[data-testid=agent-menu]").click(); card.locator("[data-testid=agent-rules-open]").click()
    card.locator("[data-testid=agent-rule-input]").fill("direct only, morning"); card.locator("[data-testid=agent-rule-go]").click(); page.wait_for_timeout(400)
    page.click("[data-testid=flight-tab-cheapest]"); page.wait_for_timeout(200)
    check("EgyptAir" in page.inner_text("[data-testid=flight-best]") and "hidden by your rules" in page.inner_text("[data-testid=flight-board]"), "“direct only, morning” → EgyptAir is the cheapest that fits; the rest say they were hidden")
    check(page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), "no sideways scroll")
    errs = real_errors(errors)
    check(not errs, "no page errors: %s" % errs[:3])
env.close()
finish()
