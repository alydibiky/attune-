"""v9.9.6 N1 (Ali OK'd): tables from one sentence — Home box "track my cranes: name, tonnage, next inspection" makes the table and
opens it; "add Grove GMK, 100 tons, inspection 4 Dec" adds the row; Table · Board · Calendar; a reminder the day before each date.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v996tables.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
NOW = datetime.datetime(2026, 11, 10, 12, 0, 0)
def home(page, t):
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'home'}}))"); page.wait_for_selector("[data-testid=home-ask]", timeout=8000)
    page.fill("[data-testid=home-ask]", t); page.click("[data-testid=home-send]"); page.wait_for_timeout(500)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init="try{localStorage.setItem('attune:start','home')}catch(e){}")
    ctx.clock.set_fixed_time(NOW)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_timeout(1200)
    home(page, "track my cranes: name, tonnage, next inspection")
    page.wait_for_selector("[data-testid=table-page]", timeout=8000)
    heads = page.locator("[data-testid=table-grid] th").all_inner_texts()
    check([h for h in heads if h] == ["Name", "Tonnage", "Next inspection"], "one sentence → the Cranes table with Name · Tonnage · Next inspection (%s)" % heads)
    home(page, "add Grove GMK, 100 tons, inspection 4 Dec")
    home(page, "add Liebherr LTM, 200, 20 Nov")
    home(page, "add milk")
    st = page.evaluate("JSON.parse(localStorage.getItem('attune:tables:v1'))")
    rows = st["tables"][0]["rows"]
    check(len(rows) == 2 and sorted(r["cells"].get(st["tables"][0]["cols"][0]["id"], "") for r in rows) == ["Grove GMK", "Liebherr LTM"], "two rows added by talking; “add milk” did not go into the table")
    rem = page.evaluate("JSON.parse(localStorage.getItem('attune:reminders:v1')||'[]')"); rem = rem if isinstance(rem, list) else rem.get("items", [])
    tr_ = [r for r in rem if str(r.get("id", "")).startswith("tbl-")]
    check(len(tr_) == 2 and any("Liebherr LTM — Next inspection" == r["title"] and r["at"] == int(datetime.datetime(2026, 11, 19, 9, 0).timestamp() * 1000) for r in tr_), "a reminder the day before each inspection, 9:00 (Liebherr: 19 Nov)")
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'lists'}}))"); page.wait_for_selector("[data-testid=lists-tables]")
    page.click("[data-testid=lists-tables]"); page.wait_for_selector("[data-testid=tables-item]")
    page.click("[data-testid=tables-item]"); page.wait_for_selector("[data-testid=table-page]")
    check(page.locator("[data-testid=table-row]").count() == 2, "Lists → Tables → Cranes: 2 rows")
    page.fill("[data-testid=table-say]", "XCMG QY, 50, 12 Jan"); page.click("[data-testid=table-say-go]"); page.wait_for_timeout(300)
    check(page.locator("[data-testid=table-row]").count() == 3, "said in the table's own box → a 3rd row")
    page.click("[data-testid=table-view-calendar]"); page.wait_for_selector("[data-testid=table-calendar]")
    check(page.locator("[data-testid=table-cal-day]").count() == 1 and "Liebherr" in page.inner_text("[data-testid=table-calendar]"), "Calendar (November): Liebherr LTM on the 20th")
    check(not real_errors(errors), "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
