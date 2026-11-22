"""v10.8 (Ali, 22 Nov 2026: "what's the use of AI if it didn't do anything"): money the code wasn't sure of is re-read by the model with his
own categories; code checks the answer; the result card says what changed, with "Put back". A stand-in model answers here (the real one
runs on the phone). Phone and computer, English and Arabic.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v1080moneyai.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
LEDGER = {"currency": "EGP", "accounts": [{"id": "a1", "name": "Cash", "currency": "EGP"}], "txns": [], "recurring": [],
          "customCats": [{"id": "c_nada", "en": "masroof nada", "ar": "مصروف ندى", "e": "👗"}]}
INIT = ("try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:coach:v1',JSON.stringify({seen:['*']}));"
        "localStorage.setItem('ledger.v3',%s);localStorage.setItem('attune:ui:lang','%s')}catch(e){}")
STUB = """() => { window.__aiAsked = 0; window.__attuneMoneyAi = async (q) => { window.__aiAsked++; window.__aiQ = q;
  return '{"items":[{"amount":25000,"cat":"c_nada","note":"%s"}]}'; }; }"""
with sync_playwright() as p:
    br = p.chromium.launch()
    for size, desk in (("phone", None), ("computer", (1366, 900))):
        for lang, text, note in (("en", "paid 25000 for nada's winter stuff", "winter stuff"), ("ar", "دفعت 25000 لندى حاجات الشتا", "حاجات الشتا")):
            tag = "%s · %s" % (size, lang)
            ctx, page = new_page(br, env, errors, legacy_nav=False, desktop=desk, extra_init=INIT % (json.dumps(json.dumps(LEDGER)), lang))
            if not desk: page.set_viewport_size({"width": 390, "height": 844})
            page.goto(env.url); page.wait_for_selector("[data-testid=home-ask]", timeout=20000); page.wait_for_timeout(600)
            page.evaluate(STUB % note)
            page.fill("[data-testid=home-ask]", text); page.click("[data-testid=home-send]")
            try: page.wait_for_selector("[data-testid=do-aifix]", timeout=6000)
            except Exception: pass
            page.wait_for_timeout(800)
            asked = page.evaluate("() => window.__aiAsked || 0")
            check(asked == 1, "%s: the code wasn't sure → the AI was asked once (%s)" % (tag, asked))
            q = page.evaluate("() => window.__aiQ || ''")
            check("c_nada" in q and ("masroof nada" in q or "مصروف ندى" in q), "%s: the question lists his own categories" % tag)
            tx = page.evaluate("() => (JSON.parse(localStorage.getItem('ledger.v3')).txns || []).slice(-1)[0] || null")
            check(tx and tx["cat"] == "c_nada" and tx["amount"] == 25000, "%s: saved under masroof nada (got %s)" % (tag, tx and tx.get("cat")))
            check(tx and tx["note"] == note, "%s: the note is «%s» (got «%s»)" % (tag, note, tx and tx.get("note")))
            line = page.locator("[data-testid=do-aifix]")
            check(line.count() == 1 and ("masroof nada" in line.inner_text() or "مصروف ندى" in line.inner_text()), "%s: the card says what the AI changed" % tag)
            back = page.locator("[data-testid=do-aifix-back]")
            if back.count():
                back.first.click(); page.wait_for_timeout(300)
                tx2 = page.evaluate("() => (JSON.parse(localStorage.getItem('ledger.v3')).txns || []).slice(-1)[0] || null")
                check(tx2 and tx2["cat"] != "c_nada", "%s: Put back undoes only the AI's change (the amount stays saved)" % tag)
            else: check(False, "%s: Put back is on the card" % tag)
            ctx.close()
    # a sentence the code IS sure of never asks the AI (no wasted time / battery)
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT % (json.dumps(json.dumps(LEDGER)), "en"))
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_selector("[data-testid=home-ask]", timeout=20000)
    page.evaluate(STUB % "x")
    page.fill("[data-testid=home-ask]", "25000 egp expense under masroof nada for shopping winter clothes"); page.click("[data-testid=home-send]"); page.wait_for_timeout(1200)
    check(page.evaluate("() => window.__aiAsked || 0") == 0, "Ali's own sentence is read right by code — the AI isn't needed")
    tx = page.evaluate("() => (JSON.parse(localStorage.getItem('ledger.v3')).txns || []).slice(-1)[0] || null")
    check(tx and tx["cat"] == "c_nada" and tx["note"] == "shopping winter clothes", "Ali's sentence: masroof nada · shopping winter clothes (got %s)" % str(tx and (tx.get("cat"), tx.get("note"))))
    ctx.close(); br.close()
check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
finish()
