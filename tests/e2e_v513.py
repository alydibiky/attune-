"""v5.13 — Ali's phone test: code boxes, scrolling over tables, paste, long
answers, the language of the reply, sums checked, files, Business designs,
Learn daily layout, chats kept, Cycle off the home screen.

  python3 tests/e2e_v513.py
"""
import sys, json, base64
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

def queue(page, items, tokens=None):
    page.evaluate("([q, t]) => { const M = window.__mock; M.fakeQueue = q; M.bodies = []; M.fakeTokens = t; }", [items, tokens])

def done(page, n=1):
    page.wait_for_function("(n) => document.querySelectorAll(\"button[title='Regenerate']\").length >= n", arg=n, timeout=30000)

def open_more(page, name, testid):
    page.locator("nav button").last.click(); page.wait_for_timeout(200)
    page.locator(f".rounded-t-2xl button:has-text('{name}')").first.click()
    page.wait_for_selector(f"[data-testid={testid}]", timeout=5000)

CODE_TWICE = "```\n```python\ndef second_largest_distinct(data):\n    unique_sorted = sorted(set(data), reverse=True)\n    return unique_sorted[1] if len(unique_sorted) > 1 else None\n```\n```"
TABLE = "| Type | Reach | Capacity | Best for | Notes | More | Even more |\n|---|---|---|---|---|---|---|\n" + "\n".join(f"| Row {i} | long cell text here {i} | 100 t | sites | notes notes | more more | even more more |" for i in range(12))

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.set_viewport_size({"width": 400, "height": 800})
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)

    # ---- home screen: no period tracker ----
    nav = page.locator("nav").inner_text()
    check("Cycle" not in nav and "Business" in nav, "the bottom bar has Business, not Cycle (%s)" % nav.replace("\n", " "))
    check(page.locator("text=Log my period").count() == 0, "no 'Log my period' starter on the home screen")
    install(page)

    # ---- 1. a code box opened twice by the model: ONE box with the code in it ----
    queue(page, [CODE_TWICE])
    send(page, "Tell me something about lists")
    done(page)
    boxes = page.locator("[data-testid=code-box]")
    check(boxes.count() == 1, "the doubled fence gives ONE code box, not an empty one + loose code (%d)" % boxes.count())
    check("def second_largest_distinct" in boxes.first.inner_text(), "…and the code is inside the box")
    check(page.locator(".att-md em").count() == 0, "second_largest_distinct is not turned into italics")
    check("Python" in boxes.first.inner_text(), "the box says which language it is")

    # ---- 2. a wide table: up/down swipes go to the page ----
    queue(page, [TABLE])
    send(page, "Compare them in a table")
    done(page, 2)
    st = page.evaluate("""() => { const t = [...document.querySelectorAll('[data-testid=md-table]')].pop(); const c = getComputedStyle(t);
      return { oy: c.overflowY, ox: c.overflowX, ob: c.overscrollBehaviorY, obx: c.overscrollBehaviorX, wide: t.scrollWidth > t.clientWidth }; }""")
    check(st["wide"] and st["ox"] == "auto", "the wide table scrolls sideways inside its box")
    check(st["oy"] == "hidden" and st["ob"] == "auto", "…but up/down is NOT held by the table: it goes to the page (%s)" % st)
    pre = page.evaluate("() => { const c = getComputedStyle(document.querySelector('[data-testid=code-box] pre')); return [c.overscrollBehaviorY, c.overflowY]; }")
    check(pre[0] == "auto", "same for code boxes (%s)" % pre)
    # a real wheel scroll that starts over the table moves the page
    page.evaluate("window.scrollTo(0, 0)")
    box = page.locator("[data-testid=md-table]").last.bounding_box()
    page.evaluate("window.scrollTo(0, 0)"); page.wait_for_timeout(100)
    y0 = page.evaluate("window.scrollY")
    page.mouse.move(box["x"] + 50, min(box["y"] + 40, 700)); page.mouse.wheel(0, 400); page.wait_for_timeout(400)
    check(page.evaluate("window.scrollY") > y0, "scrolling with the pointer over the table scrolls the page")

    # ---- 3. pasted text shows at once ----
    page.evaluate("""() => { const t = document.querySelector('[data-testid=chat-input]');
      const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(t, 'pasted from WhatsApp');
      t.dispatchEvent(new Event('paste', { bubbles: true })); }""")
    page.wait_for_timeout(200)
    check(page.locator("button[title='Send']").count() == 1, "text pasted into the box is picked up at once (Send appears)")
    page.evaluate("""() => { const t = document.querySelector('[data-testid=chat-input]');
      const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(t, 'typed while away');
      window.dispatchEvent(new Event('attune-resume')); }""")
    page.wait_for_timeout(200)
    check(page.locator("button[title='Send']").count() == 1, "coming back to the app re-reads the text box")
    page.locator("textarea[placeholder='Message Attune']").fill("")

    # ---- 4. a long answer cut by the limit: Continue carries on in the same bubble ----
    queue(page, ["The crane has four outriggers. First, the"], tokens="max")
    send(page, "Explain crane outriggers in detail")
    done(page, 3)
    b = page.evaluate("window.__mock.bodies.filter(x => x.max_tokens > 2).pop()")
    check(b["max_tokens"] >= 2048, "answers get room for a full page (max_tokens %d, was 900)" % b["max_tokens"])
    check(page.locator("[data-testid=continue]").count() == 1, "a cut answer offers Continue")
    queue(page, ["pads spread the load over the ground."])
    page.click("[data-testid=continue]")
    page.wait_for_function("() => document.body.innerText.includes('First, the pads spread the load')", timeout=15000)
    check(page.locator("[data-testid=continue]").count() == 0, "Continue writes on in the SAME bubble, and goes away when finished")
    last = page.evaluate("window.__mock.bodies.filter(x => x.max_tokens > 2).pop().messages")
    check(last[-2]["role"] == "assistant" and "First, the" in last[-2]["content"] and "Continue exactly" in last[-1]["content"], "…the model sees what it wrote and is asked to carry on")

    # ---- 5. English question after Arabic turns → English reply requested ----
    queue(page, ["تمام"])
    send(page, "اشرحلي الونش التلسكوبي باختصار")
    done(page, 4)
    queue(page, ["Sure."])
    send(page, "And what about lattice boom cranes?")
    done(page, 5)
    u = page.evaluate("window.__mock.bodies.filter(x => x.max_tokens > 2).pop().messages").pop()["content"]
    check("(Write the reply in English.)" in u, "an English question gets 'reply in English' even after Arabic turns")

    # ---- 6. a sum that doesn't add up is re-done by running code ----
    page.click("header button[aria-label='New chat']") if page.locator("header button[aria-label='New chat']").count() else None
    page.wait_for_timeout(200)
    WRONG = "Days: 5 - 1 = 4\nRent: 25,000 × 4 = **10,000 EGP**\nVAT: 10,000 × 0.04% = 40\n**Total: 10,040 EGP**"
    PROG = "```python\ndays = 5\nrate = 25000\nrent = days * rate\nvat = rent * 14 / 100\nprint(rent, vat, rent + vat)\nprint('ANSWER: 125000 EGP rent, 142500 EGP with VAT')\n```"
    EXPL = "**Rent 125,000 EGP; with 14% VAT 142,500 EGP.**\n1. 1–5 October inclusive = 5 days\n2. 5 × 25,000 = 125,000\n3. 125,000 × 14% = 17,500\n4. 125,000 + 17,500 = 142,500"
    queue(page, [WRONG, PROG, EXPL])
    send(page, "Crane hire 25000 each day, the 1st to the 5th both included. Give me the rent and the rent with the 14 tax added.")
    page.wait_for_selector("[data-testid=slip-fixed]", timeout=60000)
    txt = page.locator(".att-md").last.inner_text()
    check("142,500" in txt and "10,040" not in txt, "the wrong sum is caught and the answer re-done by running code (142,500)")

    # ---- 7. the money word problem goes to the checked route directly ----
    queue(page, [PROG, EXPL])
    send(page, "A crane rents for 25,000 EGP a day. A job runs from 1 October to 5 October, both days included. How much is the rent, and how much with 14% VAT?")
    page.wait_for_function("() => document.querySelectorAll('[data-testid=verified]').length >= 1", timeout=60000)
    check(True, "Ali's rent + VAT question is worked out as a program on the phone")

    # ---- 8. an attendance 'xls' that is really HTML ----
    html = "<html><body><table><tr><td colspan=3>July attendance</td></tr><tr><th>Name</th><th>Date</th><th>Hours</th></tr><tr><td>Ahmed</td><td>2026-07-01</td><td>8.5</td></tr><tr><td>Mohamed</td><td>2026-07-01</td><td>7</td></tr></table></body></html>"
    page.locator("[data-testid=attach-file]").set_input_files(files=[{"name": "حضور يوليو-1.xls", "mimeType": "application/vnd.ms-excel", "buffer": html.encode("utf-8")}])
    page.wait_for_selector("[data-testid=attached]")
    FILEPROG = "```python\nsheets = load_sheets('حضور يوليو-1.xls')\ndf = list(sheets.values())[0]\nprint(df)\nprint('ANSWER:', df['Hours'].sum(), 'hours')\n```"
    page.wait_for_timeout(2500)   # (background work after the last answer finishes first)
    queue(page, [FILEPROG, "**15.5 hours** in total."])
    send(page, "Tell me the total attendance hours")
    page.wait_for_selector("[data-testid=computed]", timeout=120000)
    check("15.5" in page.locator(".att-md").last.inner_text(), "an .xls that is really an HTML table is read, and the total computed (15.5 h)")

    # ---- 9. chats are saved when leaving the app ----
    page.evaluate("window.dispatchEvent(new Event('attune-pause'))")
    saved = json.loads(page.evaluate("localStorage.getItem('attune:chats:v1')"))
    check(any("attendance" in json.dumps(c) for c in saved), "leaving the app saves the chat at once")
    page.reload(); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button[aria-label]").first.click(); page.wait_for_timeout(300)
    check(page.locator("text=No chats yet.").count() == 0, "after a restart the chats are all in the history")
    page.keyboard.press("Escape"); page.evaluate("window.__attuneBack && window.__attuneBack()"); page.wait_for_timeout(200)
    ctx.close()

    # ---- 10. Business: JSON broken → simple lines → a real design ----
    ctx, page = new_page(br, env, errors)
    page.set_viewport_size({"width": 400, "height": 800})
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    install(page)
    page.locator("nav button:has-text('Business')").click()
    page.wait_for_selector("[data-testid=business-page]", timeout=5000)
    page.click("[data-testid=erp-new]")
    LINES = "TABLE Customers\n- Name: text\n- Phone: phone\nTABLE Cranes\n- Code: auto\n- Model: text\n- Status: choice (Available, On hire)\nTABLE Jobs\n- Customer: link Customers\n- Crane: link Cranes\n- Days: number\n- Daily rate: money\n- Total: formula [Days] * [Daily rate]"
    queue(page, ['{"name": "Cranes", "tables": [{"name": "Customers", "fields": [{"name": "Na', LINES])
    page.fill("[data-testid=erp-desc]", "We rent mobile cranes (20-500 t) with operators in Egypt. We track customers, jobs per site, daily rates, invoices and payments, maintenance, etc")
    page.click("[data-testid=erp-design]")
    page.wait_for_selector("[data-testid=erp-draft]", timeout=30000)
    d = page.locator("[data-testid=erp-draft]").inner_text()
    check("Jobs" in d and "Cranes" in d, "a broken JSON design is rescued by the simple line format")
    page.locator("[data-testid=erp-draft] button").first.click(); page.wait_for_timeout(200)
    queue(page, ["no idea", "sorry"])
    page.click("[data-testid=erp-design]")
    page.wait_for_selector("[data-testid=erp-draft]", timeout=30000)
    d = page.locator("[data-testid=erp-draft]").inner_text()
    check("Equipment" in d and "Maintenance" in d, "if the model can't design at all, the closest template (crane rental) is used — never a dead end")
    ctx.close()

    # ---- 11. Learn daily: the notification row is readable ----
    ctx, page = new_page(br, env, errors)
    page.set_viewport_size({"width": 400, "height": 800})
    page.add_init_script("""localStorage.setItem('attune:daily:courses:v1', JSON.stringify([{ id: 'c1', topic: 'Turkish', level: 'beginner', lang: 'en', goal: '', time: '08:00', quizEvery: 5,
      plan: ['Lesson 1', 'Lesson 2'], lessons: [], quizzes: [], review: [], streak: 0, created: 1 }]));""")
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    open_more(page, "Learn daily", "learn-page")
    page.locator("text=Turkish").first.click(); page.wait_for_selector("[data-testid=learn-time]", timeout=5000)
    h = page.evaluate("() => { const el = [...document.querySelectorAll('span')].find(s => s.textContent.trim() === 'Daily notification'); return el ? el.getBoundingClientRect().height : -1; }")
    check(0 < h < 40, "'Daily notification' reads on one line, not one letter per line (height %d px)" % h)
    w = page.evaluate("() => { const r = document.querySelector('[data-testid=learn-time]').getBoundingClientRect(); return [r.right, window.innerWidth]; }")
    check(w[0] <= w[1], "the time box stays inside the screen (%s)" % w)
    ctx.close()

    check(not real_errors(errors), "no JavaScript errors in the page (%d)" % len(real_errors(errors)))
    br.close()
env.close()
finish()
