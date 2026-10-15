"""v6.28 — Ali: "finish Learn daily and rework its logic and UI".
A course shows one plan for today: review the cards (made by code from the lessons read — no model needed) → today's lesson →
the quiz. A missed day breaks the streak (it shows 0, not the old number). Computer: the course on the left, the review on the right.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v732learn.py     (SHOTS=dir for screenshots)
"""
import os, json, time
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
def open_more(page, name, testid):
    page.locator("nav button").last.click(); page.wait_for_timeout(200)
    page.locator(f".rounded-t-2xl button:has-text('{name}')").first.click()
    page.wait_for_selector(f"[data-testid={testid}]", timeout=5000)
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
now = int(time.time() * 1000); DAY = 86400000
def day(t): return time.strftime("%Y-%m-%d", time.localtime(t / 1000))
cards = [{"id": "k1", "front": "ç", "back": "ch as in chair", "note": "çay — tea", "n": 0, "box": 0, "due": now - DAY},
         {"id": "k2", "front": "ş", "back": "sh as in shoe", "note": "", "n": 0, "box": 1, "due": now - 1000},
         {"id": "k3", "front": "ğ", "back": "lengthens the vowel", "note": "", "n": 0, "box": 0, "due": now + 5 * DAY}]
L0 = {"n": 0, "title": "The alphabet", "body": "## Letters\nTurkish has 29 letters and is written as it sounds.", "keyPoints": ["ç: ch as in chair"], "visual": None, "made": now - 3 * DAY, "day": day(now - 3 * DAY), "done": True}
L1 = {"n": 1, "title": "Greetings", "body": "## Merhaba\nMerhaba means hello. Günaydın means good morning, used until about noon.", "keyPoints": ["Merhaba: hello"], "visual": None, "made": now - DAY, "day": "", "done": False}
COURSE = {"id": "c1", "topic": "Turkish", "title": "Turkish: beginner to expert in 30 lessons", "level": "beginner", "lang": "en", "goal": "", "time": "08:00", "quizEvery": 5, "created": now - 9 * DAY,
          "plan": ["The alphabet", "Greetings", "Vowel harmony"] + ["Lesson %d" % i for i in range(4, 31)], "lessons": [L0, L1], "quizzes": [], "review": [], "streak": 7, "lastDay": day(now - 3 * DAY), "notify": True, "cards": cards}
INIT = "try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:daily:courses:v1',%s)}catch(e){}" % json.dumps(json.dumps([COURSE]))
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    open_more(page, "Learn daily", "learn-page")
    row = page.locator("[data-testid=learn-course]").inner_text()
    check("Review 2 cards" in row and "Lesson 2" in row and "🔥" not in row, "the list says today's plan in one line, and a broken streak shows no flame: " + row.replace("\n", " | "))
    page.locator("[data-testid=learn-course]").click(); page.wait_for_selector("[data-testid=course]")
    c = page.locator("[data-testid=course]").inner_text()
    check("read today to start a streak" in c and "7 days" not in c, "two days missed: the streak is not shown as 7")
    t = page.locator("[data-testid=learn-today]").inner_text()
    check(t.index("Review 2 cards") < t.index("2. Greetings"), "today, in order: review 2 cards, then lesson 2")
    check(page.locator("[data-testid=course] >> text=Lesson 30").count() == 0 and page.locator("[data-testid=learn-all-plan]").count() == 1, "a 30-lesson plan shows only the lessons around where you are (Show all)")
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, "learn-course.png"), full_page=True)
    page.click("[data-testid=review-start]"); page.wait_for_selector("[data-testid=review]")
    check("ç" in page.locator("[data-testid=review-card]").inner_text() and page.locator("[data-testid=review-back]").count() == 0, "the most overdue card first, its answer hidden")
    page.click("[data-testid=review-show]")
    check("ch as in chair" in page.locator("[data-testid=review-back]").inner_text(), "Show the answer turns it over")
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, "learn-review.png"))
    page.click("[data-testid=review-knew]")
    page.click("[data-testid=review-show]"); page.click("[data-testid=review-again]")       # ş: not yet → once more at the end
    check("ş" in page.locator("[data-testid=review-card]").inner_text(), "a card you didn't know comes once more at the end of the round")
    page.click("[data-testid=review-show]"); page.click("[data-testid=review-knew]")
    page.wait_for_selector("[data-testid=review-done]")
    check("1 / 2" in page.locator("[data-testid=review-done]").inner_text(), "the round ends: 1 of 2 known the first time")
    k = {x["id"]: x for x in json.loads(page.evaluate("localStorage.getItem('attune:daily:courses:v1')"))[0]["cards"]}
    check(k["k1"]["box"] == 1 and k["k1"]["due"] > now + 0.9 * DAY and k["k3"]["box"] == 0, "known → it comes back further away; the card not yet due is untouched")
    page.click("[data-testid=review-to-lesson]"); page.wait_for_selector("[data-testid=lesson]")
    check("Greetings" in page.locator("[data-testid=lesson]").inner_text(), "from the review straight to today's lesson")
    page.click("[data-testid=lesson-done]"); page.wait_for_timeout(200)
    cc = json.loads(page.evaluate("localStorage.getItem('attune:daily:courses:v1')"))[0]
    check(cc["streak"] == 1 and any(x["front"] == "Merhaba" and x["back"] == "hello" for x in cc["cards"]), "reading it starts a new streak (1) and its 'Merhaba: hello' becomes a card for tomorrow")
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)
    t = page.locator("[data-testid=learn-today]").inner_text()
    check("Cards reviewed" in t and "Today's lesson · read" in t, "back on the course: today's plan is ticked off")
    # computer: the course on the left, the review on the right
    page.evaluate("""() => { const k = 'attune:daily:courses:v1'; const c = JSON.parse(localStorage.getItem(k)); c[0].cards.forEach(x => x.due = Date.now() - 1000); localStorage.setItem(k, JSON.stringify(c)); }""")
    page.reload(); page.wait_for_selector("nav", timeout=15000)
    open_more(page, "Learn daily", "learn-page"); page.locator("[data-testid=learn-course]").click()
    page.set_viewport_size({"width": 1366, "height": 860}); page.wait_for_selector("[data-testid=course]", timeout=5000)
    page.click("[data-testid=review-start]"); page.wait_for_selector("[data-testid=review]")
    a, b = page.locator("[data-testid=course]").bounding_box(), page.locator("[data-testid=review]").bounding_box()
    check(a and b and a["x"] + a["width"] <= b["x"] + 2, "computer: the course stays on the left, the review opens on the right")
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, "learn-desk.png"))
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
