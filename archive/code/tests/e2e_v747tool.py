"""v6.47 (VISION phase 5: "Attune builds real tools, tests them, keeps them running"): a page the Code workbench makes carries
its own checks (<script type="text/attune-test">: fill the boxes, press the button, compare the result). The phone runs them;
a wrong total is caught, sent back, fixed, and the page is marked tested. The checks never run in the preview (tests/unit/v747tool.test.mjs).
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v747tool.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish

BUGGY = """```html
<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Rental quote</title></head><body>
<h1>Crane rental quote</h1>
<input id="rate" value="0"><input id="days" value="0"><button id="calc">Quote</button><p>Total: <b id="total">0</b></p>
<script>document.getElementById("calc").onclick=function(){var r=+document.getElementById("rate").value,d=+document.getElementById("days").value;document.getElementById("total").textContent=(r+d).toLocaleString("en-US");};</script>
<script type="text/attune-test">fill("#rate","12000");fill("#days","3");click("#calc");assertEqual(text("#total"),36000,"12,000 a day for 3 days");</script>
</body></html>
```"""
FIX = """<<<<<<< SEARCH
(r+d).toLocaleString("en-US")
=======
(r*d).toLocaleString("en-US")
>>>>>>> REPLACE"""

env = Env(); errors = []
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'code'}}))")
    page.wait_for_selector("[data-testid=code-page]", timeout=6000)
    page.evaluate("([a, b]) => { window.__mock.fakeQueue = [a, b]; window.__mock.bodies = []; }", [BUGGY, FIX])
    page.fill("[data-testid=code-task]", "A web page: crane rental quote — daily rate times days")
    page.click("[data-testid=code-build]")
    page.wait_for_selector("[data-testid=code-badge]", timeout=60000)
    steps = page.locator("[data-testid=code-steps]").inner_text()
    bodies = page.evaluate("window.__mock.bodies.filter(b => b.max_tokens > 2)")
    check(len(bodies) == 2 and "12,000 a day for 3 days" in bodies[1]["messages"][-1]["content"] and "expected 36000" in bodies[1]["messages"][-1]["content"],
          "the page's own check caught the wrong total and the failure went back to be fixed")
    check("r*d" in page.locator("[data-testid=code-editor]").input_value(), "the editor shows the fixed page")
    badge = page.locator("[data-testid=code-badge]").inner_text()
    check("1" in badge and ("passed" in badge.lower() or "tested" in badge.lower()), "marked tested: " + badge + " | " + steps.replace("\n", " ")[:200])
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
