"""v5.32 — Ali's phone test: web answers with digits missing ("0-inch", "range of 4 km"),
repeated bullets, "The passages do not provide…"; a no-letter-e pitch that ended "Stopped.";
Instant that said "go to the nearest fuel station"; Qwen / Gemma names in Engine; a cluttered
More menu; Pro unlocked for testing.

  python3 tests/e2e_v532.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish

env = Env(); errors = []

V10 = "## Winner Sky V10\\nThe V10 features 10-inch pneumatic dirt tires, reaches speeds of up to 45 km/h and has a range of 40 km on a single charge. It has a 1500W motor."
PRICE = "## Price\\nThe Winner Sky V10 sells for EGP 45,000 in Egypt."
SEARCH = """(() => { const N = window.AttuneNative, S = window.__mock;
  N.search = (id, arg) => { const a = JSON.parse(arg); (S.searchLog = S.searchLog || []).push(a.q || a.query || '');
    const q = String(a.q || a.query || '');
    const hits = /price/i.test(q) && !/specifications|review/i.test(q) && S.searchLog.length > 3
      ? [{ title: "Winner Sky V10 price in Egypt", url: "https://shop.example.com/v10-price", text: "%s" }]
      : [{ title: "Winner Sky V10 review", url: "https://example.com/v10", text: "%s" }];
    setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ via: "duckduckgo", why: "", hits })), 30); };
})();""" % (PRICE, V10)

GARBLED = "**Winner Sky V10 is a strong scooter [1].**\n* It features 0-inch pneumatic dirt tires [1].\n* It features 0-inch pneumatic dirt tires [1].\n* It has a range of 4 km on a single charge [1].\n* **Winner Sky (V10)**** reaches 45 km/h [1].\n* The passages do not provide specific prices in USD [1]."
WITH_PRICE = "**Winner Sky V10 costs EGP 45,000 [2].**\n* It features 0-inch pneumatic dirt tires [1].\n* It has a range of 4 km on a single charge [1].\n* It reaches 45 km/h [1].\n* The sources don't mention the warranty."

def install(page):
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)

def send(page, text):
    page.locator("textarea[placeholder='Message Attune']").fill(text)
    page.locator("button[title='Send']").first.click()

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    install(page)

    # ---- 1. web: gaps searched again, figures repaired by code, junk lines gone ----
    page.evaluate(SEARCH)
    page.locator("button:has-text('Web')").first.click()
    page.evaluate("(q) => { const M = window.__mock; M.fakeQueue = q; M.bodies = []; M.searchLog = []; }", [GARBLED, WITH_PRICE])
    send(page, "Winner Sky V10 detailed specs and price")
    page.wait_for_selector("button[title='Regenerate']", timeout=40000)
    sl = page.evaluate("window.__mock.searchLog")
    check(any(q.endswith(" price") for q in sl[3:]), "what the answer lacked (the price) is searched for once more (%s)" % sl)
    ans = page.locator(".att-md").last.inner_text()
    check("EGP 45,000" in ans, "the new page's price makes it into the answer")
    check("10-inch" in ans and "0-inch" not in ans.replace("10-inch", ""), "a dropped digit is put back from the source (0-inch → 10-inch)")
    check("40 km" in ans and " 4 km" not in ans, "range of 4 km → 40 km, as the source says")
    check("passages" not in ans.lower() and "don't mention" not in ans, "no 'the passages do not provide…' lines")
    bodies = page.evaluate("window.__mock.bodies.filter(x => x.max_tokens > 2).map(x => JSON.stringify(x.messages))")
    check(len(bodies) == 2 and "EGP 45,000" in bodies[-1], "the answer was written again with the new page (2 model passes)")

    # ---- 2. the answer ends "Stopped." although nobody pressed Stop → answered again ----
    page.locator("button:has-text('Web')").first.click()
    page.evaluate("() => { const M = window.__mock; M.fakeQueue = ['__STOPPED__', 'Here is your answer, written again.']; M.bodies = []; }")
    send(page, "Tell me something nice about Cairo")
    page.wait_for_function("() => document.querySelectorAll(\"button[title='Regenerate']\").length >= 2", timeout=30000)
    last = page.locator(".att-md").last.inner_text()
    check("written again" in last, "an engine-side stop is answered again instead of ending in 'Stopped.'")

    # ---- 3. writing rules checked by the phone ----
    BAD = "Our drones deliver parcels to your home quickly. They never get stuck in city traffic jams. Order now and see the future arrive today. Fast, safe and green delivery for everyone here."
    GOOD = "Our fast flying bots bring your stuff today. No traffic, no waiting, just quick aircraft drops. Our smart units find your door without fail. Sign up now and join our growing club."
    page.evaluate("(q) => { const M = window.__mock; M.fakeQueue = q; M.bodies = []; }", [BAD, GOOD])
    send(page, "Write a four-sentence product pitch for an autonomous drone delivery network. Rules:\nDo not use the letter 'e' anywhere in the response.\nEvery sentence must contain exactly eight words.\nDo not include numbers or symbols.")
    page.wait_for_function("() => document.querySelectorAll(\"button[title='Regenerate']\").length >= 3", timeout=30000)
    last = page.locator(".att-md").last.inner_text()
    check("flying bots" in last, "a pitch that breaks the rules is sent back with exactly what broke, and the fixed one is kept")
    fix = page.evaluate("JSON.stringify(window.__mock.bodies.filter(x => x.max_tokens > 2).pop().messages)")
    check("A program checked it" in fix and 'letter \\"e\\"' in fix, "the model is told which words have the letter e")
    check("all followed" in page.locator("[data-testid=rules-checked]").last.inner_text(), "the answer says the rules were checked by the phone")

    # ---- 4. More: four named groups; Instant explains itself and hands places to the map ----
    page.locator("nav button").last.click(); page.wait_for_timeout(300)
    check(page.locator("[data-testid=more-group]").count() == 4, "More shows its tools in four named groups")
    page.locator(".rounded-t-2xl button:has-text('Instant')").first.click(); page.wait_for_timeout(300)
    check(page.locator("[data-testid=instant-about]").count() == 1, "Instant says what it is for")
    page.evaluate("() => { window.__mock.fakeQueue = ['Head to the nearest fuel station.']; }")
    page.locator("textarea").first.fill("I want to go to fuel up and I am at emerald park compound now what shall i do")
    page.get_by_role("button", name="Go").first.click()
    page.wait_for_selector("[data-testid=instant-map]", timeout=20000)
    href = page.locator("[data-testid=instant-map]").get_attribute("href")
    check("google.com/maps/search" in href and "gas%20station%20near%20emerald%20park%20compound" in href, "a place request gets one tap to Google Maps, near where he is")

    # ---- 5. Engine: installed models never show vendor names ----
    page.evaluate("""() => { const M = window.__mock; M.models = M.models.map((m) => ({ ...m, label: "Gemma 4 E4B-it", source: "litert-community/gemma-4-E4B-it-litert-lm" }));
      M.models.push({ id: "qwen-small", label: "Qwen3.5 0.8B · UD-Q4_K_XL", quant: "Q4_K_M", source: "unsloth/Qwen3.5-0.8B-GGUF", sizeBytes: 530000000, active: false }); }""")
    page.evaluate("() => window.dispatchEvent(new CustomEvent('attune-engine', { detail: JSON.parse(window.AttuneNative.engine()) }))"); page.wait_for_timeout(300)
    page.locator("nav button").last.click(); page.wait_for_timeout(300)
    page.locator("[data-testid=more-settings] button").first.click(); page.wait_for_timeout(500)
    eng = page.locator("text=Installed models").locator("xpath=..").inner_text()
    check("Qwen" not in eng and "Gemma" not in eng and "Spark" in eng, "installed models show Attune names only (%s)" % eng.replace("\n", " | ")[:160])

    check(not real_errors(errors), "no errors (%s)" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
