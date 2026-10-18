"""v6.37 Sync over Wi-Fi, end to end in two pages: A shows a code, B connects with it; the test carries the encrypted text
between them (the role of LocalSync.kt); both end with each other's Money entries and missions. A wrong code changes nothing.
Google tab: the passphrase must be long.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v740sync.py
"""
import json, time
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
def ledger(txns): return json.dumps({"currency": "EGP", "accounts": [{"id": "a", "name": "CIB", "currency": "EGP", "start": 1000}], "txns": txns, "budgets": {"overall": 0, "cats": {}}, "recurring": [], "debts": [], "customCats": [], "goals": [], "projects": [], "notes": [], "zakatPayments": [], "zakatHistory": []})
LA = ledger([{"id": "t1", "type": "expense", "amount": 80, "cat": "food", "account": "a", "date": "2026-10-17", "note": "Koshary"}])
LB = ledger([{"id": "t2", "type": "expense", "amount": 600, "cat": "home", "account": "a", "date": "2026-10-17", "note": "Maid"}])
MB = json.dumps({"items": [{"id": "m1", "kind": "save", "title": "save 60k by June", "target": 60000, "deadline": "2027-06-30", "base": {"balance": 0}, "status": "active", "log": []}]})
MOCK = """(() => { const N = window.AttuneNative || (window.AttuneNative = {});
  N.localNetAllowed = () => true;
  N.syncHostStart = () => JSON.stringify({ ok: true, ip: '192.168.1.20', port: 41873 });
  N.syncHostTake = () => { const t = window.__pushedIn || ''; window.__pushedIn = ''; return t; };
  N.syncHostAnswer = (t) => { window.__answer = t; return 'ok'; };
  N.syncHostStop = () => 'ok';
  N.syncExchange = (id, arg) => { window.__pushed = JSON.parse(arg); window.__xid = id; };
})();"""
def init(L, extra=""): return "try{localStorage.setItem('ledger.v3', %s);%s}catch(e){};" % (json.dumps(L), extra) + MOCK
def open_sync(page):
    page.goto(env.url); page.wait_for_timeout(1200)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'home'}}))"); page.wait_for_timeout(300)
    page.locator("[data-testid=header-menu]:visible, [data-testid=home-menu]:visible").first.click()
    page.click("[data-testid=phone-side] [data-testid=side-backup]"); page.wait_for_selector("[data-testid=backup-panel]")
    page.locator("[data-testid=backup-panel] button:has-text('Sync')").first.click(); page.wait_for_selector("[data-testid=sync-panel]")
def carry(A, B, timeout=60):
    end = time.time() + timeout
    while time.time() < end:
        p = B.evaluate("window.__pushed || null")
        if p: break
        time.sleep(0.2)
    A.evaluate("(t) => { window.__pushedIn = t; }", p["body"]); B.evaluate("window.__pushed = null")
    while time.time() < end:
        a = A.evaluate("window.__answer || null")
        if a: break
        time.sleep(0.2)
    A.evaluate("window.__answer = null")
    if a == "ERR": B.evaluate("(id) => window.__attuneNative.reject(id, 'Wrong code — nothing was changed.')", B.evaluate("window.__xid"))
    else: B.evaluate("([id, t]) => window.__attuneNative.resolve(id, JSON.stringify({ text: t }))", [B.evaluate("window.__xid"), a])
with sync_playwright() as p:
    br = p.chromium.launch()
    ca, A = new_page(br, env, errors, legacy_nav=False, extra_init=init(LA))
    cb, B = new_page(br, env, errors, legacy_nav=False, extra_init=init(LB, "localStorage.setItem('attune:missions:v1', %s);" % json.dumps(MB)))
    open_sync(A); open_sync(B)
    # a wrong code first: nothing changes on either side
    A.click("[data-testid=sync-host-start]"); A.wait_for_selector("[data-testid=sync-code]")
    code = A.locator("[data-testid=sync-code]").inner_text().replace(" ", "")
    check(len(code) == 8 and A.locator("[data-testid=sync-addr]").inner_text() == "192.168.1.20:41873", "A shows its address and an 8-character code (%s)" % code)
    B.fill("[data-testid=sync-addr-in]", "192.168.1.20:41873"); B.fill("[data-testid=sync-code-in]", "ZZZZZZZZ" if code != "ZZZZZZZZ" else "YYYYYYYY")
    B.click("[data-testid=sync-connect]"); carry(A, B)
    B.wait_for_selector("[data-testid=sync-err]", timeout=20000)
    check("Wrong code" in B.locator("[data-testid=sync-err]").inner_text() and "Wrong code" in A.locator("[data-testid=sync-err]").inner_text(), "a wrong code: both say so")
    check(len(json.loads(A.evaluate("localStorage.getItem('ledger.v3')"))["txns"]) == 1, "…and nothing changed")
    # the right code
    A.click("[data-testid=sync-host-start]"); A.wait_for_selector("[data-testid=sync-code]")
    code = A.locator("[data-testid=sync-code]").inner_text()
    B.fill("[data-testid=sync-code-in]", code.lower())
    B.click("[data-testid=sync-connect]"); carry(A, B)
    A.wait_for_selector("[data-testid=sync-done]", timeout=30000); B.wait_for_selector("[data-testid=sync-done]", timeout=30000)
    ta = sorted(t["note"] for t in json.loads(A.evaluate("localStorage.getItem('ledger.v3')"))["txns"])
    tb = sorted(t["note"] for t in json.loads(B.evaluate("localStorage.getItem('ledger.v3')"))["txns"])
    check(ta == tb == ["Koshary", "Maid"], "after one sync both have both Money entries: %s / %s" % (ta, tb))
    check(A.evaluate("JSON.parse(localStorage.getItem('attune:missions:v1')||'{\"items\":[]}').items.length") == 1, "…and B's mission is on A")
    ca.close(); cb.close()
    # Google: the passphrase must be long
    cc, C = new_page(br, env, errors, legacy_nav=False, extra_init=init(LA)); open_sync(C)
    C.click("[data-testid=sync-way-google]"); C.fill("[data-testid=sync-pass]", "short"); C.click("[data-testid=sync-pass-save]")
    check("at least 10" in C.locator("[data-testid=sync-err]").inner_text(), "Google: a short passphrase is refused")
    C.fill("[data-testid=sync-pass]", "my crane yard 2026"); C.click("[data-testid=sync-pass-save]")
    check(C.locator("[data-testid=sync-pass-set]").count() == 1, "…a long one is kept on this device")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
