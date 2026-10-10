"""v6.16 — «علّم نموذجك» (Ali picked design B + C's chat button): make a pack from pasted text and from Markdown files, Chat answers from
it, switch it off (no facts), share it as a file, teach a chat from its «علّم هذا لنموذجي» button, delete the pack.
  python3 tests/e2e_v727teach.py
"""
import os, json, tempfile
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []

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

d = tempfile.mkdtemp()
open(os.path.join(d, "tadano.md"), "w").write("# Tadano GR-1000 checklist\n\nCheck the outrigger pads before every lift. The service interval for the swing bearing is 250 hours.")
open(os.path.join(d, "site.txt"), "w").write("Site Zayed: the gate code is 7731 and the crane pad is on the north side.")

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(250)

    open_knowledge(page)
    check(page.locator("[data-testid=my-packs]").count() == 1 and page.locator("[data-testid=my-packs-empty]").count() == 1, "the Knowledge page opens with “My packs” (empty)")
    page.click("[data-testid=my-pack-new]")
    page.fill("[data-testid=teach-name]", "Crane workshop")
    page.set_input_files("[data-testid=teach-files]", [os.path.join(d, "tadano.md"), os.path.join(d, "site.txt")])
    page.wait_for_selector("[data-testid=my-pack]", timeout=6000)
    txt = page.locator("[data-testid=my-pack]").first.inner_text()
    check("Crane workshop" in txt and "2 files" in txt, "a new pack from two files: " + txt.replace("\n", " · ")[:80])
    page.click("[data-testid=my-pack-add]")
    page.click("[data-testid=teach-paste]")
    page.fill("[data-testid=teach-paste-text]", "The LTM 1100 hydraulic oil is changed every 2,000 operating hours.")
    page.click("[data-testid=teach-paste-go]"); page.wait_for_timeout(600)
    check("3 files" in page.locator("[data-testid=my-pack]").first.inner_text(), "“Add to it” adds pasted text to the same pack")

    to_chat(page)
    send(page, "What is the gate code at site Zayed?", "The gate code is 7731 [K1].")
    check("7731" in last_user(page) and "Facts from your Knowledge" in last_user(page), "Chat answers from the pack (its passage goes to the model)")

    open_knowledge(page)
    page.click("[data-testid=my-pack-switch]")
    check(page.locator("[data-testid=my-pack-switch]").get_attribute("aria-checked") == "false", "the pack can be switched off")
    to_chat(page)
    send(page, "What is the gate code at site Zayed?", "I don't know.")
    check("7731" not in last_user(page), "a switched-off pack is not looked up")
    stored = page.evaluate("() => localStorage.getItem('attune:knowledge:off')")
    check("Crane workshop" in (stored or ""), "switched off stays off after a restart (saved)")

    # C: teach a chat from its answer
    open_knowledge(page); page.click("[data-testid=my-pack-switch]"); to_chat(page)
    send(page, "How often is the hook block inspected?", "Every month, and replace it if the throat opening grew more than 5%.")
    page.locator("[data-testid=teach-to-pack]").last.click()
    page.wait_for_selector("[data-testid=teach-to-pack-sheet]", timeout=4000)
    page.locator("[data-testid=teach-to-pack-pick]").first.click(); page.wait_for_timeout(700)
    open_knowledge(page)
    check("1 chats" in page.locator("[data-testid=my-pack]").first.inner_text(), "«Teach this to my model» saves the chat in the pack")

    # share, then delete
    page.click("[data-testid=my-pack-share]"); page.wait_for_timeout(600)
    saved = page.evaluate("() => window.__mock.lastSaved")
    data = json.loads(saved["text"])
    shared = os.path.join(d, saved["name"]); open(shared, "w").write(saved["text"])
    check(data["format"] == "attune-knowledge-1" and data["name"] == "Crane workshop" and len(data["sources"]) == 4 and saved["name"].endswith(".attune-pack.json"), "Share saves one pack file with every source (the phone's save dialog)")
    page.on("dialog", lambda dlg: dlg.accept())
    page.click("[data-testid=my-pack-delete]"); page.wait_for_timeout(500)
    check(page.locator("[data-testid=my-pack]").count() == 0, "the pack can be deleted")
    page.set_input_files("[data-testid=my-pack-import]", shared); page.wait_for_timeout(800)
    check(page.locator("[data-testid=my-pack]").count() == 1, "…and imported again from the shared file")
    check(not real_errors(errors), "no JavaScript errors (%d)" % len(real_errors(errors)))
    br.close()
finish()
