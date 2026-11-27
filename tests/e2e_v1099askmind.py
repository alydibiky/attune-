"""v10.9.9 (Ali's screenshots, 26 Nov 2026), at a phone (390) and a computer (1366), in the Glass look:
  1. the Chat message box is SOLID — the last answer's buttons showed through it while typing
  2. Chat answers "tell me about my barber" from the real note, never from his own past questions
     ("From your Mind: Tell me about my barber · Who won the last champions league final"), and the line under it says "your data"
  3. "when is the last time I went to the barber?" never says "today — Last time I went to the barber" (his question read as a visit)
  4. after an answer the page is at the bottom: the answer's buttons are not under the message box
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v1099askmind.py
"""
import json, time
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
now = int(time.time() * 1000); D = 86400000
MEM = [{"id": "n1", "kind": "note", "title": "that in the barber I go to hany rabee3 I cut with 1.ahmed me8awry , 2", "text": "that in the barber I go to hany rabee3 I cut with 1.ahmed me8awry , 2.ahmed sheraton 3.ibrahim hassan", "output": "", "tags": [], "ts": now - 3 * D},
       {"id": "c1", "kind": "chat", "title": "Tell me about my barber", "text": "Tell me about my barber", "output": "Your barber is Hany Rabee3.", "tags": ["chat"], "ts": now - 600000},
       {"id": "c2", "kind": "chat", "title": "Who won the last champions league final", "text": "Who won the last champions league final", "output": "…", "tags": ["chat"], "ts": now - 900000},
       {"id": "c3", "kind": "chat", "title": "Last time I went to the barber", "text": "Last time I went to the barber", "output": "…", "tags": ["chat"], "ts": now - 60000}]
def init():
    return ("try{localStorage.setItem('attune:start','chat');localStorage.setItem('attune:onboarded','1');localStorage.setItem('attune:coach:v1',JSON.stringify({seen:['*']}));"
            "localStorage.setItem('attune:theme:v1',JSON.stringify({accent:'burgundy',bg:'light',look:'glass'}));"
            "const k=Object.keys(localStorage).find(x=>/^attune:memory:v\\d+$/.test(x))||'attune:memory:v1';"
            "if(!sessionStorage.getItem('t-mem')){sessionStorage.setItem('t-mem','1');localStorage.setItem(k,%s);}}catch(e){}\n"
            "(() => { function w(){ const N = window.AttuneNative; if (!N || !window.__mock) return setTimeout(w, 5);"
            " window.__mock.engine = { ...window.__mock.engine, state: 'ready', modelId: 'test-model' };"
            " window.dispatchEvent(new CustomEvent('attune-engine', { detail: { ...window.__mock.engine } })); } w(); })();" % json.dumps(json.dumps(MEM)))
def ask(page, text, queue=None, wait=2800):
    page.evaluate("(q) => { window.__mock.bodies = []; window.__mock.fakeQueue = q || []; }", queue)
    page.locator("textarea[placeholder='Message Attune']").fill(text); page.locator("button[title='Send']").click()
    page.wait_for_timeout(wait)
    return page.evaluate("window.__mock.bodies.filter(x => x.max_tokens > 8)")
with sync_playwright() as p:
    br = p.chromium.launch()
    for w in (390, 1366):
        ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=init(), desktop=(w, 860) if w > 500 else None)
        if w <= 500: page.set_viewport_size({"width": w, "height": 860})
        page.goto(env.url); page.wait_for_timeout(1500)
        page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'chat'}}))"); page.wait_for_timeout(800)
        page.evaluate("document.documentElement.classList.add('att-glass')")
        comp = page.locator("[data-testid=composer]").first
        ground = page.evaluate("() => { const e = document.querySelector('[data-testid=composer] .rounded-\\\\[20px\\\\]'); return e ? getComputedStyle(e).backgroundColor : 'missing'; }")
        check(ground != "missing" and "rgba" not in ground, "%d: the message box is solid in Glass (%s)" % (w, ground))
        page.wait_for_selector("textarea[placeholder='Message Attune']", timeout=15000)
        # 2: "tell me about my barber" — the model is given the real note, never his past questions; the line says where it came from
        b = ask(page, "tell me about my barber", ["Your barber is Hany Rabee3."])
        body = page.evaluate("document.body.innerText")
        after = body.split("tell me about my barber", 1)[-1]
        mine = page.locator("[data-testid=from-mine]").all_inner_texts()
        sent = json.dumps(b, ensure_ascii=False)
        # (answered by code from the note — or, if it reaches the model, the model gets the note and the line says so)
        check("hany rabee3" in after.lower() and "champions" not in after and "Tell me about my barber" not in after and "champions" not in sent,
              "%d: the barber answer comes from the note only — never his past questions" % w)
        check(not b or ("From: your data" in body and mine and "Tell me about" not in mine[-1]), "%d: a model answer from Mind says 'From: your data'" % w)
        # 3 + 4: "when is the last time I went to the barber?" — never his own question read back as a visit "today"
        ask(page, "when is the last time I went to the barber?", ["No visit to the barber is saved yet."])
        body = page.evaluate("document.body.innerText")
        check(body.count("when is the last time I went to the barber?") >= 1, "%d: the question was sent" % w)
        check("Last time I went to the barber." not in body and "(today) — Last" not in body, "%d: no 'today — Last time I went to the barber' from his own question" % w)
        gap = page.evaluate("document.documentElement.scrollHeight - window.scrollY - window.innerHeight")
        check(gap < 60, "%d: after the answer the page is at the bottom (gap %s px)" % (w, gap))
        # A4 (Ali picked: the first word sooner): tapping the box pre-reads the rules (1 token, quiet); the rules are the SAME for an
        #   English, an Arabic and a French question (the language line goes with the question), so the engine keeps them read
        page.evaluate("() => { window.__mock.bodies = []; }")
        page.locator("textarea[placeholder='Message Attune']").click(); page.wait_for_timeout(800)
        warm = page.evaluate("window.__mock.bodies.filter(x => x.max_tokens === 1)")
        check(len(warm) == 1 and warm[0]["messages"][0]["role"] == "system", "%d: tapping the box pre-reads the rules once (1 token)" % w)
        page.locator("textarea[placeholder='Message Attune']").click(); page.wait_for_timeout(400)
        check(len(page.evaluate("window.__mock.bodies.filter(x => x.max_tokens === 1)")) == 1, "%d: …not again for the same chat" % w)
        systems = []
        for q in ("what is the capital of australia?", "يعني ايه تضخم؟", "quelle est la capitale du Japon ?"):
            b = ask(page, q, ["**Fine.**"], wait=2200)
            systems.append(b[-1]["messages"][0]["content"] if b else "")
        check(all(systems) and systems[0] == systems[1] == systems[2] and systems[0] == warm[0]["messages"][0]["content"], "%d: the rules are the same for every question and the pre-read (kept by the engine)" % w)
        check("Photo of a machine" not in systems[0], "%d: the photo rule is not read when there is no photo" % w)
        # 5 (Ali, 26 Nov: "it should look on notes, money, everything — I saved it as a note in Money"): a Money entry that says only
        #   "hany rabee3" (his note says that is his barber) answers "the last time" — and the bare follow-up takes "barber" from before
        page.evaluate("""() => { const d = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
          localStorage.setItem('ledger.v3', JSON.stringify({ currency: 'EGP', accounts: [{ id: 'a1', name: 'Cash', currency: 'EGP' }], recurring: [], customCats: [],
            txns: [{ id: 'h1', type: 'expense', amount: 150, cat: 'other', note: 'hany rabee3', date: d, account: 'a1' }] })); }""")
        for q in ("when is the last time I went to the barber?", "اخر مرة روحت الحلاق امتى؟"):
            ask(page, q, ["(the model should not be asked)"])
            body = page.evaluate("document.body.innerText"); after = body.split(q)[-1]
            check("6 days ago" in after or "منذ 6 يوم" in after or "6 يوم" in after, "%d: «%s» → the Money entry 'hany rabee3', 6 days ago" % (w, q))
        ask(page, "tell me about my barber", ["Your barber is Hany Rabee3."])
        ask(page, "When is the last time I went", ["(the model should not be asked)"])
        after = page.evaluate("document.body.innerText").split("When is the last time I went")[-1]
        check("6 days ago" in after, "%d: the bare follow-up 'When is the last time I went' → 6 days ago" % w)
        ctx.close()
    br.close()
check(not real_errors(errors), "no page errors")
env.close(); finish()
