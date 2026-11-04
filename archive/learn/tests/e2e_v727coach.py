"""v6.27 Homework Coach: a homework page → its problems → a lesson that plays (pictures + the phone's voice) and asks the
child before showing the answer (checked by code); practice like this one, marked by code; what is hard is remembered;
a homework photo in Chat → "Teach me" → the Coach reads the photo.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v727coach.py     (SHOTS=dir for screenshots)
"""
import os, base64, json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish, HERE
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
PAGE = "1. 3(x - 2) = x + 4\n2. 1/2 + 1/3\n3. 15% of 80"
INIT = "try{localStorage.setItem('attune:start','home')}catch(e){}\n" + r"""
(() => { const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0);
  window.__said = [];
  N.speakWait = (id, arg) => { window.__said.push(JSON.parse(arg).text); setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ ok: true })), 30); };
  N.readText = (id, arg) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ text: "Homework\n1) 2x + 3 = 11\n2) 4 × 3", lines: [] })), 30);
}; go(); })();"""
def open_coach(page):
    page.locator("nav button").last.click(); page.wait_for_timeout(300)
    page.locator(".rounded-t-2xl button:has-text('Homework Coach')").first.click()
    page.wait_for_selector("[data-testid=coach-page]", timeout=5000)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    open_coach(page)
    page.click("[data-testid=coach-type]"); page.fill("[data-testid=coach-text]", PAGE); page.click("[data-testid=coach-go]")
    items = page.locator("[data-testid=coach-item-text]")
    check(items.count() == 3 and items.nth(0).input_value() == "3(x - 2) = x + 4", "the page is split into its 3 problems")
    page.locator("[data-testid=coach-teachme]").first.click(); page.wait_for_selector("[data-testid=lesson-player]")
    check("Every step checked" in page.locator("[data-testid=coach-checked]").inner_text(), "the badge says the steps were checked by exact arithmetic")
    page.click("[data-testid=lesson-play]"); page.wait_for_timeout(2500)
    said = page.evaluate("window.__said")
    check(len(said) >= 2 and any("equals" in s for s in said), "Play: the steps are spoken by the phone's voice (%d so far): %s" % (len(said), said[:2]))
    page.wait_for_selector("[data-testid=lesson-ask]", timeout=8000)
    check(page.locator("[data-testid=lesson-text]").inner_text().strip() == "x = ?", "teach-first: it stops and asks the child for x")
    page.fill("[data-testid=lesson-answer]", "4"); page.click("[data-testid=lesson-check]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=lesson-wrong]").count() == 1, "a wrong answer (4) is marked 'not yet'")
    page.fill("[data-testid=lesson-answer]", "5"); page.click("[data-testid=lesson-check]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=lesson-right]").count() == 1, "…5 is right")
    page.click("[data-testid=lesson-next]"); page.wait_for_timeout(300)
    check("both sides are 9" in page.locator("[data-testid=lesson-rule]").inner_text(), "the last step checks x = 5 in both sides")
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, "coach-lesson.png"))
    # pictures: the fractions lesson draws the bars
    page.locator("[data-testid=coach-teachme]").nth(1).click(); page.wait_for_timeout(300)
    for _ in range(4):
        if page.locator("[data-testid=lesson-player] svg[aria-label=fractions]").count(): break
        if page.locator("[data-testid=lesson-next]").is_enabled(): page.click("[data-testid=lesson-next]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=lesson-player] svg[aria-label=fractions]").count() == 1, "1/2 + 1/3 shows the fraction bars")
    # practice
    q = page.locator("[data-testid=coach-practice-item]")
    check(q.count() == 3, "3 practice problems like this one")
    ans = page.evaluate("""() => { const t = document.querySelector('[data-testid=coach-practice-item] span').innerText; return t; }""")
    page.locator("[data-testid=coach-practice-answer]").first.fill("999"); page.locator("[data-testid=coach-practice-check]").first.click(); page.wait_for_timeout(200)
    c = page.evaluate("JSON.parse(localStorage.getItem('attune:coach:v1'))")
    check(c["topics"].get("fractions", {}).get("wrong") == 1, "a wrong practice answer is remembered under fractions")
    # Chat: a homework photo → Teach me → the Coach reads it
    page.locator("nav button:has-text('Chat')").click(); page.wait_for_timeout(300)
    png = page.evaluate("""() => { const c = document.createElement('canvas'); c.width = 200; c.height = 100; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0,0,200,100); return c.toDataURL('image/png').split(',')[1]; }""")
    path = os.path.join(HERE, "_hw.png"); open(path, "wb").write(base64.b64decode(png))
    page.set_input_files("input[type=file][accept='image/*']", path); os.remove(path)
    page.locator("textarea[placeholder='Message Attune']").fill("help me with my homework"); page.locator("button[title='Send']").click(); page.wait_for_timeout(500)
    page.locator("[data-testid=card-emerald] button:has-text('Teach me')").last.click()
    page.wait_for_selector("[data-testid=coach-items]", timeout=8000)
    t = page.locator("[data-testid=coach-item-text]").all()
    check(len(t) == 2 and t[0].input_value() == "2x + 3 = 11", "Chat's homework photo is read in the Coach: %s" % [x.input_value() for x in t])
    ctx.close()
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
