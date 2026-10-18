"""v6.40 Recall (agent C): one search over screenshots (their text read on the phone), kept notifications (never SMS), chats,
Mind and payments — by meaning, in English and Egyptian Arabic, with dates and apps from the question.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v740recall.py     (SHOTS=dir for screenshots)
"""
import os, json, time, base64
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
now = int(time.time() * 1000); D = 86400000
NOTES = [{"id": "n1", "pkg": "com.whatsapp", "app": "WhatsApp", "title": "Ahmed", "text": "العنوان: 12 شارع 9 المعادي، الدور التالت", "ts": now - 2 * D},
         {"id": "n2", "pkg": "com.google.android.gm", "app": "Gmail", "title": "EgyptAir", "text": "Your booking MS 985 Cairo – Dubai, 2 Nov 08:40", "ts": now - 5 * D}]
CHATS = [{"id": "c1", "title": "AC repair", "updated": now - 20 * D, "messages": [{"role": "user", "text": "The technician said the AC compressor warranty is 5 years"}]}]
INIT = ("try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:chats:v1'," + json.dumps(json.dumps(CHATS)) + ")}catch(e){}"
        "(function w(){ var N = window.AttuneNative; if (!N) return setTimeout(w, 0); window.__on = false; window.__notes = " + json.dumps(NOTES) + ";"
        "N.recallNotesIsOn = function () { return window.__on; }; N.recallNotesOn = function (on) { window.__on = on; if (!on) window.__notes = []; };"
        "N.recallNotes = function () { return window.__on ? JSON.stringify(window.__notes) : '[]'; }; N.recallForget = function (j) { var g = JSON.parse(j); window.__notes = window.__notes.filter(function (n) { return g.indexOf(n.id) < 0; }); };"
        "N.payAccess = function () { return true; }; N.payQueue = function () { return '[]'; };"
        "N.readText = function (id, arg) { setTimeout(function () { window.__attuneNative.resolve(id, JSON.stringify({ text: '12:45\\nNour_Home\\nNetwork: Nour_Home\\nPassword: kiwi7781', lines: [] })); }, 30); };"
        "})();")
# a tiny real PNG (1x1) for the picker
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    check(page.evaluate("JSON.parse(localStorage.getItem('attune:chats:v1')||'[]').length") == 1, "a saved chat is there")
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'recall'}}))")
    page.wait_for_selector("[data-testid=recall-page]", timeout=5000)
    q = page.locator("[data-testid=recall-q]")
    q.fill("AC warranty")
    check(page.locator("[data-testid=recall-hit]").count() >= 1 and "AC repair" in page.locator("[data-testid=recall-hit]").first.inner_text(), "“AC warranty” finds the chat about the compressor")
    # keep notifications
    page.click("[data-testid=recall-notes-toggle]"); page.wait_for_timeout(200)
    check(page.evaluate("window.__on") is True, "Keep my notifications switches the phone's keeping on")
    q.fill("العنوان اللي أحمد بعته على الواتس"); page.wait_for_timeout(200)
    check("Ahmed" in page.locator("[data-testid=recall-hit]").first.inner_text(), "«العنوان اللي أحمد بعته على الواتس» → Ahmed's WhatsApp")
    q.fill("flight ticket"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=recall-hit]").count() == 1 and "EgyptAir" in page.locator("[data-testid=recall-hit]").first.inner_text(), "“flight ticket” → the booking email (by meaning: booking)")
    page.locator("[data-testid=recall-hit]").first.click(); page.wait_for_selector("[data-testid=recall-open]")
    check("MS 985" in page.locator("[data-testid=recall-open]").inner_text(), "tapping a notification shows it in full")
    page.click("[data-testid=recall-forget]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=recall-hit]").count() == 0 and page.evaluate("window.__notes.length") == 1, "Forget removes it from the phone")
    # add a screenshot: its text is read and it is kept in Mind
    page.set_input_files("[data-testid=recall-add-file]", files=[{"name": "Screenshot_20261010.png", "mimeType": "image/png", "buffer": PNG}])
    page.wait_for_function("!document.querySelector('[data-testid=recall-add]').innerText.includes('Reading')", timeout=8000)
    page.wait_for_timeout(300)
    q.fill("wifi password"); page.wait_for_timeout(200)
    hit = page.locator("[data-testid=recall-hit]").first
    check(hit.count() == 1 and "Nour_Home" in hit.inner_text() and "Password" in hit.inner_text(), "the screenshot is found by the text read in it: " + (hit.inner_text().replace("\n", " | ") if hit.count() else ""))
    q.fill("باسورد الواي فاي"); page.wait_for_timeout(200)
    check("Nour_Home" in page.locator("[data-testid=recall-hit]").first.inner_text(), "…also in Egyptian Arabic: «باسورد الواي فاي»")
    mem = page.evaluate("JSON.parse(localStorage.getItem('attune:memory:v1')||'[]')")
    check(any(r.get("kind") == "photo" and "kiwi7781" in r.get("text", "") for r in mem), "the screenshot is kept in Mind with its text")
    q.fill("screenshots"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=recall-understood]").count() == 1 and page.locator("[data-testid=recall-hit]").count() == 1, "“screenshots” lists only screenshots and says what it looked in")
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, "recall.png"))
    # switching off forgets the notifications
    page.click("[data-testid=recall-notes-toggle]"); page.wait_for_timeout(200)
    q.fill("Ahmed"); page.wait_for_timeout(200)
    check(page.evaluate("window.__on") is False and page.locator("[data-testid=recall-hit]").count() == 0, "turning it off forgets the kept notifications")
    ctx.close()
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
