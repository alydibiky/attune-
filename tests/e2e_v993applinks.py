"""v9.9.3 W2 (Ali: "ask which Ahmed if it doesn't know and I can choose the contact; it must not affect Google Play"): a sentence →
the app opens at the right place (wa.me / tel: / Uber / Maps link); two Ahmeds → "Which Ahmed?" (saved people + Pick from contacts,
Android's own picker — no contacts permission); the pick is remembered.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v993applinks.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
DIR = {"v": 1, "skip": [], "items": [
  {"id": "a1", "kind": "person", "name": "Ahmed Salah", "aliases": ["Ahmed"], "role": "", "contact": {"name": "Ahmed Salah", "phone": "01001234567"}, "picks": {}, "created": 1},
  {"id": "a2", "kind": "person", "name": "Ahmed Work", "aliases": ["Ahmed"], "role": "", "contact": {"name": "Ahmed W", "phone": "01111111111"}, "picks": {}, "created": 2}]}
INIT = "try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:people:v1', %s)}catch(e){}" % json.dumps(json.dumps(DIR))
MOCK = """(() => { window.__opened = []; function w(){ const N = window.AttuneNative; if (!N) return setTimeout(w, 5);
  N.openAnyApp = (j) => { window.__opened.push(JSON.parse(j)); return JSON.stringify({ ok: true }); };
  const old = N.contactPick; N.contactPick = (id, j) => { setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ name: "Karim Hassan", phone: "0122 333 4444" })), 10); }; } w(); })();"""
def home(page, t):
    page.fill("[data-testid=home-ask]", t); page.click("[data-testid=home-send]"); page.wait_for_timeout(500)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + ";" + MOCK)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_timeout(1500)
    home(page, "send Ahmed 'I'm on my way' on WhatsApp")
    check(page.locator("[data-testid=who-pick]").count() == 1 and page.locator("[data-testid=who-pick-card]").count() == 2, "two Ahmeds → “Which Ahmed?” with both and Pick from contacts")
    check("never reads your contacts" in page.inner_text("[data-testid=who-pick]"), "…it says Attune sees only the contact you pick")
    check(page.evaluate("window.__opened.length") == 0, "nothing opens before you choose")
    page.locator("[data-testid=who-pick-card]", has_text="Ahmed Salah").click(); page.wait_for_timeout(300)
    o = page.evaluate("window.__opened")
    check(o and o[-1]["url"] == "https://wa.me/201001234567?text=I'm%20on%20my%20way" and o[-1]["pkg"] == "com.whatsapp", "→ WhatsApp opens on Ahmed Salah's chat with “I'm on my way” written (%s)" % (o[-1] if o else None))
    home(page, "send Ahmed 'see you at 8' on WhatsApp")
    check(page.locator("[data-testid=who-pick]").count() == 0 and "201001234567" in page.evaluate("window.__opened")[-1]["url"], "next time “Ahmed” = Ahmed Salah (remembered), no question")
    home(page, "call Karim")
    check(page.locator("[data-testid=who-pick]").count() == 1 and page.locator("[data-testid=who-pick-card]").count() == 0, "Karim isn't saved → only Pick from contacts")
    has_resolve = True
    if has_resolve:
        page.click("[data-testid=who-pick-contacts]"); page.wait_for_timeout(400)
        o = page.evaluate("window.__opened")[-1]
        check(o["url"] == "tel:01223334444", "picked from contacts → the dialer with Karim's number (you press Call): %s" % o)
        dirs = page.evaluate("JSON.parse(localStorage.getItem('attune:people:v1')).items.map(p => p.name)")
        check("Karim" in dirs, "…and Karim is saved in People for next time")
    else:
        page.click("[data-testid=who-pick-cancel]")
    home(page, "uber to Cairo Festival City")
    o = page.evaluate("window.__opened")[-1]
    check(o["pkg"] == "com.ubercab" and "Cairo%20Festival%20City" in o["url"], "“uber to Cairo Festival City” → Uber with the destination")
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'chat'}}))"); page.wait_for_timeout(500)
    page.locator("textarea[placeholder='Message Attune']").fill("directions to Fawzy El-Kababgy"); page.locator("button[title='Send']").first.click(); page.wait_for_timeout(600)
    o = page.evaluate("window.__opened")[-1]
    check(o["url"].startswith("https://www.google.com/maps/dir/") and "Fawzy" in o["url"], "Chat: “directions to Fawzy El-Kababgy” → Google Maps")
    check(not real_errors(errors), "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
