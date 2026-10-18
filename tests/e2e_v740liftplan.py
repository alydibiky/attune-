"""v6.40 (upgrade W2) — Crane toolkit → Lift plan: the lift from the Lift tab + ground, slings and wind → one verdict
(GO / critical / STOP) and a PDF to sign.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v740liftplan.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
INIT = "(function w(){ var N = window.AttuneNative; if (!N) return setTimeout(w, 0); window.__pdf = []; N.htmlToPdf = function (id, arg) { window.__pdf.push(JSON.parse(arg).html); setTimeout(function () { window.__attuneNative.resolve(id, JSON.stringify({ b64: 'JVBERi0x' })); }, 20); }; N.shareFile = function (id, arg) { setTimeout(function () { window.__attuneNative.resolve(id, JSON.stringify({ ok: true })); }, 20); }; })();"
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.goto(env.url); page.wait_for_timeout(1200)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'crane'}}))")
    page.wait_for_selector("[data-testid=crane-toolkit]", timeout=8000)
    page.select_option("[data-testid=lift-crane]", "")
    page.fill("[data-testid=lift-cap]", "30"); page.fill("[data-testid=lift-load]", "18"); page.fill("[data-testid=lift-hook]", "0.8")
    page.click("[data-testid=ctab-plan]")
    page.wait_for_selector("[data-testid=crane-plan]", timeout=4000)
    page.fill("[data-testid=plan-job]", "Beam lift"); page.fill("[data-testid=plan-cranemass]", "48"); page.fill("[data-testid=plan-matl]", "1.2"); page.fill("[data-testid=plan-matw]", "1.2"); page.fill("[data-testid=plan-angle]", "30")
    v = page.locator("[data-testid=plan-verdict]").inner_text()
    check("STOP" in v and "Ground under the outriggers" in v, "a 1.2 m mat on gravel: STOP, and why: %s" % v.replace("\n", " ")[:160])
    page.fill("[data-testid=plan-matl]", "3"); page.fill("[data-testid=plan-matw]", "3")
    v = page.locator("[data-testid=plan-verdict]").inner_text()
    check("GO" in v and "STOP" not in v, "a 3 m mat: GO: %s" % v.replace("\n", " ")[:120])
    page.click("[data-testid=plan-pdf]")
    page.wait_for_function("window.__pdf.length === 1", timeout=5000)
    h = page.evaluate("window.__pdf[0]")
    check("Lift plan" in h and "Beam lift" in h and "signature" in h and "Load chart" in h, "the PDF has the job, every check and the signatures")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
