"""v6.8 — Mind (Memory replaced by "an app like mymind, but better", Ali). Keep anything and it files
itself: the kind by code (link, product, quote, to-do…), a title / summary / tags by the model in the
background; plain-words search with filters ("links", «صور», "last month"); kind chips and Spaces;
an item opens with its tags, a note, pin, remind-me, similar items; Ask your Mind shows its sources;
old Memory records are all still there; From your past; photos keep a thumbnail; Promises and Your
words are tabs.

  python3 tests/e2e_v68.py
"""
import json, time, zlib, struct
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish

env = Env()
def png(w=24, h=16):
    raw = b"".join(b"\x00" + bytes([200, 40, 30]) * w for _ in range(h))
    c = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return b"\x89PNG\r\n\x1a\n" + c(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + c(b"IDAT", zlib.compress(raw)) + c(b"IEND", b"")

now = int(time.time() * 1000)
OLD = [  # the old Memory's records, as v6.7 saved them
    {"id": "old1", "ts": now - 40 * 86400000, "kind": "instant", "title": "Summarise the Orascom contract", "text": "Contract: 100 t crane, 5 days", "output": "Orascom: 100 t crane for 5 days at 13,000 EGP a day.", "lang": None, "tags": ["instant"], "meta": None, "pinned": False},
    {"id": "old2", "ts": now - 3 * 86400000, "kind": "note", "title": "Karim service note", "text": "Liebherr service done by Karim. Next oil change at 12,500 hours.", "output": "", "lang": None, "tags": ["note"], "meta": None, "pinned": False},
]
SEED = "try { localStorage.setItem('attune:memory:v1', %s); } catch (e) {}" % json.dumps(json.dumps(OLD))
FILED = lambda title, tags: json.dumps({"title": title, "summary": "About " + title.lower() + ".", "tags": tags, "kind": "note"})

def cards(page):
    return page.locator("[data-testid=mind-card]")
def kinds(page):
    return [c.get_attribute("data-kind") for c in cards(page).all()]

with sync_playwright() as p:
    br = p.chromium.launch()
    errors = []; ctx, page = new_page(br, env, errors, extra_init=SEED)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(250)
    # the model answers from a queue of fixed readings (the filer takes one per item; the promise
    # finder reads the same JSON and finds no promise in it)
    page.evaluate("(a) => { const M = window.__mock; M.bodies = []; M.fakeQueue = a; }",
                  [FILED("Karim's Liebherr service", ["liebherr", "service", "karim"])] * 40)
    nav = page.locator("nav").inner_text()
    check("Mind" in nav and "Memory" not in nav, "the bottom bar says Mind (Memory is replaced)")
    page.locator("nav button:has-text('Mind')").click()
    page.wait_for_selector("[data-testid=mind-page]", timeout=5000)

    # ---- 1. the old records are all here ----
    t = page.locator("[data-testid=mind-page]").inner_text()
    check(cards(page).count() == 2 and "Karim" in t and "Orascom" in t, "the old Memory items are all on the board")
    check("answer" in kinds(page), "a tool's saved answer shows as an Answer card")

    # ---- 2. keep anything: the kind is read by code ----
    for text in ["https://www.amazon.eg/dp/B0CRANE-toy-liebherr", "iPhone 16 Pro 256GB — 62,000 EGP at B.Tech",
                 "«الصبر مفتاح الفرج» — مثل مصري", "- [ ] call Karim about the hose\n- [ ] pay the Orascom invoice"]:
        page.fill("[data-testid=mind-add]", text); page.click("[data-testid=mind-keep]"); page.wait_for_timeout(150)
    ks = kinds(page)
    check(all(k in ks for k in ("link", "product", "quote", "todo")), "a link, a price, a quote and a to-do list are each filed as what they are (%s)" % ks)
    pt, lt = page.locator("[data-kind=product]").first.inner_text(), page.locator("[data-kind=link]").first.inner_text()
    check("62,000 EGP" in pt, "a product card shows its price (%r)" % pt[:80])
    check("Amazon" in lt, "a link card shows its site (%r)" % lt[:80])

    # ---- 3. the model files items in the background (title, summary, tags) ----
    page.wait_for_function("() => { try { return JSON.parse(localStorage.getItem('attune:memory:v1')).every((r) => r.meta && r.meta.aiAt); } catch (e) { return false; } }", timeout=30000)
    recs = page.evaluate("JSON.parse(localStorage.getItem('attune:memory:v1'))")
    filed = [r for r in recs if r.get("meta") and r["meta"].get("aiAt")]
    check(len(filed) >= 2 and any("liebherr" in (r["meta"].get("aiTags") or []) for r in filed), "items get the model's title, summary and tags on their own")
    bodies = page.evaluate("window.__mock.bodies")
    check(any("private notebook" in json.dumps(b) for b in bodies), "the filing prompt is the Mind's (one short JSON per item)")

    # ---- 4. search in plain words ----
    page.fill("[data-testid=mind-search]", "liebherr"); page.wait_for_timeout(250)
    check(cards(page).count() >= 2, "a word finds the items that say it — and the ones only tagged with it")
    page.fill("[data-testid=mind-search]", "لينكات"); page.wait_for_timeout(250)
    check(kinds(page) == ["link"], "«لينكات» shows only links (%s)" % kinds(page))
    page.fill("[data-testid=mind-search]", "notes last month"); page.wait_for_timeout(250)
    check(cards(page).count() == 0 or all(k == "note" for k in kinds(page)), "“notes last month” filters by kind and date")
    page.fill("[data-testid=mind-search]", ""); page.wait_for_timeout(200)
    page.click("[data-testid=mind-kind-quote]"); page.wait_for_timeout(200)
    check(kinds(page) == ["quote"], "the Quotes chip shows only quotes")
    page.click("text=All"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=mind-spaces]").count() == 1, "Spaces appear from the tags")

    # ---- 5. From your past ----
    check(page.get_by_text("From your past", exact=True).count() == 1, "an older item comes back under “From your past”")

    # ---- 6. open an item: tag, note, pin, remind, similar, forget ----
    page.locator("[data-kind=product]").first.click()
    page.wait_for_selector("[data-testid=mind-detail]", timeout=3000)
    page.fill("[data-testid=mind-tag-in]", "gift idea"); page.press("[data-testid=mind-tag-in]", "Enter"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=mind-detail] >> text=#gift idea").count() == 1, "you can add your own tag")
    page.locator("[data-testid=mind-detail] input[type=datetime-local]").fill(time.strftime("%Y-%m-%dT%H:%M", time.localtime(time.time() + 86400)))
    page.click("[data-testid=mind-remind]"); page.wait_for_timeout(300)
    notes = page.evaluate("window.__mock.notes")
    check(any(n["id"].startswith("m-") for n in notes), "Remind me sets a phone reminder for the item")
    page.keyboard.press("Escape"); page.mouse.click(5, 5); page.wait_for_timeout(300)
    page.fill("[data-testid=mind-search]", "gift"); page.wait_for_timeout(250)
    check(kinds(page) == ["product"], "your own tag finds it")
    page.fill("[data-testid=mind-search]", ""); page.wait_for_timeout(200)

    # ---- 7. Ask your Mind: the answer, and the sources by code ----
    page.evaluate("(a) => { const M = window.__mock; M.fakeQueue = a; }", ["The next oil change is at 12,500 hours."])
    page.fill("[data-testid=mind-search]", "when is the next oil change?"); page.wait_for_timeout(200)
    page.click("[data-testid=mind-ask]")
    page.wait_for_selector("[data-testid=mind-answer]", timeout=10000)
    a = page.locator("[data-testid=mind-answer]").inner_text()
    check("12,500" in a and "from these items" in a.lower() and "Liebherr" in a, "Ask your Mind answers and shows which items it came from (%r)" % a[:160])
    page.fill("[data-testid=mind-search]", ""); page.wait_for_timeout(200)

    # ---- 8. a photo keeps a thumbnail ----
    n0 = cards(page).count()
    page.evaluate("(a) => { const M = window.__mock; M.fakeQueue = a; }", [json.dumps({"title": "Red crane on site", "summary": "A red mobile crane.", "tags": ["cranes"], "text": ""})])
    page.set_input_files("[data-testid=mind-photo]", files=[{"name": "crane.png", "mimeType": "image/png", "buffer": png()}])
    page.wait_for_function("(n) => document.querySelectorAll('[data-testid=mind-card]').length > n", arg=n0, timeout=10000)
    page.wait_for_timeout(500)
    check(page.locator("[data-kind=photo] img").count() == 1, "a photo is kept with its picture on the card")

    # ---- 9. forget ----
    page.locator("[data-kind=quote]").first.click(); page.wait_for_selector("[data-testid=mind-detail]")
    page.click("[data-testid=mind-forget]"); page.wait_for_timeout(300)
    check(page.locator("[data-kind=quote]").count() == 0, "Forget removes it")

    # ---- 10. the other two tabs ----
    page.click("[data-testid=mind-tab-promises]"); page.wait_for_timeout(200)
    check(page.locator("text=Things you said you'd do").count() == 1, "Promises is a tab")
    page.click("[data-testid=mind-tab-words]"); page.wait_for_timeout(200)
    check(page.locator("text=Your words").count() >= 1, "Your words is a tab")
    check(not real_errors(errors), "no errors (%s)" % real_errors(errors)[:2])
    ctx.close()

    # ---- 11. Arabic ----
    errors = []; ctx, page = new_page(br, env, errors, extra_init=SEED + "try { localStorage.setItem('attune:ui:lang', 'ar'); } catch (e) {}")
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("nav button:has-text('عقلي')").click()
    page.wait_for_selector("[data-testid=mind-page]", timeout=5000)
    t = page.locator("[data-testid=mind-page]").inner_text()
    check("عقلي" in t and "احفظ" in t, "Mind is in Arabic")
    check(not real_errors(errors), "no errors in Arabic (%s)" % real_errors(errors)[:2])
    ctx.close()
    br.close()
env.close()
finish()
