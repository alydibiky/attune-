"""v9.9.18 AU1 (Ali OK'd the combined screen): a "when … do …" sentence in Chat → the Automations page with the rule card
(When / If / Do · Save rule · Try it now · Change), or "One question first" when a name isn't known; Save hands it to the engine that
runs it (a message alert here). Arabic too. A plain "every day at 7 remind me …" stays a reminder.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v9918rules.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
DIR = {"items": [{"id": "p1", "kind": "person", "name": "Karim", "aka": ["كريم"]}, {"id": "p2", "kind": "person", "name": "Mama", "role": "mother", "aka": ["ماما"]}], "skip": []}
INIT = "try{localStorage.setItem('attune:start','home');if(!localStorage.getItem('t:seeded')){localStorage.setItem('t:seeded','1');localStorage.setItem('attune:people:v1',%s)}}catch(e){}" % json.dumps(json.dumps(DIR))
BOX = "textarea[placeholder='Message Attune']"
def chat(page):
    page.evaluate("() => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'chat'}}))"); page.wait_for_selector(BOX, timeout=8000); page.wait_for_timeout(300)
def say(page, t):
    page.locator(BOX).fill(t); page.locator("button[title='Send']").first.click(); page.wait_for_timeout(1200)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_timeout(1200)
    chat(page); say(page, "when Karim messages me on weekdays, tell me")
    page.wait_for_selector("[data-testid=rule-card]", timeout=8000)
    t = page.locator("[data-testid=rule-card]").inner_text()
    check("Karim messages you" in t and "On workdays" in t and "Tell you" in t, "the rule card: When Karim messages you · If on workdays · Do tell you — " + t.replace("\n", " ")[:160])
    page.locator("[data-testid=rule-save]").click(); page.wait_for_timeout(400)
    w = page.evaluate("JSON.parse(localStorage.getItem('attune:watch:v1') || '[]')")
    check(not any("Karim" in (x.get("who") or []) for x in w) and page.locator("[data-testid=rule-row]").first.inner_text().find("Waiting") >= 0, "a rule with “on workdays” is NOT switched on without its check — it waits for the phone part")
    chat(page); say(page, "when Karim messages me, tell me"); page.wait_for_selector("[data-testid=rule-card]", timeout=8000); page.locator("[data-testid=rule-save]").click(); page.wait_for_timeout(400)
    w = page.evaluate("JSON.parse(localStorage.getItem('attune:watch:v1') || '[]')")
    check(any("Karim" in (x.get("who") or []) for x in w), "without a check, Save rule → a message alert for Karim is on: " + json.dumps(w)[:140])
    check(page.locator("[data-testid=rule-row]").count() == 2, "…both are listed under Your rules")
    chat(page); say(page, "لما زينب تتصل خلي التليفون صامت")
    page.wait_for_selector("[data-testid=rule-ask]", timeout=8000)
    check("From whom" in page.locator("[data-testid=rule-ask]").inner_text() or "Which" in page.locator("[data-testid=rule-ask]").inner_text(), "an unknown name (Zeinab) → One question first: " + page.locator("[data-testid=rule-ask]").inner_text().replace("\n", " ")[:120])
    page.locator("[data-testid=rule-ask-choice]").first.click(); page.wait_for_timeout(300)
    check(page.locator("[data-testid=rule-card]").count() == 1, "…answering it brings the rule card")
    chat(page); say(page, "every day at 7 remind me to drink water")
    check(page.locator("[data-testid=rule-card]").count() == 0, "a plain daily reminder stays a reminder (no rule card)")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
env.close(); finish()
