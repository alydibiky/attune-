"""v6.5 — Huawei Health directly (Health Kit, like Yazio): with Attune's Huawei App ID set, a phone with
Huawei Health gets "Connect Huawei Health"; Huawei's screens are opened; after "allowed" the day's
steps / calories / distance / heart rate come from Huawei; with Health Connect too, the numbers are the
larger of the two, never the sum; a refusal says what to do; no HMS Core → the button installs it.

  python3 tests/e2e_v65.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish

env = Env()
STATE = {"profile": {"sex": "m", "age": 21, "cm": 178, "kg": 92, "activity": "light", "goal": "lose", "rate": 0.5, "goalKg": 80, "diet": "balanced"}, "days": {}, "weights": [], "fast": None, "myRecipes": [], "favs": []}
def init(hms=True, hc_granted=0, allow=True):
    return "try { if (!localStorage.getItem('attune:fit:v1')) localStorage.setItem('attune:fit:v1', %s); } catch (e) {}" % json.dumps(json.dumps(STATE)) + r"""
(() => { const S = window.__mock = window.__mock || {}; S.opened = []; S.asked = 0;
  S.hc = { available: "ready", granted: HCG, of: 6, huawei: true, healthSync: false };
  S.hw = { configured: true, hms: HMS, app: true, authorized: false };
  const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0);
    N.healthStatus = () => JSON.stringify(S.hc);
    N.huaweiStatus = () => JSON.stringify(S.hw);
    N.openHealthApp = (p) => { S.opened.push(p); };
    N.huaweiConnect = () => { S.asked++; const ok = ALLOW; if (ok) S.hw = { ...S.hw, authorized: true };
      setTimeout(() => window.dispatchEvent(new CustomEvent("attune-health-permission", { detail: { huawei: ok } })), 30); };
    N.healthConnect = () => {};
    N.healthDay = (id) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ available: "ready", steps: 7000, activeKcal: 500, distanceM: 4000, workouts: [{ title: "Gym", minutes: 40 }], sources: ["com.sec.android.app.shealth"] })), 20);
    N.huaweiDay = (id) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ available: "ready", via: "huawei", steps: 9120, activeKcal: 388, distanceM: 6300, hrAvg: 74, hrMax: 139, workouts: [], sources: ["com.huawei.health"] })), 20);
  }; go(); })();""".replace("HCG", str(hc_granted)).replace("HMS", "true" if hms else "false").replace("ALLOW", "true" if allow else "false")

def open_fit(page):
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('Fit & Food')").first.click()
    page.wait_for_selector("[data-testid=fit-today]", timeout=6000)

with sync_playwright() as p:
    br = p.chromium.launch()
    # ---- 1. Huawei only ----
    errors = []; ctx, page = new_page(br, env, errors, extra_init=init())
    open_fit(page)
    check(page.locator("[data-testid=fit-huawei-direct]").count() == 1, "with Attune's Huawei App ID, a Huawei Health phone gets the direct link")
    check(page.locator("[data-testid=fit-huawei]").count() == 0, "…and not the Health Sync workaround")
    page.locator("[data-testid=fit-huawei-connect]").click()
    page.wait_for_selector("[data-testid=fit-steps]", timeout=6000)
    check(page.evaluate("window.__mock.asked") == 1, "Connect opens Huawei's sign-in / permission screens")
    check(page.locator("[data-testid=fit-steps]").inner_text() == "9,120" and page.locator("[data-testid=fit-watch-kcal]").inner_text() == "388", "after allowing: 9,120 steps and 388 kcal from Huawei Health")
    page.locator("[data-testid=fit-tab-move]").click(); page.wait_for_timeout(200)
    w = page.locator("[data-testid=fit-watch]").inner_text()
    check("Huawei Health ✓" in w and "74" in w and "6.3" in w, "Move: Huawei Health ✓, heart rate 74 avg, 6.3 km")
    check(page.locator("[data-testid=fit-huawei-direct]").count() == 0, "the connect box goes away once connected")
    check(not real_errors(errors), "no errors (%s)" % real_errors(errors)[:3])
    ctx.close()
    # ---- 2. Huawei + Health Connect: never counted twice ----
    errors = []; ctx, page = new_page(br, env, errors, extra_init=init(hc_granted=6))
    open_fit(page)
    page.locator("[data-testid=fit-huawei-connect]").click()
    page.wait_for_timeout(600)
    saved = page.evaluate("(() => { const s = JSON.parse(localStorage.getItem('attune:fit:v1')); return Object.values(s.days).find(d => d.watch).watch; })()")
    check([saved["steps"], saved["activeKcal"], saved["distanceM"]] == [9120, 500, 6300], "two sources: each number is the larger (9,120 steps · 500 kcal · 6.3 km), not the sum — %s" % [saved["steps"], saved["activeKcal"], saved["distanceM"]])
    check(sorted(saved["sources"]) == ["com.huawei.health", "com.sec.android.app.shealth"] and len(saved["workouts"]) == 1, "both sources listed; the workout kept once")
    check(not real_errors(errors), "no errors (%s)" % real_errors(errors)[:3])
    ctx.close()
    # ---- 3. refused / no HMS Core ----
    errors = []; ctx, page = new_page(br, env, errors, extra_init=init(allow=False))
    open_fit(page)
    page.locator("[data-testid=fit-huawei-connect]").click(); page.wait_for_timeout(300)
    check("allow steps" in page.locator("[data-testid=fit-watch-note]").inner_text(), "not allowed → it says to tap Connect again and allow")
    ctx.close()
    ctx, page = new_page(br, env, errors, extra_init=init(hms=False))
    open_fit(page)
    check(page.locator("[data-testid=fit-huawei-connect]").count() == 0 and page.locator("[data-testid=fit-huawei-hms]").count() == 1, "no HMS Core → the button installs it first")
    page.locator("[data-testid=fit-huawei-hms]").click(); page.wait_for_timeout(100)
    check(page.evaluate("window.__mock.opened") == ["com.huawei.hwid"], "…opening HMS Core's store page")
    check(not real_errors(errors), "no errors (%s)" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
