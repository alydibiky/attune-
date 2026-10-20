"""v6.38 (batch 4) Studio eraser → v6.43 the photo editor like the Honor Gallery (Ali): open a photo → the 28 MB eraser downloads
once → the phone finds the people and things (findSubjects) → tap one → Erase (Eraser.kt gets the photo and a PNG mask); Passers-by
removes everyone but the main subject; Cut out lifts the subject; Undo steps back. Each step joins the gallery.
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
    N.eraseImage = (id, arg) => { const a = JSON.parse(arg); S.erase.push(a); const n = S.erase.length; R(id, { ok: true, file: "erase-" + n + ".png", url: "https://appassets.androidplatform.net/studio/erase-" + n + ".png", width: 64, height: 48, ms: 900, backend: "cpu · eraser" }); };
    N.eraserRelease = () => { S.released = (S.released || 0) + 1; };
    S.found = [];
    const box = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); return c.toDataURL("image/png"); };
    N.findSubjects = (id, arg) => { S.found.push(JSON.parse(arg)); R(id, { w: 640, h: 480, subjects: [{ x: 170, y: 40, w: 300, h: 400, area: 120000, mask: box(300, 400) }, { x: 20, y: 330, w: 60, h: 120, area: 7200, mask: box(60, 120) }] }); };
    N.savePicture = (id, arg) => { const a = JSON.parse(arg); S.saved = (S.saved || []).concat([a.b64]); R(id, { ok: true, file: "img-cut.png", url: a.b64, width: 300, height: 400 }); }; };
  add(); })();
"""
def png(w, h):
    raw = b"".join(b"\x00" + b"\x40\x90\x30" * w for _ in range(h))
    c = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return b"\x89PNG\r\n\x1a\n" + c(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + c(b"IDAT", zlib.compress(raw)) + c(b"IEND", b"")
env = Env(); errors = []
MASK_PX = """(u) => new Promise((ok) => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
  const px = (fx, fy) => g.getImageData(Math.floor(fx * im.width), Math.floor(fy * im.height), 1, 1).data[3]; ok([im.width, im.height, px(0.5, 0.5), px(0.08, 0.8), px(0.01, 0.01)]); }; im.src = u; })"""
with sync_playwright() as pw:
    br = pw.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=STUDIO + "\n" + EXTRA)
    ctx.route("https://appassets.androidplatform.net/studio/**", lambda r: r.fulfill(status=200, content_type="image/png", body=png(64, 48)))
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'studio'}}))")
    page.wait_for_selector("[data-testid=studio-erase-photo]", timeout=6000)
    page.set_input_files("[data-testid=studio-erase-file]", files=[{"name": "beach.png", "mimeType": "image/png", "buffer": png(640, 480)}])
    page.wait_for_selector("[data-testid=photo-editor]", timeout=8000)
    inst = [c for c in page.evaluate("window.__mock.imgCalls") if c[0] == "install"]
    check(len(inst) == 1 and inst[0][1]["id"] == "eraser" and inst[0][1]["files"][0]["name"] == "migan_pipeline_v2.onnx", "the eraser model (28 MB) is downloaded once, first")
    tools = page.evaluate("[...document.querySelectorAll('[data-testid=pe-tools] [role=tab]')].map(b => b.dataset.testid.slice(8))")
    check(tools[:4] == ["erase", "people", "cutout", "enhance"], "the Honor-like tool row: AI Eraser · Passers-by · Cut out · Enhance: %s" % tools)
    page.wait_for_function("window.__mock.found.length === 1 && !document.querySelector('[data-testid=pe-hint]').innerText.includes('Finding')", timeout=5000)
    check(page.locator("[data-testid=pe-erase]").is_disabled(), "Erase waits until something is tapped or brushed")
    page.wait_for_timeout(300)
    b = page.locator("[data-testid=pe-canvas]").bounding_box()
    page.mouse.click(b["x"] + b["width"] * 0.5, b["y"] + b["height"] * 0.5)
    check("(1)" in page.locator("[data-testid=pe-erase]").inner_text(), "a tap on the person selects them (outlined)")
    page.click("[data-testid=pe-erase]")
    page.wait_for_function("window.__mock.erase.length === 1", timeout=5000)
    a = page.evaluate("window.__mock.erase[0]")
    check(a["mask"].startswith("data:image/png") and a["photo"].startswith("data:image/png") and not a.get("file"), "the phone gets the photo and a PNG mask")
    m = page.evaluate(MASK_PX, a["mask"])
    check(m[0] == 640 and m[1] == 480 and m[2] > 200 and m[3] == 0 and m[4] == 0, "the mask: the tapped person only (not the passer-by, not the corner): %s" % m)
    page.wait_for_function("window.__mock.found.length === 2", timeout=5000)
    check(page.evaluate("window.__mock.found[1].file") == "erase-1.png", "the editor stays open on the new picture and looks at it again")
    g = page.evaluate("JSON.parse(localStorage.getItem('attune:studio:v1'))")
    check(g[0]["file"] == "erase-1.png" and g[0].get("erased") is True, "each step joins the gallery")
    page.click("[data-testid=pe-tool-people]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=pe-people]").inner_text().strip() == "Remove 1", "Passers-by: everyone but the main subject")
    page.click("[data-testid=pe-people]")
    page.wait_for_function("window.__mock.erase.length === 2", timeout=5000)
    m2 = page.evaluate(MASK_PX, page.evaluate("window.__mock.erase[1]")["mask"])
    check(m2[3] > 200 and m2[2] == 0, "the passer-by goes, the main subject stays: %s" % m2)
    page.click("[data-testid=pe-undo]"); page.wait_for_function("window.__mock.found.length >= 4", timeout=5000)
    check(page.evaluate("window.__mock.found[window.__mock.found.length - 1].file") == "erase-1.png", "Undo steps back one edit")
    page.click("[data-testid=pe-tool-cutout]"); page.wait_for_timeout(300)
    page.click("[data-testid=pe-cut-go]"); page.wait_for_selector("[data-testid=pe-cut]", timeout=4000)
    page.click("[data-testid=pe-cut-save]"); page.wait_for_function("(window.__mock.saved || []).length === 1", timeout=4000)
    check(True, "Cut out: the subject on a clear background, saved to Studio")
    page.click("[data-testid=pe-close]")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
