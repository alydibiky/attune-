"""v6.32 — People & plans reads more: a bill to split (debts for each friend), gold / currency you keep (worth, gain, niṣāb,
Send to Zakat) and the car (fuel use, next service, licence → Deadline Radar). Money Guardian's Price memory; Chat answers
«how much did I pay for milk» from it. And the "From:" line under a Chat answer.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v736plans.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
LEDGER = "{currency:'EGP',accounts:[{id:'c',name:'Cash',currency:'EGP',start:0}],txns:[{id:'t1',type:'expense',amount:500,note:'بنزين',date:'2026-09-10',account:'c'},{id:'t2',type:'expense',amount:600,note:'بنزين',date:'2026-10-12',account:'c'}],budgets:{overall:0,cats:{}},recurring:[],debts:[],zakat:{goldPrice:4000,madhhab:'jumhur'}}"
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init="try{localStorage.setItem('ledger.v3', JSON.stringify(" + LEDGER + "))}catch(e){}")
    page.set_viewport_size({"width": 390, "height": 844})
    dialogs = []
    page.on("dialog", lambda d: (dialogs.append(d.message), d.dismiss()))
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    def open_mode(m, sel):
        page.evaluate("(m) => window.dispatchEvent(new CustomEvent('attune-open', { detail: { mode: m } }))", m)
        page.wait_for_selector(sel, timeout=8000)
    open_mode("life", "[data-testid=life-page]")
    def read(t):
        page.fill("[data-testid=life-input]", t); page.click("[data-testid=life-read]")
        page.wait_for_selector("[data-testid=life-draft]", timeout=3000)
        return page.locator("[data-testid=life-draft]").inner_text()
    dr = read("Dinner 1,200 split with Ahmed and Sara")
    check("3 ways" in dr and "Ahmed owes you 400" in dr and "Sara owes you 400" in dr, "a split is read by code: " + dr.replace("\n", " · "))
    page.click("[data-testid=life-save]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=life-item]").count() == 2, "saved as two debts, one per friend")
    dr = read("50 g gold 21k bought for 150,000")
    check("50 g of gold, 21k" in dr and "150,000" in dr, "gold kept: " + dr.replace("\n", " · "))
    page.click("[data-testid=life-save]"); page.wait_for_selector("[data-testid=gold-card]", timeout=3000)
    g = page.locator("[data-testid=gold-card]").inner_text()
    check("43.75 g of pure gold" in g and "175,000" in g and "+25,000" in page.locator("[data-testid=gold-gain]").inner_text(), "worth today with Money's gold price (4,000 a gram): " + g.replace("\n", " · ")[:160])
    check("Below the niṣāb" in page.locator("[data-testid=gold-zakat]").inner_text(), "under the niṣāb (85 g × 4,000)")
    page.click("[data-testid=gold-to-zakat]"); page.wait_for_timeout(200)
    z = page.evaluate("JSON.parse(localStorage.getItem('ledger.v3')).zakat")
    check(z.get("goldGrams") == 43.75 and z.get("madhhab") == "jumhur", "Send to Zakat fills Money's Zakat page: %s" % z)
    for s in ["fuel 600, 40 L at 45,200 km", "fuel 560 35 L at 45,700 km"]:
        dr = read(s); page.click("[data-testid=life-save]"); page.wait_for_timeout(250)
    check(any("Fuel 560 (35 L)" in m for m in dialogs), "a fuel payment is offered to Money: %s" % dialogs[-1:])
    page.wait_for_selector("[data-testid=car-card]", timeout=3000)
    check(page.locator("[data-testid=car-per100]").inner_text().strip() == "7", "35 L over 500 km = 7 L/100 km: " + page.locator("[data-testid=car-per100]").inner_text())
    dr = read("My driving licence expires on 1 March 2027")
    check("Deadline Radar" in dr, "a licence date goes to the Deadline Radar: " + dr.replace("\n", " · "))
    page.click("[data-testid=life-save]"); page.wait_for_timeout(200)
    rd = page.evaluate("JSON.parse(localStorage.getItem('attune:radar:v1')||'{}').items||[]")
    check(any(x.get("date") == "2027-03-01" for x in rd), "…and it is there")
    # Money Guardian: Price memory (Money's own petrol entries + one typed)
    open_mode("guardian", "[data-testid=guardian-page]")
    pm = page.locator("[data-testid=price-memory]").inner_text()
    check("Petrol: 600, 20% more than last month (500)" in pm, "Money's petrol entries compared: " + pm.replace("\n", " · ")[:200])
    page.fill("[data-testid=price-input]", "milk 1L 45 at Carrefour"); page.click("[data-testid=price-add]"); page.wait_for_timeout(200)
    check("Milk: 45 / L — the first price I have" in page.locator("[data-testid=price-memory]").inner_text(), "a typed price is remembered")
    # Chat: the price question, and the "From:" line
    open_mode("chat", "[data-testid=chat-input]")
    page.fill("[data-testid=chat-input]", "how much did I pay for petrol last time?"); page.click("button[title='Send']")
    page.wait_for_timeout(600)
    body = page.inner_text("body")
    check("Petrol: 600, 20% more than last month" in body, "Chat answers from Price memory")
    page.fill("[data-testid=chat-input]", "2+2*3"); page.click("button[title='Send']")
    page.wait_for_selector("[data-testid=answer-source]", timeout=8000)
    check("calculated on this phone" in page.locator("[data-testid=answer-source]").last.inner_text(), "the calculator's answer says 'From: calculated on this phone'")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
