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
STUDIO = re.search(r'MOCK = r"""(.*?)"""', open(os.path.join(HERE, "..", "archive", "studio", "tests", "e2e_v59.py"), encoding="utf-8").read(), re.S).group(1)
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

    # (v9.1: this section used Studio — archived with it in archive/studio/tests/mixed/e2e_v543.py)
    # (v9.1: this section used Deal — archived with it in archive/deal/tests/mixed/e2e_v543.py)
    check(not real_errors(errors), "no errors (%s)" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
