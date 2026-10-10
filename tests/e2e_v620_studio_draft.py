"""v6.20 — Studio "Draft then clear" (Ali chose option A): a 384 px draft appears first, can be kept, and the
clear picture fades in on the same spot. The phone side is the Studio stand-in from e2e_v59.py, taught to send a
draft (stage "draftready") when the page asks for one (draftSide) and to wait until the test lets the clear pass go.

  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v620_studio_draft.py
"""
import os, re, base64
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish, HERE

STUDIO = re.search(r'MOCK = r"""(.*?)"""', open(os.path.join(HERE, "e2e_v59.py"), encoding="utf-8").read(), re.S).group(1)
EXTRA = r"""
(() => {
  const S = window.__mock;
  S.img.packs = [{ id: "turbo-xl", label: "Studio Turbo+", kind: "draw", files: {} }];
  S.img.gpuState = "cpu"; S.img.cpuOnly = true; S.deletedAll = []; S.release = false;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const P = (id, p, s, d) => window.__attuneNative.progress(id, p, s, d);
  const R = (id, o) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify(o)), 0);
  const J = (id, m) => setTimeout(() => window.__attuneNative.reject(id, m), 0);
  const install = () => {
    const N = window.AttuneNative; if (!N || !N.imagine) return setTimeout(install, 0);
    N.deleteImage = (f) => { S.deletedAll.push(f); return true; };
    N.cancelImage = (id) => { S.imgCancel[id] = true; };
    N.imagine = (id, arg) => { const a = JSON.parse(arg); S.lastImagine = a; S.imgCalls.push(["imagine", a]); (async () => {
      const n = (S.n = (S.n || 0) + 1);
      const pass = async () => { for (const [s, d] of [["load", "300/702"], ["prompt", ""], ["draw", "1/1"], ["develop", ""]]) { if (S.imgCancel[id]) return false; P(id, 0, s, d); await wait(40); } return true; };
      P(id, 0, "start", "");
      if (a.draftSide) {
        if (!(await pass())) return J(id, "Stopped");
        P(id, 0, "draftready", "img-" + n + "-d.png|384|384|9100");
        while (!S.release) { if (S.imgCancel[id]) return J(id, "Stopped"); await wait(30); }
      }
      if (!(await pass())) return J(id, "Stopped");
      R(id, { ok: true, file: "img-" + n + ".png", url: "https://appassets.androidplatform.net/studio/img-" + n + ".png", width: a.width, height: a.height, ms: 27000, backend: "CPU", seed: a.seed });
    })(); };
  };
  install();
})();
"""
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")
SHOTS = os.environ.get("ATTUNE_SHOTS", os.path.join(HERE, "shots-v620"))
os.makedirs(SHOTS, exist_ok=True)

env = Env()
errors = []

def serve_pics(ctx):
    ctx.route("https://appassets.androidplatform.net/studio/**", lambda r: r.fulfill(status=200, content_type="image/png", body=PNG))

def open_studio(page, name="Studio"):
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(f".rounded-t-2xl button:has-text('{name}')").first.click()
    page.wait_for_selector("[data-testid=studio-page]", timeout=6000)

def phase(page):
    el = page.locator("[data-testid=studio-flow]")
    return el.get_attribute("data-phase") if el.count() else None

def start(page, idea):
    page.evaluate("() => { window.__mock.release = false; window.__mock.imgCalls = []; }")
    page.fill("[data-testid=studio-idea]", idea)
    page.click("[data-testid=studio-go]")

INIT = STUDIO + "\n" + EXTRA + "\ntry { localStorage.setItem('attune:studio:hd', '0'); } catch (e) {}"
with sync_playwright() as pw:
    br = pw.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    serve_pics(ctx)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    open_studio(page)
    check(page.is_checked("[data-testid=studio-draft-on]") and not page.is_checked("[data-testid=studio-best2]"), "the quick draft is on by default; Best of 2 is off")

    print("--- draft → clear", flush=True)
    start(page, "a red crane lifting a steel beam at sunset")
    page.wait_for_selector("[data-testid=studio-flow]", timeout=5000)
    page.wait_for_function("() => document.querySelector('[data-testid=studio-flow]')?.dataset.phase === 'draft'", timeout=8000)
    li = page.evaluate("window.__mock.lastImagine")
    check(li["draftSide"] == 384 and li["width"] == 512 and li.get("seed") is not None, "one call: a 384 px draft, then 512 px, with one seed for both (%s)" % [li.get("draftSide"), li["width"], li.get("seed")])
    badge = page.locator("[data-testid=studio-flow-badge]").inner_text()
    check("384" in badge and "9 s" in badge, "the draft is shown with its size and time: " + badge)
    check(page.locator("[data-testid=studio-keep-draft]").count() == 1 and page.locator("[data-testid=studio-draft-img]").count() == 1, "the draft picture and Keep draft are there")
    left = page.locator("[data-testid=studio-flow-left]").inner_text()
    check(re.search(r"~\d+ s left", left) is not None, "an honest time left: " + left)
    page.screenshot(path=os.path.join(SHOTS, "studio-draft.png"))
    page.evaluate("window.__mock.release = true")
    page.wait_for_selector("[data-testid=studio-result]", timeout=8000)
    check(page.locator("[data-testid=studio-flow]").count() == 0 and page.locator("[data-testid=studio-fade-under]").count() == 1, "the clear picture takes the draft's place, fading in over it")
    check("img-1-d.png" in page.evaluate("window.__mock.deletedAll"), "the draft is not kept in the gallery (only the final)")
    g = page.evaluate("JSON.parse(localStorage.getItem('attune:studio:v1'))")
    check(g[0]["file"] == "img-1.png" and not any(x["file"].endswith("-d.png") for x in g) and g[0]["seed"] == li["seed"], "the gallery has the final, with the seed")
    page.wait_for_timeout(400)
    page.screenshot(path=os.path.join(SHOTS, "studio-done.png"))

    print("--- Keep draft", flush=True)
    start(page, "a felucca on the Nile")
    page.wait_for_function("() => document.querySelector('[data-testid=studio-flow]')?.dataset.phase === 'draft'", timeout=8000)
    page.click("[data-testid=studio-keep-draft]")
    page.wait_for_selector("[data-testid=studio-is-draft]", timeout=5000)
    g = page.evaluate("JSON.parse(localStorage.getItem('attune:studio:v1'))")
    check(g[0]["file"] == "img-2-d.png" and g[0].get("draft") is True and page.locator("[data-testid=studio-go]").count() == 1, "Keep draft stops the clear pass and keeps the draft as the picture")
    check(page.evaluate("Object.keys(window.__mock.imgCancel).length") >= 1, "…the engine is told to stop")

    print("--- Stop", flush=True)
    start(page, "a koshari plate")
    page.wait_for_function("() => document.querySelector('[data-testid=studio-flow]')?.dataset.phase === 'draft'", timeout=8000)
    page.click("[data-testid=studio-flow-stop]")
    page.wait_for_selector("[data-testid=studio-go]", timeout=5000)
    g = page.evaluate("JSON.parse(localStorage.getItem('attune:studio:v1'))")
    check(page.locator("[data-testid=studio-flow]").count() == 0 and g[0]["file"] == "img-2-d.png" and "img-3-d.png" in page.evaluate("window.__mock.deletedAll"),
          "Stop ends it: nothing new in the gallery, the draft file is removed")
    check(page.locator("[data-testid=studio-error]").count() == 0, "…and Stop shows no error")

    print("--- Best of 2", flush=True)
    page.check("[data-testid=studio-best2]")
    start(page, "a street in old Cairo")
    page.wait_for_function("() => document.querySelector('[data-testid=studio-flow]')?.dataset.phase === 'pick'", timeout=8000)
    calls = [c[1] for c in page.evaluate("window.__mock.imgCalls")]
    check(len(calls) == 2 and calls[0]["width"] == 384 and calls[1]["seed"] == calls[0]["seed"] + 1, "Best of 2: two 384 px drafts with neighbouring seeds")
    page.screenshot(path=os.path.join(SHOTS, "studio-best2.png"))
    page.click("[data-testid=studio-pick-1]")
    page.wait_for_selector("[data-testid=studio-result]", timeout=8000)
    li = page.evaluate("window.__mock.lastImagine")
    check(li["width"] == 512 and li["seed"] == calls[1]["seed"] and not li.get("draftSide"), "only the picked draft is made clear, with its seed")
    page.uncheck("[data-testid=studio-best2]")
    ctx.close()

    print("--- Arabic", flush=True)
    ctx, page = new_page(br, env, errors, extra_init=INIT + "\ntry{localStorage.setItem('attune:ui:lang','ar')}catch(e){}")
    serve_pics(ctx)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    open_studio(page, "الاستوديو")
    start(page, "ونش أحمر وقت الغروب")
    page.wait_for_function("() => document.querySelector('[data-testid=studio-flow]')?.dataset.phase === 'draft'", timeout=8000)
    frame = page.locator("[data-testid=studio-flow]").inner_text()
    check("مسودة" in frame and "احتفظ بالمسودة" in frame and "متبقٍ" in frame, "the draft frame speaks Arabic: " + frame.replace("\n", " | "))
    check(not re.search(r"[A-Za-z]", frame), "…with no Latin letters")
    page.screenshot(path=os.path.join(SHOTS, "studio-draft-ar.png"))
    page.evaluate("window.__mock.release = true")
    page.wait_for_selector("[data-testid=studio-result]", timeout=8000)
    ctx.close()
    br.close()
env.close()
re_ = real_errors(errors)
for e in re_[:20]: print("   ", e)
check(len(re_) == 0, "no JavaScript errors in the page (%d)" % len(re_))
finish()
