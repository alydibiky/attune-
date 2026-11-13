"""v9.9.26 phone rules (Ali picked R1-C + R2-A, combined screen OK'd): "when I connect to my car, tell me to check the tyres" → on the
phone the device is picked from the paired list (Android's "Nearby devices" asked once) — two "JBL Flip 5" told apart; Save → the rule is
on ("instant") and handed to the phone with its words; "when I start charging, read my to-dos" → on, "within 15 min"; "when I join Wi-Fi,
remind me…" → "This one: Home-5G"; when it last fired shows; removing one hands the phone the new list. Without the phone part they wait.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v9926phonerules.py
"""
import json, time
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
BOX = "textarea[placeholder='Message Attune']"
PAIRED = [{"name": "KIA Cerato", "address": "AA:11:22:33:44:01", "type": "car"}, {"name": "JBL Flip 5", "address": "AA:11:22:33:44:03", "type": "speaker"}, {"name": "JBL Flip 5", "address": "AA:11:22:33:44:04", "type": "speaker"}]
INIT = ("try{localStorage.setItem('attune:start','home')}catch(e){}\n"
        "window.__saved = []; window.__bt = false; (() => { const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0);"
        " N.phoneRulesSave = (j) => { window.__saved.push(JSON.parse(j)); }; N.phoneRulesTake = () => '[]';"
        " N.phoneRulesStatus = () => JSON.stringify({ ['fired_' + (window.__firedId || 'x')]: Date.now() - 3600e3 });"
        " N.btAllowed = () => window.__bt; N.btAsk = () => { window.__bt = true; window.dispatchEvent(new CustomEvent('attune-bt')); }; N.btPaired = () => window.__bt ? %s : '[]';"
        " N.wifiNow = () => 'Home-5G'; }; go(); })();") % json.dumps(json.dumps(PAIRED))
def chat(page): page.evaluate("() => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'chat'}}))"); page.wait_for_selector(BOX, timeout=8000); page.wait_for_timeout(300)
def say(page, t): page.locator(BOX).fill(t); page.locator("button[title='Send']").first.click(); page.wait_for_timeout(1200)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    chat(page); say(page, "when I connect to my car, tell me to check the tyres")
    page.wait_for_selector("[data-testid=rule-device-pick]", timeout=8000)
    check(page.locator("[data-testid=rule-bt-allow]").count() == 1, "first time: Android's 'Nearby devices' asked once")
    page.click("[data-testid=rule-bt-allow]"); page.wait_for_timeout(300)
    devs = page.locator("[data-testid=rule-device]").all_inner_texts()
    check(len(devs) == 3 and any("44:03" in d for d in devs) and any("44:04" in d for d in devs) and not any("44:01" in d for d in devs), "the paired devices; the two JBLs told apart: %s" % [d.replace("\n", " ") for d in devs])
    page.locator("[data-testid=rule-device]").first.click(); page.wait_for_selector("[data-testid=rule-card]", timeout=6000)
    check("KIA Cerato" in page.locator("[data-testid=rule-card]").inner_text() and page.locator("[data-testid=rule-needs-phone]").count() == 0, "the rule card: You connect to KIA Cerato — on (no 'needs the phone part')")
    page.click("[data-testid=rule-save]"); page.wait_for_timeout(400)
    s = page.evaluate("window.__saved[window.__saved.length - 1]")
    check(len(s) == 1 and s[0]["when"]["device"]["address"] == "AA:11:22:33:44:01" and "KIA Cerato" in s[0]["title"] and s[0]["body"], "handed to the phone with its words: %s" % json.dumps(s)[:200])
    rid = s[0]["id"]; page.evaluate("id => { window.__firedId = id; }", rid)
    chat(page); say(page, "when I start charging, tell me to plan tomorrow"); page.wait_for_selector("[data-testid=rule-card]", timeout=8000); page.click("[data-testid=rule-save]"); page.wait_for_timeout(400)
    chat(page); say(page, "when I join wifi, remind me to call Mama"); page.wait_for_selector("[data-testid=rule-wifi-pick]", timeout=8000)
    check("Home-5G" in page.locator("[data-testid=rule-wifi-now]").inner_text(), "Wi-Fi: 'This one: Home-5G' from the phone")
    page.click("[data-testid=rule-wifi-now]"); page.wait_for_selector("[data-testid=rule-card]", timeout=6000); page.click("[data-testid=rule-save]"); page.wait_for_timeout(400)
    s = page.evaluate("window.__saved[window.__saved.length - 1]")
    check(sorted(x["when"]["type"] for x in s) == ["bluetooth", "charging", "wifi"] and any(x["when"].get("ssid") == "Home-5G" for x in s), "the phone has all three: %s" % [x["when"]["type"] for x in s])
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'automations'}}))"); page.wait_for_selector("[data-testid=rule-list]", timeout=8000)
    speeds = page.locator("[data-testid=rule-speed]").all_inner_texts()
    check(len(speeds) == 3 and sum("instant" in x for x in speeds) == 1 and sum("within 15 min" in x for x in speeds) == 2, "speeds shown: %s" % speeds)
    check(any("last:" in x for x in speeds), "when it last fired shows")
    n0 = page.evaluate("window.__saved.length"); page.locator("[data-testid=rule-remove]").first.click(); page.wait_for_timeout(300)
    check(page.evaluate("window.__saved.length") == n0 + 1 and len(page.evaluate("window.__saved[window.__saved.length - 1]")) == 2, "removing one hands the phone the new list (2)")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
env.close(); finish()
