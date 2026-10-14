"""v6.27 — the Deadline Radar: free trials / renewals found by itself in notifications (added + reminded), and by hand:
scan a receipt (the phone reads it), paste or type, or the "Add by hand" form; Home's TODAY shows what is close; Chat's
«my Spotify trial ends on …» opens it; "Cancelled it" counts in the Guardian; Free watches 3.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v727radar.py     (SHOTS=dir for screenshots)
"""
import json, os, time, datetime, base64
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish, HERE
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
T = datetime.date.today()
words = lambda d: d.strftime("%d %b %Y").lstrip("0")
now = int(time.time() * 1000)
Q = [{"id": "t1", "app": "Google Play", "title": "Google Play", "text": "Your free trial of YouTube Premium ends on %s. You'll be charged USD 13.99" % words(T + datetime.timedelta(days=2)), "ts": now - 3600000},
     {"id": "p1", "app": "Chase", "title": "Chase", "text": "You paid $12.00 at STARBUCKS", "ts": now - 600000}]
RECEIPT = "BEST BUY\nApple AirPods Pro\nTotal $249.00\nReturn by %s" % (T + datetime.timedelta(days=12)).strftime("%m/%d/%Y")
def init(pro=True, radar=None):
    s = "try{localStorage.setItem('attune:start','home');localStorage.setItem('ledger.v3',JSON.stringify({currency:'USD',accounts:[{id:'c',name:'Cash',currency:'USD',start:0}],txns:[],budgets:{overall:0,cats:{}},recurring:[],debts:[]}))"
    if radar: s += ";localStorage.setItem('attune:radar:v1',%s)" % json.dumps(json.dumps(radar))
    if not pro: s += ";localStorage.setItem('attune:first-run','1');localStorage.setItem('attune:testing-pro','off')"
    s += "}catch(e){}\n"
    return s + r"""(() => { const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0);
    N.payAccess = () => true; N.openPayAccess = () => {}; N.payQueue = () => %s; N.payForget = () => {};
    N.readText = (id, arg) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ text: %s, lines: [] })), 50);
  }; go(); })();""" % (json.dumps(json.dumps(Q)), json.dumps(RECEIPT))

def open_radar(page):
    page.locator("nav button").last.click(); page.wait_for_timeout(300)
    page.locator(".rounded-t-2xl button:has-text('Deadline Radar')").first.click()
    page.wait_for_selector("[data-testid=radar-page]", timeout=5000); page.wait_for_timeout(300)

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=init())
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.wait_for_timeout(3500)   # the automatic scan runs ~2.5 s after opening
    R = page.evaluate("JSON.parse(localStorage.getItem('attune:radar:v1') || '{}')")
    items = R.get("items") or []
    check(len(items) == 1 and items[0]["title"] == "YouTube Premium" and items[0]["kind"] == "trial" and items[0]["amount"] == 13.99, "a free trial in the notifications is added by itself: %s" % [(i["title"], i["date"], i["amount"]) for i in items])
    notes = page.evaluate("window.__mock.notes.map(n => n.id + ' ' + n.title)")
    check(any(n.startswith("radar-") and "YouTube Premium" in n for n in notes), "…with a reminder before it: %s" % notes)
    led = page.evaluate("JSON.parse(localStorage.getItem('ledger.v3')).txns.map(t => t.amount)")
    check(13.99 not in led, "…and the future charge is NOT added to Money as a payment (%s)" % led)
    page.reload(); page.wait_for_selector("[data-testid=phone-home]", timeout=15000); page.wait_for_timeout(500)
    today = page.locator("[data-testid=home-today]").inner_text() if page.locator("[data-testid=home-today]").count() else ""
    check("YouTube Premium" in today, "Home's TODAY shows it: %s" % today.replace("\n", " · ")[:120])

    # ---- by hand: the form ----
    open_radar(page)
    check("YouTube Premium" in page.locator("[data-testid=radar-soon]").inner_text(), "the Radar lists it under Soon")
    page.click("[data-testid=radar-add]")
    page.click("[data-testid=radar-kind-warranty]")
    page.fill("[data-testid=radar-title]", "Fridge")
    page.fill("[data-testid=radar-date]", (T + datetime.timedelta(days=700)).isoformat())
    page.fill("[data-testid=radar-amount]", "900")
    page.click("[data-testid=radar-save]"); page.wait_for_timeout(300)
    check("Fridge" in page.locator("[data-testid=radar-later]").inner_text(), "Add by hand: a warranty saved, listed under Later")

    # ---- paste or type ----
    page.click("[data-testid=radar-paste]")
    page.fill("[data-testid=radar-text]", "My Netflix trial ends on %s" % words(T + datetime.timedelta(days=20)))
    page.click("[data-testid=radar-read]"); page.wait_for_timeout(300)
    check(page.locator("[data-testid=radar-form]").count() == 1 and page.locator("[data-testid=radar-title]").input_value() == "Netflix", "a typed sentence is read into a form to check: %s" % (page.locator("[data-testid=radar-title]").input_value() if page.locator("[data-testid=radar-title]").count() else ""))
    page.click("[data-testid=radar-save]"); page.wait_for_timeout(300)

    # ---- scan a receipt ----
    png = page.evaluate("""() => { const c = document.createElement('canvas'); c.width = 300; c.height = 400; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0,0,300,400); g.fillStyle = '#000'; g.fillText('BEST BUY', 20, 40); return c.toDataURL('image/png').split(',')[1]; }""")
    path = os.path.join(HERE, "_receipt.png"); open(path, "wb").write(base64.b64decode(png))
    page.set_input_files("[data-testid=radar-file]", path); os.remove(path)
    page.wait_for_selector("[data-testid=radar-form]", timeout=8000); page.wait_for_timeout(300)
    check(page.locator("[data-testid=radar-title]").first.input_value() == "Apple AirPods Pro" and page.locator("[data-testid=radar-amount]").first.input_value() == "249", "a receipt photo is read: AirPods Pro, 249, return by its date")
    page.locator("[data-testid=radar-save]").first.click(); page.wait_for_timeout(500)
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, "radar.png"), full_page=True)
    ph = page.locator("[data-testid=radar-item]:has-text('AirPods') [data-testid=radar-photo]")
    check(ph.count() == 1, "…and the receipt photo is kept with it")
    titles = page.evaluate("JSON.parse(localStorage.getItem('attune:radar:v1')).items.map(i => i.title + ' ' + i.source)")
    check(len(titles) == 4, "four deadlines: %s" % titles)

    # ---- done: cancelled the trial before the charge → saved ----
    page.locator("[data-testid=radar-item]:has-text('YouTube Premium') [data-testid=radar-cancelled]").click(); page.wait_for_timeout(300)
    g = page.evaluate("JSON.parse(localStorage.getItem('attune:guardian:v1') || '{}')")
    check(any(s["kind"] == "radar" and s["amount"] == 13.99 for s in g.get("saved", [])), "Cancelled it → 13.99 counted in the Guardian's saved")
    check("13.99" in page.locator("[data-testid=radar-saved]").inner_text(), "…and shown as saved by the Radar")

    # ---- Chat: «my Spotify trial ends on …» → Watch it ----
    page.locator("nav button:has-text('Chat')").click(); page.wait_for_timeout(300)
    page.locator("textarea[placeholder='Message Attune']").fill("my Spotify trial ends on %s" % words(T + datetime.timedelta(days=9)))
    page.locator("button[title='Send']").click(); page.wait_for_timeout(500)
    page.locator("button:has-text('Watch it')").click()
    page.wait_for_selector("[data-testid=radar-form]", timeout=5000)
    check(page.locator("[data-testid=radar-title]").input_value() == "Spotify", "Chat → Watch it opens the Radar with it read")
    ctx.close()

    # ---- Free: 3 deadlines ----
    three = {"items": [{"id": "a%d" % i, "kind": "warranty", "title": "Item %d" % i, "date": (T + datetime.timedelta(days=100 + i)).isoformat(), "amount": 0, "status": "active", "created": now} for i in range(3)], "seen": []}
    ctx, page = new_page(br, env, errors, extra_init=init(pro=False, radar=three))
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    open_radar(page)
    check(page.locator("[data-testid=radar-limit]").count() == 1, "Free: 3 deadlines watched — the limit card shows")
    page.click("[data-testid=radar-add]")
    page.wait_for_selector("[data-testid=upgrade]", timeout=5000)
    check(True, "…and adding a 4th opens the plan")
    ctx.close()
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
