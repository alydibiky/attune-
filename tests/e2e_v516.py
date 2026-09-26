"""v5.16 — typing while it answers (queue), follow-ups that keep their
context, and a lighter screen while answers stream.

  python3 tests/e2e_v516.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish, HERE

env = Env(); errors = []

def install(page):
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)

def type_send(page, text):
    page.locator("textarea[placeholder='Message Attune']").fill(text)
    page.locator("button[title='Send']").first.click()

def done(page, n=1):
    page.wait_for_function("(n) => document.querySelectorAll(\"button[title='Regenerate']\").length >= n", arg=n, timeout=30000)

def bodies(page):
    return page.evaluate("window.__mock.bodies.filter(x => x.max_tokens > 2)")

LONG = "**The Liebherr LTM 1100-4.2 is a 100 t all-terrain crane.** " + "It has a 60 m telescopic boom and four axles. " * 40

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    install(page)

    # ---- 1. typing while it answers: queued, then read with that answer in view ----
    page.evaluate("(q) => { const M = window.__mock; M.fakeQueue = q; M.bodies = []; M.slowQueue = 60; }",
                  [LONG, "**Updated:** the LTM 1100-4.2 costs about 18,000 EGP a day to rent."])
    type_send(page, "Tell me about the Liebherr LTM 1100")
    page.wait_for_selector("text=100 t all-terrain crane", timeout=10000)
    check(page.locator("button[title='Regenerate']").count() == 0, "the first answer is still being written")
    type_send(page, "also add the daily rental price")
    page.wait_for_selector("[data-testid=queued]", timeout=3000)
    check("also add the daily rental price" in page.locator("[data-testid=queued]").inner_text(), "a message typed while it answers waits under the answer")
    check(page.locator("button[title='Stop']").count() == 1, "…and the first answer was NOT stopped")
    check(page.locator("textarea[placeholder='Message Attune']").input_value() == "", "…the box is free for more typing")
    done(page, 2)
    page.evaluate("window.__mock.slowQueue = 0")
    check(page.locator("[data-testid=queued]").count() == 0, "when the answer is done, the waiting message is sent by itself")
    b = bodies(page)[-1]["messages"]
    check("write the complete UPDATED answer" in str(b[-1]["content"]) and "also add the daily rental price" in str(b[-1]["content"]), "…told it came in during the last answer, so it updates that answer")
    check(any("100 t all-terrain crane" in str(m["content"]) for m in b[:-1] if m["role"] == "assistant"), "…with the first answer in view")
    check(page.locator("text=18,000 EGP a day").count() == 1, "the updated answer is shown")

    # "Send now" skips the wait (stops the current answer)
    page.evaluate("(q) => { const M = window.__mock; M.fakeQueue = q; M.bodies = []; M.slowQueue = 60; }", [LONG, "Right away."])
    type_send(page, "Tell me about it again")
    page.wait_for_selector("text=100 t all-terrain crane", timeout=10000)
    type_send(page, "stop, just say yes")
    page.locator("[data-testid=queued-now]").click()
    page.wait_for_selector("text=Right away.", timeout=15000)
    page.evaluate("window.__mock.slowQueue = 0")
    check(page.locator("[data-testid=queued]").count() == 0, "'Send now' stops the answer and sends the waiting message at once")

    # ---- 2. follow-up suggestions fit the answer ----
    page.click("header button[aria-label='New chat']"); page.wait_for_timeout(200)
    page.evaluate("(q) => { const M = window.__mock; M.fakeQueue = q; M.bodies = []; }", ["**No — different models.**\n\n| Point | A | B |\n|---|---|---|\n| Capacity | 100 t | 90 t |"])
    type_send(page, "Is the LTM 1100 the same as the LTM 1090?")
    done(page)
    chips = page.locator(".att-chips").last.inner_text()
    check("Which should I choose?" in chips, "after a comparison, the suggestions offer 'Which should I choose?' (%s)" % chips.replace("\n", " · "))

    # ---- 3. a maths follow-up keeps the earlier question ----
    page.click("header button[aria-label='New chat']"); page.wait_for_timeout(200)
    page.evaluate("(q) => { const M = window.__mock; M.fakeQueue = q; M.bodies = []; }",
                  ["```python\nprint('ANSWER: 342000')\n```", "**342,000 EGP**", "```python\nprint('ANSWER: 570000')\n```", "**570,000 EGP**"] * 2)
    type_send(page, "3 cranes × 4 days × 25,000 EGP a day + 14% VAT — total?")
    done(page)
    page.evaluate("() => { window.__mock.bodies = []; }")
    type_send(page, "and with 5 cranes?")
    done(page, 2)
    firsts = [str(x["messages"][-1]["content"]) for x in bodies(page)]
    check(any("3 cranes × 4 days" in f and "and with 5 cranes?" in f for f in firsts), "'and with 5 cranes?' is worked out WITH the earlier question")

    # ---- 4. lighter screen while streaming ----
    src = open(HERE + "/../web-src/chat.jsx", encoding="utf-8").read()
    check("export const Md = React.memo(MdView)" in src, "answers already on screen are not redrawn while a new one streams")
    page.click("header button[aria-label='New chat']"); page.wait_for_timeout(200)
    page.evaluate("(q) => { const M = window.__mock; M.fakeQueue = q; M.slowQueue = 5; }", ["word " * 2000])
    page.evaluate("""() => { window.__muts = 0; const mo = new MutationObserver((l) => { window.__muts += 1; });
      mo.observe(document.body, { subtree: true, childList: true, characterData: true }); window.__mo = mo; }""")
    type_send(page, "Say 'word' many times")
    done(page)
    n = page.evaluate("() => { window.__mo.disconnect(); return window.__muts; }")
    check(n < 250, "a 10,000-character answer streamed in 250 pieces redraws the screen far fewer times (%d mutation batches)" % n)

    errs = real_errors(errors)
    check(not errs, "no JavaScript errors in the page (%d)%s" % (len(errs), (": " + errs[0]) if errs else ""))
    ctx.close(); br.close()
env.close()
finish()
