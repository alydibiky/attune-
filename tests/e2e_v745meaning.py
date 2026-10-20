"""v6.45 Recall phase 2 — search by meaning: Recall → "Search by meaning" → Download (progress) → On; the things get their
numbers; «ركنت العربية» is found by "where did I park" (words alone find nothing) and marked "by meaning"; Remove.
A stand-in meaning model: each text → a vector of the concepts it mentions (both languages), like the real one.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v745meaning.py
"""
import json, time
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
now = int(time.time() * 1000); D = 86400000
NOTES = [{"id": "n1", "pkg": "com.whatsapp", "app": "WhatsApp", "title": "Me", "text": "ركنت العربية في جراج سيتي ستارز عمود B7", "ts": now - D},
         {"id": "n2", "pkg": "com.google.android.gm", "app": "Gmail", "title": "North Cairo Electricity", "text": "Your October bill is 412 EGP", "ts": now - 2 * D}]
INIT = ("try{localStorage.setItem('attune:start','home')}catch(e){}"
        "(function w(){ var N = window.AttuneNative; if (!N) return setTimeout(w, 0); window.__on = true; window.__notes = " + json.dumps(NOTES) + ";"
        "N.recallNotesIsOn = function () { return true; }; N.recallNotesOn = function () {}; N.recallNotes = function () { return JSON.stringify(window.__notes); };"
        "N.payAccess = function () { return true; }; N.payQueue = function () { return '[]'; };"
        "window.__emb = { installed: false, calls: 0 };"
        "var C = [/park|ركن|جراج|garage|parking/i, /electric|كهربا|bill|فاتورة/i, /flight|طيار|رحلة/i];"
        "function vec(t) { var v = C.map(function (r) { return r.test(t) ? 1 : 0; }); v.push(0.3); return v; }"
        "N.embedStatus = function () { return JSON.stringify({ installed: window.__emb.installed, bytes: 437778496 }); };"
        "N.embedRemove = function () { window.__emb.installed = false; return true; };"
        "N.embedInstall = function (id) { var p = 0; (function tick() { p += 25; window.__attuneNative.progress(id, Math.min(p, 99), 'download', p + ' %');"
        "  if (p < 100) return setTimeout(tick, 60); window.__emb.installed = true; window.__attuneNative.resolve(id, N.embedStatus()); })(); };"
        "N.embed = function (id, arg) { window.__emb.calls++; var t = JSON.parse(arg).texts; setTimeout(function () { window.__attuneNative.resolve(id, JSON.stringify({ vecs: t.map(vec) })); }, 20); };"
        "})();")
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'recall'}}))")
    page.wait_for_selector("[data-testid=recall-page]", timeout=5000)
    page.fill("[data-testid=recall-q]", "where did I park"); page.wait_for_timeout(700)
    check(page.locator("[data-testid=recall-hit]").count() == 0, "words alone: “where did I park” finds nothing in the Arabic note")
    check("438 MB" in page.inner_text("[data-testid=recall-meaning]"), "Search by meaning offers its 438 MB download")
    page.click("[data-testid=recall-meaning-get]"); page.wait_for_selector("[data-testid=recall-meaning-on]", timeout=5000)
    check(page.locator("[data-testid=recall-meaning-remove]").count() == 1, "downloaded → On, with Remove")
    page.wait_for_function("window.__emb.calls >= 2", timeout=5000); page.wait_for_timeout(900)
    hits = page.locator("[data-testid=recall-hit]")
    check(hits.count() >= 1 and "ركنت" in hits.first.inner_text(), "by meaning: “where did I park” → «ركنت العربية…»")
    check(page.locator("[data-testid=recall-by-meaning]").count() >= 1, "the hit says “by meaning”")
    page.fill("[data-testid=recall-q]", "فاتورة الكهربا"); page.wait_for_timeout(900)
    check("Electricity" in page.locator("[data-testid=recall-hit]").first.inner_text(), "«فاتورة الكهربا» → the electricity bill email")
    n = page.evaluate("window.__emb.calls")
    page.fill("[data-testid=recall-q]", ""); page.wait_for_timeout(300)
    check(page.evaluate("window.__emb.calls") == n, "the things got their numbers once (not again for each search)")
    page.click("[data-testid=recall-meaning-remove]"); page.wait_for_timeout(300)
    check(page.locator("[data-testid=recall-meaning-get]").count() == 1, "Remove → the download is offered again")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
