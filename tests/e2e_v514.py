"""v5.14 — Ali's screenshots after v5.13 + the new Assistants, Projects,
Artifacts and Themes.

  python3 tests/e2e_v514.py
"""
import os, base64
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish, HERE

env = Env(); errors = []

def install(page):
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)

def send(page, text):
    page.locator("textarea[placeholder='Message Attune']").fill(text)
    page.locator("button[title='Send']").click()

def queue(page, items):
    page.evaluate("(q) => { const M = window.__mock; M.fakeQueue = q; M.bodies = []; }", items)

def done(page, n=1):
    page.wait_for_function("(n) => document.querySelectorAll(\"button[title='Regenerate']\").length >= n", arg=n, timeout=30000)

def open_more(page, name, testid):
    page.locator("nav button").last.click(); page.wait_for_timeout(200)
    page.locator(f".rounded-t-2xl button:has-text('{name}')").first.click()
    page.wait_for_selector(f"[data-testid={testid}]", timeout=5000)

def bodies(page):
    return page.evaluate("window.__mock.bodies.filter(x => x.max_tokens > 2)")

SITE = """Here is your page.

```html
<!doctype html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Crane Simulator</title>
<style>body{font-family:system-ui;margin:0} h1{color:#0f766e}</style></head>
<body><h1>Crane Simulator</h1><p id="log">Ready.</p><button onclick="document.getElementById('log').textContent='Hook up'">Lift</button>
<script>window.loaded = 1;</script></body></html>
```
"""

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    install(page)

    # ---- 1. a short follow-up with Web on is searched WITH its context ----
    png = page.evaluate("""() => { const c = document.createElement('canvas'); c.width = 600; c.height = 400; const g = c.getContext('2d'); g.fillStyle = '#e0a000'; g.fillRect(0,0,600,400); return c.toDataURL('image/png').split(',')[1]; }""")
    path = os.path.join(HERE, "_crane.png"); open(path, "wb").write(base64.b64decode(png))
    page.set_input_files("input[type=file][accept='image/*']", path); os.remove(path)
    page.wait_for_selector("textarea[placeholder='Message Attune'] >> xpath=../div//img", timeout=5000)
    queue(page, ["**This is a yellow all-terrain mobile crane** — most likely a Demag AC 100 (5 axles)."])
    send(page, "what is this crane")
    done(page)
    sys_prompt = bodies(page)[0]["messages"][0]["content"]
    check("Never stop at a generic label" in sys_prompt, "a photo question asks for type, likely make/model and facts — not just 'a mobile crane'")
    page.locator("button:has-text('Web')").first.click()
    queue(page, ["Demag AC 100 all-terrain crane model", "NONE", "NONE", "The **Demag AC 100** is a 100 t all-terrain crane [1]."])   # (v5.20: notes per page, then the answer)
    send(page, "What model")
    done(page, 2)
    q = page.evaluate("window.__mock.lastSearch.q")
    check(q.startswith("Demag AC 100"), "'What model' is searched as a full question from the chat and photo, not the bare words (%s)" % q)
    b = bodies(page)
    rewrite = str(b[0]["messages"][-1]["content"])
    check("Rewrite the new message" in rewrite and "what is this crane" in rewrite, "…the rewrite sees the conversation")
    check("image_url" in rewrite, "…and the photo the follow-up is about")
    check("Demag AC 100" in str(b[-1]["messages"][-1]["content"]), "…and the grounded answer is asked the full question")
    page.locator("button:has-text('Web')").first.click()   # web off

    # ---- 2. the composer never covers the last answer's buttons ----
    page.wait_for_timeout(400)
    page.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)"); page.wait_for_timeout(400)
    last_btn = page.locator("button[title='Regenerate']").last.bounding_box()
    comp = page.locator("[data-testid=composer]").bounding_box()
    check(last_btn["y"] + last_btn["height"] <= comp["y"] + 2, "the last answer's buttons sit above the composer (%d ≤ %d)" % (last_btn["y"] + last_btn["height"], comp["y"]))
    chips = page.locator(".att-chips button").last.bounding_box() if page.locator(".att-chips button").count() else None
    if chips: check(chips["y"] + chips["height"] <= comp["y"] + 30, "…and so do the follow-up chips")

    # ---- 3. tokens/s is not shown as "unusually slow" for a tiny answer ----
    check(page.locator("[data-testid=slow-hint]").count() == 0, "no 'unusually slow' warning on short answers")

    # ---- 3b. v5.15: a comparison carries its answer recipe to the model ----
    queue(page, ["**No — they are different.**\n\n| Point | Demag | Grove |\n|---|---|---|\n| Maker | Tadano | Manitowoc |"])
    page.click("header button[aria-label='New chat']"); page.wait_for_timeout(200)   # (a new chat: no photo carried over)
    send(page, "Is a Demag crane the same as a Grove crane?")
    done(page, 1)
    last = str(bodies(page)[-1]["messages"][-1]["content"])
    check("How to answer well" in last and "table" in last, "a comparison question is sent with its recipe (verdict + table)")
    check("How to answer well" not in bodies(page)[-1]["messages"][0]["content"], "…in the question, not the system prompt (the prompt cache keeps working)")

    # ---- 4. a web page answer opens as an artifact ----
    queue(page, [SITE])
    send(page, "Tell me about a crane simulator page")
    done(page, 2)
    card = page.locator("[data-testid=artifact-card]")
    check(card.count() == 1 and "Crane Simulator" in card.inner_text(), "an answer with a web page shows an artifact card with its title")
    card.click()
    page.wait_for_selector("[data-testid=artifact-viewer]", timeout=5000)
    fr = page.frame_locator("[data-testid=artifact-frame]")
    check(fr.locator("text=Ready.").count() == 1, "the page opens full screen in its clean first state")
    fr.locator("button:has-text('Lift')").click()
    check(fr.locator("text=Hook up").count() == 1, "…and it works (its button runs its script)")
    page.locator("[data-testid=artifact-code]").click()
    check("<title>Crane Simulator</title>" in page.locator("[data-testid=artifact-viewer] pre").inner_text(), "Code shows the page's source")
    page.locator("[data-testid=artifact-save]").click(); page.wait_for_timeout(200)
    # "Change it…" makes version 2
    queue(page, ["<<<<<<< SEARCH\nh1{color:#0f766e}\n=======\nh1{color:#1d4ed8}\n>>>>>>> REPLACE"])
    page.locator("[data-testid=artifact-ask]").fill("make the title blue")
    page.locator("[data-testid=artifact-change]").click()
    page.wait_for_selector("text=version 2 of 2", timeout=15000)
    check(True, "asking for a change saves version 2 (and keeps version 1)")
    page.locator("[data-testid=artifact-close]").click()
    open_more(page, "Artifacts", "artifacts-page")
    items = page.locator("[data-testid=artifact-item]")
    check(items.count() == 1 and "2 versions" in items.first.inner_text(), "Artifacts lists the saved page with its versions")

    # ---- 5. generated web pages start clean: the brief says so ----
    from pathlib import Path
    src = Path(HERE, "..", "web-src", "code.js").read_text()
    check("never click buttons, run a demo or fill logs automatically on load" in src, "web pages are told to open in their clean state (no demo run on load)")

    # ---- 6. Assistants: a chat with the Crane expert carries its instructions ----
    open_more(page, "Assistants", "assistants-page")
    check(page.locator("[data-testid=assistant-item]").count() >= 5, "built-in assistants are listed")
    page.locator("[data-testid=assistant-item] button:has-text('Crane expert')").click()
    page.wait_for_selector("[data-testid=space-empty]", timeout=5000)
    check("Crane expert" in page.locator("[data-testid=space-empty]").inner_text(), "Chat opens as the Crane expert, with its starters")
    queue(page, ["Outriggers **(رجل التثبيت)** spread the load."])
    send(page, "What do outriggers do?")
    done(page)
    sp = bodies(page)[0]["messages"][0]["content"]
    check('you are "Crane expert"' in sp and "Egyptian Arabic" in sp, "…and its instructions go into the system prompt")
    check(page.locator("[data-testid=space-chip]").count() == 1, "…the chat shows whose chat it is")
    # a custom assistant
    open_more(page, "Assistants", "assistants-page")
    page.locator("[data-testid=assistant-new]").click()
    page.locator("[data-testid=assistant-name]").fill("Tender writer")
    page.locator("[data-testid=assistant-instructions]").fill("Always answer as a formal tender document with numbered clauses.")
    page.locator("[data-testid=assistant-save]").click()
    check(page.locator("[data-testid=assistant-item]:has-text('Tender writer')").count() == 1, "a new assistant can be made and is saved")

    # ---- 7. Projects: instructions + knowledge reach the model ----
    open_more(page, "Projects", "projects-page")
    page.locator("[data-testid=project-new]").click()
    page.locator("[data-testid=project-name]").fill("Port Said tender")
    page.locator("[data-testid=project-instructions]").fill("Prices in EGP. We are the crane supplier.")
    page.locator("[data-testid=project-save]").click()
    page.wait_for_selector("[data-testid=project-page]", timeout=5000)
    page.locator("[data-testid=project-add-note]").click()
    page.locator("[data-testid=project-note-text]").fill("Client rate card: LTM 1100 costs 18,000 EGP per day including operator.")
    page.locator("[data-testid=project-note-save]").click()
    check(page.locator("[data-testid=project-file]").count() == 1, "a note is added to the project's knowledge")
    page.locator("[data-testid=project-new-chat]").click()
    page.wait_for_selector("[data-testid=space-empty]", timeout=5000)
    queue(page, ["From your rate card: **18,000 EGP per day**."])
    send(page, "What is our daily price for the LTM 1100?")
    done(page)
    sp = bodies(page)[0]["messages"][0]["content"]
    check("Prices in EGP" in sp and "18,000 EGP per day" in sp, "a chat in a project gets its instructions and the matching knowledge")
    open_more(page, "Projects", "projects-page")
    page.locator("[data-testid=project-item]").first.click()
    check(page.locator("[data-testid=project-chat]").count() == 1, "the project lists its chat")
    page.locator("[data-testid=project-chat]").first.click()
    page.wait_for_selector("text=18,000 EGP per day", timeout=5000)
    check(True, "…and opening it goes back to that chat")

    # ---- 8. Themes ----
    page.locator("nav button").last.click(); page.wait_for_timeout(200)
    page.locator("[data-testid=accent-violet]").click()
    v = page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--color-teal-500')")
    check("292" in v, "a colour theme recolours the whole app (teal → violet: %s)" % v.strip())
    page.locator("[data-testid=bg-light]").click()
    bg = page.evaluate("getComputedStyle(document.body).backgroundColor")
    check(bg.startswith("oklch(0.98") or "248" in bg or bg.startswith("oklch(98"), "Light background makes the page light (%s)" % bg)
    page.screenshot(path=HERE + "/v514-light.png")
    page.reload(); page.wait_for_selector("nav", timeout=15000)
    check("292" in page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--color-teal-500')"), "the theme is kept after reopening the app")
    page.evaluate("localStorage.setItem('attune:theme:v1', '{}')")

    errs = real_errors(errors)
    check(not errs, "no JavaScript errors in the page (%d)%s" % (len(errs), (": " + errs[0]) if errs else ""))
    ctx.close(); br.close()
env.close()
finish()
