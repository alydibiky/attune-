"""v6.37 (upgrade W3) — Site reports: the mic button, photos stamped with time + place, the PDF button.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v740site.py
"""
import base64, struct, zlib
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
def png(w, h):
    raw = b"".join(b"\x00" + b"\x80\x40\x20" * w for _ in range(h))
    c = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return b"\x89PNG\r\n\x1a\n" + c(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + c(b"IDAT", zlib.compress(raw)) + c(b"IEND", b"")
GEO = "try{navigator.geolocation.getCurrentPosition=function(ok){ok({coords:{latitude:30.0444,longitude:31.2357}})}}catch(e){}"
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=GEO)
    page.goto(env.url); page.wait_for_timeout(1200)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'field'}}))")
    page.wait_for_selector("[data-testid=site-photos]", timeout=8000)
    check(page.locator("[data-testid=site-mic]").count() == 1, "the mic button is next to the notes")
    page.set_input_files("[data-testid=site-photo-file]", files=[{"name": "a.png", "mimeType": "image/png", "buffer": png(40, 30)}, {"name": "b.png", "mimeType": "image/png", "buffer": png(30, 40)}])
    page.wait_for_selector("[data-testid=site-photo]", timeout=6000); page.wait_for_timeout(300)
    check(page.locator("[data-testid=site-photo]").count() == 2, "two photos added")
    s = page.locator("[data-testid=site-photo-stamp]").first.inner_text()
    check("30.04" in s and "31.23" in s, "each photo is stamped with the place: %s" % s)
    check(page.locator("[data-testid=site-pdf]").count() == 0, "no PDF button before there is a report")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
