"""v6.37 (upgrade X3) — Privacy: "Your week in privacy" from the phone's connection log (folded, never counted twice).
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v740privacyweek.py
"""
import json, time
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
now = int(time.time() * 1000)
LOG = {"entries": [{"t": now - 1000, "host": "duckduckgo.com", "what": "page request", "blocked": False},
                   {"t": now - 2000, "host": "duckduckgo.com", "what": "page request", "blocked": False},
                   {"t": now - 3000, "host": "tracker.example", "what": "page request", "blocked": True}]}
INIT = "window.__netlog = %s;" % json.dumps(json.dumps(LOG))
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + "window.AttuneNative.netLog=()=>window.__netlog;")
    page.goto(env.url); page.wait_for_timeout(1500)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'privacy'}}))")
    page.wait_for_selector("[data-testid=privacy-week]", timeout=8000)
    t = page.locator("[data-testid=privacy-week-sum]").inner_text()
    check("Connections: 2 · places: 1 · blocked: 1" in t, "this week: 2 connections, 1 blocked (%s)" % t)
    rows = page.locator("[data-testid=privacy-week-place]").all_inner_texts()
    check(len(rows) == 2 and "duckduckgo.com" in rows[0] and "2 times" in rows[0] and "page request" in rows[0], "each place with how often and why: %s" % rows)
    st = page.evaluate("JSON.parse(localStorage.getItem('attune:netweek:v1'))")
    check(sum(h["n"] for d in st["days"].values() for h in d.values()) == 2, "the same session log folded twice still counts 2")
    page.click("[data-testid=privacy-week-1]")
    check("offline" in page.locator("[data-testid=privacy-week-sum]").inner_text(), "last week: nothing at all, said plainly")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
