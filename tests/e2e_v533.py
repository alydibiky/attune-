"""v5.33 — Deal Check ("before you pay or sign, ask Attune"): the model reads the offer, code
works out the real cost and interest, the market price from web pages, scam signs and the
verdict, and the model writes the reply to the seller.

  python3 tests/e2e_v533.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish

env = Env(); errors = []

SEARCH = """(() => { const N = window.AttuneNative, S = window.__mock;
  N.search = (id, arg) => { const a = JSON.parse(arg); (S.searchLog = S.searchLog || []).push(a.q || a.query || '');
    setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ via: "duckduckgo", why: "", hits: [
      { title: "iPhone 15 Pro 256GB price in Egypt", url: "https://shop.example.com/iphone", text: "iPhone 15 Pro 256GB now EGP 52,000 at the official dealer, was 55,000 EGP." },
      { title: "iPhone 15 Pro used prices", url: "https://used.example.com/ip15", text: "Used iPhone 15 Pro 256GB sells for EGP 45,000 to EGP 48,000 depending on the condition." },
      { title: "Unrelated", url: "https://example.com/x", text: "Weather in Cairo is sunny today with light winds from the north." } ] })), 30); };
})();"""

OFFER = "iPhone 15 Pro 256GB like new, only 18,000 EGP! Last chance, today only. Send 2,000 EGP deposit on Vodafone Cash to hold it, then contact me on WhatsApp."
TERMS = json.dumps({"item": "iPhone 15 Pro 256GB", "kind": "product", "price": 18000, "currency": "EGP", "cash_price": None, "down_payment": None,
                    "monthly": None, "months": None, "fees": None, "seller": None, "claims": ["like new"], "text": OFFER})
REPLY = "Hi, I'm interested. I'd like to see the phone in person and pay on delivery — no deposit in advance. Can we meet?"

PLAN = "Samsung TV 55 inch: cash 20,000 EGP, or 0% interest installments: 2,000 down, 12 x 1,900 EGP, admin fee 500 EGP."
PLAN_TERMS = json.dumps({"item": "Samsung TV 55 inch", "kind": "installment", "price": 20000, "currency": "EGP", "cash_price": 20000, "down_payment": 2000,
                         "monthly": 1900, "months": 12, "fees": 500, "seller": None, "claims": ["0% interest"], "text": PLAN})

def install(page):
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    install(page)
    page.evaluate(SEARCH)

    # ---- 1. More → Deal Check is there, first under "Your life" ----
    page.locator("nav button").last.click(); page.wait_for_timeout(300)
    check(page.locator(".rounded-t-2xl button:has-text('Deal Check')").count() == 1, "Deal Check is in More")
    page.locator(".rounded-t-2xl button:has-text('Deal Check')").first.click()
    page.wait_for_selector("[data-testid=deal]", timeout=5000)

    # ---- 2. a WhatsApp-seller scam ----
    page.evaluate("(q) => { const M = window.__mock; M.fakeQueue = q; M.bodies = []; M.searchLog = []; }", [TERMS, REPLY])
    page.locator("[data-testid=deal-input]").fill(OFFER)
    page.locator("[data-testid=deal-go]").click()
    page.wait_for_selector("[data-testid=deal-result]", timeout=30000)
    lvl = page.locator("[data-testid=deal-verdict]").get_attribute("data-level")
    check(lvl == "scam", "a too-cheap phone with a Vodafone Cash deposit and 'today only' is called a scam (%s)" % lvl)
    check(any("iPhone 15 Pro 256GB price Egypt" in q for q in page.evaluate("window.__mock.searchLog")), "the market price is searched by the item's name only")
    mk = page.locator("[data-testid=deal-market]").inner_text()
    check("45,000" in mk or "48,000" in mk or "52,000" in mk, "the market range comes from the prices on the pages (%s)" % mk)
    rs = page.locator("[data-testid=deal-reasons]").inner_text()
    check("far below the market" in rs and "personal wallet" in rs, "the reasons say why: far below market, payment to a personal wallet")
    check("pay on delivery" in page.locator("[data-testid=deal-message]").inner_text(), "the reply to the seller is written, ready to send")
    check(page.locator("[data-testid=deal-whatsapp]").count() == 1, "…with a Send on WhatsApp button")
    first = json.dumps(page.evaluate("window.__mock.bodies[0].messages"))
    check("Reply with ONLY a JSON object" in first and page.evaluate("!!window.__mock.bodies[0].response_format"), "the model only reads the offer into fields (JSON)")

    # ---- 3. an installment plan that says 0% ----
    page.evaluate("(q) => { const M = window.__mock; M.fakeQueue = q; M.bodies = []; }", [PLAN_TERMS, "Could you do it without the admin fee?"])
    page.locator("[data-testid=deal-input]").fill(PLAN)
    page.locator("[data-testid=deal-go]").click()
    page.wait_for_function("() => { const t = document.querySelector('[data-testid=deal-total]'); return t && t.innerText.includes('25,300'); }", timeout=30000)
    rate = page.locator("[data-testid=deal-rate]").inner_text()
    check(int(rate.strip('%')) >= 30, "the '0%% interest' plan's real yearly interest is worked out by code (%s)" % rate)
    check("although it says 0%" in page.locator("[data-testid=deal-reasons]").inner_text(), "…and it says the plan claimed 0%")
    check(page.locator("[data-testid=deal-verdict]").get_attribute("data-level") in ("overpriced", "risky"), "…so it is not called a good deal")

    # ---- 4. earlier checks are kept ----
    page.locator("[data-testid=deal-new]").click(); page.wait_for_timeout(300)
    check(page.locator("text=Earlier checks").count() == 1 and page.locator("text=iPhone 15 Pro 256GB").count() >= 1, "earlier checks are listed")

    # ---- 5. in Arabic ----
    page.evaluate("localStorage.setItem('attune:ui:lang','ar')"); page.reload(); page.wait_for_selector("nav", timeout=15000); page.wait_for_timeout(500)
    page.locator("nav button").last.click(); page.wait_for_timeout(400)
    check(page.locator(".rounded-t-2xl button:has-text('فحص الصفقة')").count() == 1, "Arabic: 'فحص الصفقة' in More")

    check(not real_errors(errors), "no errors (%s)" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
