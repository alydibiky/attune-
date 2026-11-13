"""v9.9.31 (Ali: "comprehend and understand every notification like you would"): with the model loaded, the notification code can't
read (Dima writes in Russian: "send me the contract tomorrow, please") is read by the model; the reading is checked and kept; Autopilot
turns it into a to-do for tomorrow by itself (Done for you + Undo); Recall finds it by meaning ("who asked me to send something");
a notification code IS sure of (the CIB debit) is never sent to the model.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v9931mind.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
NOW = datetime.datetime(2026, 11, 13, 18, 0, 0)
T0 = int(NOW.timestamp() * 1000)
NOTES = [{"id": "ru1", "pkg": "com.whatsapp", "app": "WhatsApp", "title": "Дима", "text": "Пришли мне, пожалуйста, договор завтра", "ts": T0 - 600000},
         {"id": "cib1", "pkg": "com.google.android.apps.messaging", "app": "Messages", "title": "CIB", "text": "EGP 640.00 was debited from your account ending 4471 at SPINNEYS", "ts": T0 - 900000}]
ANS = json.dumps({"cat": "chat", "intent": "request", "action": "do", "from_type": "person", "who": "Дима", "due": "2026-11-14", "amount": 0, "cur": "", "dir": "", "urgency": "normal", "summary": "Dima asks you to send the contract tomorrow"})
INIT = ("try{localStorage.setItem('attune:start','home');}catch(e){}\n"
        "(() => { function w(){ const N = window.AttuneNative; if (!N || !window.__mock) return setTimeout(w, 5); N.recallNotes = () => %s;"
        " window.__mock.fakeQueue = [%s]; window.__mock.engine = { ...window.__mock.engine, state: 'ready', modelId: 'test-model' };"
        " window.dispatchEvent(new CustomEvent('attune-engine', { detail: { ...window.__mock.engine } })); } w(); })();") % (json.dumps(json.dumps(NOTES)), json.dumps(ANS))
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    ctx.clock.set_fixed_time(NOW)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.wait_for_function("() => { try { return !!JSON.parse(localStorage.getItem('attune:notifmind:v1') || '{}').ru1 } catch (e) { return false } }", timeout=15000)
    minds = page.evaluate("JSON.parse(localStorage.getItem('attune:notifmind:v1'))")
    m = minds["ru1"]
    check(m["intent"] == "request" and m["action"] == "do" and m["by"] == "code+model" and m["due"]["date"] == "2026-11-14", "the model read the Russian request: do it, by tomorrow — %s" % {k: m.get(k) for k in ("cat", "intent", "action", "due", "by")})
    check("cib1" not in minds, "the CIB debit (code is sure) was never sent to the model")
    page.wait_for_selector("[data-testid=autopilot-done]", timeout=10000); page.wait_for_timeout(500)
    done = page.locator("[data-testid=autopilot-done]").inner_text()
    check("Дима" in done, "Autopilot made it a to-do by itself (Done for you): " + done.replace("\n", " | "))
    rem = page.evaluate("JSON.parse(localStorage.getItem('attune:reminders:v1')||'[]')"); rem = rem if isinstance(rem, list) else rem.get("items", [])
    r = [x for x in rem if "Дима" in x.get("title", "")]
    check(len(r) == 1 and datetime.datetime.fromtimestamp(r[0]["at"] / 1000).date() == datetime.date(2026, 11, 14), "…a reminder for tomorrow: %s" % [(x.get("title"), x.get("at")) for x in r])
    # Recall by meaning: the search words now carry "asked request"
    page.evaluate("m => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", "recall"); page.wait_for_selector("[data-testid=recall-q]", timeout=8000)
    page.fill("[data-testid=recall-q]", "who asked me to send something"); page.keyboard.press("Enter"); page.wait_for_timeout(800)
    check("Дима" in page.locator("[data-testid=recall-page]").inner_text(), "Recall finds Dima's message by its meaning (who asked me to send something)")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
env.close(); finish()
