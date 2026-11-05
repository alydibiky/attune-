"""v9.4 the new agents (Ali, 5 Nov 2026: "G1 ok but schedule a message — send this contact this message at 5 pm tomorrow and it does that;
G2–G7 ok. Easy, interactive, visually appealing, smooth and consistent across all agents; global").
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v940agents.py
"""
import json, datetime, os
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
NOW = datetime.datetime(2026, 11, 5, 13, 0, 0)
ms = lambda d: int(d.timestamp() * 1000)
H = 3600000
INBOX = [{"key": "com.whatsapp|p:Ahmed", "app": "whatsapp", "pkg": "com.whatsapp", "who": "Ahmed", "convo": "", "group": False, "text": "can we meet tomorrow at 5?", "ts": ms(NOW) - 4 * H, "canReply": True, "seen": False},
         {"key": "com.whatsapp|p:Mama", "app": "whatsapp", "pkg": "com.whatsapp", "who": "Mama", "convo": "", "group": False, "text": "هتيجي على الغدا الجمعة؟", "ts": ms(NOW) - 6 * H, "canReply": True, "seen": False},
         {"key": "com.whatsapp|p:Omar", "app": "whatsapp", "pkg": "com.whatsapp", "who": "Omar", "convo": "", "group": False, "text": "ok", "ts": ms(NOW) - 5 * H, "canReply": True, "seen": True},
         {"key": "com.whatsapp|g:Work", "app": "whatsapp", "pkg": "com.whatsapp", "who": "Sara", "convo": "Work", "group": True, "text": "meeting moved", "ts": ms(NOW) - 5 * H, "canReply": True, "seen": False}]
TX = [{"id": "w%d" % i, "type": "expense", "amount": 96, "account": "b", "cat": "food", "date": (NOW - datetime.timedelta(days=9 * (4 - i) + 7)).strftime("%Y-%m-%d"), "note": "Water 6x1.5L"} for i in range(4)]
L = {"currency": "EGP", "accounts": [{"id": "b", "name": "Cash", "currency": "EGP", "start": 5000}], "txns": TX, "budgets": {"overall": 0, "cats": {}}, "recurring": [], "debts": [], "customCats": [], "goals": [], "projects": [], "notes": [], "zakatHistory": [], "zakatPayments": []}
MOCK = """(() => { window.__w = { sched: [], replies: [], opened: [] }; function w(){ const N = window.AttuneNative; if (!N) return setTimeout(w, 5);
  N.chatInbox = () => %s; N.chatReply = (j) => { window.__w.replies.push(JSON.parse(j)); return JSON.stringify({ ok: true }); };
  N.schedule = (j) => { window.__w.sched.push(JSON.parse(j)); return JSON.stringify({ ok: true }); }; N.unschedule = () => true; N.scheduled = () => "[]"; N.sendLog = () => "[]";
  N.recallNotes = () => JSON.stringify([{ id: "n1", pkg: "com.egyptair", app: "EgyptAir", title: "MS 753 Cairo - Madrid", text: "Gate changed to F4. Boarding at 10:10", ts: Date.now() - 600000 }]);
  N.openInApp = (u) => { window.__w.opened.push(u); return JSON.stringify({ ok: true, how: 'app' }); }; } w(); })();""" % json.dumps(json.dumps(INBOX))
def ag(**k): base = {"on": True, "created": ms(NOW) - H, "checks": []}; base.update(k); return base
AGENTS = {"usual": {}, "agents": [
  ag(id="r1", kind="reply", title="Reply helper", hours=3),
  ag(id="s1", kind="slot", title="Visa appointments · ES", url="https://visa.vfsglobal.com/egy/en/esp/", site="VFS Global", sites=[{"name": "VFS Global", "url": "https://visa.vfsglobal.com/egy/en/esp/"}, {"name": "BLS International", "url": "https://www.blsinternational.com/"}], dest="ES", every=30,
     slot={"state": "open", "dates": ["2026-12-15", "2026-12-17"], "at": ms(NOW) - 120000}),
  ag(id="p1", kind="protect", title="AirPods Pro 2", what="AirPods Pro 2", paid=9450, site="Amazon", days=15, bought=ms(NOW) - 2 * 864e5, currency="EGP", tries=[{"site": "Amazon", "url": "https://www.amazon.eg/s?k=AirPods+Pro+2"}], url="https://www.amazon.eg/s?k=AirPods+Pro+2",
     checks=[{"at": ms(NOW) - H, "price": 8700, "how": "auto"}]),
  ag(id="c1", kind="clinic", title="Dermatologist · Nasr City", spec="dermatologist", city="Nasr City", below=500, tries=[{"site": "Vezeeta", "url": "https://www.vezeeta.com/en/doctor/dermatology/nasr-city"}, {"site": "Google Maps", "url": "https://www.google.com/maps/search/dermatologist%20in%20Nasr%20City"}]),
  ag(id="t1", kind="trip", title="Flight MS 753 · Madrid", flight="MS 753", at=ms(NOW + datetime.timedelta(hours=21, minutes=40)), to="MAD", toName="Madrid", intl=True, drive=60),
  ag(id="k1", kind="restock", title="Restock")]}
INIT = "try{localStorage.setItem('attune:start','home');localStorage.setItem('ledger.v3', %s);localStorage.setItem('attune:agents:v1', %s)}catch(e){}" % (json.dumps(json.dumps(L)), json.dumps(json.dumps(AGENTS)))
def agents(page): return {a["id"]: a for a in json.loads(page.evaluate("localStorage.getItem('attune:agents:v1')"))["agents"]}
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + ";" + MOCK)
    ctx.clock.set_fixed_time(NOW)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_timeout(1200)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'agents'}}))"); page.wait_for_selector("[data-testid=agent-reply]", timeout=10000); page.wait_for_timeout(600)
    # one shape for every card
    kinds = ["agent-reply", "agent-slot", "agent-protect", "agent-clinic", "agent-trip", "agent-restock"]
    check(all(page.locator("[data-testid=%s] [data-testid=agent-head]" % k).count() == 1 and page.locator("[data-testid=%s] [data-testid=agent-status]" % k).count() == 1 for k in kinds),
          "every new agent has the same header (icon or logo · name · what it's doing · status · ⋯)")
    check(all(page.locator("[data-testid=%s] [data-testid=agent-actions]" % k).count() >= 1 for k in kinds), "…and the same button row")
    os.makedirs("/tmp/claude-0/-home-user-attune-/23c15897-d4f2-517f-8cbd-925167b9b4b6/scratchpad/g", exist_ok=True)
    page.screenshot(path="/tmp/claude-0/-home-user-attune-/23c15897-d4f2-517f-8cbd-925167b9b4b6/scratchpad/g/agents-full.png", full_page=True)
    # G1 reply helper
    rows = page.locator("[data-testid=agent-reply] [data-testid=reply-row]")
    check(rows.count() == 2 and "Mama" in rows.first.inner_text() and "Ahmed" in rows.nth(1).inner_text(), "Reply helper: Mama and Ahmed are waiting (oldest first) — not Omar (already read) and not the Work group")
    rows.nth(1).locator("[data-testid=reply-open]").click(); page.locator("[data-testid=reply-quick]").nth(2).click(); page.click("[data-testid=reply-send]"); page.wait_for_timeout(300)
    rep = page.evaluate("window.__w.replies")
    check(len(rep) == 1 and rep[0]["key"] == "com.whatsapp|p:Ahmed" and rep[0]["text"] == "Yes 👍", "…a quick reply goes into exactly Ahmed's chat through its own Reply")
    # scheduled message — from a sentence
    page.fill("[data-testid=agents-input]", "send Ahmed 'I'm running late' at 5 pm tomorrow"); page.click("[data-testid=agents-go]"); page.wait_for_timeout(600)
    sch = page.evaluate("window.__w.sched")
    m = [x for x in sch if str(x.get("id", "")).startswith("msg-")]
    check(len(m) == 1 and m[0]["send"]["text"] == "I'm running late" and m[0]["send"]["key"] == "com.whatsapp|p:Ahmed" and datetime.datetime.fromtimestamp(m[0]["at"] / 1000).hour == 17,
          "“send Ahmed 'I'm running late' at 5 pm tomorrow” → scheduled on the phone for 17:00 tomorrow, into Ahmed's chat")
    check(page.locator("[data-testid=agent-send]").count() == 1 and "running late" in page.inner_text("[data-testid=agent-send]"), "…its card shows who, what and when")
    # the form, from the gallery
    page.click("[data-testid=agents-chip-send]"); page.wait_for_selector("[data-testid=schedule-form]")
    page.fill("[data-testid=schedule-who]", "Mama"); page.fill("[data-testid=schedule-text]", "Happy birthday 🎂")
    page.fill("[data-testid=schedule-at]", "2026-11-06T09:00"); page.click("[data-testid=schedule-go]"); page.wait_for_timeout(500)
    m2 = [x for x in page.evaluate("window.__w.sched") if str(x.get("id", "")).startswith("msg-") and x["send"]["who"] == "Mama"]
    check(len(m2) == 1 and datetime.datetime.fromtimestamp(m2[0]["at"] / 1000).hour == 9, "Schedule a message (the form): Mama, tomorrow 9:00")
    # G2 visa
    check(page.locator("[data-testid=slot-state][data-state=open]").count() == 1 and "15" in page.inner_text("[data-testid=slot-state]"), "Visa appointments: a date is showing (15 Dec), in green")
    page.locator("[data-testid=slot-every]").first.click(); page.wait_for_timeout(200)
    check(agents(page)["s1"]["every"] == 15, "…check every 15 min (one tap)")
    # G4 price protection
    check(page.locator("[data-testid=protect-drop]").count() == 1 and "750" in page.inner_text("[data-testid=protect-drop]"), "Price protection: paid 9,450, today 8,700 → 750 back possible")
    # G5 clinic
    page.locator("[data-testid=clinic-site]").first.click(); page.wait_for_timeout(200)
    check("vezeeta.com/en/doctor/dermatology/nasr-city" in (page.evaluate("window.__w.opened") or [""])[-1], "Find a doctor: Vezeeta opens already searched (dermatology, Nasr City)")
    # G6 travel day
    tp = page.inner_text("[data-testid=agent-trip]")
    check("F4" in page.inner_text("[data-testid=trip-gate]") and "Leave home by" in tp, "Travel day: the gate from EgyptAir's notification (F4) and when to leave")
    page.click("[data-testid=trip-remind]"); page.wait_for_timeout(300)
    rem = json.loads(page.evaluate("localStorage.getItem('attune:reminders:v1') || '[]'"))
    check(any(r["id"] == "trip-go-t1" for r in rem) and not any(r["id"] == "trip-ci-t1" for r in rem), "…Remind me on the day → a leave-now reminder (check-in is already open, so no reminder for it)")
    # G3 restock
    rr = page.locator("[data-testid=restock-row]")
    rt = rr.first.inner_text().replace("\u2066", "").replace("\u2069", "") if rr.count() else ""
    check(rr.count() == 1 and "Water" in rt and "every 9 days" in rt, "Restock: water, bought every 9 days, is running low")
    # G7 autonomy as a rule
    page.locator("[data-testid=agent-protect] [data-testid=agent-menu]").click(); page.locator("[data-testid=agent-protect] [data-testid=agent-rules-open]").click()
    page.locator("[data-testid=agent-protect] [data-testid=agent-rule-input]").fill("only tell me"); page.locator("[data-testid=agent-protect] [data-testid=agent-rule-go]").click(); page.wait_for_timeout(300)
    check(agents(page)["p1"].get("rules", {}).get("autonomy") == "notify" and "Only tell me" in page.inner_text("[data-testid=agent-protect]"), "How much it may do: “only tell me” is a rule like any other")
    # gallery
    page.click("[data-testid=agents-more-starters]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid^=agents-chip-]").count() >= 15, "the starters: the six most used, then all of them under More agents")
    errs = real_errors(errors)
    check(not errs, "no page errors: %s" % errs[:3])
env.close()
finish()
