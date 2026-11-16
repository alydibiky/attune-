"""v10.0.3 — Ali's 16 Nov phone list (round 2), on the real pages: Settings never scrolls sideways (the colour dots wrap); a tap on a
chat under "Kept quietly today" shows its messages; "Bank messages" says Allowed ✓ once notification access is on; a scanned bank
card gives "·· 3251" and its expiry, never its number.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v1003fixes.py
"""
import json, datetime, os, tempfile
from playwright.sync_api import sync_playwright
from harness import doc_png, Env, new_page, check, real_errors, finish
env = Env(); errors = []
NOW = datetime.datetime.now().replace(hour=14, minute=0, second=0, microsecond=0)
now = int(NOW.timestamp() * 1000)
def wa(i, title, text, ago, who):
    return {"id": "q" + str(i), "app": "WhatsApp", "pkg": "com.whatsapp", "title": title, "text": text, "ts": now - ago * 60000, "group": True, "convo": title, "who": who}
NOTES = [wa(1, "Dibiki Dabaa", "the generator is fixed", 30, "Omar"), wa(2, "Dibiki Dabaa", "who has the key to the store?", 20, "Hassan")]
ROLES = {"whatsapp|g:dibiki dabaa": {"role": "work", "ok": True, "by": "you", "care": [], "whenMe": False, "people": []}}
OCR = "CB WealthEGP5576 0199 17 3251\nVALID FROM 03/24\nVALID THRU 08/29\nALY ALDIBIKI\nVISA"
MOCK = ("(() => { const notes = %s; function w(){ const N = window.AttuneNative; if (!N) return setTimeout(w, 5); N.recallNotes = () => JSON.stringify(notes); N.payAccess = () => true; N.openPayAccess = () => {}; } w(); })();" % json.dumps(NOTES))
INIT = ("try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:test:quiet','0');localStorage.setItem('attune:coach:v1',JSON.stringify({seen:['*']}));"
        "localStorage.setItem('attune:chatroles:v1',%s);}catch(e){};" % json.dumps(json.dumps(ROLES))) + MOCK
def open_mode(page, m, sel):
    page.evaluate("(m) => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", m); page.wait_for_selector(sel, timeout=8000)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    ctx.clock.set_fixed_time(NOW)
    page.set_viewport_size({"width": 360, "height": 800}); page.goto(env.url); page.wait_for_selector("[data-testid=cp-quiet-line]", timeout=15000); page.wait_for_timeout(400)
    # 1. Kept quietly → a chat → its messages
    page.click("[data-testid=cp-quiet-line]"); page.wait_for_timeout(150)
    page.locator("[data-testid=cp-quiet-row]", has_text="Dibiki Dabaa").click(); page.wait_for_timeout(200)
    msgs = page.locator("[data-testid=cp-quiet-msgs]").inner_text() if page.locator("[data-testid=cp-quiet-msgs]").count() else ""
    check("the generator is fixed" in msgs and "who has the key" in msgs and "Omar" in msgs, "a tap on “Dibiki Dabaa · 2” shows its 2 messages in full: " + msgs.replace("\n", " | "))
    # 2. Settings: nothing sideways at 360 px
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'settings'}}))"); page.wait_for_timeout(900)
    wide = page.evaluate("""() => [...document.querySelectorAll('.fixed *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 2 || r.left < -2); }).length""")
    scrolls = page.evaluate("""() => [...document.querySelectorAll('.fixed *')].filter(e => e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 80 && !['visible','hidden'].includes(getComputedStyle(e).overflowX)).length""")
    check(wide == 0 and scrolls == 0, "Settings on a 360 px phone: nothing past the edge (%d), nothing scrolls sideways (%d)" % (wide, scrolls))
    page.keyboard.press("Escape"); page.wait_for_timeout(200)
    # 3. Set up your life → Bank messages: Allowed ✓ (notification access on, no message yet)
    open_mode(page, "setup", "[data-testid=setup-page]")
    bank = page.locator("[data-testid=setup-step][data-id=bank]").inner_text()
    check("Allowed ✓" in bank and page.locator("[data-testid=setup-step][data-id=bank] [data-testid=setup-do]").count() == 0, "Bank messages: “Allowed ✓ — waiting for the first message”, no “Do it” button: " + bank.replace("\n", " | "))
    ctx.close()
    # 4. Dates: a photo of a bank card (what the phone's OCR read on Ali's card) → ·· 3251, expires Aug 2029, never the number
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=("try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:testing-pro','on')}catch(e){}\n"
        "(() => { const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0); N.payAccess = () => true; N.payQueue = () => '[]';"
        " N.readText = (id, arg) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ text: %s, lines: [] })), 50); }; go(); })();") % json.dumps(OCR))
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_timeout(1500)
    open_mode(page, "radar", "[data-testid=radar-page]")
    f = os.path.join(tempfile.mkdtemp(), "card.png"); doc_png(page, f); page.set_input_files("[data-testid=radar-file]", f); page.wait_for_timeout(1500)
    body = page.inner_text("[data-testid=radar-page]")
    vals = page.evaluate("[...document.querySelectorAll('[data-testid=radar-page] input, [data-testid=radar-page] textarea')].map(e => e.value).join(' | ')")
    check("3251" in body + vals and ("2029-08-31" in vals or "2029" in body), "the card → ·· 3251 and its expiry (31 Aug 2029): " + (body + " || " + vals).replace("\n", " | ")[:400])
    check("5576" not in body + vals and "0199" not in body + vals, "the card's number is nowhere on the page")
    ctx.close()
    errs = real_errors(errors); check(not errs, "no JavaScript errors: %s" % errs[:2])
    br.close()
env.close(); finish()
