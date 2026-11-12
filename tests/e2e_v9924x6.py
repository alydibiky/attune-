"""v9.9.24 B6 X6 Kids & school (Ali picked A+B combined — the child's page + found in the class group, everything editable): Family →
Mariam → School: set the class group "Grade 5 B parents" → Recall kept 1 message from it → "Read 1 new message" finds the exam (Sun 15
Nov), the trip fee 350 (Wed) and the lab coat (Tue) ticked, and "No school on Thursday" (said on a Thursday) unticked with "Which day —
this one or next week?"; filling its date ticks it; Add 4 → the next two weeks + a reminder on each day; an item opens to edit / delete.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v9924x6.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
NOW = datetime.datetime(2026, 11, 12, 12, 0, 0)   # a Thursday
CARE = {"members": [{"id": "pm", "name": "Mariam"}], "meds": [], "labs": [], "taken": {}}
MSG = "Dear parents, the math exam is on Sunday 15 Nov, chapters 3-4. Trip fee 350 EGP by Wednesday. Lab coat needed on Tuesday. No school on Thursday."
NOTES = [{"id": "n1", "ts": 1, "app": "WhatsApp", "pkg": "com.whatsapp", "title": "Grade 5 B parents: Ms Hoda", "text": MSG}, {"id": "n2", "ts": 2, "app": "WhatsApp", "title": "Ahmed", "text": "see you"}]
INIT = ("try { localStorage.setItem('attune:care:v1', %s); localStorage.setItem('attune:start','home'); } catch (e) {}\n"
        "(() => { const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0); N.recallNotes = () => %s; }; go(); })();") % (json.dumps(json.dumps(CARE)), json.dumps(json.dumps(NOTES)))
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    ctx.clock.set_fixed_time(NOW)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'care'}}))"); page.wait_for_selector("[data-testid=care-page]", timeout=8000)
    page.click("[data-testid=care-tab-family]"); page.click("[data-testid=care-school]"); page.wait_for_selector("[data-testid=school]")
    page.fill("[data-testid=school-group]", "Grade 5 B parents"); page.wait_for_timeout(200)
    check("1 new message" in page.locator("[data-testid=school-read-kept]").inner_text(), "the class group's message Recall kept (not Ahmed's) — 1 new")
    page.click("[data-testid=school-read-kept]"); page.wait_for_selector("[data-testid=school-found]")
    items = page.evaluate("[...document.querySelectorAll('[data-testid=school-found-item]')].map(e => [e.dataset.kind, e.dataset.ask, e.querySelector('[data-testid=school-tick]').checked, e.querySelector('[data-testid=school-date]').value])")
    check(items == [["exam", "", True, "2026-11-15"], ["fee", "", True, "2026-11-18"], ["bring", "", True, "2026-11-17"], ["holiday", "which", False, "2026-11-12"]], "found: exam 15 Nov, fee Wed, lab coat Tue (ticked); holiday unticked — %s" % items)
    check("Which day" in page.locator("[data-testid=school-ask]").inner_text(), "the holiday asks: which day — this one or next week?")
    check(page.locator("[data-testid=school-amount]").input_value() == "350", "the fee: 350")
    page.locator("[data-testid=school-found-item][data-kind=holiday] [data-testid=school-date]").fill("2026-11-19"); page.wait_for_timeout(100)
    check(page.locator("[data-testid=school-found-item][data-kind=holiday] [data-testid=school-tick]").is_checked(), "filling the date ticks it")
    page.click("[data-testid=school-add]"); page.wait_for_timeout(400)
    week = page.locator("[data-testid=school-item]").all_inner_texts()
    check(len(week) == 4 and "Exam" in week[0], "the next two weeks: 4 items, the exam first — %s" % [w.replace("\n", " ") for w in week])
    rem = page.evaluate("JSON.parse(localStorage.getItem('attune:reminders:v1') || '[]').filter(r => r.source === 'school').map(r => r.title)")
    check(len(rem) == 4 and any("350" in r for r in rem), "a reminder on each day (the fee with 350): %s" % rem)
    check(page.locator("[data-testid=school-read-kept]").count() == 0, "the message is read — not offered again")
    page.locator("[data-testid=school-item]").first.click(); page.fill("[data-testid=school-edit-title]", "Math exam — chapters 3 and 4"); page.click("[data-testid=school-edit-save]"); page.wait_for_timeout(200)
    check("chapters 3 and 4" in page.locator("[data-testid=school-item]").first.inner_text(), "an item edited")
    page.locator("[data-testid=school-item]").last.click(); page.click("[data-testid=school-delete]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=school-item]").count() == 3, "…and one deleted")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
env.close(); finish()
