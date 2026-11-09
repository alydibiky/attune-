"""v9.9.11 (Ali picked A1 A4 L: "ask me, I tell it what it is and it understands, so next time it knows" + "make sure it's smart and
understands anything I type"): Follow-ups asks about the WhatsApp wages group; a free sentence is understood, confirmed, saved;
never asked again; What Attune learned lists it with Undo; Chat "teach me your notifications" asks there too.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v999teachnotes.py
"""
import json, time
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
now = int(time.time() * 1000)
NOTES = [{"id": "w1", "pkg": "com.whatsapp", "app": "WhatsApp", "title": "ما يخص المرتبات: Mahmoud 3ashour (Alex Accountant)", "text": "ابراهيم حسن ايام الجراح ٣٠٠\nغفره بليل ٤٥٠ جنيه+١٠٠جنيه اعاشه", "ts": now - 3600000},
         {"id": "w2", "pkg": "com.whatsapp", "app": "WhatsApp", "title": "ما يخص المرتبات (2 messages)", "text": "Mahmoud: محمد ٢٠٠ جنيه", "ts": now - 1800000},
         {"id": "b1", "pkg": "com.cib.mobile", "app": "CIB", "title": "CIB", "text": "Your account was credited with EGP 450.00 via InstaPay", "ts": now - 600000}]
INIT = "try{localStorage.setItem('attune:start','home')}catch(e){}"
MOCK = "(() => { function w(){ const N = window.AttuneNative; if (!N) return setTimeout(w, 5); N.recallNotes = () => JSON.stringify(%s); N.payQueue = () => '[]'; } w(); })();" % json.dumps(NOTES)
def open_mode(page, m, sel):
    page.evaluate("m => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", m); page.wait_for_selector(sel, timeout=8000); page.wait_for_timeout(300)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + ";" + MOCK)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_timeout(1200)
    open_mode(page, "timeline", "[data-testid=fu-thread]")
    asks = page.locator("[data-testid=note-ask]")
    check(asks.count() == 1 and "ما يخص المرتبات" in asks.first.inner_text(), "Follow-ups asks once about the WhatsApp group (two messages = one question; the CIB credit is not asked)")
    page.fill("[data-testid=note-ask-input]", "this is the work wages group, it's never my money"); page.click("[data-testid=note-ask-go]"); page.wait_for_timeout(300)
    u = page.locator("[data-testid=note-ask-understood]").inner_text()
    check("ما يخص المرتبات" in u and "never counted as money" in u, "your words are understood and shown first: " + u.replace("\n", " "))
    check(page.evaluate("JSON.parse(localStorage.getItem('attune:noteteach:v1') || '{}').rules || []") == [], "…nothing saved before Save")
    page.click("[data-testid=note-ask-save]"); page.wait_for_timeout(300)
    rules = page.evaluate("JSON.parse(localStorage.getItem('attune:noteteach:v1')).rules")
    check(len(rules) == 1 and rules[0]["meaning"] == "work" and page.locator("[data-testid=note-ask]").count() == 0, "Save → learnt (work talk) and the question goes")
    open_mode(page, "home", "body"); open_mode(page, "timeline", "[data-testid=fu-thread]")
    check(page.locator("[data-testid=note-ask]").count() == 0, "next time it knows — not asked again")
    page.click("[data-testid=learned-open]"); page.wait_for_selector("[data-testid=learned-sheet]")
    row = page.locator("[data-testid=learned-row][data-type=label]")
    check(row.count() == 1 and "ما يخص المرتبات" in row.inner_text(), "What Attune learned lists it")
    row.locator("[data-testid=learned-undo]").click(); page.wait_for_timeout(300)
    check(page.locator("[data-testid=learned-row][data-type=label]").count() == 0, "Undo removes it")
    page.keyboard.press("Escape"); page.mouse.click(10, 10); page.wait_for_timeout(300)
    # Chat: "teach me your notifications" (the group is unknown again after Undo)
    open_mode(page, "chat", "textarea[placeholder='Message Attune']")
    page.locator("textarea[placeholder='Message Attune']").fill("علمني اشعاراتي"); page.locator("button[title='Send']").first.click()
    page.wait_for_selector("[data-testid=chat-teach] [data-testid=note-ask]", timeout=5000)
    check("ما يخص المرتبات" in page.locator("[data-testid=chat-teach]").inner_text(), "Chat «علمني اشعاراتي» → the same question in the conversation")
    page.click("[data-testid=chat-teach] [data-testid=note-ask-notmoney]"); page.click("[data-testid=chat-teach] [data-testid=note-ask-save]"); page.wait_for_timeout(300)
    check(page.locator("[data-testid=teach-chat-done]").count() == 1, "…a quick answer + Save → “That's all for now — I learnt 1”")
    check(page.evaluate("JSON.parse(localStorage.getItem('attune:noteteach:v1')).rules[0].meaning") == "notmoney", "…saved as not money")
    # A2: answers given on the phone's own "What is this?" question
    ANS = [{"key": "com.whatsapp|ما يخص المرتبات", "meaning": "notmoney", "said": "", "n": NOTES[0]},
           {"key": "com.whatsapp|ahmed brother", "meaning": "", "said": "that's my brother, he sends me money every month", "n": {"pkg": "com.whatsapp", "app": "WhatsApp", "title": "Ahmed Brother", "text": "حولتلك 2000 جنيه", "ts": now}}]
    MOCK2 = "(() => { window.__known = null; let given = false; function w(){ const N = window.AttuneNative; if (!N) return setTimeout(w, 5); N.recallNotes = () => '[]'; N.payQueue = () => '[]'; N.noteAskTake = () => { if (given) return '[]'; given = true; return JSON.stringify(%s); }; N.noteAskKnown = (j) => { window.__known = JSON.parse(j); }; N.noteAskWords = () => {}; } w(); })();" % json.dumps(ANS)
    ctx2, page2 = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + ";" + MOCK2)
    page2.set_viewport_size({"width": 390, "height": 844}); page2.goto(env.url); page2.wait_for_timeout(3000)
    r2 = page2.evaluate("(JSON.parse(localStorage.getItem('attune:noteteach:v1') || '{}').rules || []).map(r => r.meaning + ':' + r.src.name)")
    check(r2 == ["notmoney:ما يخص المرتبات"], "A2: a tap on “Not money” on the phone's question is learnt as soon as Attune opens: %s" % r2)
    check(page2.evaluate("window.__known") == [{"pkg": "com.whatsapp", "name": "ما يخص المرتبات"}], "…and the phone is told, so it never asks about that group again")
    open_mode(page2, "timeline", "[data-testid=fu-thread]")
    page2.wait_for_selector("[data-testid=note-ask-understood]", timeout=5000)
    u2 = page2.locator("[data-testid=note-ask-understood]").inner_text()
    check("Ahmed Brother" in u2 and "My money" in u2, "A2: what you typed in Reply… is read and waits in Follow-ups as “I understood …” — " + u2.replace("\n", " "))
    check(len(page2.evaluate("JSON.parse(localStorage.getItem('attune:noteteach:v1')).rules")) == 1, "…not saved before Save")
    page2.click("[data-testid=note-ask-save]"); page2.wait_for_timeout(300)
    check(len(page2.evaluate("JSON.parse(localStorage.getItem('attune:noteteach:v1')).rules")) == 2, "Save → learnt")
    check(not real_errors(errors), "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
