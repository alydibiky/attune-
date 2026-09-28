"""v6.3 — Fit & Food, the real paths: a meal said out loud (mock microphone) is read by code at once;
"remove the cola" said to the edit box changes it; a photo where the model is unsure gets a zoomed second
look that corrects the food; a portion the geometry disagrees with is flagged; the watch (mock Health
Connect) connects and its steps and calories appear — burned counted once.

  python3 tests/e2e_v63.py
"""
import os, json, base64
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish

env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
def shot(page, name):
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, name + ".png"))
# a real little PNG (64×64) so the crop for the zoomed look has pixels to cut
import zlib, struct
def png(w=64, h=64):
    raw = b"".join(b"\x00" + bytes([(x * 4) % 256, (y * 4) % 256, 120] * 1)[:3] * 1 for y in range(h) for x in range(1)) if False else b"".join(b"\x00" + b"".join(bytes([(x * 4) % 256, (y * 4) % 256, 120]) for x in range(w)) for y in range(h))
    c = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return b"\x89PNG\r\n\x1a\n" + c(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + c(b"IDAT", zlib.compress(raw)) + c(b"IEND", b"")
PNG = png()
STATE = {"profile": {"sex": "m", "age": 21, "cm": 178, "kg": 92, "activity": "light", "goal": "lose", "rate": 0.5, "goalKg": 80, "diet": "balanced"}, "days": {}, "weights": [], "fast": None, "myRecipes": [], "favs": [], "watchSkip": False}
INIT = "try { if (!localStorage.getItem('attune:fit:v1')) localStorage.setItem('attune:fit:v1', %s); } catch (e) {}" % json.dumps(json.dumps(STATE)) + r"""
(() => { const S = window.__mock = window.__mock || {}; S.said = []; S.hc = { available: "ready", granted: 0, of: 6 };
  const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0);
    N.listen = (id, lang) => { const t = S.said.shift() || ""; setTimeout(() => { window.__attuneNative.progress(id, 0, "partial", t.slice(0, 6)); window.__attuneNative.resolve(id, JSON.stringify({ text: t })); }, 30); };
    N.stopListening = () => {};
    N.healthStatus = () => JSON.stringify(S.hc);
    N.healthConnect = () => { S.hc = { ...S.hc, granted: 6 }; setTimeout(() => window.dispatchEvent(new CustomEvent("attune-health-permission", { detail: { granted: 6 } })), 30); };
    N.healthDay = (id, arg) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ available: "ready", steps: 8421, activeKcal: 356, totalKcal: 2480, distanceM: 6120, hrAvg: 78, hrMax: 141,
      workouts: [{ title: "Morning walk", type: 79, minutes: 42 }], sources: ["com.sec.android.app.shealth"] })), 20);
  }; go(); })();"""

def queue(page, answers):
    page.evaluate("(a) => { const M = window.__mock; M.bodies = []; M.fakeQueue = a; }", answers)
def sent(page): return page.evaluate("window.__mock.bodies.filter(b => b.max_tokens > 2)")
def items(page): return page.locator("[data-testid=fit-draft-item]")

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(250)
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('Fit & Food')").first.click()
    page.wait_for_selector("[data-testid=fit-today]", timeout=6000)

    # ---- say it: read by code, no model call ----
    queue(page, [])
    page.evaluate("() => { window.__mock.said = ['نص فرخة مشوية ورز وكوباية بيبسي']; }")
    page.locator("[data-testid=fit-add-lunch]").click()
    page.locator("[data-testid=fit-mic]").click(); page.wait_for_timeout(400)
    check("فرخة" in page.locator("[data-testid=fit-log-text]").input_value(), "the spoken meal lands in the box")
    page.locator("[data-testid=fit-read]").click()
    page.wait_for_selector("[data-testid=fit-draft]", timeout=5000)
    d = [(items(page).nth(i).inner_text(), page.locator("[data-testid=fit-draft-grams]").nth(i).input_value()) for i in range(items(page).count())]
    check(len(d) == 3 and d[0][1] == "400" and len(sent(page)) == 0, "«نص فرخة مشوية ورز وكوباية بيبسي» → half chicken 400 g, rice, cola — by code, no model (%s)" % [x[1] for x in d])

    # ---- change it by talking ----
    page.evaluate("() => { window.__mock.said = ['شيل البيبسي']; }")
    page.locator("[data-testid=fit-cmd-mic]").click(); page.wait_for_timeout(500)
    rows = " | ".join(items(page).nth(i).inner_text() for i in range(items(page).count()))
    check(items(page).count() == 2 and "Cola" not in rows and "Removed Cola" in page.locator("[data-testid=fit-cmd-note]").inner_text(), "“remove the Pepsi” said to the edit box removes it, and says so")
    page.fill("[data-testid=fit-cmd]", "rice 120 g"); page.locator("[data-testid=fit-cmd-go]").click()
    check(page.locator("[data-testid=fit-draft-grams]").nth(1).input_value() == "120" and "120 g" in page.locator("[data-testid=fit-cmd-note]").inner_text(), "“rice 120 g” sets it and says so")
    page.fill("[data-testid=fit-cmd]", "what's the weather"); page.locator("[data-testid=fit-cmd-go]").click()
    check("didn't get" in page.locator("[data-testid=fit-cmd-note]").inner_text() and items(page).count() == 2, "a sentence that isn't a change changes nothing and says so")
    shot(page, "fit-talk")
    page.locator("[data-testid=fit-confirm]").click(); page.wait_for_timeout(200)

    # ---- a photo: unsure → zoomed look; a portion that doesn't add up → flagged ----
    queue(page, [json.dumps({"kind": "meal", "plate": "dinner plate", "items": [
                    {"food": "pasta", "alternatives": ["koshari", "rice"], "plate_share": 0.5, "height": "normal", "grams": 60, "confidence": 0.4, "box": [0.1, 0.1, 0.6, 0.6]},
                    {"food": "baladi bread", "count": 1, "container": "none", "grams": 90, "confidence": 0.9}]}),
                 json.dumps({"food": "koshari", "alternatives": ["pasta with red sauce"], "confidence": 0.85}),
                 json.dumps({"items": []})])
    page.locator("[data-testid=fit-add-dinner]").click()
    page.set_input_files("[data-testid=fit-photo-input]", {"name": "plate.png", "mimeType": "image/png", "buffer": PNG}); page.wait_for_timeout(400)
    page.locator("[data-testid=fit-read]").click()
    page.wait_for_selector("text=looked closer", timeout=20000); page.wait_for_timeout(300)
    t0 = items(page).first.inner_text()
    bodies = sent(page)
    check("Koshari" in t0 and "looked closer" in t0, "the unsure “pasta” was looked at closer and is Koshari")
    check(len(bodies) >= 2 and "close-up" in json.dumps(bodies[1]["messages"]), "the zoomed look sent a cropped close-up to the model")
    check("check the portion" in t0, "the model's 60 g against half a plate is flagged to check")
    check(page.locator("[data-testid=fit-draft-grams]").nth(1).input_value() == "90", "1 counted baladi loaf = 90 g")
    shot(page, "fit-zoom")
    page.locator("[data-testid=fit-confirm]").click(); page.wait_for_timeout(200)

    # ---- the watch ----
    w = page.locator("[data-testid=fit-watch]")
    check(w.count() == 1 and "Connect your watch" in w.inner_text(), "Today offers to connect the watch")
    page.locator("[data-testid=fit-watch-connect]").click()
    page.wait_for_selector("[data-testid=fit-steps]", timeout=6000)
    check(page.locator("[data-testid=fit-steps]").inner_text() == "8,421" and page.locator("[data-testid=fit-watch-kcal]").inner_text() == "356", "after connecting: 8,421 steps and 356 active kcal from the watch")
    check("Burned 356" in page.locator("[data-testid=fit-today]").inner_text().replace("\n", " ") or "356" in page.locator("[data-testid=fit-today]").inner_text(), "burned calories on Today come from the watch")
    shot(page, "fit-watch")
    page.locator("[data-testid=fit-tab-move]").click()
    check("Morning walk" in page.locator("[data-testid=fit-watch]").inner_text() and "141" in page.locator("[data-testid=fit-watch]").inner_text(), "Move shows the watch's workout and heart rate")
    # a manual workout smaller than the watch's calories does not add on top
    page.locator("[data-testid=fit-act]").fill("walking"); page.locator("[data-testid=fit-act-min]").fill("20")
    if page.locator("[data-testid=fit-act-log]").count(): page.locator("[data-testid=fit-act-log]").click()
    page.locator("[data-testid=fit-tab-today]").click()
    kept = page.evaluate("(() => { const s = JSON.parse(localStorage.getItem('attune:fit:v1')); const d = Object.values(s.days).find(x => x.watch); return [d.watch.activeKcal, (d.workouts || []).reduce((a, w) => a + w.kcal, 0)]; })()")
    check(kept[0] == 356 and kept[1] > 0 and kept[1] < 356, "a logged 20-min walk (%d kcal) is inside the watch's 356 — not added twice" % kept[1])

    check(not real_errors(errors), "no errors (%s)" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
