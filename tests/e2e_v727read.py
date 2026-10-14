"""v6.27 Read it to me — one sheet from Home's camera (phone), Home's starters (desktop), Chat and Translate. The paper is read
by the phone's reader (mocked), said aloud (what it is first), lit sentence by sentence; a bill's due date goes to Deadline
Radar, a prescription to Family health, by code.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v727read.py
"""
import json, base64
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
BILL = "North Cairo Electricity\nAccount number 448812\nElectricity bill\nTotal amount due: 1,236.50 EGP\nPay by 25/12/2030 to avoid disconnection"
RX = "Dr. Ahmed — Clinic\nRx\n1) Amoxicillin 500 mg 1 cap 3 times daily for 7 days\n2) Paracetamol 500 mg 1 tab when needed"
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")
INIT = "try{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s',1);localStorage.setItem('attune:start','home')}}catch(e){}\n" + r"""
window.__ocr = %s; window.__said = [];
(() => { const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0);
  N.readText = (id, arg) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ text: window.__ocr, lines: [] })), 30);
  N.speakWait = (id, arg) => { window.__said.push(JSON.parse(arg).text); setTimeout(() => window.__attuneNative.resolve(id, "{}"), 300); };
}; go(); })();""" % json.dumps(BILL)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.click("[data-testid=home-read]"); page.wait_for_selector("[data-testid=read-sheet]")
    check(page.locator("[data-testid=read-camera]").is_visible() and page.locator("[data-testid=read-pick]").is_visible(), "phone: Home's camera opens it — Take a photo / Choose a photo")
    page.set_input_files("[data-testid=read-camera-input]", {"name": "bill.png", "mimeType": "image/png", "buffer": PNG})
    page.wait_for_selector("[data-testid=read-what]", timeout=8000); page.wait_for_timeout(600)
    w = page.locator("[data-testid=read-what]").inner_text()
    check("A bill to pay" in w and "1,236.50 EGP" in w and "Pay by" in w, "says what it is, the amount and the date: " + w.replace("\n", " | ")[:140])
    said = page.evaluate("window.__said")
    check(said and said[0].startswith("A bill to pay"), "…and says it aloud first: %s" % said[:2])
    page.click("[data-testid=read-play]"); page.wait_for_timeout(250)
    check(page.locator("[data-testid=read-play]").inner_text().strip() == "Pause" and page.locator("[data-testid=read-text] p[style*='700']").count() == 1, "Read it all: one sentence lit at a time, Pause")
    page.click("[data-testid=read-play]")
    page.click("[data-testid=read-act-radar]"); page.wait_for_timeout(300)
    items = page.evaluate("JSON.parse(localStorage.getItem('attune:radar:v1') || '{\"items\":[]}').items.map(x => x.title + ' ' + x.date)")
    check(any("2030-12-25" in x for x in items), "Remind me → the due date is in Deadline Radar: %s" % items)
    notes = page.evaluate("(window.__mock.notes || []).map(n => n.id)")
    check(any(n.startswith("radar-") for n in notes), "…with a reminder scheduled")
    # a prescription → Family health
    page.click("[data-testid=read-close]")
    page.evaluate("window.__ocr = %s" % json.dumps(RX))
    page.click("[data-testid=home-read]"); page.set_input_files("[data-testid=read-file-input]", {"name": "rx.png", "mimeType": "image/png", "buffer": PNG})
    page.wait_for_selector("[data-testid=read-act-care]", timeout=8000)
    check("A prescription" in page.locator("[data-testid=read-what]").inner_text(), "a prescription is recognised")
    page.click("[data-testid=read-act-care]"); page.wait_for_selector("[data-testid=care-page]", timeout=5000); page.wait_for_timeout(300)
    check(page.locator("[data-testid=care-medform]").count() == 2, "Add to Family health → its 2 medicines, each to check and save (%d)" % page.locator("[data-testid=care-medform]").count())
    ctx.close()
    # desktop: Home's starter, a centred window
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.set_viewport_size({"width": 1280, "height": 860})
    page.goto(env.url); page.wait_for_selector("[data-testid=desk-home]", timeout=15000)
    page.click("[data-testid=home-read]"); page.wait_for_selector("[data-testid=read-sheet]")
    page.set_input_files("[data-testid=read-file-input]", {"name": "bill.png", "mimeType": "image/png", "buffer": PNG})
    page.wait_for_selector("[data-testid=read-what]", timeout=8000)
    box = page.locator("[data-testid=read-sheet] > div").bounding_box()
    check(box["width"] <= 680 and box["x"] > 250, "desktop: a centred window (%d px at x=%d)" % (box["width"], box["x"]))
    ctx.close()
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
