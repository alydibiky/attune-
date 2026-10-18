"""v6.38 (batch 4) — Studio eraser: "Remove people or things from a photo" → the 28 MB eraser downloads once → paint
over the thing → Remove → the phone (Eraser.kt, MI-GAN) gets the photo and a PNG mask; the result joins the gallery.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v740erase.py
"""
import os, re, base64, struct, zlib
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish, HERE

STUDIO = re.search(r'MOCK = r"""(.*?)"""', open(os.path.join(HERE, "e2e_v59.py"), encoding="utf-8").read(), re.S).group(1)
EXTRA = r"""
(() => { const S = window.__mock; S.img.packs = [{ id: "turbo-xl", label: "Studio Turbo+", kind: "draw", files: {} }]; S.erase = [];
  const R = (id, o) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify(o)), 30);
  const add = () => { const N = window.AttuneNative; if (!N || !N.imageInfo) return setTimeout(add, 0);
    N.eraseImage = (id, arg) => { const a = JSON.parse(arg); S.erase.push(a); R(id, { ok: true, file: "erase-1.png", url: "https://appassets.androidplatform.net/studio/erase-1.png", width: 64, height: 48, ms: 900, backend: "cpu · eraser" }); };
    N.eraserRelease = () => { S.released = (S.released || 0) + 1; }; };
  add(); })();
"""
def png(w, h):
    raw = b"".join(b"\x00" + b"\x40\x90\x30" * w for _ in range(h))
    c = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return b"\x89PNG\r\n\x1a\n" + c(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + c(b"IDAT", zlib.compress(raw)) + c(b"IEND", b"")
env = Env(); errors = []
with sync_playwright() as pw:
    br = pw.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=STUDIO + "\n" + EXTRA)
    ctx.route("https://appassets.androidplatform.net/studio/**", lambda r: r.fulfill(status=200, content_type="image/png", body=png(64, 48)))
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('Studio')").first.click()
    page.wait_for_selector("[data-testid=studio-erase-photo]", timeout=6000)
    page.set_input_files("[data-testid=studio-erase-file]", files=[{"name": "beach.png", "mimeType": "image/png", "buffer": png(640, 480)}])
    page.wait_for_selector("[data-testid=erase-sheet]", timeout=8000)
    inst = [c for c in page.evaluate("window.__mock.imgCalls") if c[0] == "install"]
    check(len(inst) == 1 and inst[0][1]["id"] == "eraser" and inst[0][1]["files"][0]["name"] == "migan_pipeline_v2.onnx", "the eraser model (28 MB) is downloaded once, first")
    page.click("[data-testid=erase-go]")
    check("Paint over" in page.locator("[data-testid=erase-err]").inner_text() and page.evaluate("window.__mock.erase.length") == 0, "Remove with nothing painted: says what to do, sends nothing")
    page.wait_for_timeout(300)
    b = page.locator("[data-testid=erase-canvas]").bounding_box()
    page.mouse.move(b["x"] + b["width"] * 0.4, b["y"] + b["height"] * 0.5); page.mouse.down()
    page.mouse.move(b["x"] + b["width"] * 0.6, b["y"] + b["height"] * 0.5, steps=6); page.mouse.up()
    page.click("[data-testid=erase-go]")
    page.wait_for_function("window.__mock.erase.length === 1", timeout=5000)
    a = page.evaluate("window.__mock.erase[0]")
    check(a["mask"].startswith("data:image/png") and a["photo"].startswith("data:image/png") and not a.get("file"), "the phone gets the photo and a PNG mask")
    m = page.evaluate("""(u) => new Promise((ok) => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
      const px = (x, y) => g.getImageData(x, y, 1, 1).data[3]; ok([im.width, im.height, px(im.width/2|0, im.height/2|0), px(5, 5)]); }; im.src = u; })""", a["mask"])
    check(m[0] == 640 and m[1] == 480 and m[2] > 200 and m[3] == 0, "the mask has the photo's size, painted in the middle, empty elsewhere: %s" % m)
    page.wait_for_selector("[data-testid=erase-sheet]", state="detached", timeout=5000)
    g = page.evaluate("JSON.parse(localStorage.getItem('attune:studio:v1'))")
    check(g[0]["file"] == "erase-1.png" and g[0].get("erased") is True, "the erased photo is the new picture in the gallery")
    check(page.locator("[data-testid=studio-erase]").count() == 1, "…and can be erased again (Erase on the picture)")
    page.click("[data-testid=studio-erase]"); page.wait_for_selector("[data-testid=erase-sheet]", timeout=5000)
    check(len([c for c in page.evaluate("window.__mock.imgCalls") if c[0] == "install"]) == 1, "no second download")
    page.click("[data-testid=erase-close]")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
