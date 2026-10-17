"""v6.32 — web comparisons as side-by-side tables: "Geely Galaxy M9 vs Lynk & Co 900" → under the answer, a head-to-head table
built by code — each figure under the car it belongs to, cited, ✓ when two sites agree, and "Better" by the number.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v736compare.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
HITS = [
  {"title": "Geely Galaxy M9 review", "url": "https://carnewschina.com/galaxy-m9", "text": "The Galaxy M9 is a large PHEV SUV.\nPower: 422 hp\nTorque: 535 Nm\nThe price starts at 193,800 yuan.\n0-100 km/h in 4.8 s."},
  {"title": "Lynk & Co 900 launched", "url": "https://autohome.com/lynk-900", "text": "Lynk & Co 900 gets a 1.5T PHEV.\nPower: 653 hp\nTorque: 828 Nm\nPrice starts at 265,900 yuan.\nAccelerates 0-100 km/h in 4.3 s."},
  {"title": "Galaxy M9 vs Lynk 900: which to buy", "url": "https://x.com/compare", "text": "Spec | Geely Galaxy M9 | Lynk & Co 900\nPower | 422 hp | 653 hp\nBattery | 41.5 kWh | 39.6 kWh\nRange | 1,400 km | 1,350 km"}]
SEARCH = """(() => { const N = window.AttuneNative;
  N.search = (id, arg) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ via: "duckduckgo", why: "", hits: %s })), 30);
})();""" % json.dumps(HITS)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)
    page.evaluate(SEARCH)
    page.locator("button:has-text('Web')").first.click()
    page.evaluate("() => { const M = window.__mock; M.fakeQueue = ['**Quick verdict:** the Lynk & Co 900 is stronger, the Galaxy M9 cheaper [1][2].']; }")
    page.locator("textarea[placeholder='Message Attune']").fill("Geely Galaxy M9 vs Lynk & Co 900")
    page.locator("button[title='Send']").first.click()
    page.wait_for_selector("button[title='Regenerate']", timeout=30000)
    md = page.locator(".att-md").last
    t = md.inner_text()
    check("Head to head" in t, "a head-to-head table under the answer")
    tbl = md.locator("table").filter(has_text="Geely Galaxy M9").first
    hdr = tbl.locator("th").all_inner_texts()
    check(hdr[:4] == ["Spec", "Geely Galaxy M9", "Lynk & Co 900", "Better"], "columns: Spec | each car | Better (%s)" % hdr)
    pw = tbl.locator("tr").filter(has_text="Power").first.locator("td").all_inner_texts()
    check("422 hp" in pw[1] and "653 hp" in pw[2] and pw[3] == "Lynk & Co 900", "power: each car's figure, cited, and which is more (%s)" % pw)
    pr = tbl.locator("tr").filter(has_text="Price").first.locator("td").all_inner_texts()
    check("193,800" in pr[1] and "265,900" in pr[2] and pr[3] == "Geely Galaxy M9", "price: the cheaper one is 'better' (%s)" % pr)
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
