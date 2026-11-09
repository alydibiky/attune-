"""v9.9.6 N3 (Ali OK'd): @ links in notes — typing @She shows Sheikh, picking writes @Sheikh, the note shows Linked: @Sheikh (a tap
opens his page), "he'll pay Thursday" offers Follow up (a reminder only when tapped); @ + a new name can make a new card.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v996mentions.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
NOW = datetime.datetime(2026, 11, 10, 12, 0, 0)
DIR = {"v": 1, "skip": [], "items": [{"id": "p1", "kind": "person", "name": "Sheikh", "aliases": [], "role": "client", "contact": None, "picks": {}, "created": 1},
  {"id": "t1", "kind": "thing", "name": "Grove GMK", "aliases": [], "role": "", "contact": None, "picks": {}, "created": 2}]}
INIT = "try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:people:v1', %s)}catch(e){}" % json.dumps(json.dumps(DIR))
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    ctx.clock.set_fixed_time(NOW)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_timeout(1200)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'shelf'}}))"); page.wait_for_selector("[data-testid=shelf-home]", timeout=10000)
    page.locator("[data-testid=shelf-cover]").first.click(); page.wait_for_selector("[data-testid=shelf-new-note]", timeout=5000)
    page.click("[data-testid=shelf-new-note]"); page.wait_for_selector("[data-testid=shelf-editor]")
    body = page.locator("[data-testid=shelf-note-body]")
    body.click(); page.keyboard.type("Called @She")
    page.wait_for_selector("[data-testid=note-at]")
    check(page.locator("[data-testid=note-at-pick]").count() == 1 and "Sheikh" in page.inner_text("[data-testid=note-at]"), "typing “@She” shows @Sheikh · client")
    page.click("[data-testid=note-at-pick]"); page.wait_for_timeout(150)
    check(body.input_value() == "Called @Sheikh ", "picked → “Called @Sheikh ”")
    page.keyboard.type("about the @gro"); page.wait_for_selector("[data-testid=note-at-pick]"); page.click("[data-testid=note-at-pick]")
    page.keyboard.type("rental, he'll pay Thursday. Ask @Mona")
    page.wait_for_selector("[data-testid=note-at-new]")
    page.click("[data-testid=note-at-new]"); page.wait_for_timeout(150)
    check("@Mona" in body.input_value() and any(p["name"] == "Mona" for p in page.evaluate("JSON.parse(localStorage.getItem('attune:people:v1')).items")), "“@Mona” + New → a new card for Mona")
    links = page.locator("[data-testid=note-link]").all_inner_texts()
    check(sorted(links) == sorted(["@Sheikh", "@Grove GMK", "@Mona"]), "the note shows Linked: @Sheikh @Grove GMK @Mona (%s)" % links)
    pr = page.locator("[data-testid=note-promise]")
    check(pr.count() == 1 and "Sheikh" in pr.inner_text() and "Thu" in pr.inner_text(), "“he'll pay Thursday” → Follow up on Sheikh, Thu 9:00 (offered)")
    rem0 = page.evaluate("(JSON.parse(localStorage.getItem('attune:reminders:v1')||'[]')).length")
    page.click("[data-testid=note-promise-go]"); page.wait_for_timeout(300)
    rem = page.evaluate("JSON.parse(localStorage.getItem('attune:reminders:v1')||'[]')"); rem = rem if isinstance(rem, list) else rem.get("items", [])
    check(len(rem) == rem0 + 1 and "Sheikh" in rem[-1]["title"], "Follow up → a reminder “Sheikh — … he'll pay Thursday”")
    page.locator("[data-testid=note-link]", has_text="@Sheikh").click(); page.wait_for_selector("[data-testid=people-card]", timeout=8000)
    check("Sheikh" in page.inner_text("[data-testid=people-card]"), "a tap on @Sheikh opens his page")
    check(not real_errors(errors), "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
