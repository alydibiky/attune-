"""v6.32 — Code look B, "talk to a coder" (Ali picked B): a start screen with "What should I build?" and starters; then your
ask as a bubble, each step with a mark, the code in a card (first lines, tap to open), Run / Copy / Save, and a box at the
bottom to ask for a change — which shows as the next bubble with its own steps.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v736coder.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
SHOT = "/tmp/v736coder.png"
GOOD = """```python
def capacity_at(chart, r):
    pts = sorted(chart.items())
    for (r1, c1), (r2, c2) in zip(pts, pts[1:]):
        if r1 <= r <= r2:
            return c1 if r == r1 else (c2 if r == r2 else min(c1, c2))
    raise ValueError("radius outside the chart")

chart = {3: 60.0, 5: 42.0, 10: 20.0}
print(capacity_at(chart, 7))
# --- tests ---
assert capacity_at(chart, 3) == 60.0
assert capacity_at(chart, 7) == 20.0
print("ALL TESTS PASSED")
```"""
EDIT = """<<<<<<< SEARCH
print(capacity_at(chart, 7))
=======
print(capacity_at(chart, 7))
print("at 4 m:", capacity_at(chart, 4))
>>>>>>> REPLACE"""
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'code'}}))"); page.wait_for_selector("[data-testid=code-page]", timeout=5000)
    t = page.locator("[data-testid=code-page]").inner_text()
    check("What should I build?" in t and page.locator("[data-testid=code-starters] button").count() == 4, "a start screen with four starters")
    page.locator("[data-testid=code-starters] button").first.click()
    check("load chart" in page.locator("[data-testid=code-task]").input_value(), "a starter fills in the ask")
    page.wait_for_function("document.querySelector('[data-testid=py-status]').innerText.includes('ready')", timeout=90000)
    page.evaluate("(a) => { window.__mock.fakeQueue = a; }", [GOOD])
    page.click("[data-testid=code-build]")
    page.wait_for_selector("[data-testid=code-badge]", timeout=120000)
    check(page.locator("[data-testid=code-ask]").count() == 1 and "load chart" in page.locator("[data-testid=code-ask]").inner_text(), "your ask shows as a bubble")
    check(page.locator("[data-testid=code-step]").count() >= 3 and "Passed all 2 tests" in page.locator("[data-testid=code-steps]").inner_text(), "each step shows, ending in the passed tests")
    check(not page.locator("[data-testid=code-editor]").is_visible() and "def capacity_at" in page.locator("[data-testid=code-page]").inner_text(), "the code sits in a card: first lines shown, the editor folded")
    page.click("[data-testid=code-view-code]")
    check(page.locator("[data-testid=code-editor]").is_visible(), "Show code opens the editor")
    page.click("[data-testid=code-view-code]")
    page.evaluate("(a) => { window.__mock.fakeQueue = a; }", [EDIT])
    page.fill("[data-testid=code-change]", "also print the capacity at 4 m")
    page.click("[data-testid=code-change-go]")
    page.wait_for_function("document.querySelector('[data-testid=code-output]') && document.querySelector('[data-testid=code-output]').innerText.includes('at 4 m')", timeout=60000)
    asks = page.locator("[data-testid=code-ask]").all_inner_texts()
    check(len(asks) == 2 and "at 4 m" in asks[1], "the change is the next bubble in the conversation (%s)" % asks)
    page.wait_for_timeout(300)
    page.evaluate("window.scrollTo(0, 0)"); page.wait_for_timeout(200); page.screenshot(path=SHOT)
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
finish()
