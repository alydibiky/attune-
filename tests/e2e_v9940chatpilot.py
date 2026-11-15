"""v9.9.40 the new Autopilot on Home (Ali's OK on K1–K6): a new group is asked about ("What I understood" → Right), Talabat's messages
become Shopping items (also the ones that came while it was asking), a meme is kept quietly, "Done for you" opens the full message
with Undo / Open chat / Never from this chat, a group is described in the person's own words, Mama's request is a to-do; Arabic too.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v9940chatpilot.py
"""
import json, time, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
NOW = datetime.datetime.now().replace(hour=14, minute=0, second=0, microsecond=0)   # (a fixed afternoon: "Kept quietly TODAY" must not cross midnight)
now = int(NOW.timestamp() * 1000)
def wa(i, title, text, ago, group=False, who=""):
    n = {"id": "n" + str(i), "app": "WhatsApp", "pkg": "com.whatsapp", "title": title, "text": text, "ts": now - ago * 60000}
    if group: n.update({"group": True, "convo": title, "who": who})
    return n
NOTES = [wa(1, "Talabat", "tortilla", 30, True, "Noudy"), wa(2, "Talabat", "chicken strips", 25, True, "Noudy"), wa(3, "Talabat", "😂😂", 20, True, "Noudy"),
         wa(4, "Gym buddies", "leg day tomorrow at 7", 15, True, "Karim"), wa(5, "Mama", "can you call me when you're free", 10)]
MOCK = "(() => { const notes = %s; function w(){ const N = window.AttuneNative; if (!N) return setTimeout(w, 5); N.recallNotes = () => JSON.stringify(notes); } w(); })();" % json.dumps(NOTES)
INIT = "try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:test:quiet','0');localStorage.setItem('attune:coach:v1',JSON.stringify({seen:['*']}))}catch(e){};" + MOCK
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    ctx.clock.set_fixed_time(NOW)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_selector("[data-testid=chatpilot]", timeout=15000); page.wait_for_timeout(500)
    ask = page.locator("[data-testid=cp-ask]")
    check(ask.count() == 1 and "Talabat" in ask.inner_text(), "K1: the new group Talabat is asked about")
    und = page.locator("[data-testid=cp-understood]").inner_text()
    check("shared shopping list" in und, "…“What I understood”: Talabat = a shared shopping list (from its messages): " + und.replace("\n", " | "))
    lists = page.evaluate("JSON.parse(localStorage.getItem('attune:lists:v1')||'{\"lists\":[]}').lists")
    check(not any(l.get("chatKey") for l in lists), "nothing is added before Right (rule 2)")
    page.click("[data-testid=cp-right]"); page.wait_for_timeout(800)
    lists = page.evaluate("JSON.parse(localStorage.getItem('attune:lists:v1')).lists")
    tl = [l for l in lists if l.get("chatKey") == "whatsapp|g:talabat"]
    check(len(tl) == 1 and [i["text"] for i in tl[0]["items"]] == ["tortilla", "chicken strips"], "after Right: tortilla and chicken strips are on the Talabat list (the 😂 is not): %s" % ([i["text"] for i in tl[0]["items"]] if tl else None))
    check(page.locator("[data-testid=cp-shopping]").count() == 1 and "2 items" in page.locator("[data-testid=cp-shopping]").inner_text(), "K2: “Shopping · 2 items” on Home")
    check(page.locator("[data-testid=cp-quiet]").count() == 1 and "1" in page.locator("[data-testid=cp-quiet-line]").inner_text(), "NS-2: the meme is kept quietly (Kept quietly today: 1)")
    # Mama → a to-do with her message
    rem = page.evaluate("JSON.parse(localStorage.getItem('attune:reminders:v1')||'[]')"); rem = rem if isinstance(rem, list) else rem.get("items", [])
    check(any(r.get("source") == "chatpilot" and "Mama" in r.get("title", "") for r in rem), "Mama's request → a to-do (one person — no question needed)")
    # K4: a Done line → the full message → Undo
    line = page.locator("[data-testid=cp-line][data-kind=items]").first
    check(line.count() == 1, "Done for you: “Added … to Talabat”")
    line.click(); page.wait_for_selector("[data-testid=cp-sheet]", timeout=3000)
    check(page.locator("[data-testid=cp-full]").inner_text() in ("tortilla", "chicken strips") and "Talabat" in page.locator("[data-testid=cp-sheet]").inner_text(), "K4: the full message, its chat and why")
    check(all(page.locator("[data-testid=%s]" % t).count() == 1 for t in ("cp-undo", "cp-open-chat", "cp-never")), "…with Undo, Open chat, Never from this chat")
    page.click("[data-testid=cp-undo]"); page.wait_for_timeout(400)
    tl = [l for l in page.evaluate("JSON.parse(localStorage.getItem('attune:lists:v1')).lists") if l.get("chatKey") == "whatsapp|g:talabat"]
    check(len(tl[0]["items"]) == 1, "Undo takes that item off the list again")
    # K1 for the next group, in the person's own words
    ask = page.locator("[data-testid=cp-ask]")
    check(ask.count() == 1 and "Gym buddies" in ask.inner_text(), "the next new group: Gym buddies")
    page.fill("[data-testid=cp-say-input]", "my gym buddies, only if they talk about the schedule"); page.click("[data-testid=cp-say-go]"); page.wait_for_timeout(200)
    und = page.locator("[data-testid=cp-understood]").inner_text()
    check("your friends" in und and "schedule" in und, "your words → “What I understood”: friends · tell you when: schedule — " + und.replace("\n", " | "))
    page.click("[data-testid=cp-right]"); page.wait_for_timeout(300)
    roles = page.evaluate("JSON.parse(localStorage.getItem('attune:chatroles:v1'))")
    check(roles.get("whatsapp|g:gym buddies", {}).get("role") == "friends" and roles["whatsapp|g:gym buddies"].get("ok") and roles["whatsapp|g:gym buddies"].get("by") == "you", "saved as you said it (friends, confirmed by you)")
    # K3 (Ali's wish): "I bought the shopping list" in the Home box → the Talabat list is ticked, with Undo
    page.fill("[data-testid=home-ask]", "got everything"); page.click("[data-testid=home-send]"); page.wait_for_timeout(500)
    tl = [l for l in page.evaluate("JSON.parse(localStorage.getItem('attune:lists:v1')).lists") if l.get("chatKey") == "whatsapp|g:talabat"]
    check(all(i["done"] for i in tl[0]["items"]) and page.locator("text=Took 1 off Talabat").count() > 0, "K3: “got everything” → the Talabat list is ticked (“Took 1 off Talabat”)")
    page.click("[data-testid=do-undo]"); page.wait_for_timeout(300)
    tl = [l for l in page.evaluate("JSON.parse(localStorage.getItem('attune:lists:v1')).lists") if l.get("chatKey") == "whatsapp|g:talabat"]
    check(not any(i["done"] for i in tl[0]["items"]), "…Undo opens it again")
    ctx.close()
    # Arabic: the same card in Egyptian Arabic
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + "try{localStorage.setItem('attune:ui:lang','ar')}catch(e){}")
    ctx.clock.set_fixed_time(NOW)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_selector("[data-testid=cp-ask]", timeout=15000); page.wait_for_timeout(300)
    t = page.locator("[data-testid=cp-ask]").inner_text()
    check("اللي فهمته" in t and "قايمة مشتريات" in t and "What I understood" not in t, "Arabic: «اللي فهمته» · «قايمة مشتريات مشتركة»")
    errs = real_errors(errors); check(not errs, "no JavaScript errors: %s" % errs[:2])
    br.close()
env.close(); finish()
