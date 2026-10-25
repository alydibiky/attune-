"""v8.0 Agents (Ali picked design A, 25 Oct 2026): one sentence makes an agent — a price watch (Ali's Makkah hotels under 45k for
4 nights; asked for the day it didn't have; Check now reads the cheapest offer in Attune's browser; the phone gets the plan for
the checks with Attune closed), a delivery agent (a notification rule on Amazon's own app), the usual order (Talabat opens with it
copied), any app by its name (Uber), and the Agents report.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v1000agents.py     (SHOTS=dir for screenshots)
"""
import json, os
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
def shot(page, name):
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, name + ".png"), full_page=True)
INIT = """const N = window.AttuneNative; window.__calls = [];
N.agentWatchPlan = (p) => { window.__plan = JSON.parse(p); return 'ok'; };
N.agentWatchTake = () => '{}';
N.appsList = () => JSON.stringify([{pkg: 'com.ubercab', label: 'Uber'}, {pkg: 'com.vodafone.my', label: 'My Vodafone'}]);
N.openAnyApp = (j) => { window.__calls.push(['open', JSON.parse(j)]); return JSON.stringify({ok: true, how: 'app'}); };
N.intent = (j) => { window.__calls.push(['intent', JSON.parse(j)]); return JSON.stringify({ok: true}); };
N.watchSave = (j) => { window.__rules = JSON.parse(j).rules; };
N.payAccess = () => true;
N.agentOpen = (id, arg) => { window.__agentOpen = JSON.parse(arg); setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({reason: 'done', offers: 6, price: 44600, currency: 'EGP'})), 50); };"""
def go(page, mode, sel):
    page.evaluate("m => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", mode); page.wait_for_selector(sel, timeout=8000); page.wait_for_timeout(300)
def say(page, text):
    page.fill("[data-testid=agents-input]", text); page.click("[data-testid=agents-go]"); page.wait_for_timeout(300)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_timeout(1200)
    go(page, "agents", "[data-testid=agents-page]")
    check(page.locator("[data-testid=agents-empty]").count() == 1 and page.locator("[data-testid^=agents-chip-]").count() == 5, "Agents opens calm: the box, five example chips, no agents yet")
    # ---- Ali's price watch: no day → asked, then a Booking watch ----
    say(page, "tell me when hotels in masjid el haram become less than 45k in 4 nights")
    check(page.locator("[data-testid=agents-ask]").count() == 1 and "which day" in page.locator("[data-testid=agents-ask]").inner_text(), "no day in the sentence → the agent asks from which day")
    page.fill("[data-testid=agents-answer]", "10 December"); page.click("[data-testid=agents-answer-go]"); page.wait_for_timeout(300)
    card = page.locator("[data-testid=agent-watch]")
    check(card.count() == 1 and "EGP 45,000" in card.inner_text() and "2026-12-10" in card.inner_text() or "12-10" in card.inner_text(), "a price watch: Hotels · Masjid al-Haram · 4 nights, under EGP 45,000: " + card.inner_text()[:120].replace("\n", " · "))
    plan = page.evaluate("window.__plan")
    check(plan and len(plan) == 1 and "booking.com" in plan[0]["url"] and plan[0]["below"] == 45000, "the phone gets it to check about every 12 hours, even with Attune closed")
    page.click("[data-testid=agent-check]"); page.wait_for_selector("[data-testid=agent-found]", timeout=4000)
    ao = page.evaluate("window.__agentOpen")
    check(ao["watch"] is True and "booking.com" in ao["url"] and "44,600" in page.locator("[data-testid=agent-found]").inner_text(), "Check now: Booking opens inside Attune, the cheapest (EGP 44,600) is under the limit → Found")
    shot(page, "v1000-agents-watch")
    # ---- a delivery: a rule on Amazon's own notifications ----
    say(page, "tell me when my amazon order arrives")
    rules = page.evaluate("window.__rules") or []
    mine = [r for r in rules if str(r["id"]).startswith("agent-")]
    check(page.locator("[data-testid=agent-track]").count() == 1 and mine and mine[0]["app"].startswith("pkgs:com.amazon.mShop.android.shopping"), "a delivery agent: Amazon's own notifications are watched (rule %s)" % (mine[0]["app"] if mine else None))
    # ---- the usual order ----
    page.click("[data-testid=agents-chip-order]"); page.click("[data-testid=agents-go]"); page.wait_for_timeout(300)
    check("usual" in page.locator("[data-testid=agents-ask]").inner_text(), "Order my usual from Talabat → it asks what the usual is (once)")
    page.fill("[data-testid=agents-answer]", "Koshary Abou Tarek — large + rice pudding"); page.click("[data-testid=agents-answer-go]"); page.wait_for_timeout(300)
    page.click("[data-testid=agent-order-now]"); page.wait_for_timeout(200)
    it = [c[1] for c in page.evaluate("window.__calls") if c[0] == "intent"]
    check(it and it[-1]["app"] == "com.talabat" and "Koshary" in it[-1]["copy"], "Order now: Talabat opens with the order copied (you press Order)")
    # ---- any app by its name ----
    say(page, "open uber"); say(page, "افتح طلبات"); say(page, "open My Vodafone")
    opened = [c[1]["pkg"] for c in page.evaluate("window.__calls") if c[0] == "open"]
    check(opened[-3:] == ["com.ubercab", "com.talabat", "com.vodafone.my"], "open Uber / «افتح طلبات» / an app only the phone knows (My Vodafone): %s" % opened[-3:])
    say(page, "uber to cairo airport")
    lk = [x.strip() for x in page.locator("[data-testid=agents-do-link]").all_inner_texts()]
    check(lk[:3] == ["Uber", "Careem", "inDrive"], "“Uber to Cairo airport” → Uber with the destination, Careem and inDrive (Egypt's ride apps): %s" % lk)
    check("running" in page.locator("[data-testid=agents-running]").inner_text().lower() and "3" in page.locator("[data-testid=agents-running]").inner_text(), "Running · 3 (watch, delivery, usual order)")
    shot(page, "v1000-agents")
    # ---- the report ----
    page.click("[data-testid=agents-open-report]"); page.wait_for_selector("[data-testid=agents-report]")
    check(page.locator("[data-testid=agents-kpi-found]").inner_text().strip().endswith("1") and page.locator("[data-testid=agents-report-watch]").count() == 1, "Agents report: 1 found, the watch's checks listed")
    shot(page, "v1000-agents-report")
    # ---- it is in the sidebar's places and "/agents" ----
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
finish()
