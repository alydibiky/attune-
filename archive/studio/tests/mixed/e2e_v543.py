"""v5.43 — the website that didn't finish is finished; Studio sharpens in a second without the graphics
chip (and says how long ×4 really takes); Deal Check asks "Do you mean…?" and reads the offer again
with the buyer's explanation.

  python3 tests/e2e_v543.py
"""
import os, re, json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish, HERE

env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
STUDIO = re.search(r'MOCK = r"""(.*?)"""', open(os.path.join(HERE, "e2e_v59.py"), encoding="utf-8").read(), re.S).group(1)
EXTRA = r"""(() => { const S = window.__mock = window.__mock || {};
  const go = () => { const N = window.AttuneNative; if (!N || !N.upscaleImage) return setTimeout(go, 0);
    S.img.packs = [{ id: "turbo", label: "Studio Turbo", kind: "turbo", files: {} }, { id: "esrgan-x4", label: "Sharpen", kind: "upscale", files: {} }];
    N.imageList = () => JSON.stringify(S.folder || []);
    N.sharpenFast = (id, arg) => { const a = JSON.parse(arg); S.imgCalls.push(["fast", a]);
      setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ ok: true, file: a.file.replace(".png", "-x2.png"), url: "data:image/png;base64,iVBORw0KGgo=", width: 1024, height: 1024, ms: 400, backend: "fast" })), 20); };
  }; go(); })();"""

def shot(page, name):
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, name + ".png"))

def queue(page, answers):
    page.evaluate("(a) => { const M = window.__mock; M.bodies = []; M.fakeQueue = a; }", answers)

def sent(page):
    return page.evaluate("window.__mock.bodies.filter(b => b.max_tokens > 2)")

def open_tool(page, name, testid):
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(f".rounded-t-2xl button:has-text('{name}')").first.click()
    page.wait_for_selector(f"[data-testid={testid}]", timeout=6000)

FULL = ('<!DOCTYPE html><html><head><meta charset="utf-8"><title>HeavyLift Crane Rentals</title><style>body{font-family:sans-serif;margin:0}.card{padding:12px}</style></head>'
        '<body><header><h1>HeavyLift Crane Rentals</h1></header><section id="services"><div class="card">Mobile crane rental</div><div class="card">Tower crane rental</div></section>'
        '<section id="fleet"><div class="card">Liebherr LTM 1100</div></section><form id="contact"><input name="name"><button>Send</button></form><footer>HeavyLift 2026</footer></body></html>')

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=STUDIO + "\n" + EXTRA)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(250)

    # ---- the website: cut off by the answer limit → the rest is asked for ----
    cut = 260
    queue(page, ["```html\n" + FULL[:cut], FULL[cut:]] + ["ok"] * 3)
    page.locator("textarea[placeholder='Message Attune']").fill("Make a landing page website for HeavyLift Crane Rentals with services, fleet and a contact form")
    page.locator("button[title='Send']").first.click()
    page.wait_for_selector("text=Preview", timeout=30000); page.wait_for_timeout(500)
    bodies = sent(page)
    cont = [b for b in bodies if "Output ONLY the rest" in json.dumps(b["messages"])]
    check(len(cont) == 1, "the cut page was continued (1 more call, %d calls in all)" % len(bodies))
    txt = page.locator("main").inner_text() if page.locator("main").count() else page.inner_text("body")
    check("</html>" in page.content() or "HeavyLift 2026" in page.content(), "the finished page reaches its end (footer and </html>)")
    shot(page, "web-continued")

    # ---- Studio without the graphics chip: HD is the instant ×2; ×4 says how long it takes ----
    page.evaluate("() => { window.__mock.img.cpuOnly = true; }")
    open_tool(page, "Studio", "studio-page")
    page.fill("[data-testid=studio-idea]", "a crane at sunset")
    page.locator("[data-testid=studio-go]").first.click()
    page.wait_for_selector("[data-testid=studio-result]", timeout=15000); page.wait_for_timeout(600)
    calls = [c[0] for c in page.evaluate("window.__mock.imgCalls")]
    check("fast" in calls and "upscale" not in calls, "drawn on the processor → sharpened ×2 at once, not the 10-minute ×4 (%s)" % calls)
    check("1024×1024" in page.locator("[data-testid=studio-result]").inner_text(), "the picture is 1024 px after the fast sharpen")
    up = page.locator("[data-testid=studio-upscale]")
    check(up.count() == 1 and "min" in up.inner_text(), "×4 shows its real time on this phone (%s)" % (up.inner_text() if up.count() else ""))
    up.click(); page.wait_for_selector("[data-testid=confirm]", timeout=3000)
    ctext = page.locator("[data-testid=confirm]").inner_text()
    check("minutes" in ctext and "Start ×4" in ctext and "Delete" not in ctext, "…and asks before starting, with its own buttons")
    page.locator("[data-testid=confirm-no]").click(); page.wait_for_timeout(200)
    check("upscale" not in [c[0] for c in page.evaluate("window.__mock.imgCalls")], "Cancel → nothing started")
    shot(page, "studio-fast")
    card = page.locator("[data-testid=studio-gpu-card]")
    check(card.count() == 1 and "graphics chip" in card.inner_text(), "on the processor with a graphics chip available → a clear card offers it")
    page.locator("[data-testid=studio-gpu-on]").click(); page.wait_for_timeout(200)
    check(page.evaluate("window.__mock.img.cpuOnly") is False and page.locator("[data-testid=studio-gpu-card]").count() == 0, "“Use the graphics chip” turns it back on")

    # ---- Deal Check: "Do you mean…?" ----
    OFFER = "iPhone 15 Pro 256GB 38,000 EGP, pay 12,400 now then 3 x 4,133"
    TERMS = json.dumps({"item": "iPhone 15 Pro 256GB", "kind": "installment", "price": 38000, "currency": "EGP", "cash_price": 38000, "down_payment": 12400,
                        "monthly": 4133, "months": 3, "fees": None, "seller": None, "claims": [], "text": OFFER, "unclear": ""})
    open_tool(page, "Deal Check", "deal")
    queue(page, [TERMS])
    page.locator("[data-testid=deal-input]").fill(OFFER)
    page.locator("[data-testid=deal-go]").click()
    page.wait_for_selector("[data-testid=deal-ask]", timeout=15000)
    reading = page.locator("[data-testid=deal-reading]").inner_text()
    check(reading.startswith("Do you mean:") and "38,000" in reading and "3 × 4,133" in reading, "the doubtful offer is shown back first: " + reading[:90])
    check(page.locator("[data-testid=deal-result]").count() == 0, "…before any verdict")
    shot(page, "deal-ask")
    # No → explain → read again with the explanation
    TERMS2 = json.dumps({"item": "iPhone 15 Pro 256GB", "kind": "installment", "price": 38000, "currency": "EGP", "cash_price": 38000, "down_payment": 12400,
                         "monthly": 8533, "months": 3, "fees": None, "seller": None, "claims": [], "text": OFFER, "unclear": ""})
    queue(page, [TERMS2, "Hi, is the price negotiable?"])
    page.locator("[data-testid=deal-no]").click()
    page.fill("[data-testid=deal-note]", "The price is 38,000. 12,400 is the down payment, then 3 payments of 8,533")
    page.locator("[data-testid=deal-note-go]").click()
    page.wait_for_selector("[data-testid=deal-result]", timeout=20000)
    b0 = json.dumps(sent(page)[0]["messages"])
    check("12,400 is the down payment" in b0, "the explanation went to the second reading")
    check(page.locator("[data-testid=deal-ask]").count() == 0, "…which isn't asked again")
    # Yes → goes straight on with the same reading (no second model reading)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)
    queue(page, [TERMS, "Hi, can we meet?"])
    page.locator("[data-testid=deal-go]").click()
    page.wait_for_selector("[data-testid=deal-ask]", timeout=15000)
    n0 = len(sent(page))
    page.locator("[data-testid=deal-yes]").click()
    page.wait_for_selector("[data-testid=deal-result]", timeout=20000)
    check(len(sent(page)) == n0 + 1, "Yes → the check goes on with that reading (only the reply is written)")
    shot(page, "deal-yes")

    check(not real_errors(errors), "no errors (%s)" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
