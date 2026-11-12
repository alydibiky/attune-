"""v9.9.22 B5 people (Ali's picks): N3 "A year ago today" on Home (tap → the original; Nice / Hide these), P1 Keep in touch on People
(each person how often; due ones say ✓ Talked; a chat in the notifications resets it; one "Say hi?" a day on Home), P3 Occasions
(People list + a person's dates; on the day from 9:00 a card on Home with a wish in their language and Send on WhatsApp).
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v9922b5.py
"""
import json, time, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
t = datetime.date.today(); now = int(time.time() * 1000); D = 864e5
LEDGER = {"txns": [{"id": "old1", "type": "expense", "amount": 3500, "cat": "car", "account": "cash", "date": t.replace(year=t.year - 1).isoformat() if not (t.month == 2 and t.day == 29) else "2024-02-29", "note": "last car instalment"}],
          "accounts": [{"id": "cash", "name": "Cash", "currency": "EGP", "start": 5000}]}
DIR = {"v": 1, "skip": [], "items": [
  {"id": "nada", "kind": "person", "name": "Nada", "aliases": [], "role": "sister", "contact": {"name": "Nada", "phone": "+201001112223"}, "lang": "ar", "created": now - 90 * D, "dates": [{"kind": "birthday", "md": t.strftime("%m-%d"), "year": 1996}]},
  {"id": "karim", "kind": "person", "name": "Karim", "aliases": [], "role": "friend", "created": now - 90 * D, "touch": {"every": 30, "since": now - 40 * D}},
  {"id": "mum", "kind": "person", "name": "Mum", "aliases": ["mama"], "role": "mother", "created": now - 90 * D, "touch": {"every": 3, "since": now - 10 * D}}]}
INBOX = [{"key": "w1", "who": "Mum", "app": "WhatsApp", "ts": now - 3600000, "text": "call me later"}]
INIT = ("try{localStorage.setItem('attune:start','home');if(!localStorage.getItem('t:seeded')){localStorage.setItem('t:seeded','1');localStorage.setItem('ledger.v3',%s);localStorage.setItem('attune:people:v1',%s);localStorage.setItem('attune:people:seeded','1')}}catch(e){}"
        "(() => { function w(){ const N = window.AttuneNative; if (!N) return setTimeout(w, 5); window.__opened = []; N.chatInbox = () => %s; N.openUrl = (u) => { window.__opened.push(u); return true; }; } w(); })();") % (json.dumps(json.dumps(LEDGER)), json.dumps(json.dumps(DIR)), json.dumps(json.dumps(INBOX)))
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_timeout(1800)
    # N3
    c = page.locator("[data-testid=home-onthisday]")
    check(c.count() == 1 and "A year ago today" in c.inner_text() and "3,500" in c.inner_text() and "car instalment" in c.inner_text(), "N3: 'A year ago today' — the car instalment 3,500: " + (c.inner_text().replace("\n", " ") if c.count() else "none"))
    page.click("[data-testid=onthisday-nice]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=home-onthisday]").count() == 0, "N3: Nice hides it for today")
    # P3 on Home (after 9:00 only)
    occ = page.locator("[data-testid=home-occasion]")
    if datetime.datetime.now().hour >= 9:
        check(occ.count() == 1 and "Nada" in occ.inner_text() and "turns 30" in occ.inner_text(), "P3: Nada birthday card on Home, turns 30")
        wish = page.locator("[data-testid=home-occasion-wish]").inner_text()
        check("كل سنة وانت طيب يا Nada" in wish, "P3: the wish is in Nada's language (Arabic): " + wish)
        page.click("[data-testid=home-occasion-send]"); page.wait_for_timeout(200)
        op = page.evaluate("window.__opened")
        check(op and op[0].startswith("https://wa.me/201001112223?text="), "P3: Send opens WhatsApp to Nada with the wish: " + str(op)[:120])
        check(page.locator("[data-testid=home-occasion]").count() == 0, "P3: sent → the card goes for today")
    else:
        check(occ.count() == 0, "P3: before 9:00 no occasion card yet")
    # P1 on Home: Karim is due (40 days, every 30); Mum's WhatsApp an hour ago resets her
    tc = page.locator("[data-testid=home-touch]")
    check(tc.count() == 1 and "Karim" in tc.inner_text(), "P1: one 'Say hi to Karim?' on Home: " + (tc.inner_text().replace("\n", " ") if tc.count() else "none"))
    page.click("[data-testid=home-touch-later]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=home-touch]").count() == 0, "P1: Later → no more nudges today")
    # People page
    page.evaluate("m => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", "people"); page.wait_for_selector("[data-testid=people-touch]", timeout=6000)
    rows = page.locator("[data-testid=touch-row]")
    k = rows.filter(has_text="Karim"); m = rows.filter(has_text="Mum")
    check(k.get_attribute("data-due") == "1" and m.get_attribute("data-due") == "0" and "today" in m.inner_text(), "P1: Karim due; Mum not (her WhatsApp today counts): " + m.inner_text().replace("\n", " "))
    k.locator("[data-testid=touch-talked]").click(); page.wait_for_timeout(300)
    check(rows.filter(has_text="Karim").get_attribute("data-due") == "0", "P1: ✓ Talked resets Karim")
    o = page.locator("[data-testid=occasion-row]").first.inner_text()
    check("Nada" in o and "Today" in o and "turns 30" in o, "P3: Occasions list — Nada, today, turns 30: " + o.replace("\n", " "))
    # a person's card: add a birthday to Karim
    page.locator("[data-testid=touch-row]").filter(has_text="Karim").locator("button").first.click(); page.wait_for_selector("[data-testid=person-b5]")
    page.click("[data-testid=person-date-add]"); page.fill("[data-testid=person-date-input]", "1990-03-15"); page.click("[data-testid=person-date-save]"); page.wait_for_timeout(300)
    d = [x for x in page.evaluate("JSON.parse(localStorage.getItem('attune:people:v1')).items") if x["id"] == "karim"][0]
    check(d.get("dates") == [{"kind": "birthday", "md": "03-15", "year": 1990}], "P3: Karim's birthday saved (15 March 1990): " + json.dumps(d.get("dates")))
    page.click("[data-testid=person-every-7]"); page.wait_for_timeout(200)
    d = [x for x in page.evaluate("JSON.parse(localStorage.getItem('attune:people:v1')).items") if x["id"] == "karim"][0]
    check(d["touch"]["every"] == 7, "P1: how often → every week")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
env.close(); finish()
