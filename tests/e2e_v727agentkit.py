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
    br.close()
finish()
