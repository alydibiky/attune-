"""v6.40 (C5) a saved page keeps its data: a tracker made in Chat counts with its own storage, and the boxes typed into
(a note, a tick) come back after the page is closed and opened again — also when opened from a home-screen icon.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v740artdata.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
PAGE = """<!doctype html><html><head><title>Water tracker</title></head><body>
<h1 id=n>0</h1><button id=add onclick="var v=+(localStorage.getItem('cups')||0)+1;localStorage.setItem('cups',v);document.getElementById('n').textContent=v">+1</button>
<input id=note placeholder=note><label><input type=checkbox id=done> done</label><input type=password id=pw>
<script>document.getElementById('n').textContent=localStorage.getItem('cups')||0</script></body></html>"""
ART = [{"id": "art_water", "kind": "html", "lang": "html", "title": "Water tracker", "created": 1, "updated": 1, "versions": [{"content": PAGE, "ts": 1}]}]
PIN = "(function w(){if(!window.AttuneNative){return setTimeout(w,20)}window.AttuneNative.pinPage=function(id,l){window.__pinned=[id,l];return true}})();"
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init="try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:artifacts:v1'," + json.dumps(json.dumps(ART)) + ")}catch(e){}" + PIN)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    def open_it():
        page.evaluate("window.dispatchEvent(new MessageEvent('attune-share',{data:{kind:'artifact',id:'art_water'}}))")
        page.wait_for_selector("[data-testid=artifact-viewer]", timeout=5000)
        return page.frame_locator("[data-testid=artifact-frame]")
    fr = open_it()
    check("0" == fr.locator("#n").inner_text(), "the home-screen icon opens the saved page; a new tracker starts at 0")
    for _ in range(3): fr.locator("#add").click()
    fr.locator("#note").fill("drink before gym"); fr.locator("#done").check(); fr.locator("#pw").fill("secret")
    page.wait_for_timeout(700)
    saved = page.evaluate("localStorage.getItem('attune:artifact:data:v1:art_water')") or ""
    check('"cups":"3"' in saved and "drink before gym" in saved, "what the page saved and the note are kept on the phone")
    check("secret" not in saved, "a password box is never kept")
    page.click("[data-testid=artifact-pin]")
    check(page.evaluate("window.__pinned") == ["art_water", "Water tracker"], "Home screen asks Android to pin this page with its name")
    page.click("[data-testid=artifact-close]"); page.wait_for_timeout(300)
    fr = open_it(); page.wait_for_timeout(500)
    check(fr.locator("#n").inner_text() == "3", "opened again: the count is still 3 (%s)" % fr.locator("#n").inner_text())
    check(fr.locator("#note").input_value() == "drink before gym" and fr.locator("#done").is_checked(), "…the note and the tick are back")
    page.click("[data-testid=artifact-clear-data]")
    page.click("[data-testid=confirm-yes]"); page.wait_for_timeout(600)
    fr = page.frame_locator("[data-testid=artifact-frame]")
    check(fr.locator("#n").inner_text() == "0" and fr.locator("#note").input_value() == "", "Clear data starts the page fresh")
    page.click("[data-testid=artifact-close]")
    page.evaluate("window.dispatchEvent(new MessageEvent('attune-share',{data:{kind:'artifact',id:'gone'}}))"); page.wait_for_timeout(300)
    check(page.locator("[data-testid=artifact-viewer]").count() == 0, "a deleted page's icon just says it was deleted")
    ctx.close()
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
