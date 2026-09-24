"""Opens every screen in Arabic and lists English that is still showing.

  python3 tests/i18n_crawl.py [out.json]

Two lists: 'missing' = strings passed to tr() with no Arabic entry;
'raw' = visible text with Latin words that never went through tr() at all
(to be wrapped by hand, or left if it's a brand/model name).
"""
import json, sys, re
from playwright.sync_api import sync_playwright
from harness import Env, new_page

OUT = sys.argv[1] if len(sys.argv) > 1 else None
env = Env()
errors = []
INIT = "window.__trMiss = new Set(); try{localStorage.setItem('attune:ui:lang','ar')}catch(e){}"
VISIBLE = r"""() => {
  const out = new Set();
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const t = n.nodeValue.trim(); if (!t || !/[A-Za-z]{3}/.test(t)) continue;
    const el = n.parentElement; if (!el || el.closest('script,style,textarea,[data-i18n-skip]')) continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    out.add(t);
  }
  document.querySelectorAll('input[placeholder],textarea[placeholder]').forEach((e) => { if (/[A-Za-z]{3}/.test(e.placeholder)) out.add('placeholder: ' + e.placeholder); });
  return [...out];
}"""
missing, raw = set(), set()

def grab(page):
    try:
        missing.update(page.evaluate("[...(window.__trMiss||[])]"))
        raw.update(page.evaluate(VISIBLE))
    except Exception as e:
        print("grab failed", e)

with sync_playwright() as pw:
    br = pw.chromium.launch()
    # First run: onboarding
    ctx, page = new_page(br, env, errors, extra_init=INIT + ";localStorage.removeItem('attune:onboarded')")
    page.goto(env.url); page.wait_for_timeout(1500)
    for _ in range(7):
        grab(page)
        b = page.locator("button:has-text('التالي'), button:has-text('Next')")
        if b.count(): b.first.click()
        else:
            opts = page.locator(".fixed.inset-0 .flex-wrap button")
            if opts.count(): opts.first.click()
        page.wait_for_timeout(250)
    grab(page); ctx.close()

    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000); page.wait_for_timeout(500)
    grab(page)
    page.evaluate("window.__mock.fake = 'Hello **there**.'")
    page.locator("nav button").first.click()
    ta = page.locator("textarea").last
    ta.fill("test"); page.keyboard.press("Enter"); page.wait_for_timeout(1500); grab(page)
    for sel in ["header button[aria-label]"]:
        for i in range(page.locator(sel).count()):
            try:
                page.locator(sel).nth(i).click(timeout=2000); page.wait_for_timeout(300); grab(page)
                page.evaluate("window.__attuneBack && window.__attuneBack()"); page.wait_for_timeout(200)
            except Exception: pass
    navn = page.locator("nav button").count()
    for i in range(navn - 1):
        page.locator("nav button").nth(i).click(); page.wait_for_timeout(700); grab(page)
    # Engine (native), Profile, Plan, Backup — all panels opened from the header chip / More
    try:
        page.locator("header button").filter(has_text="لا يوجد نموذج").first.click(); page.wait_for_timeout(500); grab(page)
        page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)
    except Exception as e: print("engine", e)
    for label in ["ملفك الشخصي", "الخطة", "النسخ الاحتياطي", "Pro"]:
        try:
            page.locator("nav button").last.click(); page.wait_for_timeout(250)
            page.locator(".rounded-t-2xl button").filter(has_text=label).first.click(timeout=1500); page.wait_for_timeout(400); grab(page)
            for _ in range(2): page.evaluate("window.__attuneBack && window.__attuneBack()"); page.wait_for_timeout(150)
        except Exception as e: print("panel", label, str(e)[:80])
    # every tool in More
    page.locator("nav button").last.click(); page.wait_for_timeout(300); grab(page)
    n = page.locator(".rounded-t-2xl button").count()
    for i in range(n):
        try:
            page.locator("nav button").last.click(); page.wait_for_timeout(250)
            btns = page.locator(".rounded-t-2xl button")
            if i >= btns.count(): break
            if btns.nth(i).get_attribute("data-lang"): continue
            btns.nth(i).click(); page.wait_for_timeout(600); grab(page)
            # open every tab/chip inside a tool once (only buttons without side effects are fine here)
            for j in range(min(page.locator("main button, section button").count(), 25)):
                try:
                    b = page.locator("main button, section button").nth(j)
                    txt = (b.inner_text(timeout=500) or "")
                    if re.search(r"Delete|حذف|Clear|مسح|Remove|Reset|Install|تثبيت|Download|Buy|Pay", txt): continue
                    b.click(timeout=800); page.wait_for_timeout(120)
                except Exception: pass
            grab(page)
            for _ in range(3): page.evaluate("window.__attuneBack && window.__attuneBack()"); page.wait_for_timeout(120)
        except Exception as e:
            print("tool", i, "failed:", str(e)[:120])
    grab(page)
    br.close()
env.close()
res = {"missing": sorted(missing), "raw": sorted(raw - missing)}
print(len(res["missing"]), "missing;", len(res["raw"]), "raw")
if OUT: json.dump(res, open(OUT, "w"), ensure_ascii=False, indent=1)
else: print(json.dumps(res, ensure_ascii=False, indent=1)[:6000])
