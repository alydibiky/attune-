"""v6.34 — Ali 17 Oct: "I want the lesson to be ready when the user opens the app", "I want to add lessons", and Home listed
"lesson 2 — Turkish" above "lesson 1 — Turkish". The next lesson is written in the background while a model is loaded and idle;
Add a lesson puts your own title at the end of the course; Home keeps one line per topic, lowest lesson first.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v737learn.py
"""
import json, time
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
now = int(time.time() * 1000); DAY = 86400000
L0 = {"n": 0, "title": "Greetings", "body": "Say Merhaba to anyone. " * 8, "keyPoints": ["Merhaba: hello"], "made": now - DAY, "day": "", "done": True}
C1 = {"id": "c1", "topic": "Turkish", "title": "Turkish", "level": "beginner", "lang": "en", "goal": "", "time": "08:00", "quizEvery": 9, "created": now - 2 * DAY,
      "plan": ["Greetings", "Numbers", "Food"], "lessons": [L0], "quizzes": [], "review": [], "streak": 1, "lastDay": "", "notify": True, "cards": []}
C2 = dict(C1, id="c2", created=now - DAY, lessons=[])   # the same course started twice
LESSON = "## Numbers\nBir, iki, üç — one, two, three. Count everything you see today: bir çay, iki simit, üç kedi. " * 3 + "\n```json\n{\"keyPoints\": [\"bir = one\", \"iki = two\"]}\n```"
INIT = "try{localStorage.setItem('attune:learn:ahead','1');localStorage.setItem('attune:start','home');localStorage.setItem('attune:daily:courses:v1',%s)}catch(e){}" % json.dumps(json.dumps([C1, C2]))
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    w = page.locator("[data-testid=phone-home]").inner_text()
    check(w.count("— Turkish") == 1 and "lesson 1 — Turkish" in w, "Home: one line for Turkish, the lowest lesson (%s)" % w.replace("\n", " | ")[:200])
    # a model loaded and idle → the next lesson of the course whose lessons are all read is written by itself
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'chat'}}))"); page.wait_for_timeout(300)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)
    page.evaluate("(a) => { const M = window.__mock; M.fakeQueue = [a]; M.bodies = []; }", LESSON)
    got = None
    for _ in range(40):
        page.wait_for_timeout(1000)
        cs = page.evaluate("JSON.parse(localStorage.getItem('attune:daily:courses:v1'))")
        c1 = [c for c in cs if c["id"] == "c1"][0]
        if len(c1["lessons"]) == 2: got = c1; break
    check(got is not None and got["lessons"][1]["n"] == 1 and "Bir, iki" in got["lessons"][1]["body"], "the next lesson was written in the background, before Learn was opened")
    check(len([c for c in cs if c["id"] == "c2"][0]["lessons"]) == 0, "…only for a course whose lessons are all read (one unread lesson ahead, not more)")
    # Learn → the course: lesson 2 is ready to read; Add a lesson
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'learn'}}))"); page.wait_for_selector("[data-testid=learn-page]", timeout=5000)
    page.locator("[data-testid=learn-course]").first.click(); page.wait_for_selector("[data-testid=course]")
    check(page.locator("[data-testid=today-lesson]").count() == 1 and "2. Numbers" in page.locator("[data-testid=today-lesson]").inner_text(), "Learn: lesson 2 is there to read, no waiting")
    page.click("[data-testid=learn-add-lesson]"); page.fill("[data-testid=learn-add-title]", "Ordering at a restaurant"); page.click("[data-testid=learn-add-save]"); page.wait_for_timeout(200)
    check("Ordering at a restaurant" in page.locator("[data-testid=course]").inner_text(), "Add a lesson: your title is at the end of the course")
    cs = page.evaluate("JSON.parse(localStorage.getItem('attune:daily:courses:v1'))")
    check([c for c in cs if c["id"] == "c1"][0]["plan"][-1] == "Ordering at a restaurant", "…and saved in the plan")
    check(real_errors(errors) == [], "no page errors: %s" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
