"""v6.48 Chat runs the app (CHAT_RUNS_APP.md, Home option A): the "/" list, to-dos, where things are (asks when it moved; counts),
two meanings → ask with two options, the map card, jobs on Home (humanize, translate, convert) with their results, Web as an
option, /travel pinned on Home.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v748commands.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
import json
env = Env(); errors = []

def box(page, text):
    page.fill("[data-testid=home-ask]", text); page.click("[data-testid=home-send]"); page.wait_for_timeout(350)

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init="try{localStorage.setItem('attune:start','home')}catch(e){}")
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    # Ali (22 Oct): commands show only when "/" is typed — no command chips under the box, no list before "/"
    check(page.locator("[data-testid^=box-cmd-]").count() == 0 and page.locator("[data-testid=slash-menu]").count() == 0
          and page.locator("[data-testid=box-web]").count() == 1, "no command chips and no / list until / is typed (Web stays)")
    page.fill("[data-testid=home-ask]", "/"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=slash-menu]").count() == 1, "typing / opens the command list")
    # the / list
    page.fill("[data-testid=home-ask]", "/tr"); page.wait_for_timeout(200)
    ids = page.evaluate("() => [...document.querySelectorAll('[data-testid^=slash-]')].map(e => e.dataset.testid)")
    check("slash-translate" in ids and "slash-travel" in ids and "slash-convert" not in ids, "typing /tr shows /translate and /travel: %s" % ids)
    page.click("[data-testid=slash-translate]")
    check(page.input_value("[data-testid=home-ask]") == "/translate ", "tapping one fills it in")
    page.fill("[data-testid=home-ask]", "")
    # to-dos
    box(page, "add buy milk to my to-do list")
    check("Added to your to-do list: buy milk" in page.inner_text("[data-testid=lines-card]"), "“add buy milk to my to-do list” → added")
    box(page, "add call the bank to my to-do list")
    box(page, "what's in my to-do list?")
    items = page.locator("[data-testid=todo-item]").all_inner_texts()
    check(items == ["buy milk", "call the bank"], "“what's in my to-do list?” → %s" % items)
    page.locator("[data-testid=todo-item]").first.click(); page.wait_for_timeout(200)
    box(page, "/todo")
    check(page.locator("[data-testid=todo-item]").all_inner_texts() == ["call the bank"], "ticked → finished (/todo shows what is left)")
    # where things are
    box(page, "remember my passport is in the drawer")
    check("passport — in the drawer" in page.inner_text("[data-testid=lines-card]"), "kept: passport — in the drawer")
    box(page, "remember my passport is on the desk")
    check("not in the drawer any more" in page.inner_text("[data-testid=confirm-card]"), "a new place → “not in the drawer any more?”")
    page.click("[data-testid=confirm-yes]"); page.wait_for_timeout(200)
    box(page, "my passport is in the drawer"); page.click("[data-testid=confirm-yes]"); page.wait_for_timeout(200)
    box(page, "my passport is on the desk"); page.click("[data-testid=confirm-yes]"); page.wait_for_timeout(200)
    box(page, "where do I usually keep my passport?")
    ans = page.inner_text("[data-testid=lines-card]")
    check("on the desk twice" in ans and "in the drawer twice" in ans and "Last time you said: on the desk" in ans, "where I usually keep it: " + ans.replace("\n", " ")[:160])
    # two meanings → ask, and the ticked one runs
    box(page, "where is the umbrella")
    check(page.locator("[data-testid=ask-card]").count() == 1 and page.locator("[data-testid=ask-map]").count() == 1 and page.locator("[data-testid=ask-whereAsk]").count() == 1, "“where is the umbrella” → What did you mean? (the map / where I keep it)")
    page.click("[data-testid=ask-whereAsk]"); page.click("[data-testid=ask-go]"); page.wait_for_timeout(250)
    check("don't know where the umbrella" in page.inner_text("[data-testid=lines-card]"), "he ticks “where I keep it” → it says it doesn't know yet")
    prefs = page.evaluate("JSON.parse(localStorage.getItem('attune:intent:prefs') || '{}')")
    check(any(v.get("kind") == "whereAsk" for v in prefs.values()), "his answer is remembered")
    # the map card
    box(page, "I want to go to Cairo Tower")
    check("Cairo Tower" in page.inner_text("[data-testid=map-card]"), "“I want to go to Cairo Tower” → the map card")
    page.click("[data-testid=map-open]"); page.wait_for_timeout(600)
    check(page.evaluate("localStorage.getItem('attune:map:ask')") in (None, ""), "the map opens with the place searched (the hand-off is read)")
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    # jobs need a model
    page.locator("[data-testid=home-menu]").count()
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'chat'}}))"); page.wait_for_timeout(400)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'home'}}))"); page.wait_for_selector("[data-testid=phone-home]", timeout=5000)
    page.evaluate("() => { window.__mock.bodies = []; window.__mock.fakeQueue = ['Hi Ahmed, the shipment is late by two days. Sorry about that.', 'Bonjour à tous']; }")
    box(page, "/humanize I am writing to inform you that the shipment has been delayed by two days. We apologize for the inconvenience.")
    page.wait_for_selector("[data-testid=job][data-status=done][data-kind=humanize]", timeout=20000)
    check("shipment is late by two days" in page.inner_text("[data-testid=job][data-kind=humanize]"), "/humanize → a job on Home, done, with the text and Copy")
    box(page, "/translate to French good morning everyone")
    page.wait_for_selector("[data-testid=job][data-status=done][data-kind=translate]", timeout=20000)
    check("Bonjour" in page.inner_text("[data-testid=job][data-kind=translate]"), "/translate to French → done")
    # convert: a text file → Word
    page.set_input_files("[data-testid=box-file-input]", files=[{"name": "notes.txt", "mimeType": "text/plain", "buffer": b"Site visit\n\nThe crane is ready on Monday."}])
    check(page.locator("[data-testid=box-file]").count() == 1, "the attached file shows in the box")
    box(page, "/convert to word")
    page.wait_for_selector("[data-testid=job][data-status=done][data-kind=convert]", timeout=20000)
    check(page.locator("[data-testid=job][data-kind=convert] [data-testid=job-save]").count() == 1 and "notes.docx" in page.inner_text("[data-testid=job][data-kind=convert]"), "/convert to word + a .txt → notes.docx, Save")
    box(page, "/convert to pdf")
    check("Attach the file" in page.inner_text("[data-testid=lines-card]"), "/convert with no file → asks for the file")
    # Web as an option in the box
    page.click("[data-testid=box-web]")
    box(page, "price of gold today in Egypt")
    page.wait_for_timeout(500)
    check(page.locator("[data-testid=phone-home]").count() == 0, "Web on → the question goes to Chat with the web search")
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'home'}}))"); page.wait_for_selector("[data-testid=phone-home]", timeout=5000)
    # /travel pinned
    box(page, "/travel Turkey"); page.wait_for_timeout(500)
    trip = page.evaluate("JSON.parse(localStorage.getItem('attune:trip:v1') || '{}')")
    check(trip.get("country") == "tr" and trip.get("pinned") is True, "/travel Turkey → the trip page, pinned")
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'home'}}))"); page.wait_for_selector("[data-testid=phone-home]", timeout=5000)
    check(page.locator("[data-testid=trip-pin]").count() == 1, "Home shows the pinned trip")
    page.click("[data-testid=trip-pin-end]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=trip-pin]").count() == 0, "End trip → unpinned")
    page.screenshot(path="/tmp/claude-0/-home-user-attune-/1ff82a38-ab20-5fab-997e-a9a69538f1c3/scratchpad/v748home.png")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
