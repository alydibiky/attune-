"""v9.9.38 CG-3 + BK-2 + WK-1 + WK-2 (Ali's picks) in the real page: a book goal counts from its +1 (the book sheet: title, author, plot,
stars, review, lessons) and from the Home box ("finished another book: Sapiens", «خلصت كتاب»), Undo takes one back, the card shows
"N / 14 books", the last books with their stars; Settings → Week starts on changes Money's "this week".
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v9938goals.py
"""
import json, time, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
today = datetime.date.today()
GOAL = {"items": [{"id": "g1", "kind": "count", "target": 14, "unit": "book", "deadline": (today + datetime.timedelta(days=400)).isoformat(), "title": "read 14 books",
                   "created": (today - datetime.timedelta(days=60)).isoformat(), "base": {}, "status": "active", "log": [], "done": [{"id": "x1", "at": today.isoformat()}]}]}
INIT = "try{localStorage.setItem('attune:missions:v1',%s);localStorage.setItem('attune:start','home');localStorage.setItem('attune:country','de')}catch(e){}" % json.dumps(json.dumps(GOAL))
def goal(page): return page.evaluate("JSON.parse(localStorage.getItem('attune:missions:v1')).items[0]")
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT, legacy_nav=False)
    page.goto(env.url); page.wait_for_selector("[data-testid=home-ask]", timeout=15000); page.wait_for_timeout(600)
    key = page.evaluate("Object.keys(localStorage).find(k => /missions/.test(k))")
    check(key == "attune:missions:v1", "the goals are kept under attune:missions:v1 (%s)" % key)
    # the Home box counts it, with the book's title, and Undo takes it back
    page.fill("[data-testid=home-ask]", "finished another book: Sapiens"); page.click("[data-testid=home-send]"); page.wait_for_timeout(400)
    g = goal(page)
    check(len(g["done"]) == 2 and g["done"][-1].get("title") == "Sapiens", "Home box: “finished another book: Sapiens” → 2 of 14, titled Sapiens")
    check(page.locator("text=Counted: 2 of 14").count() > 0, "it says “Counted: 2 of 14”")
    page.click("[data-testid=do-undo]"); page.wait_for_timeout(200)
    check(len(goal(page)["done"]) == 1, "Undo takes it back (1 of 14)")
    page.fill("[data-testid=home-ask]", "خلصت كتاب"); page.click("[data-testid=home-send]"); page.wait_for_timeout(400)
    check(len(goal(page)["done"]) == 2, "«خلصت كتاب» counts too (and is not put on the shopping list)")
    lists = page.evaluate("JSON.stringify(Object.keys(localStorage).filter(k => /list/i.test(k)).map(k => localStorage.getItem(k)))")
    check("كتاب" not in lists, "no «كتاب» on any list")
    # the card: +1 opens the book sheet; Save with the details
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open', { detail: { mode: 'missions' } }))"); page.wait_for_selector("[data-testid=mission]", timeout=8000)
    check("2 / 14 books" in page.locator("[data-testid=mission-progress]").inner_text(), "the card: “2 / 14 books”")
    check(page.locator("[data-testid=mission-step]").count() == 1 and "keeps you on time" in page.locator("[data-testid=mission-step]").inner_text(), "the pace line: “1 every … keeps you on time”")
    page.click("[data-testid=mission-plus]"); page.wait_for_selector("[data-testid=book-sheet]", timeout=4000)
    check(page.locator("[data-testid=book-save]").is_disabled(), "Save waits for a title")
    page.fill("[data-testid=book-title]", "Atomic Habits"); page.fill("[data-testid=book-author]", "James Clear"); page.fill("[data-testid=book-plot]", "Small habits compound.")
    page.click("[data-testid=book-star-4]"); page.fill("[data-testid=book-review]", "Practical"); page.fill("[data-testid=book-lessons]", "1. Make it obvious\n2. The 2-minute rule\n- Identity first")
    page.click("[data-testid=book-save]"); page.wait_for_timeout(300)
    b = goal(page)["done"][-1]
    check(b.get("title") == "Atomic Habits" and b.get("author") == "James Clear" and b.get("stars") == 4 and b.get("plot") == "Small habits compound." and b.get("review") == "Practical",
          "the book is kept with its author, plot, 4 stars and review")
    check(b.get("lessons") == ["Make it obvious", "The 2-minute rule", "Identity first"], "the lessons, one per line, numbers and dashes taken off: %s" % b.get("lessons"))
    check("3 / 14 books" in page.locator("[data-testid=mission-progress]").inner_text(), "the card: “3 / 14 books”")
    check(page.locator("[data-testid=mission-book]").count() >= 1 and "Atomic Habits" in page.locator("[data-testid=mission-books]").inner_text() and "★★★★" in page.locator("[data-testid=mission-books]").inner_text(), "Books you read: Atomic Habits ★★★★")
    page.click("[data-testid=mission-undo]"); page.wait_for_timeout(200)
    check(len(goal(page)["done"]) == 2, "Undo last on the card")
    # Save and attach → the Library opens in “Books I read”
    page.click("[data-testid=mission-plus]"); page.fill("[data-testid=book-title]", "Deep Work"); page.click("[data-testid=book-attach]"); page.wait_for_timeout(900)
    check(goal(page)["done"][-1].get("file") is True, "attach: the book is saved, marked as having its file")
    check(page.locator("[data-testid=booklib-file]").count() > 0 or page.evaluate("!!document.querySelector('[data-testid*=booklib]')"), "…and the Library opens")
    # the week: Germany starts on Monday; Settings changes it
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open', { detail: { mode: 'settings' } }))"); page.wait_for_timeout(500)
    sel = page.locator("[data-testid=week-select]")
    check(sel.count() >= 1 and "Monday" in sel.first.inner_text(), "Settings → Week starts on: “Your country's day — Monday” for Germany")
    sel.first.select_option("6"); page.wait_for_timeout(200)
    check(page.evaluate("localStorage.getItem('attune:week-start')") == "6", "choosing Saturday is kept")
    sel.first.select_option(""); page.wait_for_timeout(200)
    check(page.evaluate("localStorage.getItem('attune:week-start')") is None, "back to the country's day")
    errs = real_errors(errors); check(not errs, "no JavaScript errors: %s" % errs[:2])
    br.close()
env.close(); finish()
