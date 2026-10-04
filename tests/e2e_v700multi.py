"""v6.12 — several files and photos in one Chat message (Ali: "attach more than 1 pdf or file or photo").
  python3 tests/e2e_v700multi.py
"""
import base64, io
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish

env = Env()
errors = []

def png(color):
    from PIL import Image
    b = io.BytesIO(); Image.new("RGB", (64, 48), color).save(b, "PNG"); return b.getvalue()

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)
    page.set_input_files("[data-testid=attach-file]", files=[
        {"name": "contract.txt", "mimeType": "text/plain", "buffer": "Daily rate for the 50 t crane: 9,000 EGP.".encode()},
        {"name": "quote.md", "mimeType": "text/markdown", "buffer": "Quote: 70 t crane, 12,500 EGP a day.".encode()}])
    page.wait_for_function("document.querySelectorAll('[data-testid=attached]').length === 2", timeout=5000)
    check(page.locator("[data-testid=attached]").count() == 2, "two files attached at once, two chips")
    page.set_input_files("[data-testid=attach-photo]", files=[
        {"name": "a.png", "mimeType": "image/png", "buffer": png((200, 30, 30))},
        {"name": "b.png", "mimeType": "image/png", "buffer": png((30, 30, 200))}])
    page.wait_for_function("document.querySelectorAll('[data-testid=attached-photos] img').length === 2", timeout=5000)
    check(page.locator("[data-testid=attached-photos] img").count() == 2, "two photos attached at once, numbered")
    page.evaluate("() => { const M = window.__mock; M.fakeQueue = ['The 70 t quote is 3,500 EGP a day more than the 50 t rate.']; M.bodies = []; }")
    page.locator("textarea[placeholder='Message Attune']").fill("Compare the two daily rates")
    page.locator("button[title='Send']").click()
    page.wait_for_function("window.__mock.bodies.filter(x => x.max_tokens > 2).length >= 1", timeout=30000)
    page.wait_for_timeout(500)
    b = page.evaluate("window.__mock.bodies.filter(x => x.max_tokens > 2)")
    last = b[-1]["messages"][-1]["content"]
    txt = last if isinstance(last, str) else " ".join(x.get("text", "") for x in last if isinstance(x, dict))
    check("contract.txt" in txt and "quote.md" in txt and "9,000" in txt and "12,500" in txt, "both files reach the model, each labelled")
    imgs = [x for x in (last if isinstance(last, list) else []) if isinstance(x, dict) and x.get("type") == "image_url"]
    check(len(imgs) == 1 and "2 photos side by side" in txt, "the two photos go as ONE numbered picture (works on every engine)")
    check(page.locator("[data-testid=attached]").count() == 0 and page.locator("[data-testid=attached-photos]").count() == 0, "the composer is cleared after sending")
    check(real_errors(errors) == [], "no errors: %s" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
