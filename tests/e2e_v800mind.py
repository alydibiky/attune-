"""v7.7 — Mind & learning from Gemini's mock-up "Area 5" (Ali sent it 24 Oct 2026): Mind's calm top (three numbers on a computer,
"Do now" with the promise due today) and the Mind Report (kept this week by kind, promises due or late, top tags, things you forgot
you have — beside the wall on a computer); Learn daily with the streak, today's lesson and the Learning Report; the Homework Report;
Remember's library numbers; Recall's matched words highlighted and its index. Phone + computer, dark + light, Arabic 360 px.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v800mind.py     (SHOTS=dir for screenshots)
"""
import os, json, time, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
now = int(time.time() * 1000); D = 86400000
T = datetime.date.today(); dk = lambda n: (T - datetime.timedelta(days=n)).isoformat()
def rec(i, title, text, tags, ago, kind="note"): return {"id": i, "ts": now - ago * D, "kind": kind, "title": title, "text": text, "output": "", "tags": tags, "meta": None, "pinned": False}
MEM = [rec("m1", "Kia Sportage oil filter 26300-35505", "Kia oil filter OEM 26300-35505, 5W-30 at 42,000 km", ["car"], 1),
       rec("m2", "New Cairo 5th Settlement 2BR duplex", "https://aqarmap.com.eg/en/listing/94821", ["apartment"], 2),
       rec("m3", "GIU thesis supervisor office hours", "Tuesdays 11:30-13:00, room S3.204", ["giu-uni"], 3),
       rec("m4", "Living room paint — Jotun 1024 Timeless", "Jotun 1024 Timeless", ["home"], 70),
       rec("m5", "Grandma's kahk recipe", "flour, ghee, sesame", ["home"], 200)]
today17 = int(datetime.datetime.combine(T, datetime.time(23, 0)).timestamp() * 1000)
COMMITS = [{"id": "p1", "quote": "", "action": "Send Dr. Tarek the GIU Embedded Systems Lab 4 report", "who": "me", "whenText": "today at 17:00", "due": today17, "ts": now, "state": "confirmed"},
           {"id": "p2", "quote": "", "action": "Renew Mom's Eltroxin at El-Ezaby", "who": "me", "whenText": "yesterday", "due": now - D, "ts": now, "state": "confirmed"}]
COURSES = [{"id": "c1", "topic": "Turkish: beginner to expert", "title": "Turkish: beginner to expert", "level": "beginner", "lang": "en", "plan": ["L%d" % i for i in range(30)], "quizEvery": 5, "streak": 9, "lastDay": T.isoformat(),
            "lessons": [{"n": i, "title": "Lesson %d" % (i + 1), "body": "x", "done": True, "day": dk(12 - i)} for i in range(min(11, T.day))] + [{"n": 11, "title": "Ordering coffee, tea & simit in Kadıköy", "body": "Bir Türk kahvesi alabilir miyim?", "done": False, "day": ""}],
            "quizzes": [{"after": 4, "score": 3, "total": 4, "at": now - 9 * D}, {"after": 9, "score": 5, "total": 5, "at": now - 2 * D}], "cards": [{"id": "k1", "front": "çay", "back": "tea", "due": now - 100, "n": 1, "box": 0}],
            "learnedCards": 140, "review": ["Vowel harmony: -lar vs -ler → kitaplar"], "srs": {}, "created": now - 30 * D}]
COACH = {"topics": {"equations": {"right": 9, "wrong": 1}, "fractions": {"right": 1, "wrong": 2}}, "history": [{"text": "2x^2-7x+3=0", "topic": "equations", "right": True, "at": now - D}, {"text": "1/2+1/3", "topic": "fractions", "right": False, "at": now - 2 * D}], "settings": {"teach": True, "level": ""}}
INIT = "try{" + "".join("localStorage.setItem(%s,%s);" % (json.dumps(k), json.dumps(json.dumps(v))) for k, v in [("attune:memory:v1", MEM), ("attune:commits:v1", COMMITS), ("attune:daily:courses:v1", COURSES), ("attune:coach:v1", COACH)]) + "}catch(e){}"
LIGHT = ";try{localStorage.setItem('attune:theme:v1', JSON.stringify({accent:'teal',bg:'light'}))}catch(e){}"
AR = ";try{localStorage.setItem('attune:ui:lang','ar')}catch(e){}"
def shot(page, name, full=False):
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, name + ".png"), full_page=full)
def go(page, mode, sel):
    page.evaluate("m => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", mode); page.wait_for_selector(sel, timeout=8000); page.wait_for_timeout(500)
with sync_playwright() as p:
    br = p.chromium.launch()
    for theme in ["dark", "light"]:
        ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + (LIGHT if theme == "light" else ""))
        page.set_viewport_size({"width": 390, "height": 844})
        page.goto(env.url); page.wait_for_timeout(1200)
        tag = "[phone %s] " % theme
        go(page, "memory", "[data-testid=mind-page]")
        dn = page.locator("[data-testid=mind-do-now]")
        check(dn.count() == 1 and ("Eltroxin" in dn.inner_text() or "Tarek" in dn.inner_text()), tag + "Mind: “Do now” shows the promise that is due: %s" % dn.inner_text().replace("\n", " · ")[:90])
        shot(page, "mind-calm-phone-" + theme)
        page.click("[data-testid=mind-open-report]"); page.wait_for_selector("[data-testid=mind-report]")
        check("3" in page.locator("[data-testid=mind-rep-week]").inner_text(), tag + "…the Mind Report: 3 kept this week")
        check(page.locator("[data-testid=mind-rep-promises]").inner_text().count("late") >= 1, tag + "…promises due or late")
        check("#home" in page.locator("[data-testid=mind-rep-tags]").inner_text(), tag + "…the most-used tags")
        check("kahk" in page.locator("[data-testid=mind-rep-forgotten]").inner_text(), tag + "…things you forgot you have")
        shot(page, "mind-report-phone-" + theme, True)
        if theme == "dark":
            page.click("[data-testid=report-back]"); page.wait_for_timeout(200)
            page.click("[data-testid=mind-do-now-done]"); page.wait_for_timeout(300)
            st = {c["id"]: c["state"] for c in json.loads(page.evaluate("localStorage.getItem('attune:commits:v1')"))}
            check("done" in st.values(), tag + "Done marks the promise done: %s" % st)
        go(page, "learn", "[data-testid=learn-page]")
        check("9" in page.locator("[data-testid=learn-streak]").inner_text() and page.locator("[data-testid=learn-today]").count() == 1, tag + "Learn: the 9-day streak and today's lesson")
        check("Kadıköy" in page.locator("[data-testid=learn-today]").inner_text(), tag + "…today's lesson is lesson 12")
        shot(page, "learn-calm-phone-" + theme, True)
        page.click("[data-testid=learn-open-report]"); page.wait_for_selector("[data-testid=learn-report]")
        check("88%" in page.locator("[data-testid=learn-rep-acc]").inner_text() and "140" in page.locator("[data-testid=learn-rep-learned]").inner_text(), tag + "…the Learning Report: 88% quiz accuracy, 140 learned")
        check("Vowel" in page.locator("[data-testid=learn-rep-weak]").inner_text(), tag + "…weak points to review")
        shot(page, "learn-report-phone-" + theme, True)
        go(page, "coach", "[data-testid=coach-page]")
        page.click("[data-testid=coach-open-report]"); page.wait_for_selector("[data-testid=coach-report]")
        check("50%" in page.locator("[data-testid=coach-rep-pct]").inner_text() and "Fractions" in page.locator("[data-testid=coach-rep-topics]").inner_text(), tag + "Homework Report: 50% first try this week, by topic")
        shot(page, "coach-report-phone-" + theme, True)
        go(page, "recall", "[data-testid=recall-page]")
        check(page.locator("[data-testid=recall-report]").count() == 1, tag + "Recall: the on-phone index")
        page.fill("[data-testid=recall-q]", "oil filter"); page.wait_for_timeout(500)
        check(page.locator("[data-testid=recall-results] mark").count() >= 1, tag + "…the matched words are highlighted")
        shot(page, "recall-phone-" + theme)
        ctx.close()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + AR)
    page.set_viewport_size({"width": 360, "height": 800})
    page.goto(env.url); page.wait_for_timeout(1200)
    for mode, sel, nm in [("memory", "[data-testid=mind-page]", "mind"), ("learn", "[data-testid=learn-page]", "learn")]:
        go(page, mode, sel)
        over = page.evaluate("() => [...document.querySelectorAll('[data-testid=mind-calm] *, [data-testid=learn-today] *')].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1 || e.getBoundingClientRect().left < -1).map(e => (e.dataset.testid || e.tagName)).slice(0, 5)")
        check(not over, "[phone ar 360] %s fits, right to left %s" % (nm, over))
        shot(page, nm + "-phone-ar")
    ctx.close()
    for theme in ["dark", "light"]:
        ctx, page = new_page(br, env, errors, legacy_nav=False, desktop=(1440, 900), extra_init=INIT + (LIGHT if theme == "light" else ""))
        page.goto(env.url); page.wait_for_selector("[data-testid=side]", timeout=15000); page.wait_for_timeout(500)
        tag = "[computer %s] " % theme
        go(page, "memory", "[data-testid=mind-page]")
        a, b = page.locator("[data-testid=mind-kpi-total]").bounding_box(), page.locator("[data-testid=mind-kpi-spaces]").bounding_box()
        check(abs(a["y"] - b["y"]) < 4, tag + "Mind: three numbers in a row")
        w, r = page.locator("[data-testid=mind-board]").bounding_box(), page.locator("[data-testid=mind-report]").bounding_box()
        check(r["x"] > w["x"] + w["width"] - 4, tag + "…the Mind Report beside the wall")
        shot(page, "mind-desktop-" + theme)
        go(page, "learn", "[data-testid=learn-page]"); shot(page, "learn-desktop-" + theme)
        page.click("[data-testid=learn-open-report]"); page.wait_for_selector("[data-testid=learn-report]"); shot(page, "learn-report-desktop-" + theme)
        ctx.close()
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
