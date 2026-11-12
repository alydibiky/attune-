"""v9.9.24 B6 X4 the emergency card (Ali picked A+B combined: Family health → Emergency, a tab per person, the full card each; share
one or all, in the reader's language). Baba's card: blood "o pos" read as O+, only today's medicine (a finished course and a stopped
one left out), allergy, doctor, insurance, who to call; Mama's card lists what is missing ("+ Blood type"…) and fills in by Edit;
Share Baba in Arabic → the Arabic card with the insurance number masked; Share all → both cards.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v9924x4.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
t = datetime.date.today()
def d(k): return (t - datetime.timedelta(days=k)).isoformat()
CARE = {"members": [{"id": "pb", "name": "Baba", "emergency": {"blood": "o pos", "allergies": ["Penicillin"], "doctor": {"name": "Dr Hany", "phone": "010 2345 6789"},
          "insurance": {"company": "Misr", "number": "7712345641"}, "call": [{"name": "Ahmed", "rel": "brother", "phone": "0111 222 3333"}]}},
          {"id": "pm", "name": "Mama"}],
        "meds": [{"id": "m1", "member": "pb", "name": "Concor", "strength": "5 mg", "dose": "1", "times": ["08:00"], "start": d(100), "days": 0},
                 {"id": "m2", "member": "pb", "name": "Augmentin", "strength": "1 g", "dose": "1", "times": [], "start": d(30), "days": 7},
                 {"id": "m3", "member": "pb", "name": "Oldmed", "strength": "", "dose": "", "times": [], "start": d(300), "days": 0, "stopped": True}], "labs": [], "taken": {}}
INIT = ("try { localStorage.setItem('attune:care:v1', %s); localStorage.setItem('attune:start','home'); } catch (e) {}\n"
        "window.__shared = []; (() => { const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0); N.share = (t) => { window.__shared.push(t); return true; }; }; go(); })();") % json.dumps(json.dumps(CARE))
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'care'}}))"); page.wait_for_selector("[data-testid=care-page]", timeout=8000)
    page.click("[data-testid=care-tab-emergency]"); page.wait_for_selector("[data-testid=emergency]")
    check(page.locator("[data-testid=em-person]").count() == 2, "a tab per person: Baba, Mama")
    card = page.locator("[data-testid=em-card]").inner_text()
    check("O+" in card and page.locator("[data-testid=em-blood-check]").count() == 0, "Baba's \"o pos\" → O+ (sure, no 'check')")
    meds = page.locator("[data-testid=em-meds]").inner_text()
    check("Concor 5 mg" in meds and "Augmentin" not in meds and "Oldmed" not in meds, "medicines: only today's (Concor) — not the finished course or the stopped one: " + meds.replace("\n", " "))
    check("Penicillin" in card and "Dr Hany" in card and "Misr" in card and "Ahmed" in card, "allergy, doctor, insurance, who to call")
    check(page.locator("[data-testid=em-missing]").count() == 0, "nothing missing on Baba's card")
    # share in Arabic
    page.select_option("[data-testid=em-lang]", "ar"); page.click("[data-testid=em-share]"); page.wait_for_timeout(200)
    sh = page.evaluate("window.__shared[window.__shared.length - 1] || ''")
    check("كارت الطوارئ — Baba" in sh and "فصيلة الدم: O+" in sh and "77…41" in sh and "7712345641" not in sh, "Share Baba in Arabic, insurance masked:\n" + sh)
    # Mama: what's missing, then Edit
    page.locator("[data-testid=em-person]").nth(1).click(); page.wait_for_timeout(200)
    miss = page.locator("[data-testid=em-missing]").inner_text()
    check("Blood type" in miss and "Who to call" in miss and "Allergies" in miss, "Mama's card lists what is missing: " + miss.replace("\n", " "))
    page.click("[data-testid=em-add-blood]"); page.wait_for_selector("[data-testid=em-form]")
    page.fill("[data-testid=em-f-blood]", "A سالب"); page.wait_for_timeout(100)
    check("A-" in page.locator("[data-testid=em-blood-read]").inner_text(), "«A سالب» → read as A- while typing")
    page.check("[data-testid=em-f-none]"); page.fill("[data-testid=em-f-call-name]", "Nada"); page.fill("[data-testid=em-f-call-phone]", "0100 000 0000")
    page.click("[data-testid=em-f-save]"); page.wait_for_timeout(300)
    card = page.locator("[data-testid=em-card]").inner_text()
    check("A-" in card and "No known allergies" in card and "Nada" in card, "saved: A-, no known allergies (ticked), Nada to call")
    saved = page.evaluate("JSON.parse(localStorage.getItem('attune:care:v1')).members.find(m => m.id === 'pm').emergency")
    check(saved.get("blood") == "A-" and saved.get("noAllergies") is True, "kept in Family health: %s" % json.dumps(saved)[:160])
    page.select_option("[data-testid=em-lang]", "en"); page.click("[data-testid=em-share-all]"); page.wait_for_timeout(200)
    sh = page.evaluate("window.__shared[window.__shared.length - 1] || ''")
    check(sh.count("Emergency card") == 2 and "Baba" in sh and "Mama" in sh, "Share all → both cards")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
env.close(); finish()
