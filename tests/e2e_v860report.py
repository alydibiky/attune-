"""v8.6 (Play launch review): Google Play's AI-generated content policy — every AI answer has "Report this answer" with reasons;
the report is kept on the phone (and e-mailed when SUPPORT_EMAIL is set).
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v860report.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)
    page.locator("textarea[placeholder='Message Attune']").fill("write one sentence about the sea"); page.locator("button[title='Send']").click()
    page.wait_for_selector("[data-testid=report-answer]", timeout=90000)
    page.locator("[data-testid=report-answer]").last.click()
    check(page.locator("[data-testid=report-reasons] button").count() == 5, "Report this answer → 5 reasons (offensive, harmful, sexual, false, other)")
    page.click("[data-testid=report-offensive]"); page.wait_for_timeout(200)
    rows = json.loads(page.evaluate("localStorage.getItem('attune:ai-reports') || '[]'"))
    check(len(rows) == 1 and rows[0]["why"] == "offensive" and rows[0]["text"], "the report is kept with the answer's text")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
finish()
