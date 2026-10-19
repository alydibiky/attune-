"""v6.41 C2 Studio: change only the painted part — paint, say "a sunset sky", and the picture model's edit is kept only where it
was painted (softly blended); the rest of the photo stays exactly as it was. Empty / "remove …" is still the eraser.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v741editarea.py
"""
import os, re, base64, struct, zlib
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish, HERE
STUDIO = re.search(r'MOCK = r"""(.*?)"""', open(os.path.join(HERE, "e2e_v59.py"), encoding="utf-8").read(), re.S).group(1)
EXTRA = r"""
(() => { const S = window.__mock; S.img.packs = [{ id: "turbo-xl", label: "Studio Turbo+", kind: "draw", files: {} }, { id: "klein-4b", label: "Studio Pro", kind: "draw", files: {} }, { id: "eraser", label: "Eraser", kind: "erase", files: {} }]; S.erase = []; S.saved = [];
  const R = (id, o) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify(o)), 30);
  const add = () => { const N = window.AttuneNative; if (!N || !N.imageInfo) return setTimeout(add, 0);
    N.eraseImage = (id, arg) => { S.erase.push(JSON.parse(arg)); R(id, { ok: true, file: "erase-1.png", url: "", width: 64, height: 48 }); };
    N.imagine = (id, arg) => { const a = JSON.parse(arg); S.imgCalls.push(["imagine", a]); const c = document.createElement("canvas"); c.width = a.width; c.height = a.height; const g = c.getContext("2d"); g.fillStyle = "#ff0000"; g.fillRect(0, 0, c.width, c.height);
      R(id, { ok: true, file: "img-e.png", url: c.toDataURL("image/png"), width: a.width, height: a.height, ms: 1000, backend: "GPU" }); };
    N.savePicture = (id, arg) => { const a = JSON.parse(arg); S.saved.push(a.b64); R(id, { ok: true, file: "img-area.png", url: a.b64, width: 640, height: 480 }); };
    N.deleteImage = () => true; N.eraserRelease = () => {}; };
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
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'studio'}}))")
    page.wait_for_selector("[data-testid=studio-erase-photo]", timeout=6000)
    page.set_input_files("[data-testid=studio-erase-file]", files=[{"name": "beach.png", "mimeType": "image/png", "buffer": png(640, 480)}])
    page.wait_for_selector("[data-testid=erase-what]", timeout=8000)
    check(page.locator("[data-testid=erase-go]").inner_text().strip() == "Remove", "empty → Remove (the eraser)")
    page.fill("[data-testid=erase-what]", "a sunset sky")
    check(page.locator("[data-testid=erase-go]").inner_text().strip() == "Change it", "a wish → Change it")
    page.wait_for_timeout(300)
    b = page.locator("[data-testid=erase-canvas]").bounding_box()
    page.mouse.move(b["x"] + b["width"] * 0.1, b["y"] + b["height"] * 0.15); page.mouse.down()
    page.mouse.move(b["x"] + b["width"] * 0.9, b["y"] + b["height"] * 0.15, steps=8); page.mouse.up()
    page.click("[data-testid=erase-go]")
    page.wait_for_function("window.__mock.saved.length === 1", timeout=8000)
    im = [c for c in page.evaluate("window.__mock.imgCalls") if c[0] == "imagine"]
    check(len(im) == 1 and im[0][1]["prompt"] == "a sunset sky" and im[0][1]["refImage"].startswith("data:image/png"), "the picture model gets the photo and the wish")
    check(page.evaluate("window.__mock.erase.length") == 0, "not the eraser")
    px = page.evaluate("""(u) => new Promise((ok) => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
      const p = (x, y) => Array.from(g.getImageData(x, y, 1, 1).data.slice(0, 3)); ok([p(im.width / 2 | 0, im.height * 0.15 | 0), p(im.width / 2 | 0, im.height * 0.8 | 0)]); }; im.src = u; })""", page.evaluate("window.__mock.saved[0]"))
    check(px[0][0] > 200 and px[0][1] < 60, "inside the painted band: the edit (red): %s" % px[0])
    check(abs(px[1][0] - 0x40) < 6 and abs(px[1][1] - 0x90) < 6, "outside it: the photo exactly as it was: %s" % px[1])
    page.wait_for_selector("[data-testid=erase-sheet]", state="detached", timeout=5000)
    g = page.evaluate("JSON.parse(localStorage.getItem('attune:studio:v1'))")
    check(g[0]["file"] == "img-area.png" and g[0].get("area") is True, "the result joins the gallery")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
