"""Voice (VOICE_PLAN.md, design A — Ali's pick): the Home box's orb opens "Ya Attune"; a message goes to the CORRECT contact
(two Ahmeds → asked; the language asked once and remembered; the read-back names the full contact, the app and their last
message; sent through that chat's own reply), "who messaged me" reads the inbox, a person who only wrote in a group is never
reached through the group, and anything else (money, reminders…) is done by the Home box and spoken.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v1100voice.py     (SHOTS=dir for screenshots)
"""
import json, os, time
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
def shot(page, name):
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, name + ".png"))
now = int(time.time() * 1000)
INBOX = [{"key": "whatsapp|p:Ahmed Samir", "app": "whatsapp", "who": "Ahmed Samir", "text": "enta gay emta?", "ts": now - 60000, "canReply": True},
         {"key": "whatsapp|p:Ahmed Ali", "app": "whatsapp", "who": "Ahmed Ali", "text": "ok", "ts": now - 600000, "canReply": True},
         {"key": "whatsapp|p:ماما", "app": "whatsapp", "who": "ماما", "text": "كلمني", "ts": now - 120000, "canReply": True},
         {"key": "whatsapp|g:Family", "app": "whatsapp", "who": "Khaled", "convo": "Family", "group": True, "text": "salam", "ts": now - 30000, "canReply": True}]
INIT = """const N = window.AttuneNative; window.__replies = []; window.__intents = [];
N.chatInbox = () = > '%s';
N.chatReply = (j) => { window.__replies.push(JSON.parse(j)); return JSON.stringify({ok: true}); };
N.intent = (j) => { window.__intents.push(JSON.parse(j)); return JSON.stringify({ok: true}); };
N.speakWait = (id, a) => { window.__said = (window.__said || []).concat(JSON.parse(a).text); setTimeout(() => window.__attuneNative.resolve(id, '{}'), 10); };
delete N.listen; N.listen = undefined;
window.__sms = false; N.smsNotifs = () => window.__sms; N.setSmsNotifs = (on) => { window.__sms = on; };""".replace("= >", "=>") % json.dumps(INBOX).replace("'", "\\'")
def say(page, text):
    page.fill("[data-testid=voice-input]", text); page.click("[data-testid=voice-type-go]"); page.wait_for_timeout(350)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + "try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:country','eg')}catch(e){}")
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=home-voice]", timeout=15000)
    page.click("[data-testid=home-voice]"); page.wait_for_selector("[data-testid=voice-screen]")
    check(page.locator("[data-testid=voice-orb]").count() == 1, "the orb opens “Ya Attune” (design A)")
    check(page.locator("[data-testid=sms-switch-input]").count() == 1 and not page.locator("[data-testid=sms-switch-input]").is_checked(), "SMS (Ali picked B): a switch, off by default")
    page.click("[data-testid=sms-switch-input]")
    check(page.evaluate("window.__sms") is True, "…switching it on tells the phone (setSmsNotifs)")
    say(page, "ابعت لأحمد إني هتأخر نص ساعة")
    opts = page.locator("[data-testid=voice-option]").all_inner_texts()
    check(opts == ["Ahmed Samir", "Ahmed Ali"], "two Ahmeds → it asks which one: %s" % opts)
    page.locator("[data-testid=voice-option]", has_text="Ahmed Samir").click(); page.wait_for_timeout(300)
    check("فرانكو" in page.inner_text("[data-testid=voice-ask]"), "then it asks Arabic or Franco (he writes Franco)")
    page.locator("[data-testid=voice-option]", has_text="فرانكو").click(); page.wait_for_timeout(300)
    rb = page.inner_text("[data-testid=voice-readback]")
    check(page.inner_text("[data-testid=voice-text]") == "hat2akhar nos sa3a" and "Ahmed Samir" in page.inner_text("[data-testid=voice-to]") and "enta gay emta?" in rb, "read-back: «hat2akhar nos sa3a» to Ahmed Samir · WhatsApp, with his last message to check: " + rb.replace("\n", " · ")[:120])
    check(page.evaluate("window.__replies").__len__() == 0, "nothing is sent before Send")
    shot(page, "v1100-voice-readback")
    page.click("[data-testid=voice-send]"); page.wait_for_timeout(300)
    rp = page.evaluate("window.__replies")
    check(rp == [{"key": "whatsapp|p:Ahmed Samir", "text": "hat2akhar nos sa3a"}], "Send → into exactly Ahmed Samir's chat (its own reply key): %s" % rp)
    check(any("Ahmed Samir" in s for s in page.evaluate("window.__said || []")), "…and it says so out loud")
    say(page, "ابعت لأحمد سمير إني وصلت")
    check(page.inner_text("[data-testid=voice-text]") == "wselt", "the second time: no language question — Franco is remembered for Ahmed Samir")
    page.click("[data-testid=voice-change]"); page.fill("[data-testid=voice-edit]", "وصلت البيت"); page.click("[data-testid=voice-edit-ok]"); page.wait_for_timeout(300)
    check(page.inner_text("[data-testid=voice-text]") == "wselt el beit", "Change by hand → read back again, in Franco: wselt el beit")
    say(page, "لا")
    check(len(page.evaluate("window.__replies")) == 1, "«لا» → nothing sent")
    # a person who only wrote in a group
    say(page, "ابعت لخالد إني جاي"); say(page, "عربي")
    check(page.locator("[data-testid=voice-group-note]").count() == 1, "Khaled only wrote in the Family group → the card says the app opens on him, not the group")
    say(page, "ابعت")
    check(len(page.evaluate("window.__replies")) == 1 and page.evaluate("window.__intents")[-1]["message"] == "جاي", "…and it is NOT sent into the group: WhatsApp opens with the text ready")
    say(page, "مين بعتلي؟")
    check(page.locator("[data-testid=voice-messages] p").count() >= 6, "«مين بعتلي؟» → the newest messages, read aloud")
    say(page, "سجل غدا ١٥٠")
    check(page.locator("[data-testid=voice-done]").count() == 1, "anything else (log lunch 150) is done by the Home box and spoken: " + page.inner_text("[data-testid=voice-done]")[:80])
    shot(page, "v1100-voice-done")
    page.click("[data-testid=voice-close]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=voice-screen]").count() == 0, "✕ closes it")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
finish()
