"""v9.2 (Ali, 5 Nov 2026, screenshot of Add to Money: "there was an option to add receipts"): the + sheet takes a receipt photo; the phone's
text reader (ML Kit, here a stand-in) reads its TOTAL into the amount; the photo is kept with the entry in the ledger and shows on it.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v922receipt.py
"""
import json, os, struct, zlib, datetime
from playwright.sync_api import sync_playwright
from harness import doc_png, Env, new_page, check, real_errors, finish
env = Env(); errors = []
def png(rgb, w=40, h=60):
    raw = b"".join(b"\x00" + bytes(rgb) * w for _ in range(h))
    ch = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return b"\x89PNG\r\n\x1a\n" + ch(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + ch(b"IDAT", zlib.compress(raw)) + ch(b"IEND", b"")
L = {"currency": "EGP", "accounts": [{"id": "b", "name": "Cib,instapay", "emoji": "🏦", "currency": "EGP", "start": 20000}], "txns": [], "budgets": {"overall": 0, "cats": {}},
     "recurring": [], "debts": [], "customCats": [], "goals": [], "projects": [], "notes": [], "zakatHistory": [], "zakatPayments": []}
INIT = "try{localStorage.setItem('ledger.v3', %s)}catch(e){}" % json.dumps(json.dumps(L))
OCR = """(() => { function w(){ const N = window.AttuneNative; if (!N) return setTimeout(w, 5);
  N.readText = (id, arg) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ width: 900, height: 1300, lines: ['SIZZLER', 'Tel 0223456789', 'Mixed grill 1 x 850.00', 'Subtotal 1,780.00', 'Service 12% 213.60', 'VAT 14% 249.20', 'TOTAL 2,030.00', 'Cash 2,100', 'Change 70'].map((t, i) => ({ text: t, x: 10, y: 20 + i * 40, w: 300, h: 30 })) })), 20);
} w(); })();"""
def ledger(page): return json.loads(page.evaluate("localStorage.getItem('ledger.v3')"))
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + ";" + OCR)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_timeout(1200)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'money'}}))")
    page.wait_for_selector("[data-testid=money-bar]", timeout=10000); page.wait_for_timeout(1500)
    page.click("[data-testid=money-add]"); page.wait_for_selector("[data-testid=money-add-sheet]")
    check(page.locator("[data-testid=add-receipt-btn]").count() == 1, "Add to Money has “Add a receipt”")
    f = "/tmp/v922receipt.png"; doc_png(page, f)
    page.set_input_files("[data-testid=add-receipt-input]", f); page.wait_for_selector("[data-testid=add-receipt-thumb]", timeout=5000); page.wait_for_timeout(300)
    check(page.input_value("[data-testid=add-amount]") == "2030", "the TOTAL is read from the receipt into the amount (not the subtotal, the cash or the change): %s" % page.input_value("[data-testid=add-amount]"))
    check("2,030" in page.inner_text("[data-testid=add-receipt-read]"), "…and it says so, to check")
    page.fill("[data-testid=add-note]", "Sizzler"); page.click("[data-testid=add-save]"); page.wait_for_timeout(1200)
    t = [x for x in ledger(page)["txns"] if x.get("note") == "Sizzler"]
    check(len(t) == 1 and t[0]["amount"] == 2030 and str(t[0].get("photo", "")).startswith("data:image/jpeg;base64,"), "the entry is in the ledger with its receipt photo")
    page.click("[data-testid=money-more]"); page.click("[data-testid=money-open-ledger]"); page.wait_for_selector("[data-testid=money-list]")
    page.locator("[data-testid=money-list-row]").first.click(); page.wait_for_selector("[data-testid=money-tx-sheet]")
    check(page.locator("[data-testid=tx-receipt] img").count() == 1, "the entry shows its receipt (tap to see it big)")
    errs = real_errors(errors)
    check(not errs, "no page errors: %s" % errs[:3])
env.close()
finish()
