"""v6.27 Translate: text with locked numbers/names/codes put back by code, a wrong-language answer retried and then MARKED (never
hidden), the person's glossary, a photo whose translation is drawn over it, and the document route to the File Converter.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v727translate.py     (SHOTS=dir for screenshots)
"""
import os, base64, json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish, HERE
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
INIT = "try{localStorage.setItem('attune:start','chat')}catch(e){}\n" + r"""
(() => { const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0);
  N.readText = (id, arg) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ text: "Fresh juice 25 EGP\nOpen daily", width: 400, height: 200,
    lines: [{ text: "Fresh juice 25 EGP", x: 20, y: 30, w: 300, h: 40 }, { text: "Open daily", x: 20, y: 110, w: 200, h: 36 }] })), 30);
}; go(); })();"""
def install(page):
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)
def open_tr(page):
    # v7.6 (Ali): Translate is no longer a page in the lists — Home's Translate pill opens it ("Talk with someone, a photo or a document")
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'translate'}}))")
    page.wait_for_selector("[data-testid=translate-page]", timeout=5000)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    install(page)
    open_tr(page)
    page.select_option("[data-testid=tr-to]", "ar")
    page.fill("[data-testid=tr-text]", "Invoice INV-2026-0042 for 1,250.50 EGP is due on 12/10/2026.")
    page.evaluate("""() => { const M = window.__mock; M.bodies = []; M.fakeQueue = ['[[1]] الفاتورة ⟦1⟧ بمبلغ ⟦2⟧ مستحقة في ⟦3⟧.']; }""")
    page.click("[data-testid=tr-go]"); page.wait_for_selector("[data-testid=tr-result]", timeout=15000)
    out = page.locator("[data-testid=tr-result]").inner_text()
    sent = page.evaluate("window.__mock.bodies.filter(b => b.max_tokens > 4).map(b => b.messages[b.messages.length - 1].content).join(' ')")
    check("INV-2026-0042" not in sent and "1,250.50" not in sent and "⟦1⟧" in sent, "the numbers, the code and the date never reach the model (locked): %s" % sent[:90])
    check("INV-2026-0042" in out and "1,250.50 EGP" in out and "12/10/2026" in out and "الفاتورة" in out, "…and are put back exactly: %s" % out.split("\n")[0])
    check("Checked" in page.locator("[data-testid=tr-badge]").inner_text(), "the badge: checked")
    # a model that answers in the wrong language twice → marked, not hidden
    page.fill("[data-testid=tr-text]", "Please bring your passport tomorrow.")
    page.evaluate("""() => { window.__mock.fakeQueue = ['[[1]] Please bring your passport tomorrow.', '[[1]] Please bring your passport tomorrow.']; }""")
    page.click("[data-testid=tr-go]"); page.wait_for_timeout(1500)
    check(page.locator("[data-testid=tr-flagged]").count() == 1 and "marked" in page.locator("[data-testid=tr-badge]").inner_text(), "a wrong-language answer is retried, then MARKED for checking: %s" % page.locator("[data-testid=tr-badge]").inner_text()[:90])
    # the glossary travels with the request
    page.click("[data-testid=tr-glossary]"); page.locator("[data-testid=tr-gloss] button:has-text('Add')").click()
    page.locator("[data-testid=tr-gloss] input").nth(0).fill("Attune"); page.locator("[data-testid=tr-gloss] input").nth(1).fill("أتيون")
    page.fill("[data-testid=tr-text]", "Attune works offline.")
    page.evaluate("""() => { const M = window.__mock; M.bodies = []; M.fakeQueue = ['[[1]] يعمل أتيون دون إنترنت.']; }""")
    page.click("[data-testid=tr-go]"); page.wait_for_selector("[data-testid=tr-piece]", timeout=10000)
    sys = page.evaluate("window.__mock.bodies.filter(b => b.max_tokens > 4).map(b => b.messages[0].content).join(' ')")
    check('"Attune" → "أتيون"' in sys and "أتيون" in page.locator("[data-testid=tr-result]").inner_text(), "the glossary term goes with the request and is used")
    # a photo: the translation drawn over it
    page.click("[data-testid=tr-tab-photo]")
    png = page.evaluate("""() => { const c = document.createElement('canvas'); c.width = 400; c.height = 200; const g = c.getContext('2d'); g.fillStyle = '#f5e6c8'; g.fillRect(0,0,400,200); g.fillStyle = '#000'; g.font = '30px sans-serif'; g.fillText('Fresh juice 25 EGP', 22, 60); return c.toDataURL('image/png').split(',')[1]; }""")
    path = os.path.join(HERE, "_menu.png"); open(path, "wb").write(base64.b64decode(png))
    page.evaluate("""() => { window.__mock.fakeQueue = ['[[1]] عصير طازج ⟦1⟧\\n[[2]] مفتوح يوميًا']; }""")
    page.set_input_files("[data-testid=tr-file]", path); os.remove(path)
    page.wait_for_selector("[data-testid=tr-overlay] img", timeout=15000)
    check("25 EGP" in page.locator("[data-testid=tr-result]").inner_text() and "عصير" in page.locator("[data-testid=tr-result]").inner_text(), "a photo: its lines translated, the price kept exactly")
    check(page.evaluate("document.querySelector('[data-testid=tr-overlay] img').naturalWidth") == 400, "…and drawn over the photo (same size as the photo)")
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, "translate-photo.png"))
    # a document → the File Converter
    page.click("[data-testid=tr-tab-doc]"); page.click("[data-testid=tr-open-converter]")
    page.wait_for_selector("[data-testid=convert]", timeout=5000)
    check(page.evaluate("localStorage.getItem('attune:convert:tlang')") == "ar", "a document opens the File Converter set to the same language")
    ctx.close()
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
