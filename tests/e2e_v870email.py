"""v8.7 (Ali, 29 Oct: "draft the emails in Gmail and send with my confirmation, like Gemini"): "email … that …" in the Home box →
a ready email (To / Subject / Body, all editable) → Open in Gmail hands Gmail's compose screen everything (mocked phone), Send
sends only after the tap (mocked gmailSend). Without a model the email is written from the person's own words.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v870email.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
MOCK = r"""try{localStorage.setItem('attune:start','home')}catch(e){}
(() => { const S = window.__em = { intents: [], sends: [] };
  const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0);
    N.intent = (j) => { S.intents.push(JSON.parse(j)); return JSON.stringify({ ok: true }); };
    N.gmailSend = (id, arg) => { S.sends.push(JSON.parse(arg)); setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ id: "m1" })), 30); };
  }; go(); })();"""
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=MOCK)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.fill("[data-testid=home-ask]", "email ahmed@site.com that the meeting moved to Sunday"); page.click("[data-testid=home-send]")
    page.wait_for_selector("[data-testid=email-card]", timeout=8000)
    page.wait_for_function("() => (document.querySelector('[data-testid=email-body]') || {}).value", timeout=60000)
    to, subj, body = (page.input_value("[data-testid=email-to]"), page.input_value("[data-testid=email-subject]"), page.input_value("[data-testid=email-body]"))
    check(to == "ahmed@site.com" and subj and "Sunday" in body, "a ready email: to %s · subject “%s” · body mentions Sunday" % (to, subj))
    check(page.evaluate("window.__em.sends.length") == 0 and page.evaluate("window.__em.intents.length") == 0, "nothing is sent or opened before a tap")
    page.fill("[data-testid=email-body]", "Hi Ahmed,\n\nThe meeting moved to Sunday at 10.\n\nAli")
    page.click("[data-testid=email-gmail]"); page.wait_for_timeout(200)
    it = page.evaluate("window.__em.intents[0]")
    check(it and it["kind"] == "email" and it["to"] == ["ahmed@site.com"] and "Sunday at 10" in it["body"], "Open in Gmail hands Gmail the email as edited: %s" % it)
    page.click("[data-testid=email-send]"); page.wait_for_selector("[data-testid=email-sent]", timeout=5000)
    sd = page.evaluate("window.__em.sends[0]")
    check(sd and sd["to"] == ["ahmed@site.com"] and sd["body"].startswith("Hi Ahmed"), "Send sends exactly what was shown, after the tap")
    # Arabic, no address yet: the card asks for it before Send
    page.fill("[data-testid=home-ask]", "ابعت ايميل لأحمد إن الاجتماع اتأجل للأحد"); page.click("[data-testid=home-send]")
    page.wait_for_function("() => (document.querySelector('[data-testid=email-body]') || {}).value", timeout=60000)
    check(page.input_value("[data-testid=email-to]") == "" and "أحمد" in page.get_attribute("[data-testid=email-to]", "placeholder"), "no address: the To box asks for Ahmed's email")
    page.click("[data-testid=email-send]"); page.wait_for_timeout(200)
    check("email address" in page.inner_text("[data-testid=email-note]") and page.evaluate("window.__em.sends.length") == 1, "Send without an address asks for it and sends nothing")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
