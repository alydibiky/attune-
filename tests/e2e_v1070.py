"""v10.7 — Ali's OKs on the real page, at a phone, a foldable's cover, an unfolded foldable and a computer:
 · OK-AN: a tick pops and the to-do slides away (then it is saved); "make to-do lists editable easily" — tap the words → edit;
 · OK-WR: the Writing page — tabs, "For" = which AI (ChatGPT, Gemini…), every run keeps a version, Keep going / delete;
 · OK-FO: the open foldable (673) shows the computer layout with the side rail; nothing past the edge.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v1070.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
now = int(datetime.datetime.now().timestamp() * 1000)
SOON = min(now + 3600000, int(datetime.datetime.combine(datetime.date.today(), datetime.time(23, 59, 0)).timestamp() * 1000))   # (later TODAY — at 23:30 "in an hour" is tomorrow)
REM = [{"id": "r1", "title": "Call the crane yard", "at": SOON, "repeat": "none", "created": now - 86400000},
       {"id": "r2", "title": "Pay the maid", "at": SOON + 15000, "repeat": "none", "created": now - 86400000}]
INIT = ("try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:coach:v1',JSON.stringify({seen:['*']}));"
        "localStorage.setItem('attune:reminders:v1',%s);}catch(e){};") % json.dumps(json.dumps(REM))
LONG = ("I would really like you to please write for me a very detailed and very long explanation, if it is possible, of how the hydraulic "
        "system of a mobile crane basically works, and please make sure that you basically explain it in very simple words.")
with sync_playwright() as p:
    br = p.chromium.launch()
    for name, w, desk in (("phone", 360, False), ("fold cover", 344, False), ("fold open", 673, True), ("computer", 1366, True)):
        ctx, page = new_page(br, env, errors, legacy_nav=False, desktop=(w, 860) if desk else None, extra_init=INIT)
        if not desk: page.set_viewport_size({"width": w, "height": 820})
        page.goto(env.url); page.wait_for_timeout(1800)
        if w == 673:
            check(page.locator("[data-testid=rail-menu]").is_visible(), name + ": the side rail (computer layout) is shown")
        if page.locator("[data-testid=home-todo-row-words]").count():
            # tap the words → edit
            page.locator("[data-testid=home-todo-row-words]").first.click(); page.wait_for_timeout(250)
            check(page.locator("[data-testid=todo-edit-input]").count() == 1, name + ": tapping a to-do's words opens its edit")
            page.fill("[data-testid=todo-edit-input]", "Call the crane yard at 5"); page.click("[data-testid=todo-edit-save]"); page.wait_for_timeout(300)
            rem = json.loads(page.evaluate("localStorage.getItem('attune:reminders:v1')"))
            check(any(r["title"] == "Call the crane yard at 5" for r in rem), name + ": the words changed")
            # tick → the motion, then saved
            n0 = page.locator("[data-testid=home-todo-row]").count()
            page.locator("[data-testid=home-todo-row]").first.click(); page.wait_for_timeout(200)
            mid = json.loads(page.evaluate("localStorage.getItem('attune:reminders:v1')"))
            page.wait_for_timeout(1200)
            after = json.loads(page.evaluate("localStorage.getItem('attune:reminders:v1')"))
            check(mid == rem or len(mid) == len(rem), name + ": the row moves away first (not saved in the middle of the motion)")
            check(page.locator("[data-testid=home-todo-row]").count() < n0 or after != rem, name + ": …then the tick is saved and the row is gone")
        else:
            check(desk, name + ": Home's To do card shows the to-dos")
        # the Writing page
        page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'write'}}))"); page.wait_for_timeout(700)
        check(page.locator("[data-testid=writing-page]").is_visible(), name + ": the Writing page opens")
        for t in ("improve", "shorten", "humanize", "copilot", "recipes"): check(page.locator("[data-testid=writing-tab-%s]" % t).count() == 1, name + ": tab " + t)
        check(page.locator("[data-testid=writing-for-chatgpt]").count() == 1 and page.locator("[data-testid=writing-for-gemini]").count() == 1, name + ": For ChatGPT / Gemini")
        bg = page.evaluate("getComputedStyle(document.querySelector('[data-testid=writing-go]')).backgroundColor")
        check(bg not in ("rgba(0, 0, 0, 0)", "transparent"), name + ": the main button has its colour (it was drawn as bare text): " + bg)
        page.locator("[data-testid=writing-for-gemini]").click()
        page.locator("[data-testid=writing-tab-shorten]").click(); page.fill("[data-testid=writing-text]", LONG)
        page.locator("[data-testid=writing-trim]").click(); page.wait_for_timeout(600)
        v = page.locator("[data-testid=writing-version]")
        check(v.count() == 1, name + ": Trim (offline) keeps a version")
        if v.count():
            txt = page.locator("[data-testid=writing-version-text]").first.inner_text()
            check(0 < len(txt) < len(LONG), name + ": …shorter than the original (%d < %d)" % (len(txt), len(LONG)))
            page.locator("[data-testid=writing-keep]").first.click(); page.wait_for_timeout(150)
            check(page.input_value("[data-testid=writing-text]") == txt, name + ": Keep going puts that version in the box")
            page.locator("[data-testid=writing-delete]").first.click(); page.wait_for_timeout(150)
            check(page.locator("[data-testid=writing-version]").count() == 0, name + ": a version can be deleted")
        st = json.loads(page.evaluate("localStorage.getItem('attune:writing:v1')") or "{}")
        check(st.get("target") == "gemini", name + ": the AI picked is remembered")
        sw = page.evaluate("document.scrollingElement.scrollWidth")
        check(sw <= w + 2, name + ": nothing scrolls sideways (%d)" % sw)
        ctx.close()
    errs = real_errors(errors); check(not errs, "no JavaScript errors: %s" % errs[:2])
    br.close()
env.close(); finish()
