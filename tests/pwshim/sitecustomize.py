# Playwright → the pre-installed Chromium in Claude Code cloud sessions (ignored when it isn't there).
import os
if os.path.exists("/opt/pw-browsers/chromium"):
    from playwright.sync_api._generated import BrowserType
    _orig = BrowserType.launch
    def launch(self, *a, **k):
        k.setdefault("executable_path", "/opt/pw-browsers/chromium")
        return _orig(self, *a, **k)
    BrowserType.launch = launch
