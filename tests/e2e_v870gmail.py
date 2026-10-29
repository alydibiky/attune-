"""v8.7 (Ali, 29 Oct: "and also reads Gmail by itself"): Recall shows "Read my Gmail by itself"; Connect reads the money emails
(GmailRead.kt, mocked here) → the payment waits in Money's review list, all of them are found in Recall, and the next day Attune
reads again silently when it opens.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v870gmail.py
"""
import json, time
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
now = int(time.time() * 1000)
E = [{"id": "gm:1", "kind": "email", "from": "Netflix <info@netflix.com>", "title": "Your Netflix price is changing", "text": "From November your plan will be EGP 240 a month.", "at": now - 2 * 86400000, "link": "https://mail.google.com/mail/#all/a"},
     {"id": "gm:2", "kind": "email", "from": "CIB <alerts@cib.com>", "title": "Card transaction", "text": "Your card ending 1234 was charged EGP 850.00 at NOON.", "at": now - 86400000, "link": "https://mail.google.com/mail/#all/b"}]
def init(pre=""):
    return "try{localStorage.setItem('attune:resume:v1', JSON.stringify({mode:'recall', at: Date.now()}));" + pre + "}catch(e){}\n" + r"""(() => { const S = window.__gm = { calls: [] };
  const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0);
    N.gmailRead = (id, arg) => { S.calls.push(JSON.parse(arg)); setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ emails: %s })), 30); };
  }; go(); })();""" % json.dumps(E)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=init())
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url)
    page.wait_for_selector("[data-testid=gmail-card]", timeout=15000)
    check("Read my Gmail by itself" in page.locator("[data-testid=gmail-card]").inner_text(), "Recall offers to read Gmail by itself")
    page.click("[data-testid=gmail-go]"); page.wait_for_timeout(800)
    t = page.locator("[data-testid=gmail-card]").inner_text()
    check("2 emails about money read" in t and "1 payments are waiting" in t, "it says what it read: %s" % t.replace("\n", " · ")[:140])
    check(page.evaluate("window.__gm.calls[0]") == {"days": 365, "max": 100, "silent": False}, "the first read asks Google once and reads the last year")
    wait = page.evaluate("JSON.parse(localStorage.getItem('attune:sms-old:v1') || '[]')")
    check(len(wait) == 1 and "charged EGP 850" in wait[0]["text"], "the card payment waits in Money's review list (only the payment)")
    page.fill("[data-testid=recall-q]", "netflix price")
    page.wait_for_timeout(500)
    hits = page.locator("[data-testid=recall-hit]").all_inner_texts()
    check(hits and "Netflix" in hits[0] and "Gmail" in hits[0], "Recall finds the email: %s" % (hits[0].replace("\n", " · ")[:100] if hits else hits))
    ctx.close()
    # the next day: read again by itself, silently, when Attune opens
    pre = "localStorage.setItem('attune:gmail:v1', JSON.stringify({on:true,last:%d,emails:[]}));localStorage.setItem('attune:resume:v1', JSON.stringify({mode:'home', at: Date.now()}));" % (now - 26 * 3600000)
    ctx, page = new_page(br, env, errors, extra_init=init(pre))
    page.goto(env.url); page.wait_for_timeout(5000)
    calls = page.evaluate("window.__gm.calls")
    check(len(calls) == 1 and calls[0]["silent"] is True and calls[0]["days"] <= 3, "the daily read runs by itself, silently, for the last days: %s" % calls)
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
