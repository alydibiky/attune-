"""v6.27 "Do it for me" in Chat: a booking request is read by code into a plan card — what is missing is ASKED; a full
request opens the person's app / site filled in (level 1: NATIVE.intent "link") or inside Attune (level 2: agentOpen with
the person's Booking details and rules); questions stay in Chat; Booking details live in Your profile.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v727agent.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
T = datetime.date.today()
day = (T + datetime.timedelta(days=9))
BOOK = {"first": "Aly", "last": "Aldibiki", "email": "aly@example.com", "homeAirport": "CAI"}
INIT = "try{localStorage.setItem('attune:start','chat');localStorage.setItem('attune:agent:profile',%s)}catch(e){}\n" % json.dumps(json.dumps(BOOK)) + r"""
(() => { const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0);
  N.agentOpen = (id, arg) => { window.__agent = JSON.parse(arg); setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ reason: "done", filled: 6, offers: 12, payment: false })), 50); };
}; go(); })();"""
def send(page, t):
    page.locator("textarea[placeholder='Message Attune']").fill(t); page.locator("button[title='Send']").click(); page.wait_for_timeout(500)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    # missing details are asked
    send(page, "Book me a flight to Atlantis tomorrow")
    card = page.locator("[data-testid=card-emerald]").last.inner_text()
    check("a flight" in card and "Atlantis" in card and "which city" in card, "an unknown city is asked, not guessed: %s" % card.replace("\n", " · ")[:140])
    # a full request → links + Do it here
    send(page, "Book me the cheapest flight from Cairo to Dubai on %s morning" % day.strftime("%d %B"))
    card = page.locator("[data-testid=card-emerald]").last
    txt = card.inner_text()
    check("CAI" in txt and "DXB" in txt and "cheapest" in txt and "morning" in txt and "never pays" in txt, "the plan is shown exactly: %s" % txt.replace("\n", " · ")[:160])
    btns = card.locator("button").all_inner_texts()
    check(btns[0].startswith("Do it here") and "Google Flights" in btns and "Skyscanner" in btns, "buttons: %s" % btns)
    card.locator("button:has-text('Google Flights')").click(); page.wait_for_timeout(300)
    it = page.evaluate("window.__mock.intents")
    check(it and it[-1]["kind"] == "link" and it[-1]["url"].startswith("https://www.google.com/travel/flights?q=") and "CAI" in it[-1]["url"], "level 1: the link opens filled in: %s" % (it[-1]["url"][:110] if it else it))
    card.locator("button").first.click(); page.wait_for_timeout(400)
    a = page.evaluate("window.__agent")
    check(a and "skyscanner" in a["url"] and a["profile"]["first"] == "Aly" and a["rules"]["cheapest"] is True and a["rules"]["time"] == "morning" and a["labels"]["fill"] == "Fill my details",
          "level 2: inside Attune with the Booking details and the rules: %s" % (a and {k: a[k] for k in ("url", "rules")}))
    check(page.locator("text=Filled 6 fields").count() >= 1, "…and when it closes, what it did is said")
    # food: the app opens, the search copied
    send(page, "Order koshary from Abou Tarek on Talabat")
    page.locator("[data-testid=card-emerald]").last.locator("button:has-text('Talabat')").click(); page.wait_for_timeout(300)
    it = page.evaluate("window.__mock.intents")[-1]
    check(it["kind"] == "link" and it["app"] == "com.talabat" and "koshary" in it["copy"], "food: Talabat opens with the search ready to paste")
    # questions stay in Chat
    n = page.locator("[data-testid=card-emerald]").count()
    page.evaluate("window.__mock.fakeQueue = ['Choose high-fibre foods.']")
    send(page, "Can you recommend food for diabetics?")
    page.wait_for_timeout(800)
    check(page.locator("[data-testid=card-emerald]").count() == n, "a question about food is answered, not turned into an order")
    # Booking details in Your profile
    # with no model installed, the question opened the Engine panel — close it
    for _ in range(3):
        c = page.locator("button[aria-label='Close']")
        if not c.count() or not c.first.is_visible(): break
        c.first.click(); page.wait_for_timeout(300)
    page.locator("nav button").last.click(); page.wait_for_timeout(300)
    page.locator("[data-testid=more-settings] button").nth(1).click(); page.wait_for_timeout(300)
    check(page.locator("[data-testid=booking-details]").count() == 1, "Your profile has Booking details")
    ctx.close()
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
