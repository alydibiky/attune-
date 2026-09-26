"""v5.27 — nothing goes unanswered: a message far bigger than a small model's window is read
in parts and answered; a long answer carries on by itself (no Continue tap).

  python3 tests/e2e_v527.py
"""
import json, subprocess
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish, HERE

env = Env(); errors = []

def send(page, text):
    page.locator("textarea[placeholder='Message Attune']").fill(text)
    page.locator("button[title='Send']").first.click()

def done(page, n=1, timeout=60000):
    page.wait_for_function("(n) => document.querySelectorAll(\"button[title='Regenerate']\").length >= n", arg=n, timeout=timeout)

def main_bodies(page):
    return page.evaluate("window.__mock.bodies.filter(x => x.max_tokens > 2)")

# a report of 90,000+ characters, with the request at the start and the end
paras = ["Section %d. Crane LTM-%d was inspected on day %d; the hydraulic pressure read %d bar and the repair cost %d EGP. " % (i, 1000 + i, i, 180 + i, 1500 * i) * 6 for i in range(1, 121)]
LONG = "Summarise this maintenance report and list every repair cost above 150,000 EGP.\n\n" + "\n\n".join(paras) + "\n\nGive the total of those costs at the end."
parts = int(subprocess.check_output(["node", "-e", """
import('%s/../web-src/longread.js').then(m => { const s = Math.max(1500, Math.floor(m.fitChars(16384, 900, 600, process.argv[1]) * 0.85)); console.log(m.splitParts(process.argv[1], s).length); })
""" % HERE, LONG]).decode().strip())

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.evaluate("localStorage.setItem('attune:ram', '4')"); page.reload(); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("button:has-text('Echo')").first.click(); page.wait_for_timeout(300)
    page.locator("button:has-text('Download Echo')").first.click()
    page.wait_for_selector("text=Running · Echo", timeout=15000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)

    # ---- 1. a 90,000-character message on a small model: read in parts, then answered ----
    check(len(LONG) > 80000 and parts >= 2, "the test message is %d characters — %d parts for a small model" % (len(LONG), parts))
    notes = ["- Section %d: repair cost %d EGP" % (i, 1500 * i) for i in range(1, parts + 1)]
    page.evaluate("(q) => { const M = window.__mock; M.fakeQueue = q; M.bodies = []; }", notes + ["**Summary:** the report covers 120 cranes. Costs above 150,000 EGP: … **Total: 1,234,500 EGP**"])
    send(page, LONG)
    page.wait_for_function("() => /reading it in parts/.test(document.body.innerText)", timeout=20000)
    check(True, "it says it is reading the long message in parts")
    done(page, 1, 120000)
    bs = main_bodies(page)
    reads = [b for b in bs if "PART " in str(b["messages"][-1]["content"]) and "OF %d" % parts in str(b["messages"][-1]["content"])]
    check(len(reads) == parts, "each of the %d parts is read on its own (%d)" % (parts, len(reads)))
    check(all(len(str(b["messages"][-1]["content"])) < 60000 for b in bs), "no request is bigger than the model can read")
    final = str(bs[-1]["messages"][-1]["content"])
    check("NOTES FROM EVERY PART" in final and "Section %d: repair cost" % parts in final, "the answer is written from the notes of every part")
    check("Summarise this maintenance report" in final and "Give the total" in final, "…and it knows the request (from the start AND the end of the message)")
    check("Total: 1,234,500 EGP" in page.locator(".att-md").last.inner_text(), "the long message gets a real answer — no 'too long' error")

    # ---- 2. a long answer carries on by itself ----
    page.evaluate("() => { const M = window.__mock; M.fakeQueue = ['Step 1: survey the ground. Step 2: set the mats.', 'Step 3: level the crane. Step 4: check the chart.', 'Step 5: lift slowly.']; M.fakeTokens = 'max'; M.bodies = []; }")
    # the first two answers hit the length limit, the third one finishes
    page.evaluate("""() => { const N = window.AttuneNative, S = window.__mock; const prev = N.chat; let k = 0;
      N.chat = (id, body) => { if (JSON.parse(body).max_tokens > 2) { k++; if (k === 3) S.fakeTokens = 0; } return prev(id, body); }; }""")
    send(page, "Write the full procedure for a tandem lift with two mobile cranes")
    done(page, 2)
    page.wait_for_timeout(400)
    bs = main_bodies(page)
    txt = page.locator(".att-md").last.inner_text()
    check("Step 1" in txt and "Step 3" in txt and "Step 5" in txt, "a cut answer carried on by itself, in the same bubble (no Continue tap)")
    cont = [b for b in bs if "Continue exactly where you stopped" in str(b["messages"][-1]["content"])]
    check(len(cont) >= 1 and "set the mats." in str(cont[0]["messages"][-2]["content"]), "…the model saw the END of what it had written")
    check(page.locator("[data-testid=continue]").count() == 0, "no Continue button is left to tap")

    errs = real_errors(errors)
    check(not errs, "no JavaScript errors (%d)%s" % (len(errs), (": " + errs[0]) if errs else ""))
    ctx.close(); br.close()
env.close()
finish()
