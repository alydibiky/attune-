"""v6.27 — a map question asked in Chat («فين أقرب صيدلية؟») becomes a Maps card; "Show on the map" opens Maps with the
search already run. Questions that only look like it («where is the bug in my code») stay in Chat.

  python3 tests/e2e_v727chatmap.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish

env = Env(); errors = []
MOCK = r"""
(() => { const S = window.__mapmock = { calls: [] };
  const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0);
    N.mapPacks = () => JSON.stringify({ packs: [{ code: "eg", name: "Egypt", date: "2026-10-13", bytes: 1, installed: true, files: [] }], assets: true });
    N.mapRead = () => "";
    N.mapSearch = (id, a) => { const o = JSON.parse(a); S.calls.push(o);
      setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ places: o.kinds && o.kinds.includes("amenity/pharmacy") ? [{ name: "صيدلية العزبي", kind: "amenity/pharmacy", lat: 30.05, lon: 31.25, dist: 0.3, rank: 42 }] : [] })), 30); };
  }; go(); })();"""

with sync_playwright() as pw:
    br = pw.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
    ctx, page = new_page(br, env, errors, extra_init=MOCK)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    comp = page.locator("textarea[placeholder='Message Attune']")
    comp.fill("فين أقرب صيدلية؟"); page.locator("button[title='Send']").click()
    card = page.locator("[data-testid=card-emerald]").last
    card.wait_for(timeout=5000)
    check("Maps finds it" in card.inner_text() and "أقرب صيدلية" in card.inner_text(), "a map question in Chat becomes a Maps card: " + card.inner_text().replace("\n", " · ")[:120])
    card.get_by_role("button", name="Show on the map").click()
    page.wait_for_selector("[data-testid=map-page]", timeout=8000)
    page.wait_for_selector("[data-testid=map-hit]", timeout=10000)
    check(page.locator("[data-testid=map-search]").input_value() == "أقرب صيدلية", "Maps opens with the search filled in")
    asked = [c for c in page.evaluate("window.__mapmock.calls") if c.get("kinds")]
    check(any("amenity/pharmacy" in c["kinds"] for c in asked) and "العزبي" in page.locator("[data-testid=map-hit]").first.inner_text(), "…and already run: pharmacies from the phone's map, offline")
    page.click("[data-testid=map-exit]"); page.wait_for_timeout(300)
    n0 = page.locator("[data-testid=card-emerald]").count()
    comp = page.locator("textarea[placeholder='Message Attune']")
    if comp.count():
        comp.fill("where is the bug in my code?"); page.locator("button[title='Send']").click(); page.wait_for_timeout(500)
        check(page.locator("[data-testid=card-emerald]").count() == n0, "«where is the bug in my code?» stays a Chat question")
    # v6.27: a commitment typed in Chat → People & plans, read and ready to save
    page.keyboard.press("Escape"); page.evaluate("window.__attuneBack && window.__attuneBack()"); page.wait_for_timeout(300)   # the question above opened "install a model"
    if not page.locator("textarea[placeholder='Message Attune']").count():
        page.locator("nav button").first.click(); page.wait_for_timeout(300)
    comp = page.locator("textarea[placeholder='Message Attune']")
    comp.fill("Ahmed owes me 12,000, 1,000 a month for a year"); page.locator("button[title='Send']").click()
    card = page.locator("[data-testid=card-emerald]").last
    page.wait_for_function("() => [...document.querySelectorAll('[data-testid=card-emerald]')].some((e) => e.innerText.includes('People & plans'))", timeout=5000)
    check("People & plans" in card.inner_text(), "a commitment in Chat becomes a card: " + card.inner_text().replace("\n", " · ")[:100])
    page.locator("[data-testid=card-emerald]").last.get_by_role("button", name="Save it").click()
    page.wait_for_selector("[data-testid=life-draft]", timeout=8000)
    check("Ahmed owes you" in page.locator("[data-testid=life-draft]").inner_text(), "…People & plans opens with it read, ready to save")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
