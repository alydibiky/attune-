"""v9.9.3 T1 (Ali: "timetable photo → reminders — slower OK, don't compromise quality and accuracy"): Reminders → From a timetable
photo → the photo is read (positions → grid) → a table to check (fix / delete) → Save → a weekly reminder before each class, which
stops after the term's last day.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v993timetable.py
"""
import json, os, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
NOW = datetime.datetime(2026, 11, 9, 8, 0, 0)
IMG = "/tmp/claude-0/-home-user-attune-/739740fb-478b-5f95-b105-83fb84eb25c5/scratchpad/tt.png"
L = lambda t, x, y, w=80, h=14: {"text": t, "x": x, "y": y, "w": w, "h": h}
LINES = [L("Sun", 200, 40, 40), L("Mon", 320, 40, 40), L("Tue", 440, 40, 40), L("9:00 - 10:30", 40, 100, 100), L("11:00 - 12:30", 40, 200, 110), L("1:00 - 2:30", 40, 300, 100),
  L("Accounting", 180, 95), L("B204", 190, 115, 40), L("Tax Law", 420, 95), L("A12", 430, 115, 30), L("Finance", 300, 195), L("Seminar", 180, 295), L("Finance Lab", 300, 295, 90), L("Accounting", 420, 295)]
MOCK = """(() => { window.__sched = []; function w(){ const N = window.AttuneNative; if (!N) return setTimeout(w, 5);
  N.readText = (id, j) => { setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ text: "", lines: %s, width: 600, height: 400 })), 20); };
  N.schedule = (j) => { window.__sched.push(JSON.parse(j)); return true; }; N.scheduled = () => "[]"; } w(); })();""" % json.dumps(LINES)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init="try{localStorage.setItem('attune:start','home')}catch(e){};" + MOCK)
    ctx.clock.set_fixed_time(NOW)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_timeout(1200)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'reminders'}}))"); page.wait_for_selector("[data-testid=rem-timetable]", timeout=10000)
    page.click("[data-testid=rem-timetable]"); page.wait_for_selector("[data-testid=timetable-page]")
    page.set_input_files("[data-testid=timetable-file]", IMG); page.wait_for_selector("[data-testid=timetable-rows]", timeout=10000)
    rows = page.locator("[data-testid=timetable-row]")
    check(rows.count() == 6, "the photo → 6 classes to check (%d)" % rows.count())
    subj = [page.locator("[data-testid=timetable-subject]").nth(i).input_value() for i in range(rows.count())]
    check(subj[0] == "Accounting" and "Finance Lab" in subj, "Sun 09:00 Accounting first … Finance Lab read: %s" % subj)
    check(page.locator("[data-testid=timetable-save]").is_disabled(), "Save waits for the term's last day")
    page.locator("[data-testid=timetable-subject]").nth(0).fill("Financial Accounting")
    page.locator("[data-testid=timetable-row]").nth(5).locator("button").click(); page.wait_for_timeout(100)
    page.fill("[data-testid=timetable-until]", "2027-01-20"); page.click("[data-testid=timetable-save]"); page.wait_for_timeout(300)
    rem = page.evaluate("JSON.parse(localStorage.getItem('attune:reminders:v1')||'[]')"); rem = rem if isinstance(rem, list) else rem.get("items", [])
    cls = [r for r in rem if r.get("source") == "timetable"]
    check(len(cls) == 5 and all(r["repeat"] == "weekly" for r in cls), "Save → 5 weekly class reminders (one deleted)")
    check(any(r["title"] == "Financial Accounting · B204" for r in cls), "the fix is kept: “Financial Accounting · B204”")
    s = page.evaluate("window.__sched")
    check(s and all(x.get("until") == int(datetime.datetime(2027, 1, 20, 23, 59).timestamp() * 1000) for x in s if x["id"].startswith("class-")), "the phone gets each with the term's end (they stop after 20 Jan)")
    check("5 classes saved" in page.inner_text("[data-testid=timetable-saved]"), "it says: 5 classes saved — a reminder 15 min before each")
    check(not real_errors(errors), "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
