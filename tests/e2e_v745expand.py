"""v6.45 Expand in the photo editor: a shape → the photo on a bigger canvas (centred) and a mask of the new border goes to
the eraser model; the result is the next step. Arabic: no English left.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v745expand.py
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
SIZE = """(u) => new Promise((ok) => { const im = new Image(); im.onload = () => ok([im.width, im.height]); im.src = u; })"""
env = Env(); errors = []
with sync_playwright() as pw:
    br = pw.chromium.launch()
    for lang in ["en", "ar"]:
        init = STUDIO + "\n" + EXTRA + ("\ntry{localStorage.setItem('attune:ui:lang','ar')}catch(e){};window.__trMiss=new Set()" if lang == "ar" else "")
        ctx, page = new_page(br, env, errors, extra_init=init)
        page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
        page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'studio'}}))")
        page.wait_for_selector("[data-testid=studio-erase-photo]", timeout=6000)
        page.set_input_files("[data-testid=studio-erase-file]", files=[{"name": "beach.png", "mimeType": "image/png", "buffer": photo(False)}])
        page.wait_for_selector("[data-testid=photo-editor]", timeout=8000); page.wait_for_timeout(400)
        page.click("[data-testid=pe-tool-expand]"); page.wait_for_selector("[data-testid=pe-shapes]")
        if lang == "en":
            check(page.locator("[data-testid=pe-shapes] button").count() == 7, "Expand: 7 shapes (all round, wider, taller, 1:1, 4:5, 16:9, 9:16)")
            page.click("[data-testid=pe-shape-16x9]"); page.click("[data-testid=pe-expand]")
            page.wait_for_function("window.__mock.erase.length === 1", timeout=5000)
            a = page.evaluate("window.__mock.erase[0]")
            check(page.evaluate(SIZE, a["photo"]) == [853, 480], "16:9 from 640 × 480 → an 853 × 480 canvas")
            m = page.evaluate(MASK_AT, [a["mask"], [[10, 240], [840, 240], [426, 240]]])
            check(m[0] > 200 and m[1] > 200 and m[2] == 0, "the mask: the new edges are filled, the photo kept: %s" % m)
            page.wait_for_timeout(300)
            check("853" in page.inner_text("body") or page.locator("[data-testid=pe-hint]").count() == 1, "the expanded picture is the next step")
        else:
            miss = [x for x in page.evaluate("[...window.__trMiss]") if x != "Attune"]
            check(not miss, "Arabic: no English left in Expand: %s" % miss[:6])
        ctx.close()
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
