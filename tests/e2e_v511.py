"""v5.11 — making the same model stronger:
  reason: riddles/logic are answered several times, voted on and checked
  teach:  👎 → the right answer → used as an example on similar questions
  file:   a spreadsheet question is computed by pandas on the real file (real Pyodide + openpyxl)

  python3 tests/e2e_v511.py [reason] [teach] [file]
"""
import os, sys
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish, HERE

SECTIONS = sys.argv[1:] or ["reason", "teach", "wrongfix", "file"]
env = Env()
errors = []

def install(page):
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)

def send(page, text):
    page.locator("textarea[placeholder='Message Attune']").fill(text)
    page.locator("button[title='Send']").click()

def answers(page): return page.evaluate("window.__mock.bodies.filter(x => x.max_tokens > 2)")

MARBLE = "I have an empty glass on the kitchen counter. I place a marble inside it, turn the glass upside down, and carry it across the room to the coffee table. Where is the marble? Walk through the physical steps."
WRONG = "1. The marble is in the glass.\n2. The glass is turned upside down.\n3. The glass is carried to the table.\nFINAL: on the coffee table"
FIXED = "1. The marble is in the glass on the counter.\n2. Turning the glass upside down, the marble falls out onto the kitchen counter.\n3. Only the empty glass is carried to the coffee table.\nFINAL: on the kitchen counter"

def sec_reason(br):
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    install(page)
    page.evaluate("([a, b, c]) => { const M = window.__mock; M.fakeQueue = [a, b, c]; M.bodies = []; }", [WRONG, WRONG, FIXED])
    send(page, MARBLE)
    page.wait_for_selector("[data-testid=reasoned]", timeout=60000)
    txt = page.locator(".att-md").last.inner_text()
    check(txt.startswith("on the kitchen counter"), "Ali's marble question: the answer shown is 'on the kitchen counter' — " + txt.splitlines()[0])
    check("reviewer fixed a mistake" in page.locator("[data-testid=reasoned]").inner_text(), "two tries agreed on the WRONG answer; the strict checker caught it")
    b = answers(page)
    check(len(b) == 3 and "FINAL:" in b[0]["messages"][0]["content"] and "strict reviewer" in b[2]["messages"][0]["content"],
          "3 calls: two tries (stopped early because they agreed) + one strict check")
    check(b[1]["temperature"] > b[0]["temperature"], "the second try uses more randomness, so it is an independent attempt")
    # "Think" keeps the model's own thinking (shown live) instead of the vote
    page.evaluate("() => { const M = window.__mock; M.fakeQueue = ['12 edges.']; M.bodies = []; }")
    page.locator("button:has-text('Think')").first.click()
    send(page, "Explain your reasoning: how many edges does a cube have?")
    page.wait_for_function("document.querySelectorAll('button[title=Regenerate]').length >= 2", timeout=60000)
    b = answers(page)
    check(len(b) == 1 and b[0]["chat_template_kwargs"]["enable_thinking"] is True, "with Think on, the model's own thinking is used (one call, thinking on)")
    ctx.close()

def sec_teach(br):
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    install(page)
    PREF = "VERDICT: PREFERENCE\nREASON: This is how your own crews name it.\nANSWER: crane mat"
    page.evaluate("(p) => { const M = window.__mock; M.fakeQueue = ['Call it an outrigger pad.', p, p]; M.bodies = []; }", PREF)
    send(page, "What should I call the outrigger mat in the daily site report?")
    page.wait_for_selector("button[title='Regenerate']", timeout=30000)
    page.click("[data-testid=teach]")
    page.fill("[data-testid=teach-right]", "Call it a crane mat (in Arabic: مطة), and give its size, e.g. crane mat 1.5 × 1.5 m.")
    page.fill("[data-testid=teach-why]", "that is what our crews and clients call it")
    page.click("[data-testid=teach-save]")
    page.wait_for_selector("[data-testid=teach-form]", state="detached", timeout=30000)
    check(any("trust neither side" in b["messages"][0]["content"].lower() for b in answers(page)), "the correction was double-checked by the model before saving")
    check(page.evaluate("JSON.parse(localStorage.getItem('attune:learned:v1')||'[]').filter(e => e.kind === 'chat').length") == 1, "👎 → the right answer is saved as a lesson")
    page.evaluate("() => { const M = window.__mock; M.fakeQueue = ['Crane mat 1.5 × 1.5 m.']; M.bodies = []; }")
    send(page, "In the site report, what do I call the outrigger mat under each leg?")
    page.wait_for_selector("[data-testid=learned-used]", timeout=30000)
    last = answers(page)[-1]["messages"][-1]["content"]
    check("HOW THIS USER HAS CORRECTED YOU" in last and "crane mat" in last and "our crews and clients" in last, "a similar question later carries the lesson (answer + reason) to the model")
    check("Used 1 of your corrections" in page.locator("[data-testid=learned-used]").inner_text(), "…and the answer says it used it")
    page.evaluate("() => { const M = window.__mock; M.fakeQueue = ['Sunny.']; M.bodies = []; }")
    send(page, "Tell me a fun fact about octopuses")
    page.wait_for_function("document.querySelectorAll('button[title=Regenerate]').length >= 3", timeout=30000)
    check("CORRECTED YOU" not in str(answers(page)[-1]["messages"][-1]["content"]), "an unrelated question does not get the lesson")
    ctx.close()

def make_xlsx(path):
    import openpyxl
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = "RFQ"
    ws.append(["RFQ No", "Client", "Value EGP", "Status", "Due"])
    rows = [("R-101", "Orascom", 120000, "Open", "2026-09-20"), ("R-102", "Hassan Allam", 85000, "Won", "2026-09-01"),
            ("R-103", "Orascom", 130000, "Open", "2026-10-05"), ("R-104", "Petrojet", 40000, "Lost", "2026-08-15")]
    for r in rows: ws.append(r)
    wb.save(path)

PROGRAM = """```python
import pandas as pd
df = pd.read_excel("rfq.xlsx", sheet_name="RFQ")
open_ = df[df["Status"] == "Open"]
print(open_[["RFQ No", "Client", "Value EGP"]].to_string(index=False))
total = int(open_["Value EGP"].sum())
print("ANSWER:", f"{total:,} EGP in {len(open_)} open RFQs")
```"""

def sec_file(br):
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    install(page)
    path = os.path.join(HERE, "rfq.xlsx"); make_xlsx(path)
    page.set_input_files("[data-testid=attach-file]", path); os.remove(path)
    check("rfq.xlsx" in page.locator("[data-testid=attached]").inner_text(), "a spreadsheet can be attached in Chat")
    page.evaluate("([a, b]) => { const M = window.__mock; M.fakeQueue = [a, b]; M.bodies = []; }",
                  [PROGRAM, "**250,000 EGP** is still open, in 2 RFQs (R-101 and R-103, both Orascom)."])
    send(page, "What is the total value of the open RFQs?")
    page.wait_for_selector("[data-testid=computed]", timeout=120000)
    b = answers(page)
    check("SHEET 'RFQ': 4 rows x 5 columns" in b[0]["messages"][-1]["content"] and "Value EGP" in b[0]["messages"][-1]["content"],
          "the model is first shown the file's real sheet, rows and columns (read by pandas on the phone)")
    check("Result: 250,000 EGP in 2 open RFQs" in b[1]["messages"][-1]["content"], "the program ran on the real .xlsx: 120,000 + 130,000 = 250,000 EGP")
    page.locator("[data-testid=computed] button").click()
    check("R-103" in page.locator("[data-testid=computed]").inner_text(), "the program and what it printed can be opened")
    check("rfq.xlsx" in page.locator("text=rfq.xlsx").first.inner_text(), "the question shows the file it was about")
    page.screenshot(path=HERE + "/v511-file.png", full_page=True)
    ctx.close()

def sec_wrongfix(br):
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    install(page)
    W = "VERDICT: WRONG\nREASON: Turning the glass over makes the marble fall out onto the counter, so the first answer was right.\nANSWER: on the kitchen counter"
    page.evaluate("(w) => { const M = window.__mock; M.fakeQueue = ['The marble is on the kitchen counter.', w, w]; M.bodies = []; }", W)
    send(page, "Short answer only: where does the marble end up if I turn the glass over on the counter and carry the glass away?")
    page.wait_for_selector("button[title='Regenerate']", timeout=60000)
    page.click("[data-testid=teach]")
    page.fill("[data-testid=teach-right]", "It is on the coffee table.")
    page.click("[data-testid=teach-save]")
    page.wait_for_selector("[data-testid=teach-verdict]", timeout=30000)
    v = page.locator("[data-testid=teach-verdict]").inner_text()
    check("don't think the correction is right" in v and "fall out" in v, "a WRONG correction is caught and the reason is shown — " + v.splitlines()[0])
    learned = lambda: page.evaluate("JSON.parse(localStorage.getItem('attune:learned:v1')||'[]').filter(e => e.kind === 'chat').length")
    check(learned() == 0, "…and it is NOT learned")
    page.screenshot(path=HERE + "/v512-teach-wrong.png")
    page.click("[data-testid=teach-force]")
    check(learned() == 1, "'I'm sure — learn mine anyway' still lets Ali overrule it")
    ctx.close()

FN = {"reason": sec_reason, "teach": sec_teach, "wrongfix": sec_wrongfix, "file": sec_file}
with sync_playwright() as pw:
    br = pw.chromium.launch()
    for s in SECTIONS:
        print(f"--- {s}", flush=True)
        try: FN[s](br)
        except Exception as e: check(False, f"{s} section crashed: {str(e)[:300]}")
    br.close()
env.close()
re_ = real_errors(errors)
for e in re_[:20]: print("   ", e)
check(len(re_) == 0, "no JavaScript errors in the page (%d)" % len(re_))
finish()
