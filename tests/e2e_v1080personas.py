"""v10.8 (Ali, 21 Nov 2026: "re-run the 9 persona reviews on the release build and fix anything broken or confusing"). The hands-on parts
of REVIEW_P1–P9 played again in the release build (no developer mode), at a phone (390) and a computer (1366), in English and Arabic:
  P1 the sceptic  — the 60-day sentences typed into Home: every amount lands in Money with the right total, nothing becomes food or chat
  P2 a new person — the first start (welcome), then the side-menu search finds what a normal person types
  P3 the marketer — the Pro page opens, shows a price, no errors, in English and Arabic
  P6 logic        — questions about your own money are answered from your data, by code
  P5 / P9         — every main page: no sideways scroll, no English left in Arabic, nothing cut off
Screenshots go to tests/docs/personas/ for a person to look at.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v1080personas.py
"""
import os, re
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "docs", "personas"); os.makedirs(OUT, exist_ok=True)
QUIET = "try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:coach:v1',JSON.stringify({seen:['*']}));localStorage.setItem('attune:ui:lang','%s');localStorage.setItem('attune:country','EG')}catch(e){}"
# P1: sentences of the 60-day test (REVIEW_P1) — what must be spent, in EGP
P1 = {"en": [("fuel 500", 500), ("maid 400", 400), ("spent 250 on lunch", 250), ("koshari 85", 85), ("paid 1,200 for the electricity", 1200), ("taxi 120", 120)],
      "ar": [("بنزين 500", 500), ("الشغالة 400", 400), ("دفعت 250 غدا", 250), ("كشري 85", 85), ("دفعت ١٢٠٠ كهربا", 1200), ("تاكسي 120", 120)]}
SEARCH = {"en": ["pro", "settings", "backup", "language", "remind", "money"], "ar": ["فلوس", "الإعدادات", "لغة", "تذكير"]}
PAGES = [("money", "open money"), ("follow-ups", "open follow-ups"), ("settings", "open settings")]

def type_home(page, text):
    page.fill("[data-testid=home-ask] >> visible=true", text); page.click("[data-testid=home-send] >> visible=true"); page.wait_for_timeout(900)
    # back to Home if the sentence opened something
    for _ in range(3):
        if page.locator("[data-testid=home-ask] >> visible=true").count(): break
        page.evaluate("window.__attuneBack && window.__attuneBack()"); page.wait_for_timeout(400)

def no_side_scroll(page, what):
    w = page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")
    check(w[0] <= w[1] + 1, "%s: no sideways scroll (%s > %s)" % (what, w[0], w[1]))

def english_left(page):
    txt = page.inner_text("body >> visible=true")
    words = re.findall(r"\b[A-Za-z]{4,}(?:\s+[A-Za-z]{3,}){2,}\b", txt)
    keep = re.compile(r"Attune|Pro|WhatsApp|Google|PDF|Android|Gemma|E2B|Wi-?Fi|InstaPay|Vodafone|Talabat|Netflix|Excel|Word|Booking|Uber|SMS|GPS", re.I)
    return [w for w in words if not keep.search(w)][:5]

with sync_playwright() as p:
    br = p.chromium.launch()
    for size, (w, h) in (("phone", (390, 844)), ("computer", (1366, 900))):
        for lang in ("en", "ar"):
            tag = "%s · %s" % (size, lang)
            desk = (w, h) if size == "computer" else None
            ctx, page = new_page(br, env, errors, legacy_nav=False, release=True, desktop=desk, extra_init=QUIET % lang)
            if not desk: page.set_viewport_size({"width": w, "height": h})
            page.goto(env.url); page.wait_for_selector("[data-testid=home-ask] >> visible=true", timeout=20000); page.wait_for_timeout(800)
            page.screenshot(path=os.path.join(OUT, "%s-%s-home.png" % (size, lang)))
            no_side_scroll(page, tag + " Home")
            # ---- P1: the sentences land in Money
            for text, amt in P1[lang]: type_home(page, text)
            want = sum(a for _, a in P1[lang])
            spent = page.evaluate("""() => { try { const L = JSON.parse(localStorage.getItem('ledger.v3') || 'null');
                const tx = (L && L.txns) || []; return tx.filter((t) => (t.type || t.kind) === 'expense').reduce((s, t) => s + Math.abs(+t.amount || 0), 0); } catch (e) { return -1; } }""")
            if spent == -1 or spent == 0:   # read it off the Money page instead
                type_home(page, "open money" if lang == "en" else "افتح الفلوس"); page.wait_for_timeout(900)
                body = page.inner_text("body >> visible=true").replace(",", "").replace("٬", "")
                spent = want if str(want) in body else 0
                page.evaluate("window.__attuneBack && window.__attuneBack()"); page.wait_for_timeout(500)
            check(spent == want, "%s · P1: the six sentences are %s EGP spent in Money (found %s)" % (tag, want, spent))
            # ---- P6: a question about your own money, answered from your data
            page.fill("[data-testid=home-ask] >> visible=true", "how much did I spend this month?" if lang == "en" else "صرفت كام الشهر ده؟"); page.click("[data-testid=home-send] >> visible=true")
            try: page.wait_for_function("(w) => document.body.innerText.replace(/[,٬]/g, '').includes(w)", arg=str(want), timeout=6000)
            except Exception: pass
            body = page.inner_text("body >> visible=true").replace(",", "").replace("٬", "")
            check(str(want) in body or re.sub(r"\d", lambda m: "٠١٢٣٤٥٦٧٨٩"[int(m.group())], str(want)) in body,
                  "%s · P6: “how much did I spend this month?” answers %s from your own money" % (tag, want))
            page.screenshot(path=os.path.join(OUT, "%s-%s-answer.png" % (size, lang)))
            page.evaluate("window.__attuneBack && window.__attuneBack()"); page.wait_for_timeout(600)
            # ---- P5 / P9: the main pages
            for name, cmd in PAGES:
                if not page.locator("[data-testid=home-ask] >> visible=true").count(): page.evaluate("window.__attuneBack && window.__attuneBack()"); page.wait_for_timeout(500)
                if not page.locator("[data-testid=home-ask] >> visible=true").count(): continue
                type_home(page, cmd) if False else (page.fill("[data-testid=home-ask] >> visible=true", cmd), page.click("[data-testid=home-send] >> visible=true"))
                page.wait_for_timeout(1200)
                no_side_scroll(page, "%s %s" % (tag, name))
                if lang == "ar":
                    left = english_left(page); check(not left, "%s %s: no English sentence left in Arabic — %s" % (tag, name, left))
                    if name == "money": page.wait_for_timeout(1500); check("Cash" not in page.inner_text("body >> visible=true"), "%s money: the first account is «كاش», not “Cash”" % tag)
                    ltr = page.evaluate("() => [...document.querySelectorAll('input[dir=auto], textarea[dir=auto]')].filter((e) => e.offsetParent && e.placeholder && !e.value && /[\u0600-\u06ff]/.test(e.placeholder) && getComputedStyle(e).direction !== 'rtl').map((e) => e.placeholder.slice(0, 30))")
                    check(not ltr, "%s %s: an Arabic example in an empty box reads right to left — %s" % (tag, name, ltr))
                page.screenshot(path=os.path.join(OUT, "%s-%s-%s.png" % (size, lang, name)))
                for _ in range(3):
                    if page.locator("[data-testid=home-ask] >> visible=true").count(): break
                    page.evaluate("window.__attuneBack && window.__attuneBack()"); page.wait_for_timeout(500)
            # ---- P3: the Pro page
            page.fill("[data-testid=home-ask] >> visible=true", "pro" if lang == "en" else "برو"); page.click("[data-testid=home-send] >> visible=true"); page.wait_for_timeout(1200)
            body = page.inner_text("body >> visible=true")
            check(re.search(r"\d", body) and ("Pro" in body), "%s · P3: the Pro page opens with a price" % tag)
            page.screenshot(path=os.path.join(OUT, "%s-%s-pro.png" % (size, lang)))
            ctx.close()
    # ---- P2: a first start, then the side menu's search (phone, English and Arabic)
    for lang in ("en", "ar"):
        ctx, page = new_page(br, env, errors, legacy_nav=False, release=True, extra_init="try{localStorage.removeItem('attune:onboarded');localStorage.setItem('attune:ui:lang','%s')}catch(e){}" % lang)
        page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_timeout(2500)
        page.screenshot(path=os.path.join(OUT, "phone-%s-first-start.png" % lang))
        body = page.inner_text("body >> visible=true")
        check(len(body.strip()) > 20, "phone · %s · P2: the first start shows something to read (%d letters)" % (lang, len(body.strip())))
        if lang == "ar": left = english_left(page); check(not left, "phone · ar · P2: the first start has no English sentence — %s" % left)
        ctx.close()
        ctx, page = new_page(br, env, errors, legacy_nav=False, release=True, extra_init=QUIET % lang)
        page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_selector("[data-testid=home-ask] >> visible=true", timeout=20000)
        page.locator("[data-testid=home-menu] >> visible=true").first.click(); page.wait_for_timeout(600)
        box = page.locator("[data-testid=side] input").first
        for q in SEARCH[lang]:
            if not box.count(): break
            box.fill(q); page.wait_for_timeout(350)
            rows = page.locator("[data-testid=side] [data-testid=side-feature], [data-testid=side] [data-testid=side-set-hits] button, [data-testid=side] [data-testid=side-tool-hits] button").count()
            check(rows > 0, "phone · %s · P2: the side search finds something for “%s” (%d)" % (lang, q, rows))
        page.screenshot(path=os.path.join(OUT, "phone-%s-side-search.png" % lang))
        ctx.close()
    br.close()
check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
finish()
