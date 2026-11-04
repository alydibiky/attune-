"""v7.9 — Ali's 24 Oct phone list, fixed by code: the Guardian's "twice" card shows the two payments and asks when the times
don't prove a double charge (his 599 at كل الزوايا); People & plans asks "came today?" with a checkbox on the maid's day; Scout
opens the goal with new finds and marks them; the Code page fits a 360-px phone; Money → More has no Notes and points Invoices to
Business; Money's invoices are copied into Business → Books and its notes into Mind, once.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v900fixes.py     (SHOTS=dir for screenshots)
"""
import json, os, datetime, time, subprocess
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
T = datetime.date.today()
def shot(page, name, full=True):
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, name + ".png"), full_page=full)
def go(page, mode, sel):
    page.evaluate("m => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", mode); page.wait_for_selector(sel, timeout=8000); page.wait_for_timeout(400)
ACC = [{"id": "c", "name": "CIB", "currency": "EGP", "start": 0}]
# Ali's case: two 599s at كل الزوايا on the same day from notifications before v7.9 (no time kept)
TX = [{"id": "x1", "type": "expense", "amount": 599, "cat": "food", "account": "c", "date": (T - datetime.timedelta(days=1)).isoformat(), "note": "كل الزوايا · CIB"},
      {"id": "x2", "type": "expense", "amount": 599, "cat": "food", "account": "c", "date": (T - datetime.timedelta(days=1)).isoformat(), "note": "كل الزوايا · CIB"}]
INV = [{"id": "i1", "num": 7, "client": "Nile Bakery", "phone": "01001234567", "account": "c", "date": "2026-10-02", "taxPct": 14, "discount": 0, "items": [{"name": "Delivery", "qty": 2, "price": 500}], "payments": [{"id": "p", "amount": 400, "date": "2026-10-05"}]}]
NOTES = [{"id": "n1", "type": "text", "title": "Car insurance", "body": "Renew with Misr Insurance in November", "items": [], "pinned": False, "updated": 1}]
LEDGER = {"currency": "EGP", "accounts": ACC, "budgets": {"overall": 0, "cats": {}}, "txns": TX, "recurring": [], "debts": [], "invoices": INV, "notes": NOTES, "clients": []}
DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
LIFE_TEXT = "The maid comes every %s and takes 600 EGP" % DAYS[T.weekday()]
# a Scout goal with two finds, one new since it was last opened (made by the app's own code, so the shape is right)
SCOUT = json.loads(subprocess.check_output(["node", "-e", """
import("./web-src/scout.js").then((S) => {
  const g = S.parseGoal("Hyundai Tucson 2022 used");
  const now = Date.now(), ad = (id, title, price) => ({ ...S.readAd({ url: "https://www.hatla2ee.com/en/car/details/" + id, title, text: title + " for sale, price " + price + " EGP, 2022, 40,000 km" }, g), lastSeen: now, firstSeen: now });
  const seen = [ad(111, "Hyundai Tucson 2022 GDI", 1450000), ad(222, "Hyundai Tucson 2022 Highline", 1520000)];
  console.log(JSON.stringify({ goals: [{ id: "g1", text: "Hyundai Tucson 2022 used", g, seen, unseen: [seen[1].id], votes: {}, taste: {}, lastRun: now, on: true }] }));
});"""], cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))), stderr=subprocess.DEVNULL).decode())
CODE = [{"id": "p1", "title": "From chat", "lang": "html", "status": "draft", "code": "<p>x</p>"}, {"id": "p2", "title": "Make me a complete clothing store website", "lang": "python", "status": "draft", "code": "print(1)"},
        {"id": "p3", "title": "Bill splitter", "lang": "javascript", "status": "passed", "code": "1"}]
INIT = ("try{localStorage.setItem('ledger.v3',%s);localStorage.setItem('attune:scout:v1',%s);localStorage.setItem('attune:code:v1',%s)}catch(e){}"
        % (json.dumps(json.dumps(LEDGER)), json.dumps(json.dumps(SCOUT)), json.dumps(json.dumps(CODE))))
AR = ";try{localStorage.setItem('attune:ui:lang','ar')}catch(e){}"
LIGHT = ";try{localStorage.setItem('attune:theme:v1', JSON.stringify({accent:'teal',bg:'light'}))}catch(e){}"
def ledger(page): return page.evaluate("JSON.parse(localStorage.getItem('ledger.v3'))")

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_timeout(4500)   # the once-only moves run 3 s after start
    # ---- invoices → Business → Books, notes → Mind (once) ----
    mv = page.evaluate("JSON.parse(localStorage.getItem('attune:moved:invoices')||'null')")
    check(mv and len(mv["moved"]) == 1 and mv["moved"][0][0] == 7, "Money's invoice #7 was copied into Business → Books: %s" % mv)
    books = page.evaluate("""new Promise((ok) => { const r = indexedDB.open('attune-books', 1); r.onsuccess = () => { const t = r.result.transaction('kv'), st = t.objectStore('kv'), out = {};
      const q = st.openCursor(); q.onsuccess = () => { const c = q.result; if (c) { out[c.key] = c.value; c.continue(); } else ok({ docs: out.docs || [], customers: out.customers || [], payments: out.payments || [] }); }; }; r.onerror = () => ok(null); })""")
    check(books and len(books["docs"]) == 1 and books["docs"][0]["status"] == "posted" and books["docs"][0]["ref"] == "Yusr #7", "…a posted Books invoice marked Yusr #7")
    check(books and books["customers"][0]["name"] == "Nile Bakery" and len(books["payments"]) == 1 and books["payments"][0]["amount"] == 40000, "…with its customer and the 400 already paid as a receipt")
    check(page.evaluate("localStorage.getItem('attune:moved:notes')") == "1", "Money's note was copied into Mind")
    check(len(ledger(page)["invoices"]) == 1 and len(ledger(page)["notes"]) == 1, "…and nothing was taken out of Money")
    # ---- the Guardian: Ali's 599 ----
    go(page, "guardian", "[data-testid=guardian-page]")
    item = page.locator("[data-testid=guardian-item]:has-text('twice')")
    check(item.count() == 1 and "Same payment twice at" in item.inner_text() and "logged twice, or charged twice" in item.inner_text(), "no times kept → it asks \"Same payment twice?\": %s" % item.inner_text().split("\n")[0])
    check(item.locator("[data-testid=guardian-pair-row]").count() == 2 and "CIB" in item.locator("[data-testid=guardian-pair]").inner_text(), "…and shows the two payments it matched (day, account, source)")
    shot(page, "v900-guardian-twice")
    item.locator("[data-testid=guardian-remove-copy]").click(); page.wait_for_timeout(400)
    check(len(ledger(page)["txns"]) == 1 and ledger(page)["txns"][0]["id"] == "x1", "\"Logged twice — remove one\" takes the copy out of Money")
    check(page.locator("[data-testid=guardian-item]:has-text('twice')").count() == 0, "…and the card is gone")
    # ---- People & plans: the maid, on her day ----
    go(page, "life", "[data-testid=life-page]")
    page.fill("[data-testid=life-input]", LIFE_TEXT); page.keyboard.press("Enter"); page.wait_for_selector("[data-testid=life-draft]"); page.click("[data-testid=life-save]"); page.wait_for_timeout(300)
    ask = page.locator("[data-testid=life-ask-today]")
    check(ask.count() == 1 and "today" in ask.inner_text().lower() and page.locator("[data-testid=life-ask-came]").get_attribute("type") == "checkbox", "on her day People & plans asks, with a checkbox: %s" % (ask.inner_text().replace("\n", " · ") if ask.count() else ""))
    shot(page, "v900-maid-ask")
    n0 = len(ledger(page)["txns"])
    page.click("[data-testid=life-ask-came]"); page.wait_for_timeout(400)
    check(len(ledger(page)["txns"]) == n0 + 1 and ledger(page)["txns"][-1]["amount"] == 600, "ticked → 600 recorded in Money by itself")
    check(page.locator("[data-testid=life-ask-today]").count() == 0, "…and it isn't asked again today")
    # ---- Scout: the goal with new finds opens on them ----
    go(page, "scout", "[data-testid=scout-ad]")
    check(page.locator("[data-testid=scout-ad]").count() == 2, "Scout shows the two Tucsons")
    first = page.locator("[data-testid=scout-ad]").first
    check(first.get_attribute("data-new") == "1" and "Highline" in first.inner_text() and page.locator("[data-testid=scout-ad-new]").count() == 1, "…the new one first, marked New")
    shot(page, "v900-scout-new")
    # ---- Money → More: no Notes; Invoices → Business ----
    go(page, "money", "[data-testid=money-bar]")
    page.locator("[data-testid=money-more]").first.click(); page.wait_for_selector("[data-testid=money-more-sheet]")
    check(page.locator("[data-testid=money-more-notes]").count() == 0, "Money → More has no Notes")
    inv = page.locator("[data-testid=money-more-biz-invoices]")
    check(inv.count() == 1 and "Business" in inv.inner_text(), "Invoices says it is in Business → Books now")
    inv.click(); page.wait_for_timeout(900)
    check(page.locator("[data-testid=books-app], [data-testid=books]").count() >= 1 or "Books" in page.inner_text("body")[:4000], "…and opens Business → Books")
    ctx.close()
    # ---- the Code page at 360 px (Arabic, dark) and 390 px (light) ----
    for name, w, extra in [("v900-code-360-ar", 360, AR), ("v900-code-390-light", 390, LIGHT)]:
        ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + extra)
        page.set_viewport_size({"width": w, "height": 900})
        page.goto(env.url); page.wait_for_timeout(1200)
        go(page, "code", "[data-testid=code-page]")
        if page.locator("[data-testid=code-new]").count(): page.click("[data-testid=code-new]"); page.wait_for_selector("[data-testid=code-projects]", timeout=5000)   # it reopens the last program
        check(not page.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1"), "[%d px] the Code page doesn't overflow" % w)
        lab = page.locator("text=" + ("برامجك" if extra == AR else "Your programs")).first.bounding_box() if page.locator("text=" + ("برامجك" if extra == AR else "Your programs")).count() else None
        card = page.locator("[data-testid=code-projects] > div").first.bounding_box()
        check(lab is None or lab["y"] + lab["height"] <= card["y"] + 1, "[%d px] \"Your programs\" sits above the cards, not under them" % w)
        cards = page.locator("[data-testid=code-projects] > div")
        check(all(cards.nth(i).bounding_box()["x"] + cards.nth(i).bounding_box()["width"] <= w + 1 for i in range(cards.count())), "[%d px] no program card is cut off" % w)
        b = page.locator("[data-testid=code-build]").bounding_box()
        check(b["x"] >= 0 and b["x"] + b["width"] <= w + 1 and b["height"] >= 44, "[%d px] Build & test fits, ≥ 44 px" % w)
        shot(page, name)
        ctx.close()
    br.close()
check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
finish()
