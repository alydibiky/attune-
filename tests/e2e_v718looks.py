"""v6.18 — Fit & Food's three looks (Ali: "all 3 optional in the settings, the default is A"), the loading screen with
nutrition facts while a photo is read, and the photo with each food's name, calories and an arrow to it.

  python3 tests/e2e_v718looks.py          SHOTS=<dir> keeps a screenshot of each look
"""
import os, json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish

env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
def draw_plate():
    """A drawn plate (eggs on toast, tomato sauce, salad) — the foods sit where the mocked photo reader says."""
    import io
    from PIL import Image, ImageDraw
    im = Image.new("RGB", (800, 600), (122, 98, 80)); d = ImageDraw.Draw(im)
    d.ellipse((130, 30, 670, 570), fill=(244, 243, 239))
    d.rounded_rectangle((220, 170, 420, 340), radius=30, fill=(215, 161, 90), outline=(169, 115, 47), width=10)
    d.rounded_rectangle((380, 140, 570, 310), radius=30, fill=(220, 168, 98), outline=(169, 115, 47), width=10)
    d.ellipse((240, 190, 400, 320), fill=(255, 253, 246)); d.ellipse((295, 230, 345, 280), fill=(242, 178, 42))
    d.ellipse((400, 165, 550, 285), fill=(255, 253, 246)); d.ellipse((450, 200, 500, 250), fill=(242, 178, 42))
    d.ellipse((440, 360, 580, 470), fill=(194, 64, 43))
    for b, c in [((230, 380, 330, 440), (95, 168, 59)), ((290, 410, 390, 470), (62, 138, 44)), ((220, 430, 300, 480), (121, 191, 78))]: d.ellipse(b, fill=c)
    out = io.BytesIO(); im.save(out, "PNG"); return out.getvalue()
PLATE = draw_plate()
PROFILE = json.dumps({"profile": {"sex": "m", "age": 21, "cm": 178, "kg": 92, "activity": "light", "goal": "lose", "rate": 0.5, "goalKg": 80, "diet": "balanced"}, "days": {}, "weights": [], "fast": None, "myRecipes": [], "favs": []})
AI = json.dumps({"kind": "meal", "plate": "dinner plate", "items": [
    {"food": "Fried egg", "count": 2, "grams": 92, "confidence": 0.8, "box": [0.30, 0.27, 0.40, 0.25]},
    {"food": "White toast bread", "count": 2, "grams": 56, "confidence": 0.7, "box": [0.27, 0.23, 0.45, 0.35]},
    {"food": "Tomato sauce", "grams": 30, "confidence": 0.6, "box": [0.55, 0.60, 0.18, 0.18]},
    {"food": "Green salad", "grams": 100, "confidence": 0.6, "box": [0.27, 0.63, 0.22, 0.17]}], "label": None})

def shot(page, name):
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, name + ".png"), full_page=False)

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init="try { localStorage.setItem('attune:fit:v1', %s); } catch (e) {}" % json.dumps(PROFILE))
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(250)
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('Fit & Food')").first.click()
    page.wait_for_selector("[data-testid=fit-today]", timeout=6000)

    check(page.locator("[data-testid=fit-app]").get_attribute("data-look") == "fresh", "the default look is Fresh (A)")
    bg = page.evaluate("getComputedStyle(document.body).backgroundColor")
    check(bg == "rgb(242, 246, 243)", "…a light page behind Fit (%s)" % bg)
    card = page.evaluate("getComputedStyle(document.querySelector('[data-testid=fit-app]')).getPropertyValue('--color-white').trim()")
    check(card.lower() == "#0b1a12", "…dark writing on light (the palette turned around inside Fit: %s)" % card)
    shot(page, "look-fresh-home")

    for look in ("fresh", "night", "bold", "meals", "rings"):   # (tiles shares the light labels; its home has no meal "+" buttons)
        if look != "fresh":
            page.locator("[data-testid=fit-tab-me]").click(); page.wait_for_timeout(200)
            page.locator("[data-testid=fit-look-%s]" % look).click(); page.wait_for_timeout(200)
            check(page.locator("[data-testid=fit-app]").get_attribute("data-look") == look, "%s chosen in the settings" % look)
            page.locator("[data-testid=fit-tab-today]").click(); page.wait_for_timeout(200)
            shot(page, "look-%s-home" % look)
        page.evaluate("(a) => { const M = window.__mock; M.bodies = []; M.fakeQueue = [a, JSON.stringify({items: []})]; M.slowQueue = 250; M.codes = []; }", AI)
        page.locator("[data-testid=fit-add-breakfast]").click()
        page.set_input_files("[data-testid=fit-photo-input]", {"name": "plate.png", "mimeType": "image/png", "buffer": PLATE}); page.wait_for_timeout(300)
        page.locator("[data-testid=fit-read]").click()
        page.wait_for_selector("[data-testid=fit-photo-loading]", timeout=8000)
        fact = page.locator("[data-testid=fit-fact]").inner_text()
        check(len(fact) > 40 and ("WHO" in fact or "USDA" in fact or "EFSA" in fact or "Atwater" in fact or "Thermic" in fact or "physiology" in fact or "European" in fact or "World Health" in fact),
              "%s: while the photo is read, a nutrition fact with its source: %s" % (look, fact.replace("\n", " | ")[:110]))
        page.wait_for_timeout(500); shot(page, "look-%s-loading" % look)
        page.wait_for_selector("[data-testid=fit-photo-marks]", timeout=30000); page.wait_for_timeout(500)
        marks = page.locator("[data-testid=fit-mark]")
        check(marks.count() == 4, "%s: the photo shows a label on each of the 4 foods (%d)" % (look, marks.count()))
        txt = page.locator("[data-testid=fit-photo-marks]").inner_text()
        check("Fried egg" in txt and "Tomato sauce" in txt and "180" in txt, "%s: …each with its name and calories" % look)
        # Ali 17 Oct: in the light looks the label was white text on a white pill (an empty white box)
        same = page.evaluate("() => [...document.querySelectorAll('[data-testid=fit-mark]')].filter((e) => { const s = getComputedStyle(e); return s.color === s.backgroundColor; }).length")
        check(same == 0, "%s: …each label's text is readable (not the colour of its pill: %d)" % (look, same))
        lines = page.locator("[data-testid=fit-photo-marks] svg line").count()
        check(lines >= 4, "%s: …and a line from each label to its food (%d lines)" % (look, lines))
        # the labels never cover each other (Night's first try put them beside the pins: they overlapped)
        rects = page.evaluate("() => [...document.querySelectorAll('[data-testid=fit-mark]')].map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; })")
        overlap = any(a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3] for i, a in enumerate(rects) for b in rects[i + 1:])
        check(not overlap, "%s: …no two labels overlap" % look)
        if look == "night": check(page.locator("[data-testid=fit-pin-no]").count() == 4, "night: numbered pins, the same numbers in the list")
        shot(page, "look-%s-result" % look)
        page.locator("[data-testid=fit-confirm]").click(); page.wait_for_timeout(300)

    # one dish from the fast look (no position): its label points at the middle of the plate
    page.evaluate("""() => { localStorage.setItem('attune:fit:v1', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('attune:fit:v1')), {look: 'fresh'}))); }""")
    check(real_errors(errors) == [], "no errors: %s" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
