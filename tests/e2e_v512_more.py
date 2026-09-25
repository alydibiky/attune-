"""v5.12 sections: Learn daily (lessons, visuals, quizzes, notifications, widget) and Daily news.
Run through e2e_v512.py:  python3 tests/e2e_v512.py lessons news layout
"""
import json, time
from harness import new_page, check, HERE

PLAN = json.dumps({"title": "Turkish from zero", "lessons": ["Alphabet & sounds", "Vowel harmony", "Plurals: -ler / -lar", "Numbers 1–10", "Olmak: to be", "Past tense -di"]})

def lesson(title, visual):
    return f"""Merhaba! Today: **{title}**.

## The idea
Turkish words change their endings to match their vowels. Example: *ev* (house) → *evler* (houses).

## Examples
- kitap → kitaplar (books)
- göz → gözler (eyes)

## Try it
Make the plural of *okul* (school).

```json
{json.dumps({"visual": visual, "keyPoints": ["Front vowels take -ler", "Back vowels take -lar", "Look at the last vowel"]})}
```"""

L1 = lesson("Alphabet & sounds", {"kind": "cards", "title": "Letters that surprise", "items": [{"front": "ç", "back": "ch as in chair", "note": "çay — tea"}, {"front": "ş", "back": "sh as in shoe", "note": "şeker — sugar"}]})
L2 = lesson("Vowel harmony", {"kind": "table", "title": "Vowel groups", "columns": ["Last vowel", "Plural"], "rows": [["e, i, ö, ü", "-ler"], ["a, ı, o, u", "-lar"]]})
L3 = lesson("Plurals", {"kind": "steps", "title": "Making a plural", "items": ["Find the last vowel", "Front or back?", "Add -ler or -lar"]})
QUIZ = json.dumps({"questions": [
    {"q": "Plural of ev (house)?", "options": ["evler", "evlar", "evleri", "evlerim"], "answer": 0, "why": "e is a front vowel → -ler"},
    {"q": "Plural of kitap (book)?", "options": ["kitapler", "kitaplar", "kitaplır", "kitapsız"], "answer": 1, "why": "a is a back vowel → -lar"},
    {"q": "How is ş pronounced?", "options": ["s", "sh", "ch", "z"], "answer": 1, "why": "ş = sh"}]})

NEWS_MOCK = r"""
(() => {
  const N = window.AttuneNative, S = window.__mock;
  const R = (id, o) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify(o)), 0);
  S.widget = null; S.newsCalls = [];
  N.setWidget = (j) => { S.widget = JSON.parse(j); return true; };
  N.news = (id, arg) => { const a = JSON.parse(arg); S.newsCalls.push(a); const now = Date.now(), H = 3600000;
    R(id, { items: [
      { title: "Al Ahly beat Zamalek 2-1 in the Cairo derby - KingFut", url: "https://kingfut.com/derby", source: "KingFut", date: now - 3 * H, snippet: "Goals from Tau and Maaloul." },
      { title: "Al Ahly beat Zamalek 2-1 in Cairo derby - Ahram Online", url: "https://english.ahram.org.eg/derby", source: "Ahram Online", date: now - 4 * H },
      { title: "Ahly agree deal for Moroccan striker - Kooora", url: "https://kooora.com/striker", source: "Kooora", date: now - 6 * H, snippet: "Talks reached the final stage." },
      { title: "Ahly's 2019 season review - Old", url: "https://old.example/2019", source: "Old", date: now - 90 * H } ],
      hits: [{ title: "Ahly next match: CAF Champions League on Friday", url: "https://www.cafonline.com/ahly", text: "Al Ahly play Esperance on Friday at 9 pm Cairo time in the CAF Champions League." }], why: "" }); };
})();
"""

DIGEST = """**Al Ahly won the Cairo derby 2-1 and are close to signing a Moroccan striker.**
- Ahly beat Zamalek 2-1, with goals from Tau and Maaloul [1]
- Talks for a Moroccan striker have reached the final stage [2]
- A rumour that the coach is leaving [9]
Coming up: Ahly play Esperance in the CAF Champions League on Friday at 9 pm Cairo time [3]"""

def sections(env, errors, install, open_more, queue):
    def page_with_mock(br):
        ctx, page = new_page(br, env, errors, extra_init=NEWS_MOCK)
        page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
        return ctx, page

    def notes(page, prefix):
        # the phone keeps one notification per id (a new schedule replaces it); the mock keeps every call
        return page.evaluate("(p) => { const m = new Map(); for (const n of window.__mock.notes) if (n.id.startsWith(p)) m.set(n.id, n); return [...m.values()]; }", prefix)

    def sec_lessons(br):
        ctx, page = page_with_mock(br)
        install(page)
        open_more(page, "Learn daily", "learn-page")
        page.click("[data-testid=learn-new-btn]")
        page.fill("[data-testid=learn-topic]", "Turkish")
        page.select_option("select >> nth=2", "3")          # a quiz every 3 lessons
        queue(page, ["```json\n" + PLAN + "\n```", L1])
        page.click("[data-testid=learn-create]")
        page.wait_for_selector("[data-testid=today-lesson]", timeout=60000)
        c = page.locator("[data-testid=course]").inner_text()
        check("Turkish from zero" in c and "Past tense -di" in c, "the course is planned from beginner up (6 lessons listed)")
        b = page.evaluate("window.__mock.bodies.filter(x => x.max_tokens > 2)")
        check("step by step towards expert level" in b[0]["messages"][0]["content"], "the plan asks for beginner → expert")
        n = notes(page, "daily-learn-")
        check(len(n) == 1 and n[0]["repeat"] == "daily" and "Alphabet & sounds" in n[0]["body"], "a daily notification is set, saying today's lesson: " + (n[0]["body"] if n else "none"))
        w = page.evaluate("window.__mock.widget")
        check(w and "Alphabet" in w["lesson"]["title"] and w["lesson"]["open"].startswith("daily-learn-"), "the home-screen widget shows today's lesson")

        page.click("[data-testid=today-lesson]")
        page.wait_for_selector("[data-testid=lesson]")
        check(page.locator("[data-testid=visual-cards]").count() == 1 and page.locator("[data-testid=key-points]").count() == 1, "the lesson has a visual (word cards) and key points")
        page.locator("[data-testid=visual-cards] button").first.click()
        check("ch as in chair" in page.locator("[data-testid=visual-cards]").inner_text(), "a card turns over to show its meaning")
        page.screenshot(path=HERE + "/v512-lesson.png", full_page=True)

        def read_and_next(nxt):
            queue(page, [nxt] if nxt else [])
            page.click("[data-testid=lesson-done]")
            if nxt:
                page.wait_for_function("JSON.parse(localStorage.getItem('attune:daily:courses:v1'))[0].lessons.length >= %d" % (L_count[0] + 1), timeout=60000)
                L_count[0] += 1
        L_count = [1]
        read_and_next(L2)
        n = notes(page, "daily-learn-")
        check("Vowel harmony" in n[0]["body"], "after reading, tomorrow's lesson is prepared and the notification says what it is")
        page.click("text=Turkish")                           # back to the course
        page.click("[data-testid=next-now]")
        page.wait_for_selector("[data-testid=visual-table]")
        check("-lar" in page.locator("[data-testid=visual-table]").inner_text(), "lesson 2 carries a table")
        read_and_next(L3)
        page.click("text=Turkish")
        page.click("[data-testid=next-now]")
        page.wait_for_selector("[data-testid=visual-steps]")
        b = page.evaluate("window.__mock.bodies.filter(x => x.max_tokens > 2).pop()")
        check("Already covered: Alphabet & sounds; Vowel harmony" in b["messages"][1]["content"], "each lesson knows what was already taught")
        read_and_next(None)
        page.wait_for_selector("[data-testid=quiz-start]")
        queue(page, [QUIZ])
        page.click("[data-testid=quiz-start]")
        page.wait_for_selector("[data-testid=quiz]", timeout=60000)
        wrong_one = None
        for i in range(3):
            q = page.locator("[data-testid=quiz] p").nth(0).inner_text()
            opts = page.locator("[data-testid=quiz-option]")
            texts = [opts.nth(k).inner_text().split("\n")[-1].strip() for k in range(opts.count())]
            right = {"Plural of ev (house)?": "evler", "Plural of kitap (book)?": "kitaplar", "How is ş pronounced?": "sh"}[q]
            pick = right if not q.startswith("Plural of kitap") else next(t for t in texts if t != right)
            if pick != right: wrong_one = q
            opts.nth(texts.index(pick)).click()
            page.click("[data-testid=quiz-next]")
        check("2 / 3" in page.locator("[data-testid=quiz-result]").inner_text(), "quiz scored: 2 / 3")
        page.click("[data-testid=quiz-finish]")
        course = page.evaluate("JSON.parse(localStorage.getItem('attune:daily:courses:v1'))[0]")
        check(course["review"] and course["review"][0].startswith("Plural of kitap") and course["quizzes"][0]["score"] == 2, "the missed question goes into the review list (it comes back in the next lesson)")

        # tapping the notification opens the course and writes today's lesson
        queue(page, [lesson("Numbers 1–10", {"kind": "bars", "title": "x", "items": [{"label": "bir", "value": 1}, {"label": "iki", "value": 2}]})])
        page.evaluate("window.__attuneBack && window.__attuneBack()")
        page.locator("nav button").first.click()
        cid = course["id"]
        # the next morning: yesterday's lessons are behind us
        page.evaluate("""() => { const k = 'attune:daily:courses:v1'; const c = JSON.parse(localStorage.getItem(k));
            const y = new Date(Date.now() - 86400000); const d = y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0');
            c[0].lessons.forEach(l => l.day = d); c[0].lastDay = d; localStorage.setItem(k, JSON.stringify(c)); }""")
        page.evaluate("(id) => window.dispatchEvent(new MessageEvent('attune-share', {data: {kind: 'reminder', id: 'daily-learn-' + id}}))", cid)
        page.wait_for_selector("[data-testid=course]", timeout=5000)
        page.wait_for_function("JSON.parse(localStorage.getItem('attune:daily:courses:v1'))[0].lessons.length >= 4", timeout=60000)
        b = page.evaluate("window.__mock.bodies.filter(x => x.max_tokens > 2).pop()")
        check("Quick review" in b["messages"][0]["content"] and "Plural of kitap" in b["messages"][0]["content"], "tapping the notification opens the course; the new lesson starts with a review of what was missed")
        ctx.close()

    def sec_news(br):
        ctx, page = page_with_mock(br)
        install(page)
        open_more(page, "Daily news", "news-page")
        page.click("[data-testid=news-add-btn]")
        page.fill("[data-testid=news-query]", "Al Ahly")
        page.click("[data-testid=news-follow]")
        page.wait_for_selector("[data-testid=news-topic]")
        n = notes(page, "daily-news-")
        check(len(n) == 1 and n[0]["repeat"] == "daily", "following a topic sets a daily notification")
        queue(page, [DIGEST])
        page.click("[data-testid=news-gather]")
        page.wait_for_selector("[data-testid=digest]", timeout=60000)
        d = page.locator("[data-testid=digest]").inner_text()
        src = page.locator("[data-testid=digest-sources]").inner_text()
        check("won the Cairo derby" in d and "[9]" not in d, "the digest is shown; a citation to a source that doesn't exist is removed")
        check("KingFut" in src and "Ahram Online" not in src and "2019" not in src, "the same story from two sites is kept once; a 4-day-old article is dropped")
        check("cite no source" in d, "a line left without a source is flagged")
        b = page.evaluate("window.__mock.bodies.filter(x => x.max_tokens > 2).pop()")
        check("never add facts from memory" in b["messages"][0]["content"] and "Esperance" in b["messages"][1]["content"], "the model writes only from the gathered articles (headlines + pages read)")
        check(page.evaluate("window.__mock.newsCalls[0].q") == "Al Ahly", "only the topic is sent out")
        n = notes(page, "daily-news-")
        check("won the Cairo derby" in n[0]["body"] and "Cairo derby" in page.evaluate("window.__mock.widget.news.title"), "the notification and the widget show today's headline")
        page.screenshot(path=HERE + "/v512-news.png", full_page=True)
        ctx.close()

    def sec_layout(br):
        """Arabic, 360 px: every Business tab fits the phone (the grid scrolls inside its own box)."""
        ctx = br.new_context(viewport={"width": 360, "height": 780}, device_scale_factor=2, is_mobile=True, has_touch=True)
        ctx.add_init_script(env.mock); ctx.add_init_script(NEWS_MOCK)
        ctx.add_init_script("try{localStorage.setItem('attune:onboarded','1');localStorage.setItem('attune:ui:lang','ar')}catch(e){}")
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
        page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
        WIDE = """() => { const W = window.innerWidth; const out = [...document.querySelectorAll('section *')].filter(e => { const r = e.getBoundingClientRect();
            if (!r.width || e.closest('.overflow-x-auto')) return false; return r.right > W + 1 || r.left < -1; }).slice(0, 3).map(e => e.tagName + '.' + (e.className || '').toString().slice(0, 40));
            return { sw: document.documentElement.scrollWidth, W, out }; }"""
        page.locator("nav button").last.click(); page.wait_for_timeout(250)
        page.locator(".rounded-t-2xl .grid button").filter(has_text="أعمالي").first.click()
        page.wait_for_selector("[data-testid=business-page]", timeout=5000)
        page.click("[data-testid=erp-new]"); page.click("[data-testid=erp-tpl-cranes]"); page.click("[data-testid=erp-create]")
        page.wait_for_selector("[data-testid=erp-systemview]")
        bad = {}
        for tab in ["data", "design", "summary", "more"]:
            page.click(f"[data-testid=erp-tab-{tab}]"); page.wait_for_timeout(200)
            r = page.evaluate(WIDE)
            if r["sw"] > r["W"] + 1 or r["out"]: bad[tab] = r
        page.click("[data-testid=erp-tab-data]"); page.click("[data-testid=erp-add-row]"); page.wait_for_timeout(200)
        r = page.evaluate(WIDE)
        if r["sw"] > r["W"] + 1 or r["out"]: bad["record"] = r
        for k, v in bad.items(): print("   wider than the phone on", k, v)
        check(not bad, "Arabic, 360 px: Business data, design, summary, more and the record form all fit")
        page.screenshot(path=HERE + "/v512-business-ar.png", full_page=True)
        miss = page.evaluate("window.__trMiss ? [...window.__trMiss] : []")
        ctx.close()

    return {"lessons": sec_lessons, "news": sec_news, "layout": sec_layout}
