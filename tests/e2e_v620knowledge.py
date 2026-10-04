"""v6.20 — Knowledge: add a pasted text, ask a fact question in Chat (the facts block reaches the model, the answer shows its
source chip and no [K1] tag), chit-chat gets nothing, switch off → no block and no chip, remove the source, and the Arabic
screen shows no Latin words. SHOTS=dir saves screenshots.

  python3 tests/e2e_v620knowledge.py
"""
import os
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
def shot(page, name):
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, name + ".png"))

def open_knowledge(page):
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('Knowledge'), .rounded-t-2xl button:has-text('المعرفة')").first.click()
    page.wait_for_selector("[data-testid=knowledge]", timeout=5000)

def to_chat(page):
    page.evaluate("window.__attuneBack && window.__attuneBack()"); page.wait_for_timeout(300)
    if page.locator("textarea[placeholder='Message Attune']").count() == 0:
        page.locator("nav button").first.click(); page.wait_for_timeout(300)
    page.locator("button[aria-label='New chat']").first.click(); page.wait_for_timeout(300)

def send(page, text, answer):
    page.evaluate("(a) => { const M = window.__mock; M.bodies = []; M.fakeQueue = [a, a, a]; }", answer)
    page.locator("textarea[placeholder='Message Attune']").fill(text)
    page.locator("button[title='Send']").first.click()
    page.wait_for_timeout(2500)

def last_user(page):
    return page.evaluate("() => { const b = (window.__mock.bodies || []).filter((x) => x.max_tokens > 2); const m = b[0]; return m ? (m.messages.filter((x) => x.role === 'user').slice(-1)[0] || {}).content || '' : ''; }")

def last_ai(page):
    return page.locator("[data-testid=kn-chips]").count(), page.locator("main").inner_text()

VISIBLE = r"""() => {
  const out = new Set(), root = document.querySelector('[data-testid=knowledge]');
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) { const t = n.nodeValue.trim(); if (t && /[A-Za-z]{2}/.test(t.replace(/Attune|PDF/g, ''))) out.add(t); }
  root.querySelectorAll('input[placeholder],textarea[placeholder]').forEach((e) => { if (/[A-Za-z]{2}/.test(e.placeholder)) out.add('placeholder: ' + e.placeholder); });
  return [...out];
}"""

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(250)

    # ---- the screen, and a pasted text
    open_knowledge(page)
    check(page.locator("[data-testid=kn-switch]").get_attribute("aria-checked") == "true", "Knowledge opens from More, switched on")
    page.click("[data-testid=kn-paste]")
    page.fill("[data-testid=kn-paste-title]", "Villa rules")
    page.fill("[data-testid=kn-paste-text]", "The pool opens at 8 am and closes at 10 pm.\n\nThe gate code for the villa is 4471. Guests park in bay 12.\n\nRubbish is collected on Mondays and Thursdays.")
    page.click("[data-testid=kn-paste-save]"); page.wait_for_timeout(600)
    rows = page.locator("[data-testid=kn-source]")
    check(rows.count() == 1 and "Villa rules" in rows.first.inner_text() and "Pasted text" in rows.first.inner_text(), "the pasted text is listed with its kind and size")
    check("passages from" in page.locator("[data-testid=kn-stats]").inner_text(), "storage used and passages are shown")
    shot(page, "1-knowledge")

    # ---- a fact question: the block reaches the model, the answer shows its chip
    to_chat(page)
    send(page, "What is the gate code for the villa?", "The gate code for the villa is 4471 [K1]. Parking is free everywhere [K9].")
    u = last_user(page)
    check("Facts from your Knowledge" in u and "[K1] (Villa rules)" in u and "4471" in u, "the facts block with its source tag goes to the model")
    check(u.rstrip().endswith("What is the gate code for the villa?") or "Question: What is the gate code" in u, "…followed by the question")
    page.wait_for_selector("[data-testid=kn-chip]", timeout=6000)
    main = page.locator("main").inner_text()
    check(page.locator("[data-testid=kn-chip]").count() == 1 and "Villa rules" in page.locator("[data-testid=kn-chip]").first.inner_text(), "the answer shows one source chip: Villa rules")
    check("[K1]" not in main and "[K9]" not in main and "4471" in main, "the tags are taken out of the answer; the invented [K9] is removed")
    page.locator("[data-testid=kn-chip]").first.click(); page.wait_for_timeout(200)
    check("4471" in page.locator("[data-testid=kn-passage]").inner_text(), "tapping the chip shows the passage it came from")
    shot(page, "2-chat-chip")

    # ---- chit-chat gets nothing
    to_chat(page)
    send(page, "hello", "Hi! How can I help?")
    check("Facts from your Knowledge" not in last_user(page), "a greeting gets no facts")

    # ---- switched off: no block, no chip
    open_knowledge(page); page.click("[data-testid=kn-switch]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=kn-switch]").get_attribute("aria-checked") == "false", "the switch turns off")
    to_chat(page)
    send(page, "What is the gate code for the villa?", "I don't know the gate code.")
    check("Facts from your Knowledge" not in last_user(page) and page.locator("[data-testid=kn-chip]").count() == 0, "switched off: no facts block and no chip")

    # ---- on again, remove the source: nothing is added any more
    open_knowledge(page); page.click("[data-testid=kn-switch]"); page.wait_for_timeout(200)
    page.once("dialog", lambda d: d.accept())
    page.click("[data-testid=kn-remove]"); page.wait_for_timeout(500)
    check(page.locator("[data-testid=kn-source]").count() == 0, "the source is removed")
    to_chat(page)
    send(page, "What is the gate code for the villa?", "I don't know.")
    check("Facts from your Knowledge" not in last_user(page), "a removed source is not looked up any more")
    ctx.close()

    # ---- Arabic screen: no Latin words
    ctx, page = new_page(br, env, errors, extra_init="try{localStorage.setItem('attune:ui:lang','ar')}catch(e){}")
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    open_knowledge(page)
    page.click("[data-testid=kn-paste]"); page.wait_for_timeout(200)
    latin = page.evaluate(VISIBLE)
    check(latin == [], "the Arabic Knowledge screen shows no Latin words " + str(latin))
    shot(page, "3-arabic")
    ctx.close()
    br.close()

check(not real_errors(errors), "no page errors " + str(real_errors(errors)[:3]))
env.close()
finish()
