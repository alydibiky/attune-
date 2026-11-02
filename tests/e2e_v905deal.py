"""v9.0 (Ali picked "A and B in a smart way"): an agent's results — the best deal big (the cheapest real store, how far under the
limit, Open the listing → that exact listing), a cheaper Facebook post as "check the seller first", and every store as a bar
against the limit line, each opening its own listing. Arabic too.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v905deal.py     (SHOTS=dir for screenshots)
"""
import json, os, time
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
def shot(page, name):
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, name + ".png"), full_page=True)
now = int(time.time() * 1000)
best = [{"name": "HUAWEI FreeClip 2 Open-Ear, Black", "price": 7800, "site": "facebook.com", "web": True, "href": "https://www.facebook.com/groups/1/posts/2", "key": "fb"},
        {"name": "HUAWEI FreeClip 2 Open-Ear, Black", "price": 7950, "site": "Jumia", "href": "https://www.jumia.com.eg/huawei-freeclip-2.html", "key": "j"},
        {"name": "HUAWEI FreeClip 2", "price": 8250, "site": "Amazon", "href": "https://www.amazon.eg/dp/B0XYZ", "key": "a"},
        {"name": "HUAWEI FreeClip 2", "price": 8300, "site": "noon", "href": "https://www.noon.com/egypt-en/p/1", "key": "n"},
        {"name": "HUAWEI FreeClip 2", "price": 8899, "site": "2B", "href": "https://2b.com.eg/freeclip-2", "key": "b"}]
agent = {"id": "agx1", "kind": "watch", "title": "سماعة هواوي فري كليب 2 · Amazon, noon, Jumia…", "on": True, "created": now - 864e5 * 9, "what": "Huawei FreeClip 2", "said": "سماعة هواوي فري كليب 2", "q": "Huawei FreeClip 2 earbuds",
         "site": "6 stores", "url": "https://www.amazon.eg/s?k=Huawei%20FreeClip%202", "below": 8400, "currency": "EGP", "tries": [{"url": "https://www.amazon.eg/s?k=x", "site": "Amazon"}, {"url": "https://www.noon.com/egypt-en/search/?q=x", "site": "noon"}],
         "checks": [{"at": now - 864e5 * (8 - i), "price": p, "how": "auto"} for i, p in enumerate([8490, 8450, 8399, 8300, 8250, 8100, 8000, 7950])], "best3": best, "stores": 7}
INIT = """const N = window.AttuneNative; N.agentWatchPlan = () => 'ok'; N.agentWatchTake = () => '{}'; N.watchSave = () => {}; N.payAccess = () => true;
N.agentOpen = (id, arg) => { window.__agentOpen = JSON.parse(arg); setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({reason: 'done'})), 30); };"""
follow = {"id": "agf1", "kind": "follow", "title": "Follow · solar panels", "on": True, "created": now, "topic": "solar panels in Egypt", "every": "week", "next": now + 864e5 * 7, "runs": [now - 3600e3], "checks": []}
SEED = json.dumps({"agents": [follow, agent], "usual": {}})
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_timeout(1200)
    page.evaluate("s => localStorage.setItem('attune:agents:v1', s)", SEED); page.reload(); page.wait_for_timeout(1200)
    page.evaluate("m => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", "agents"); page.wait_for_selector("[data-testid=agent-deal]", timeout=8000); page.wait_for_timeout(300)
    tabs = page.locator("[data-testid=agents-tab]")
    check(tabs.count() == 2 and page.locator("[data-testid=agent-follow]").count() == 0, "each running agent is its own tab; only the open one shows (the one with a find opens first)")
    hero = page.locator("[data-testid=agent-deal-best]").inner_text()
    check("Jumia" in hero and "7,950" in hero and "450" in hero, "the best deal is the cheapest real store, Jumia 7,950, 450 under the limit: " + hero.replace("\n", " · ")[:160])
    check("check the seller" in page.locator("[data-testid=agent-deal-cheaper]").inner_text(), "the cheaper Facebook post says check the seller first")
    check(page.locator("[data-testid=agent-deal-row]").count() == 5, "five stores as bars")
    check("Huawei FreeClip 2 earbuds" in page.locator("[data-testid=agent-searching-as]").inner_text(), "his Arabic name kept; the stores searched in English")
    shot(page, "v905-deal-en")
    page.click("[data-testid=agent-deal-open]"); page.wait_for_timeout(200)
    check((page.evaluate("window.__agentOpen") or {}).get("url") == "https://www.jumia.com.eg/huawei-freeclip-2.html", "Open the listing opens THAT listing, not a search page")
    page.locator("[data-testid=agent-deal-row]").nth(2).click(); page.wait_for_timeout(200)
    check((page.evaluate("window.__agentOpen") or {}).get("url") == "https://www.amazon.eg/dp/B0XYZ", "a bar opens its own store's listing")
    tabs.nth(0).click(); page.wait_for_timeout(200)
    check(page.locator("[data-testid=agent-follow]").count() == 1 and page.locator("[data-testid=agent-deal]").count() == 0, "tapping the other tab shows that agent instead")
    shot(page, "v905-tabs")
    tabs.nth(1).click(); page.wait_for_timeout(200)
    # Arabic
    page.evaluate("() => { localStorage.setItem('attune:ui:lang', 'ar'); }"); page.reload(); page.wait_for_timeout(1200)
    page.evaluate("m => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", "agents"); page.wait_for_selector("[data-testid=agent-deal]", timeout=8000); page.wait_for_timeout(300)
    check("أحسن عرض دلوقتي" in page.locator("[data-testid=agent-deal-best]").inner_text(), "Egyptian Arabic: «أحسن عرض دلوقتي»")
    shot(page, "v905-deal-ar")
    br.close()
finish()
