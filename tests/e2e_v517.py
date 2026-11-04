"""v5.17 — Ali's phone test of v5.16: website links reloading Attune, a
wrong total after "And with 5 cranes", Memory items opening off-screen,
Business (rename by tap, connections, queries and forms from a sentence),
Copilot (bring a chat), Memory in the bottom bar, the version shown.

  python3 tests/e2e_v517.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish, HERE, to_tables, leave_apps

env = Env(); errors = []

def install(page):
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)

def send(page, text):
    page.locator("textarea[placeholder='Message Attune']").fill(text)
    page.locator("button[title='Send']").first.click()

def done(page, n=1):
    page.wait_for_function("(n) => document.querySelectorAll(\"button[title='Regenerate']\").length >= n", arg=n, timeout=30000)

def queue(page, items):
    page.evaluate("(q) => { const M = window.__mock; M.fakeQueue = q; M.bodies = []; }", items)

def bodies(page):
    return page.evaluate("window.__mock.bodies.filter(x => x.max_tokens > 2)")

def open_more(page, name, testid):
    leave_apps(page); page.locator("nav button").last.click(); page.wait_for_timeout(200)
    page.locator(f".rounded-t-2xl button:has-text('{name}')").first.click()
    page.wait_for_selector(f"[data-testid={testid}]", timeout=5000)

SITE = """```html
<!doctype html><html><head><title>Oriental Delights</title></head><body style="margin:0">
<nav><a href="#menu" id="go">Menu</a> <a href="about.html" id="away">About</a></nav>
<div style="height:1500px">Welcome to Our Table</div>
<section id="menu"><h2>Our Menu</h2></section>
<form id="f"><input name="n"><button id="send">Send</button></form>
</body></html>
```"""

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    install(page)

    # ---- 1. links and forms inside a generated website stay inside it ----
    queue(page, [SITE])
    send(page, "Tell me about an oriental restaurant page")
    done(page)
    page.locator("[data-testid=artifact-card]").click()
    page.wait_for_selector("[data-testid=artifact-viewer]")
    fr = page.frame_locator("[data-testid=artifact-frame]")
    fr.locator("#go").click(); page.wait_for_timeout(600)
    check(fr.locator("text=Welcome to Our Table").count() == 1 and fr.locator("nav").count() == 1 and fr.locator("text=Message Attune").count() == 0,
          "tapping a #menu link keeps the page (Attune does not open inside it)")
    body = page.frame_locator("[data-testid=artifact-frame]").locator("body")
    for _ in range(12):   # smooth scrolling can take longer when the machine is busy
        y = body.evaluate("e => e.ownerDocument.defaultView.scrollY")
        if y > 300: break
        page.wait_for_timeout(250)
    check(y > 300, "…and scrolls down to that section (%d px)" % y)
    fr.locator("#away").click(); page.wait_for_timeout(400)
    check(fr.locator("text=Welcome to Our Table").count() == 1, "a link to another file doesn't load Attune either")
    fr.locator("#send").click(); page.wait_for_timeout(400)
    check(fr.locator("text=Welcome to Our Table").count() == 1, "a form's Send button doesn't either")
    page.locator("[data-testid=artifact-close]").click()

    # ---- 2. "And with 5 cranes" after an instant sum: worked out with the first question ----
    page.click("header button[aria-label='New chat']"); page.wait_for_timeout(200); page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'chat'}}))"); page.wait_for_timeout(400)   # v7.6: New chat → Home, then Chat
    send(page, "3 cranes × 4 days × 25,000 EGP + 14% VAT")
    page.wait_for_selector("text=342,000", timeout=15000)
    queue(page, ["```python\nprint('ANSWER: 570000')\n```", "**570,000 EGP**\n\n1. 5 × 4 × 25,000 = 500,000\n2. 14% of 500,000 = 70,000\n3. 500,000 + 70,000 = 570,000"])
    send(page, "And with 5 cranes")
    done(page, 2)
    firsts = [str(b["messages"][-1]["content"]) for b in bodies(page)]
    check(any("25,000" in f and "And with 5 cranes" in f for f in firsts), "the follow-up is worked out WITH the first question (by running code)")
    check(page.locator("text=453,000").count() == 0 and page.locator(".att-md").last.inner_text().count("570,000") >= 1, "the total is 570,000")

    # ---- 3. Memory: in the bottom bar, and an item opens ON the screen ----
    leave_apps(page); nav = page.locator("nav").inner_text()
    check("Mind" in nav, "Mind (v6.8, was Memory) is in the bottom bar")
    page.locator("nav button:has-text('Mind')").click()
    page.wait_for_timeout(400)
    item = page.locator("button:has-text('And with 5 cranes')").first
    item.scroll_into_view_if_needed(); item.click(); page.wait_for_timeout(400)
    card = page.locator("div.fixed.inset-0.z-50 > div").first
    bb = card.bounding_box(); vh = page.viewport_size["height"]
    check(bb is not None and bb["y"] >= 0 and bb["y"] < vh * 0.8, "a Memory item opens where you can see it (top at %s of %d)" % (bb and int(bb["y"]), vh))
    page.mouse.click(5, 5); page.wait_for_timeout(200)

    # (v9.1: this section used Business — archived with it in archive/business/tests/mixed/e2e_v517.py)
    # ---- 5. Copilot: bring a chat from ChatGPT in one paste ----
    open_more(page, "Copilot", "cp-import")
    queue(page, ["Ask it to compare the LTM 1100 and GMK5150 for a 60 t lift at 14 m, as a table."] * 3)
    page.locator("[data-testid=cp-import-text]").fill("ChatGPT: The LTM 1100 is a 100 t crane with a 60 m boom.")
    page.click("[data-testid=cp-import-go]")
    try: page.wait_for_function("() => document.body.innerText.includes('Pasted from')", timeout=20000)
    except Exception: page.screenshot(path=HERE + "/v517-copilot.png", full_page=True)
    check(page.locator("text=Pasted from").count() >= 1, "a pasted chat is read into the conversation")
    check(len(bodies(page)) >= 1, "…and Attune suggests the next message straight away")

    # ---- 6. the version is shown ----
    leave_apps(page); page.locator("nav button").last.click(); page.wait_for_timeout(200)
    import re as _re
    check(bool(_re.search(r"Attune \d+\.\d+", page.locator("[data-testid=app-version]").inner_text())), "More shows the version (so an old page can be spotted)")

    errs = real_errors(errors)
    check(not errs, "no JavaScript errors in the page (%d)%s" % (len(errs), (": " + errs[0]) if errs else ""))
    ctx.close(); br.close()
env.close()
finish()
