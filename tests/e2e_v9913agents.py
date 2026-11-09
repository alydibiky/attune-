"""v9.9.13 Ali picked AG1 + AG2 + AC2 + AC3 + AH1 ("OK1") and "who pays it" ("OK2"). His hotel agent: the best on top with ↓ since
before, Book this, See 3 more; the chart of every date × hotel (a tap shows that hotel); "Checks by itself" (night while charging);
the plan in 4 lines; the old conversation behind History. A new watch says its plan before Start. The phone's "tap and I'll check"
opens the agent and checks it. The Google subscription asks "Who pays it?" — My father → nothing out of Money, reminded on the 7th.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v9913agents.py
"""
import json, time
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
now = int(time.time() * 1000); H = 3600000
AG = {"id": "h1", "kind": "watch", "on": True, "created": now - 50 * H, "title": "Hotels · Masjid al-Haram · 4 nights · 5★", "site": "Booking.com",
      "url": "https://www.booking.com/searchresults.html?ss=Mecca", "below": 45000, "currency": "EGP",
      "fields": {"nights": 4, "stars": [5], "near": True, "window": {"from": "2026-12-10", "to": "2027-01-24"}}, "rules": {},
      "checks": [{"at": now - 30 * H, "price": 42124}, {"at": now - 20 * H, "blocked": True}, {"at": now - H, "price": 41495, "how": "browser"}],
      "best3": [{"name": "Swissôtel Makkah", "price": 41495, "checkin": "2027-01-08", "checkout": "2027-01-12", "href": "https://www.booking.com/hotel/sa/swiss.html"},
                {"name": "Hilton Suites", "price": 42124, "checkin": "2027-01-04", "checkout": "2027-01-08", "href": "https://www.booking.com/hotel/sa/hilton.html"}],
      "byDay": [{"date": "2026-12-18", "checkout": "2026-12-22", "offers": [{"name": "Pullman Zamzam", "price": 43090}]},
                {"date": "2027-01-20", "checkout": "2027-01-24", "offers": [{"name": "Le Meridien", "price": 45092}, {"name": "Conrad", "price": 45711}]}]}
INIT = """try{localStorage.setItem('attune:start','home'); localStorage.setItem('attune:agents:v1', %s);}catch(e){}
(() => { function w(){ const N = window.AttuneNative; if (!N) return setTimeout(w, 5); window.__opened = [];
  N.agentWatchPlan = (p) => { window.__plan = JSON.parse(p); return 'ok'; }; N.agentWatchTake = () => '{}'; N.agentWatchWords = (j) => { window.__words = JSON.parse(j); return 'ok'; };
  N.openInApp = (u) => { window.__opened.push(u); return JSON.stringify({ok: true, how: 'app'}); };
  N.agentOpen = (id, arg) => { window.__checked = (window.__checked || 0) + 1; setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({reason: 'done', offers: 4, price: 41000, currency: 'EGP', top: []})), 50); }; } w(); })();""" % json.dumps(json.dumps({"agents": [AG], "usual": {}}))
def go(page, mode, sel):
    page.evaluate("m => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", mode); page.wait_for_selector(sel, timeout=8000); page.wait_for_timeout(300)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_timeout(1200)
    page.evaluate("localStorage.setItem('attune:agents:openchat','h1')")
    go(page, "agents", "[data-testid=agent-overview]")
    best = page.locator("[data-testid=agent-best]").inner_text()
    check("41,495" in best and "Swissôtel" in best, "AG1: the best so far on top — 41,495 Swissôtel: " + best.replace("\n", " ")[:90])
    check("629" in page.locator("[data-testid=agent-best-better]").inner_text(), "AG1: “↓ 629 since …” — better than before")
    check(page.locator("[data-testid=agent-chat] [data-testid=agent-dates-grid]").count() == 0 and page.locator("[data-testid=agent-history-toggle]").count() == 1, "AG1: the conversation and grid are behind History")
    page.click("[data-testid=agent-best-more]"); page.wait_for_timeout(150)
    check("Hilton Suites" in page.locator("[data-testid=agent-best-others]").inner_text(), "See more → the next hotels")
    check(page.locator("[data-testid=agent-chart-dot], [data-testid=agent-chart-best]").count() == 5 and page.locator("[data-testid=agent-chart-best]").count() == 1, "AG2: the chart has every date × hotel (5 dots, one best)")
    page.locator("[data-testid=agent-chart-dot]", has_text="Pullman").dispatch_event("click"); page.wait_for_timeout(150)
    check("Pullman Zamzam" in page.locator("[data-testid=agent-chart-pick]").inner_text(), "AG2: a tap on the Dec 18 dot shows that hotel (Pullman Zamzam, 43,090)")
    auto = page.locator("[data-testid=agent-auto]").inner_text()
    check("Every night while the phone charges on Wi-Fi" in auto and "beats your best" in auto, "AC2: “Checks by itself — every night while charging on Wi-Fi; tells you only when a price beats your best”")
    lines = [x.replace("\u2066", "").replace("\u2069", "") for x in page.locator("[data-testid=agent-plan-lines] [data-testid=agent-plan-line]").all_inner_texts()]
    check(len(lines) == 4 and "Booking.com" in lines[0] and "5★" in lines[1] and "45,000" in lines[3], "AH1: the plan in 4 lines: " + " | ".join(lines))
    page.click("[data-testid=agent-history-toggle]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=agent-chat] [data-testid=agent-watch]").count() == 1, "History › shows the old card and conversation")
    plan = page.evaluate("window.__plan")
    check(plan and all(x.get("best") == 41495 for x in plan), "AC2: the phone knows the best (41,495) — it tells only a better price")
    check(page.evaluate("window.__words && window.__words.ask") and "{site}" in page.evaluate("window.__words.ask"), "AC3: the phone gets the question's words in the person's language")
    # AH1: a new watch says its plan before Start
    page.click("[data-testid=agent-chat-back]"); page.wait_for_timeout(300)
    page.fill("[data-testid=agents-input]", "Tell me when an iPhone 16 Pro on Amazon is under 50000"); page.click("[data-testid=agents-go]"); page.wait_for_timeout(300)
    n0 = len(page.evaluate("JSON.parse(localStorage.getItem('attune:agents:v1')).agents"))
    check(page.locator("[data-testid=agents-plan]").count() == 1 and n0 == 1, "AH1: a new agent first shows “Here's what I'll do” — nothing started yet")
    page.click("[data-testid=agent-plan-start]"); page.wait_for_timeout(300)
    check(len(page.evaluate("JSON.parse(localStorage.getItem('attune:agents:v1')).agents")) == 2, "…Start → the agent is made")
    # AC3: the phone's "tap and I'll check" → the agent opens and is checked
    c0 = page.evaluate("window.__checked || 0")
    page.evaluate("localStorage.setItem('attune:agents:openchat','h1'); localStorage.setItem('attune:agents:checknow','h1')")
    go(page, "home", "body"); go(page, "agents", "[data-testid=agent-overview]"); page.wait_for_timeout(1200)
    check(page.evaluate("window.__checked || 0") > c0, "AC3: opening from the phone's question checks the agent by itself")
    # who pays it
    LIFE = {"v": 1, "items": [{"id": "s1", "kind": "subscription", "dir": "out", "title": "Google Gemini", "amount": 939.99, "currency": "EGP", "every": "month", "start": "2026-11-07", "count": 0, "total": 0, "paid": [0], "auto": True, "person": "", "created": now}]}
    page.evaluate("l => { localStorage.setItem('attune:life:v1', JSON.stringify(l)); localStorage.setItem('ledger.v3', JSON.stringify({txns: [], accounts: [{id: 'a', currency: 'EGP'}]})); }", LIFE)
    go(page, "home", "body"); go(page, "life", "[data-testid=life-page]")
    pa = page.locator("[data-testid=payer-ask]")
    check(pa.count() == 1 and "Google Gemini" in pa.inner_text() and "939.99" in pa.inner_text() and "Who pays it?" in pa.inner_text(), "People & plans asks: Google Gemini 939.99 · every month on the 7 — who pays it?")
    page.click("[data-testid=payer-other]"); page.fill("[data-testid=payer-name]", "My father"); page.click("[data-testid=payer-save]"); page.wait_for_timeout(300)
    life = page.evaluate("JSON.parse(localStorage.getItem('attune:life:v1')).items[0]")
    led = page.evaluate("JSON.parse(localStorage.getItem('ledger.v3')).txns")
    check(life.get("payer") == "My father" and led == [] and page.locator("[data-testid=payer-ask]").count() == 0, "“Someone else pays — My father” → saved, nothing out of Money, not asked again")
    rem = page.evaluate("JSON.parse(localStorage.getItem('attune:reminders:v1') || '[]')")
    check(any("My father pays it" in (r.get("body") or "") for r in rem), "…and a reminder on the renewal day says “My father pays it; your balance stays the same”")
    # v9.9.14: Me → which balance; a known person; Nobody; changeable on the item
    LIFE2 = {"v": 1, "items": [{"id": "s2", "kind": "subscription", "dir": "out", "title": "Netflix", "amount": 240, "currency": "EGP", "every": "month", "start": "2026-11-05", "count": 0, "total": 0, "paid": [0], "auto": True, "person": "", "created": now}]}
    page.evaluate("l => { localStorage.setItem('attune:life:v1', JSON.stringify(l)); localStorage.setItem('ledger.v3', JSON.stringify({txns: [], accounts: [{id: 'cash', name: 'Cash', currency: 'EGP', start: 500}, {id: 'cib', name: 'CIB', currency: 'EGP', start: 12000}]})); localStorage.setItem('attune:people:v1', JSON.stringify({items: [{id: 'p1', kind: 'person', name: 'Baba', role: 'my father'}], skip: []})); }", LIFE2)
    go(page, "home", "body"); go(page, "life", "[data-testid=life-page]")
    page.click("[data-testid=payer-ask] [data-testid=payer-me]"); page.wait_for_timeout(150)
    accs = page.locator("[data-testid=payer-account]").all_inner_texts()
    check(len(accs) == 2 and "CIB" in accs[1] and "12,000" in accs[1], "Me → “From which balance?” lists each account with what's in it: " + " | ".join(a.replace("\n", " ") for a in accs))
    page.locator("[data-testid=payer-account]", has_text="CIB").click(); page.wait_for_timeout(300)
    tx = page.evaluate("JSON.parse(localStorage.getItem('ledger.v3')).txns")
    check(len(tx) == 1 and tx[0]["account"] == "cib" and tx[0]["amount"] == 240, "…CIB → this month's 240 comes out of CIB: %s" % [(t["account"], t["amount"]) for t in tx])
    row = page.locator("[data-testid=life-item]", has_text="Netflix").locator("[data-testid=payer-line]")
    check("You pay · from CIB" in row.inner_text(), "the item says who pays: " + row.inner_text())
    page.locator("[data-testid=life-item]", has_text="Netflix").locator("[data-testid=payer-change]").click(); page.wait_for_timeout(150)
    page.locator("[data-testid=life-item]", has_text="Netflix").locator("[data-testid=payer-other]").click(); page.wait_for_timeout(150)
    ppl = page.locator("[data-testid=life-item]", has_text="Netflix").locator("[data-testid=payer-person]").all_inner_texts()
    check(any("Baba" in x for x in ppl), "Someone else → the people Attune knows are offered (Baba · my father): " + ", ".join(ppl))
    check(page.locator("[data-testid=life-item]", has_text="Netflix").locator("[data-testid=payer-contact]").count() == 1, "…and “Pick from contacts”")
    page.locator("[data-testid=life-item]", has_text="Netflix").locator("[data-testid=payer-person]", has_text="Baba").click(); page.wait_for_timeout(300)
    check("Baba pays" in page.locator("[data-testid=life-item]", has_text="Netflix").locator("[data-testid=payer-line]").inner_text(), "changed on the item: Baba pays")
    page.locator("[data-testid=life-item]", has_text="Netflix").locator("[data-testid=payer-change]").click(); page.locator("[data-testid=life-item]", has_text="Netflix").locator("[data-testid=payer-none]").click(); page.wait_for_timeout(300)
    check("Nobody set" in page.locator("[data-testid=life-item]", has_text="Netflix").locator("[data-testid=payer-line]").inner_text(), "Nobody → “Nobody set — reminder only”")
    rem2 = page.evaluate("JSON.parse(localStorage.getItem('attune:reminders:v1') || '[]')")
    check(any(r.get("id") == "life-s2" and "nobody" in (r.get("body") or "") for r in rem2), "…and the reminder is still set for the day")
    check(not real_errors(errors), "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
