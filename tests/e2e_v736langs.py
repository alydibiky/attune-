"""v6.32 — more interface languages: Settings shows English, العربية, Français, Español, Türkçe; picking French turns the
app French (left to right), Turkish turns it Turkish, and Arabic still turns it right to left.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v736langs.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
SHOT = "/tmp/v736langs-fr.png"
def boot(page, lang):
    page.goto(env.url); page.evaluate("l => localStorage.setItem('attune:ui:lang', l)", lang)
    page.reload(); page.wait_for_selector("nav", timeout=15000); page.wait_for_timeout(300)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("nav button:has-text('All')").first.click(); page.wait_for_timeout(400)
    body = page.locator("[data-testid=more-appearance]").first.inner_text()
    check(all(n in body for n in ["Français", "Español", "Türkçe", "العربية"]), "the language switch lists the new languages")
    boot(page, "fr")
    body = page.locator("body").inner_text()
    check(page.evaluate("document.documentElement.lang") == "fr" and page.evaluate("document.documentElement.dir") == "ltr", "French: lang=fr, left to right")
    check("Demandez n'importe quoi" in body or "Discussion" in body or "Outils" in body, "French text on the first screen")
    page.screenshot(path=SHOT)
    boot(page, "tr")
    check("Sohbet" in page.locator("nav").first.inner_text(), "Turkish text on the first screen")
    boot(page, "ar")
    check(page.evaluate("document.documentElement.dir") == "rtl", "Arabic still right to left")
    boot(page, "en")
    check("What can I help with?" in page.locator("body").inner_text(), "English back")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
finish()
