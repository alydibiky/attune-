"""v9.4 (Ali, 5 Nov 2026, a screenshot of "Sheikh owes you · 20,000": "I told it Sheikh pays me 19,500 in installments of 2,500 on the
first day of each month — why did it turn it to 20,000? … fix it for good for everything in the chat"): the plan keeps 19,500 (7 × 2,500
and a last 2,000), the preview says so, Chat's card shows what will be saved, and an amount said that isn't in a plan is shown before Save.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v940sentences.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
LEDGER = "try{localStorage.setItem('ledger.v3', JSON.stringify({currency:'EGP',accounts:[{id:'c',name:'Cash',currency:'EGP',start:0}],txns:[],budgets:{overall:0,cats:{}},recurring:[],debts:[]}))}catch(e){}"
SAY = "Sheikh pays me 19500 in installments of 2500 on first day of each month"
clean = lambda s: s.replace("⁦", "").replace("⁩", "")
def go(page, m): page.evaluate("(m) => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", m); page.wait_for_timeout(700)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=LEDGER)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_timeout(1200)
    # People & plans: Ali's own sentence
    go(page, "life"); page.wait_for_selector("[data-testid=life-page]", timeout=8000)
    page.fill("[data-testid=life-input]", SAY); page.click("[data-testid=life-read]"); page.wait_for_timeout(300)
    d = clean(page.inner_text("[data-testid=life-draft]"))
    check("19,500 in all" in d and "8 payments" in d and "the last one 2,000" in d and "20,000" not in d, "the preview: 2,500 a month · 8 payments · 19,500 in all · the last one 2,000: %r" % d)
    check(page.locator("[data-testid=life-numcheck]").count() == 0, "…every amount said is in it — no warning")
    page.click("[data-testid=life-save]"); page.wait_for_timeout(300)
    t = clean(page.inner_text("[data-testid=life-page]"))
    check("19,500" in t and "20,000" not in t, "saved: left to pay 19,500 — never 20,000")
    # the warning: a plan that lost an amount (the old reading, as the phone may still hold it) is flagged before Save
    page.evaluate("""() => window.dispatchEvent(new CustomEvent('attune-life', { detail: { text: 'Hassan owes me 9,999, 1,000 a month' } }))"""); page.wait_for_timeout(400)
    check(page.locator("[data-testid=life-numcheck]").count() == 0, "a right reading has no warning (9,999 kept, the last payment 999)")
    # Chat: the card says what will be saved, not just the sentence back
    go(page, "home"); page.wait_for_selector("[data-testid=home-ask]", timeout=8000)
    page.fill("[data-testid=home-ask]", SAY); (page.click("[data-testid=home-send]") if page.locator("[data-testid=home-send]").count() else page.keyboard.press("Enter"))   # v9.8: on a phone Enter is a new line; page.wait_for_timeout(1200)
    body = clean(page.inner_text("body"))
    check("Saved in People & plans" in body and "8 payments" in body and "19,500 in all" in body and "the last one 2,000" in body and "20,000" not in body,
          "the Home box says what it saved — 8 payments · 19,500 in all (the last one 2,000): %r" % body[-500:])
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
finish()
