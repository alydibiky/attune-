"""v9.9.3 Ali picked L1–L4 (9 Nov): teach Attune from notifications — on a Recall notification ("she's my wife" → I understood:
Nada = your wife → Save), from the Home box ("tell me when my wife gets home" → a phone alert), Home asks once "Who is Sara?",
Home reads "Your wife (Nada) · Arrived at Home", Chat answers "where's my wife?" from Life360, "never show Yazio" hides it.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v993teach.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
NOW = datetime.datetime(2026, 11, 9, 18, 0, 0); T0 = int(NOW.timestamp() * 1000); H = 3600000
L = lambda i, t, x, ago: {"id": i, "pkg": "com.life360.android.safetymapd", "app": "Life360", "title": t, "text": x, "ts": T0 - int(ago * H)}
NOTES = [L(1, "Nada", "Arrived at Home", 0.4), L(2, "Nada", "🏁 Completed a 13km drive", 0.6), L(3, "Sara", "Arrived at Work", 3), L(4, "Sara", "Left Work", 5), L(5, "Sara", "Completed a 5km drive", 6),
         {"id": 6, "pkg": "com.yazio.android", "app": "Yazio", "title": "Water", "text": "Keep your kidneys healthy with an extra glass of water today.", "ts": T0 - 2 * H}]
INIT = "try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:dayset:v1', JSON.stringify({notes:true}))}catch(e){}"
MOCK = "(() => { const notes = %s; window.__watch = []; function w(){ const N = window.AttuneNative; if (!N) return setTimeout(w, 5); N.recallNotes = () => JSON.stringify(notes); N.recallIsOn = () => true; N.watchSave = (j) => { window.__watch.push(JSON.parse(j)); }; } w(); })();" % json.dumps(NOTES)
def open_mode(page, m, sel):
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'%s'}}))" % m); page.wait_for_selector(sel, timeout=10000); page.wait_for_timeout(300)
people = lambda page: page.evaluate("(JSON.parse(localStorage.getItem('attune:people:v1')||'{\"items\":[]}').items)")
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + ";" + MOCK)
    ctx.clock.set_fixed_time(NOW)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_timeout(1500)
    # L3 — Home asks once about a name seen often (Sara 3×, Nada 2× → only Sara)
    page.wait_for_selector("[data-testid=who-ask]", timeout=10000)
    check("Sara" in page.inner_text("[data-testid=who-ask]"), "Home asks once: I see “Sara” often in Life360. Who is this?")
    page.click("[data-testid=who-ask-skip]"); page.wait_for_timeout(300)
    check(page.locator("[data-testid=who-ask]").count() == 0, "Skip → not asked again")
    # L1 on a Recall notification
    open_mode(page, "recall", "[data-testid=recall-hit]")
    page.locator("[data-testid=recall-hit]", has_text="Completed a 13km drive").first.click(); page.wait_for_selector("[data-testid=teach-box]")
    page.fill("[data-testid=teach-input]", "she's my wife"); page.click("[data-testid=teach-go]"); page.wait_for_timeout(200)
    check("Nada = your wife" in page.inner_text("[data-testid=teach-understood]"), "on Nada's notification, “she's my wife” → I understood: Nada = your wife (nothing saved yet)")
    check(not people(page), "…nothing is saved before Save")
    page.click("[data-testid=teach-save]"); page.wait_for_timeout(200)
    pp = people(page)
    check(len(pp) == 1 and pp[0]["name"] == "Nada" and pp[0]["role"] == "wife", "Save → Nada's People card says wife")
    page.keyboard.press("Escape"); page.mouse.click(5, 5); page.wait_for_timeout(200)
    # L4 on Home
    open_mode(page, "home", "[data-testid=day-notes]")
    fam = page.locator("[data-testid=day-family]")
    check(fam.count() == 1 and "Your wife (Nada) · Arrived at Home" in fam.first.inner_text(), "Home: Your wife (Nada) · Arrived at Home")
    # L2 from the Home box
    page.fill("[data-testid=home-ask]", "tell me when my wife gets home"); page.click("[data-testid=home-send]"); page.wait_for_timeout(500)
    w = page.evaluate("window.__watch")
    rules = w[-1]["rules"] if w else []
    check(any(r.get("who") == ["Nada"] and "life360" in r.get("app", "") for r in rules), "“tell me when my wife gets home” → a phone alert for Nada on Life360 (works with Attune closed)")
    check("I'll tell you when Nada arrives" in page.inner_text("body"), "…and it says: Learnt: I'll tell you when Nada arrives — Home")
    page.fill("[data-testid=home-ask]", "never show Yazio"); page.click("[data-testid=home-send]"); page.wait_for_timeout(500)
    t = page.evaluate("JSON.parse(localStorage.getItem('attune:noteteach:v1')||'{}')")
    check(any(r.get("kind") == "hide" and r.get("app") == "yazio" for r in t.get("rules", [])), "“never show Yazio” → a hide rule")
    open_mode(page, "recall", "[data-testid=recall-hit]")
    check("kidneys" not in page.inner_text("body"), "Recall no longer shows Yazio's notifications")
    # Chat
    open_mode(page, "chat", "textarea[placeholder='Message Attune']")
    page.locator("textarea[placeholder='Message Attune']").fill("where's my wife?"); page.locator("button[title='Send']").first.click(); page.wait_for_timeout(800)
    check("Arrived at Home" in page.inner_text("body"), "Chat: “where's my wife?” → Life360: Nada — Arrived at Home")
    check(not real_errors(errors), "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
