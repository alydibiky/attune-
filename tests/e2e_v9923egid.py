"""v9.9.23 Egyptian national ID: a photo whose text holds the 14-digit number (Arabic-Indic digits) → the card shows the birth date,
governorate and sex worked out from the number; a wrong digit says which part is impossible; the expiry (on the back) is asked; Save → Dates.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v9923egid.py
"""
import json, os, tempfile, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
TEXT = "جمهورية مصر العربية\nبطاقة تحقيق الشخصية\n٢٩٠٠٣١٥٠١٠١٢٣٤"
INIT = ("try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:testing-pro','on')}catch(e){}\n"
        "(() => { const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0); N.payAccess = () => true; N.payQueue = () => '[]';"
        " N.readText = (id, arg) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ text: %s, lines: [] })), 50); }; go(); })();") % json.dumps(TEXT)
PNG = bytes.fromhex("89504e470d0a1a0a0000000d4948445200000001000000010806000000" "1f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4b70000000049454e44ae426082")
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_timeout(1500)
    page.evaluate("m => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", "radar"); page.wait_for_selector("[data-testid=radar-page]", timeout=6000)
    f = os.path.join(tempfile.mkdtemp(), "id.png"); open(f, "wb").write(PNG); page.set_input_files("[data-testid=radar-file]", f)
    page.wait_for_selector("[data-testid=radar-egid]", timeout=6000)
    dec = page.locator("[data-testid=egid-decoded]").inner_text()
    check(page.locator("[data-testid=egid-number]").input_value() == "29003150101234" and "1990-03-15" in dec and "Cairo" in dec and "Male" in dec, "the number (Arabic-Indic) → 15 Mar 1990, Cairo, Male: " + dec.replace("\n", " "))
    check(page.locator("[data-testid=egid-save]").is_disabled(), "no expiry yet → Save waits (it's on the back of the card)")
    page.fill("[data-testid=egid-number]", "29013150101234"); page.wait_for_timeout(100)
    check("isn't a real date" in page.locator("[data-testid=egid-why]").inner_text(), "a wrong digit (month 13) → says the date inside it isn't real")
    page.fill("[data-testid=egid-number]", "29003150101234")
    exp = (datetime.date.today() + datetime.timedelta(days=900)).isoformat()
    page.fill("[data-testid=egid-expiry]", exp); page.fill("[data-testid=egid-name]", "Ali"); page.click("[data-testid=egid-save]"); page.wait_for_timeout(400)
    items = page.evaluate("JSON.parse(localStorage.getItem('attune:radar:v1')||'{\"items\":[]}').items")
    it = [i for i in items if i.get("doc") == "id"]
    check(len(it) == 1 and it[0]["date"] == exp and "29003150101234" in it[0]["note"] and "Cairo" in it[0]["note"], "saved with its expiry, number and governorate: " + json.dumps(it)[:200])
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
env.close(); finish()
