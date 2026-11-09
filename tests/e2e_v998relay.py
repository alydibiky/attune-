"""v9.9.8 M2 (Ali OK'd: small models help each other, never big ones on phones): the meaning model finds your note that MEANS the
question (Arabic question, English note — no word in common), the chat model answers from it, and the phone is asked to let the
meaning model go after. Strict: a note that only loosely means it is never passed as "yours".
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v998relay.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
MEM = [{"id": "e1", "ts": 1762000000000, "kind": "note", "title": "Bills", "text": "Electricity invoice for October came to 850 pounds, paid at Fawry.", "output": "", "tags": [], "meta": {"book": "mybook"}, "pinned": False},
       {"id": "g1", "ts": 1762000001000, "kind": "note", "title": "Gym", "text": "Leg day on Monday, 5 sets of squats.", "output": "", "tags": [], "meta": {"book": "mybook"}, "pinned": False}]
INIT = "try{localStorage.setItem('attune:memory:v1', %s)}catch(e){}" % json.dumps(json.dumps(MEM))
# the phone's meaning model, faked: electricity / الكهربا → one direction, gym → another, "weather" → in between
MOCK = """(() => { window.__embeds = []; function w(){ const N = window.AttuneNative; if (!N) return setTimeout(w, 5);
  N.embedStatus = () => JSON.stringify({ installed: true, loaded: false });
  N.embed = (id, arg) => { const a = JSON.parse(arg); window.__embeds.push(a);
    const v = (t) => /electric|الكهربا|كهربا/i.test(t) ? [0.98, 0.1, 0.05] : /gym|leg day|squat/i.test(t) ? [0, 1, 0] : [0.3, 0.3, 0.9];
    setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ vecs: a.texts.map(v) })), 10); }; } w(); })();"""
def install(page):
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)
def ask(page, t):
    page.evaluate("() => { window.__mock.bodies = []; }")
    page.locator("textarea[placeholder='Message Attune']").fill(t); page.locator("button[title='Send']").click()
    page.wait_for_function("() => window.__mock.bodies.some(x => x.max_tokens > 2)", timeout=20000); page.wait_for_timeout(1500)
    return json.dumps(page.evaluate("window.__mock.bodies.filter(x => x.max_tokens > 2)"), ensure_ascii=False)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT + ";" + MOCK)
    page.goto(env.url); page.wait_for_timeout(1000)
    install(page)
    b = ask(page, "فاتورة الكهربا الشهر اللي فات كانت كام؟")
    check("850" in b and "Fawry" in b, "Arabic question, English note: the meaning model finds it and the chat model gets it")
    check("Leg day" not in b, "…and only that note (the gym note is not passed)")
    e = page.evaluate("window.__embeds")
    check(e and e[0].get("release") is True and "الكهربا" in e[0]["texts"][0], "the phone gets the question with release (the meaning model is let go when memory is tight)")
    page.wait_for_selector("[data-testid=from-mine]", timeout=20000)
    check("Bills" in page.locator("[data-testid=from-mine]").last.inner_text(), "the answer says where it came from: your note “Bills”")
    page.click("header button[aria-label='New chat']"); page.wait_for_timeout(200); page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'chat'}}))"); page.wait_for_timeout(400)
    b = ask(page, "what will the weather be like in Alexandria tomorrow")
    check("850" not in b and "Leg day" not in b, "strict: a question only loosely near your notes gets none of them")
    check(len(page.evaluate("window.__embeds")) >= 2 and len(page.evaluate("window.__embeds")[1]["texts"]) == 1, "the notes got their numbers once; the next question only sends itself")
    check(not real_errors(errors), "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
