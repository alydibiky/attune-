"""v6.28 — Ali: "a feature that helps people, automates their lives or does a hard thing no one can do" → Ask your life: one
question answered by code from everything Attune keeps (Money, People & plans, Family health, Fit & Food, the Radar, Mind).
Phone: All → Ask your life; an example and a typed question; the answer names its source and Open goes there; nothing found →
Ask Chat (the question waits in Chat's box). Computer: two panels. Chat: «who owes me money?» answered from the data in a card;
a general question is left to the model. Arabic.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v731lifeask.py     (SHOTS=dir for screenshots)
"""
import os, json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
T = datetime.date.today(); d = lambda n: str(T + datetime.timedelta(days=n))
DATA = {
  "attune:life:v1": {"v": 1, "items": [{"id": "a", "kind": "debt", "person": "Ahmed", "dir": "in", "amount": 1000, "total": 12000, "count": 12, "every": "month", "start": d(-20), "currency": "EGP", "paid": [0, 1, 2]}]},
  "attune:care:v1": {"members": [{"id": "me", "name": "Me"}, {"id": "mum", "name": "Mama"}], "meds": [], "taken": {},
                     "labs": [{"test": "HbA1c", "value": 8.1, "unit": "%", "low": 4, "high": 5.6, "flag": "high", "member": "mum", "date": "2026-05-02"},
                              {"test": "HbA1c", "value": 7.2, "unit": "%", "low": 4, "high": 5.6, "flag": "high", "member": "mum", "date": "2026-09-10"}]},
  "attune:radar:v1": {"items": [{"id": "r1", "kind": "trial", "title": "YouTube Premium", "date": d(2), "amount": 13.99, "currency": "USD", "status": "active"}], "seen": []},
}
def init(start):
    s = "try{localStorage.setItem('attune:start','%s');" % start
    for k, v in DATA.items(): s += "if(!localStorage.getItem('%s'))localStorage.setItem('%s',%s);" % (k, k, json.dumps(json.dumps(v)))
    return s + "}catch(e){}"
def ask(page, q):
    page.fill("[data-testid=home-ask]", q); page.click("[data-testid=home-send]"); page.wait_for_timeout(200)
with sync_playwright() as p:
    br = p.chromium.launch()
    # v7.6 (Ali: "your life integrated in Home in a minimal way"): Your life is a pill in Home's box; the answer shows under it
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=init("home"))
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.click("[data-testid=box-mode-life]")
    ask(page, "Who owes me money?")
    a = page.locator("[data-testid=lifeask-answer]")
    check(a.get_attribute("data-kind") == "owed-in" and "9,000 EGP" in a.inner_text(), "who owes me → 9,000 EGP (12,000 − 3 paid), under Home's box")
    check("People & plans" in a.inner_text(), "the answer names where it came from")
    ask(page, "Is mama's HbA1c getting better?")
    t = page.locator("[data-testid=lifeask-text]").inner_text()
    check("7.2" in t and "down from 8.1" in t and "doctor" in t, "typed: mum's HbA1c 7.2, down from 8.1 — ask the doctor: " + t)
    check(page.locator("[data-testid=lifeask-rows] tr").count() == 2, "both results listed")
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, "lifeask-phone.png"))
    page.click("[data-testid=lifeask-open]"); page.wait_for_timeout(300)
    check(page.locator("[data-testid=care-page]").count() == 1, "Open goes to Family health")
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'lifeask'}}))"); page.wait_for_timeout(500)
    check(page.locator("[data-testid=box-mode-life][aria-checked=true]").count() == 1, "the old Your life page opens Home with the pill on")
    ask(page, "capital of France")
    check(page.locator("[data-testid=lifeask-none]").count() == 1, "nothing in the data → says so, offers Chat")
    page.click("[data-testid=lifeask-close]"); page.wait_for_timeout(150)
    check(page.locator("[data-testid=lifeask-none]").count() == 0, "the answer closes")
    # computer
    page.set_viewport_size({"width": 1366, "height": 860}); page.wait_for_timeout(200)
    page.goto(env.url); page.wait_for_selector("[data-testid=side]", timeout=15000); page.wait_for_timeout(300)
    page.click("[data-testid=box-mode-life]"); ask(page, "What's due this week?")
    check("YouTube Premium" in page.locator("[data-testid=lifeask-answer]").inner_text(), "computer: the answer under the box (the trial in 2 days)")
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, "lifeask-desk.png"))
    ctx.close()
    # Chat
    ctx, page = new_page(br, env, errors, extra_init=init("chat"))
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    comp = page.locator("textarea[placeholder='Message Attune']")
    comp.fill("مين عليه فلوس ليا؟"); page.locator("button[title='Send']").click(); page.wait_for_timeout(400)
    card = page.locator("[data-testid=card-emerald]").last
    check(card.count() == 1 and "9,000" in card.inner_text() and "Ahmed" in card.inner_text(), "Chat: «مين عليه فلوس ليا؟» answered from People & plans: " + card.inner_text().replace("\n", " ")[:120])
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, "lifeask-chat.png"))
    card.locator("button").first.click(); page.wait_for_timeout(300)
    check(page.locator("[data-testid=life-page]").count() == 1, "its Open button goes to People & plans")
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    n0 = page.locator("[data-testid=card-emerald]").count()
    page.locator("textarea[placeholder='Message Attune']").fill("What is HbA1c?"); page.locator("button[title='Send']").click(); page.wait_for_timeout(500)
    check(page.locator("[data-testid=card-emerald]").count() == n0, "Chat: «What is HbA1c?» stays a normal question")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
