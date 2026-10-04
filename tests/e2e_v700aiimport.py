"""v6.12 — a conversation from Gemini / ChatGPT / any AI becomes the chat's context: a share link (fetched natively, mocked
here) or pasted "You said / Gemini said" text; the next question is answered with it.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v700aiimport.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
T1 = "What are all the trims of the Lynk & Co 900 and their prices in China?"
T2 = "The Lynk & Co 900 comes in four trims: Pro (CNY 309,900), Max (CNY 339,900), Ultra (CNY 369,900) and Halo (CNY 399,900)."
BLOB = json.dumps([[None, [T1]], [None, [[T2]]]])
HTML = "<html><head><meta property='og:title' content='Lynk &amp; Co 900 trims - Gemini'></head><body><script>AF_initDataCallback({key: 'ds:1', data:%s});</script></body></html>" % json.dumps(BLOB)
MOCK = "(() => { const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0); N.fetchShare = (id, url) => { window.__shareUrl = url; setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ url, html: %s })), 30); }; }; go(); })();" % json.dumps(HTML)
def send(page, t):
    page.locator("textarea[placeholder='Message Attune']").fill(t); page.locator("button[title='Send']").click()
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=MOCK)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(250)
    page.evaluate("() => { const M = window.__mock; M.fakeQueue = ['The cheapest is the Pro at CNY 309,900.']; M.bodies = []; }")
    send(page, "https://share.gemini.google/M76X2XrLpG9c which trim is the cheapest?")
    page.wait_for_function("window.__mock.bodies.filter(x => x.max_tokens > 2).length >= 1", timeout=20000); page.wait_for_timeout(500)
    check(page.evaluate("window.__shareUrl") == "https://share.gemini.google/M76X2XrLpG9c", "the share link is opened natively")
    txt = page.locator("body").inner_text()
    check("I read your conversation with Gemini" in txt and "Lynk & Co 900 trims" in txt, "the chat says what it read")
    sysmsg = page.evaluate("window.__mock.bodies.filter(x => x.max_tokens > 2).pop().messages[0].content")
    check("EARLIER CONVERSATION the user had with Gemini" in sysmsg and "CNY 309,900" in sysmsg, "the question written with the link is answered WITH the conversation as context")
    page.locator("button[aria-label='New chat']").first.click(); page.wait_for_timeout(300)
    pasted = "You said: Compare the Liebherr LTM 1100-4.2 and the Grove GMK5250L for wind turbine work, with capacities and boom lengths.\n\nChatGPT said: The LTM 1100-4.2 lifts 100 t with a 60 m boom; the GMK5250L lifts 250 t with a 79 m main boom, so it suits turbine work better.\n\nYou said: and the price?\n\nChatGPT said: Roughly 1.1 million euros new for the Grove."
    send(page, pasted); page.wait_for_timeout(800)
    check("I read your conversation with ChatGPT" in page.locator("body").inner_text(), "pasted 'You said / ChatGPT said' text is imported too")
    page.evaluate("() => { const M = window.__mock; M.fakeQueue = ['The Grove, at about 1.1 million euros.']; M.bodies = []; }")
    send(page, "which one is more expensive?")
    page.wait_for_function("window.__mock.bodies.filter(x => x.max_tokens > 2).length >= 1", timeout=20000)
    sysmsg = page.evaluate("window.__mock.bodies.filter(x => x.max_tokens > 2).pop().messages[0].content")
    check("USER: Compare the Liebherr" in sysmsg and "1.1 million euros" in sysmsg, "the follow-up question sees the imported turns")
    check(real_errors(errors) == [], "no errors: %s" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
