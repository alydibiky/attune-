"""v10.0.2 (Ali, 16 Nov 2026: "agents still does not open to the specific listing so fix it for good") — the page reader
(web-src/agent-kit.js) on fake store results: each offer's link is ITS product page — never the brand's shop, the seller, the
category or the "sponsored" link that comes first in the card; Jumia / B.TECH style pages are known; a shop whose links say nothing
gives the link that carries the product's name; goTo finds the asked offer by its name and goes into its page.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v1002listing.py
"""
import os
from playwright.sync_api import sync_playwright
from harness import check, finish, HERE
KIT = os.path.join(HERE, "..", "web-src", "agent-kit.js")
def card(brand, seller, prod, name, price, extra=""):
    return f"""<div class=card><a href="{brand}">Huawei Official Store</a> <a href="{extra or brand}"><span>Sponsored</span></a>
<a href="{prod}"><img src="https://img.example.com/p.jpg" width=120 height=120></a> <h3><a href="{prod}">{name}</a></h3>
<div class=price>EGP {price}</div> <a href="{seller}">Sold by Tech Zone</a></div>"""
JUMIA = "<html><body>" + card("https://www.jumia.com.eg/mlp-huawei-official-store/", "https://www.jumia.com.eg/seller/tech-zone/", "https://www.jumia.com.eg/huawei-freeclip-2-black-98765432.html", "Huawei FreeClip 2 Wireless Earbuds Black", "7,400") \
    + card("https://www.jumia.com.eg/mlp-huawei-official-store/", "https://www.jumia.com.eg/seller/sound-hub/", "https://www.jumia.com.eg/huawei-freebuds-6i-white-11223344.html", "Huawei FreeBuds 6i White", "3,900") + "</body></html>"
BTECH = "<html><body>" + card("https://btech.com/en/brands/huawei", "https://btech.com/en/moblies/audio.html", "https://btech.com/en/huawei-freeclip-2-black.html", "Huawei FreeClip 2 Black", "7,650") + "</body></html>"
# a shop whose product links have no known shape: the brand link comes first, the product link carries the name
ODD = "<html><body>" + card("https://shop.example.com/makers/huawei-official", "https://shop.example.com/vendors/tech-zone-egypt", "https://shop.example.com/view/freeclip2black", "Huawei FreeClip 2 Black", "7,500") \
    + card("https://shop.example.com/makers/anker-official", "https://shop.example.com/vendors/sound-hub-egypt", "https://shop.example.com/view/liberty4ncblue", "Anker Soundcore Liberty 4 NC", "4,200") + "</body></html>"
with sync_playwright() as p:
    br = p.chromium.launch(); page = br.new_page()
    def top(html):
        page.set_content(html); page.add_script_tag(path=KIT)
        return page.evaluate("window.__attuneAgent.best({cheapest:true, many:true}).top.map(o => [o.name, o.href, o.price])")
    t = top(JUMIA)
    check(len(t) == 2 and all(h.endswith(".html") and "mlp-" not in h and "/seller/" not in h for _, h, _ in t), "Jumia: each offer's link is its product page (not the brand's shop / the seller): %s" % [h for _, h, _ in t])
    check(any("98765432" in h and "FreeClip 2" in n for n, h, _ in t), "…the FreeClip 2 card carries the FreeClip 2 page")
    t = top(BTECH)
    check(len(t) == 1 and t[0][1] == "https://btech.com/en/huawei-freeclip-2-black.html", "B.TECH: the product page, not /brands/ or the category: %s" % t)
    t = top(ODD)
    check([h for _, h, _ in t] == ["https://shop.example.com/view/liberty4ncblue", "https://shop.example.com/view/freeclip2black"], "an unknown shop: the link that carries the product's NAME wins over the brand link that comes first: %s" % [h for _, h, _ in t])
    # goTo: the asked offer, by its name → its own page
    page.set_content(JUMIA); page.add_script_tag(path=KIT)
    r = page.evaluate("(() => { const a = window.location.assign; try { Object.defineProperty(window.location, 'assign', { value: () => {} }); } catch (e) {} return window.__attuneAgent.goTo({ name: 'Huawei FreeBuds 6i White', price: 3900 }); })()")
    check(r.get("ok") and r.get("href", "").endswith("11223344.html"), "goTo finds “Huawei FreeBuds 6i White” and goes into ITS page: %s" % r)
    page.set_content(JUMIA); page.add_script_tag(path=KIT)
    r = page.evaluate("window.__attuneAgent.goTo({ name: 'Sony WH-1000XM5', price: 0 })")
    check(not r.get("ok"), "an offer that is not on the page is not “found” (the fallback link is opened instead)")
    br.close()
finish()
