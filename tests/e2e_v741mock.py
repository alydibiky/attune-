"""v6.41 S5 the scored mock interview (CV → Job ready): 5 questions said aloud; each answer scored by code (story, fillers,
confidence, pace); a scorecard with one tip; a better answer from the person's own facts on request.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v741mock.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
SEC = lambda t, items: {"id": "s" + t, "type": t, "title": t, "visible": True, "items": items}
CV = {"id": "cv1", "name": "My CV", "lang": "en", "page": "A4", "layout": "ats", "theme": "teal", "font": "sans", "fontSize": 10.5, "spacing": "normal", "margin": 14, "fit": 1, "photo": "", "showPhoto": False, "updated": 1,
      "basics": {"name": "Sara Adel", "title": "Data analyst", "email": "s@example.com", "phone": "", "city": "Cairo", "links": []},
      "sections": [SEC("summary", [{"text": "Data analyst."}]), SEC("experience", []), SEC("education", []), SEC("skills", []), SEC("languages", []), SEC("certs", [])], "target": {"role": "Data analyst"}}
INIT = "try{localStorage.setItem('attune:cv:v1',%s)}catch(e){}\nwindow.__said=[];(() => { const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0); N.speakWait = (id, arg) => { window.__said.push(JSON.parse(arg).text); setTimeout(() => window.__attuneNative.resolve(id, '{}'), 30); }; }; go(); })();" % json.dumps(json.dumps([CV]))
GOOD = "When I joined Fawry the regional sales reports took three days every month. I decided to build a Power BI dashboard on our SQL database and I trained the six regional managers to use it. As a result the report takes ten minutes, and managers cut stock-outs by 18 percent in one quarter."
WEAK = "Um, I think, like, maybe I am good with data, you know, kind of."
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(250)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'cv'}}))")
    page.wait_for_selector("[data-testid=cv-page]", timeout=6000)
    page.locator("[data-testid=cv-row] button").first.click(); page.wait_for_selector("[data-testid=cv-editor]")
    page.click("[data-testid=cv-tab-job]")
    page.click("[data-testid=mock-start]"); page.wait_for_selector("[data-testid=mock-q]")
    page.wait_for_timeout(200)
    check(page.evaluate("window.__said[0]") == page.locator("[data-testid=mock-q]").inner_text(), "the first question is said aloud")
    for k in range(5):
        page.fill("[data-testid=mock-answer]", GOOD if k % 2 == 0 else WEAK)
        page.click("[data-testid=mock-next]"); page.wait_for_timeout(120)
    page.wait_for_selector("[data-testid=mock-card]", timeout=3000)
    total = int(page.locator("[data-testid=mock-total]").inner_text())
    check(len(page.evaluate("window.__said")) == 5, "all 5 questions were said aloud")
    check(page.locator("[data-testid=mock-row]").count() == 5 and 30 < total < 90, "5 answers scored, total %d" % total)
    check(len(page.locator("[data-testid=mock-tip]").inner_text()) > 20, "one tip: " + page.locator("[data-testid=mock-tip]").inner_text())
    rows = page.locator("[data-testid=mock-row]")
    check("fillers" in rows.nth(1).inner_text(), "the weak answer shows its filler count: " + rows.nth(1).inner_text())
    page.evaluate("() => { window.__mock.bodies = []; window.__mock.fakeQueue = ['I am good with data: [number] reports a month.']; }")
    rows.nth(1).locator("[data-testid=mock-improve]").click()
    page.wait_for_selector("[data-testid=mock-better]", timeout=8000)
    sent = page.evaluate("window.__mock.bodies.filter(b => b.max_tokens > 2).map(b => b.messages[0].content)")
    check(sent and "ONLY facts" in sent[0], "the better answer is asked to use only the person's facts")
    ctx.close()
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
