import sys
from playwright.sync_api import sync_playwright
# usage: PYTHONPATH=tests/pwshim:tests python3 design/_render.py design/src/fit.html design/fit-home-options.png
import os
with sync_playwright() as p:
    br = p.chromium.launch()
    pg = br.new_page(viewport={"width": 1200, "height": 900}, device_scale_factor=1)
    for i in range(1, len(sys.argv), 2):
        pg.goto("file://" + os.path.abspath(sys.argv[i])); pg.wait_for_timeout(300)
        pg.screenshot(path=sys.argv[i + 1], full_page=True)
    br.close()
