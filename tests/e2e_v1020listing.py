"""v10.2 L1 (Ali OK'd the combined page: "OK-L1" — "it should still redirect me to the right listing because I don't want to open the
product in search and search again by myself"): the kit reads a store's product page (name, price, photo, its own address, rating) and
knows a results page; a tap on an offer shows ITS page in Attune; "Open this listing" checks the offer's page first and opens the
checked address in the phone's browser; a page that is another product is never opened — no search page instead.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v1020listing.py
"""
import json, os, time
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish, HERE
KIT = os.path.join(HERE, "..", "web-src", "agent-kit.js")
PRODUCT = """<html><head><title>Amazon.eg</title><link rel="canonical" href="https://www.amazon.eg/dp/B0DJ7KXK7Q">
<meta property="og:image" content="https://m.media-amazon.com/images/I/freeclip.jpg">
<script type="application/ld+json">{"@type":"Product","name":"HUAWEI FreeClip 2 Open-Ear Earbuds, Dual-Driver, Black","offers":{"@type":"Offer","price":"7400.00","priceCurrency":"EGP","seller":{"name":"Amazon.eg"}},"aggregateRating":{"ratingValue":"4.6","reviewCount":"212"}}</script>
</head><body><h1>HUAWEI FreeClip 2 Open-Ear Earbuds, Dual-Driver, Black</h1><div class=price>EGP 7,400.00</div><p>FREE delivery Thursday, 20 November</p></body></html>"""
RESULTS = "<html><body>" + "".join(f"<div class=card><h3><a href='https://www.amazon.eg/dp/B0DJ7KXK{i}Q'>HUAWEI FreeClip 2 colour {i}</a></h3><div class=price>EGP {7400 + i * 50}</div></div>" for i in range(6)) + "</body></html>"
env = Env(); errors = []
now = int(time.time() * 1000)
best = [{"name": "HUAWEI FreeClip 2", "price": 7400, "currency": "EGP", "site": "Amazon", "href": "", "url": "https://www.amazon.eg/s?k=Huawei%20FreeClip%202", "key": "a"},
        {"name": "HUAWEI FreeClip 2", "price": 7650, "currency": "EGP", "site": "noon", "href": "https://www.noon.com/egypt-en/freeclip-2/N70112233A/p/", "key": "n"}]
agent = {"id": "agl1", "kind": "watch", "title": "Huawei FreeClip 2", "on": True, "created": now - 864e5, "what": "Huawei FreeClip 2", "q": "Huawei FreeClip 2",
         "site": "2 stores", "url": "https://www.amazon.eg/s?k=Huawei%20FreeClip%202", "below": 8000, "currency": "EGP",
         "checks": [{"at": now - 600000, "price": 7400, "how": "auto"}], "best3": best, "stores": 2}
SEED = json.dumps({"agents": [agent], "usual": {}})
# the phone's check: Amazon's offer lands on its product page; noon's lands on ANOTHER product (the first FreeClip)
INIT = """const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0); N.agentWatchPlan = () => 'ok'; N.agentWatchTake = () => '{}'; N.watchSave = () => {}; N.payAccess = () => true;
window.__calls = []; window.__opened = [];
N.openInBrowser = (u) => { window.__opened.push(u); return true; };
N.agentOpen = (id, arg) => { const a = JSON.parse(arg); window.__calls.push(a); let r = { reason: 'done' };
  if (a.resolve && /amazon/.test(a.url)) r = { reason: 'done', opened: 'https://www.amazon.eg/-/en/dp/B0DJ7KXK7Q?ref=sr_1_1', landed: 'https://www.amazon.eg/-/en/dp/B0DJ7KXK7Q?ref=sr_1_1',
    product: { kind: 'product', url: 'https://www.amazon.eg/-/en/dp/B0DJ7KXK7Q?ref=sr_1_1', canonical: 'https://www.amazon.eg/dp/B0DJ7KXK7Q', name: 'HUAWEI FreeClip 2 Open-Ear Earbuds, Dual-Driver, Black', price: 7400, currency: 'EGP', photo: '', rating: 4.6, reviews: 212, seller: 'Amazon.eg', delivery: 'FREE delivery Thursday, 20 November', many: 0 } };
  if (a.resolve && /noon/.test(a.url)) r = { reason: 'done', product: { kind: 'product', url: 'https://www.noon.com/egypt-en/freeclip/N60000001A/p/', name: 'HUAWEI FreeClip Open-Ear Earbuds, Black', price: 5200, currency: 'EGP', many: 0 } };
  setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify(r)), 40); }; }; go();"""
with sync_playwright() as p:
    br = p.chromium.launch()
    # 1. the kit reads a product page, and knows a results page
    pg = br.new_page()
    pg.set_content(PRODUCT); pg.add_script_tag(path=KIT)
    r = pg.evaluate("window.__attuneAgent.product()")
    check(r["name"].startswith("HUAWEI FreeClip 2") and r["price"] == 7400 and r["currency"] == "EGP" and r["canonical"] == "https://www.amazon.eg/dp/B0DJ7KXK7Q"
          and r["rating"] == 4.6 and r["reviews"] == 212 and r["seller"] == "Amazon.eg" and "Thursday" in r["delivery"] and "freeclip.jpg" in r["photo"], "the kit reads the product page: %s" % {k: r[k] for k in ("name", "price", "canonical", "rating", "seller", "delivery")})
    pg.set_content(RESULTS); pg.add_script_tag(path=KIT)
    check(pg.evaluate("window.__attuneAgent.product().many") > 3, "…and a results page says it holds many offers")
    pg.close()
    # 2. the app: the offer's page, then Open → checked → the exact listing in the phone's browser
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_timeout(1200)
    page.evaluate("s => localStorage.setItem('attune:agents:v1', s)", SEED); page.reload(); page.wait_for_timeout(1200)
    page.evaluate("m => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", "agents"); page.wait_for_selector("[data-testid=agent-deal]", timeout=8000)
    page.click("[data-testid=agent-deal-open]"); page.wait_for_selector("[data-testid=offer-page]", timeout=5000)
    t = page.inner_text("[data-testid=offer-page]")
    check("7,400" in t and "Amazon" in t and "under your" in t and page.locator("[data-testid=offer-unverified]").count() == 1, "the offer's own page: price, store, under the limit, not checked yet")
    page.click("[data-testid=offer-open]"); page.wait_for_function("window.__opened.length > 0", timeout=8000)
    calls = page.evaluate("window.__calls")
    check(calls and calls[0].get("resolve") and calls[0].get("goto", {}).get("name") == "HUAWEI FreeClip 2", "Open first checks: Attune's browser finds THAT offer on the results and reads its page")
    check(page.evaluate("window.__opened[0]") == "https://www.amazon.eg/dp/B0DJ7KXK7Q", "…and opens the exact listing (clean, no tracking) in the phone's browser: %s" % page.evaluate("window.__opened[0]"))
    page.wait_for_selector("[data-testid=offer-verified]", timeout=5000)
    v = page.inner_text("[data-testid=offer-page]")
    check("Exact listing saved" in v and "amazon.eg/dp/B0DJ7KXK7Q" in v and "Amazon.eg" in v and "Thursday" in v, "the page now says ✓ Exact listing saved, with the seller and delivery it read")
    page.evaluate("window.__calls = []; window.__opened = []")
    page.click("[data-testid=offer-open]"); page.wait_for_timeout(500)
    check(page.evaluate("window.__calls.length") == 0 and page.evaluate("window.__opened[0]") == "https://www.amazon.eg/dp/B0DJ7KXK7Q", "the next Open goes straight to the saved listing (no second check)")
    # 3. noon: the page it reaches is ANOTHER product → never opened in the browser, never a search page
    page.click("[data-testid=offer-back]"); page.wait_for_selector("[data-testid=agent-deal]")
    page.locator("[data-testid=agent-deal-row]").filter(has_text="noon").first.click(); page.wait_for_selector("[data-testid=offer-page]", timeout=5000)
    page.evaluate("window.__calls = []; window.__opened = []")
    page.click("[data-testid=offer-open]"); page.wait_for_timeout(900)
    calls = page.evaluate("window.__calls")
    check(page.evaluate("window.__opened.length") == 0, "a page that is another product (the first FreeClip) is NOT opened as the offer")
    check(len(calls) == 2 and not calls[1].get("resolve") and "search" not in calls[1].get("url", "") and "search" not in calls[1].get("gotoFallback", ""), "…Attune's browser opens it to tap through itself — no search page: %s" % [c.get("url") for c in calls])
    page.wait_for_timeout(300)
    check(page.locator("[data-testid=offer-verified]").count() == 0, "…and it is not marked as checked")
    check(not real_errors(errors), "no JavaScript errors: %s" % real_errors(errors)[:2])
    ctx.close(); br.close()
env.close(); finish()
