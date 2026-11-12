"""v9.9.23 (Ali: "add the photo check everywhere applicable"): every screen that reads a paper from a photo checks it first —
Read it to me, Translate (photo), Money (receipt), Timetable, Family health (lab result). A blurry photo → the sheet says why
("This photo is blurry …") with Take another photo / Use this one anyway / Cancel, and nothing is read; "Use this one anyway" reads it;
"Take another photo" opens Camera / Gallery; a sharp photo goes straight through. Arabic shows the Arabic line.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v9923photogate.py
"""
import os, json, tempfile
from playwright.sync_api import sync_playwright
from harness import doc_png, doc_bytes, Env, new_page, check, real_errors, finish
env = Env(); errors = []
INIT = ("try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:testing-pro','on')}catch(e){}\n"
        "window.__reads = 0; (() => { const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0); N.payAccess = () => true; N.payQueue = () => '[]';"
        " N.readText = (id, arg) => { window.__reads++; setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ text: 'Haemoglobin 11.2 g/dL 13.5 - 17.5', lines: [] })), 30); }; }; go(); })();")
D = tempfile.mkdtemp()
L = {"currency": "EGP", "accounts": [{"id": "b", "name": "Bank", "emoji": "🏦", "currency": "EGP", "start": 20000}], "txns": [], "budgets": {"overall": 0, "cats": {}},
     "recurring": [], "debts": [], "customCats": [], "goals": [], "projects": [], "notes": [], "zakatHistory": [], "zakatPayments": []}
LEDGER = "try{localStorage.setItem('ledger.v3', %s)}catch(e){};" % json.dumps(json.dumps(L))
def sheet(page, what):
    page.wait_for_selector("[data-testid=photo-retake]", timeout=8000)
    w = page.locator("[data-testid=photo-retake]").get_attribute("data-why"); t = page.locator("[data-testid=photo-retake-text]").inner_text()
    check(w == "blur" and "blurry" in t and page.evaluate("window.__reads") == 0, what + ": a blurry photo → asked for another, nothing read")
def reads(page): return page.evaluate("window.__reads")
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    BLUR = doc_png(page, os.path.join(D, "blur.png"), blur=4); SHARP = doc_png(page, os.path.join(D, "sharp.png"))
    # 1 Read it to me
    page.click("[data-testid=home-read]"); page.wait_for_selector("[data-testid=read-sheet]")
    page.set_input_files("[data-testid=read-camera-input]", BLUR); sheet(page, "Read it to me")
    page.click("[data-testid=photo-retake-again]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=photo-retake]").count() == 0 and page.locator("[data-testid=photo-pick]").count() == 1, "Take another photo → Camera / Gallery opens")
    page.click("[data-testid=photo-pick-cancel]")
    page.set_input_files("[data-testid=read-camera-input]", SHARP); page.wait_for_timeout(1500)
    check(reads(page) == 1 and page.locator("[data-testid=photo-retake]").count() == 0, "Read it to me: a sharp photo is read straight away")
    ctx.close(); ctx, page = new_page(br, env, errors, extra_init=INIT)   # (a fresh start for each screen)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    # 2 Translate
    page.evaluate("window.__reads = 0; window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'translate'}}))"); page.wait_for_selector("[data-testid=translate-page]", timeout=6000)
    page.click("[data-testid=tr-tab-photo]"); page.set_input_files("[data-testid=tr-file]", BLUR); sheet(page, "Translate")
    page.click("[data-testid=photo-retake-anyway]"); page.wait_for_timeout(1500)
    check(reads(page) == 1, "Translate: Use this one anyway → it's read")
    # 3 Timetable
    page.evaluate("window.__reads = 0; window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'reminders'}}))"); page.wait_for_selector("[data-testid=rem-timetable]", timeout=10000)
    page.click("[data-testid=rem-timetable]"); page.wait_for_selector("[data-testid=timetable-page]")
    page.set_input_files("[data-testid=timetable-file]", BLUR); sheet(page, "Timetable")
    page.click("[data-testid=photo-retake-cancel]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=photo-retake]").count() == 0 and reads(page) == 0, "Timetable: Cancel → nothing read, the sheet closes")
    # 4 Money receipt
    ctx.close(); ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=LEDGER + INIT)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_timeout(1500)
    page.evaluate("window.__reads = 0; window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'money'}}))"); page.wait_for_selector("[data-testid=money-bar]", timeout=10000); page.wait_for_timeout(1200)
    page.click("[data-testid=money-add]"); page.wait_for_selector("[data-testid=money-add-sheet]")
    page.set_input_files("[data-testid=add-receipt-input]", BLUR); sheet(page, "Money receipt")
    check(page.locator("[data-testid=add-receipt-thumb]").count() == 0, "Money: the blurry receipt isn't attached")
    page.click("[data-testid=photo-retake-cancel]")
    page.set_input_files("[data-testid=add-receipt-input]", SHARP); page.wait_for_selector("[data-testid=add-receipt-thumb]", timeout=6000)
    check(page.locator("[data-testid=photo-retake]").count() == 0, "Money: a sharp receipt is attached with no warning")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    # 5 Family health (lab result), in Arabic
    ctx.close(); ctx, page = new_page(br, env, errors, extra_init="localStorage.setItem('attune:ui:lang','ar');" + INIT)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_timeout(2000)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'care'}}))"); page.wait_for_selector("[data-testid=care-page]", timeout=8000)
    page.click("[data-testid=care-tab-labs]")
    page.locator("[data-testid=care-lab-file]").set_input_files(os.path.join(D, "blur.png"))
    page.wait_for_selector("[data-testid=photo-retake]", timeout=8000)
    t = page.locator("[data-testid=photo-retake-text]").inner_text()
    check("مهزوزة" in t and "صوّر تاني" in page.locator("[data-testid=photo-retake]").inner_text(), "Family health (Arabic): " + t[:60])
    page.click("[data-testid=photo-retake-anyway]"); page.wait_for_selector("[data-testid=care-labdraft]", timeout=6000)
    check(True, "…Use this one anyway → the lab result is read")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
env.close(); finish()
