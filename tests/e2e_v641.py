"""v6.4.1 — Huawei watches: a phone with Huawei Health shows the Health Sync steps by itself; the
buttons open Health Sync / Huawei Health (and nothing else); once data arrives through Health Sync
the card says so and the steps go away. A phone without Huawei Health only shows a "Huawei watch?" link.

  python3 tests/e2e_v641.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish

env = Env(); errors = []
STATE = {"profile": {"sex": "m", "age": 21, "cm": 178, "kg": 92, "activity": "light", "goal": "lose", "rate": 0.5, "goalKg": 80, "diet": "balanced"}, "days": {}, "weights": [], "fast": None, "myRecipes": [], "favs": []}
def init(huawei):
    return "try { if (!localStorage.getItem('attune:fit:v1')) localStorage.setItem('attune:fit:v1', %s); } catch (e) {}" % json.dumps(json.dumps(STATE)) + r"""
(() => { const S = window.__mock = window.__mock || {}; S.opened = []; S.hc = { available: "ready", granted: 0, of: 6, huawei: HUAWEI, healthSync: false };
  const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0);
    N.healthStatus = () => JSON.stringify(S.hc);
    N.openHealthApp = (p) => { S.opened.push(p); if (p === "nl.appyhapps.healthsync") S.hc = { ...S.hc, healthSync: true }; };
    N.healthConnect = () => { S.hc = { ...S.hc, granted: 6 }; setTimeout(() => window.dispatchEvent(new CustomEvent("attune-health-permission", { detail: { granted: 6 } })), 30); };
    N.healthDay = (id, arg) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ available: "ready", steps: 10230, activeKcal: 412, totalKcal: 2600, distanceM: 7400,
      workouts: [], sources: HUAWEI ? ["nl.appyhapps.healthsync"] : ["com.sec.android.app.shealth"] })), 20);
  }; go(); })();""".replace("HUAWEI", "true" if huawei else "false")

def open_fit(page):
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('Fit & Food')").first.click()
    page.wait_for_selector("[data-testid=fit-today]", timeout=6000)

with sync_playwright() as p:
    br = p.chromium.launch()
    # ---- a phone with Huawei Health ----
    ctx, page = new_page(br, env, errors, extra_init=init(True))
    open_fit(page)
    g = page.locator("[data-testid=fit-huawei]")
    check(g.count() == 1 and "Health Sync" in g.inner_text(), "Huawei Health on the phone → the Health Sync steps show by themselves")
    check("Huawei ID" in g.inner_text() and "Health Connect" in g.inner_text(), "the steps say what to pick: Huawei Health → Health Connect")
    page.locator("[data-testid=fit-huawei-open-0]").click(); page.wait_for_timeout(100)
    page.locator("[data-testid=fit-huawei-app]").click(); page.wait_for_timeout(100)
    check(page.evaluate("window.__mock.opened") == ["nl.appyhapps.healthsync", "com.huawei.health"], "the buttons open Health Sync and Huawei Health")
    page.locator("[data-testid=fit-watch-connect]").click()
    page.wait_for_selector("[data-testid=fit-steps]", timeout=6000)
    check(page.locator("[data-testid=fit-steps]").inner_text() == "10,230", "after connecting: the Huawei watch's 10,230 steps arrive")
    page.locator("[data-testid=fit-tab-move]").click(); page.wait_for_timeout(200)
    w = page.locator("[data-testid=fit-watch]").inner_text()
    check("Huawei Health, through Health Sync" in w and page.locator("[data-testid=fit-huawei]").count() == 0, "the card says where it comes from, and the setup steps are gone")
    check(not real_errors(errors), "no errors (%s)" % real_errors(errors)[:3])
    ctx.close()
    # ---- a phone without it ----
    errors2 = []
    ctx, page = new_page(br, env, errors2, extra_init=init(False))
    open_fit(page)
    check(page.locator("[data-testid=fit-huawei]").count() == 0 and page.locator("[data-testid=fit-huawei-link]").count() == 1, "no Huawei Health → only a small “Huawei watch?” link")
    page.locator("[data-testid=fit-huawei-link]").click(); page.wait_for_timeout(100)
    check(page.locator("[data-testid=fit-huawei]").count() == 1, "…which opens the same steps")
    check(not real_errors(errors2), "no errors (%s)" % real_errors(errors2)[:3])
    ctx.close(); br.close()
env.close()
finish()
