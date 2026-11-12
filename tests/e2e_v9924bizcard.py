"""v9.9.24 X1 business card → People card: People → Add → From a business card: the photo (clarity-checked) is read — «م. محمود السيد»,
«مدير المشروعات · شركة النيل للمقاولات», the mobile (not the fax) linked as his contact, the email kept on the card; Save → his card.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v9924bizcard.py
"""
import json, os, tempfile
from playwright.sync_api import sync_playwright
from harness import doc_png, Env, new_page, check, real_errors, finish
env = Env(); errors = []
CARD = "م. محمود السيد\nمدير المشروعات\nشركة النيل للمقاولات\nموبايل: ٠١٠٠١٢٣٤٥٦٧\nفاكس: ٠٢٢٣٤٥٦٧٨٩\nmahmoud@nile.com.eg"
INIT = ("try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:people:seeded','1')}catch(e){}\n"
        "(() => { const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0); N.readText = (id, arg) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ text: %s, lines: [] })), 30); }; go(); })();") % json.dumps(CARD)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'people'}}))"); page.wait_for_selector("[data-testid=people-page]", timeout=8000)
    page.click("[data-testid=people-add]"); page.wait_for_selector("[data-testid=people-editor]")
    page.set_input_files("[data-testid=people-card-input]", doc_png(page, os.path.join(tempfile.mkdtemp(), "c.png"))); page.wait_for_timeout(1500)
    check(page.input_value("[data-testid=people-name]") == "محمود السيد", "the name without «م.»: " + page.input_value("[data-testid=people-name]"))
    check(page.input_value("[data-testid=people-role]") == "مدير المشروعات · شركة النيل للمقاولات", "job · company: " + page.input_value("[data-testid=people-role]"))
    check("01001234567" in page.locator("[data-testid=people-contact]").inner_text(), "the mobile linked (not the fax)")
    page.click("[data-testid=people-save]"); page.wait_for_selector("[data-testid=people-card]", timeout=5000)
    d = page.evaluate("JSON.parse(localStorage.getItem('attune:people:v1')).items[0]")
    check(d["name"] == "محمود السيد" and d["contact"]["phone"] == "01001234567" and "mahmoud@nile.com.eg" in d.get("note", ""), "saved: %s" % json.dumps(d, ensure_ascii=False)[:200])
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
env.close(); finish()
