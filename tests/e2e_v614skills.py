"""v6.10 — Your Skills: add one from the catalogue, switch it off and on, and see that "/quote …" reaches the model
with the skill's instructions (and without the command), that a question that fits is matched by itself, that an
imported skill is shown before it is kept, and that nothing is added when the skill is off.

  python3 tests/e2e_v614skills.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish

env = Env()

def open_skills(page):
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('Skills')").first.click()
    page.wait_for_selector("[data-testid=skills-page]", timeout=5000)

def send(page, text):
    page.locator("textarea[placeholder='Message Attune']").fill(text)
    page.locator("button[title='Send']").first.click()
    page.wait_for_timeout(2500)

def last_user(page):
    return page.evaluate("() => { const b = (window.__mock.bodies || []).filter((x) => x.max_tokens > 2); const m = b[b.length - 1]; return m ? (m.messages.filter((x) => x.role === 'user').slice(-1)[0] || {}).content || '' : ''; }")

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
    check("No skills yet" in page.locator("[data-testid=skills-page]").inner_text(), "Skills opens from More, empty at first")

    # ---- the catalogue
    page.click("[data-testid=skill-open-catalogue]"); page.wait_for_selector("[data-testid=skill-catalogue]")
    check(page.locator("[data-testid=catalogue-item]").count() >= 10, "the catalogue offers ready-made skills")
    page.locator("[data-testid=catalogue-item]:has-text('Crane rental quote') [data-testid=catalogue-add]").click(); page.wait_for_timeout(300)
    check("Added" in page.locator("[data-testid=catalogue-item]:has-text('Crane rental quote')").inner_text(), "adding marks it Added")
    page.locator("[data-testid=skill-catalogue] button[aria-label=Close]").click(); page.wait_for_timeout(200)
    check(page.locator("[data-testid=skill-row]").count() == 1 and "/quote" in page.locator("[data-testid=skill-row]").inner_text(), "the skill is in your list with its /quote command")

    # ---- the command reaches the model with the instructions, without the command itself
    page.evaluate("window.__attuneBack && window.__attuneBack()"); page.wait_for_timeout(300)
    if page.locator("textarea[placeholder='Message Attune']").count() == 0:
        page.locator("nav button").first.click(); page.wait_for_timeout(300)
    send(page, "/quote 50 t crane for 3 days at Ain Sokhna")
    u = last_user(page)
    check("Your saved skills" in u and "Crane rental quote" in u, "the skill's instructions are added under the question")
    check(u.startswith("50 t crane for 3 days") and "/quote" not in u.split("(Your saved skills")[0], "the /quote command itself is not sent to the model")

    # ---- a question that fits is matched by itself
    page.locator("button[aria-label='New chat']").first.click(); page.wait_for_timeout(300)
    send(page, "I need a price offer for a crane rental job next week")
    check("Crane rental quote" in last_user(page), "a question that fits the description picks the skill by itself")
    page.locator("button[aria-label='New chat']").first.click(); page.wait_for_timeout(300)
    send(page, "What is the capital of France")
    check("Your saved skills" not in last_user(page), "an unrelated question gets no skill")

    # ---- off means off
    open_skills(page)
    page.click("[data-testid=skill-toggle]"); page.wait_for_timeout(200)
    page.evaluate("window.__attuneBack && window.__attuneBack()"); page.wait_for_timeout(300)
    if page.locator("textarea[placeholder='Message Attune']").count() == 0:
        page.locator("nav button").first.click(); page.wait_for_timeout(300)
    page.locator("button[aria-label='New chat']").first.click(); page.wait_for_timeout(300)
    send(page, "I need a price offer for a crane rental job next week")
    check("Your saved skills" not in last_user(page), "a switched-off skill adds nothing")

    # ---- import: shown before it is kept
    open_skills(page)
    page.click("[data-testid=skill-open-import]"); page.wait_for_selector("[data-testid=skill-import]")
    page.fill("[data-testid=skill-import-text]", "---\nname: Haggling coach\ncommand: /haggle\nwhen: negotiate price discount supplier\n---\nHelp me negotiate: give an opening offer, two fallback offers and one sentence to say for each.")
    page.wait_for_selector("[data-testid=skill-import-preview]", timeout=3000)
    pv = page.locator("[data-testid=skill-import-preview]").inner_text()
    check("Haggling coach" in pv and "opening offer" in pv and "it will add this" in pv.lower(), "an imported skill is shown in full before it is kept")
    page.click("[data-testid=skill-import-save]", timeout=4000); page.wait_for_timeout(300)
    check(page.locator("[data-testid=skill-row]").count() == 2 and "imported" in page.locator("[data-testid=skills-page]").inner_text(), "it is added and marked imported")
    check(real_errors(errors) == [], "no errors: %s" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
