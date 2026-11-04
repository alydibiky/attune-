"""v6.48 Chat runs the app, the other screens: Chat's + menu has "Translate my messages" (the checked engine translates instead of
answering); Chat does to-dos by code (a card); Mind ticks a to-do; a recording kept with /remember plays in Mind; the Video page makes
subtitles for any video on the phone (a job on Home — in a browser it says it needs the Android app).
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v748chat.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
WAV = bytes.fromhex("52494646") + (36 + 8000).to_bytes(4, "little") + b"WAVEfmt " + (16).to_bytes(4, "little") + (1).to_bytes(2, "little") + (1).to_bytes(2, "little") + (8000).to_bytes(4, "little") + (16000).to_bytes(4, "little") + (2).to_bytes(2, "little") + (16).to_bytes(2, "little") + b"data" + (8000).to_bytes(4, "little") + bytes(8000)
def open_mode(page, m, sel):
    page.evaluate("(m) => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", m); page.wait_for_selector(sel, timeout=8000)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init="try{localStorage.setItem('attune:start','home')}catch(e){}")
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    open_mode(page, "chat", "[data-testid=composer-plus]")
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)
    open_mode(page, "chat", "[data-testid=composer-plus]")
    send = lambda t: (page.locator("textarea").first.fill(t), page.wait_for_timeout(150), page.evaluate("() => [...document.querySelectorAll('button[title=Send]')].find((b) => b.offsetParent).click()"), page.wait_for_timeout(400))
    # Translate mode
    page.click("[data-testid=composer-plus]"); page.click("[data-testid=menu-translate]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=chip-translate]").count() == 1, "Chat's + menu → Translate my messages (a chip shows it is on)")
    page.evaluate("() => { window.__mock.bodies = []; window.__mock.fakeQueue = ['صباح الخير يا جماعة']; }")
    send("good morning everyone")
    page.wait_for_function("() => document.body.innerText.includes('صباح الخير يا جماعة')", timeout=20000)
    sent = page.evaluate("JSON.stringify(window.__mock.bodies.map(b => b.messages))")
    check("good morning everyone" in sent and "Arabic" in sent, "the message was TRANSLATED into Arabic (not answered)")
    page.click("[data-testid=chip-translate]"); page.wait_for_timeout(150)
    check(page.locator("[data-testid=chip-translate]").count() == 0, "tap the chip → Translate off")
    # to-do in Chat, by code
    send("add buy bread to my to-do list")
    check("Added to your to-do list" in page.inner_text("body") and "buy bread" in page.inner_text("body"), "Chat: “add buy bread to my to-do list” → a card, done by code")
    # Mind: tick it
    open_mode(page, "memory", "[data-testid=mind-todo-tick]")
    page.locator("[data-testid=mind-todo-tick]").first.click(); page.wait_for_timeout(300)
    done = page.evaluate("() => { const m = JSON.parse(localStorage.getItem('attune:memory:v1') || localStorage.getItem('attune.memory') || 'null'); return m; }")
    check(page.locator("[data-testid=mind-todo-tick] .line-through").count() == 1, "Mind: the to-do ticks done")
    # a recording kept with /remember plays in Mind
    open_mode(page, "home", "[data-testid=phone-home]")
    page.set_input_files("[data-testid=box-file-input]", files=[{"name": "site-meeting.wav", "mimeType": "audio/wav", "buffer": WAV}])
    page.fill("[data-testid=home-ask]", "/remember as the site meeting with Hassan"); page.click("[data-testid=home-send]")
    page.wait_for_selector("[data-testid=job][data-status=done][data-kind=remember]", timeout=20000)
    check("site meeting with Hassan" in page.inner_text("[data-testid=job][data-kind=remember]"), "/remember + a recording → kept in Mind (a job on Home)")
    page.fill("[data-testid=home-ask]", "/find site meeting"); page.click("[data-testid=home-send]"); page.wait_for_timeout(300)
    check(page.locator("[data-testid=found-item]").count() >= 1, "/find site meeting → found")
    page.locator("[data-testid=found-item]").first.click()
    page.wait_for_selector("[data-testid=mind-media]", timeout=8000)
    page.wait_for_selector("[data-testid=mind-player]", timeout=8000)
    check(page.locator("[data-testid=mind-player]").count() == 1, "Mind opens it with the player")
    # Video page: subtitles for any video
    open_mode(page, "video", "[data-testid=video-subs-any]")
    page.set_input_files("[data-testid=video-subs-file]", files=[{"name": "clip.wav", "mimeType": "audio/wav", "buffer": WAV}])
    page.wait_for_timeout(300)
    open_mode(page, "home", "[data-testid=phone-home]")
    page.wait_for_selector("[data-testid=job][data-kind=subtitles][data-status=fail]", timeout=8000)
    t = page.inner_text("[data-testid=job][data-kind=subtitles]"); check("Android app" in t or "newest Attune app" in t, "Video → Subtitles for a video on this phone → a job on Home (here: says it needs the new Android app): " + t.replace("\n", " ")[:120])
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
