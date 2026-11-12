"""v9.9.22 (Ali: "make me also upload photos from gallery" + "upload the photo of the passport … it fills out all info"): every photo button
asks Camera or Gallery (Gallery opens the picker WITHOUT forcing the camera); a passport photo on the Dates page fills every field from its
coded lines (checked), each editable; Save → the passport with its expiry on the Dates page.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v9922photos.py
"""
import json, os, tempfile, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
W = [7, 3, 1]
def cd(s): return str(sum((0 if c == "<" else int(c) if c.isdigit() else ord(c) - 55) * W[i % 3] for i, c in enumerate(s)) % 10)
exp = datetime.date.today().replace(year=datetime.date.today().year + 6)
nm, bd, ed = "A12345678", "900315", exp.strftime("%y%m%d")
body = nm + cd(nm) + "EGY" + bd + cd(bd) + "M" + ed + cd(ed) + "<" * 14 + cd("<" * 14)
L2 = body + cd(body[0:10] + body[13:20] + body[21:43])
L1 = ("P<EGYELDIBIKY<<ALI<" + "<" * 44)[:44]
TEXT = "ARAB REPUBLIC OF EGYPT\nPASSPORT\n" + L1 + "\n" + L2.replace("0", "O", 1)   # one camera misread (O for 0) to be fixed
INIT = ("try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:testing-pro','on')}catch(e){}\n"
        "(() => { const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0); N.payAccess = () => true; N.payQueue = () => '[]';"
        " N.readText = (id, arg) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ text: %s, lines: [] })), 50); }; go(); })();") % json.dumps(TEXT)
PNG = bytes.fromhex("89504e470d0a1a0a0000000d4948445200000001000000010806000000" "1f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4b70000000049454e44ae426082")
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_timeout(1500)
    page.evaluate("m => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", "radar"); page.wait_for_selector("[data-testid=radar-page]", timeout=6000)
    page.click("[data-testid=radar-scan]"); page.wait_for_selector("[data-testid=photo-pick]", timeout=3000)
    check(page.locator("[data-testid=photo-pick-camera]").count() == 1 and page.locator("[data-testid=photo-pick-gallery]").count() == 1, "the photo button asks: Take a photo · Choose from gallery")
    with page.expect_file_chooser() as fc: page.click("[data-testid=photo-pick-gallery]")
    check(page.evaluate("document.querySelector('[data-testid=radar-file]').hasAttribute('capture')") is False, "Gallery opens the picker without forcing the camera")
    f = os.path.join(tempfile.mkdtemp(), "passport.png"); open(f, "wb").write(PNG); fc.value.set_files(f)
    page.wait_for_selector("[data-testid=radar-mrz]", timeout=6000)
    val = lambda k: page.locator("[data-testid=mrz-%s]" % k).input_value()
    check(val("surname") == "ELDIBIKY" and val("given") == "ALI" and val("number") == "A12345678" and val("nationality") == "EGY" and val("birth") == "1990-03-15" and val("expiry") == exp.isoformat() and val("sex") == "M",
          "the passport fills every field (O-for-0 fixed): %s" % [val(k) for k in ["given", "surname", "number", "nationality", "birth", "sex", "expiry"]])
    check(page.locator("[data-testid=radar-mrz]").inner_text().count("check this") == 0, "all checks passed — nothing marked to check")
    page.fill("[data-testid=mrz-given]", "Ali Ahmed")   # every field editable
    page.click("[data-testid=mrz-save]"); page.wait_for_timeout(500)
    items = page.evaluate("JSON.parse(localStorage.getItem('attune:radar:v1')||'{\"items\":[]}').items")
    pp = [i for i in items if i.get("doc") == "passport"]
    check(len(pp) == 1 and pp[0]["date"] == exp.isoformat() and "Ali Ahmed ELDIBIKY" in pp[0]["title"] and "A12345678" in pp[0]["note"], "saved: the passport with its expiry, the edited name and the number: %s" % json.dumps(pp)[:220])
    # the same choice from Home's smart camera
    page.evaluate("m => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", "home"); page.wait_for_timeout(600)
    if page.locator("[data-testid=home-smartcam]").count():
        page.click("[data-testid=home-smartcam]"); check(page.locator("[data-testid=photo-pick]").count() == 1, "Home's camera asks the same"); page.click("[data-testid=photo-pick-cancel]")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
env.close(); finish()
