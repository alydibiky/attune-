"""v6.4 — the real paths: the engine log is copied and sent with its header; a typed meal is corrected
once (another food, another portion) and read that way the next time by itself; a food is starred and
logged again from Favorites with one tap.

  python3 tests/e2e_v64.py
"""
import os, json, re
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish

env = Env(); errors = []
STATE = {"profile": {"sex": "m", "age": 21, "cm": 178, "kg": 92, "activity": "light", "goal": "lose", "rate": 0.5, "goalKg": 80, "diet": "balanced"}, "days": {}, "weights": [], "fast": None, "myRecipes": [], "favs": [], "watchSkip": True}
INIT = "try { if (!localStorage.getItem('attune:fit:v1')) localStorage.setItem('attune:fit:v1', %s); } catch (e) {}" % json.dumps(json.dumps(STATE)) + r"""
(() => { const S = window.__mock = window.__mock || {};
  try { Object.defineProperty(navigator, "clipboard", { value: { writeText: (t) => { S.copied = t; return Promise.resolve(); } }, configurable: true }); } catch (e) {}
  const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0);
    N.log = () => "12:01:07 engine: loaded gemma in 14.2 s\n12:01:09 engine: 38 tok/s";
    N.share = (t) => { S.shared = t; };
  }; go(); })();"""

def items(page): return page.locator("[data-testid=fit-draft-item]")
def draft(page): return [(items(page).nth(i).inner_text(), page.locator("[data-testid=fit-draft-grams]").nth(i).input_value()) for i in range(items(page).count())]

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)

    # ---- 1. the engine log: shown with a header, copied, sent ----
    page.locator("button:has-text('Engine log')").first.click()
    page.wait_for_selector("[data-testid=engine-log]", timeout=4000)
    log = page.locator("[data-testid=engine-log]").inner_text()
    check(re.match(r"Attune \d+\.\d+", log) and "38 tok/s" in log, "the log shows the app version first, then the engine's lines")
    check(page.locator("[data-testid=engine-log]").evaluate("e => getComputedStyle(e).userSelect") in ("text", "auto"), "the log text can be selected by hand too")
    page.locator("[data-testid=engine-log-copy]").click(); page.wait_for_timeout(200)
    copied = page.evaluate("window.__mock.copied || ''")
    check(re.match(r"Attune \d+\.\d+", copied) and "loaded gemma" in copied, "Copy log puts the whole log, header included, on the clipboard")
    check(page.locator("text=Log copied").count() > 0, "…and says so")
    page.locator("[data-testid=engine-log-share]").click(); page.wait_for_timeout(100)
    check("38 tok/s" in page.evaluate("window.__mock.shared || ''"), "Send log hands the same text to the phone's share sheet")

    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(250)
    # (v9.1: the typed-meal corrections below used Fit & Food — archived in archive/fit/tests/mixed/e2e_v64.py)
    errs = real_errors(errors)
    check(not errs, "no JavaScript errors in the page (%d)%s" % (len(errs), (": " + errs[0]) if errs else ""))
    ctx.close(); br.close()
env.close()
finish()
