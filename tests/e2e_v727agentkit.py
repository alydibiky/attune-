"""v6.27 "Do it for me", level 2 — the agent kit (web-src/agent-kit.js) on fake booking / checkout pages: it reads the
offers, marks the best by the person's rules, fills only fields that clearly ask for the person's details, never touches
card / CVV / password fields, and says when the payment form appears.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v727agentkit.py
"""
import os
from playwright.sync_api import sync_playwright
from harness import check, finish, HERE
KIT = os.path.join(HERE, "..", "web-src", "agent-kit.js")
FLIGHTS = """<html><body><h1>Cairo → Dubai</h1><p class=total>Total for 1 adult</p>
<div class=r><b>EgyptAir</b> <span>07:40 – 12:10</span> <span>Nonstop</span> <div class=p>EGP 8,450</div></div>
<div class=r><b>Flydubai</b> <span>02:15 – 06:30</span> <span>Nonstop</span> <div class=p>EGP 7,990</div></div>
<div class=r><b>Saudia</b> <span>09:05 – 18:40</span> <span>1 stop</span> <div class=p><s>EGP 9,900</s> EGP 6,200</div></div>
<div class=r><b>Emirates</b> <span>15:30 – 20:00</span> <span>Nonstop</span> <div class=p>EGP 11,300</div></div>
</body></html>"""
FORM = """<html><body><form>
<label>First name <input name=fn></label><label>Last name <input name=ln></label>
<input type=email placeholder="Email"><input type=tel placeholder="Mobile number"><label>Date of birth <input type=date name=dob></label>
<label>Passport number <input name=passport_no></label><label>Nationality <select name=nat><option value="">—</option><option value=EG>Egypt</option><option value=FR>France</option></select></label>
<label>Hotel name <input name=hotel></label><label>Already typed <input name=city value="Giza"></label>
<label>Card number <input name=cardnumber></label><label>CVV <input name=cvc></label><label>Password <input type=password name=pw></label>
<input autocomplete="cc-name" placeholder="Name on card">
</form></body></html>"""
FORM2 = """<html><body><form><label>Name <input name=name></label><label>Company name <input name=company></label><label>Username <input name=username></label>
<label>البريد الإلكتروني <input name=ar_mail></label><label>رقم الجوال <input name=ar_phone></label><label>اسم الفندق <input name=ar_hotel></label>
<label>رقم البطاقة <input name=ar_card></label></form></body></html>"""
P = {"first": "Aly", "last": "Aldibiki", "email": "aly@example.com", "phone": "+201001234567", "birth": "2005-03-09", "passport": "A12345678", "nationality": "Egypt", "city": "Cairo"}
with sync_playwright() as p:
    br = p.chromium.launch(); page = br.new_page()
    page.set_content(FLIGHTS); page.add_script_tag(path=KIT)
    offers = page.evaluate("window.__attuneAgent.offers()")
    check(len(offers) == 4 and sorted(o["price"] for o in offers) == [6200, 7990, 8450, 11300], "reads the 4 offers, not the struck-out old price: %s" % [o["price"] for o in offers])
    r = page.evaluate("window.__attuneAgent.best({cheapest:true})")
    check(r["price"] == 6200 and "Saudia" in r["text"], "cheapest: Saudia 6,200 marked")
    r = page.evaluate("window.__attuneAgent.best({direct:true, time:'morning'})")
    check(r["price"] == 8450 and "EgyptAir" in r["text"], "direct + morning: EgyptAir 07:40 nonstop (not the 02:15, not the 1-stop): %s" % r.get("text", "")[:40])
    check(page.evaluate("getComputedStyle([...document.querySelectorAll('.r')].find(x => x.innerText.includes('EgyptAir'))).outlineStyle") == "solid", "…and outlined for the person to tap")
    page.set_content(FORM); page.add_script_tag(path=KIT)
    r = page.evaluate("(p) => window.__attuneAgent.fill(p)", P)
    vals = page.evaluate("Object.fromEntries([...document.querySelectorAll('input,select')].map(e => [e.name || e.placeholder || e.type, e.value]))")
    check(vals["fn"] == "Aly" and vals["ln"] == "Aldibiki" and vals["Email"] == "aly@example.com" and vals["Mobile number"] == "+201001234567" and vals["dob"] == "2005-03-09" and vals["passport_no"] == "A12345678" and vals["nat"] == "EG", "fills name, email, phone, birth date, passport, nationality: %s" % vals)
    check(vals["hotel"] == "" and vals["city"] == "Giza", "a 'Hotel name' field is not a phone; what was typed is kept")
    check(vals["cardnumber"] == "" and vals["cvc"] == "" and vals["pw"] == "" and vals["Name on card"] == "", "card number, CVV, password and name-on-card are NEVER filled")
    check(r["refused"] >= 4 and r["payment"] is True, "…they are counted as refused, and the payment form is recognised (%s)" % r)
    page.set_content(FORM2); page.add_script_tag(path=KIT)
    page.evaluate("(p) => window.__attuneAgent.fill(p)", P)
    v = page.evaluate("Object.fromEntries([...document.querySelectorAll('input')].map(e => [e.name, e.value]))")
    check(v["name"] == "Aly Aldibiki" and v["company"] == "" and v["username"] == "", "a field called just 'Name' gets the full name; 'Company name' and 'Username' are left alone: %s" % v)
    check(v["ar_mail"] == "aly@example.com" and v["ar_phone"] == "+201001234567" and v["ar_hotel"] == "" and v["ar_card"] == "", "Arabic labels: email and mobile filled, the hotel name and the card number not: %s" % v)
    # v8.6 buy agent: each offer carries its own link; on the product page it presses Buy now ONCE — never Place order / Pay
    page.set_content("""<html><body><div class=r><a href="https://shop.example/dp/A1"><b>Apple AirPods Pro 2 USB-C</b></a><div>EGP 8,900</div></div>
<div class=r><a href="https://shop.example/dp/C9"><b>Silicone case for AirPods Pro 2</b></a><div>EGP 250</div></div></body></html>""")
    page.add_script_tag(path=KIT)
    r = page.evaluate("window.__attuneAgent.best({cheapest:true, many:true})")
    check(any(o["href"] == "https://shop.example/dp/A1" and "AirPods Pro 2" in o["name"] for o in r["top"]), "offers carry their product link and name: %s" % r["top"])
    page.set_content("""<html><body><button id=po onclick="window.__po=1">Place order</button><button id=pay onclick="window.__pay=1">Pay</button>
<button id=cart onclick="window.__cart=1">Add to Cart</button><button id=bn onclick="window.__bn=(window.__bn||0)+1">Buy Now</button></body></html>""")
    page.add_script_tag(path=KIT)
    r = page.evaluate("window.__attuneAgent.buy()"); page.wait_for_timeout(700); page.evaluate("window.__attuneAgent.buy()"); page.wait_for_timeout(600)
    check(r["clicked"] == "Buy Now" and page.evaluate("window.__bn") == 1, "Buy now pressed once (not twice): %s" % r)
    check(not page.evaluate("window.__po") and not page.evaluate("window.__pay") and not page.evaluate("window.__cart"), "Place order / Pay are never pressed — the person pays")
    # v9.1 (Ali, 3 Nov, Booking hotels near Masjid al-Haram: the check didn't find the lowest price): a "taxes and charges" line,
    # "Original price" and a crossed-out price drawn with CSS are NOT offers; a quiet read (while the page loads) doesn't move the page
    page.set_content("""<html><body><div style="height:1500px">search form</div>
<div class=h><b>Swissotel Makkah</b> <span style="text-decoration:line-through">EGP 61,000</span> <span>EGP 52,400</span> <div>+EGP 4,120 taxes and charges</div></div>
<div class=h><b>Pullman ZamZam Makkah</b> <span>Original price EGP 70,000</span> <span>EGP 48,900</span> <div>+EGP 3,900 taxes and fees</div></div>
<div class=h><b>Fairmont Makkah Clock Royal Tower</b> <span>EGP 66,300</span> <div>Save EGP 5,000</div></div></body></html>""")
    page.add_script_tag(path=KIT)
    r = page.evaluate("window.__attuneAgent.best({cheapest:true}, true)")
    check(r["price"] == 48900 and "Pullman" in r["text"], "hotels: the cheapest is Pullman 48,900 — not a 'taxes and charges' line or a crossed-out price: %s" % r.get("price"))
    check(sorted(o["price"] for o in page.evaluate("window.__attuneAgent.offers()")) == [48900, 52400, 66300], "only the three real prices are offers")
    check(r.get("quiet") is True and page.evaluate("scrollY") == 0, "a quiet read doesn't scroll the page")
    # v9.1 (Ali's 4 Nov screenshots: every hotel named "Booking.com", no photo, "+0"): Booking's own property cards — the name, the
    # photo, the score and the distance come with the price, even though each card has several prices
    card = lambda n, img, price, old, score, dist: f"""<div data-testid="property-card"><a href="https://www.booking.com/hotel/sa/{n.lower().replace(' ', '-')}.html">
<img data-testid="image" src="https://cf.bstatic.com/xdata/images/hotel/{img}.jpg" width="200" height="200"></a>
<div><div data-testid="title">{n}</div><span data-testid="distance">{dist} from Masjid al Haram</span>
<div data-testid="review-score"><div>Scored {score}</div><div>{score}</div><div>Superb</div></div>
<div><span>4 nights, 2 adults</span><span style="text-decoration:line-through">EGP {old}</span><span data-testid="price-and-discounted-price">EGP {price}</span><div>+EGP 4,120 taxes and charges</div></div></div></div>"""
    page.set_content("<html><body><div>search form</div>" + card("Swissotel Makkah", "a1", "41,495", "52,000", "8.9", "150 m") + card("Pullman ZamZam Makkah", "b2", "42,124", "49,000", "8.6", "300 m")
                     + card("Fairmont Makkah Clock Royal Tower", "c3", "55,300", "61,000", "9.1", "100 m") + "</body></html>")
    page.add_script_tag(path=KIT)
    r = page.evaluate("window.__attuneAgent.best({cheapest:true, many:true}, true)")
    top = r["top"]
    check(r["offers"] == 3 and [o["price"] for o in top[:3]] == [41495, 42124, 55300], "Booking cards: 3 offers, cheapest first: %s" % [o["price"] for o in top])
    check([o["name"] for o in top[:3]] == ["Swissotel Makkah", "Pullman ZamZam Makkah", "Fairmont Makkah Clock Royal Tower"], "each offer has its hotel's own name (not 'Booking.com'): %s" % [o["name"] for o in top])
    check(all(o["img"].startswith("https://cf.bstatic.com/") for o in top[:3]) and top[0]["href"].endswith("swissotel-makkah.html"), "…its photo and its own page")
    check("Scored 8.9" in top[0]["text"] and "150 m" in top[0]["text"], "…and its score and distance, for the comparison")
    # v9.1 (Ali: "not just Booking — all"): any site's own result card — a shop with "product-card" classes, schema.org items
    page.set_content("""<html><body><div class="grid">
<div class="ProductCard_wrap__x1"><a href="https://www.noon.com/egypt-en/huawei-freeclip-2/N1/p/"><img src="https://f.nooncdn.com/p/n1.jpg" width="120" height="120"></a>
  <div class="ProductCard_name__y">Huawei FreeClip 2 Open-Ear</div><div><span style="text-decoration:line-through">EGP 9,999</span><b>EGP 8,399</b></div><div>Save EGP 1,600</div></div>
<div class="ProductCard_wrap__x1"><a href="https://www.noon.com/egypt-en/huawei-freeclip-2-white/N2/p/"><img src="https://f.nooncdn.com/p/n2.jpg" width="120" height="120"></a>
  <div class="ProductCard_name__y">Huawei FreeClip 2 White</div><div><b>EGP 8,650</b></div></div></div>
<ul><li itemscope itemtype="https://schema.org/Hotel"><img src="https://img.example/h1.jpg" width="90" height="90"><h3 itemprop="name">Hilton Suites Makkah</h3><span>EGP 43,900</span> <span>EGP 10,975 a night</span></li></ul>
</body></html>""")
    page.add_script_tag(path=KIT)
    r = page.evaluate("window.__attuneAgent.best({cheapest:true, many:true}, true)")
    names = {o["name"]: o for o in r["top"]}
    check("Huawei FreeClip 2 Open-Ear" in names and names["Huawei FreeClip 2 Open-Ear"]["price"] == 8399 and names["Huawei FreeClip 2 Open-Ear"]["img"].startswith("https://f.nooncdn.com/"), "a shop's product cards: name, price (not the old one / the saving), photo: %s" % list(names))
    check("Hilton Suites Makkah" in names and names["Hilton Suites Makkah"]["img"].startswith("https://img.example/"), "a schema.org hotel item: its name and photo")
    # v9.4 (Ali, 5 Nov: "Offer 3", no photo, Book opened the search): a layout without Booking's markers (its phone site) — the hotel's
    # link, name and lazy photo sit in other branches of the card than the price; each offer still gets its own page, name and photo
    mob = lambda n, slug, price: f"""<div class="c1"><div class="c2"><a href="https://www.booking.com/hotel/es/{slug}.html?aid=1&amp;label=x"><div class="pic"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" data-src="https://cf.bstatic.com/xdata/images/hotel/max500/{slug}.jpg" width="1" height="1"></div></a></div>
<div class="c3"><div class="c4"><a href="https://www.booking.com/hotel/es/{slug}.html?aid=1"><span class="h">{n}</span></a><div>Madrid city centre · 0.4 km</div></div>
<div class="c5"><div class="c6"><div><span>4 nights</span></div><div><span>EGP {price}</span></div><div>+EGP 900 taxes and charges</div></div></div></div></div>"""
    page.set_content('<html><body><div>search form <a href="https://www.booking.com/searchresults.html?ss=Madrid">Search</a></div><div class="list">' + mob("Hotel Europa Madrid", "europa", "42,124") + mob("Room Mate Alicia", "alicia", "39,900") + "</div></body></html>")
    page.add_script_tag(path=KIT)
    r = page.evaluate("window.__attuneAgent.best({cheapest:true, many:true}, true)")
    top = r["top"]
    check([o["price"] for o in top[:2]] == [39900, 42124], "phone layout: both offers, cheapest first: %s" % [o["price"] for o in top])
    check([o["name"] for o in top[:2]] == ["Room Mate Alicia", "Hotel Europa Madrid"], "phone layout: each hotel's own name: %s" % [o["name"] for o in top])
    check(all("/hotel/es/" in o["href"] for o in top[:2]) and "alicia" in top[0]["href"], "phone layout: each hotel's own page (not the search): %s" % [o["href"] for o in top])
    check(top[0]["img"] == "https://cf.bstatic.com/xdata/images/hotel/max500/alicia.jpg", "phone layout: the lazy photo, not the 1-pixel placeholder: %s" % top[0]["img"])
    br.close()
finish()
