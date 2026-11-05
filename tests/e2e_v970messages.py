"""v9.7 Messages like Auto Text (Ali, 6 Nov 2026: picked M3 + S1 + S2 + S3, MOCKUPS.md): Scheduled · Auto-reply · Sent; the composer
(app, person, words, templates, time, repeat, ask first, send by itself); auto-reply rules sent to the phone.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v970messages.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
NOW = datetime.datetime(2026, 11, 6, 13, 0, 0)
ms = lambda d: int(d.timestamp() * 1000)
SENT = [{"id": "msg-x1", "how": "auto", "ok": True, "who": "Karim", "app": "whatsapp", "text": "See you at 9", "at": ms(NOW) - 3600000},
        {"id": "ar-r1", "how": "autoreply", "ok": True, "who": "Ahmed", "app": "whatsapp", "text": "I'm driving", "rule": "Driving", "at": ms(NOW) - 600000}]
INIT = "try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:agents:view2','board')}catch(e){}"
MOCK = """(() => { window.__w = { sched: [], rules: null }; function w(){ const N = window.AttuneNative; if (!N) return setTimeout(w, 5);
  N.schedule = (j) => { window.__w.sched.push(JSON.parse(j)); return JSON.stringify({ ok: true }); }; N.unschedule = () => true; N.scheduled = () => "[]"; N.sendLog = () => "[]";
  N.chatInbox = () => "[]"; N.msgState = () => JSON.stringify({ auto: true, autoOn: false, sms: true, smsOn: false });
  N.autoReplyRules = () => window.__w.rules ? JSON.stringify(window.__w.rules) : "[]"; N.autoReplySet = (j) => { window.__w.rules = JSON.parse(j); };
  N.msgSent = () => %s; N.msgOpenAuto = () => { window.__w.openedAuto = 1; }; N.msgAskSms = () => { window.__w.askedSms = 1; }; } w(); })();""" % json.dumps(json.dumps(SENT))
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + ";" + MOCK)
    ctx.clock.set_fixed_time(NOW); page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_timeout(1200)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'agents'}}))"); page.wait_for_selector("[data-testid=agents-page]")
    page.click("[data-testid=agents-chip-send]"); page.wait_for_selector("[data-testid=msg-composer]")
    check(page.locator("[data-testid=messages-tab-scheduled]").count() == 1 and page.locator("[data-testid=messages-tab-auto]").count() == 1 and page.locator("[data-testid=messages-tab-sent]").count() == 1,
          "S1: Messages has three tabs — Scheduled · Auto-reply · Sent")
    # S2: the composer — a yearly birthday message to Mama on WhatsApp, asking first
    page.fill("[data-testid=msg-who]", "Mama"); page.fill("[data-testid=msg-phone]", "+20 100 123 4431")
    page.click("[data-testid=msg-templates]"); page.locator("[data-testid=msg-tpl]").first.click()
    check(len(page.input_value("[data-testid=msg-text]")) > 5, "a template fills the words")
    page.fill("[data-testid=msg-text]", "كل سنة وانتي طيبة يا ماما ❤️")
    page.fill("[data-testid=msg-at]", "2027-02-03T09:00"); page.click("[data-testid=msg-repeat-yearly]"); page.click("[data-testid=msg-ask]")
    page.click("[data-testid=msg-save]"); page.wait_for_timeout(400)
    s = [x for x in page.evaluate("window.__w.sched") if str(x.get("id", "")).startswith("msg-")]
    check(len(s) == 1 and s[0]["repeat"] == "yearly" and s[0]["send"]["ask"] is True and s[0]["send"]["phone"] == "+20 100 123 4431" and s[0]["send"]["app"] == "whatsapp",
          "the phone gets it: yearly, asks first, WhatsApp, Mama's number: %s" % (s[0] if s else None))
    check(datetime.datetime.fromtimestamp(s[0]["at"] / 1000).strftime("%m-%d %H") == "02-03 09", "…on 3 Feb at 9:00")
    card = page.locator("[data-testid=msg-card]")
    check(card.count() == 1 and "Mama" in card.first.inner_text() and "Every year" in card.first.inner_text(), "its card: who, when, Every year")
    # SMS needs a number; email needs an address
    page.click("[data-testid=msg-new]"); page.wait_for_selector("[data-testid=msg-composer]")
    page.click("[data-testid=msg-app-sms]"); page.fill("[data-testid=msg-who]", "Eng. Mahmoud"); page.fill("[data-testid=msg-text]", "Site meeting moved to Sunday")
    page.fill("[data-testid=msg-at]", "2026-11-07T17:00"); page.click("[data-testid=msg-save]"); page.wait_for_timeout(200)
    check("phone number" in page.inner_text("[data-testid=msg-missing]").lower(), "an SMS without a number says what's missing")
    page.fill("[data-testid=msg-phone]", "01001112222"); page.click("[data-testid=msg-save]"); page.wait_for_timeout(300)
    check(page.locator("[data-testid=msg-card]").count() == 2, "…and saves once it has one")
    # M3: "Send by itself" — Attune's own screen first, then Android's settings; SMS permission
    page.click("[data-testid=msg-auto-turn-on]"); page.wait_for_selector("[data-testid=msg-auto-explain]")
    check("only in WhatsApp" in page.inner_text("[data-testid=msg-auto-explain]"), "before Accessibility: Attune says exactly what it does")
    page.click("[data-testid=msg-auto-go]"); page.wait_for_timeout(200)
    check(page.evaluate("window.__w.openedAuto") == 1, "…then opens Android's Accessibility settings")
    page.click("[data-testid=msg-sms-allow]"); page.wait_for_timeout(200)
    check(page.evaluate("window.__w.askedSms") == 1, "SMS by itself asks for the SMS permission")
    # S3: auto-reply rules go to the phone
    page.click("[data-testid=messages-tab-auto]"); page.wait_for_selector("[data-testid=msg-auto]")
    page.click("[data-testid=msg-rule-add-driving]"); page.wait_for_timeout(200)
    page.locator("[data-testid=msg-rule-on]").first.click(); page.wait_for_timeout(200)
    rules = page.evaluate("window.__w.rules")
    check(rules and rules[0]["on"] is True and rules[0]["groups"] is False and rules[0]["once"] is True and "driving" in rules[0]["text"].lower(), "Driving rule on: never groups, once a day per person: %s" % rules)
    page.locator("[data-testid=msg-rule-edit]").first.click(); page.click("[data-testid=msg-rule-mode-hours]"); page.wait_for_timeout(200)
    check(page.evaluate("window.__w.rules")[0]["mode"] == "hours", "a rule can work between hours")
    check("1" in page.inner_text("[data-testid=msg-replied-today]"), "Replied today: 1 (from the phone's log)")
    # Sent
    page.click("[data-testid=messages-tab-sent]"); page.wait_for_selector("[data-testid=msg-sent]")
    rows = page.locator("[data-testid=msg-sent-row]")
    check(rows.count() == 2 and "Ahmed" in rows.first.inner_text() and "Auto-reply" in rows.first.inner_text() and "Sent by itself" in rows.nth(1).inner_text(), "Sent: newest first, how each went")
    page.click("[data-testid=messages-back]"); page.wait_for_selector("[data-testid=agents-page]")
    check(page.locator("[data-testid=agent-send]").count() == 1 and "2 scheduled" in page.inner_text("[data-testid=agent-send]"), "Agents shows ONE Messages card (2 scheduled), not one card each")
    check(not real_errors(errors), "no page errors: " + str(real_errors(errors))[:300])
    br.close()
finish()
