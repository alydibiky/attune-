"""v6.41 D6 one trip pack (Travel → Trip): the parts and how many are ready, the country's map in one tap (offline), the flight
numbers, the delay & claim watch (reminders on each flight day).
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v741trippack.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
RADAR = {"items": [{"id": "p1", "kind": "expiry", "doc": "passport", "title": "Passport", "date": "2030-02-10", "status": "active", "created": 1}], "seen": []}
INIT = ("try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:radar:v1',%s);localStorage.setItem('attune:nat','eg')}catch(e){}" % json.dumps(json.dumps(RADAR)) +
        "(function w(){ var N = window.AttuneNative; if (!N) return setTimeout(w, 0); window.__maps = []; window.__mapCalls = [];"
        "N.mapPacks = function () { return JSON.stringify({ packs: window.__maps }); };"
        "N.mapInstall = function (id, arg) { window.__mapCalls.push(JSON.parse(arg)); setTimeout(function () { window.__attuneNative.progress(id, 50, 'tr', '40 / 80 MB'); }, 10);"
        " setTimeout(function () { window.__maps.push({ code: 'tr', installed: true }); window.__attuneNative.resolve(id, JSON.stringify({ code: 'tr' })); }, 60); }; })();")
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'travel'}}))")
    page.wait_for_selector("[data-testid=travel-page]", timeout=5000)
    page.fill("[data-testid=travel-find]", "turk"); page.click("[data-testid=travel-pack-tr]"); page.wait_for_timeout(300)
    page.fill("[data-testid=travel-depart]", "2026-11-01"); page.fill("[data-testid=travel-ret]", "2026-11-08"); page.wait_for_timeout(200)
    page.wait_for_selector("[data-testid=trip-pack]", timeout=3000)
    c0 = page.locator("[data-testid=trip-pack-count]").inner_text()
    check("3 of 6" in c0 or "4 of 6" in c0, "the pack: phrases, money and papers ready; map, flights, watch to do: " + c0)
    page.click("[data-testid=trip-pack-getmap]")
    page.wait_for_function("document.querySelector('[data-testid=trip-pack-map]').innerText.includes('no internet') && !document.querySelector('[data-testid=trip-pack-getmap]')", timeout=5000)
    check(page.evaluate("window.__mapCalls[0]") == {"code": "tr", "routes": True}, "one tap downloads Turkey's map and directions")
    page.fill("[data-testid=trip-pack-flight]", "MS 735 out, TK 690 back"); page.click("[data-testid=trip-pack-add]"); page.wait_for_timeout(150)
    check("MS735, TK690" in page.locator("[data-testid=trip-pack-flights]").inner_text(), "flight numbers kept: " + page.locator("[data-testid=trip-pack-flights]").inner_text())
    page.click("[data-testid=trip-pack-watch-on]"); page.wait_for_timeout(300)
    notes = page.evaluate("window.__mock.notes.filter(n => String(n.id).startsWith('trip-watch-')).map(n => n.id + '|' + n.title)")
    check(len(set(n.split('|')[0] for n in notes)) == 2 and any("MS735" in n for n in notes), "the watch: a reminder on each flight day: %s" % notes)
    check("6 of 6" in page.locator("[data-testid=trip-pack-count]").inner_text(), "all 6 ready: " + page.locator("[data-testid=trip-pack-count]").inner_text())
    ctx.close()
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
