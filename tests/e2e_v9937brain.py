"""v9.9.37 BR-4 the Attune brain in the real page (trial = Pro): the Home row, "What Attune knows" with facts and their source, Forget,
Not right (your words kept first), Chat "how am I doing?" answered at once from the facts — and in Free the page says Part of Pro.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v9937brain.py
"""
import json, time, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
now = int(time.time() * 1000); DAY = 86400000; today = datetime.date.today()
LED = {"currency": "EGP", "accounts": [{"id": "c", "name": "Cash", "currency": "EGP", "start": 0}], "budgets": {"overall": 0, "cats": {}}, "recurring": [],
       "txns": [{"id": "t1", "type": "expense", "amount": 1040, "cat": "food", "note": "Talabat", "date": today.isoformat(), "account": "c"}, {"id": "t2", "type": "income", "amount": 18500, "cat": "salary", "date": today.isoformat(), "account": "c"}]}
LIFE = {"v": 1, "items": [{"id": "sh", "kind": "debt", "dir": "in", "person": "Sheikh", "amount": 19500, "count": 1, "total": 19500, "paid": []}]}
RADAR = {"items": [{"id": "cl", "title": "Car licence", "date": (today + datetime.timedelta(days=20)).isoformat(), "status": "active"}], "seen": []}
def init(pro):
    s = "try{localStorage.setItem('attune:test:quiet','0');localStorage.setItem('attune:coach:v1',JSON.stringify({seen:['*']}));localStorage.setItem('attune:setup:hide',String(Date.now()+9e9));localStorage.setItem('attune:start','home');"
    s += "localStorage.setItem('ledger.v3',%s);localStorage.setItem('attune:life:v1',%s);localStorage.setItem('attune:radar:v1',%s);" % (json.dumps(json.dumps(LED)), json.dumps(json.dumps(LIFE)), json.dumps(json.dumps(RADAR)))
    s += "localStorage.setItem('attune:first-run',String(%d));" % ((now - DAY) if pro else 1)
    return s + "}catch(e){}"
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=init(True))
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000); page.wait_for_timeout(800)
    row = page.locator("[data-testid=brain-row]")
    check(row.count() == 1 and "facts" in row.inner_text(), "Home: “What Attune knows · N facts” — " + (row.inner_text().replace("\n", " ")[:120] if row.count() else ""))
    row.click(); page.wait_for_selector("[data-testid=brain-page]", timeout=8000); page.wait_for_timeout(300)
    body = page.locator("[data-testid=brain-page]").inner_text()
    check("Sheikh still owes you 19,500" in body, "people: Sheikh still owes you 19,500")
    check("Car licence ends on" in body and "in 20 days" in body, "papers: the car licence ends in 20 days")
    check("1,040" in body and "18,500" in body, "money: this month's 1,040 spent and 18,500 in")
    check("From: People & plans" in body and "From: Dates" in body, "each fact says where it came from")
    n0 = page.locator("[data-testid=brain-fact]").count()
    page.locator("[data-testid=brain-fact][data-id=paper\\:cl\\:%s] [data-testid=brain-forget]" % (today + datetime.timedelta(days=20)).isoformat()).click(); page.wait_for_timeout(300)
    check(page.locator("[data-testid=brain-fact]").count() == n0 - 1 and "Car licence" not in page.locator("[data-testid=brain-page]").inner_text(), "Forget hides the fact")
    page.locator("[data-testid=brain-fact][data-id=people\\:sh] [data-testid=brain-wrong]").click()
    page.fill("#brain-fix-text", "Sheikh paid 5,000 last week, 14,500 left"); page.click("[data-testid=brain-fix-save]"); page.wait_for_timeout(300)
    first = page.locator("[data-testid=brain-area]").first
    check(first.get_attribute("data-area") == "mine" and "Sheikh paid 5,000 last week" in first.inner_text() and "19,500" not in page.locator("[data-testid=brain-page]").inner_text(), "Not right: your words become the first fact, the wrong one is gone")
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'chat'}}))"); page.wait_for_timeout(500)
    page.locator("textarea[placeholder='Message Attune']").fill("how am I doing?"); page.locator("button[title='Send']").click()
    page.wait_for_selector("text=What I know right now", timeout=8000)
    ans = page.locator("text=What I know right now").locator("xpath=ancestor::*[contains(@class,'rounded')][1]").inner_text()
    check("Sheikh paid 5,000 last week" in ans and "1,040" in ans, "Chat “how am I doing?” → at once, from the brain (with your correction): " + ans.replace("\n", " ")[:160])
    check(not real_errors(errors), "no page errors: " + str(real_errors(errors))[:200])
    ctx.close()
    errors.clear()
    ctx, page = new_page(br, env, errors, extra_init=init(False))
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000); page.wait_for_timeout(600)
    check(page.locator("[data-testid=brain-row]").count() == 0, "Free: no brain row on Home")
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'brain'}}))"); page.wait_for_timeout(600)
    check(page.locator("[data-testid=pro-lock][data-feature=brain]").count() == 1, "Free: What Attune knows says Part of Pro")
    check(not real_errors(errors), "no page errors (Free): " + str(real_errors(errors))[:200])
    ctx.close(); br.close()
finish()
