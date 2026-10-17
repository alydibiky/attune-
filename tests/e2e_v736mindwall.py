"""v6.32 — Mind look A, "the wall" (Ali picked A): search, one row of chips (All, each kind, Promises, Your words, colours,
spaces, #tags), then everything as a picture wall — links get a coloured preview, each card a small kind label; a photo's
main colour is read once and the colour chip filters the wall (search by colour, like My Mind).
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v736mindwall.py
"""
import json, time, zlib, struct, os
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
def png(rgb, w=24, h=16):
    raw = b"".join(b"\x00" + bytes(rgb) * w for _ in range(h))
    c = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return b"\x89PNG\r\n\x1a\n" + c(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + c(b"IDAT", zlib.compress(raw)) + c(b"IEND", b"")
now = int(time.time() * 1000)
REC = [
  {"id": "n1", "ts": now - 2 * 86400000, "kind": "note", "title": "Ask Hany about the outrigger pads", "text": "Ask Hany about the outrigger pads before Thursday's lift", "output": "", "tags": [], "meta": {"mindKind": "note"}, "pinned": False},
  {"id": "l1", "ts": now - 86400000, "kind": "note", "title": "Liebherr LTM 1100 load chart", "text": "https://www.liebherr.com/en/ltm-1100-load-chart.pdf", "output": "", "tags": [], "meta": {"mindKind": "link"}, "pinned": False},
  {"id": "q1", "ts": now - 3600000, "kind": "note", "title": "", "text": "“The best time to plant a tree was 20 years ago.”", "output": "", "tags": [], "meta": {"mindKind": "quote"}, "pinned": False},
  {"id": "o1", "ts": now - 40 * 86400000, "kind": "note", "title": "Book the car service at 40,000 km", "text": "Book the car service at 40,000 km", "output": "", "tags": [], "meta": {"mindKind": "note"}, "pinned": False},
]
SEED = "try { localStorage.setItem('attune:memory:v1', %s); } catch (e) {}" % json.dumps(json.dumps(REC))
SHOT = "/tmp/v736mindwall.png"
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=SEED)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("nav button:has-text('Mind')").click(); page.wait_for_selector("[data-testid=mind-page]", timeout=5000)
    chips = page.locator("[data-testid=mind-spaces]").inner_text()
    check(all(w in chips for w in ["All", "Notes", "Links", "Quotes", "Promises", "Your words"]), "one row of chips: All, kinds, Promises, Your words (%s)" % chips.replace("\n", " | "))
    check(page.locator("[data-testid=mind-board] [data-testid=mind-card]").count() == 4, "everything is on the wall")
    check(page.locator("[data-testid=mind-past]").count() == 1, "something from your past sits on the wall too")
    link = page.locator("[data-testid=mind-card][data-kind=link]").first
    check("liebherr.com" in link.inner_text() and "gradient" in (link.locator("div").first.get_attribute("style") or ""), "a link gets a coloured preview and its site")
    check("Note".upper() in page.locator("[data-testid=mind-card][data-kind=note]").first.inner_text().upper(), "cards carry a small kind label")
    # a red photo → its colour is read, the colour chip filters
    f = "/tmp/v736red.png"; open(f, "wb").write(png([210, 40, 35]))
    page.set_input_files("input[data-testid=mind-photo]", f); page.wait_for_timeout(1500)
    check(page.locator("[data-testid=mind-colour-red]").count() == 1, "a red photo makes a red colour chip")
    page.click("[data-testid=mind-colour-red]"); page.wait_for_timeout(200)
    ks = [c.get_attribute("data-kind") for c in page.locator("[data-testid=mind-card]").all()]
    check(ks == ["photo"], "the colour chip shows only the red photo (%s)" % ks)
    page.click("[data-testid=mind-all]"); page.wait_for_timeout(200)
    page.click("[data-testid=mind-kind-link]"); page.wait_for_timeout(200)
    check([c.get_attribute("data-kind") for c in page.locator("[data-testid=mind-card]").all()] == ["link"], "a kind chip filters the wall")
    page.click("[data-testid=mind-tab-promises]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=mind-board]").count() == 0 and page.locator("[data-testid=mind-spaces]").count() == 1, "Promises opens from the same chip row, which stays to get back")
    page.click("[data-testid=mind-all]"); page.wait_for_timeout(300)
    page.screenshot(path=SHOT)
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
finish()
