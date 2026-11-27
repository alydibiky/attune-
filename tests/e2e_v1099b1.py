"""v10.9.9 B1 (Ali OK'd 27 Nov: "tap where an answer came from"), at a phone (390) and a computer (1366):
  1. "when is the last time I went to the barber?" → the green card ends with chips: the Money entry "hany rabee3" and the note that
     linked it ("the barber I go to hany rabee3")
  2. the Money chip opens THAT payment's own sheet in Money (edit / delete) — also when Money was already open before (kept page)
  3. the note chip opens the note in Mind
  4. "tell me about my barber" → the note chip; a model answer from Mind ("From your Mind: …") has its note as a chip too
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v1099b1.py
"""
import json, time
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
now = int(time.time() * 1000); D = 86400000
DAY6 = time.strftime("%Y-%m-%d", time.localtime((now - 6 * D) / 1000))
MEM = [{"id": "n1", "kind": "note", "title": "that in the barber I go to hany rabee3", "text": "that in the barber I go to hany rabee3 I cut with 1.ahmed me8awry", "output": "", "tags": [], "ts": now - 30 * D}]
LEDGER = {"currency": "EGP", "accounts": [{"id": "a1", "name": "Cash", "currency": "EGP"}], "recurring": [], "customCats": [],
          "txns": [{"id": "h1", "type": "expense", "amount": 150, "cat": "other", "note": "hany rabee3", "date": DAY6, "account": "a1"},
                   {"id": "u1", "type": "expense", "amount": 90, "cat": "food", "note": "lunch with ahmed", "date": DAY6, "account": "a1"}]}
INIT = ("try{localStorage.setItem('attune:start','chat');localStorage.setItem('attune:onboarded','1');localStorage.setItem('attune:coach:v1',JSON.stringify({seen:['*']}));"
        "if(!sessionStorage.getItem('t-b1')){sessionStorage.setItem('t-b1','1');localStorage.setItem('attune:memory:v1',%s);localStorage.setItem('ledger.v3',%s);}}catch(e){}\n"
        "(() => { function w(){ const N = window.AttuneNative; if (!N || !window.__mock) return setTimeout(w, 5);"
        " window.__mock.engine = { ...window.__mock.engine, state: 'ready', modelId: 'test-model' };"
        " window.dispatchEvent(new CustomEvent('attune-engine', { detail: { ...window.__mock.engine } })); } w(); })();") % (json.dumps(json.dumps(MEM)), json.dumps(json.dumps(LEDGER)))
def ask(page, text, queue=None, wait=2600):
    page.evaluate("(q) => { window.__mock.bodies = []; window.__mock.fakeQueue = q || []; }", queue)
    page.locator("textarea[placeholder='Message Attune']").fill(text); page.locator("button[title='Send']").click()
    page.wait_for_timeout(wait)
def open_chat(page):
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'chat'}}))"); page.wait_for_selector("textarea[placeholder='Message Attune']", timeout=15000); page.wait_for_timeout(400)
with sync_playwright() as p:
    br = p.chromium.launch()
    for w in (390, 1366):
        ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT, desktop=(w, 860) if w > 500 else None)
        if w <= 500: page.set_viewport_size({"width": w, "height": 860})
        page.goto(env.url); page.wait_for_timeout(1500)
        # Money opened once first, so it is a KEPT page when the chip opens it
        page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'money'}}))"); page.wait_for_timeout(1200)
        open_chat(page)
        ask(page, "when is the last time I went to the barber?", ["(not the model)"])
        chips = page.locator("[data-testid=src-chip]")
        srcs = [(chips.nth(i).get_attribute("data-src"), chips.nth(i).get_attribute("data-id")) for i in range(chips.count())]
        check(("money", "h1") in srcs and ("memory", "n1") in srcs and ("money", "u1") not in srcs, "%d: the answer's chips = the Money entry + the note that linked it: %s" % (w, srcs))
        txt = page.locator("[data-testid=src-chip][data-src=money]").first.inner_text()
        check("hany rabee3" in txt and "150" in txt, "%d: the Money chip says what it is (%s)" % (w, txt.replace("\n", " ")))
        page.locator("[data-testid=src-chip][data-src=money]").first.click(); page.wait_for_timeout(1500)
        sheet = page.locator("[data-testid=money-tx-sheet]")
        vals = page.evaluate("() => { const s = document.querySelector('[data-testid=money-tx-sheet]'); return s ? Array.from(s.querySelectorAll('input')).map((i) => i.value).join(' | ') + ' | ' + s.innerText : ''; }")
        check(sheet.count() > 0 and sheet.first.is_visible() and "hany rabee3" in vals and "150" in vals, "%d: the Money chip opens THAT payment's sheet (Money was a kept page)" % w)
        page.keyboard.press("Escape"); page.wait_for_timeout(300)
        try: sheet.first.click(position={"x": 5, "y": 5}, timeout=1500)
        except Exception: pass
        page.wait_for_timeout(400)
        open_chat(page)
        page.locator("[data-testid=src-chip][data-src=memory]").last.click(); page.wait_for_timeout(1500)
        det = page.locator("[data-testid=mind-detail]")
        check(det.count() > 0 and "hany rabee3" in det.first.inner_text(), "%d: the note chip opens the note in Mind" % w)
        page.keyboard.press("Escape"); page.wait_for_timeout(300)
        open_chat(page)
        ask(page, "tell me about my barber", ["**Your barber is Hany Rabee3.**"])
        last = page.locator("[data-testid=src-chip][data-src=memory]")
        check(last.count() >= 2 and last.last.get_attribute("data-id") == "n1", "%d: 'tell me about my barber' → the note as a chip" % w)
        ctx.close()
    br.close()
check(not real_errors(errors), "no page errors")
env.close(); finish()
