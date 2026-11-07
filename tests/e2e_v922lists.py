"""v9.2 To-dos & lists (Ali, 4 Nov 2026, picked 1A: "the to-do or remind appears on Home when it's due or not finished … recurring lists
… I'm travelling and it shows my travel list on Home" + "a part where I add my list and choose whether it repeats, clear and visible").
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v922lists.py
"""
import json, time
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
now = int(time.time() * 1000)
REM = [{"id": "r1", "at": now - 3 * 3600 * 1000, "title": "Pay electricity", "repeat": "none"}, {"id": "r2", "at": now + 3600 * 1000 if time.localtime().tm_hour < 22 else now + 60000, "title": "Call Hassan", "repeat": "none"}]
INIT = ("try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:reminders:v1', %s)}catch(e){}" % json.dumps(json.dumps(REM)))
def go(page, m): page.evaluate("(m) => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", m); page.wait_for_timeout(600)
def say(page, t):
    page.fill("[data-testid=home-ask]", t); (page.click("[data-testid=home-send]") if page.locator("[data-testid=home-send]").count() else page.keyboard.press("Enter"))   # v9.8: on a phone Enter is a new line; page.wait_for_timeout(700)
def lists(page): return json.loads(page.evaluate("localStorage.getItem('attune:lists:v1') || '{\"lists\":[]}'"))["lists"]
with sync_playwright() as p:
    br = p.chromium.launch()
    for size, tag in [((390, 844), "[phone] "), ((1366, 860), "[computer] ")]:
        ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
        page.on("dialog", lambda d: d.accept())
        page.set_viewport_size({"width": size[0], "height": size[1]})
        page.goto(env.url); page.wait_for_timeout(1500)
        go(page, "home")
        card = page.locator("[data-testid=home-todo-card]")
        check(card.count() == 1 and "Pay electricity" in card.inner_text() and "Call Hassan" in card.inner_text(), tag + "Home's To do card: the late reminder and today's")
        check(page.locator("[data-testid=home-todo-late]").count() == 1, tag + "…the late one is marked late (red)")
        # a to-do from the box shows on Home and ticks off there
        say(page, "add buy batteries to my to-do list"); go(page, "home")
        check("buy batteries" in page.inner_text("[data-testid=home-todo-card]"), tag + "a to-do added in the box is on Home until it is done")
        page.locator("[data-testid=home-todo-row]", has_text="buy batteries").click(); page.wait_for_timeout(400)
        check("buy batteries" not in page.inner_text("[data-testid=home-todo]"), tag + "…ticked → gone")
        # a travel list from the box; "I'm travelling tomorrow" brings it to Home
        say(page, "make my travel checklist: passport, charger, Umrah clothes")
        check(page.locator("[data-testid=list-answer-card]").count() == 1 and len(lists(page)) == 1 and len(lists(page)[0]["items"]) == 3, tag + "“make my travel checklist: …” → a list with 3 items, shown at once")
        go(page, "home")
        check(page.locator("[data-testid=home-list]").count() == 0, tag + "…not on Home yet (no trip date)")
        say(page, "I'm travelling tomorrow"); go(page, "home")
        hl = page.locator("[data-testid=home-list]")
        check(hl.count() == 1 and "0 of 3" in hl.inner_text(), tag + "“I'm travelling tomorrow” → the travel list is on Home: " + (hl.inner_text().replace("\n", " · ") if hl.count() else ""))
        hl.locator("[data-testid=list-item]").first.click(); page.wait_for_timeout(300)
        check("1 of 3" in page.inner_text("[data-testid=home-list]"), tag + "tick on Home → 1 of 3")
        # the page: clear "New list" with "Does it repeat?"
        go(page, "lists")
        check(page.locator("[data-testid=lists-new]").count() == 1 and page.locator("[data-testid=lists-row]").count() == 1, tag + "To-dos & lists: New list + the travel list")
        check("On Home" in page.inner_text("[data-testid=lists-row]") and "Before" in page.inner_text("[data-testid=lists-row-when]"), tag + "…the row says it is on Home and when it comes back")
        page.click("[data-testid=lists-new]"); page.wait_for_selector("[data-testid=list-editor]")
        page.fill("[data-testid=list-name]", "Saturday cleaning"); page.fill("[data-testid=list-items]", "Floors\nBathroom\nPay the maid")
        check(page.locator("[data-testid^=list-repeat-]").count() == 5, tag + "Does it repeat? No · Every day · Every week · Every month · Before a date")
        page.click("[data-testid=list-repeat-week]")
        page.click("[data-testid=list-day-6]")   # Saturday is on by default → off
        page.click("[data-testid=list-day-5]")   # Friday
        check("Friday" in page.inner_text("[data-testid=list-when]"), tag + "…it says when it comes back: " + page.inner_text("[data-testid=list-when]"))
        page.click("[data-testid=list-save]"); page.wait_for_timeout(400)
        l2 = [l for l in lists(page) if l["name"] == "Saturday cleaning"]
        check(l2 and l2[0]["repeat"]["every"] == "week" and l2[0]["repeat"]["days"] == [5] and len(l2[0]["items"]) == 3, tag + "saved: every Friday, 3 items")
        # the sidebar row
        if tag == "[computer] ":
            check(page.locator("nav >> text=To-dos & lists").count() + page.locator("aside >> text=To-dos & lists").count() >= 1, tag + "To-dos & lists is in the sidebar")
        wide = page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
        check(wide, tag + "no sideways scroll")
        ctx.close()
    errs = real_errors(errors)
    check(not errs, "no page errors: %s" % errs[:3])
env.close()
finish()
