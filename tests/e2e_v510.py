"""v5.10 — the fixes from Ali's phone test (25 Sep 2026):
  layout:  nothing on any screen is wider than the phone; no blank sections
  scroll:  a streaming answer does not pull you back down while you read
  typing:  the text box sits on the keyboard, the bottom bar steps aside
  loops:   a repeating answer is stopped and trimmed; math shows as math
  verify:  math word problems are checked by running code; code is tested
  photo:   a photo question with Web on looks at the photo first

  python3 tests/e2e_v510.py [layout] [scroll] [typing] [loops] [verify] [photo]
"""
import re, sys, json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish, HERE

SECTIONS = sys.argv[1:] or ["layout", "layout-ar", "scroll", "typing", "loops", "verify", "photo"]
env = Env()
errors = []

def install(page):
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)

WIDE = """() => {
  const W = window.innerWidth, out = [];
  const inScroller = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(s.overflowX) && p !== document.body && p !== document.documentElement) return true; } return false; };
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    if (getComputedStyle(el).position === 'fixed' && r.right <= W + 1) continue;
    if (r.right > W + 1 && !inScroller(el)) out.push((el.tagName + '.' + (el.className && el.className.baseVal === undefined ? String(el.className) : '')).slice(0, 80) + ' → ' + Math.round(r.right) + ' "' + (el.innerText || '').slice(0, 40).replace(/\\n/g, ' ') + '"');
  }
  return { sw: document.documentElement.scrollWidth, W, out: out.slice(0, 8) };
}"""

def sec_layout(br, lang="en"):
    ctx = br.new_context(viewport={"width": 360, "height": 780}, device_scale_factor=3, is_mobile=True, has_touch=True)
    ctx.add_init_script(env.mock); ctx.add_init_script("try{localStorage.setItem('attune:onboarded','1')}catch(e){}")
    if lang == "ar": ctx.add_init_script("try{localStorage.setItem('attune:ui:lang','ar')}catch(e){}")
    page = ctx.new_page(); page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    bad = {}
    def audit(name):
        page.wait_for_timeout(250)
        r = page.evaluate(WIDE)
        if r["sw"] > r["W"] + 1 or r["out"]: bad[name] = r
    audit("chat")
    for i, tab in enumerate(["Instant", "Money", "Memory"]):
        page.locator("nav button").nth(i + 1).click(); audit(tab)
    page.locator("nav button").last.click(); page.wait_for_timeout(300)
    tools = page.evaluate("""() => [...document.querySelectorAll('.rounded-t-2xl .grid.grid-cols-3 > button')].map(b => (b.querySelector('span') || {}).innerText).filter(Boolean)""")
    page.mouse.click(180, 60); page.wait_for_timeout(200)
    print("   tools:", tools)
    for ti, t in enumerate(tools):
        page.locator("nav button").last.click(); page.wait_for_timeout(150)
        btn = page.locator(".rounded-t-2xl .grid button").filter(has_text=t).first
        if not btn.count(): continue
        btn.click(); page.wait_for_timeout(300); audit(t)
        if ti >= len(tools) - 4:   # Engine, profile, plan, backup open over the page
            page.evaluate("window.__attuneBack && window.__attuneBack()"); page.wait_for_timeout(200)
        if t == "Travel":
            # a country pack, the screen from the screenshot
            try:
                page.locator("button:has-text('Turkey')").first.click(timeout=2000); audit("Travel · Turkey")
            except Exception: pass
    page.evaluate("window.__attuneBack && window.__attuneBack()"); page.wait_for_timeout(200)
    page.locator("header button:has(svg)").nth(1).click(); audit("Engine")
    for k, v in bad.items(): print("   wider than the phone on", k, v)
    check(not bad, "%sno screen is wider than a 360 px phone (%d screens checked)" % ("Arabic: " if lang == "ar" else "", len(tools) + 5))
    page.screenshot(path=HERE + "/v510-layout.png")
    ctx.close()

import random
_W = "crane load chart radius boom length capacity outrigger ground bearing mat counterweight sling angle wind speed hook block jib luffing slew tonnes metres operator banksman lift plan".split()
_r = random.Random(7)
LONG = "\n\n".join(" ".join(_r.choice(_W) for _ in range(40)).capitalize() + "." for i in range(40))   # varied text (identical lines would be caught as a loop)

def sec_scroll(br):
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    install(page)
    page.evaluate("(t) => { const M = window.__mock; M.fakeQueue = [t]; }", LONG)
    page.evaluate("() => { const M = window.__mock; M.slowQueue = 30; }")
    comp = page.locator("textarea[placeholder='Message Attune']")
    comp.fill("explain load charts at length"); page.locator("button[title='Send']").click()
    page.wait_for_function("document.documentElement.scrollHeight > window.innerHeight * 2", timeout=40000)
    page.wait_for_timeout(300)
    at_bottom = page.evaluate("document.documentElement.scrollHeight - scrollY - innerHeight")
    check(at_bottom < 80, "while you don't touch it, the answer is followed to the bottom (gap %d px)" % at_bottom)
    # the reader scrolls up to read
    page.mouse.move(200, 400); page.mouse.wheel(0, -1500); page.wait_for_timeout(200)
    y0 = page.evaluate("scrollY")
    page.wait_for_timeout(1200)
    y1 = page.evaluate("scrollY")
    check(abs(y1 - y0) < 5, "after scrolling up, new words no longer pull the page down (%d → %d)" % (y0, y1))
    check(page.locator("[data-testid=jump-bottom]").count() == 1, "a ↓ button offers the newest words")
    page.click("[data-testid=jump-bottom]"); page.wait_for_timeout(400)
    gap = page.evaluate("document.documentElement.scrollHeight - scrollY - innerHeight")
    check(gap < 80, "↓ goes back to following the answer (gap %d px)" % gap)
    page.wait_for_selector("button[title='Regenerate']", timeout=30000)
    ctx.close()

def sec_typing(br):
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("[data-testid=chat-input]").click()
    page.wait_for_timeout(300)
    check(not page.locator("nav").first.is_visible(), "while typing, the bottom bar steps aside for the keyboard")
    box = page.locator("[data-testid=composer]").bounding_box()
    vh = page.evaluate("innerHeight")
    check(box["y"] + box["height"] > vh - 20, "the text box sits at the very bottom, right on the keyboard")
    page.keyboard.type("hello crane")
    check(page.locator("[data-testid=chat-input]").input_value() == "hello crane" and page.locator("[data-testid=chat-input]").is_visible(), "what you type is shown")
    page.locator("[data-testid=chat-input]").blur(); page.wait_for_timeout(450)
    check(page.locator("nav").first.is_visible(), "the bottom bar comes back when you stop typing")
    ctx.close()

FN = {"layout": sec_layout, "layout-ar": lambda br: sec_layout(br, "ar"), "scroll": sec_scroll, "typing": sec_typing}

if __name__ == "__main__":
    import e2e_v510_more as more   # loops / verify / photo
    FN.update(more.sections(env, errors))
    with sync_playwright() as pw:
        br = pw.chromium.launch()
        for s in SECTIONS:
            print(f"--- {s}", flush=True)
            try: FN[s](br)
            except Exception as e: check(False, f"{s} section crashed: {str(e)[:300]}")
        br.close()
    env.close()
    re_ = real_errors(errors)
    for e in re_[:20]: print("   ", e)
    check(len(re_) == 0, "no JavaScript errors in the page (%d)" % len(re_))
    finish()
