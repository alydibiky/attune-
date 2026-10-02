"""v6.7 — Google Play Billing (a fake Play stands in for the real one): the Plan screen shows Play's
own prices and no WhatsApp; buying yearly turns Pro on by itself; a pending carrier-billing payment says
so; a business system is activated through Play and the purchase is used up; a paid purchase that
wasn't applied is offered; Fit on Free: 3 photo meals a day, the week plan and report are Pro.

  python3 tests/e2e_v67.py
"""
import json, zlib, struct
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish

env = Env()
def png(w=16, h=16):
    raw = b"".join(b"\x00" + bytes([120, 90, 60]) * w for _ in range(h))
    c = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return b"\x89PNG\r\n\x1a\n" + c(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + c(b"IDAT", zlib.compress(raw)) + c(b"IEND", b"")
PLAY = r"""
(() => { const S = window.__mock = window.__mock || {}; S.owned = S.owned || []; S.consumed = []; S.pending = PENDING;
  const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0);
    const R = (id, o) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify(o)), 20);
    N.storeProducts = (id) => R(id, { items: [{ id: "attune_pro_monthly", price: "EGP 299.00" }, { id: "attune_pro_yearly", price: "EGP 2,499.00" }, { id: "attune_pro_lifetime", price: "EGP 5,999.00" }, { id: "attune_business_system", price: "EGP 14,999.00" }] });
    N.storeOwned = (id) => R(id, { items: S.owned });
    N.storeBuy = (id, arg) => { const sku = JSON.parse(arg).sku; S.bought = sku;
      if (S.pending) return R(id, { ok: false, pending: true });
      const p = { productId: sku, products: [sku], purchased: true, token: "tok-" + sku, orderId: "GPA.1" }; S.owned.push(p); R(id, { ok: true, purchase: p, productId: sku }); };
    N.storeConsume = (id, arg) => { const t = JSON.parse(arg).token; S.consumed.push(t); S.owned = S.owned.filter((x) => x.token !== t); R(id, { ok: true }); };
  }; go(); })();"""
FREE = "try { localStorage.setItem('attune:testing-pro', 'off'); localStorage.setItem('attune:first-run', String(Date.now() - 30 * 86400000)); } catch (e) {}"

def open_plan(page):
    page.locator("nav button").last.click(); page.wait_for_timeout(300)
    page.locator("text=Plan").first.click()
    page.wait_for_selector("[data-testid=upgrade]", timeout=5000)

with sync_playwright() as p:
    br = p.chromium.launch()
    # ---- 1. Pro through Google Play ----
    errors = []; ctx, page = new_page(br, env, errors, extra_init=FREE + PLAY.replace("PENDING", "false"))
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    open_plan(page)
    up = page.locator("[data-testid=upgrade]"); page.wait_for_timeout(300)
    t = up.inner_text()
    check("EGP 2,499.00" in t and "EGP 299.00" in t, "the plans show Google Play's own prices")
    check("InstaPay" not in t and "send this code" not in t and up.locator("[data-testid=buy-direct]").count() == 0, "no WhatsApp / InstaPay buying anywhere (WhatsApp is only named in the Chat X-Ray benefit)")
    check(up.locator("[data-testid=request-code]").count() == 0, "no request code to send — that's only behind 'I have an activation code'")
    up.locator("[data-testid=buy-store]").click(); page.wait_for_timeout(600)
    check(page.evaluate("window.__mock.bought") == "attune_pro_yearly", "one tap buys the yearly plan (the default)")
    check(page.locator("[data-testid=upgrade]").count() == 0 and page.locator("text=Pro active").count() >= 1, "Pro switches on by itself")
    check(not real_errors(errors), "no errors (%s)" % real_errors(errors)[:2])
    ctx.close()
    # ---- 2. a pending carrier-billing payment ----
    errors = []; ctx, page = new_page(br, env, errors, extra_init=FREE + PLAY.replace("PENDING", "true"))
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    open_plan(page); page.wait_for_timeout(300)
    page.locator("[data-testid=plan-month]").click(); page.locator("[data-testid=buy-store]").click(); page.wait_for_timeout(500)
    check(page.locator("text=Payment pending").count() >= 1, "a pending mobile-balance payment says Pro turns on when Google confirms it")
    ctx.close()
    # ---- 3. a business system through Google Play ----
    errors = []; ctx, page = new_page(br, env, errors, extra_init=FREE + PLAY.replace("PENDING", "false"))
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('Business')").first.click()
    page.wait_for_selector("[data-testid=business-page]", timeout=6000)
    page.click("[data-testid=erp-new]"); page.click("[data-testid=erp-tpl-cranes]"); page.click("[data-testid=erp-create]")
    page.wait_for_selector("[data-testid=erp-systemview]", timeout=6000)
    page.locator("[data-testid=erp-tab-more]").click(); page.wait_for_timeout(500)
    lic = page.locator("[data-testid=erp-licence]")
    check("EGP 14,999.00" in lic.inner_text(), "the system's activation shows Play's price")
    page.locator("[data-testid=erp-buy-play]").click(); page.wait_for_timeout(700)
    check("Activated" in page.locator("[data-testid=erp-licence]").inner_text(), "one tap in Play activates the system")
    check(page.evaluate("window.__mock.consumed") == ["tok-attune_business_system"], "the purchase is used up, so the next system can be bought")
    check(not real_errors(errors), "no errors (%s)" % real_errors(errors)[:2])
    ctx.close()
    # ---- 4. a paid business purchase that wasn't applied (the app closed) ----
    OWN = "window.__mock = { owned: [{ productId: 'attune_business_system', purchased: true, token: 'tok-old', orderId: 'GPA.9' }] };"
    errors = []; ctx, page = new_page(br, env, errors, extra_init=FREE + OWN + PLAY.replace("PENDING", "false"))
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('Business')").first.click()
    page.wait_for_selector("[data-testid=business-page]", timeout=6000)
    page.click("[data-testid=erp-new]"); page.click("[data-testid=erp-tpl-cranes]"); page.click("[data-testid=erp-create]")
    page.wait_for_selector("[data-testid=erp-systemview]", timeout=6000)
    page.locator("[data-testid=erp-tab-more]").click(); page.wait_for_timeout(600)
    check(page.locator("[data-testid=erp-use-purchase]").count() == 1, "a paid, unused purchase is offered: 'Use your Google Play purchase on this system'")
    page.locator("[data-testid=erp-use-purchase]").click(); page.wait_for_timeout(500)
    check("Activated" in page.locator("[data-testid=erp-licence]").inner_text() and page.evaluate("window.__mock.consumed") == ["tok-old"], "…and it activates the system")
    ctx.close()
    # ---- 5. Fit on Free ----
    STATE = {"profile": {"sex": "m", "age": 21, "cm": 178, "kg": 92, "activity": "light", "goal": "lose", "rate": 0.5, "goalKg": 80, "diet": "balanced"}, "days": {}, "weights": [], "fast": None, "myRecipes": [], "favs": [], "watchSkip": True,
             "photoUse": {"d": "__TODAY__", "n": 3}}
    SEED = "try { const s = %s; s.photoUse.d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10); if (!localStorage.getItem('attune:fit:v1')) localStorage.setItem('attune:fit:v1', JSON.stringify(s)); } catch (e) {}" % json.dumps(STATE)
    errors = []; ctx, page = new_page(br, env, errors, extra_init=FREE + SEED)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(250)
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('Fit & Food')").first.click()
    page.wait_for_selector("[data-testid=fit-today]", timeout=6000)
    page.locator("[data-testid=fit-add-lunch]").click()
    page.locator("[data-testid=fit-photo-input]").set_input_files(files=[{"name": "m.png", "mimeType": "image/png", "buffer": png()}]); page.wait_for_timeout(300)
    page.evaluate("() => { window.__mock.bodies = []; window.__mock.fakeQueue = []; }")
    page.locator("[data-testid=fit-read]").click(); page.wait_for_timeout(600)
    check(page.locator("[data-testid=upgrade]").count() == 1 and page.evaluate("(window.__mock.bodies || []).filter(b => b.max_tokens > 2).length") == 0 and page.locator("text=3 photo meals a day are free").count() == 1, "after 3 photo meals today, Free opens the plan instead of reading a 4th (no model call)")
    page.locator("[data-testid=upgrade] button[aria-label=Close]").click(); page.wait_for_timeout(200)   # the plan page closes with its X
    page.locator("[data-testid=fit-log-text]").fill("2 eggs and a banana"); page.locator("[data-testid=fit-read]").click()
    page.wait_for_selector("[data-testid=fit-draft]", timeout=5000)
    check(page.locator("[data-testid=fit-draft-item]").count() == 2, "typing a meal stays free and unlimited")
    ctx.close(); br.close()
env.close()
finish()
