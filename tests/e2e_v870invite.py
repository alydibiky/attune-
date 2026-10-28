"""v8.7 (Ali: a month free for each friend who subscribes through your link, max 3 — linked to a Google account): the invite card
on the plan page, with a pretend invite server and a pretend Google sign-in.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v870invite.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
INIT = """
localStorage.setItem('attune:invite-server', 'https://invite.test/referral');
const N = window.AttuneNative; N.googleAccount = (id) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ token: 'g-token' })), 20);
window.__inviteCalls = [];
const _f = window.fetch;
window.fetch = async (url, o) => {
  if (String(url).startsWith('https://invite.test/')) { const b = JSON.parse(o.body); window.__inviteCalls.push(b);
    return new Response(JSON.stringify(b.op === 'redeem' ? { days: 30 } : { code: 'ABCD2345', friends: 2, max: 3, days: 30, acct: 'h1' }), { status: 200, headers: { 'Content-Type': 'application/json' } }); }
  return _f(url, o);
};
"""
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("nav button").last.click(); page.wait_for_timeout(300)
    page.locator("text=Pro trial").first.click(); page.wait_for_selector("[data-testid=upgrade]", timeout=5000)
    page.locator("[data-testid=referral-start]").scroll_into_view_if_needed()
    check("Invite friends" in page.locator("[data-testid=referral-start]").inner_text(), "with the invite server on: 'Invite friends — a month free for each who subscribes (up to 3)'")
    page.click("[data-testid=referral-start]")
    page.wait_for_selector("[data-testid=referral-card]", timeout=5000)
    check("2 of 3 friends joined" in page.locator("[data-testid=referral-count]").inner_text(), "after Google sign-in: 2 of 3 friends joined")
    calls = page.evaluate("window.__inviteCalls")
    check(calls and calls[0]["op"] == "hello" and calls[0]["token"] == "g-token", "the app sends only Google's token to the server (%s)" % calls[:1])
    page.click("[data-testid=referral-redeem]"); page.wait_for_timeout(400)
    until = page.evaluate("+localStorage.getItem('attune:pro-bonus-until') || 0")
    now = page.evaluate("Date.now()")
    check(until > now + 29 * 864e5, "Use my 30 free days → 30 days of Pro on this phone")
    check(page.locator("[data-testid=referral-redeem]").count() == 0, "…and the button goes")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
finish()
