"""v9.9.2 S1 (Ali picked, 9 Nov): Chat always checks your own Shelf / Mind notes first and says where the answer came from.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v992s1.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
MEM = [{"id": "n1", "ts": 1762000000000, "kind": "note", "title": "Crane notes", "text": "The Liebherr mechanic said the hydraulic hose on boom 2 must be changed before the Sokhna job, about 4,500.", "output": "", "tags": [], "meta": {"book": "mybook"}, "pinned": False},
       {"id": "n2", "ts": 1762000001000, "kind": "note", "title": "Groceries", "text": "milk, eggs, bread", "output": "", "tags": [], "meta": {"book": "mybook"}, "pinned": False}]
INIT = "try{localStorage.setItem('attune:memory:v1', %s)}catch(e){}" % json.dumps(json.dumps(MEM))
def install(page):
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)
def ask(page, t):
    page.evaluate("() => { window.__mock.bodies = []; }")
    page.locator("textarea[placeholder='Message Attune']").fill(t); page.locator("button[title='Send']").click()
    page.wait_for_function("() => window.__mock.bodies.some(x => x.max_tokens > 2)", timeout=20000); page.wait_for_timeout(1500)
    return json.dumps(page.evaluate("window.__mock.bodies.filter(x => x.max_tokens > 2)"))
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.goto(env.url); page.wait_for_timeout(1000)
    install(page)
    b = ask(page, "what about the liebherr hydraulic hose on boom 2")
    check("Sokhna" in b, "the question (not a “my…” question) reaches the AI WITH the Shelf note about the hose")
    page.wait_for_selector("[data-testid=from-mine]", timeout=20000)
    check(page.locator("[data-testid=from-mine]").count() >= 1 and "From your Shelf: Crane notes" in page.locator("[data-testid=from-mine]").last.inner_text(), "the answer says: From your Shelf: Crane notes")
    page.click("header button[aria-label='New chat']"); page.wait_for_timeout(200); page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'chat'}}))"); page.wait_for_timeout(400)
    b = ask(page, "explain how a hydraulic cylinder works in simple words")
    check("Sokhna" not in b, "a general question that no note fits gets no note")
    check(not real_errors(errors), "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
