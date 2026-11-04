"""v6.7 — Google Play Billing (a fake Play stands in for the real one): the Plan screen shows Play's
own prices and no WhatsApp; buying yearly turns Pro on by itself; a pending carrier-billing payment says
so; a business system is activated through Play and the purchase is used up; a paid purchase that
wasn't applied is offered; Fit on Free: 3 photo meals a day, the week plan and report are Pro.

  python3 tests/e2e_v67.py
"""
import json, zlib, struct
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish, to_tables

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
    page.locator("[data-testid=more-settings] button").nth(2).click()   # v6.27: "text=Plan" also matched "People & plans"
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
    # (v9.1: this section used Business — archived with it in archive/business/tests/mixed/e2e_v67.py)
    check(not real_errors(errors), "no errors (%s)" % real_errors(errors)[:2])
    ctx.close()
    # (v9.1: this section used Business — archived with it in archive/business/tests/mixed/e2e_v67.py)
    ctx.close()
    # (v9.1: this section used Fit & Food — archived with it in archive/fit/tests/mixed/e2e_v67.py)
    ctx.close(); br.close()
env.close()
finish()
