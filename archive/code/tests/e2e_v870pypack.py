"""v8.7 (P7): in the Play build, Python for Code downloads the first time it is needed (PyPack.kt, a Play on-demand pack).
Mocked: the phone says Python isn't there, the download reports 50 % then done — then Python starts as before.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v870pypack.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
INIT = """
window.__py = { ready: false, fetched: 0 };
const N = window.AttuneNative;
N.pyPackStatus = () => JSON.stringify({ inApk: false, pack: window.__py.ready, ready: window.__py.ready });
N.pyPackFetch = () => { window.__py.fetched++;
  setTimeout(() => window.dispatchEvent(new CustomEvent('attune-pypack', { detail: { status: 2, pct: 50 } })), 50);
  setTimeout(() => { window.__py.ready = true; window.dispatchEvent(new CustomEvent('attune-pypack', { detail: { status: 4, pct: 100, done: true } })); }, 150); };
if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('attune:resume:v1', JSON.stringify({ mode: 'code', at: Date.now(), hist: [] })); }
"""
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.goto(env.url)
    page.wait_for_selector("[data-testid=py-download]", timeout=15000)
    check("26 MB" in page.locator("[data-testid=py-status]").inner_text(), "Play build, Python not there: 'Python downloads the first time you need it (26 MB)' + Download Python")
    page.click("[data-testid=py-download]")
    page.wait_for_function("() => /ready/.test((document.querySelector('[data-testid=py-status]') || {}).innerText || '')", timeout=90000)
    check(page.evaluate("window.__py.fetched") == 1, "one tap → one download from Google Play")
    check("ready" in page.locator("[data-testid=py-status]").inner_text(), "…then Python starts as before (%s)" % page.locator("[data-testid=py-status]").inner_text())
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
finish()
