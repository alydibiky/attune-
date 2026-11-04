"""v9.1 design D (Ali, 4 Nov 2026, picked D: "ask box + 4 rows"): a project opens on its name + due date, ONE big "Ask about this
work" box, then Files · Saved · Repeats · Answers as. The box sends at once into a new chat of this work (with its role and what it
always knows); a repeat runs with a tap and stops being due; a page saved from the work's chat shows under Saved. Phone + computer.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v912projects.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
PROJ = [{"id": "p1", "emoji": "🏠", "name": "Flat renovation", "due": "2030-12-20", "instructions": "Budget 250,000 EGP. Answer in short steps.",
  "knowledge": [{"id": "k1", "name": "Quotes.txt", "text": "Painter quote: 18,000 EGP for the whole flat."}],
  "repeats": [{"id": "r1", "text": "What is still open this week?", "every": "week", "last": 0}, {"id": "r2", "text": "Total spent so far?", "every": "", "last": 0}]}]
INIT = "try{localStorage.setItem('attune:projects:v1', %s)}catch(e){}" % json.dumps(json.dumps(PROJ))
PAGE = "Here it is.\n\n```html\n<!doctype html><html><head><title>Room plan</title></head><body><div>Kitchen</div><script>1</script></body></html>\n```"
def queue(page, a): page.evaluate("(a) => { const M = window.__mock; M.bodies = []; M.fakeQueue = a; }", a)
def sysprompt(page): return page.evaluate("(window.__mock.bodies.filter(x => x.max_tokens > 2).slice(-1)[0] || {messages:[{}]}).messages[0].content || ''")
def go(page, m): page.evaluate("(m) => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", m); page.wait_for_timeout(500)
with sync_playwright() as p:
    br = p.chromium.launch()
    for size in [(390, 844), (1366, 860)]:
        tag = "[%dpx] " % size[0]
        ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
        page.set_viewport_size({"width": 390, "height": 844})
        page.goto(env.url); page.wait_for_timeout(1300)
        page.locator("header button:has-text('No model')").first.click()      # the model is installed on the phone layout, then the window grows
        page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
        page.wait_for_selector("text=Running now", timeout=10000)
        page.evaluate("window.__attuneBack()"); page.wait_for_timeout(250)
        page.set_viewport_size({"width": size[0], "height": size[1]}); page.wait_for_timeout(400)
        go(page, "projects")
        it = page.locator("[data-testid=project-item]").first.inner_text()
        check("Due" in it and "1 due" in it, tag + "the list shows the due date and the repeat that is due: " + it.replace("\n", " · "))
        page.click("[data-testid=project-item]")
        page.wait_for_selector("[data-testid=project-ask]", timeout=5000)
        rows = page.evaluate("[...document.querySelectorAll('[data-testid^=project-row-]')].map(e => e.dataset.testid.slice(12))")
        check(rows == ["files", "saved", "repeats", "answers"], tag + "the work: ask box + Files · Saved · Repeats · Answers as (no chats yet): %s" % rows)
        check("Dec" in page.locator("[data-testid=project-due-line]").inner_text(), tag + "…its due date under the name")
        check(page.locator("[data-testid=project-brain]").count() == 0 and page.locator("[data-testid=project-file]").count() == 0, tag + "…and nothing else on the page")
        check("1" in page.locator("[data-testid=project-row-files]").inner_text() and "1 due" in page.locator("[data-testid=project-row-repeats]").inner_text()
              and "Just Attune" in page.locator("[data-testid=project-row-answers]").inner_text(), tag + "the rows say what is inside")
        wide = page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
        check(wide, tag + "no sideways scroll")
        # ---- Answers as: pick the Writer
        page.click("[data-testid=project-row-answers]"); page.wait_for_selector("[data-testid=project-sub-answers]")
        page.locator("[data-testid=project-answers-pick]:has-text('Writer')").click(); page.wait_for_timeout(200)
        page.evaluate("window.__attuneBack()"); page.wait_for_timeout(300)
        check("Writer" in page.locator("[data-testid=project-row-answers]").inner_text(), tag + "Answers as → Writer")
        # ---- the ask box sends at once, in a new chat of this work, with its role, what it always knows and its files
        queue(page, ["The painter quoted **18,000 EGP**."])
        page.fill("[data-testid=project-ask-input]", "How much did the painter quote?")
        page.click("[data-testid=project-new-chat]")
        page.wait_for_selector("text=18,000 EGP", timeout=15000)
        sp = sysprompt(page)
        check('you are "Writer"' in sp and "Budget 250,000 EGP" in sp and "Painter quote" in sp, tag + "the chat carries the role, what it always knows and the matching file")
        check(page.locator("[data-testid=space-chip]").count() >= 1, tag + "…and shows it belongs to the work")
        # ---- a page made in this work's chat → Saved
        queue(page, [PAGE])
        page.locator("textarea[placeholder='Message Attune']").fill("Make a room plan page")
        page.locator("button[title='Send']").first.click()
        page.wait_for_selector("[data-testid=artifact-card]", timeout=15000)
        page.locator("[data-testid=artifact-card]").last.click(); page.wait_for_selector("[data-testid=artifact-viewer]")
        page.locator("[data-testid=artifact-save]").click(); page.wait_for_timeout(300)
        page.locator("[data-testid=artifact-close]").click(); page.wait_for_timeout(300)
        go(page, "projects")
        if page.locator("[data-testid=project-ask]").count() == 0: page.click("[data-testid=project-item]")
        page.wait_for_selector("[data-testid=project-ask]", timeout=5000)
        check("1" in page.locator("[data-testid=project-row-saved]").inner_text(), tag + "Saved counts the page made in this work")
        page.click("[data-testid=project-row-saved]")
        check("Room plan" in page.locator("[data-testid=project-saved-item]").first.inner_text(), tag + "Saved lists it")
        page.locator("[data-testid=project-saved-item]").first.click(); page.wait_for_selector("[data-testid=artifact-viewer]")
        check(True, tag + "…and opens it full screen")
        page.locator("[data-testid=artifact-close]").click(); page.wait_for_timeout(300)
        page.evaluate("window.__attuneBack()"); page.wait_for_timeout(300)
        check(page.locator("[data-testid=project-row-chats]").count() == 1 and "(2)" not in page.locator("[data-testid=project-row-chats]").inner_text(), tag + "one light 'Earlier chats (1)' link")
        # ---- Repeats: run the due one → it asks in a new chat and stops being due; add one
        page.click("[data-testid=project-row-repeats]"); page.wait_for_selector("[data-testid=project-sub-repeats]")
        check(page.locator("[data-testid=project-repeat-due]").count() == 1, tag + "the weekly repeat that never ran is due; 'only when I tap' is not")
        page.click("[data-testid=project-repeat-add]"); page.fill("[data-testid=project-repeat-text]", "Which bills are due?")
        page.click("[data-testid=project-repeat-every-month]"); page.click("[data-testid=project-repeat-save]"); page.wait_for_timeout(200)
        check(page.locator("[data-testid=project-repeat]").count() == 3, tag + "a repeat is added (every month)")
        queue(page, ["Still open: **tiles** and **the painter's date**."])
        page.locator("[data-testid=project-repeat]").first.locator("[data-testid=project-repeat-run]").click()
        page.wait_for_selector("text=the painter's date", timeout=15000)
        check(True, tag + "Run asks it in a new chat of this work")
        go(page, "projects")
        if page.locator("[data-testid=project-ask]").count() == 0: page.click("[data-testid=project-item]")
        page.wait_for_selector("[data-testid=project-ask]", timeout=5000)
        r = page.locator("[data-testid=project-row-repeats]").inner_text()
        check("1 due" in r, tag + "…the run one is no longer due (the new monthly one is): " + r.replace("\n", " "))
        check("(2)" in page.locator("[data-testid=project-row-chats]").inner_text(), tag + "Earlier chats (2)")
        # ---- Files: add a note
        page.click("[data-testid=project-row-files]"); page.click("[data-testid=project-add-note]")
        page.fill("[data-testid=project-note-text]", "Tiles: 320 EGP per m²"); page.click("[data-testid=project-note-save]"); page.wait_for_timeout(200)
        check(page.locator("[data-testid=project-file]").count() == 2, tag + "Files: a note is added")
        # ---- Arabic: the rows read in Egyptian Arabic
        ctx.close()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + "try{localStorage.setItem('attune:ui:lang','ar')}catch(e){}")
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_timeout(1300)
    go(page, "projects"); page.click("[data-testid=project-item]"); page.wait_for_selector("[data-testid=project-ask]", timeout=5000)
    t = page.locator("[data-testid=project-page]").inner_text()
    check("التكرارات" in t and "بيرد بصفته" in t and "اسأل عن الشغل ده" in page.locator("[data-testid=project-ask-input]").get_attribute("placeholder"), "[ar] the page reads in Egyptian Arabic")
    ctx.close()
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
