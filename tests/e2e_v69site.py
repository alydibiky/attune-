"""v6.9 — Ali's phone, 29 Sep: after asking for a website, "Okay u do me the frontend only for now"
got "I cannot create a functional website, as I am an AI language model". The go-ahead now continues the
website asked for before, and a refusal to build is asked again as the code task it is.

  python3 tests/e2e_v69site.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish

env = Env(); errors = []
FULL = ('<!DOCTYPE html><html><head><meta charset="utf-8"><title>HeavyLift Crane Rentals</title><style>body{font-family:sans-serif;margin:0}.card{padding:12px}</style></head>'
        '<body><header><h1>HeavyLift Crane Rentals</h1></header><section id="services"><div class="card">Mobile crane rental</div><div class="card">Tower crane rental</div></section>'
        '<section id="fleet"><div class="card">Liebherr LTM 1100</div></section><form id="contact"><input name="name"><button>Send</button></form><footer>HeavyLift 2026</footer></body></html>')
REFUSAL = "I cannot create a functional website for you, as I am an AI language model and do not have the capability to write, host, or deploy live code.\n\n- What I can provide: HTML and CSS."

def queue(page, answers):
    page.evaluate("(a) => { const M = window.__mock; M.bodies = []; M.fakeQueue = a; }", answers)
def sent(page):
    return page.evaluate("window.__mock.bodies.filter(b => b.max_tokens > 2)")
def previews(page):
    return page.evaluate("document.body.innerText.split('Preview').length - 1")
def send(page, text):
    page.locator("textarea[placeholder='Message Attune']").fill(text)
    page.locator("button[title='Send']").first.click()

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(250)

    # 1. the website is asked for
    queue(page, ["```html\n" + FULL + "\n```"] + ["ok"] * 3)
    send(page, "Make a landing page website for HeavyLift Crane Rentals where people can book cranes, with a services list and a contact form")
    page.wait_for_function("() => document.body.innerText.includes('Preview')", timeout=30000); page.wait_for_timeout(500)
    n1 = previews(page)
    check(n1 >= 1, "the first request builds the page (%d preview)" % n1)

    # 2. "okay you do the frontend only" continues THAT website (it used to go to the model on its own)
    queue(page, ["```html\n" + FULL + "\n```"] + ["ok"] * 3)
    send(page, "Okay u do me the frontend only for now")
    page.wait_for_function("(n) => document.body.innerText.split('Preview').length - 1 > n", arg=n1, timeout=30000); page.wait_for_timeout(500)
    b = sent(page)
    asked = json.dumps(b[0]["messages"]) if b else ""
    check(b and "HeavyLift Crane Rentals" in asked and "frontend only" in asked, "the go-ahead is built from the earlier website request (%d call)" % len(b))
    check(previews(page) > n1, "a second page appears for the go-ahead")

    # 3. a model that refuses to build is asked again as a code task
    n2 = previews(page)
    queue(page, [REFUSAL, "```html\n" + FULL + "\n```"] + ["ok"] * 3)
    send(page, "Can you put together the screens for my crane booking idea please, thanks")
    page.wait_for_function("(n) => document.body.innerText.split('Preview').length - 1 > n", arg=n2, timeout=30000); page.wait_for_timeout(500)
    check(previews(page) > n2, "a refusal ('I cannot create a functional website…') becomes a built page")
    check("I am an AI language model" not in page.inner_text("body").split("Can you put together")[-1], "the refusal text is not shown")

    check(not real_errors(errors), "no errors (%s)" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
