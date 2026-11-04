"""v8.0 — Ali's 25 Oct list: Studio is paused in the phone app (no list, hub or "/" shows it; its page says so; the engine call is
refused); Fit's Huawei tile shows the real way to connect (and is ticked only when Huawei data has arrived); Yusr's "Tabs to show"
checkboxes show their tick.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v1000fixes.py     (SHOTS=dir for screenshots)
"""
import json, os
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
def shot(page, name):
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, name + ".png"), full_page=True)
PROFILE = json.dumps({"profile": {"sex": "m", "age": 21, "cm": 178, "kg": 92, "activity": "light", "goal": "lose", "rate": 0.5, "goalKg": 80, "diet": "balanced"}, "days": {}, "weights": [], "fast": None, "myRecipes": [], "favs": []})
INIT = ("try{localStorage.setItem('attune:studio:try','0');if(!localStorage.getItem('attune:fit:v1'))localStorage.setItem('attune:fit:v1', %s)}catch(e){}"
        "const N=window.AttuneNative;N.healthStatus=()=>JSON.stringify({available:'ready',granted:5,huawei:true,healthSync:false});"
        "N.watchAppsInstalled=()=>'[\"com.huawei.health\"]';N.healthConnect=()=>{};N.openHealthApp=(p)=>{window.__opened=(window.__opened||[]).concat(p)};"
        "N.healthDay=(id)=>window.__attuneNative.resolve(id,JSON.stringify({steps:null}));") % json.dumps(PROFILE)
def go(page, mode, sel):
    page.evaluate("m => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", mode); page.wait_for_selector(sel, timeout=8000); page.wait_for_timeout(300)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_timeout(1200)
    # (v9.1: this section used Studio — archived with it in archive/studio/tests/mixed/e2e_v1000fixes.py)
    # (v9.1: this section used Fit & Food — archived with it in archive/fit/tests/mixed/e2e_v1000fixes.py)
    # ---- Money settings (v8.0: Attune's own, never the old ledger): Tabs to show ----
    go(page, "money", "[data-testid=money-more]")
    page.click("[data-testid=money-more]"); page.click("[data-testid=money-more-settings]"); page.wait_for_selector("[data-testid=money-settings]", timeout=5000)
    check(page.locator("[data-testid=money-yusr]").is_hidden(), "Money settings are Attune's own page (the old ledger stays hidden)")
    box = page.locator("[data-testid=set-tab-show-goals]")
    box.scroll_into_view_if_needed()
    look = box.evaluate("e => { const c = getComputedStyle(e); return [c.appearance || c.webkitAppearance, Math.round(e.getBoundingClientRect().width), e.checked]; }")
    check(look[0] != "none" and look[1] <= 26 and look[2], "Tabs to show: a real checkbox with its tick: %s" % look)
    labels = page.locator("[data-testid=set-tabs] span").all_inner_texts()
    check("Bills" in labels and "Notes" not in labels and "Home" not in labels, "Tabs to show lists Money's tabs with their names (no Notes; Home is always first): %s" % labels)
    page.click("[data-testid=set-tab-show-accounts]"); page.wait_for_timeout(900)
    bar = [x.get_attribute("data-testid") for x in page.locator("[data-testid^=money-bar-]").all()]
    check("money-bar-goals" in bar and "money-bar-accounts" not in bar and "money-bar-trends" in bar, "once Tabs to show is changed, Money's bar follows it (Accounts off): %s" % bar)
    page.click("[data-testid=set-tab-up-zakat]"); page.wait_for_timeout(900)
    bar2 = [x.get_attribute("data-testid")[10:] for x in page.locator("[data-testid^=money-bar-]").all()]
    order = page.evaluate("JSON.parse(localStorage.getItem('ledger.v3')).ui.tabOrder")
    check(bar2.index("zakat") < bar2.index("bills"), "▲ moves Zakāt before Bills on the bar too: %s (order %s)" % (bar2, order))
    shot(page, "v1000-yusr-tabs")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
finish()
