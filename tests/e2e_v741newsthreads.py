"""v6.41 D4 News story threads: the same story over days is one thread (each day's headlines by source); "What changed since …"
is written from those articles only and cites them.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v741newsthreads.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
t = datetime.date.today(); D = lambda n: (t + datetime.timedelta(days=n)).isoformat()
TOPIC = {"id": "n1", "query": "Egypt economy", "lang": "en", "time": "08:30", "created": 1, "notify": False, "digests": [
    {"day": D(-1), "at": 1, "text": "**Rates cut**\n- The CBE cut rates [1]", "items": [
        {"title": "Central Bank of Egypt cuts interest rates by 2%", "url": "https://ahram.org.eg/a1", "source": "Ahram Online", "text": "The CBE cut the overnight deposit rate by 200 basis points to 22%."}]},
    {"day": D(-2), "at": 1, "text": "**Expectations**\n- A cut is expected [1]", "items": [
        {"title": "Analysts expect Central Bank to cut interest rates on Thursday", "url": "https://reuters.com/b1", "source": "Reuters", "text": "A Reuters poll of 15 economists expects a 100–200 bp cut."},
        {"title": "Metro line 4 tunnel works", "url": "https://ahram.org.eg/b2", "source": "Ahram Online", "text": ""}]}]}
INIT = "try{localStorage.setItem('attune:daily:news:v1'," + json.dumps(json.dumps([TOPIC])) + ")}catch(e){}"
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(250)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'news'}}))")
    page.wait_for_selector("[data-testid=news-topic-item]", timeout=6000); page.click("[data-testid=news-topic-item]")
    page.wait_for_selector("[data-testid=news-thread]", timeout=5000)
    check(page.locator("[data-testid=news-thread]").count() == 1 and "2 days · 2 sources" in page.locator("[data-testid=news-thread]").inner_text(), "one thread: the rates story over 2 days, 2 sources (metro is not part of it)")
    page.locator("[data-testid=news-thread] button").first.click()
    o = page.locator("[data-testid=news-thread-open]").inner_text()
    check("Reuters" in o and "Ahram Online" in o and o.index(D(-1)) < o.index(D(-2)), "each day's headlines with their source, newest first")
    page.evaluate("() => { window.__mock.bodies = []; window.__mock.fakeQueue = ['- The cut came at the top of the range: 200 bp, rate now 22% [2]\\n- Reuters had expected 100–200 bp [1]']; }")
    page.click("[data-testid=news-thread-ask]")
    page.wait_for_selector("[data-testid=news-thread-change]", timeout=10000)
    ch = page.locator("[data-testid=news-thread-change]").inner_text()
    check("200 bp" in ch and "[2]" in ch, "what changed, cited: " + ch.replace("\n", " | "))
    sent = page.evaluate("window.__mock.bodies.filter(b => b.max_tokens > 2).map(b => b.messages[1].content)")
    check(len(sent) == 1 and "[1] (" + D(-2) + ") Analysts expect" in sent[0] and "Metro" not in sent[0], "only the thread's articles were sent, dated")
    ctx.close()
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
