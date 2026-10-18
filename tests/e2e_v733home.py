"""v6.29 — Ali picked Home option A: "Recent" tools (each with what waits there) instead of the area tiles; "What's waiting" (due
items, new Scout finds, cards to review, a medicine running out); the bottom bar Health → Scout; and "a sidebar where I can see the
history of my chats" — ☰ on Home opens it (chats, search, places), and a chat can be opened, renamed or deleted from it.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v733home.py     (SHOTS=dir for screenshots)
"""
import os, json, time
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
now = int(time.time() * 1000); DAY = 86400000
SCOUT = {"goals": [{"id": "s1", "text": "a flat in Maadi", "g": {"kind": "rent", "what": "a flat in Maadi", "wish": [], "place": "Maadi"}, "created": now - DAY, "lastRun": now - 3600000, "seen": [], "votes": {}, "taste": {"up": {}, "down": {}}, "on": True, "unseen": ["a1", "a2"]}]}
COURSE = {"id": "c1", "topic": "Turkish", "title": "Turkish", "level": "beginner", "lang": "en", "goal": "", "time": "08:00", "quizEvery": 5, "created": now - 5 * DAY,
          "plan": ["Alphabet", "Greetings", "Numbers"], "lessons": [{"n": 0, "title": "Alphabet", "body": "x" * 100, "keyPoints": [], "visual": None, "made": now - 2 * DAY, "day": "", "done": True}], "quizzes": [], "review": [], "streak": 1, "lastDay": "", "notify": True,
          "cards": [{"id": "k1", "front": "ç", "back": "ch", "note": "", "n": 0, "box": 0, "due": now - 1000}, {"id": "k2", "front": "ş", "back": "sh", "note": "", "n": 0, "box": 0, "due": now - 1000}]}
CHATS = [{"id": "c-a", "title": "Crane rental quote", "messages": [{"role": "user", "text": "quote for a 100 t crane"}, {"role": "assistant", "text": "ok"}], "updated": now - 3600000, "created": now - 3600000},
         {"id": "c-b", "title": "Trip to Istanbul", "messages": [{"role": "user", "text": "plan 4 days"}, {"role": "assistant", "text": "ok"}], "updated": now - 2 * DAY, "created": now - 2 * DAY}]
INIT = ("try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:scout:v1',%s);localStorage.setItem('attune:daily:courses:v1',%s);localStorage.setItem('attune:chats:v1',%s);"
        "localStorage.setItem('attune:tools:recent',%s)}catch(e){}") % (json.dumps(json.dumps(SCOUT)), json.dumps(json.dumps([COURSE])), json.dumps(json.dumps(CHATS)), json.dumps(json.dumps(["learn", "scout"])))
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 860})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000); page.wait_for_timeout(500)
    labels = [b.strip() for b in page.locator("nav button").all_inner_texts()]
    check(labels == ["Home", "Chat", "Money", "Scout", "Mind", "All"], "the bottom bar: Health → Scout: %s" % labels)
    w = page.locator("[data-testid=home-today]").inner_text()
    check("attune suggests" in w.lower() and "2 new finds: a flat in Maadi" in w and "2 cards to review · lesson 2 — Turkish" in w, "What's waiting: Scout's new finds and the cards to review: " + w.replace("\n", " | "))
    r = page.locator("[data-testid=home-recent]").inner_text()
    check(r.index("Learn daily") < r.index("Scout") and "Review 2 cards · Lesson 2" in r and "2 new finds" in r, "Recent: the last tools used, first the latest, each with what waits there")
    check(page.locator("[data-testid^=home-recent-]").count() == 4 and page.locator("[data-testid=home-areas]").count() == 0, "four recent tools (filled with useful ones); the old tiles are gone")
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, "home-A.png"), full_page=True)
    # the sidebar with the chats
    page.click("[data-testid=home-menu]"); page.wait_for_selector("[data-testid=phone-side]", timeout=3000)
    s = page.locator("[data-testid=phone-side] [data-testid=side-chats]").inner_text()
    check("Crane rental quote" in s and "Trip to Istanbul" in s, "☰ on Home opens the sidebar with the chat history")
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, "phone-side.png"))
    page.fill("[data-testid=phone-side] [data-testid=side-search]", "istanbul")
    check(page.locator("[data-testid=phone-side] [data-testid=side-chat]").count() == 1, "searching the chats finds by title")
    page.fill("[data-testid=phone-side] [data-testid=side-search]", "")
    page.locator("[data-testid=phone-side] [data-testid=side-del]").nth(1).click()
    page.click("[data-testid=phone-side] [data-testid=side-del-yes]"); page.wait_for_timeout(200)
    left = [c["title"] for c in json.loads(page.evaluate("localStorage.getItem('attune:chats:v1')"))]
    check(left == ["Crane rental quote"], "a chat deleted from the sidebar on Home is deleted (asked first): %s" % left)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=phone-side]").count() == 0 and page.locator("[data-testid=phone-home]").count() == 1, "Back closes the sidebar, staying on Home")
    page.click("[data-testid=home-menu]"); page.locator("[data-testid=phone-side] [data-testid=side-open-chat]").first.click(); page.wait_for_timeout(500)
    check(page.locator("text=quote for a 100 t crane").count() >= 1 and page.locator("[data-testid=phone-side]").count() == 0, "tapping a chat opens it")
    # Scout tab: opening the goal marks its finds seen, so Home stops saying "new"
    page.locator("nav button:has-text('Scout')").click(); page.wait_for_selector("[data-testid=scout-page]", timeout=5000); page.wait_for_timeout(300)
    check(json.loads(page.evaluate("localStorage.getItem('attune:scout:v1')"))["goals"][0]["unseen"] == [], "Scout opened → its new finds are seen")
    page.locator("nav button:has-text('Home')").click(); page.wait_for_selector("[data-testid=phone-home]", timeout=5000)
    check("new finds" not in page.locator("[data-testid=phone-home]").inner_text(), "…and Home no longer says new finds")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
