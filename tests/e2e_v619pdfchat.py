"""v6.18 — Ask a PDF: open a PDF, chat with it (answers from the right pages, citations checked in code), read its pages,
search inside it, and a PDF attached in Chat opens here. SHOTS=dir saves screenshots.

  python3 tests/e2e_v619pdfchat.py
"""
import json, os
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
def shot(page, name):
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, name + ".png"))

PAGES = [
  "Crane Rental Agreement\n\nThis agreement is made between Adrighem Cranes and Nile Constructions on 1 March 2026 for the rental of one 50 tonne mobile crane.",
  "Payment terms\n\nThe client shall pay a daily rate of 9,000 EGP. Invoices are due within 15 days. A late payment fee of 2% per month applies after the due date.",
  "Insurance and liability\n\nThe owner carries third party insurance of 5,000,000 EGP. The client is responsible for ground conditions and for providing a certified signalman.",
  "Termination\n\nEither party may end this agreement with 30 days written notice. If the client cancels within 48 hours of the start date, one day's rental is charged.",
]
JPG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="
NATIVE = """(() => { const N = window.AttuneNative, S = window.__mock; S.pdfCalls = [];
  const R = (id, v) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify(v)), 25);
  N.pdfText = (id, arg) => { S.pdfCalls.push(['pdfText', JSON.parse(arg).textOnly === true]); R(id, { count: %N%, pages: %PAGES% }); };
  N.pdfImages = (id, arg) => { const a = JSON.parse(arg); S.pdfCalls.push(['pdfImages', a.pages]); R(id, { images: a.pages.map((n) => ({ n, image: %JPG% })) }); };
})();""".replace("%N%", str(len(PAGES))).replace("%PAGES%", json.dumps([{"n": i + 1, "text": t, "scan": False} for i, t in enumerate(PAGES)])).replace("%JPG%", json.dumps(JPG))

def queue(page, answers):
    page.evaluate("(a) => { const M = window.__mock; M.bodies = []; M.fakeQueue = a; }", answers)
def sent(page): return page.evaluate("window.__mock.bodies.filter((b) => b.max_tokens > 2)")
def say(page, text):
    page.fill("[data-testid=pdf-input]", text); page.click("[data-testid=pdf-send]")

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(250)
    page.evaluate(NATIVE)
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('Ask a PDF')").first.click()
    page.wait_for_selector("[data-testid=pdfchat-home]", timeout=5000)
    shot(page, "1-home")

    # ---- open a PDF
    page.set_input_files("[data-testid=pdfchat-file]", files=[{"name": "contract.pdf", "mimeType": "application/pdf", "buffer": b"%PDF-1.4 test"}])
    page.wait_for_selector("[data-testid=pdfchat]", timeout=8000)
    check("contract.pdf" in page.locator("[data-testid=pdf-name]").inner_text() and "4 pages" in page.locator("[data-testid=pdfchat]").inner_text(), "the PDF opens with its name and page count")
    check(page.evaluate("window.__mock.pdfCalls")[0] == ["pdfText", True], "it is read in the fast text-only way")
    check(page.locator("[data-testid=pdf-suggest]").count() >= 3, "starter questions are offered")
    shot(page, "2-opened")

    # ---- a question: only the right page goes to the model, the answer shows its page
    queue(page, ["The late payment fee is 2% per month after the due date [p. 2]. Insurance is 5,000,000 EGP [p. 9]."])
    say(page, "What is the late payment fee?")
    page.wait_for_selector("[data-testid=pdf-msg-ai]", timeout=10000)
    ai = page.locator("[data-testid=pdf-msg-ai]").last.inner_text()
    body = json.dumps(sent(page)[-1])
    check("[p. 2]" in body and "Insurance and liability" not in body and "Termination" not in body, "only the page that fits the question was sent to the model")
    check("2% per month" in ai and page.locator("[data-testid=pdf-cite]").count() == 1 and "p. 9" not in ai, "the answer shows page 2 as a chip; the invented page 9 is removed")
    check("made up were removed" in ai, "…and the person is told a reference was removed")
    shot(page, "3-answer")

    # ---- a chip opens that page in the reader
    page.locator("[data-testid=pdf-cite]").first.click()
    page.wait_for_selector("[data-testid=pdf-reader]", timeout=4000); page.wait_for_selector("[data-testid=pdf-page-img]", timeout=4000)
    check("late payment fee" in page.locator("[data-testid=pdf-page-text]").inner_text() and page.locator("[data-testid=pdf-page-img]").count() == 1, "tapping the chip opens page 2: its picture and its text")
    check(page.locator("[data-testid=pdf-page-text] mark").count() >= 1, "the words of the question are highlighted on the page")
    shot(page, "4-reader")
    page.click("[data-testid=pdf-next]"); page.wait_for_timeout(300)
    check("Insurance and liability" in page.locator("[data-testid=pdf-page-text]").inner_text(), "next page works")
    page.fill("[data-testid=pdf-page-input]", "4"); page.wait_for_timeout(300)
    check("Termination" in page.locator("[data-testid=pdf-page-text]").inner_text(), "jump to page 4")
    page.fill("[data-testid=pdf-find]", "insurance"); page.wait_for_timeout(300)
    check(page.locator("[data-testid=pdf-hits] button").count() == 1 and "p. 3" in page.locator("[data-testid=pdf-hits]").inner_text(), "word search finds the page")
    page.locator("[data-testid=pdf-hits] button").first.click(); page.wait_for_timeout(300)
    check("Insurance and liability" in page.locator("[data-testid=pdf-page-text]").inner_text(), "a search hit opens its page")

    # ---- the document does not contain it: an honest answer, no model call
    page.click("[data-testid=pdf-tab-chat]")
    queue(page, [])
    say(page, "zebra giraffe safari itinerary")
    page.wait_for_function("() => document.querySelectorAll('[data-testid=pdf-msg-ai]').length >= 2", timeout=5000)
    check("could not find" in page.locator("[data-testid=pdf-msg-ai]").last.inner_text() and len(sent(page)) == 0, "not in the document → says so, and does not ask the model to guess")

    # ---- a page named in the question is read exactly
    queue(page, ["Page 4 says either party may end the agreement with 30 days' notice [p. 4]."])
    say(page, "explain page 4")
    page.wait_for_function("() => document.querySelectorAll('[data-testid=pdf-msg-ai]').length >= 3", timeout=10000)
    b = json.dumps(sent(page)[-1])
    check("Termination" in b and "Payment terms" not in b, "'explain page 4' sends exactly page 4")

    # ---- a summary: read in parts, notes, then the answer
    queue(page, ["- Rental of a 50 t crane [p. 1]\n- Daily rate 9,000 EGP; late fee 2% [p. 2]\n- 30 days notice [p. 4]", "Overview: a crane rental agreement. Daily rate 9,000 EGP [p. 2]; 30 days' notice to end it [p. 4]."])
    say(page, "Summarise this document")
    page.wait_for_function("() => document.querySelectorAll('[data-testid=pdf-msg-ai]').length >= 4", timeout=15000)
    last = page.locator("[data-testid=pdf-msg-ai]").last.inner_text()
    check("crane rental agreement" in last.lower() and page.locator("[data-testid=pdf-msg-ai]").last.locator("[data-testid=pdf-cite]").count() >= 2, "a summary is built from notes and keeps its page references")
    shot(page, "5-summary")

    # ---- v6.12: the document and its conversation are kept: back, then tap it under "Opened before"
    n_before = page.locator("[data-testid=pdf-msg-ai]").count()
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(400)
    page.wait_for_selector("[data-testid=pdfchat-recent]", timeout=5000)
    page.locator("[data-testid=pdfchat-recent]").first.click()
    page.wait_for_function("(n) => document.querySelectorAll('[data-testid=pdf-msg-ai]').length === n", arg=n_before, timeout=8000)
    check(page.locator("[data-testid=pdf-msg-ai]").count() == n_before, "a file opened before reopens with one tap, with its conversation (%d answers)" % n_before)

    # ---- a PDF attached in the main Chat opens here
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(300)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(300)
    page.locator("nav button").first.click(); page.wait_for_timeout(400)
    page.set_input_files("[data-testid=attach-file]", files=[{"name": "second.pdf", "mimeType": "application/pdf", "buffer": b"%PDF-1.4 other"}])
    page.wait_for_selector("[data-testid=attached-read]", timeout=8000)   # v6.12: it stays in the chat; "Read" opens it in Ask a PDF
    page.locator("[data-testid=attached-read]").click()
    page.wait_for_selector("[data-testid=pdfchat]", timeout=8000)
    check("second.pdf" in page.locator("[data-testid=pdf-name]").inner_text(), "a PDF attached in Chat opens in Ask a PDF (its Read button)")
    check(real_errors(errors) == [], "no errors: %s" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
