"""v6.41 F3 Family health: tap a lab test → its chart over the years with every value and the change in words; a medicine →
Cheapest price from the web (one price per site, the strength never read as a price).
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v741care.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
CARE = {"members": [{"id": "p1", "name": "Me"}], "taken": {},
        "meds": [{"id": "m1", "member": "p1", "name": "Glucophage", "strength": "500 mg", "dose": "1 tab", "freq": "twice daily", "times": ["09:00", "21:00"], "days": 0, "start": "2026-10-01", "stock": 40, "stockAt": 1}],
        "labs": [{"test": "HbA1c", "value": 6.1, "unit": "%", "low": 4, "high": 5.6, "date": "2023-03-01", "member": "p1", "flag": "high"},
                 {"test": "HbA1c", "value": 6.8, "unit": "%", "low": 4, "high": 5.6, "date": "2024-09-10", "member": "p1", "flag": "high"},
                 {"test": "HbA1c", "value": 5.5, "unit": "%", "low": 4, "high": 5.6, "date": "2026-10-01", "member": "p1", "flag": "in range"}]}
HITS = [{"title": "Glucophage 500mg price in Egypt", "url": "https://chefaa.com/y", "text": "Glucophage 500 mg 50 tablets EGP 48.50"},
        {"title": "سعر جلوكوفاج Glucophage 500", "url": "https://www.vezeeta.com/x", "text": "Glucophage 500 مجم سعره 52 جنيه"}]
INIT = ("try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:care:v1'," + json.dumps(json.dumps(CARE)) + ")}catch(e){}"
        "(function w(){ var N = window.AttuneNative; if (!N) return setTimeout(w, 0); window.__q = [];"
        "N.search = function (id, arg) { window.__q.push(JSON.parse(arg).q); setTimeout(function () { window.__attuneNative.resolve(id, JSON.stringify({ hits: " + json.dumps(HITS) + " })); }, 30); }; })();")
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'care'}}))")
    page.wait_for_selector("[data-testid=care-page]", timeout=5000)
    page.click("[data-testid=care-tab-labs]"); page.click("[data-testid=care-lab]")
    words = page.locator("[data-testid=care-lab-words]").inner_text()
    check("3 results in 3.6 years" in words and "6.1 → 5.5" in words and "-10%" in words and "2 times" in words, "HbA1c over the years: " + words)
    check(page.locator("[data-testid=care-lab-detail] svg circle").count() == 3, "the chart shows each of the 3 results")
    page.click("[data-testid=care-tab-meds]"); page.click("[data-testid=care-price]")
    page.wait_for_selector("[data-testid=care-prices]", timeout=5000)
    t = page.locator("[data-testid=care-prices]").inner_text()
    check(t.index("chefaa.com") < t.index("vezeeta.com") and "48.5" in t and "52" in t and "500" not in t.split("\n")[1], "cheapest first: chefaa 48.5, vezeeta 52: " + t.replace("\n", " | "))
    check("سعر" in page.evaluate("window.__q[0]") and "Glucophage 500 mg" in page.evaluate("window.__q[0]"), "searched with the name, strength and «سعر»")
    ctx.close()
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
