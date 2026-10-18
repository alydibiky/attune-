"""v6.40 (upgrade C1) — an assistant keeps what you taught it (its rules show in its edit form) and goes to another phone as
one file: Save as a file → Open an assistant file brings it back with its rules.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v740assistrules.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
A = [{"id": "a1", "emoji": "🏗️", "name": "Crane quotes", "desc": "Prices crane jobs", "instructions": "You price crane jobs.", "starters": []}]
R = {"a1": [{"text": "Always add 14% VAT", "at": 1}]}
INIT = "try{localStorage.setItem('attune:assistants:v1', %s);localStorage.setItem('attune:assistants:rules:v1', %s)}catch(e){}" % (json.dumps(json.dumps(A)), json.dumps(json.dumps(R)))
INIT += "(function w(){ var N = window.AttuneNative; if (!N) return setTimeout(w, 0); window.__saved = []; N.saveFile = function (id, arg) { window.__saved.push(JSON.parse(arg)); setTimeout(function () { window.__attuneNative.resolve(id, JSON.stringify({ ok: true })); }, 20); }; })();"
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.goto(env.url); page.wait_for_timeout(1200)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'assistants'}}))")
    page.wait_for_selector("[data-testid=assistant-item]:has-text('Crane quotes')", timeout=8000)
    item = page.locator("[data-testid=assistant-item]:has-text('Crane quotes')")
    item.locator("button[title='Edit']").click()
    page.wait_for_selector("[data-testid=assistant-rules]", timeout=4000)
    check("Always add 14% VAT" in page.locator("[data-testid=assistant-rules]").inner_text(), "the edit form lists what it learned")
    page.click("[data-testid=assistant-back]")
    page.locator("[data-testid=assistant-item]:has-text('Crane quotes')").locator("[data-testid=assistant-export]").click()
    page.wait_for_function("window.__saved.length === 1", timeout=5000)
    f = page.evaluate("window.__saved[0]")
    check(f["name"].endswith(".attune-assistant.json") and "Always add 14% VAT" in f["text"], "Save as a file: one file with the rules")
    page.set_input_files("[data-testid=assistant-import-file]", files=[{"name": "x.json", "mimeType": "application/json", "buffer": f["text"].encode()}])
    page.wait_for_timeout(500)
    check(page.locator("[data-testid=assistant-item]:has-text('Crane quotes')").count() == 2, "Open an assistant file adds it")
    rules = page.evaluate("JSON.parse(localStorage.getItem('attune:assistants:rules:v1'))")
    check(len([k for k, v in rules.items() if v and v[0]["text"] == "Always add 14% VAT"]) == 2, "…with its rules")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
