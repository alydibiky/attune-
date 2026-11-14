"""v9.9.40 K5 / AS-2 (Ali: "when I ask what or when did Address East discuss the garage it should know" + "display the full message of
everything"): Chat answers from the kept messages of that chat — every day the garage came up, who wrote, and Show all N messages
opens every message in full; "what are all the talabat?" is the Talabat list, not the delivery app.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v9940chatask.py
"""
import json, time
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
D = 86400000; now = int(time.time() * 1000)
def wa(i, title, text, ago_days, who):
    return {"id": "n" + str(i), "app": "WhatsApp", "pkg": "com.whatsapp", "title": title, "text": text, "ts": now - int(ago_days * D), "group": True, "convo": title, "who": who}
AE = "🏠ADDRESS EAST OWNERS 🏠"
NOTES = [wa(1, AE, "The garage gate will be closed for 2 days", 9, "Dr Hazem Wagdy"), wa(2, AE, "thanks", 9, "Rowan"), wa(3, AE, "مين راكن في الجراج مكاني؟", 4, "Mona"),
         wa(4, AE, "the pool opens Sunday", 3, "Dr Hazem Wagdy"), wa(5, AE, "garage cleaning on Sunday", 4, "Dr Hazem Wagdy"), wa(6, "Talabat", "tortilla", 0.1, "Noudy")]
LISTS = {"lists": [{"id": "lt", "name": "Talabat", "emoji": "🛒", "chatKey": "whatsapp|g:talabat", "items": [{"id": "i1", "text": "tortilla", "done": False}, {"id": "i2", "text": "milk", "done": False}], "repeat": {"every": "once"}, "cycle": "", "created": now}]}
ROLES = {"whatsapp|g:talabat": {"role": "shopping", "ok": True}, "whatsapp|g:" + AE.lower(): {"role": "building", "ok": True}}
MOCK = "(() => { const notes = %s; function w(){ const N = window.AttuneNative; if (!N) return setTimeout(w, 5); N.recallNotes = () => JSON.stringify(notes); } w(); })();" % json.dumps(NOTES)
INIT = "try{localStorage.setItem('attune:lists:v1',%s);localStorage.setItem('attune:chatroles:v1',%s)}catch(e){};" % (json.dumps(json.dumps(LISTS)), json.dumps(json.dumps(ROLES))) + MOCK
def ask(page, q):
    box = page.locator("textarea[placeholder='Message Attune']"); box.fill(q); page.locator("button[title='Send']").click(); page.wait_for_timeout(700)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.goto(env.url); page.wait_for_timeout(1200)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open', { detail: { mode: 'chat' } }))"); page.wait_for_selector("textarea[placeholder='Message Attune']", timeout=10000)
    ask(page, "When did Address East discuss the garage?")
    card = page.locator("text=From your chats").last.locator("xpath=ancestor::div[contains(@class,'rounded')][1]")
    body = page.inner_text("body")
    check("From your chats" in body and "came up in" in body, "K5: the answer comes from the chat's own messages")
    check("Dr Hazem Wagdy" in body and "Mona" in body and "on 2 days" in body, "…the 2 days the garage came up, with who wrote («الجراج» counted too)")
    check("the pool opens Sunday" not in body, "…not the messages about other things")
    page.locator("button", has_text="Show all 3 messages").last.click(); page.wait_for_timeout(500)
    body = page.inner_text("body")
    check("All 3 messages" in body and "The garage gate will be closed for 2 days" in body and "garage cleaning on Sunday" in body and "مين راكن في الجراج مكاني؟" in body, "Show all 3 messages → every message, in full")
    ask(page, "what are all the talabat")
    body = page.inner_text("body")
    check("2 items still to buy" in body and "tortilla" in body and "milk" in body and "food and grocery delivery" not in body.lower(), "“what are all the talabat” → the Talabat list (tortilla, milk), not the delivery app")
    errs = real_errors(errors); check(not errs, "no JavaScript errors: %s" % errs[:2])
    br.close()
env.close(); finish()
