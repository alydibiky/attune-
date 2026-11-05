"""v9.3 (Ali on A3: "wasn't that already available via Deal Check?") — Deal Check's scam check, folded into Money Guardian: a message, an
offer or a screenshot → Scam · Be careful · No warning signs, with the reasons. On the phone, by code.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v930scam.py
"""
import struct, zlib
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
def png(w=40, h=60):
    raw = b"".join(b"\x00" + bytes([240, 240, 235]) * w for _ in range(h))
    ch = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return b"\x89PNG\r\n\x1a\n" + ch(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + ch(b"IDAT", zlib.compress(raw)) + ch(b"IEND", b"")
OCR = """(() => { function w(){ const N = window.AttuneNative; if (!N) return setTimeout(w, 5);
  N.readText = (id, arg) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ width: 900, height: 1300, lines: ['CIB', 'Your card will be blocked within 24 hours.', 'Click the link to verify your account:', 'cib-secure-login.com'].map((t, i) => ({ text: t, x: 10, y: 20 + i * 40, w: 300, h: 30 })) })), 20);
} w(); })();"""
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init="try{localStorage.setItem('attune:start','home')}catch(e){};" + OCR)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_timeout(1200)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'guardian'}}))"); page.wait_for_selector("[data-testid=scam-check]", timeout=8000)
    check(page.locator("[data-testid=guardian-page] [data-testid=scam-check]").count() == 1, "Money Guardian has “Is this a scam?”")
    page.fill("[data-testid=scam-text]", "مبروك! كسبت ٥٠٠٠ جنيه من إنستاباي 🎉 ابعت كود التفعيل اللي هيوصلك في رسالة عشان نحوّلك المبلغ: instapay-gift.co")
    page.click("[data-testid=scam-go]"); page.wait_for_timeout(300)
    rs = page.inner_text("[data-testid=scam-result]")
    check(page.locator("[data-testid=scam-result][data-level=scam]").count() == 1 and "instapay-gift.co" in rs and page.locator("[data-testid=scam-reason]").count() >= 3, "the InstaPay prize message → Scam, with its reasons (the code, the prize, the fake link)")
    page.fill("[data-testid=scam-text]", "Can we meet tomorrow at 5 at the cafe?"); page.click("[data-testid=scam-go]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=scam-result][data-level=none]").count() == 1, "a normal message → no warning signs (and the reminder never to share codes)")
    f = "/tmp/v930scam.png"; open(f, "wb").write(png())
    page.set_input_files("[data-testid=scam-shot-input]", f); page.wait_for_selector("[data-testid=scam-result][data-level=scam]", timeout=6000)
    check("cib-secure-login.com" in page.inner_text("[data-testid=scam-result]") and "blocked" in page.input_value("[data-testid=scam-text]"), "a screenshot → its words are read on the phone and checked: “your card will be blocked” + a fake CIB link → Scam")
    errs = real_errors(errors)
    check(not errs, "no page errors: %s" % errs[:3])
env.close()
finish()
