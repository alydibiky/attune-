"""v9.8 N1 The Haggler + N3 Errands (Ali: "do N1 and N3 … best way possible … without any mistakes").
N1: a sentence → the Haggler's page; a pasted ad → a seller; the first message goes out through Messages (one tap / by itself);
the seller's WhatsApp reply (a kept notification) → the next message, an offer; never a promise; a price inside the limit → your turn.
N3: an errand in your words → "Needs you" with the papers; it is on Follow-ups' list too.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v980n1n3.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
NOW = datetime.datetime(2026, 11, 7, 10, 0, 0)
ms = lambda d: int(d.timestamp() * 1000)
INIT = "try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:agents:view2','new')}catch(e){}"
MOCK = """(() => { window.__sched = []; function w(){ const N = window.AttuneNative; if (!N) return setTimeout(w, 5);
  N.schedule = (j) => { window.__sched.push(JSON.parse(j)); return true; };
  N.recallNotes = () => localStorage.getItem('test:notes') || '[]'; } w(); })();"""
def open_mode(page, m, sel):
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'%s'}}))" % m); page.wait_for_selector(sel, timeout=10000); page.wait_for_timeout(300)
def haggle(page): return [a for a in page.evaluate("JSON.parse(localStorage.getItem('attune:agents:v1')).agents") if a["kind"] == "haggle"][0]
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + ";" + MOCK)
    ctx.clock.set_fixed_time(NOW)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_timeout(1200)
    # ---- N1 ----
    open_mode(page, "agents", "[data-testid=agents-page]")
    page.fill("[data-testid=agents-input]", "negotiate a Tucson 2022 under 1,050,000, no accidents, agency service, in Cairo or Giza")
    page.click("[data-testid=agents-go]"); page.wait_for_selector("[data-testid=haggle-view]", timeout=5000)
    lim = page.inner_text("[data-testid=haggle-limits]")
    check("1,050,000" in lim and "No accidents" in lim and "Agency service" in lim, "the Haggler's page with your limits: " + lim.replace("\n", " · "))
    page.fill("[data-testid=haggle-paste]", "Hyundai Tucson 2022 للبيع 1,120,000 جنيه — كلمني 0100 123 4567 https://www.hatla2ee.com/ar/car/used/hyundai/tucson/123456")
    page.click("[data-testid=haggle-add-go]"); page.wait_for_timeout(300)
    check(page.locator("[data-testid=haggle-seller]").count() == 1 and "1,120,000" in page.inner_text("[data-testid=haggle-seller]"), "a pasted ad → Seller 1 at 1,120,000")
    page.reload(); page.wait_for_timeout(1800)   # the background step runs (it runs every minute and at start)
    h = haggle(page); s = h["sellers"][0]
    sent = [x for x in page.evaluate("window.__sched") if x.get("send")]
    check(len(sent) == 1 and "still available" in sent[0]["send"]["text"] and sent[0]["send"]["phone"] == "01001234567" and sent[0]["send"]["ask"] is True, "the first message goes to the seller's WhatsApp — one tap (Send / Not now): " + (sent[0]["send"]["text"] if sent else ""))
    check(not s.get("pending") and len(s.get("said", [])) == 1, "…and is in the seller's thread, never sent twice")
    page.evaluate("t => localStorage.setItem('test:notes', JSON.stringify([{id: 5, pkg: 'com.whatsapp', app: 'WhatsApp', title: '+20 100 123 4567', text: 'مفيهاش رش وصيانة توكيل، آخر سعر مليون و١٠٠', ts: t}]))", ms(NOW) + 60000)
    ctx.clock.set_fixed_time(datetime.datetime(2026, 11, 7, 10, 5, 0))
    page.reload(); page.wait_for_timeout(1800)
    sent = [x for x in page.evaluate("window.__sched") if x.get("send")]
    check(len(sent) == 1 and "cash" in sent[0]["send"]["text"], "their reply (a WhatsApp notification) → the next message: an offer: " + (sent[0]["send"]["text"] if sent else ""))
    check(not any(w in (sent[0]["send"]["text"] if sent else "") for w in ["Deal", "I'll take", "اتفقنا", "عربون"]), "…never a promise or a deposit")
    s = haggle(page)["sellers"][0]
    check(s["theirs"][-1] == 1100000 and s["answers"].get("no-accident") == "yes", "it understood: 1,100,000 and no accidents")
    # ---- N3 ----
    open_mode(page, "errands", "[data-testid=errands-page]")
    page.fill("[data-testid=errands-input]", "رخصة القيادة بتخلص ٢٠ نوفمبر ٢٠٢٦"); page.click("[data-testid=errands-add]"); page.wait_for_timeout(300)
    check(page.locator("[data-testid=errand-due]").count() == 1 and "Driving licence" in page.inner_text("[data-testid=errands-due]"), "an errand in Arabic → Needs you: the driving licence")
    page.locator("[data-testid=errand-due] button").first.click(); page.wait_for_timeout(150)
    check("Eye test" in page.inner_text("[data-testid=errand-papers]"), "…with the papers to bring")
    check(page.evaluate("document.documentElement.dataset.area") == "fu", "Errands is in Follow-ups (amber)")
    open_mode(page, "timeline", "[data-testid=timeline-page]")
    check("Driving licence" in page.inner_text("[data-testid=timeline-page]"), "the errand is on Follow-ups' list too")
    check(not real_errors(errors), "no JavaScript errors: %s" % real_errors(errors)[:3])
    br.close()
finish()
