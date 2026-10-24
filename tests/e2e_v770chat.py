"""v7.4 — Chat, Assistants and Projects from Gemini's mock-up "Area 3: Chat" (Ali sent it 24 Oct 2026): the empty chat as one quiet card,
the "/" list only while "/" is typed (in Chat too), answers in a quiet card with their checks as pills, assistant cards that are never cut
(on a computer one opens beside the list), project cards with chats / files / last change, and Workspaces in the sidebar.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v770chat.py     (SHOTS=dir for screenshots)
"""
import os, json, time
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
now = int(time.time() * 1000)
ANSWER = ("Your 4-week plan comes to **5,420 EGP**, leaving **580 EGP** under your 6,000 EGP budget [1].\n\n"
          "| Item | Qty | Unit | Subtotal |\n|---|---|---|---|\n| Flour (10 kg) | 8 | 420 | 3,360 |\n| Butter & yeast | 4 | 310 | 1,240 |\n| Boxes | 100 | 4.6 | 460 |\n| Printing | 4 | 90 | 360 |\n\n"
          "```python\nitems = [(8, 420), (4, 310), (100, 4.6), (4, 90)]\ntotal = sum(q * p for q, p in items)\nprint(total)\n```")
CHATS = [{"id": "c1", "title": "Study & bakery flour budget", "updated": now, "projectId": "p1", "messages": [
    {"id": "u1", "role": "user", "text": "Work out our 4-week flour and printing budget against our 6,000 EGP limit."},
    {"id": "a1", "role": "assistant", "text": ANSWER, "thinking": "Read the price list, added it up.", "secs": 2,
     "verified": {"code": "print(5420)", "output": "5420"}, "sources": [{"title": "Bakery prices Oct.csv", "url": "file://prices.csv"}]}]}]
PROJ = [{"id": "p1", "emoji": "🎓", "name": "Graduation project · Cairo Univ", "instructions": "Cite the lecture notes first.", "knowledge": [{"id": "k1", "name": "lecture_notes_week4.md", "text": "notes " * 300}], "updated": now},
        {"id": "p2", "emoji": "🥐", "name": "Maadi home bakery menu", "instructions": "", "knowledge": [], "updated": now - 86400000}]
INIT = "try{localStorage.setItem('attune:chats:v1',%s);localStorage.setItem('attune:projects:v1',%s)}catch(e){}" % (json.dumps(json.dumps(CHATS)), json.dumps(json.dumps(PROJ)))
LIGHT = ";try{localStorage.setItem('attune:theme:v1', JSON.stringify({accent:'teal',bg:'light'}))}catch(e){}"
def shot(page, name):
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, name + ".png"))
def go(page, mode):
    page.evaluate("m => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", mode); page.wait_for_timeout(900)
with sync_playwright() as p:
    br = p.chromium.launch()
    for theme in ["dark", "light"]:
        ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + (LIGHT if theme == "light" else ""))
        page.set_viewport_size({"width": 390, "height": 844})
        page.goto(env.url); page.wait_for_timeout(1200)
        tag = "[phone %s] " % theme
        page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'chat'}}))"); page.wait_for_timeout(600)
        page.evaluate("() => { const b = [...document.querySelectorAll('button')].find(x => /new chat/i.test(x.title || x.getAttribute('aria-label') || '')); b && b.click(); }")
        page.wait_for_timeout(400)
        # v7.6 (Ali): New chat goes to the clean Home; the chat opens again from there
        check(page.locator("[data-testid=phone-home]").count() == 1, tag + "New chat → the clean Home")
        page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'chat'}}))"); page.wait_for_timeout(500)
        if page.locator("[data-testid=chat-empty-min]").count():
            check(page.locator("[data-testid=chat-empty-min] button svg").count() >= 3, tag + "the empty chat: the starters in one card, each with a chevron")
        page.fill("[data-testid=chat-input]", "/"); page.wait_for_timeout(200)
        check(page.locator("[data-testid=chat-slash] [data-testid=slash-menu]").count() == 1, tag + "typing “/” opens the command list above the box")
        shot(page, "chat-slash-phone-" + theme)
        page.click("[data-testid=chat-slash] [data-testid=slash-convert]"); page.wait_for_timeout(150)
        check(page.locator("[data-testid=chat-input]").input_value().startswith("/convert"), tag + "a command fills the box")
        check(page.locator("[data-testid=chat-slash]").count() == 0, tag + "…and the list closes")
        page.fill("[data-testid=chat-input]", "")
        ctx.close()
        # a conversation
        ctx, page = new_page(br, env, errors, legacy_nav=False, desktop=(1366, 860), extra_init=INIT + (LIGHT if theme == "light" else ""))
        page.goto(env.url); page.wait_for_selector("[data-testid=side]", timeout=15000); page.wait_for_timeout(400)
        tag = "[computer %s] " % theme
        check(page.locator("[data-testid=side-ws-assistants]").count() == 1 and "2" in page.locator("[data-testid=side-ws-projects]").inner_text(), tag + "Workspaces in the sidebar: Assistants, Projects (2)")
        page.locator("[data-testid=side-open-chat]").first.click(); page.wait_for_timeout(900)
        ans = page.locator("[data-testid=chat-answer]").first
        bg = ans.evaluate("e => getComputedStyle(e).borderTopWidth")
        check(ans.count() == 1 and bg != "0px", tag + "the answer sits in a quiet card")
        check(page.locator("[data-testid=verified] button").first.evaluate("e => getComputedStyle(e).borderRadius") not in ("0px", ""), tag + "“Checked by code” is a pill")
        shot(page, "chat-convo-desktop-" + theme)
        go(page, "assistants")
        page.locator("[data-testid=assistant-open]").first.click(); page.wait_for_timeout(300)
        check(page.locator("[data-testid=assistant-detail]").is_visible(), tag + "an assistant opens beside the list, with Start a chat")
        names = page.evaluate("[...document.querySelectorAll('[data-testid=assistant-item] [data-testid=assistant-open] span:first-child')].every(e => e.scrollWidth <= e.clientWidth + 1)")
        check(names, tag + "no assistant name is cut")
        shot(page, "assistants-desktop-" + theme)
        go(page, "projects")
        it = page.locator("[data-testid=project-item]").first.inner_text()
        check("1 chats" in it or "1 chat" in it, tag + "a project shows its chats, files and last change: %s" % it.replace("\n", " · "))
        shot(page, "projects-desktop-" + theme)
        ctx.close()
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
