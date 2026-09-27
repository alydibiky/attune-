"""v5.28 — nothing is ever sent bigger than the model's window (the fast engine wrote
garbage when it overflowed: "since 205", "[111]", "1,2,48 Nm"); research notes are cut to fit.

  python3 tests/e2e_v528.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish, HERE

env = Env(); errors = []

FILLER = "\\n".join("Row %d | Lynk & Co 900 trim note %d | 845 hp | 1,200 Nm | CNY 369,900 | range 1,400 km" % (i, i) for i in range(120))
SEARCH = """(() => { const N = window.AttuneNative, S = window.__mock;
  N.search = (id, arg) => { const a = JSON.parse(arg); (S.searchLog = S.searchLog || []).push(a);
    const hits = Array.from({ length: 8 }, (_, i) => ({ title: "Lynk & Co 900 review " + (i + 1) + " " + a.q.length, url: "https://site" + i + ".com/" + encodeURIComponent(a.q).slice(0, 20), text: "## Specs\\n" + "%s" }));
    setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ via: "duckduckgo", why: "", hits })), 20); };
})();""" % FILLER

def send(page, text):
    page.locator("textarea[placeholder='Message Attune']").fill(text)
    page.locator("button[title='Send']").first.click()

def est(msgs):
    n = 0
    for m in msgs:
        c = m["content"]
        n += len(c if isinstance(c, str) else json.dumps(c)) / 3.4
    return n

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)
    # a phone under 8 GB: the fast engine runs with a 4,096-token window
    # (the fake phone itself reports the 4k window too — the app also asks it every second)
    page.evaluate("() => { const N = window.AttuneNative, e0 = N.engine; N.engine = () => { const c = JSON.parse(e0()); return JSON.stringify({ ...c, settings: 'context 4096 · weights in RAM' }); }; window.dispatchEvent(new CustomEvent('attune-engine', { detail: JSON.parse(N.engine()) })); }")
    page.wait_for_timeout(500)

    page.evaluate(SEARCH)
    page.locator("button:has-text('Web')").first.click()
    NOTE = "\\n".join("- Lynk & Co 900 trim %d: 845 hp; 1,200 Nm; CNY 369,900; range 1,400 km" % i for i in range(30))
    page.evaluate("() => { const M = window.__mock; M.fakeQueue = ['**Lynk & Co 900** [1]', '**Lynk & Co 900**: the trims are listed by the maker [1]']; M.bodies = []; }")
    send(page, "Lynk & Co 900 all trims with hp, torque, price and range")
    page.wait_for_selector("button[title='Regenerate']", timeout=120000)
    bs = page.evaluate("window.__mock.bodies.filter(x => x.max_tokens > 2)")
    over = [(round(est(b["messages"])), b["max_tokens"]) for b in bs if est(b["messages"]) + b["max_tokens"] > 4096 * 1.08]
    check(len(bs) >= 1 and not over, "with a 4k window, no request (%d of them) is bigger than the window%s" % (len(bs), (": " + str(over[:3])) if over else ""))
    final = bs[-1]
    fin = str(final["messages"][-1]["content"])
    check("PASSAGES" in fin and len(fin) < 4096 * 3.4, "the answer is written from the passages that fit the window (%d characters)" % len(fin))
    check("Lynk & Co 900" in page.locator(".att-md").last.inner_text(), "the answer arrives")

    page.locator("button:has-text('Web')").first.click()   # web off

    # ---- 2. the flurbs puzzle: a tool_code reply is rewritten in words ----
    FLURBS = "All flurbs are either glips or morps, but never both. Exactly 40% of flurbs are glips. All morps can fly. No glip can breathe underwater. Only creatures that can breathe underwater are immortal. Can an immortal flurb exist? What percentage of flurbs cannot fly? Show your deduction step-by-step before answering."
    page.locator("button:has-text('Think')").first.click()   # Think on, like on Ali's phone
    page.evaluate("() => { const M = window.__mock; M.fakeQueue = ['```tool_code\\nprint(default_api.solve(glips=0.4))\\n```', '**No — an immortal flurb cannot exist.**\\n1. Every flurb is a glip or a morp.\\n2. Glips cannot breathe underwater, so they are not immortal.\\n3. Morps fly; glips do not.\\n**40% of flurbs cannot fly.**']; M.bodies = []; }")
    send(page, FLURBS)
    page.wait_for_function("() => document.querySelectorAll(\"button[title='Regenerate']\").length >= 2", timeout=60000)
    page.wait_for_timeout(300)
    t = page.locator(".att-md").last.inner_text()
    check("40% of flurbs cannot fly" in t and "tool_code" not in t and "default_api" not in t, "a function / tool_code reply is replaced by a worded answer")
    bs = page.evaluate("window.__mock.bodies.filter(x => x.max_tokens > 2)")
    check("Never answer with a function" in str(bs[0]["messages"][0]["content"]), "every model is told not to answer with a function")
    check(not any("You check word problems by computing them" in str(b["messages"][0]["content"]) for b in bs), "the puzzle doesn't go to the maths program")

    # ---- 3. deleting a chat asks first ----
    page.locator("header button").first.click(); page.wait_for_timeout(300)
    n0 = page.locator("[data-testid=chat-del]").count()
    page.locator("[data-testid=chat-del]").first.click()
    check(page.locator("[data-testid=chat-del-confirm]").count() == 1, "tapping delete on a chat asks 'Delete this chat?' first")
    page.click("[data-testid=chat-del-no]")
    check(page.locator("[data-testid=chat-del]").count() == n0, "…Cancel keeps it")
    page.locator("[data-testid=chat-del]").first.click(); page.click("[data-testid=chat-del-yes]")
    check(page.locator("[data-testid=chat-del]").count() == n0 - 1, "…Delete removes it")
    page.keyboard.press("Escape"); page.evaluate("window.__attuneBack && window.__attuneBack()"); page.wait_for_timeout(200)

    # ---- 4. the shared 'Are you sure?' dialog ----
    src = open(HERE + "/../web-src/confirm.jsx", encoding="utf-8").read()
    uses = sum(open(HERE + "/../web-src/" + f, encoding="utf-8").read().count("askConfirm(") for f in ["actions-ui.jsx", "code-ui.jsx", "crane-ui.jsx", "spaces-ui.jsx", "studio-ui.jsx", "attune.jsx"])
    check("This can't be undone." in src and uses >= 8, "reminders, places, projects, cranes, pictures, corrections and actions all ask before deleting (%d places)" % uses)

    errs = real_errors(errors)
    check(not errs, "no JavaScript errors (%d)%s" % (len(errs), (": " + errs[0]) if errs else ""))
    ctx.close(); br.close()
env.close()
finish()
