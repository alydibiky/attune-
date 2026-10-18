"""v6.38 (upgrade C4) — Project brain: a project's page shows what its chats decided, what is still open and the dates
coming up; a tap opens the chat it came from.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v740projectbrain.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
PROJ = [{"id": "p1", "emoji": "🏗️", "name": "Port Said tender", "instructions": "", "knowledge": []}]
CHATS = [{"id": "c1", "projectId": "p1", "title": "Cranes", "updated": 2000, "created": 1000, "messages": [
  {"id": "m1", "role": "user", "text": "Which crane for the 40 t beams?"},
  {"id": "m2", "role": "assistant", "text": "We'll go with the LTM 1100 for the beams. The tender closes on 2030-11-05."},
  {"id": "m3", "role": "user", "text": "Still need to check the ground pressure at gate 3."}]}]
INIT = "try{localStorage.setItem('attune:projects:v1', %s);localStorage.setItem('attune:chats:v1', %s)}catch(e){}" % (json.dumps(json.dumps(PROJ)), json.dumps(json.dumps(CHATS)))
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.goto(env.url); page.wait_for_timeout(1200)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'projects'}}))")
    page.wait_for_selector("[data-testid=project-item]", timeout=8000); page.click("[data-testid=project-item]")
    page.wait_for_selector("[data-testid=project-brain]", timeout=5000)
    check("LTM 1100" in page.locator("[data-testid=project-brain-decisions]").inner_text(), "Decided: the crane choice")
    check("ground pressure" in page.locator("[data-testid=project-brain-open]").inner_text(), "Still open: the ground pressure")
    check("2030-11-05" in page.locator("[data-testid=project-brain-dates]").inner_text(), "Dates: the tender closing")
    page.locator("[data-testid=project-brain-decisions] button").first.click()
    page.wait_for_selector("text=Which crane for the 40 t beams?", timeout=5000)
    check(True, "a tap opens the chat it came from")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
