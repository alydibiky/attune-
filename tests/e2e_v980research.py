"""v9.8 (Ali, 8 Nov: "I made an agent to research a car — it went to Chat, so I have to keep the app open"): a research agent runs on
its own page — it never opens Chat — the report is kept on the agent's card, and a notification says when it is ready; the writing
service (keepAwake → GenService) keeps it going while Attune is in the background.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v980research.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
MOCK = """(() => { window.__sched = []; window.__awake = []; function w(){ const N = window.AttuneNative; if (!N) return setTimeout(w, 5);
  N.schedule = (j) => { window.__sched.push(JSON.parse(j)); return true; }; const ka = N.keepAwake; N.keepAwake = (on) => { window.__awake.push(on); try { ka && ka.call(N, on); } catch (e) {} }; } w(); })();"""
def install(page):
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init="try{localStorage.setItem('attune:agents:view2','new')}catch(e){};" + MOCK)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    install(page)
    page.evaluate("(q) => { const M = window.__mock; M.fakeQueue = q; M.bodies = []; }", ["**Best pick: a 2022 Tucson with agency service, 950k–1.05M EGP.** Check the turbo, the paint and the licence date."])
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'agents'}}))"); page.wait_for_selector("[data-testid=agents-page]", timeout=8000)
    page.fill("[data-testid=agents-input]", "research the best used Hyundai Tucson 2022 in Egypt")
    page.click("[data-testid=agents-go]")
    page.wait_for_selector("[data-testid=agent-report]", timeout=40000)
    check(page.locator("[data-testid=agents-page]").count() == 1 and page.locator("textarea[placeholder='Message Attune']").count() == 0, "the research stays on the Agents page — Chat is never opened")
    check("2022 Tucson with agency service" in page.inner_text("[data-testid=agent-report]"), "the report is kept on the agent's card")
    st = page.evaluate("JSON.parse(localStorage.getItem('attune:agents:v1')).agents.find(a => a.kind === 'follow')")
    check(st and st.get("once") and st.get("report", {}).get("text", "").startswith("**Best pick"), "…and saved with the agent (it is there after a restart)")
    check(any(x.get("id", "").startswith("agent-report-") for x in page.evaluate("window.__sched")), "a notification says the research is ready")
    aw = page.evaluate("window.__awake")
    check(aw[:1] == [True] and aw[-1:] == [False], "the writing service kept it going, then stopped: %s" % aw)
    page.reload(); page.wait_for_timeout(1500)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'agents'}}))"); page.wait_for_selector("[data-testid=agent-report]", timeout=8000)
    check(True, "after a restart the report is still on the card")
    check(not real_errors(errors), "no JavaScript errors: %s" % real_errors(errors)[:3])
    br.close()
finish()
