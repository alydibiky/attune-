"""v6.38 (Ali's 18 Oct screenshots of "Solve the questions"): each question is a card with its page and a Copy button;
formulas show as text (μ = ln(4.0)/4 h), not LaTeX; a "Final Answer" written twice is shown once; every calculation is
re-done by code — the doubling time 0.69315/0.34657 = 2, not 1.980 h, is flagged.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v740solve.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
PAGES = ["Bioprocess assignment\n\nQuestion 1. A culture grows from X1 = 0.80 g/L at t = 2 h to X2 = 3.20 g/L at t = 6 h. Calculate the specific growth rate and the doubling time.\n\nQuestion 2. A batch starts with 0.5 g/L biomass and 25 g/L glucose and ends with 10.5 g/L biomass and 5 g/L glucose. Calculate the biomass yield Y(X/S)."]
A1 = r"""**a.** $$\mu = \frac{\ln(3.20 / 0.80)}{6 \text{ h} - 2 \text{ h}}$$
$$\mu = \frac{\ln(4.0)}{4 \text{ h}}$$
$$\mu \approx 0.34657 \text{ h}^{-1}$$

**b.** $$t_d = \frac{0.69315}{0.34657 \text{ h}^{-1}}$$
$$t_d \approx 1.980 \text{ h}$$

**Final Answer:** μ ≈ 0.3466 h⁻¹, t_d ≈ 1.98 h

**Final Answer:** a. μ ≈ 0.3466 h⁻¹ b. t_d ≈ 1.98 h"""
A2 = r"""$$Y_{X/S} = \frac{10.5 \text{ g/L} - 0.5 \text{ g/L}}{25 \text{ g/L} - 5 \text{ g/L}} = \frac{10.0 \text{ g/L}}{20 \text{ g/L}} = 0.5$$

**Final Answer:** Y(X/S) = 0.5 g biomass per g glucose."""
NATIVE = """(() => { const N = window.AttuneNative, S = window.__mock; S.copied = [];
  const R = (id, v) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify(v)), 25);
  N.pdfText = (id) => R(id, { count: 1, pages: %PAGES% });
  N.copy = (t) => { S.copied.push(t); return true; };
})();""".replace("%PAGES%", json.dumps([{"n": 1, "text": PAGES[0], "scan": False}]))
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
    page.set_input_files("[data-testid=pdfchat-file]", files=[{"name": "assignment.pdf", "mimeType": "application/pdf", "buffer": b"%PDF-1.4 test"}])
    page.wait_for_selector("[data-testid=pdfchat]", timeout=8000)
    page.evaluate("(a) => { const M = window.__mock; M.bodies = []; M.fakeQueue = a; }", [A1, A2])
    tab = page.locator("[data-testid=pdf-tab-chat]")
    if tab.count(): tab.first.click()
    page.fill("[data-testid=pdf-input]", "Solve the questions"); page.click("[data-testid=pdf-send]")
    page.wait_for_function("document.querySelectorAll('[data-testid=pdf-solve-card]').length === 2 && document.querySelectorAll('[data-testid=pdf-math-ok], [data-testid=pdf-math-wrong]').length === 2", timeout=20000)
    cards = page.locator("[data-testid=pdf-solve-card]")
    c1, c2 = cards.nth(0).inner_text(), cards.nth(1).inner_text()
    check("Question 1" in c1 and "p. 1" in c1, "one card per question, with its page")
    check("$" not in c1 and "\\frac" not in c1 and "\\text" not in c1 and "μ" in c1 and "ln(4.0)" in c1, "formulas show as text, not LaTeX: %s" % c1[:160].replace("\n", " "))
    check(c1.count("Final Answer") == 1, "a Final Answer written twice is shown once")
    w = cards.nth(0).locator("[data-testid=pdf-math-wrong]").inner_text()
    check("= 2" in w and "1.980" in w, "the slip is caught by code: %s" % w.replace("\n", " "))
    check(cards.nth(1).locator("[data-testid=pdf-math-ok]").count() == 1, "question 2's sums are confirmed")
    cards.nth(1).locator("[data-testid=pdf-copy-one]").click(); page.wait_for_timeout(200)
    cp = page.evaluate("window.__mock.copied[window.__mock.copied.length - 1] || ''")
    check(cp.startswith("Question 2") and "0.5" in cp and "$" not in cp and "**" not in cp, "Copy gives clean text: %s" % cp[:80].replace("\n", " "))
    check(page.locator("[data-testid=pdf-copy]").count() >= 1, "and Copy all for the whole answer")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
