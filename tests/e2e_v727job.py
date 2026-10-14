"""v6.27 Job ready — a tab inside CV / Resume (no new tool): the job you want → the skills the CV shows and lacks (a missing one
opens Learn daily with it filled in), interview practice (a question said aloud, the answer checked by code), and the job
sites of the person's country. Phone + desktop.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v727job.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
SEC = lambda t, items: {"id": "s" + t, "type": t, "title": t, "visible": True, "items": items}
CV = {"id": "cv1", "name": "My CV", "lang": "en", "page": "A4", "layout": "ats", "theme": "teal", "font": "sans", "fontSize": 10.5, "spacing": "normal", "margin": 14, "fit": 1, "photo": "", "showPhoto": False, "updated": 1,
      "basics": {"name": "Sara Adel", "title": "Data analyst", "email": "s@example.com", "phone": "", "city": "Cairo", "links": []},
      "sections": [SEC("summary", [{"text": "Data analyst who turns messy data into decisions."}]),
                   SEC("experience", [{"role": "Data analyst", "company": "Fawry", "location": "Cairo", "start": "2022", "end": "", "current": True, "bullets": ["Built Power BI dashboards for 12 regions", "Wrote SQL queries and cleaned data in Excel", "Presented results to stakeholders"]}]),
                   SEC("education", []), SEC("skills", [{"name": "Tools", "items": ["SQL", "Excel", "Power BI"]}]), SEC("languages", []), SEC("certs", [])]}
INIT = "try{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s',1);localStorage.setItem('attune:start','home');localStorage.setItem('attune:cv:v1',%s)}}catch(e){}\nwindow.__said=[];(() => { const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0); N.speakWait = (id, arg) => { window.__said.push(JSON.parse(arg).text); setTimeout(() => window.__attuneNative.resolve(id, '{}'), 50); }; }; go(); })();" % json.dumps(json.dumps([CV]))
ANSWER = "When I joined Fawry the regional sales reports took three days every month. I decided to build a Power BI dashboard on our SQL database and I trained the six regional managers to use it. As a result the report takes ten minutes, and managers cut stock-outs by 18 percent in one quarter."
with sync_playwright() as p:
    br = p.chromium.launch()
    for W, H in ((390, 844), (1280, 860)):
        dev = "phone" if W < 600 else "desktop"
        ctx, page = new_page(br, env, errors, extra_init=INIT)
        page.set_viewport_size({"width": W, "height": H})
        page.goto(env.url); page.wait_for_timeout(1500)
        if dev == "phone":
            page.locator("nav button").last.click(); page.wait_for_timeout(250)
            page.locator(".rounded-t-2xl button:has-text('CV / Resume')").first.click()
        else:
            page.fill("[data-testid=side-search]", "cv"); page.wait_for_timeout(200); page.locator("[data-testid=side-tool-hits] button").first.click()
        page.wait_for_selector("[data-testid=cv-page]", timeout=6000)
        page.locator("[data-testid=cv-row] button").first.click(); page.wait_for_selector("[data-testid=cv-editor]")
        page.click("[data-testid=cv-tab-job]")
        page.fill("[data-testid=cv-job-role]", "Data analyst"); page.fill("[data-testid=cv-job-city]", "Cairo"); page.wait_for_timeout(200)
        sk = page.locator("[data-testid=cv-job-skills]").inner_text()
        check("SQL" in sk and "Python" in sk and "learn it" in sk, f"{dev}: skills the CV shows (SQL…) and lacks (Python · learn it)")
        page.click("[data-testid=cv-job-hear]"); page.wait_for_timeout(300)
        q = page.locator("[data-testid=cv-job-q]").inner_text()
        check(page.evaluate("window.__said") and page.evaluate("window.__said")[-1] == q, f"{dev}: the question is said aloud: {q}")
        page.fill("[data-testid=cv-job-answer]", "um I am like good with, you know, data"); page.click("[data-testid=cv-job-check]")
        fb = page.locator("[data-testid=cv-job-feedback]").inner_text()
        check("Too short" in fb and "filler" in fb, f"{dev}: a weak answer → too short, fillers")
        page.fill("[data-testid=cv-job-answer]", ANSWER); page.click("[data-testid=cv-job-check]")
        fb = page.locator("[data-testid=cv-job-feedback]").inner_text()
        check("clear story" in fb and "number" in fb and "matches what your CV says" in fb, f"{dev}: a strong answer → a clear story, a number, matches the CV")
        links = page.locator("[data-testid=cv-job-link]").all_inner_texts()
        check("LinkedIn Jobs" in links and "Google" in links, f"{dev}: job sites to search: {links}")
        if dev == "phone":
            page.locator("[data-testid=cv-job-learn]", has_text="Python").click(); page.wait_for_timeout(600)
            check(page.locator("[data-testid=learn-topic]").count() == 1 and page.locator("[data-testid=learn-topic]").input_value() == "Python", "a missing skill → Learn daily, the course topic filled in")
        ctx.close()
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
