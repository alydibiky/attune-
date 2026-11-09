"""v9.9.7 R3 (Ali picked: "looks like the real card"; "the additional things in the edit") on top of
v9.9.5 D1 + D2 + S1 (Ali: photos on documents, several details — ID number, visa number, CVC, password; "make the vault
customizable … the time for each one separately, and an option to do S2").
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v995docs.py
"""
import json, base64, tempfile, os
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
IMG = os.path.join(tempfile.mkdtemp(), "doc.png")
open(IMG, "wb").write(base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQSACj/P8Fu7N9hAAAAAElFTkSuQmCC"))
RADAR = {"items": [{"id": "v1", "kind": "expiry", "doc": "card", "title": "Visa card", "date": "2029-08-31", "status": "active", "source": "typed", "created": 1}], "seen": []}
TH = {"accent": "burgundy", "bg": "light", "a43": 1, "v87": 1, "v95": 1}   # Ali's phone: the light theme (where "white" became dark)
INIT = "try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:radar:v1', %s);localStorage.setItem('attune:theme:v1', %s)}catch(e){}" % (json.dumps(json.dumps(RADAR)), json.dumps(json.dumps(TH)))
MOCK = "(() => { window.__unlocks = 0; function w(){ const N = window.AttuneNative; if (!N) return setTimeout(w, 5); N.vaultUnlock = (id, j) => { window.__unlocks++; setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ ok: true })), 20); }; } w(); })();"
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + ";" + MOCK)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_timeout(1200)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'radar'}}))"); page.wait_for_selector("[data-testid=doc-cover]", timeout=10000)
    check("2029-08-31" not in page.inner_text("[data-testid=radar-item]") and "Aug" in page.inner_text("[data-testid=radar-item]") and "2029" in page.inner_text("[data-testid=radar-item]"), "the date reads like a date (Aug 31, 2029), not 2029-08-31")
    check(page.locator("[data-testid=radar-item] [data-testid=doc-suggest], [data-testid=radar-item] [data-testid=doc-say], [data-testid=radar-item] [data-testid=doc-photo-add]").count() == 0,
          "R3: the card is calm — no + chips, no Name/Value boxes, no say box on it")
    page.click("[data-testid=radar-edit]"); page.wait_for_selector("[data-testid=radar-form] [data-testid=doc-details]", timeout=4000)
    check(True, "…they are inside Edit")
    check(page.locator("[data-testid=doc-suggest]").count() == 1 and "CVC" in page.inner_text("[data-testid=doc-suggest]"), "a bank card suggests Card number · Name on card · Expiry · CVC · PIN")
    page.fill("[data-testid=doc-say]", "card number 4242 4242 4242 4242 cvc 123"); page.keyboard.press("Enter"); page.wait_for_timeout(300)
    rows = page.locator("[data-testid=doc-field]")
    check(rows.count() == 2, "said once → 2 details")
    cvc = page.locator("[data-testid=doc-field][data-lock=finger]")
    check(cvc.count() == 1 and "123" not in cvc.inner_text() and "•••" in cvc.inner_text(), "CVC is hidden (••• ) and locked with the fingerprint")
    card = page.locator("[data-testid=doc-field][data-lock=tap]")
    check("4242" in card.inner_text() and "4242 4242 4242 4242" not in card.inner_text(), "the card number shows only its last 4")
    store = page.evaluate("localStorage.getItem('attune:radar:v1')")
    check("123" not in store.split('"cvc"')[0] and '"123"' not in store, "the CVC is not saved in the Radar item (kept apart — not in sync / backup)")
    cvc.locator("[data-testid=doc-field-show]").click(); page.wait_for_timeout(300)
    check(page.evaluate("window.__unlocks") == 1 and "123" in page.locator("[data-testid=doc-field][data-lock=finger]").inner_text(), "Show → the fingerprint → CVC 123 shown")
    card.locator("[data-testid=doc-field-show]").click(); page.wait_for_timeout(150)
    check(page.evaluate("window.__unlocks") == 1 and "4242 4242 4242 4242" in page.locator("[data-testid=doc-field][data-lock=tap]").inner_text(), "tap-to-show (S2) needs no fingerprint")
    # per row: make the card number normal, set CVC's time to 15 s
    page.locator("[data-testid=doc-field][data-lock=tap] [data-testid=doc-field-gear]").click(); page.click("[data-testid=doc-lock-none]"); page.wait_for_timeout(150)
    check(page.locator("[data-testid=doc-field][data-lock=none]").count() == 1, "the card number made Normal — always shown")
    page.locator("[data-testid=doc-field][data-lock=finger] [data-testid=doc-field-gear]").click(); page.click("[data-testid=doc-secs-15]"); page.wait_for_timeout(150)
    f = page.evaluate("JSON.parse(localStorage.getItem('attune:radar:v1')).items[0].fields")
    check(any(x["name"] == "CVC" and x["secs"] == 15 for x in f), "CVC's show time set to 15 s — each detail its own time")
    # D1 photos
    page.set_input_files("[data-testid=doc-photo-file]", [IMG, IMG]); page.wait_for_timeout(800)
    check(page.locator("[data-testid=doc-photo]").count() == 2, "two photos added at once")
    page.locator("[data-testid=doc-photo]").first.click(); page.wait_for_selector("[data-testid=doc-photo-view]")
    check(page.locator("[data-testid=doc-photo-next]").count() == 1, "a photo opens full screen, with › to the next")
    page.click("[data-testid=doc-photo-del]"); page.wait_for_timeout(300)
    check(page.locator("[data-testid=doc-photo]").count() == 1, "delete one → one left")
    page.set_input_files("[data-testid=doc-photo-file]", [IMG]); page.wait_for_timeout(600)
    page.click("[data-testid=radar-save]"); page.wait_for_timeout(500)
    it = page.evaluate("JSON.parse(localStorage.getItem('attune:radar:v1')).items[0]")
    check(len(it.get("photos", [])) == 2 and len(it.get("fields", [])) == 2, "Save in Edit keeps the photos and details added there (%s photos, %s details)" % (len(it.get("photos", [])), len(it.get("fields", []))))
    cov = page.locator("[data-testid=doc-cover]")
    check(cov.count() == 1 and cov.locator("img").count() == 0 and "📷 2" in cov.inner_text() and "4242" in cov.inner_text() and "Visa card" in cov.inner_text(), "look C (Ali's pick): a colour card with the name and number, no photo on it — “📷 2” says the photos are there")
    col = page.evaluate("[...document.querySelectorAll('[data-testid=doc-cover] b, [data-testid=doc-cover-main], [data-testid=doc-cover] [data-testid=radar-when]')].map(e => getComputedStyle(e).color)")
    check(col and all(c.startswith("rgb(255, 255, 255") or c.startswith("rgba(255, 255, 255, 0.8") or c.startswith("rgba(255, 255, 255, 0.9") for c in col), "light theme: the card's words are real white on the dark card, never dark on dark (Ali's phone, 10 Nov): %s" % col)
    check(page.locator("[data-testid=doc-details-view]").count() == 0, "details folded by default")
    page.click("[data-testid=radar-details-toggle]"); page.wait_for_timeout(200)
    v = page.locator("[data-testid=doc-details-view]")
    check(v.count() == 1 and v.locator("[data-testid=doc-field]").count() == 2 and v.locator("[data-testid=doc-field-gear]").count() == 0 and v.locator("[data-testid=doc-field-copy]").count() == 2, "Details (2) → Show · Copy only (settings live in Edit)")
    cov.click(); page.wait_for_selector("[data-testid=doc-photo-view]")
    check(page.locator("[data-testid=doc-photo-del]").count() == 0, "tapping the card opens the photos (no delete here — that's in Edit)")
    check(not real_errors(errors), "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
