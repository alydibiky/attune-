"""v9.9.23 B5 P2 "before you meet" (Ali picked B: three lines in the notification): saving the reminder "Meeting Sheikh" for tomorrow
16:00 also puts on the phone, for 15:00, "In 1 hour: Meeting Sheikh · 16:00" with what is still open with him — he owes 14,625
(2 of 8 paid), the price list you promised, the latest note — never the 300 he already paid back. "Call Ahmed" with two Ahmeds sends
nothing. Opening the app keeps it (the first sync doesn't drop it). Arabic text too.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v9923p2.py
"""
import json, time, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
DIR = {"v": 1, "skip": [], "items": [{"id": "s", "kind": "person", "name": "Sheikh Mahmoud", "aliases": ["Sheikh"], "role": ""},
  {"id": "a", "kind": "person", "name": "Ahmed Samir", "aliases": [], "role": ""}, {"id": "b", "kind": "person", "name": "Ahmed Kamal", "aliases": [], "role": ""}]}
LIFE = {"items": [{"id": "i1", "kind": "installment", "person": "Sheikh", "dir": "in", "amount": 2437.5, "total": 19500, "count": 8, "start": "2026-09-01", "paid": [0, 1], "created": 1},
  {"id": "i2", "kind": "debt", "person": "Sheikh", "dir": "in", "amount": 300, "total": 300, "count": 1, "start": "2026-08-01", "paid": [0], "created": 2},
  {"id": "i3", "kind": "person", "person": "Sheikh", "title": "send him the price list", "count": 1, "start": "2026-11-02", "created": 3}]}
REC = [{"id": "n1", "kind": "note", "title": "Sheikh's son got married last week", "text": "", "ts": int(time.time() * 1000) - 86400000, "tags": [], "meta": {}}]
tom = datetime.datetime.now().replace(hour=16, minute=0, second=0, microsecond=0) + datetime.timedelta(days=1)
AT = int(tom.timestamp() * 1000)
def init(extra=""):
    S = {"attune:people:v1": DIR, "attune:life:v1": LIFE, "attune:memory:v1": REC}
    return ("try { var S=%s; for (var k in S) localStorage.setItem(k, JSON.stringify(S[k])); localStorage.setItem('attune:start','home'); localStorage.setItem('attune:people:seeded','1'); %s } catch (e) {}\n"
            "window.__sched = []; window.__unsched = []; (() => { const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0);"
            " N.schedule = (j) => { window.__sched.push(JSON.parse(j)); return true; }; N.unschedule = (id) => { window.__unsched.push(id); return true; };"
            " N.scheduled = () => JSON.stringify(window.__sched.map(x => ({ id: x.id }))); }; go(); })();") % (json.dumps(S), extra)
def meets(page): return page.evaluate("window.__sched.filter(x => x.id.startsWith('meet-'))")
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=init())
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.evaluate("r => window.__attuneAddReminder(r)", {"id": "r1", "at": AT, "title": "Meeting Sheikh", "body": "", "repeat": "none", "created": 1, "done": False})
    page.wait_for_timeout(300); m = meets(page)
    n = m[-1] if m else {}
    check(len(m) >= 1 and n.get("id") == "meet-r1" and n.get("at") == AT - 3600000, "Meeting Sheikh tomorrow 16:00 → a notification at 15:00")
    check(n.get("title") == "In 1 hour: Meeting Sheikh · 16:00", "its title: %s" % n.get("title"))
    body = n.get("body", "")
    check("Owes you 14,625 (2 of 8 paid)" in body and "Open: send him the price list" in body and "married" in body, "three lines: %s" % body.replace("\n", " | "))
    check("300" not in body, "…never the 300 he already paid back")
    page.evaluate("r => window.__attuneAddReminder(r)", {"id": "r2", "at": AT, "title": "Call Ahmed", "body": "", "repeat": "none", "created": 2, "done": False})
    page.wait_for_timeout(300)
    check(not any(x["id"] == "meet-r2" for x in meets(page)), "\"Call Ahmed\" (two Ahmeds) → no before-you-meet note")
    # reopening the app keeps it: the first sync schedules it again and doesn't drop it
    page.evaluate("window.__sched = []; window.__unsched = []"); page.reload(); page.wait_for_selector("[data-testid=phone-home]", timeout=15000); page.wait_for_timeout(800)
    check(any(x["id"] == "meet-r1" for x in meets(page)) and "meet-r1" not in page.evaluate("window.__unsched"), "after reopening the app it's still scheduled")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    ctx.close(); ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=init("localStorage.setItem('attune:ui:lang','ar');"))
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.evaluate("r => window.__attuneAddReminder(r)", {"id": "r3", "at": AT, "title": "اقابل Sheikh", "body": "", "repeat": "none", "created": 3, "done": False})
    page.wait_for_timeout(300); n = (meets(page) or [{}])[-1]
    check("كمان ساعة" in n.get("title", "") and "ليك عنده 14,625 (اتدفع 2 من 8)" in n.get("body", ""), "Arabic: %s / %s" % (n.get("title"), n.get("body", "").replace("\n", " | ")))
    br.close()
env.close(); finish()
