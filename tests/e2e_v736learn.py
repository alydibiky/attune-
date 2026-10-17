"""v6.32 — Learn extras (roadmap "Learning"): say it with a score per word, a spoken dialogue where you say one part, a picture drawn
for the lesson and kept with it, and a Knowledge pack turned into a daily course (a book's sections, each lesson the book's own
words with its source — no model needed — and a quiz made by code from the definitions).
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v736learn.py     (SHOTS=dir for screenshots)
"""
import os, json, time
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
now = int(time.time() * 1000); DAY = 86400000
L1 = {"n": 0, "title": "Greetings", "body": "## Merhaba\nSay **Merhaba** to anyone. **Günaydın** means good morning.", "keyPoints": ["Merhaba: hello"],
      "visual": {"kind": "cards", "items": [{"front": "Merhaba", "back": "Hello"}, {"front": "Bir çay lütfen", "back": "A tea, please"}]}, "made": now - 1000, "day": "", "done": False,
      "dialogue": {"title": "At the café", "lines": [{"who": "A", "text": "Merhaba!", "say": "Hello!"}, {"who": "B", "text": "Merhaba, bir çay lütfen.", "say": "Hello, a tea please."},
                                                     {"who": "A", "text": "Tabii, buyurun.", "say": "Sure, here you are."}, {"who": "B", "text": "Teşekkürler.", "say": "Thanks."}]}}
COURSE = {"id": "c1", "topic": "Turkish", "title": "Turkish", "level": "beginner", "lang": "en", "goal": "", "time": "08:00", "quizEvery": 5, "created": now - DAY,
          "plan": ["Greetings", "Numbers"], "lessons": [L1], "quizzes": [], "review": [], "streak": 0, "lastDay": "", "notify": True, "cards": []}
TOC = [{"title": "Principles of Economics 3e — Preface", "n": 2}, {"title": "Principles of Economics 3e — What Is Economics?", "n": 3}, {"title": "Principles of Economics 3e — Inflation", "n": 4}]
SECTIONS = {"Principles of Economics 3e — What Is Economics?": [{"text": "Economics is the study of how humans make decisions in the face of scarcity. Access for free at openstax.org", "url": "https://openstax.org/books/principles-economics-3e/pages/1-1"},
                                                              {"text": "Scarcity is the situation where human wants exceed the available resources.", "url": ""}]}
MOCK = r"""try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:daily:courses:v1',%s)}catch(e){}
(() => { const TOC = %s, SECTIONS = %s; window.__heard = []; window.__said = []; window.__drawn = 0;
  const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0);
    const R = (id, v) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify(v)), 15);
    N.listen = (id, lang) => R(id, { text: window.__heard.shift() || "" });
    N.speakWait = (id, arg) => { window.__said.push(JSON.parse(arg).text); R(id, { ok: true }); };
    N.imageInfo = () => JSON.stringify({ built: true, packs: [{ id: "turbo", installed: true, defaults: { steps: 4 } }] });
    N.imagine = (id, arg) => { window.__drawn++; window.__imagine = JSON.parse(arg);
      const c = document.createElement("canvas"); c.width = 64; c.height = 48; c.getContext("2d").fillRect(0, 0, 30, 30); R(id, { ok: true, url: c.toDataURL(), file: "x.png", width: 512, height: 384 }); };
    N.knowPacks = () => JSON.stringify({ packs: [{ id: "economics", name: "Economics", installed: true }] });
    N.knowToc = (id, arg) => R(id, { sections: TOC });
    N.knowSection = (id, arg) => R(id, { passages: SECTIONS[JSON.parse(arg).title] || [] });
  }; go(); })();""" % (json.dumps(json.dumps([COURSE])), json.dumps(TOC), json.dumps(SECTIONS))
def open_learn(page):
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'learn'}}))"); page.wait_for_selector("[data-testid=learn-page]", timeout=5000)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=MOCK)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    open_learn(page)
    page.locator("[data-testid=learn-course]").first.click(); page.wait_for_selector("[data-testid=course]")
    page.click("[data-testid=today-lesson]"); page.wait_for_selector("[data-testid=lesson]")
    ph = page.locator("[data-testid=speak-phrase]")
    check(ph.count() == 3 and "Merhaba" in ph.nth(0).inner_text() and "Günaydın" in ph.nth(2).inner_text(), "Say it: the lesson's word cards and bold phrases: %d" % ph.count())
    ph.nth(0).locator("[data-testid=speak-hear]").click(); page.wait_for_timeout(200)
    check(page.evaluate("window.__said").count("Merhaba") >= 1, "▶ the phone says the phrase")
    page.evaluate("window.__heard.push('merhaba')"); ph.nth(0).locator("[data-testid=speak-say]").click(); page.wait_for_selector("[data-testid=speak-score]")
    check("100/100" in ph.nth(0).inner_text() and "Excellent" in ph.nth(0).inner_text(), "said right → 100/100")
    page.evaluate("window.__heard.push('bir şey lütfen')"); ph.nth(1).locator("[data-testid=speak-say]").click(); page.wait_for_timeout(400)
    t1 = ph.nth(1).inner_text()
    check("/100" in t1 and "100/100" not in t1 and "heard: «bir şey lütfen»" in t1, "one word off → a lower score and what was heard: %s" % t1.replace("\n", " | "))
    check(page.locator("[data-testid=speak-result]").nth(1).locator("span[style*='underline']").count() == 1, "the missed word is marked")
    # dialogue: the phone says A, you say B
    page.evaluate("window.__heard.push('merhaba bir çay lütfen'); window.__heard.push('teşekkürler')")
    page.click("[data-testid=dialogue-play]"); page.wait_for_selector("[data-testid=dialogue-score]", timeout=8000)
    check("100/100" in page.locator("[data-testid=dialogue-score]").inner_text() and "Tabii, buyurun." in page.evaluate("window.__said"), "dialogue: the phone says its lines, yours are scored: %s" % page.locator("[data-testid=dialogue-score]").inner_text())
    # picture
    page.click("[data-testid=lesson-draw]"); page.wait_for_selector("[data-testid=lesson-picture]", timeout=5000)
    check(page.evaluate("window.__drawn") == 1 and "Greetings" in page.evaluate("window.__imagine.prompt"), "a picture is drawn on the phone for the lesson")
    saved = page.evaluate("JSON.parse(localStorage.getItem('attune:daily:courses:v1'))[0].lessons[0]")
    check(saved.get("picture", "").startswith("data:") and saved.get("speak", {}).get("Merhaba") == 100, "the picture and the best score are kept with the lesson")
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, "learn-speak.png"), full_page=True)
    # a course from a pack
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000); open_learn(page)
    page.locator("[data-testid=learn-new-btn]").first.click(); page.wait_for_selector("[data-testid=learn-packs]")
    page.click("[data-testid=learn-pack-economics]"); page.wait_for_selector("[data-testid=learn-book]")
    check("2 lessons" in page.locator("[data-testid=learn-book]").inner_text(), "the pack's book, without its preface: 2 lessons")
    page.click("[data-testid=learn-book]"); page.wait_for_selector("[data-testid=course]"); page.wait_for_timeout(600)
    page.click("[data-testid=today-lesson]"); page.wait_for_selector("[data-testid=lesson]")
    lt = page.locator("[data-testid=lesson]").inner_text()
    check("study of how humans make decisions" in lt and "Access for free" not in lt, "the lesson is the book's own words, tidied, with no model")
    check("Scarcity: the situation where human wants exceed" in lt, "its definitions are the key points (and become cards)")
    check("Economics" in page.locator("[data-testid=lesson-source]").inner_text() and page.locator("[data-testid=lesson-source] a").get_attribute("href").startswith("https://openstax.org"), "the source is shown with a link")
    check(page.locator("[data-testid=speak-practice]").count() == 0, "no Say it in a course that isn't a language")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
