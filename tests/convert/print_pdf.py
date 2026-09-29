"""v6.8 — print a page to PDF with Chromium, as the phone's WebView does (NativeBridge.htmlToPdf):
the page's own @page size and margins. python3 print_pdf.py in.html out.pdf"""
import sys, pathlib, os
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(**({"executable_path": "/opt/pw-browsers/chromium"} if os.path.exists("/opt/pw-browsers/chromium") else {}))   # cloud sessions (as tests/pwshim)
    pg = b.new_page()
    pg.goto(pathlib.Path(sys.argv[1]).resolve().as_uri())
    pg.pdf(path=sys.argv[2], prefer_css_page_size=True, print_background=True)
    b.close()
