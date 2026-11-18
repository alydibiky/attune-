"""v10.5 — the interactive widgets (Ali OK'd OK-A1 OK-W1 OK-W2 OK-W3 OK-W5 OK-W6 OK-W7 OK-S), on the real page, phone AND computer size:
 · the app hands every widget its data (setWidgets) — his Talabat list "9 left", Your day, Money with the CIB SMS, the stack;
 · a tap kept by the phone (Done on the maid reminder, Add ✓ on the CIB SMS) is applied once when the page runs, and forgotten by the phone;
 · the small box over the home screen (index.html?quick=…): "+ Add" → 3 items on Talabat (Undo takes them back), "− I spent" → Money,
   "Tell Attune" → a reminder, a question → "Open Chat".
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v1050widgets.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
NOW = datetime.datetime.now().replace(hour=9, minute=5, second=0, microsecond=0)
now = int(NOW.timestamp() * 1000)
day = NOW.strftime("%Y-%m-%d")
NAMES = ["Salsa", "Foul", "Lettuce", "Cucumber", "Tomatoes", "Bread", "Eggs", "Milk", "Cheese", "Tahina", "Pickles", "Rice", "Water"]
LISTS = {"lists": [{"id": "l1", "name": "Talabat", "emoji": "🛒", "items": [{"id": "i%d" % i, "text": t, "done": i < 4} for i, t in enumerate(NAMES)], "repeat": {"every": "once"}, "created": now - 86400000}]}
REM = [{"id": "maid", "title": "The maid comes", "at": now + 55 * 60000, "repeat": "none", "created": now - 86400000}]
LEDGER = {"accounts": [{"id": "a1", "name": "Cash", "currency": "EGP"}], "txns": [], "recurring": []}
CIB = {"id": "sms:cib1", "pkg": "com.google.android.apps.messaging", "app": "Messages", "title": "CIB",
       "text": "Your debit card ending 1234 was charged EGP 350.00 at CARREFOUR MAADI on %s. Available balance EGP 12,450.75" % NOW.strftime("%d/%m"), "ts": now - 3600000}
SEED = ("try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:coach:v1',JSON.stringify({seen:['*']}));localStorage.setItem('attune:lists:v1',%s);"
        "localStorage.setItem('attune:reminders:v1',%s);localStorage.setItem('ledger.v3',%s);}catch(e){};") % (json.dumps(json.dumps(LISTS)), json.dumps(json.dumps(REM)), json.dumps(json.dumps(LEDGER)))
ACTS = [{"w": "day", "a": "done", "id": "rem:maid", "at": now + 1000}, {"w": "money", "a": "add", "id": "bank:sms:cib1", "at": now + 2000}]
MOCK = ("(() => { let acts = %s; window.__sent = []; window.__cleared = []; function w(){ const N = window.AttuneNative; if (!N) return setTimeout(w, 5);"
        " N.setWidgets = (j) => { window.__sent.push(JSON.parse(j)); return true; }; N.widgetActs = () => JSON.stringify(acts);"
        " N.clearWidgetActs = (k) => { const ks = JSON.parse(k); window.__cleared.push(...ks); acts = acts.filter((a) => !ks.includes([a.w, a.a, a.id, a.at].join('|'))); };"
        " N.payAccess = () => true; N.payAvailable = () => true; N.payQueue = () => JSON.stringify([%s]); N.payForget = () => {}; N.smsDiag = () => '{\"live\":true,\"smsSwitch\":true}';"
        " N.quickClose = () => { window.__closed = true; }; N.quickOpen = (m, t) => { window.__opened = [m, t]; }; } w(); })();") % (json.dumps(ACTS), json.dumps(CIB))
with sync_playwright() as p:
    br = p.chromium.launch()
    for name, size in (("phone", None), ("computer", (1366, 860))):
        # ---- the app: data for every widget + the kept taps applied once
        ctx, page = new_page(br, env, errors, legacy_nav=False, desktop=size, extra_init=SEED + MOCK)
        ctx.clock.set_fixed_time(NOW)
        if not size: page.set_viewport_size({"width": 360, "height": 800})
        page.goto(env.url); page.wait_for_function("window.__sent && window.__sent.length > 0", timeout=20000); page.wait_for_timeout(800)
        d = page.evaluate("window.__sent[window.__sent.length - 1]")
        tal = (d.get("list") or {}).get("lists", [{}])[0]
        check(tal.get("side") == "9 left" and len(tal.get("items", [])) == 13 and all(not x["done"] for x in tal["items"][:9]), name + ": the Talabat widget gets all 13, “9 left”, ticked under: " + str(tal.get("side")))
        check(all(k in d for k in ("day", "money", "agents", "med", "papers", "trip", "next", "stack", "words")) and d["stack"]["pages"], name + ": every widget gets its data (and the stack its pages)")
        rem = json.loads(page.evaluate("localStorage.getItem('attune:reminders:v1')"))
        check(any(r["id"] == "maid" and r.get("done") for r in rem), name + ": Done on the maid (tapped on the home screen) is applied")
        led = json.loads(page.evaluate("localStorage.getItem('ledger.v3')"))
        n350 = [t for t in led["txns"] if t.get("amount") == 350]
        check(len(n350) == 1 and n350[0].get("source") == "notification", name + ": Add ✓ on the CIB SMS → Money once, as a bank message: " + json.dumps(n350)[:200])
        check(len(page.evaluate("window.__cleared")) == 2, name + ": the phone forgets the two taps once applied")
        page.evaluate("window.dispatchEvent(new Event('attune-widget-acts'))"); page.wait_for_timeout(600)
        rem2 = json.loads(page.evaluate("localStorage.getItem('attune:reminders:v1')")); led2 = json.loads(page.evaluate("localStorage.getItem('ledger.v3')"))
        check(len([t for t in led2["txns"] if t.get("amount") == 350]) == 1, name + ": a second ping applies nothing twice")
        ctx.close()
        # ---- the small box: + Add on the Talabat widget
        ctx, page = new_page(br, env, errors, legacy_nav=False, desktop=size, extra_init=SEED + MOCK)
        ctx.clock.set_fixed_time(NOW)
        if not size: page.set_viewport_size({"width": 360, "height": 800})
        page.goto(env.url + "?quick=list&list=l1"); page.wait_for_selector("[data-testid=quickbox]", timeout=15000)
        check(page.locator("[data-testid=chat-input]").count() == 0 and "Talabat" in page.inner_text("[data-testid=quickbox]"), name + ": only the box is drawn (the app isn't started), titled “Add to Talabat”")
        page.fill("[data-testid=quickbox-input]", "cheese, pickles and bread thanks"); page.click("[data-testid=quickbox-go]"); page.wait_for_timeout(300)
        items = [x["text"] for x in json.loads(page.evaluate("localStorage.getItem('attune:lists:v1')"))["lists"][0]["items"]]
        check(items[-3:] == ["cheese", "pickles", "bread"], name + ": 3 items added to Talabat: " + str(items[-3:]))
        page.click("[data-testid=quickbox-undo]"); page.wait_for_timeout(200)
        check(len(json.loads(page.evaluate("localStorage.getItem('attune:lists:v1')"))["lists"][0]["items"]) == 13, name + ": Undo takes them back")
        wide = page.evaluate("""() => [...document.querySelectorAll('[data-testid=quickbox] *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 2 || r.left < -2); }).length""")
        check(wide == 0, name + ": the box fits the screen (%d past the edge)" % wide)
        page.click("[data-testid=quickbox-close]"); page.wait_for_timeout(200)
        check(page.evaluate("window.__closed === true"), name + ": ✕ closes the box")
        ctx.close()
        # ---- − I spent
        ctx, page = new_page(br, env, errors, legacy_nav=False, desktop=size, extra_init=SEED + MOCK)
        ctx.clock.set_fixed_time(NOW)
        page.goto(env.url + "?quick=spend"); page.wait_for_selector("[data-testid=quickbox]", timeout=15000)
        page.fill("[data-testid=quickbox-input]", "٢٠٠ كشري"); page.click("[data-testid=quickbox-cat-food]"); page.click("[data-testid=quickbox-go]"); page.wait_for_timeout(300)
        led = json.loads(page.evaluate("localStorage.getItem('ledger.v3')"))
        check(any(t.get("amount") == 200 and t.get("type") == "expense" and t.get("cat") == "food" for t in led["txns"]), name + ": «٢٠٠ كشري» → −200 Food in Money")
        ctx.close()
        # ---- Tell Attune: a reminder, then a question → Open Chat
        ctx, page = new_page(br, env, errors, legacy_nav=False, desktop=size, extra_init=SEED + MOCK)
        ctx.clock.set_fixed_time(NOW)
        page.goto(env.url + "?quick=say"); page.wait_for_selector("[data-testid=quickbox]", timeout=15000)
        page.fill("[data-testid=quickbox-input]", "remind me tomorrow at 9 to call Sara"); page.click("[data-testid=quickbox-go]"); page.wait_for_timeout(400)
        rem = json.loads(page.evaluate("localStorage.getItem('attune:reminders:v1')"))
        check(any("Sara" in (r.get("title") or "") and r.get("source") == "widget" for r in rem) and page.locator("[data-testid=quickbox-line]").count() == 1, name + ": “remind me tomorrow at 9 to call Sara” → a reminder, with Undo")
        page.fill("[data-testid=quickbox-input]", "how much did I spend this week?"); page.click("[data-testid=quickbox-go]"); page.wait_for_timeout(300)
        check(page.locator("[data-testid=quickbox-open-chat]").count() == 1, name + ": a question → “Open Chat”")
        page.click("[data-testid=quickbox-open-chat]"); page.wait_for_timeout(200)
        check(page.evaluate("window.__opened && window.__opened[0] === 'chat' && /spend this week/.test(window.__opened[1])"), name + ": Chat opens with the question")
        ctx.close()
    errs = real_errors(errors); check(not errs, "no JavaScript errors: %s" % errs[:2])
    br.close()
env.close(); finish()
