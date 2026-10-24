"""Render a Gemini HTML mock-up (Attune's Gemini step) to PNGs: every [data-screen] section, dark + light, and the first two in
Arabic RTL. External requests (Tailwind CDN, fonts) are blocked in cloud sessions, so they are aborted — the mock-ups carry their
own CSS. Usage: python3 tools/render_mockup.py /abs/path/mockup.html /abs/out/dir   (out: <screen>-dark|light|ar.png)
"""
import sys
from playwright.sync_api import sync_playwright
src, out = sys.argv[1], sys.argv[2]
import re
SCREENS = sorted(set(re.findall(r'data-screen="([a-z0-9-]+)"', open(src).read())), key=lambda x: open(src).read().find('data-screen="'+x))
with sync_playwright() as p:
    br = p.chromium.launch()
    pg = br.new_page(viewport={"width": 1800, "height": 1000})
    pg.route("**/*", lambda r: r.abort() if r.request.url.startswith("http") else r.continue_())
    pg.goto("file://" + src); pg.wait_for_timeout(600)
    for theme in ["dark", "light"]:
        pg.evaluate(f"setTheme('{theme}')")
        for s in SCREENS:
            pg.locator(f'[data-screen="{s}"]').first.screenshot(path=f"{out}/{s}-{theme}.png")
    pg.evaluate("setTheme('dark')"); pg.evaluate("setDir('rtl')")
    [pg.locator(f'[data-screen="{x}"]').first.screenshot(path=f"{out}/{x}-ar.png") for x in SCREENS[:2]]
    br.close()
