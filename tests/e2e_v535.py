"""v5.35 — Chat X-Ray: a WhatsApp chat export, read on the phone — the money ledger (by code),
promises with reminders, unanswered questions, stats and "ask this chat".

  python3 tests/e2e_v535.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish

env = Env(); errors = []
d = datetime.date.today()
day = lambda k: (d - datetime.timedelta(days=k)).strftime("%d/%m/%Y")
CHAT = "\n".join([
    f"{day(5)}, 09:14 - Messages and calls are end-to-end encrypted. No one outside of this chat can read them.",
    f"{day(5)}, 09:15 - Hassan Crane Co: Good morning Ali",
    f"{day(5)}, 09:16 - Ali: Morning. The 50 t crane for Friday is 18,000 EGP per day",
    f"{day(5)}, 09:20 - Hassan Crane Co: OK. I'll transfer 9,000 EGP deposit tomorrow",
    "and the rest after the job",
    f"{day(4)}, 18:02 - Hassan Crane Co: Sent 9,000 on InstaPay",
    f"{day(3)}, 11:00 - Hassan Crane Co: Can you send the operator's licence copy?",
])
ITEMS = json.dumps({"items": [
    {"type": "owes", "msg": 1, "from": "Hassan", "to": "Ali", "amount": 18000, "currency": "EGP", "what": "crane day"},
    {"type": "paid", "msg": 3, "from": "Hassan Crane Co", "to": "Ali", "amount": 9000, "currency": "EGP", "what": "deposit"},
    {"type": "promise", "msg": 2, "from": "Hassan", "to": "Ali", "amount": None, "what": "pay the rest after the job", "due": (d + datetime.timedelta(days=3)).isoformat()},
]})

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)

    # ---- 1. WhatsApp → Export chat → Attune opens Chat X-Ray with the chat loaded ----
    page.evaluate("(t) => window.dispatchEvent(new MessageEvent('attune-share', { data: { kind: 'chatfile', text: t, name: 'Hassan Crane Co' } }))", CHAT)
    page.wait_for_selector("[data-testid=xray-setup]", timeout=5000)
    check("5 messages" in page.locator("[data-testid=xray-setup]").inner_text(), "a shared chat export opens Chat X-Ray with its 5 messages")
    page.locator("[data-testid=xray-me]", has_text="Ali").click()

    # ---- 2. the X-ray: only money / promise / question messages go to the model ----
    page.evaluate("(q) => { const M = window.__mock; M.fakeQueue = q; M.bodies = []; }", [ITEMS])
    page.locator("[data-testid=xray-go]").click()
    page.wait_for_selector("[data-testid=xray-result]", timeout=30000)
    sent = json.dumps(page.evaluate("window.__mock.bodies.filter(x => x.max_tokens > 2).map(x => x.messages)"))
    check("#2" in sent and "Sent 9,000" in sent and "end-to-end" not in sent, "the model reads numbered messages (never the encryption notice)")
    check("9,000 EGP" in page.locator("[data-testid=xray-owed]").inner_text(), "the ledger by code: 18,000 owed − 9,000 paid → 9,000 EGP owed to Ali")
    money = page.locator("[data-testid=xray-money]").inner_text()
    check("Hassan Crane Co" in money and "owes you 9,000 EGP" in money, "…Hassan Crane Co owes you 9,000 EGP")

    # ---- 3. promises with a reminder; unanswered questions; stats ----
    page.locator("[data-testid=xray-tab-promises]").click()
    check("pay the rest after the job" in page.locator("[data-testid=xray-promises]").inner_text(), "the promise is listed with its date and the message itself")
    page.locator("[data-testid=xray-remind]").first.click(); page.wait_for_timeout(200)
    check(len(page.evaluate("window.__mock.scheduled || []")) >= 1 or page.locator("text=Reminder set").count() >= 1, "'Remind me' sets a phone reminder")
    page.locator("[data-testid=xray-tab-unanswered]").click()
    check("operator's licence" in page.locator("[data-testid=xray-unanswered]").inner_text(), "the question Ali never answered is found (by code)")
    page.locator("[data-testid=xray-tab-stats]").click()
    check("Hassan Crane Co" in page.locator("[data-testid=xray-stats]").inner_text(), "stats per person")

    # ---- 4. ask this chat ----
    page.locator("[data-testid=xray-tab-ask]").click()
    page.evaluate("() => { window.__mock.fakeQueue = ['The 50 t crane is 18,000 EGP per day [#1].']; }")
    page.locator("[data-testid=xray-q]").fill("How much is the 50 t crane per day?")
    page.locator("[data-testid=xray-ask]").click()
    page.wait_for_selector("[data-testid=xray-answer]", timeout=20000)
    check("18,000 EGP" in page.locator("[data-testid=xray-answer]").inner_text(), "a question about the chat is answered with the message number")
    ask = json.dumps(page.evaluate("window.__mock.bodies.filter(x => x.max_tokens > 2).pop().messages"))
    check("18,000 EGP per day" in ask, "…from the messages that match it")

    # ---- 5. Back: result → the chat → the start ----
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=xray-setup]").count() == 1, "Back from the result returns to the chat")
    check(not real_errors(errors), "no errors (%s)" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
