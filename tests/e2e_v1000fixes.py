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
    # ---- Studio is paused on the phone ----
    go(page, "studio", "[data-testid=studio-page]")
    check(page.locator("[data-testid=studio-paused]").count() == 1, "Studio on a phone: its page says it is paused (no engine is started)")
    err = page.evaluate("() => window.__attuneNativeCall('imagine', {prompt: 'x'}).then(() => 'ran', (e) => e.message)")
    check("paused" in err, "the picture engine call is refused: " + err)
    go(page, "tools", "[data-testid=tools-families]")
    check(page.locator("[data-testid=tools-page-studio]").count() == 0 and page.locator("[data-testid=tools-page-convert]").count() == 1, "the Tools hub has no Studio card (the others stay)")
    shot(page, "v1000-studio-paused")
    # ---- Huawei: the real way in ----
    go(page, "fit", "[data-testid=fit-today]")
    page.click("[data-testid=fit-tab-me]"); page.wait_for_selector("[data-testid=fit-autotrack]", timeout=5000)
    hw = page.locator("[data-testid=fit-autotrack-huawei]")
    check("✓" not in page.locator("button[data-testid=fit-autotrack-huawei]").inner_text(), "Huawei Health installed but no Huawei data yet → the tile is not ticked")
    page.click("button[data-testid=fit-autotrack-huawei]")
    page.wait_for_selector("[data-testid=fit-autotrack-huawei-state]")
    st = page.locator("[data-testid=fit-autotrack-huawei-state]").inner_text()
    check("Not connected" in st and page.locator("[data-testid=fit-autotrack-sheet] [data-testid=fit-huawei]").count() == 1, "its card says it is not connected yet and shows the Health Sync steps: " + st[:60])
    page.click("[data-testid=fit-huawei-open-0]")
    check(page.evaluate("window.__opened") == ["nl.appyhapps.healthsync"], "step 1 opens Health Sync (Play Store when missing)")
    shot(page, "v1000-huawei")
    # with Huawei data in a day (through Health Sync) it is ticked and says when the last data came
    page.evaluate("""() => { const k = 'attune:fit:v1', s = JSON.parse(localStorage.getItem(k)); s.days['2026-10-24'] = { meals: {}, water: 0, workouts: [], watch: { steps: 5000, sources: ['nl.appyhapps.healthsync'] } }; localStorage.setItem(k, JSON.stringify(s)); }""")
    page.reload(); page.wait_for_timeout(1200)
    go(page, "fit", "[data-testid=fit-today]")
    page.click("[data-testid=fit-tab-me]"); page.wait_for_selector("[data-testid=fit-autotrack]", timeout=5000)
    page.click("button[data-testid=fit-autotrack-huawei]"); page.wait_for_selector("[data-testid=fit-autotrack-huawei-state]")
    check("2026-10-24" in page.locator("[data-testid=fit-autotrack-huawei-state]").inner_text() and "✓" in page.locator("button[data-testid=fit-autotrack-huawei]").inner_text(), "Huawei data arrived → ticked, with the day it last came")
    # ---- Yusr settings: the Show checkboxes ----
    go(page, "money", "[data-testid=money-more]")
    page.click("[data-testid=money-more]"); page.click("[data-testid=money-more-settings]"); page.wait_for_timeout(1200)
    fr = page.frame_locator("[data-testid=money-yusr]")
    box = fr.locator("#tabs-row input[type=checkbox]").first
    box.scroll_into_view_if_needed()
    look = box.evaluate("e => { const c = getComputedStyle(e); return [c.appearance || c.webkitAppearance, Math.round(e.getBoundingClientRect().width), e.checked]; }")
    check(look[0] != "none" and look[1] <= 26 and look[2], "Tabs to show: a real checkbox with its tick (not an empty 48-px box): %s" % look)
    labels = fr.locator("#tabs-row .tablabel").all_inner_texts()
    check("bills" not in labels and "Bills" in labels and "Notes" not in labels, "Tabs to show lists Money's tabs with their names (Bills, not “bills”; no Notes): %s" % labels)
    fr.locator("#tabs-row .taborow:has-text('Goals') input").evaluate("e => e.click()"); page.wait_for_timeout(800)
    bar = [x.get_attribute("data-testid") for x in page.locator("[data-testid^=money-bar-]").all()]
    check("money-bar-goals" in bar and "money-bar-accounts" not in bar and "money-bar-trends" in bar, "once Tabs to show is changed, Money's bar follows it (Goals switched on, Accounts off): %s" % bar)
    fr.locator("#tabs-row .taborow:has-text('Zakat') .tabmove").first.evaluate("e => e.click()"); page.wait_for_timeout(800)
    bar2 = [x.get_attribute("data-testid")[10:] for x in page.locator("[data-testid^=money-bar-]").all()]
    order = page.evaluate("JSON.parse(localStorage.getItem('ledger.v3')).ui.tabOrder")
    check(bar2.index("zakat") < bar2.index("bills"), "▲ moves Zakāt before Bills on the bar too: %s (order %s)" % (bar2, order))
    shot(page, "v1000-yusr-tabs")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
finish()
