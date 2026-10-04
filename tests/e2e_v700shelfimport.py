"""v6.12 — import notes into Shelf from the phone's Notebook app and other notes apps: pasted / shared text, several
files at once (text, Evernote, Google Keep), into a new «Imported notes» book.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v700shelfimport.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []

def open_shelf(page):
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('Shelf'), .rounded-t-2xl button:has-text('رف')").first.click()
    page.wait_for_selector("[data-testid=shelf-home]", timeout=5000)

ENEX = '<?xml version="1.0"?><en-export><note><title>Site visit</title><content><![CDATA[<en-note><div>Ground is soft</div></en-note>]]></content></note></en-export>'
KEEP = json.dumps({"title": "Diesel", "textContent": "Buy 200 L", "listContent": [{"text": "oil filter", "isChecked": True}]})

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    open_shelf(page)
    page.click("[data-testid=shelf-more]"); page.click("[data-testid=shelf-import-open]")
    page.wait_for_selector("[data-testid=shelf-import-sheet]", timeout=3000)
    page.fill("[data-testid=shelf-import-text]", "Crane 50 t\nservice on Sunday\n\n---\n\nCall Karim\nabout the invoice")
    page.click("[data-testid=shelf-import-paste]")
    page.wait_for_selector("[data-testid=shelf-book]", timeout=3000)
    notes = page.locator("[data-testid=shelf-note]").all_inner_texts()
    check(len(notes) == 2 and any("Call Karim" in n for n in notes), "pasted text → 2 notes in a new «Imported notes» book: %s" % [n[:20] for n in notes])
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(300)
    check(page.locator("[data-testid=shelf-book-tile]", has_text="Imported notes").count() == 1, "the «Imported notes» book is on the shelf")
    # several files at once into the same book
    page.click("[data-testid=shelf-more]"); page.click("[data-testid=shelf-import-open]")
    page.set_input_files("[data-testid=shelf-import-file]", files=[
        {"name": "a.txt", "mimeType": "text/plain", "buffer": "Shopping\nmilk".encode()},
        {"name": "Evernote.enex", "mimeType": "application/xml", "buffer": ENEX.encode()},
        {"name": "Keep note.json", "mimeType": "application/json", "buffer": KEEP.encode()}])
    page.wait_for_selector("[data-testid=shelf-book]", timeout=8000)
    page.wait_for_timeout(400)
    notes = page.locator("[data-testid=shelf-note]").all_inner_texts()
    check(len(notes) == 5 and any("Site visit" in n for n in notes) and any("Diesel" in n for n in notes) and any("Shopping" in n for n in notes),
          "3 files (text, Evernote, Google Keep) → 3 more notes in the same book: %d notes" % len(notes))
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(300)
    check(page.locator("[data-testid=shelf-book-tile]", has_text="Imported notes").count() == 1, "the same book is reused, not a second one")
    check(real_errors(errors) == [], "no errors: %s" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
