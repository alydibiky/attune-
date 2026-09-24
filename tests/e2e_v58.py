"""v5.8 — the Code workbench: code written by the model is run on the phone
(Python via Pyodide, JavaScript, web pages), errors go back to the model, and
the result is marked tested. Python here is the real bundled Pyodide.

  python3 tests/e2e_v58.py [sandbox] [workbench] [chat]
"""
import re, sys
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish, HERE

SECTIONS = sys.argv[1:] or ["sandbox", "workbench", "chat"]
env = Env()
errors = []

def offline(ctx):
    # Nothing may leave the machine: only the page server and the test engine.
    ctx.route("**/*", lambda r: r.continue_() if re.match(r"https?://(127\.0\.0\.1|localhost)[:/]", r.request.url) or r.request.url.startswith(("data:", "blob:", "about:")) else r.abort())

def open_code(page):
    page.locator("nav button").last.click(); page.wait_for_timeout(200)
    page.locator(".rounded-t-2xl button:has-text('Code')").first.click()
    page.wait_for_selector("[data-testid=code-page]", timeout=5000)

def install(page):
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)

def sec_sandbox(br):
    ctx, page = new_page(br, env, errors); offline(ctx)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    open_code(page)
    page.wait_for_function("document.querySelector('[data-testid=py-status]').innerText.includes('ready')", timeout=90000)
    check("numpy, pandas, sympy" in page.locator("[data-testid=py-status]").inner_text(), "Python starts on the phone, offline, with numpy/pandas/sympy: " + page.locator("[data-testid=py-status]").inner_text())
    # Run pasted code through the editor (a program from chat arrives like this).
    def load(lang, code):
        page.evaluate("([l, c]) => window.dispatchEvent(new CustomEvent('attune-code', { detail: { lang: l, code: c } }))", [lang, code])
        page.wait_for_selector("[data-testid=code-editor]", timeout=5000)
        page.fill("[data-testid=code-editor]", code)
    def run_and_read():
        page.click("[data-testid=code-run]")
        page.wait_for_selector("[data-testid=code-output]", timeout=90000)
        return page.locator("[data-testid=code-output]").inner_text()
    load("python", "import numpy as np, pandas as pd, sympy as sp\nprint(np.arange(5).sum())\nprint(pd.DataFrame({'t': [12.5, 7.5]})['t'].sum())\nx = sp.symbols('x')\nprint(sp.solve(x**2 - 4, x))\n# --- tests ---\nassert np.arange(5).sum() == 10\nprint('ALL TESTS PASSED')")
    out = run_and_read()
    check("10" in out and "20.0" in out and "[-2, 2]" in out, "numpy, pandas and sympy all run from the app's own files (no internet)")
    check("Passed its 1 tests" in out, "a run with tests that pass is marked passed: " + out.splitlines()[0])
    load("python", "def area(w, h):\n    return w + h\n\nprint(area(2, 3))\n# --- tests ---\nassert area(2, 3) == 6, 'area is wrong'\nprint('ALL TESTS PASSED')")
    out = run_and_read()
    check("Failed" in out and "AssertionError" in out and "area is wrong" in out, "a failing test shows the real Python error")
    check("_pyodide" not in out and "/lib/python" not in out, "…without the runtime's own lines in the traceback")
    load("python", "import urllib.request\nurllib.request.urlopen('https://example.com').read()")
    out = run_and_read()
    check("Failed" in out, "Python cannot reach the internet from the sandbox")
    load("python", "from js import fetch\nawait fetch('https://example.com')")
    out = run_and_read()
    check("No internet in the sandbox" in out, "…not even through the browser's fetch: " + out.strip().splitlines()[-1][:90])
    load("python", "while True:\n    pass")
    page.click("[data-testid=code-run]")
    page.wait_for_selector("[data-testid=code-output]", timeout=40000)
    check("took too long" in page.locator("[data-testid=code-output]").inner_text(), "an endless loop is stopped (20 s), not frozen")
    load("python", "print(6 * 7)")
    check("42" in run_and_read(), "…and Python works again right after")
    load("javascript", "const t = (kg) => kg / 1000;\nconsole.log(t(2500));\n// --- tests ---\nassertEqual(t(1000), 1);\nconsole.log('ALL TESTS PASSED');")
    out = run_and_read()
    check("2.5" in out and "Passed its 1 tests" in out, "JavaScript runs with assert/assertEqual")
    load("javascript", "let a = 1;\nlet b = 2;\nnull.x;")
    out = run_and_read()
    check("TypeError" in out and "line 3" in out, "a JavaScript error names the right line: " + out.strip().splitlines()[-1][:80])
    load("javascript", "await fetch('https://example.com')")
    check("No internet in the sandbox" in run_and_read(), "JavaScript cannot reach the internet either")
    load("html", "<h1 id=h>Crane</h1><script>document.getElementById('h').textContent = 'Crane ' + (2 + 3);</script>")
    fr = page.frame_locator("[data-testid=code-preview]")
    check(fr.locator("h1").inner_text(timeout=5000) == "Crane 5", "a web page is previewed live, scripts running")
    page.click("[data-testid=code-run]")
    page.wait_for_selector("[data-testid=code-output]", timeout=10000)
    check("Ran without errors" in page.locator("[data-testid=code-output]").inner_text(), "a page that loads cleanly passes the check")
    load("html", "<p>x</p><script>undefinedThing()</script>")
    page.click("[data-testid=code-run]")
    page.wait_for_selector("[data-testid=code-output]", timeout=10000)
    check("undefinedThing" in page.locator("[data-testid=code-output]").inner_text(), "a page's script error is caught and shown")
    page.screenshot(path=HERE + "/v58-sandbox.png", full_page=True)
    ctx.close()

BUGGY = """Here it is:
```python
def capacity_at(chart, r):
    pts = sorted(chart.items())
    for (r1, c1), (r2, c2) in zip(pts, pts[1:]):
        if r1 <= r <= r2:
            return c1 + (c2 - c1) * (r - r1) / (r2 - r1)
    raise ValueError("radius outside the chart")

chart = {3: 60.0, 5: 42.0, 10: 20.0}
print(capacity_at(chart, 7))
# --- tests ---
assert capacity_at(chart, 3) == 60.0
assert capacity_at(chart, 10) == 20.0
assert capacity_at(chart, 7) == 20.0, "use the lower chart value between points"
print("ALL TESTS PASSED")
```
It interpolates between chart points."""

FIX = """<<<<<<< SEARCH
            return c1 + (c2 - c1) * (r - r1) / (r2 - r1)
=======
            return c1 if r == r1 else (c2 if r == r2 else min(c1, c2))
>>>>>>> REPLACE"""

def sec_workbench(br):
    ctx, page = new_page(br, env, errors); offline(ctx)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    install(page)
    open_code(page)
    page.wait_for_function("document.querySelector('[data-testid=py-status]').innerText.includes('ready')", timeout=90000)
    page.evaluate("([a, b]) => { window.__mock.fakeQueue = [a, b]; window.__mock.bodies = []; }", [BUGGY, FIX])
    page.fill("[data-testid=code-task]", "Capacity at any radius from a crane load chart; between points use the lower value")
    page.click("[data-testid=code-build]")
    page.wait_for_selector("[data-testid=code-badge]", timeout=120000)
    steps = page.locator("[data-testid=code-steps]").inner_text()
    check("Wrote it, with 3 tests" in steps, "step 1: the model wrote the program with 3 tests")
    check("use the lower chart value" in steps, "step 2: the phone ran it and caught the failing test")
    check("Changed 1 place" in steps, "step 3: the error went back and the model sent a one-line edit")
    check("Passed all 3 tests" in steps, "step 4: run again — all tests pass")
    badge = page.locator("[data-testid=code-badge]").inner_text()
    check("Tested on this phone: 3 passed" in badge, "the program is marked tested on this phone: " + badge)
    check("else min(c1, c2)" in page.locator("[data-testid=code-editor]").input_value(), "the editor shows the fixed code")
    bodies = page.evaluate("window.__mock.bodies")
    check(len(bodies) == 2 and "SEARCH" in bodies[1]["messages"][0]["content"] and "use the lower chart value" in bodies[1]["messages"][-1]["content"],
          "the fix request asked for SEARCH/REPLACE edits and carried the real failing assertion")
    check(all(b.get("chat_template_kwargs", {}).get("enable_thinking") is False for b in bodies), "no slow 'thinking' in the loop")
    # change request
    page.evaluate("(t) => { window.__mock.fakeQueue = [t]; }", """<<<<<<< SEARCH
print(capacity_at(chart, 7))
=======
print(capacity_at(chart, 7))
print("at 4 m:", capacity_at(chart, 4))
>>>>>>> REPLACE""")
    page.fill("[data-testid=code-change]", "also print the capacity at 4 m")
    page.click("[data-testid=code-change-go]")
    page.wait_for_function("document.querySelector('[data-testid=code-output]') && document.querySelector('[data-testid=code-output]').innerText.includes('at 4 m')", timeout=60000)
    check("at 4 m: 42.0" in page.locator("[data-testid=code-output]").inner_text(), "“Change it” edits the program and re-runs the tests")
    # gives up honestly
    page.evaluate("() => { window.__mock.fakeQueue = ['```python\\nassert 1 == 2\\nprint(\"ALL TESTS PASSED\")\\n```', 'no idea', 'still no idea', 'sorry', 'nope']; }")
    page.fill("[data-testid=code-task]", "something impossible")
    page.click("[data-testid=code-build]")
    page.wait_for_selector("[data-testid=code-badge]:has-text('Not passing yet')", timeout=120000)
    check(page.locator("[data-testid=code-fix]").count() == 1, "if it can't make the tests pass it says so, and offers to keep fixing")
    check(page.locator("text=Your programs").count() == 1 and page.locator("text=passing").count() >= 1, "programs are kept in a list")
    page.screenshot(path=HERE + "/v58-workbench.png", full_page=True)
    ctx.close()

ANSWER = """Here's a quick script:

```python
loads = [12.5, 7.25, 3.0]
print("total:", sum(loads))
```

And a page:

```html
<button id=b>Tap</button><script>document.getElementById('b').onclick=()=>b.textContent='done'</script>
```"""

def sec_chat(br):
    ctx, page = new_page(br, env, errors); offline(ctx)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    install(page)
    page.evaluate("(t) => { window.__mock.fakeQueue = [t]; }", ANSWER)
    comp = page.locator("textarea[placeholder='Message Attune']")
    comp.fill("Show me an example snippet for summing crane loads"); page.locator("button[title='Send']").click()
    page.wait_for_selector("button[title='Regenerate']", timeout=30000)
    check(page.locator("[data-testid=run-code]").count() == 2, "finished code blocks in Chat get a Run / Preview button")
    page.locator("[data-testid=run-code]").first.click()
    page.wait_for_selector("[data-testid=code-output]", timeout=90000)
    check("total: 22.75" in page.locator("[data-testid=code-output]").inner_text(), "▶ Run runs the Python right under the answer")
    page.locator("[data-testid=run-code]").nth(1).click()
    fr = page.frame_locator("[data-testid=code-preview]")
    fr.locator("#b").click(timeout=5000)
    check(fr.locator("#b").inner_text() == "done", "the web page answer opens as a working preview")
    page.locator("[data-testid=open-in-code]").first.click()
    page.wait_for_selector("[data-testid=code-page]", timeout=5000)
    check("sum(loads)" in page.locator("[data-testid=code-editor]").input_value(), "“Test & fix in Code” carries the code over to the workbench")
    page.screenshot(path=HERE + "/v58-chat.png")
    ctx.close()

FUNCS = {"sandbox": sec_sandbox, "workbench": sec_workbench, "chat": sec_chat}
with sync_playwright() as pw:
    br = pw.chromium.launch()
    for s in SECTIONS:
        print(f"--- {s}", flush=True)
        try: FUNCS[s](br)
        except Exception as e: check(False, f"{s} section crashed: {str(e)[:300]}")
    br.close()
env.close()
re_ = [e for e in real_errors(errors) if "undefinedThing" not in e]   # (that one is the test's own broken page)
for e in re_[:20]: print("   ", e)
check(len(re_) == 0, "no JavaScript errors in the page (%d)" % len(re_))
finish()
