"""v6.42 F1 (Ali picked B): a bank card in the photo, or my plate's width, is the ruler for photo portions.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v742ruler.py
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
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'fit'}}))")
    page.wait_for_selector("[data-testid=fit-today]", timeout=6000)
    page.locator("[data-testid=fit-add-lunch]").click()
    page.set_input_files("[data-testid=fit-photo-input]", {"name": "plate.png", "mimeType": "image/png", "buffer": PNG}); page.wait_for_timeout(400)
    check(page.locator("[data-testid=fit-ruler]").count() == 1 and "bank card" in page.locator("[data-testid=fit-ruler]").inner_text(), "with a photo: the tip — put a bank card next to the plate, or my plate's width")
    page.fill("[data-testid=fit-plate-cm]", "30")
    check(page.evaluate("localStorage.getItem('attune:fit:plate:cm')") == "30", "my plate width is kept (30 cm)")
    # 1) no card: measured with my 30 cm plate
    queue(page, [json.dumps({"kind": "meal", "plate": "dinner plate", "items": [{"food": "white rice", "plate_share": 0.5, "height": "normal", "grams": 200, "confidence": 0.9}]}), json.dumps({"items": []})])
    page.locator("[data-testid=fit-read]").click()
    page.wait_for_selector("[data-testid=fit-draft]", timeout=15000); page.wait_for_timeout(600)
    check(page.locator("[data-testid=fit-ruler-plate]").count() == 1 and "30 cm" in page.locator("[data-testid=fit-ruler-plate]").inner_text(), "the result says it was measured with my 30 cm plate")
    g30 = int(page.locator("[data-testid=fit-draft-grams]").first.input_value())
    # 2) a card in the photo: the card measures the plate (≈ 22 cm here) → less rice than the 30 cm plate
    import math
    area = math.pi * 11 ** 2; box = 0.36 * (math.pi / 4) * (8.56 * 5.398) / area; w = math.sqrt(box * 1.585); h = box / w
    page.evaluate("() => { const b = [...document.querySelectorAll('button')].find(x => /^(Cancel|Discard|Back)$/i.test(x.textContent.trim())); if (b) b.click(); }")
    page.wait_for_timeout(300)
    if page.locator("[data-testid=fit-photo-input]").count() == 0:
        page.locator("[data-testid=fit-add-lunch]").click()
    page.set_input_files("[data-testid=fit-photo-input]", {"name": "plate2.png", "mimeType": "image/png", "buffer": PNG}); page.wait_for_timeout(400)
    queue(page, [json.dumps({"kind": "meal", "plate": "dinner plate", "card": [0.02, 0.02, w, h], "plate_box": [0.2, 0.2, 0.6, 0.6],
                 "items": [{"food": "white rice", "plate_share": 0.5, "height": "normal", "grams": 200, "confidence": 0.9}]}), json.dumps({"items": []})])
    if page.locator("[data-testid=fit-read]").count(): page.locator("[data-testid=fit-read]").click()
    page.wait_for_selector("[data-testid=fit-ruler-card]", timeout=15000); page.wait_for_timeout(400)
    g22 = int(page.locator("[data-testid=fit-draft-grams]").first.input_value())
    check(g22 < g30, "measured against the card (a 22 cm plate): %d g, less than with my 30 cm plate (%d g)" % (g22, g30))
    check(page.locator("[data-testid=fit-draft-item]").count() == 1, "the card itself is not a food")
    ctx.close()
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
