"""v6.27 Family health: a prescription (typed / photo) is read line by line — the line shown, missing parts asked, a tapering
dose flagged; daily reminders per time; today's doses ticked; interaction warnings ONLY quoted from an official label (the
medicines pack, mocked); lab results flagged only by the report's own range; a medicine reminder opens the page; Home's Today
lists the next doses.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v727care.py     (SHOTS=dir for screenshots)
"""
import os, json, base64
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish, HERE
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
RX = "Dr. Ahmed — Clinic\nDate: 12/10/2026\n1) Coumadin 5 mg 1 tab once daily\n2) Brufen 400 mg 1 tab 3 times daily after food for 5 days\n3) Prednisolone 5 mg 2 tabs daily for 5 days then 1 tab daily for 5 days"
PASSAGES = {"Coumadin": [{"title": "Medicine — WARFARIN SODIUM (warfarin) — oral — Interactions", "text": "Drugs that increase bleeding risk: Concomitant use of aspirin, NSAIDs such as ibuprofen, or clopidogrel increases the risk of bleeding.", "url": "https://dailymed.nlm.nih.gov/x"},
                         {"title": "Medicine — WARFARIN SODIUM (warfarin) — oral — Uses", "text": "warfarin (brands: Coumadin, Jantoven), oral — Uses: …", "url": ""}],
            "Brufen": [{"title": "Medicine — IBUPROFEN (ibuprofen) — oral — Uses", "text": "ibuprofen (brands: Advil, Motrin, Brufen), oral — Uses: pain", "url": ""}]}
INIT = "try{localStorage.setItem('attune:start','home')}catch(e){}\n" + r"""
(() => { const P = %s; const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0);
  N.knowPacks = () => JSON.stringify({ packs: [{ id: "medicines", installed: true }] });
  N.knowSearch = (id, arg) => { const a = JSON.parse(arg); const k = Object.keys(P).find((n) => a.q.startsWith(n)); setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ passages: k ? P[k] : [] })), 20); };
  N.readText = (id, arg) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ text: "LAB REPORT\nHaemoglobin 11.2 g/dL 13.5 - 17.5\nPlatelets 250\nHbA1c 7.2 %% < 5.7", lines: [] })), 20);
}; go(); })();""" % json.dumps(PASSAGES)
def open_care(page):
    page.locator("nav button").last.click(); page.wait_for_timeout(300)
    page.locator(".rounded-t-2xl button:has-text('Family health')").first.click()
    page.wait_for_selector("[data-testid=care-page]", timeout=5000)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    open_care(page)
    page.click("[data-testid=care-rx-type]"); page.fill("[data-testid=care-rx-text]", RX); page.click("[data-testid=care-rx-read]")
    forms = page.locator("[data-testid=care-medform]")
    check(forms.count() == 3, "the prescription gives 3 medicines (doctor and date lines skipped)")
    check("Coumadin 5 mg 1 tab once daily" in forms.nth(0).locator("[data-testid=care-raw]").inner_text(), "each one shows the line it was read from")
    check(forms.nth(2).locator("[data-testid=care-taper]").count() == 1, "the tapering prednisolone is flagged to check, not simplified")
    page.locator("[data-testid=care-medform]").nth(2).locator("button:has-text('Cancel')").click()
    page.locator("[data-testid=care-save]").first.click(); page.wait_for_timeout(200)
    page.locator("[data-testid=care-save]").first.click(); page.wait_for_timeout(600)
    notes = page.evaluate("window.__mock.notes.filter(n => n.id.startsWith('med-')).map(n => n.title + ' @' + n.repeat)")
    check(len(notes) == 4 and all("@daily" in n for n in notes), "daily reminders: 1 for Coumadin + 3 for Brufen: %s" % notes)
    page.wait_for_selector("[data-testid=care-warnings]", timeout=5000)
    w = page.locator("[data-testid=care-warnings]").inner_text()
    check("Coumadin + Brufen" in w and "ibuprofen" in w and "official label" in w, "Coumadin + Brufen: the warfarin label's own sentence is quoted: %s" % w.replace("\n", " ")[:160])
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, "care-meds.png"))
    page.click("[data-testid=care-tab-today]")
    rows = page.locator("[data-testid=care-dose-row]")
    check(rows.count() == 4, "today: 4 doses")
    rows.first.click(); page.wait_for_timeout(200)
    check(rows.first.get_attribute("aria-pressed") == "true", "a dose is ticked as taken")
    # labs from a photo
    page.click("[data-testid=care-tab-labs]")
    png = page.evaluate("""() => { const c = document.createElement('canvas'); c.width = 100; c.height = 100; return c.toDataURL('image/png').split(',')[1]; }""")
    path = os.path.join(HERE, "_lab.png"); open(path, "wb").write(base64.b64decode(png))
    page.locator("[data-testid=care-lab-file]").set_input_files(path); os.remove(path)
    page.wait_for_selector("[data-testid=care-labdraft]", timeout=5000)
    page.click("[data-testid=care-lab-save]"); page.wait_for_timeout(300)
    labs = {t.split("\n")[0]: t for t in page.locator("[data-testid=care-lab]").all_inner_texts()}
    check("low" in labs.get("Haemoglobin", "") and "high" in labs.get("HbA1c", "") and "range" not in labs.get("Platelets", "x").replace("report range", ""), "labs: Hb low and HbA1c high by the report's ranges; Platelets with no range is not judged: %s" % list(labs.values()))
    # Home lists the next doses; a reminder tap opens the page
    page.locator("nav button:has-text('Home')").click(); page.wait_for_timeout(400)
    page.evaluate("(() => { const ev = new Event('attune-share'); ev.data = { kind: 'reminder', id: 'med-x-0800' }; window.dispatchEvent(ev); })()"); page.wait_for_timeout(400)
    check(page.locator("[data-testid=care-page]").count() == 1, "a medicine reminder opens Family health")
    ctx.close()
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
