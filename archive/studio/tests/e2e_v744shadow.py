"""v6.44 the photo editor erases a tapped person's shadow with them (like the Honor gallery): the shadow is found on the
phone's page (findShadow), shown lighter, "Its shadow too" switches it off; the mask sent to the eraser holds it.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v744shadow.py
"""
import os, re, struct, zlib
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish, HERE

STUDIO = re.search(r'MOCK = r"""(.*?)"""', open(os.path.join(HERE, "e2e_v59.py"), encoding="utf-8").read(), re.S).group(1)
EXTRA = r"""
(() => { const S = window.__mock; S.img.packs = [{ id: "turbo-xl", label: "Studio Turbo+", kind: "draw", files: {} }]; S.erase = []; S.found = [];
  const R = (id, o) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify(o)), 30);
  const add = () => { const N = window.AttuneNative; if (!N || !N.imageInfo) return setTimeout(add, 0);
    N.eraseImage = (id, arg) => { const a = JSON.parse(arg); S.erase.push(a); R(id, { ok: true, file: "erase-" + S.erase.length + ".png", url: a.photo, width: 640, height: 480, ms: 900 }); };
    N.eraserRelease = () => {};
    const box = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); return c.toDataURL("image/png"); };
    N.findSubjects = (id, arg) => { S.found.push(JSON.parse(arg)); R(id, { w: 640, h: 480, subjects: [{ x: 170, y: 40, w: 300, h: 400, area: 120000, mask: box(300, 400) }] }); }; };
  add(); })();
"""
def photo(shadow=True):
    G = (170, 160, 140); S = tuple(int(c * 0.45) for c in G)
    rows = []
    for y in range(480):
        r = bytearray(b"\x00")
        for x in range(640):
            if 170 <= x < 470 and 40 <= y < 440: c = (200, 30, 40)
            elif shadow and ((x - 545) / 80) ** 2 + ((y - 430) / 28) ** 2 <= 1: c = S
            else: c = G
            r += bytes(c)
        rows.append(bytes(r))
    c = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return b"\x89PNG\r\n\x1a\n" + c(b"IHDR", struct.pack(">IIBBBBB", 640, 480, 8, 2, 0, 0, 0)) + c(b"IDAT", zlib.compress(b"".join(rows))) + c(b"IEND", b"")
MASK_AT = """([u, pts]) => new Promise((ok) => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
  ok(pts.map(([x, y]) => g.getImageData(x, y, 1, 1).data[3])); }; im.src = u; })"""
env = Env(); errors = []
with sync_playwright() as pw:
    br = pw.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=STUDIO + "\n" + EXTRA)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    def open_photo(png):
        page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'studio'}}))")
        page.wait_for_selector("[data-testid=studio-erase-photo]", timeout=6000)
        page.set_input_files("[data-testid=studio-erase-file]", files=[{"name": "beach.png", "mimeType": "image/png", "buffer": png}])
        page.wait_for_selector("[data-testid=photo-editor]", timeout=8000)
        page.wait_for_function("window.__mock.found.length >= 1 && !document.querySelector('[data-testid=pe-hint]').innerText.includes('Finding')", timeout=6000)
        page.wait_for_timeout(300)
        b = page.locator("[data-testid=pe-canvas]").bounding_box()
        page.mouse.click(b["x"] + b["width"] * 0.5, b["y"] + b["height"] * 0.5)
    open_photo(photo())
    page.wait_for_selector("[data-testid=pe-shadow]", timeout=3000)
    check("Its shadow too" in page.inner_text("[data-testid=pe-shadow]") and page.get_attribute("[data-testid=pe-shadow]", "aria-pressed") == "true", "a tapped person with a shadow: 'Its shadow too' is on")
    page.click("[data-testid=pe-erase]"); page.wait_for_function("window.__mock.erase.length === 1", timeout=5000)
    m = page.evaluate(MASK_AT, [page.evaluate("window.__mock.erase[0].mask"), [[320, 240], [545, 430], [600, 440], [60, 100], [545, 200]]])
    check(m[0] > 200 and m[1] > 200 and m[2] > 200, "the mask holds the person AND the shadow at their feet: %s" % m)
    check(m[3] == 0 and m[4] == 0, "the plain ground stays: %s" % m)
    page.click("[data-testid=pe-close]"); page.wait_for_timeout(300)
    # switched off → only the person
    page.evaluate("window.__mock.found = []"); open_photo(photo())
    page.wait_for_selector("[data-testid=pe-shadow]", timeout=3000); page.click("[data-testid=pe-shadow]")
    page.click("[data-testid=pe-erase]"); page.wait_for_function("window.__mock.erase.length === 2", timeout=5000)
    m = page.evaluate(MASK_AT, [page.evaluate("window.__mock.erase[1].mask"), [[320, 240], [545, 430]]])
    check(m[0] > 200 and m[1] == 0, "switched off: the person only: %s" % m)
    page.click("[data-testid=pe-close]"); page.wait_for_timeout(300)
    # no shadow in the photo → no chip
    page.evaluate("window.__mock.found = []"); open_photo(photo(shadow=False)); page.wait_for_timeout(300)
    check(page.locator("[data-testid=pe-shadow]").count() == 0, "a photo with no shadow: no chip, nothing extra erased")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
