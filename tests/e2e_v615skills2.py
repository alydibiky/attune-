"""Skills, second round — a skill can include another skill ({{skill:vat}}), and the optional checklist pass:
after the answer one short model call checks each checklist line; the result shows under the answer (tap to open),
"Fix it" sends one revision call and Undo brings the first answer back. Off by default: no extra call then.

  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v615skills2.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish

env = Env()

def open_skills(page):
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('Skills')").first.click()
    page.wait_for_selector("[data-testid=skills-page]", timeout=5000)

def to_chat(page):
    page.evaluate("window.__attuneBack && window.__attuneBack()"); page.wait_for_timeout(300)
    if page.locator("textarea[placeholder='Message Attune']").count() == 0:
        page.locator("nav button").first.click(); page.wait_for_timeout(300)
    page.locator("button[aria-label='New chat']").first.click(); page.wait_for_timeout(300)

def import_skill(page, text):
    page.click("[data-testid=skill-open-import]"); page.wait_for_selector("[data-testid=skill-import]")
    page.fill("[data-testid=skill-import-text]", text)
    page.wait_for_selector("[data-testid=skill-import-preview]", timeout=3000)
    page.click("[data-testid=skill-import-save]"); page.wait_for_timeout(300)

def send(page, text, wait=2500):
    page.locator("textarea[placeholder='Message Attune']").fill(text)
    page.locator("button[title='Send']").first.click()
    page.wait_for_timeout(wait)

def bodies(page):
    return page.evaluate("() => (window.__mock.bodies || []).filter((x) => x.max_tokens > 2).map((b) => ({ sys: (b.messages.find((m) => m.role === 'system') || {}).content || '', user: (b.messages.filter((m) => m.role === 'user').slice(-1)[0] || {}).content || '' }))")

ANSWER = "Quote: 50 t crane, 3 days at 9000 EGP/day. Total 27000 EGP."
CHECK = '[{"n":1,"pass":true,"why":"total shown"},{"n":2,"pass":false,"why":"no VAT line"}]'
FIXED = "Quote: 50 t crane, 3 days at 9000 EGP/day. Total 27000 EGP. VAT 14%: 3780 EGP."

with sync_playwright() as p:
    br = p.chromium.launch()
    errors = []
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(250)
    open_skills(page)
    import_skill(page, "---\nname: VAT rule\ncommand: /vat\nwhen: value added tax\n---\nAlways add VAT at 14 percent as its own line.")
    import_skill(page, "---\nname: Crane quote check\ncommand: /qc\nwhen: crane quote checked\n---\nWrite a short crane quote. {{skill:vat}}\n\n## Checklist\n- total equals days x rate\n- VAT 14% on its own line\n")

    # ---- the editor: the switch is off by default, includes are listed, a missing include is a clear error
    page.locator("[data-testid=skill-row]:has-text('Crane quote check') button.text-start").click()
    page.wait_for_selector("[data-testid=skill-editor]")
    check(page.get_attribute("[data-testid=skill-selfcheck]", "aria-checked") == "false", "the checklist pass is off by default")
    check("VAT rule" in page.locator("[data-testid=skill-includes]").inner_text(), "the editor shows which skills this one includes")
    page.fill("[data-testid=skill-instructions]", "Write a short crane quote. {{skill:vat}} {{skill:nothere}}")
    check(page.locator("[data-testid=skill-include-error]").count() == 1 and "nothere" in page.locator("[data-testid=skill-include-error]").inner_text(), "a missing included skill is a clear error")
    page.fill("[data-testid=skill-instructions]", "Write a short crane quote. {{skill:vat}}")
    page.click("[data-testid=skill-save]"); page.wait_for_timeout(300)

    # ---- off: one model call, no check
    to_chat(page)
    page.evaluate(f"() => {{ window.__mock.bodies = []; window.__mock.fakeQueue = [{json.dumps(ANSWER)}]; }}")
    send(page, "/qc 50 t crane 3 days at 9000")
    b = bodies(page)
    check(any("VAT at 14 percent" in x["user"] for x in b), "the included skill's instructions reach the model")
    check(not any("checklist" in x["sys"].lower() for x in b), "switch off → no checklist call")
    check(page.locator("[data-testid=skill-check]").count() == 0, "…and nothing shown under the answer")

    # ---- on
    open_skills(page)
    page.locator("[data-testid=skill-row]:has-text('Crane quote check') button.text-start").click()
    page.wait_for_selector("[data-testid=skill-editor]")
    page.click("[data-testid=skill-selfcheck]")
    check(page.get_attribute("[data-testid=skill-selfcheck]", "aria-checked") == "true", "the switch turns on")
    page.click("[data-testid=skill-save]"); page.wait_for_timeout(300)
    to_chat(page)
    page.evaluate(f"() => {{ window.__mock.bodies = []; window.__mock.fakeQueue = [{json.dumps(ANSWER)}, {json.dumps(CHECK)}, {json.dumps(FIXED)}]; }}")
    send(page, "/qc 50 t crane 3 days at 9000", 3500)
    b = bodies(page)
    chk = [x for x in b if "checklist" in x["sys"].lower()]
    check(len(chk) == 1 and "1. total equals days x rate" in chk[0]["user"] and "27000" in chk[0]["user"], "one checklist call, with the numbered lines and the answer")
    page.wait_for_selector("[data-testid=skill-check-summary]", timeout=5000)
    s = page.locator("[data-testid=skill-check-summary]").inner_text()
    check("1 of 2 not met" in s, "the result shows under the answer: %s" % s)
    check(ANSWER in page.locator("main").inner_text() if page.locator("main").count() else True, "the first answer stays shown")
    page.click("[data-testid=skill-check-summary]"); page.wait_for_timeout(200)
    lines = page.locator("[data-testid=skill-check-lines]").inner_text()
    check("no VAT line" in lines and "✓" in lines and "✗" in lines, "tap → each line with pass/fail and its reason")
    check("one more model run" in page.locator("[data-testid=skill-check-fix]").inner_text(), "Fix it says it costs a model run")
    page.click("[data-testid=skill-check-fix]"); page.wait_for_timeout(1500)
    b = bodies(page)
    check("Failed checks" in b[-1]["user"] and "VAT 14% on its own line" in b[-1]["user"] and "total equals" not in b[-1]["user"].split("Failed checks")[1], "Fix it sends one revision call with only the failed line")
    check("3780" in page.content(), "the fixed answer replaces the first")
    check("Fixed to meet the checklist" in page.locator("[data-testid=skill-check]").inner_text(), "…and says so")
    page.click("[data-testid=skill-check-undo]"); page.wait_for_timeout(300)
    check("3780" not in page.content(), "Undo brings the first answer back")

    # ---- an unreadable check is quiet
    page.locator("button[aria-label='New chat']").first.click(); page.wait_for_timeout(300)
    page.evaluate(f"() => {{ window.__mock.fakeQueue = [{json.dumps(ANSWER)}, 'I think it is all fine.']; }}")
    send(page, "/qc 20 t crane 1 day at 5000", 3500)
    check("Could not check" in page.locator("[data-testid=skill-check]").inner_text() and page.locator("[data-testid=skill-check-fix]").count() == 0, "an unreadable check says so quietly, no Fix button")
    check(real_errors(errors) == [], "no errors: %s" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
