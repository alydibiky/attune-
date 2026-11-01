"""v8.9 (Ali: "the app is not reading notifications — make it a pop up in the app to allow it"): on the phone, while Notification
access is off, a card asks a few seconds after opening; Allow opens Android's switch; Not now waits 3 days."""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, finish
env = Env(); errors = []
STUB = "window.__opened=0;window.AttuneNative=window.AttuneNative||{};window.AttuneNative.payAccess=()=>false;window.AttuneNative.openPayAccess=()=>{window.__opened++};window.AttuneNative.openAppInfo=()=>{};"
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=STUB)
    page.goto(env.url); page.wait_for_timeout(4200)
    if page.locator("[data-testid=notif-ask]").count():
        check(True, "the card asks while access is off")
        page.click("[data-testid=notif-ask-allow]"); page.wait_for_timeout(200)
        check(page.evaluate("window.__opened") == 1, "Allow opens Android's Notification access switch")
        page.reload(); page.wait_for_timeout(4200)
        check(page.locator("[data-testid=notif-ask]").count() == 1, "still off → asked again next time")
        page.click("[data-testid=notif-ask-later]"); page.reload(); page.wait_for_timeout(4200)
        check(page.locator("[data-testid=notif-ask]").count() == 0, "Not now → not asked again for 3 days")
    else:
        check(False, "the card asks while access is off (the page did not show it — the stub may not reach NATIVE)")
    ctx.close(); br.close()
env.close(); finish()
